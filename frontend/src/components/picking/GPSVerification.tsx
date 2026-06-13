'use client';

import * as React from 'react';
import { AlertTriangle, Check, ExternalLink, Loader2, LocateFixed, MapPin, Navigation, RefreshCw, Shield, Wifi, WifiOff, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import {
    calculateDistance,
    formatAccuracy,
    formatDistance,
    getAccuracyColor,
    isGeolocationSupported,
} from '@/lib/geolocation';

export type LocationType = 'origin' | 'destination';

export type VerificationStatus =
    | 'idle'
    | 'checking'
    | 'verified'
    | 'too_far'
    | 'error';

type GpsIssue =
    | 'permission_denied'
    | 'timeout'
    | 'position_unavailable'
    | 'low_accuracy'
    | 'missing_target'
    | 'unsupported'
    | 'unknown';

export interface GPSVerificationProps {
    locationType: LocationType;
    locationName: string;
    locationAddress?: string;
    targetLatitude?: number | null;
    targetLongitude?: number | null;
    toleranceMeters?: number;
    isVerified?: boolean;
    verifiedAt?: string | null;
    onVerified?: (result: {
        latitude: number;
        longitude: number;
        accuracy: number;
        distanceMeters: number;
    }) => void;
    className?: string;
}

type CurrentPosition = {
    latitude: number;
    longitude: number;
    accuracy: number;
};

const MAX_ACCEPTABLE_ACCURACY_METERS = 150;
const GPS_READ_TIMEOUT_MS = 45000;
const GPS_WATCH_TIMEOUT_MS = 60000;
const GPS_POSITION_MAX_AGE_MS = 5000;

function hasTargetCoordinates(latitude?: number | null, longitude?: number | null) {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
        return false;
    }

    if (String(latitude).trim() === '' || String(longitude).trim() === '') {
        return false;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    return Number.isFinite(lat)
        && Number.isFinite(lng)
        && !(lat === 0 && lng === 0);
}

function getPermissionErrorMessage(error: GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) {
        return 'Permiso de GPS denegado. Activa la ubicacion para este sitio y elige ubicacion precisa, no aproximada.';
    }

    if (error.code === error.TIMEOUT) {
        return 'El celular no entrego una ubicacion precisa a tiempo. Activa ubicacion precisa, sal a cielo abierto y vuelve a intentar.';
    }

    return 'No se pudo obtener tu ubicacion. Verifica que el GPS del celular este activo y que el permiso sea preciso.';
}

function getGpsIssue(error: GeolocationPositionError): GpsIssue {
    if (error.code === error.PERMISSION_DENIED) return 'permission_denied';
    if (error.code === error.TIMEOUT) return 'timeout';
    if (error.code === error.POSITION_UNAVAILABLE) return 'position_unavailable';
    return 'unknown';
}

function getErrorTitle(issue: GpsIssue | null) {
    if (issue === 'permission_denied') return 'GPS bloqueado';
    if (issue === 'timeout') return 'GPS sin respuesta';
    if (issue === 'low_accuracy') return 'Falta precision';
    if (issue === 'missing_target') return 'Coordenadas faltantes';
    if (issue === 'unsupported') return 'GPS no disponible';
    return 'GPS pendiente';
}

function getHelpTitle(issue: GpsIssue | null, permissionState: PermissionState | 'unsupported') {
    if (permissionState === 'denied' || issue === 'permission_denied') return 'Permiso de ubicacion bloqueado';
    if (issue === 'low_accuracy') return 'Activa Ubicacion precisa';
    if (issue === 'timeout') return 'Lectura GPS agotada';
    return 'Verificacion pendiente';
}

function getHelpMessage(issue: GpsIssue | null, error: string) {
    if (issue === 'low_accuracy') {
        return 'Tu celular esta usando una zona aproximada. Para registrar llegada, KargaX necesita un punto preciso.';
    }

    if (issue === 'timeout') {
        return 'Mantente en esta pantalla, activa GPS del sistema y prueba en un punto abierto. La lectura puede tardar hasta un minuto.';
    }

    return error || 'Debes estar dentro del radio permitido para continuar.';
}

