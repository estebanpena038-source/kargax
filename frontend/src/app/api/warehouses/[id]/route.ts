import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    assertWarehouseCapability,
    enforceWarehouseActivationLimit,
    ensureWarehouseAccess,
    getBusinessPlanSnapshot,
    getPlanLimitErrorDetails,
    isPlanLimitError,
} from '@/lib/server/warehouses';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const params = await context.params;
    const warehouseId = params.id;
    const { supabaseAdmin, authUser, profile } = auth.context;

    try {
        const access = await ensureWarehouseAccess(supabaseAdmin, authUser.id, profile, warehouseId);

        if (!access) {
            return apiError('Warehouse not found or access denied', {
                status: 404,
                code: 'WAREHOUSE_ACCESS_DENIED',
                requestId,
            });
        }

        const [appointments, docks, stockBalances, tasks, incidents, receipts, dispatches, snapshot] = await Promise.all([
            supabaseAdmin.from('warehouse_appointments').select('id').eq('warehouse_id', warehouseId),
            supabaseAdmin.from('warehouse_docks').select('id').eq('warehouse_id', warehouseId),
            supabaseAdmin.from('warehouse_stock_balances').select('quantity_on_hand').eq('warehouse_id', warehouseId),
            supabaseAdmin.from('warehouse_tasks').select('id, status').eq('warehouse_id', warehouseId),
            supabaseAdmin.from('warehouse_incidents').select('id, status').eq('warehouse_id', warehouseId),
            supabaseAdmin.from('warehouse_receipts').select('id').eq('warehouse_id', warehouseId),
            supabaseAdmin.from('warehouse_dispatch_orders').select('id').eq('warehouse_id', warehouseId),
            getBusinessPlanSnapshot(supabaseAdmin, access.warehouse.business_id),
        ]);

        const stockUnits = (stockBalances.data || []).reduce(
            (sum, item) => sum + Number(item.quantity_on_hand || 0),
            0
        );

        const warehouse = {
            ...access.warehouse,
            summary: {
                appointments: (appointments.data || []).length,
                docks: (docks.data || []).length,
                skuCount: (stockBalances.data || []).length,
                stockUnits,
                openTasks: (tasks.data || []).filter((item) => item.status === 'open' || item.status === 'in_progress').length,
                openIncidents: (incidents.data || []).filter((item) => item.status !== 'closed' && item.status !== 'resolved').length,
                receipts: (receipts.data || []).length,
                dispatches: (dispatches.data || []).length,
            },
        };

        return apiSuccess({
            warehouse,
            role: access.membershipRole,
            capabilities: access.capabilities,
            plans: snapshot.plans,
            subscription: snapshot.subscription,
        }, {
            code: 'WAREHOUSE_DETAIL_LOADED',
            requestId,
            meta: {
                warehouseId,
            },
        });
    } catch (error) {
        console.error('[Warehouse][GET]', error);
        return apiError('Internal server error', {
            status: 500,
            code: 'WAREHOUSE_DETAIL_LOAD_FAILED',
            requestId,
        });
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const params = await context.params;
    const warehouseId = params.id;
    const { supabaseAdmin, authUser, profile } = auth.context;

    try {
        const access = await ensureWarehouseAccess(supabaseAdmin, authUser.id, profile, warehouseId);

        if (!access) {
            return apiError('Warehouse not found or access denied', {
                status: 404,
                code: 'WAREHOUSE_ACCESS_DENIED',
                requestId,
            });
        }

        try {
            assertWarehouseCapability(
                access,
                'manageWarehouseSettings',
                'This warehouse role cannot update settings.'
            );
        } catch (error) {
            return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
                status: 403,
                code: 'WAREHOUSE_CAPABILITY_DENIED',
                requestId,
            });
        }

        const body = (await request.json()) as {
            code?: string;
            name?: string;
            description?: string;
            department?: string;
            city?: string;
            address?: string;
            timezone?: string;
            status?: 'active' | 'inactive' | 'maintenance';
            flowMode?: 'manual' | 'warehouse_managed' | '3pl';
            notes?: string;
        };

        const payload: Record<string, unknown> = {};

        if (body.code !== undefined) payload.code = body.code.trim().toUpperCase();
        if (body.name !== undefined) payload.name = body.name.trim();
        if (body.description !== undefined) payload.description = body.description?.trim() || null;
        if (body.department !== undefined) payload.department = body.department.trim();
        if (body.city !== undefined) payload.city = body.city.trim();
        if (body.address !== undefined) payload.address = body.address.trim();
        if (body.timezone !== undefined) payload.timezone = body.timezone.trim();
        if (body.status !== undefined) payload.status = body.status;
        if (body.flowMode !== undefined) payload.flow_mode = body.flowMode;
        if (body.notes !== undefined) payload.notes = body.notes?.trim() || null;

        if (
            body.status === 'active' &&
            access.warehouse.status !== 'active' &&
            !access.isAdmin
        ) {
            await enforceWarehouseActivationLimit(supabaseAdmin, access.warehouse.business_id);
        }

        const { data: warehouse, error } = await supabaseAdmin
            .from('warehouses')
            .update(payload)
            .eq('id', warehouseId)
            .select('*')
            .single();

        if (error || !warehouse) {
            return apiError(error?.message || 'Could not update warehouse', {
                status: 500,
                code: 'WAREHOUSE_UPDATE_FAILED',
                requestId,
            });
        }

        return apiSuccess(warehouse, {
            code: 'WAREHOUSE_UPDATED',
            requestId,
            meta: {
                warehouseId,
            },
        });
    } catch (error) {
        console.error('[Warehouse][PATCH]', error);
        if (isPlanLimitError(error)) {
            return apiError(error.message, {
                status: 402,
                code: 'PLAN_LIMIT_REACHED',
                requestId,
                details: getPlanLimitErrorDetails(error),
            });
        }

        return apiError(error instanceof Error ? error.message : 'Internal server error', {
            status: 500,
            code: 'WAREHOUSE_UPDATE_FAILED',
            requestId,
        });
    }
}
