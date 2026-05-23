import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker' && profile?.user_type !== 'admin') {
        return apiError('Solo transportadores pueden reportar eventos de flota privada', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_EVENT_FORBIDDEN',
        });
    }

    const body = await request.json().catch(() => ({})) as {
        offerId?: string;
        eventType?: 'fleet_incident' | 'panic_alert';
        notes?: string;
        photoUrls?: string[];
        latitude?: number;
        longitude?: number;
        accuracyMeters?: number;
        metadata?: Record<string, unknown>;
    };

    if (!body.offerId?.trim() || !body.eventType) {
        return apiError('offerId y eventType son requeridos', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_EVENT_REQUIRED_FIELDS',
        });
    }

    const { data: eventResult, error: eventError } = await supabaseAdmin.rpc('record_private_fleet_event', {
        p_offer_id: body.offerId,
        p_trucker_id: authUser.id,
        p_event_type: body.eventType,
        p_notes: body.notes?.trim() || null,
        p_photo_urls: Array.isArray(body.photoUrls) ? body.photoUrls : null,
        p_latitude: typeof body.latitude === 'number' ? body.latitude : null,
        p_longitude: typeof body.longitude === 'number' ? body.longitude : null,
        p_accuracy_meters: typeof body.accuracyMeters === 'number' ? body.accuracyMeters : null,
        p_metadata: body.metadata || {},
    });

    if (eventError) {
        return apiError(eventError.message || 'No se pudo registrar el evento', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_EVENT_FAILED',
        });
    }

    const result = Array.isArray(eventResult) ? eventResult[0] : eventResult;

    if (!result?.success) {
        return apiError(result?.message || 'No se pudo registrar el evento', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_EVENT_REJECTED',
        });
    }

    return apiSuccess({
        eventId: result.event_id,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_EVENT_CREATED',
        status: 201,
    });
}
