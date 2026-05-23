/**
 * =============================================================================
 * KARGAX - INSPECTION REPORTS API
 * /lib/inspections/api.ts
 *
 * Capa de API para obtener reportes de inspección desde Supabase.
 * Proporciona funciones para consultar y transformar datos de inspección
 * para la vista de empresas.
 *
 * ARQUITECTURA:
 * - Consultas optimizadas a Supabase
 * - Transformación de datos de DB a tipos de frontend
 * - Enriquecimiento con picking_events para status real
 * - Manejo robusto de errores
 *
 * SEGURIDAD:
 * - Todas las consultas pasan por RLS de Supabase
 * - Solo el business_id de la oferta puede ver el reporte
 *
 * =============================================================================
 */

import { supabase } from '@/lib/supabase/client';
import { formatLocation } from '@/constants/colombia';
import { generateStableManifestItemId } from '@/lib/picking/types';
import type {
    InspectionReport,
    InspectionSummary,
    InspectionManifestItem,
    InspectionTimelineEvent,
    InspectionPhoto,
    InspectionStatus,
    InspectionPhase,
    InspectionItemStatus,
    TruckerInfo,
    RouteInfo,
    VerifiedLocation,
    GetInspectionReportResponse,
    RejectionReason,
    InspectionEventType,
} from './types';
import { calculateCompliancePercent } from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const IS_DEV = process.env.NODE_ENV === 'development';

const logger = {
    log: (...args: unknown[]) => IS_DEV && console.log('[InspectionsAPI]', ...args),
    error: (...args: unknown[]) => console.error('[InspectionsAPI]', ...args),
    warn: (...args: unknown[]) => IS_DEV && console.warn('[InspectionsAPI]', ...args),
};

// =============================================================================
// TYPE DEFINITIONS FOR DATABASE RESPONSE
// =============================================================================

interface DbCargoOffer {
    id: string;
    status: string;
    cargo_type: string;
    cargo_description: string | null;
    origin_department: string | null;
    origin_city: string;
    origin_address: string;
    destination_department: string | null;
    destination_city: string;
    destination_address: string;
    pickup_contact_name: string | null;
    pickup_contact_phone: string | null;
    delivery_contact_name: string | null;
    delivery_contact_phone: string | null;
    total_amount: number;
    net_amount: number | null;
    manifest_items: DbManifestItem[] | null;
    trip_photos: DbTripPhoto[] | null;
    business_id: string;
    assigned_trucker_id: string | null;
    created_at: string;
    updated_at: string;
    arrived_at_origin_at: string | null;
    loading_started_at: string | null;
    loading_completed_at: string | null;
    pickup_verified_at: string | null;
    arrived_at_destination_at: string | null;
    unloading_started_at: string | null;
    unloading_completed_at: string | null;
    delivery_verified_at: string | null;
    origin_latitude: number | null;
    origin_longitude: number | null;
    destination_latitude: number | null;
    destination_longitude: number | null;
    trucker_origin_lat: number | null;
    trucker_origin_lng: number | null;
    trucker_destination_lat: number | null;
    trucker_destination_lng: number | null;
    gps_tolerance_meters: number | null;
    manifest_loaded_count: number | null;
    manifest_delivered_count: number | null;
    manifest_rejected_count: number | null;
}

interface DbManifestItem {
    id?: string;
    name: string;
    quantity: number;
    reference?: string;
    imageUrl?: string;
    description?: string;
    loadedAt?: string;
    loadedQty?: number;
    loadNotes?: string;
    loadStatus?: 'loaded' | 'issue' | 'rejected' | string;
    loadRejectionReason?: string;
    loadPhotos?: string[];
    hasIssue?: boolean;
    isLoaded?: boolean;
    deliveredAt?: string;
    deliveredQty?: number;
    rejectedQty?: number;
    rejectionReason?: string;
    deliveryNotes?: string;
    deliveryPhotos?: string[];
    deliveryStatus?: 'complete' | 'partial' | 'rejected';
}

function clampQuantity(value: number | null | undefined, min: number, max: number): number {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) return min;
    return Math.min(Math.max(numericValue, min), max);
}

function sumEventQuantity(events: DbPickingEvent[]): number {
    return events.reduce((total, event) => total + Number(event.quantity || 1), 0);
}

function getLatestEvent(events: DbPickingEvent[]): DbPickingEvent | undefined {
    return events[events.length - 1];
}

