import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPaymentIdempotencyKey } from '@/lib/contracts/payments';
import { getFeatureFlags, isFeatureFlagEnabled } from '@/lib/server/feature-flags';
import { recordCriticalOperation } from '@/lib/server/operations';
import { getPayoutRuntimeConfig } from '@/lib/server/payouts/provider';
import { MARKETPLACE_MONEY_RAIL } from './rails';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

type ReleaseActor = 'route_completion' | 'admin_replay' | 'system_reconcile';

interface ReleaseMarketplaceFreightInput {
    supabaseAdmin: SupabaseAdminClient;
    offerId: string;
    actor: ReleaseActor;
    requestId: string;
}

export interface ReleaseMarketplaceFreightResult {
    released: boolean;
    duplicate: boolean;
    reason?: string;
    transactionId?: string | null;
    payoutAttemptId?: string | null;
    walletId?: string | null;
    amountCop?: number;
    repaymentAppliedCop?: number;
}

function firstPositiveNumber(...values: unknown[]) {
    for (const value of values) {
        const numberValue = Number(value || 0);
        if (Number.isFinite(numberValue) && numberValue > 0) {
            return Math.round(numberValue);
        }
    }

    return 0;
}

function isCompletedOfferStatus(status: unknown) {
    return ['completed', 'delivered', 'finished', 'closed'].includes(String(status || '').toLowerCase());
}

function isActiveDispute(value: unknown) {
    return ['open', 'active', 'pending', 'in_review'].includes(String(value || '').toLowerCase());
}

function normalizeDigits(value: unknown) {
    return String(value || '').replace(/\D/g, '');
}

function resolveCanonicalPayoutMethod(methodType: unknown, bankName: unknown) {
    const method = String(methodType || '').toLowerCase();
    const bank = String(bankName || '').toLowerCase();

    if (method === 'nequi') return 'nequi';
    if (method === 'checking' && bank.includes('bancolombia')) return 'bancolombia_checking';
    if (method === 'savings' && bank.includes('bancolombia')) return 'bancolombia_savings';
    return 'other_bank';
}

async function getOrCreateWallet(supabaseAdmin: SupabaseAdminClient, userId: string) {
    const { data: wallet, error } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'No se pudo cargar la billetera');
    }

    if (wallet) {
        return wallet as Record<string, any>;
    }

    const { data: newWallet, error: createError } = await supabaseAdmin
        .from('wallets')
        .insert({
            user_id: userId,
            pending_balance: 0,
            available_balance: 0,
            total_earned: 0,
            total_withdrawn: 0,
            total_trips_completed: 0,
        })
        .select('*')
        .single();

    if (createError || !newWallet) {
        throw new Error(createError?.message || 'No se pudo crear la billetera');
    }

    return newWallet as Record<string, any>;
}

async function getCompletedMarketplacePayment(supabaseAdmin: SupabaseAdminClient, offerId: string) {
    const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('offer_id', offerId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'No se pudo cargar el pago marketplace');
    }

    return payment as Record<string, any> | null;
}

async function getExistingMarketplaceRelease(supabaseAdmin: SupabaseAdminClient, offerId: string) {
    const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('id, wallet_id, amount, payout_attempt_id, money_rail, metadata')
        .eq('offer_id', offerId)
        .eq('type', 'trip_deposit')
        .limit(10);

    if (error) {
        throw new Error(error.message || 'No se pudo validar liberacion existente');
    }

    return ((data || []) as Array<Record<string, any>>).find((transaction) => {
        const metadata = transaction.metadata && typeof transaction.metadata === 'object'
            ? transaction.metadata as Record<string, unknown>
            : {};
        const sourceKind = String(metadata.source_kind || '');

        return transaction.money_rail === MARKETPLACE_MONEY_RAIL
            || sourceKind === 'marketplace_freight_release'
            || sourceKind === 'trip_settlement';
    }) || null;
}

async function applyMarketplaceAdvanceRepayments(
    supabaseAdmin: SupabaseAdminClient,
    walletId: string,
    offerId: string,
    amountCop: number
) {
    const { data, error } = await supabaseAdmin.rpc('apply_advance_repayments', {
        p_wallet_id: walletId,
        p_offer_id: offerId,
        p_max_amount: amountCop,
        p_source: 'trip_settlement',
    });

    if (error) {
        return {
            appliedCop: 0,
            error: error.message || 'No se pudo aplicar descuentos de adelantos',
        };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
        appliedCop: Number(result?.total_applied || 0),
        error: null as string | null,
    };
}

