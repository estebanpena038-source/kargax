import type { AlgorithmRiskLevel } from '../shared/types';
import type { SlaComplianceResult } from './slaCompliance';
import type { CostAnomalyResult } from './costAnomaly';
import type { CarrierScorecardResult } from './carrierScorecard';
import type { FleetCapacitySummary } from './capacityUtilization';
import type { FleetHealthResult } from './fleetHealth';

export interface IntelligenceAlert {
    id: string;
    ruleCode: string;
    severity: AlgorithmRiskLevel;
    title: string;
    description: string;
    sourceType: 'offer' | 'carrier' | 'vehicle' | 'advance' | 'fleet';
    sourceId: string;
    actionLabel: string;
    href: string;
    metadata: Record<string, unknown>;
}

export interface StaleTrackingTrip {
    offerId: string;
    lastPingAt: string | null;
    minutesSinceLastPing: number | null;
    originCity?: string | null;
    destinationCity?: string | null;
    truckerName?: string | null;
}

export interface IntelligenceAlertsInput {
    businessId: string;
    slaResults: SlaComplianceResult[];
    costAnomalies: CostAnomalyResult[];
    carrierScorecards: CarrierScorecardResult[];
    capacitySummary: FleetCapacitySummary;
    fleetHealth: FleetHealthResult;
    activeTripsWithStaleTracking: StaleTrackingTrip[];
}

function severityRank(severity: AlgorithmRiskLevel): number {
    const ranks: Record<AlgorithmRiskLevel, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
    };
    return ranks[severity] || 1;
}

