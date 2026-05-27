import type { SupabaseClient } from '@supabase/supabase-js';
import { getMonthRange } from './access';
import { LastMileError, getSupabaseWriteErrorMessage } from './errors';
import { listLastMileAlerts, updateLastMileAlertStatus, upsertLastMileRecommendation } from './alerts';
import type { LastMileRecommendationCreate, LastMileRecommendationPatch } from './schemas';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

export async function listLastMileRenegotiations(
    supabaseAdmin: AdminClient,
    businessId: string,
    filters: { status?: string | null; severity?: string | null } = {}
) {
    return listLastMileAlerts(supabaseAdmin, businessId, filters);
}

export async function createLastMileRenegotiation(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string,
    payload: LastMileRecommendationCreate
) {
    const range = getMonthRange(null);
    const result = await upsertLastMileRecommendation(supabaseAdmin, {
        businessId,
        carrierId: payload.carrierId,
        laneId: payload.laneId,
        contractId: payload.contractId,
        periodStart: payload.periodStart || range.start.toISOString().slice(0, 10),
        periodEnd: payload.periodEnd || range.end.toISOString().slice(0, 10),
        triggerType: payload.triggerType,
        severity: payload.severity,
        title: payload.title,
        description: payload.description,
        detectedMetric: { source: 'manual' },
        expectedSavingCop: payload.expectedSavingCop,
        confidenceScore: payload.confidenceScore,
        recommendedAction: payload.recommendedAction || 'Revisar proveedor, ruta y tarifa vigente con evidencia operativa.',
        createdBy: actorId,
    });

    if (payload.assignedTo || payload.dueAt) {
        const { data, error } = await supabaseAdmin
            .from('last_mile_renegotiation_recommendations')
            .update({
                assigned_to: payload.assignedTo,
                due_at: payload.dueAt,
                updated_by: actorId,
            })
            .eq('business_id', businessId)
            .eq('id', result.data.id)
            .select('*, carrier:last_mile_carriers(*), lane:last_mile_route_lanes(*), contract:last_mile_contracts(*)')
            .single();

        if (error || !data) {
            throw new LastMileError(getSupabaseWriteErrorMessage(error), {
                status: 500,
                code: 'LAST_MILE_RENEGOTIATION_CREATE_FAILED',
            });
        }

        return data;
    }

    return result.data;
}

export async function updateLastMileRenegotiation(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string,
    renegotiationId: string,
    payload: LastMileRecommendationPatch
) {
    return updateLastMileAlertStatus(supabaseAdmin, businessId, renegotiationId, actorId, payload);
}
