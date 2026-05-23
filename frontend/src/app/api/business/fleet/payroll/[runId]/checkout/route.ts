import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import { isMercadoPagoTestMode, preferenceApi } from '@/lib/mercadopago/config';
import { getPaymentRuntimeConfig } from '@/lib/server/runtime-env';
import {
    buildPaymentIdempotencyKey,
    buildPrivateFleetPayrollPaymentReference,
    serializePaymentReference,
} from '@/lib/contracts/payments';
import { resolvePrivateFleetPayrollAccess } from '@/lib/server/private-fleet-payroll';

interface PayrollPreferenceBody {
    items: Array<{
        id: string;
        title: string;
        description: string;
        quantity: number;
        currency_id: 'COP' | 'USD' | 'PEN' | 'BRL';
        unit_price: number;
    }>;
    payer: {
        name: string;
        email?: string;
    };
    back_urls: {
        success: string;
        failure: string;
        pending: string;
    };
    external_reference: string;
    statement_descriptor: string;
    metadata: {
        payroll_run_id: string;
        business_id: string;
        gross_amount: number;
        processing_fee_amount: number;
        total_amount: number;
        currency_code: string;
    };
    auto_return?: 'approved';
    notification_url?: string;
    expires?: boolean;
    expiration_date_to?: string;
}

function normalizeCurrency(value: unknown): 'COP' | 'USD' | 'PEN' | 'BRL' {
    const candidate = typeof value === 'string' ? value.toUpperCase() : 'COP';
    return (['COP', 'USD', 'PEN', 'BRL'] as const).includes(candidate as 'COP' | 'USD' | 'PEN' | 'BRL')
        ? candidate as 'COP' | 'USD' | 'PEN' | 'BRL'
        : 'COP';
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { runId } = await params;
    const body = await request.json().catch(() => ({})) as { businessId?: string };
    const { supabaseAdmin, authUser, profile } = auth.context;
    const payrollAccess = await resolvePrivateFleetPayrollAccess(
        supabaseAdmin,
        authUser.id,
        profile,
        body.businessId
    );

    if (!payrollAccess.businessId) {
        return apiError('Business access required', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_PAYROLL_BUSINESS_REQUIRED',
        });
    }

    if (!payrollAccess.canManagePayroll) {
        return apiError('Solo owner/admin/contabilidad puede fondear nomina privada.', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_PAYROLL_CHECKOUT_FORBIDDEN',
        });
    }

    const { data: run, error: runError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .select('*')
        .eq('id', runId)
        .eq('business_id', payrollAccess.businessId)
        .maybeSingle();

    if (runError || !run) {
        return apiError(runError?.message || 'Corrida de nomina no encontrada', {
            requestId,
            status: 404,
            code: 'PRIVATE_FLEET_PAYROLL_NOT_FOUND',
        });
    }

    if (!['approved', 'checkout_pending'].includes(run.status)) {
        return apiError('La nomina debe estar aprobada antes de fondearse.', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_PAYROLL_NOT_APPROVED',
        });
    }

    const totalAmount = Math.round(Number(run.total_amount || 0));
    if (totalAmount <= 0) {
        return apiError('La nomina no tiene monto para fondear.', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_PAYROLL_EMPTY',
        });
    }

    const [{ data: businessProfile }, { count: itemCount }] = await Promise.all([
        supabaseAdmin
            .from('business_profiles')
            .select('company_name')
            .eq('user_id', payrollAccess.businessId)
            .maybeSingle(),
        supabaseAdmin
            .from('private_fleet_payroll_items')
            .select('id', { count: 'exact', head: true })
            .eq('run_id', run.id)
            .gt('amount', 0),
    ]);

    const { baseUrl, isLocalhost } = getPaymentRuntimeConfig({
        requireWebhookSecret: true,
    });

    if (!isLocalhost && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
        return apiError('El webhook de Mercado Pago no esta configurado para este ambiente publico', {
            status: 503,
            code: 'PAYMENT_WEBHOOK_NOT_CONFIGURED',
            requestId,
        });
    }

    const canonicalReference = buildPrivateFleetPayrollPaymentReference({
        run_id: run.id,
        business_id: payrollAccess.businessId,
        payer_id: authUser.id,
    });
    const idempotencyKey = buildPaymentIdempotencyKey([
        'kargax',
        'private-fleet-payroll',
        canonicalReference.business_id,
        canonicalReference.run_id,
    ]);
    const returnParams = new URLSearchParams({
        payroll_run_id: run.id,
        payment_kind: 'private_fleet_payroll',
    });
    const currencyCode = normalizeCurrency(run.currency_code);

    const preferenceBody: PayrollPreferenceBody = {
        items: [
            {
                id: run.id,
                title: `Nomina flota privada ${String(run.period_start).slice(0, 7)}`,
                description: `${itemCount || 0} conductor(es) de ${businessProfile?.company_name || 'empresa KargaX'}`,
                quantity: 1,
                currency_id: currencyCode,
                unit_price: totalAmount,
            },
        ],
        payer: {
            name: profile?.full_name || businessProfile?.company_name || 'Empresa KargaX',
            email: isMercadoPagoTestMode
                ? 'test@testuser.com'
                : (profile?.email || authUser.email || undefined),
        },
        back_urls: {
            success: `${baseUrl}/dashboard/flota?pago=nomina_exitoso&${returnParams.toString()}`,
            failure: `${baseUrl}/dashboard/flota?pago=nomina_fallido&${returnParams.toString()}`,
            pending: `${baseUrl}/dashboard/flota?pago=nomina_pendiente&${returnParams.toString()}`,
        },
        external_reference: serializePaymentReference(canonicalReference),
        statement_descriptor: 'KARGAX',
        metadata: {
            payroll_run_id: run.id,
            business_id: payrollAccess.businessId,
            gross_amount: Number(run.gross_amount || 0),
            processing_fee_amount: Number(run.processing_fee_amount || 0),
            total_amount: totalAmount,
            currency_code: currencyCode,
        },
    };

    if (!isLocalhost) {
        preferenceBody.auto_return = 'approved';
        preferenceBody.notification_url = `${baseUrl}/api/payments/webhook`;
        preferenceBody.expires = true;
        preferenceBody.expiration_date_to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    const preference = await preferenceApi.create({
        body: preferenceBody,
        requestOptions: {
            idempotencyKey,
        },
    });

    await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .update({
            status: 'checkout_pending',
            mp_preference_id: preference.id || null,
            mp_external_reference: preferenceBody.external_reference,
        })
        .eq('id', run.id);

    return apiSuccess({
        preference: {
            id: preference.id,
            init_point: preference.init_point,
            sandbox_init_point: preference.sandbox_init_point,
        },
        runId: run.id,
        grossAmount: Number(run.gross_amount || 0),
        processingFeeAmount: Number(run.processing_fee_amount || 0),
        totalAmount,
        currencyCode,
        externalReference: canonicalReference,
        idempotencyKey,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_PAYROLL_CHECKOUT_CREATED',
        meta: {
            paymentKind: 'private_fleet_payroll',
        },
    });
}
