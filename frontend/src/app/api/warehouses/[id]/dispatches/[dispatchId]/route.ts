import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { assertWarehouseCapability, ensureWarehouseAccess } from '@/lib/server/warehouses';

interface RouteContext {
    params: Promise<{ id: string; dispatchId: string }>;
}

const DISPATCH_TRANSITIONS: Record<string, string[]> = {
    draft: ['picking', 'cancelled'],
    picking: ['ready', 'cancelled'],
    ready: ['dispatched', 'cancelled'],
    dispatched: [],
    cancelled: [],
};

export async function PATCH(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id, dispatchId } = await context.params;
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
        assertWarehouseCapability(access, 'manageDispatches', 'This warehouse role cannot update dispatches.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        status?: 'draft' | 'picking' | 'ready' | 'dispatched' | 'cancelled';
        notes?: string;
        scheduledAt?: string | null;
    };

    const { data: dispatchOrder, error: dispatchError } = await supabaseAdmin
        .from('warehouse_dispatch_orders')
        .select('*')
        .eq('id', dispatchId)
        .eq('warehouse_id', id)
        .maybeSingle();

    if (dispatchError || !dispatchOrder) {
        return apiError(dispatchError?.message || 'Dispatch not found', {
            status: 404,
            code: 'WAREHOUSE_DISPATCH_NOT_FOUND',
            requestId,
        });
    }

    const payload: Record<string, unknown> = {};

    if (body.status && body.status !== dispatchOrder.status) {
        const allowed = DISPATCH_TRANSITIONS[dispatchOrder.status] || [];
        if (!allowed.includes(body.status)) {
            return apiError(`Invalid dispatch transition: ${dispatchOrder.status} -> ${body.status}`, {
                status: 409,
                code: 'WAREHOUSE_DISPATCH_INVALID_TRANSITION',
                requestId,
            });
        }

        payload.status = body.status;

        if (body.status === 'dispatched') {
            payload.dispatched_at = new Date().toISOString();
            payload.confirmed_at = new Date().toISOString();
            payload.confirmed_by = authUser.id;
        }
    }

    if (body.notes !== undefined) payload.notes = body.notes?.trim() || null;
    if (body.scheduledAt !== undefined) payload.scheduled_at = body.scheduledAt || null;

    if (!Object.keys(payload).length) {
        return apiError('No dispatch changes provided', {
            status: 400,
            code: 'WAREHOUSE_DISPATCH_EMPTY_PATCH',
            requestId,
        });
    }

    const { data: updatedDispatch, error: updateError } = await supabaseAdmin
        .from('warehouse_dispatch_orders')
        .update(payload)
        .eq('id', dispatchId)
        .eq('warehouse_id', id)
        .select('*')
        .single();

    if (updateError || !updatedDispatch) {
        return apiError(updateError?.message || 'Could not update dispatch', {
            status: 500,
            code: 'WAREHOUSE_DISPATCH_UPDATE_FAILED',
            requestId,
        });
    }

    return apiSuccess(updatedDispatch, {
        code: 'WAREHOUSE_DISPATCH_UPDATED',
        requestId,
        meta: {
            warehouseId: id,
            dispatchId,
        },
    });
}
