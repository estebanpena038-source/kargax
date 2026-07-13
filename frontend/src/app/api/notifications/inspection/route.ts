/**
 * =============================================================================
 * KARGAX - INSPECTION NOTIFICATION SERVICE
 * /api/notifications/inspection/route.ts
 * 
 * Enterprise-grade SMS/Email notification service for inspection events.
 * Notifies businesses when truckers complete loading/delivery with summary.
 * 
 * =============================================================================
 * NOTIFICATION TYPES:
 * - loading_completed: Carga completada, incluye resumen de items
 * - delivery_completed: Entrega completada, incluye resumen y rechazos
 * - issue_reported: Problema reportado durante inspección
 * 
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getNotificationRuntimeSnapshot, isNonStrictProductionEnvironment } from '@/lib/server/runtime-env';
import { normalizePhoneForNotification, type AndeanCountryCode } from '@/lib/phone/andean';
import { getInternalApiKeyFromRequest, safelyCompareSecrets } from '@/lib/server/route-auth';

// =============================================================================
// TYPES
// =============================================================================

interface InspectionSummary {
    total: number;
    loaded: number;
    delivered: number;
    rejected: number;
    withIssues: number;
    loadingCompliancePercent: number;
    deliveryCompliancePercent: number;
}

interface InspectionNotificationRequest {
    offerId: string;
    type: 'loading_completed' | 'delivery_completed' | 'issue_reported';
    businessPhone: string;
    businessEmail?: string;
    businessName: string;
    truckerName: string;
    originCity: string;
    destinationCity: string;
    summary: InspectionSummary;
    issueDetails?: {
        itemName: string;
        reason: string;
        notes?: string;
    };
    countryCode?: AndeanCountryCode;
}

// =============================================================================
// NOTIFICATION PROVIDER (abstracted for Twilio/Email integration)
// =============================================================================

interface NotificationProvider {
    sendSMS(to: string, message: string, countryCode?: AndeanCountryCode): Promise<{ success: boolean; error?: string; sid?: string }>;
    sendEmail?(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }>;
}

class ConsoleNotificationProvider implements NotificationProvider {
    async sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
        console.log('='.repeat(60));
        console.log('[DEV MODE] Inspection SMS Notification');
        console.log(`To: ${to}`);
        console.log(`Message: ${message}`);
        console.log('='.repeat(60));
        return { success: true };
    }

    async sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }> {
        console.log('='.repeat(60));
        console.log('[DEV MODE] Inspection Email Notification');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        console.log('='.repeat(60));
        return { success: true };
    }
}

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
    }

    async sendSMS(to: string, message: string, countryCode?: AndeanCountryCode): Promise<{ success: boolean; error?: string; sid?: string }> {
        if (!this.accountSid || !this.authToken || (!this.fromNumber && !this.messagingServiceSid)) {
            return { success: false, error: 'Twilio credentials or sender not configured' };
        }

        try {
            const formattedPhone = this.formatPhoneNumber(to, countryCode);
            if (!formattedPhone) {
                return { success: false, error: `Invalid phone number for ${countryCode || 'CO'}` };
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
                console.log(`[Twilio] Inspection SMS sent. SID: ${result?.sid || 'unknown'}`);
                return { success: true, sid: result?.sid };
            } else {
                console.error('[Twilio] SMS failed:', {
                    status: response.status,
                    code: result?.code,
                    message: result?.message,
                    moreInfo: result?.more_info,
                    toLast4: formattedPhone.slice(-4),
                });
                return { success: false, error: result?.message || `Twilio HTTP ${response.status}` };
            }
        } catch (error: unknown) {
            console.error('[Twilio] Error:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown Twilio error' };
        }
    }

    private formatPhoneNumber(phone: string, countryCode?: AndeanCountryCode): string | null {
        return normalizePhoneForNotification(phone, countryCode || 'CO');
    }
}

type NotificationRuntimeSnapshot = ReturnType<typeof getNotificationRuntimeSnapshot>;

function getNotificationRuntimeForRequest(request: NextRequest) {
    return getNotificationRuntimeSnapshot({
        requestHost: request.headers.get('host'),
        requestUrl: request.nextUrl.href,
    });
}

function getNotificationProvider(runtime: NotificationRuntimeSnapshot): NotificationProvider {
    const provider = runtime.effectiveProvider;

    if (runtime.requiresRealProvider && provider === 'console') {
        throw new Error('NOTIFICATION_PROVIDER must be configured with a real provider in production');
    }

    switch (provider) {
        case 'twilio': return new TwilioNotificationProvider();
        case 'console': return new ConsoleNotificationProvider();
        default: throw new Error(`Unsupported NOTIFICATION_PROVIDER: ${provider}`);
    }
}

function maskPhoneForLog(value: string) {
    const digits = value.replace(/\D/g, '');
    return digits ? `****${digits.slice(-4)}` : '****';
}

// =============================================================================
// MESSAGE TEMPLATES
// =============================================================================

function getLoadingCompletedMessage(req: InspectionNotificationRequest): string {
    const { truckerName, originCity, destinationCity, summary } = req;
    const issueText = summary.withIssues > 0
        ? ` ${summary.withIssues} con novedades.`
        : ' Sin novedades.';

    return `KargaX - Carga completada.\n` +
        `${truckerName} finalizó la carga en ${originCity}.\n` +
        `Items: ${summary.loaded}/${summary.total} cargados.${issueText}\n` +
        `Destino: ${destinationCity}\n` +
        `Ver detalles en la app.`;
}

function getDeliveryCompletedMessage(req: InspectionNotificationRequest): string {
    const { truckerName, destinationCity, summary } = req;
    const rejectionText = summary.rejected > 0
        ? ` ${summary.rejected} rechazados.`
        : '';

    return `KargaX - Entrega completada.\n` +
        `${truckerName} entregó en ${destinationCity}.\n` +
        `Items: ${summary.delivered}/${summary.total} entregados.${rejectionText}\n` +
        `Cumplimiento: ${summary.deliveryCompliancePercent}%\n` +
        `Ver reporte completo en la app.`;
}

function getIssueReportedMessage(req: InspectionNotificationRequest): string {
    const { truckerName, destinationCity, issueDetails } = req;

    return `KargaX - Problema reportado\n` +
        `${truckerName} en ${destinationCity}\n` +
        `Item: ${issueDetails?.itemName || 'No especificado'}\n` +
        `Motivo: ${issueDetails?.reason || 'No especificado'}\n` +
        `Revisa los detalles en la app.`;
}

function getMessage(req: InspectionNotificationRequest): string {
    switch (req.type) {
        case 'loading_completed': return getLoadingCompletedMessage(req);
        case 'delivery_completed': return getDeliveryCompletedMessage(req);
        case 'issue_reported': return getIssueReportedMessage(req);
        default: return 'KargaX - Notificación de inspección';
    }
}

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
    // Authentication: internal server-to-server calls may use INTERNAL_API_KEY.
    // User-triggered inspection events may use a Supabase Bearer token instead.
    const bearerHeader = request.headers.get('authorization');
    const expectedKey = process.env.INTERNAL_API_KEY;
    const isDev = isNonStrictProductionEnvironment();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const hasValidInternalKey = safelyCompareSecrets(getInternalApiKeyFromRequest(request), expectedKey);

    let hasValidBearerToken = false;
    if (bearerHeader?.startsWith('Bearer ') && supabaseUrl && serviceRoleKey) {
        try {
            const supabase = createClient(supabaseUrl, serviceRoleKey);
            const token = bearerHeader.replace('Bearer ', '').trim();
            const { data: authData, error: authError } = await supabase.auth.getUser(token);
            hasValidBearerToken = !!authData.user && !authError;
        } catch (error) {
            console.error('[Inspection Notification] Failed to validate bearer token:', error);
        }
    }

    if (!isDev) {
        if (!expectedKey && !hasValidBearerToken) {
            return NextResponse.json(
                { success: false, error: 'INTERNAL_API_KEY is required in production' },
                { status: 500 }
            );
        }

        if (!hasValidInternalKey && !hasValidBearerToken) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }
    }

    // Parse body
    let body: InspectionNotificationRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
        );
    }

    // Validate
    if (!body.offerId || !body.type || !body.businessPhone) {
        return NextResponse.json(
            { success: false, error: 'Missing required fields: offerId, type, businessPhone' },
            { status: 400 }
        );
    }

    // Send SMS
    let provider: NotificationProvider;
    const notificationRuntime = getNotificationRuntimeForRequest(request);

    try {
        provider = getNotificationProvider(notificationRuntime);
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Notification provider not available',
            },
            { status: 500 }
        );
    }

    const message = getMessage(body);

    console.log(`[Inspection Notification] Sending ${body.type} to ${maskPhoneForLog(body.businessPhone)}`);
    const smsResult = await provider.sendSMS(body.businessPhone, message, body.countryCode || 'CO');

    // Log to database
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabase.from('admin_notifications').insert({
            type: 'inspection_notification',
            title: `Inspection ${body.type}`,
            message: `Notification sent for offer ${body.offerId.substring(0, 8)}`,
            data: {
                offer_id: body.offerId,
                notification_type: body.type,
                sms_sent: smsResult.success,
                business_phone_last4: body.businessPhone.slice(-4),
                country_code: body.countryCode || 'CO',
                provider: notificationRuntime.effectiveProvider,
                configured_provider: notificationRuntime.configuredProvider,
                real_sms_enabled: notificationRuntime.realSmsEnabled,
                runtime_hostname: notificationRuntime.hostname,
                sms_sid: smsResult.sid,
                summary: body.summary,
                error: smsResult.error,
            },
        });
    } catch (logError) {
        console.error('[Inspection Notification] Failed to log:', logError);
    }

    return NextResponse.json({
        success: smsResult.success,
        smsSent: smsResult.success,
        error: smsResult.error,
    }, { status: smsResult.success ? 200 : 500 });
}

// =============================================================================
// GET HANDLER - Health check
// =============================================================================

export async function GET(request: NextRequest) {
    const notificationRuntime = getNotificationRuntimeForRequest(request);

    return NextResponse.json({
        service: 'inspection-notifications',
        status: 'healthy',
        provider: notificationRuntime.effectiveProvider,
        configuredProvider: notificationRuntime.configuredProvider,
        realSmsEnabled: notificationRuntime.realSmsEnabled,
        stagingEnvironment: notificationRuntime.stagingEnvironment,
        productionHost: notificationRuntime.productionHost,
        runtimeHostname: notificationRuntime.hostname,
        supportedTypes: ['loading_completed', 'delivery_completed', 'issue_reported'],
    });
}
