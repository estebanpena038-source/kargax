import { toDate, minutesBetween, isPast } from '../shared/date';
import { clampScore, riskLevelFromScore } from '../shared/scoring';
import type { AlgorithmRiskLevel } from '../shared/types';

export interface SlaComplianceInput {
    offerId: string;
    status: string | null;
    // Scheduled windows
    pickupDate: string | null;
    pickupTimeEnd: string | null;
    deliveryDate: string | null;
    deliveryTimeEnd: string | null;
    // Actual operational timestamps
    arrivedAtOriginAt: string | null;
    loadingStartedAt: string | null;
    loadingCompletedAt: string | null;
    pickupVerifiedAt: string | null;
    arrivedAtDestinationAt: string | null;
    unloadingStartedAt: string | null;
    unloadingCompletedAt: string | null;
    deliveryVerifiedAt: string | null;
    // Context
    now?: string | Date;
}

export type SlaStatus = 'on_time' | 'at_risk' | 'breached' | 'pending' | 'not_applicable';

export interface SlaComplianceResult {
    offerId: string;
    // SLA status
    pickupSlaStatus: SlaStatus;
    deliverySlaStatus: SlaStatus;
    overallSlaStatus: 'on_time' | 'at_risk' | 'breached' | 'pending';
    // Delays in minutes (positive if delayed, null if not applicable or pending without breach)
    pickupDelayMinutes: number | null;
    deliveryDelayMinutes: number | null;
    // Operational time intervals in minutes
    dwellTimeOriginMinutes: number | null;
    dwellTimeDestinationMinutes: number | null;
    loadingDurationMinutes: number | null;
    unloadingDurationMinutes: number | null;
    tripDurationMinutes: number | null;
    totalCycleMinutes: number | null;
    // Score 0-100 (100 = perfect compliance)
    complianceScore: number;
    complianceLevel: AlgorithmRiskLevel;
}

function parseDateTime(dateStr: string | null | undefined, timeStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const cleanDate = dateStr.trim();
    if (!cleanDate) return null;

    // If dateStr is already a full ISO string
    if (cleanDate.includes('T') && (cleanDate.endsWith('Z') || cleanDate.includes('+') || cleanDate.includes('-'))) {
        return toDate(cleanDate);
    }

    const datePart = cleanDate.split('T')[0];
    const cleanTime = (timeStr && timeStr.trim()) ? timeStr.trim() : '23:59:59';
    const timePart = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;

    // Standardize to ISO UTC
    const combinedIso = `${datePart}T${timePart}Z`;
    const parsed = toDate(combinedIso);
    if (parsed) return parsed;

    return toDate(cleanDate);
}

function calculateInterval(laterStr: string | null | undefined, earlierStr: string | null | undefined): number | null {
    if (!laterStr || !earlierStr) return null;
    const mins = minutesBetween(laterStr, earlierStr);
    if (mins === null || !Number.isFinite(mins) || mins < 0) return null;
    return mins;
}

