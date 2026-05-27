import type { SupabaseClient } from '@supabase/supabase-js';
import { getPayoutProvider } from './provider';
import type { PayoutDestination, PayoutProcessorOptions, PayoutProcessorResult } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

type PayoutAttemptRow = Record<string, any>;

function maskDigits(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `****${digits.slice(-4)}` : null;
}

function readDestination(attempt: PayoutAttemptRow): PayoutDestination | null {
  const snapshot = attempt.destination_snapshot && typeof attempt.destination_snapshot === 'object'
    ? attempt.destination_snapshot
    : attempt.provider_payload && typeof attempt.provider_payload === 'object'
      ? attempt.provider_payload
      : {};

  const method = String(attempt.method || snapshot.payment_method || snapshot.method || '').toLowerCase();
  const normalizedMethod = method.includes('nequi')
    ? 'nequi'
    : method.includes('checking') || method.includes('corriente')
      ? 'checking'
      : 'savings';

  const accountNumber = String(snapshot.account_number || snapshot.accountNumber || '');
  const accountHolderName = String(snapshot.account_holder_name || snapshot.accountHolderName || '');
  const documentNumber = String(snapshot.document_number || snapshot.documentNumber || '');

  if (!accountNumber || !accountHolderName || !documentNumber) {
    return null;
  }

  return {
    method: normalizedMethod as PayoutDestination['method'],
    bankName: snapshot.bank_name || snapshot.bankName || null,
    accountNumber,
    accountHolderName,
    documentType: String(snapshot.document_type || snapshot.documentType || 'CC'),
    documentNumber,
  };
}

function safeProviderPayload(destination: PayoutDestination | null) {
  if (!destination) return {};

  return {
    method: destination.method,
    bankName: destination.bankName || null,
    accountNumberLast4: maskDigits(destination.accountNumber),
    documentNumberLast4: maskDigits(destination.documentNumber),
  };
}

export async function processQueuedPayouts(
  supabaseAdmin: SupabaseAdminClient,
  options: PayoutProcessorOptions = {}
): Promise<PayoutProcessorResult> {
  const dryRun = options.dryRun ?? process.env.PAYOUT_DRY_RUN !== 'false';
  const limit = Math.max(1, Math.min(Number(options.limit || process.env.PAYOUT_BATCH_SIZE || 10), 50));
  const provider = getPayoutProvider();

  const result: PayoutProcessorResult = {
    processed: 0,
    paid: 0,
    failed: 0,
    manualReview: 0,
    dryRun,
    errors: [],
  };

  if (process.env.PAYOUTS_ENABLED !== 'true') {
    return result;
  }

  const { data: claimedAttempts, error: claimError } = await supabaseAdmin.rpc('claim_payout_attempts', {
    p_limit: limit,
  });

  if (claimError) {
    throw new Error(claimError.message || 'Could not claim payout attempts.');
  }

  for (const attempt of (claimedAttempts || []) as PayoutAttemptRow[]) {
    result.processed += 1;

    try {
      const amountCop = Number(attempt.amount_cop || 0);
      const maxSingle = Number(process.env.PAYOUT_MAX_SINGLE_COP || 0);

      if (amountCop <= 0) {
        throw new Error('Invalid payout amount.');
      }

      if (!dryRun && maxSingle > 0 && amountCop > maxSingle) {
        await supabaseAdmin.rpc('mark_payout_manual_review', {
          p_payout_attempt_id: attempt.id,
          p_reason: `Amount exceeds max single payout: ${maxSingle}`,
        });
        result.manualReview += 1;
        continue;
      }

      const destination = readDestination(attempt);
      if (!destination) {
        await supabaseAdmin.rpc('mark_payout_manual_review', {
          p_payout_attempt_id: attempt.id,
          p_reason: 'Missing payout destination data',
        });
        result.manualReview += 1;
        continue;
      }

      const providerResult = dryRun
        ? {
            status: 'manual_review' as const,
            providerTransferId: null,
            receiptUrl: null,
            errorMessage: 'Dry-run payout blocked from real provider.',
            rawResponse: { dryRun: true, destination: safeProviderPayload(destination) },
          }
        : await provider.createPayout({
            payoutAttemptId: attempt.id,
            idempotencyKey: String(attempt.idempotency_key || attempt.id),
            amountCop,
            destination,
            metadata: {
              offer_id: attempt.offer_id || null,
              payment_id: attempt.payment_id || null,
              trucker_id: attempt.trucker_id || attempt.user_id || null,
              source_kind: attempt.source_kind || 'wallet_withdrawal',
            },
          });

      if (providerResult.status === 'paid') {
        await supabaseAdmin.rpc('mark_payout_paid', {
          p_payout_attempt_id: attempt.id,
          p_provider_transfer_id: providerResult.providerTransferId || null,
          p_receipt_url: providerResult.receiptUrl || null,
          p_provider_response: providerResult.rawResponse || {},
        });
        result.paid += 1;
        continue;
      }

      if (providerResult.status === 'processing') {
        await supabaseAdmin
          .from('payout_attempts')
          .update({
            status: 'processing',
            provider_transfer_id: providerResult.providerTransferId || attempt.provider_transfer_id || null,
            provider_response: providerResult.rawResponse || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', attempt.id);
        continue;
      }

      if (providerResult.status === 'manual_review') {
        await supabaseAdmin.rpc('mark_payout_manual_review', {
          p_payout_attempt_id: attempt.id,
          p_reason: providerResult.errorMessage || 'Provider requested manual review',
        });
        result.manualReview += 1;
        continue;
      }

      await supabaseAdmin.rpc('mark_payout_failed', {
        p_payout_attempt_id: attempt.id,
        p_failure_reason: providerResult.errorMessage || 'Provider payout failed',
        p_provider_response: providerResult.rawResponse || {},
      });
      result.failed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown payout processor error';
      await supabaseAdmin.rpc('mark_payout_failed', {
        p_payout_attempt_id: attempt.id,
        p_failure_reason: message,
        p_provider_response: { processorError: true },
      });
      result.failed += 1;
      result.errors.push({ payoutAttemptId: String(attempt.id), message });
    }
  }

  return result;
}
