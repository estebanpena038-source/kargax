import { NextRequest } from 'next/server';
import { merchantOrderApi, paymentApi } from '@/lib/mercadopago/config';
import { deriveFreightTripStatus } from '@/lib/payments/trip-state';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { reconcileFreightPaymentFromMercadoPagoPayment } from '@/lib/server/payments/freight-settlement';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

function readPaymentIdFromReturn(searchParams: URLSearchParams) {
    return searchParams.get('payment_id')
        || searchParams.get('collection_id')
        || searchParams.get('paymentId')
        || null;
}

function readMerchantOrderIdFromReturn(searchParams: URLSearchParams) {
    return searchParams.get('merchant_order_id')
        || searchParams.get('merchantOrderId')
        || null;
}

function readLocalPaymentRecordId(searchParams: URLSearchParams) {
    return searchParams.get('local_payment_id')
        || searchParams.get('payment_record_id')
        || searchParams.get('localPaymentId')
        || null;
}

function pickProviderPaymentIdFromMerchantOrder(
    merchantOrder: {
        payments?: Array<{
            id?: string | number;
            status?: string;
            date_approved?: string;
            date_created?: string;
            last_modified?: string;
        }>;
    } | null
) {
    const payments = (merchantOrder?.payments || [])
        .filter((payment) => payment?.id !== undefined && payment?.id !== null);

    if (!payments.length) {
        return null;
    }

    const approvedPayment = payments.find((payment) => String(payment.status || '').toLowerCase() === 'approved');
    if (approvedPayment?.id !== undefined && approvedPayment.id !== null) {
        return String(approvedPayment.id);
    }

    const sortedPayments = [...payments].sort((left, right) => {
        const leftTimestamp = new Date(
            left.last_modified || left.date_approved || left.date_created || 0
        ).getTime();
        const rightTimestamp = new Date(
            right.last_modified || right.date_approved || right.date_created || 0
        ).getTime();

        return rightTimestamp - leftTimestamp;
    });

    const fallbackPaymentId = sortedPayments[0]?.id;
    return fallbackPaymentId !== undefined && fallbackPaymentId !== null
        ? String(fallbackPaymentId)
        : null;
}

