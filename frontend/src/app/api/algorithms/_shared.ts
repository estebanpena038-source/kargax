import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateDeliveryFailureRisk } from '@/algorithms/lastmile/deliveryRisk';
import { validateEvidenceQuality } from '@/algorithms/evidence/evidenceQuality';
import { distanceKm, hasValidCoordinates } from '@/algorithms/shared/geo';
import type {
    DeliveryRiskResult,
    EvidenceQualityResult,
    ExecutiveAlert,
    NextBestAction,
    OperationRail,
} from '@/algorithms/shared/types';
import type { BusinessRolePolicy } from '@/lib/server/role-policy';

export type Row = Record<string, unknown>;
export type SnapshotPersistence = 'stored' | 'skipped';

const DELIVERY_SIGNATURE_STAGES = new Set([
    'delivery_pod',
    'destination_driver_handoff',
    'destination_warehouse_receipt',
]);

const OPEN_INCIDENT_STATUSES = new Set(['open', 'new', 'reported', 'investigating', 'in_progress', 'pending']);
const CRITICAL_INCIDENT_SEVERITIES = new Set(['high', 'critical']);

const OFFER_SELECT = [
    'id',
    'business_id',
    'status',
    'cargo_type',
    'origin_department',
    'origin_city',
    'origin_address',
    'origin_latitude',
    'origin_longitude',
    'destination_department',
    'destination_city',
    'destination_address',
    'destination_latitude',
    'destination_longitude',
    'pickup_date',
    'delivery_date',
    'is_private_fleet',
    'assigned_trucker_id',
    'private_fleet_trucker_id',
    'private_fleet_assignment_status',
    'private_fleet_confirmed_at',
    'pickup_verified_at',
    'delivery_verified_at',
    'manifest_items',
    'manifest_loaded_count',
    'manifest_delivered_count',
    'manifest_rejected_count',
    'trip_photos',
    'delivery_contact_name',
    'private_payment_status',
    'created_at',
    'updated_at',
].join(', ');

export interface OfferAlgorithmRecord {
    offerId: string;
    businessId: string;
    status: string | null;
    rail: OperationRail;
    cargoType: string | null;
    originLabel: string;
    destinationLabel: string;
    updatedAt: string | null;
    risk: DeliveryRiskResult;
    evidence: EvidenceQualityResult;
}

export interface AlgorithmOverviewData {
    generatedAt: string;
    businessId: string;
    role: string;
    summary: {
        evaluatedOffers: number;
        criticalRisks: number;
        highRisks: number;
        incompleteEvidence: number;
        nextActions: number;
        executiveAlerts: number;
    };
    deliveryRisks: OfferAlgorithmRecord[];
    nextBestActions: NextBestAction[];
    executiveAlerts: ExecutiveAlert[];
    snapshotPersistence: SnapshotPersistence;
}

export interface EvidenceValidationData {
    generatedAt: string;
    businessId: string;
    role: string;
    offer: {
        id: string;
        status: string | null;
        rail: OperationRail;
        route: string;
    };
    evidence: EvidenceQualityResult;
    snapshotPersistence: SnapshotPersistence;
}

export function asString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

export function asNumber(value: unknown, fallback = 0): number {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function asBoolean(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
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
            .map((item) => typeof item === 'string' ? item.trim() : asString((item as Row)?.url) || asString((item as Row)?.publicUrl))
            .filter((item): item is string => Boolean(item));
    }

    const single = asString(value);
    return single ? [single] : [];
}

function groupByOffer(rows: Row[]): Map<string, Row[]> {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
        const offerId = asString(row.offer_id);
        if (!offerId) continue;
        map.set(offerId, [...(map.get(offerId) || []), row]);
    }
    return map;
}

function routePart(city: unknown, department: unknown) {
    const cityName = asString(city);
    const departmentName = asString(department);
    if (cityName && departmentName) return `${cityName}, ${departmentName}`;
    return cityName || departmentName || 'Sin ciudad';
}

export function routeLabel(offer: Row) {
    return `${routePart(offer.origin_city, offer.origin_department)} -> ${routePart(offer.destination_city, offer.destination_department)}`;
}

function toCoordinates(row: Row, latitudeKey: string, longitudeKey: string) {
    const latitude = row[latitudeKey] === null || row[latitudeKey] === undefined ? null : asNumber(row[latitudeKey], NaN);
    const longitude = row[longitudeKey] === null || row[longitudeKey] === undefined ? null : asNumber(row[longitudeKey], NaN);

    return {
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
    };
}

function getRail(offer: Row): OperationRail {
    return asBoolean(offer.is_private_fleet) ? 'private_fleet' : 'marketplace';
}

function getDriverId(offer: Row) {
    return asString(offer.private_fleet_trucker_id) || asString(offer.assigned_trucker_id);
}

