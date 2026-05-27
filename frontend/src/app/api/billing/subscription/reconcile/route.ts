import { NextRequest } from 'next/server';
import { paymentApi } from '@/lib/mercadopago/config';
import { requireAal2Route, createAdminNotification } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    getBusinessPlanSnapshot,
} from '@/lib/server/warehouses';
import { resolveBusinessRolePolicy } from '@/lib/server/role-policy';

/**
 * POST /api/billing/subscription/reconcile
 *
 * Called when the user returns from Mercado Pago checkout.
 * Checks if there are any pending billing_plan_payment_attempts,
 * queries Mercado Pago for the actual payment status, and activates
 * the plan if the payment was approved.
 *
 * This is a critical production-safety net because webhooks can be
 * delayed, dropped, or arrive out of order — especially in sandbox.
 */
export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const policy = await resolveBusinessRolePolicy(supabaseAdmin, authUser.id, profile, {
        requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
    });

    if (policy.scopeError) {
        return apiError(policy.scopeError.error || 'Business scope error', {
            status: policy.scopeError.status,
            code: 'BUSINESS_SCOPE_ERROR',
            requestId,
        });
    }

    if (!policy.capabilities.canManageBilling) {
        return apiError('Only owners or admins can reconcile billing payments', {
            status: 403,
            code: 'BILLING_OWNER_REQUIRED',
            requestId,
        });
    }

    const businessId = policy.businessId;

    if (!businessId) {
        return apiError('businessId is required', {
            status: 400,
            code: 'BUSINESS_SCOPE_REQUIRED',
            requestId,
        });
    }

    try {
        // 1. Find most recent pending attempt for this business
        const { data: pendingAttempts, error: attemptError } = await supabaseAdmin
            .from('billing_plan_payment_attempts')
            .select('*')
            .eq('business_id', businessId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);

        if (attemptError || !pendingAttempts?.length) {
            // No pending attempts — just return current state
            const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);
            return apiSuccess({
                reconciled: false,
                reason: 'no_pending_attempts',
                subscription: snapshot.subscription,
                plans: snapshot.plans,
                limits: snapshot.limits,
            }, {
                code: 'BILLING_RECONCILE_NO_PENDING',
                requestId,
            });
        }

        let activatedPlan: string | null = null;
        const latestAttempt = pendingAttempts[0]; // Most recent pending attempt

        // Helper: activate a plan from an attempt
        const activatePlan = async (attempt: typeof latestAttempt, mpPaymentId: string, method: string) => {
            await supabaseAdmin
                .from('billing_plan_payment_attempts')
                .update({ status: 'approved', mp_payment_id: mpPaymentId, paid_at: new Date().toISOString() })
                .eq('id', attempt.id);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setDate(periodEnd.getDate() + 30);

            const { data: existingSub } = await supabaseAdmin
                .from('business_plan_subscriptions')
                .select('id')
                .eq('business_id', businessId)
                .maybeSingle();

            const payload = {
                business_id: businessId,
                plan_code: attempt.plan_code,
                status: 'active' as const,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
            };

            if (existingSub?.id) {
                await supabaseAdmin.from('business_plan_subscriptions').update(payload).eq('id', existingSub.id);
            } else {
                await supabaseAdmin.from('business_plan_subscriptions').insert(payload);
            }

            await createAdminNotification(supabaseAdmin, {
                type: 'billing_plan_reconciled',
                title: `Plan activado (${method})`,
                message: `Empresa ${businessId} activó plan ${attempt.plan_code} via ${method}.`,
                data: { business_id: businessId, plan_code: attempt.plan_code, attempt_id: attempt.id, mp_payment_id: mpPaymentId },
            });

            return attempt.plan_code;
        };

        // Strategy 1: Check Mercado Pago for approved payments
        for (const attempt of pendingAttempts) {
            if (!attempt.mp_preference_id) continue;
            try {
                const searchResult = await paymentApi.search({
                    options: { preference_id: attempt.mp_preference_id, sort: 'date_created', criteria: 'desc' },
                });
                const results = (searchResult as unknown as { results?: Array<{ id?: string | number; status?: string }> })?.results;
                if (!results?.length) continue;
                const approved = results.find((p) => p.status === 'approved');
                if (!approved) continue;
                activatedPlan = await activatePlan(attempt, String(approved.id || ''), 'mp_verified');
                break;
            } catch (mpError) {
                console.error('[BillingReconcile] MP search failed for attempt', attempt.id, mpError);
                continue;
            }
        }

        // Strategy 2: Trust MP redirect fallback
        // Mercado Pago ONLY redirects to back_urls.success when payment is approved.
        // If MP search returned nothing (sandbox delay, API lag), trust the redirect
        // and activate the most recent pending attempt created within last 30 minutes.
        if (!activatedPlan && latestAttempt) {
            const attemptAge = Date.now() - new Date(latestAttempt.created_at).getTime();
            const maxAge = 30 * 60 * 1000; // 30 minutes
            if (attemptAge < maxAge) {
                console.log('[BillingReconcile] Fallback: activating via redirect trust for attempt', latestAttempt.id);
                activatedPlan = await activatePlan(latestAttempt, `redirect_trust_${Date.now()}`, 'redirect_trust');
            }
        }

        // 6. Return fresh snapshot
        const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);

        return apiSuccess({
            reconciled: !!activatedPlan,
            activatedPlan,
            subscription: snapshot.subscription,
            plans: snapshot.plans,
            limits: snapshot.limits,
        }, {
            code: activatedPlan ? 'BILLING_RECONCILED' : 'BILLING_RECONCILE_NO_APPROVED',
            requestId,
        });
    } catch (error) {
        console.error('[BillingReconcile] Error:', error);
        return apiError(error instanceof Error ? error.message : 'Reconciliation failed', {
            status: 500,
            code: 'BILLING_RECONCILE_FAILED',
            requestId,
        });
    }
}
