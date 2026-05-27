import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    assertLastMileRenegotiation,
    lastMileRecommendationPatchSchema,
    resolveLastMileRouteContext,
    toLastMileError,
    updateLastMileRenegotiation,
} from '@/lib/server/last-mile';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);
    if ('response' in auth) return auth.response;

    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const parsed = lastMileRecommendationPatchSchema.safeParse(body);
        if (!parsed.success) {
            return apiError('Datos invalidos para actualizar renegociacion', {
                status: 400,
                code: 'LAST_MILE_RENEGOTIATION_VALIDATION_ERROR',
                details: parsed.error.issues,
                requestId,
            });
        }

        const { supabaseAdmin, authUser, profile } = auth.context;
        const routeContext = await resolveLastMileRouteContext(supabaseAdmin, authUser.id, profile, parsed.data.businessId);
        assertLastMileRenegotiation(routeContext.access);
        const renegotiation = await updateLastMileRenegotiation(
            supabaseAdmin,
            routeContext.businessId,
            authUser.id,
            id,
            parsed.data
        );

        return apiSuccess({ renegotiation }, {
            requestId,
            code: 'LAST_MILE_RENEGOTIATION_UPDATED',
            meta: { businessId: routeContext.businessId, renegotiationId: id },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo actualizar renegociacion de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}
