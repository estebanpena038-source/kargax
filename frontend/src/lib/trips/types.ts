import type { FreightTripStatus, TruckerJobStatus } from '@/lib/payments/trip-state';

export type TripNextAction = 'awaiting' | 'pickup' | 'delivery' | 'completed';

export interface TripContextPayload {
    offer: {
        id: string;
        status: string | null;
        isPrivateFleet: boolean;
        countryCode: 'CO' | 'EC' | 'PE' | 'BR' | null;
        cargoDescription: string | null;
        originAddress: string | null;
        originDepartment: string | null;
        originCity: string | null;
        originLatitude: number | null;
        originLongitude: number | null;
        destinationAddress: string | null;
        destinationDepartment: string | null;
        destinationCity: string | null;
        destinationLatitude: number | null;
        destinationLongitude: number | null;
        pickupContactName: string | null;
        pickupContactPhone: string | null;
        deliveryContactName: string | null;
        deliveryContactPhone: string | null;
        pickupPin: string | null;
        deliveryPin: string | null;
        arrivedAtOriginAt: string | null;
        arrivedAtDestinationAt: string | null;
        loadingStartedAt: string | null;
        unloadingStartedAt: string | null;
        pickupVerifiedAt: string | null;
        deliveryVerifiedAt: string | null;
        manifestItems: unknown;
        totalAmount: number | null;
        freightPaymentAmount: number | null;
        expenseAllowanceAmount: number | null;
        compensationMode: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses' | null;
        expensesReleasePolicy: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual' | null;
        netAmount: number | null;
        platformFee: number | null;
        gpsToleranceMeters: number | null;
        manifestDeliveredCount: number | null;
        manifestRejectedCount: number | null;
    };
    payment: {
        id: string;
        status: string;
        externalId: string | null;
        externalReference: string | null;
        completedAt: string | null;
        updatedAt: string | null;
    } | null;
    tripStatus: FreightTripStatus;
    jobStatus: TruckerJobStatus;
    canOpenTrip: boolean;
    canAccessPickup: boolean;
    canAccessDelivery: boolean;
    nextAction: TripNextAction;
    blockingReason: string | null;
}

export interface TripContextEnvelope {
    success: boolean;
    data: TripContextPayload | null;
    error: {
        message: string;
        details?: unknown;
    } | null;
    code: string;
    meta: {
        requestId: string;
        timestamp: string;
        [key: string]: unknown;
    };
}