export function computeSlaCompliance(input: SlaComplianceInput): SlaComplianceResult {
    const now = input.now ? (toDate(input.now) || new Date()) : new Date();
    const isCompleted = ['completed', 'delivered'].includes(String(input.status || '').toLowerCase());
    const isCancelled = ['cancelled', 'expired'].includes(String(input.status || '').toLowerCase());
    const isActive = ['in_progress', 'assigned', 'reserved', 'picked_up', 'in_transit'].includes(String(input.status || '').toLowerCase());

    // 1. Pickup SLA Assessment
    const pickupDeadline = parseDateTime(input.pickupDate, input.pickupTimeEnd);
    let pickupSlaStatus: SlaStatus = 'not_applicable';
    let pickupDelayMinutes: number | null = null;

    if (pickupDeadline) {
        const pickupActual = toDate(input.pickupVerifiedAt || input.loadingCompletedAt);
        if (pickupActual) {
            const diffMins = minutesBetween(pickupActual, pickupDeadline);
            if (diffMins !== null && diffMins > 0) {
                pickupSlaStatus = 'breached';
                pickupDelayMinutes = diffMins;
            } else {
                pickupSlaStatus = 'on_time';
                pickupDelayMinutes = 0;
            }
        } else if (isCancelled) {
            pickupSlaStatus = 'not_applicable';
        } else if (isPast(pickupDeadline, now)) {
            const delay = minutesBetween(now, pickupDeadline);
            pickupSlaStatus = 'breached';
            pickupDelayMinutes = delay !== null && delay > 0 ? delay : 0;
        } else {
            const minsToDeadline = minutesBetween(pickupDeadline, now);
            if (minsToDeadline !== null && minsToDeadline <= 120 && minsToDeadline >= 0 && isActive) {
                pickupSlaStatus = 'at_risk';
            } else {
                pickupSlaStatus = 'pending';
            }
        }
    }

    // 2. Delivery SLA Assessment
    const deliveryDeadline = parseDateTime(input.deliveryDate, input.deliveryTimeEnd);
    let deliverySlaStatus: SlaStatus = 'not_applicable';
    let deliveryDelayMinutes: number | null = null;

    if (deliveryDeadline) {
        const deliveryActual = toDate(input.deliveryVerifiedAt || input.unloadingCompletedAt);
        if (deliveryActual) {
            const diffMins = minutesBetween(deliveryActual, deliveryDeadline);
            if (diffMins !== null && diffMins > 0) {
                deliverySlaStatus = 'breached';
                deliveryDelayMinutes = diffMins;
            } else {
                deliverySlaStatus = 'on_time';
                deliveryDelayMinutes = 0;
            }
        } else if (isCancelled) {
            deliverySlaStatus = 'not_applicable';
        } else if (isPast(deliveryDeadline, now)) {
            const delay = minutesBetween(now, deliveryDeadline);
            deliverySlaStatus = 'breached';
            deliveryDelayMinutes = delay !== null && delay > 0 ? delay : 0;
        } else {
            const minsToDeadline = minutesBetween(deliveryDeadline, now);
            if (minsToDeadline !== null && minsToDeadline <= 240 && minsToDeadline >= 0 && (isActive || isCompleted)) {
                deliverySlaStatus = 'at_risk';
            } else {
                deliverySlaStatus = 'pending';
            }
        }
    }

    // 3. Operational Durations and Dwell Times (in minutes)
    const dwellTimeOriginMinutes = calculateInterval(input.loadingStartedAt, input.arrivedAtOriginAt);
    const dwellTimeDestinationMinutes = calculateInterval(input.unloadingStartedAt, input.arrivedAtDestinationAt);
    const loadingDurationMinutes = calculateInterval(input.loadingCompletedAt, input.loadingStartedAt);
    const unloadingDurationMinutes = calculateInterval(input.unloadingCompletedAt, input.unloadingStartedAt);
    const tripDurationMinutes = calculateInterval(input.deliveryVerifiedAt, input.pickupVerifiedAt);
    const totalCycleMinutes = calculateInterval(input.deliveryVerifiedAt, input.arrivedAtOriginAt);

    // 4. Overall SLA Status
    let overallSlaStatus: 'on_time' | 'at_risk' | 'breached' | 'pending' = 'pending';
    if (pickupSlaStatus === 'breached' || deliverySlaStatus === 'breached') {
        overallSlaStatus = 'breached';
    } else if (pickupSlaStatus === 'at_risk' || deliverySlaStatus === 'at_risk') {
        overallSlaStatus = 'at_risk';
    } else if (deliverySlaStatus === 'on_time' || (deliverySlaStatus === 'not_applicable' && pickupSlaStatus === 'on_time')) {
        overallSlaStatus = 'on_time';
    } else if (isCompleted) {
        overallSlaStatus = 'on_time';
    }

    // 5. Compliance Score (100 = perfect score, penalty deductions for breaches/excessive delays)
    let score = 100;
    if (deliverySlaStatus === 'breached') {
        score -= 40;
        const extraHours = Math.floor((deliveryDelayMinutes || 0) / 60);
        score -= Math.min(25, extraHours * 5);
    } else if (deliverySlaStatus === 'at_risk') {
        score -= 15;
    }

    if (pickupSlaStatus === 'breached') {
        score -= 25;
        const extraHours = Math.floor((pickupDelayMinutes || 0) / 60);
        score -= Math.min(15, extraHours * 3);
    } else if (pickupSlaStatus === 'at_risk') {
        score -= 10;
    }

    if (dwellTimeOriginMinutes !== null && dwellTimeOriginMinutes > 60) {
        const excessHalfHours = Math.floor((dwellTimeOriginMinutes - 60) / 30);
        score -= Math.min(10, excessHalfHours * 3);
    }

    if (dwellTimeDestinationMinutes !== null && dwellTimeDestinationMinutes > 60) {
        const excessHalfHours = Math.floor((dwellTimeDestinationMinutes - 60) / 30);
        score -= Math.min(10, excessHalfHours * 3);
    }

    if (isCancelled) {
        score = 20;
    }

    const normalizedScore = clampScore(score);
    // Inverted risk level: High score (100) -> 'low' risk; Low score (20) -> 'critical' risk
    let complianceLevel = riskLevelFromScore(100 - normalizedScore);
    if (deliverySlaStatus === 'breached' && (complianceLevel === 'low' || complianceLevel === 'medium')) {
        complianceLevel = normalizedScore <= 45 ? 'critical' : 'high';
    }

    return {
        offerId: input.offerId,
        pickupSlaStatus,
        deliverySlaStatus,
        overallSlaStatus,
        pickupDelayMinutes,
        deliveryDelayMinutes,
        dwellTimeOriginMinutes,
        dwellTimeDestinationMinutes,
        loadingDurationMinutes,
        unloadingDurationMinutes,
        tripDurationMinutes,
        totalCycleMinutes,
        complianceScore: normalizedScore,
        complianceLevel,
    };
}
