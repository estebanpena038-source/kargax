import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSlaCompliance } from './intelligence/slaCompliance';
import { buildRouteKey, computeRouteBaseline, detectCostAnomaly } from './intelligence/costAnomaly';
import { buildCarrierScorecards } from './intelligence/carrierScorecard';
import { computeCapacity, computeFleetCapacitySummary } from './intelligence/capacityUtilization';
import { computeFleetHealth } from './intelligence/fleetHealth';
import { generateIntelligenceAlerts } from './intelligence/intelligenceAlerts';

// ─── 1. SLA COMPLIANCE TESTS ────────────────────────────────────────────────

test('computeSlaCompliance marks on-time delivery with valid score', () => {
    const result = computeSlaCompliance({
        offerId: 'offer-1',
        status: 'completed',
        pickupDate: '2026-08-10',
        pickupTimeEnd: '14:00:00',
        deliveryDate: '2026-08-11',
        deliveryTimeEnd: '18:00:00',
        arrivedAtOriginAt: '2026-08-10T11:45:00Z',
        loadingStartedAt: '2026-08-10T12:00:00Z',
        loadingCompletedAt: '2026-08-10T13:00:00Z',
        pickupVerifiedAt: '2026-08-10T13:10:00Z',
        arrivedAtDestinationAt: '2026-08-11T16:00:00Z',
        unloadingStartedAt: '2026-08-11T16:15:00Z',
        unloadingCompletedAt: '2026-08-11T17:30:00Z',
        deliveryVerifiedAt: '2026-08-11T17:40:00Z',
    });

    assert.equal(result.offerId, 'offer-1');
    assert.equal(result.overallSlaStatus, 'on_time');
    assert.equal(result.deliverySlaStatus, 'on_time');
    assert.equal(result.dwellTimeOriginMinutes, 15);
    assert.equal(result.dwellTimeDestinationMinutes, 15);
    assert.equal(result.loadingDurationMinutes, 60);
    assert.equal(result.unloadingDurationMinutes, 75);
    assert.equal(result.complianceScore, 100);
    assert.equal(result.complianceLevel, 'low');
});

test('computeSlaCompliance detects breached delivery deadline and penalizes score', () => {
    const result = computeSlaCompliance({
        offerId: 'offer-2',
        status: 'completed',
        pickupDate: '2026-08-10',
        pickupTimeEnd: '14:00:00',
        deliveryDate: '2026-08-10',
        deliveryTimeEnd: '18:00:00',
        arrivedAtOriginAt: '2026-08-10T13:00:00Z',
        loadingStartedAt: '2026-08-10T13:30:00Z',
        loadingCompletedAt: '2026-08-10T14:30:00Z',
        pickupVerifiedAt: '2026-08-10T14:45:00Z',
        arrivedAtDestinationAt: '2026-08-11T02:00:00Z',
        unloadingStartedAt: '2026-08-11T02:15:00Z',
        unloadingCompletedAt: '2026-08-11T03:00:00Z',
        deliveryVerifiedAt: '2026-08-11T03:15:00Z', // Many hours late
    });

    assert.equal(result.overallSlaStatus, 'breached');
    assert.equal(result.deliverySlaStatus, 'breached');
    assert.ok(result.deliveryDelayMinutes !== null && result.deliveryDelayMinutes > 0);
    assert.ok(result.complianceScore < 60);
    assert.ok(['high', 'critical'].includes(result.complianceLevel));
});

// ─── 2. COST ANOMALY TESTS ──────────────────────────────────────────────────

