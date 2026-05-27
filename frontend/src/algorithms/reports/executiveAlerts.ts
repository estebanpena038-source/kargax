import type {
    AlgorithmRoleCapabilities,
    DeliveryRiskResult,
    EvidenceQualityResult,
    ExecutiveAlert,
    NextBestAction,
} from '../shared/types';

interface ExecutiveAlertsInput {
    businessId: string;
    role: string;
    capabilities: AlgorithmRoleCapabilities;
    deliveryRisks: DeliveryRiskResult[];
    evidenceResults: EvidenceQualityResult[];
    nextBestActions: NextBestAction[];
    billingUsagePercent?: number | null;
}

function severityRank(severity: ExecutiveAlert['severity']) {
    return ({ critical: 4, high: 3, medium: 2, low: 1 })[severity];
}

export function buildExecutiveAlerts(input: ExecutiveAlertsInput): ExecutiveAlert[] {
    const alerts: ExecutiveAlert[] = [];
    const canViewFinance = Boolean(input.capabilities.canViewFinance);

    const criticalRisks = input.deliveryRisks.filter((risk) => ['critical', 'high'].includes(risk.riskLevel));
    for (const risk of criticalRisks.slice(0, 5)) {
        alerts.push({
            id: `delivery-risk:${risk.offerId}`,
            module: 'lastmile',
            sourceId: risk.offerId,
            severity: risk.riskLevel,
            title: risk.riskLevel === 'critical' ? 'Entrega en riesgo critico' : 'Entrega en riesgo alto',
            description: risk.reasons[0]?.label || 'La entrega requiere seguimiento operativo.',
            actionLabel: 'Revisar entrega',
            href: `/viaje/${risk.offerId}`,
            rail: risk.rail,
            includesFinance: false,
        });
    }

    const blockedEvidence = input.evidenceResults.filter((item) => item.status === 'blocked' || item.status === 'incomplete');
    for (const evidence of blockedEvidence.slice(0, 5)) {
        alerts.push({
            id: `evidence:${evidence.offerId}`,
            module: 'evidence',
            sourceId: evidence.offerId,
            severity: evidence.status === 'blocked' ? 'high' : 'medium',
            title: evidence.status === 'blocked' ? 'POD bloqueado para soporte' : 'Evidencia incompleta',
            description: evidence.missingRequirements[0]?.label || 'La evidencia necesita revision antes del cierre documental.',
            actionLabel: 'Ver POD',
            href: `/viaje/${evidence.offerId}/entrega`,
            rail: evidence.rail,
            includesFinance: false,
        });
    }

    for (const action of input.nextBestActions.slice(0, 3)) {
        alerts.push({
            id: `action:${action.id}`,
            module: 'reports',
            sourceId: action.sourceId,
            severity: action.priority === 'P0' ? 'high' : 'medium',
            title: action.title,
            description: action.description,
            actionLabel: action.actionLabel,
            href: action.href,
            rail: action.rail,
            includesFinance: false,
        });
    }

    if (canViewFinance && input.billingUsagePercent !== null && input.billingUsagePercent !== undefined && input.billingUsagePercent >= 90) {
        alerts.push({
            id: `billing-usage:${input.businessId}`,
            module: 'billing',
            sourceId: input.businessId,
            severity: input.billingUsagePercent >= 100 ? 'critical' : 'high',
            title: 'Uso del plan cerca del limite',
            description: `La empresa esta al ${Math.round(input.billingUsagePercent)}% de uso. Revisar upgrade sin cambiar plan automaticamente.`,
            actionLabel: 'Revisar planes',
            href: '/planes',
            includesFinance: true,
        });
    }

    return alerts
        .filter((alert) => canViewFinance || !alert.includesFinance)
        .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
        .slice(0, 8);
}

