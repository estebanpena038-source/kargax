import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPaymentIdempotencyKey } from '@/lib/contracts/payments';
import { recordCriticalOperation } from '@/lib/server/operations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

interface ReleaseMarketplaceFreightInput {
  supabaseAdmin: SupabaseAdminClient;
  offerId: string;
  actor: 'route_completion' | 'admin_replay' | 'system_reconcile';
  requestId: string;
}

interface ReleaseMarketplaceFreightResult {
  released: boolean;
  duplicate: boolean;
  reason?: string;
  transactionId?: string | null;
  payoutAttemptId?: string | null;
  walletId?: string | null;
  amountCop?: number;
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

async function getOrCreateWallet(supabaseAdmin: SupabaseAdminClient, userId: string) {
  const { data: wallet, error } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (wallet) return wallet as Record<string, any>;

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
    throw new Error(createError?.message || 'Could not create wallet');
  }

  return newWallet as Record<string, any>;
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

  if (!isCompletedOfferStatus(offer.status)) {
    return { released: false, duplicate: false, reason: 'route_not_completed' };
  }

  const truckerId = offer.assigned_trucker_id || offer.trucker_id;
  if (!truckerId) {
    return { released: false, duplicate: false, reason: 'missing_trucker' };
  }

  // Optional dispute guard. Keep tolerant because schema may not have disputes yet.
  if (offer.dispute_status && ['open', 'active', 'pending'].includes(String(offer.dispute_status).toLowerCase())) {
    return { released: false, duplicate: false, reason: 'active_dispute' };
  }

  const { data: existingRelease } = await supabaseAdmin
    .from('transactions')
    .select('id, wallet_id, amount')
    .eq('offer_id', offerId)
    .eq('money_rail', 'marketplace_freelancer')
    .in('type', ['marketplace_freight_release', 'trip_deposit', 'trip_settlement'])
    .maybeSingle();

  if (existingRelease?.id) {
    return {
      released: true,
      duplicate: true,
      transactionId: existingRelease.id,
      walletId: existingRelease.wallet_id,
      amountCop: Number(existingRelease.amount || 0),
    };
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('offer_id', offerId)
    .in('status', ['completed', 'paid', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError || !payment) {
    return { released: false, duplicate: false, reason: paymentError?.message || 'payment_not_completed' };
  }

  const grossAmount = firstPositiveNumber(
    payment.freight_amount,
    payment.amount_cop,
    payment.amount,
    offer.accepted_price,
    offer.price,
    offer.freight_value,
    offer.amount
  );

  if (grossAmount <= 0) {
    return { released: false, duplicate: false, reason: 'missing_release_amount' };
  }

  const platformFee = firstPositiveNumber(payment.platform_fee, payment.platform_fee_cop, 0);
  const netAmount = Math.max(0, grossAmount - platformFee);

  if (netAmount <= 0) {
    return { released: false, duplicate: false, reason: 'invalid_net_amount' };
  }

  const wallet = await getOrCreateWallet(supabaseAdmin, truckerId);
  const availableBefore = Number(wallet.available_balance || 0);
  const pendingBefore = Number(wallet.pending_balance || 0);
  const availableAfter = availableBefore + netAmount;
  const idempotencyKey = buildPaymentIdempotencyKey(['marketplace_release', offerId, payment.id, truckerId]);

  const { error: walletUpdateError } = await supabaseAdmin
    .from('wallets')
    .update({
      available_balance: availableAfter,
      total_earned: Number(wallet.total_earned || 0) + netAmount,
      total_trips_completed: Number(wallet.total_trips_completed || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  if (walletUpdateError) {
    throw new Error(walletUpdateError.message);
  }

  const { data: transaction, error: transactionError } = await supabaseAdmin
    .from('transactions')
    .insert({
      wallet_id: wallet.id,
      offer_id: offerId,
      type: 'marketplace_freight_release',
      status: 'completed',
      amount: netAmount,
      balance_before: availableBefore,
      balance_after: availableAfter,
      pending_balance_before: pendingBefore,
      pending_balance_after: pendingBefore,
      description: 'Liberación marketplace por ruta completada',
      reference_id: payment.id,
      money_rail: 'marketplace_freelancer',
      source_system: 'route_completion',
      payout_eligible: true,
      external_proof_only: false,
      metadata: {
        source_kind: 'marketplace_freight_release',
        source_reference: offerId,
        offer_id: offerId,
        payment_id: payment.id,
        trucker_id: truckerId,
        gross_amount_cop: grossAmount,
        platform_fee_cop: platformFee,
        net_amount_cop: netAmount,
        idempotency_key: idempotencyKey,
        actor,
      },
    })
    .select('id')
    .single();

  if (transactionError || !transaction) {
    throw new Error(transactionError?.message || 'Could not create marketplace release transaction');
  }

  const { data: defaultPaymentMethod } = await supabaseAdmin
    .from('payment_methods')
    .select('*')
    .eq('user_id', truckerId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let payoutAttemptId: string | null = null;

  if (defaultPaymentMethod && process.env.PAYOUTS_ENABLED === 'true') {
    const payoutIdempotencyKey = buildPaymentIdempotencyKey(['marketplace_payout', transaction.id, offerId, truckerId]);

    const { data: payoutAttempt, error: payoutError } = await supabaseAdmin
      .from('payout_attempts')
      .upsert({
        wallet_transaction_id: transaction.id,
        source_kind: 'marketplace_freight_release',
        source_id: transaction.id,
        offer_id: offerId,
        payment_id: payment.id,
        trucker_id: truckerId,
        user_id: truckerId,
        provider: process.env.PAYOUT_PROVIDER || 'manual',
        method: defaultPaymentMethod.method_type,
        amount_cop: netAmount,
        status: process.env.PAYOUT_DRY_RUN === 'false' ? 'queued' : 'manual_review',
        idempotency_key: payoutIdempotencyKey,
        destination_snapshot: {
          method: defaultPaymentMethod.method_type,
          bank_name: defaultPaymentMethod.bank_name || null,
          account_number: defaultPaymentMethod.account_number,
          account_holder_name: defaultPaymentMethod.account_holder_name,
          document_type: defaultPaymentMethod.document_type || 'CC',
          document_number: defaultPaymentMethod.document_number,
        },
        provider_payload: {
          account_number_last4: String(defaultPaymentMethod.account_number || '').slice(-4),
          document_number_last4: String(defaultPaymentMethod.document_number || '').slice(-4),
          dry_run: process.env.PAYOUT_DRY_RUN !== 'false',
        },
      }, { onConflict: 'idempotency_key' })
      .select('id')
      .single();

    if (payoutError) {
      await recordCriticalOperation(supabaseAdmin, {
        requestId,
        actorUserId: truckerId,
        actorType: 'system',
        domain: 'wallet',
        action: 'create_marketplace_payout_attempt',
        entityType: 'payout_attempt',
        entityId: transaction.id,
        status: 'error',
        errorClass: 'PAYOUT_ATTEMPT_CREATE_FAILED',
        sourceReference: offerId,
        replayable: true,
        metadata: { error: payoutError.message, offerId, transactionId: transaction.id },
      });
    } else {
      payoutAttemptId = payoutAttempt?.id || null;
    }
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
    sourceReference: offerId,
    replayable: false,
    metadata: {
      offerId,
      paymentId: payment.id,
      transactionId: transaction.id,
      payoutAttemptId,
      netAmount,
      actor,
    },
  });

  return {
    released: true,
    duplicate: false,
    transactionId: transaction.id,
    payoutAttemptId,
    walletId: wallet.id,
    amountCop: netAmount,
  };
}
