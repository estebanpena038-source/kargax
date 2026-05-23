import { NextResponse } from 'next/server';

export interface ApiEnvelope<T> {
    success: boolean;
    data: T | null;
    error: {
        message: string;
        details?: unknown;
    } | null;
    code: string;
    meta: {
        requestId: string;
        timestamp: string;
        [key: string]: unknown;
    };
}

interface ApiResponseOptions {
    status?: number;
    code?: string;
    requestId?: string;
    meta?: Record<string, unknown>;
    details?: unknown;
}

export function getRequestId(request: Request) {
    return request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
}

export function apiSuccess<T>(
    data: T,
    options: ApiResponseOptions = {}
) {
    const requestId = options.requestId || crypto.randomUUID();

    const payload: ApiEnvelope<T> = {
        success: true,
        data,
        error: null,
        code: options.code || 'OK',
        meta: {
            requestId,
            timestamp: new Date().toISOString(),
            ...(options.meta || {}),
        },
    };

    return NextResponse.json(payload, {
        status: options.status || 200,
    });
}

export function apiError(
    message: string,
    options: ApiResponseOptions = {}
) {
    const requestId = options.requestId || crypto.randomUUID();

    const payload: ApiEnvelope<null> = {
        success: false,
        data: null,
        error: {
            message,
            ...(options.details !== undefined ? { details: options.details } : {}),
        },
        code: options.code || 'ERROR',
        meta: {
            requestId,
            timestamp: new Date().toISOString(),
            ...(options.meta || {}),
        },
    };

    return NextResponse.json(payload, {
        status: options.status || 500,
    });
}
