import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    assertLastMileRecompute,
    getMonthRange,
    lastMileRecomputeSchema,
    recomputeLastMileSnapshots,
    resolveLastMileRouteContext,
    toLastMileError,
} from '@/lib/server/last-mile';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);
    if ('response' in auth) return auth.response;

    try {
        const body = await request.json().catch(() => ({}));
        const parsed = lastMileRecomputeSchema.safeParse(body);
        if (!parsed.success) {
            return apiError('Datos invalidos para recalcular snapshots', {
                status: 400,
                code: 'LAST_MILE_RECOMPUTE_VALIDATION_ERROR',
                details: parsed.error.issues,
                requestId,
            });
        }

        const { supabaseAdmin, authUser, profile } = auth.context;
        const context = await resolveLastMileRouteContext(supabaseAdmin, authUser.id, profile, parsed.data.businessId);
        assertLastMileRecompute(context.access);
        const range = getMonthRange(parsed.data.month || null);
        const result = await recomputeLastMileSnapshots(supabaseAdmin, context.businessId, authUser.id, parsed.data, range);

        return apiSuccess(result, {
            requestId,
            code: 'LAST_MILE_SNAPSHOT_RECOMPUTED',
            meta: { businessId: context.businessId },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo recalcular Control de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}
