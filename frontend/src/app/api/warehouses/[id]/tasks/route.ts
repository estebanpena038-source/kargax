import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { assertWarehouseCapability, ensureWarehouseAccess } from '@/lib/server/warehouses';

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
        .from('warehouse_tasks')
        .select('*')
        .eq('warehouse_id', id)
        .order('created_at', { ascending: false });

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'WAREHOUSE_TASKS_LOAD_FAILED',
            requestId,
        });
    }

    return apiSuccess(data || [], {
        code: 'WAREHOUSE_TASKS_LOADED',
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
        assertWarehouseCapability(access, 'manageTasks', 'This warehouse role cannot create tasks.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        appointmentId?: string;
        offerId?: string;
        taskType?: 'check_in' | 'loading' | 'picking' | 'dispatch' | 'receiving' | 'inspection' | 'incident_followup';
        status?: 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
        title?: string;
        description?: string;
        assignedTo?: string;
        dueAt?: string;
        metadata?: Record<string, unknown>;
    };

    if (!body.taskType || !body.title) {
        return apiError('taskType and title are required', {
            status: 400,
            code: 'WAREHOUSE_TASK_VALIDATION_ERROR',
            requestId,
        });
    }

    const { data, error } = await supabaseAdmin
        .from('warehouse_tasks')
        .insert({
            warehouse_id: id,
            appointment_id: body.appointmentId || null,
            offer_id: body.offerId || null,
            task_type: body.taskType,
            status: body.status || 'open',
            title: body.title.trim(),
            description: body.description?.trim() || null,
            assigned_to: body.assignedTo || null,
            due_at: body.dueAt || null,
            created_by: authUser.id,
            metadata: body.metadata || {},
        })
        .select('*')
        .single();

    if (error || !data) {
        return apiError(error?.message || 'Could not create task', {
            status: 500,
            code: 'WAREHOUSE_TASK_CREATE_FAILED',
            requestId,
        });
    }

    return apiSuccess(data, {
        status: 201,
        code: 'WAREHOUSE_TASK_CREATED',
        requestId,
        meta: {
            warehouseId: id,
        },
    });
}
