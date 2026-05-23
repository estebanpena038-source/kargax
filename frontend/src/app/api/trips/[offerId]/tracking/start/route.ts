import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { canWriteTracking, getOrCreateActiveTrackingSession, getTrackingOffer } from '@/lib/server/trip-tracking';

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
        return apiError('Solo el conductor asignado puede iniciar tracking para este viaje', {
            status: 403,
            code: 'TRACKING_WRITE_FORBIDDEN',
            requestId,
        });
    }

    const { session, error: sessionError } = await getOrCreateActiveTrackingSession(
        supabaseAdmin,
        offer.id,
        authUser.id,
        {
            user_agent: request.headers.get('user-agent'),
            client: typeof body?.client === 'string' ? body.client : 'pwa',
        }
    );

    if (sessionError || !session) {
        return apiError(sessionError || 'No se pudo iniciar tracking', {
            status: 500,
            code: 'TRACKING_SESSION_START_FAILED',
            requestId,
        });
    }

    return apiSuccess({ session }, { code: 'TRACKING_SESSION_STARTED', requestId });
}
