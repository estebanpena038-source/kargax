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

        const notificationProvider = (process.env.NOTIFICATION_PROVIDER || '').trim().toLowerCase();

        if (options.requireNotificationProvider && !notificationProvider) {
            missingVariables.push('NOTIFICATION_PROVIDER');
        }

        if (options.requireNotificationProvider && notificationProvider === 'console') {
            throw new Error('NOTIFICATION_PROVIDER must use a real delivery provider in production');
        }

        if (options.requireTwilio && notificationProvider && notificationProvider !== 'twilio') {
            throw new Error('NOTIFICATION_PROVIDER must be set to twilio for this production flow');
        }

        if (options.requireTwilio && notificationProvider === 'twilio') {
            if (!process.env.TWILIO_ACCOUNT_SID) {
                missingVariables.push('TWILIO_ACCOUNT_SID');
            }

            if (!process.env.TWILIO_AUTH_TOKEN) {
                missingVariables.push('TWILIO_AUTH_TOKEN');
            }

            if (!process.env.TWILIO_PHONE_NUMBER) {
                missingVariables.push('TWILIO_PHONE_NUMBER');
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
