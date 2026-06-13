import { NextRequest, NextResponse } from 'next/server';
import { createAdminNotification } from '@/lib/server/route-auth';
import { requireInternalAdminCapability } from '@/lib/server/internal-admins';
import { getPaymentRuntimeConfig } from '@/lib/server/runtime-env';
import { getRequestId } from '@/lib/server/api-response';
import { recordCriticalOperation } from '@/lib/server/operations';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireInternalAdminCapability(request, 'pin:resend');

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin } = auth.context;
    const body = await request.json().catch(() => ({}));
    const offerId = typeof body?.offerId === 'string' ? body.offerId : null;

    if (!offerId) {
        await recordCriticalOperation(auth.context.supabaseAdmin, {
            requestId,
            actorUserId: auth.context.authUser.id,
            actorType: 'admin',
            domain: 'payments',
            action: 'admin_resend_pin',
            entityType: 'offer',
            entityId: null,
            status: 'error',
            errorClass: 'PIN_RESEND_IDENTIFIER_REQUIRED',
            replayable: false,
            incident: {
                title: 'PIN resend request missing offerId',
                severity: 'low',
                runbookKey: 'payment_webhook_failure',
            },
        });
        return NextResponse.json({ error: 'offerId is required' }, { status: 400 });
    }

    const { data: offer, error } = await supabaseAdmin
        .from('cargo_offers')
        .select('id, cargo_description, pickup_pin, delivery_pin, pickup_contact_phone, pickup_contact_name, delivery_contact_phone, delivery_contact_name')
        .eq('id', offerId)
        .single();

    if (error || !offer) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: auth.context.authUser.id,
            actorType: 'admin',
            domain: 'payments',
            action: 'admin_resend_pin',
            entityType: 'offer',
            entityId: offerId,
            status: 'error',
            errorClass: 'PIN_RESEND_OFFER_NOT_FOUND',
            replayable: false,
            sourceReference: offerId,
            incident: {
                title: 'PIN resend target not found',
                severity: 'medium',
                runbookKey: 'payment_webhook_failure',
            },
        });
        return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    if (!offer.pickup_pin || !offer.delivery_pin) {
        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: auth.context.authUser.id,
            actorType: 'admin',
            domain: 'payments',
            action: 'admin_resend_pin',
            entityType: 'offer',
            entityId: offer.id,
            status: 'error',
            errorClass: 'PIN_RESEND_PINS_NOT_READY',
            replayable: true,
            replayAction: 'resend_pin',
            sourceReference: offer.id,
            metadata: {
                offerId: offer.id,
            },
            incident: {
                title: 'PIN resend attempted before PIN generation',
                severity: 'medium',
                runbookKey: 'payment_webhook_failure',
                replayPayload: {
                    offerId: offer.id,
                },
            },
        });
        return NextResponse.json({ error: 'Offer does not have generated PINs yet' }, { status: 409 });
    }

    const { baseUrl: appUrl } = getPaymentRuntimeConfig({
        requireInternalApiKey: true,
        requireNotificationProvider: true,
        requireTwilio: true,
    });
    const internalApiKey = process.env.INTERNAL_API_KEY;

    const response = await fetch(`${appUrl}/api/notifications/send-pin`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(internalApiKey ? { 'x-internal-api-key': internalApiKey } : {}),
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
        await createAdminNotification(supabaseAdmin, {
            type: 'pin_incident',
            title: 'Error reenviando PIN',
            message: `Fallo el reenvio de PIN para la oferta ${offer.id.slice(0, 8)}.`,
            data: {
                offer_id: offer.id,
                response_status: response.status,
                result,
            },
        });

        await recordCriticalOperation(supabaseAdmin, {
            requestId,
            actorUserId: auth.context.authUser.id,
            actorType: 'admin',
            domain: 'payments',
            action: 'admin_resend_pin',
            entityType: 'offer',
            entityId: offer.id,
            status: 'error',
            errorClass: 'PIN_RESEND_FAILED',
            replayable: true,
            replayAction: 'resend_pin',
            sourceReference: offer.id,
            metadata: {
                offerId: offer.id,
                responseStatus: response.status,
            },
            incident: {
                title: 'PIN resend failed',
                detail: typeof result?.error === 'string' ? result.error : 'Notification provider returned an error.',
                severity: 'high',
                runbookKey: 'payment_webhook_failure',
                replayPayload: {
                    offerId: offer.id,
                    notificationType: 'pin',
                },
            },
        });

        return NextResponse.json(
            { error: result?.error || 'Failed to resend PIN notifications' },
            { status: 500 }
        );
    }

    await recordCriticalOperation(supabaseAdmin, {
        requestId,
        actorUserId: auth.context.authUser.id,
        actorType: 'admin',
        domain: 'payments',
        action: 'admin_resend_pin',
        entityType: 'offer',
        entityId: offer.id,
        status: 'success',
        replayable: false,
        sourceReference: offer.id,
        metadata: {
            offerId: offer.id,
        },
    });

    return NextResponse.json({
        success: true,
        offerId: offer.id,
        result,
    });
}