async function createAutomaticPayoutIfEligible(
    supabaseAdmin: SupabaseAdminClient,
    payload: {
        offer: Record<string, any>;
        payment: Record<string, any>;
        wallet: Record<string, any>;
        releaseTransactionId: string;
        truckerId: string;
        maxAmountCop: number;
        requestId: string;
    }
) {
    const flags = await getFeatureFlags(supabaseAdmin);
    const automaticPayoutsEnabled = isFeatureFlagEnabled(
        flags,
        'automatic_payouts_enabled',
        payload.offer.country_code || 'CO'
    );

    if (!automaticPayoutsEnabled || payload.maxAmountCop < 50000) {
        return null;
    }

    const { data: defaultPaymentMethod } = await supabaseAdmin
        .from('payment_methods')
        .select('*')
        .eq('user_id', payload.truckerId)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!defaultPaymentMethod) {
        return null;
    }

    const refreshedWallet = await getOrCreateWallet(supabaseAdmin, payload.truckerId);
    const availableBefore = Number(refreshedWallet.available_balance || 0);
    const payoutAmountCop = Math.min(payload.maxAmountCop, availableBefore);

    if (payoutAmountCop < 50000) {
        return null;
    }

    const canonicalMethod = resolveCanonicalPayoutMethod(
        defaultPaymentMethod.method_type,
        defaultPaymentMethod.bank_name
    );
    const runtimeConfig = getPayoutRuntimeConfig();
    const provider = runtimeConfig.provider === 'manual' ? 'manual' : runtimeConfig.provider;
    const payoutStatus = runtimeConfig.enabled ? 'queued' : 'manual_review';
    const availableAfter = Math.max(availableBefore - payoutAmountCop, 0);
    const payoutIdempotencyKey = buildPaymentIdempotencyKey([
        'marketplace_payout',
        payload.releaseTransactionId,
        payload.offer.id,
        payload.truckerId,
        payoutAmountCop,
    ]);

    const { error: walletUpdateError } = await supabaseAdmin
        .from('wallets')
        .update({
            available_balance: availableAfter,
            updated_at: new Date().toISOString(),
        })
        .eq('id', refreshedWallet.id);

    if (walletUpdateError) {
        throw new Error(walletUpdateError.message || 'No se pudo reservar saldo para payout');
    }

    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
        .from('transactions')
        .insert({
            wallet_id: refreshedWallet.id,
            offer_id: payload.offer.id,
            type: 'withdrawal',
            status: 'pending',
            amount: payoutAmountCop * -1,
            balance_before: availableBefore,
            balance_after: availableAfter,
            pending_balance_before: Number(refreshedWallet.pending_balance || 0),
            pending_balance_after: Number(refreshedWallet.pending_balance || 0),
            description: `Payout marketplace por viaje #${String(payload.offer.id).slice(0, 8)}`,
            reference_id: payload.offer.id,
            money_rail: MARKETPLACE_MONEY_RAIL,
            source_system: provider,
            payout_eligible: false,
            locked_for_payout: true,
            external_proof_only: false,
            metadata: {
                source_kind: 'automatic_marketplace_payout',
                release_transaction_id: payload.releaseTransactionId,
                offer_id: payload.offer.id,
                payment_id: payload.payment.id,
                payout_method: canonicalMethod,
                payout_provider: provider,
                automatic_payouts_enabled: automaticPayoutsEnabled,
            },
        })
        .select('id, metadata')
        .single();

    if (withdrawalError || !withdrawal) {
        throw new Error(withdrawalError?.message || 'No se pudo crear transaccion de payout');
    }

    const { data: payoutAttempt, error: payoutError } = await supabaseAdmin
        .from('payout_attempts')
        .upsert({
            wallet_transaction_id: withdrawal.id,
            source_kind: 'automatic_marketplace_payout',
            source_id: withdrawal.id,
            offer_id: payload.offer.id,
            payment_id: payload.payment.id,
            trucker_id: payload.truckerId,
            user_id: payload.truckerId,
            provider,
            method: canonicalMethod,
            amount_cop: payoutAmountCop,
            status: payoutStatus,
            idempotency_key: payoutIdempotencyKey,
            destination_snapshot: {
                method: canonicalMethod,
                bank_name: defaultPaymentMethod.bank_name || null,
                account_number: normalizeDigits(defaultPaymentMethod.account_number),
                account_holder_name: defaultPaymentMethod.account_holder_name,
                document_type: defaultPaymentMethod.document_type || 'CC',
                document_number: normalizeDigits(defaultPaymentMethod.document_number),
                payment_method_id: defaultPaymentMethod.id,
            },
            provider_payload: {
                account_number_last4: normalizeDigits(defaultPaymentMethod.account_number).slice(-4),
                document_number_last4: normalizeDigits(defaultPaymentMethod.document_number).slice(-4),
                runtime_provider: runtimeConfig.provider,
                dry_run: runtimeConfig.dryRun,
                real_provider_allowed: runtimeConfig.realProviderAllowed,
            },
        }, { onConflict: 'idempotency_key' })
        .select('id, status')
        .single();

    if (payoutError || !payoutAttempt) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId: payload.requestId,
            actorUserId: payload.truckerId,
            actorType: 'system',
            domain: 'payouts',
            action: 'create_automatic_marketplace_payout',
            entityType: 'transactions',
            entityId: withdrawal.id,
            status: 'error',
            errorClass: 'PAYOUT_ATTEMPT_CREATE_FAILED',
            sourceReference: payload.offer.id,
            replayable: true,
            metadata: {
                error: payoutError?.message || 'missing_payout_attempt',
                offerId: payload.offer.id,
                releaseTransactionId: payload.releaseTransactionId,
            },
        });
        return null;
    }

    await supabaseAdmin
        .from('transactions')
        .update({
            payout_attempt_id: payoutAttempt.id,
            metadata: {
                ...((withdrawal.metadata && typeof withdrawal.metadata === 'object') ? withdrawal.metadata : {}),
                payout_attempt_id: payoutAttempt.id,
                payout_status: payoutAttempt.status,
            },
        })
        .eq('id', withdrawal.id);

    return payoutAttempt.id as string;
}

