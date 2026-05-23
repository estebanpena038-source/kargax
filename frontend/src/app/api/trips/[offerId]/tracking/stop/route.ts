import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { canWriteTracking, getTrackingOffer } from '@/lib/server/trip-tracking';

export async function POST(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
    const requestId = getRequestId(request);
    const { offerId } = await params;
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser } = auth.context;
    const { offer, error } = await getTrackingOffer(supabaseAdmin, offerId);

    if (error || !offer) {
        return apiError(error || 'Viaje no encontrado', {
            status: 404,
            code: 'TRACKING_OFFER_NOT_FOUND',
            requestId,
        });
    }

    if (!canWriteTracking(offer, authUser.id)) {
        return apiError('No puedes detener el tracking de este viaje', {
            status: 403,
            code: 'TRACKING_FORBIDDEN',
            requestId,
        });
    }

    const { data, error: updateError } = await supabaseAdmin
        .from('trip_tracking_sessions')
        .update({
            status: 'stopped',
            stopped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('offer_id', offerId)
        .eq('trucker_id', authUser.id)
        .eq('status', 'active')
        .select('*')
        .maybeSingle();

    if (updateError) {
        return apiError(updateError.message, {
            status: 500,
            code: 'TRACKING_STOP_FAILED',
            requestId,
        });
    }

    return apiSuccess({ session: data }, {
        requestId,
        code: 'TRACKING_STOPPED',
    });
}
