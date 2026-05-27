import type { SupabaseClient } from '@supabase/supabase-js';
import { LastMileError } from './errors';
import { percentile } from './cost-engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

type ObservationRow = {
    business_id: string;
    carrier_id: string | null;
    execution_status: string;
    final_cost_cop: number;
    agreed_cost_cop: number;
    overrun_cop: number;
    overrun_pct: number;
    evidence_score: number;
    on_time_score: number;
    provider_score: number;
    incident_snapshot?: { count?: number } | null;
};

function average(values: number[]) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export async function listLastMileScorecards(
    supabaseAdmin: AdminClient,
    businessId: string,
    range: { start: Date; end: Date }
) {
    const { data, error } = await supabaseAdmin
        .from('last_mile_provider_score_snapshots')
        .select('*, carrier:last_mile_carriers(*)')
        .eq('business_id', businessId)
        .eq('period_start', range.start.toISOString().slice(0, 10))
        .eq('period_end', range.end.toISOString().slice(0, 10))
        .order('estimated_leakage_cop', { ascending: false });

    if (error) {
        throw new LastMileError(error.message || 'No se pudieron cargar scorecards de proveedores', {
            status: 500,
            code: 'LAST_MILE_SCORECARDS_FAILED',
        });
    }

    return data || [];
}

export async function generateLastMileScorecards(
    supabaseAdmin: AdminClient,
    businessId: string,
    range: { start: Date; end: Date },
    observations?: ObservationRow[]
) {
    const rows = observations || await (async () => {
        const { data, error } = await supabaseAdmin
            .from('last_mile_trip_cost_observations')
            .select('*')
            .eq('business_id', businessId)
            .gte('observed_at', range.start.toISOString())
            .lte('observed_at', range.end.toISOString());

        if (error) {
            throw new LastMileError(error.message || 'No se pudieron cargar observaciones para scorecards', {
                status: 500,
                code: 'LAST_MILE_SCORECARD_SOURCE_FAILED',
            });
        }

        return (data || []) as ObservationRow[];
    })();

    const byCarrier = new Map<string, ObservationRow[]>();
    for (const row of rows) {
        if (!row.carrier_id) continue;
        const bucket = byCarrier.get(row.carrier_id) || [];
        bucket.push(row);
        byCarrier.set(row.carrier_id, bucket);
    }

    const payload = [...byCarrier.entries()].map(([carrierId, carrierRows]) => {
        const finalCosts = carrierRows.map((row) => Number(row.final_cost_cop || 0));
        const overrunRows = carrierRows.filter((row) => Number(row.overrun_cop || 0) > 0);
        return {
            business_id: businessId,
            carrier_id: carrierId,
            period_start: range.start.toISOString().slice(0, 10),
            period_end: range.end.toISOString().slice(0, 10),
            completed_trips: carrierRows.filter((row) => ['completed', 'delivered'].includes(row.execution_status)).length,
            cancelled_trips: carrierRows.filter((row) => row.execution_status === 'cancelled').length,
            disputed_trips: carrierRows.filter((row) => row.execution_status === 'disputed').length,
            incident_count: carrierRows.reduce((sum, row) => sum + Number(row.incident_snapshot?.count || 0), 0),
            evidence_complete_rate: average(carrierRows.map((row) => Number(row.evidence_score || 0))),
            on_time_rate: average(carrierRows.map((row) => Number(row.on_time_score || 0))),
            avg_agreed_cost_cop: average(carrierRows.map((row) => Number(row.agreed_cost_cop || 0))),
            avg_final_cost_cop: average(finalCosts),
            avg_overrun_cop: average(carrierRows.map((row) => Number(row.overrun_cop || 0))),
            avg_overrun_pct: average(carrierRows.map((row) => Number(row.overrun_pct || 0))),
            p95_final_cost_cop: percentile(finalCosts, 95),
            estimated_leakage_cop: overrunRows.reduce((sum, row) => sum + Number(row.overrun_cop || 0), 0),
            score: average(carrierRows.map((row) => Number(row.provider_score || 0))),
            generated_at: new Date().toISOString(),
        };
    });

    if (!payload.length) {
        return [];
    }

    const { data, error } = await supabaseAdmin
        .from('last_mile_provider_score_snapshots')
        .upsert(payload, {
            onConflict: 'business_id,carrier_id,period_start,period_end',
        })
        .select('*, carrier:last_mile_carriers(*)');

    if (error) {
        throw new LastMileError(error.message || 'No se pudieron guardar scorecards de proveedores', {
            status: 500,
            code: 'LAST_MILE_SCORECARD_SAVE_FAILED',
        });
    }

    return data || [];
}
