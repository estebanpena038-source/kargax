import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { createAdminNotification } from '@/lib/server/route-auth';
import { getDriverPayout } from '@/lib/server/driver-payouts';
import { getRequestAuditMetadata, recordStaffAuditEvent, requireStaffCapability, type StaffCapability } from '@/lib/server/staff';
import { recordCriticalOperation } from '@/lib/server/operations';

type DriverPayoutAction = 'approve' | 'reject' | 'cancel' | 'retry' | 'under_review' | 'mark_paid';

function normalizeAction(value: unknown): DriverPayoutAction | null {
    return value === 'approve'
        || value === 'reject'
        || value === 'cancel'
        || value === 'retry'
        || value === 'under_review'
        || value === 'mark_paid'
        ? value
        : null;
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const requestId = getRequestId(request);
    const body = await request.json().catch(() => ({}));
    const action = normalizeAction(body?.action);
    const requiredCapability: StaffCapability | null = action === 'mark_paid'
        ? 'payout:mark_paid'
        : action === 'approve' || action === 'reject'
            ? 'payout:approve'
            : action
                ? 'payout:review'
                : null;

    if (!action || !requiredCapability) {
        return apiError('Accion de payout invalida', {
            requestId,
            status: 400,
            code: 'DRIVER_PAYOUT_ACTION_INVALID',
        });
    }

    const auth = await requireStaffCapability(request, requiredCapability, {
        requireAal2: ['approve', 'reject', 'mark_paid'].includes(action),
    });

    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const { supabaseAdmin, authUser, staff } = auth.context;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
    const receiptUrl = typeof body?.receiptUrl === 'string' && body.receiptUrl.trim()
        ? body.receiptUrl.trim()
        : null;

    const { data: transaction, error: txError } = await supabaseAdmin
        .from('transactions')
        .select('id, wallet_id, amount, status, metadata')
        .eq('id', id)
        .eq('type', 'withdrawal')
        .maybeSingle();

    if (txError || !transaction) {
        return apiError('Pago a driver no encontrado', {
            requestId,
            status: 404,
            code: 'DRIVER_PAYOUT_NOT_FOUND',
        });
    }

    const { data: payoutAttempt } = await supabaseAdmin
        .from('payout_attempts')
        .select('*')
        .eq('wallet_transaction_id', transaction.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (payoutAttempt?.status === 'paid') {
        return apiError('Este pago ya fue marcado como pagado.', {
            requestId,
            status: 409,
            code: 'DRIVER_PAYOUT_ALREADY_PAID',
        });
    }

    if (['approve', 'reject', 'cancel'].includes(action)) {
        if (transaction.status !== 'pending') {
            return apiError('La solicitud ya fue procesada.', {
                requestId,
                status: 409,
                code: 'DRIVER_PAYOUT_ALREADY_PROCESSED',
            });
        }

        const { data, error } = await supabaseAdmin.rpc('process_withdrawal_request', {
            p_transaction_id: transaction.id,
            p_admin_id: authUser.id,
            p_action: action,
            p_note: note || null,
        });

        const result = Array.isArray(data) ? data[0] : null;
        if (error || !result?.success) {
            await recordCriticalOperation(supabaseAdmin, {
                requestId,
                actorUserId: authUser.id,
                actorType: 'staff',
                domain: 'wallet',
                action: 'driver_payout_staff_action',
                entityType: 'withdrawal',
                entityId: transaction.id,
                status: 'error',
                errorClass: 'DRIVER_PAYOUT_ACTION_FAILED',
                sourceReference: transaction.id,
                metadata: {
                    action,
                    previous_status: transaction.status,
                    actor_role: staff.actorRole,
                    note: note || null,
                },
            });

            return apiError(error?.message || result?.message || 'No se pudo procesar el pago a driver', {
                requestId,
                status: 500,
                code: 'DRIVER_PAYOUT_ACTION_FAILED',
            });
        }
    }

    if (action === 'retry') {
        if (!payoutAttempt) {
            return apiError('No existe intento de payout para reintentar.', {
                requestId,
                status: 404,
                code: 'PAYOUT_ATTEMPT_NOT_FOUND',
            });
        }

        await supabaseAdmin
            .from('payout_attempts')
            .update({
                status: 'queued',
                next_retry_at: null,
                failure_reason: null,
                failure_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', payoutAttempt.id);
    }

    if (action === 'under_review') {
        if (!payoutAttempt) {
            return apiError('No existe intento de payout para revisar.', {
                requestId,
                status: 404,
                code: 'PAYOUT_ATTEMPT_NOT_FOUND',
            });
        }

        await supabaseAdmin
            .from('payout_attempts')
            .update({
                status: 'manual_review',
                failure_reason: note || 'Revision manual solicitada por staff.',
                failure_message: note || 'Revision manual solicitada por staff.',
                manual_review_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', payoutAttempt.id);
    }

    if (action === 'mark_paid') {
        if (!payoutAttempt) {
            return apiError('No existe intento de payout para marcar como pagado.', {
                requestId,
                status: 404,
                code: 'PAYOUT_ATTEMPT_NOT_FOUND',
            });
        }

        if (!reference) {
            return apiError('La referencia de pago es obligatoria.', {
                requestId,
                status: 400,
                code: 'PAYOUT_REFERENCE_REQUIRED',
            });
        }

        const { error } = await supabaseAdmin.rpc('mark_payout_paid', {
            p_payout_attempt_id: payoutAttempt.id,
            p_provider_transfer_id: reference,
            p_receipt_url: receiptUrl,
            p_provider_response: {
                provider: 'manual',
                marked_by: authUser.id,
                actor_role: staff.actorRole,
                note: note || null,
            },
        });

        if (error) {
            return apiError(error.message || 'No se pudo marcar el payout como pagado', {
                requestId,
                status: 500,
                code: 'PAYOUT_MARK_PAID_FAILED',
            });
        }
    }

    await createAdminNotification(supabaseAdmin, {
        type: 'driver_payout_staff_action',
        title: 'Pago a driver actualizado',
        message: `La solicitud ${transaction.id.slice(0, 8)} recibio accion ${action}.`,
        data: {
            transaction_id: transaction.id,
            payout_attempt_id: payoutAttempt?.id || null,
            action,
            actor_id: authUser.id,
            actor_role: staff.actorRole,
            note: note || null,
            reference: action === 'mark_paid' ? reference : null,
        },
    });

    await recordCriticalOperation(supabaseAdmin, {
        requestId,
        actorUserId: authUser.id,
        actorType: 'staff',
        domain: 'wallet',
        action: 'driver_payout_staff_action',
        entityType: payoutAttempt ? 'payout_attempt' : 'withdrawal',
        entityId: payoutAttempt?.id || transaction.id,
        status: 'success',
        replayable: action === 'retry',
        sourceReference: transaction.id,
        metadata: {
            action,
            previous_status: transaction.status,
            provider_previous_status: payoutAttempt?.status || null,
            actor_role: staff.actorRole,
            note: note || null,
            reference: action === 'mark_paid' ? reference : null,
        },
    });

    await recordStaffAuditEvent(supabaseAdmin, {
        actorId: authUser.id,
        actorRole: staff.actorRole,
        capability: requiredCapability,
        targetType: payoutAttempt ? 'payout_attempt' : 'wallet_transaction',
        targetId: payoutAttempt?.id || transaction.id,
        previousState: {
            transaction_status: transaction.status,
            payout_status: payoutAttempt?.status || null,
        },
        newState: {
            action,
            reference: action === 'mark_paid' ? reference : null,
        },
        reason: note || null,
        ...getRequestAuditMetadata(request),
    });

    const data = await getDriverPayout(supabaseAdmin, transaction.id);

    return apiSuccess(data, {
        requestId,
        code: 'DRIVER_PAYOUT_ACTION_APPLIED',
    });
}
