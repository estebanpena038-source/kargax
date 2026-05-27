import { NextRequest } from 'next/server';
import { preferenceApi } from '@/lib/mercadopago/config';
import { requireAal2Route } from '@/lib/server/route-auth';
import { getPaymentRuntimeConfig } from '@/lib/server/runtime-env';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    getBillingCheckoutInfrastructureStatus,
    getBusinessOperationsSetupMessage,
    getBusinessPlanSnapshot,
    isBillingPlanPaymentAttemptsTableMissing,
} from '@/lib/server/warehouses';
import { resolveBusinessRolePolicy } from '@/lib/server/role-policy';
import {
    buildBillingPlanPaymentReference,
    buildPaymentIdempotencyKey,
    serializePaymentReference,
} from '@/lib/contracts/payments';

function getBillingCheckoutConfig(planCurrency?: string | null) {
    const currencyId = (
        process.env.BILLING_PLAN_CURRENCY_ID
        || planCurrency
        || 'COP'
    ).trim().toUpperCase();

    return {
        currencyId,
    };
}

interface BillingCheckoutPreferenceBody {
    items: Array<{
        id: string;
        title: string;
        description: string;
        quantity: number;
        currency_id: string;
        unit_price: number;
    }>;
    payer: {
        email?: string;
        name: string;
    };
    back_urls: {
        success: string;
        failure: string;
        pending: string;
    };
    external_reference: string;
    statement_descriptor: string;
    metadata: {
        plan_code: string;
        business_id: string;
        current_plan: string;
        price_monthly_cop: number;
        gateway_currency: string;
        gateway_amount: number;
        country_code?: string;
    };
    auto_return?: 'approved';
    notification_url?: string;
    expires?: boolean;
    expiration_date_to?: string;
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const body = (await request.json()) as { planCode?: string; businessId?: string };
    const policy = await resolveBusinessRolePolicy(supabaseAdmin, authUser.id, profile, {
        requestedBusinessId: body.businessId,
    });

    if (!policy.capabilities.canManageBilling) {
        return apiError('Only owners or admins can purchase plans', {
            status: 403,
            code: 'BILLING_OWNER_REQUIRED',
            requestId,
        });
    }

    if (policy.scopeError) {
        return apiError(policy.scopeError.error || 'Business scope error', {
            status: policy.scopeError.status,
            code: 'BUSINESS_SCOPE_ERROR',
            requestId,
        });
    }

    const businessId = policy.businessId;
    const planCode = body.planCode;

    if (!businessId || !planCode) {
        return apiError('businessId and planCode are required', {
            status: 400,
            code: 'MISSING_BILLING_CHECKOUT_INPUT',
            requestId,
        });
    }

    const billingInfrastructure = await getBillingCheckoutInfrastructureStatus(supabaseAdmin);