function getDisplayLocation(city: string | null | undefined, department: string | null | undefined): string {
    if (!city) return '';
    if (!department) return city;

    return formatLocation(city, department);
}

function parseOptionalQuantity(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return undefined;
    return Math.max(0, numericValue);
}

function hasRejectionText(value: string | null | undefined): boolean {
    return /rechaz/i.test(value || '');
}

function hasLoadRejectionSignal(item: Pick<DbManifestItem, 'loadStatus' | 'loadRejectionReason' | 'loadNotes' | 'loadedQty' | 'loadedAt'>): boolean {
    const loadedQty = parseOptionalQuantity(item.loadedQty);
    return item.loadStatus === 'rejected'
        || item.loadStatus === 'rechazado_en_origen'
        || hasRejectionText(item.loadRejectionReason)
        || hasRejectionText(item.loadNotes)
        || (loadedQty === 0 && Boolean(item.loadedAt || item.loadRejectionReason));
}

function hasLoadRejectionEventSignal(event: DbPickingEvent): boolean {
    const isLoadingEvent = event.event_type === 'item_loaded' || event.event_type === 'item_load_issue';
    return isLoadingEvent && (
        (event.event_type === 'item_load_issue' && event.item_status === 'rejected')
        || hasRejectionText(event.notes)
        || hasRejectionText(event.rejection_reason)
    );
}

function getLoadRejectedQuantity(item: DbManifestItem, expectedQuantity: number): number {
    return hasLoadRejectionSignal(item) ? expectedQuantity : 0;
}

interface DbTripPhoto {
    url: string;
    type: 'loading' | 'unloading' | 'general' | 'issue';
    notes?: string;
    timestamp: string;
    latitude?: number;
    longitude?: number;
}

