import { NextRequest } from 'next/server';
import { createAdminNotification } from '@/lib/server/route-auth';
import { requireInternalAdminCapability } from '@/lib/server/internal-admins';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { buildPaymentIdempotencyKey } from '@/lib/contracts/payments';
import { recordCriticalOperation } from '@/lib/server/operations';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireInternalAdminCapability(request, 'payment:reconcile');

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin } = auth.context;
    const body = await request.json().catch(() => ({}));
    const paymentId = typeof body?.paymentId === 'string' ? body.paymentId : null;
    const offerId = typeof body?.offerId === 'string' ? body.offerId : null;
    const externalId = typeof body?.externalId === 'string' ? body.externalId : null;
    const reasonCode = typeof body?.reasonCode === 'string' ? body.reasonCode : 'manual_reconcile';

    if (!paymentId && !offerId) {
        return apiError('paymentId or offerId is required', {
            status: 400,
            code: 'PAYMENT_IDENTIFIER_REQUIRED',
            requestId,
        });
    }

    let query = supabaseAdmin.from('payments').select('id, offer_id, status').limit(1);

    query = paymentId ? query.eq('id', paymentId) : query.eq('offer_id', offerId);

    const { data: payment, error: paymentError } = await query.single();

    if (paymentError || !payment) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: auth.context.authUser.id,
            actorType: 'admin',
            domain: 'payments',
            action: 'admin_payment_reconcile',
            entityType: 'payment',
            entityId: paymentId || offerId || null,
            status: 'error',
            errorClass: 'PAYMENT_NOT_FOUND',
            replayable: false,
            metadata: {
                paymentId,
                offerId,
            },
            incident: {
                title: 'Payment reconcile target not found',
                detail: 'The admin reconcile flow could not resolve a payment by paymentId or offerId.',
                severity: 'medium',
                runbookKey: 'payment_webhook_failure',
            },
        });
        return apiError('Payment not found', {
            status: 404,
            code: 'PAYMENT_NOT_FOUND',
            requestId,
        });
    }

    if (payment.status === 'completed') {
        return apiSuccess({
            alreadyReconciled: true,
            paymentId: payment.id,
        }, {
            code: 'PAYMENT_ALREADY_RECONCILED',
            requestId,
            meta: {
                offerId: payment.offer_id,
            },
        });
    }

    const resolvedExternalId =
        externalId ||
        buildPaymentIdempotencyKey(['manual-reconcile', payment.id, payment.offer_id || 'no-offer']);

    const { data: result, error: reconcileError } = await supabaseAdmin.rpc('process_successful_payment', {
        p_payment_id: payment.id,
        p_external_id: resolvedExternalId,
        p_gateway_response: {
            manual_reconcile: true,
            reason_code: reasonCode,
            reconciled_at: new Date().toISOString(),
            external_id: resolvedExternalId,
        },
    });

    if (reconcileError) {
        await createAdminNotification(supabaseAdmin, {
            type: 'payment_incident',
            title: 'Error en conciliacion manual',
            message: `No se pudo reconciliar el pago ${payment.id.slice(0, 8)}.`,
            data: {
                payment_id: payment.id,
                offer_id: payment.offer_id,
                error: reconcileError.message,
            },
        });

        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: auth.context.authUser.id,
            actorType: 'admin',
            domain: 'payments',
            action: 'admin_payment_reconcile',
            entityType: 'payment',
            entityId: payment.id,
            businessId: null,
            status: 'error',
            errorClass: 'PAYMENT_RECONCILE_FAILED',
            replayable: true,
            replayAction: 'reconcile_payment',
            sourceReference: payment.offer_id,
            metadata: {
                paymentId: payment.id,
                offerId: payment.offer_id,
                reasonCode,
            },
            incident: {
                title: 'Manual payment reconcile failed',
                detail: reconcileError.message,
                severity: 'high',
                runbookKey: 'payment_webhook_failure',
                replayPayload: {
                    paymentId: payment.id,
                    offerId: payment.offer_id,
                },
            },
        });

        return apiError(reconcileError.message, {
            status: 500,
            code: 'PAYMENT_RECONCILE_FAILED',
            requestId,
        });
    }

    await recordCriticalOperation(supabaseAdmin, {
        requestId,
        actorUserId: auth.context.authUser.id,
        actorType: 'admin',
        domain: 'payments',
        action: 'admin_payment_reconcile',
        entityType: 'payment',
        entityId: payment.id,
        status: 'success',
        replayable: false,
        sourceReference: payment.offer_id,
        metadata: {
            paymentId: payment.id,
            offerId: payment.offer_id,
            reasonCode,
            externalId: resolvedExternalId,
        },
    });

    return apiSuccess({
        paymentId: payment.id,
        externalId: resolvedExternalId,
        reasonCode,
        result: Array.isArray(result) ? result[0] : result,
    }, {
        code: 'PAYMENT_RECONCILED',
        requestId,
        meta: {
            offerId: payment.offer_id,
        },
    });
}
