import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { applyStockDelta, assertWarehouseCapability, ensureWarehouseAccess } from '@/lib/server/warehouses';

interface RouteContext {
    params: Promise<{ id: string }>;
}

type ReceiptLineRow = Record<string, unknown> & { receipt_id: string };

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

    const { data: receipts, error } = await supabaseAdmin
        .from('warehouse_receipts')
        .select('*')
        .eq('warehouse_id', id)
        .order('received_at', { ascending: false });

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'WAREHOUSE_RECEIPTS_LOAD_FAILED',
            requestId,
        });
    }

    const receiptIds = (receipts || []).map((receipt) => receipt.id);

    const { data: lines } = receiptIds.length
        ? await supabaseAdmin
            .from('warehouse_receipt_lines')
            .select('*, sku:warehouse_skus(*), location:warehouse_locations(*)')
            .in('receipt_id', receiptIds)
        : { data: [] as ReceiptLineRow[] };

    const lineMap = new Map<string, ReceiptLineRow[]>();

    for (const line of lines || []) {
        const current = lineMap.get(line.receipt_id) || [];
        current.push(line);
        lineMap.set(line.receipt_id, current);
    }

    const data = (receipts || []).map((receipt) => ({
        ...receipt,
        lines: lineMap.get(receipt.id) || [],
    }));

    return apiSuccess(data, {
        code: 'WAREHOUSE_RECEIPTS_LOADED',
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
        assertWarehouseCapability(access, 'manageReceipts', 'This warehouse role cannot create receipts.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        receiptNumber?: string;
        offerId?: string;
        clientId?: string;
        appointmentId?: string;
        notes?: string;
        lines?: Array<{
            skuCode: string;
            skuName: string;
            locationCode?: string;
            expectedQty?: number;
            receivedQty: number;
            damagedQty?: number;
        }>;
    };

    if (!body.receiptNumber || !body.lines?.length) {
        return apiError('receiptNumber and at least one line are required', {
            status: 400,
            code: 'WAREHOUSE_RECEIPT_VALIDATION_ERROR',
            requestId,
        });
    }

    try {
        const { data: receipt, error } = await supabaseAdmin
            .from('warehouse_receipts')
            .insert({
                warehouse_id: id,
                offer_id: body.offerId || null,
                client_id: body.clientId || null,
                appointment_id: body.appointmentId || null,
                receipt_number: body.receiptNumber.trim().toUpperCase(),
                status: 'received',
                notes: body.notes || null,
                received_by: authUser.id,
            })
            .select('*')
            .single();

        if (error || !receipt) {
            return apiError(error?.message || 'Could not create receipt', {
                status: 500,
                code: 'WAREHOUSE_RECEIPT_CREATE_FAILED',
                requestId,
            });
        }

        const createdLines: ReceiptLineRow[] = [];

        for (const line of body.lines) {
            const netQty = Math.max(Number(line.receivedQty || 0) - Number(line.damagedQty || 0), 0);

            const balance = await applyStockDelta(supabaseAdmin, {
                warehouseId: id,
                businessId: access.warehouse.business_id,
                skuCode: line.skuCode.trim().toUpperCase(),
                skuName: line.skuName.trim(),
                quantityDelta: netQty,
                locationCode: line.locationCode?.trim().toUpperCase() || 'REC-01',
                locationType: 'receiving',
                movementType: 'receipt',
                referenceType: 'receipt',
                referenceId: receipt.id,
                performedBy: authUser.id,
                notes: body.notes || null,
                metadata: {
                    damagedQty: Number(line.damagedQty || 0),
                    expectedQty: Number(line.expectedQty || 0),
                },
            });

            const { data: receiptLine, error: lineError } = await supabaseAdmin
                .from('warehouse_receipt_lines')
                .insert({
                    receipt_id: receipt.id,
                    sku_id: balance.sku.id,
                    location_id: balance.location?.id || null,
                    sku_code_snapshot: balance.sku.sku_code,
                    sku_name_snapshot: balance.sku.name,
                    expected_qty: Number(line.expectedQty || 0),
                    received_qty: Number(line.receivedQty || 0),
                    damaged_qty: Number(line.damagedQty || 0),
                    metadata: {
                        netQty,
                    },
                })
                .select('*, sku:warehouse_skus(*), location:warehouse_locations(*)')
                .single();

            if (lineError || !receiptLine) {
                return apiError(lineError?.message || 'Could not create receipt line', {
                    status: 500,
                    code: 'WAREHOUSE_RECEIPT_LINE_CREATE_FAILED',
                    requestId,
                });
            }

            createdLines.push(receiptLine as ReceiptLineRow);
        }

        return apiSuccess({
            ...receipt,
            lines: createdLines,
        }, {
            status: 201,
            code: 'WAREHOUSE_RECEIPT_CREATED',
            requestId,
            meta: {
                warehouseId: id,
                receiptId: receipt.id,
            },
        });
    } catch (error) {
        console.error('[Warehouse receipts][POST]', error);
        return apiError(error instanceof Error ? error.message : 'Could not create receipt', {
            status: 400,
            code: 'WAREHOUSE_RECEIPT_CREATE_FAILED',
            requestId,
        });
    }
}
