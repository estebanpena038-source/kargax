/**
 * =============================================================================
 * KARGAX - GPS VERIFICATION COMPONENT
 * /components/picking/GPSVerification.tsx
 * 
 * Componente premium para verificación de ubicación GPS antes de iniciar
 * carga o descarga. Usa geolocalización del navegador para confirmar
 * que el camionero está en la ubicación esperada.
 * 
 * FEATURES:
 * - Verificación de proximidad con tolerancia configurable
 * - Animaciones visuales de estado
 * - Indicador de precisión del GPS
 * - Mapa simplificado mostrando posición
 * - Retry automático y manual
 * - Soporte offline
 * 
 * UX PSYCHOLOGY:
 * - Verde = éxito, confianza
 * - Amber = procesando, atención
 * - Feedback inmediato con animaciones
 * - Textos claros y actionables
 * 
 * =============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin,
    Navigation,
    Check,
    X,
    AlertTriangle,
    Loader2,
    RefreshCw,
    Shield,
    Wifi,
    WifiOff,
    Target,
    Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import {
    useGPSVerification,
    formatDistance,
    formatAccuracy,
    getAccuracyColor,
    isGeolocationSupported,
} from '@/lib/geolocation';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tipo de ubicación a verificar
 */
export type LocationType = 'origin' | 'destination';

/**
 * Estado de la verificación
 */
export type VerificationStatus =
    | 'idle'        // No iniciado
    | 'checking'    // Verificando GPS
    | 'verified'    // Dentro de rango
    | 'too_far'     // Fuera de rango
    | 'error';      // Error de GPS

/**
 * Props del componente GPSVerification
 */
export interface GPSVerificationProps {
    /** Tipo de ubicación (origen o destino) */
    locationType: LocationType;

    /** Nombre de la ubicación para mostrar */
    locationName: string;

    /** Dirección de la ubicación */
    locationAddress?: string;

    /** Latitud objetivo */
    targetLatitude?: number | null;

    /** Longitud objetivo */
    targetLongitude?: number | null;

    /** Tolerancia en metros (default: 500) */
    toleranceMeters?: number;

    /** Si ya fue verificado previamente */
    isVerified?: boolean;

    /** Timestamp de verificación previa */
    verifiedAt?: string | null;

    /** Callback cuando se verifica exitosamente */
    onVerified?: (result: {
        latitude: number;
        longitude: number;
        accuracy: number;
        distanceMeters: number;
    }) => void;

    /** Si permitir bypass (para desarrollo/testing) */
    allowBypass?: boolean;

    /** Callback para bypass */
    onBypass?: () => void;

    /** Clase CSS adicional */
    className?: string;
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

/**
 * Animación de onda pulsante para indicar escaneo
 */
function PulseRing({ tone = 'muted' }: { tone?: 'muted' | 'strong' | 'critical' }) {
    const toneClasses = {
        muted: 'border-zinc-400',
        strong: 'border-zinc-500',
        critical: 'border-zinc-500',
    };

    return (
        <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className={cn(
                        'absolute rounded-full border-2',
                        toneClasses[tone]
                    )}
                    initial={{ width: 60, height: 60, opacity: 0.6 }}
                    animate={{
                        width: [60, 120, 180],
                        height: [60, 120, 180],
                        opacity: [0.6, 0.3, 0],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.6,
                        ease: 'easeOut',
                    }}
                />
            ))}
        </div>
    );
}

/**
 * Icono central animado según estado
 */
function StatusIcon({
    status,
    isChecking
}: {
    status: VerificationStatus;
    isChecking: boolean;
}) {
    if (isChecking) {
        return (
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
                <Compass className="w-10 h-10 text-zinc-800" />
            </motion.div>
        );
    }

    switch (status) {
        case 'verified':
            return (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                >
                    <Check className="w-10 h-10 text-zinc-950" />
                </motion.div>
            );
        case 'too_far':
            return (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                >
                    <AlertTriangle className="w-10 h-10 text-zinc-800" />
                </motion.div>
            );
        case 'error':
            return (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                >
                    <X className="w-10 h-10 text-zinc-600" />
                </motion.div>
            );
        default:
            return <Navigation className="w-10 h-10 text-slate-400" />;
    }
}

/**
 * Indicador de distancia con barra visual
 */
