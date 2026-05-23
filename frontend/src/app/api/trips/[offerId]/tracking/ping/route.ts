import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    canWriteTracking,
    getOrCreateActiveTrackingSession,
    getTrackingOffer,
    normalizePingInput,
    recordTrackingPing,
} from '@/lib/server/trip-tracking';

interface RouteContext {
    params: Promise<{ offerId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) return auth.response;

    const { offerId } = await context.params;
    const { supabaseAdmin, authUser } = auth.context;
    const body = await request.json().catch(() => ({}));
    const { offer, error } = await getTrackingOffer(supabaseAdmin, offerId);

    if (!offer) {
        return apiError(error || 'Viaje no encontrado', { status: 404, code: 'TRACKING_OFFER_NOT_FOUND', requestId });
    }

    if (!canWriteTracking(offer, authUser.id)) {
        return apiError('Solo el conductor asignado puede enviar ubicacion para este viaje', {
            status: 403,
            code: 'TRACKING_WRITE_FORBIDDEN',
            requestId,
        });
    }

    const normalized = normalizePingInput({
        latitude: body.latitude,
        longitude: body.longitude,
        accuracyMeters: body.accuracyMeters,
        speedMps: body.speedMps,
        headingDegrees: body.headingDegrees,
        batteryLevel: body.batteryLevel,
        capturedAt: body.capturedAt,
        metadata: body.metadata,
    });

    if (normalized.error) {
        return apiError(normalized.error, { status: 400, code: 'TRACKING_PING_INVALID', requestId });
    }
    const normalizedPing = normalized.ping;

    if (!normalizedPing) {
        return apiError('Ubicacion invalida', { status: 400, code: 'TRACKING_PING_INVALID', requestId });
    }

    const { session, error: sessionError } = await getOrCreateActiveTrackingSession(
        supabaseAdmin,
        offer.id,
        authUser.id,
        { auto_created_by: 'ping' }
    );

    if (sessionError || !session) {
        return apiError(sessionError || 'No se pudo resolver sesion de tracking', {
            status: 500,
            code: 'TRACKING_SESSION_RESOLVE_FAILED',
            requestId,
        });
    }

    const { ping, error: pingError } = await recordTrackingPing(
        supabaseAdmin,
        session.id,
        offer.id,
        authUser.id,
        normalizedPing
    );

    if (pingError || !ping) {
        return apiError(pingError || 'No se pudo registrar ubicacion', {
            status: 500,
            code: 'TRACKING_PING_FAILED',
            requestId,
        });
    }

    return apiSuccess({ sessionId: session.id, ping }, { code: 'TRACKING_PING_RECORDED', requestId });
}
