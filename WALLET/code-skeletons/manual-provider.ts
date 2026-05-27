import type { CreatePayoutInput, CreatePayoutResult, PayoutProvider } from './payout-types';

export const manualPayoutProvider: PayoutProvider = {
  code: 'manual',
  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    return {
      status: 'failed',
      providerTransferId: null,
      receiptUrl: null,
      errorMessage: `Manual review required for ${input.idempotencyKey}`,
      rawResponse: {
        manual: true,
        amountCop: input.amountCop,
        idempotencyKey: input.idempotencyKey,
      },
    };
  },
};
