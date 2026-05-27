import type { AlgorithmRiskLevel } from './types';

export function clampScore(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function riskLevelFromScore(score: number): AlgorithmRiskLevel {
    if (score >= 85) return 'critical';
    if (score >= 65) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
}

export function maxRiskLevel(levels: AlgorithmRiskLevel[]): AlgorithmRiskLevel {
    const order: Record<AlgorithmRiskLevel, number> = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
    };
    return levels.reduce<AlgorithmRiskLevel>((current, next) => (
        order[next] > order[current] ? next : current
    ), 'low');
}

export function sortRiskLevelDesc<T extends { riskLevel: AlgorithmRiskLevel; score: number }>(items: T[]) {
    const order: Record<AlgorithmRiskLevel, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
    };
    return [...items].sort((left, right) => (
        order[right.riskLevel] - order[left.riskLevel] || right.score - left.score
    ));
}

