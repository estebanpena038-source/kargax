import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { resolveBusinessRolePolicy } from '@/lib/server/role-policy';
import {
    intelligenceAlertsParamsSchema,
    assertCanViewAlgorithms,
    type Row,
} from '@/app/api/intelligence/_shared';

const SEVERITY_ORDER: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);

    // 1. Authentication Check
    const auth = await requireAuthenticatedRoute(request);
    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;

    // 2. Validate Query Parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parseResult = intelligenceAlertsParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
        return apiError('Parámetros de consulta inválidos.', {
            status: 400,
            code: 'INVALID_PARAMS',
            requestId,
            details: parseResult.error.flatten().fieldErrors,
        });
    }

    const { businessId: requestedBusinessId, severity, status, limit } = parseResult.data;

    // 3. Resolve Role & Access Policy
    const policy = await resolveBusinessRolePolicy(supabaseAdmin, authUser.id, profile, {
        requestedBusinessId,
    });

    if (policy.scopeError) {
        return apiError(policy.scopeError.error, {
            status: policy.scopeError.status,
            code: 'INTELLIGENCE_SCOPE_DENIED',
            requestId,
        });
    }

    if (!policy.businessId || !assertCanViewAlgorithms(policy)) {
        return apiError('No tienes permisos para consultar alertas de inteligencia para esta empresa.', {
            status: 403,
            code: 'INTELLIGENCE_FORBIDDEN',
            requestId,
        });
    }

    try {
        // 4. Query algorithm_alerts Table
        let query = supabaseAdmin
            .from('algorithm_alerts')
            .select('id, business_id, offer_id, alert_type, severity, title, description, status, metadata, created_at, updated_at')
            .eq('business_id', policy.businessId)
            .eq('status', status)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (severity && severity.length > 0) {
            query = query.in('severity', severity);
        }

        const { data: alertsData, error } = await query;

        if (error) {
            throw new Error(error.message || 'Error al consultar alertas en la base de datos.');
        }

        const rawAlerts = (alertsData || []) as Row[];

        // Sort in memory by Severity Rank (critical -> high -> medium -> low), then by created_at DESC
        const sortedAlerts = [...rawAlerts].sort((a, b) => {
            const rankA = SEVERITY_ORDER[String(a.severity || '').toLowerCase()] || 0;
            const rankB = SEVERITY_ORDER[String(b.severity || '').toLowerCase()] || 0;
            if (rankB !== rankA) return rankB - rankA;

            const timeA = Date.parse(String(a.created_at || '')) || 0;
            const timeB = Date.parse(String(b.created_at || '')) || 0;
            return timeB - timeA;
        });

        const criticalCount = sortedAlerts.filter((a) => String(a.severity).toLowerCase() === 'critical').length;
        const highCount = sortedAlerts.filter((a) => String(a.severity).toLowerCase() === 'high').length;
        const mediumCount = sortedAlerts.filter((a) => String(a.severity).toLowerCase() === 'medium').length;
        const lowCount = sortedAlerts.filter((a) => String(a.severity).toLowerCase() === 'low').length;

        return apiSuccess({
            generatedAt: new Date().toISOString(),
            businessId: policy.businessId,
            status,
            totalCount: sortedAlerts.length,
            countsBySeverity: {
                critical: criticalCount,
                high: highCount,
                medium: mediumCount,
                low: lowCount,
            },
            alerts: sortedAlerts,
        }, {
            code: 'INTELLIGENCE_ALERTS_READY',
            requestId,
        });
    } catch (error) {
        return apiError(
            error instanceof Error ? error.message : 'Error inesperado al obtener alertas de inteligencia.',
            {
                status: 500,
                code: 'INTELLIGENCE_ALERTS_FAILED',
                requestId,
            }
        );
    }
}
