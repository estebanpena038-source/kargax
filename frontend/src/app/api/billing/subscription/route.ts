import { NextRequest } from 'next/server';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    getBillingCheckoutInfrastructureStatus,
    getBusinessPlanSnapshot,
    resolveBusinessAccessContext,
} from '@/lib/server/warehouses';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

        if (!profile || !['business', 'admin'].includes(profile.user_type)) {
            return apiError('Only business and admin users can manage plans', {
                status: 403,
                code: 'BILLING_ROLE_REQUIRED',
                requestId,
            });
        }

        const scopedBusiness = resolveScopedBusinessId({
            requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
            resolvedBusinessId: businessAccess.businessId,
            profile,
            adminFallbackBusinessId: authUser.id,
        });

        if ('error' in scopedBusiness) {
            return apiError(scopedBusiness.error || 'Business scope error', {
                status: scopedBusiness.status,
                code: 'BUSINESS_SCOPE_ERROR',
                requestId,
            });
        }

        const businessId = scopedBusiness.businessId;
        const [snapshot, billingCheckoutStatus] = await Promise.all([
            getBusinessPlanSnapshot(supabaseAdmin, businessId),
            getBillingCheckoutInfrastructureStatus(supabaseAdmin),
        ]);

        return apiSuccess({
            subscription: snapshot.subscription,
            plans: snapshot.plans,
            limits: snapshot.limits,
            teamSchemaReady: snapshot.teamSchemaReady,
            teamSchemaMessage: snapshot.teamSchemaMessage,
            billingCheckoutReady: billingCheckoutStatus.ready,
            billingCheckoutMessage: billingCheckoutStatus.message,
            canManageBilling: businessAccess.isOwner || profile.user_type === 'admin',
        }, {
            code: 'BILLING_SUBSCRIPTION_LOADED',
            requestId,
            meta: {
                businessId,
            },
        });
    } catch (error) {
        console.error('[BillingSubscription][GET]', error);
        return apiError(error instanceof Error ? error.message : 'Internal server error', {
            status: 500,
            code: 'BILLING_SUBSCRIPTION_LOAD_FAILED',
            requestId,
        });
    }
}

export async function PATCH(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

        if (!profile || !['business', 'admin'].includes(profile.user_type)) {
            return apiError('Only business and admin users can manage plans', {
                status: 403,
                code: 'BILLING_ROLE_REQUIRED',
                requestId,
            });
        }

        const body = (await request.json()) as {
            planCode?: string;
            businessId?: string;
            status?: 'active' | 'trialing' | 'paused' | 'cancelled';
        };

        if (!body.planCode) {
            return apiError('planCode is required', {
                status: 400,
                code: 'PLAN_CODE_REQUIRED',
                requestId,
            });
        }

        const scopedBusiness = resolveScopedBusinessId({
            requestedBusinessId: body.businessId,
            resolvedBusinessId: businessAccess.businessId,
            profile,
            adminFallbackBusinessId: authUser.id,
        });

        if ('error' in scopedBusiness) {
            return apiError(scopedBusiness.error || 'Business scope error', {
                status: scopedBusiness.status,
                code: 'BUSINESS_SCOPE_ERROR',
                requestId,
            });
        }

        const businessId = scopedBusiness.businessId;

        if (!businessId || (!businessAccess.isOwner && profile.user_type !== 'admin')) {
            return apiError('Only owners or admins can update plans directly', {
                status: 403,
                code: 'BILLING_OWNER_REQUIRED',
                requestId,
            });
        }

        const [currentSnapshot, billingCheckout] = await Promise.all([
            getBusinessPlanSnapshot(supabaseAdmin, businessId),
            getBillingCheckoutInfrastructureStatus(supabaseAdmin),
        ]);
        const plan = currentSnapshot.plans.find((candidate) => candidate.code === body.planCode);

        if (!plan) {
            return apiError('Plan not found', {
                status: 404,
                code: 'PLAN_NOT_FOUND',
                requestId,
            });
        }

        if (plan.action_state === 'current') {
            return apiSuccess({
                subscription: currentSnapshot.subscription,
                plans: currentSnapshot.plans,
                limits: currentSnapshot.limits,
                teamSchemaReady: currentSnapshot.teamSchemaReady,
                teamSchemaMessage: currentSnapshot.teamSchemaMessage,
                billingCheckoutReady: billingCheckout.ready,
                billingCheckoutMessage: billingCheckout.message,
                canManageBilling: businessAccess.isOwner || profile.user_type === 'admin',
            }, {
                code: 'PLAN_ALREADY_ACTIVE',
                requestId,
                meta: {
                    businessId,
                },
            });
        }

        if (profile.user_type !== 'admin' && plan.action_state === 'checkout') {
            return apiError('This plan requires payment approval before activation.', {
                status: 400,
                code: 'PLAN_REQUIRES_CHECKOUT',
                requestId,
            });
        }

        if (profile.user_type !== 'admin' && plan.action_state === 'blocked_by_usage') {
            return apiError(plan.action_disabled_reason || 'Current usage exceeds the selected plan limits.', {
                status: 409,
                code: 'PLAN_LIMIT_BLOCKED',
                requestId,
            });
        }

        const now = new Date().toISOString();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const { data: existing } = await supabaseAdmin
            .from('business_plan_subscriptions')
            .select('id')
            .eq('business_id', businessId)
            .maybeSingle();

        const query = existing
            ? supabaseAdmin
                .from('business_plan_subscriptions')
                .update({
                    plan_code: body.planCode,
                    status: body.status || 'active',
                    current_period_start: now,
                    current_period_end: nextMonth.toISOString(),
                })
                .eq('id', existing.id)
            : supabaseAdmin
                .from('business_plan_subscriptions')
                .insert({
                    business_id: businessId,
                    plan_code: body.planCode,
                    status: body.status || 'active',
                    current_period_start: now,
                    current_period_end: nextMonth.toISOString(),
                });

        const { error } = await query;

        if (error) {
            return apiError(error.message, {
                status: 500,
                code: 'PLAN_UPDATE_FAILED',
                requestId,
            });
        }

        const [snapshot, billingCheckoutAfterUpdate] = await Promise.all([
            getBusinessPlanSnapshot(supabaseAdmin, businessId),
            getBillingCheckoutInfrastructureStatus(supabaseAdmin),
        ]);

        return apiSuccess({
            subscription: snapshot.subscription,
            plans: snapshot.plans,
            limits: snapshot.limits,
            teamSchemaReady: snapshot.teamSchemaReady,
            teamSchemaMessage: snapshot.teamSchemaMessage,
            billingCheckoutReady: billingCheckoutAfterUpdate.ready,
            billingCheckoutMessage: billingCheckoutAfterUpdate.message,
            canManageBilling: businessAccess.isOwner || profile.user_type === 'admin',
        }, {
            code: 'PLAN_UPDATED',
            requestId,
            meta: {
                businessId,
                planCode: body.planCode,
            },
        });
    } catch (error) {
        console.error('[BillingSubscription][PATCH]', error);
        return apiError(error instanceof Error ? error.message : 'Internal server error', {
            status: 500,
            code: 'BILLING_SUBSCRIPTION_UPDATE_FAILED',
            requestId,
        });
    }
}
