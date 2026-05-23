import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { assertWarehouseCapability, ensureWarehouseAccess } from '@/lib/server/warehouses';

interface RouteContext {
    params: Promise<{ id: string; appointmentId: string }>;
}

const APPOINTMENT_TRANSITIONS: Record<string, string[]> = {
    scheduled: ['checked_in', 'cancelled'],
    checked_in: ['in_progress', 'completed', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
};

export async function PATCH(request: NextRequest, context: RouteContext) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id, appointmentId } = await context.params;
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
        assertWarehouseCapability(access, 'manageAppointments', 'This warehouse role cannot update appointments.');
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Warehouse action not permitted', {
            status: 403,
            code: 'WAREHOUSE_CAPABILITY_DENIED',
            requestId,
        });
    }

    const body = (await request.json()) as {
        status?: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';
        notes?: string;
        dockId?: string | null;
        paymentStatus?: 'pending' | 'reserved' | 'completed' | 'n_a';
    };

    const { data: appointment, error: appointmentError } = await supabaseAdmin
        .from('warehouse_appointments')
        .select('*, dock:warehouse_docks(*)')
        .eq('id', appointmentId)
        .eq('warehouse_id', id)
        .maybeSingle();

    if (appointmentError || !appointment) {
        return apiError(appointmentError?.message || 'Appointment not found', {
            status: 404,
            code: 'WAREHOUSE_APPOINTMENT_NOT_FOUND',
            requestId,
        });
    }

    const payload: Record<string, unknown> = {};
    const nextStatus = body.status || appointment.status;

    if (body.status && body.status !== appointment.status) {
        const allowed = APPOINTMENT_TRANSITIONS[appointment.status] || [];
        if (!allowed.includes(body.status)) {
            return apiError(`Invalid appointment transition: ${appointment.status} -> ${body.status}`, {
                status: 409,
                code: 'WAREHOUSE_APPOINTMENT_INVALID_TRANSITION',
                requestId,
            });
        }

        payload.status = body.status;

        if (body.status === 'checked_in') {
            payload.checked_in_at = appointment.checked_in_at || new Date().toISOString();
            payload.actual_start_at = appointment.actual_start_at || new Date().toISOString();
        }

        if (body.status === 'in_progress') {
            payload.checked_in_at = appointment.checked_in_at || new Date().toISOString();
            payload.actual_start_at = appointment.actual_start_at || new Date().toISOString();
        }

        if (body.status === 'completed') {
            payload.checked_in_at = appointment.checked_in_at || new Date().toISOString();
            payload.checked_out_at = new Date().toISOString();
            payload.actual_start_at = appointment.actual_start_at || new Date().toISOString();
            payload.actual_end_at = new Date().toISOString();
        }

        if (body.status === 'cancelled') {
            payload.actual_end_at = appointment.actual_end_at || new Date().toISOString();
            payload.checked_out_at = appointment.checked_out_at || new Date().toISOString();
        }
    }

    if (body.notes !== undefined) payload.notes = body.notes?.trim() || null;
    if (body.dockId !== undefined) payload.dock_id = body.dockId || null;
    if (body.paymentStatus !== undefined) payload.payment_status = body.paymentStatus;

    if (!Object.keys(payload).length) {
        return apiError('No appointment changes provided', {
            status: 400,
            code: 'WAREHOUSE_APPOINTMENT_EMPTY_PATCH',
            requestId,
        });
    }

    const { data: updatedAppointment, error: updateError } = await supabaseAdmin
        .from('warehouse_appointments')
        .update(payload)
        .eq('id', appointmentId)
        .eq('warehouse_id', id)
        .select('*, dock:warehouse_docks(*)')
        .single();

    if (updateError || !updatedAppointment) {
        return apiError(updateError?.message || 'Could not update appointment', {
            status: 500,
            code: 'WAREHOUSE_APPOINTMENT_UPDATE_FAILED',
            requestId,
        });
    }

    if (body.status === 'completed' && updatedAppointment.offer_id) {
        const offerPatch = updatedAppointment.appointment_type === 'pickup'
            ? { origin_appointment_id: updatedAppointment.id }
            : updatedAppointment.appointment_type === 'delivery'
                ? { destination_appointment_id: updatedAppointment.id }
                : null;

        if (offerPatch) {
            await supabaseAdmin.from('cargo_offers').update(offerPatch).eq('id', updatedAppointment.offer_id);
        }
    }

    await supabaseAdmin
        .from('warehouse_tasks')
        .update({
            status: nextStatus === 'cancelled' ? 'cancelled' : nextStatus === 'completed' ? 'completed' : 'in_progress',
            completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        })
        .eq('appointment_id', updatedAppointment.id)
        .eq('warehouse_id', id)
        .in('status', ['open', 'in_progress', 'blocked']);

    return apiSuccess(updatedAppointment, {
        code: 'WAREHOUSE_APPOINTMENT_UPDATED',
        requestId,
        meta: {
            warehouseId: id,
            appointmentId,
        },
    });
}