interface DbPickingEvent {
    id: string;
    offer_id: string;
    trucker_id: string;
    event_type: string;
    manifest_item_id: string | null;
    manifest_item_name: string | null;
    quantity: number | null;
    item_status: string | null;
    notes: string | null;
    rejection_reason: string | null;
    photo_urls: string[] | null;
    latitude: number | null;
    longitude: number | null;
    accuracy_meters: number | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

interface DbTruckerProfile {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
}

// =============================================================================
// TRANSFORMATION FUNCTIONS
// =============================================================================

function mapOfferStatusToInspectionStatus(status: string, pickupVerified: boolean, deliveryVerified: boolean): InspectionStatus {
    if (deliveryVerified) return 'completed';
    if (pickupVerified) return 'delivery';
    if (status === 'in_progress') return 'in_progress';
    if (status === 'cancelled') return 'cancelled';
    return 'pending';
}

function determineInspectionPhase(pickupVerified: boolean): InspectionPhase {
    return pickupVerified ? 'delivery' : 'loading';
}

function mapItemStatus(item: DbManifestItem): InspectionItemStatus {
    if (item.deliveryStatus === 'complete') return 'delivered';
    if (item.deliveryStatus === 'partial') return 'partial';
    if (item.deliveryStatus === 'rejected') return 'rejected';
    if (item.rejectedQty && item.rejectedQty > 0 && (!item.deliveredQty || item.deliveredQty === 0)) return 'rejected';
    if (item.deliveredQty && item.deliveredQty > 0) {
        if (item.rejectedQty && item.rejectedQty > 0) return 'partial';
        return 'delivered';
    }
    if (item.hasIssue) return 'issue';
    if (item.loadedQty && item.loadedQty > 0) return 'loaded';
    return 'pending';
}

/**
 * Transforma items del manifiesto, enriqueciendo con picking_events
 * ya que el JSONB manifest_items no siempre refleja rechazos/entregas.
 */
function transformManifestItems(
    items: DbManifestItem[] | null,
    pickingEvents: DbPickingEvent[] = []
): InspectionManifestItem[] {
    if (!items || !Array.isArray(items)) return [];

    return items.map((item, idx) => {
        const manifestItemId = item.id || generateStableManifestItemId(item.name, idx);
        const hasExactEventMatch = pickingEvents.some((event) => event.manifest_item_id === manifestItemId);
        const shouldUseLegacyNameMatch = !item.id || item.id.startsWith('manifest-') || !hasExactEventMatch;
        const itemEvents = pickingEvents.filter((event) => {
            if (event.manifest_item_id && event.manifest_item_id === manifestItemId) return true;
            if (shouldUseLegacyNameMatch && event.manifest_item_name === item.name) return true;
            return false;
        });
        const expectedQuantity = Math.max(0, Number(item.quantity || 0));
        const maxQuantity = expectedQuantity || Number.MAX_SAFE_INTEGER;
        const rejectedByLoad = hasLoadRejectionSignal(item) || itemEvents.some(hasLoadRejectionEventSignal);

        let loadedQty = rejectedByLoad ? 0 : parseOptionalQuantity(item.loadedQty) || 0;
        let deliveredQty = rejectedByLoad ? 0 : parseOptionalQuantity(item.deliveredQty) || 0;
        let rejectedQty = rejectedByLoad ? 0 : parseOptionalQuantity(item.rejectedQty) || 0;
        let rejectionReason = item.rejectionReason as RejectionReason | undefined;
        let hasIssue = item.hasIssue || false;
        let loadedAt = item.loadedAt;
        let deliveredAt = rejectedByLoad ? undefined : item.deliveredAt;
        const loadPhotos = [...(item.loadPhotos || [])];
        const deliveryPhotos = rejectedByLoad ? [] : [...(item.deliveryPhotos || [])];
        let loadNotes = item.loadNotes;
        let loadRejectionReason = item.loadRejectionReason;
        let deliveryNotes = item.deliveryNotes;
        let deliveryStatus = rejectedByLoad ? undefined : item.deliveryStatus;

        // Picking events can contain retries from old flows. Use them as evidence,
        // but cap operational quantities to the manifest expectation.
        if (itemEvents.length > 0) {
            const loadedEvents = itemEvents.filter((event) => event.event_type === 'item_loaded');
            const loadIssueEvents = itemEvents.filter((event) => event.event_type === 'item_load_issue');
            const deliveredEvents = rejectedByLoad ? [] : itemEvents.filter((event) => event.event_type === 'item_delivered');
            const rejectedEvents = rejectedByLoad ? [] : itemEvents.filter((event) => event.event_type === 'item_rejected');
            const loadingEvidenceEvents = [...loadedEvents, ...loadIssueEvents];

            const eventLoadedQty = sumEventQuantity(loadingEvidenceEvents);
            const eventDeliveredQty = sumEventQuantity(deliveredEvents);
            const eventRejectedQty = sumEventQuantity(rejectedEvents);

            loadedQty = rejectedByLoad ? 0 : clampQuantity(Math.max(loadedQty, eventLoadedQty), 0, maxQuantity);
            rejectedQty = clampQuantity(Math.max(rejectedQty, eventRejectedQty), 0, maxQuantity);
            deliveredQty = clampQuantity(Math.max(deliveredQty, eventDeliveredQty), 0, Math.max(0, maxQuantity - rejectedQty));

            const latestLoadEvent = getLatestEvent(loadingEvidenceEvents);
            const latestDeliveredEvent = getLatestEvent(deliveredEvents);
            const latestRejectedEvent = getLatestEvent(rejectedEvents);

            if (latestLoadEvent) {
                loadedAt = loadedAt || latestLoadEvent.created_at;
                loadNotes = latestLoadEvent.notes || loadNotes;
                if (hasLoadRejectionEventSignal(latestLoadEvent)) {
                    loadRejectionReason = latestLoadEvent.rejection_reason || latestLoadEvent.notes || loadRejectionReason;
                }
            }

            if (latestDeliveredEvent) {
                deliveredAt = deliveredAt || latestDeliveredEvent.created_at;
                deliveryNotes = latestDeliveredEvent.notes || deliveryNotes;
            }

            if (latestRejectedEvent) {
                deliveredAt = deliveredAt || latestRejectedEvent.created_at;
                rejectionReason = (latestRejectedEvent.rejection_reason as RejectionReason | null) || rejectionReason;
                deliveryNotes = latestRejectedEvent.notes || deliveryNotes;
                deliveryStatus = rejectedQty >= maxQuantity ? 'rejected' : 'partial';
            } else if (deliveredQty >= maxQuantity && maxQuantity > 0) {
                deliveryStatus = 'complete';
            } else if (deliveredQty > 0) {
                deliveryStatus = 'partial';
            }

            hasIssue = hasIssue || loadIssueEvents.length > 0;
            for (const event of loadingEvidenceEvents) {
                if (event.photo_urls?.length) loadPhotos.push(...event.photo_urls);
            }
            for (const event of [...deliveredEvents, ...rejectedEvents]) {
                if (event.photo_urls?.length) deliveryPhotos.push(...event.photo_urls);
            }
        }

        if (rejectedByLoad) {
            loadedQty = 0;
            deliveredQty = 0;
            rejectedQty = 0;
            deliveredAt = undefined;
            deliveryNotes = undefined;
            deliveryStatus = undefined;
            hasIssue = true;
            loadRejectionReason = loadRejectionReason || loadNotes || 'Carga rechazada en bodega.';
        }

        const uniqueLoadPhotos = [...new Set(loadPhotos)];
        const uniqueDeliveryPhotos = [...new Set(deliveryPhotos)];
        const loadRejectedQuantity = rejectedByLoad ? getLoadRejectedQuantity({ ...item, loadStatus: 'rejected' }, expectedQuantity) : 0;
        const deliveryRejectedQuantity = rejectedByLoad ? 0 : rejectedQty;
        const rejectedUnits = loadRejectedQuantity + deliveryRejectedQuantity;

        const enriched: DbManifestItem = {
            ...item,
            id: manifestItemId,
            loadedQty: rejectedByLoad ? 0 : loadedQty || undefined,
            deliveredQty: deliveredQty || undefined,
            rejectedQty: rejectedQty || undefined,
            rejectionReason: rejectionReason as string | undefined,
            hasIssue, loadedAt, deliveredAt,
            loadPhotos: uniqueLoadPhotos,
            deliveryPhotos: uniqueDeliveryPhotos,
            loadNotes, loadRejectionReason, deliveryNotes, deliveryStatus,
            loadStatus: rejectedByLoad ? 'rejected' : item.loadStatus,
        };

        return {
            id: enriched.id || manifestItemId,
            name: enriched.name || 'Item sin nombre',
            description: enriched.description,
            reference: enriched.reference,
            imageUrl: enriched.imageUrl,
            expectedQuantity,
            loadedQuantity: enriched.loadedQty,
            loadRejectedQuantity,
            loadedAt: enriched.loadedAt,
            loadNotes: enriched.loadNotes,
            loadRejectionReason: enriched.loadRejectionReason,
            loadPhotos: uniqueLoadPhotos,
            hasLoadIssue: enriched.hasIssue || false,
            isRejectedInLoad: rejectedByLoad,
            deliveredQuantity: enriched.deliveredQty,
            rejectedQuantity: rejectedUnits || undefined,
            deliveryRejectedQuantity: deliveryRejectedQuantity || undefined,
            rejectedUnits,
            rejectionReason: enriched.rejectionReason as RejectionReason | undefined,
            deliveredAt: enriched.deliveredAt,
            deliveryNotes: enriched.deliveryNotes,
            deliveryPhotos: uniqueDeliveryPhotos,
            status: rejectedByLoad ? 'rejected' : mapItemStatus(enriched),
        };
    });
}

function transformPickingEvents(events: DbPickingEvent[]): InspectionTimelineEvent[] {
    return events.map(event => ({
        id: event.id,
        eventType: event.event_type as InspectionEventType,
        timestamp: event.created_at,
        manifestItemId: event.manifest_item_id || undefined,
        manifestItemName: event.manifest_item_name || undefined,
        quantity: event.quantity || undefined,
        itemStatus: event.item_status as InspectionItemStatus | undefined,
        notes: event.notes || undefined,
        rejectionReason: event.rejection_reason as RejectionReason | undefined,
        photoUrls: event.photo_urls || [],
        location: event.latitude && event.longitude ? {
            latitude: event.latitude,
            longitude: event.longitude,
            accuracyMeters: event.accuracy_meters || undefined,
        } : undefined,
        metadata: event.metadata || undefined,
    }));
}

function eventMatchesManifestItem(event: DbPickingEvent, item: InspectionManifestItem): boolean {
    if (event.manifest_item_id && event.manifest_item_id === item.id) return true;
    return Boolean(event.manifest_item_name && event.manifest_item_name === item.name);
}

function filterTimelineEventsForInspection(
    events: DbPickingEvent[],
    manifestItems: InspectionManifestItem[]
): DbPickingEvent[] {
    const loadRejectedItems = manifestItems.filter((item) => item.isRejectedInLoad);

    return events
        .map((event) => {
            if (!hasLoadRejectionEventSignal(event)) return event;
            return {
                ...event,
                event_type: 'item_load_issue',
                item_status: 'rejected',
                quantity: 0,
                rejection_reason: event.rejection_reason || event.notes || 'Rechazo de carga',
            };
        })
        .filter((event) => {
            if (event.event_type !== 'item_delivered' && event.event_type !== 'item_rejected') return true;
            return !loadRejectedItems.some((item) => eventMatchesManifestItem(event, item));
        });
}

function transformTripPhotos(photos: DbTripPhoto[] | null, offerId: string): InspectionPhoto[] {
    if (!photos || !Array.isArray(photos)) return [];
    return photos.map((photo, index) => ({
        id: `photo_${offerId}_${index}`,
        url: photo.url,
        type: photo.type,
        stage: photo.type === 'loading' ? 'loading' : photo.type === 'unloading' ? 'unloading' : undefined,
        notes: photo.notes,
        timestamp: photo.timestamp,
        latitude: photo.latitude,
        longitude: photo.longitude,
    }));
}

function calculateSummary(items: InspectionManifestItem[], photos: InspectionPhoto[]): InspectionSummary {
    const totalItems = items.length;
    let loadedItems = 0, loadIssueItems = 0, deliveredItems = 0, partialItems = 0, rejectedUnits = 0, rejectedItemCount = 0;
    for (const item of items) {
        const isLoaded = (item.loadedQuantity || 0) > 0 || ['loaded', 'issue', 'delivered', 'partial', 'rejected'].includes(item.status);
        if (isLoaded) loadedItems++;
        if (item.hasLoadIssue) loadIssueItems++;
        if (item.rejectedUnits > 0) {
            rejectedUnits += item.rejectedUnits;
            rejectedItemCount++;
        }

        switch (item.status) {
            case 'delivered': deliveredItems++; break;
            case 'partial': partialItems++; break;
        }
    }
    return {
        totalItems,
        loadedItems,
        loadIssueItems,
        deliveredItems,
        partialItems,
        rejectedItems: rejectedUnits,
        rejectedItemCount,
        totalPhotos: photos.length,
        loadingCompliancePercent: calculateCompliancePercent(loadedItems, totalItems),
        deliveryCompliancePercent: calculateCompliancePercent(deliveredItems + partialItems, totalItems),
    };
}

function buildVerifiedLocation(
    verifiedLat: number | null, verifiedLng: number | null, verifiedAt: string | null,
    expectedLat: number | null, expectedLng: number | null, tolerance: number | null
): VerifiedLocation | undefined {
    if (!verifiedLat || !verifiedLng || !verifiedAt) return undefined;
    let withinTolerance = true;
    let distanceFromExpected: number | undefined;
    if (expectedLat && expectedLng) {
        const R = 6371000;
        const dLat = (verifiedLat - expectedLat) * Math.PI / 180;
        const dLng = (verifiedLng - expectedLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(expectedLat * Math.PI / 180) * Math.cos(verifiedLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceFromExpected = R * c;
        withinTolerance = distanceFromExpected <= (tolerance || 500);
    }
    return { latitude: verifiedLat, longitude: verifiedLng, verifiedAt, withinTolerance, distanceFromExpected };
}

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

export async function getInspectionReport(offerId: string): Promise<GetInspectionReportResponse> {
    logger.log('Fetching inspection report for offer:', offerId);

    try {
        const { data: offer, error: offerError } = await supabase
            .from('cargo_offers')
            .select(`
                id, status, cargo_type, cargo_description,
                origin_department, origin_city, origin_address,
                destination_department, destination_city, destination_address,
                pickup_contact_name, pickup_contact_phone,
                delivery_contact_name, delivery_contact_phone,
                total_amount, net_amount, manifest_items, trip_photos,
                business_id, assigned_trucker_id, created_at, updated_at,
                arrived_at_origin_at, loading_started_at, loading_completed_at, pickup_verified_at,
                arrived_at_destination_at, unloading_started_at, unloading_completed_at, delivery_verified_at,
                origin_latitude, origin_longitude, destination_latitude, destination_longitude,
                trucker_origin_lat, trucker_origin_lng, trucker_destination_lat, trucker_destination_lng,
                gps_tolerance_meters, manifest_loaded_count, manifest_delivered_count, manifest_rejected_count
            `)
            .eq('id', offerId)
            .single();

        if (offerError) {
            logger.error('Error fetching offer:', offerError);
            return { success: false, error: offerError.message, errorCode: offerError.code };
        }
        if (!offer) {
            return { success: false, error: 'Oferta no encontrada', errorCode: 'NOT_FOUND' };
        }

        const dbOffer = offer as unknown as DbCargoOffer;

        // Picking events (authoritative source for item status)
        const { data: events, error: eventsError } = await supabase
            .from('picking_events')
            .select('*')
            .eq('offer_id', offerId)
            .order('created_at', { ascending: true });

        if (eventsError) {
            logger.warn('Error fetching picking events:', eventsError);
        }

        const dbEvents = (events || []) as DbPickingEvent[];

        // Trucker info
        let truckerInfo: TruckerInfo = { id: dbOffer.assigned_trucker_id || '', fullName: 'Camionero' };
        if (dbOffer.assigned_trucker_id) {
            const { data: truckerData } = await supabase
                .from('user_profiles')
                .select('id, full_name, email, phone, avatar_url')
                .eq('id', dbOffer.assigned_trucker_id)
                .single();
            if (truckerData) {
                const trucker = truckerData as DbTruckerProfile;
                truckerInfo = {
                    id: trucker.id,
                    fullName: trucker.full_name || 'Camionero',
                    email: trucker.email || undefined,
                    phone: trucker.phone || undefined,
                    avatarUrl: trucker.avatar_url || undefined,
                };
            }
        }

        // Transform data — pass picking events to enrich manifest items
        const manifestItems = transformManifestItems(dbOffer.manifest_items, dbEvents);
        const photos = transformTripPhotos(dbOffer.trip_photos, offerId);
        const timelineEvents = filterTimelineEventsForInspection(dbEvents, manifestItems);
        const timeline = transformPickingEvents(timelineEvents);

        // Also include photos from picking events in the gallery
        const eventPhotos: InspectionPhoto[] = dbEvents
            .filter(e => e.photo_urls && e.photo_urls.length > 0)
            .flatMap((e, eIdx) =>
                (e.photo_urls || []).map((url, pIdx) => ({
                    id: `ev_photo_${e.id}_${pIdx}`,
                    url,
                    type: (e.event_type.includes('load') ? 'loading' : 'unloading') as 'loading' | 'unloading',
                    stage: e.event_type.includes('load') ? 'loading' as const : 'unloading' as const,
                    notes: e.notes || undefined,
                    timestamp: e.created_at,
                    latitude: e.latitude || undefined,
                    longitude: e.longitude || undefined,
                    manifestItemId: e.manifest_item_id || undefined,
                    manifestItemName: e.manifest_item_name || undefined,
                    quantity: e.quantity || undefined,
                    itemStatus: e.item_status as InspectionItemStatus | undefined,
                    hasIssue: e.event_type === 'item_load_issue',
                    isRejected: e.event_type === 'item_rejected',
                    rejectionReason: e.rejection_reason as RejectionReason | undefined,
                }))
            );

        // Merge trip_photos + event photos, deduplicate by URL
        const seenUrls = new Set(photos.map(p => p.url));
        const allPhotos = [...photos];
        for (const ep of eventPhotos) {
            if (!seenUrls.has(ep.url)) {
                allPhotos.push(ep);
                seenUrls.add(ep.url);
            }
        }

        const summary = calculateSummary(manifestItems, allPhotos);
        const pickupVerified = !!dbOffer.pickup_verified_at;
        const deliveryVerified = !!dbOffer.delivery_verified_at;

        const report: InspectionReport = {
            offerId: dbOffer.id,
            status: mapOfferStatusToInspectionStatus(dbOffer.status, pickupVerified, deliveryVerified),
            phase: determineInspectionPhase(pickupVerified),
            trucker: truckerInfo,
            route: {
                originCity: getDisplayLocation(dbOffer.origin_city, dbOffer.origin_department),
                originAddress: dbOffer.origin_address,
                destinationCity: getDisplayLocation(dbOffer.destination_city, dbOffer.destination_department),
                destinationAddress: dbOffer.destination_address,
                pickupContactName: dbOffer.pickup_contact_name || undefined,
                pickupContactPhone: dbOffer.pickup_contact_phone || undefined,
                deliveryContactName: dbOffer.delivery_contact_name || undefined,
                deliveryContactPhone: dbOffer.delivery_contact_phone || undefined,
            },
            cargoType: dbOffer.cargo_type,
            cargoDescription: dbOffer.cargo_description || undefined,
            totalAmount: dbOffer.total_amount,
            currency: 'COP',
            createdAt: dbOffer.created_at,
            arrivedAtOriginAt: dbOffer.arrived_at_origin_at || undefined,
            loadingStartedAt: dbOffer.loading_started_at || undefined,
            loadingCompletedAt: dbOffer.loading_completed_at || undefined,
            pickupVerifiedAt: dbOffer.pickup_verified_at || undefined,
            arrivedAtDestinationAt: dbOffer.arrived_at_destination_at || undefined,
            unloadingStartedAt: dbOffer.unloading_started_at || undefined,
            unloadingCompletedAt: dbOffer.unloading_completed_at || undefined,
            deliveryVerifiedAt: dbOffer.delivery_verified_at || undefined,
            originLocation: buildVerifiedLocation(
                dbOffer.trucker_origin_lat, dbOffer.trucker_origin_lng, dbOffer.arrived_at_origin_at,
                dbOffer.origin_latitude, dbOffer.origin_longitude, dbOffer.gps_tolerance_meters
            ),
            destinationLocation: buildVerifiedLocation(
                dbOffer.trucker_destination_lat, dbOffer.trucker_destination_lng, dbOffer.arrived_at_destination_at,
                dbOffer.destination_latitude, dbOffer.destination_longitude, dbOffer.gps_tolerance_meters
            ),
            summary,
            manifestItems,
            timeline,
            photos: allPhotos,
        };

        logger.log('Report built successfully:', {
            offerId: report.offerId, status: report.status,
            itemsCount: report.manifestItems.length, eventsCount: report.timeline.length, photosCount: report.photos.length,
        });

        return { success: true, data: report };
    } catch (error) {
        logger.error('Unexpected error in getInspectionReport:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido', errorCode: 'UNEXPECTED_ERROR' };
    }
}

export async function getInspectionList(
    businessId: string,
    options: { status?: InspectionStatus; limit?: number; offset?: number } = {}
): Promise<{
    success: boolean;
    data?: Array<Pick<InspectionReport, 'offerId' | 'status' | 'phase' | 'trucker' | 'route' | 'summary' | 'createdAt'>>;
    error?: string;
    total?: number;
}> {
    logger.log('Fetching inspection list for business:', businessId, options);

    try {
        let query = supabase
            .from('cargo_offers')
            .select(`
                id, status, cargo_type, origin_department, origin_city, destination_department, destination_city,
                manifest_items, trip_photos, assigned_trucker_id, created_at,
                pickup_verified_at, delivery_verified_at,
                manifest_loaded_count, manifest_delivered_count, manifest_rejected_count
            `, { count: 'exact' })
            .eq('business_id', businessId)
            .not('assigned_trucker_id', 'is', null)
            .order('created_at', { ascending: false });

        if (options.limit) query = query.limit(options.limit);
        if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

        const { data, error, count } = await query;

        if (error) {
            logger.error('Error fetching inspection list:', error);
            return { success: false, error: error.message };
        }

        const inspections = (data || []).map(offer => {
            const dbOffer = offer as unknown as DbCargoOffer;
            const manifestItems = transformManifestItems(dbOffer.manifest_items);
            const photos = transformTripPhotos(dbOffer.trip_photos, dbOffer.id);
            const summary = calculateSummary(manifestItems, photos);
            const pickupVerified = !!dbOffer.pickup_verified_at;
            const deliveryVerified = !!dbOffer.delivery_verified_at;

            return {
                offerId: dbOffer.id,
                status: mapOfferStatusToInspectionStatus(dbOffer.status, pickupVerified, deliveryVerified),
                phase: determineInspectionPhase(pickupVerified),
                trucker: { id: dbOffer.assigned_trucker_id || '', fullName: 'Camionero' },
                route: {
                    originCity: getDisplayLocation(dbOffer.origin_city, dbOffer.origin_department), originAddress: '',
                    destinationCity: getDisplayLocation(dbOffer.destination_city, dbOffer.destination_department), destinationAddress: '',
                },
                summary,
                createdAt: dbOffer.created_at,
            };
        });

        return { success: true, data: inspections, total: count || 0 };
    } catch (error) {
        logger.error('Unexpected error in getInspectionList:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// =============================================================================
// EXPORT
// =============================================================================

export const inspectionsApi = {
    getInspectionReport,
    getInspectionList,
};

export default inspectionsApi;
