import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    assertWarehouseCapability,
    ensureWarehouseAccess,
} from '@/lib/server/warehouses';
import type {
    WarehouseDigitalEvidenceManifestItem,
    WarehouseDigitalEvidencePhoto,
    WarehouseDigitalEvidenceRecord,
    WarehouseDigitalEvidenceStage,
    WarehouseDigitalEvidenceStatus,
    WarehouseDigitalEvidenceTimelineEvent,
    WarehouseDispatchLine,
    WarehouseDispatchOrder,
} from '@/lib/warehouses/types';

interface RouteContext {
    params: Promise<{ id: string }>;
}

type Row = Record<string, unknown>;
type DispatchRow = Row & {
    id: string;
    dispatch_number?: string;
    status?: WarehouseDispatchOrder['status'];
    offer_id?: string | null;
    created_at?: string;
};
type DispatchLineRow = Row & { dispatch_order_id: string };

function asString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function asNumber(value: unknown): number {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function asBoolean(value: unknown) {
    return value === true || value === 'true' || value === 1;
}

function asRow(value: unknown): Row {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Row
        : {};
}

function asRows(value: unknown): Row[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            return asRows(JSON.parse(value));
        } catch {
            return [];
        }
    }

    return [];
}

function asStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .map((item) => typeof item === 'string' ? item.trim() : asString(asRow(item).url) || asString(asRow(item).publicUrl))
            .filter((item): item is string => Boolean(item));
    }

    const single = asString(value);
    return single ? [single] : [];
}

function mapByOfferId(rows: Row[]) {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
        const offerId = asString(row.offer_id);
        if (!offerId) continue;
        map.set(offerId, [...(map.get(offerId) || []), row]);
    }
    return map;
}

function getOfferDriverId(offer: Row | null) {
    if (!offer) return null;
    return asString(offer.private_fleet_trucker_id) || asString(offer.assigned_trucker_id);
}

function getOfferStatus(offer: Row | null) {
    return offer ? asString(offer.status) : null;
}

function buildEvidenceStatus(dispatchItem: DispatchRow, offer: Row | null): WarehouseDigitalEvidenceStatus {
    const offerStatus = getOfferStatus(offer);
    const assignmentStatus = offer ? asString(offer.private_fleet_assignment_status) : null;

    if (!offer) {
        return dispatchItem.status === 'cancelled' ? 'cancelled' : 'dispatch_only';
    }

    if (assignmentStatus === 'rejected' || asString(offer.private_fleet_rejected_at)) {
        return 'rejected';
    }

    if (offerStatus === 'cancelled') return 'cancelled';
    if (offerStatus === 'delivered' || offerStatus === 'completed' || asString(offer.delivery_verified_at)) return 'completed';
    if (offerStatus === 'in_transit' || asString(offer.pickup_verified_at)) return 'in_transit';
    if (assignmentStatus === 'accepted' || asString(offer.private_fleet_confirmed_at)) return 'accepted';
    if (offerStatus === 'assigned' || assignmentStatus === 'pending') return 'assigned';

    return 'blocked';
}

function normalizeDispatchLines(lines: DispatchLineRow[]) {
    return lines.map((line) => ({
        ...line,
        metadata: asRow(line.metadata),
    })) as WarehouseDispatchLine[];
}

function buildDispatchManifest(lines: WarehouseDispatchLine[]): WarehouseDigitalEvidenceManifestItem[] {
    return lines.map((line) => ({
        id: line.id,
        reference: line.sku_code_snapshot,
        name: line.sku_name_snapshot || line.sku_code_snapshot,
        expectedQty: asNumber(line.requested_qty),
        loadedQty: asNumber(line.picked_qty || line.dispatched_qty),
        deliveredQty: 0,
        rejectedQty: asNumber(line.rejected_qty),
        rejectionReason: asString(asRow(line.metadata).rejectionReason) || asString(asRow(line.metadata).rejection_reason),
        status: null,
    }));
}

function buildOfferManifest(offer: Row | null, fallbackLines: WarehouseDispatchLine[]) {
    const manifestRows = offer ? asRows(offer.manifest_items) : [];

    if (!manifestRows.length) {
        return buildDispatchManifest(fallbackLines);
    }

    return manifestRows.map((item, index) => {
        const id = asString(item.id) || asString(item.reference) || `manifest-${index + 1}`;
        const expectedQty = asNumber(item.quantity || item.expectedQty || item.expected_qty || 1);
        const loadedQty = asNumber(item.loadedQty || item.loaded_qty || item.pickedQty || item.picked_qty);
        const deliveredQty = asNumber(item.deliveredQty || item.delivered_qty);
        const rejectedQty = asNumber(
            item.rejectedQty
            || item.rejected_qty
            || item.loadRejectedQty
            || item.deliveryRejectedQty
            || item.delivery_rejected_qty
        );

        return {
            id,
            reference: asString(item.reference) || asString(item.skuCode) || asString(item.sku_code),
            name: asString(item.name) || asString(item.description) || asString(item.reference) || `Item ${index + 1}`,
            expectedQty,
            loadedQty: loadedQty || (asString(item.loadStatus) === 'loaded' ? expectedQty : 0),
            deliveredQty: deliveredQty || (asString(item.deliveryStatus) === 'delivered' ? expectedQty : 0),
            rejectedQty,
            rejectionReason: asString(item.rejectionReason) || asString(item.rejection_reason) || asString(item.loadRejectionReason),
            status: asString(item.deliveryStatus) || asString(item.loadStatus) || asString(item.status),
        };
    });
}

