import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getPlatformIncident } from '@/lib/server/operations';
import { requireInternalAdminCapability } from '@/lib/server/internal-admins';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireInternalAdminCapability(request, 'incident:read');

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { id } = await context.params;
        const data = await getPlatformIncident(auth.context.supabaseAdmin, id);

        if (!data) {
            return apiError('Incident not found', {
                requestId,
                status: 404,
                code: 'INCIDENT_NOT_FOUND',
            });
        }

        return apiSuccess(data, {
            requestId,
            code: 'ADMIN_INCIDENT_READY',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Could not load incident', {
            requestId,
            status: 500,
            code: 'ADMIN_INCIDENT_FAILED',
        });
    }
}