test('detectCostAnomaly accurately identifies severe cost deviations', () => {
    const baselineKey = buildRouteKey('Bogotá', 'Cali');
    assert.equal(baselineKey, 'bogotá→cali');

    const historicalOffers = [
        { offerId: 'h1', totalAmount: 2000000, ratePerKm: 4000, estimatedDistanceKm: 500, weightKg: 10000, originCity: 'Bogotá', destinationCity: 'Cali', vehicleType: 'sencillo', isPrivateFleet: false },
        { offerId: 'h2', totalAmount: 2100000, ratePerKm: 4200, estimatedDistanceKm: 500, weightKg: 10000, originCity: 'Bogotá', destinationCity: 'Cali', vehicleType: 'sencillo', isPrivateFleet: false },
        { offerId: 'h3', totalAmount: 1900000, ratePerKm: 3800, estimatedDistanceKm: 500, weightKg: 10000, originCity: 'Bogotá', destinationCity: 'Cali', vehicleType: 'sencillo', isPrivateFleet: false },
    ];

    const baselines = computeRouteBaseline(historicalOffers);
    const baseline = baselines.get(baselineKey);
    assert.ok(baseline);
    assert.equal(baseline.sampleCount, 3);
    assert.equal(baseline.avgTotalAmount, 2000000);

    // Test normal cost (should NOT be anomaly)
    const normalOffer = {
        offerId: 'n1',
        totalAmount: 2050000,
        ratePerKm: 4100,
        estimatedDistanceKm: 500,
        weightKg: 10000,
        originCity: 'Bogotá',
        destinationCity: 'Cali',
        vehicleType: 'sencillo',
        isPrivateFleet: false,
    };
    const normalResult = detectCostAnomaly(normalOffer, baseline);
    assert.equal(normalResult.isAnomaly, false);
    assert.equal(normalResult.severity, 'low');

    // Test +60% overrun anomaly (should be CRITICAL anomaly)
    const expensiveOffer = {
        offerId: 'exp-1',
        totalAmount: 3200000,
        ratePerKm: 6400,
        estimatedDistanceKm: 500,
        weightKg: 10000,
        originCity: 'Bogotá',
        destinationCity: 'Cali',
        vehicleType: 'sencillo',
        isPrivateFleet: false,
    };
    const anomalyResult = detectCostAnomaly(expensiveOffer, baseline);
    assert.equal(anomalyResult.isAnomaly, true);
    assert.equal(anomalyResult.deviationPct, 60);
    assert.equal(anomalyResult.severity, 'critical');
});

// ─── 3. CARRIER SCORECARD TESTS ─────────────────────────────────────────────

test('buildCarrierScorecards computes composite score and ranks carriers', () => {
    const trips = [
        // Driver 1: Excellent performance
        { offerId: 't1', truckerId: 'driver-1', truckerName: 'Carlos Gómez', status: 'completed', slaBreached: false, deliveryDelayMinutes: 0, totalAmount: 1500000, rejectedItemCount: 0, totalItemCount: 100, hasDeliverySignature: true, hasDeliveryPhoto: true, hasDeliveryPin: true, openIncidents: 0, isPrivateFleet: true },
        { offerId: 't2', truckerId: 'driver-1', truckerName: 'Carlos Gómez', status: 'completed', slaBreached: false, deliveryDelayMinutes: 0, totalAmount: 1500000, rejectedItemCount: 0, totalItemCount: 100, hasDeliverySignature: true, hasDeliveryPhoto: true, hasDeliveryPin: true, openIncidents: 0, isPrivateFleet: true },
        // Driver 2: Poor performance (SLA breach and rejections)
        { offerId: 't3', truckerId: 'driver-2', truckerName: 'Juan Pérez', status: 'completed', slaBreached: true, deliveryDelayMinutes: 180, totalAmount: 1200000, rejectedItemCount: 30, totalItemCount: 100, hasDeliverySignature: true, hasDeliveryPhoto: false, hasDeliveryPin: true, openIncidents: 1, isPrivateFleet: false },
        { offerId: 't4', truckerId: 'driver-2', truckerName: 'Juan Pérez', status: 'completed', slaBreached: true, deliveryDelayMinutes: 240, totalAmount: 1200000, rejectedItemCount: 20, totalItemCount: 100, hasDeliverySignature: false, hasDeliveryPhoto: true, hasDeliveryPin: false, openIncidents: 1, isPrivateFleet: false },
    ];

    const scorecards = buildCarrierScorecards(trips);
    assert.equal(scorecards.length, 2);

    const driver1 = scorecards.find((s) => s.truckerId === 'driver-1');
    const driver2 = scorecards.find((s) => s.truckerId === 'driver-2');

    assert.ok(driver1);
    assert.ok(driver2);

    assert.equal(driver1.slaCompliancePct, 100);
    assert.equal(driver1.rejectionRatePct, 0);
    assert.equal(driver1.evidenceCompletePct, 100);
    assert.equal(driver1.overallScore, 100);
    assert.equal(driver1.performanceLevel, 'low'); // low risk = high performance

    assert.equal(driver2.slaCompliancePct, 0);
    assert.equal(driver2.rejectionRatePct, 25);
    assert.ok(driver2.overallScore < 50);
    assert.ok(['high', 'critical'].includes(driver2.performanceLevel));

    // Ranking order
    assert.equal(scorecards[0].truckerId, 'driver-1');
    assert.equal(scorecards[1].truckerId, 'driver-2');
});

