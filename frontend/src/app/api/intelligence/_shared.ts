import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { distanceKm, hasValidCoordinates } from '@/algorithms/shared/geo';
import { minutesSince } from '@/algorithms/shared/date';
import {
    computeSlaCompliance,
    type SlaComplianceInput,
    type SlaComplianceResult,
} from '@/algorithms/intelligence/slaCompliance';
import {
    buildRouteKey,
    computeRouteBaseline,
    detectCostAnomaly,
    type CostAnomalyInput,
    type CostAnomalyResult,
    type RouteHistoricalBaseline,
} from '@/algorithms/intelligence/costAnomaly';
import {
    buildCarrierScorecards,
    type CarrierTripData,
    type CarrierScorecardResult,
} from '@/algorithms/intelligence/carrierScorecard';
import {
    computeCapacity,
    computeFleetCapacitySummary,
    type CapacityInput,
    type CapacityResult,
    type FleetCapacitySummary,
} from '@/algorithms/intelligence/capacityUtilization';
import {
    computeFleetHealth,
    type VehicleDocStatus,
    type FuelAdvanceRisk,
    type FleetHealthResult,
} from '@/algorithms/intelligence/fleetHealth';
import {
    generateIntelligenceAlerts,
    type IntelligenceAlert,
    type StaleTrackingTrip,
} from '@/algorithms/intelligence/intelligenceAlerts';

// Re-export common utilities
export { asString, asNumber, asBoolean, getMonthRange, assertCanViewAlgorithms, routeLabel }
    from '@/app/api/algorithms/_shared';

export type Row = Record<string, unknown>;

// ─── VALIDATION SCHEMAS (ZOD) ───────────────────────────────

