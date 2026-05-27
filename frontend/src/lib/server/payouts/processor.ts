import { createAdminNotification } from '@/lib/server/route-auth';
import { getPayoutProvider, getPayoutRuntimeConfig } from './provider';
import type {
    CreatePayoutResult,
    PayoutAttemptRecord,
    PayoutDestination,
    SupabaseAdminClient,
} from './types';

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeDigits(value: unknown) {
    return readString(value).replace(/\D/g, '');
}

function resolveDestination(attempt: PayoutAttemptRecord): PayoutDestination {
    const snapshot = asRecord(attempt.destination_snapshot);
    const method = readString(snapshot.method) || attempt.method;
    const accountNumber = normalizeDigits(snapshot.account_number);
    const documentNumber = normalizeDigits(snapshot.document_number);
    const accountHolderName = readString(snapshot.account_holder_name);

    if (!accountNumber || !documentNumber || !accountHolderName) {
        throw new Error('Destino de payout incompleto');
    }

    return {
        method: method === 'nequi'
            ? 'nequi'
            : method === 'bancolombia_checking'
                ? 'bancolombia_checking'
                : method === 'bancolombia_savings'
                    ? 'bancolombia_savings'
                    : 'other_bank',
        bankName: readString(snapshot.bank_name) || null,
        accountNumber,
        accountHolderName,
        documentType: readString(snapshot.document_type) || 'CC',
        documentNumber,
        paymentMethodId: readString(snapshot.payment_method_id) || null,
    };
}

function getBogotaDayBounds(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((part) => part.type === 'year')?.value || now.getUTCFullYear().toString();
    const month = parts.find((part) => part.type === 'month')?.value || '01';
    const day = parts.find((part) => part.type === 'day')?.value || '01';
    const localDay = `${year}-${month}-${day}`;

    return {
        start: new Date(`${localDay}T00:00:00-05:00`).toISOString(),
        end: new Date(`${localDay}T23:59:59.999-05:00`).toISOString(),
    };
}

async function getDailyPayoutLoadCop(supabaseAdmin: SupabaseAdminClient, currentAttemptId: string) {
    const { start, end } = getBogotaDayBounds();
    const { data, error } = await supabaseAdmin
        .from('payout_attempts')
        .select('id, amount_cop')
        .gte('created_at', start)
        .lt('created_at', end)
        .in('status', ['processing', 'paid'])
        .neq('id', currentAttemptId);

    if (error) {
        throw new Error(error.message || 'No se pudo validar limite diario de payouts');
    }

    return (data || []).reduce((sum, row: { amount_cop?: number | string | null }) => sum + Number(row.amount_cop || 0), 0);
}

async function markManualReview(
    supabaseAdmin: SupabaseAdminClient,
    attempt: PayoutAttemptRecord,
    result: CreatePayoutResult
) {
    await supabaseAdmin
        .from('payout_attempts')
        .update({
            status: 'manual_review',
            provider_response: asRecord(result.rawResponse),
            failure_reason: result.errorMessage || 'Payout requiere revision manual.',
            failure_message: result.errorMessage || 'Payout requiere revision manual.',
            updated_at: new Date().toISOString(),
        })
        .eq('id', attempt.id);

    await supabaseAdmin
        .from('transactions')
        .update({
            locked_for_payout: true,
            payout_attempt_id: attempt.id,
        })
        .eq('id', attempt.wallet_transaction_id);
}

async function markProcessing(
    supabaseAdmin: SupabaseAdminClient,
    attempt: PayoutAttemptRecord,
    result: CreatePayoutResult
) {
    await supabaseAdmin
        .from('payout_attempts')
        .update({
            status: 'processing',
            provider_transfer_id: result.providerTransferId || attempt.provider_transfer_id || null,
            provider_reference: result.providerTransferId || attempt.provider_reference || null,
            receipt_url: result.receiptUrl || attempt.receipt_url || null,
            provider_response: asRecord(result.rawResponse),
            updated_at: new Date().toISOString(),
        })
        .eq('id', attempt.id);
}

