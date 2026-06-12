import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { getBusinessPlanSnapshot, resolveBusinessAccessContext } from '@/lib/server/warehouses';

const RECOMMENDED_PLAN_BY_FEATURE: Record<string, string> = {
    warehouse_limit: 'starter',
    team_limit: 'starter',
    private_fleet_limit: 'starter',
    monthly_trip_limit: 'starter',
    report_exports: 'growth',
    api_access: 'scale',
};

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;
    const access = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const body = (await request.json().catch(() => ({}))) as {
        businessId?: string;
        featureKey?: string;
        currentUsage?: number;
        limitValue?: number | null;
        message?: string;
        metadata?: Record<string, unknown>;
    };
    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: body.businessId,
        resolvedBusinessId: access.businessId,
        profile,
    });

    if ('error' in scopedBusiness) {
        return apiError(scopedBusiness.error || 'Business scope error', {
            status: scopedBusiness.status,
            code: 'BUSINESS_SCOPE_ERROR',
            requestId,
        });
    }

    const businessId = scopedBusiness.businessId;
    if (!businessId) {
        return apiError('businessId es requerido', {
            status: 400,
            code: 'BUSINESS_SCOPE_REQUIRED',
            requestId,
        });
    }

    if (!body.featureKey) {
        return apiError('featureKey es requerido', {
            status: 400,
            code: 'PAYWALL_EVENT_VALIDATION_ERROR',
            requestId,
        });
    }

    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);
    const recommendedPlan = typeof body.metadata?.recommendedPlan === 'string'
        ? body.metadata.recommendedPlan
        : RECOMMENDED_PLAN_BY_FEATURE[body.featureKey] || 'starter';
    const limitText = body.limitValue == null ? 'sin limite definido' : String(body.limitValue);
    const usageText = body.currentUsage == null ? 'uso actual no informado' : String(body.currentUsage);
    const message = body.message
        || `Tu plan ${snapshot.subscription?.plan?.name || snapshot.subscription?.plan_code || 'Free'} permite ${limitText}. Uso actual: ${usageText}.`;

    const { data, error } = await supabaseAdmin
        .from('paywall_events')
        .insert({
            business_id: businessId,
            user_id: authUser.id,
            feature_key: body.featureKey,
            plan_code: snapshot.subscription?.plan_code || 'free',
            current_usage: body.currentUsage ?? null,
            limit_value: body.limitValue ?? null,
            recommended_plan: recommendedPlan,
            message,
            metadata: body.metadata || {},
        })
        .select('*')
        .single();

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'PAYWALL_EVENT_CREATE_FAILED',
            requestId,
        });
    }

    return apiSuccess({
        event: data,
        recommendedPlan,
        message,
        limits: snapshot.limits,
    }, {
        requestId,
        code: 'PAYWALL_EVENT_RECORDED',
    });
}
