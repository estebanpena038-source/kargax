import { NextRequest } from 'next/server';
import { buildNextBestActions } from '@/algorithms/lastmile/nextBestAction';
import { buildExecutiveAlerts } from '@/algorithms/reports/executiveAlerts';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { resolveBusinessRolePolicy } from '@/lib/server/role-policy';
import { getBusinessPlanSnapshot } from '@/lib/server/warehouses';
import {
    assertCanViewAlgorithms,
    loadOfferAlgorithmRecords,
    persistAlgorithmOutputs,
    type AlgorithmOverviewData,
} from '@/app/api/algorithms/_shared';

function parseLimit(value: string | null) {
    const parsed = Number(value || 40);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 100)) : 40;
}

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;
    const requestedBusinessId = request.nextUrl.searchParams.get('businessId');
    const policy = await resolveBusinessRolePolicy(supabaseAdmin, authUser.id, profile, {
        requestedBusinessId,
    });

    if (policy.scopeError) {
        return apiError(policy.scopeError.error, {
            status: policy.scopeError.status,
            code: 'ALGORITHMS_SCOPE_DENIED',
            requestId,
        });
    }

    if (!policy.businessId || !assertCanViewAlgorithms(policy)) {
        return apiError('No puedes consultar inteligencia operacional para esta empresa.', {
            status: 403,
            code: 'ALGORITHMS_FORBIDDEN',
            requestId,
        });
    }

    try {
        const records = await loadOfferAlgorithmRecords(supabaseAdmin, {
            businessId: policy.businessId,
            month: request.nextUrl.searchParams.get('month'),
            limit: parseLimit(request.nextUrl.searchParams.get('limit')),
        });
        const deliveryRisks = records.map((record) => record.risk);
        const evidenceResults = records.map((record) => record.evidence);
        const nextBestActions = buildNextBestActions({
            role: policy.effectiveRole,
            capabilities: policy.capabilities,
            deliveryRisks,
            evidenceResults,
        });

        let billingUsagePercent: number | null = null;
        if (policy.capabilities.canViewFinance || policy.capabilities.canManageBilling) {
            try {
                const planSnapshot = await getBusinessPlanSnapshot(supabaseAdmin, policy.businessId);
                const maxTrips = planSnapshot.limits.maxMonthlyTrips;
                billingUsagePercent = maxTrips && maxTrips > 0
                    ? Math.round((planSnapshot.limits.monthlyTrips / maxTrips) * 100)
                    : null;
            } catch {
                billingUsagePercent = null;
            }
        }

        const executiveAlerts = buildExecutiveAlerts({
            businessId: policy.businessId,
            role: policy.effectiveRole,
            capabilities: policy.capabilities,
            deliveryRisks,
            evidenceResults,
            nextBestActions,
            billingUsagePercent,
        });
        const snapshotPersistence = await persistAlgorithmOutputs(supabaseAdmin, {
            businessId: policy.businessId,
            userId: authUser.id,
            records,
            alerts: executiveAlerts,
            actions: nextBestActions,
        });

        const data: AlgorithmOverviewData = {
            generatedAt: new Date().toISOString(),
            businessId: policy.businessId,
            role: policy.effectiveRole,
            summary: {
                evaluatedOffers: records.length,
                criticalRisks: deliveryRisks.filter((risk) => risk.riskLevel === 'critical').length,
                highRisks: deliveryRisks.filter((risk) => risk.riskLevel === 'high').length,
                incompleteEvidence: evidenceResults.filter((evidence) => evidence.status !== 'complete').length,
                nextActions: nextBestActions.length,
                executiveAlerts: executiveAlerts.length,
            },
            deliveryRisks: records,
            nextBestActions,
            executiveAlerts,
            snapshotPersistence,
        };

        return apiSuccess(data, {
            code: 'ALGORITHMS_LASTMILE_READY',
            requestId,
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'No se pudo calcular inteligencia operacional.', {
            status: 500,
            code: 'ALGORITHMS_LASTMILE_FAILED',
            requestId,
        });
    }
}
