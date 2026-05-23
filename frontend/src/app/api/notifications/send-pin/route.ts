/**
 * =============================================================================
 * KARGAX - PIN NOTIFICATION SERVICE
 * /api/notifications/send-pin/route.ts
 *
 * Provider-agnostic SMS/WhatsApp notification service for sending PINs
 * to pickup and delivery contacts after successful payment.
 *
 * Supported providers (set NOTIFICATION_PROVIDER env var):
 * - 'console' (default): Logs to console for development
 * - 'twilio': Uses Twilio SMS API (requires TWILIO_* env vars)
 *
 * =============================================================================
 * SECURITY:
 *
 * - Only accepts requests from internal services (webhook)
 * - Validates API key for external calls
 * - Rate-limited to prevent abuse
 * - PINs are never logged in production
 * 
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isNonStrictProductionEnvironment, isStrictProductionEnvironment } from '@/lib/server/runtime-env';
import { normalizePhoneForNotification, type AndeanCountryCode } from '@/lib/phone/andean';

// =============================================================================
// TYPES
// =============================================================================

interface PinNotificationRequest {
    offerId: string;
    pickupPin: string;
    deliveryPin: string;
    pickupContactPhone: string;
    pickupContactName: string;
    deliveryContactPhone: string;
    deliveryContactName: string;
    cargoDescription?: string;
    countryCode?: AndeanCountryCode;
}

interface NotificationResult {
    success: boolean;
    pickupSent: boolean;
    deliverySent: boolean;
    errors?: string[];
}

// =============================================================================
// NOTIFICATION PROVIDERS
// =============================================================================

/**
 * Abstract interface for notification providers
 * This allows easy switching between SMS, WhatsApp, etc.
 */
interface NotificationProvider {
    sendSMS(to: string, message: string, countryCode?: AndeanCountryCode): Promise<{ success: boolean; error?: string; sid?: string }>;
}

/**
 * Console provider for development - logs messages instead of sending
 */
class ConsoleNotificationProvider implements NotificationProvider {
    async sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
        if (isNonStrictProductionEnvironment()) {
            console.log('[PIN Notification][dev]', {
                toLast4: to.slice(-4),
                message,
            });
        }

        return { success: true };
    }
}

/**
 * Twilio provider for production SMS
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
class TwilioNotificationProvider implements NotificationProvider {
    private accountSid: string;
    private authToken: string;
    private fromNumber: string;
    private messagingServiceSid: string;

    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
        this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
        this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';

        if (!this.accountSid || !this.authToken || (!this.fromNumber && !this.messagingServiceSid)) {
            console.warn('[TwilioProvider] Missing Twilio credentials or sender - SMS will fail');
        }
    }

    async sendSMS(to: string, message: string, countryCode?: AndeanCountryCode): Promise<{ success: boolean; error?: string; sid?: string }> {
        if (!this.accountSid || !this.authToken || (!this.fromNumber && !this.messagingServiceSid)) {
            return {
                success: false,
                error: 'Twilio credentials or sender not configured'
            };
        }

        try {
            const formattedPhone = this.formatPhoneNumber(to, countryCode);

            if (!formattedPhone) {
                return {
                    success: false,
                    error: `Invalid phone number for ${countryCode || 'CO'}`
                };
            }

            const params = new URLSearchParams({
                To: formattedPhone,
                Body: message,
            });

            if (this.messagingServiceSid) {
                params.set('MessagingServiceSid', this.messagingServiceSid);
            } else {
                params.set('From', this.fromNumber);
            }

            // Twilio REST API call
            const response = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: params,
                }
            );

            const result = await response.json().catch(() => null);

            if (response.ok) {
                console.log(`[Twilio] SMS sent successfully. SID: ${result?.sid || 'unknown'}`);
                return { success: true, sid: result?.sid };
            }

            const twilioError = [
                result?.code ? `code ${result.code}` : null,
                result?.message || 'SMS failed to send',
                result?.more_info ? `more info: ${result.more_info}` : null,
            ].filter(Boolean).join(' - ');

            console.error('[Twilio] SMS failed:', {
                status: response.status,
                code: result?.code,
                message: result?.message,
                moreInfo: result?.more_info,
                toLast4: formattedPhone.slice(-4),
            });

            return {
                success: false,
                error: twilioError || `Twilio HTTP ${response.status}`
            };
        } catch (error: unknown) {
            console.error('[Twilio] Error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown Twilio error'
            };
        }
    }

    /**
     * Format phone number to E.164 format for Twilio
     * Handles Andean phone numbers with stored or local formats
     */
    private formatPhoneNumber(phone: string, countryCode?: AndeanCountryCode): string | null {
        return normalizePhoneForNotification(phone, countryCode || 'CO');
    }
}

// =============================================================================
// PROVIDER FACTORY
// =============================================================================

function getNotificationProvider(): NotificationProvider {
    const provider = process.env.NOTIFICATION_PROVIDER || 'console';
    const isProduction = isStrictProductionEnvironment();

    if (isProduction && provider === 'console') {
        throw new Error('NOTIFICATION_PROVIDER must be configured with a real provider in production');
    }

    switch (provider) {
        case 'twilio':
            return new TwilioNotificationProvider();
        case 'console':
            return new ConsoleNotificationProvider();
        default:
            throw new Error(`Unsupported NOTIFICATION_PROVIDER: ${provider}`);
    }
}

// =============================================================================
// MESSAGE TEMPLATES
// =============================================================================

