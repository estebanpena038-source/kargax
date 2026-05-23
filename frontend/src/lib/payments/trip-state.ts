export type FreightTripStatus =
    | 'awaiting_payment'
    | 'pending_confirmation'
    | 'confirmed'
    | 'in_transit'
    | 'completed'
    | 'failed';

export type TruckerJobStatus = 'awaiting_confirmation' | 'awaiting_payment' | 'awaiting' | 'in_transit' | 'delivered';

interface TripStateInput {
    offerStatus?: string | null;
    paymentStatus?: string | null;
    pickupPin?: string | null;
    deliveryPin?: string | null;
    pickupVerifiedAt?: string | null;
    deliveryVerifiedAt?: string | null;
}

export function deriveFreightTripStatus({
    offerStatus,
    paymentStatus,
    pickupPin,
    deliveryPin,
    pickupVerifiedAt,
    deliveryVerifiedAt,
}: TripStateInput): FreightTripStatus {
    if (deliveryVerifiedAt || offerStatus === 'completed') {
        return 'completed';
    }

    if (pickupVerifiedAt || offerStatus === 'in_progress') {
        return 'in_transit';
    }

    if (
        offerStatus === 'reserved'
        || paymentStatus === 'completed'
        || (pickupPin && deliveryPin)
    ) {
        return 'confirmed';
    }

    if (paymentStatus === 'failed' || paymentStatus === 'expired' || paymentStatus === 'refunded') {
        return 'failed';
    }

    if (paymentStatus === 'processing' || paymentStatus === 'pending') {
        return 'pending_confirmation';
    }

    return 'awaiting_payment';
}

export function deriveTruckerJobStatus(input: TripStateInput): TruckerJobStatus {
    if (input.offerStatus === 'assigned') {
        return 'awaiting_confirmation';
    }

    const tripStatus = deriveFreightTripStatus(input);

    if (tripStatus === 'completed') {
        return 'delivered';
    }

    if (tripStatus === 'in_transit') {
        return 'in_transit';
    }

    if (tripStatus === 'confirmed') {
        return 'awaiting';
    }

    return 'awaiting_payment';
}
