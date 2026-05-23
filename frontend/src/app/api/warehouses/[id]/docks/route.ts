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
        .from('warehouse_docks')
        .select('*')
        .eq('warehouse_id', id)
        .order('is_default', { ascending: false })
        .order('code', { ascending: true });

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'WAREHOUSE_DOCKS_LOAD_FAILED',
            requestId,
        });
    }

    return apiSuccess(data || [], {
        code: 'WAREHOUSE_DOCKS_LOADED',
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
        assertWarehouseCapability(access, 'manageDocks', 'This warehouse role cannot create docks.');
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
        dockType?: 'loading' | 'unloading' | 'mixed';
        status?: 'available' | 'occupied' | 'maintenance';
        isDefault?: boolean;
    };

    if (!body.code || !body.name) {
        return apiError('code and name are required', {
            status: 400,
            code: 'WAREHOUSE_DOCK_VALIDATION_ERROR',
            requestId,
        });
    }

    if (body.isDefault) {
        await supabaseAdmin
            .from('warehouse_docks')
            .update({ is_default: false })
            .eq('warehouse_id', id);
    }

    const { data, error } = await supabaseAdmin
        .from('warehouse_docks')
        .insert({
            warehouse_id: id,
            code: body.code.trim().toUpperCase(),
            name: body.name.trim(),
            dock_type: body.dockType || 'mixed',
            status: body.status || 'available',
            is_default: body.isDefault || false,
        })
        .select('*')
        .single();

    if (error || !data) {
        return apiError(error?.message || 'Could not create dock', {
            status: 500,
            code: 'WAREHOUSE_DOCK_CREATE_FAILED',
            requestId,
        });
    }

    return apiSuccess(data, {
        status: 201,
        code: 'WAREHOUSE_DOCK_CREATED',
        requestId,
        meta: {
            warehouseId: id,
        },
    });
}
