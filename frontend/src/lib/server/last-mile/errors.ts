export class LastMileError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details?: unknown;

    constructor(message: string, options: { status?: number; code?: string; details?: unknown } = {}) {
        super(message);
        this.name = 'LastMileError';
        this.status = options.status || 500;
        this.code = options.code || 'LAST_MILE_ERROR';
        this.details = options.details;
    }
}

export function toLastMileError(error: unknown, fallbackMessage = 'No se pudo procesar Control de margen') {
    if (error instanceof LastMileError) {
        return error;
    }

    if (error instanceof Error) {
        const candidate = error as Error & { status?: number; code?: string; details?: unknown };
        return new LastMileError(candidate.message || fallbackMessage, {
            status: candidate.status || 500,
            code: candidate.code || 'LAST_MILE_INTERNAL_ERROR',
            details: candidate.details,
        });
    }

    return new LastMileError(fallbackMessage, {
        status: 500,
        code: 'LAST_MILE_INTERNAL_ERROR',
    });
}

export function getSupabaseWriteErrorMessage(error: unknown) {
    if (!error || typeof error !== 'object') {
        return 'No se pudo guardar la informacion de Control de margen';
    }

    const candidate = error as { message?: string; details?: string; hint?: string; code?: string };
    return candidate.message || candidate.details || candidate.hint || candidate.code || 'No se pudo guardar la informacion de Control de margen';
}