// ─── 4. CAPACITY UTILIZATION TESTS ──────────────────────────────────────────

test('computeCapacity and summary detect underutilization and potential consolidations', () => {
    const cap1 = computeCapacity({
        offerId: 'cap-1',
        weightKg: 2000, // 2 tons
        vehicleCapacityTons: 10, // 10 tons -> 20% load factor (< 40%)
        vehicleType: 'sencillo',
        originCity: 'Medellín',
        destinationCity: 'Bogotá',
        pickupDate: '2026-08-20',
    });
    assert.equal(cap1.loadFactorPct, 20);
    assert.equal(cap1.isUnderutilized, true);

    const cap2 = computeCapacity({
        offerId: 'cap-2',
        weightKg: 3000, // 3 tons
        vehicleCapacityTons: 10,
        vehicleType: 'sencillo',
        originCity: 'Medellín',
        destinationCity: 'Bogotá',
        pickupDate: '2026-08-20',
    });
    assert.equal(cap2.loadFactorPct, 30);
    assert.equal(cap2.isUnderutilized, true);

    const summary = computeFleetCapacitySummary([cap1, cap2]);
    assert.equal(summary.totalTrips, 2);
    assert.equal(summary.underutilizedCount, 2);
    assert.equal(summary.underutilizedPct, 100);
    assert.equal(summary.potentialConsolidations.length, 1);

    const consolidation = summary.potentialConsolidations[0];
    assert.equal(consolidation.combinedWeightKg, 5000);
    assert.equal(consolidation.combinedLoadFactorPct, 50);
});

// ─── 5. FLEET HEALTH TESTS ──────────────────────────────────────────────────

test('computeFleetHealth flags expired/expiring docs and overdue fuel advances', () => {
    const now = new Date('2026-08-16T12:00:00Z');

    const vehicles = [
        {
            vehicleId: 'veh-1',
            truckerId: 'trucker-1',
            plateNumber: 'ABC123',
            vehicleType: 'Tractomula',
            soatExpiry: '2026-08-10', // Expired 6 days ago
            technomechanicalExpiry: '2026-08-25', // Expiring in 9 days
            insuranceExpiry: '2027-01-01', // OK
        },
    ];

    const advances = [
        {
            advanceId: 'adv-1',
            truckerId: 'trucker-1',
            principalAmount: 500000,
            principalOutstanding: 500000,
            interestOutstanding: 25000,
            status: 'overdue',
            dueAt: '2026-08-01T00:00:00Z',
            daysOverdue: null,
        },
    ];

    const health = computeFleetHealth(vehicles, advances, now);

    assert.equal(health.vehiclesTotal, 1);
    assert.equal(health.vehiclesDocsExpired, 1);
    assert.equal(health.documentAlerts.length, 2); // 1 expired, 1 expiring soon

    assert.equal(health.overdueAdvances, 1);
    assert.equal(health.totalOutstandingPrincipal, 500000);
    assert.equal(health.totalOutstandingInterest, 25000);
});

// ─── 6. INTELLIGENCE ALERTS ENGINE TESTS ────────────────────────────────────

