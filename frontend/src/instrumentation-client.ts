import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

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

function scrubSentryEvent(event: Sentry.ErrorEvent) {
    if (event.user) {
        event.user = event.user.id ? { id: event.user.id } : undefined;
    }

    if (event.request?.cookies) {
        delete event.request.cookies;
    }

    if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers['set-cookie'];
    }

    return event;
}

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (sentryDsn) {
    Sentry.init({
        dsn: sentryDsn,
        environment: getRuntimeEnvironment(),
        sendDefaultPii: false,
        tracesSampleRate: getSampleRate(
            process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
            process.env.NODE_ENV === 'development' ? 1 : 0.05
        ),
        beforeSend: scrubSentryEvent,
    });
}

const posthogKey = (
    process.env.NEXT_PUBLIC_POSTHOG_KEY
    || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
)?.trim();

if (posthogKey && typeof window !== 'undefined') {
    posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        defaults: '2026-01-30',
        person_profiles: 'identified_only',
        autocapture: false,
        capture_pageview: true,
        loaded: (client) => {
            if (process.env.NODE_ENV === 'development') {
                client.debug(false);
            }
        },
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
