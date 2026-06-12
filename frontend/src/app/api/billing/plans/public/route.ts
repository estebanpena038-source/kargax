import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    getBillingPlanUsdToCopRate,
    loadPublicBillingPlans,
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

    try {
        const plans = await loadPublicBillingPlans();

        return apiSuccess({
            plans: plans.map(serializePublicPlan),
            billingCurrencyCode: 'COP',
            usdToCopRate: getBillingPlanUsdToCopRate(),
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
