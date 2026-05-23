export type MoneyFlowStatus =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'refunded'
    | 'failed'
    | 'expired';

export interface FreightPaymentReference {
    version: 1;
    kind: 'freight';
    offer_id: string;
    application_id: string;
    payment_id: string;
    trucker_id: string;
    payer_id: string;
}

export interface BillingPlanPaymentReference {
    version: 1;
    kind: 'billing_plan';
    attempt_id: string;
    business_id: string;
    plan_code: string;
    payer_id: string;
}

export interface PrivateFleetPayrollPaymentReference {
    version: 1;
    kind: 'private_fleet_payroll';
    run_id: string;
    business_id: string;
    payer_id: string;
}

export type PaymentReferenceData =
    | FreightPaymentReference
    | BillingPlanPaymentReference
    | PrivateFleetPayrollPaymentReference;

const PAYMENT_REFERENCE_SEPARATOR = '|';

export function buildFreightPaymentReference(payload: Omit<FreightPaymentReference, 'version' | 'kind'>): FreightPaymentReference {
    return {
        version: 1,
        kind: 'freight',
        ...payload,
    };
}

export function buildBillingPlanPaymentReference(payload: Omit<BillingPlanPaymentReference, 'version' | 'kind'>): BillingPlanPaymentReference {
    return {
        version: 1,
        kind: 'billing_plan',
        ...payload,
    };
}

export function buildPrivateFleetPayrollPaymentReference(
    payload: Omit<PrivateFleetPayrollPaymentReference, 'version' | 'kind'>
): PrivateFleetPayrollPaymentReference {
    return {
        version: 1,
        kind: 'private_fleet_payroll',
        ...payload,
    };
}

export function serializePaymentReference(reference: PaymentReferenceData) {
    if (reference.kind === 'freight') {
        return [
            `v${reference.version}`,
            reference.kind,
            reference.offer_id,
            reference.application_id,
            reference.payment_id,
            reference.trucker_id,
            reference.payer_id,
        ].join(PAYMENT_REFERENCE_SEPARATOR);
    }

    if (reference.kind === 'billing_plan') {
        return [
            `v${reference.version}`,
            reference.kind,
            reference.attempt_id,
            reference.business_id,
            reference.plan_code,
            reference.payer_id,
        ].join(PAYMENT_REFERENCE_SEPARATOR);
    }

    return [
        `v${reference.version}`,
        reference.kind,
        reference.run_id,
        reference.business_id,
        reference.payer_id,
    ].join(PAYMENT_REFERENCE_SEPARATOR);
}

export function parsePaymentReference(rawReference: unknown): PaymentReferenceData | null {
    if (!rawReference || typeof rawReference !== 'string') {
        return null;
    }

    const compactReference = parseCompactPaymentReference(rawReference);

    if (compactReference) {
        return compactReference;
    }

    try {
        const parsed = JSON.parse(rawReference) as Partial<PaymentReferenceData>;

        if (parsed.kind === 'freight' && parsed.offer_id && parsed.application_id && parsed.payment_id && parsed.trucker_id && parsed.payer_id) {
            return {
                version: 1,
                kind: 'freight',
                offer_id: parsed.offer_id,
                application_id: parsed.application_id,
                payment_id: parsed.payment_id,
                trucker_id: parsed.trucker_id,
                payer_id: parsed.payer_id,
            };
        }

        if (parsed.kind === 'billing_plan' && parsed.attempt_id && parsed.business_id && parsed.plan_code && parsed.payer_id) {
            return {
                version: 1,
                kind: 'billing_plan',
                attempt_id: parsed.attempt_id,
                business_id: parsed.business_id,
                plan_code: parsed.plan_code,
                payer_id: parsed.payer_id,
            };
        }

        if (parsed.kind === 'private_fleet_payroll' && parsed.run_id && parsed.business_id && parsed.payer_id) {
            return {
                version: 1,
                kind: 'private_fleet_payroll',
                run_id: parsed.run_id,
                business_id: parsed.business_id,
                payer_id: parsed.payer_id,
            };
        }

        return null;
    } catch {
        return null;
    }
}

function parseCompactPaymentReference(rawReference: string): PaymentReferenceData | null {
    const [versionToken, kind, ...parts] = rawReference.split(PAYMENT_REFERENCE_SEPARATOR);

    if (versionToken !== 'v1') {
        return null;
    }

    if (kind === 'freight' && parts.length === 5) {
        const [offer_id, application_id, payment_id, trucker_id, payer_id] = parts;

        if (offer_id && application_id && payment_id && trucker_id && payer_id) {
            return {
                version: 1,
                kind: 'freight',
                offer_id,
                application_id,
                payment_id,
                trucker_id,
                payer_id,
            };
        }
    }

    if (kind === 'billing_plan' && parts.length === 4) {
        const [attempt_id, business_id, plan_code, payer_id] = parts;

        if (attempt_id && business_id && plan_code && payer_id) {
            return {
                version: 1,
                kind: 'billing_plan',
                attempt_id,
                business_id,
                plan_code,
                payer_id,
            };
        }
    }

    if (kind === 'private_fleet_payroll' && parts.length === 3) {
        const [run_id, business_id, payer_id] = parts;

        if (run_id && business_id && payer_id) {
            return {
                version: 1,
                kind: 'private_fleet_payroll',
                run_id,
                business_id,
                payer_id,
            };
        }
    }

    return null;
}

export function buildPaymentIdempotencyKey(parts: Array<string | number | null | undefined>) {
    return parts
        .filter((part) => part !== null && part !== undefined && String(part).trim())
        .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '-'))
        .join(':')
        .slice(0, 255);
}

export function mapMercadoPagoStatusToMoneyFlow(status: string | null | undefined): MoneyFlowStatus {
    const normalizedStatus = String(status || '').toLowerCase();

    if (normalizedStatus === 'approved') {
        return 'completed';
    }

    if (['authorized', 'in_process', 'in_mediation'].includes(normalizedStatus)) {
        return 'processing';
    }

    if (normalizedStatus === 'expired') {
        return 'expired';
    }

    if (['refunded', 'charged_back'].includes(normalizedStatus)) {
        return 'refunded';
    }

    if (['cancelled', 'rejected', 'failed'].includes(normalizedStatus)) {
        return 'failed';
    }

    return 'pending';
}
