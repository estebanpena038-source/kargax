import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { listPlatformIncidents } from '@/lib/server/operations';
import { requireInternalAdminCapability } from '@/lib/server/internal-admins';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireInternalAdminCapability(request, 'incident:read');

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const data = await listPlatformIncidents(auth.context.supabaseAdmin, {
            status: request.nextUrl.searchParams.get('status'),
            domain: request.nextUrl.searchParams.get('domain'),
            limit: Number(request.nextUrl.searchParams.get('limit') || 50),
        });

        return apiSuccess(data, {
            requestId,
            code: 'ADMIN_INCIDENTS_READY',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Could not load incidents', {
            requestId,
            status: 500,
            code: 'ADMIN_INCIDENTS_FAILED',
        });
    }
}
