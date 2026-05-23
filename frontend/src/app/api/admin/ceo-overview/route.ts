import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getCeoOverviewSnapshot } from '@/lib/server/operations';
import { requireFounderCeoRoute } from '@/lib/server/route-auth';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireFounderCeoRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const data = await getCeoOverviewSnapshot(auth.context.supabaseAdmin, requestId);
        return apiSuccess(data, {
            requestId,
            code: 'CEO_OVERVIEW_READY',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Could not load CEO overview', {
            requestId,
            status: 500,
            code: 'CEO_OVERVIEW_FAILED',
        });
    }
}
