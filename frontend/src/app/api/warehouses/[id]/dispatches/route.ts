import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    applyStockDelta,
    assertWarehouseCapability,
    enforceMonthlyTripLimit,
    ensureWarehouseAccess,
    getPlanLimitErrorDetails,
    isPlanLimitError,
} from '@/lib/server/warehouses';
import { normalizePhoneForNotification } from '@/lib/phone/andean';

interface RouteContext {
    params: Promise<{ id: string }>;
}

type DispatchLineRow = Record<string, unknown> & { dispatch_order_id: string };

type PrivateTripDetails = {
    offerId?: string;
    assignmentMode?: 'public' | 'private';
    privateFleetTruckerId?: string;
    compensationMode?: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses';
    expensesReleasePolicy?: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual';
    freightPaymentAmount?: number;
    expenseAllowanceAmount?: number;
    originAddress?: string;
    pickupContactName?: string;
    pickupContactPhone?: string;
    deliveryContactName?: string;
    deliveryContactPhone?: string;
    destinationType?: 'final_customer' | 'warehouse';
    destinationWarehouseId?: string;
    destinationAddress?: string;
    destinationCity?: string;
    destinationDepartment?: string;
    destinationLatitude?: number | null;
    destinationLongitude?: number | null;
    vehicleType?: string;
    deliveryAt?: string;
};

type CreatedOfferResponse = {
    success?: boolean;
    data?: {
        id?: string;
        status?: string;
        assigned_trucker_id?: string | null;
        private_fleet_trucker_id?: string | null;
        is_private_fleet?: boolean;
    };
    error?: string | { message?: string };
    message?: string;
};

function getApiErrorMessage(payload: CreatedOfferResponse, fallback: string) {
    if (typeof payload.error === 'string') return payload.error;
    if (payload.error?.message) return payload.error.message;
    if (payload.message) return payload.message;
    return fallback;
}

function toLocalDateTimeParts(value: string | undefined, fallback: Date) {
    if (value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
        return {
            date: value.slice(0, 10),
            time: value.slice(11, 16),
            dateValue: new Date(value),
        };
    }

    return {
        date: fallback.toISOString().slice(0, 10),
        time: fallback.toISOString().slice(11, 16),
        dateValue: fallback,
    };
}

function addHours(base: Date, hours: number) {
    const next = new Date(base);
    next.setHours(next.getHours() + hours);
    return next;
}

function resolveProfileCountryCode(profile: unknown) {
    if (profile && typeof profile === 'object') {
        const value = (profile as { country_code?: unknown; country?: unknown }).country_code
            || (profile as { country_code?: unknown; country?: unknown }).country;

        if (value === 'CO' || value === 'EC' || value === 'PE' || value === 'BR') {
            return value;
        }
    }

    return 'CO';
}

function toOptionalCoordinate(value: unknown) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return undefined;
    }

    const coordinate = Number(value);
    return Number.isFinite(coordinate) && coordinate !== 0 ? coordinate : undefined;
}

function buildServerDispatchNumber() {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `DSP-${stamp}-${suffix}`;
}

function normalizeDispatchNumber(value: string | undefined) {
    return value?.trim().toUpperCase() || buildServerDispatchNumber();
}

function dispatchNumberForAttempt(base: string, attempt: number) {
    if (attempt === 0) return base;
    return `${base}-${attempt + 1}`;
}

function isDuplicateDispatchNumberError(error: unknown) {
    const details = error as { code?: string; message?: string } | null;
    return details?.code === '23505'
        || /warehouse_dispatch_orders_warehouse_id_dispatch_number_key/i.test(details?.message || '');
}