function getLatestTracking(rows: Row[]) {
    return [...rows].sort((left, right) => {
        const leftDate = Date.parse(asString(left.last_ping_at) || asString(left.updated_at) || '');
        const rightDate = Date.parse(asString(right.last_ping_at) || asString(right.updated_at) || '');
        return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
    })[0] || null;
}

function photoGroupsContainDeliveryPhoto(offer: Row, events: Row[]) {
    for (const tripPhoto of asRows(offer.trip_photos)) {
        const stage = `${asString(tripPhoto.stage) || ''} ${asString(tripPhoto.type) || ''} ${asString(tripPhoto.label) || ''}`.toLowerCase();
        const hasUrl = Boolean(asString(tripPhoto.url) || asString(tripPhoto.publicUrl) || asString(tripPhoto.public_url));
        if (hasUrl && (stage.includes('delivery') || stage.includes('entrega') || stage.includes('unloading'))) {
            return true;
        }
    }

    for (const item of asRows(offer.manifest_items)) {
        if (asStringList(item.deliveryPhotos).length || asStringList(item.delivery_photos).length) {
            return true;
        }
    }

    for (const event of events) {
        const eventType = (asString(event.event_type) || '').toLowerCase();
        if (
            asStringList(event.photo_urls).length
            && (eventType.includes('delivery') || eventType.includes('delivered') || eventType.includes('unloading'))
        ) {
            return true;
        }
    }

    return false;
}

function manifestSummary(offer: Row, events: Row[]) {
    const items = asRows(offer.manifest_items);
    let expected = asNumber(offer.manifest_expected_count, 0);
    let delivered = asNumber(offer.manifest_delivered_count, 0);
    let rejected = asNumber(offer.manifest_rejected_count, 0);
    let rejectedWithoutReason = 0;

    if (items.length) {
        expected = expected || items.reduce((sum, item) => sum + asNumber(item.quantity || item.expectedQty || item.expected_qty, 1), 0);
        delivered = delivered || items.reduce((sum, item) => sum + asNumber(item.deliveredQty || item.delivered_qty, 0), 0);
        rejected = rejected || items.reduce((sum, item) => sum + asNumber(
            item.rejectedQty
            || item.rejected_qty
            || item.loadRejectedQty
            || item.deliveryRejectedQty
            || item.delivery_rejected_qty,
            0
        ), 0);

        rejectedWithoutReason += items.filter((item) => {
            const rejectedQty = asNumber(
                item.rejectedQty
                || item.rejected_qty
                || item.loadRejectedQty
                || item.deliveryRejectedQty
                || item.delivery_rejected_qty,
                0
            );
            const reason = asString(item.rejectionReason) || asString(item.rejection_reason) || asString(item.loadRejectionReason);
            return rejectedQty > 0 && !reason;
        }).length;
    }

    rejectedWithoutReason += events.filter((event) => {
        const type = (asString(event.event_type) || '').toLowerCase();
        const itemStatus = (asString(event.item_status) || '').toLowerCase();
        const rejectedEvent = type.includes('reject') || itemStatus.includes('reject');
        return rejectedEvent && !(asString(event.rejection_reason) || asString(event.notes));
    }).length;

    return { expected, delivered, rejected, rejectedWithoutReason };
}

function hasDeliverySignature(signatures: Row[]) {
    return signatures.some((signature) => DELIVERY_SIGNATURE_STAGES.has(asString(signature.signature_stage) || ''));
}

function hasRecipientName(offer: Row, signatures: Row[]) {
    return Boolean(asString(offer.delivery_contact_name) || signatures.some((signature) => asString(signature.signer_name)));
}

function hasRecipientDocument(signatures: Row[]) {
    return signatures.some((signature) => asString(signature.signer_document_id));
}

function countOpenCriticalIncidents(rows: Row[]) {
    return rows.filter((incident) => {
        const severity = (asString(incident.severity) || '').toLowerCase();
        const status = (asString(incident.status) || 'open').toLowerCase();
        return CRITICAL_INCIDENT_SEVERITIES.has(severity) && OPEN_INCIDENT_STATUSES.has(status);
    }).length;
}

