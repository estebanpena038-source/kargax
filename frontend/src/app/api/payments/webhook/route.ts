/**
 * =============================================================================
 * KARGAX - MERCADO PAGO WEBHOOK API
 * POST /api/payments/webhook
 *
 * Security:
 * - Validates webhook signature
 * - Ignores duplicate notifications safely
 * - Uses the shared freight reconciliation pipeline to keep webhook and
 *   browser-driven recovery aligned
 * =============================================================================
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paymentApi, validateWebhookSignature } from '@/lib/mercadopago/config';
import { reconcileFreightPaymentFromMercadoPagoPayment } from '@/lib/server/payments/freight-settlement';
import { releasePrivateFleetPayrollRun } from '@/lib/server/private-fleet-payroll';
import { createAdminNotification } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    type BillingPlanPaymentReference,
    parsePaymentReference,
    type PaymentReferenceData,
} from '@/lib/contracts/payments';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase service role no configurado para webhook de pagos');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

interface WebhookPayload {
    id: number;
    live_mode: boolean;
    type: string;
    date_created: string;
    user_id: number;
    api_version: string;
    action: string;
    data: {
        id: string;
    };
}

interface MercadoPagoPaymentLike {
    id?: string | number;
    status?: string | null;
    status_detail?: string | null;
    external_reference?: string | null;
    metadata?: Record<string, unknown> | null;
    order?: {
        id?: string | number;
    } | null;
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);

    try {
        const xSignature = request.headers.get('x-signature');
        const xRequestId = request.headers.get('x-request-id');
        const body: WebhookPayload = await request.json();
        const dataIdFromQuery =
            request.nextUrl.searchParams.get('data.id')
            || request.nextUrl.searchParams.get('id');

        console.log('[WEBHOOK] recibido:', {
            type: body.type,
            action: body.action,
            dataId: body.data?.id,
            queryDataId: dataIdFromQuery,
        });

        if (!validateWebhookSignature(xSignature, xRequestId, body.data?.id || '', dataIdFromQuery)) {
            console.warn('[WEBHOOK] firma invalida');
            return apiSuccess({
                received: true,
                processed: false,
                ignored: true,
                reason: 'invalid_signature',
            }, {
                code: 'WEBHOOK_IGNORED_INVALID_SIGNATURE',
                requestId,
            });
        }

        if (body.type !== 'payment') {
            console.log('[WEBHOOK] ignorado porque no es payment:', body.type);
            return apiSuccess({
                received: true,
                processed: false,
                ignored: true,
                reason: 'unsupported_type',
            }, {
                code: 'WEBHOOK_IGNORED_UNSUPPORTED_TYPE',
                requestId,
            });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const providerPaymentId = body.data.id;
        const mpPayment = await paymentApi.get({ id: providerPaymentId });

        console.log('[WEBHOOK] payment status:', {
            id: providerPaymentId,
            status: mpPayment.status,
            status_detail: mpPayment.status_detail,
            external_reference: mpPayment.external_reference,
        });

        const refData = parseExternalReference(mpPayment.external_reference);
        if (refData?.kind === 'billing_plan') {
            await handleBillingPlanPayment(supabaseAdmin, refData, mpPayment);
            return apiSuccess({
                received: true,
                processed: true,
                paymentKind: 'billing_plan',
            }, {
                code: 'WEBHOOK_PROCESSED',
                requestId,
            });
        }

        if (refData?.kind === 'private_fleet_payroll') {
            const payrollSync = await releasePrivateFleetPayrollRun(supabaseAdmin, refData, mpPayment);
            return apiSuccess({
                received: true,
                processed: payrollSync.released,
                duplicate: payrollSync.duplicate,
                paymentKind: 'private_fleet_payroll',
                sync: payrollSync,
            }, {
                code: payrollSync.released ? 'WEBHOOK_PROCESSED' : 'WEBHOOK_RECEIVED_NON_APPROVED_PAYMENT',
                requestId,
            });
        }

        const freightSync = await reconcileFreightPaymentFromMercadoPagoPayment(supabaseAdmin, mpPayment);

        if (freightSync.reason === 'missing_payment_reference') {
            console.error('[WEBHOOK] no se pudo resolver payment/offer para freight', {
                providerStatus: freightSync.providerStatus,
                external_reference: mpPayment.external_reference,
                metadata: mpPayment.metadata,
            });

            return apiSuccess({
                received: true,
                processed: false,
                ignored: true,
                paymentKind: 'freight',
                reason: 'missing_payment_reference',
                sync: freightSync,
            }, {
                code: 'WEBHOOK_IGNORED_MISSING_REFERENCE',
                requestId,
            });
        }

        if (freightSync.duplicate) {
            console.log('[WEBHOOK] notificacion duplicada detectada, se omite reproceso');
            return apiSuccess({
                received: true,
                processed: true,
                duplicate: true,
                paymentKind: 'freight',
                sync: freightSync,
            }, {
                code: 'WEBHOOK_DUPLICATE_IGNORED',
                requestId,
            });
        }

        if (mpPayment.status !== 'approved') {
            console.log('[WEBHOOK] pago no aprobado:', mpPayment.status);
            return apiSuccess({
                received: true,
                processed: false,
                paymentKind: 'freight',
                providerStatus: mpPayment.status || 'pending',
                sync: freightSync,
            }, {
                code: 'WEBHOOK_RECEIVED_NON_APPROVED_PAYMENT',
                requestId,
            });
        }

        return apiSuccess({
            received: true,
            processed: freightSync.settlementApplied || freightSync.duplicate,
            paymentKind: 'freight',
            sync: freightSync,
        }, {
            code: 'WEBHOOK_PROCESSED',
            requestId,
        });
    } catch (error) {
        console.error('[WEBHOOK] error:', error);
        return apiError('Internal error', {
            status: 500,
            code: 'WEBHOOK_PROCESSING_FAILED',
            requestId,
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

async function handleBillingPlanPayment(
    supabaseAdmin: SupabaseAdminClient,
    refData: BillingPlanPaymentReference | null,
    mpPayment: MercadoPagoPaymentLike
) {
    if (!refData?.attempt_id || !refData.business_id || !refData.plan_code) {
        console.error('[WEBHOOK] billing_plan external_reference incompleto');
        return;
    }

    const paymentId = String(mpPayment.id || '');
    const mappedStatus = mapBillingAttemptStatus(String(mpPayment.status || 'pending'));

    const { data: attempt } = await supabaseAdmin
        .from('billing_plan_payment_attempts')
        .select('*')
        .eq('id', refData.attempt_id)
        .maybeSingle();

    if (!attempt) {
        console.error('[WEBHOOK] billing_plan attempt not found', refData.attempt_id);
        return;
    }

    if (
        attempt.status === 'approved'
        && attempt.mp_payment_id
        && String(attempt.mp_payment_id) === paymentId
    ) {
        console.log('[WEBHOOK] billing plan duplicate notification skipped');
        return;
    }

    await supabaseAdmin
        .from('billing_plan_payment_attempts')
        .update({
            status: mappedStatus,
            mp_payment_id: paymentId || null,
            mp_preference_id: mpPayment.order?.id ? String(mpPayment.order.id) : attempt.mp_preference_id,
            gateway_response: mpPayment,
            paid_at: mpPayment.status === 'approved' ? new Date().toISOString() : attempt.paid_at,
        })
        .eq('id', attempt.id);

    if (mpPayment.status !== 'approved') {
        return;
    }

    const now = new Date();
    const { data: existingSubscription } = await supabaseAdmin
        .from('business_plan_subscriptions')
        .select('*')
        .eq('business_id', refData.business_id)
        .maybeSingle();

    const currentPeriodEnd = existingSubscription?.current_period_end
        ? new Date(existingSubscription.current_period_end)
        : null;
    const baseDate =
        currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime()
            ? currentPeriodEnd
            : now;
    const nextPeriodEnd = new Date(baseDate);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    const subscriptionPayload = {
        business_id: refData.business_id,
        plan_code: refData.plan_code,
        status: 'active' as const,
        current_period_start: now.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
    };

    if (existingSubscription?.id) {
        await supabaseAdmin
            .from('business_plan_subscriptions')
            .update(subscriptionPayload)
            .eq('id', existingSubscription.id);
    } else {
        await supabaseAdmin
            .from('business_plan_subscriptions')
            .insert(subscriptionPayload);
    }

    await createAdminNotification(supabaseAdmin, {
        type: 'billing_plan_payment',
        title: 'Plan empresarial actualizado',
        message: `La empresa ${refData.business_id} activo el plan ${refData.plan_code}.`,
        data: {
            business_id: refData.business_id,
            attempt_id: attempt.id,
            plan_code: refData.plan_code,
            mp_payment_id: paymentId,
            paid_at: new Date().toISOString(),
        },
    });
}

function parseExternalReference(externalReference: unknown): PaymentReferenceData | null {
    const parsed = parsePaymentReference(externalReference);

    if (!parsed && externalReference) {
        console.error('[WEBHOOK] error parsing external_reference');
    }

    return parsed;
}

function mapBillingAttemptStatus(mpStatus: string): 'pending' | 'approved' | 'processing' | 'failed' | 'cancelled' | 'refunded' {
    const normalizedStatus = String(mpStatus || '').toLowerCase();

    if (normalizedStatus === 'approved') {
        return 'approved';
    }

    if (['authorized', 'in_process', 'in_mediation'].includes(normalizedStatus)) {
        return 'processing';
    }

    if (['cancelled'].includes(normalizedStatus)) {
        return 'cancelled';
    }

    if (['refunded', 'charged_back'].includes(normalizedStatus)) {
        return 'refunded';
    }

    if (['rejected', 'failed'].includes(normalizedStatus)) {
        return 'failed';
    }

    return 'pending';
}