export const intelligenceOverviewParamsSchema = z.object({
    businessId: z.string().uuid().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const intelligenceAlertsParamsSchema = z.object({
    businessId: z.string().uuid().optional(),
    severity: z.string().optional().transform((val) => {
        if (!val) return undefined;
        return val.split(',').map((s) => s.trim().toLowerCase()).filter((s) =>
            ['low', 'medium', 'high', 'critical'].includes(s)
        );
    }),
    status: z.enum(['open', 'acknowledged', 'resolved', 'dismissed']).default('open'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const carrierScorecardParamsSchema = z.object({
    businessId: z.string().uuid().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    truckerId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── OUTPUT INTERFACES ──────────────────────────────────────

export interface IntelligenceKpiSummary {
    totalTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    inProgressTrips: number;
    slaMetCount: number;
    slaBreachedCount: number;
    slaCompliancePct: number;
    totalGmvCop: number;
    totalPlatformRevenueCop: number;
    avgCostPerTrip: number;
    avgRatePerKm: number | null;
    avgDwellTimeOriginMin: number | null;
    avgDwellTimeDestinationMin: number | null;
    avgTripDurationMin: number | null;
    rejectionRatePct: number;
    avgLoadFactorPct: number | null;
    uniqueDrivers: number;
    uniqueVehicles: number;
    // Week-over-week or Month-over-month deltas
    gmvDeltaPct: number | null;
    tripsDeltaPct: number | null;
    slaComplianceDeltaPct: number | null;
}

export interface IntelligenceOverviewData {
    generatedAt: string;
    businessId: string;
    role: string;
    kpis: IntelligenceKpiSummary;
    slaResults: SlaComplianceResult[];
    costAnomalies: CostAnomalyResult[];
    carrierScorecards: CarrierScorecardResult[];
    capacitySummary: FleetCapacitySummary;
    fleetHealth: FleetHealthResult;
    alerts: IntelligenceAlert[];
    snapshotPersistence: 'stored' | 'skipped';
}

// ─── QUERY SELECT STRINGS ───────────────────────────────────

const INTELLIGENCE_OFFER_SELECT = [
    'id', 'business_id', 'status', 'is_private_fleet',
    'assigned_trucker_id', 'private_fleet_trucker_id',
    'cargo_type', 'cargo_description', 'vehicle_type', 'weight_kg',
    'origin_city', 'origin_department', 'origin_address',
    'origin_latitude', 'origin_longitude',
    'destination_city', 'destination_department', 'destination_address',
    'destination_latitude', 'destination_longitude',
    'total_amount', 'net_amount', 'platform_fee',
    'rate_per_km', 'estimated_distance_km',
    'expense_allowance_amount', 'freight_payment_amount',
    'pickup_date', 'pickup_time_start', 'pickup_time_end',
    'delivery_date', 'delivery_time_start', 'delivery_time_end',
    'arrived_at_origin_at', 'loading_started_at', 'loading_completed_at',
    'pickup_verified_at',
    'arrived_at_destination_at', 'unloading_started_at', 'unloading_completed_at',
    'delivery_verified_at',
    'manifest_items', 'manifest_loaded_count', 'manifest_delivered_count', 'manifest_rejected_count',
    'trip_photos',
    'cancelled_at', 'cancellation_reason',
    'created_at', 'updated_at',
].join(', ');

// ─── DATA LOADER ────────────────────────────────────────────

export interface LoadedIntelligenceData {
    offers: Row[];
    vehicles: Row[];
    trackingSessions: Row[];
    fuelAdvances: Row[];
    fleetMembers: Row[];
    truckerProfiles: Row[];
    previousPeriodOffers: Row[];
}

export function getPreviousMonthRange(month: string | null): { startIso: string; endIso: string } {
    const normalized = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    const [year, monthIndex] = normalized.split('-').map((p) => Number(p));
    // Previous month
    const prevYear = monthIndex === 1 ? year - 1 : year;
    const prevMonthIndex = monthIndex === 1 ? 12 : monthIndex - 1;

    const start = new Date(Date.UTC(prevYear, prevMonthIndex - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(prevYear, prevMonthIndex, 1, 0, 0, 0));

    return {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
    };
}

export async function loadIntelligenceData(
    supabaseAdmin: SupabaseClient,
    options: {
        businessId: string;
        month?: string | null;
        limit?: number;
    }
): Promise<LoadedIntelligenceData> {
    const limit = Math.max(1, Math.min(Number(options.limit || 100), 200));

    let currentStartIso: string | null = null;
    let currentEndIso: string | null = null;

    if (options.month && /^\d{4}-\d{2}$/.test(options.month)) {
        const [y, m] = options.month.split('-').map((p) => Number(p));
        currentStartIso = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString();
        currentEndIso = new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString();
    }

    let offersQuery = supabaseAdmin
        .from('cargo_offers')
        .select(INTELLIGENCE_OFFER_SELECT)
        .eq('business_id', options.businessId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (currentStartIso && currentEndIso) {
        offersQuery = offersQuery.gte('created_at', currentStartIso).lt('created_at', currentEndIso);
    }

    const prevRange = getPreviousMonthRange(options.month || null);
    const prevOffersQuery = supabaseAdmin
        .from('cargo_offers')
        .select('id, total_amount, platform_fee, net_amount, status, delivery_verified_at, delivery_date, delivery_time_end')
        .eq('business_id', options.businessId)
        .gte('created_at', prevRange.startIso)
        .lt('created_at', prevRange.endIso)
        .limit(200);

    const [offersRes, prevOffersRes, fleetMembersRes, advancesRes] = await Promise.all([
        offersQuery,
        prevOffersQuery,
        supabaseAdmin
            .from('business_fleet_members')
            .select('id, trucker_id, status, vehicle_plate, internal_driver_id, default_compensation_mode, monthly_salary_amount')
            .eq('business_id', options.businessId)
            .eq('status', 'active'),
        supabaseAdmin
            .from('fuel_advances')
            .select('id, trucker_id, principal_amount, principal_outstanding, interest_outstanding, status, due_at')
            .in('status', ['disbursed', 'overdue', 'at_risk']),
    ]);

    if (offersRes.error) {
        throw new Error(offersRes.error.message || 'Error al cargar viajes para inteligencia.');
    }

    const offers = (offersRes.data || []) as unknown as Row[];
    const prevOffers = (prevOffersRes.data || []) as unknown as Row[];
    const fleetMembers = (fleetMembersRes.data || []) as unknown as Row[];
    const fuelAdvances = (advancesRes.data || []) as unknown as Row[];

    // Extract unique trucker IDs
    const driverIdsSet = new Set<string>();
    for (const off of offers) {
        const truckerId = typeof off.assigned_trucker_id === 'string'
            ? off.assigned_trucker_id
            : (typeof off.private_fleet_trucker_id === 'string' ? off.private_fleet_trucker_id : null);
        if (truckerId) driverIdsSet.add(truckerId);
    }
    for (const mem of fleetMembers) {
        if (typeof mem.trucker_id === 'string') driverIdsSet.add(mem.trucker_id);
    }

    const driverIds = Array.from(driverIdsSet);

    // Extract active offer IDs
    const activeOfferIds = offers
        .filter((o) => ['in_progress', 'assigned', 'reserved', 'picked_up', 'in_transit'].includes(String(o.status || '')))
        .map((o) => String(o.id));

    const [vehiclesRes, trackingRes, profilesRes] = await Promise.all([
        driverIds.length > 0
            ? supabaseAdmin
                .from('vehicles')
                .select('id, trucker_id, plate_number, vehicle_type, brand, model, year, capacity_tons, volume_m3, soat_expiry, technomechanical_expiry, insurance_expiry, status')
                .in('trucker_id', driverIds)
                .eq('status', 'active')
            : Promise.resolve({ data: [], error: null }),
        activeOfferIds.length > 0
            ? supabaseAdmin
                .from('trip_tracking_sessions')
                .select('id, offer_id, trucker_id, status, last_ping_at, last_latitude, last_longitude, last_speed_mps, last_accuracy_meters, updated_at')
                .in('offer_id', activeOfferIds)
            : Promise.resolve({ data: [], error: null }),
        driverIds.length > 0
            ? supabaseAdmin
                .from('user_profiles')
                .select('id, full_name, email, phone, user_type')
                .in('id', driverIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    return {
        offers,
        vehicles: (vehiclesRes.data || []) as unknown as Row[],
        trackingSessions: (trackingRes.data || []) as unknown as Row[],
        fuelAdvances,
        fleetMembers,
        truckerProfiles: (profilesRes.data || []) as unknown as Row[],
        previousPeriodOffers: prevOffers,
    };
}

// ─── HAVERSINE DISTANCE CALCULATOR ──────────────────────────

export function computeHaversineForOffers(offers: Row[]): Map<string, number | null> {
    const distanceMap = new Map<string, number | null>();

    for (const off of offers) {
        const id = String(off.id || '');
        if (!id) continue;

        // If estimated_distance_km is already computed and valid, reuse it
        const existingDistance = Number(off.estimated_distance_km);
        if (Number.isFinite(existingDistance) && existingDistance > 0) {
            distanceMap.set(id, Math.round(existingDistance * 10) / 10);
            continue;
        }

        const originLat = Number(off.origin_latitude);
        const originLng = Number(off.origin_longitude);
        const destLat = Number(off.destination_latitude);
        const destLng = Number(off.destination_longitude);

        const originCoords = {
            latitude: Number.isFinite(originLat) ? originLat : null,
            longitude: Number.isFinite(originLng) ? originLng : null,
        };

        const destCoords = {
            latitude: Number.isFinite(destLat) ? destLat : null,
            longitude: Number.isFinite(destLng) ? destLng : null,
        };

        if (hasValidCoordinates(originCoords) && hasValidCoordinates(destCoords)) {
            const calculated = distanceKm(originCoords, destCoords);
            distanceMap.set(id, calculated !== null ? Math.round(calculated * 10) / 10 : null);
        } else {
            distanceMap.set(id, null);
        }
    }

    return distanceMap;
}

// ─── KPI AGGREGATOR ─────────────────────────────────────────

export function aggregateIntelligenceKpis(
    offers: Row[],
    slaResults: SlaComplianceResult[],
    capacityResults: CapacityResult[],
    distanceMap: Map<string, number | null>,
    previousOffers: Row[]
): IntelligenceKpiSummary {
    const totalTrips = offers.length;
    let completedTrips = 0;
    let cancelledTrips = 0;
    let inProgressTrips = 0;
    let totalGmvCop = 0;
    let totalPlatformRevenueCop = 0;
    let totalItemsLoaded = 0;
    let totalItemsRejected = 0;

    const uniqueDriversSet = new Set<string>();
    const uniqueVehiclesSet = new Set<string>();
    const ratesPerKm: number[] = [];

    for (const off of offers) {
        const status = String(off.status || '').toLowerCase();
        const totalAmount = Math.max(0, Number(off.total_amount) || 0);
        const platformFee = Math.max(0, Number(off.platform_fee) || 0);

        if (['completed', 'delivered'].includes(status)) {
            completedTrips++;
            totalGmvCop += totalAmount;
            totalPlatformRevenueCop += platformFee;
        } else if (['cancelled', 'expired'].includes(status)) {
            cancelledTrips++;
        } else if (['in_progress', 'assigned', 'reserved', 'picked_up', 'in_transit'].includes(status)) {
            inProgressTrips++;
            totalGmvCop += totalAmount;
        }

        const driverId = String(off.assigned_trucker_id || off.private_fleet_trucker_id || '');
        if (driverId) uniqueDriversSet.add(driverId);

        const vType = String(off.vehicle_type || '');
        if (vType) uniqueVehiclesSet.add(vType);

        // Rate per km
        const id = String(off.id || '');
        const distance = distanceMap.get(id);
        const explicitRate = Number(off.rate_per_km);

        if (Number.isFinite(explicitRate) && explicitRate > 0) {
            ratesPerKm.push(explicitRate);
        } else if (distance && distance > 0 && totalAmount > 0) {
            ratesPerKm.push(totalAmount / distance);
        }

        totalItemsLoaded += Math.max(0, Number(off.manifest_loaded_count) || 0);
        totalItemsRejected += Math.max(0, Number(off.manifest_rejected_count) || 0);
    }

    // SLA Aggregations
    let slaMetCount = 0;
    let slaBreachedCount = 0;
    let dwellOriginSum = 0;
    let dwellOriginCount = 0;
    let dwellDestSum = 0;
    let dwellDestCount = 0;
    let durationSum = 0;
    let durationCount = 0;

    for (const sla of slaResults) {
        if (sla.deliverySlaStatus === 'on_time') slaMetCount++;
        else if (sla.deliverySlaStatus === 'breached') slaBreachedCount++;

        if (sla.dwellTimeOriginMinutes !== null) {
            dwellOriginSum += sla.dwellTimeOriginMinutes;
            dwellOriginCount++;
        }
        if (sla.dwellTimeDestinationMinutes !== null) {
            dwellDestSum += sla.dwellTimeDestinationMinutes;
            dwellDestCount++;
        }
        if (sla.tripDurationMinutes !== null) {
            durationSum += sla.tripDurationMinutes;
            durationCount++;
        }
    }

    const slaEvaluated = slaMetCount + slaBreachedCount;
    const slaCompliancePct = slaEvaluated > 0
        ? Math.round((slaMetCount / slaEvaluated) * 100)
        : (totalTrips > 0 ? 100 : 0);

    const avgCostPerTrip = completedTrips > 0
        ? Math.round(totalGmvCop / completedTrips)
        : (totalTrips > 0 ? Math.round(totalGmvCop / totalTrips) : 0);

    const avgRatePerKm = ratesPerKm.length > 0
        ? Math.round(ratesPerKm.reduce((acc, curr) => acc + curr, 0) / ratesPerKm.length)
        : null;

    const avgDwellTimeOriginMin = dwellOriginCount > 0
        ? Math.round(dwellOriginSum / dwellOriginCount)
        : null;

    const avgDwellTimeDestinationMin = dwellDestCount > 0
        ? Math.round(dwellDestSum / dwellDestCount)
        : null;

    const avgTripDurationMin = durationCount > 0
        ? Math.round(durationSum / durationCount)
        : null;

    const totalHandled = totalItemsLoaded + totalItemsRejected;
    const rejectionRatePct = totalHandled > 0
        ? Math.round((totalItemsRejected / totalHandled) * 100)
        : 0;

    const validCapacityFactors = capacityResults
        .map((c) => c.loadFactorPct)
        .filter((f): f is number => f !== null && Number.isFinite(f));

    const avgLoadFactorPct = validCapacityFactors.length > 0
        ? Math.round(validCapacityFactors.reduce((acc, curr) => acc + curr, 0) / validCapacityFactors.length)
        : null;

    // Previous Period Deltas
    let prevGmv = 0;
    let prevCompleted = 0;
    let prevSlaMet = 0;
    let prevSlaTotal = 0;

    for (const prev of previousOffers) {
        const status = String(prev.status || '').toLowerCase();
        const amt = Math.max(0, Number(prev.total_amount) || 0);

        if (['completed', 'delivered'].includes(status)) {
            prevCompleted++;
            prevGmv += amt;
            if (prev.delivery_verified_at) prevSlaMet++;
            prevSlaTotal++;
        }
    }

    const gmvDeltaPct = prevGmv > 0
        ? Math.round(((totalGmvCop - prevGmv) / prevGmv) * 100)
        : null;

    const tripsDeltaPct = prevCompleted > 0
        ? Math.round(((completedTrips - prevCompleted) / prevCompleted) * 100)
        : null;

    const prevSlaPct = prevSlaTotal > 0 ? (prevSlaMet / prevSlaTotal) * 100 : null;
    const slaComplianceDeltaPct = prevSlaPct !== null
        ? Math.round(slaCompliancePct - prevSlaPct)
        : null;

    return {
        totalTrips,
        completedTrips,
        cancelledTrips,
        inProgressTrips,
        slaMetCount,
        slaBreachedCount,
        slaCompliancePct,
        totalGmvCop: Math.round(totalGmvCop),
        totalPlatformRevenueCop: Math.round(totalPlatformRevenueCop),
        avgCostPerTrip,
        avgRatePerKm,
        avgDwellTimeOriginMin,
        avgDwellTimeDestinationMin,
        avgTripDurationMin,
        rejectionRatePct,
        avgLoadFactorPct,
        uniqueDrivers: uniqueDriversSet.size,
        uniqueVehicles: uniqueVehiclesSet.size,
        gmvDeltaPct,
        tripsDeltaPct,
        slaComplianceDeltaPct,
    };
}

// ─── PERSISTENCE HELPER ─────────────────────────────────────

export async function persistIntelligenceOutputs(
    supabaseAdmin: SupabaseClient,
    payload: {
        businessId: string;
        userId: string;
        kpis: IntelligenceKpiSummary;
        alerts: IntelligenceAlert[];
    }
): Promise<'stored' | 'skipped'> {
    const alertRows = (payload.alerts || []).map((alert) => ({
        business_id: payload.businessId,
        offer_id: alert.sourceType === 'offer' ? alert.sourceId : null,
        alert_type: `intelligence:${alert.ruleCode}`,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        status: 'open',
        metadata: {
            ruleCode: alert.ruleCode,
            sourceType: alert.sourceType,
            sourceId: alert.sourceId,
            href: alert.href,
            actionLabel: alert.actionLabel,
            ...alert.metadata,
        },
        created_by: payload.userId,
    }));

    const snapshotRow = {
        business_id: payload.businessId,
        module: 'intelligence',
        algorithm_key: 'intelligence_overview_v1',
        score: payload.kpis.slaCompliancePct,
        risk_level: payload.kpis.slaCompliancePct >= 85 ? 'low' : (payload.kpis.slaCompliancePct >= 65 ? 'medium' : 'high'),
        output: {
            kpis: payload.kpis,
            alertsCount: payload.alerts.length,
            criticalAlertsCount: payload.alerts.filter((a) => a.severity === 'critical').length,
        },
        created_by: payload.userId,
    };

    try {
        const [scoreInsert, alertsInsert] = await Promise.all([
            supabaseAdmin.from('algorithm_score_snapshots').insert(snapshotRow),
            alertRows.length > 0
                ? supabaseAdmin.from('algorithm_alerts').insert(alertRows)
                : Promise.resolve({ error: null }),
        ]);

        if (scoreInsert.error || alertsInsert.error) {
            return 'skipped';
        }

        return 'stored';
    } catch {
        return 'skipped';
    }
}
