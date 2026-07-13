import { isLocalAppUrl, resolvePublicAppUrl } from '@/lib/platform/public-app-url';

export { isLocalAppUrl };

export function isStrictProductionEnvironment() {
    return (
        process.env.VERCEL_ENV === 'production' ||
        (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production')
    );
}

export function isNonStrictProductionEnvironment() {
    return !isStrictProductionEnvironment();
}

export function isPreviewEnvironment() {
    return process.env.VERCEL_ENV === 'preview';
}

export function getConfiguredAppUrl() {
    return resolvePublicAppUrl({ allowLocalhost: true }) || 'http://localhost:3000';
}

const KARGAX_STAGING_HOSTS = new Set([
    'kargax-staging.vercel.app',
]);

const KARGAX_PRODUCTION_HOSTS = new Set([
    'www.kargax.online',
    'kargax.online',
    'app.kargax.online',
]);

interface RuntimeHostOptions {
    requestHost?: string | null;
    requestUrl?: string | URL | null;
}

function normalizeHostname(value?: string | URL | null) {
    if (!value) {
        return null;
    }

    if (value instanceof URL) {
        return value.hostname.toLowerCase();
    }

    const candidate = value.trim();

    if (!candidate) {
        return null;
    }

    try {
        const url = /^[a-z][a-z\d+\-.]*:\/\//i.test(candidate)
            ? new URL(candidate)
            : new URL(`https://${candidate}`);

        return url.hostname.toLowerCase();
    } catch {
        return null;
    }
}

export function getRuntimeAppHostname(options: RuntimeHostOptions = {}) {
    return normalizeHostname(options.requestHost)
        || normalizeHostname(options.requestUrl)
        || normalizeHostname(getConfiguredAppUrl());
}

export function isKargaxStagingEnvironment(options: RuntimeHostOptions = {}) {
    const hostname = getRuntimeAppHostname(options);

    return isPreviewEnvironment() || (hostname ? KARGAX_STAGING_HOSTS.has(hostname) : false);
}

export function isKargaxProductionHost(options: RuntimeHostOptions = {}) {
    const hostname = getRuntimeAppHostname(options);
    return hostname ? KARGAX_PRODUCTION_HOSTS.has(hostname) : false;
}

export function getConfiguredNotificationProvider() {
    return (process.env.NOTIFICATION_PROVIDER || 'console').trim().toLowerCase();
}

function hasTwilioSender() {
    return Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID);
}

export function getNotificationRuntimeSnapshot(options: RuntimeHostOptions = {}) {
    const hostname = getRuntimeAppHostname(options);
    const strictProduction = isStrictProductionEnvironment();
    const stagingEnvironment = isKargaxStagingEnvironment(options);
    const productionHost = isKargaxProductionHost(options);
    const configuredProvider = getConfiguredNotificationProvider();
    const effectiveProvider = stagingEnvironment ? 'console' : configuredProvider;
    const twilioConfigured = Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        hasTwilioSender()
    );
    const requiresRealProvider = !stagingEnvironment && (strictProduction || productionHost);

    return {
        hostname,
        strictProduction,
        stagingEnvironment,
        productionHost,
        configuredProvider,
        effectiveProvider,
        requiresRealProvider,
        realSmsEnabled: effectiveProvider === 'twilio' && !stagingEnvironment,
        twilioConfigured,
        hasMessagingServiceSid: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID),
        hasFromNumber: Boolean(process.env.TWILIO_PHONE_NUMBER),
    };
}

interface PaymentRuntimeConfigOptions {
    requireWebhookSecret?: boolean;
    requireInternalApiKey?: boolean;
    requireNotificationProvider?: boolean;
    requireTwilio?: boolean;
    requirePayoutProvider?: boolean;
}

export function getPaymentRuntimeConfig(options: PaymentRuntimeConfigOptions = {}) {
    const baseUrl = getConfiguredAppUrl();
    const isLocalhost = isLocalAppUrl(baseUrl);
    const notificationRuntime = getNotificationRuntimeSnapshot({ requestUrl: baseUrl });

    if (isStrictProductionEnvironment()) {
        const missingVariables: string[] = [];

        if (!baseUrl.startsWith('https://') || isLocalhost) {
            throw new Error('NEXT_PUBLIC_APP_URL must use a public HTTPS domain in production');
        }

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            missingVariables.push('SUPABASE_SERVICE_ROLE_KEY');
        }

        if (options.requireWebhookSecret && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
            missingVariables.push('MERCADOPAGO_WEBHOOK_SECRET');
        }

        if (options.requireInternalApiKey && !process.env.INTERNAL_API_KEY) {
            missingVariables.push('INTERNAL_API_KEY');
        }

        const notificationProviderSetting = (process.env.NOTIFICATION_PROVIDER || '').trim().toLowerCase();
        const notificationProvider = notificationRuntime.effectiveProvider;

        if (options.requireNotificationProvider && notificationRuntime.requiresRealProvider && !notificationProviderSetting) {
            missingVariables.push('NOTIFICATION_PROVIDER');
        }

        if (options.requireNotificationProvider && notificationRuntime.requiresRealProvider && notificationProvider === 'console') {
            throw new Error('NOTIFICATION_PROVIDER must use a real delivery provider in production');
        }

        if (options.requireTwilio && notificationRuntime.requiresRealProvider && notificationProvider !== 'twilio') {
            throw new Error('NOTIFICATION_PROVIDER must be set to twilio for this production flow');
        }

        if (options.requireTwilio && notificationRuntime.requiresRealProvider && notificationProvider === 'twilio') {
            if (!process.env.TWILIO_ACCOUNT_SID) {
                missingVariables.push('TWILIO_ACCOUNT_SID');
            }

            if (!process.env.TWILIO_AUTH_TOKEN) {
                missingVariables.push('TWILIO_AUTH_TOKEN');
            }

            if (!hasTwilioSender()) {
                missingVariables.push('TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID');
            }
        }

        if (options.requirePayoutProvider || process.env.PAYOUTS_ENABLED === 'true') {
            const payoutProvider = (process.env.PAYOUT_PROVIDER || 'manual').trim().toLowerCase();

            if (!process.env.PAYOUT_PROVIDER) {
                missingVariables.push('PAYOUT_PROVIDER');
            }

            if (!process.env.PAYOUT_WEBHOOK_SECRET) {
                missingVariables.push('PAYOUT_WEBHOOK_SECRET');
            }

            if (payoutProvider === 'cobre' && process.env.PAYOUT_DRY_RUN === 'false') {
                if (!process.env.COBRE_API_KEY) {
                    missingVariables.push('COBRE_API_KEY');
                }

                if (!process.env.COBRE_SOURCE_ACCOUNT_ID) {
                    missingVariables.push('COBRE_SOURCE_ACCOUNT_ID');
                }
            }
        }

        if (missingVariables.length) {
            throw new Error(`Missing required production env vars: ${missingVariables.join(', ')}`);
        }
    }

    return {
        baseUrl,
        isLocalhost,
    };
}
