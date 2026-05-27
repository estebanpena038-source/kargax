type ContractLike = {
    pricing_model?: string | null;
    base_rate_cop?: number | string | null;
    per_km_rate_cop?: number | string | null;
    per_kg_rate_cop?: number | string | null;
    minimum_rate_cop?: number | string | null;
    maximum_rate_cop?: number | string | null;
    fuel_surcharge_cop?: number | string | null;
    other_surcharge_cop?: number | string | null;
} | null;

type OfferLike = {
    total_amount?: number | string | null;
    platform_fee?: number | string | null;
    net_amount?: number | string | null;
    is_private_fleet?: boolean | null;
    freight_payment_amount?: number | string | null;
    expense_allowance_amount?: number | string | null;
    weight_kg?: number | string | null;
    status?: string | null;
    pickup_verified_at?: string | null;
    delivery_verified_at?: string | null;
    loading_completed_at?: string | null;
    unloading_completed_at?: string | null;
    delivery_date?: string | null;
};

function amount(value: unknown) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min = 0, max = 100) {
    return Math.min(max, Math.max(min, value));
}

export function calculateContractedCost(contract: ContractLike, offer: OfferLike) {
    if (!contract) {
        return amount(offer.total_amount || offer.net_amount);
    }

    const base = amount(contract.base_rate_cop);
    const weight = amount(offer.weight_kg);
    const byWeight = amount(contract.per_kg_rate_cop) * weight;
    const expected = base + byWeight + amount(contract.fuel_surcharge_cop) + amount(contract.other_surcharge_cop);
    const minimum = amount(contract.minimum_rate_cop);
    const maximum = contract.maximum_rate_cop === null || contract.maximum_rate_cop === undefined
        ? null
        : amount(contract.maximum_rate_cop);
    const floored = Math.max(expected, minimum);

    return maximum !== null && maximum > 0 ? Math.min(floored, maximum) : floored;
}

export function calculateActualCost(offer: OfferLike) {
    const platformFee = amount(offer.platform_fee);
    const netAmount = amount(offer.net_amount);
    const totalAmount = amount(offer.total_amount);

    if (offer.is_private_fleet) {
        return {
            finalCostCop: amount(offer.freight_payment_amount) + amount(offer.expense_allowance_amount),
            payoutCostCop: amount(offer.freight_payment_amount),
            platformFeeCop: platformFee,
            privateExpenseCostCop: amount(offer.expense_allowance_amount),
        };
    }

    return {
        finalCostCop: netAmount + platformFee || totalAmount,
        payoutCostCop: netAmount || Math.max(0, totalAmount - platformFee),
        platformFeeCop: platformFee,
        privateExpenseCostCop: 0,
    };
}

export function calculateCostVariance(expectedCostCop: number, finalCostCop: number) {
    const overrunCop = finalCostCop - expectedCostCop;
    const overrunPct = expectedCostCop > 0 ? (overrunCop / expectedCostCop) * 100 : 0;
    return {
        overrunCop,
        overrunPct,
    };
}

export function computeEvidenceScore(input: {
    offer: OfferLike;
    pickingEventsCount: number;
    signatureCount: number;
    incidentCount: number;
    photoCount: number;
}) {
    let score = 0;
    if (input.offer.pickup_verified_at) score += 20;
    if (input.offer.delivery_verified_at) score += 25;
    if (input.pickingEventsCount > 0) score += 15;
    if (input.signatureCount > 0) score += 20;
    if (input.photoCount > 0) score += 15;
    if (input.incidentCount > 0 && input.signatureCount === 0 && input.photoCount === 0) score -= 20;
    return clamp(score);
}

export function computeOnTimeScore(offer: OfferLike) {
    if (!offer.delivery_date || !offer.unloading_completed_at) {
        return ['completed', 'delivered'].includes(String(offer.status || '')) ? 70 : 50;
    }

    const due = new Date(`${offer.delivery_date}T23:59:59.999Z`).getTime();
    const done = new Date(offer.unloading_completed_at).getTime();
    return done <= due ? 100 : 70;
}

export function computeCompletionScore(offer: OfferLike) {
    if (['completed', 'delivered'].includes(String(offer.status || ''))) return 100;
    if (['in_progress', 'assigned', 'reserved'].includes(String(offer.status || ''))) return 60;
    if (['cancelled', 'expired'].includes(String(offer.status || ''))) return 0;
    return 40;
}

export function computeProviderScore(input: {
    evidenceScore: number;
    onTimeScore: number;
    completionScore: number;
    overrunPct: number;
    incidentCount: number;
}) {
    const costScore = clamp(100 - Math.max(0, input.overrunPct));
    const incidentPenalty = Math.min(30, input.incidentCount * 10);
    return clamp(
        input.evidenceScore * 0.30 +
        input.onTimeScore * 0.20 +
        input.completionScore * 0.25 +
        costScore * 0.25 -
        incidentPenalty
    );
}

export function percentile(values: number[], p: number) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index] || 0;
}
