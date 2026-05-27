import type { PayoutProvider } from './payout-types';
import { manualPayoutProvider } from './manual-provider';

export function getPayoutProvider(): PayoutProvider {
  const provider = (process.env.PAYOUT_PROVIDER || 'manual').trim().toLowerCase();

  if (!process.env.PAYOUTS_ENABLED || process.env.PAYOUTS_ENABLED !== 'true') {
    return manualPayoutProvider;
  }

  // TODO: import real providers once implemented.
  // if (provider === 'cobre') return cobrePayoutProvider;
  // if (provider === 'wompi') return wompiPayoutProvider;

  return manualPayoutProvider;
}

export function assertRealPayoutAllowed() {
  if (process.env.PAYOUT_DRY_RUN === 'true') {
    throw new Error('Payout dry-run is enabled. Real payout is blocked.');
  }

  if (process.env.PAYOUTS_ENABLED !== 'true') {
    throw new Error('Payouts are disabled.');
  }

  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    throw new Error('Real payouts are allowed only in production Vercel environment.');
  }
}