function stageFromEventType(eventType: string | null): WarehouseDigitalEvidenceStage {
    if (!eventType) return 'incident';
    if (eventType.includes('arrival_origin')) return 'origin';
    if (eventType.includes('loading') || eventType.includes('load') || eventType.includes('item_loaded')) return 'loading';
    if (eventType.includes('arrival_destination')) return 'destination';
    if (eventType.includes('delivery') || eventType.includes('unloading') || eventType.includes('delivered')) return 'delivery';
    if (eventType.includes('rejected') || eventType.includes('issue')) return 'incident';
    return 'incident';
}

function getPickingEventLabel(eventType: string | null) {
    const labels: Record<string, string> = {
        arrival_origin: 'Llegada a origen',
        loading_started: 'Carga iniciada',
        item_loaded: 'Item cargado',
        item_load_issue: 'Novedad en cargue',
        loading_completed: 'Carga completada',
        pickup_pin_verified: 'PIN de salida verificado',
        arrival_destination: 'Llegada a destino',
        unloading_started: 'Entrega iniciada',
        item_delivered: 'Item entregado',
        item_rejected: 'Item rechazado',
        unloading_completed: 'Entrega completada',
        delivery_pin_verified: 'PIN de entrega verificado',
    };

    if (!eventType) return 'Evento operativo';
    return labels[eventType] || eventType.replace(/_/g, ' ');
}

function getTimelineDetailLabel(value: string | null) {
    const labels: Record<string, string> = {
        accepted: 'Aceptado',
        cancelled: 'Cancelado',
        completed: 'Completado',
        dispatched: 'Despachado',
        draft: 'Borrador',
        in_transit: 'En ruta',
        paid_external: 'Pagado por fuera de KargaX',
        pending: 'Pendiente',
        proof_uploaded: 'Comprobante cargado',
        ready: 'Listo para salida',
        rejected: 'Rechazado',
        customer_refused: 'Cliente rechazo la entrega',
        damaged: 'Producto averiado',
        missing: 'Faltante',
        wrong_item: 'Referencia equivocada',
        other: 'Otro motivo',
    };

    if (!value) return null;
    return labels[value] || value;
}

function getPickingTimelineDetail(event: Row) {
    const parts = [
        asString(event.manifest_item_name),
        asString(event.notes),
        getTimelineDetailLabel(asString(event.rejection_reason)),
    ].filter((part, index, list): part is string => Boolean(part) && list.indexOf(part) === index);

    return parts.length ? parts.join(' / ') : null;
}

function addPhoto(
    photos: WarehouseDigitalEvidencePhoto[],
    seen: Set<string>,
    url: string | null,
    payload: {
        id: string;
        stage: WarehouseDigitalEvidenceStage;
        label: string;
        itemName?: string | null;
        notes?: string | null;
        rejectionReason?: string | null;
        createdAt?: string | null;
    }
) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    photos.push({
        id: payload.id,
        url,
        stage: payload.stage,
        label: payload.label,
        itemName: payload.itemName || null,
        notes: payload.notes || null,
        rejectionReason: payload.rejectionReason || null,
        createdAt: payload.createdAt || null,
    });
}

function buildPhotos(offer: Row | null, pickingEvents: Row[]) {
    const photos: WarehouseDigitalEvidencePhoto[] = [];
    const seen = new Set<string>();

    for (const tripPhoto of offer ? asRows(offer.trip_photos) : []) {
        const url = asString(tripPhoto.url) || asString(tripPhoto.publicUrl) || asString(tripPhoto.public_url);
        const stage = (asString(tripPhoto.stage) || asString(tripPhoto.type) || 'incident') as WarehouseDigitalEvidenceStage;
        addPhoto(photos, seen, url, {
            id: asString(tripPhoto.id) || `trip-photo-${photos.length + 1}`,
            stage,
            label: asString(tripPhoto.label) || 'Evidencia de viaje',
            itemName: asString(tripPhoto.itemName) || asString(tripPhoto.manifest_item_name),
            notes: asString(tripPhoto.notes),
            rejectionReason: asString(tripPhoto.rejectionReason) || asString(tripPhoto.rejection_reason),
            createdAt: asString(tripPhoto.createdAt) || asString(tripPhoto.created_at),
        });
    }

    for (const manifestItem of offer ? asRows(offer.manifest_items) : []) {
        const itemName = asString(manifestItem.name) || asString(manifestItem.reference);
        const groups: Array<{ key: string; stage: WarehouseDigitalEvidenceStage; label: string }> = [
            { key: 'loadPhotos', stage: 'loading', label: 'Foto de carga' },
            { key: 'deliveryPhotos', stage: 'delivery', label: 'Foto de entrega' },
            { key: 'rejectionPhotos', stage: 'incident', label: 'Foto de rechazo' },
            { key: 'photos', stage: 'incident', label: 'Evidencia' },
        ];

        for (const group of groups) {
            asStringList(manifestItem[group.key]).forEach((url, index) => addPhoto(photos, seen, url, {
                id: `${asString(manifestItem.id) || itemName || 'item'}-${group.key}-${index}`,
                stage: group.stage,
                label: group.label,
                itemName,
                notes: asString(manifestItem.notes),
                rejectionReason: asString(manifestItem.rejectionReason) || asString(manifestItem.rejection_reason),
                createdAt: asString(manifestItem.updatedAt) || asString(manifestItem.updated_at),
            }));
        }
    }

    for (const event of pickingEvents) {
        const eventType = asString(event.event_type);
        const stage = stageFromEventType(eventType);
        asStringList(event.photo_urls).forEach((url, index) => addPhoto(photos, seen, url, {
            id: `${asString(event.id) || 'event'}-${index}`,
            stage,
            label: getPickingEventLabel(eventType),
            itemName: asString(event.manifest_item_name),
            notes: asString(event.notes),
            rejectionReason: getTimelineDetailLabel(asString(event.rejection_reason)),
            createdAt: asString(event.created_at),
        }));
    }

    return photos;
}

