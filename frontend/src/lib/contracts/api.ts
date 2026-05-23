export interface ApiErrorPayload {
    message: string;
    details?: unknown;
}

export interface ApiEnvelope<T> {
    success: boolean;
    data: T | null;
    error: ApiErrorPayload | null;
    code: string;
    meta: {
        requestId: string;
        timestamp: string;
        [key: string]: unknown;
    };
}

type EnvelopeLike<T> =
    | ApiEnvelope<T>
    | {
        success?: boolean;
        data?: T;
        error?: string | ApiErrorPayload | null;
        code?: string;
        meta?: Record<string, unknown>;
    };

export function isApiEnvelope<T = unknown>(input: unknown): input is ApiEnvelope<T> {
    if (!input || typeof input !== 'object') {
        return false;
    }

    const candidate = input as Partial<ApiEnvelope<T>>;

    return (
        typeof candidate.success === 'boolean' &&
        typeof candidate.code === 'string' &&
        candidate.meta !== undefined &&
        typeof candidate.meta === 'object' &&
        candidate.meta !== null &&
        'data' in candidate &&
        'error' in candidate
    );
}

export function extractApiErrorMessage(input: unknown, fallback = 'Unexpected API error') {
    if (!input || typeof input !== 'object') {
        return fallback;
    }

    const candidate = input as EnvelopeLike<unknown>;

    if (typeof candidate.error === 'string' && candidate.error.trim()) {
        return candidate.error;
    }

    if (candidate.error && typeof candidate.error === 'object' && 'message' in candidate.error) {
        const message = candidate.error.message;
        if (typeof message === 'string' && message.trim()) {
            return message;
        }
    }

    return fallback;
}

export function unwrapApiEnvelope<T>(input: unknown): T | null {
    if (isApiEnvelope<T>(input)) {
        return input.data ?? null;
    }

    return null;
}
