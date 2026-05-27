import { clampScore, riskLevelFromScore } from '../shared/scoring';
import type {
    AlgorithmReason,
    EvidenceQualityInput,
    EvidenceQualityResult,
    EvidenceQualityStatus,
} from '../shared/types';

function issue(code: string, label: string, weight: number, detail?: string): AlgorithmReason {
    return { code, label, detail, weight };
}

export function validateEvidenceQuality(input: EvidenceQualityInput): EvidenceQualityResult {
    const missing: AlgorithmReason[] = [];
    const warnings: AlgorithmReason[] = [];
    let score = 100;

    if (!input.hasDeliverySignature) {
        score -= 28;
        missing.push(issue('delivery_signature_missing', 'Falta firma POD del receptor.', 28));
    }

    if (!input.hasDeliveryPhoto) {
        score -= 20;
        missing.push(issue('delivery_photo_missing', 'Falta foto de entrega.', 20));
    }

    if (!input.hasDeliveryPinVerified && !input.deliveryVerifiedAt) {
        score -= 22;
        missing.push(issue('delivery_pin_missing', 'PIN de entrega no verificado.', 22));
    }

    if (!input.hasRecipientName) {
        score -= 10;
        missing.push(issue('recipient_name_missing', 'Falta nombre del receptor.', 10));
    }

    if (!input.hasRecipientDocument) {
        score -= 8;
        warnings.push(issue('recipient_document_missing', 'Documento del receptor no registrado.', 8));
    }

    const destinationCoordinatesValid = input.destinationCoordinatesValid !== false;
    if (!destinationCoordinatesValid) {
        score -= 10;
        warnings.push(issue('destination_coordinates_missing', 'Destino sin coordenadas validas para validar llegada.', 10));
    } else if (
        input.lastDistanceToDestinationKm !== null
        && input.lastDistanceToDestinationKm !== undefined
        && input.lastDistanceToDestinationKm > 1.5
    ) {
        score -= input.lastDistanceToDestinationKm > 5 ? 18 : 10;
        warnings.push(issue(
            'tracking_far_from_destination',
            `Ultimo tracking a ${input.lastDistanceToDestinationKm.toFixed(1)} km del destino.`,
            input.lastDistanceToDestinationKm > 5 ? 18 : 10
        ));
    }

    const expected = Number(input.manifestExpectedCount || 0);
    const delivered = Number(input.manifestDeliveredCount || 0);
    const rejected = Number(input.manifestRejectedCount || 0);
    if (expected > 0 && delivered + rejected < expected) {
        score -= 18;
        warnings.push(issue('manifest_incomplete', 'Manifiesto incompleto frente a cantidades esperadas.', 18));
    }

    if (Number(input.rejectedWithoutReasonCount || 0) > 0) {
        score -= 22;
        warnings.push(issue('rejection_without_reason', 'Hay rechazos sin motivo preservado.', 22));
    }

    if (Number(input.openCriticalIncidents || 0) > 0) {
        score -= 20;
        warnings.push(issue('critical_incident_open', 'Existe novedad critica abierta.', 20));
    }

    if (input.rail === 'private_fleet' && input.externalProofPending) {
        warnings.push(issue(
            'private_external_proof_pending',
            'Comprobante privado pendiente; es alerta documental, no wallet.',
            0
        ));
    }

    const normalizedScore = clampScore(score);
    const hasCriticalMissing = missing.some((item) => (
        ['delivery_signature_missing', 'delivery_photo_missing', 'delivery_pin_missing'].includes(item.code)
    ));
    const suspicious = warnings.some((item) => (
        ['tracking_far_from_destination', 'rejection_without_reason', 'critical_incident_open'].includes(item.code)
    ));
    let status: EvidenceQualityStatus = 'complete';

    if (hasCriticalMissing && normalizedScore < 55) {
        status = 'blocked';
    } else if (hasCriticalMissing || normalizedScore < 75) {
        status = 'incomplete';
    } else if (suspicious) {
        status = 'suspicious';
    }

    const canCloseOperationally = status === 'complete' || status === 'suspicious';
    const canReleaseMarketplaceSettlementSuggestion = input.rail === 'marketplace'
        && canCloseOperationally
        && Boolean(input.deliveryVerifiedAt || input.hasDeliveryPinVerified);

    return {
        offerId: input.offerId,
        businessId: input.businessId,
        rail: input.rail,
        score: normalizedScore,
        riskLevel: riskLevelFromScore(100 - normalizedScore),
        status,
        missingRequirements: missing,
        warnings,
        canCloseOperationally,
        canReleaseMarketplaceSettlementSuggestion,
    };
}
