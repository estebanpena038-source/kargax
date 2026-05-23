import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentRuntimeConfig } from '@/lib/server/runtime-env';
import { normalizePhoneForNotification } from '@/lib/phone/andean';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

type PrivateFleetPinOffer = {
    id: string;
    cargo_description: string | null;
    pickup_pin: string | null;
    delivery_pin: string | null;
    pickup_contact_name: string | null;
    pickup_contact_phone: string | null;
    delivery_contact_name: string | null;
    delivery_contact_phone: string | null;
    country_code?: string | null;
};

export type PrivateFleetPinNotificationResult = {
    success: boolean;
    errors?: string[];
};

export async function assertPrivateFleetPinContacts(
    supabaseAdmin: SupabaseAdminClient,
    offerId: string
) {
    const { data: offer, error } = await supabaseAdmin
        .from('cargo_offers')
        .select('id, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, country_code')
        .eq('id', offerId)
        .maybeSingle();

    if (error || !offer) {
        throw new Error(error?.message || 'Oferta privada no encontrada');
    }

    const pickupPhone = normalizePhoneForNotification(offer.pickup_contact_phone, offer.country_code || 'CO');
    const deliveryPhone = normalizePhoneForNotification(offer.delivery_contact_phone, offer.country_code || 'CO');

    if (
        !offer.pickup_contact_name?.trim()
        || !pickupPhone
        || !offer.delivery_contact_name?.trim()
        || !deliveryPhone
    ) {
        throw new Error('Este viaje privado no tiene responsable y telefono de origen y entrega para enviar los PIN.');
    }
}

export async function sendPrivateFleetPinNotifications(
    supabaseAdmin: SupabaseAdminClient,
    offerId: string
): Promise<PrivateFleetPinNotificationResult> {
    const { data: offer, error } = await supabaseAdmin
        .from('cargo_offers')
        .select('id, cargo_description, pickup_pin, delivery_pin, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, country_code')
        .eq('id', offerId)
        .maybeSingle<PrivateFleetPinOffer>();

    if (error || !offer) {
        return { success: false, errors: [error?.message || 'Oferta privada no encontrada'] };
    }

    if (!offer.pickup_pin || !offer.delivery_pin) {
        return { success: false, errors: ['El viaje privado no tiene PINs generados'] };
    }

    if (!offer.pickup_contact_phone || !offer.delivery_contact_phone) {
        return { success: false, errors: ['Faltan telefonos de origen o entrega para enviar PINs'] };
    }

    try {
        const { baseUrl } = getPaymentRuntimeConfig({
            requireInternalApiKey: true,
            requireNotificationProvider: true,
            requireTwilio: true,
        });

        const response = await fetch(`${baseUrl}/api/notifications/send-pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.INTERNAL_API_KEY ? { 'x-internal-api-key': process.env.INTERNAL_API_KEY } : {}),
            },
            body: JSON.stringify({
                offerId: offer.id,
                cargoDescription: offer.cargo_description || undefined,
                pickupPin: offer.pickup_pin,
                deliveryPin: offer.delivery_pin,
                pickupContactPhone: offer.pickup_contact_phone,
                pickupContactName: offer.pickup_contact_name || 'Responsable de origen',
                deliveryContactPhone: offer.delivery_contact_phone,
                deliveryContactName: offer.delivery_contact_name || 'Receptor',
                countryCode: offer.country_code || 'CO',
            }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
            return {
                success: false,
                errors: [
                    result?.error || 'No se pudieron enviar los PIN',
                    ...(Array.isArray(result?.errors) ? result.errors : []),
                ].filter(Boolean),
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            errors: [error instanceof Error ? error.message : 'No se pudieron enviar los PIN'],
        };
    }
}
