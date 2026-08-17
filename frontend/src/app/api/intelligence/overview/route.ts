import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { resolveBusinessRolePolicy } from '@/lib/server/role-policy';
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
import {
    intelligenceOverviewParamsSchema,
    loadIntelligenceData,
    computeHaversineForOffers,
    aggregateIntelligenceKpis,
    persistIntelligenceOutputs,
    assertCanViewAlgorithms,
    type IntelligenceOverviewData,
    type Row,
} from '@/app/api/intelligence/_shared';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);

    // 1. Authentication Check
    const auth = await requireAuthenticatedRoute(request);
    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;

    // 2. Validate Query Parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parseResult = intelligenceOverviewParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
        return apiError('Parámetros de consulta inválidos.', {
            status: 400,
            code: 'INVALID_PARAMS',
            requestId,
            details: parseResult.error.flatten().fieldErrors,
        });
    }

    const { businessId: requestedBusinessId, month, limit } = parseResult.data;

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
        return apiError('No tienes permisos para consultar inteligencia operacional para esta empresa.', {
            status: 403,
            code: 'INTELLIGENCE_FORBIDDEN',
            requestId,
        });
    }

    try {
        // 4. Load Operational and Financial Data from Supabase
        const rawData = await loadIntelligenceData(supabaseAdmin, {
            businessId: policy.businessId,
            month: month || null,
            limit,
        });

        // 5. Compute Haversine Distances for all offers
        const distanceMap = computeHaversineForOffers(rawData.offers);

        // 6. Build Lookup Maps for Vehicles, Profiles, and Tracking
        const vehiclesByTrucker = new Map<string, Row[]>();
        for (const v of rawData.vehicles) {
            const truckerId = String(v.trucker_id || '');
            if (!truckerId) continue;
            const cur = vehiclesByTrucker.get(truckerId) || [];
            cur.push(v);
            vehiclesByTrucker.set(truckerId, cur);
        }

        const profilesById = new Map<string, Row>();
        for (const p of rawData.truckerProfiles) {
            const id = String(p.id || '');
            if (id) profilesById.set(id, p);
        }

        const trackingByOffer = new Map<string, Row>();
        for (const t of rawData.trackingSessions) {
            const offerId = String(t.offer_id || '');
            if (offerId) trackingByOffer.set(offerId, t);
        }

        // 7. Domain Algorithm Execution: SLA Compliance
        const slaResults: SlaComplianceResult[] = [];
        for (const off of rawData.offers) {
            const slaInput: SlaComplianceInput = {
                offerId: String(off.id || ''),
                status: (off.status as string) || null,
                pickupDate: (off.pickup_date as string) || null,
                pickupTimeEnd: (off.pickup_time_end as string) || null,
                deliveryDate: (off.delivery_date as string) || null,
                deliveryTimeEnd: (off.delivery_time_end as string) || null,
                arrivedAtOriginAt: (off.arrived_at_origin_at as string) || null,
                loadingStartedAt: (off.loading_started_at as string) || null,
                loadingCompletedAt: (off.loading_completed_at as string) || null,
                pickupVerifiedAt: (off.pickup_verified_at as string) || null,
                arrivedAtDestinationAt: (off.arrived_at_destination_at as string) || null,
                unloadingStartedAt: (off.unloading_started_at as string) || null,
                unloadingCompletedAt: (off.unloading_completed_at as string) || null,
                deliveryVerifiedAt: (off.delivery_verified_at as string) || null,
            };
            slaResults.push(computeSlaCompliance(slaInput));
        }

        // 8. Domain Algorithm Execution: Cost Anomaly Detection
        const costInputs: CostAnomalyInput[] = rawData.offers.map((off) => {
            const id = String(off.id || '');
            return {
                offerId: id,
                totalAmount: Math.max(0, Number(off.total_amount) || 0),
                ratePerKm: Number(off.rate_per_km) || null,
                estimatedDistanceKm: distanceMap.get(id) ?? (Number(off.estimated_distance_km) || null),
                weightKg: Math.max(0, Number(off.weight_kg) || 0),
                originCity: String(off.origin_city || ''),
                destinationCity: String(off.destination_city || ''),
                vehicleType: String(off.vehicle_type || ''),
                isPrivateFleet: Boolean(off.is_private_fleet),
            };
        });

        const routeBaselines = computeRouteBaseline(costInputs);
        const costAnomalies: CostAnomalyResult[] = costInputs.map((input) => {
            const baselineKey = buildRouteKey(input.originCity, input.destinationCity);
            const baseline = routeBaselines.get(baselineKey);
            return detectCostAnomaly(input, baseline);
        });

        // 9. Domain Algorithm Execution: Capacity Utilization
        const capacityResults: CapacityResult[] = rawData.offers.map((off) => {
            const truckerId = String(off.assigned_trucker_id || off.private_fleet_trucker_id || '');
            const driverVehicles = vehiclesByTrucker.get(truckerId) || [];
            const vehicle = driverVehicles[0];

            const capacityInput: CapacityInput = {
                offerId: String(off.id || ''),
                weightKg: Math.max(0, Number(off.weight_kg) || 0),
                vehicleCapacityTons: vehicle ? Number(vehicle.capacity_tons) : null,
                vehicleType: (off.vehicle_type as string) || (vehicle ? String(vehicle.vehicle_type) : null),
                originCity: (off.origin_city as string) || null,
                destinationCity: (off.destination_city as string) || null,
                pickupDate: (off.pickup_date as string) || null,
            };
            return computeCapacity(capacityInput);
        });

        const capacitySummary = computeFleetCapacitySummary(capacityResults);

        // 10. Domain Algorithm Execution: Carrier Scorecards
        const slaByOffer = new Map<string, SlaComplianceResult>();
        for (const sla of slaResults) {
            slaByOffer.set(sla.offerId, sla);
        }

        const carrierTrips: CarrierTripData[] = [];
        for (const off of rawData.offers) {
            const truckerId = String(off.assigned_trucker_id || off.private_fleet_trucker_id || '');
            if (!truckerId) continue;

            const offerId = String(off.id || '');
            const sla = slaByOffer.get(offerId);
            const profile = profilesById.get(truckerId);

            carrierTrips.push({
                offerId,
                truckerId,
                truckerName: profile ? String(profile.full_name || '') : null,
                status: (off.status as string) || null,
                slaBreached: sla ? sla.deliverySlaStatus === 'breached' : false,
                deliveryDelayMinutes: sla ? sla.deliveryDelayMinutes : null,
                totalAmount: Math.max(0, Number(off.total_amount) || 0),
                rejectedItemCount: Math.max(0, Number(off.manifest_rejected_count) || 0),
                totalItemCount: Math.max(0, Number(off.manifest_loaded_count) || 0) + Math.max(0, Number(off.manifest_rejected_count) || 0),
                hasDeliverySignature: Boolean(off.delivery_verified_at),
                hasDeliveryPhoto: Array.isArray(off.trip_photos) && (off.trip_photos as unknown[]).length > 0,
                hasDeliveryPin: Boolean(off.delivery_verified_at),
                openIncidents: 0,
                isPrivateFleet: Boolean(off.is_private_fleet),
            });
        }

        const carrierScorecards = buildCarrierScorecards(carrierTrips);

        // 11. Domain Algorithm Execution: Fleet Health & Vehicle Docs
        const vehicleDocStatuses: VehicleDocStatus[] = rawData.vehicles.map((v) => ({
            vehicleId: String(v.id || ''),
            truckerId: String(v.trucker_id || ''),
            plateNumber: String(v.plate_number || 'SIN_PLACA'),
            vehicleType: String(v.vehicle_type || 'Desconocido'),
            soatExpiry: (v.soat_expiry as string) || null,
            technomechanicalExpiry: (v.technomechanical_expiry as string) || null,
            insuranceExpiry: (v.insurance_expiry as string) || null,
        }));

        const fuelAdvanceRisks: FuelAdvanceRisk[] = rawData.fuelAdvances.map((adv) => ({
            advanceId: String(adv.id || ''),
            truckerId: String(adv.trucker_id || ''),
            principalAmount: Math.max(0, Number(adv.principal_amount) || 0),
            principalOutstanding: Math.max(0, Number(adv.principal_outstanding) || 0),
            interestOutstanding: Math.max(0, Number(adv.interest_outstanding) || 0),
            status: String(adv.status || 'requested'),
            dueAt: String(adv.due_at || new Date().toISOString()),
            daysOverdue: null,
        }));

        const fleetHealth = computeFleetHealth(vehicleDocStatuses, fuelAdvanceRisks);

        // 12. Domain Algorithm Execution: Stale Tracking Signals
        const activeTripsWithStaleTracking: StaleTrackingTrip[] = [];
        for (const off of rawData.offers) {
            const status = String(off.status || '').toLowerCase();
            if (['in_progress', 'picked_up', 'in_transit'].includes(status)) {
                const offerId = String(off.id || '');
                const session = trackingByOffer.get(offerId);
                const lastPingAt = session ? String(session.last_ping_at || session.updated_at || '') : null;
                const pingAgeMinutes = lastPingAt ? minutesSince(lastPingAt) : 999;

                if (!lastPingAt || (pingAgeMinutes !== null && pingAgeMinutes > 30)) {
                    const truckerId = String(off.assigned_trucker_id || off.private_fleet_trucker_id || '');
                    const driver = profilesById.get(truckerId);
                    activeTripsWithStaleTracking.push({
                        offerId,
                        lastPingAt,
                        minutesSinceLastPing: pingAgeMinutes,
                        originCity: (off.origin_city as string) || null,
                        destinationCity: (off.destination_city as string) || null,
                        truckerName: driver ? String(driver.full_name || '') : null,
                    });
                }
            }
        }

        // 13. Rules & Alerts Engine
        const alerts = generateIntelligenceAlerts({
            businessId: policy.businessId,
            slaResults,
            costAnomalies,
            carrierScorecards,
            capacitySummary,
            fleetHealth,
            activeTripsWithStaleTracking,
        });

        // 14. Aggregate KPI Summary
        const kpis = aggregateIntelligenceKpis(
            rawData.offers,
            slaResults,
            capacityResults,
            distanceMap,
            rawData.previousPeriodOffers
        );

        // 15. Persist Intelligence Snapshot & Alerts (Read-only on-demand background sync)
        const snapshotPersistence = await persistIntelligenceOutputs(supabaseAdmin, {
            businessId: policy.businessId,
            userId: authUser.id,
            kpis,
            alerts,
        });

        const overviewData: IntelligenceOverviewData = {
            generatedAt: new Date().toISOString(),
            businessId: policy.businessId,
            role: policy.effectiveRole,
            kpis,
            slaResults,
            costAnomalies,
            carrierScorecards,
            capacitySummary,
            fleetHealth,
            alerts,
            snapshotPersistence,
        };

        return apiSuccess(overviewData, {
            code: 'INTELLIGENCE_OVERVIEW_READY',
            requestId,
        });
    } catch (error) {
        return apiError(
            error instanceof Error ? error.message : 'Error inesperado al calcular inteligencia operacional.',
            {
                status: 500,
                code: 'INTELLIGENCE_OVERVIEW_FAILED',
                requestId,
            }
        );
    }
}