function buildLowAccuracyMessage(accuracyMeters: number, distanceMeters: number, toleranceMeters: number, targetLabel: string) {
    const roundedAccuracy = Math.round(accuracyMeters);

    if (distanceMeters <= toleranceMeters) {
        return `Estas en el punto. El celular sigue en ubicacion aproximada (+/- ${roundedAccuracy}m). Activa Ubicacion precisa para Chrome/kargax.com y vuelve a intentar.`;
    }

    return `Acercate al ${targetLabel.toLowerCase()} y activa Ubicacion precisa. Precision actual: +/- ${roundedAccuracy}m.`;
}

function mapsEmbedUrl(latitude: number, longitude: number) {
    return `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
}

function mapsDirectionsUrl(current: CurrentPosition | null, targetLatitude: number, targetLongitude: number) {
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    if (current) {
        url.searchParams.set('origin', `${current.latitude},${current.longitude}`);
    }
    url.searchParams.set('destination', `${targetLatitude},${targetLongitude}`);
    url.searchParams.set('travelmode', 'driving');
    return url.toString();
}

function StatusIcon({ status }: { status: VerificationStatus }) {
    if (status === 'checking') {
        return <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />;
    }

    if (status === 'verified') {
        return <Check className="h-8 w-8 text-zinc-950" />;
    }

    if (status === 'too_far') {
        return <Navigation className="h-8 w-8 text-zinc-950" />;
    }

    if (status === 'error') {
        return <X className="h-8 w-8 text-zinc-700" />;
    }

    return <LocateFixed className="h-8 w-8 text-zinc-500" />;
}

function RouteMapPanel({
    current,
    targetLatitude,
    targetLongitude,
    targetLabel,
    distance,
    toleranceMeters,
}: {
    current: CurrentPosition | null;
    targetLatitude: number;
    targetLongitude: number;
    targetLabel: string;
    distance: number | null;
    toleranceMeters: number;
}) {
    const isAtTarget = distance !== null && distance <= toleranceMeters;
    const hasUsableAccuracy = current ? current.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS : false;
    const distanceTone = distance === null
        ? 'text-zinc-500'
        : isAtTarget
            ? 'text-emerald-700'
            : 'text-amber-700';
    const accuracyTone = !current
        ? 'text-zinc-500'
        : hasUsableAccuracy
            ? 'text-emerald-700'
            : 'text-red-700';

    return (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="grid gap-px bg-zinc-200 md:grid-cols-2">
                <div className="bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase text-zinc-500">Tu ubicacion</p>
                    {current ? (
                        <>
                            <p className="mt-2 font-money text-sm text-zinc-950">{current.latitude.toFixed(6)}, {current.longitude.toFixed(6)}</p>
                            <p className={cn('mt-1 text-xs font-medium', getAccuracyColor(current.accuracy))}>
                                Precision: {formatAccuracy(current.accuracy)} (+/- {Math.round(current.accuracy)}m)
                            </p>
                        </>
                    ) : (
                        <p className="mt-2 text-sm text-zinc-500">Toca Activar GPS para ver tu punto actual.</p>
                    )}
                </div>
                <div className="bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase text-zinc-500">{targetLabel}</p>
                    <p className="mt-2 font-money text-sm text-zinc-950">{targetLatitude.toFixed(6)}, {targetLongitude.toFixed(6)}</p>
                    <p className="mt-1 text-xs text-zinc-500">Radio permitido: {formatDistance(toleranceMeters)}</p>
                </div>
            </div>

            {current ? (
                <div className="grid gap-px border-t border-zinc-200 bg-zinc-200 sm:grid-cols-2">
                    <div className="bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-zinc-500">Distancia al punto</p>
                        <p className={cn('mt-2 text-sm font-semibold', distanceTone)}>
                            {distance === null ? 'Pendiente' : `${formatDistance(distance)} - ${isAtTarget ? 'en el radio' : 'fuera del radio'}`}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Te dice si estas cerca de la direccion configurada.
                        </p>
                    </div>
                    <div className="bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-zinc-500">Precision del dispositivo</p>
                        <p className={cn('mt-2 text-sm font-semibold', accuracyTone)}>
                            {formatAccuracy(current.accuracy)} (+/- {Math.round(current.accuracy)}m)
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Debe ser {MAX_ACCEPTABLE_ACCURACY_METERS} m o menos. Si ves 2000 m, el celular esta en modo aproximado.
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="relative h-60 bg-zinc-100">
                <iframe
                    title={`Mapa ${targetLabel}`}
                    src={mapsEmbedUrl(targetLatitude, targetLongitude)}
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
                {distance !== null ? (
                    <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-white/70 bg-white/95 p-3 shadow-lg">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-zinc-950">
                                    {isAtTarget && hasUsableAccuracy
                                        ? 'Llegaste al punto correcto'
                                            : isAtTarget
                                                ? 'Estas en el punto. Falta precision'
                                                : `No has llegado al ${targetLabel.toLowerCase()}`}
                                </p>
                                <p className="text-xs text-zinc-500">Distancia actual: {formatDistance(distance)}</p>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                                <a href={mapsDirectionsUrl(current, targetLatitude, targetLongitude)} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                    Abrir ruta
                                </a>
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

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
    className,
}: GPSVerificationProps) {
    const [status, setStatus] = React.useState<VerificationStatus>(isVerified ? 'verified' : 'idle');
    const [current, setCurrent] = React.useState<CurrentPosition | null>(null);
    const [distance, setDistance] = React.useState<number | null>(null);
    const [error, setError] = React.useState('');
    const [issue, setIssue] = React.useState<GpsIssue | null>(null);
    const [permissionState, setPermissionState] = React.useState<PermissionState | 'unsupported'>('unsupported');
    const watchIdRef = React.useRef<number | null>(null);
    const watchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAccuracyRef = React.useRef<number | null>(null);
    const lastDistanceRef = React.useRef<number | null>(null);

    const gpsSupported = isGeolocationSupported();
    const hasTarget = hasTargetCoordinates(targetLatitude, targetLongitude);
    const targetLabel = locationType === 'origin' ? 'Origen' : 'Destino';
    const strictMessage = locationType === 'origin'
        ? 'No has llegado al origen. Debes estar dentro del radio permitido para iniciar carga.'
        : 'No has llegado al destino. Debes estar dentro del radio permitido para iniciar descarga.';

    const clearGpsWatch = React.useCallback(() => {
        if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        if (watchTimeoutRef.current !== null) {
            clearTimeout(watchTimeoutRef.current);
            watchTimeoutRef.current = null;
        }
    }, []);

    React.useEffect(() => {
        let cancelled = false;

        if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
            setPermissionState('unsupported');
            return;
        }

        navigator.permissions.query({ name: 'geolocation' as PermissionName })
            .then((permission) => {
                if (!cancelled) {
                    setPermissionState(permission.state);
                }

                permission.onchange = () => {
                    setPermissionState(permission.state);
                };
            })
            .catch(() => setPermissionState('unsupported'));

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => () => clearGpsWatch(), [clearGpsWatch]);

    const handleVerify = React.useCallback(() => {
        clearGpsWatch();
        setError('');
        setIssue(null);
        setCurrent(null);
        setDistance(null);
        lastAccuracyRef.current = null;
        lastDistanceRef.current = null;

        if (!gpsSupported) {
            setStatus('error');
            setIssue('unsupported');
            setError('GPS no disponible en este dispositivo.');
            return;
        }

        if (!hasTarget) {
            setStatus('error');
            setIssue('missing_target');
            setError('Esta ruta no tiene coordenadas configuradas. La empresa debe completarlas.');
            return;
        }

        setStatus('checking');

        const target = { latitude: Number(targetLatitude), longitude: Number(targetLongitude) };

        try {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const nextCurrent = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    };
                    const nextDistance = Math.round(calculateDistance(
                        nextCurrent,
                        target
                    ));

                    lastAccuracyRef.current = nextCurrent.accuracy;
                    lastDistanceRef.current = nextDistance;
                    setCurrent(nextCurrent);
                    setDistance(nextDistance);

                    if (nextCurrent.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
                        setStatus('checking');
                        setIssue('low_accuracy');
                        setError(buildLowAccuracyMessage(nextCurrent.accuracy, nextDistance, toleranceMeters, targetLabel));
                        return;
                    }

                    if (nextDistance > toleranceMeters) {
                        setStatus('checking');
                        setIssue(null);
                        setError(`Estas a ${formatDistance(nextDistance)} del ${targetLabel.toLowerCase()}. Acercate al punto y la app verificara automaticamente cuando entres al radio permitido.`);
                        return;
                    }

                    clearGpsWatch();
                    setStatus('verified');
                    setIssue(null);
                    setError('');
                    onVerified?.({
                        latitude: nextCurrent.latitude,
                        longitude: nextCurrent.longitude,
                        accuracy: nextCurrent.accuracy,
                        distanceMeters: nextDistance,
                    });
                },
                (gpsError) => {
                    clearGpsWatch();
                    setStatus('error');
                    setIssue(getGpsIssue(gpsError));
                    setError(getPermissionErrorMessage(gpsError));
                    if (gpsError.code === gpsError.PERMISSION_DENIED) {
                        setPermissionState('denied');
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: GPS_READ_TIMEOUT_MS,
                    maximumAge: GPS_POSITION_MAX_AGE_MS,
                }
            );

            watchTimeoutRef.current = setTimeout(() => {
                const lastAccuracy = lastAccuracyRef.current;
                const lastDistance = lastDistanceRef.current;

                clearGpsWatch();

                if (
                    lastAccuracy !== null
                    && lastAccuracy <= MAX_ACCEPTABLE_ACCURACY_METERS
                    && lastDistance !== null
                    && lastDistance > toleranceMeters
                ) {
                    setStatus('too_far');
                    setIssue(null);
                    setError(strictMessage);
                    return;
                }

                if (lastAccuracy !== null && lastAccuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
                    setStatus('error');
                    setIssue('low_accuracy');
                    setError(buildLowAccuracyMessage(lastAccuracy, lastDistance ?? Number.POSITIVE_INFINITY, toleranceMeters, targetLabel));
                    return;
                }

                setStatus('error');
                setIssue('timeout');
                setError('No logramos una lectura precisa en 60 segundos. Mantente en punto abierto, activa ubicacion precisa y vuelve a intentar.');
            }, GPS_WATCH_TIMEOUT_MS);
        } catch {
            clearGpsWatch();
            setStatus('error');
            setIssue('unknown');
            setError('No se pudo iniciar el GPS del navegador. Verifica permisos y vuelve a intentar.');
        }
    }, [clearGpsWatch, gpsSupported, hasTarget, onVerified, strictMessage, targetLabel, targetLatitude, targetLongitude, toleranceMeters]);

    const handleRetry = React.useCallback(() => {
        clearGpsWatch();
        setStatus('idle');
        setCurrent(null);
        setDistance(null);
        setError('');
        setIssue(null);
        lastAccuracyRef.current = null;
        lastDistanceRef.current = null;
    }, [clearGpsWatch]);

    const targetLat = Number(targetLatitude);
    const targetLng = Number(targetLongitude);
    const canShowMap = hasTargetCoordinates(targetLat, targetLng);
    const isCheckingTooFar = status === 'checking' && distance !== null && distance > toleranceMeters && issue !== 'low_accuracy';
    const isLowAccuracyAtTarget = issue === 'low_accuracy' && distance !== null && distance <= toleranceMeters;
    const showPermissionWarning = permissionState === 'denied' || status === 'error' || issue === 'low_accuracy';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-6', className)}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-950">
                        <MapPin className="h-5 w-5 text-zinc-800" />
                        Verificar {targetLabel}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">{locationName}</p>
                    {locationAddress ? <p className="mt-0.5 text-sm text-zinc-500">{locationAddress}</p> : null}
                </div>

                {status === 'verified' ? (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-zinc-950 bg-zinc-950 px-3 py-1 text-sm font-medium text-white">
                        <Shield className="h-4 w-4" />
                        Verificado
                    </span>
                ) : null}
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
                <div className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-5">
                    <div className="flex flex-col items-center text-center">
                        <div className={cn(
                            'flex h-20 w-20 items-center justify-center rounded-full border-4 bg-white shadow-sm',
                            status === 'verified' ? 'border-zinc-950' : 'border-zinc-200'
                        )}>
                            <StatusIcon status={status} />
                        </div>
                        <p className="mt-4 font-semibold text-zinc-950">
                            {status === 'idle' && 'Activa GPS para continuar'}
                            {status === 'checking' && (isLowAccuracyAtTarget ? 'Estas en el punto. Falta precision' : issue === 'low_accuracy' ? 'Esperando ubicacion precisa' : isCheckingTooFar ? `Acercate al ${targetLabel.toLowerCase()}` : 'Leyendo GPS del celular...')}
                            {status === 'verified' && 'Ubicacion registrada'}
                            {status === 'too_far' && `No has llegado al ${targetLabel.toLowerCase()}`}
                            {status === 'error' && (isLowAccuracyAtTarget ? 'Estas en el punto. Falta precision' : getErrorTitle(issue))}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                            {status === 'idle' && 'El navegador pedira permiso de ubicacion. Elige Precisa/Exacta, no aproximada.'}
                            {status === 'checking' && ((issue === 'low_accuracy' || isCheckingTooFar) && error ? error : 'Mantente en esta pantalla. Veras tu posicion, precision y distancia mientras el GPS se estabiliza.')}
                            {status === 'verified' && (verifiedAt ? `Verificado a las ${new Date(verifiedAt).toLocaleTimeString()}` : 'Ya puedes continuar con el checklist.')}
                            {status === 'too_far' && strictMessage}
                            {status === 'error' && (error || 'No se pudo verificar tu ubicacion.')}
                        </p>
                    </div>

                    <div className="mt-5 space-y-3">
                        {(status === 'idle' || status === 'checking') ? (
                            <Button
                                onClick={handleVerify}
                                disabled={status === 'checking' || !gpsSupported}
                                className="w-full"
                                variant="primary"
                                size="lg"
                            >
                                {status === 'checking' ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
                                Activar GPS
                            </Button>
                        ) : null}

                        {(status === 'too_far' || status === 'error') ? (
                            <Button onClick={handleRetry} className="w-full" variant="outline" size="lg">
                                <RefreshCw className="h-5 w-5" />
                                Intentar de nuevo
                            </Button>
                        ) : null}
                    </div>
                </div>

                {canShowMap ? (
                    <RouteMapPanel
                        current={current}
                        targetLatitude={targetLat}
                        targetLongitude={targetLng}
                        targetLabel={targetLabel}
                        distance={distance}
                        toleranceMeters={toleranceMeters}
                    />
                ) : (
                    <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
                        <AlertTriangle className="mb-3 h-8 w-8 text-zinc-700" />
                        <p className="font-semibold text-zinc-950">Coordenadas faltantes</p>
                        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
                            Esta ruta no tiene coordenadas configuradas. La empresa debe completarlas antes de permitir carga o descarga.
                        </p>
                    </div>
                )}
            </div>

            {showPermissionWarning ? (
                <div className="mt-5 flex items-start gap-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4">
                    {permissionState === 'denied' ? <WifiOff className="mt-0.5 h-5 w-5 text-zinc-800" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-zinc-800" />}
                    <div>
                        <p className="font-medium text-zinc-950">{getHelpTitle(issue, permissionState)}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-600">
                            {permissionState === 'denied'
                                ? 'Activa el permiso de ubicacion para esta web desde la configuracion del navegador o del celular.'
                                : getHelpMessage(issue, error)}
                        </p>
                    </div>
                </div>
            ) : null}

            {issue === 'low_accuracy' ? (
                <div className="mt-5 rounded-lg border border-zinc-300 bg-white p-4">
                    <p className="font-medium text-zinc-950">Activa Precisa en 3 pasos</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                        La distancia puede estar bien, pero Android todavia puede estar ocultando tu punto exacto.
                    </p>
                    <div className="mt-3 grid gap-3 text-sm leading-6 text-zinc-600 sm:grid-cols-3">
                        <div>
                            <p className="font-semibold text-zinc-800">1. Abre ajustes</p>
                            <p>Configuracion &gt; Apps &gt; Chrome &gt; Permisos &gt; Ubicacion.</p>
                        </div>
                        <div>
                            <p className="font-semibold text-zinc-800">2. Elige Precisa</p>
                            <p>Activa Ubicacion precisa. No uses Aproximada.</p>
                        </div>
                        <div>
                            <p className="font-semibold text-zinc-800">3. Vuelve a KargaX</p>
                            <p>Recarga la pagina y toca Intentar de nuevo. Espera la lectura sin cerrar la pantalla.</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">
                        Si no mejora, desactiva ahorro de bateria y prueba en un punto abierto durante 30 a 60 segundos.
                    </p>
                </div>
            ) : null}

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
                <Wifi className="h-3.5 w-3.5" />
                <span>Para registrar llegada necesitas dos cosas: estar en el radio y tener precision de {MAX_ACCEPTABLE_ACCURACY_METERS} m o menos.</span>
            </div>
        </motion.div>
    );
}

export default GPSVerification;