async function createPrivateFleetOfferFromDispatch(
    request: NextRequest,
    payload: {
        warehouseId: string;
        warehouse: Record<string, unknown>;
        dispatchId: string;
        dispatchNumber: string;
        scheduledAt?: string;
        notes?: string;
        tripDetails: PrivateTripDetails;
    lines: Array<{
            skuCode: string;
            skuName: string;
            requestedQty: number;
            pickedQty?: number;
            dispatchedQty?: number;
            rejectedQty?: number;
    }>;
    destinationWarehouse?: Record<string, unknown> | null;
    }
) {
    const pickupFallback = payload.scheduledAt ? new Date(payload.scheduledAt) : new Date();
    const pickupStart = toLocalDateTimeParts(payload.scheduledAt, pickupFallback);
    const pickupEnd = toLocalDateTimeParts(undefined, addHours(pickupStart.dateValue, 2));
    const deliveryStart = toLocalDateTimeParts(payload.tripDetails.deliveryAt, addHours(pickupStart.dateValue, 8));
    const deliveryEnd = toLocalDateTimeParts(undefined, addHours(deliveryStart.dateValue, 2));
    const manifestItems = payload.lines.map((line, index) => ({
        id: `dispatch-${payload.dispatchNumber}-${index + 1}`,
        name: `${line.skuCode} - ${line.skuName}`,
        quantity: Math.max(1, Number(line.dispatchedQty || line.pickedQty || line.requestedQty || 1)),
        reference: line.skuCode,
        description: `Despacho ${payload.dispatchNumber}`,
    }));
    const manifestDescription = manifestItems
        .map((item) => `${item.quantity} x ${item.name}`)
        .join(', ')
        .slice(0, 900);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    const authorization = request.headers.get('authorization');
    const cookie = request.headers.get('cookie');

    if (authorization) headers.Authorization = authorization;
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(new URL('/api/offers', request.url), {
        method: 'POST',
        headers,
        body: JSON.stringify({
            cargoType: 'GENERAL',
            cargoDescription: manifestDescription || `Despacho ${payload.dispatchNumber}`,
            quantity: manifestItems.reduce((sum, item) => sum + item.quantity, 0) || 1,
            originDepartment: String(payload.warehouse.department || ''),
            originCity: String(payload.warehouse.city || ''),
            originAddress: String(payload.warehouse.address || payload.warehouse.name || ''),
            originLatitude: toOptionalCoordinate(payload.warehouse.latitude),
            originLongitude: toOptionalCoordinate(payload.warehouse.longitude),
            destinationDepartment: payload.tripDetails.destinationDepartment || String(payload.warehouse.department || ''),
            destinationCity: payload.tripDetails.destinationCity || String(payload.warehouse.city || ''),
            destinationAddress: payload.tripDetails.destinationAddress || 'Destino operativo por confirmar',
            destinationLatitude: payload.tripDetails.destinationLatitude,
            destinationLongitude: payload.tripDetails.destinationLongitude,
            pickupDate: pickupStart.date,
            pickupTimeStart: pickupStart.time,
            pickupTimeEnd: pickupEnd.time,
            deliveryDate: deliveryStart.date,
            deliveryTimeStart: deliveryStart.time,
            deliveryTimeEnd: deliveryEnd.time,
            totalAmount: Number(payload.tripDetails.freightPaymentAmount || 0),
            paymentMethod: 'bank_transfer',
            paymentSchedule: 'on_delivery',
            additionalTerms: [
                `Creado desde despacho ${payload.dispatchNumber}`,
                payload.notes,
            ].filter(Boolean).join('. '),
            vehicleType: payload.tripDetails.vehicleType || 'TURBO',
            minExperienceYears: 1,
            insuranceRequired: true,
            additionalRequirements: 'Ruta asignada por flota privada empresarial.',
            publishImmediately: true,
            manifestItems,
            pickupContactName: payload.tripDetails.pickupContactName,
            pickupContactPhone: payload.tripDetails.pickupContactPhone,
            deliveryContactName: payload.tripDetails.deliveryContactName,
            deliveryContactPhone: payload.tripDetails.deliveryContactPhone,
            warehouseFlowMode: 'warehouse_managed',
            originWarehouseId: payload.warehouseId,
            destinationWarehouseId: payload.tripDetails.destinationType === 'warehouse'
                ? payload.tripDetails.destinationWarehouseId
                : undefined,
            assignmentMode: 'private',
            privateFleetTruckerId: payload.tripDetails.privateFleetTruckerId,
            compensationMode: payload.tripDetails.compensationMode || 'salary_no_trip_pay',
            expensesReleasePolicy: payload.tripDetails.expensesReleasePolicy || 'acceptance',
            expenseAllowanceAmount: Number(payload.tripDetails.expenseAllowanceAmount || 0),
            freightPaymentAmount: Number(payload.tripDetails.freightPaymentAmount || 0),
            privateFleetNotes: payload.notes || `Despacho ${payload.dispatchNumber}`,
            sourceDispatchId: payload.dispatchId,
            dispatchTripMode: 'private_fleet_trip',
            metadata: {
                destinationType: payload.tripDetails.destinationType || 'final_customer',
                destinationWarehouseId: payload.tripDetails.destinationWarehouseId || null,
                destinationWarehouseName: payload.destinationWarehouse?.name || null,
            },
        }),
    });

    const json = await response.json().catch(() => ({})) as CreatedOfferResponse;

    if (!response.ok || !json.data?.id) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear el viaje privado desde el despacho'));
    }

    return json.data;
}

