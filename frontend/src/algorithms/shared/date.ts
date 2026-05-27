export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export function toDate(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function minutesBetween(later: string | Date, earlier: string | Date) {
    const laterDate = toDate(later);
    const earlierDate = toDate(earlier);
    if (!laterDate || !earlierDate) return null;
    return Math.round((laterDate.getTime() - earlierDate.getTime()) / MINUTE_MS);
}

export function minutesSince(value: string | Date | null | undefined, now: string | Date = new Date()) {
    const date = toDate(value);
    const nowDate = toDate(now);
    if (!date || !nowDate) return null;
    return Math.max(0, Math.round((nowDate.getTime() - date.getTime()) / MINUTE_MS));
}

export function hoursUntil(value: string | Date | null | undefined, now: string | Date = new Date()) {
    const date = toDate(value);
    const nowDate = toDate(now);
    if (!date || !nowDate) return null;
    return Math.round((date.getTime() - nowDate.getTime()) / HOUR_MS);
}

export function isPast(value: string | Date | null | undefined, now: string | Date = new Date()) {
    const date = toDate(value);
    const nowDate = toDate(now);
    if (!date || !nowDate) return false;
    return date.getTime() < nowDate.getTime();
}

