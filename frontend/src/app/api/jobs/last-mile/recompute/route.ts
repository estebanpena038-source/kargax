import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getSupabaseAdmin } from '@/lib/server/route-auth';
import {
    getMonthRange,
    lastMileRecomputeSchema,
    recomputeLastMileJob,
    toLastMileError,
} from '@/lib/server/last-mile';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const expectedKey = process.env.INTERNAL_API_KEY;
    const providedKey = request.headers.get('x-internal-api-key')?.trim();

    if (!expectedKey) {
        return apiError('INTERNAL_API_KEY no esta configurado para jobs internos', {
            status: 500,
            code: 'LAST_MILE_JOB_KEY_MISSING',
            requestId,
        });
    }

    if (providedKey !== expectedKey) {
        return apiError('No autorizado para ejecutar job Last-Mile', {
            status: 401,
            code: 'LAST_MILE_JOB_UNAUTHORIZED',
            requestId,
        });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const parsed = lastMileRecomputeSchema.safeParse(body);
        if (!parsed.success) {
            return apiError('Datos invalidos para job Last-Mile', {
                status: 400,
                code: 'LAST_MILE_JOB_VALIDATION_ERROR',
                details: parsed.error.issues,
                requestId,
            });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const range = getMonthRange(parsed.data.month || null);
        const result = await recomputeLastMileJob(supabaseAdmin, parsed.data, range);

        return apiSuccess(result, {
            requestId,
            code: 'LAST_MILE_JOB_RECOMPUTED',
            meta: { businessId: parsed.data.businessId || null },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo ejecutar job Last-Mile');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}
