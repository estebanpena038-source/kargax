import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    assertLastMileView,
    getMonthRange,
    loadLastMileDashboard,
    resolveLastMileRouteContext,
    toLastMileError,
} from '@/lib/server/last-mile';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);
    if ('response' in auth) return auth.response;

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const context = await resolveLastMileRouteContext(
            supabaseAdmin,
            authUser.id,
            profile,
            request.nextUrl.searchParams.get('businessId')
        );
        assertLastMileView(context.access);
        const range = getMonthRange(request.nextUrl.searchParams.get('month'));
        const dashboard = await loadLastMileDashboard(supabaseAdmin, {
            businessId: context.businessId,
            access: context.access,
            range,
        });

        return apiSuccess(dashboard, {
            requestId,
            code: 'LAST_MILE_DASHBOARD_LOADED',
            meta: { businessId: context.businessId },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo cargar Control de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}
