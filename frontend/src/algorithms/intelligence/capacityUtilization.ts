import { clampScore } from '../shared/scoring';

export interface CapacityInput {
    offerId: string;
    weightKg: number;
    vehicleCapacityTons: number | null;
    vehicleType: string | null;
    originCity?: string | null;
    destinationCity?: string | null;
    pickupDate?: string | null;
}

export interface CapacityResult {
    offerId: string;
    loadFactorPct: number | null;
    isUnderutilized: boolean;
    isOverloaded: boolean;
    weightKg: number;
    vehicleCapacityKg: number | null;
    vehicleType: string | null;
    originCity: string | null;
    destinationCity: string | null;
    pickupDate: string | null;
}

export interface PotentialConsolidation {
    offerIdA: string;
    offerIdB: string;
    route: string;
    pickupDate: string;
    weightKgA: number;
    weightKgB: number;
    combinedWeightKg: number;
    vehicleCapacityKg: number;
    combinedLoadFactorPct: number;
    estimatedSavingsPct: number;
}

export interface FleetCapacitySummary {
    totalTrips: number;
    avgLoadFactorPct: number;
    underutilizedCount: number;
    wellUtilizedCount: number;
    overloadedCount: number;
    underutilizedPct: number;
    potentialConsolidations: PotentialConsolidation[];
}

// Approximate vehicle capacity in tons fallback by vehicle type
const VEHICLE_TYPE_CAPACITY_TONS: Record<string, number> = {
    tractomula: 35.0,
    mula: 35.0,
    dobletroque: 18.0,
    cuatro_manos: 22.0,
    patineta: 25.0,
    sencillo: 8.5,
    turbo: 4.5,
    camioneta: 1.5,
    furgon: 4.5,
    carry: 0.8,
    otro: 5.0,
};

export function computeCapacity(input: CapacityInput): CapacityResult {
    const weightKg = Math.max(0, Number(input.weightKg) || 0);

    let vehicleCapacityTons = input.vehicleCapacityTons && Number.isFinite(Number(input.vehicleCapacityTons)) && Number(input.vehicleCapacityTons) > 0
        ? Number(input.vehicleCapacityTons)
        : null;

    if (!vehicleCapacityTons && input.vehicleType) {
        const normalizedType = input.vehicleType.trim().toLowerCase().replace(/[\s-]/g, '_');
        vehicleCapacityTons = VEHICLE_TYPE_CAPACITY_TONS[normalizedType] || null;
    }

    const vehicleCapacityKg = vehicleCapacityTons ? Math.round(vehicleCapacityTons * 1000) : null;

    let loadFactorPct: number | null = null;
    let isUnderutilized = false;
    let isOverloaded = false;

    if (vehicleCapacityKg && vehicleCapacityKg > 0) {
        const rawFactor = (weightKg / vehicleCapacityKg) * 100;
        loadFactorPct = Math.round(rawFactor);
        isUnderutilized = loadFactorPct < 40;
        isOverloaded = loadFactorPct > 105;
    }

    return {
        offerId: input.offerId,
        loadFactorPct,
        isUnderutilized,
        isOverloaded,
        weightKg,
        vehicleCapacityKg,
        vehicleType: input.vehicleType || null,
        originCity: input.originCity || null,
        destinationCity: input.destinationCity || null,
        pickupDate: input.pickupDate || null,
    };
}

export function computeFleetCapacitySummary(results: CapacityResult[]): FleetCapacitySummary {
    const totalTrips = results.length;
    if (totalTrips === 0) {
        return {
            totalTrips: 0,
            avgLoadFactorPct: 0,
            underutilizedCount: 0,
            wellUtilizedCount: 0,
            overloadedCount: 0,
            underutilizedPct: 0,
            potentialConsolidations: [],
        };
    }

    let validFactorSum = 0;
    let validFactorCount = 0;
    let underutilizedCount = 0;
    let wellUtilizedCount = 0;
    let overloadedCount = 0;

    for (const r of results) {
        if (r.loadFactorPct !== null) {
            validFactorSum += r.loadFactorPct;
            validFactorCount++;

            if (r.isUnderutilized) {
                underutilizedCount++;
            } else if (r.isOverloaded) {
                overloadedCount++;
            } else {
                wellUtilizedCount++;
            }
        }
    }

    const avgLoadFactorPct = validFactorCount > 0
        ? Math.round(validFactorSum / validFactorCount)
        : 0;

    const underutilizedPct = totalTrips > 0
        ? Math.round((underutilizedCount / totalTrips) * 100)
        : 0;

    // Detect consolidation opportunities among underutilized loads with matching route & date
    const underutilizedOffers = results.filter((r) => r.isUnderutilized && r.originCity && r.destinationCity && r.vehicleCapacityKg);
    const potentialConsolidations: PotentialConsolidation[] = [];
    const usedOfferIds = new Set<string>();

    for (let i = 0; i < underutilizedOffers.length; i++) {
        const a = underutilizedOffers[i];
        if (!a || usedOfferIds.has(a.offerId)) continue;

        for (let j = i + 1; j < underutilizedOffers.length; j++) {
            const b = underutilizedOffers[j];
            if (!b || usedOfferIds.has(b.offerId)) continue;

            const sameOrigin = a.originCity?.trim().toLowerCase() === b.originCity?.trim().toLowerCase();
            const sameDestination = a.destinationCity?.trim().toLowerCase() === b.destinationCity?.trim().toLowerCase();
            const sameDate = a.pickupDate === b.pickupDate || (!a.pickupDate && !b.pickupDate);

            if (sameOrigin && sameDestination && sameDate) {
                const combinedWeightKg = a.weightKg + b.weightKg;
                const capacityKg = Math.max(a.vehicleCapacityKg || 0, b.vehicleCapacityKg || 0);

                if (capacityKg > 0 && combinedWeightKg <= capacityKg) {
                    const combinedLoadFactorPct = Math.round((combinedWeightKg / capacityKg) * 100);

                    // Estimated freight savings by reducing two separate trips into one consolidated trip
                    const estimatedSavingsPct = 35;

                    potentialConsolidations.push({
                        offerIdA: a.offerId,
                        offerIdB: b.offerId,
                        route: `${a.originCity} → ${a.destinationCity}`,
                        pickupDate: a.pickupDate || 'Misma fecha',
                        weightKgA: a.weightKg,
                        weightKgB: b.weightKg,
                        combinedWeightKg,
                        vehicleCapacityKg: capacityKg,
                        combinedLoadFactorPct,
                        estimatedSavingsPct,
                    });

                    usedOfferIds.add(a.offerId);
                    usedOfferIds.add(b.offerId);
                    break;
                }
            }
        }

        if (potentialConsolidations.length >= 10) break;
    }

    return {
        totalTrips,
        avgLoadFactorPct,
        underutilizedCount,
        wellUtilizedCount,
        overloadedCount,
        underutilizedPct,
        potentialConsolidations,
    };
}
