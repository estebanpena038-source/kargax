import { clampScore, riskLevelFromScore } from '../shared/scoring';
import type { AlgorithmRiskLevel } from '../shared/types';

export interface CarrierTripData {
    offerId: string;
    truckerId: string;
    truckerName: string | null;
    status: string | null;
    slaBreached: boolean;
    deliveryDelayMinutes: number | null;
    totalAmount: number;
    rejectedItemCount: number;
    totalItemCount: number;
    hasDeliverySignature: boolean;
    hasDeliveryPhoto: boolean;
    hasDeliveryPin: boolean;
    openIncidents: number;
    isPrivateFleet: boolean;
}

export interface CarrierScorecardResult {
    truckerId: string;
    truckerName: string | null;
    isPrivateFleet: boolean;
    // Trip volumes
    totalTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    inProgressTrips: number;
    completionRatePct: number;
    // SLA performance
    slaMet: number;
    slaBreached: number;
    slaCompliancePct: number;
    avgDeliveryDelayMinutes: number | null;
    // Quality & Rejections
    totalItemsHandled: number;
    totalItemsRejected: number;
    rejectionRatePct: number;
    // Evidence completeness
    evidenceCompletePct: number;
    // Incidents
    totalIncidents: number;
    // Composite Performance Score (0-100)
    overallScore: number;
    performanceLevel: AlgorithmRiskLevel;
    // Network comparison
    networkAvgScore: number | null;
    deviationFromNetworkAvg: number | null;
}

export function buildCarrierScorecards(
    trips: CarrierTripData[],
    networkAvgScore?: number | null
): CarrierScorecardResult[] {
    const grouped = new Map<string, CarrierTripData[]>();

    for (const trip of trips) {
        const id = trip.truckerId?.trim();
        if (!id) continue;
        const current = grouped.get(id) || [];
        current.push(trip);
        grouped.set(id, current);
    }

    const initialScorecards: CarrierScorecardResult[] = [];

    for (const [truckerId, driverTrips] of grouped.entries()) {
        const truckerName = driverTrips.find((t) => Boolean(t.truckerName))?.truckerName || null;
        const isPrivateFleet = driverTrips.some((t) => t.isPrivateFleet);
        const totalTrips = driverTrips.length;

        let completedTrips = 0;
        let cancelledTrips = 0;
        let inProgressTrips = 0;
        let slaMet = 0;
        let slaBreached = 0;
        let totalDelayMinutes = 0;
        let delayCount = 0;
        let totalItemsHandled = 0;
        let totalItemsRejected = 0;
        let evidenceCompleteCount = 0;
        let totalIncidents = 0;

        for (const trip of driverTrips) {
            const status = String(trip.status || '').toLowerCase();
            if (['completed', 'delivered'].includes(status)) {
                completedTrips++;
            } else if (['cancelled', 'expired'].includes(status)) {
                cancelledTrips++;
            } else if (['in_progress', 'assigned', 'reserved', 'picked_up', 'in_transit'].includes(status)) {
                inProgressTrips++;
            }

            if (trip.slaBreached) {
                slaBreached++;
            } else if (['completed', 'delivered'].includes(status)) {
                slaMet++;
            }

            if (trip.deliveryDelayMinutes !== null && trip.deliveryDelayMinutes > 0) {
                totalDelayMinutes += trip.deliveryDelayMinutes;
                delayCount++;
            }

            totalItemsHandled += Math.max(0, trip.totalItemCount || 0);
            totalItemsRejected += Math.max(0, trip.rejectedItemCount || 0);

            // Complete evidence requires photo, pin and signature
            const hasCompleteEvidence = trip.hasDeliveryPin && trip.hasDeliveryPhoto && trip.hasDeliverySignature;
            if (hasCompleteEvidence) {
                evidenceCompleteCount++;
            }

            totalIncidents += Math.max(0, trip.openIncidents || 0);
        }

        const evaluatedForSla = slaMet + slaBreached;
        const slaCompliancePct = evaluatedForSla > 0
            ? Math.round((slaMet / evaluatedForSla) * 100)
            : 100;

        const completionRatePct = totalTrips > 0
            ? Math.round((completedTrips / totalTrips) * 100)
            : 0;

        const avgDeliveryDelayMinutes = delayCount > 0
            ? Math.round(totalDelayMinutes / delayCount)
            : 0;

        const rejectionRatePct = totalItemsHandled > 0
            ? Math.round((totalItemsRejected / totalItemsHandled) * 100)
            : 0;

        const evidenceCompletePct = totalTrips > 0
            ? Math.round((evidenceCompleteCount / totalTrips) * 100)
            : 0;

        // Composite Score Calculation
        const incidentPenalty = Math.min(100, totalIncidents * 15);
        const incidentScore = Math.max(0, 100 - incidentPenalty);
        const rejectionScore = Math.max(0, 100 - rejectionRatePct);

        const rawOverallScore = (slaCompliancePct * 0.35)
            + (rejectionScore * 0.20)
            + (evidenceCompletePct * 0.20)
            + (completionRatePct * 0.15)
            + (incidentScore * 0.10);

        const overallScore = clampScore(rawOverallScore);
        // Performance risk level (inverted: high score is low risk)
        let performanceLevel = riskLevelFromScore(100 - overallScore);
        if (overallScore < 50 && (performanceLevel === 'low' || performanceLevel === 'medium')) {
            performanceLevel = overallScore < 30 ? 'critical' : 'high';
        }

        initialScorecards.push({
            truckerId,
            truckerName,
            isPrivateFleet,
            totalTrips,
            completedTrips,
            cancelledTrips,
            inProgressTrips,
            completionRatePct,
            slaMet,
            slaBreached,
            slaCompliancePct,
            avgDeliveryDelayMinutes,
            totalItemsHandled,
            totalItemsRejected,
            rejectionRatePct,
            evidenceCompletePct,
            totalIncidents,
            overallScore,
            performanceLevel,
            networkAvgScore: null,
            deviationFromNetworkAvg: null,
        });
    }

    // Compute network average score
    const computedNetworkAvg = initialScorecards.length > 0
        ? Math.round(initialScorecards.reduce((sum, s) => sum + s.overallScore, 0) / initialScorecards.length)
        : (networkAvgScore ?? 80);

    const finalAvg = networkAvgScore ?? computedNetworkAvg;

    return initialScorecards.map((scorecard) => {
        const deviation = scorecard.overallScore - finalAvg;
        return {
            ...scorecard,
            networkAvgScore: finalAvg,
            deviationFromNetworkAvg: Math.round(deviation),
        };
    }).sort((a, b) => b.overallScore - a.overallScore);
}
