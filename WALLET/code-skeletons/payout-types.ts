export type PayoutProviderCode = 'manual' | 'cobre' | 'wompi' | 'bank_partner';

export type PayoutAttemptStatus =
  | 'queued'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'manual_review'
  | 'cancelled'
  | 'reversed';

export type PayoutDestinationMethod = 'nequi' | 'savings' | 'checking';

export interface PayoutDestination {
  method: PayoutDestinationMethod;
  bankName?: string | null;
  accountNumber: string;
  accountHolderName: string;
  documentType: string;
  documentNumber: string;
}

export interface CreatePayoutInput {
  idempotencyKey: string;
  amountCop: number;
  destination: PayoutDestination;
  metadata: Record<string, string | number | boolean | null | undefined>;
}

export interface CreatePayoutResult {
  status: 'processing' | 'paid' | 'failed';
  providerTransferId?: string | null;
  receiptUrl?: string | null;
  rawResponse?: unknown;
  errorMessage?: string | null;
}

export interface PayoutProvider {
  code: PayoutProviderCode;
  createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult>;
}
