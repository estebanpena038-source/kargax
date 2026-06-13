export type PlanLimitFeatureKey =
    | 'warehouse_limit'
    | 'team_limit'
    | 'monthly_trip_limit'
    | 'private_fleet_limit'
    | 'last_mile_contract_limit'
    | 'last_mile_alert_limit';

export interface PlanLimitErrorDetails {
    featureKey: PlanLimitFeatureKey | string;
    currentUsage: number;
    limitValue: number;
    recommendedPlan: string | null;
    checkoutPath: string;
}

const FEATURE_LABELS: Record<string, string> = {
    warehouse_limit: 'bodegas activas',
    team_limit: 'usuarios internos',
    monthly_trip_limit: 'viajes del mes',
    private_fleet_limit: 'conductores privados',
    last_mile_contract_limit: 'contratos de margen activos',
    last_mile_alert_limit: 'alertas de margen del mes',
};

const PLAN_LABELS: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    growth: 'Growth',
    pro: 'Growth',
    scale: 'Scale',
    enterprise: 'Enterprise',
};

export class PlanLimitReachedError extends Error {
    readonly code = 'PLAN_LIMIT_REACHED';
    readonly status = 402;
    readonly details: PlanLimitErrorDetails;

    constructor(message: string, details: PlanLimitErrorDetails) {
        super(message);
        this.name = 'PlanLimitReachedError';
        this.details = details;
    }
}

export function isPlanLimitReachedError(error: unknown): error is PlanLimitReachedError {
    return error instanceof PlanLimitReachedError || (
        Boolean(error) &&
        typeof error === 'object' &&
        (error as { name?: string; code?: string }).name === 'PlanLimitReachedError'
    ) || (
        Boolean(error) &&
        typeof error === 'object' &&
        (error as { code?: string }).code === 'PLAN_LIMIT_REACHED'
    );
}

export function coercePlanLimitDetails(input: unknown): PlanLimitErrorDetails | null {
    if (!input || typeof input !== 'object') {
        return null;
    }

    const candidate = input as Partial<PlanLimitErrorDetails>;

    if (!candidate.featureKey || typeof candidate.featureKey !== 'string') {
        return null;
    }

    const currentUsage = Number(candidate.currentUsage);
    const limitValue = Number(candidate.limitValue);

    if (!Number.isFinite(currentUsage) || !Number.isFinite(limitValue)) {
        return null;
    }

    return {
        featureKey: candidate.featureKey,
        currentUsage,
        limitValue,
        recommendedPlan: typeof candidate.recommendedPlan === 'string' ? candidate.recommendedPlan : null,
        checkoutPath: typeof candidate.checkoutPath === 'string' ? candidate.checkoutPath : '/planes',
    };
}

export function getPlanLabel(planCode: string | null | undefined) {
    if (!planCode) {
        return 'Growth';
    }

    return PLAN_LABELS[planCode] || planCode.charAt(0).toUpperCase() + planCode.slice(1);
}

export function getPlanLimitFeatureLabel(featureKey: string) {
    return FEATURE_LABELS[featureKey] || 'recursos del plan';
}

export function buildPlanLimitCopy(details: PlanLimitErrorDetails) {
    const featureLabel = getPlanLimitFeatureLabel(details.featureKey);
    const planLabel = getPlanLabel(details.recommendedPlan);

    return {
        title: 'Tu operacion ya supero el limite del plan actual',
        description: `Tus datos siguen seguros. Tienes ${details.currentUsage} ${featureLabel} y el limite actual es ${details.limitValue}. Para crear mas viajes, usuarios, bodegas o conductores, activa ${planLabel}.`,
        actionLabel: `Ver ${planLabel}`,
    };
}

export async function recordPlanLimitEvent(
    details: PlanLimitErrorDetails,
    message: string,
    headers?: HeadersInit
) {
    try {
        await fetch('/api/billing/paywall-events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(headers || {}),
            },
            body: JSON.stringify({
                featureKey: details.featureKey,
                currentUsage: details.currentUsage,
                limitValue: details.limitValue,
                message,
                metadata: {
                    checkoutPath: details.checkoutPath,
                    recommendedPlan: details.recommendedPlan,
                    source: 'client_limit_guard',
                },
            }),
        });
    } catch {
        // Paywall telemetry should never block the user's upgrade path.
    }
}
