import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { assertWarehouseCapability, ensureWarehouseAccess } from '@/lib/server/warehouses';

interface RouteContext {
    params: Promise<{ id: string; incidentId: string }>;
}

const INCIDENT_TRANSITIONS: Record<string, string[]> = {
    open: ['investigating', 'resolved', 'closed'],
    investigating: ['resolved', 'closed'],
    resolved: ['closed'],
    closed: [],
};

export async function PATCH(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id, incidentId } = await context.params;
    const { supabaseAdmin, authUser, profile } = auth.context;
    const access = await ensureWarehouseAccess(supabaseAdmin, authUser.id, profile, id);

    if (!access) {
        return apiError('Warehouse not found or access denied', {
            status: 404,
            code: 'WAREHOUSE_ACCESS_DENIED',
            requestId,
        });
    }

    try {
        assertWarehouseCapability(access, 'manageIncidents', 'This warehouse role cannot update incidents.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        status?: 'open' | 'investigating' | 'resolved' | 'closed';
        description?: string;
        evidenceUrls?: string[];
        metadata?: Record<string, unknown>;
    };

    const { data: incident, error: incidentError } = await supabaseAdmin
        .from('warehouse_incidents')
        .select('*')
        .eq('id', incidentId)
        .eq('warehouse_id', id)
        .maybeSingle();

    if (incidentError || !incident) {
        return apiError(incidentError?.message || 'Incident not found', {
            status: 404,
            code: 'WAREHOUSE_INCIDENT_NOT_FOUND',
            requestId,
        });
    }

    const payload: Record<string, unknown> = {};

    if (body.status && body.status !== incident.status) {
        const allowed = INCIDENT_TRANSITIONS[incident.status] || [];
        if (!allowed.includes(body.status)) {
            return apiError(`Invalid incident transition: ${incident.status} -> ${body.status}`, {
                status: 409,
                code: 'WAREHOUSE_INCIDENT_INVALID_TRANSITION',
                requestId,
            });
        }

        payload.status = body.status;

        if (body.status === 'resolved' || body.status === 'closed') {
            payload.resolved_at = incident.resolved_at || new Date().toISOString();
            payload.resolved_by = incident.resolved_by || authUser.id;
        }
    }

    if (body.description !== undefined) payload.description = body.description.trim();
    if (body.evidenceUrls !== undefined) payload.evidence_urls = body.evidenceUrls;
    if (body.metadata !== undefined) payload.metadata = body.metadata || {};

    if (!Object.keys(payload).length) {
        return apiError('No incident changes provided', {
            status: 400,
            code: 'WAREHOUSE_INCIDENT_EMPTY_PATCH',
            requestId,
        });
    }

    const { data: updatedIncident, error: updateError } = await supabaseAdmin
        .from('warehouse_incidents')
        .update(payload)
        .eq('id', incidentId)
        .eq('warehouse_id', id)
        .select('*')
        .single();

    if (updateError || !updatedIncident) {
        return apiError(updateError?.message || 'Could not update incident', {
            status: 500,
            code: 'WAREHOUSE_INCIDENT_UPDATE_FAILED',
            requestId,
        });
    }

    if (updatedIncident.task_id && (updatedIncident.status === 'resolved' || updatedIncident.status === 'closed')) {
        await supabaseAdmin
            .from('warehouse_tasks')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', updatedIncident.task_id)
            .eq('warehouse_id', id)
            .in('status', ['open', 'in_progress', 'blocked']);
    }

    return apiSuccess(updatedIncident, {
        code: 'WAREHOUSE_INCIDENT_UPDATED',
        requestId,
        meta: {
            warehouseId: id,
            incidentId,
        },
    });
}
