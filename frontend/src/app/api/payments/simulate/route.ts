/**
 * =============================================================================
 * KARGAX - PAYMENT SIMULATION API
 * POST /api/payments/simulate
 *
 * DEVELOPMENT ONLY - Simulates a successful Mercado Pago payment
 * =============================================================================
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase service role no configurado para payment simulation');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

interface SimulatePaymentRequest {
    offerId: string;
    applicationId?: string;
    testPickupPhone?: string;
    testDeliveryPhone?: string;
    testPickupName?: string;
    testDeliveryName?: string;
}

interface NotificationPayload {
    pickup_pin?: string;
    delivery_pin?: string;
    pickup_contact_phone?: string;
    pickup_contact_name?: string;
    delivery_contact_phone?: string;
    delivery_contact_name?: string;
    offer_id?: string;
    country_code?: string;
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev) {
        return apiError('Simulacion de pago solo disponible en desarrollo', {
            status: 403,
            code: 'PAYMENT_SIMULATION_DISABLED',
            requestId,
        });
    }

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body: SimulatePaymentRequest = await request.json();

        if (!body.offerId) {
            return apiError('offerId es requerido', {
                status: 400,
                code: 'PAYMENT_SIMULATION_VALIDATION_ERROR',
                requestId,
            });
        }

        console.log('[SIMULATION] Starting payment simulation for offer:', body.offerId);

        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('payments')
            .select('*')
            .eq('offer_id', body.offerId)
            .eq('status', 'pending')
            .single();

        if (paymentError || !payment) {
            console.log('[SIMULATION] No pending payment found, attempting direct simulation...');
        }

        const fakePaymentId = `SIM-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const fakeGatewayResponse = {
            id: fakePaymentId,
            status: 'approved',
            status_detail: 'accredited',
            payment_type_id: 'credit_card',
            payment_method_id: 'visa',
            transaction_amount: payment?.amount || 0,
            date_approved: new Date().toISOString(),
            _simulated: true,
            _simulated_at: new Date().toISOString(),
        };

        const { data: result, error: processError } = await supabaseAdmin
            .rpc('process_successful_payment', {
                p_payment_id: payment?.id || null,
                p_external_id: fakePaymentId,
                p_gateway_response: fakeGatewayResponse,
            });

        if (processError) {
            console.error('[SIMULATION] RPC Error:', processError);

            const simResult = await fallbackSimulation(supabaseAdmin, body.offerId, fakePaymentId);

            if (!simResult.success) {
                return apiError('Error procesando simulacion: ' + processError.message, {
                    status: 500,
                    code: 'PAYMENT_SIMULATION_PROCESS_FAILED',
                    requestId,
                });
            }

            return apiSuccess({
                ...simResult,
                simulated: true,
                method: 'fallback',
            }, {
                code: 'PAYMENT_SIMULATED',
                requestId,
                meta: {
                    offerId: body.offerId,
                    simulationMethod: 'fallback',
                },
            });
        }

        const processResult = result?.[0];

        if (!processResult?.success) {
            console.error('[SIMULATION] Process failed:', processResult?.message);
            return apiError(processResult?.message || 'Error en simulacion', {
                status: 400,
                code: 'PAYMENT_SIMULATION_REJECTED',
                requestId,
            });
        }

        const notificationData: NotificationPayload = {
            pickup_pin: processResult.pickup_pin,
            delivery_pin: processResult.delivery_pin,
            pickup_contact_phone: processResult.pickup_contact_phone || body.testPickupPhone,
            pickup_contact_name: processResult.pickup_contact_name || body.testPickupName || 'Contacto Recogida',
            delivery_contact_phone: processResult.delivery_contact_phone || body.testDeliveryPhone,
            delivery_contact_name: processResult.delivery_contact_name || body.testDeliveryName || 'Contacto Entrega',
            offer_id: body.offerId,
            country_code: processResult.country_code || 'CO',
        };

        if (processResult.pickup_pin && processResult.delivery_pin) {
            await sendPinNotifications(notificationData);
        }

        return apiSuccess({
            success: true,
            simulated: true,
            method: 'rpc',
            fakePaymentId,
            offerId: body.offerId,
            pickupPin: processResult.pickup_pin,
            deliveryPin: processResult.delivery_pin,
            smsSentTo: {
                pickup: notificationData.pickup_contact_phone,
                delivery: notificationData.delivery_contact_phone,
            },
            pickupContact: {
                name: notificationData.pickup_contact_name,
                phone: notificationData.pickup_contact_phone,
            },
            deliveryContact: {
                name: notificationData.delivery_contact_name,
                phone: notificationData.delivery_contact_phone,
            },
            message: 'Pago simulado exitosamente. Los PINs han sido generados y enviados.',
        }, {
            code: 'PAYMENT_SIMULATED',
            requestId,
            meta: {
                offerId: body.offerId,
                simulationMethod: 'rpc',
            },
        });
    } catch (error: unknown) {
        console.error('[SIMULATION] Error:', error);
        return apiError(
            'Error en simulacion: ' + (error instanceof Error ? error.message : 'Unknown error'),
            {
                status: 500,
                code: 'PAYMENT_SIMULATION_FAILED',
                requestId,
            }
        );
    }
}

async function fallbackSimulation(
    supabaseAdmin: SupabaseAdminClient,
    offerId: string,
    fakePaymentId: string,
    testPhones?: {
        pickupPhone?: string;
        deliveryPhone?: string;
        pickupName?: string;
        deliveryName?: string;
    }
) {
    try {
        const pickupPin = String(Math.floor(1000 + Math.random() * 9000));
        const deliveryPin = String(Math.floor(1000 + Math.random() * 9000));

        const { data: offer, error: offerError } = await supabaseAdmin
            .from('cargo_offers')
            .select('*, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, country_code')
            .eq('id', offerId)
            .single();

        if (offerError || !offer) {
            return { success: false, error: 'Oferta no encontrada' };
        }

        const { error: updateError } = await supabaseAdmin
            .from('cargo_offers')
            .update({
                pickup_pin: pickupPin,
                delivery_pin: deliveryPin,
                status: 'reserved',
            })
            .eq('id', offerId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        await supabaseAdmin
            .from('payments')
            .update({
                status: 'completed',
                external_id: fakePaymentId,
                gateway_response: { _simulated: true },
                completed_at: new Date().toISOString(),
            })
            .eq('offer_id', offerId);

        const pickupPhone = testPhones?.pickupPhone || offer.pickup_contact_phone;
        const deliveryPhone = testPhones?.deliveryPhone || offer.delivery_contact_phone;
        const pickupName = testPhones?.pickupName || offer.pickup_contact_name || 'Contacto Recogida';
        const deliveryName = testPhones?.deliveryName || offer.delivery_contact_name || 'Contacto Entrega';

        await sendPinNotifications({
            pickup_pin: pickupPin,
            delivery_pin: deliveryPin,
            pickup_contact_phone: pickupPhone,
            pickup_contact_name: pickupName,
            delivery_contact_phone: deliveryPhone,
            delivery_contact_name: deliveryName,
            offer_id: offerId,
            country_code: offer.country_code || 'CO',
        });

        return {
            success: true,
            pickupPin,
            deliveryPin,
            smsSent: !!(pickupPhone && deliveryPhone),
            pickupContact: {
                name: pickupName,
                phone: pickupPhone,
            },
            deliveryContact: {
                name: deliveryName,
                phone: deliveryPhone,
            },
        };
    } catch (error: unknown) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function sendPinNotifications(result: NotificationPayload) {
    if (!result.pickup_contact_phone || !result.delivery_contact_phone) {
        console.log('[SIMULATION] Missing contact phones, skipping notifications');
        return;
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
        const internalApiKey = process.env.INTERNAL_API_KEY;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (internalApiKey) {
            headers['x-internal-api-key'] = internalApiKey;
        }

        const response = await fetch(`${baseUrl}/api/notifications/send-pin`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                offerId: result.offer_id || '',
                pickupPin: result.pickup_pin,
                deliveryPin: result.delivery_pin,
                pickupContactPhone: result.pickup_contact_phone,
                pickupContactName: result.pickup_contact_name || 'Contacto',
                deliveryContactPhone: result.delivery_contact_phone,
                deliveryContactName: result.delivery_contact_name || 'Contacto',
                countryCode: result.country_code || 'CO',
            }),
        });

        const notificationResult = await response.json();

        if (notificationResult.success) {
            console.log('[SIMULATION] PIN notifications sent successfully');
        } else {
            console.log('[SIMULATION] PIN notification issues:', notificationResult.errors);
        }
    } catch (error) {
        console.error('[SIMULATION] Error sending notifications:', error);
    }
}

export async function GET() {
    const isDev = process.env.NODE_ENV !== 'production';

    return apiSuccess({
        service: 'payment-simulation',
        available: isDev,
        description: 'Simulates a successful Mercado Pago payment for testing',
        usage: {
            method: 'POST',
            body: {
                offerId: 'uuid-of-offer-to-simulate',
            },
        },
        notificationProvider: process.env.NOTIFICATION_PROVIDER || 'console',
        twilioConfigured: !!(
            process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN &&
            process.env.TWILIO_PHONE_NUMBER
        ),
    }, {
        code: 'PAYMENT_SIMULATION_STATUS',
    });
}
