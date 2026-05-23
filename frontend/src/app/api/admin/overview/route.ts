import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getAdminOverviewSnapshot } from '@/lib/server/operations';
import { requireAdminRoute } from '@/lib/server/route-auth';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAdminRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const data = await getAdminOverviewSnapshot(auth.context.supabaseAdmin, requestId);
        return apiSuccess(data, {
            requestId,
            code: 'ADMIN_OVERVIEW_READY',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Could not load admin overview', {
            requestId,
            status: 500,
            code: 'ADMIN_OVERVIEW_FAILED',
        });
    }
}
