import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;
type JsonRecord = Record<string, unknown>;

export type DriverPayoutOperationalStatus =
    | 'pending'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'paid'
    | 'failed'
    | 'cancelled';

export interface DriverPayoutFilters {
    status?: string | null;
    driverId?: string | null;
    businessId?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
}

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : {};
}

function numberValue(value: unknown) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function maskTail(value: unknown) {
    const text = stringValue(value);
    if (!text) {
        return null;
    }

    const tail = text.slice(-4);
    return tail ? `****${tail}` : '****';
}

function resolveOperationalStatus(transaction: JsonRecord, payoutAttempt?: JsonRecord | null): DriverPayoutOperationalStatus {
    const txStatus = String(transaction.status || '').toLowerCase();
    const txMetadata = asRecord(transaction.metadata);
    const adminAction = String(txMetadata.admin_action || '').toLowerCase();
    const payoutStatus = String(payoutAttempt?.status || '').toLowerCase();

    if (payoutStatus === 'paid') return 'paid';
    if (payoutStatus === 'manual_review') return 'under_review';
    if (payoutStatus === 'failed') return 'failed';
    if (payoutStatus === 'cancelled' || payoutStatus === 'reversed') return 'cancelled';
    if (['queued', 'processing', 'requested'].includes(payoutStatus)) return 'approved';
    if (adminAction === 'reject' || txStatus === 'rejected') return 'rejected';
    if (adminAction === 'cancel' || txStatus === 'cancelled' || txStatus === 'reversed') return 'cancelled';
    if (txStatus === 'completed') return 'approved';

    return 'pending';
}

function normalizeDestination(payoutAttempt?: JsonRecord | null) {
    const destination = asRecord(payoutAttempt?.destination_snapshot);

    return {
        method: stringValue(payoutAttempt?.method) || stringValue(destination.method) || 'manual',
        provider: stringValue(payoutAttempt?.provider) || 'manual',
        account_tail: maskTail(destination.account_number || destination.accountNumber || destination.phone_number || destination.phoneNumber),
        holder: stringValue(destination.account_holder_name || destination.accountHolderName),
    };
}

export function normalizeDriverPayout(
    transaction: JsonRecord,
    context: {
        payoutAttempt?: JsonRecord | null;
        wallet?: JsonRecord | null;
        trucker?: JsonRecord | null;
        offer?: JsonRecord | null;
        payment?: JsonRecord | null;
    } = {}
) {
    const metadata = asRecord(transaction.metadata);
    const payoutAttempt = context.payoutAttempt || null;
    const amount = Math.abs(numberValue(transaction.amount));
    const payment = context.payment || null;
    const offer = context.offer || null;
    const status = resolveOperationalStatus(transaction, payoutAttempt);
    const platformFee = numberValue(payment?.platform_fee || metadata.platform_fee);
    const gross = numberValue(payment?.subtotal || metadata.gross_amount || amount + platformFee);

    return {
        id: transaction.id,
        wallet_transaction_id: transaction.id,
        payout_attempt_id: payoutAttempt?.id || null,
        status,
        transaction_status: transaction.status || null,
        provider_status: payoutAttempt?.status || null,
        source_kind: stringValue(metadata.source_kind) || 'withdrawal_request',
        source_reference: stringValue(metadata.source_reference) || stringValue(transaction.reference_id) || transaction.id,
        value_earned_cop: gross,
        platform_fee_cop: platformFee,
        net_to_pay_cop: amount,
        requested_amount_cop: amount,
        generated_at: transaction.created_at,
        updated_at: payoutAttempt?.updated_at || transaction.created_at,
        paid_at: payoutAttempt?.paid_at || null,
        failed_at: payoutAttempt?.failed_at || null,
        failure_reason: payoutAttempt?.failure_reason || payoutAttempt?.failure_message || null,
        reference: payoutAttempt?.provider_transfer_id || payoutAttempt?.provider_reference || null,
        receipt_url: payoutAttempt?.receipt_url || null,
        destination: normalizeDestination(payoutAttempt),
        driver: context.trucker
            ? {
                id: context.trucker.id,
                full_name: context.trucker.full_name,
                email: context.trucker.email,
                phone: context.trucker.phone,
            }
            : null,
        wallet: context.wallet
            ? {
                id: context.wallet.id,
                available_balance: numberValue(context.wallet.available_balance),
                pending_balance: numberValue(context.wallet.pending_balance),
                total_earned: numberValue(context.wallet.total_earned),
                total_withdrawn: numberValue(context.wallet.total_withdrawn),
            }
            : null,
        route: offer
            ? {
                id: offer.id,
                business_id: offer.business_id,
                origin_city: offer.origin_city,
                origin_department: offer.origin_department,
                destination_city: offer.destination_city,
                destination_department: offer.destination_department,
                cargo_description: offer.cargo_description,
                status: offer.status,
            }
            : null,
        payment: payment
            ? {
                id: payment.id,
                status: payment.status,
                total_amount: numberValue(payment.total_amount),
                subtotal: numberValue(payment.subtotal),
                platform_fee: numberValue(payment.platform_fee),
            }
            : null,
        audit_snapshot: {
            admin_action: metadata.admin_action || null,
            processed_by: metadata.processed_by || null,
            processed_at: metadata.processed_at || null,
            note: metadata.admin_note || metadata.note || null,
        },
    };
}

