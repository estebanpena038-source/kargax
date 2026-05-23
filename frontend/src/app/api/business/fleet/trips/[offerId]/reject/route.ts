import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

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
        return apiError('Solo transportadores pueden rechazar viajes privados', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_TRIP_REJECT_FORBIDDEN',
        });
    }

    if (!normalizedOfferId) {
        return apiError('offerId es requerido', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_TRIP_REJECT_OFFER_REQUIRED',
        });
    }

    const body = await request.json().catch(() => ({})) as {
        reason?: string | null;
    };
    const reason = body.reason?.trim() || null;

    const { data: offer, error: offerError } = await supabaseAdmin
        .from('cargo_offers')
        .select(`
            id,
            business_id,
            status,
            is_private_fleet,
            assigned_trucker_id,
            private_fleet_trucker_id,
            private_fleet_confirmed_at,
            pickup_pin,
            delivery_pin,
            private_fleet_assignment_status
        `)
        .eq('id', normalizedOfferId)
        .maybeSingle();

    if (offerError) {
        if (isAssignmentColumnMissing(offerError)) {
            return apiError('Falta aplicar la migracion de viajes asignados de flota privada', {
                requestId,
                status: 503,
                code: 'PRIVATE_FLEET_ASSIGNMENT_SCHEMA_MISSING',
                details: offerError.message,
            });
        }

        return apiError(offerError.message || 'No se pudo cargar el viaje privado', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_TRIP_REJECT_LOAD_FAILED',
        });
    }

    if (!offer) {
        return apiError('Viaje privado no encontrado', {
            requestId,
            status: 404,
            code: 'PRIVATE_FLEET_TRIP_REJECT_NOT_FOUND',
        });
    }

    if (!offer.is_private_fleet) {
        return apiError('Este viaje no pertenece a flota privada', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_TRIP_REJECT_NOT_PRIVATE',
        });
    }

    const assignedToUser = offer.assigned_trucker_id === authUser.id || offer.private_fleet_trucker_id === authUser.id;

    if (profile?.user_type !== 'admin' && !assignedToUser) {
        return apiError('No tienes permiso para rechazar este viaje', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_TRIP_REJECT_SCOPE_DENIED',
        });
    }

    if (offer.private_fleet_assignment_status === 'rejected') {
        return apiSuccess({
            offerId: normalizedOfferId,
            assignmentStatus: 'rejected',
            alreadyRejected: true,
        }, {
            requestId,
            code: 'PRIVATE_FLEET_TRIP_ALREADY_REJECTED',
        });
    }

    const alreadyOperational = Boolean(
        offer.private_fleet_confirmed_at
        || offer.pickup_pin
        || offer.delivery_pin
        || ['reserved', 'in_progress', 'completed'].includes(String(offer.status))
    );

    if (alreadyOperational || offer.status !== 'assigned') {
        return apiError('Solo puedes rechazar viajes privados antes de aceptarlos', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_TRIP_REJECT_ALREADY_OPERATIONAL',
        });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
        .from('cargo_offers')
        .update({
            private_fleet_assignment_status: 'rejected',
            private_fleet_rejected_at: now,
            private_fleet_rejected_by: authUser.id,
            private_fleet_rejection_reason: reason,
            updated_at: now,
        })
        .eq('id', normalizedOfferId);

    if (updateError) {
        return apiError(updateError.message || 'No se pudo devolver el viaje a la empresa', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_TRIP_REJECT_UPDATE_FAILED',
        });
    }

    await supabaseAdmin
        .from('trip_financial_allocations')
        .update({
            status: 'refunded',
            metadata: {
                source_kind: 'private_fleet_driver_rejection',
                rejected_by: authUser.id,
                rejected_at: now,
                reason,
            },
        })
        .eq('offer_id', normalizedOfferId)
        .eq('status', 'held_in_custody');

    await supabaseAdmin.rpc('create_notification', {
        p_user_id: offer.business_id,
        p_type: 'private_fleet_assignment_rejected',
        p_title: 'Viaje privado rechazado',
        p_message: reason
            ? `El conductor devolvio el viaje asignado: ${reason}`
            : 'El conductor devolvio el viaje asignado. Reasigna la ruta o cancelala desde operaciones.',
        p_data: {
            offer_id: normalizedOfferId,
            trucker_id: authUser.id,
            reason,
        },
    });

    return apiSuccess({
        offerId: normalizedOfferId,
        assignmentStatus: 'rejected',
    }, {
        requestId,
        code: 'PRIVATE_FLEET_TRIP_REJECTED',
    });
}
