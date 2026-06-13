import { NextRequest, NextResponse } from 'next/server';
import { createAdminNotification } from '@/lib/server/route-auth';
import { requireInternalAdminCapability } from '@/lib/server/internal-admins';
import { getRequestId } from '@/lib/server/api-response';
import { recordCriticalOperation } from '@/lib/server/operations';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireInternalAdminCapability(request, 'payout:write');

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, internalAdmin } = auth.context;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action as 'approve' | 'reject' | 'cancel' | 'retry_payout' | 'force_manual_review' | 'mark_paid_manual';
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!['approve', 'reject', 'cancel', 'retry_payout', 'force_manual_review', 'mark_paid_manual'].includes(action)) {
        await recordCriticalOperation(auth.context.supabaseAdmin, {
            requestId,
            actorUserId: auth.context.authUser.id,
            actorType: 'admin',
            domain: 'wallet',
            action: 'admin_process_withdrawal',
            entityType: 'withdrawal',
            entityId: id,
            status: 'error',
            errorClass: 'WITHDRAWAL_INVALID_ACTION',
            replayable: false,
            sourceReference: id,
            incident: {
                title: 'Withdrawal action invalid',
                severity: 'low',
                runbookKey: 'withdrawal_stuck',
            },
        });
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: transaction, error: txError } = await supabaseAdmin
        .from('transactions')
        .select('id, wallet_id, amount, status, metadata')
        .eq('id', id)
        .single();

    if (txError || !transaction) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: authUser.id,
            actorType: 'admin',
            domain: 'wallet',
            action: 'admin_process_withdrawal',
            entityType: 'withdrawal',
            entityId: id,
            status: 'error',
            errorClass: 'WITHDRAWAL_NOT_FOUND',
            replayable: false,
            sourceReference: id,
            incident: {
                title: 'Withdrawal not found',
                severity: 'medium',
                runbookKey: 'withdrawal_stuck',
            },
        });
        return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    if (transaction.status !== 'pending') {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: authUser.id,
            actorType: 'admin',
            domain: 'wallet',
            action: 'admin_process_withdrawal',
            entityType: 'withdrawal',
            entityId: transaction.id,
            status: 'error',
            errorClass: 'WITHDRAWAL_ALREADY_PROCESSED',
            replayable: false,
            sourceReference: transaction.id,
            incident: {
                title: 'Withdrawal already processed',
                severity: 'low',
                runbookKey: 'withdrawal_stuck',
            },
        });
        return NextResponse.json({ error: 'Withdrawal already processed' }, { status: 409 });
    }

    const amount = Math.abs(Number(transaction.amount || 0));

    const { data: wallet, error: walletError } = await supabaseAdmin
        .from('wallets')
        .select('id, user_id, available_balance, total_withdrawn')
        .eq('id', transaction.wallet_id)
        .single();

    if (walletError || !wallet) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: authUser.id,
            actorType: 'admin',
            domain: 'wallet',
            action: 'admin_process_withdrawal',
            entityType: 'wallet',
            entityId: transaction.wallet_id,
            status: 'error',
            errorClass: 'WALLET_NOT_FOUND',
            replayable: false,
            sourceReference: transaction.id,
            incident: {
                title: 'Wallet missing during withdrawal processing',
                severity: 'high',
                runbookKey: 'withdrawal_stuck',
            },
        });
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (['retry_payout', 'force_manual_review', 'mark_paid_manual'].includes(action)) {
        const { data: payoutAttempt } = await supabaseAdmin
            .from('payout_attempts')
            .select('*')
            .eq('wallet_transaction_id', transaction.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!payoutAttempt) {
            return NextResponse.json({ error: 'Payout attempt not found' }, { status: 404 });
        }

        if (action === 'retry_payout') {
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

        if (action === 'force_manual_review') {
            await supabaseAdmin
                .from('payout_attempts')
                .update({
                    status: 'manual_review',
                    failure_reason: note || 'Revision manual solicitada por admin.',
                    failure_message: note || 'Revision manual solicitada por admin.',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payoutAttempt.id);
        }

        if (action === 'mark_paid_manual') {
            const providerTransferId = typeof body?.providerTransferId === 'string' && body.providerTransferId.trim()
                ? body.providerTransferId.trim()
                : `manual:${transaction.id}`;
            const receiptUrl = typeof body?.receiptUrl === 'string' && body.receiptUrl.trim()
                ? body.receiptUrl.trim()
                : null;

            const { error: paidError } = await supabaseAdmin.rpc('mark_payout_paid', {
                p_payout_attempt_id: payoutAttempt.id,
                p_provider_transfer_id: providerTransferId,
                p_receipt_url: receiptUrl,
                p_provider_response: {
                    provider: 'manual',
                    marked_by: authUser.id,
                    note: note || null,
                },
            });

            if (paidError) {
                return NextResponse.json({ error: paidError.message }, { status: 500 });
            }
        }

        await createAdminNotification(supabaseAdmin, {
            type: 'payout_admin_action',
            title: 'Payout actualizado por admin',
            message: `Payout ${payoutAttempt.id.slice(0, 8)} recibio accion ${action}.`,
            data: {
                request_id: transaction.id,
                payout_attempt_id: payoutAttempt.id,
                action,
                note: note || null,
                trucker_id: wallet.user_id,
            },
        });

        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: authUser.id,
            actorType: 'admin',
            domain: 'wallet',
            action: 'admin_payout_action',
            entityType: 'payout_attempt',
            entityId: payoutAttempt.id,
            status: 'success',
            replayable: action === 'retry_payout',
            sourceReference: transaction.id,
            metadata: {
                action,
                amount,
                note: note || null,
                actor_role: internalAdmin.actorRole,
            },
        });

        return NextResponse.json({
            success: true,
            action,
            request_id: transaction.id,
            payout_attempt_id: payoutAttempt.id,
        });
    }

    const { data: processingResult, error: processingError } = await supabaseAdmin.rpc('process_withdrawal_request', {
        p_transaction_id: transaction.id,
        p_admin_id: authUser.id,
        p_action: action,
        p_note: note || null,
    });

    const processing = Array.isArray(processingResult) ? processingResult[0] : null;

    if (processingError || !processing?.success) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: authUser.id,
            actorType: 'admin',
            domain: 'wallet',
            action: 'admin_process_withdrawal',
            entityType: 'withdrawal',
            entityId: transaction.id,
            businessId: null,
            status: 'error',
            errorClass: 'WITHDRAWAL_PROCESS_FAILED',
            replayable: true,
            replayAction: 'retry_notification',
            sourceReference: transaction.id,
            metadata: {
                action,
                note: note || null,
                walletId: wallet.id,
            },
            incident: {
                title: 'Withdrawal processing failed',
                detail: processingError?.message || processing?.message || 'Could not process withdrawal',
                severity: 'high',
                runbookKey: 'withdrawal_stuck',
                replayPayload: {
                    notificationType: 'withdrawal',
                    withdrawalId: transaction.id,
                },
            },
        });
        return NextResponse.json({
            error: processingError?.message || processing?.message || 'Could not process withdrawal',
        }, { status: 500 });
    }

    await createAdminNotification(supabaseAdmin, {
        type: 'withdrawal_processed',
        title: `Retiro ${action === 'approve' ? 'aprobado' : 'rechazado'}`,
        message: `La solicitud ${transaction.id.slice(0, 8)} fue ${action === 'approve' ? 'aprobada' : 'rechazada'}.`,
        data: {
            request_id: transaction.id,
            wallet_id: wallet.id,
            amount,
            action,
            note: note || null,
            trucker_id: wallet.user_id,
        },
    });

    await supabaseAdmin
        .from('admin_notifications')
        .update({
            processed: true,
            processed_at: new Date().toISOString(),
            processed_by: authUser.id,
            read: true,
        })
        .eq('type', 'withdrawal_request')
        .contains('data', { request_id: transaction.id });

    await recordCriticalOperation(supabaseAdmin, {
        requestId,
        actorUserId: authUser.id,
        actorType: 'admin',
        domain: 'wallet',
        action: 'admin_process_withdrawal',
        entityType: 'withdrawal',
        entityId: transaction.id,
        status: 'success',
        replayable: false,
        sourceReference: transaction.id,
        metadata: {
            action,
            amount,
            note: note || null,
            actor_role: internalAdmin.actorRole,
            reversal_transaction_id: processing?.reversal_transaction_id || null,
        },
    });

    return NextResponse.json({
        success: true,
        action,
        request_id: transaction.id,
        reversal_transaction_id: processing?.reversal_transaction_id || null,
    });
}