async function createPendingTransferReceipt(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabaseAdmin: any,
    payload: {
        destinationWarehouseId: string;
        offerId: string;
        dispatchId: string;
        dispatchNumber: string;
        notes?: string;
        lines: DispatchLineRow[];
    }
) {
    const receiptNumberBase = `TRF-${payload.dispatchNumber}`.slice(0, 80);
    let receipt: Record<string, unknown> | null = null;
    let receiptError: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const receiptNumber = attempt === 0 ? receiptNumberBase : `${receiptNumberBase}-${attempt + 1}`;
        const { data, error } = await supabaseAdmin
            .from('warehouse_receipts')
            .insert({
                warehouse_id: payload.destinationWarehouseId,
                offer_id: payload.offerId,
                receipt_number: receiptNumber,
                status: 'draft',
                notes: [
                    `Recepcion pendiente creada automaticamente desde despacho ${payload.dispatchNumber}`,
                    payload.notes,
                ].filter(Boolean).join('. '),
                received_by: null,
            })
            .select('*')
            .single();

        if (!error && data) {
            receipt = data as Record<string, unknown>;
            receiptError = null;
            break;
        }

        receiptError = error as { code?: string; message?: string } | null;
        if (receiptError?.code !== '23505') break;
    }

    if (receiptError || !receipt?.id) {
        throw new Error(receiptError?.message || 'No se pudo crear la recepcion pendiente en bodega destino');
    }

    const receiptLines = payload.lines.map((line) => ({
        receipt_id: receipt.id,
        sku_id: null,
        location_id: null,
        sku_code_snapshot: String(line.sku_code_snapshot || '').trim().toUpperCase(),
        sku_name_snapshot: String(line.sku_name_snapshot || '').trim(),
        expected_qty: Number(line.dispatched_qty || 0),
        received_qty: 0,
        damaged_qty: 0,
        metadata: {
            source: 'warehouse_transfer',
            sourceDispatchId: payload.dispatchId,
            sourceDispatchLineId: line.id || null,
            pendingDestinationConfirmation: true,
        },
    }));

    const { error: lineError } = await supabaseAdmin
        .from('warehouse_receipt_lines')
        .insert(receiptLines);

    if (lineError) {
        throw new Error(lineError.message || 'No se pudieron crear las lineas de recepcion pendiente');
    }

    return receipt;
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

    const { data: dispatches, error } = await supabaseAdmin
        .from('warehouse_dispatch_orders')
        .select('*')
        .eq('warehouse_id', id)
        .order('created_at', { ascending: false });

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'WAREHOUSE_DISPATCHES_LOAD_FAILED',
            requestId,
        });
    }

    const dispatchIds = (dispatches || []).map((dispatchItem) => dispatchItem.id);

    const { data: lines } = dispatchIds.length
        ? await supabaseAdmin
            .from('warehouse_dispatch_lines')
            .select('*, sku:warehouse_skus(*), location:warehouse_locations(*)')
            .in('dispatch_order_id', dispatchIds)
        : { data: [] as DispatchLineRow[] };

    const lineMap = new Map<string, DispatchLineRow[]>();

    for (const line of lines || []) {
        const current = lineMap.get(line.dispatch_order_id) || [];
        current.push(line);
        lineMap.set(line.dispatch_order_id, current);
    }

    const data = (dispatches || []).map((dispatchItem) => ({
        ...dispatchItem,
        lines: lineMap.get(dispatchItem.id) || [],
    }));

    return apiSuccess(data, {
        code: 'WAREHOUSE_DISPATCHES_LOADED',
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
        assertWarehouseCapability(access, 'manageDispatches', 'This warehouse role cannot create dispatches.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        dispatchNumber?: string;
        offerId?: string;
        clientId?: string;
        appointmentId?: string;
        scheduledAt?: string;
        notes?: string;
        dispatchTripMode?: 'dispatch_only' | 'private_fleet_trip' | 'marketplace_offer';
        tripDetails?: PrivateTripDetails;
        lines?: Array<{
            skuCode: string;
            skuName: string;
            locationCode?: string;
            requestedQty: number;
            pickedQty?: number;
            dispatchedQty?: number;
            rejectedQty?: number;
        }>;
    };

    if (!body.lines?.length) {
        return apiError('At least one line is required', {
            status: 400,
            code: 'WAREHOUSE_DISPATCH_VALIDATION_ERROR',
            requestId,
        });
    }

    const dispatchTripMode = body.dispatchTripMode || 'dispatch_only';
    if (!['dispatch_only', 'private_fleet_trip', 'marketplace_offer'].includes(dispatchTripMode)) {
        return apiError('dispatchTripMode invalido', {
            status: 400,
            code: 'WAREHOUSE_DISPATCH_TRIP_MODE_INVALID',
            requestId,
        });
    }

    const destinationType = body.tripDetails?.destinationType || 'final_customer';
    let destinationWarehouse: Record<string, unknown> | null = null;

    if (!['final_customer', 'warehouse'].includes(destinationType)) {
        return apiError('destinationType invalido', {
            status: 400,
            code: 'WAREHOUSE_DISPATCH_DESTINATION_TYPE_INVALID',
            requestId,
        });
    }

    if (dispatchTripMode === 'private_fleet_trip' && !body.tripDetails?.privateFleetTruckerId && !body.offerId) {
        return apiError('private_fleet_trip requiere conductor privado o offerId preexistente', {
            status: 400,
            code: 'WAREHOUSE_DISPATCH_PRIVATE_FLEET_REQUIRED',
            requestId,
        });
    }

    if (dispatchTripMode === 'private_fleet_trip' && !body.offerId) {
        if (destinationType === 'warehouse') {
            if (!body.tripDetails?.destinationWarehouseId) {
                return apiError('Selecciona la bodega destino para crear el viaje bodega a bodega.', {
                    status: 400,
                    code: 'WAREHOUSE_DISPATCH_DESTINATION_WAREHOUSE_REQUIRED',
                    requestId,
                });
            }

            if (body.tripDetails.destinationWarehouseId === id) {
                return apiError('La bodega destino no puede ser la misma bodega origen.', {
                    status: 400,
                    code: 'WAREHOUSE_DISPATCH_DESTINATION_SAME_AS_ORIGIN',
                    requestId,
                });
            }

            const { data: warehouseRow, error: warehouseError } = await supabaseAdmin
                .from('warehouses')
                .select('id, business_id, code, name, status, department, city, address, latitude, longitude')
                .eq('id', body.tripDetails.destinationWarehouseId)
                .maybeSingle();

            if (warehouseError || !warehouseRow) {
                return apiError('Bodega destino no encontrada.', {
                    status: 404,
                    code: 'WAREHOUSE_DISPATCH_DESTINATION_WAREHOUSE_NOT_FOUND',
                    requestId,
                });
            }

            if (warehouseRow.business_id !== access.warehouse.business_id || warehouseRow.status !== 'active') {
                return apiError('La bodega destino debe pertenecer a la misma empresa y estar activa.', {
                    status: 403,
                    code: 'WAREHOUSE_DISPATCH_DESTINATION_WAREHOUSE_FORBIDDEN',
                    requestId,
                });
            }

            destinationWarehouse = warehouseRow as Record<string, unknown>;
            body.tripDetails.destinationAddress = String(warehouseRow.address || warehouseRow.name || '');
            body.tripDetails.destinationCity = String(warehouseRow.city || '');
            body.tripDetails.destinationDepartment = String(warehouseRow.department || '');
            body.tripDetails.destinationLatitude = typeof warehouseRow.latitude === 'number' ? warehouseRow.latitude : Number(warehouseRow.latitude || 0) || null;
            body.tripDetails.destinationLongitude = typeof warehouseRow.longitude === 'number' ? warehouseRow.longitude : Number(warehouseRow.longitude || 0) || null;
        }

        const countryCode = resolveProfileCountryCode(profile);
        const pickupContactName = body.tripDetails?.pickupContactName?.trim();
        const pickupContactPhone = normalizePhoneForNotification(body.tripDetails?.pickupContactPhone, countryCode);
        const deliveryContactName = body.tripDetails?.deliveryContactName?.trim();
        const deliveryContactPhone = normalizePhoneForNotification(body.tripDetails?.deliveryContactPhone, countryCode);

        if (!body.tripDetails?.destinationAddress?.trim() || !body.tripDetails?.destinationCity?.trim() || !body.tripDetails?.destinationDepartment?.trim()) {
            return apiError('Completa destino, ciudad y departamento para crear el viaje privado.', {
                status: 400,
                code: 'WAREHOUSE_DISPATCH_PRIVATE_DESTINATION_REQUIRED',
                requestId,
            });
        }

        if (!pickupContactName || !pickupContactPhone || !deliveryContactName || !deliveryContactPhone) {
            return apiError('Completa responsable y telefono validos de origen y entrega para enviar los PIN.', {
                status: 400,
                code: 'WAREHOUSE_DISPATCH_PRIVATE_CONTACTS_REQUIRED',
                requestId,
            });
        }
    }

    if (!body.offerId && dispatchTripMode !== 'dispatch_only') {
        try {
            await enforceMonthlyTripLimit(supabaseAdmin, access.warehouse.business_id);
        } catch (error) {
            if (isPlanLimitError(error)) {
                return apiError(error.message, {
                    status: 402,
                    code: 'PLAN_LIMIT_REACHED',
                    requestId,
                    details: getPlanLimitErrorDetails(error),
                });
            }

            throw error;
        }
    }

    const dispatchNumberBase = normalizeDispatchNumber(body.dispatchNumber);

    try {
        let dispatchOrder: Record<string, any> | null = null;
        let dispatchCreateError: { code?: string; message?: string } | null = null;

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const dispatchNumber = dispatchNumberForAttempt(dispatchNumberBase, attempt);
            const { data, error } = await supabaseAdmin
                .from('warehouse_dispatch_orders')
                .insert({
                warehouse_id: id,
                offer_id: body.offerId || null,
                dispatch_trip_mode: dispatchTripMode,
                trip_creation_status: body.offerId
                    ? 'created'
                    : dispatchTripMode === 'dispatch_only'
                        ? 'not_requested'
                        : 'manual_review',
                client_id: body.clientId || null,
                appointment_id: body.appointmentId || null,
                dispatch_number: dispatchNumber,
                status: 'dispatched',
                notes: body.notes || null,
                scheduled_at: body.scheduledAt || null,
                dispatched_at: new Date().toISOString(),
                confirmed_at: new Date().toISOString(),
                confirmed_by: authUser.id,
                metadata: {
                    dispatchTripMode,
                    tripDetails: body.tripDetails || null,
                    destinationType,
                    destinationWarehouseId: body.tripDetails?.destinationWarehouseId || null,
                    source: 'warehouse_dispatch_wizard',
                },
            })
            .select('*')
            .single();

            if (!error && data) {
                dispatchOrder = data;
                dispatchCreateError = null;
                break;
            }

            dispatchCreateError = error as { code?: string; message?: string } | null;

            if (!isDuplicateDispatchNumberError(error)) {
                break;
            }
        }

        if (dispatchCreateError || !dispatchOrder) {
            return apiError(dispatchCreateError?.message || 'Could not create dispatch', {
                status: 500,
                code: 'WAREHOUSE_DISPATCH_CREATE_FAILED',
                requestId,
            });
        }

        const createdLines: DispatchLineRow[] = [];

        for (const line of body.lines) {
            const quantityToDispatch = Number(line.dispatchedQty || line.pickedQty || line.requestedQty || 0);

            const balance = await applyStockDelta(supabaseAdmin, {
                warehouseId: id,
                businessId: access.warehouse.business_id,
                skuCode: line.skuCode.trim().toUpperCase(),
                skuName: line.skuName.trim(),
                quantityDelta: quantityToDispatch * -1,
                locationCode: line.locationCode?.trim().toUpperCase() || null,
                locationType: 'dispatch',
                movementType: 'dispatch',
                referenceType: 'dispatch',
                referenceId: dispatchOrder.id,
                performedBy: authUser.id,
                notes: body.notes || null,
                metadata: {
                    requestedQty: Number(line.requestedQty || 0),
                    rejectedQty: Number(line.rejectedQty || 0),
                },
            });

            const { data: dispatchLine, error: lineError } = await supabaseAdmin
                .from('warehouse_dispatch_lines')
                .insert({
                    dispatch_order_id: dispatchOrder.id,
                    sku_id: balance.sku.id,
                    location_id: balance.location?.id || null,
                    sku_code_snapshot: balance.sku.sku_code,
                    sku_name_snapshot: balance.sku.name,
                    requested_qty: Number(line.requestedQty || 0),
                    picked_qty: Number(line.pickedQty || quantityToDispatch),
                    dispatched_qty: quantityToDispatch,
                    rejected_qty: Number(line.rejectedQty || 0),
                    metadata: {
                        sourceDispatchLine: true,
                        loadStatus: Number(line.rejectedQty || 0) > 0 ? 'rechazado_en_origen' : 'loaded',
                        requestedQty: Number(line.requestedQty || 0),
                        loadedQty: quantityToDispatch,
                        rejectedQty: Number(line.rejectedQty || 0),
                        originWarehouseId: id,
                    },
                })
                .select('*, sku:warehouse_skus(*), location:warehouse_locations(*)')
                .single();

            if (lineError || !dispatchLine) {
                return apiError(lineError?.message || 'Could not create dispatch line', {
                    status: 500,
                    code: 'WAREHOUSE_DISPATCH_LINE_CREATE_FAILED',
                    requestId,
                });
            }

            createdLines.push(dispatchLine as DispatchLineRow);
        }

        let finalDispatchOrder = dispatchOrder;

        if (dispatchTripMode === 'private_fleet_trip' && !body.offerId && body.tripDetails?.privateFleetTruckerId) {
            try {
                const createdOffer = await createPrivateFleetOfferFromDispatch(request, {
                    warehouseId: id,
                    warehouse: access.warehouse as Record<string, unknown>,
                    dispatchId: dispatchOrder.id,
                    dispatchNumber: dispatchOrder.dispatch_number,
                    scheduledAt: body.scheduledAt,
                    notes: body.notes,
                    tripDetails: body.tripDetails,
                    lines: body.lines,
                    destinationWarehouse,
                });
                const createdOfferId = createdOffer.id;

                if (!createdOfferId) {
                    throw new Error('El viaje privado fue creado sin identificador de oferta.');
                }

                const transferReceipt = destinationType === 'warehouse' && body.tripDetails.destinationWarehouseId
                    ? await createPendingTransferReceipt(supabaseAdmin, {
                        destinationWarehouseId: body.tripDetails.destinationWarehouseId,
                        offerId: createdOfferId,
                        dispatchId: dispatchOrder.id,
                        dispatchNumber: dispatchOrder.dispatch_number,
                        notes: body.notes,
                        lines: createdLines,
                    })
                    : null;

                const { data: updatedDispatchOrder, error: updateError } = await supabaseAdmin
                    .from('warehouse_dispatch_orders')
                    .update({
                        offer_id: createdOfferId,
                        trip_creation_status: 'created',
                        trip_created_at: new Date().toISOString(),
                        trip_creation_error: null,
                        metadata: {
                            dispatchTripMode,
                            tripDetails: body.tripDetails || null,
                            destinationType,
                            destinationWarehouseId: body.tripDetails.destinationWarehouseId || null,
                            transferReceiptId: transferReceipt?.id || null,
                            source: 'warehouse_dispatch_wizard',
                            createdOfferId,
                        },
                    })
                    .eq('id', dispatchOrder.id)
                    .select('*')
                    .single();

                if (updateError || !updatedDispatchOrder) {
                    throw new Error(updateError?.message || 'El viaje fue creado, pero no se pudo enlazar al despacho');
                }

                finalDispatchOrder = updatedDispatchOrder;
            } catch (offerError) {
                const message = offerError instanceof Error ? offerError.message : 'No se pudo crear el viaje privado';

                await supabaseAdmin
                    .from('warehouse_dispatch_orders')
                    .update({
                        trip_creation_status: 'failed',
                        trip_creation_error: message,
                        metadata: {
                            dispatchTripMode,
                            tripDetails: body.tripDetails || null,
                            destinationType,
                            destinationWarehouseId: body.tripDetails?.destinationWarehouseId || null,
                            source: 'warehouse_dispatch_wizard',
                            tripCreationError: message,
                        },
                    })
                    .eq('id', dispatchOrder.id);

                throw new Error(message);
            }
        }

        return apiSuccess({
            ...finalDispatchOrder,
            lines: createdLines,
        }, {
            status: 201,
            code: 'WAREHOUSE_DISPATCH_CREATED',
            requestId,
            meta: {
                warehouseId: id,
                dispatchId: dispatchOrder.id,
            },
        });
    } catch (error) {
        console.error('[Warehouse dispatches][POST]', error);
        return apiError(error instanceof Error ? error.message : 'Could not create dispatch', {
            status: 400,
            code: 'WAREHOUSE_DISPATCH_CREATE_FAILED',
            requestId,
        });
    }
}
