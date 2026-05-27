import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    assertLastMileRenegotiation,
    assertLastMileView,
    createLastMileRenegotiation,
    lastMileRecommendationCreateSchema,
    listLastMileRenegotiations,
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
        const renegotiations = await listLastMileRenegotiations(supabaseAdmin, context.businessId, {
            status: request.nextUrl.searchParams.get('status'),
            severity: request.nextUrl.searchParams.get('severity'),
        });

        return apiSuccess({ renegotiations }, {
            requestId,
            code: 'LAST_MILE_RENEGOTIATIONS_LOADED',
            meta: { businessId: context.businessId },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudieron cargar renegociaciones de margen');
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
        const parsed = lastMileRecommendationCreateSchema.safeParse(body);
        if (!parsed.success) {
            return apiError('Datos invalidos para crear renegociacion', {
                status: 400,
                code: 'LAST_MILE_RENEGOTIATION_VALIDATION_ERROR',
                details: parsed.error.issues,
                requestId,
            });
        }

        const { supabaseAdmin, authUser, profile } = auth.context;
        const context = await resolveLastMileRouteContext(supabaseAdmin, authUser.id, profile, parsed.data.businessId);
        assertLastMileRenegotiation(context.access);
        const renegotiation = await createLastMileRenegotiation(supabaseAdmin, context.businessId, authUser.id, parsed.data);

        return apiSuccess({ renegotiation }, {
            requestId,
            status: 201,
            code: 'LAST_MILE_RENEGOTIATION_CREATED',
            meta: { businessId: context.businessId },
        });
    } catch (error) {
        const mapped = toLastMileError(error, 'No se pudo crear renegociacion de margen');
        return apiError(mapped.message, {
            status: mapped.status,
            code: mapped.code,
            details: mapped.details,
            requestId,
        });
    }
}
