import type { CreatePayoutInput, CreatePayoutResult, PayoutProvider } from '../types';

export const manualPayoutProvider: PayoutProvider = {
  code: 'manual',
  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    return {
      status: 'manual_review',
      providerTransferId: null,
      receiptUrl: null,
      errorMessage: `Manual review required for ${input.idempotencyKey}`,
      rawResponse: {
        manual: true,
        payoutAttemptId: input.payoutAttemptId,
        amountCop: input.amountCop,
        idempotencyKey: input.idempotencyKey,
      },
    };
  },
};
