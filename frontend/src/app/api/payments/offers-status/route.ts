import { NextRequest } from 'next/server';
import { deriveTruckerJobStatus } from '@/lib/payments/trip-state';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

interface OfferStatusesRequest {
    offerIds?: string[];
}

function buildBlockingReason(jobStatus: ReturnType<typeof deriveTruckerJobStatus>) {
    if (jobStatus === 'awaiting_confirmation') {
        return 'La empresa todavia esta terminando de confirmar esta ruta.';
    }

    if (jobStatus === 'awaiting_payment') {
        return 'Esta ruta fue aceptada, pero aun falta la confirmacion final de la empresa.';
    }

    return null;
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const body = await request.json().catch(() => ({})) as OfferStatusesRequest;
    const offerIds = Array.from(new Set(
        Array.isArray(body.offerIds)
            ? body.offerIds.filter((offerId): offerId is string => typeof offerId === 'string' && Boolean(offerId.trim()))
            : []
    ));

    if (offerIds.length === 0) {
        return apiError('offerIds es requerido', {
            status: 400,
            code: 'PAYMENT_OFFER_STATUSES_REQUIRED',
            requestId,
        });
    }

    const { authUser, profile, supabaseAdmin } = auth.context;

    if (profile?.user_type !== 'trucker' && profile?.user_type !== 'admin') {
        return apiError('Solo transportadores o admin pueden consultar estos estados', {
            status: 403,
            code: 'PAYMENT_OFFER_STATUSES_FORBIDDEN',
            requestId,
        });
    }

    let authorizedOfferIds = offerIds;

    if (profile?.user_type !== 'admin') {
        const [{ data: acceptedApplications }, { data: privateFleetOffers }] = await Promise.all([
            supabaseAdmin
                .from('offer_applications')
                .select('offer_id')
                .eq('trucker_id', authUser.id)
                .eq('status', 'accepted')
                .in('offer_id', offerIds),
            supabaseAdmin
                .from('cargo_offers')
                .select('id')
                .in('id', offerIds)
                .or(`assigned_trucker_id.eq.${authUser.id},private_fleet_trucker_id.eq.${authUser.id}`),
        ]);

        authorizedOfferIds = Array.from(new Set([
            ...((acceptedApplications || [])
                .map((application) => application.offer_id)
                .filter(Boolean)),
            ...((privateFleetOffers || [])
                .map((offer) => offer.id)
                .filter(Boolean)),
        ]));
    }

    if (authorizedOfferIds.length === 0) {
        return apiSuccess({
            statuses: {},
        }, {
            code: 'PAYMENT_OFFER_STATUSES_EMPTY',
            requestId,
        });
    }

    const [{ data: offers }, { data: payments, error: paymentsError }] = await Promise.all([
        supabaseAdmin
            .from('cargo_offers')
            .select('id, status, pickup_pin, delivery_pin, pickup_verified_at, delivery_verified_at, is_private_fleet, private_fleet_trucker_id')
            .in('id', authorizedOfferIds),
        supabaseAdmin
            .from('payments')
            .select('offer_id, status, created_at')
            .in('offer_id', authorizedOfferIds)
            .order('created_at', { ascending: false }),
    ]);

    if (paymentsError) {
        return apiError('No se pudieron cargar los estados de pago', {
            status: 500,
            code: 'PAYMENT_OFFER_STATUSES_LOAD_FAILED',
            requestId,
            details: paymentsError.message,
        });
    }

    const latestPaymentByOfferId = new Map<string, { offer_id: string; status: string }>();

    (payments || []).forEach((payment) => {
        if (!payment.offer_id) {
            return;
        }

        if (!latestPaymentByOfferId.has(payment.offer_id) || payment.status === 'completed') {
            latestPaymentByOfferId.set(payment.offer_id, payment);
        }
    });

    const statuses = (offers || []).reduce<Record<string, {
        offerStatus: string | null;
        paymentStatus: string | null;
        jobStatus: ReturnType<typeof deriveTruckerJobStatus>;
        canOpenTrip: boolean;
        blockingReason: string | null;
    }>>((accumulator, currentOffer) => {
        const latestPayment = latestPaymentByOfferId.get(currentOffer.id);
        const jobStatus = deriveTruckerJobStatus({
            offerStatus: currentOffer.status,
            paymentStatus: latestPayment?.status || null,
            pickupPin: currentOffer.pickup_pin,
            deliveryPin: currentOffer.delivery_pin,
            pickupVerifiedAt: currentOffer.pickup_verified_at,
            deliveryVerifiedAt: currentOffer.delivery_verified_at,
        });

        accumulator[currentOffer.id] = {
            offerStatus: currentOffer.status,
            paymentStatus: latestPayment?.status || null,
            jobStatus,
            canOpenTrip: jobStatus === 'awaiting' || jobStatus === 'in_transit' || jobStatus === 'delivered',
            blockingReason: buildBlockingReason(jobStatus),
        };

        return accumulator;
    }, {});

    return apiSuccess({
        statuses,
    }, {
        code: 'PAYMENT_OFFER_STATUSES_RESOLVED',
        requestId,
    });
}
