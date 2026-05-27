'use client';

import * as React from 'react';
import { AlertTriangle, Check, ExternalLink, Loader2, LocateFixed, MapPin, Navigation, RefreshCw, Shield, Target, Wifi, WifiOff, X } from 'lucide-react';
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
        return 'Permiso de GPS denegado. Activa la ubicacion en tu celular para continuar.';
    }

    if (error.code === error.TIMEOUT) {
        return 'El GPS tardo demasiado. Sal a un punto con mejor senal y vuelve a intentar.';
    }

    return 'No se pudo obtener tu ubicacion. Verifica que el GPS del celular este activo.';
}

function mapsPointUrl(latitude: number, longitude: number) {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
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
                                    {distance <= toleranceMeters ? 'Llegaste al punto correcto' : `No has llegado al ${targetLabel.toLowerCase()}`}
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
    const [permissionState, setPermissionState] = React.useState<PermissionState | 'unsupported'>('unsupported');

    const gpsSupported = isGeolocationSupported();
    const hasTarget = hasTargetCoordinates(targetLatitude, targetLongitude);
    const targetLabel = locationType === 'origin' ? 'Origen' : 'Destino';
    const strictMessage = locationType === 'origin'
        ? 'No has llegado al origen. Debes estar dentro del radio permitido para iniciar carga.'
        : 'No has llegado al destino. Debes estar dentro del radio permitido para iniciar descarga.';

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

    const handleVerify = React.useCallback(() => {
        setError('');

        if (!gpsSupported) {
            setStatus('error');
            setError('GPS no disponible en este dispositivo.');
            return;
        }

        if (!hasTarget) {
            setStatus('error');
            setError('Esta ruta no tiene coordenadas configuradas. La empresa debe completarlas.');
            return;
        }

        setStatus('checking');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextCurrent = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                };
                const nextDistance = Math.round(calculateDistance(
                    nextCurrent,
                    { latitude: Number(targetLatitude), longitude: Number(targetLongitude) }
                ));

                setCurrent(nextCurrent);
                setDistance(nextDistance);

                if (nextCurrent.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
                    setStatus('error');
                    setError(`La senal GPS esta imprecisa (+/- ${Math.round(nextCurrent.accuracy)}m). Espera mejor senal y vuelve a intentar.`);
                    return;
                }

                if (nextDistance > toleranceMeters) {
                    setStatus('too_far');
                    setError(strictMessage);
                    return;
                }

                setStatus('verified');
                onVerified?.({
                    latitude: nextCurrent.latitude,
                    longitude: nextCurrent.longitude,
                    accuracy: nextCurrent.accuracy,
                    distanceMeters: nextDistance,
                });
            },
            (gpsError) => {
                setStatus('error');
                setError(getPermissionErrorMessage(gpsError));
                if (gpsError.code === gpsError.PERMISSION_DENIED) {
                    setPermissionState('denied');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0,
            }
        );
    }, [gpsSupported, hasTarget, onVerified, strictMessage, targetLatitude, targetLongitude, toleranceMeters]);

    const handleRetry = React.useCallback(() => {
        setStatus('idle');
        setDistance(null);
        setError('');
    }, []);

    const targetLat = Number(targetLatitude);
    const targetLng = Number(targetLongitude);
    const canShowMap = hasTargetCoordinates(targetLat, targetLng);
    const showPermissionWarning = permissionState === 'denied' || status === 'error';

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
                            {status === 'checking' && 'Leyendo GPS del celular...'}
                            {status === 'verified' && 'Ubicacion registrada'}
                            {status === 'too_far' && `No has llegado al ${targetLabel.toLowerCase()}`}
                            {status === 'error' && 'GPS bloqueado'}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                            {status === 'idle' && 'El navegador pedira permiso de ubicacion en tu celular.'}
                            {status === 'checking' && 'Mantente en esta pantalla hasta que termine la lectura.'}
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
                        <p className="font-medium text-zinc-950">{permissionState === 'denied' ? 'Permiso de ubicacion bloqueado' : 'Verificacion pendiente'}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-600">
                            {permissionState === 'denied'
                                ? 'Activa el permiso de ubicacion para esta web desde la configuracion del navegador o del celular.'
                                : error || 'Debes estar dentro del radio permitido para continuar.'}
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
                <Wifi className="h-3.5 w-3.5" />
                <span>Usando GPS real del dispositivo</span>
            </div>
        </motion.div>
    );
}

export default GPSVerification;
