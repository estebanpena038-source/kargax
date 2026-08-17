import { clampScore, riskLevelFromScore } from '../shared/scoring';
import type { AlgorithmRiskLevel } from '../shared/types';

export interface CostAnomalyInput {
    offerId: string;
    totalAmount: number;
    ratePerKm: number | null;
    estimatedDistanceKm: number | null;
    weightKg: number;
    originCity: string;
    destinationCity: string;
    vehicleType: string;
    isPrivateFleet: boolean;
}

export interface RouteHistoricalBaseline {
    routeKey: string;
    avgTotalAmount: number;
    stddevTotalAmount: number;
    avgRatePerKm: number;
    sampleCount: number;
    p95TotalAmount: number;
    minTotalAmount: number;
    maxTotalAmount: number;
}

export interface CostAnomalyResult {
    offerId: string;
    routeKey: string;
    isAnomaly: boolean;
    deviationPct: number;
    deviationFromP95Pct: number;
    expectedCost: number;
    actualCost: number;
    computedRatePerKm: number | null;
    baselineAvgRatePerKm: number | null;
    baselineSampleCount: number;
    severity: AlgorithmRiskLevel;
    reason: string;
}

export function buildRouteKey(originCity: string | null | undefined, destinationCity: string | null | undefined): string {
    const origin = (originCity || '').trim().toLowerCase();
    const destination = (destinationCity || '').trim().toLowerCase();
    if (!origin && !destination) return 'ruta_desconocida';
    return `${origin || 'desconocido'}→${destination || 'desconocido'}`;
}

function calculatePercentile(values: number[], p: number): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index] ?? 0;
}

export function computeRouteBaseline(offers: CostAnomalyInput[]): Map<string, RouteHistoricalBaseline> {
    const grouped = new Map<string, CostAnomalyInput[]>();

    for (const offer of offers) {
        const amount = Number(offer.totalAmount);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        const key = buildRouteKey(offer.originCity, offer.destinationCity);
        const current = grouped.get(key) || [];
        current.push(offer);
        grouped.set(key, current);
    }

    const baselines = new Map<string, RouteHistoricalBaseline>();

    for (const [routeKey, routeOffers] of grouped.entries()) {
        const amounts = routeOffers.map((o) => Number(o.totalAmount)).filter((n) => Number.isFinite(n) && n > 0);
        if (!amounts.length) continue;

        const sampleCount = amounts.length;
        const sum = amounts.reduce((acc, curr) => acc + curr, 0);
        const avgTotalAmount = sum / sampleCount;

        // Compute standard deviation
        const squaredDiffs = amounts.map((val) => Math.pow(val - avgTotalAmount, 2));
        const variance = squaredDiffs.reduce((acc, curr) => acc + curr, 0) / sampleCount;
        const stddevTotalAmount = Math.sqrt(variance);

        // Compute average rate per km
        const ratesPerKm: number[] = [];
        for (const o of routeOffers) {
            if (o.ratePerKm && Number.isFinite(Number(o.ratePerKm)) && Number(o.ratePerKm) > 0) {
                ratesPerKm.push(Number(o.ratePerKm));
            } else if (o.estimatedDistanceKm && o.estimatedDistanceKm > 0 && o.totalAmount > 0) {
                ratesPerKm.push(o.totalAmount / o.estimatedDistanceKm);
            }
        }
        const avgRatePerKm = ratesPerKm.length > 0
            ? ratesPerKm.reduce((acc, curr) => acc + curr, 0) / ratesPerKm.length
            : 0;

        const p95TotalAmount = calculatePercentile(amounts, 95);
        const minTotalAmount = Math.min(...amounts);
        const maxTotalAmount = Math.max(...amounts);

        baselines.set(routeKey, {
            routeKey,
            avgTotalAmount: Math.round(avgTotalAmount),
            stddevTotalAmount: Math.round(stddevTotalAmount),
            avgRatePerKm: Math.round(avgRatePerKm),
            sampleCount,
            p95TotalAmount: Math.round(p95TotalAmount),
            minTotalAmount: Math.round(minTotalAmount),
            maxTotalAmount: Math.round(maxTotalAmount),
        });
    }

    return baselines;
}

export function detectCostAnomaly(
    input: CostAnomalyInput,
    baseline: RouteHistoricalBaseline | null | undefined
): CostAnomalyResult {
    const routeKey = buildRouteKey(input.originCity, input.destinationCity);
    const actualCost = Math.max(0, Number(input.totalAmount) || 0);
    const distanceKm = Number(input.estimatedDistanceKm) || 0;

    let computedRatePerKm: number | null = null;
    if (input.ratePerKm && Number.isFinite(Number(input.ratePerKm)) && Number(input.ratePerKm) > 0) {
        computedRatePerKm = Math.round(Number(input.ratePerKm));
    } else if (distanceKm > 0 && actualCost > 0) {
        computedRatePerKm = Math.round(actualCost / distanceKm);
    }

    if (!baseline || baseline.sampleCount < 2) {
        return {
            offerId: input.offerId,
            routeKey,
            isAnomaly: false,
            deviationPct: 0,
            deviationFromP95Pct: 0,
            expectedCost: actualCost,
            actualCost,
            computedRatePerKm,
            baselineAvgRatePerKm: null,
            baselineSampleCount: baseline?.sampleCount || 0,
            severity: 'low',
            reason: 'Muestra historica insuficiente para determinar anomalia de costo en esta ruta.',
        };
    }

    const expectedCost = baseline.avgTotalAmount > 0 ? baseline.avgTotalAmount : actualCost;
    const deviation = actualCost - expectedCost;
    const deviationPct = expectedCost > 0 ? Math.round((deviation / expectedCost) * 100) : 0;
    const deviationFromP95 = baseline.p95TotalAmount > 0
        ? Math.round(((actualCost - baseline.p95TotalAmount) / baseline.p95TotalAmount) * 100)
        : 0;

    // Thresholds: >30% over baseline with at least 3 samples is considered an anomaly
    const isOverCost = deviationPct >= 30 && baseline.sampleCount >= 2;
    const isUnderCost = deviationPct <= -45 && baseline.sampleCount >= 3;
    const isAnomaly = isOverCost || isUnderCost;

    let severity: AlgorithmRiskLevel = 'low';
    let reason = 'Costo alineado con el historico de la ruta.';

    if (deviationPct >= 50) {
        severity = 'critical';
        reason = `Sobrecosto critico: +${deviationPct}% sobre el promedio de la ruta (${actualCost.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} vs ${expectedCost.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}).`;
    } else if (deviationPct >= 30) {
        severity = 'high';
        reason = `Desviacion alta de costo: +${deviationPct}% sobre el promedio historico.`;
    } else if (deviationPct >= 18) {
        severity = 'medium';
        reason = `Costo moderadamente elevado (+${deviationPct}% sobre promedio).`;
    } else if (isUnderCost) {
        severity = 'medium';
        reason = `Tarifa atipicamente baja (-${Math.abs(deviationPct)}% vs promedio). Verificar viabilidad operativa.`;
    }

    return {
        offerId: input.offerId,
        routeKey,
        isAnomaly,
        deviationPct,
        deviationFromP95Pct: deviationFromP95,
        expectedCost,
        actualCost,
        computedRatePerKm,
        baselineAvgRatePerKm: baseline.avgRatePerKm,
        baselineSampleCount: baseline.sampleCount,
        severity,
        reason,
    };
}
