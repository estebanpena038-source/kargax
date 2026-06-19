export interface SecurityHeaderOptions {
    includeStrictTransportSecurity?: boolean;
    includeContentSecurityPolicyReportOnly?: boolean;
}

const CONTENT_SECURITY_POLICY_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://sdk.mercadopago.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' blob: mediastream:",
    "connect-src 'self' https://www.google.com https://www.gstatic.com https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://api.mercadolibre.com https://*.sentry.io https://*.ingest.sentry.io https://*.posthog.com https://*.i.posthog.com https://us.i.posthog.com https://eu.i.posthog.com",
    "frame-src https://www.google.com https://www.recaptcha.net https://www.mercadopago.com https://www.mercadopago.com.co https://www.mercadopago.com.br",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://www.mercadopago.com https://www.mercadopago.com.co https://www.mercadopago.com.br",
    "worker-src 'self' blob:",
];

export const CONTENT_SECURITY_POLICY = CONTENT_SECURITY_POLICY_DIRECTIVES.join('; ');

function isStrictProductionEnvironment() {
    return (
        process.env.VERCEL_ENV === 'production'
        || (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production')
    );
}

export function shouldIncludeStrictTransportSecurity() {
    return isStrictProductionEnvironment();
}

export function shouldIncludeContentSecurityPolicyReportOnly() {
    return (
        process.env.CSP_REPORT_ONLY === 'true'
        || process.env.CONTENT_SECURITY_POLICY_REPORT_ONLY === 'true'
        || process.env.VERCEL_ENV === 'preview'
    );
}

export function getSecurityHeaderEntries(options: SecurityHeaderOptions = {}) {
    const includeStrictTransportSecurity =
        options.includeStrictTransportSecurity ?? shouldIncludeStrictTransportSecurity();
    const includeContentSecurityPolicyReportOnly =
        options.includeContentSecurityPolicyReportOnly ?? shouldIncludeContentSecurityPolicyReportOnly();

    const headers = [
        {
            key: 'Content-Security-Policy',
            value: CONTENT_SECURITY_POLICY,
        },
        {
            key: 'X-Frame-Options',
            value: 'DENY',
        },
        {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
        },
        {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
        },
        {
            key: 'Permissions-Policy',
            value: [
                'camera=(self)',
                'microphone=()',
                'geolocation=(self)',
                'interest-cohort=()',
                'payment=(self)',
                'usb=()',
                'magnetometer=()',
                'gyroscope=()',
                'accelerometer=()',
            ].join(', '),
        },
        {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
        },
        {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
        },
    ];

    if (includeStrictTransportSecurity) {
        headers.push({
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
        });
    }

    if (includeContentSecurityPolicyReportOnly) {
        headers.push({
            key: 'Content-Security-Policy-Report-Only',
            value: CONTENT_SECURITY_POLICY,
        });
    }

    return headers;
}
