import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { capturePostHogServerEvent, isPostHogServerConfigured } from '@/lib/observability/posthog-server';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest) {
    const expected = process.env.INTERNAL_API_KEY?.trim();

    if (!expected) {
        return false;
    }

    const provided = request.headers.get('x-internal-api-key')?.trim();
    return provided === expected;
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);

    if (!process.env.INTERNAL_API_KEY?.trim()) {
        return apiError('Prueba de observabilidad no configurada.', {
            status: 503,
            code: 'OBSERVABILITY_TEST_NOT_CONFIGURED',
            requestId,
        });
    }

    if (!isAuthorized(request)) {
        return apiError('No autorizado.', {
            status: 401,
            code: 'UNAUTHORIZED',
            requestId,
        });
    }

    const sentryConfigured = Boolean(
        process.env.SENTRY_DSN?.trim()
        || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
    );
    const posthogConfigured = isPostHogServerConfigured();

    if (sentryConfigured) {
        Sentry.captureMessage('KargaX observability smoke event', {
            level: 'info',
            tags: {
                surface: 'observability-test',
                requestId,
            },
        });
    }

    const sentryFlushed = sentryConfigured ? await Sentry.flush(2000) : false;
    const posthogCaptured = await capturePostHogServerEvent(
        'observability_smoke_event',
        'kargax-system',
        {
            requestId,
            environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        }
    );

    return apiSuccess({
        sentryConfigured,
        sentryFlushed,
        posthogConfigured,
        posthogCaptured,
    }, {
        code: 'OBSERVABILITY_TEST_COMPLETED',
        requestId,
    });
}
