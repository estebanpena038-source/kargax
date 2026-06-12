// =============================================================================
// KargaX - Security Proxy (Sin Supabase)
// Oracle-Level: Route protection, rate limiting, security headers
// =============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-constants';
import { handleCorsRequest, secureResponse } from '@/lib/server/cors';

// =============================================================================
// Configuration
// =============================================================================

const PUBLIC_ROUTES = [
    '/',
    '/ayuda',
    '/planes',
    '/soporte',
    '/onboarding',
    '/login',
    '/registro',
    '/verificar-email',
    '/recuperar-contrasena',
    '/auth/callback',
    '/api/auth/session',
    '/api/billing/plans/public',
    '/api/market/context',
    '/api/onboarding/status',
    '/api/onboarding/checklist',
    '/api/ops/events',
    '/api/notifications/send-pin',
    '/api/notifications/inspection',
    '/api/payments/webhook',
    '/api/jobs/payouts/process',
    '/api/jobs/last-mile/recompute',
    '/api/cron/inactive-users',
    '/api/support/requests',
    '/api/health',
];

const RATE_LIMITS = {
    auth: { requests: 25, windowMs: 60 * 1000 },
    webhook: { requests: 180, windowMs: 60 * 1000 },
    adminReplay: { requests: 30, windowMs: 60 * 1000 },
    onboarding: { requests: 80, windowMs: 60 * 1000 },
    read: { requests: 600, windowMs: 60 * 1000 },
    mutation: { requests: 120, windowMs: 60 * 1000 },
    default: { requests: 300, windowMs: 60 * 1000 },
} as const;

const fallbackRateLimitMap = new Map<string, { count: number; resetTime: number }>();

// =============================================================================
// Rate Limiting
// =============================================================================

function getClientIp(request: NextRequest) {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function getRateLimitFamily(pathname: string, method: string) {
    if (pathname.startsWith('/api/auth')) {
        return 'auth' as const;
    }

    if (
        (pathname.startsWith('/login')
            || pathname.startsWith('/registro')
            || pathname.startsWith('/recuperar-contrasena'))
        && method !== 'GET'
        && method !== 'HEAD'
        && method !== 'OPTIONS'
    ) {
        return 'auth' as const;
    }

    if (pathname.startsWith('/api/payments/webhook')) {
        return 'webhook' as const;
    }

    if (pathname.startsWith('/api/admin/incidents/') && pathname.endsWith('/replay')) {
        return 'adminReplay' as const;
    }

    if (
        pathname.startsWith('/onboarding')
        || pathname.startsWith('/api/onboarding')
        || pathname.startsWith('/api/support')
    ) {
        return 'onboarding' as const;
    }

    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return 'read' as const;
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return 'mutation' as const;
    }

    return 'default' as const;
}

function getUpstashHeaders() {
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!token) {
        return null;
    }

    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

async function checkRateLimitWithUpstash(
    key: string,
    requests: number,
    windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number } | null> {
    const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const headers = getUpstashHeaders();

    if (!baseUrl || !headers) {
        return null;
    }

    try {
        const encodedKey = encodeURIComponent(key);
        const setResponse = await fetch(`${baseUrl}/set/${encodedKey}/1?NX=true&PX=${windowMs}`, {
            method: 'POST',
            headers,
            cache: 'no-store',
        });

        if (!setResponse.ok) {
            return null;
        }

        const setResult = await setResponse.json().catch(() => ({}));
        if (setResult?.result === 'OK') {
            return {
                allowed: true,
                remaining: requests - 1,
                retryAfterSeconds: Math.ceil(windowMs / 1000),
            };
        }

        const [incrResponse, ttlResponse] = await Promise.all([
            fetch(`${baseUrl}/incr/${encodedKey}`, {
                method: 'POST',
                headers,
                cache: 'no-store',
            }),
            fetch(`${baseUrl}/pttl/${encodedKey}`, {
                method: 'POST',
                headers,
                cache: 'no-store',
            }),
        ]);

        if (!incrResponse.ok) {
            return null;
        }

        const incrJson = await incrResponse.json().catch(() => ({}));
        const ttlJson = await ttlResponse.json().catch(() => ({}));
        const count = Number(incrJson?.result || 0);
        const ttlMs = Math.max(Number(ttlJson?.result || windowMs), 0);

        return {
            allowed: count <= requests,
            remaining: Math.max(requests - count, 0),
            retryAfterSeconds: Math.max(Math.ceil(ttlMs / 1000), 1),
        };
    } catch {
        return null;
    }
}

