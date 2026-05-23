import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { assertWarehouseCapability, ensureWarehouseAccess } from '@/lib/server/warehouses';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';

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
        .from('warehouse_appointments')
        .select('*, dock:warehouse_docks(*)')
        .eq('warehouse_id', id)
        .order('scheduled_start', { ascending: false });

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'WAREHOUSE_APPOINTMENTS_LOAD_FAILED',
            requestId,
        });
    }

    return apiSuccess(data || [], {
        code: 'WAREHOUSE_APPOINTMENTS_LOADED',
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
        assertWarehouseCapability(access, 'manageAppointments', 'This warehouse role cannot create appointments.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        offerId?: string;
        dockId?: string;
        appointmentType?: 'pickup' | 'delivery' | 'receipt' | 'dispatch';
        scheduledStart?: string;
        scheduledEnd?: string;
        vehiclePlate?: string;
        truckerName?: string;
        truckerPhone?: string;
        contactName?: string;
        contactPhone?: string;
        paymentStatus?: 'pending' | 'reserved' | 'completed' | 'n_a';
        notes?: string;
    };

    if (!body.appointmentType || !body.scheduledStart || !body.scheduledEnd) {
        return apiError('appointmentType, scheduledStart and scheduledEnd are required', {
            status: 400,
            code: 'WAREHOUSE_APPOINTMENT_VALIDATION_ERROR',
            requestId,
        });
    }

    const { data: appointment, error } = await supabaseAdmin
        .from('warehouse_appointments')
        .insert({
            warehouse_id: id,
            offer_id: body.offerId || null,
            dock_id: body.dockId || null,
            appointment_type: body.appointmentType,
            scheduled_start: body.scheduledStart,
            scheduled_end: body.scheduledEnd,
            vehicle_plate: body.vehiclePlate || null,
            trucker_name: body.truckerName || null,
            trucker_phone: body.truckerPhone || null,
            contact_name: body.contactName || null,
            contact_phone: body.contactPhone || null,
            payment_status: body.paymentStatus || 'pending',
            notes: body.notes || null,
            created_by: authUser.id,
        })
        .select('*, dock:warehouse_docks(*)')
        .single();

    if (error || !appointment) {
        return apiError(error?.message || 'Could not create appointment', {
            status: 500,
            code: 'WAREHOUSE_APPOINTMENT_CREATE_FAILED',
            requestId,
        });
    }

    if (body.offerId) {
        const offerUpdate: Record<string, unknown> = {
            warehouse_flow_mode: access.warehouse.flow_mode,
        };

        if (body.appointmentType === 'pickup') {
            offerUpdate.origin_warehouse_id = id;
            offerUpdate.origin_dock_id = body.dockId || null;
            offerUpdate.origin_appointment_id = appointment.id;
        }

        if (body.appointmentType === 'delivery') {
            offerUpdate.destination_warehouse_id = id;
            offerUpdate.destination_dock_id = body.dockId || null;
            offerUpdate.destination_appointment_id = appointment.id;
        }

        await supabaseAdmin.from('cargo_offers').update(offerUpdate).eq('id', body.offerId);
    }

    await supabaseAdmin.from('warehouse_tasks').insert({
        warehouse_id: id,
        appointment_id: appointment.id,
        offer_id: body.offerId || null,
        task_type:
            body.appointmentType === 'pickup'
                ? 'loading'
                : body.appointmentType === 'delivery'
                    ? 'receiving'
                    : body.appointmentType === 'dispatch'
                        ? 'dispatch'
                        : 'check_in',
        status: 'open',
        title: `${body.appointmentType.toUpperCase()} appointment`,
        description: body.notes || null,
        created_by: authUser.id,
        due_at: body.scheduledStart,
        metadata: {
            vehiclePlate: body.vehiclePlate || null,
            dockId: body.dockId || null,
        },
    });

    return apiSuccess(appointment, {
        status: 201,
        code: 'WAREHOUSE_APPOINTMENT_CREATED',
        requestId,
        meta: {
            warehouseId: id,
            appointmentId: appointment.id,
        },
    });
}
