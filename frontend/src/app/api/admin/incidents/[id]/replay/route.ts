import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { executeReplayAction } from '@/lib/server/replay-actions';
import { getPlatformIncident, recordCriticalOperation } from '@/lib/server/operations';
import { requireAdminRoute } from '@/lib/server/route-auth';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAdminRoute(request, { requireAal2: true });

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { id } = await context.params;
        const incident = await getPlatformIncident(auth.context.supabaseAdmin, id);

        if (!incident) {
            return apiError('Incident not found', {
                requestId,
                status: 404,
                code: 'INCIDENT_NOT_FOUND',
            });
        }

        const replay = await executeReplayAction(
            auth.context.supabaseAdmin,
            incident,
            auth.context.authUser.id,
            requestId
        );

        await auth.context.supabaseAdmin
            .from('platform_incidents')
            .update({
                status: 'resolved',
                updated_at: new Date().toISOString(),
                resolved_at: new Date().toISOString(),
                resolved_by: auth.context.authUser.id,
                metadata: {
                    ...(incident.metadata || {}),
                    replayed_at: new Date().toISOString(),
                    replayed_by: auth.context.authUser.id,
                    replay_request_id: requestId,
                    replay_result: replay,
                },
            })
            .eq('id', incident.id);

        await recordCriticalOperation(auth.context.supabaseAdmin, {
            requestId,
            actorUserId: auth.context.authUser.id,
            actorType: 'admin',
            domain: 'platform',
            action: 'incident_replayed',
            entityType: 'platform_incident',
            entityId: incident.id,
            businessId: incident.business_id,
            holdingAccountId: incident.holding_account_id,
            countryCode: incident.country_code,
            status: 'success',
            replayable: false,
            sourceReference: incident.source_reference || incident.id,
            metadata: {
                incident_id: incident.id,
                replay_action: incident.replay_action,
                replay_request_id: requestId,
            },
        });

        return apiSuccess({
            incidentId: incident.id,
            replayAction: incident.replay_action,
            replay,
        }, {
            requestId,
            code: 'INCIDENT_REPLAYED',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Could not replay incident', {
            requestId,
            status: 500,
            code: 'INCIDENT_REPLAY_FAILED',
        });
    }
}
