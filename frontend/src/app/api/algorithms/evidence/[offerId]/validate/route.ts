import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { resolveBusinessRolePolicy } from '@/lib/server/role-policy';
import {
    assertCanViewAlgorithms,
    loadOfferAlgorithmRecords,
    persistAlgorithmOutputs,
    routeLabel,
    type EvidenceValidationData,
} from '@/app/api/algorithms/_shared';

export async function GET(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
    const requestId = getRequestId(request);
    const { offerId } = await params;
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;
    const policy = await resolveBusinessRolePolicy(supabaseAdmin, authUser.id, profile, {
        requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
    });

    if (policy.scopeError) {
        return apiError(policy.scopeError.error, {
            status: policy.scopeError.status,
            code: 'ALGORITHMS_SCOPE_DENIED',
            requestId,
        });
    }

    if (!policy.businessId || !assertCanViewAlgorithms(policy)) {
        return apiError('No puedes validar evidencia para esta empresa.', {
            status: 403,
            code: 'ALGORITHMS_EVIDENCE_FORBIDDEN',
            requestId,
        });
    }

    if (!policy.capabilities.canViewEvidence && !policy.capabilities.canViewIntelligence && !policy.capabilities.canViewOperations) {
        return apiError('Tu rol no puede consultar calidad de evidencia.', {
            status: 403,
            code: 'ALGORITHMS_EVIDENCE_ROLE_DENIED',
            requestId,
        });
    }

    try {
        const records = await loadOfferAlgorithmRecords(supabaseAdmin, {
            businessId: policy.businessId,
            offerId,
            limit: 1,
        });
        const record = records[0] || null;

        if (!record) {
            return apiError('Viaje no encontrado para esta empresa.', {
                status: 404,
                code: 'ALGORITHMS_EVIDENCE_NOT_FOUND',
                requestId,
            });
        }

        const snapshotPersistence = await persistAlgorithmOutputs(supabaseAdmin, {
            businessId: policy.businessId,
            userId: authUser.id,
            records: [record],
        });
        const data: EvidenceValidationData = {
            generatedAt: new Date().toISOString(),
            businessId: policy.businessId,
            role: policy.effectiveRole,
            offer: {
                id: record.offerId,
                status: record.status,
                rail: record.rail,
                route: routeLabel({
                    origin_city: record.originLabel,
                    destination_city: record.destinationLabel,
                }),
            },
            evidence: record.evidence,
            snapshotPersistence,
        };

        return apiSuccess(data, {
            code: 'ALGORITHMS_EVIDENCE_READY',
            requestId,
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'No se pudo validar la evidencia.', {
            status: 500,
            code: 'ALGORITHMS_EVIDENCE_FAILED',
            requestId,
        });
    }
}
