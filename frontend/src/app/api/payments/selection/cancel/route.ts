import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';

interface CancelSelectionRequest {
    offerId?: string;
    applicationId?: string;
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);

    try {
        const auth = await requireAal2Route(request);

        if ('response' in auth) {
            return auth.response;
        }

        const body = (await request.json()) as CancelSelectionRequest;
        const offerId = body.offerId?.trim();
        const applicationId = body.applicationId?.trim();

        if (!offerId || !applicationId) {
            return apiError('offerId y applicationId son requeridos', {
                status: 400,
                code: 'PAYMENT_SELECTION_VALIDATION_ERROR',
                requestId,
            });
        }

        const { authUser, profile, supabaseAdmin } = auth.context;

        if (profile?.user_type !== 'business' && profile?.user_type !== 'admin') {
            return apiError('Solo usuarios empresa o admin pueden cancelar esta selección', {
                status: 403,
                code: 'PAYMENT_SELECTION_FORBIDDEN',
                requestId,
            });
        }

        const { data: offer, error: offerError } = await supabaseAdmin
            .from('cargo_offers')
            .select(`
                id,
                business_id,
                status,
                assigned_trucker_id,
                pickup_pin,
                delivery_pin,
                pickup_verified_at,
                delivery_verified_at,
                arrived_at_origin_at,
                arrived_at_destination_at,
                loading_started_at,
                loading_completed_at,
                unloading_started_at,
                unloading_completed_at,
                manifest_loaded_count,
                manifest_delivered_count,
                manifest_rejected_count
            `)
            .eq('id', offerId)
            .maybeSingle();

        if (offerError || !offer) {
            return apiError('Oferta no encontrada', {
                status: 404,
                code: 'PAYMENT_SELECTION_OFFER_NOT_FOUND',
                requestId,
            });
        }

        if (profile?.user_type !== 'admin' && offer.business_id !== authUser.id) {
            return apiError('No tienes permiso para liberar esta oferta', {
                status: 403,
                code: 'PAYMENT_SELECTION_OWNERSHIP_ERROR',
                requestId,
            });
        }

        const { data: application, error: applicationError } = await supabaseAdmin
            .from('offer_applications')
            .select('id, status, trucker_id')
            .eq('id', applicationId)
            .eq('offer_id', offerId)
            .maybeSingle();

        if (applicationError || !application) {
            return apiError('Postulación no encontrada para esta oferta', {
                status: 404,
                code: 'PAYMENT_SELECTION_APPLICATION_NOT_FOUND',
                requestId,
            });
        }

        const { data: completedPayment } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('offer_id', offerId)
            .eq('status', 'completed')
            .maybeSingle();

        const offerAlreadyOperational =
            offer.status === 'reserved' ||
            offer.status === 'in_progress' ||
            offer.status === 'completed' ||
            Boolean(offer.pickup_pin) ||
            Boolean(offer.delivery_pin) ||
            Boolean(offer.pickup_verified_at) ||
            Boolean(offer.delivery_verified_at);

        if (completedPayment || offerAlreadyOperational) {
            return apiError('La oferta ya tiene un pago confirmado o ya entró en operación', {
                status: 409,
                code: 'PAYMENT_SELECTION_ALREADY_SECURED',
                requestId,
            });
        }

        const now = new Date().toISOString();

        const { data: activePayments } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('offer_id', offerId)
            .in('status', ['pending', 'processing']);

        const activePaymentIds = (activePayments || []).map((payment) => payment.id);

        if (activePaymentIds.length > 0) {
            const { error: expirePaymentsError } = await supabaseAdmin
                .from('payments')
                .update({
                    status: 'expired',
                    error_message: 'selection_cancelled_by_business_before_payment_confirmation',
                    expires_at: now,
                    updated_at: now,
                })
                .in('id', activePaymentIds);

            if (expirePaymentsError) {
                return apiError('No se pudieron cerrar los pagos pendientes de la oferta', {
                    status: 500,
                    code: 'PAYMENT_SELECTION_PAYMENT_RELEASE_FAILED',
                    requestId,
                    details: expirePaymentsError.message,
                });
            }
        }

        const { error: offerUpdateError } = await supabaseAdmin
            .from('cargo_offers')
            .update({
                status: 'active',
                assigned_trucker_id: null,
                platform_fee: null,
                net_amount: null,
                pickup_pin: null,
                delivery_pin: null,
                pickup_verified_at: null,
                delivery_verified_at: null,
                arrived_at_origin_at: null,
                arrived_at_destination_at: null,
                loading_started_at: null,
                loading_completed_at: null,
                unloading_started_at: null,
                unloading_completed_at: null,
                manifest_loaded_count: 0,
                manifest_delivered_count: 0,
                manifest_rejected_count: 0,
                updated_at: now,
            })
            .eq('id', offerId);

        if (offerUpdateError) {
            return apiError('No se pudo reabrir la oferta', {
                status: 500,
                code: 'PAYMENT_SELECTION_OFFER_RELEASE_FAILED',
                requestId,
                details: offerUpdateError.message,
            });
        }

        const { error: selectedApplicationError } = await supabaseAdmin
            .from('offer_applications')
            .update({
                status: 'pending',
                business_response: null,
                responded_at: null,
                updated_at: now,
            })
            .eq('id', applicationId)
            .eq('offer_id', offerId)
            .eq('status', 'accepted');

        if (selectedApplicationError) {
            return apiError('No se pudo liberar la postulación seleccionada', {
                status: 500,
                code: 'PAYMENT_SELECTION_APPLICATION_RELEASE_FAILED',
                requestId,
                details: selectedApplicationError.message,
            });
        }

        const { error: reopenOthersError } = await supabaseAdmin
            .from('offer_applications')
            .update({
                status: 'pending',
                business_response: null,
                responded_at: null,
                updated_at: now,
            })
            .eq('offer_id', offerId)
            .eq('status', 'rejected')
            .eq('business_response', 'Otro transportador fue seleccionado');

        if (reopenOthersError) {
            return apiError('No se pudieron reabrir las demás postulaciones de la oferta', {
                status: 500,
                code: 'PAYMENT_SELECTION_REOPEN_OTHERS_FAILED',
                requestId,
                details: reopenOthersError.message,
            });
        }

        return apiSuccess({
            offerId,
            applicationId,
            released: true,
            expiredPayments: activePaymentIds.length,
            truckerId: application.trucker_id,
        }, {
            code: 'PAYMENT_SELECTION_RELEASED',
            requestId,
        });
    } catch (error) {
        return apiError('No se pudo cancelar la selección pendiente de pago', {
            status: 500,
            code: 'PAYMENT_SELECTION_UNEXPECTED_ERROR',
            requestId,
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
