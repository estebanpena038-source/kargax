import type { SupabaseClient } from '@supabase/supabase-js';
import { LastMileError, getSupabaseWriteErrorMessage } from './errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

type RecommendationStatus = 'open' | 'acknowledged' | 'in_negotiation' | 'accepted' | 'rejected' | 'closed';

function dedupeKey(input: {
    businessId: string;
    carrierId?: string | null;
    laneId?: string | null;
    triggerType: string;
    periodStart: string;
    periodEnd: string;
}) {
    return [
        input.businessId,
        input.carrierId || 'carrier-any',
        input.laneId || 'lane-any',
        input.triggerType,
        input.periodStart,
        input.periodEnd,
    ].join(':');
}

export async function listLastMileAlerts(
    supabaseAdmin: AdminClient,
    businessId: string,
    filters: { status?: string | null; severity?: string | null } = {}
) {
    let query = supabaseAdmin
        .from('last_mile_renegotiation_recommendations')
        .select('*, carrier:last_mile_carriers(*), lane:last_mile_route_lanes(*), contract:last_mile_contracts(*)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.severity) query = query.eq('severity', filters.severity);

    const { data, error } = await query;
    if (error) {
        throw new LastMileError(error.message || 'No se pudieron cargar alertas de margen', {
            status: 500,
            code: 'LAST_MILE_ALERTS_FAILED',
        });
    }

    return data || [];
}

export async function getLastMileAlert(supabaseAdmin: AdminClient, businessId: string, alertId: string) {
    const { data, error } = await supabaseAdmin
        .from('last_mile_renegotiation_recommendations')
        .select('*, carrier:last_mile_carriers(*), lane:last_mile_route_lanes(*), contract:last_mile_contracts(*)')
        .eq('business_id', businessId)
        .eq('id', alertId)
        .maybeSingle();

    if (error) {
        throw new LastMileError(error.message || 'No se pudo cargar alerta de margen', {
            status: 500,
            code: 'LAST_MILE_ALERT_LOAD_FAILED',
        });
    }

    if (!data) {
        throw new LastMileError('Alerta de margen no encontrada', {
            status: 404,
            code: 'LAST_MILE_ALERT_NOT_FOUND',
        });
    }

    return data;
}

export async function upsertLastMileRecommendation(
    supabaseAdmin: AdminClient,
    payload: {
        businessId: string;
        carrierId?: string | null;
        laneId?: string | null;
        contractId?: string | null;
        periodStart: string;
        periodEnd: string;
        triggerType: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        title: string;
        description: string;
        detectedMetric: Record<string, unknown>;
        expectedSavingCop: number;
        confidenceScore: number;
        recommendedAction: string;
        createdBy?: string | null;
    }
) {
    const key = dedupeKey(payload);
    const { data: existing } = await supabaseAdmin
        .from('last_mile_renegotiation_recommendations')
        .select('id, status')
        .eq('business_id', payload.businessId)
        .eq('dedupe_key', key)
        .maybeSingle();

    const update = {
        business_id: payload.businessId,
        carrier_id: payload.carrierId || null,
        lane_id: payload.laneId || null,
        contract_id: payload.contractId || null,
        period_start: payload.periodStart,
        period_end: payload.periodEnd,
        trigger_type: payload.triggerType,
        severity: payload.severity,
        title: payload.title,
        description: payload.description,
        detected_metric: payload.detectedMetric,
        expected_saving_cop: Math.max(0, Math.round(payload.expectedSavingCop)),
        confidence_score: payload.confidenceScore,
        recommended_action: payload.recommendedAction,
        opened_by_system: true,
        dedupe_key: key,
        created_by: payload.createdBy || null,
        updated_by: payload.createdBy || null,
    };

    const { data, error } = await supabaseAdmin
        .from('last_mile_renegotiation_recommendations')
        .upsert(update, { onConflict: 'dedupe_key' })
        .select('*')
        .single();

    if (error || !data) {
        throw new LastMileError(getSupabaseWriteErrorMessage(error), {
            status: 500,
            code: 'LAST_MILE_ALERT_SAVE_FAILED',
        });
    }

    return {
        data,
        created: !existing,
    };
}

export async function generateLastMileAlerts(
    supabaseAdmin: AdminClient,
    businessId: string,
    range: { start: Date; end: Date },
    actorId?: string | null
) {
    const periodStart = range.start.toISOString().slice(0, 10);
    const periodEnd = range.end.toISOString().slice(0, 10);
    const { data: observations, error } = await supabaseAdmin
        .from('last_mile_trip_cost_observations')
        .select('carrier_id, lane_id, contract_id, overrun_cop, overrun_pct, evidence_score, incident_snapshot, carrier:last_mile_carriers(display_name), lane:last_mile_route_lanes(origin_city, destination_city)')
        .eq('business_id', businessId)
        .gte('observed_at', range.start.toISOString())
        .lte('observed_at', range.end.toISOString());

    if (error) {
        throw new LastMileError(error.message || 'No se pudieron cargar snapshots para alertas', {
            status: 500,
            code: 'LAST_MILE_ALERT_SOURCE_FAILED',
        });
    }

    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const row of observations || []) {
        const key = `${row.carrier_id || 'any'}:${row.lane_id || 'any'}`;
        const bucket = grouped.get(key) || [];
        bucket.push(row as Record<string, unknown>);
        grouped.set(key, bucket);
    }

    let created = 0;
    for (const rows of grouped.values()) {
        const overrunCop = rows.reduce((sum, row) => sum + Number(row.overrun_cop || 0), 0);
        const avgOverrunPct = rows.reduce((sum, row) => sum + Number(row.overrun_pct || 0), 0) / rows.length;
        const avgEvidence = rows.reduce((sum, row) => sum + Number(row.evidence_score || 0), 0) / rows.length;
        const first = rows[0] || {};
        const carrier = first.carrier as { display_name?: string } | undefined;
        const lane = first.lane as { origin_city?: string | null; destination_city?: string | null } | undefined;
        const laneLabel = lane ? `${lane.origin_city || 'Origen'} -> ${lane.destination_city || 'Destino'}` : 'ruta general';

        if (overrunCop > 200000 && avgOverrunPct > 10) {
            const result = await upsertLastMileRecommendation(supabaseAdmin, {
                businessId,
                carrierId: String(first.carrier_id || '') || null,
                laneId: String(first.lane_id || '') || null,
                contractId: String(first.contract_id || '') || null,
                periodStart,
                periodEnd,
                triggerType: 'cost_overrun',
                severity: overrunCop > 1000000 || avgOverrunPct > 25 ? 'critical' : 'high',
                title: 'Sobrecosto observado para renegociar',
                description: `${carrier?.display_name || 'Proveedor'} acumula fuga estimada en ${laneLabel}. Revisar tarifa pactada contra costo observado.`,
                detectedMetric: { overrunCop, avgOverrunPct, trips: rows.length },
                expectedSavingCop: overrunCop,
                confidenceScore: Math.min(95, 65 + rows.length * 4),
                recommendedAction: 'Revisar contrato, evidencia operativa y tarifa vigente antes de reasignar volumen.',
                createdBy: actorId || null,
            });
            if (result.created) created += 1;
        }

        if (avgEvidence < 85 && rows.length >= 2) {
            const result = await upsertLastMileRecommendation(supabaseAdmin, {
                businessId,
                carrierId: String(first.carrier_id || '') || null,
                laneId: String(first.lane_id || '') || null,
                contractId: String(first.contract_id || '') || null,
                periodStart,
                periodEnd,
                triggerType: 'evidence_missing',
                severity: avgEvidence < 60 ? 'high' : 'medium',
                title: 'Evidencia incompleta en entregas',
                description: `${carrier?.display_name || 'Proveedor'} tiene evidencia incompleta en ${laneLabel}. Prioriza POD/firma/foto antes de negociar reclamos.`,
                detectedMetric: { evidenceCompleteRate: avgEvidence, trips: rows.length },
                expectedSavingCop: Math.max(0, overrunCop),
                confidenceScore: 70,
                recommendedAction: 'Exigir evidencia completa por contrato y cerrar novedades con soporte.',
                createdBy: actorId || null,
            });
            if (result.created) created += 1;
        }
    }

    return { createdRecommendations: created };
}