    if (!billingInfrastructure.ready) {
        return apiError(billingInfrastructure.message || getBusinessOperationsSetupMessage(), {
            status: 503,
            code: 'BILLING_INFRASTRUCTURE_NOT_READY',
            requestId,
        });
    }

    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);
    const plan = snapshot.plans.find((candidate) => candidate.code === planCode);

    if (!plan) {
        return apiError('Plan not found', {
            status: 404,
            code: 'PLAN_NOT_FOUND',
            requestId,
        });
    }

    if (plan.action_state === 'current') {
        return apiError('This is already the active plan', {
            status: 400,
            code: 'PLAN_ALREADY_ACTIVE',
            requestId,
        });
    }

    if (plan.action_state === 'switch_now') {
        return apiError('This plan can be activated immediately without payment', {
            status: 409,
            code: 'PLAN_SWITCH_DOES_NOT_REQUIRE_CHECKOUT',
            requestId,
        });
    }

    if (plan.action_state === 'blocked_by_usage') {
        return apiError(plan.action_disabled_reason || 'Current usage exceeds the selected plan limits.', {
            status: 409,
            code: 'PLAN_LIMIT_BLOCKED',
            requestId,
        });
    }

    const priceMonthlyCop = Number(plan.price_monthly_cop ?? 0) || Math.round(Number(plan.price_monthly_usd || 0) * 4000);

    if (priceMonthlyCop <= 0) {
        return apiError('Free plan does not require checkout', {
            status: 400,
            code: 'FREE_PLAN_NO_CHECKOUT',
            requestId,
        });
    }

    const { baseUrl, isLocalhost } = getPaymentRuntimeConfig({
        requireWebhookSecret: true,
    });
    const { data: businessProfile } = await supabaseAdmin
        .from('business_profiles')
        .select('company_name, country_code')
        .eq('user_id', businessId)
        .maybeSingle();
    const countryCode = businessProfile?.country_code || (auth.context.profile as { country_code?: string } | null)?.country_code || 'CO';
    const checkoutConfig = getBillingCheckoutConfig(plan.billing_currency_code);
    const gatewayAmount = Math.round(priceMonthlyCop);

    // Cancel ALL previous pending attempts for this business (prevent race conditions)
    await supabaseAdmin
        .from('billing_plan_payment_attempts')
        .update({ status: 'cancelled' })
        .eq('business_id', businessId)
        .eq('status', 'pending');

    const { data: attempt, error: attemptError } = await supabaseAdmin
        .from('billing_plan_payment_attempts')
        .insert({
            business_id: businessId,
            plan_code: plan.code,
            status: 'pending',
            amount: gatewayAmount,
            created_by: authUser.id,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('*')
        .single();

    if (attemptError || !attempt) {
        if (attemptError && isBillingPlanPaymentAttemptsTableMissing(attemptError)) {
            return apiError(getBusinessOperationsSetupMessage(), {
                status: 503,
                code: 'BILLING_INFRASTRUCTURE_NOT_READY',
                requestId,
            });
        }

        return apiError(attemptError?.message || 'Could not create payment attempt', {
            status: 500,
            code: 'BILLING_ATTEMPT_CREATE_FAILED',
            requestId,
        });
    }

    const canonicalReference = buildBillingPlanPaymentReference({
        attempt_id: attempt.id,
        business_id: businessId,
        plan_code: plan.code,
        payer_id: authUser.id,
    });
    const idempotencyKey = buildPaymentIdempotencyKey([
        'kargax',
        'billing',
        canonicalReference.business_id,
        canonicalReference.plan_code,
        canonicalReference.attempt_id,
    ]);

    const preferenceBody: BillingCheckoutPreferenceBody = {
        items: [
            {
                id: plan.code,
                title: `KargaX ${plan.name}`,
                description: `Plan mensual ${plan.name} para ${businessProfile?.company_name || 'empresa KargaX'}`,
                quantity: 1,
                currency_id: checkoutConfig.currencyId,
                unit_price: gatewayAmount,
            },
        ],
        payer: {
            email: auth.context.profile?.email || auth.context.authUser.email || undefined,
            name: auth.context.profile?.full_name || 'Empresa KargaX',
        },
        back_urls: {
            success: `${baseUrl}/planes?pago=exitoso`,
            failure: `${baseUrl}/planes?pago=fallido`,
            pending: `${baseUrl}/planes?pago=pendiente`,
        },
        external_reference: serializePaymentReference(canonicalReference),
        statement_descriptor: 'KARGAX',
        metadata: {
            plan_code: plan.code,
            business_id: businessId,
            current_plan: snapshot.subscription?.plan_code || 'free',
            price_monthly_cop: priceMonthlyCop,
            gateway_currency: checkoutConfig.currencyId,
            gateway_amount: gatewayAmount,
            country_code: countryCode,
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
        .from('billing_plan_payment_attempts')
        .update({
            mp_preference_id: preference.id || null,
            mp_external_reference: preferenceBody.external_reference,
        })
        .eq('id', attempt.id);

    return apiSuccess({
        preference: {
            id: preference.id,
            init_point: preference.init_point,
            sandbox_init_point: preference.sandbox_init_point,
        },
        attemptId: attempt.id,
        planCode: plan.code,
        gatewayAmount,
        gatewayCurrency: checkoutConfig.currencyId,
        externalReference: canonicalReference,
        idempotencyKey,
    }, {
        code: 'BILLING_CHECKOUT_CREATED',
        requestId,
        meta: {
            paymentKind: 'billing_plan',
        },
    });
}