export async function processPayoutAttempt(
    supabaseAdmin: SupabaseAdminClient,
    attempt: PayoutAttemptRecord
) {
    const config = getPayoutRuntimeConfig();
    const amountCop = Number(attempt.amount_cop || 0);

    if (!Number.isFinite(amountCop) || amountCop < config.minAmountCop) {
        await supabaseAdmin.rpc('mark_payout_failed', {
            p_payout_attempt_id: attempt.id,
            p_failure_reason: `Monto menor al minimo permitido (${config.minAmountCop})`,
            p_provider_response: { reason: 'below_minimum', amountCop, minAmountCop: config.minAmountCop },
        });
        return { attemptId: attempt.id, status: 'failed', reason: 'below_minimum' };
    }

    if (amountCop > config.maxSingleCop) {
        await markManualReview(supabaseAdmin, attempt, {
            status: 'manual_review',
            errorMessage: `Monto supera limite automatico (${config.maxSingleCop})`,
            rawResponse: { reason: 'above_single_limit', amountCop, maxSingleCop: config.maxSingleCop },
        });
        return { attemptId: attempt.id, status: 'manual_review', reason: 'above_single_limit' };
    }

    let destination: PayoutDestination;
    try {
        destination = resolveDestination(attempt);
    } catch (error) {
        await markManualReview(supabaseAdmin, attempt, {
            status: 'manual_review',
            errorMessage: error instanceof Error ? error.message : 'Destino incompleto',
            rawResponse: { reason: 'invalid_destination' },
        });
        return { attemptId: attempt.id, status: 'manual_review', reason: 'invalid_destination' };
    }

    const dailyPayoutLoadCop = await getDailyPayoutLoadCop(supabaseAdmin, attempt.id);
    if (dailyPayoutLoadCop + amountCop > config.dailyLimitCop) {
        await markManualReview(supabaseAdmin, attempt, {
            status: 'manual_review',
            errorMessage: `Payout supera limite diario (${config.dailyLimitCop})`,
            rawResponse: {
                reason: 'above_daily_limit',
                amountCop,
                dailyPayoutLoadCop,
                dailyLimitCop: config.dailyLimitCop,
            },
        });
        return { attemptId: attempt.id, status: 'manual_review', reason: 'above_daily_limit' };
    }

    const provider = getPayoutProvider(config);
    const result = await provider.createPayout({
        idempotencyKey: attempt.idempotency_key,
        amountCop,
        destination,
        metadata: {
            payoutAttemptId: attempt.id,
            walletTransactionId: attempt.wallet_transaction_id,
            sourceKind: attempt.source_kind || 'wallet_withdrawal',
            offerId: attempt.offer_id || null,
            paymentId: attempt.payment_id || null,
            truckerId: attempt.trucker_id || attempt.user_id,
        },
    });

    if (result.status === 'paid') {
        await supabaseAdmin.rpc('mark_payout_paid', {
            p_payout_attempt_id: attempt.id,
            p_provider_transfer_id: result.providerTransferId || null,
            p_receipt_url: result.receiptUrl || null,
            p_provider_response: asRecord(result.rawResponse),
        });
    } else if (result.status === 'processing') {
        await markProcessing(supabaseAdmin, attempt, result);
    } else if (result.status === 'manual_review') {
        await markManualReview(supabaseAdmin, attempt, result);
    } else {
        await supabaseAdmin.rpc('mark_payout_failed', {
            p_payout_attempt_id: attempt.id,
            p_failure_reason: result.errorMessage || 'Provider payout failed',
            p_provider_response: asRecord(result.rawResponse),
        });
    }

    if (result.status === 'failed' || result.status === 'manual_review') {
        await createAdminNotification(supabaseAdmin, {
            type: 'payout_attention_required',
            title: 'Payout requiere revision',
            message: `Payout ${attempt.id.slice(0, 8)} quedo en ${result.status}.`,
            data: {
                payout_attempt_id: attempt.id,
                status: result.status,
                amount_cop: amountCop,
                provider: provider.code,
                error: result.errorMessage || null,
            },
        });
    }

    return {
        attemptId: attempt.id,
        status: result.status,
        provider: provider.code,
        providerTransferId: result.providerTransferId || null,
    };
}

export async function claimAndProcessPayouts(supabaseAdmin: SupabaseAdminClient, limit: number) {
    const { data, error } = await supabaseAdmin.rpc('claim_payout_attempts', {
        p_limit: limit,
    });

    if (error) {
        throw new Error(error.message || 'No se pudo reclamar cola de payouts');
    }

    const attempts = (data || []) as PayoutAttemptRecord[];
    const results: Array<Awaited<ReturnType<typeof processPayoutAttempt>>> = [];

    for (const attempt of attempts) {
        results.push(await processPayoutAttempt(supabaseAdmin, attempt));
    }

    return {
        claimed: attempts.length,
        results,
    };
}
