import { NextRequest } from 'next/server';
import { isBillingMercadoPagoCheckoutConfigured } from '@/lib/mercadopago/config';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    decorateBillingPlanForCountry,
    getBillingCountryLabel,
    getBillingCurrencyForCountry,
    getBillingPlanUsdToLocalRate,
    loadPublicBillingPlans,
    normalizeBillingCheckoutCountryCode,
    SUPPORTED_BILLING_CHECKOUT_COUNTRIES,
} from '@/lib/server/warehouses';
import type { BillingPlan } from '@/lib/warehouses/types';

function pickPublicFeatureMatrix(plan: BillingPlan) {
    const source = plan.feature_matrix || {};
    const keys = [
        'billing_price_mode',
        'usd_anchor',
        'starts_at',
        'contact_sales_only',
        'marketplace_commission_percent',
        'commercial_position',
    ];

    return Object.fromEntries(
        keys
            .filter((key) => key in source)
            .map((key) => [key, source[key]])
    );
}

function serializePublicPlan(plan: BillingPlan) {
    return {
        code: plan.code,
        name: plan.name,
        tagline: plan.tagline,
        price_monthly_usd: plan.price_monthly_usd,
        price_monthly_cop: plan.price_monthly_cop,
        billing_currency_code: plan.billing_currency_code,
        billing_country_code: plan.billing_country_code ?? null,
        local_currency_code: plan.local_currency_code ?? null,
        price_monthly_local: plan.price_monthly_local ?? null,
        usd_anchor: plan.usd_anchor ?? null,
        fx_rate_usd_to_local: plan.fx_rate_usd_to_local ?? null,
        self_serve_checkout_enabled: plan.self_serve_checkout_enabled ?? false,
        max_warehouses: plan.max_warehouses,
        max_internal_users: plan.max_internal_users,
        max_monthly_trips: plan.max_monthly_trips,
        max_private_fleet_drivers: plan.max_private_fleet_drivers,
        includes_inventory: plan.includes_inventory,
        includes_locations: plan.includes_locations,
        includes_receipts: plan.includes_receipts,
        includes_dispatches: plan.includes_dispatches,
        includes_analytics: plan.includes_analytics,
        includes_api_webhooks: plan.includes_api_webhooks,
        includes_multi_client_3pl: plan.includes_multi_client_3pl,
        is_public: plan.is_public,
        support_tier: plan.support_tier,
        feature_matrix: pickPublicFeatureMatrix(plan),
        created_at: plan.created_at,
        updated_at: plan.updated_at,
    };
}

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const requestedCountry = request.nextUrl.searchParams.get('country') || process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || 'CO';
    const countryCode = normalizeBillingCheckoutCountryCode(requestedCountry);

    if (!countryCode) {
        return apiError('El checkout automatico de planes solo esta activo en Colombia, Peru y Brasil.', {
            requestId,
            status: 400,
            code: 'PUBLIC_BILLING_COUNTRY_NOT_SUPPORTED',
            details: {
                requestedCountry,
                supportedCountries: SUPPORTED_BILLING_CHECKOUT_COUNTRIES,
            },
        });
    }

    try {
        const plans = await loadPublicBillingPlans();
        const checkoutConfigured = isBillingMercadoPagoCheckoutConfigured(countryCode);
        const localizedPlans = plans.map((plan) => ({
            ...decorateBillingPlanForCountry(plan, countryCode),
            self_serve_checkout_enabled: checkoutConfigured,
        }));
        const billingCurrencyCode = getBillingCurrencyForCountry(countryCode);

        return apiSuccess({
            plans: localizedPlans.map(serializePublicPlan),
            billingCountryCode: countryCode,
            billingCountryLabel: getBillingCountryLabel(countryCode),
            billingCurrencyCode,
            usdToLocalRate: getBillingPlanUsdToLocalRate(billingCurrencyCode),
            checkoutConfigured,
            supportedCountries: SUPPORTED_BILLING_CHECKOUT_COUNTRIES.map((code) => ({
                code,
                label: getBillingCountryLabel(code),
                currencyCode: getBillingCurrencyForCountry(code),
                checkoutConfigured: isBillingMercadoPagoCheckoutConfigured(code),
            })),
        }, {
            requestId,
            code: 'PUBLIC_BILLING_PLANS_LOADED',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'No se pudieron cargar los planes publicos', {
            requestId,
            status: 500,
            code: 'PUBLIC_BILLING_PLANS_FAILED',
        });
    }
}