export function generateIntelligenceAlerts(input: IntelligenceAlertsInput): IntelligenceAlert[] {
    const alerts: IntelligenceAlert[] = [];

    // ─── REGLA 1: SLA de Entrega Incumplido ─────────────────────────
    for (const sla of input.slaResults) {
        if (sla.deliverySlaStatus === 'breached') {
            const delayHours = sla.deliveryDelayMinutes !== null && sla.deliveryDelayMinutes > 0
                ? Math.round(sla.deliveryDelayMinutes / 60)
                : 0;
            alerts.push({
                id: `sla_breach:${sla.offerId}`,
                ruleCode: 'sla_breach',
                severity: 'critical',
                title: 'SLA de entrega incumplido',
                description: delayHours > 0
                    ? `El viaje presenta un retraso de ${delayHours} horas frente a la ventana acordada.`
                    : 'La ventana de entrega programada ha vencido sin confirmación de cierre.',
                sourceType: 'offer',
                sourceId: sla.offerId,
                actionLabel: 'Ver viaje',
                href: `/viaje/${sla.offerId}`,
                metadata: {
                    offerId: sla.offerId,
                    delayMinutes: sla.deliveryDelayMinutes,
                    score: sla.complianceScore,
                },
            });
        }
    }

    // ─── REGLA 2: SLA de Entrega en Riesgo ──────────────────────────
    for (const sla of input.slaResults) {
        if (sla.deliverySlaStatus === 'at_risk') {
            alerts.push({
                id: `sla_at_risk:${sla.offerId}`,
                ruleCode: 'sla_at_risk',
                severity: 'high',
                title: 'SLA de entrega en riesgo',
                description: 'La ventana de entrega finaliza en menos de 4 horas. Confirmar ETA con el conductor.',
                sourceType: 'offer',
                sourceId: sla.offerId,
                actionLabel: 'Confirmar ETA',
                href: `/viaje/${sla.offerId}`,
                metadata: {
                    offerId: sla.offerId,
                    complianceScore: sla.complianceScore,
                },
            });
        }
    }

    // ─── REGLA 3: Desviación Anómala de Costos ──────────────────────
    for (const cost of input.costAnomalies) {
        if (cost.isAnomaly && cost.deviationPct >= 25) {
            alerts.push({
                id: `cost_anomaly:${cost.offerId}`,
                ruleCode: 'cost_anomaly',
                severity: cost.severity,
                title: 'Costo anómalo detectado',
                description: cost.reason,
                sourceType: 'offer',
                sourceId: cost.offerId,
                actionLabel: 'Auditar flete',
                href: `/viaje/${cost.offerId}`,
                metadata: {
                    offerId: cost.offerId,
                    routeKey: cost.routeKey,
                    deviationPct: cost.deviationPct,
                    actualCost: cost.actualCost,
                    expectedCost: cost.expectedCost,
                },
            });
        }
    }

    // ─── REGLA 4: Rendimiento Anormal de Conductor / Transportador ──
    for (const carrier of input.carrierScorecards) {
        const networkAvg = carrier.networkAvgScore ?? 80;
        const isSeverelyUnderperforming = carrier.totalTrips >= 3 && carrier.overallScore < (networkAvg * 0.65);

        if (isSeverelyUnderperforming) {
            alerts.push({
                id: `carrier_underperformance:${carrier.truckerId}`,
                ruleCode: 'carrier_underperformance',
                severity: carrier.overallScore < 45 ? 'high' : 'medium',
                title: 'Transportador con bajo rendimiento',
                description: `${carrier.truckerName || 'Conductor'} registra un puntaje de ${carrier.overallScore}/100 (${carrier.deviationFromNetworkAvg}% vs red), con ${carrier.slaBreached} entregas fuera de SLA y ${carrier.rejectionRatePct}% de rechazo.`,
                sourceType: 'carrier',
                sourceId: carrier.truckerId,
                actionLabel: 'Ver conductor',
                href: `/flota/conductores/${carrier.truckerId}`,
                metadata: {
                    truckerId: carrier.truckerId,
                    score: carrier.overallScore,
                    slaBreached: carrier.slaBreached,
                    rejectionRatePct: carrier.rejectionRatePct,
                },
            });
        }
    }

    // ─── REGLA 5: Desperdicio de Capacidad de Flota ─────────────────
    if (input.capacitySummary.totalTrips >= 3 && input.capacitySummary.underutilizedPct >= 40) {
        alerts.push({
            id: `capacity_waste:${input.businessId}`,
            ruleCode: 'capacity_waste',
            severity: 'medium',
            title: 'Capacidad de flota subutilizada',
            description: `El ${input.capacitySummary.underutilizedPct}% de los viajes transporta menos del 40% de la capacidad del vehículo. Se detectaron ${input.capacitySummary.potentialConsolidations.length} oportunidades de consolidación de carga.`,
            sourceType: 'fleet',
            sourceId: input.businessId,
            actionLabel: 'Ver consolidaciones',
            href: `/dashboard/inteligencia?tab=capacidad`,
            metadata: {
                underutilizedPct: input.capacitySummary.underutilizedPct,
                avgLoadFactorPct: input.capacitySummary.avgLoadFactorPct,
                consolidationsCount: input.capacitySummary.potentialConsolidations.length,
            },
        });
    }

    // ─── REGLA 6: Pérdida de Telemetría GPS en Ruta Activa ──────────
    for (const trip of input.activeTripsWithStaleTracking) {
        const mins = trip.minutesSinceLastPing || 30;
        alerts.push({
            id: `tracking_lost:${trip.offerId}`,
            ruleCode: 'tracking_lost',
            severity: mins > 60 ? 'critical' : 'high',
            title: 'Tracking GPS inactivo en viaje',
            description: `Sin señal de rastreo hace ${mins} minutos en la ruta ${trip.originCity || 'origen'} → ${trip.destinationCity || 'destino'}.`,
            sourceType: 'offer',
            sourceId: trip.offerId,
            actionLabel: 'Solicitar GPS',
            href: `/viaje/${trip.offerId}`,
            metadata: {
                offerId: trip.offerId,
                minutesSinceLastPing: mins,
                lastPingAt: trip.lastPingAt,
            },
        });
    }

    // ─── REGLA 7: Adelanto de Combustible Vencido / En Riesgo ──────
    for (const adv of input.fleetHealth.advanceAlerts) {
        if (adv.status === 'overdue' || (adv.daysOverdue && adv.daysOverdue > 0)) {
            alerts.push({
                id: `advance_overdue:${adv.advanceId}`,
                ruleCode: 'advance_overdue',
                severity: 'critical',
                title: 'Adelanto de combustible vencido',
                description: `Adelanto por ${adv.principalOutstanding.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} vencido hace ${adv.daysOverdue || 1} días.`,
                sourceType: 'advance',
                sourceId: adv.advanceId,
                actionLabel: 'Gestionar cartera',
                href: `/billetera/adelantos`,
                metadata: {
                    advanceId: adv.advanceId,
                    truckerId: adv.truckerId,
                    daysOverdue: adv.daysOverdue,
                    principalOutstanding: adv.principalOutstanding,
                },
            });
        }
    }

    // ─── REGLA 8: Alza Inusual en Tasa de Rechazo de Mercancía ──────
    for (const carrier of input.carrierScorecards) {
        if (carrier.totalItemsHandled >= 10 && carrier.rejectionRatePct >= 15) {
            alerts.push({
                id: `rejection_spike:${carrier.truckerId}`,
                ruleCode: 'rejection_spike',
                severity: 'high',
                title: 'Tasa de rechazo crítica',
                description: `${carrier.truckerName || 'Conductor'} presenta una tasa de rechazo de ${carrier.rejectionRatePct}% (${carrier.totalItemsRejected} unidades rechazadas de ${carrier.totalItemsHandled}).`,
                sourceType: 'carrier',
                sourceId: carrier.truckerId,
                actionLabel: 'Revisar novedades',
                href: `/flota/conductores/${carrier.truckerId}`,
                metadata: {
                    truckerId: carrier.truckerId,
                    rejectionRatePct: carrier.rejectionRatePct,
                    totalRejected: carrier.totalItemsRejected,
                },
            });
        }
    }

    // ─── REGLA 9: Vencimiento Próximo o Vencido de Documentos ───────
    for (const doc of input.fleetHealth.documentAlerts) {
        if (doc.daysUntilExpiry <= 15) {
            const isExpired = doc.status === 'expired' || doc.daysUntilExpiry <= 0;
            alerts.push({
                id: `vehicle_docs_expiring:${doc.vehicleId}:${doc.documentType}`,
                ruleCode: 'vehicle_docs_expiring',
                severity: isExpired ? 'high' : 'medium',
                title: isExpired ? `${doc.documentName} vencido` : `${doc.documentName} por vencer`,
                description: isExpired
                    ? `El ${doc.documentName} del vehículo placa ${doc.plateNumber} está vencido desde hace ${Math.abs(doc.daysUntilExpiry)} días.`
                    : `El ${doc.documentName} del vehículo placa ${doc.plateNumber} vence en ${doc.daysUntilExpiry} días (${doc.expiryDate}).`,
                sourceType: 'vehicle',
                sourceId: doc.vehicleId,
                actionLabel: 'Actualizar documento',
                href: `/flota/vehiculos/${doc.vehicleId}`,
                metadata: {
                    vehicleId: doc.vehicleId,
                    plateNumber: doc.plateNumber,
                    documentType: doc.documentType,
                    daysUntilExpiry: doc.daysUntilExpiry,
                    expiryDate: doc.expiryDate,
                },
            });
        }
    }

    // Sort all alerts strictly by severity (critical -> high -> medium -> low)
    return alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}
