/**
 * =============================================================================
 * KARGAX - MERCADO PAGO CONFIGURATION
 * Server-side only configuration for payment processing
 * =============================================================================
 */

import crypto from 'crypto';
import { MercadoPagoConfig, MerchantOrder, Payment, Preference } from 'mercadopago';
import {
    getConfiguredAppUrl,
    isLocalAppUrl,
    isPreviewEnvironment,
    isStrictProductionEnvironment,
} from '@/lib/server/runtime-env';

type BillingMercadoPagoCountryCode = 'CO' | 'PE' | 'BR';

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const BILLING_MERCADO_PAGO_COUNTRIES = ['CO', 'PE', 'BR'] as const;
const BILLING_ACCESS_TOKEN_ENV_BY_COUNTRY: Record<BillingMercadoPagoCountryCode, string> = {
    CO: 'MERCADOPAGO_ACCESS_TOKEN_CO',
    PE: 'MERCADOPAGO_ACCESS_TOKEN_PE',
    BR: 'MERCADOPAGO_ACCESS_TOKEN_BR',
};
const BILLING_WEBHOOK_SECRET_ENV_BY_COUNTRY: Record<BillingMercadoPagoCountryCode, string> = {
    CO: 'MERCADOPAGO_WEBHOOK_SECRET_CO',
    PE: 'MERCADOPAGO_WEBHOOK_SECRET_PE',
    BR: 'MERCADOPAGO_WEBHOOK_SECRET_BR',
};

if (!accessToken) {
    console.error('MERCADOPAGO_ACCESS_TOKEN no esta configurado en las variables de entorno');
}

export const mercadoPagoClient = new MercadoPagoConfig({
    accessToken: accessToken || '',
    options: {
        timeout: 30000,
    },
});

export const preferenceApi = new Preference(mercadoPagoClient);
export const paymentApi = new Payment(mercadoPagoClient);
export const merchantOrderApi = new MerchantOrder(mercadoPagoClient);
export const isMercadoPagoTestMode = Boolean(accessToken && /^TEST[-_]/i.test(accessToken));

interface MercadoPagoApis {
    preferenceApi: Preference;
    paymentApi: Payment;
    merchantOrderApi: MerchantOrder;
    isTestMode: boolean;
}

const billingApisByCountry = new Map<BillingMercadoPagoCountryCode, MercadoPagoApis>();

export function normalizeBillingMercadoPagoCountryCode(value: unknown): BillingMercadoPagoCountryCode | null {
    const normalized = String(value || '').trim().toUpperCase();

    return BILLING_MERCADO_PAGO_COUNTRIES.includes(normalized as BillingMercadoPagoCountryCode)
        ? normalized as BillingMercadoPagoCountryCode
        : null;
}

function getBillingAccessToken(countryCode: BillingMercadoPagoCountryCode) {
    const envName = BILLING_ACCESS_TOKEN_ENV_BY_COUNTRY[countryCode];
    const countryToken = process.env[envName]?.trim();

    if (countryToken) {
        return countryToken;
    }

    if (countryCode === 'CO' && accessToken) {
        return accessToken;
    }

    if (isStrictProductionEnvironment()) {
        throw new Error(`Missing required production env vars: ${envName}`);
    }

    throw new Error(`Mercado Pago billing no esta configurado para ${countryCode}. Define ${envName}.`);
}

export function hasBillingMercadoPagoAccessToken(countryCodeInput: unknown) {
    const countryCode = normalizeBillingMercadoPagoCountryCode(countryCodeInput);

    if (!countryCode) {
        return false;
    }

    return Boolean(
        process.env[BILLING_ACCESS_TOKEN_ENV_BY_COUNTRY[countryCode]]?.trim()
        || (countryCode === 'CO' && accessToken)
    );
}

export function getBillingMercadoPagoApis(countryCodeInput: unknown): MercadoPagoApis {
    const countryCode = normalizeBillingMercadoPagoCountryCode(countryCodeInput);

    if (!countryCode) {
        throw new Error('Mercado Pago billing no esta disponible para este pais.');
    }

    const existing = billingApisByCountry.get(countryCode);

    if (existing) {
        return existing;
    }

    const countryAccessToken = getBillingAccessToken(countryCode);
    const client = new MercadoPagoConfig({
        accessToken: countryAccessToken,
        options: {
            timeout: 30000,
        },
    });
    const apis = {
        preferenceApi: new Preference(client),
        paymentApi: new Payment(client),
        merchantOrderApi: new MerchantOrder(client),
        isTestMode: /^TEST[-_]/i.test(countryAccessToken),
    };

    billingApisByCountry.set(countryCode, apis);
    return apis;
}

export function getBillingMercadoPagoWebhookSecret(countryCodeInput: unknown) {
    const countryCode = normalizeBillingMercadoPagoCountryCode(countryCodeInput);

    if (!countryCode) {
        return process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || '';
    }

    const envName = BILLING_WEBHOOK_SECRET_ENV_BY_COUNTRY[countryCode];
    const countrySecret = process.env[envName]?.trim();

    if (countrySecret) {
        return countrySecret;
    }

    if (countryCode === 'CO') {
        return process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || '';
    }

    return '';
}