export async function listDriverPayouts(
    supabaseAdmin: AdminClient,
    filters: DriverPayoutFilters = {}
) {
    let query = supabaseAdmin
        .from('transactions')
        .select('id, wallet_id, offer_id, type, status, amount, description, reference_id, metadata, created_at')
        .eq('type', 'withdrawal')
        .order('created_at', { ascending: false })
        .limit(filters.limit || 100);

    if (filters.from) {
        query = query.gte('created_at', filters.from);
    }

    if (filters.to) {
        query = query.lte('created_at', filters.to);
    }

    const { data: transactions, error } = await query;
    if (error) {
        throw new Error(error.message || 'Could not load driver payouts.');
    }

    return enrichDriverPayouts(supabaseAdmin, transactions || [], filters);
}

export async function getDriverPayout(
    supabaseAdmin: AdminClient,
    payoutId: string
) {
    const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('id, wallet_id, offer_id, type, status, amount, description, reference_id, metadata, created_at')
        .eq('id', payoutId)
        .eq('type', 'withdrawal')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Could not load driver payout.');
    }

    if (!data) {
        return null;
    }

    const payouts = await enrichDriverPayouts(supabaseAdmin, [data], {});
    return payouts[0] || null;
}

async function enrichDriverPayouts(
    supabaseAdmin: AdminClient,
    transactions: JsonRecord[],
    filters: DriverPayoutFilters
) {
    const walletIds = [...new Set(transactions.map((item) => stringValue(item.wallet_id)).filter(Boolean))] as string[];
    const transactionIds = [...new Set(transactions.map((item) => stringValue(item.id)).filter(Boolean))] as string[];
    const offerIds = [...new Set(transactions.map((item) => stringValue(item.offer_id)).filter(Boolean))] as string[];

    const [{ data: wallets }, { data: payoutAttempts }, { data: offers }, { data: payments }] = await Promise.all([
        walletIds.length
            ? supabaseAdmin
                .from('wallets')
                .select('id, user_id, available_balance, pending_balance, total_earned, total_withdrawn')
                .in('id', walletIds)
            : Promise.resolve({ data: [] }),
        transactionIds.length
            ? supabaseAdmin
                .from('payout_attempts')
                .select('id, wallet_transaction_id, provider, method, amount_cop, status, provider_reference, provider_transfer_id, receipt_url, destination_snapshot, failure_reason, failure_message, attempts_count, next_retry_at, paid_at, failed_at, created_at, updated_at')
                .in('wallet_transaction_id', transactionIds)
            : Promise.resolve({ data: [] }),
        offerIds.length
            ? supabaseAdmin
                .from('cargo_offers')
                .select('id, business_id, origin_city, origin_department, destination_city, destination_department, cargo_description, status')
                .in('id', offerIds)
            : Promise.resolve({ data: [] }),
        offerIds.length
            ? supabaseAdmin
                .from('payments')
                .select('id, offer_id, status, subtotal, platform_fee, total_amount')
                .in('offer_id', offerIds)
            : Promise.resolve({ data: [] }),
    ]);

    const walletMap = new Map((wallets || []).map((wallet: JsonRecord) => [wallet.id, wallet]));
    const userIds = [...new Set((wallets || []).map((wallet: JsonRecord) => stringValue(wallet.user_id)).filter(Boolean))] as string[];
    const { data: profiles } = userIds.length
        ? await supabaseAdmin
            .from('user_profiles')
            .select('id, full_name, email, phone')
            .in('id', userIds)
        : { data: [] };

    const profileMap = new Map((profiles || []).map((profile: JsonRecord) => [profile.id, profile]));
    const payoutByTransactionId = new Map(
        (payoutAttempts || [])
            .sort((a: JsonRecord, b: JsonRecord) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime())
            .map((attempt: JsonRecord) => [attempt.wallet_transaction_id, attempt])
    );
    const offerMap = new Map((offers || []).map((offer: JsonRecord) => [offer.id, offer]));
    const paymentMap = new Map((payments || []).map((payment: JsonRecord) => [payment.offer_id, payment]));

    return transactions
        .map((transaction) => {
            const wallet = walletMap.get(transaction.wallet_id);
            const trucker = wallet ? profileMap.get(wallet.user_id) : null;
            const offer = offerMap.get(transaction.offer_id);
            return normalizeDriverPayout(transaction, {
                payoutAttempt: payoutByTransactionId.get(transaction.id) || null,
                wallet,
                trucker,
                offer,
                payment: paymentMap.get(transaction.offer_id) || null,
            });
        })
        .filter((payout) => !filters.status || payout.status === filters.status)
        .filter((payout) => !filters.driverId || payout.driver?.id === filters.driverId)
        .filter((payout) => !filters.businessId || payout.route?.business_id === filters.businessId);
}
