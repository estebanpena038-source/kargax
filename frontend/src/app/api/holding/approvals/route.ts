import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route, requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    canApproveHoldingRequest,
    canManageHoldingFinance,
    createHoldingApproval,
    decideHoldingApproval,
    getHoldingFinancePolicy,
    getHoldingApprovals,
    getHoldingBusinesses,
    resolveHoldingAccessContext,
} from '@/lib/server/holding';

export async function GET(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveHoldingAccessContext(
            supabaseAdmin,
            authUser.id,
            profile,
            request.nextUrl.searchParams.get('holdingId')
        );

        if (!access.ready) {
            return NextResponse.json({
                ready: false,
                message: access.message,
                holdingAccountId: null,
                role: access.role,
                capabilities: access.capabilities,
                canManageHolding: false,
                data: [],
            });
        }

        if (!access.holdingAccountId) {
            return NextResponse.json({
                ready: true,
                message: null,
                holdingAccountId: null,
                role: null,
                capabilities: null,
                canManageHolding: false,
                data: [],
            });
        }

        const response = await getHoldingApprovals(
            supabaseAdmin,
            access.holdingAccountId,
            access.role
        );

        return NextResponse.json(response);
    } catch (error) {
        console.error('[HoldingApprovals][GET]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const body = (await request.json()) as {
            holdingId?: string;
            businessId?: string;
            requestType?: 'business_link' | 'credit_policy' | 'wallet_release' | 'plan_upgrade' | 'ops_exception' | 'custom';
            priority?: 'low' | 'medium' | 'high' | 'critical';
            title?: string;
            description?: string;
            payload?: Record<string, unknown>;
        };
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveHoldingAccessContext(
            supabaseAdmin,
            authUser.id,
            profile,
            body.holdingId || null
        );

        if (!access.ready) {
            return NextResponse.json(
                { error: access.message || 'Holding infrastructure is not ready' },
                { status: 503 }
            );
        }

        if (!access.holdingAccountId) {
            return NextResponse.json({ error: 'No holding account selected' }, { status: 403 });
        }

        const requestType = body.requestType || 'custom';
        const title = body.title?.trim();
        const requestPayload = body.payload && typeof body.payload === 'object' ? { ...body.payload } : {};
        let businessId = body.businessId || null;

        if (!title) {
            return NextResponse.json({ error: 'title is required' }, { status: 400 });
        }

        if (!['business_link', 'credit_policy', 'wallet_release', 'plan_upgrade', 'ops_exception', 'custom'].includes(requestType)) {
            return NextResponse.json({ error: 'Invalid requestType' }, { status: 400 });
        }

        if (requestType === 'business_link' && businessId) {
            const businessContext = await getHoldingBusinesses(
                supabaseAdmin,
                authUser.id,
                profile,
                access.holdingAccountId,
                access.role,
                access.accounts
            );
            const targetBusiness = businessContext.catalog.find((business) => business.business_id === businessId)
                || businessContext.linked.find((business) => business.business_id === businessId);

            if (!targetBusiness) {
                return NextResponse.json(
                    { error: 'You do not have permission to request this business link' },
                    { status: 403 }
                );
            }
        }

        if (requestType !== 'business_link' && typeof requestPayload.businessId === 'string' && !businessId) {
            businessId = requestPayload.businessId;
        }

        if (['plan_upgrade', 'wallet_release', 'ops_exception'].includes(requestType)) {
            if (!businessId) {
                return NextResponse.json({ error: 'businessId is required for this request type' }, { status: 400 });
            }

            const { data: linkedBusiness, error: linkedBusinessError } = await supabaseAdmin
                .from('holding_business_links')
                .select('business_id')
                .eq('holding_account_id', access.holdingAccountId)
                .eq('business_id', businessId)
                .eq('status', 'linked')
                .maybeSingle();

            if (linkedBusinessError) {
                return NextResponse.json(
                    { error: linkedBusinessError.message || 'Could not verify holding business access' },
                    { status: 500 }
                );
            }

            if (!linkedBusiness) {
                return NextResponse.json(
                    { error: 'The selected business is not linked to this holding account' },
                    { status: 403 }
                );
            }
        }

        if (requestType === 'plan_upgrade') {
            const planCode = typeof requestPayload.planCode === 'string' ? requestPayload.planCode.trim() : '';

            if (!businessId || !planCode) {
                return NextResponse.json(
                    { error: 'plan_upgrade requires businessId and payload.planCode' },
                    { status: 400 }
                );
            }

            const { data: plan, error: planError } = await supabaseAdmin
                .from('billing_plans')
                .select('code, name, price_monthly_cop, price_monthly_usd')
                .eq('code', planCode)
                .maybeSingle();

            if (planError) {
                return NextResponse.json(
                    { error: planError.message || 'Could not validate target plan' },
                    { status: 500 }
                );
            }

            if (!plan) {
                return NextResponse.json({ error: 'Target plan not found' }, { status: 404 });
            }

            requestPayload.businessId = businessId;
            requestPayload.planCode = plan.code;
            requestPayload.targetPlanName = plan.name;
            requestPayload.monthlyPriceCop = Number(plan.price_monthly_cop || Math.round(Number(plan.price_monthly_usd || 0) * 4000));
            requestPayload.monthlyPriceUsd = Number(plan.price_monthly_usd || 0);
        }

        if (requestType === 'wallet_release') {
            const amount = Number(requestPayload.amount || 0);
            const targetUserId = typeof requestPayload.userId === 'string' ? requestPayload.userId : businessId;

            if (!businessId || amount <= 0) {
                return NextResponse.json(
                    { error: 'wallet_release requires businessId and a positive payload.amount' },
                    { status: 400 }
                );
            }

            requestPayload.businessId = businessId;
            requestPayload.userId = targetUserId;
            requestPayload.amount = amount;
            requestPayload.description = typeof requestPayload.description === 'string'
                ? requestPayload.description
                : body.description || title;
        }

        if (requestType === 'ops_exception') {
            const advanceId = typeof requestPayload.advanceId === 'string' ? requestPayload.advanceId.trim() : '';
            const advanceAction = typeof requestPayload.advanceAction === 'string' ? requestPayload.advanceAction.trim() : '';

            if (!advanceId || !['approve', 'reject', 'mark_restructured', 'write_off'].includes(advanceAction)) {
                return NextResponse.json(
                    { error: 'ops_exception requires payload.advanceId and a valid payload.advanceAction' },
                    { status: 400 }
                );
            }

            requestPayload.businessId = businessId;
        }

        if (requestType === 'credit_policy') {
            requestPayload.maxSingleAdvanceCop = Number(requestPayload.maxSingleAdvanceCop || 0);
            requestPayload.maxBusinessExposureCop = Number(requestPayload.maxBusinessExposureCop || 0);
            requestPayload.maxPortfolioExposureCop = Number(requestPayload.maxPortfolioExposureCop || 0);
            requestPayload.walletReleaseLimitCop = Number(requestPayload.walletReleaseLimitCop || 0);
            requestPayload.autoApprovePlanUpgradesUntilUsd = Number(requestPayload.autoApprovePlanUpgradesUntilUsd || 0);
            requestPayload.allowHighRiskOperations = Boolean(requestPayload.allowHighRiskOperations);
            requestPayload.allowCriticalRiskOperations = Boolean(requestPayload.allowCriticalRiskOperations);
        }

        let approval = await createHoldingApproval(supabaseAdmin, {
            holdingAccountId: access.holdingAccountId,
            businessId,
            requestType,
            priority: body.priority || 'medium',
            title,
            description: body.description || null,
            requestPayload,
            requestedBy: authUser.id,
        });

        let mode: 'pending' | 'auto_approved' = 'pending';

        if (canManageHoldingFinance(access.role) && ['plan_upgrade', 'wallet_release'].includes(requestType)) {
            const financePolicy = await getHoldingFinancePolicy(
                supabaseAdmin,
                access.holdingAccountId,
                access.role
            );

            if (financePolicy.ready && financePolicy.data) {
                const canAutoApprovePlanUpgrade =
                    requestType === 'plan_upgrade' &&
                    Number(requestPayload.monthlyPriceCop || 0) > 0 &&
                    Number(requestPayload.monthlyPriceCop || 0) <= Number(financePolicy.data.auto_approve_plan_upgrades_until_usd || 0);
                const canAutoApproveWalletRelease =
                    requestType === 'wallet_release' &&
                    Number(requestPayload.amount || 0) > 0 &&
                    Number(requestPayload.amount || 0) <= Number(financePolicy.data.wallet_release_limit_cop || 0);

                if ((canAutoApprovePlanUpgrade || canAutoApproveWalletRelease) && canApproveHoldingRequest(access.role, requestType, 'finance_admin')) {
                    approval = await decideHoldingApproval(supabaseAdmin, {
                        approvalId: approval.id,
                        holdingAccountId: access.holdingAccountId,
                        status: 'approved',
                        decisionNote: 'Auto approved by holding finance policy.',
                        assignedTo: authUser.id,
                        decidedBy: authUser.id,
                    });
                    mode = 'auto_approved';
                }
            }
        }

        return NextResponse.json({ data: approval, mode }, { status: mode === 'auto_approved' ? 200 : 201 });
    } catch (error) {
        console.error('[HoldingApprovals][POST]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
