import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAdminRoute } from '@/lib/server/route-auth';
import { recordCriticalOperation } from '@/lib/server/operations';

type ManualArrivalLocationType = 'origin' | 'destination';

function asLocationType(value: unknown): ManualArrivalLocationType | null {
    return value === 'origin' || value === 'destination' ? value : null;
}

function asOptionalNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function getArrivalEventType(locationType: ManualArrivalLocationType) {
    return locationType === 'origin' ? 'arrival_origin' : 'arrival_destination';
}

function getArrivalColumn(locationType: ManualArrivalLocationType) {
    return locationType === 'origin' ? 'arrived_at_origin_at' : 'arrived_at_destination_at';
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ offerId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAdminRoute(request, { requireAal2: true });

    if ('response' in auth) {
        return auth.response;
    }

    const { offerId } = await params;
    const normalizedOfferId = offerId?.trim();

    if (!normalizedOfferId) {
        return apiError('offerId es requerido', {
            status: 400,
            code: 'OFFER_ID_REQUIRED',
            requestId,
        });
    }

    const body = await request.json().catch(() => ({}));
    const locationType = asLocationType(body?.locationType);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const rejectedAccuracyMeters = asOptionalNumber(body?.rejectedAccuracyMeters);
    const rejectedLatitude = asOptionalNumber(body?.rejectedLatitude);
    const rejectedLongitude = asOptionalNumber(body?.rejectedLongitude);

    if (!locationType) {
        return apiError('locationType debe ser origin o destination', {
            status: 400,
            code: 'LOCATION_TYPE_INVALID',
            requestId,
        });
    }

    if (reason.length < 12) {
        return apiError('reason debe explicar el motivo operativo del override', {
            status: 400,
            code: 'MANUAL_ARRIVAL_REASON_REQUIRED',
            requestId,
        });
    }

    const { supabaseAdmin, authUser } = auth.context;
    const { data: offer, error: offerError } = await supabaseAdmin
        .from('cargo_offers')
        .select(`
            id,
            business_id,
            country_code,
            status,
            assigned_trucker_id,
            private_fleet_trucker_id,
            pickup_verified_at,
            arrived_at_origin_at,
            arrived_at_destination_at,
            loading_started_at,
            unloading_started_at
        `)
        .eq('id', normalizedOfferId)
        .maybeSingle();

    if (offerError || !offer) {
        return apiError('Viaje no encontrado', {
            status: 404,
            code: 'OFFER_NOT_FOUND',
            requestId,
        });
    }

    const arrivalColumn = getArrivalColumn(locationType);
    const existingArrivalAt = locationType === 'origin'
        ? offer.arrived_at_origin_at
        : offer.arrived_at_destination_at;

    if (existingArrivalAt) {
        return apiSuccess({
            offerId: offer.id,
            locationType,
            alreadyRegistered: true,
            arrivedAt: existingArrivalAt,
        }, {
            code: 'MANUAL_ARRIVAL_ALREADY_REGISTERED',
            requestId,
        });
    }

    if (locationType === 'destination' && !offer.pickup_verified_at) {
        return apiError('Primero debe estar completada la carga en origen', {
            status: 409,
            code: 'PICKUP_REQUIRED_BEFORE_DESTINATION_MANUAL_ARRIVAL',
            requestId,
        });
    }

    const arrivedAt = new Date().toISOString();
    const truckerId = offer.assigned_trucker_id || offer.private_fleet_trucker_id || authUser.id;
    const eventType = getArrivalEventType(locationType);

    const updatePayload = locationType === 'origin'
        ? {
            arrived_at_origin_at: arrivedAt,
            loading_started_at: offer.loading_started_at || arrivedAt,
            updated_at: arrivedAt,
        }
        : {
            arrived_at_destination_at: arrivedAt,
            unloading_started_at: offer.unloading_started_at || arrivedAt,
            updated_at: arrivedAt,
        };

    const { data: updatedOffer, error: updateError } = await supabaseAdmin
        .from('cargo_offers')
        .update(updatePayload)
        .eq('id', offer.id)
        .is(arrivalColumn, null)
        .select('id')
        .maybeSingle();

    if (updateError) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: authUser.id,
            actorType: 'admin',
            domain: 'platform',
            action: 'admin_manual_arrival',
            entityType: 'cargo_offer',
            entityId: offer.id,
            businessId: offer.business_id || null,
            countryCode: offer.country_code || 'CO',
            status: 'error',
            errorClass: 'MANUAL_ARRIVAL_UPDATE_FAILED',
            metadata: {
                locationType,
                reason,
                rejectedAccuracyMeters,
            },
        });

        return apiError('No se pudo registrar la llegada manual', {
            status: 500,
            code: 'MANUAL_ARRIVAL_UPDATE_FAILED',
            requestId,
        });
    }

    if (!updatedOffer) {
        return apiSuccess({
            offerId: offer.id,
            locationType,
            alreadyRegistered: true,
            arrivedAt: existingArrivalAt || arrivedAt,
        }, {
            code: 'MANUAL_ARRIVAL_ALREADY_REGISTERED',
            requestId,
        });
    }

    const { error: eventError } = await supabaseAdmin
        .from('picking_events')
        .insert({
            offer_id: offer.id,
            trucker_id: truckerId,
            event_type: eventType,
            latitude: rejectedLatitude,
            longitude: rejectedLongitude,
            accuracy_meters: rejectedAccuracyMeters,
            notes: reason,
            metadata: {
                manual_override: true,
                admin_user_id: authUser.id,
                reason,
                rejected_accuracy_meters: rejectedAccuracyMeters,
                rejected_latitude: rejectedLatitude,
                rejected_longitude: rejectedLongitude,
                recorded_at: arrivedAt,
                request_id: requestId,
            },
        });

    await recordCriticalOperation(supabaseAdmin, {
        requestId,
        actorUserId: authUser.id,
        actorType: 'admin',
        domain: 'platform',
        action: 'admin_manual_arrival',
        entityType: 'cargo_offer',
        entityId: offer.id,
        businessId: offer.business_id || null,
        countryCode: offer.country_code || 'CO',
        status: eventError ? 'warning' : 'success',
        errorClass: eventError ? 'MANUAL_ARRIVAL_EVENT_INSERT_FAILED' : null,
        metadata: {
            locationType,
            reason,
            arrivedAt,
            rejectedAccuracyMeters,
            rejectedLatitude,
            rejectedLongitude,
            eventInsertError: eventError?.message || null,
        },
    });

    return apiSuccess({
        offerId: offer.id,
        locationType,
        arrivedAt,
        manualOverride: true,
        auditEventRecorded: !eventError,
    }, {
        code: eventError ? 'MANUAL_ARRIVAL_REGISTERED_WITH_AUDIT_WARNING' : 'MANUAL_ARRIVAL_REGISTERED',
        requestId,
    });
}
