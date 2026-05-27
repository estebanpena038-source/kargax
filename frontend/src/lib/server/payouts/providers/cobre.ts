import type { CreatePayoutInput, CreatePayoutResult, PayoutDestination, PayoutProvider } from '../types';

const DEFAULT_COBRE_BASE_URL = 'https://api.cobre.co/v1';

const BANK_CODE_BY_NAME: Record<string, string> = {
    bancolombia: '1007',
    'banco de bogota': '1001',
    davivienda: '1051',
    'bbva colombia': '1013',
    'banco de occidente': '1023',
    'banco popular': '1002',
    'banco caja social': '1032',
    'banco agrario': '1040',
    'banco av villas': '1052',
    'banco falabella': '1062',
    'scotiabank colpatria': '1019',
    'banco itau': '1006',
    'banco gnb sudameris': '1012',
    citibank: '1009',
    nequi: '1507',
    daviplata: '1551',
};

function requiredEnv(name: string) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} no configurado`);
    }
    return value;
}

function getCobreConfig() {
    return {
        baseUrl: (process.env.COBRE_API_BASE_URL || DEFAULT_COBRE_BASE_URL).replace(/\/+$/, ''),
        apiKey: requiredEnv('COBRE_API_KEY'),
        sourceAccountId: requiredEnv('COBRE_SOURCE_ACCOUNT_ID'),
    };
}

function normalizeDigits(value: string | undefined | null) {
    return (value || '').replace(/\D/g, '');
}

function normalizeDocumentType(value: string | undefined | null) {
    const normalized = (value || 'CC').trim().toLowerCase();
    if (normalized === 'ce') return 'ce';
    if (normalized === 'nit') return 'nit';
    if (normalized === 'pas' || normalized === 'passport') return 'pa';
    return 'cc';
}

function normalizeBankName(value: string | undefined | null) {
    return (value || '').trim().toLowerCase();
}

function resolveBankCode(destination: PayoutDestination) {
    if (destination.method === 'nequi') {
        return '1507';
    }

    const normalizedBank = normalizeBankName(destination.bankName);
    return BANK_CODE_BY_NAME[normalizedBank] || process.env.COBRE_DEFAULT_BANK_CODE || '';
}

function resolveCobreCounterpartyType(destination: PayoutDestination): 'cc' | 'ch' | 'dp' {
    if (destination.method === 'nequi') return 'dp';
    if (destination.method === 'bancolombia_checking') return 'cc';
    return 'ch';
}

function mapCobreStatus(state: unknown): CreatePayoutResult['status'] {
    const normalized = String(state || '').toLowerCase();
    if (normalized === 'completed') return 'paid';
    if (['failed', 'rejected', 'returned', 'canceled', 'cancelled'].includes(normalized)) return 'failed';
    return 'processing';
}

async function cobreRequest<T>(path: string, init: RequestInit): Promise<T> {
    const config = getCobreConfig();
    const response = await fetch(`${config.baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
    const rawText = await response.text();
    const payload = rawText ? JSON.parse(rawText) as T : {} as T;

    if (!response.ok) {
        const message = typeof payload === 'object' && payload && 'message' in payload
            ? String((payload as { message?: unknown }).message)
            : `Cobre request failed (${response.status})`;
        throw new Error(message);
    }

    return payload;
}

async function createCounterparty(input: CreatePayoutInput) {
    const destination = input.destination;
    const bankCode = resolveBankCode(destination);
    const accountNumber = normalizeDigits(destination.accountNumber);
    const documentNumber = normalizeDigits(destination.documentNumber);

    if (!bankCode) {
        throw new Error('Banco destino no soportado por el adapter Cobre');
    }

    if (!accountNumber || !documentNumber || !destination.accountHolderName.trim()) {
        throw new Error('Destino incompleto para payout Cobre');
    }

    const body = {
        geo: 'col',
        type: resolveCobreCounterpartyType(destination),
        alias: `KargaX payout ${input.idempotencyKey.slice(-12)}`,
        metadata: {
            account_number: accountNumber,
            beneficiary_institution: bankCode,
            counterparty_fullname: destination.accountHolderName.trim(),
            counterparty_id_number: documentNumber,
            counterparty_id_type: normalizeDocumentType(destination.documentType),
            counterparty_phone: destination.method === 'nequi' ? `+57${accountNumber}` : undefined,
        },
    };

    return cobreRequest<{ id: string; metadata?: Record<string, unknown> }>('/counterparties', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export const cobrePayoutProvider: PayoutProvider = {
    code: 'cobre',
    async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
        try {
            const config = getCobreConfig();
            const counterparty = await createCounterparty(input);
            const moneyMovement = await cobreRequest<{
                id?: string;
                external_id?: string;
                status?: { state?: string; code?: string; description?: string };
                metadata?: { cep_url?: string; tracking_key?: string; reference?: string };
            }>('/money_movements', {
                method: 'POST',
                headers: {
                    idempotency: input.idempotencyKey,
                },
                body: JSON.stringify({
                    amount: Math.round(input.amountCop),
                    source_id: config.sourceAccountId,
                    destination_id: counterparty.id,
                    metadata: {
                        description: 'KargaX payout operativo',
                        reference: input.idempotencyKey.slice(-24),
                        payout_attempt_id: input.metadata.payoutAttemptId,
                        wallet_transaction_id: input.metadata.walletTransactionId,
                        source_kind: input.metadata.sourceKind,
                    },
                    checker_approval: false,
                    external_id: input.idempotencyKey,
                }),
            });

            return {
                status: mapCobreStatus(moneyMovement.status?.state),
                providerTransferId: moneyMovement.id || moneyMovement.external_id || null,
                receiptUrl: moneyMovement.metadata?.cep_url || null,
                rawResponse: moneyMovement,
                errorMessage: moneyMovement.status?.description || null,
            };
        } catch (error) {
            return {
                status: 'failed',
                providerTransferId: null,
                receiptUrl: null,
                rawResponse: {
                    provider: 'cobre',
                    error: error instanceof Error ? error.message : 'Cobre payout failed',
                },
                errorMessage: error instanceof Error ? error.message : 'Cobre payout failed',
            };
        }
    },
};
