import type { CreatePayoutInput, CreatePayoutResult, PayoutProvider } from '../types';

export const manualPayoutProvider: PayoutProvider = {
    code: 'manual',
    async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
        return {
            status: 'manual_review',
            providerTransferId: null,
            receiptUrl: null,
            rawResponse: {
                provider: 'manual',
                idempotencyKey: input.idempotencyKey,
                amountCop: input.amountCop,
                destinationLast4: input.destination.accountNumber.slice(-4),
            },
            errorMessage: 'Payout real no habilitado para este ambiente o proveedor.',
        };
    },
};
