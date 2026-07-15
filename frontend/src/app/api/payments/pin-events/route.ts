import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { recordOperationEvent } from '@/lib/server/operations';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

const PIN_EVENT_ACTIONS = new Set([
    'pin_viewed',
    'pin_message_copied',
    'pin_copied',
]);

const PIN_EVENT_SIDES = new Set(['pickup', 'delivery', 'both']);

function getActorType(profileType?: string | null) {
    if (profileType === 'admin') return 'admin';
    if (profileType === 'staff') return 'staff';
    return 'user';
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const offerId = typeof body?.offerId === 'string' ? body.offerId.trim() : '';
    const action = typeof body?.event === 'string' ? body.event.trim() : '';
    const side = typeof body?.side === 'string' ? body.side.trim() : 'both';
    const source = typeof body?.source === 'string' ? body.source.trim().slice(0, 80) : 'payment_success';

    if (!offerId) {
        return apiError('offerId es requerido', {
            requestId,
            status: 400,
            code: 'PIN_EVENT_OFFER_REQUIRED',
        });
    }

    if (!PIN_EVENT_ACTIONS.has(action)) {
        return apiError('Evento de PIN no soportado', {
            requestId,
            status: 400,
            code: 'PIN_EVENT_UNSUPPORTED',
        });
    }

    if (!PIN_EVENT_SIDES.has(side)) {
        return apiError('Lado de PIN no soportado', {
            requestId,
            status: 400,
            code: 'PIN_EVENT_SIDE_UNSUPPORTED',
        });
    }

    const { authUser, profile, supabaseAdmin } = auth.context;
    const { data: offer, error: offerError } = await supabaseAdmin
        .from('cargo_offers')
        .select('id, business_id, assigned_trucker_id, private_fleet_trucker_id, country_code')
        .eq('id', offerId)
        .maybeSingle();

    if (offerError || !offer) {
        return apiError('Oferta no encontrada', {
            requestId,
            status: 404,
            code: 'PIN_EVENT_OFFER_NOT_FOUND',
        });
    }

    const isInternal = profile?.user_type === 'admin' || profile?.user_type === 'staff';
    const isBusinessOwner = profile?.user_type === 'business' && offer.business_id === authUser.id;
    let hasTruckerAccess = offer.assigned_trucker_id === authUser.id || offer.private_fleet_trucker_id === authUser.id;

    if (!isInternal && !isBusinessOwner && !hasTruckerAccess) {
        const { data: acceptedApplication } = await supabaseAdmin
            .from('offer_applications')
            .select('id')
            .eq('offer_id', offerId)
            .eq('trucker_id', authUser.id)
            .eq('status', 'accepted')
            .maybeSingle();

        hasTruckerAccess = Boolean(acceptedApplication?.id);
    }

    if (!isInternal && !isBusinessOwner && !hasTruckerAccess) {
        return apiError('No tienes permiso para auditar este PIN', {
            requestId,
            status: 403,
            code: 'PIN_EVENT_FORBIDDEN',
        });
    }

    await recordOperationEvent(supabaseAdmin, {
        requestId,
        actorUserId: authUser.id,
        actorType: getActorType(profile?.user_type),
        domain: 'payments',
        action,
        entityType: 'cargo_offer',
        entityId: offer.id,
        countryCode: offer.country_code || 'CO',
        status: 'success',
        metadata: {
            side,
            source,
            user_type: profile?.user_type || null,
        },
    });

    return apiSuccess({
        tracked: true,
        event: action,
        side,
    }, {
        requestId,
        code: 'PIN_EVENT_RECORDED',
    });
}
