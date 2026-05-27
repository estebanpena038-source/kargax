import type { SupabaseClient } from '@supabase/supabase-js';
import { listLastMileContracts } from './contracts';
import { listLastMileScorecards } from './scorecards';
import { listLastMileAlerts } from './alerts';
import type { LastMileAccess, LastMileDashboardResponse } from '@/lib/last-mile/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

function money(value: unknown) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function routeLabel(row: Record<string, unknown>) {
    const lane = row.lane as { origin_city?: string | null; destination_city?: string | null } | null;
    if (lane) {
        return `${lane.origin_city || 'Origen'} -> ${lane.destination_city || 'Destino'}`;
    }
    return 'Ruta sin clasificar';
}

export async function loadLastMileDashboard(
    supabaseAdmin: AdminClient,
    input: {
        businessId: string;
        access: LastMileAccess;
        range: { start: Date; end: Date; month: string };
    }
): Promise<LastMileDashboardResponse> {
    const { data: offers } = await supabaseAdmin
        .from('cargo_offers')
        .select('id')
        .eq('business_id', input.businessId)
        .gte('created_at', input.range.start.toISOString())
        .lte('created_at', input.range.end.toISOString());

    if (!input.access.enabled && !input.access.readOnly) {
        return {
            ready: false,
            message: 'Control de margen esta disponible en Enterprise.',
            businessId: input.businessId,
            period: {
                start: input.range.start.toISOString(),
                end: input.range.end.toISOString(),
                month: input.range.month,
            },
            access: input.access,
            metrics: {
                totalTrips: offers?.length || 0,
                observedTrips: 0,
                totalAgreedCostCop: 0,
                totalExpectedCostCop: 0,
                totalFinalCostCop: 0,
                leakageCop: 0,
                avgOverrunPct: 0,
                evidenceCompleteRate: 0,
                openRecommendations: 0,
                criticalRecommendations: 0,
                expiringContracts: 0,
            },
            topRoutes: [],
            topCarriers: [],
            contracts: [],
            snapshots: [],
            scorecards: [],
            alerts: [],
            renegotiations: [],
        };
    }

    if (input.access.readOnly && !input.access.enabled) {
        const scorecards = await listLastMileScorecards(supabaseAdmin, input.businessId, input.range);
        const totalTripsFromScorecards = scorecards.reduce((sum, row) => sum + Number(row.completed_trips || 0), 0);
        const totalLeakage = scorecards.reduce((sum, row) => sum + Number(row.estimated_leakage_cop || 0), 0);
        const evidenceAvg = scorecards.length
            ? scorecards.reduce((sum, row) => sum + Number(row.evidence_complete_rate || 0), 0) / scorecards.length
            : 0;
        const topCarriers = scorecards
            .map((row) => {
                const carrier = row.carrier as { id?: string; display_name?: string; carrier_type?: string } | null;
                return {
                    carrierId: row.carrier_id || null,
                    name: carrier?.display_name || 'Proveedor',
                    type: carrier?.carrier_type || null,
                    trips: Number(row.completed_trips || 0),
                    leakageCop: Number(row.estimated_leakage_cop || 0),
                    score: Number(row.score || 0),
                    evidenceCompleteRate: Number(row.evidence_complete_rate || 0),
                };
            })
            .slice(0, 6);

        return {
            ready: true,
            message: 'Scorecards basicos disponibles. Contratos, alertas y renegociaciones requieren Enterprise.',
            businessId: input.businessId,
            period: {
                start: input.range.start.toISOString(),
                end: input.range.end.toISOString(),
                month: input.range.month,
            },
            access: input.access,
            metrics: {
                totalTrips: offers?.length || totalTripsFromScorecards,
                observedTrips: totalTripsFromScorecards,
                totalAgreedCostCop: 0,
                totalExpectedCostCop: 0,
                totalFinalCostCop: 0,
                leakageCop: totalLeakage,
                avgOverrunPct: 0,
                evidenceCompleteRate: evidenceAvg,
                openRecommendations: 0,
                criticalRecommendations: 0,
                expiringContracts: 0,
            },
            topRoutes: [],
            topCarriers,
            contracts: [],
            snapshots: [],
            scorecards,
            alerts: [],
            renegotiations: [],
        };
    }

    const [observationsResponse, contracts, scorecards, alerts] = await Promise.all([
        supabaseAdmin
            .from('last_mile_trip_cost_observations')
            .select('*, carrier:last_mile_carriers(*), lane:last_mile_route_lanes(*), contract:last_mile_contracts(*)')
            .eq('business_id', input.businessId)
            .gte('observed_at', input.range.start.toISOString())
            .lte('observed_at', input.range.end.toISOString())
            .order('observed_at', { ascending: false })
            .limit(100),
        listLastMileContracts(supabaseAdmin, input.businessId, {}),
        listLastMileScorecards(supabaseAdmin, input.businessId, input.range),
        listLastMileAlerts(supabaseAdmin, input.businessId, {}),
    ]);
    const observations = observationsResponse.data || [];
    const openAlerts = alerts.filter((alert) => ['open', 'acknowledged', 'in_negotiation'].includes(alert.status));
    const activeContracts = contracts.filter((contract) => contract.status === 'active');
    const now = new Date();
    const expiringContracts = activeContracts.filter((contract) => {
        if (!contract.ends_at) return false;
        const expires = new Date(contract.ends_at).getTime();
        return expires >= now.getTime() && expires <= now.getTime() + 30 * 24 * 60 * 60 * 1000;
    }).length;
    const totalFinalCost = observations.reduce((sum, row) => sum + money(row.final_cost_cop), 0);
    const totalExpectedCost = observations.reduce((sum, row) => sum + money(row.expected_cost_cop), 0);
    const leakage = observations.reduce((sum, row) => sum + Math.max(0, money(row.overrun_cop)), 0);
    const evidenceAvg = observations.length
        ? observations.reduce((sum, row) => sum + money(row.evidence_score), 0) / observations.length
        : 0;

    const routeMap = new Map<string, { laneId: string | null; label: string; trips: number; leakageCop: number; overrunPct: number; evidence: number }>();
    const carrierMap = new Map<string, { carrierId: string | null; name: string; type: string | null; trips: number; leakageCop: number; score: number; evidence: number }>();
    for (const row of observations) {
        const laneId = row.lane_id || null;
        const routeKey = laneId || routeLabel(row);
        const route = routeMap.get(routeKey) || { laneId, label: routeLabel(row), trips: 0, leakageCop: 0, overrunPct: 0, evidence: 0 };
        route.trips += 1;
        route.leakageCop += Math.max(0, money(row.overrun_cop));
        route.overrunPct += money(row.overrun_pct);
        route.evidence += money(row.evidence_score);
        routeMap.set(routeKey, route);

        const carrier = row.carrier as { id?: string; display_name?: string; carrier_type?: string } | null;
        const carrierKey = row.carrier_id || 'unassigned';
        const carrierBucket = carrierMap.get(carrierKey) || {
            carrierId: row.carrier_id || null,
            name: carrier?.display_name || 'Sin proveedor',
            type: carrier?.carrier_type || null,
            trips: 0,
            leakageCop: 0,
            score: 0,
            evidence: 0,
        };
        carrierBucket.trips += 1;
        carrierBucket.leakageCop += Math.max(0, money(row.overrun_cop));
        carrierBucket.score += money(row.provider_score);
        carrierBucket.evidence += money(row.evidence_score);
        carrierMap.set(carrierKey, carrierBucket);
    }

    const topRoutes = [...routeMap.values()]
        .map((route) => ({
            laneId: route.laneId,
            label: route.label,
            trips: route.trips,
            leakageCop: route.leakageCop,
            avgOverrunPct: route.trips ? route.overrunPct / route.trips : 0,
            evidenceCompleteRate: route.trips ? route.evidence / route.trips : 0,
        }))
        .sort((left, right) => right.leakageCop - left.leakageCop)
        .slice(0, 6);
    const topCarriers = [...carrierMap.values()]
        .map((carrier) => ({
            carrierId: carrier.carrierId,
            name: carrier.name,
            type: carrier.type,
            trips: carrier.trips,
            leakageCop: carrier.leakageCop,
            score: carrier.trips ? carrier.score / carrier.trips : 0,
            evidenceCompleteRate: carrier.trips ? carrier.evidence / carrier.trips : 0,
        }))
        .sort((left, right) => right.leakageCop - left.leakageCop)
        .slice(0, 6);

    return {
        ready: true,
        message: null,
        businessId: input.businessId,
        period: {
            start: input.range.start.toISOString(),
            end: input.range.end.toISOString(),
            month: input.range.month,
        },
        access: input.access,
        metrics: {
            totalTrips: offers?.length || 0,
            observedTrips: observations.length,
            totalAgreedCostCop: observations.reduce((sum, row) => sum + money(row.agreed_cost_cop), 0),
            totalExpectedCostCop: totalExpectedCost,
            totalFinalCostCop: totalFinalCost,
            leakageCop: leakage,
            avgOverrunPct: totalExpectedCost > 0 ? ((totalFinalCost - totalExpectedCost) / totalExpectedCost) * 100 : 0,
            evidenceCompleteRate: evidenceAvg,
            openRecommendations: openAlerts.length,
            criticalRecommendations: openAlerts.filter((alert) => alert.severity === 'critical').length,
            expiringContracts,
        },
        topRoutes,
        topCarriers,
        contracts: contracts.slice(0, 20),
        snapshots: observations,
        scorecards,
        alerts: openAlerts,
        renegotiations: alerts,
    };
}
