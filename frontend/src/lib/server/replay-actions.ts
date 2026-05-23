import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPaymentIdempotencyKey } from '@/lib/contracts/payments';
import type { PlatformIncident, ReplayAction } from '@/lib/platform/types';
import { getPaymentRuntimeConfig } from '@/lib/server/runtime-env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

async function reconcilePayment(
    supabaseAdmin: AdminClient,
    payload: {
        paymentId?: string | null;
        offerId?: string | null;
        requestId: string;
        reasonCode?: string;
    }
) {
    let query = supabaseAdmin
        .from('payments')
        .select('id, offer_id, status')
        .limit(1);

    query = payload.paymentId ? query.eq('id', payload.paymentId) : query.eq('offer_id', payload.offerId);

    const { data: payment, error } = await query.single();

    if (error || !payment) {
        throw new Error('Payment not found for replay.');
    }

    const externalId = buildPaymentIdempotencyKey([
        'replay',
        payload.requestId,
        payment.id,
        payment.offer_id || 'no-offer',
    ]);

    const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_successful_payment', {
        p_payment_id: payment.id,
        p_external_id: externalId,
        p_gateway_response: {
            replay: true,
            replay_reason: payload.reasonCode || 'incident_replay',
            replay_request_id: payload.requestId,
            replayed_at: new Date().toISOString(),
        },
    });

    if (rpcError) {
        throw new Error(rpcError.message || 'Could not replay payment settlement.');
    }

    return {
        paymentId: payment.id,
        offerId: payment.offer_id,
        externalId,
        result: Array.isArray(result) ? result[0] : result,
    };
}

async function resendPins(
    supabaseAdmin: AdminClient,
    payload: {
        offerId: string;
    }
) {
    const { data: offer, error } = await supabaseAdmin
        .from('cargo_offers')
        .select('id, cargo_description, pickup_pin, delivery_pin, pickup_contact_phone, pickup_contact_name, delivery_contact_phone, delivery_contact_name')
        .eq('id', payload.offerId)
        .single();

    if (error || !offer) {
        throw new Error('Offer not found for PIN replay.');
    }

    if (!offer.pickup_pin || !offer.delivery_pin) {
        throw new Error('Offer does not have generated PINs.');
    }

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
            pickupContactName: offer.pickup_contact_name || 'Contacto de origen',
            deliveryContactPhone: offer.delivery_contact_phone,
            deliveryContactName: offer.delivery_contact_name || 'Contacto de destino',
        }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to replay PIN notification.');
    }

    return {
        offerId: offer.id,
        result,
    };
}

export async function executeReplayAction(
    supabaseAdmin: AdminClient,
    incident: PlatformIncident,
    actorId: string,
    requestId: string
) {
    const replayAction = incident.replay_action as ReplayAction | null;
    const payload = incident.replay_payload || {};

    if (!incident.replayable || !replayAction) {
        throw new Error('Incident is not replayable.');
    }

    if (replayAction === 'reconcile_payment' || replayAction === 'retry_webhook_follow_up' || replayAction === 'rerun_settlement_side_effects') {
        return reconcilePayment(supabaseAdmin, {
            paymentId: typeof payload.paymentId === 'string' ? payload.paymentId : null,
            offerId: typeof payload.offerId === 'string' ? payload.offerId : incident.source_reference,
            requestId,
            reasonCode: `incident_replay:${replayAction}:${actorId}`,
        });
    }

    if (replayAction === 'resend_pin') {
        const offerId = typeof payload.offerId === 'string' ? payload.offerId : incident.source_reference;
        if (!offerId) {
            throw new Error('Replay payload is missing offerId.');
        }
        return resendPins(supabaseAdmin, { offerId });
    }

    if (replayAction === 'retry_notification') {
        const notificationType = typeof payload.notificationType === 'string' ? payload.notificationType : 'pin';
        if (notificationType === 'pin') {
            const offerId = typeof payload.offerId === 'string' ? payload.offerId : incident.source_reference;
            if (!offerId) {
                throw new Error('Replay payload is missing offerId.');
            }
            return resendPins(supabaseAdmin, { offerId });
        }

        throw new Error(`Unsupported notification replay type: ${notificationType}`);
    }

    throw new Error(`Unsupported replay action: ${replayAction}`);
}
