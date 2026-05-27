import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

export type PayoutProviderCode = 'manual' | 'cobre' | 'wompi' | 'bank_partner';

export type PayoutAttemptStatus =
    | 'requested'
    | 'queued'
    | 'processing'
    | 'paid'
    | 'failed'
    | 'manual_review'
    | 'cancelled'
    | 'reversed';

export type PayoutMethodCode = 'nequi' | 'bancolombia_savings' | 'bancolombia_checking' | 'other_bank';

export interface PayoutDestination {
    method: PayoutMethodCode;
    bankName?: string | null;
    accountNumber: string;
    accountHolderName: string;
    documentType: string;
    documentNumber: string;
    paymentMethodId?: string | null;
}

export interface CreatePayoutInput {
    idempotencyKey: string;
    amountCop: number;
    destination: PayoutDestination;
    metadata: Record<string, string | number | boolean | null | undefined>;
}

export interface CreatePayoutResult {
    status: 'processing' | 'paid' | 'failed' | 'manual_review';
    providerTransferId?: string | null;
    receiptUrl?: string | null;
    rawResponse?: unknown;
    errorMessage?: string | null;
}

export interface PayoutProvider {
    code: PayoutProviderCode;
    createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult>;
}

export interface PayoutAttemptRecord {
    id: string;
    wallet_transaction_id: string;
    user_id: string;
    provider: PayoutProviderCode | string;
    method: PayoutMethodCode;
    amount_cop: number | string;
    status: PayoutAttemptStatus | string;
    idempotency_key: string;
    provider_reference?: string | null;
    provider_payload?: Record<string, unknown> | null;
    provider_response?: Record<string, unknown> | null;
    source_kind?: string | null;
    offer_id?: string | null;
    payment_id?: string | null;
    trucker_id?: string | null;
    provider_transfer_id?: string | null;
    receipt_url?: string | null;
    destination_snapshot?: Record<string, unknown> | null;
    attempts_count?: number | null;
}