function buildOfferRecord(offer: Row, context: {
    tracking: Row[];
    signatures: Row[];
    pickingEvents: Row[];
    incidents: Row[];
    now: string;
}): OfferAlgorithmRecord {
    const offerId = asString(offer.id) || '';
    const businessId = asString(offer.business_id) || '';
    const rail = getRail(offer);
    const status = asString(offer.status);
    const origin = toCoordinates(offer, 'origin_latitude', 'origin_longitude');
    const destination = toCoordinates(offer, 'destination_latitude', 'destination_longitude');
    const latestTracking = getLatestTracking(context.tracking);
    const latestTrackingCoordinates = latestTracking
        ? toCoordinates(latestTracking, 'last_latitude', 'last_longitude')
        : null;
    const latestDistanceToDestinationKm = latestTrackingCoordinates && hasValidCoordinates(latestTrackingCoordinates) && hasValidCoordinates(destination)
        ? distanceKm(latestTrackingCoordinates, destination)
        : null;
    const manifest = manifestSummary(offer, context.pickingEvents);
    const openCriticalIncidents = countOpenCriticalIncidents(context.incidents);
    const hasSignature = hasDeliverySignature(context.signatures);
    const hasPhoto = photoGroupsContainDeliveryPhoto(offer, context.pickingEvents);
    const hasPin = Boolean(asString(offer.delivery_verified_at));
    const missingEvidenceCount = [hasSignature, hasPhoto, hasPin].filter((item) => !item).length;
    const evidence = validateEvidenceQuality({
        offerId,
        businessId,
        rail,
        status,
        deliveryVerifiedAt: asString(offer.delivery_verified_at),
        hasDeliverySignature: hasSignature,
        hasDeliveryPhoto: hasPhoto,
        hasDeliveryPinVerified: hasPin,
        hasRecipientName: hasRecipientName(offer, context.signatures),
        hasRecipientDocument: hasRecipientDocument(context.signatures),
        destinationCoordinatesValid: hasValidCoordinates(destination),
        lastDistanceToDestinationKm: latestDistanceToDestinationKm,
        manifestExpectedCount: manifest.expected,
        manifestDeliveredCount: manifest.delivered,
        manifestRejectedCount: manifest.rejected,
        rejectedWithoutReasonCount: manifest.rejectedWithoutReason,
        openCriticalIncidents,
        externalProofPending: rail === 'private_fleet' && asString(offer.private_payment_status) === 'external_proof_pending',
    });
    const risk = calculateDeliveryFailureRisk({
        offerId,
        businessId,
        rail,
        status,
        pickupDate: asString(offer.pickup_date),
        deliveryDate: asString(offer.delivery_date),
        origin,
        destination,
        assignedTruckerId: getDriverId(offer),
        privateFleetAssignmentStatus: asString(offer.private_fleet_assignment_status),
        pickupVerifiedAt: asString(offer.pickup_verified_at),
        deliveryVerifiedAt: asString(offer.delivery_verified_at),
        lastPingAt: latestTracking ? asString(latestTracking.last_ping_at) || asString(latestTracking.updated_at) : null,
        lastPingAccuracyMeters: latestTracking ? asNumber(latestTracking.last_accuracy_meters, 0) : null,
        latestDistanceToDestinationKm,
        hasDeliverySignature: hasSignature,
        hasDeliveryPhoto: hasPhoto,
        hasDeliveryPinVerified: hasPin,
        evidenceMissingCount: missingEvidenceCount,
        openCriticalIncidents,
        manifestExpectedCount: manifest.expected,
        manifestDeliveredCount: manifest.delivered,
        manifestRejectedCount: manifest.rejected,
        rejectedWithoutReasonCount: manifest.rejectedWithoutReason,
        externalProofPending: rail === 'private_fleet' && asString(offer.private_payment_status) === 'external_proof_pending',
        now: context.now,
    });

    return {
        offerId,
        businessId,
        status,
        rail,
        cargoType: asString(offer.cargo_type),
        originLabel: routePart(offer.origin_city, offer.origin_department),
        destinationLabel: routePart(offer.destination_city, offer.destination_department),
        updatedAt: asString(offer.updated_at) || asString(offer.created_at),
        risk,
        evidence,
    };
}

export function getMonthRange(month: string | null) {
    const normalized = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    const [year, monthIndex] = normalized.split('-').map((part) => Number(part));
    const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));

    return {
        month: normalized,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
    };
}

