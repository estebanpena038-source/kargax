import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    assertLastMileManageContracts,
    assertLastMileView,
    createLastMileContract,
    lastMileContractPayloadSchema,
    listLastMileContracts,
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
        const contracts = await listLastMileContracts(supabaseAdmin, context.businessId, {
            status: request.nextUrl.searchParams.get('status'),
            carrierId: request.nextUrl.searchParams.get('carrierId'),
            laneId: request.nextUrl.searchParams.get('laneId'),
        });

        return apiSuccess(contracts, {
            requestId,
            code: 'LAST_MILE_CONTRACTS_LOADED',
            meta: { businessId: context.businessId },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudieron cargar contratos de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);
    if ('response' in auth) return auth.response;

    try {
        const body = await request.json().catch(() => ({}));
        const parsed = lastMileContractPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return apiError('Datos invalidos para crear contrato de margen', {
                status: 400,
                code: 'LAST_MILE_CONTRACT_VALIDATION_ERROR',
                details: parsed.error.issues,
                requestId,
            });
        }

        const { supabaseAdmin, authUser, profile } = auth.context;
        const context = await resolveLastMileRouteContext(supabaseAdmin, authUser.id, profile, parsed.data.businessId);
        assertLastMileManageContracts(context.access);
        const contract = await createLastMileContract(
            supabaseAdmin,
            context.businessId,
            authUser.id,
            context.access,
            parsed.data
        );

        return apiSuccess({ contract }, {
            requestId,
            status: 201,
            code: 'LAST_MILE_CONTRACT_CREATED',
            meta: { businessId: context.businessId },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo crear contrato de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}
