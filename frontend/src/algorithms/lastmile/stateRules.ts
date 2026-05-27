import type { AlgorithmReason, AlgorithmRoleCapabilities, EvidenceQualityResult } from '../shared/types';

export interface StateRuleInput {
    currentStatus: string | null;
    targetStatus: string;
    role: string;
    capabilities: AlgorithmRoleCapabilities;
    evidence?: EvidenceQualityResult | null;
    hasAssignedDriver?: boolean;
    hasPickupPin?: boolean;
    hasDeliveryPin?: boolean;
    isPrivateFleet?: boolean;
}

export interface StateRuleResult {
    allowed: boolean;
    blockers: AlgorithmReason[];
    warnings: AlgorithmReason[];
    nextAllowedStatuses: string[];
}

const TRANSITIONS: Record<string, string[]> = {
    draft: ['active', 'assigned', 'cancelled'],
    active: ['assigned', 'cancelled'],
    assigned: ['in_progress', 'cancelled'],
    reserved: ['in_progress', 'cancelled'],
    in_progress: ['picked_up', 'in_transit', 'completed', 'cancelled'],
    picked_up: ['in_transit', 'completed', 'cancelled'],
    in_transit: ['completed', 'cancelled'],
    completed: [],
    delivered: [],
    cancelled: [],
};

function reason(code: string, label: string): AlgorithmReason {
    return { code, label };
}

export function evaluateDeliveryStateTransition(input: StateRuleInput): StateRuleResult {
    const current = String(input.currentStatus || 'draft');
    const nextAllowedStatuses = TRANSITIONS[current] || [];
    const blockers: AlgorithmReason[] = [];
    const warnings: AlgorithmReason[] = [];

    if (!nextAllowedStatuses.includes(input.targetStatus)) {
        blockers.push(reason('transition_not_allowed', `No se recomienda pasar de ${current} a ${input.targetStatus}.`));
    }

    if (input.targetStatus === 'in_progress' && !input.hasAssignedDriver) {
        blockers.push(reason('driver_required', 'Asigna conductor antes de iniciar ruta.'));
    }

    if (input.targetStatus === 'completed') {
        if (!input.hasDeliveryPin) {
            blockers.push(reason('delivery_pin_required', 'No cierres entrega sin PIN/POD validado.'));
        }

        if (input.evidence && !input.evidence.canCloseOperationally) {
            blockers.push(reason('evidence_required', 'La evidencia POD todavia no soporta el cierre operativo.'));
        }
    }

    if (input.isPrivateFleet && input.targetStatus === 'completed') {
        warnings.push(reason('private_fleet_documentary_payment', 'Flota privada puede requerir comprobante externo; no mover wallet desde algoritmos.'));
    }

    if (!input.capabilities.canViewOperations && !input.capabilities.canExecuteWarehouse) {
        warnings.push(reason('role_read_only', 'El rol actual debe operar como lectura o revision, no como cambio de estado.'));
    }

    return {
        allowed: blockers.length === 0,
        blockers,
        warnings,
        nextAllowedStatuses,
    };
}

