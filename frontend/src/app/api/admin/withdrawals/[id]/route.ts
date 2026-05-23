import { NextRequest, NextResponse } from 'next/server';
import { createAdminNotification, requireAdminRoute } from '@/lib/server/route-auth';
import { getRequestId } from '@/lib/server/api-response';
import { recordCriticalOperation } from '@/lib/server/operations';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAdminRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser } = auth.context;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action as 'approve' | 'reject' | 'cancel';
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!['approve', 'reject', 'cancel'].includes(action)) {
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
