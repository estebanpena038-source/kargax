import type { RouteCoordinates } from './types';

export function hasValidCoordinates(coords: RouteCoordinates | null | undefined) {
    if (!coords) return false;
    const latitude = Number(coords.latitude);
    const longitude = Number(coords.longitude);
    return Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && latitude >= -90
        && latitude <= 90
        && longitude >= -180
        && longitude <= 180;
}

export function distanceKm(left: RouteCoordinates | null | undefined, right: RouteCoordinates | null | undefined) {
    if (!hasValidCoordinates(left) || !hasValidCoordinates(right)) return null;
    const earthRadiusKm = 6371;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const lat1 = Number(left?.latitude);
    const lat2 = Number(right?.latitude);
    const deltaLat = toRad(lat2 - lat1);
    const deltaLng = toRad(Number(right?.longitude) - Number(left?.longitude));
    const a = Math.sin(deltaLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