export function getBillingMercadoPagoWebhookSecretEnvName(countryCodeInput: unknown) {
    const countryCode = normalizeBillingMercadoPagoCountryCode(countryCodeInput);

    return countryCode ? BILLING_WEBHOOK_SECRET_ENV_BY_COUNTRY[countryCode] : 'MERCADOPAGO_WEBHOOK_SECRET';
}

export function isBillingMercadoPagoCheckoutConfigured(countryCodeInput: unknown) {
    return hasBillingMercadoPagoAccessToken(countryCodeInput) && Boolean(getBillingMercadoPagoWebhookSecret(countryCodeInput));
}

export const PLATFORM_FEE_PERCENT = parseFloat(
    process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT || '10'
);

function getBaseUrl(): string {
    const configuredAppUrl = getConfiguredAppUrl();

    if (configuredAppUrl) {
        return configuredAppUrl;
    }

    // Fallback: use NEXT_PUBLIC_APP_URL directly, only default to localhost in dev
    const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    return envUrl || 'http://localhost:3000';
}

export const PAYMENT_URLS = {
    success: `${getBaseUrl()}/pago/exitoso`,
    failure: `${getBaseUrl()}/pago/fallido`,
    pending: `${getBaseUrl()}/pago/pendiente`,
};

export function calculatePaymentAmounts(freightAmount: number) {
    const platformFee = Math.round((freightAmount * PLATFORM_FEE_PERCENT) / 100);
    const totalAmount = freightAmount + platformFee;

    return {
        freightAmount,
        platformFee,
        totalAmount,
    };
}

export function validateWebhookSignature(
    xSignature: string | null,
    xRequestId: string | null,
    dataId: string,
    dataIdFromQuery?: string | null,
    countryCode?: string | null
): boolean {
    if (!xSignature) {
        console.warn('Webhook sin firma valida');
        return false;
    }

    const webhookSecret = getBillingMercadoPagoWebhookSecret(countryCode);

    if (!webhookSecret) {
        const allowUnsignedPreviewWebhooks =
            process.env.ALLOW_UNSIGNED_MP_WEBHOOKS_IN_PREVIEW === 'true';
        const appUrl = getConfiguredAppUrl();
        const canBypassSignature =
            allowUnsignedPreviewWebhooks &&
            (isPreviewEnvironment() || isLocalAppUrl(appUrl));

        if (!isStrictProductionEnvironment() && canBypassSignature) {
            console.warn(
                'MERCADOPAGO_WEBHOOK_SECRET not configured; unsigned webhook accepted only for local or preview environments'
            );
            return true;
        }

        console.warn(`${getBillingMercadoPagoWebhookSecretEnvName(countryCode)} no configurado`);
        return false;
    }

    const signatureParts = new Map(
        xSignature.split(',').map((part) => {
            const [key, value] = part.split('=');
            return [key?.trim(), value?.trim()];
        })
    );

    const timestamp = signatureParts.get('ts');
    const receivedHash = signatureParts.get('v1');

    if (!timestamp || !receivedHash) {
        console.warn('x-signature incompleto');
        return false;
    }

    try {
        const manifests = buildWebhookSignatureManifestCandidates({
            queryDataId: dataIdFromQuery,
            bodyDataId: dataId,
            requestId: xRequestId,
            timestamp,
        });

        const receivedHashBuffer = Buffer.from(receivedHash, 'hex');

        return manifests.some((manifest) => {
            const expectedHash = crypto
                .createHmac('sha256', webhookSecret)
                .update(manifest)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(expectedHash, 'hex'),
                receivedHashBuffer
            );
        });
    } catch (error) {
        console.error('Error validando firma del webhook:', error);
        return false;
    }
}

function buildWebhookSignatureManifestCandidates({
    queryDataId,
    bodyDataId,
    requestId,
    timestamp,
}: {
    queryDataId?: string | null;
    bodyDataId?: string | null;
    requestId?: string | null;
    timestamp: string;
}) {
    const normalizedQueryDataId = normalizeWebhookDataId(queryDataId);
    const normalizedBodyDataId = normalizeWebhookDataId(bodyDataId);
    const normalizedRequestId = requestId?.trim() || null;
    const idCandidates = [
        normalizedQueryDataId,
        normalizedQueryDataId ? null : normalizedBodyDataId,
        null,
    ];
    const manifests = new Set<string>();

    idCandidates.forEach((candidateId) => {
        const parts = [
            candidateId ? `id:${candidateId};` : null,
            normalizedRequestId ? `request-id:${normalizedRequestId};` : null,
            `ts:${timestamp};`,
        ].filter(Boolean);

        manifests.add(parts.join(''));
    });

    return Array.from(manifests);
}

function normalizeWebhookDataId(value?: string | null) {
    const normalized = value?.trim();

    if (!normalized) {
        return null;
    }

    return normalized.toLowerCase();
}
