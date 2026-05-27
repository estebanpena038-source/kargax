import { hoursUntil, isPast, minutesSince } from '../shared/date';
import { hasValidCoordinates } from '../shared/geo';
import { clampScore, riskLevelFromScore } from '../shared/scoring';
import type {
    AlgorithmReason,
    DelaySignal,
    DeliveryRiskInput,
    DeliveryRiskResult,
} from '../shared/types';

const CLOSED_STATUSES = new Set(['completed', 'delivered', 'cancelled', 'expired']);
const ACTIVE_ROUTE_STATUSES = new Set(['in_progress', 'picked_up', 'in_transit']);
const ASSIGNED_STATUSES = new Set(['assigned', 'reserved']);

function pushReason(reasons: AlgorithmReason[], code: string, label: string, weight: number, detail?: string) {
    reasons.push({ code, label, detail, weight });
}

function actionForReason(code: string) {
    const actions: Record<string, string> = {
        delivery_window_breached: 'Escalar ruta retrasada y confirmar ETA con conductor.',
        delivery_window_close: 'Confirmar ETA y preparar contacto con receptor.',
        tracking_missing: 'Pedir al conductor activar rastreo en vivo.',
        tracking_stale: 'Contactar conductor y actualizar ubicacion.',
        gps_low_accuracy: 'Pedir nuevo ping GPS con mejor precision.',
        driver_not_assigned: 'Asignar conductor antes de comprometer la entrega.',
        private_driver_not_accepted: 'Pedir aceptacion del conductor privado.',
        destination_coordinates_missing: 'Corregir coordenadas de destino antes de cerrar ruta.',
        evidence_missing: 'Solicitar POD, foto o firma faltante.',
        incident_critical: 'Resolver novedad critica antes de cerrar.',
        manifest_gap: 'Revisar diferencias de manifiesto con bodega o receptor.',
        rejection_without_reason: 'Documentar motivo de rechazo y soporte fotografico.',
        private_external_proof_pending: 'Dejar comprobante privado pendiente como alerta documental.',
    };

    return actions[code] || 'Revisar la entrega antes de continuar.';
}

function buildDelaySignals(input: DeliveryRiskInput, now: Date): DelaySignal[] {
    const signals: DelaySignal[] = [];
    const hoursToDelivery = hoursUntil(input.deliveryDate, now);
    const pingAgeMinutes = minutesSince(input.lastPingAt, now);

    if (input.deliveryDate && isPast(input.deliveryDate, now) && !input.deliveryVerifiedAt) {
        signals.push({
            code: 'delivery_window_breached',
            label: 'Ventana de entrega vencida sin cierre confirmado.',
            severity: 'critical',
        });
    } else if (hoursToDelivery !== null && hoursToDelivery <= 4 && !input.deliveryVerifiedAt) {
        signals.push({
            code: 'delivery_window_close',
            label: 'Ventana de entrega cercana.',
            severity: hoursToDelivery <= 1 ? 'high' : 'medium',
        });
    }

    if (ACTIVE_ROUTE_STATUSES.has(String(input.status || '')) && !input.lastPingAt) {
        signals.push({
            code: 'tracking_missing',
            label: 'Ruta activa sin rastreo reciente.',
            severity: 'high',
        });
    } else if (pingAgeMinutes !== null && pingAgeMinutes > 30 && ACTIVE_ROUTE_STATUSES.has(String(input.status || ''))) {
        signals.push({
            code: 'tracking_stale',
            label: `Ultimo ping hace ${pingAgeMinutes} min.`,
            severity: pingAgeMinutes > 60 ? 'critical' : 'high',
        });
    }

    return signals;
}

export function detectDelaySignals(input: DeliveryRiskInput): DelaySignal[] {
    const now = input.now ? new Date(input.now) : new Date();
    return buildDelaySignals(input, now);
}

