import * as Sentry from '@sentry/nextjs';

function getRuntimeEnvironment() {
    return (
        process.env.NEXT_PUBLIC_APP_ENV
        || process.env.VERCEL_ENV
        || process.env.NODE_ENV
        || 'development'
    );
}

function getSampleRate(value: string | undefined, fallback: number) {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

const sentryDsn = (
    process.env.SENTRY_DSN
    || process.env.NEXT_PUBLIC_SENTRY_DSN
)?.trim();

if (sentryDsn) {
    Sentry.init({
        dsn: sentryDsn,
        environment: getRuntimeEnvironment(),
        sendDefaultPii: false,
        tracesSampleRate: getSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.02),
    });
}