function buildSignatures(rows: Row[]) {
    return rows.map((signature, index) => ({
        id: asString(signature.id) || `signature-${index + 1}`,
        stage: asString(signature.signature_stage) || 'signature',
        signerName: asString(signature.signer_name),
        signerDocumentId: asString(signature.signer_document_id),
        signerRole: asString(signature.signer_role),
        publicUrl: asString(signature.public_url),
        createdAt: asString(signature.created_at),
    }));
}

function buildSignatureRequirements(destinationType: 'final_customer' | 'warehouse', signatures: ReturnType<typeof buildSignatures>) {
    const signatureByStage = new Map(signatures.map((signature) => [signature.stage, signature]));
    const requirements = destinationType === 'warehouse'
        ? [
            { stage: 'origin_warehouse_release', label: 'Bodeguero origen entrega', signerRole: 'warehouse_manager' as const, captureSurface: 'warehouse_panel' as const },
            { stage: 'origin_driver_acceptance', label: 'Conductor recibe en origen', signerRole: 'other' as const, captureSurface: 'driver_app' as const },
            { stage: 'destination_driver_handoff', label: 'Conductor entrega en destino', signerRole: 'other' as const, captureSurface: 'driver_app' as const },
            { stage: 'destination_warehouse_receipt', label: 'Bodeguero destino recibe', signerRole: 'warehouse_manager' as const, captureSurface: 'warehouse_panel' as const },
        ]
        : [
            { stage: 'origin_dispatch', label: 'Firma en origen', signerRole: 'warehouse_manager' as const, captureSurface: 'legacy' as const },
            { stage: 'delivery_pod', label: 'Firma receptor/POD', signerRole: 'receiver' as const, captureSurface: 'legacy' as const },
        ];

    return requirements.map((requirement) => {
        const signature = signatureByStage.get(requirement.stage) || null;
        return {
            ...requirement,
            required: true,
            completed: Boolean(signature),
            signature,
        };
    });
}

function timelineEvent(
    id: string,
    stage: WarehouseDigitalEvidenceStage,
    label: string,
    source: WarehouseDigitalEvidenceTimelineEvent['source'],
    timestamp: string | null,
    detail: string | null,
    status: WarehouseDigitalEvidenceTimelineEvent['status'] = timestamp ? 'complete' : 'pending'
): WarehouseDigitalEvidenceTimelineEvent {
    return { id, stage, label, source, timestamp, detail, status };
}

function getSignatureTimelineLabel(stage: string) {
    const labels: Record<string, string> = {
        origin_dispatch: 'Firma origen registrada',
        delivery_pod: 'Firma receptor/POD registrada',
        origin_warehouse_release: 'Bodeguero origen entrego custodia',
        origin_driver_acceptance: 'Conductor recibio custodia en origen',
        destination_driver_handoff: 'Conductor entrego custodia en destino',
        destination_warehouse_receipt: 'Bodeguero destino recibio custodia',
    };

    return labels[stage] || 'Firma registrada';
}

