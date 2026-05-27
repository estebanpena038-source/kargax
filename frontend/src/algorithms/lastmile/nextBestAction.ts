import type {
    AlgorithmPriority,
    AlgorithmRoleCapabilities,
    DeliveryRiskResult,
    EvidenceQualityResult,
    NextBestAction,
    NextBestActionType,
    OperationRail,
} from '../shared/types';

interface NextBestActionInput {
    role: string;
    capabilities: AlgorithmRoleCapabilities;
    deliveryRisks: DeliveryRiskResult[];
    evidenceResults: EvidenceQualityResult[];
}

const OPERATIONAL_ROLES = ['admin', 'owner', 'manager', 'ops_manager', 'dispatcher', 'operator'];
const FINANCE_ROLES = ['admin', 'owner', 'finance_accountant', 'auditor'];
const WAREHOUSE_ROLES = ['admin', 'owner', 'warehouse_manager', 'warehouse_operator', 'operator'];

function actionId(type: NextBestActionType, sourceId: string) {
    return `${type}:${sourceId}`;
}

function priorityFromRisk(score: number): AlgorithmPriority {
    if (score >= 70) return 'P0';
    if (score >= 40) return 'P1';
    return 'P2';
}

function routeHref(offerId: string) {
    return `/viaje/${offerId}`;
}

function canSeeOperational(role: string, capabilities: AlgorithmRoleCapabilities) {
    return OPERATIONAL_ROLES.includes(role) || Boolean(capabilities.canViewOperations || capabilities.canViewTracking);
}

function canSeeEvidence(role: string, capabilities: AlgorithmRoleCapabilities) {
    return canSeeOperational(role, capabilities)
        || WAREHOUSE_ROLES.includes(role)
        || Boolean(capabilities.canViewEvidence);
}

function visibilityFor(type: NextBestActionType) {
    if (type === 'download_support') return FINANCE_ROLES;
    if (type === 'verify_manifest_difference') return [...OPERATIONAL_ROLES, ...WAREHOUSE_ROLES, 'auditor'];
    return OPERATIONAL_ROLES;
}

function createAction(payload: {
    type: NextBestActionType;
    sourceId: string;
    rail: OperationRail;
    priority: AlgorithmPriority;
    title: string;
    description: string;
    actionLabel: string;
    href: string;
    reason: string;
    signals: string[];
}): NextBestAction {
    return {
        id: actionId(payload.type, payload.sourceId),
        type: payload.type,
        priority: payload.priority,
        title: payload.title,
        description: payload.description,
        actionLabel: payload.actionLabel,
        href: payload.href,
        roleVisibility: visibilityFor(payload.type),
        reason: payload.reason,
        sourceId: payload.sourceId,
        rail: payload.rail,
        createdFromSignals: payload.signals,
    };
}

export function buildNextBestActions(input: NextBestActionInput): NextBestAction[] {
    const actions: NextBestAction[] = [];
    const operational = canSeeOperational(input.role, input.capabilities);
    const evidenceVisible = canSeeEvidence(input.role, input.capabilities);

    if (operational) {
        for (const risk of input.deliveryRisks) {
            const codes = risk.reasons.map((reason) => reason.code);
            const href = routeHref(risk.offerId);
            const priority = priorityFromRisk(risk.score);

            if (codes.includes('tracking_missing') || codes.includes('tracking_stale')) {
                actions.push(createAction({
                    type: 'request_live_tracking',
                    sourceId: risk.offerId,
                    rail: risk.rail,
                    priority,
                    title: 'Activar rastreo en vivo',
                    description: 'La ruta necesita ubicacion reciente para anticipar retrasos.',
                    actionLabel: 'Ver viaje',
                    href,
                    reason: 'Tracking ausente o vencido.',
                    signals: codes,
                }));
            } else if (codes.includes('delivery_window_breached') || codes.includes('delivery_window_close')) {
                actions.push(createAction({
                    type: 'review_delayed_route',
                    sourceId: risk.offerId,
                    rail: risk.rail,
                    priority,
                    title: 'Revisar ruta retrasada',
                    description: 'Confirma ETA, contacto de destino y siguiente accion del conductor.',
                    actionLabel: 'Revisar ruta',
                    href,
                    reason: 'Ventana de entrega en riesgo.',
                    signals: codes,
                }));
            } else if (codes.includes('driver_not_assigned') || codes.includes('private_driver_not_accepted')) {
                actions.push(createAction({
                    type: 'contact_driver',
                    sourceId: risk.offerId,
                    rail: risk.rail,
                    priority,
                    title: 'Resolver asignacion de conductor',
                    description: 'La entrega necesita conductor confirmado antes de avanzar.',
                    actionLabel: 'Gestionar viaje',
                    href,
                    reason: 'Conductor pendiente.',
                    signals: codes,
                }));
            }

            if (codes.includes('incident_critical')) {
                actions.push(createAction({
                    type: 'resolve_incident',
                    sourceId: risk.offerId,
                    rail: risk.rail,
                    priority: 'P0',
                    title: 'Resolver novedad critica',
                    description: 'Hay novedad abierta que puede bloquear el cierre logistico.',
                    actionLabel: 'Atender novedad',
                    href,
                    reason: 'Novedad critica abierta.',
                    signals: codes,
                }));
            }
        }
    }

    if (evidenceVisible) {
        for (const evidence of input.evidenceResults) {
            if (evidence.status === 'complete') continue;
            const missingCodes = evidence.missingRequirements.map((item) => item.code);
            actions.push(createAction({
                type: missingCodes.includes('delivery_signature_missing') || missingCodes.includes('delivery_photo_missing')
                    ? 'collect_missing_pod'
                    : 'verify_manifest_difference',
                sourceId: evidence.offerId,
                rail: evidence.rail,
                priority: evidence.status === 'blocked' ? 'P0' : 'P1',
                title: evidence.status === 'blocked' ? 'Completar evidencia obligatoria' : 'Revisar calidad de evidencia',
                description: 'El soporte de entrega aun no esta listo para reclamos, auditoria o reporte.',
                actionLabel: 'Ver evidencia',
                href: `${routeHref(evidence.offerId)}/entrega`,
                reason: evidence.missingRequirements[0]?.label || evidence.warnings[0]?.label || 'Evidencia requiere revision.',
                signals: [...missingCodes, ...evidence.warnings.map((item) => item.code)],
            }));
        }
    }

    const unique = new Map<string, NextBestAction>();
    for (const action of actions) {
        if (!unique.has(action.id)) unique.set(action.id, action);
    }

    return [...unique.values()]
        .filter((action) => input.role === 'admin' || action.roleVisibility.includes(input.role) || input.capabilities.canViewIntelligence)
        .filter((action) => {
            if (input.role === 'finance_accountant') {
                return action.type === 'download_support' || action.type === 'verify_manifest_difference' || action.type === 'collect_missing_pod';
            }
            return true;
        })
        .sort((left, right) => {
            const priorityOrder: Record<AlgorithmPriority, number> = { P0: 3, P1: 2, P2: 1 };
            return priorityOrder[right.priority] - priorityOrder[left.priority];
        })
        .slice(0, 8);
}