export function calculateDeliveryFailureRisk(input: DeliveryRiskInput): DeliveryRiskResult {
    const now = input.now ? new Date(input.now) : new Date();
    const reasons: AlgorithmReason[] = [];
    let rawScore = CLOSED_STATUSES.has(String(input.status || '')) ? 4 : 8;

    if (!input.assignedTruckerId && !CLOSED_STATUSES.has(String(input.status || ''))) {
        rawScore += 18;
        pushReason(reasons, 'driver_not_assigned', 'Entrega sin conductor asignado.', 18);
    }

    if (
        input.rail === 'private_fleet'
        && ASSIGNED_STATUSES.has(String(input.status || ''))
        && input.privateFleetAssignmentStatus
        && input.privateFleetAssignmentStatus !== 'accepted'
    ) {
        rawScore += 12;
        pushReason(reasons, 'private_driver_not_accepted', 'Conductor privado aun no acepto la ruta.', 12);
    }

    if (!hasValidCoordinates(input.destination)) {
        rawScore += 16;
        pushReason(reasons, 'destination_coordinates_missing', 'Destino sin coordenadas validas.', 16);
    }

    const delaySignals = buildDelaySignals(input, now);
    for (const signal of delaySignals) {
        const weight = signal.severity === 'critical' ? 35 : signal.severity === 'high' ? 25 : 12;
        rawScore += weight;
        pushReason(reasons, signal.code, signal.label, weight);
    }

    const accuracy = Number(input.lastPingAccuracyMeters || 0);
    if (accuracy > 120) {
        rawScore += accuracy > 300 ? 12 : 7;
        pushReason(reasons, 'gps_low_accuracy', `Precision GPS baja: ${Math.round(accuracy)} m.`, accuracy > 300 ? 12 : 7);
    }

    const missingEvidence = Number(input.evidenceMissingCount || 0);
    if (missingEvidence > 0) {
        const weight = Math.min(24, missingEvidence * 8);
        rawScore += weight;
        pushReason(reasons, 'evidence_missing', `${missingEvidence} requisito(s) de evidencia pendiente(s).`, weight);
    }

    const criticalIncidents = Number(input.openCriticalIncidents || 0);
    if (criticalIncidents > 0) {
        const weight = Math.min(30, criticalIncidents * 18);
        rawScore += weight;
        pushReason(reasons, 'incident_critical', `${criticalIncidents} novedad(es) critica(s) abierta(s).`, weight);
    }

    const expected = Number(input.manifestExpectedCount || 0);
    const delivered = Number(input.manifestDeliveredCount || 0);
    const rejected = Number(input.manifestRejectedCount || 0);
    if (expected > 0 && delivered + rejected < expected && ['completed', 'delivered'].includes(String(input.status || ''))) {
        rawScore += 18;
        pushReason(reasons, 'manifest_gap', 'Manifiesto no cuadra con la entrega cerrada.', 18);
    }

    const rejectedWithoutReason = Number(input.rejectedWithoutReasonCount || 0);
    if (rejectedWithoutReason > 0) {
        rawScore += 16;
        pushReason(reasons, 'rejection_without_reason', 'Hay rechazos sin motivo documentado.', 16);
    }

    if (input.rail === 'private_fleet' && input.externalProofPending) {
        rawScore += 6;
        pushReason(reasons, 'private_external_proof_pending', 'Comprobante privado pendiente; no afecta wallet marketplace.', 6);
    }

    if (input.deliveryVerifiedAt && input.hasDeliverySignature && input.hasDeliveryPhoto) {
        rawScore -= 25;
    }

    const score = clampScore(rawScore);
    const riskLevel = riskLevelFromScore(score);
    const blockingForClosure = reasons.some((reason) => (
        ['evidence_missing', 'incident_critical', 'manifest_gap', 'rejection_without_reason'].includes(reason.code)
    ));

    return {
        offerId: input.offerId,
        businessId: input.businessId,
        rail: input.rail,
        score,
        riskLevel,
        reasons,
        recommendedActions: Array.from(new Set(reasons.map((reason) => actionForReason(reason.code)))).slice(0, 4),
        delaySignals,
        blockingForClosure,
    };
}

