/**
 * =============================================================================
 * KARGAX - GEOLOCATION UTILITIES & HOOKS
 * /lib/geolocation/index.ts
 * 
 * Utilidades para manejo de geolocalización del navegador.
 * Incluye hooks de React, funciones de cálculo de distancia, y formateo.
 * 
 * FEATURES:
 * - useGeolocation: Hook para tracking de ubicación en tiempo real
 * - useGPSVerification: Hook para verificar proximidad a una ubicación
 * - Cálculo de distancia Haversine
 * - Formateo de coordenadas y distancias
 * 
 * CONSIDERACIONES DE SEGURIDAD:
 * - Siempre pedir permiso explícito del usuario
 * - Manejar casos donde GPS no está disponible
 * - Mostrar indicadores claros de estado de GPS
 * 
 * =============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Coordenadas geográficas
 */
export interface Coordinates {
    latitude: number;
    longitude: number;
}

/**
 * Posición con metadata adicional
 */
export interface GeolocationPosition {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp: number;
}

/**
 * Estado del GPS
 */
export type GPSStatus =
    | 'idle'           // No se ha solicitado
    | 'requesting'     // Solicitando permiso
    | 'tracking'       // Tracking activo
    | 'success'        // Posición obtenida
    | 'denied'         // Permiso denegado
    | 'unavailable'    // GPS no disponible
    | 'timeout'        // Timeout al obtener posición
    | 'error';         // Error genérico

/**
 * Error de geolocalización con código descriptivo
 */
export interface GeolocationError {
    code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';
    message: string;
}

/**
 * Opciones para el hook useGeolocation
 */
export interface GeolocationOptions {
    /** Si debe hacer tracking continuo o solo una lectura */
    enableHighAccuracy?: boolean;
    /** Timeout en milisegundos para obtener posición */
    timeout?: number;
    /** Edad máxima de cache de posición en milisegundos */
    maximumAge?: number;
    /** Si debe comenzar tracking automáticamente */
    autoStart?: boolean;
    /** Callback cuando se obtiene posición */
    onSuccess?: (position: GeolocationPosition) => void;
    /** Callback en caso de error */
    onError?: (error: GeolocationError) => void;
}

/**
 * Resultado de verificación de proximidad
 */
export interface ProximityResult {
    isWithinRange: boolean;
    distanceMeters: number;
    formattedDistance: string;
    accuracy: number;
    latitude: number;
    longitude: number;
}

// =============================================================================
// CONSTANTES
// =============================================================================

/** Radio de la Tierra en metros (WGS84) */
const EARTH_RADIUS_METERS = 6371000;

/** Opciones default para geolocalización */
const DEFAULT_OPTIONS: GeolocationOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    autoStart: false,
};

/** Mensajes de error amigables */
const ERROR_MESSAGES: Record<string, string> = {
    PERMISSION_DENIED: 'Permiso de ubicación denegado. Por favor habilita el GPS en la configuración.',
    POSITION_UNAVAILABLE: 'No se pudo obtener tu ubicación. Verifica que el GPS esté activo.',
    TIMEOUT: 'Tiempo agotado al obtener ubicación. Intenta en un lugar con mejor señal.',
    UNKNOWN: 'Error desconocido al obtener ubicación.',
};

// =============================================================================
// FUNCIONES DE CÁLCULO
// =============================================================================

/**
 * Calcula la distancia entre dos puntos usando la fórmula Haversine
 * Esta es la distancia "en línea recta" sobre la superficie de la Tierra
 * 
 * @param from - Coordenadas del punto de origen
 * @param to - Coordenadas del punto de destino
 * @returns Distancia en metros
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
    // Convertir grados a radianes
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.latitude);
    const deltaLat = toRad(to.latitude - from.latitude);
    const deltaLng = toRad(to.longitude - from.longitude);

    // Fórmula Haversine
    const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * c;
}

/**
 * Verifica si una posición está dentro de un rango de tolerancia
 * 
 * @param current - Posición actual del usuario
 * @param target - Posición objetivo a verificar
 * @param toleranceMeters - Tolerancia en metros
 * @returns Resultado de la verificación
 */
export function checkProximity(
    current: Coordinates,
    target: Coordinates,
    toleranceMeters: number = 500
): ProximityResult {
    const distance = calculateDistance(current, target);

    return {
        isWithinRange: distance <= toleranceMeters,
        distanceMeters: Math.round(distance),
        formattedDistance: formatDistance(distance),
        accuracy: 0, // Se llena después con la accuracy real
        latitude: current.latitude,
        longitude: current.longitude,
    };
}

