import type { PayoutProvider } from './types';
import { manualPayoutProvider } from './providers/manual';
import { isStrictProductionEnvironment } from '@/lib/server/runtime-env';

export function getPayoutProvider(): PayoutProvider {
  const provider = (process.env.PAYOUT_PROVIDER || 'manual').trim().toLowerCase();

  if (process.env.PAYOUTS_ENABLED !== 'true') {
    return manualPayoutProvider;
  }

  if (process.env.PAYOUT_DRY_RUN === 'true') {
    return manualPayoutProvider;
  }

  // TODO: wire real providers after legal/API contract validation.
  // if (provider === 'cobre') return cobrePayoutProvider;
  // if (provider === 'wompi') return wompiPayoutProvider;

  if (provider !== 'manual') {
    throw new Error(`Payout provider ${provider} is not implemented. Falling back is intentionally blocked.`);
  }

  return manualPayoutProvider;
}

export function assertRealPayoutAllowed() {
  if (process.env.PAYOUTS_ENABLED !== 'true') {
    throw new Error('Payouts are disabled.');
  }

  if (process.env.PAYOUT_DRY_RUN !== 'false') {
    throw new Error('PAYOUT_DRY_RUN must be false for real payouts.');
  }

  if (!isStrictProductionEnvironment()) {
    throw new Error('Real payouts are allowed only in strict production.');
  }

  const maxSingle = Number(process.env.PAYOUT_MAX_SINGLE_COP || 0);
  const dailyLimit = Number(process.env.PAYOUT_DAILY_LIMIT_COP || 0);

  if (!Number.isFinite(maxSingle) || maxSingle <= 0) {
    throw new Error('PAYOUT_MAX_SINGLE_COP must be configured before real payouts.');
  }

  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
    throw new Error('PAYOUT_DAILY_LIMIT_COP must be configured before real payouts.');
  }
}
