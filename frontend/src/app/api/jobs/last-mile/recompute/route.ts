import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getSupabaseAdmin, requireInternalApiKeyRoute } from '@/lib/server/route-auth';
import {
    getMonthRange,
    lastMileRecomputeSchema,
    recomputeLastMileJob,
    toLastMileError,
} from '@/lib/server/last-mile';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const internalAuth = requireInternalApiKeyRoute(request, {
        code: 'LAST_MILE_JOB_UNAUTHORIZED',
    });

    if ('response' in internalAuth) {
        return internalAuth.response;
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
