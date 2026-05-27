import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    assertLastMileRenegotiation,
    assertLastMileView,
    getLastMileAlert,
    lastMileRecommendationPatchSchema,
    resolveLastMileRouteContext,
    toLastMileError,
    updateLastMileAlertStatus,
} from '@/lib/server/last-mile';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);
    if ('response' in auth) return auth.response;

    try {
        const { id } = await context.params;
        const { supabaseAdmin, authUser, profile } = auth.context;
        const routeContext = await resolveLastMileRouteContext(
            supabaseAdmin,
            authUser.id,
            profile,
            request.nextUrl.searchParams.get('businessId')
        );
        assertLastMileView(routeContext.access);
        const alert = await getLastMileAlert(supabaseAdmin, routeContext.businessId, id);

        return apiSuccess({ alert }, {
            requestId,
            code: 'LAST_MILE_ALERT_LOADED',
            meta: { businessId: routeContext.businessId, alertId: id },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo cargar la alerta de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
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
            return apiError('Datos invalidos para actualizar alerta de margen', {
                status: 400,
                code: 'LAST_MILE_ALERT_VALIDATION_ERROR',
                details: parsed.error.issues,
                requestId,
            });
        }

        const { supabaseAdmin, authUser, profile } = auth.context;
        const routeContext = await resolveLastMileRouteContext(supabaseAdmin, authUser.id, profile, parsed.data.businessId);
        assertLastMileRenegotiation(routeContext.access);
        const alert = await updateLastMileAlertStatus(supabaseAdmin, routeContext.businessId, id, authUser.id, parsed.data);

        return apiSuccess({ alert }, {
            requestId,
            code: 'LAST_MILE_ALERT_UPDATED',
            meta: { businessId: routeContext.businessId, alertId: id },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo actualizar la alerta de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}