export async function updateLastMileAlertStatus(
    supabaseAdmin: AdminClient,
    businessId: string,
    alertId: string,
    actorId: string,
    payload: {
        status?: RecommendationStatus;
        assignedTo?: string | null;
        resolutionNote?: string | null;
    }
) {
    const current = await getLastMileAlert(supabaseAdmin, businessId, alertId);
    const nextStatus = payload.status || current.status;
    const closing = ['accepted', 'rejected', 'closed'].includes(nextStatus);

    if (closing && !payload.resolutionNote && !current.resolution_note) {
        throw new LastMileError('Cierra la renegociacion con una nota de decision.', {
            status: 400,
            code: 'LAST_MILE_RESOLUTION_NOTE_REQUIRED',
        });
    }

    const { data, error } = await supabaseAdmin
        .from('last_mile_renegotiation_recommendations')
        .update({
            status: nextStatus,
            assigned_to: payload.assignedTo === undefined ? current.assigned_to : payload.assignedTo,
            resolution_note: payload.resolutionNote === undefined ? current.resolution_note : payload.resolutionNote,
            resolved_at: closing ? new Date().toISOString() : null,
            updated_by: actorId,
        })
        .eq('business_id', businessId)
        .eq('id', alertId)
        .select('*, carrier:last_mile_carriers(*), lane:last_mile_route_lanes(*), contract:last_mile_contracts(*)')
        .single();

    if (error || !data) {
        throw new LastMileError(getSupabaseWriteErrorMessage(error), {
            status: 500,
            code: 'LAST_MILE_ALERT_UPDATE_FAILED',
        });
    }

    if (current.contract_id) {
        await supabaseAdmin.from('last_mile_contract_events').insert({
            business_id: businessId,
            contract_id: current.contract_id,
            event_type: nextStatus === 'in_negotiation' ? 'renegotiation_requested' : 'manual_note',
            actor_id: actorId,
            reason: payload.resolutionNote || `Renegociacion actualizada a ${nextStatus}`,
            old_snapshot: current,
            new_snapshot: data,
        });
    }

    return data;
}
