import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { canReadTracking, getTrackingOffer } from '@/lib/server/trip-tracking';

export async function GET(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
    const requestId = getRequestId(request);
    const { offerId } = await params;
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;
    const { offer, error } = await getTrackingOffer(supabaseAdmin, offerId);

    if (error || !offer) {
        return apiError(error || 'Viaje no encontrado', {
            status: 404,
            code: 'TRACKING_OFFER_NOT_FOUND',
            requestId,
        });
    }

    if (!canReadTracking(offer, authUser.id, profile)) {
        return apiError('No puedes consultar el tracking de este viaje', {
            status: 403,
            code: 'TRACKING_FORBIDDEN',
            requestId,
        });
    }

    const limitParam = Number(request.nextUrl.searchParams.get('limit') || 80);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 300) : 80;

    const [{ data: sessions, error: sessionError }, { data: pings, error: pingsError }] = await Promise.all([
        supabaseAdmin
            .from('trip_tracking_sessions')
            .select('*')
            .eq('offer_id', offerId)
            .order('started_at', { ascending: false })
            .limit(5),
        supabaseAdmin
            .from('trip_location_pings')
            .select('*')
            .eq('offer_id', offerId)
            .order('captured_at', { ascending: false })
            .limit(limit),
    ]);

    if (sessionError || pingsError) {
        return apiError(sessionError?.message || pingsError?.message || 'No se pudo consultar tracking', {
            status: 500,
            code: 'TRACKING_QUERY_FAILED',
            requestId,
        });
    }

    const latestPing = Array.isArray(pings) && pings.length > 0 ? pings[0] : null;

    return apiSuccess({
        sessions: sessions || [],
        latestPing,
        pings: (pings || []).slice().reverse(),
    }, {
        requestId,
        code: 'TRACKING_READY',
    });
}