function checkRateLimitInMemory(key: string, requests: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const record = fallbackRateLimitMap.get(key);

    if (!record || now > record.resetTime) {
        fallbackRateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return {
            allowed: true,
            remaining: requests - 1,
            retryAfterSeconds: Math.ceil(windowMs / 1000),
        };
    }

    if (record.count >= requests) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.max(Math.ceil((record.resetTime - now) / 1000), 1),
        };
    }

    record.count++;
    return {
        allowed: true,
        remaining: Math.max(requests - record.count, 0),
        retryAfterSeconds: Math.max(Math.ceil((record.resetTime - now) / 1000), 1),
    };
}

async function checkRateLimit(pathname: string, method: string, ip: string) {
    const family = getRateLimitFamily(pathname, method);
    const config = RATE_LIMITS[family];
    const key = `ratelimit:${family}:${method}:${ip}`;
    const distributed = await checkRateLimitWithUpstash(key, config.requests, config.windowMs);

    const usedDistributed = Boolean(distributed);
    if (!usedDistributed && process.env.VERCEL_ENV === 'production') {
        console.warn('[RateLimit] Upstash unavailable in production, using in-memory fallback', { family, pathname });
    }

    return {
        family,
        distributed: usedDistributed,
        ...(distributed || checkRateLimitInMemory(key, config.requests, config.windowMs)),
    };
}

function isStaticAssetRequest(pathname: string) {
    return (
        pathname.startsWith('/_next')
        || pathname.startsWith('/locales/')
        || pathname === '/favicon.ico'
        || /\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest|txt|xml|map)$/i.test(pathname)
    );
}

// =============================================================================
// Main Proxy Function
// =============================================================================

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const ip = getClientIp(request);

    if (isStaticAssetRequest(pathname)) {
        return secureResponse(NextResponse.next(), request);
    }

    // ==========================================================================
    // URL Normalization: lowercase + strip trailing slash
    // Fixes: /Onboarding → /onboarding, /Dashboard/ → /dashboard
    // ==========================================================================
    const lowered = pathname.toLowerCase();
    const normalized =
        lowered.length > 1 && lowered.endsWith('/') ? lowered.slice(0, -1) : lowered;

    if (pathname !== normalized) {
        const url = request.nextUrl.clone();
        url.pathname = normalized;
        return secureResponse(NextResponse.redirect(url, 308), request);
    }

    const corsResponse = handleCorsRequest(request);
    if (corsResponse) {
        return corsResponse;
    }

    // ==========================================================================
    // Rate Limiting Check
    // ==========================================================================
    const { allowed, remaining, retryAfterSeconds, family, distributed } = await checkRateLimit(pathname, request.method, ip);

    if (!allowed) {
        const response = NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429 }
        );
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Family', family);
        response.headers.set('X-RateLimit-Distributed', String(distributed));
        response.headers.set('Retry-After', String(retryAfterSeconds));
        return secureResponse(response, request);
    }

    // ==========================================================================
    // Skip auth check for public routes and static files
    // ==========================================================================
    const isPublicRoute = PUBLIC_ROUTES.some(
        (route) =>
            pathname === route ||
            pathname.startsWith('/_next') ||
            pathname.startsWith('/api/public') ||
            pathname.startsWith('/locales')
    );

    if (isPublicRoute) {
        const response = NextResponse.next();
        response.headers.set('X-RateLimit-Remaining', String(remaining));
        return secureResponse(response, request);
    }

    // ==========================================================================
    // Authentication Check
    // ==========================================================================
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
        if (pathname.startsWith('/api')) {
            const response = NextResponse.json(
                {
                    success: false,
                    data: null,
                    error: { message: 'Authentication required' },
                    code: 'UNAUTHORIZED',
                    meta: {
                        requestId: request.headers.get('x-request-id') || crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                    },
                },
                { status: 401 }
            );
            response.headers.set('X-RateLimit-Remaining', String(remaining));
            return secureResponse(response, request);
        }

        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('redirect', pathname);

        const response = NextResponse.redirect(loginUrl);
        response.headers.set('X-RateLimit-Remaining', String(remaining));
        return secureResponse(response, request);
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', String(remaining));

    return secureResponse(response, request);
}

// =============================================================================
// Proxy Configuration
// =============================================================================

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