function buildTimeline(
    dispatchItem: DispatchRow,
    offer: Row | null,
    pickingEvents: Row[],
    signatures: ReturnType<typeof buildSignatures>,
    trackingSessions: Row[],
    paymentRows: Row[]
) {
    const events: WarehouseDigitalEvidenceTimelineEvent[] = [
        timelineEvent('dispatch-created', 'dispatch', 'Orden de despacho creada', 'dispatch', asString(dispatchItem.created_at), asString(dispatchItem.dispatch_number)),
        timelineEvent('dispatch-confirmed', 'dispatch', 'Salida de bodega confirmada', 'dispatch', asString(dispatchItem.dispatched_at) || asString(dispatchItem.confirmed_at), getTimelineDetailLabel(asString(dispatchItem.status))),
    ];

    if (offer) {
        const assignmentStatus = asString(offer.private_fleet_assignment_status);
        events.push(
            timelineEvent('trip-created', 'assignment', 'Viaje enlazado', 'offer', asString(offer.created_at), asString(offer.id)),
            timelineEvent('trip-accepted', 'assignment', 'Conductor acepto viaje', 'offer', asString(offer.private_fleet_confirmed_at), getTimelineDetailLabel(assignmentStatus)),
            timelineEvent('arrival-origin', 'origin', 'Llegada a origen', 'offer', asString(offer.arrived_at_origin_at), null),
            timelineEvent('loading-started', 'loading', 'Carga iniciada', 'offer', asString(offer.loading_started_at), null),
            timelineEvent('pickup-pin', 'pickup_pin', 'PIN salida verificado', 'offer', asString(offer.pickup_verified_at), null),
            timelineEvent('tracking-started', 'tracking', 'Tracking activo', 'tracking', trackingSessions.length ? asString(trackingSessions[0]?.started_at) : null, `${trackingSessions.length} sesiones`),
            timelineEvent('arrival-destination', 'destination', 'Llegada a destino', 'offer', asString(offer.arrived_at_destination_at), null),
            timelineEvent('unloading-started', 'delivery', 'Entrega iniciada', 'offer', asString(offer.unloading_started_at), null),
            timelineEvent('delivery-pin', 'delivery_pin', 'PIN entrega verificado', 'offer', asString(offer.delivery_verified_at), null),
        );

        if (asString(offer.private_fleet_rejected_at) || assignmentStatus === 'rejected') {
            events.push(timelineEvent(
                'trip-rejected',
                'assignment',
                'Viaje rechazado',
                'offer',
                asString(offer.private_fleet_rejected_at),
                getTimelineDetailLabel(asString(offer.private_fleet_rejection_reason)),
                'rejected'
            ));
        }

        for (const signature of signatures) {
            events.push(timelineEvent(
                `signature-${signature.id}`,
                'signature',
                getSignatureTimelineLabel(signature.stage),
                'signature',
                signature.createdAt,
                signature.signerName
            ));
        }

        for (const event of pickingEvents) {
            const eventType = asString(event.event_type);
            events.push(timelineEvent(
                `picking-${asString(event.id) || events.length}`,
                stageFromEventType(eventType),
                getPickingEventLabel(eventType),
                'picking',
                asString(event.created_at),
                getPickingTimelineDetail(event),
                eventType?.includes('rejected') || eventType?.includes('issue') ? 'warning' : 'complete'
            ));
        }

        for (const payment of paymentRows) {
            events.push(timelineEvent(
                `payment-${asString(payment.id) || events.length}`,
                'financial',
                'Pago / custodia actualizado',
                'payment',
                asString(payment.completed_at) || asString(payment.updated_at) || asString(payment.created_at),
                getTimelineDetailLabel(asString(payment.status))
            ));
        }
    }

    return events.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
}

function buildTracking(sessions: Row[], pings: Row[]) {
    const normalizedSessions = sessions.map((session) => ({
        id: asString(session.id) || crypto.randomUUID(),
        status: asString(session.status) || 'unknown',
        source: asString(session.source),
        startedAt: asString(session.started_at),
        stoppedAt: asString(session.stopped_at),
        lastPingAt: asString(session.last_ping_at),
        lastLatitude: asNumber(session.last_latitude) || null,
        lastLongitude: asNumber(session.last_longitude) || null,
        lastAccuracyMeters: asNumber(session.last_accuracy_meters) || null,
    }));
    const normalizedPings = pings.map((ping) => ({
        id: asString(ping.id) || crypto.randomUUID(),
        sessionId: asString(ping.session_id),
        latitude: asNumber(ping.latitude) || null,
        longitude: asNumber(ping.longitude) || null,
        accuracyMeters: asNumber(ping.accuracy_meters) || null,
        capturedAt: asString(ping.captured_at),
    }));

    return {
        sessionCount: normalizedSessions.length,
        active: normalizedSessions.some((session) => session.status === 'active'),
        sessions: normalizedSessions,
        latestPing: normalizedPings[0] || null,
        pings: normalizedPings.slice(0, 20),
    };
}

function buildFinancial(offer: Row | null, payments: Row[], allocations: Row[]) {
    const latestPayment = payments[0] || {};
    const latestAllocation = allocations[0] || {};

    return {
        paymentStatus: asString(latestPayment.status) || asString(offer?.private_payment_status),
        freightAmount: asNumber(offer?.freight_payment_amount || offer?.total_amount || offer?.net_amount),
        expenseAmount: asNumber(offer?.expense_allowance_amount),
        releasedAt: asString(latestAllocation.released_at),
        allocationStatus: asString(latestAllocation.status),
    };
}

function hasMissingEvidence(offer: Row | null, signatures: ReturnType<typeof buildSignatures>, photos: WarehouseDigitalEvidencePhoto[]) {
    if (!offer) return false;
    const delivered = Boolean(asString(offer.delivery_verified_at) || getOfferStatus(offer) === 'delivered' || getOfferStatus(offer) === 'completed');
    const destinationType = asString(offer.destination_warehouse_id) ? 'warehouse' : 'final_customer';

    if (destinationType === 'warehouse') {
        const requiredStages = ['origin_warehouse_release', 'origin_driver_acceptance', 'destination_driver_handoff', 'destination_warehouse_receipt'];
        return requiredStages.some((stage) => !signatures.some((signature) => signature.stage === stage));
    }

    const hasOriginSignature = signatures.some((signature) => signature.stage === 'origin_dispatch');
    const hasDestinationSignature = signatures.some((signature) => signature.stage === 'delivery_pod');
    const hasPickupPin = Boolean(asString(offer.pickup_verified_at));
    const hasDeliveryPin = Boolean(asString(offer.delivery_verified_at));

    return delivered
        ? !(hasOriginSignature && hasDestinationSignature && hasPickupPin && hasDeliveryPin)
        : photos.length === 0 && signatures.length === 0;
}