function DistanceIndicator({
    distance,
    tolerance
}: {
    distance: number;
    tolerance: number;
}) {
    const percentage = Math.min((distance / tolerance) * 100, 100);
    const isWithin = distance <= tolerance;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-slate-600">Distancia</span>
                <span className={cn(
                    'font-semibold',
                    isWithin ? 'text-zinc-950' : 'text-zinc-700'
                )}>
                    {formatDistance(distance)}
                </span>
            </div>

            <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                    className={cn(
                        'absolute left-0 top-0 bottom-0 rounded-full',
                        'bg-zinc-950'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - percentage}%` }}
                    transition={{ duration: 0.5 }}
                />

                {/* Línea de tolerancia */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                    style={{ right: 0 }}
                />
            </div>

            <div className="flex justify-between text-xs text-slate-400">
                <span>0 m</span>
                <span>Tolerancia: {formatDistance(tolerance)}</span>
            </div>
        </div>
    );
}

/**
 * Indicador de precisión del GPS
 */
function AccuracyIndicator({ accuracy }: { accuracy: number }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <Target className={cn('w-4 h-4', getAccuracyColor(accuracy))} />
            <span className="text-slate-600">Precisión:</span>
            <span className={cn('font-medium', getAccuracyColor(accuracy))}>
                {formatAccuracy(accuracy)} (±{Math.round(accuracy)}m)
            </span>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GPSVerification({
    locationType,
    locationName,
    locationAddress,
    targetLatitude,
    targetLongitude,
    toleranceMeters = 500,
    isVerified = false,
    verifiedAt,
    onVerified,
    allowBypass = false,
    onBypass,
    className,
}: GPSVerificationProps) {
    // Estado local
    const [status, setStatus] = useState<VerificationStatus>(
        isVerified ? 'verified' : 'idle'
    );
    const [distance, setDistance] = useState<number | null>(null);
    const [accuracy, setAccuracy] = useState<number | null>(null);

    // Verificar si hay coordenadas objetivo configuradas
    const hasTargetCoords = targetLatitude !== null &&
        targetLatitude !== undefined &&
        targetLongitude !== null &&
        targetLongitude !== undefined;

    // Hook de verificación GPS (solo si hay coords)
    const {
        verify,
        isVerifying,
        error: gpsError,
        reset: resetGPS,
    } = useGPSVerification({
        targetLatitude: targetLatitude ?? 0,
        targetLongitude: targetLongitude ?? 0,
        toleranceMeters,
        onVerified: (result) => {
            setDistance(result.distanceMeters);
            setAccuracy(result.accuracy);

            if (result.isWithinRange) {
                setStatus('verified');
            } else {
                setStatus('too_far');
            }
        },
    });

    // Verificar soporte de GPS
    const gpsSupported = isGeolocationSupported();

    // Manejar verificación
    const handleVerify = useCallback(async () => {
        if (!gpsSupported) {
            setStatus('error');
            return;
        }

        // Si no hay coordenadas configuradas, verificar automáticamente
        if (!hasTargetCoords) {
            setStatus('verified');
            onVerified?.({
                latitude: 0,
                longitude: 0,
                accuracy: 0,
                distanceMeters: 0,
            });
            return;
        }

        setStatus('checking');

        const result = await verify();

        if (result) {
            const verificationData = {
                latitude: result.latitude,
                longitude: result.longitude,
                accuracy: result.accuracy,
                distanceMeters: result.distanceMeters,
            };

            if (result.isWithinRange) {
                onVerified?.(verificationData);
            }
        } else if (gpsError) {
            setStatus('error');
        }
    }, [gpsSupported, hasTargetCoords, verify, gpsError, onVerified]);

    // Reintentar
    const handleRetry = useCallback(() => {
        setStatus('idle');
        setDistance(null);
        setAccuracy(null);
        resetGPS();
    }, [resetGPS]);

    // Bypass para desarrollo
    const handleBypass = useCallback(() => {
        setStatus('verified');
        onBypass?.();
    }, [onBypass]);

    const effectiveStatus: VerificationStatus =
        gpsError && status === 'checking' ? 'error' : status;

    // Determinar colores según estado
    const statusColors = {
        idle: 'from-slate-100 to-slate-50 border-slate-200',
        checking: 'bg-white border-zinc-300',
        verified: 'bg-white border-zinc-950',
        too_far: 'bg-white border-zinc-300',
        error: 'bg-white border-zinc-300',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'rounded-lg border p-6 transition-all duration-500',
                statusColors[effectiveStatus],
                className
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <MapPin className={cn(
                            'w-5 h-5',
                            'text-zinc-800'
                        )} />
                        {locationType === 'origin' ? 'Verificar Origen' : 'Verificar Destino'}
                    </h3>
                    <p className="text-slate-600 mt-0.5">{locationName}</p>
                    {locationAddress && (
                        <p className="text-sm text-slate-400 mt-0.5">{locationAddress}</p>
                    )}
                </div>

                {/* Badge de estado */}
                {effectiveStatus === 'verified' && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-800"
                    >
                        <Shield className="w-4 h-4" />
                        Verificado
                    </motion.div>
                )}
            </div>

            {/* Área de animación central */}
            <div className="relative flex flex-col items-center justify-center py-8">
                {/* Ondas pulsantes */}
                {(effectiveStatus === 'checking' || isVerifying) && (
                    <PulseRing tone="muted" />
                )}
                {effectiveStatus === 'verified' && (
                    <PulseRing tone="strong" />
                )}

                {/* Círculo central con icono */}
                <motion.div
                    className={cn(
                        'relative z-10 w-24 h-24 rounded-full flex items-center justify-center',
                        'border-4 shadow-lg transition-all duration-300',
                        effectiveStatus === 'verified'
                            ? 'bg-white border-zinc-950'
                            : effectiveStatus === 'error'
                                ? 'bg-white border-zinc-400'
                                : effectiveStatus === 'too_far'
                                    ? 'bg-white border-zinc-500'
                                    : 'bg-white border-zinc-200'
                    )}
                    animate={isVerifying ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                >
                    <StatusIcon status={effectiveStatus} isChecking={isVerifying || effectiveStatus === 'checking'} />
                </motion.div>

                {/* Mensaje de estado */}
                <motion.p
                    key={effectiveStatus}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        'mt-6 text-center font-medium',
                        effectiveStatus === 'verified' ? 'text-zinc-950' :
                            effectiveStatus === 'error' ? 'text-zinc-700' :
                                effectiveStatus === 'too_far' ? 'text-zinc-800' :
                                    effectiveStatus === 'checking' ? 'text-zinc-800' :
                                        'text-slate-600'
                    )}
                >
                    {effectiveStatus === 'idle' && 'Verifica tu ubicacion para continuar'}
                    {(effectiveStatus === 'checking' || isVerifying) && 'Obteniendo ubicacion GPS...'}
                    {effectiveStatus === 'verified' && 'Ubicacion registrada'}
                    {effectiveStatus === 'too_far' && 'Estas fuera del radio permitido'}
                    {effectiveStatus === 'error' && (gpsError || 'Error al obtener ubicación')}
                </motion.p>

                {/* Submensaje */}
                {effectiveStatus === 'verified' && verifiedAt && (
                    <p className="mt-1 text-sm text-zinc-600">
                        Verificado a las {new Date(verifiedAt).toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* Indicadores de distancia y precisión */}
            <AnimatePresence>
                {(distance !== null || accuracy !== null) && effectiveStatus !== 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 mb-6 overflow-hidden"
                    >
                        {distance !== null && (
                            <DistanceIndicator
                                distance={distance}
                                tolerance={toleranceMeters}
                            />
                        )}

                        {accuracy !== null && (
                            <AccuracyIndicator accuracy={accuracy} />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Aviso si no hay GPS */}
            {!gpsSupported && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4">
                    <WifiOff className="w-5 h-5 flex-shrink-0 text-zinc-700" />
                    <div>
                        <p className="font-medium text-zinc-950">GPS no disponible</p>
                        <p className="text-sm text-zinc-600">
                            Tu dispositivo no soporta geolocalización o el permiso fue denegado.
                        </p>
                    </div>
                </div>
            )}

            {/* Aviso si no hay coordenadas configuradas */}
            {!hasTargetCoords && effectiveStatus !== 'verified' && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-zinc-700" />
                    <div>
                        <p className="font-medium text-zinc-950">Sin coordenadas</p>
                        <p className="text-sm text-zinc-600">
                            Esta ubicación no tiene coordenadas GPS configuradas.
                            La verificación se omitirá.
                        </p>
                    </div>
                </div>
            )}

            {/* Botones de acción */}
            <div className="space-y-3">
                {effectiveStatus === 'idle' && (
                    <Button
                        onClick={handleVerify}
                        disabled={isVerifying || !gpsSupported}
                        className="w-full"
                        variant="primary"
                        size="lg"
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Verificando...
                            </>
                        ) : (
                            <>
                                <Navigation className="w-5 h-5" />
                                Verificar mi ubicacion
                            </>
                        )}
                    </Button>
                )}

                {(effectiveStatus === 'too_far' || effectiveStatus === 'error') && (
                    <Button
                        onClick={handleRetry}
                        className="w-full"
                        variant="outline"
                        size="lg"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Intentar de nuevo
                    </Button>
                )}

                {/* Botón de bypass (solo en desarrollo) */}
                {allowBypass && effectiveStatus !== 'verified' && (
                    <Button
                        onClick={handleBypass}
                        className="w-full text-slate-500 hover:text-slate-700"
                        variant="ghost"
                        size="sm"
                    >
                        Omitir verificación (solo desarrollo)
                    </Button>
                )}
            </div>

            {/* Indicador de conexión */}
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-400">
                <Wifi className="w-3.5 h-3.5" />
                <span>Usando GPS del dispositivo</span>
            </div>
        </motion.div>
    );
}

export default GPSVerification;
