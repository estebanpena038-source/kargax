import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    archiveLastMileContract,
    assertLastMileManageContracts,
    lastMileContractPatchSchema,
    resolveLastMileRouteContext,
    toLastMileError,
    updateLastMileContract,
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
        const parsed = lastMileContractPatchSchema.safeParse(body);
        if (!parsed.success) {
            return apiError('Datos invalidos para actualizar contrato de margen', {
                status: 400,
                code: 'LAST_MILE_CONTRACT_VALIDATION_ERROR',
                details: parsed.error.issues,
                requestId,
            });
        }

        const { supabaseAdmin, authUser, profile } = auth.context;
        const routeContext = await resolveLastMileRouteContext(supabaseAdmin, authUser.id, profile, parsed.data.businessId);
        assertLastMileManageContracts(routeContext.access);
        const contract = await updateLastMileContract(supabaseAdmin, routeContext.businessId, authUser.id, id, parsed.data);

        return apiSuccess({ contract }, {
            requestId,
            code: 'LAST_MILE_CONTRACT_UPDATED',
            meta: { businessId: routeContext.businessId, contractId: id },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo actualizar contrato de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);
    if ('response' in auth) return auth.response;

    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({})) as { businessId?: string };
        const { supabaseAdmin, authUser, profile } = auth.context;
        const routeContext = await resolveLastMileRouteContext(supabaseAdmin, authUser.id, profile, body.businessId || request.nextUrl.searchParams.get('businessId'));
        assertLastMileManageContracts(routeContext.access);
        const contract = await archiveLastMileContract(supabaseAdmin, routeContext.businessId, authUser.id, id);

        return apiSuccess({ contract }, {
            requestId,
            code: 'LAST_MILE_CONTRACT_ARCHIVED',
            meta: { businessId: routeContext.businessId, contractId: id },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo archivar contrato de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}