function buildRecord(payload: {
    dispatchItem: DispatchRow;
    lines: DispatchLineRow[];
    offer: Row | null;
    pickingEvents: Row[];
    signatureRows: Row[];
    trackingSessions: Row[];
    trackingPings: Row[];
    payments: Row[];
    allocations: Row[];
    profileMap: Map<string, Row>;
    fleetMap: Map<string, Row>;
    warehouseMap: Map<string, Row>;
    transferReceipt: Row | null;
    warehouse: {
        id?: string;
        code?: string;
        name?: string;
        address: string;
        city: string;
        department: string;
    };
}): WarehouseDigitalEvidenceRecord {
    const { dispatchItem, offer, profileMap, fleetMap } = payload;
    const lines = normalizeDispatchLines(payload.lines);
    const driverId = getOfferDriverId(offer);
    const profile = driverId ? profileMap.get(driverId) || {} : {};
    const fleetMember = driverId ? fleetMap.get(driverId) || {} : {};
    const manifestItems = buildOfferManifest(offer, lines);
    const signatures = buildSignatures(payload.signatureRows);
    const destinationType = offer && asString(offer.destination_warehouse_id) ? 'warehouse' : 'final_customer';
    const originWarehouseId = offer ? asString(offer.origin_warehouse_id) : null;
    const destinationWarehouseId = offer ? asString(offer.destination_warehouse_id) : null;
    const originWarehouse = originWarehouseId ? payload.warehouseMap.get(originWarehouseId) || null : null;
    const destinationWarehouse = destinationWarehouseId ? payload.warehouseMap.get(destinationWarehouseId) || null : null;
    const signatureRequirements = buildSignatureRequirements(destinationType, signatures);
    const photos = buildPhotos(offer, payload.pickingEvents);
    const expected = manifestItems.reduce((sum, item) => sum + item.expectedQty, 0);
    const loaded = manifestItems.reduce((sum, item) => sum + item.loadedQty, 0);
    const delivered = manifestItems.reduce((sum, item) => sum + item.deliveredQty, 0);
    const rejected = manifestItems.reduce((sum, item) => sum + item.rejectedQty, 0);
    const assignmentStatus = offer ? asString(offer.private_fleet_assignment_status) as 'pending' | 'accepted' | 'rejected' | null : null;
    const rejectedAt = offer ? asString(offer.private_fleet_rejected_at) : null;
    const rejectedById = offer ? asString(offer.private_fleet_rejected_by) : null;
    const rejectedBy = rejectedById ? profileMap.get(rejectedById) || {} : {};

    return {
        id: dispatchItem.id,
        destinationType,
        dispatch: {
            id: dispatchItem.id,
            number: asString(dispatchItem.dispatch_number) || dispatchItem.id.slice(0, 8),
            status: dispatchItem.status || 'draft',
            scheduledAt: asString(dispatchItem.scheduled_at),
            dispatchedAt: asString(dispatchItem.dispatched_at),
            confirmedAt: asString(dispatchItem.confirmed_at),
            createdAt: asString(dispatchItem.created_at) || new Date().toISOString(),
            notes: asString(dispatchItem.notes),
            tripCreationStatus: asString(dispatchItem.trip_creation_status),
            tripCreationError: asString(dispatchItem.trip_creation_error),
            dispatchTripMode: asString(dispatchItem.dispatch_trip_mode),
            lines,
        },
        offer: offer ? {
            id: asString(offer.id) || '',
            status: getOfferStatus(offer),
            isPrivateFleet: asBoolean(offer.is_private_fleet),
            sourceDispatchId: asString(offer.source_dispatch_id),
            cargoDescription: asString(offer.cargo_description) || asString(offer.description) || asString(offer.title),
            createdAt: asString(offer.created_at),
            pickupVerified: Boolean(asString(offer.pickup_verified_at)),
            deliveryVerified: Boolean(asString(offer.delivery_verified_at)),
        } : null,
        driver: {
            id: driverId,
            name: asString(profile.full_name) || asString(profile.email),
            email: asString(profile.email),
            phone: asString(profile.phone),
            vehiclePlate: asString(fleetMember.vehicle_plate),
            internalDriverId: asString(fleetMember.internal_driver_id),
            assignmentStatus,
            acceptedAt: offer ? asString(offer.private_fleet_confirmed_at) : null,
            rejectedAt,
            rejectionReason: offer ? asString(offer.private_fleet_rejection_reason) : null,
        },
        route: {
            originAddress: offer ? asString(offer.origin_address) : payload.warehouse.address,
            originCity: offer ? asString(offer.origin_city) : payload.warehouse.city,
            originDepartment: offer ? asString(offer.origin_department) : payload.warehouse.department,
            destinationAddress: offer ? asString(offer.destination_address) : null,
            destinationCity: offer ? asString(offer.destination_city) : null,
            destinationDepartment: offer ? asString(offer.destination_department) : null,
        },
        originWarehouse: originWarehouse ? {
            id: asString(originWarehouse.id) || '',
            code: asString(originWarehouse.code) || '',
            name: asString(originWarehouse.name) || '',
            city: asString(originWarehouse.city) || '',
            department: asString(originWarehouse.department) || '',
            address: asString(originWarehouse.address) || '',
        } : {
            id: asString(payload.warehouse.id) || '',
            code: asString(payload.warehouse.code) || '',
            name: asString(payload.warehouse.name) || '',
            city: payload.warehouse.city,
            department: payload.warehouse.department,
            address: payload.warehouse.address,
        },
        destinationWarehouse: destinationWarehouse ? {
            id: asString(destinationWarehouse.id) || '',
            code: asString(destinationWarehouse.code) || '',
            name: asString(destinationWarehouse.name) || '',
            city: asString(destinationWarehouse.city) || '',
            department: asString(destinationWarehouse.department) || '',
            address: asString(destinationWarehouse.address) || '',
        } : null,
        transferReceipt: payload.transferReceipt ? {
            id: asString(payload.transferReceipt.id) || '',
            number: asString(payload.transferReceipt.receipt_number) || '',
            status: (asString(payload.transferReceipt.status) || 'draft') as 'draft' | 'received' | 'closed' | 'cancelled',
            warehouseId: asString(payload.transferReceipt.warehouse_id) || '',
            createdAt: asString(payload.transferReceipt.created_at),
            receivedAt: asString(payload.transferReceipt.received_at),
        } : null,
        status: buildEvidenceStatus(dispatchItem, offer),
        timestamps: {
            createdAt: asString(dispatchItem.created_at),
            scheduledAt: asString(dispatchItem.scheduled_at),
            dispatchedAt: asString(dispatchItem.dispatched_at),
            acceptedAt: offer ? asString(offer.private_fleet_confirmed_at) : null,
            rejectedAt,
            arrivedOriginAt: offer ? asString(offer.arrived_at_origin_at) : null,
            loadingStartedAt: offer ? asString(offer.loading_started_at) : null,
            pickupVerifiedAt: offer ? asString(offer.pickup_verified_at) : null,
            arrivedDestinationAt: offer ? asString(offer.arrived_at_destination_at) : null,
            unloadingStartedAt: offer ? asString(offer.unloading_started_at) : null,
            deliveryVerifiedAt: offer ? asString(offer.delivery_verified_at) : null,
            closedAt: offer ? asString(offer.delivery_verified_at) || asString(offer.updated_at) : asString(dispatchItem.confirmed_at),
        },
        manifestSummary: {
            expected,
            loaded,
            delivered,
            rejected,
            lineCount: manifestItems.length,
            photoCount: photos.length,
            signatureCount: signatures.length,
            hasMissingEvidence: hasMissingEvidence(offer, signatures, photos),
            items: manifestItems,
        },
        signatures,
        signatureRequirements,
        photos,
        timeline: buildTimeline(dispatchItem, offer, payload.pickingEvents, signatures, payload.trackingSessions, payload.payments),
        tracking: buildTracking(payload.trackingSessions, payload.trackingPings),
        financial: buildFinancial(offer, payload.payments, payload.allocations),
        rejection: {
            rejected: Boolean(rejectedAt || assignmentStatus === 'rejected'),
            rejectedAt,
            reason: offer ? asString(offer.private_fleet_rejection_reason) : null,
            rejectedBy: asString(rejectedBy.full_name) || asString(rejectedBy.email),
        },
    };
}

