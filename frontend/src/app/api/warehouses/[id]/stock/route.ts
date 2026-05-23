import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { applyStockDelta, assertWarehouseCapability, ensureWarehouseAccess, enforcePlanFeature } from '@/lib/server/warehouses';

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
        .from('warehouse_stock_balances')
        .select('*, sku:warehouse_skus(*, images:warehouse_sku_images(*)), location:warehouse_locations(*)')
        .eq('warehouse_id', id)
        .order('updated_at', { ascending: false });

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'WAREHOUSE_STOCK_LOAD_FAILED',
            requestId,
        });
    }

    return apiSuccess(data || [], {
        code: 'WAREHOUSE_STOCK_LOADED',
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
        assertWarehouseCapability(
            access,
            'manageInventoryAdjustments',
            'This warehouse role cannot post manual stock adjustments.'
        );
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        skuCode?: string;
        skuName?: string;
        quantityDelta?: number;
        locationCode?: string;
        locationType?: 'receiving' | 'storage' | 'picking' | 'dispatch' | 'quarantine';
        lotCode?: string;
        expiresAt?: string;
        notes?: string;
    };

    if (!body.skuCode || !body.skuName || typeof body.quantityDelta !== 'number' || body.quantityDelta === 0) {
        return apiError('skuCode, skuName and a non-zero quantityDelta are required', {
            status: 400,
            code: 'WAREHOUSE_STOCK_VALIDATION_ERROR',
            requestId,
        });
    }

    try {
        await enforcePlanFeature(supabaseAdmin, access.warehouse.business_id, 'includes_inventory');

        const data = await applyStockDelta(supabaseAdmin, {
            warehouseId: id,
            businessId: access.warehouse.business_id,
            skuCode: body.skuCode.trim().toUpperCase(),
            skuName: body.skuName.trim(),
            quantityDelta: body.quantityDelta,
            locationCode: body.locationCode?.trim().toUpperCase() || null,
            locationType: body.locationType || 'storage',
            lotCode: body.lotCode?.trim() || null,
            expiresAt: body.expiresAt || null,
            movementType: 'adjustment',
            referenceType: 'manual_adjustment',
            referenceId: null,
            performedBy: authUser.id,
            notes: body.notes || null,
            metadata: {
                source: 'warehouse_stock_api',
            },
        });

        return apiSuccess(data, {
            status: 201,
            code: 'WAREHOUSE_STOCK_ADJUSTED',
            requestId,
            meta: {
                warehouseId: id,
            },
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Could not update stock', {
            status: 400,
            code: 'WAREHOUSE_STOCK_ADJUST_FAILED',
            requestId,
        });
    }
}
