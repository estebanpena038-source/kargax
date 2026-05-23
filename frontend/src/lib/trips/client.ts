import { supabase } from '@/lib/supabase/client';
import type { TripContextEnvelope, TripContextPayload } from '@/lib/trips/types';

interface TripContextSuccess {
    ok: true;
    data: TripContextPayload;
}

interface TripContextFailure {
    ok: false;
    status: number;
    error: string;
    requiresLogin: boolean;
}

export type TripContextResult = TripContextSuccess | TripContextFailure;

async function requestTripContext(offerId: string) {
    return fetch(`/api/trips/${encodeURIComponent(offerId)}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
    });
}

export async function fetchTripContext(offerId: string): Promise<TripContextResult> {
    let response = await requestTripContext(offerId);

    if (response.status === 401) {
        await supabase.auth.refreshSession().catch(() => null);
        response = await requestTripContext(offerId);
    }

    const payload = await response.json().catch(() => null) as TripContextEnvelope | null;

    if (!response.ok || !payload?.success || !payload.data) {
        return {
            ok: false,
            status: response.status,
            error: payload?.error?.message || 'No se pudo cargar el viaje',
            requiresLogin: response.status === 401,
        };
    }

    return {
        ok: true,
        data: payload.data,
    };
}