// =============================================================================
// FUNCIONES DE FORMATEO
// =============================================================================

/**
 * Formatea una distancia en metros a string legible
 * 
 * @param meters - Distancia en metros
 * @returns String formateado (ej: "450 m" o "2.3 km")
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
}

/**
 * Formatea coordenadas para mostrar
 * 
 * @param coords - Coordenadas a formatear
 * @param precision - Decimales a mostrar
 * @returns String formateado
 */
export function formatCoordinates(
    coords: Coordinates,
    precision: number = 6
): string {
    return `${coords.latitude.toFixed(precision)}, ${coords.longitude.toFixed(precision)}`;
}

/**
 * Formatea la precisión del GPS
 * 
 * @param accuracyMeters - Precisión en metros
 * @returns Descripción de calidad
 */
export function formatAccuracy(accuracyMeters: number): string {
    if (accuracyMeters <= 5) return 'Excelente';
    if (accuracyMeters <= 15) return 'Muy buena';
    if (accuracyMeters <= 50) return 'Buena';
    if (accuracyMeters <= 100) return 'Aceptable';
    return 'Baja precisión';
}

/**
 * Obtiene el color para mostrar según la precisión
 */
export function getAccuracyColor(accuracyMeters: number): string {
    if (accuracyMeters <= 15) return 'text-emerald-500';
    if (accuracyMeters <= 50) return 'text-green-600';
    return 'text-red-500';
}

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================

/**
 * Convierte un GeolocationPositionError a nuestro tipo
 */
function mapError(error: GeolocationPositionError): GeolocationError {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return { code: 'PERMISSION_DENIED', message: ERROR_MESSAGES.PERMISSION_DENIED };
        case error.POSITION_UNAVAILABLE:
            return { code: 'POSITION_UNAVAILABLE', message: ERROR_MESSAGES.POSITION_UNAVAILABLE };
        case error.TIMEOUT:
            return { code: 'TIMEOUT', message: ERROR_MESSAGES.TIMEOUT };
        default:
            return { code: 'UNKNOWN', message: ERROR_MESSAGES.UNKNOWN };
    }
}

/**
 * Convierte GeolocationPosition del navegador a nuestro tipo
 */
function mapPosition(pos: globalThis.GeolocationPosition): GeolocationPosition {
    return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        altitudeAccuracy: pos.coords.altitudeAccuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
    };
}

/**
 * Verifica si el navegador soporta geolocalización
 */
export function isGeolocationSupported(): boolean {
    return 'geolocation' in navigator;
}

// =============================================================================
// HOOK: useGeolocation
// =============================================================================

/**
 * Hook para obtener y trackear la ubicación del usuario
 * 
 * @example
 * ```tsx
 * const { position, status, error, startTracking, stopTracking } = useGeolocation({
 *   enableHighAccuracy: true,
 *   onSuccess: (pos) => console.log('Posición:', pos),
 * });
 * 
 * if (status === 'tracking') {
 *   return <p>Lat: {position?.latitude}</p>;
 * }
 * ```
 */
