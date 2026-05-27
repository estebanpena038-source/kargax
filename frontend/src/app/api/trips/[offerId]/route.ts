import { NextRequest } from 'next/server';
import { deriveFreightTripStatus, deriveTruckerJobStatus } from '@/lib/payments/trip-state';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

type PrivateFleetAssignmentStatus = 'pending' | 'accepted' | 'rejected';

const PRIVATE_FLEET_READY_STATUSES = new Set(['reserved', 'in_progress', 'completed']);

function buildBlockingReason(jobStatus: ReturnType<typeof deriveTruckerJobStatus>) {
    if (jobStatus === 'awaiting_confirmation') {
        return 'La empresa todavia esta terminando de confirmar esta ruta.';
    }

    if (jobStatus === 'awaiting_payment') {
        return 'Esta ruta fue aceptada, pero aun falta la confirmacion final de la empresa.';
    }

    return null;
}

function isPrivateFleetAssignmentSchemaMissing(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const candidate = error as {
        code?: string | null;
        details?: string | null;
        hint?: string | null;
        message?: string | null;
    };
    const text = [candidate.code, candidate.message, candidate.details, candidate.hint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return text.includes('private_fleet_assignment_status') || text.includes('private_fleet_rejected');
}

function resolvePrivateFleetAssignmentStatus(offer: Record<string, unknown>): PrivateFleetAssignmentStatus {
    const rawStatus = String(offer.private_fleet_assignment_status || '');

    if (rawStatus === 'accepted' || rawStatus === 'rejected' || rawStatus === 'pending') {
        return rawStatus;
    }

    if (
        offer.private_fleet_confirmed_at
        || offer.pickup_pin
        || offer.delivery_pin
        || PRIVATE_FLEET_READY_STATUSES.has(String(offer.status || ''))
    ) {
        return 'accepted';
    }

    return 'pending';
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ offerId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { offerId } = await params;

    if (!offerId?.trim()) {
        return apiError('offerId es requerido', {
            status: 400,
            code: 'TRIP_CONTEXT_OFFER_REQUIRED',
            requestId,
        });
    }

    const { authUser, profile, supabaseAdmin } = auth.context;

    let offerResponse = await supabaseAdmin
        .from('cargo_offers')
        .select(`
            id,
            business_id,
            status,
            is_private_fleet,
            country_code,
            cargo_description,
            origin_address,
            origin_department,
            origin_city,
            origin_latitude,
            origin_longitude,
            destination_address,
            destination_department,
            destination_city,
            destination_latitude,
            destination_longitude,
            pickup_contact_name,
            pickup_contact_phone,
            delivery_contact_name,
            delivery_contact_phone,
            pickup_pin,
            delivery_pin,
            arrived_at_origin_at,
            arrived_at_destination_at,
            loading_started_at,
            unloading_started_at,
            pickup_verified_at,
            delivery_verified_at,
            manifest_items,
            total_amount,
            freight_payment_amount,
            expense_allowance_amount,
            compensation_mode,
            expenses_release_policy,
            net_amount,
            platform_fee,
            gps_tolerance_meters,
            assigned_trucker_id,
            private_fleet_trucker_id,
            private_fleet_confirmed_at,
            private_fleet_assignment_status,
            manifest_delivered_count,
            manifest_rejected_count
        `)
        .eq('id', offerId)
        .maybeSingle();

    if (offerResponse.error && isPrivateFleetAssignmentSchemaMissing(offerResponse.error)) {
        offerResponse = await supabaseAdmin
            .from('cargo_offers')
            .select(`
                id,
                business_id,
                status,
                is_private_fleet,
                country_code,
                cargo_description,
                origin_address,
                origin_department,
                origin_city,
                origin_latitude,
                origin_longitude,
                destination_address,
                destination_department,
                destination_city,
                destination_latitude,
                destination_longitude,
                pickup_contact_name,
                pickup_contact_phone,
                delivery_contact_name,
                delivery_contact_phone,
                pickup_pin,
                delivery_pin,
                arrived_at_origin_at,
                arrived_at_destination_at,
                loading_started_at,
                unloading_started_at,
                pickup_verified_at,
                delivery_verified_at,
                manifest_items,
                total_amount,
                freight_payment_amount,
                expense_allowance_amount,
                compensation_mode,
                expenses_release_policy,
                net_amount,
                platform_fee,
                gps_tolerance_meters,
                assigned_trucker_id,
                private_fleet_trucker_id,
                private_fleet_confirmed_at,
                manifest_delivered_count,
                manifest_rejected_count
            `)
            .eq('id', offerId)
            .maybeSingle();
    }

    const { data: offer, error: offerError } = offerResponse;

    if (offerError || !offer) {
        return apiError('Viaje no encontrado', {
            status: 404,
            code: 'TRIP_CONTEXT_NOT_FOUND',
            requestId,
        });
    }

    const isAdmin = profile?.user_type === 'admin';
    const isBusinessOwner = profile?.user_type === 'business' && offer.business_id === authUser.id;
    let hasTruckerAccess = offer.assigned_trucker_id === authUser.id || offer.private_fleet_trucker_id === authUser.id;

    if (!isAdmin && !isBusinessOwner && !hasTruckerAccess) {
        const { data: acceptedApplication } = await supabaseAdmin
            .from('offer_applications')
            .select('id')
            .eq('offer_id', offerId)
            .eq('trucker_id', authUser.id)
            .eq('status', 'accepted')
            .maybeSingle();

        hasTruckerAccess = Boolean(acceptedApplication?.id);
    }

    if (!isAdmin && !isBusinessOwner && !hasTruckerAccess) {
        return apiError('No tienes permiso para abrir este viaje', {
            status: 403,
            code: 'TRIP_CONTEXT_FORBIDDEN',
            requestId,
        });
    }

    const { data: paymentRows, error: paymentsError } = await supabaseAdmin
        .from('payments')
        .select('id, status, external_id, external_reference, created_at, completed_at, updated_at')
        .eq('offer_id', offerId)
        .order('created_at', { ascending: false });

    if (paymentsError) {
        return apiError('No se pudo cargar el estado del viaje', {
            status: 500,
            code: 'TRIP_CONTEXT_PAYMENTS_FAILED',
            requestId,
            details: paymentsError.message,
        });
    }

    const completedPayment = (paymentRows || []).find((payment) => payment.status === 'completed') || null;
    const latestPayment = completedPayment || paymentRows?.[0] || null;

    const marketplaceTripStatus = deriveFreightTripStatus({
        offerStatus: offer.status,
        paymentStatus: latestPayment?.status || null,
        pickupPin: offer.pickup_pin,
        deliveryPin: offer.delivery_pin,
        pickupVerifiedAt: offer.pickup_verified_at,
        deliveryVerifiedAt: offer.delivery_verified_at,
    });

    const marketplaceJobStatus = deriveTruckerJobStatus({
        offerStatus: offer.status,
        paymentStatus: latestPayment?.status || null,
        pickupPin: offer.pickup_pin,
        deliveryPin: offer.delivery_pin,
        pickupVerifiedAt: offer.pickup_verified_at,
        deliveryVerifiedAt: offer.delivery_verified_at,
    });

    const isPrivateFleet = Boolean(offer.is_private_fleet);
    const privateAssignmentStatus = isPrivateFleet
        ? resolvePrivateFleetAssignmentStatus(offer as Record<string, unknown>)
        : null;
    const privateReady = Boolean(
        isPrivateFleet
        && privateAssignmentStatus === 'accepted'
        && (
            offer.private_fleet_confirmed_at
            || offer.pickup_pin
            || offer.delivery_pin
            || PRIVATE_FLEET_READY_STATUSES.has(String(offer.status || ''))
        )
    );

    const tripStatus = isPrivateFleet
        ? offer.delivery_verified_at || offer.status === 'completed'
            ? 'completed'
            : offer.pickup_verified_at || offer.status === 'in_progress'
                ? 'in_transit'
                : privateReady
                    ? 'confirmed'
                    : privateAssignmentStatus === 'rejected'
                        ? 'failed'
                        : 'pending_confirmation'
        : marketplaceTripStatus;

    const jobStatus = isPrivateFleet
        ? tripStatus === 'completed'
            ? 'delivered'
            : tripStatus === 'in_transit'
                ? 'in_transit'
                : privateReady
                    ? 'awaiting'
                    : 'awaiting_confirmation'
        : marketplaceJobStatus;

    const canOpenTrip = jobStatus === 'awaiting' || jobStatus === 'in_transit' || jobStatus === 'delivered';
    const canAccessPickup = Boolean(offer.pickup_verified_at || offer.pickup_pin || tripStatus === 'in_transit' || tripStatus === 'completed' || privateReady);
    const canAccessDelivery = Boolean(offer.delivery_verified_at || ((tripStatus === 'in_transit' || tripStatus === 'completed') && offer.delivery_pin));
    const blockingReason = canOpenTrip
        ? null
        : privateAssignmentStatus === 'rejected'
            ? 'Esta ruta fue devuelta a la empresa. Espera una reasignacion o una nueva ruta.'
            : isPrivateFleet && privateAssignmentStatus === 'pending'
                ? 'Acepta la ruta desde Viajes asignados para iniciar la operacion.'
                : buildBlockingReason(jobStatus);

    const nextAction = offer.delivery_verified_at
        ? 'completed'
        : offer.pickup_verified_at
            ? 'delivery'
            : canAccessPickup
                ? 'pickup'
                : 'awaiting';

    const shouldUseLegacyFreight = isPrivateFleet && (
        !offer.compensation_mode
        || offer.compensation_mode === 'trip_pay'
        || offer.compensation_mode === 'trip_pay_plus_expenses'
    );
    const freightPaymentAmount = isPrivateFleet
        ? Number(offer.freight_payment_amount || (shouldUseLegacyFreight ? offer.total_amount : 0) || 0)
        : Number(offer.freight_payment_amount || 0);
    const expenseAllowanceAmount = Number(offer.expense_allowance_amount || 0);

    return apiSuccess({
        offer: {
            id: offer.id,
            status: offer.status,
            isPrivateFleet,
            countryCode: offer.country_code || 'CO',
            cargoDescription: offer.cargo_description,
            originAddress: offer.origin_address,
            originDepartment: offer.origin_department,
            originCity: offer.origin_city,
            originLatitude: offer.origin_latitude,
            originLongitude: offer.origin_longitude,
            destinationAddress: offer.destination_address,
            destinationDepartment: offer.destination_department,
            destinationCity: offer.destination_city,
            destinationLatitude: offer.destination_latitude,
            destinationLongitude: offer.destination_longitude,
            pickupContactName: offer.pickup_contact_name,
            pickupContactPhone: offer.pickup_contact_phone,
            deliveryContactName: offer.delivery_contact_name,
            deliveryContactPhone: offer.delivery_contact_phone,
            pickupPin: offer.pickup_pin,
            deliveryPin: offer.delivery_pin,
            arrivedAtOriginAt: offer.arrived_at_origin_at,
            arrivedAtDestinationAt: offer.arrived_at_destination_at,
            loadingStartedAt: offer.loading_started_at,
            unloadingStartedAt: offer.unloading_started_at,
            pickupVerifiedAt: offer.pickup_verified_at,
            deliveryVerifiedAt: offer.delivery_verified_at,
            manifestItems: offer.manifest_items,
            totalAmount: offer.total_amount,
            freightPaymentAmount,
            expenseAllowanceAmount,
            compensationMode: offer.compensation_mode,
            expensesReleasePolicy: offer.expenses_release_policy,
            netAmount: offer.net_amount,
            platformFee: offer.platform_fee,
            gpsToleranceMeters: offer.gps_tolerance_meters,
            manifestDeliveredCount: offer.manifest_delivered_count,
            manifestRejectedCount: offer.manifest_rejected_count,
        },
        payment: latestPayment
            ? {
                id: latestPayment.id,
                status: latestPayment.status,
                externalId: latestPayment.external_id,
                externalReference: latestPayment.external_reference,
                completedAt: latestPayment.completed_at,
                updatedAt: latestPayment.updated_at,
            }
            : null,
        tripStatus,
        jobStatus,
        canOpenTrip,
        canAccessPickup,
        canAccessDelivery,
        nextAction,
        blockingReason,
    }, {
        code: 'TRIP_CONTEXT_RESOLVED',
        requestId,
        meta: {
            offerId,
        },
    });
}