function buildSettlementSyncErrorMessage(
    syncResult: Awaited<ReturnType<typeof reconcileFreightPaymentFromMercadoPagoPayment>> | null
) {
    if (!syncResult || syncResult.settlementApplied || syncResult.duplicate) {
        return null;
    }

    switch (syncResult.reason) {
        case 'missing_provider_payment_id':
            return 'Mercado Pago no devolvio un identificador verificable del pago.';
        case 'missing_payment_reference':
            return 'El pago fue reportado por Mercado Pago, pero no pudimos vincularlo con la reserva interna.';
        case 'process_unsuccessful':
            return 'El pago fue aprobado, pero la conciliacion interna no pudo cerrar la reserva.';
        default:
            if (syncResult.reason?.includes('Estado de pago invalido')) {
                return 'El pago quedo en un estado intermedio y requiere una conciliacion segura.';
            }

            return syncResult.reason || null;
    }
}

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const offerId = request.nextUrl.searchParams.get('offerId')?.trim()
        || request.nextUrl.searchParams.get('offer_id')?.trim()
        || null;
    const paymentIdFromReturn = readPaymentIdFromReturn(request.nextUrl.searchParams);
    const merchantOrderIdFromReturn = readMerchantOrderIdFromReturn(request.nextUrl.searchParams);
    const localPaymentRecordId = readLocalPaymentRecordId(request.nextUrl.searchParams);
    const syncRequested = request.nextUrl.searchParams.get('sync') === '1';

    if (!offerId) {
        return apiError('offerId es requerido', {
            status: 400,
            code: 'PAYMENT_STATUS_OFFER_REQUIRED',
            requestId,
        });
    }

    const { authUser, profile, supabaseAdmin } = auth.context;

    const { data: offer, error: offerError } = await supabaseAdmin
        .from('cargo_offers')
        .select(`
            id,
            business_id,
            assigned_trucker_id,
            private_fleet_trucker_id,
            status,
            pickup_pin,
            delivery_pin,
            pickup_verified_at,
            delivery_verified_at
        `)
        .eq('id', offerId)
        .maybeSingle();

    if (offerError || !offer) {
        return apiError('Oferta no encontrada', {
            status: 404,
            code: 'PAYMENT_STATUS_OFFER_NOT_FOUND',
            requestId,
        });
    }

    const isAdmin = profile?.user_type === 'admin';
    const isBusinessOwner = profile?.user_type === 'business' && offer.business_id === authUser.id;
    let hasTruckerAccess = offer.assigned_trucker_id === authUser.id || offer.private_fleet_trucker_id === authUser.id;

    if (!isAdmin && !isBusinessOwner && !hasTruckerAccess) {
        const { data: acceptedApplication } = await supabaseAdmin
            .from('offer_applications')
            .select('id')
            .eq('offer_id', offerId)
            .eq('trucker_id', authUser.id)
            .eq('status', 'accepted')
            .maybeSingle();

        hasTruckerAccess = Boolean(acceptedApplication?.id);
    }

    if (!isAdmin && !isBusinessOwner && !hasTruckerAccess) {
        return apiError('No tienes permiso para consultar este pago', {
            status: 403,
            code: 'PAYMENT_STATUS_FORBIDDEN',
            requestId,
        });
    }

    const { data: initialPaymentRows, error: initialPaymentsError } = await supabaseAdmin
        .from('payments')
        .select('id, offer_id, status, external_id, external_reference, created_at, completed_at, updated_at')
        .eq('offer_id', offerId)
        .order('created_at', { ascending: false });

    if (initialPaymentsError) {
        return apiError('No se pudo cargar el estado del pago', {
            status: 500,
            code: 'PAYMENT_STATUS_LOAD_FAILED',
            requestId,
            details: initialPaymentsError.message,
        });
    }

    let syncResult: Awaited<ReturnType<typeof reconcileFreightPaymentFromMercadoPagoPayment>> | null = null;
    let syncError: string | null = null;
    let providerPaymentIdForSync = paymentIdFromReturn;

    const scopedPaymentRows = localPaymentRecordId
        ? (initialPaymentRows || []).filter((payment) => payment.id === localPaymentRecordId)
        : (initialPaymentRows || []);
    const syncCandidatePayment = scopedPaymentRows[0] || initialPaymentRows?.[0] || null;

    if (syncRequested && (isAdmin || isBusinessOwner)) {
        try {
            if (!providerPaymentIdForSync && merchantOrderIdFromReturn) {
                const merchantOrder = await merchantOrderApi.get({
                    merchantOrderId: merchantOrderIdFromReturn,
                });
                providerPaymentIdForSync = pickProviderPaymentIdFromMerchantOrder(merchantOrder);
            }

            if (!providerPaymentIdForSync) {
                providerPaymentIdForSync = syncCandidatePayment?.external_id || null;
            }

            if (!providerPaymentIdForSync) {
                syncError = 'No pudimos obtener un identificador confiable del pago para reconciliar la reserva.';
            } else {
                const providerPayment = await paymentApi.get({ id: providerPaymentIdForSync });
                syncResult = await reconcileFreightPaymentFromMercadoPagoPayment(supabaseAdmin, providerPayment);
                syncError = buildSettlementSyncErrorMessage(syncResult);
            }
        } catch (error) {
            syncError = error instanceof Error ? error.message : 'No se pudo sincronizar el pago con Mercado Pago';
        }
    }

    let effectiveOffer = offer;
    let paymentRows = initialPaymentRows || [];

    if (syncRequested && (isAdmin || isBusinessOwner)) {
        const [{ data: freshOffer }, { data: freshPaymentRows, error: freshPaymentsError }] = await Promise.all([
            supabaseAdmin
                .from('cargo_offers')
                .select(`
                    id,
                    business_id,
                    assigned_trucker_id,
                    private_fleet_trucker_id,
                    status,
                    pickup_pin,
                    delivery_pin,
                    pickup_verified_at,
                    delivery_verified_at
                `)
                .eq('id', offerId)
                .maybeSingle(),
            supabaseAdmin
                .from('payments')
                .select('id, offer_id, status, external_id, external_reference, created_at, completed_at, updated_at')
                .eq('offer_id', offerId)
                .order('created_at', { ascending: false }),
        ]);

        if (freshPaymentsError) {
            return apiError('No se pudo cargar el estado del pago', {
                status: 500,
                code: 'PAYMENT_STATUS_LOAD_FAILED',
                requestId,
                details: freshPaymentsError.message,
            });
        }

        if (freshOffer) {
            effectiveOffer = freshOffer;
        }

        paymentRows = freshPaymentRows || [];
    }

    const completedPayment = (paymentRows || []).find((payment) => payment.status === 'completed') || null;
    const latestPayment = completedPayment || paymentRows?.[0] || null;

    const tripStatus = deriveFreightTripStatus({
        offerStatus: effectiveOffer?.status,
        paymentStatus: latestPayment?.status || null,
        pickupPin: effectiveOffer?.pickup_pin,
        deliveryPin: effectiveOffer?.delivery_pin,
        pickupVerifiedAt: effectiveOffer?.pickup_verified_at,
        deliveryVerifiedAt: effectiveOffer?.delivery_verified_at,
    });

    return apiSuccess({
        offer: {
            id: effectiveOffer?.id || offerId,
            status: effectiveOffer?.status || null,
            pickupPin: effectiveOffer?.pickup_pin || null,
            deliveryPin: effectiveOffer?.delivery_pin || null,
            pickupVerifiedAt: effectiveOffer?.pickup_verified_at || null,
            deliveryVerifiedAt: effectiveOffer?.delivery_verified_at || null,
        },
        payment: latestPayment
            ? {
                id: latestPayment.id,
                status: latestPayment.status,
                externalId: latestPayment.external_id,
                externalReference: latestPayment.external_reference,
                completedAt: latestPayment.completed_at,
                updatedAt: latestPayment.updated_at,
            }
            : null,
        tripStatus,
        canResumePayment: tripStatus === 'awaiting_payment' || tripStatus === 'pending_confirmation',
        sync: {
            attempted: Boolean(syncRequested && (isAdmin || isBusinessOwner)),
            paymentIdFromReturn,
            providerPaymentIdForSync,
            merchantOrderIdFromReturn,
            localPaymentRecordId,
            result: syncResult,
            error: syncError,
        },
    }, {
        code: 'PAYMENT_STATUS_RESOLVED',
        requestId,
        meta: {
            offerId,
        },
    });
}