test('generateIntelligenceAlerts triggers all appropriate rules and sorts by severity', () => {
    const alerts = generateIntelligenceAlerts({
        businessId: 'biz-1',
        slaResults: [
            {
                offerId: 'off-breach',
                pickupSlaStatus: 'on_time',
                deliverySlaStatus: 'breached',
                overallSlaStatus: 'breached',
                pickupDelayMinutes: 0,
                deliveryDelayMinutes: 180,
                dwellTimeOriginMinutes: 10,
                dwellTimeDestinationMinutes: 15,
                loadingDurationMinutes: 45,
                unloadingDurationMinutes: 45,
                tripDurationMinutes: 400,
                totalCycleMinutes: 450,
                complianceScore: 40,
                complianceLevel: 'critical',
            },
            {
                offerId: 'off-risk',
                pickupSlaStatus: 'on_time',
                deliverySlaStatus: 'at_risk',
                overallSlaStatus: 'at_risk',
                pickupDelayMinutes: 0,
                deliveryDelayMinutes: null,
                dwellTimeOriginMinutes: 10,
                dwellTimeDestinationMinutes: null,
                loadingDurationMinutes: 45,
                unloadingDurationMinutes: null,
                tripDurationMinutes: null,
                totalCycleMinutes: null,
                complianceScore: 75,
                complianceLevel: 'medium',
            },
        ],
        costAnomalies: [
            {
                offerId: 'off-cost',
                routeKey: 'bogotá→cali',
                isAnomaly: true,
                deviationPct: 45,
                deviationFromP95Pct: 35,
                expectedCost: 2000000,
                actualCost: 2900000,
                computedRatePerKm: 5800,
                baselineAvgRatePerKm: 4000,
                baselineSampleCount: 5,
                severity: 'high',
                reason: 'Desviacion alta de costo',
            },
        ],
        carrierScorecards: [
            {
                truckerId: 'bad-driver',
                truckerName: 'Conductor Deficiente',
                isPrivateFleet: false,
                totalTrips: 6,
                completedTrips: 5,
                cancelledTrips: 1,
                inProgressTrips: 0,
                completionRatePct: 83,
                slaMet: 2,
                slaBreached: 3,
                slaCompliancePct: 40,
                avgDeliveryDelayMinutes: 120,
                totalItemsHandled: 50,
                totalItemsRejected: 12,
                rejectionRatePct: 24,
                evidenceCompletePct: 50,
                totalIncidents: 2,
                overallScore: 42,
                performanceLevel: 'critical',
                networkAvgScore: 80,
                deviationFromNetworkAvg: -38,
            },
        ],
        capacitySummary: {
            totalTrips: 5,
            avgLoadFactorPct: 28,
            underutilizedCount: 4,
            wellUtilizedCount: 1,
            overloadedCount: 0,
            underutilizedPct: 80,
            potentialConsolidations: [],
        },
        fleetHealth: {
            vehiclesTotal: 2,
            vehiclesDocsExpiringSoon: 1,
            vehiclesDocsExpired: 1,
            documentAlerts: [
                {
                    vehicleId: 'v1',
                    plateNumber: 'XYZ789',
                    truckerId: 't1',
                    documentType: 'soat',
                    documentName: 'SOAT',
                    expiryDate: '2026-08-01',
                    daysUntilExpiry: -15,
                    status: 'expired',
                },
            ],
            activeAdvances: 1,
            overdueAdvances: 1,
            atRiskAdvances: 0,
            totalOutstandingPrincipal: 400000,
            totalOutstandingInterest: 20000,
            advanceAlerts: [
                {
                    advanceId: 'adv-1',
                    truckerId: 't1',
                    principalAmount: 400000,
                    principalOutstanding: 400000,
                    interestOutstanding: 20000,
                    status: 'overdue',
                    dueAt: '2026-08-01',
                    daysOverdue: 15,
                },
            ],
        },
        activeTripsWithStaleTracking: [
            {
                offerId: 'off-gps',
                lastPingAt: '2026-08-16T10:00:00Z',
                minutesSinceLastPing: 75,
                originCity: 'Bogotá',
                destinationCity: 'Cali',
                truckerName: 'Juan Pérez',
            },
        ],
    });

    assert.ok(alerts.length >= 7);

    // Verify rules were generated
    const ruleCodes = alerts.map((a) => a.ruleCode);
    assert.ok(ruleCodes.includes('sla_breach'));
    assert.ok(ruleCodes.includes('sla_at_risk'));
    assert.ok(ruleCodes.includes('cost_anomaly'));
    assert.ok(ruleCodes.includes('carrier_underperformance'));
    assert.ok(ruleCodes.includes('capacity_waste'));
    assert.ok(ruleCodes.includes('tracking_lost'));
    assert.ok(ruleCodes.includes('advance_overdue'));
    assert.ok(ruleCodes.includes('rejection_spike'));
    assert.ok(ruleCodes.includes('vehicle_docs_expiring'));

    // Verify sorting order: critical first
    assert.equal(alerts[0].severity, 'critical');
});
