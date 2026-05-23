import { NextRequest } from 'next/server';
import { apiSuccess, getRequestId } from '@/lib/server/api-response';
import { isFounderCeoAllowed, requireAdminRoute } from '@/lib/server/route-auth';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAdminRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    return apiSuccess({
        allowed: isFounderCeoAllowed(auth.context),
    }, {
        requestId,
        code: 'CEO_ACCESS_RESOLVED',
    });
}
