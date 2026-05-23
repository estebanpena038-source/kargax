import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { assertWarehouseCapability, ensureWarehouseAccess } from '@/lib/server/warehouses';

interface RouteContext {
    params: Promise<{ id: string; receiptId: string }>;
}

const RECEIPT_TRANSITIONS: Record<string, string[]> = {
    draft: ['received', 'cancelled'],
    received: ['closed', 'cancelled'],
    closed: [],
    cancelled: [],
};

export async function PATCH(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id, receiptId } = await context.params;
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
        assertWarehouseCapability(access, 'manageReceipts', 'This warehouse role cannot update receipts.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        status?: 'draft' | 'received' | 'closed' | 'cancelled';
        notes?: string;
    };

    const { data: receipt, error: receiptError } = await supabaseAdmin
        .from('warehouse_receipts')
        .select('*')
        .eq('id', receiptId)
        .eq('warehouse_id', id)
        .maybeSingle();

    if (receiptError || !receipt) {
        return apiError(receiptError?.message || 'Receipt not found', {
            status: 404,
            code: 'WAREHOUSE_RECEIPT_NOT_FOUND',
            requestId,
        });
    }

    const payload: Record<string, unknown> = {};

    if (body.status && body.status !== receipt.status) {
        const allowed = RECEIPT_TRANSITIONS[receipt.status] || [];
        if (!allowed.includes(body.status)) {
            return apiError(`Invalid receipt transition: ${receipt.status} -> ${body.status}`, {
                status: 409,
                code: 'WAREHOUSE_RECEIPT_INVALID_TRANSITION',
                requestId,
            });
        }

        payload.status = body.status;

        if (body.status === 'received') {
            payload.received_at = receipt.received_at || new Date().toISOString();
            payload.received_by = receipt.received_by || authUser.id;
        }
    }

    if (body.notes !== undefined) payload.notes = body.notes?.trim() || null;

    if (!Object.keys(payload).length) {
        return apiError('No receipt changes provided', {
            status: 400,
            code: 'WAREHOUSE_RECEIPT_EMPTY_PATCH',
            requestId,
        });
    }

    const { data: updatedReceipt, error: updateError } = await supabaseAdmin
        .from('warehouse_receipts')
        .update(payload)
        .eq('id', receiptId)
        .eq('warehouse_id', id)
        .select('*')
        .single();

    if (updateError || !updatedReceipt) {
        return apiError(updateError?.message || 'Could not update receipt', {
            status: 500,
            code: 'WAREHOUSE_RECEIPT_UPDATE_FAILED',
            requestId,
        });
    }

    return apiSuccess(updatedReceipt, {
        code: 'WAREHOUSE_RECEIPT_UPDATED',
        requestId,
        meta: {
            warehouseId: id,
            receiptId,
        },
    });
}