function matchesStatusFilter(record: WarehouseDigitalEvidenceRecord, filter: string | null) {
    if (!filter || filter === 'all') return true;
    if (filter === 'in_route') return record.status === 'in_transit' || record.tracking.active;
    if (filter === 'completed') return record.status === 'completed';
    if (filter === 'rejected') return record.status === 'rejected' || record.rejection.rejected;
    if (filter === 'missing') return record.manifestSummary.hasMissingEvidence;
    if (filter === 'no_signature') return Boolean(record.offer) && record.signatures.length === 0;
    return true;
}

function matchesQuery(record: WarehouseDigitalEvidenceRecord, query: string | null) {
    if (!query) return true;
    const haystack = [
        record.dispatch.number,
        record.dispatch.id,
        record.offer?.id,
        record.driver.name,
        record.driver.vehiclePlate,
        record.route.originCity,
        record.route.destinationCity,
        record.route.destinationAddress,
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(query.toLowerCase());
}

export async function GET(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const { supabaseAdmin, authUser, profile } = auth.context;
    const access = await ensureWarehouseAccess(supabaseAdmin, authUser.id, profile, id);

    if (!access) {
        return apiError('Warehouse not found or access denied', {
            status: 404,
            code: 'WAREHOUSE_ACCESS_DENIED',
            requestId,
        });
    }

    try {
        assertWarehouseCapability(access, 'viewEvidence', 'This warehouse role cannot view digital evidence.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse evidence access denied', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = asString(searchParams.get('status'));
    const query = asString(searchParams.get('q'));

    const { data: destinationTransferOffers, error: destinationTransferError } = await supabaseAdmin
        .from('cargo_offers')
        .select('id, source_dispatch_id')
        .eq('destination_warehouse_id', id)
        .not('source_dispatch_id', 'is', null);

    if (destinationTransferError) {
        return apiError(destinationTransferError.message, {
            status: 500,
            code: 'WAREHOUSE_DIGITAL_EVIDENCE_DESTINATION_LOAD_FAILED',
            requestId,
        });
    }

    const destinationDispatchIds = ((destinationTransferOffers || []) as Row[])
        .map((offer) => asString(offer.source_dispatch_id))
        .filter((dispatchId): dispatchId is string => Boolean(dispatchId));

    const { data: originDispatches, error: dispatchError } = await supabaseAdmin
        .from('warehouse_dispatch_orders')
        .select('*')
        .eq('warehouse_id', id)
        .order('created_at', { ascending: false });

    if (dispatchError) {
        return apiError(dispatchError.message, {
            status: 500,
            code: 'WAREHOUSE_DIGITAL_EVIDENCE_DISPATCH_LOAD_FAILED',
            requestId,
        });
    }

    const { data: destinationDispatches, error: destinationDispatchError } = destinationDispatchIds.length
        ? await supabaseAdmin
            .from('warehouse_dispatch_orders')
            .select('*')
            .in('id', destinationDispatchIds)
        : { data: [] as DispatchRow[], error: null };

    if (destinationDispatchError) {
        return apiError(destinationDispatchError.message, {
            status: 500,
            code: 'WAREHOUSE_DIGITAL_EVIDENCE_DESTINATION_DISPATCH_LOAD_FAILED',
            requestId,
        });
    }

    const dispatchRows = Array.from(new Map(
        [...(originDispatches || []), ...(destinationDispatches || [])]
            .map((dispatchItem) => [dispatchItem.id, dispatchItem as DispatchRow])
    ).values()).sort((left, right) => (
        new Date(asString(right.created_at) || 0).getTime() - new Date(asString(left.created_at) || 0).getTime()
    ));
    const dispatchIds = dispatchRows.map((dispatchItem) => dispatchItem.id);
    const directOfferIds = dispatchRows
        .map((dispatchItem) => asString(dispatchItem.offer_id))
        .filter((offerId): offerId is string => Boolean(offerId));

    const { data: lineRows, error: lineError } = dispatchIds.length
        ? await supabaseAdmin
            .from('warehouse_dispatch_lines')
            .select('*, sku:warehouse_skus(*), location:warehouse_locations(*)')
            .in('dispatch_order_id', dispatchIds)
        : { data: [] as DispatchLineRow[], error: null };

    if (lineError) {
        return apiError(lineError.message, {
            status: 500,
            code: 'WAREHOUSE_DIGITAL_EVIDENCE_LINES_LOAD_FAILED',
            requestId,
        });
    }

    const lineMap = new Map<string, DispatchLineRow[]>();
    for (const line of (lineRows || []) as DispatchLineRow[]) {
        lineMap.set(line.dispatch_order_id, [...(lineMap.get(line.dispatch_order_id) || []), line]);
    }

    const sourceOfferQuery = dispatchIds.length
        ? await supabaseAdmin
            .from('cargo_offers')
            .select('*')
            .in('source_dispatch_id', dispatchIds)
        : { data: [] as Row[], error: null };

    const directOfferQuery = directOfferIds.length
        ? await supabaseAdmin
            .from('cargo_offers')
            .select('*')
            .in('id', directOfferIds)
        : { data: [] as Row[], error: null };

    if (sourceOfferQuery.error || directOfferQuery.error) {
        return apiError(sourceOfferQuery.error?.message || directOfferQuery.error?.message || 'Could not load trip evidence', {
            status: 500,
            code: 'WAREHOUSE_DIGITAL_EVIDENCE_TRIPS_LOAD_FAILED',
            requestId,
        });
    }

    const offers = [...(sourceOfferQuery.data || []), ...(directOfferQuery.data || [])] as Row[];
    const offerMap = new Map<string, Row>();
    const offerByDispatch = new Map<string, Row>();

    for (const offer of offers) {
        const offerId = asString(offer.id);
        const sourceDispatchId = asString(offer.source_dispatch_id);
        if (offerId) offerMap.set(offerId, offer);
        if (sourceDispatchId) offerByDispatch.set(sourceDispatchId, offer);
    }

    const offerIds = Array.from(offerMap.keys());
    const warehouseIds = Array.from(new Set([
        id,
        ...offers.flatMap((offer) => [asString(offer.origin_warehouse_id), asString(offer.destination_warehouse_id)]),
    ].filter((warehouseId): warehouseId is string => Boolean(warehouseId))));
    const [pickingQuery, signatureQuery, trackingSessionQuery, trackingPingQuery, paymentQuery, allocationQuery, receiptQuery, warehouseQuery] = await Promise.all([
        offerIds.length
            ? supabaseAdmin.from('picking_events').select('*').in('offer_id', offerIds).order('created_at', { ascending: true })
            : Promise.resolve({ data: [] as Row[], error: null }),
        offerIds.length
            ? supabaseAdmin.from('trip_signature_evidences').select('*').in('offer_id', offerIds).order('created_at', { ascending: true })
            : Promise.resolve({ data: [] as Row[], error: null }),
        offerIds.length
            ? supabaseAdmin.from('trip_tracking_sessions').select('*').in('offer_id', offerIds).order('started_at', { ascending: true })
            : Promise.resolve({ data: [] as Row[], error: null }),
        offerIds.length
            ? supabaseAdmin.from('trip_location_pings').select('*').in('offer_id', offerIds).order('captured_at', { ascending: false }).limit(250)
            : Promise.resolve({ data: [] as Row[], error: null }),
        offerIds.length
            ? supabaseAdmin.from('payments').select('*').in('offer_id', offerIds).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as Row[], error: null }),
        offerIds.length
            ? supabaseAdmin.from('trip_financial_allocations').select('*').in('offer_id', offerIds).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as Row[], error: null }),
        offerIds.length
            ? supabaseAdmin.from('warehouse_receipts').select('*').in('offer_id', offerIds).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as Row[], error: null }),
        warehouseIds.length
            ? supabaseAdmin.from('warehouses').select('id, code, name, city, department, address').in('id', warehouseIds)
            : Promise.resolve({ data: [] as Row[], error: null }),
    ]);

    const secondaryError = pickingQuery.error
        || signatureQuery.error
        || trackingSessionQuery.error
        || trackingPingQuery.error
        || paymentQuery.error
        || allocationQuery.error
        || receiptQuery.error
        || warehouseQuery.error;

    if (secondaryError) {
        return apiError(secondaryError.message, {
            status: 500,
            code: 'WAREHOUSE_DIGITAL_EVIDENCE_DETAIL_LOAD_FAILED',
            requestId,
        });
    }

    const pickingByOffer = mapByOfferId((pickingQuery.data || []) as Row[]);
    const signaturesByOffer = mapByOfferId((signatureQuery.data || []) as Row[]);
    const sessionsByOffer = mapByOfferId((trackingSessionQuery.data || []) as Row[]);
    const pingsByOffer = mapByOfferId((trackingPingQuery.data || []) as Row[]);
    const paymentsByOffer = mapByOfferId((paymentQuery.data || []) as Row[]);
    const allocationsByOffer = mapByOfferId((allocationQuery.data || []) as Row[]);
    const receiptsByOffer = mapByOfferId((receiptQuery.data || []) as Row[]);
    const warehouseMap = new Map<string, Row>();
    for (const warehouseRow of (warehouseQuery.data || []) as Row[]) {
        const warehouseId = asString(warehouseRow.id);
        if (warehouseId) warehouseMap.set(warehouseId, warehouseRow);
    }
    const driverIds = Array.from(new Set(offers.flatMap((offer) => [
        getOfferDriverId(offer),
        asString(offer.private_fleet_rejected_by),
    ]).filter((driverId): driverId is string => Boolean(driverId))));

    const [profileQuery, fleetQuery] = await Promise.all([
        driverIds.length
            ? supabaseAdmin.from('user_profiles').select('id, full_name, email, phone').in('id', driverIds)
            : Promise.resolve({ data: [] as Row[], error: null }),
        driverIds.length
            ? supabaseAdmin
                .from('business_fleet_members')
                .select('trucker_id, internal_driver_id, vehicle_plate, status, default_compensation_mode')
                .eq('business_id', access.warehouse.business_id)
                .in('trucker_id', driverIds)
            : Promise.resolve({ data: [] as Row[], error: null }),
    ]);

    if (profileQuery.error || fleetQuery.error) {
        return apiError(profileQuery.error?.message || fleetQuery.error?.message || 'Could not load driver evidence', {
            status: 500,
            code: 'WAREHOUSE_DIGITAL_EVIDENCE_DRIVER_LOAD_FAILED',
            requestId,
        });
    }

    const profileMap = new Map<string, Row>();
    for (const row of (profileQuery.data || []) as Row[]) {
        const profileId = asString(row.id);
        if (profileId) profileMap.set(profileId, row);
    }

    const fleetMap = new Map<string, Row>();
    for (const row of (fleetQuery.data || []) as Row[]) {
        const truckerId = asString(row.trucker_id);
        if (truckerId) fleetMap.set(truckerId, row);
    }

    const records = dispatchRows
        .map((dispatchItem) => {
            const offer = (asString(dispatchItem.offer_id) ? offerMap.get(asString(dispatchItem.offer_id) || '') : null)
                || offerByDispatch.get(dispatchItem.id)
                || null;
            const offerId = offer ? asString(offer.id) || '' : '';

            return buildRecord({
                dispatchItem,
                lines: lineMap.get(dispatchItem.id) || [],
                offer,
                pickingEvents: offerId ? pickingByOffer.get(offerId) || [] : [],
                signatureRows: offerId ? signaturesByOffer.get(offerId) || [] : [],
                trackingSessions: offerId ? sessionsByOffer.get(offerId) || [] : [],
                trackingPings: offerId ? pingsByOffer.get(offerId) || [] : [],
                payments: offerId ? paymentsByOffer.get(offerId) || [] : [],
                allocations: offerId ? allocationsByOffer.get(offerId) || [] : [],
                profileMap,
                fleetMap,
                warehouseMap,
                transferReceipt: offerId ? receiptsByOffer.get(offerId)?.[0] || null : null,
                warehouse: access.warehouse,
            });
        })
        .filter((record) => matchesStatusFilter(record, statusFilter))
        .filter((record) => matchesQuery(record, query));

    return apiSuccess({ data: records }, {
        code: 'WAREHOUSE_DIGITAL_EVIDENCE_LOADED',
        requestId,
        meta: {
            warehouseId: id,
            count: records.length,
        },
    });
}
