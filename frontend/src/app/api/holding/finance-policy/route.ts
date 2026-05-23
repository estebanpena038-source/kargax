import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route, requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    canManageHoldingFinance,
    getHoldingFinancePolicy,
    resolveHoldingAccessContext,
    upsertHoldingFinancePolicy,
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
                data: null,
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
                data: null,
            });
        }

        const response = await getHoldingFinancePolicy(
            supabaseAdmin,
            access.holdingAccountId,
            access.role
        );

        return NextResponse.json(response);
    } catch (error) {
        console.error('[HoldingFinancePolicy][GET]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const body = (await request.json()) as {
            holdingId?: string;
            maxSingleAdvanceCop?: number;
            maxBusinessExposureCop?: number;
            maxPortfolioExposureCop?: number;
            walletReleaseLimitCop?: number;
            autoApprovePlanUpgradesUntilUsd?: number;
            allowHighRiskOperations?: boolean;
            allowCriticalRiskOperations?: boolean;
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

        if (!access.holdingAccountId || !canManageHoldingFinance(access.role)) {
            return NextResponse.json({ error: 'Only holding managers can update finance policy' }, { status: 403 });
        }

        const policy = await upsertHoldingFinancePolicy(supabaseAdmin, {
            holdingAccountId: access.holdingAccountId,
            updatedBy: authUser.id,
            maxSingleAdvanceCop: Number(body.maxSingleAdvanceCop || 0),
            maxBusinessExposureCop: Number(body.maxBusinessExposureCop || 0),
            maxPortfolioExposureCop: Number(body.maxPortfolioExposureCop || 0),
            walletReleaseLimitCop: Number(body.walletReleaseLimitCop || 0),
            autoApprovePlanUpgradesUntilUsd: Number(body.autoApprovePlanUpgradesUntilUsd || 0),
            allowHighRiskOperations: Boolean(body.allowHighRiskOperations),
            allowCriticalRiskOperations: Boolean(body.allowCriticalRiskOperations),
        });

        return NextResponse.json({ data: policy });
    } catch (error) {
        console.error('[HoldingFinancePolicy][PATCH]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