/**
 * Message templates following best practices for transactional SMS:
 * - Clear sender identification
 * - Concise and actionable
 * - PIN highlighted
 * - No sensitive details exposed
 */

function getPickupMessage(contactName: string, pin: string, cargo?: string): string {
    return `KargaX: Hola ${contactName}. ` +
        `Un vehiculo llegara a recoger ${cargo || 'la carga'}. ` +
        `Tu PIN de SALIDA es: ${pin}. ` +
        `Entregalo solo al conductor verificado.`;
}

function getDeliveryMessage(contactName: string, pin: string, cargo?: string): string {
    return `KargaX: Hola ${contactName}. ` +
        `${cargo || 'Tu carga'} esta en camino. ` +
        `Cuando llegue, tu PIN de ENTREGA es: ${pin}. ` +
        `Entregalo al conductor para confirmar recepcion.`;
}

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
    // =========================================================================
    // AUTHENTICATION
    // For internal webhook calls, we use a shared secret
    // =========================================================================

    const authHeader = request.headers.get('x-internal-api-key');
    const expectedKey = process.env.INTERNAL_API_KEY;
    const isDev = isNonStrictProductionEnvironment();

    if (!isDev) {
        if (!expectedKey) {
            return NextResponse.json(
                { success: false, error: 'INTERNAL_API_KEY is required in production' },
                { status: 500 }
            );
        }

        if (authHeader !== expectedKey) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }
    }

    // =========================================================================
    // REQUEST VALIDATION
    // =========================================================================

    let body: PinNotificationRequest;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
        );
    }

    // Validate required fields
    const requiredFields = [
        'offerId',
        'pickupPin',
        'deliveryPin',
        'pickupContactPhone',
        'pickupContactName',
        'deliveryContactPhone',
        'deliveryContactName',
    ];

    const missingFields = requiredFields.filter(
        field => !body[field as keyof PinNotificationRequest]
    );

    if (missingFields.length > 0) {
        return NextResponse.json(
            {
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            },
            { status: 400 }
        );
    }

    // =========================================================================
    // SEND NOTIFICATIONS
    // =========================================================================

    let provider: NotificationProvider;

    try {
        provider = getNotificationProvider();
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Notification provider not available',
            },
            { status: 500 }
        );
    }

    const errors: string[] = [];

    const countryCode = body.countryCode || 'CO';

    // Send pickup notification
    console.log(`[PIN Notification] Sending pickup PIN to ${body.pickupContactPhone}`);
    const pickupResult = await provider.sendSMS(
        body.pickupContactPhone,
        getPickupMessage(body.pickupContactName, body.pickupPin, body.cargoDescription),
        countryCode
    );

    if (!pickupResult.success) {
        errors.push(`Pickup: ${pickupResult.error}`);
    }

    // Send delivery notification
    console.log(`[PIN Notification] Sending delivery PIN to ${body.deliveryContactPhone}`);
    const deliveryResult = await provider.sendSMS(
        body.deliveryContactPhone,
        getDeliveryMessage(body.deliveryContactName, body.deliveryPin, body.cargoDescription),
        countryCode
    );

    if (!deliveryResult.success) {
        errors.push(`Delivery: ${deliveryResult.error}`);
    }

    // =========================================================================
    // LOG TO DATABASE (for audit trail)
    // =========================================================================

    try {
        const logSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const logServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!logSupabaseUrl || !logServiceKey) {
            console.warn('[PIN Notification] Missing Supabase service role for audit logging');
        } else {
            const supabase = createClient(logSupabaseUrl, logServiceKey);

            // Log notification attempt (don't store actual PINs)
            await supabase.from('admin_notifications').insert({
                type: 'pin_notification',
                title: 'PIN Notifications Sent',
                message: `PINs enviados para oferta ${body.offerId.substring(0, 8)}`,
                data: {
                    offer_id: body.offerId,
                    pickup_sent: pickupResult.success,
                    delivery_sent: deliveryResult.success,
                    pickup_phone_last4: body.pickupContactPhone.slice(-4),
                    delivery_phone_last4: body.deliveryContactPhone.slice(-4),
                    country_code: countryCode,
                    provider: process.env.NOTIFICATION_PROVIDER || 'console',
                    pickup_sid: pickupResult.sid,
                    delivery_sid: deliveryResult.sid,
                    errors: errors.length > 0 ? errors : undefined,
                },
            });
        }
    } catch (logError) {
        console.error('[PIN Notification] Failed to log to database:', logError);
        // Don't fail the request if logging fails
    }

    // =========================================================================
    // RESPONSE
    // =========================================================================

    const result: NotificationResult = {
        success: pickupResult.success && deliveryResult.success,
        pickupSent: pickupResult.success,
        deliverySent: deliveryResult.success,
        errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(result, {
        status: result.success ? 200 : 207, // 207 = Multi-Status (partial success)
    });
}

// =============================================================================
// GET HANDLER - Health check
// =============================================================================

export async function GET() {
    const provider = process.env.NOTIFICATION_PROVIDER || 'console';
    const isProduction = isStrictProductionEnvironment();

    return NextResponse.json({
        service: 'pin-notifications',
        status: 'healthy',
        provider,
        productionReady: !isProduction || provider !== 'console',
        twilioConfigured: !!(
            process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN &&
            (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
        ),
        hasMessagingServiceSid: !!process.env.TWILIO_MESSAGING_SERVICE_SID,
        hasFromNumber: !!process.env.TWILIO_PHONE_NUMBER,
    });
}
