import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { assertPrivateFleetPinContacts, sendPrivateFleetPinNotifications } from '@/lib/server/private-fleet-pins';

function isAssignmentColumnMissing(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const candidate = error as { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };
    const text = [candidate.code, candidate.message, candidate.details, candidate.hint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return text.includes('private_fleet_assignment_status') || text.includes('private_fleet_rejected');
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ offerId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const { offerId } = await params;
    const normalizedOfferId = offerId?.trim();

    if (profile?.user_type !== 'trucker' && profile?.user_type !== 'admin') {
        return apiError('Solo transportadores pueden aceptar viajes privados', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_TRIP_ACCEPT_FORBIDDEN',
        });
    }

    if (!normalizedOfferId) {
        return apiError('offerId es requerido', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_TRIP_ACCEPT_OFFER_REQUIRED',
        });
    }

    try {
        await assertPrivateFleetPinContacts(supabaseAdmin, normalizedOfferId);
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Completa contactos de origen y entrega antes de aceptar el viaje', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_TRIP_ACCEPT_CONTACTS_REQUIRED',
        });
    }

    const { data: confirmationResult, error: confirmationError } = await supabaseAdmin.rpc('confirm_private_fleet_offer', {
        p_offer_id: normalizedOfferId,
        p_trucker_id: authUser.id,
    });

    if (confirmationError) {
        return apiError(confirmationError.message || 'No se pudo aceptar el viaje privado', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_TRIP_ACCEPT_FAILED',
        });
    }

    const result = Array.isArray(confirmationResult) ? confirmationResult[0] : confirmationResult;

    if (!result?.success) {
        return apiError(result?.message || 'No se pudo aceptar el viaje privado', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_TRIP_ACCEPT_REJECTED',
        });
    }

    const { error: assignmentUpdateError } = await supabaseAdmin
        .from('cargo_offers')
        .update({
            private_fleet_assignment_status: 'accepted',
            private_fleet_rejected_at: null,
            private_fleet_rejected_by: null,
            private_fleet_rejection_reason: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', normalizedOfferId);

    if (assignmentUpdateError && !isAssignmentColumnMissing(assignmentUpdateError)) {
        return apiError(assignmentUpdateError.message || 'El viaje fue aceptado, pero no se pudo actualizar el estado de asignacion', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_TRIP_ACCEPT_STATE_FAILED',
        });
    }

    const notificationResult = await sendPrivateFleetPinNotifications(supabaseAdmin, normalizedOfferId);
    if (!notificationResult.success) {
        console.warn('[Private fleet trip accept] PIN notification failed', {
            offerId: normalizedOfferId,
            errors: notificationResult.errors,
        });
    }

    return apiSuccess({
        offerId: normalizedOfferId,
        assignmentStatus: 'accepted',
        paymentId: result.payment_id,
        expenseAmount: Number(result.expense_amount || 0),
        freightAmount: Number(result.freight_amount || 0),
        pickupPin: result.pickup_pin || null,
        deliveryPin: result.delivery_pin || null,
        notificationSent: notificationResult.success,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_TRIP_ACCEPTED',
    });
}
