import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applySecurityHeaders } from '@/lib/server/security-headers';
import { isStrictProductionEnvironment } from '@/lib/server/runtime-env';

const CORS_ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS = [
    'Authorization',
    'Content-Type',
    'X-Requested-With',
    'X-Internal-Api-Key',
    'X-Request-Id',
    'X-Signature',
    'X-Client-Info',
    'Apikey',
].join(', ');

function normalizeOrigin(candidate: string) {
    try {
        const trimmed = candidate.trim();
        const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        return new URL(withProtocol).origin;
    } catch {
        return null;
    }
}

function isLocalOrigin(origin: string) {
    try {
        const { hostname } = new URL(origin);
        return ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);
    } catch {
        return false;
    }
}

function getRuntimeCorsOriginCandidates() {
    const productionCandidates = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
        'https://kargax.com',
        'https://www.kargax.com',
        'https://app.kargax.com',
    ];

    if (isStrictProductionEnvironment()) {
        return productionCandidates;
    }

    return [
        ...productionCandidates,
        process.env.VERCEL_URL,
        process.env.VERCEL_BRANCH_URL,
        'https://kargax-staging.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ];
}

export function getAllowedCorsOrigins() {
    return new Set(
        [
            ...getRuntimeCorsOriginCandidates(),
            ...(process.env.ALLOWED_ORIGINS || '').split(/[\s,]+/),
        ]
            .filter((origin): origin is string => Boolean(origin))
            .map((origin) => normalizeOrigin(origin))
            .filter((origin): origin is string => Boolean(origin))
            .filter((origin) => !isStrictProductionEnvironment() || !isLocalOrigin(origin))
    );
}

function appendVaryOrigin(headers: Headers) {
    const current = headers.get('Vary');
    if (!current) {
        headers.set('Vary', 'Origin');
        return;
    }

    const values = current.split(',').map((value) => value.trim().toLowerCase());
    if (!values.includes('origin')) {
        headers.set('Vary', `${current}, Origin`);
    }
}

function isApiRequest(request: NextRequest) {
    return request.nextUrl.pathname.startsWith('/api');
}

export function isCorsOriginAllowed(origin: string | null, request?: NextRequest) {
    if (!origin) {
        return true;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
        return false;
    }

    const requestOrigin = request ? normalizeOrigin(request.nextUrl.origin) : null;
    if (requestOrigin && normalizedOrigin === requestOrigin) {
        return true;
    }

    return getAllowedCorsOrigins().has(normalizedOrigin);
}

export function applyCorsHeaders(response: NextResponse, request: NextRequest) {
    if (!isApiRequest(request)) {
        return response;
    }

    appendVaryOrigin(response.headers);

    const origin = request.headers.get('origin');
    if (!origin || !isCorsOriginAllowed(origin, request)) {
        return response;
    }

    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
    response.headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
    response.headers.set('Access-Control-Max-Age', '86400');

    return response;
}

export function secureResponse(response: NextResponse, request: NextRequest) {
    applySecurityHeaders(response);
    applyCorsHeaders(response, request);

    return response;
}

export function handleCorsRequest(request: NextRequest) {
    if (!isApiRequest(request)) {
        return null;
    }

    const origin = request.headers.get('origin');
    if (origin && !isCorsOriginAllowed(origin, request)) {
        const response = NextResponse.json(
            {
                success: false,
                data: null,
                error: { message: 'CORS origin is not allowed' },
                code: 'CORS_ORIGIN_DENIED',
                meta: {
                    requestId: request.headers.get('x-request-id') || crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 403 }
        );

        return secureResponse(response, request);
    }

    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 204 });
        return secureResponse(response, request);
    }

    return null;
}
