import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { assertWarehouseCapability, createWarehouseIncidentNotification, ensureWarehouseAccess } from '@/lib/server/warehouses';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const { supabaseAdmin, authUser, profile } = auth.context;
    const access = await ensureWarehouseAccess(supabaseAdmin, authUser.id, profile, id);

    if (!access) {
        return apiError('Warehouse not found or access denied', {
            status: 404,
            code: 'WAREHOUSE_ACCESS_DENIED',
            requestId,
        });
    }

    const { data, error } = await supabaseAdmin
        .from('warehouse_incidents')
        .select('*')
        .eq('warehouse_id', id)
        .order('created_at', { ascending: false });

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'WAREHOUSE_INCIDENTS_LOAD_FAILED',
            requestId,
        });
    }

    return apiSuccess(data || [], {
        code: 'WAREHOUSE_INCIDENTS_LOADED',
        requestId,
        meta: {
            warehouseId: id,
        },
    });
}

export async function POST(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
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
        assertWarehouseCapability(access, 'manageIncidents', 'This warehouse role cannot create incidents.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        offerId?: string;
        appointmentId?: string;
        taskId?: string;
        incidentType?: 'damage' | 'shortage' | 'delay' | 'security' | 'documentation' | 'payment_hold' | 'other';
        severity?: 'low' | 'medium' | 'high' | 'critical';
        status?: 'open' | 'investigating' | 'resolved' | 'closed';
        title?: string;
        description?: string;
        evidenceUrls?: string[];
        metadata?: Record<string, unknown>;
    };

    if (!body.incidentType || !body.title || !body.description) {
        return apiError('incidentType, title and description are required', {
            status: 400,
            code: 'WAREHOUSE_INCIDENT_VALIDATION_ERROR',
            requestId,
        });
    }

    const { data, error } = await supabaseAdmin
        .from('warehouse_incidents')
        .insert({
            warehouse_id: id,
            offer_id: body.offerId || null,
            appointment_id: body.appointmentId || null,
            task_id: body.taskId || null,
            incident_type: body.incidentType,
            severity: body.severity || 'medium',
            status: body.status || 'open',
            title: body.title.trim(),
            description: body.description.trim(),
            evidence_urls: body.evidenceUrls || [],
            metadata: body.metadata || {},
            reported_by: authUser.id,
        })
        .select('*')
        .single();

    if (error || !data) {
        return apiError(error?.message || 'Could not create incident', {
            status: 500,
            code: 'WAREHOUSE_INCIDENT_CREATE_FAILED',
            requestId,
        });
    }

    await createWarehouseIncidentNotification(supabaseAdmin, {
        warehouseId: id,
        warehouseName: access.warehouse.name,
        incidentId: data.id,
        title: data.title,
        severity: data.severity,
        offerId: data.offer_id,
    });

    if (body.taskId) {
        await supabaseAdmin
            .from('warehouse_tasks')
            .update({
                status: 'blocked',
                metadata: {
                    blockedByIncidentId: data.id,
                },
            })
            .eq('id', body.taskId);
    }

    return apiSuccess(data, {
        status: 201,
        code: 'WAREHOUSE_INCIDENT_CREATED',
        requestId,
        meta: {
            warehouseId: id,
            incidentId: data.id,
        },
    });
}
