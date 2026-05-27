import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/server/route-auth';

function normalizeWithdrawal(row: Record<string, any>): Record<string, any> {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return {
        ...row,
        amount: Number(row.amount || 0),
        balance_before: Number(row.balance_before || 0),
        balance_after: Number(row.balance_after || 0),
        pending_balance_before: Number(row.pending_balance_before || 0),
        pending_balance_after: Number(row.pending_balance_after || 0),
        source_kind: typeof metadata.source_kind === 'string' ? metadata.source_kind : 'withdrawal_request',
        source_reference: typeof metadata.source_reference === 'string'
            ? metadata.source_reference
            : row.reference_id || row.id,
        withdrawal_snapshot: {
            withdrawal_request_id: metadata.withdrawal_request_id || row.reference_id || row.id,
            payment_method: metadata.payment_method || null,
            admin_action: metadata.admin_action || null,
            processed_by: metadata.processed_by || null,
            processed_at: metadata.processed_at || null,
        },
    };
}

export async function GET(request: NextRequest) {
    const auth = await requireAdminRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin } = auth.context;

    const { data: withdrawals, error } = await supabaseAdmin
        .from('transactions')
        .select('id, wallet_id, offer_id, type, status, amount, description, reference_id, metadata, balance_before, balance_after, pending_balance_before, pending_balance_after, created_at')
        .eq('type', 'withdrawal')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const walletIds = [...new Set((withdrawals || []).map((item) => item.wallet_id).filter(Boolean))];

    const { data: wallets } = walletIds.length
        ? await supabaseAdmin
            .from('wallets')
            .select('id, user_id, available_balance, pending_balance, total_earned, total_withdrawn')
            .in('id', walletIds)
        : { data: [] as any[] };

    const userIds = [...new Set((wallets || []).map((wallet) => wallet.user_id).filter(Boolean))];
    const withdrawalIds = [...new Set((withdrawals || []).map((item) => item.id).filter(Boolean))];

    const { data: profiles } = userIds.length
        ? await supabaseAdmin
            .from('user_profiles')
            .select('id, full_name, email, phone')
            .in('id', userIds)
        : { data: [] as any[] };

    const walletMap = new Map((wallets || []).map((wallet) => [wallet.id, wallet]));
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const { data: payoutAttempts } = withdrawalIds.length
        ? await supabaseAdmin
            .from('payout_attempts')
            .select('id, wallet_transaction_id, provider, method, amount_cop, status, provider_transfer_id, receipt_url, failure_reason, failure_message, attempts_count, next_retry_at, paid_at, failed_at, created_at, updated_at')
            .in('wallet_transaction_id', withdrawalIds)
        : { data: [] as any[] };
    const payoutByTransactionId = new Map((payoutAttempts || []).map((attempt) => [attempt.wallet_transaction_id, attempt]));

    const data = ((withdrawals || []) as Array<Record<string, any>>).map((row) => normalizeWithdrawal(row)).map((withdrawal) => {
        const wallet = walletMap.get(withdrawal.wallet_id);
        const profile = wallet ? profileMap.get(wallet.user_id) : null;

        return {
            ...withdrawal,
            requested_amount: Math.abs(Number(withdrawal.amount || 0)),
            payout_attempt: payoutByTransactionId.get(withdrawal.id) || null,
            wallet,
            trucker: profile
                ? {
                    id: profile.id,
                    fullName: profile.full_name,
                    email: profile.email,
                    phone: profile.phone,
                }
                : null,
        };
    });

    return NextResponse.json({ data });
}
