import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { assertWarehouseCapability, ensureWarehouseAccess } from '@/lib/server/warehouses';

interface RouteContext {
    params: Promise<{ id: string; taskId: string }>;
}

const TASK_TRANSITIONS: Record<string, string[]> = {
    open: ['in_progress', 'blocked', 'completed', 'cancelled'],
    in_progress: ['blocked', 'completed', 'cancelled'],
    blocked: ['in_progress', 'completed', 'cancelled'],
    completed: [],
    cancelled: [],
};

export async function PATCH(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id, taskId } = await context.params;
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
        assertWarehouseCapability(access, 'manageTasks', 'This warehouse role cannot update tasks.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        status?: 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
        assignedTo?: string | null;
        description?: string;
        dueAt?: string | null;
        metadata?: Record<string, unknown>;
    };

    const { data: task, error: taskError } = await supabaseAdmin
        .from('warehouse_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('warehouse_id', id)
        .maybeSingle();

    if (taskError || !task) {
        return apiError(taskError?.message || 'Task not found', {
            status: 404,
            code: 'WAREHOUSE_TASK_NOT_FOUND',
            requestId,
        });
    }

    const payload: Record<string, unknown> = {};

    if (body.status && body.status !== task.status) {
        const allowed = TASK_TRANSITIONS[task.status] || [];
        if (!allowed.includes(body.status)) {
            return apiError(`Invalid task transition: ${task.status} -> ${body.status}`, {
                status: 409,
                code: 'WAREHOUSE_TASK_INVALID_TRANSITION',
                requestId,
            });
        }

        payload.status = body.status;
        payload.completed_at = body.status === 'completed' ? new Date().toISOString() : null;
    }

    if (body.assignedTo !== undefined) payload.assigned_to = body.assignedTo || null;
    if (body.description !== undefined) payload.description = body.description?.trim() || null;
    if (body.dueAt !== undefined) payload.due_at = body.dueAt || null;
    if (body.metadata !== undefined) payload.metadata = body.metadata || {};

    if (!Object.keys(payload).length) {
        return apiError('No task changes provided', {
            status: 400,
            code: 'WAREHOUSE_TASK_EMPTY_PATCH',
            requestId,
        });
    }

    const { data: updatedTask, error: updateError } = await supabaseAdmin
        .from('warehouse_tasks')
        .update(payload)
        .eq('id', taskId)
        .eq('warehouse_id', id)
        .select('*')
        .single();

    if (updateError || !updatedTask) {
        return apiError(updateError?.message || 'Could not update task', {
            status: 500,
            code: 'WAREHOUSE_TASK_UPDATE_FAILED',
            requestId,
        });
    }

    return apiSuccess(updatedTask, {
        code: 'WAREHOUSE_TASK_UPDATED',
        requestId,
        meta: {
            warehouseId: id,
            taskId,
        },
    });
}
