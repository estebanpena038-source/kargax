import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { releaseMarketplaceFreightForCompletedOffer } from '@/lib/server/wallet/marketplace-release';

interface VerifyDeliveryPinBody {
    pin?: string;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ offerId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { offerId } = await params;
    const body = await request.json().catch(() => ({})) as VerifyDeliveryPinBody;
    const pin = String(body.pin || '').trim();

    if (!offerId?.trim()) {
        return apiError('offerId es requerido', {
            status: 400,
            code: 'DELIVERY_PIN_OFFER_REQUIRED',
            requestId,
        });
    }

    if (!/^[A-Za-z0-9]{4,6}$/.test(pin)) {
        return apiError('Ingresa un PIN de entrega valido', {
            status: 400,
            code: 'DELIVERY_PIN_INVALID',
            requestId,
        });
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker' && profile?.user_type !== 'admin') {
        return apiError('Solo el conductor asignado puede cerrar esta entrega', {
            status: 403,
            code: 'DELIVERY_PIN_FORBIDDEN_ROLE',
            requestId,
        });
    }

    try {
        const { data, error } = await supabaseAdmin.rpc('verify_delivery_pin', {
            p_offer_id: offerId,
            p_input_pin: pin,
            p_trucker_id: authUser.id,
        });

        if (error) {
            return apiError('No se pudo verificar el PIN de entrega', {
                status: 500,
                code: 'DELIVERY_PIN_RPC_FAILED',
                requestId,
                details: error.message,
            });
        }

        const result = Array.isArray(data) ? data[0] : data;
        if (!result?.success) {
            return apiSuccess({
                verified: false,
                result: result || null,
                marketplaceRelease: null,
            }, {
                code: 'DELIVERY_PIN_REJECTED',
                requestId,
            });
        }

        const marketplaceRelease = await releaseMarketplaceFreightForCompletedOffer({
            supabaseAdmin,
            offerId,
            actor: 'route_completion',
            requestId,
        });

        return apiSuccess({
            verified: true,
            result,
            marketplaceRelease,
        }, {
            code: 'DELIVERY_PIN_VERIFIED',
            requestId,
        });
    } catch (error) {
        return apiError('No se pudo cerrar la entrega', {
            status: 500,
            code: 'DELIVERY_PIN_CLOSE_FAILED',
            requestId,
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
