import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeliveryFailureRisk } from './lastmile/deliveryRisk';
import { buildNextBestActions } from './lastmile/nextBestAction';
import { validateEvidenceQuality } from './evidence/evidenceQuality';
import { buildExecutiveAlerts } from './reports/executiveAlerts';
import type { AlgorithmRoleCapabilities, DeliveryRiskInput, EvidenceQualityInput } from './shared/types';

const baseCapabilities: AlgorithmRoleCapabilities = {
    canViewFinance: false,
    canViewOperations: true,
    canViewTracking: true,
    canViewEvidence: true,
    canViewIntelligence: true,
};

function healthyDelivery(overrides: Partial<DeliveryRiskInput> = {}): DeliveryRiskInput {
    return {
        offerId: 'offer-ok',
        businessId: 'business-1',
        rail: 'marketplace',
        status: 'in_transit',
        deliveryDate: '2026-05-28T18:00:00.000Z',
        destination: { latitude: 4.71099, longitude: -74.07209 },
        assignedTruckerId: 'trucker-1',
        deliveryVerifiedAt: '2026-05-27T18:00:00.000Z',
        lastPingAt: '2026-05-27T17:45:00.000Z',
        lastPingAccuracyMeters: 30,
        latestDistanceToDestinationKm: 0.4,
        hasDeliverySignature: true,
        hasDeliveryPhoto: true,
        hasDeliveryPinVerified: true,
        evidenceMissingCount: 0,
        openCriticalIncidents: 0,
        manifestExpectedCount: 2,
        manifestDeliveredCount: 2,
        manifestRejectedCount: 0,
        rejectedWithoutReasonCount: 0,
        now: '2026-05-27T18:00:00.000Z',
        ...overrides,
    };
}

function healthyEvidence(overrides: Partial<EvidenceQualityInput> = {}): EvidenceQualityInput {
    return {
        offerId: 'offer-ok',
        businessId: 'business-1',
        rail: 'marketplace',
        status: 'delivered',
        deliveryVerifiedAt: '2026-05-27T18:00:00.000Z',
        hasDeliverySignature: true,
        hasDeliveryPhoto: true,
        hasDeliveryPinVerified: true,
        hasRecipientName: true,
        hasRecipientDocument: true,
        destinationCoordinatesValid: true,
        lastDistanceToDestinationKm: 0.3,
        manifestExpectedCount: 2,
        manifestDeliveredCount: 2,
        manifestRejectedCount: 0,
        rejectedWithoutReasonCount: 0,
        openCriticalIncidents: 0,
        ...overrides,
    };
}

test('calculateDeliveryFailureRisk clasifica una entrega sana como low', () => {
    const result = calculateDeliveryFailureRisk(healthyDelivery());

    assert.equal(result.riskLevel, 'low');
    assert.equal(result.blockingForClosure, false);
});

test('calculateDeliveryFailureRisk clasifica vencido sin tracking como critical', () => {
    const result = calculateDeliveryFailureRisk(healthyDelivery({
        offerId: 'offer-risk',
        deliveryDate: '2026-05-26T18:00:00.000Z',
        deliveryVerifiedAt: null,
        lastPingAt: null,
        hasDeliverySignature: false,
        hasDeliveryPhoto: false,
        hasDeliveryPinVerified: false,
        evidenceMissingCount: 3,
    }));

    assert.equal(result.riskLevel, 'critical');
    assert.equal(result.blockingForClosure, true);
});

test('validateEvidenceQuality marca firma, foto y PIN como complete', () => {
    const result = validateEvidenceQuality(healthyEvidence());

    assert.equal(result.status, 'complete');
    assert.equal(result.canCloseOperationally, true);
});

test('validateEvidenceQuality marca falta de firma como incomplete', () => {
    const result = validateEvidenceQuality(healthyEvidence({
        offerId: 'offer-no-signature',
        hasDeliverySignature: false,
    }));

    assert.equal(result.status, 'incomplete');
    assert.equal(result.missingRequirements.some((item) => item.code === 'delivery_signature_missing'), true);
});

test('nextBestAction evita dinero para dispatcher y reasignacion operativa para finance', () => {
    const deliveryRisks = [
        calculateDeliveryFailureRisk(healthyDelivery({
            offerId: 'offer-late',
            deliveryDate: '2026-05-26T18:00:00.000Z',
            deliveryVerifiedAt: null,
            lastPingAt: null,
            hasDeliverySignature: false,
            hasDeliveryPhoto: false,
            hasDeliveryPinVerified: false,
            evidenceMissingCount: 3,
        })),
    ];
    const evidenceResults = [
        validateEvidenceQuality(healthyEvidence({
            offerId: 'offer-late',
            hasDeliverySignature: false,
            hasDeliveryPhoto: false,
            hasDeliveryPinVerified: false,
        })),
    ];

    const dispatcherActions = buildNextBestActions({
        role: 'dispatcher',
        capabilities: baseCapabilities,
        deliveryRisks,
        evidenceResults,
    });
    const financeActions = buildNextBestActions({
        role: 'finance_accountant',
        capabilities: {
            ...baseCapabilities,
            canViewFinance: true,
            canViewOperations: false,
            canViewTracking: false,
        },
        deliveryRisks,
        evidenceResults,
    });

    assert.equal(dispatcherActions.some((action) => action.type === 'review_billing_limit' || action.type === 'download_support'), false);
    assert.equal(financeActions.some((action) => action.type === 'contact_driver' || action.type === 'review_delayed_route'), false);
});

test('executiveAlerts no muestra montos ni alertas financieras sin canViewFinance', () => {
    const deliveryRisk = calculateDeliveryFailureRisk(healthyDelivery({
        offerId: 'offer-critical',
        deliveryDate: '2026-05-26T18:00:00.000Z',
        deliveryVerifiedAt: null,
        lastPingAt: null,
        hasDeliverySignature: false,
        hasDeliveryPhoto: false,
        hasDeliveryPinVerified: false,
        evidenceMissingCount: 3,
    }));
    const evidence = validateEvidenceQuality(healthyEvidence({
        offerId: 'offer-critical',
        hasDeliverySignature: false,
        hasDeliveryPhoto: false,
        hasDeliveryPinVerified: false,
    }));
    const alerts = buildExecutiveAlerts({
        businessId: 'business-1',
        role: 'viewer',
        capabilities: {
            ...baseCapabilities,
            canViewFinance: false,
            canViewEvidence: false,
        },
        deliveryRisks: [deliveryRisk],
        evidenceResults: [evidence],
        nextBestActions: [],
        billingUsagePercent: 99,
    });

    assert.equal(alerts.some((alert) => alert.includesFinance), false);
});