export async function loadOfferAlgorithmRecords(
    supabaseAdmin: SupabaseClient,
    options: {
        businessId: string;
        offerId?: string | null;
        month?: string | null;
        limit?: number;
    }
) {
    const range = getMonthRange(options.month || null);
    const limit = Math.max(1, Math.min(Number(options.limit || 40), 100));
    let query = supabaseAdmin
        .from('cargo_offers')
        .select(OFFER_SELECT)
        .eq('business_id', options.businessId)
        .order('updated_at', { ascending: false })
        .limit(limit);

    if (options.offerId) {
        query = query.eq('id', options.offerId);
    } else {
        query = query.gte('created_at', range.startIso).lt('created_at', range.endIso);
    }

    const offersResponse = await query;
    if (offersResponse.error) {
        throw new Error(offersResponse.error.message || 'No se pudieron cargar viajes para inteligencia.');
    }

    const offers = (offersResponse.data || []) as unknown as Row[];
    const offerIds = offers.map((offer) => asString(offer.id)).filter((id): id is string => Boolean(id));

    if (!offerIds.length) {
        return [];
    }

    const [trackingResponse, signaturesResponse, pickingResponse, incidentsResponse] = await Promise.all([
        supabaseAdmin
            .from('trip_tracking_sessions')
            .select('offer_id, status, last_ping_at, last_latitude, last_longitude, last_accuracy_meters, updated_at')
            .in('offer_id', offerIds),
        supabaseAdmin
            .from('trip_signature_evidences')
            .select('offer_id, signature_stage, signer_name, signer_document_id, created_at')
            .in('offer_id', offerIds),
        supabaseAdmin
            .from('picking_events')
            .select('offer_id, event_type, item_status, notes, rejection_reason, photo_urls, latitude, longitude, accuracy_meters, created_at')
            .in('offer_id', offerIds),
        supabaseAdmin
            .from('warehouse_incidents')
            .select('offer_id, severity, status, incident_type, title, created_at')
            .in('offer_id', offerIds),
    ]);

    const trackingByOffer = groupByOffer(trackingResponse.error ? [] : (trackingResponse.data || []) as unknown as Row[]);
    const signaturesByOffer = groupByOffer(signaturesResponse.error ? [] : (signaturesResponse.data || []) as unknown as Row[]);
    const pickingByOffer = groupByOffer(pickingResponse.error ? [] : (pickingResponse.data || []) as unknown as Row[]);
    const incidentsByOffer = groupByOffer(incidentsResponse.error ? [] : (incidentsResponse.data || []) as unknown as Row[]);
    const now = new Date().toISOString();

    return offers.map((offer) => {
        const offerId = asString(offer.id) || '';
        return buildOfferRecord(offer, {
            tracking: trackingByOffer.get(offerId) || [],
            signatures: signaturesByOffer.get(offerId) || [],
            pickingEvents: pickingByOffer.get(offerId) || [],
            incidents: incidentsByOffer.get(offerId) || [],
            now,
        });
    });
}

export function assertCanViewAlgorithms(policy: BusinessRolePolicy) {
    return Boolean(
        policy.capabilities.canViewIntelligence
        || policy.capabilities.canViewOperations
        || policy.capabilities.canViewEvidence
        || policy.capabilities.canViewBusinessMonthlyReport
    );
}

export async function persistAlgorithmOutputs(
    supabaseAdmin: SupabaseClient,
    payload: {
        businessId: string;
        userId: string;
        records: OfferAlgorithmRecord[];
        alerts?: ExecutiveAlert[];
        actions?: NextBestAction[];
    }
): Promise<SnapshotPersistence> {
    const scoreRows = payload.records.flatMap((record) => [
        {
            business_id: payload.businessId,
            offer_id: record.offerId,
            module: 'lastmile',
            algorithm_key: 'delivery_failure_risk_v1',
            score: record.risk.score,
            risk_level: record.risk.riskLevel,
            output: {
                rail: record.rail,
                status: record.status,
                reasons: record.risk.reasons,
                recommendedActions: record.risk.recommendedActions,
                blockingForClosure: record.risk.blockingForClosure,
            },
            created_by: payload.userId,
        },
        {
            business_id: payload.businessId,
            offer_id: record.offerId,
            module: 'evidence',
            algorithm_key: 'evidence_quality_v1',
            score: record.evidence.score,
            risk_level: record.evidence.riskLevel,
            output: {
                rail: record.rail,
                status: record.evidence.status,
                missingRequirements: record.evidence.missingRequirements,
                warnings: record.evidence.warnings,
                canCloseOperationally: record.evidence.canCloseOperationally,
            },
            created_by: payload.userId,
        },
    ]);

    const offerIds = new Set(payload.records.map((record) => record.offerId));
    const alertRows = (payload.alerts || []).map((alert) => ({
        business_id: payload.businessId,
        offer_id: offerIds.has(alert.sourceId) ? alert.sourceId : null,
        alert_type: `${alert.module}:${alert.id.split(':')[0] || alert.id}`,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        status: 'open',
        metadata: {
            sourceId: alert.sourceId,
            href: alert.href,
            actionLabel: alert.actionLabel,
            rail: alert.rail || null,
            includesFinance: alert.includesFinance,
        },
        created_by: payload.userId,
    }));

    try {
        if (scoreRows.length) {
            const { error } = await supabaseAdmin.from('algorithm_score_snapshots').insert(scoreRows);
            if (error) return 'skipped';
        }

        if (alertRows.length) {
            const { error } = await supabaseAdmin.from('algorithm_alerts').insert(alertRows);
            if (error) return 'skipped';
        }

        return 'stored';
    } catch {
        return 'skipped';
    }
}