export async function releaseMarketplaceFreightForCompletedOffer({
    supabaseAdmin,
    offerId,
    actor,
    requestId,
}: ReleaseMarketplaceFreightInput): Promise<ReleaseMarketplaceFreightResult> {
    const { data: offer, error: offerError } = await supabaseAdmin
        .from('cargo_offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle();

    if (offerError || !offer) {
        return { released: false, duplicate: false, reason: offerError?.message || 'offer_not_found' };
    }

    if (offer.is_private_fleet === true) {
        return { released: false, duplicate: false, reason: 'private_fleet_external_ledger' };
    }

    if (!isCompletedOfferStatus(offer.status) || !offer.delivery_verified_at) {
        return { released: false, duplicate: false, reason: 'route_not_completed' };
    }

    if (isActiveDispute(offer.dispute_status || offer.claim_status || offer.incident_status)) {
        return { released: false, duplicate: false, reason: 'active_dispute' };
    }

    const truckerId = offer.assigned_trucker_id || offer.trucker_id;
    if (!truckerId) {
        return { released: false, duplicate: false, reason: 'missing_trucker' };
    }

    const existingRelease = await getExistingMarketplaceRelease(supabaseAdmin, offerId);
    if (existingRelease?.id) {
        return {
            released: true,
            duplicate: true,
            transactionId: existingRelease.id,
            payoutAttemptId: existingRelease.payout_attempt_id || null,
            walletId: existingRelease.wallet_id,
            amountCop: Number(existingRelease.amount || 0),
        };
    }

    const payment = await getCompletedMarketplacePayment(supabaseAdmin, offerId);
    if (!payment?.id) {
        return { released: false, duplicate: false, reason: 'payment_not_completed' };
    }

    const releaseAmountCop = firstPositiveNumber(
        payment.subtotal,
        offer.net_amount,
        offer.freight_payment_amount,
        offer.total_amount
    );

    if (releaseAmountCop <= 0) {
        return { released: false, duplicate: false, reason: 'missing_release_amount' };
    }

    const wallet = await getOrCreateWallet(supabaseAdmin, truckerId);
    const availableBefore = Number(wallet.available_balance || 0);
    const pendingBefore = Number(wallet.pending_balance || 0);
    const availableAfter = availableBefore + releaseAmountCop;
    const pendingAfter = Math.max(pendingBefore - releaseAmountCop, 0);
    const idempotencyKey = buildPaymentIdempotencyKey([
        'marketplace_release',
        offerId,
        payment.id,
        truckerId,
    ]);

    const { data: transaction, error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
            wallet_id: wallet.id,
            offer_id: offerId,
            type: 'trip_deposit',
            status: 'completed',
            amount: releaseAmountCop,
            balance_before: availableBefore,
            balance_after: availableAfter,
            pending_balance_before: pendingBefore,
            pending_balance_after: pendingAfter,
            description: `Pago marketplace liberado por viaje #${String(offerId).slice(0, 8)}`,
            reference_id: payment.id,
            money_rail: MARKETPLACE_MONEY_RAIL,
            source_system: 'route_completion',
            payout_eligible: true,
            locked_for_payout: false,
            external_proof_only: false,
            metadata: {
                source_kind: 'marketplace_freight_release',
                source_reference: offerId,
                offer_id: offerId,
                payment_id: payment.id,
                trucker_id: truckerId,
                release_amount_cop: releaseAmountCop,
                payment_subtotal_cop: Number(payment.subtotal || 0),
                platform_fee_cop: Number(payment.platform_fee || 0),
                total_paid_cop: Number(payment.total_amount || 0),
                idempotency_key: idempotencyKey,
                actor,
            },
        })
        .select('id')
        .single();

    if (transactionError || !transaction) {
        const duplicateRelease = await getExistingMarketplaceRelease(supabaseAdmin, offerId);
        if (duplicateRelease?.id) {
            return {
                released: true,
                duplicate: true,
                transactionId: duplicateRelease.id,
                payoutAttemptId: duplicateRelease.payout_attempt_id || null,
                walletId: duplicateRelease.wallet_id,
                amountCop: Number(duplicateRelease.amount || 0),
            };
        }

        throw new Error(transactionError?.message || 'No se pudo crear liberacion marketplace');
    }

    const { error: walletUpdateError } = await supabaseAdmin
        .from('wallets')
        .update({
            pending_balance: pendingAfter,
            available_balance: availableAfter,
            total_earned: Number(wallet.total_earned || 0) + releaseAmountCop,
            total_trips_completed: Number(wallet.total_trips_completed || 0) + 1,
            updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

    if (walletUpdateError) {
        throw new Error(walletUpdateError.message || 'No se pudo actualizar wallet marketplace');
    }

    const repayment = await applyMarketplaceAdvanceRepayments(
        supabaseAdmin,
        wallet.id,
        offerId,
        releaseAmountCop
    );

    if (repayment.error) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: truckerId,
            actorType: 'system',
            domain: 'lending',
            action: 'apply_marketplace_release_repayment',
            entityType: 'cargo_offer',
            entityId: offerId,
            status: 'warning',
            errorClass: 'ADVANCE_REPAYMENT_FAILED',
            sourceReference: transaction.id,
            replayable: true,
            metadata: {
                error: repayment.error,
                offerId,
                transactionId: transaction.id,
            },
        });
    }

    let payoutAttemptId: string | null = null;
    try {
        payoutAttemptId = await createAutomaticPayoutIfEligible(supabaseAdmin, {
            offer,
            payment,
            wallet,
            releaseTransactionId: transaction.id,
            truckerId,
            maxAmountCop: Math.max(releaseAmountCop - repayment.appliedCop, 0),
            requestId,
        });
    } catch (payoutError) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: truckerId,
            actorType: 'system',
            domain: 'payouts',
            action: 'reserve_automatic_marketplace_payout',
            entityType: 'cargo_offer',
            entityId: offerId,
            status: 'error',
            errorClass: 'AUTOMATIC_PAYOUT_RESERVATION_FAILED',
            sourceReference: transaction.id,
            replayable: true,
            metadata: {
                error: payoutError instanceof Error ? payoutError.message : 'Unknown payout error',
                offerId,
                transactionId: transaction.id,
            },
        });
    }

    await recordCriticalOperation(supabaseAdmin, {
        requestId,
        actorUserId: truckerId,
        actorType: 'system',
        domain: 'wallet',
        action: 'release_marketplace_freight',
        entityType: 'cargo_offer',
        entityId: offerId,
        status: 'success',
        sourceReference: transaction.id,
        replayable: false,
        metadata: {
            offerId,
            paymentId: payment.id,
            transactionId: transaction.id,
            payoutAttemptId,
            amountCop: releaseAmountCop,
            repaymentAppliedCop: repayment.appliedCop,
            actor,
        },
    });

    return {
        released: true,
        duplicate: false,
        transactionId: transaction.id,
        payoutAttemptId,
        walletId: wallet.id,
        amountCop: releaseAmountCop,
        repaymentAppliedCop: repayment.appliedCop,
    };
}