export function useGeolocation(options: GeolocationOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const [position, setPosition] = useState<GeolocationPosition | null>(null);
    const [status, setStatus] = useState<GPSStatus>('idle');
    const [error, setError] = useState<GeolocationError | null>(null);

    const watchIdRef = useRef<number | null>(null);

    // Callback de éxito
    const handleSuccess = useCallback((pos: globalThis.GeolocationPosition) => {
        const mapped = mapPosition(pos);
        setPosition(mapped);
        setStatus('success');
        setError(null);
        opts.onSuccess?.(mapped);
    }, [opts]);

    // Callback de error
    const handleError = useCallback((err: GeolocationPositionError) => {
        const mapped = mapError(err);
        setError(mapped);
        setStatus(
            err.code === err.PERMISSION_DENIED ? 'denied' :
                err.code === err.POSITION_UNAVAILABLE ? 'unavailable' :
                    err.code === err.TIMEOUT ? 'timeout' : 'error'
        );
        opts.onError?.(mapped);
    }, [opts]);

    // Obtener posición una vez
    const getCurrentPosition = useCallback(() => {
        if (!isGeolocationSupported()) {
            setStatus('unavailable');
            setError({ code: 'POSITION_UNAVAILABLE', message: 'GPS no soportado en este dispositivo' });
            return;
        }

        setStatus('requesting');

        navigator.geolocation.getCurrentPosition(
            handleSuccess,
            handleError,
            {
                enableHighAccuracy: opts.enableHighAccuracy,
                timeout: opts.timeout,
                maximumAge: opts.maximumAge,
            }
        );
    }, [handleSuccess, handleError, opts]);

    // Iniciar tracking continuo
    const startTracking = useCallback(() => {
        if (!isGeolocationSupported()) {
            setStatus('unavailable');
            setError({ code: 'POSITION_UNAVAILABLE', message: 'GPS no soportado en este dispositivo' });
            return;
        }

        // Limpiar tracking anterior si existe
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
        }

        setStatus('tracking');

        watchIdRef.current = navigator.geolocation.watchPosition(
            handleSuccess,
            handleError,
            {
                enableHighAccuracy: opts.enableHighAccuracy,
                timeout: opts.timeout,
                maximumAge: opts.maximumAge,
            }
        );
    }, [handleSuccess, handleError, opts]);

    // Detener tracking
    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setStatus('idle');
    }, []);

    // Auto-start si está habilitado
    useEffect(() => {
        if (opts.autoStart) {
            startTracking();
        }

        // Cleanup al desmontar
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [opts.autoStart, startTracking]);

    return {
        /** Posición actual (null si no se ha obtenido) */
        position,
        /** Estado del GPS */
        status,
        /** Error si existe */
        error,
        /** Si está trackeando activamente */
        isTracking: status === 'tracking' || status === 'success',
        /** Si hubo algún error */
        hasError: status === 'denied' || status === 'unavailable' || status === 'timeout' || status === 'error',
        /** Obtener posición una vez */
        getCurrentPosition,
        /** Iniciar tracking continuo */
        startTracking,
        /** Detener tracking */
        stopTracking,
    };
}

// =============================================================================
// HOOK: useGPSVerification
// =============================================================================

/**
 * Hook especializado para verificar proximidad a una ubicación objetivo
 * 
 * @example
 * ```tsx
 * const { verify, result, isVerifying } = useGPSVerification({
 *   targetLatitude: 4.6097,
 *   targetLongitude: -74.0817,
 *   toleranceMeters: 500,
 * });
 * 
 * <Button onClick={verify} disabled={isVerifying}>
 *   Verificar Ubicación
 * </Button>
 * 
 * {result?.isWithinRange && <p>✅ Estás en el lugar correcto</p>}
 * ```
 */
export function useGPSVerification(options: {
    targetLatitude: number;
    targetLongitude: number;
    toleranceMeters?: number;
    onVerified?: (result: ProximityResult) => void;
}) {
    const {
        targetLatitude,
        targetLongitude,
        toleranceMeters = 500,
        onVerified,
    } = options;

    const [result, setResult] = useState<ProximityResult | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const verify = useCallback(async () => {
        if (!isGeolocationSupported()) {
            setError('GPS no disponible en este dispositivo');
            return null;
        }

        setIsVerifying(true);
        setError(null);

        return new Promise<ProximityResult | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const proximity = checkProximity(
                        { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
                        { latitude: targetLatitude, longitude: targetLongitude },
                        toleranceMeters
                    );

                    // Agregar la precisión real
                    const resultWithAccuracy: ProximityResult = {
                        ...proximity,
                        accuracy: pos.coords.accuracy,
                    };

                    setResult(resultWithAccuracy);
                    setIsVerifying(false);
                    onVerified?.(resultWithAccuracy);
                    resolve(resultWithAccuracy);
                },
                (err) => {
                    const mapped = mapError(err);
                    setError(mapped.message);
                    setIsVerifying(false);
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                }
            );
        });
    }, [targetLatitude, targetLongitude, toleranceMeters, onVerified]);

    // Reset resultado cuando cambia el target
    useEffect(() => {
        setResult(null);
        setError(null);
    }, [targetLatitude, targetLongitude, toleranceMeters]);

    return {
        /** Iniciar verificación */
        verify,
        /** Resultado de la última verificación */
        result,
        /** Si está verificando actualmente */
        isVerifying,
        /** Error si existe */
        error,
        /** Reset del estado */
        reset: () => {
            setResult(null);
            setError(null);
        },
    };
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
    useGeolocation,
    useGPSVerification,
    calculateDistance,
    checkProximity,
    formatDistance,
    formatCoordinates,
    formatAccuracy,
    getAccuracyColor,
    isGeolocationSupported,
};
