import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

export interface TrackingOfferAccess {
    id: string;
    business_id: string;
    assigned_trucker_id: string | null;
    private_fleet_trucker_id: string | null;
    status: string;
}

export interface TrackingAuthProfile {
    user_type: 'trucker' | 'business' | 'admin' | 'staff';
}

export interface LocationPingInput {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    speedMps?: number | null;
    headingDegrees?: number | null;
    batteryLevel?: number | null;
    capturedAt?: string | null;
    metadata?: Record<string, unknown>;
}

export interface NormalizedLocationPing {
    latitude: number;
    longitude: number;
    accuracy_meters: number | null;
    speed_mps: number | null;
    heading_degrees: number | null;
    battery_level: number | null;
    captured_at: string;
    metadata: Record<string, unknown>;
}

export function isAssignedTrucker(offer: TrackingOfferAccess, userId: string) {
    return offer.assigned_trucker_id === userId || offer.private_fleet_trucker_id === userId;
}

export function canReadTracking(offer: TrackingOfferAccess, userId: string, profile: TrackingAuthProfile | null) {
    return profile?.user_type === 'admin' || offer.business_id === userId || isAssignedTrucker(offer, userId);
}

export function canWriteTracking(offer: TrackingOfferAccess, userId: string) {
    return isAssignedTrucker(offer, userId)
        && ['assigned', 'reserved', 'in_progress', 'picked_up', 'in_transit'].includes(offer.status);
}

export async function getTrackingOffer(supabaseAdmin: AdminClient, offerId: string) {
    const { data, error } = await supabaseAdmin
        .from('cargo_offers')
        .select('id, business_id, assigned_trucker_id, private_fleet_trucker_id, status')
        .eq('id', offerId)
        .maybeSingle();

    if (error || !data) {
        return { offer: null, error: error?.message || 'Viaje no encontrado' };
    }

    return { offer: data as TrackingOfferAccess, error: null };
}

export function normalizePingInput(input: LocationPingInput): { ping: NormalizedLocationPing; error?: never } | { ping?: never; error: string } {
    const latitude = Number(input.latitude);
    const longitude = Number(input.longitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return { error: 'latitude invalida' };
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return { error: 'longitude invalida' };
    }

    const capturedAt = input.capturedAt && !Number.isNaN(new Date(input.capturedAt).getTime())
        ? new Date(input.capturedAt).toISOString()
        : new Date().toISOString();

    return {
        ping: {
            latitude,
            longitude,
            accuracy_meters: input.accuracyMeters == null ? null : Number(input.accuracyMeters),
            speed_mps: input.speedMps == null ? null : Number(input.speedMps),
            heading_degrees: input.headingDegrees == null ? null : Number(input.headingDegrees),
            battery_level: input.batteryLevel == null ? null : Number(input.batteryLevel),
            captured_at: capturedAt,
            metadata: input.metadata || {},
        },
    };
}

export async function getOrCreateActiveTrackingSession(
    supabaseAdmin: AdminClient,
    offerId: string,
    truckerId: string,
    metadata: Record<string, unknown> = {}
) {
    const { data: existing, error: existingError } = await supabaseAdmin
        .from('trip_tracking_sessions')
        .select('*')
        .eq('offer_id', offerId)
        .eq('trucker_id', truckerId)
        .eq('status', 'active')
        .maybeSingle();

    if (!existingError && existing) {
        return { session: existing, error: null };
    }

    const { data, error } = await supabaseAdmin
        .from('trip_tracking_sessions')
        .insert({
            offer_id: offerId,
            trucker_id: truckerId,
            status: 'active',
            source: 'pwa',
            metadata,
        })
        .select('*')
        .single();

    return { session: data, error: error?.message || null };
}

export async function recordTrackingPing(
    supabaseAdmin: AdminClient,
    sessionId: string,
    offerId: string,
    truckerId: string,
    ping: NormalizedLocationPing
) {
    const { data: pingRow, error: pingError } = await supabaseAdmin
        .from('trip_location_pings')
        .insert({
            session_id: sessionId,
            offer_id: offerId,
            trucker_id: truckerId,
            source: 'pwa',
            ...ping,
        })
        .select('*')
        .single();

    if (pingError || !pingRow) {
        return { ping: null, error: pingError?.message || 'No se pudo registrar ubicacion' };
    }

    await supabaseAdmin
        .from('trip_tracking_sessions')
        .update({
            last_ping_at: pingRow.captured_at,
            last_latitude: ping.latitude,
            last_longitude: ping.longitude,
            last_accuracy_meters: ping.accuracy_meters,
            last_speed_mps: ping.speed_mps,
            last_heading_degrees: ping.heading_degrees,
            updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

    return { ping: pingRow, error: null };
}
