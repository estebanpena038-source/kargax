'use client';

import * as React from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ExternalLink,
    LocateFixed,
    PauseCircle,
    Radio,
    RefreshCw,
    ShieldCheck,
    WifiOff,
} from 'lucide-react';
import { Button, Card, Badge, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

interface QueuedPing {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    speedMps: number | null;
    headingDegrees: number | null;
    capturedAt: string;
    metadata: Record<string, unknown>;
}

interface TrackingResponse<T = unknown> {
    success?: boolean;
    data?: T;
    error?: string;
    message?: string;
}

interface LatestPing {
    latitude: number;
    longitude: number;
    accuracy_meters: number | null;
    captured_at: string;
}

type GeoPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

const MIN_DISTANCE_METERS = 250;
const MIN_INTERVAL_MS = 30_000;

function queueKey(offerId: string) {
    return `kargax-tracking-queue:${offerId}`;
}

function readQueue(offerId: string): QueuedPing[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(queueKey(offerId));
        return raw ? JSON.parse(raw) as QueuedPing[] : [];
    } catch {
        return [];
    }
}

function writeQueue(offerId: string, queue: QueuedPing[]) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(queueKey(offerId), JSON.stringify(queue.slice(-300)));
}

function metersBetween(a: QueuedPing | null, b: QueuedPing) {
    if (!a) return Number.POSITIVE_INFINITY;
    const earthRadius = 6371000;
    const toRad = (value: number) => value * Math.PI / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function formatTime(value: string | null) {
    if (!value) return 'Sin sincronizar';
    return new Date(value).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function getPermissionLabel(permissionState: GeoPermissionState) {
    const labels = {
        unknown: 'Sin solicitar',
        granted: 'Permitido',
        denied: 'Denegado',
        prompt: 'Pendiente',
    };

    return labels[permissionState];
}

function buildPingFromPosition(position: GeolocationPosition): QueuedPing {
    return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        speedMps: position.coords.speed ?? null,
        headingDegrees: position.coords.heading ?? null,
        capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        metadata: {
            source: 'pwa_foreground',
            visibilityState: document.visibilityState,
        },
    };
}

function getGeolocationErrorMessage(geoError: GeolocationPositionError) {
    if (geoError.code === geoError.PERMISSION_DENIED) {
        return 'Permiso de ubicacion denegado. Habilita la ubicacion para este sitio en el navegador y vuelve a iniciar GPS.';
    }

    if (geoError.code === geoError.POSITION_UNAVAILABLE) {
        return 'GPS no disponible en este momento. Revisa senal, permisos del sistema y vuelve a intentar.';
    }

    if (geoError.code === geoError.TIMEOUT) {
        return 'El GPS tardo demasiado en responder. Intenta de nuevo con mejor senal.';
    }

    return geoError.message || 'GPS no disponible';
}

function requestCurrentPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            maximumAge: 10_000,
            timeout: 20_000,
        });
    });
}

async function getBrowserGeolocationPermission(): Promise<PermissionState | null> {
    try {
        if (!navigator.permissions?.query) return null;
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return permission.state;
    } catch {
        return null;
    }
}

async function postJson<T>(url: string, body: unknown): Promise<TrackingResponse<T>> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'No se pudo sincronizar tracking');
    }
    return payload;
}

export function LiveTripTracker({ offerId, compact = false }: { offerId: string; compact?: boolean }) {
    const [isActive, setIsActive] = React.useState(false);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [permissionState, setPermissionState] = React.useState<GeoPermissionState>('unknown');
    const [lastPing, setLastPing] = React.useState<QueuedPing | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);
    const [queuedCount, setQueuedCount] = React.useState(0);
    const [latestRemote, setLatestRemote] = React.useState<LatestPing | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isOnline, setIsOnline] = React.useState(true);
    const watchIdRef = React.useRef<number | null>(null);
    const lastSentRef = React.useRef<{ ping: QueuedPing | null; sentAt: number }>({ ping: null, sentAt: 0 });

    const refreshQueuedCount = React.useCallback(() => {
        setQueuedCount(readQueue(offerId).length);
    }, [offerId]);

    const syncQueue = React.useCallback(async () => {
        const queue = readQueue(offerId);
        if (queue.length === 0 || !navigator.onLine) {
            refreshQueuedCount();
            return;
        }

        setIsSyncing(true);
        try {
            await postJson(`/api/trips/${offerId}/tracking/start`, {
                metadata: {
                    userAgent: navigator.userAgent,
                    online: navigator.onLine,
                },
            });

            const remaining: QueuedPing[] = [];
            for (const ping of queue) {
                try {
                    await postJson(`/api/trips/${offerId}/tracking/ping`, ping);
                    lastSentRef.current = { ping, sentAt: Date.now() };
                    setLastSyncedAt(new Date().toISOString());
                } catch {
                    remaining.push(ping);
                }
            }
            writeQueue(offerId, remaining);
            refreshQueuedCount();
        } catch (syncError) {
            setError(syncError instanceof Error ? syncError.message : 'Rastreo sin conexion');
        } finally {
            setIsSyncing(false);
        }
    }, [offerId, refreshQueuedCount]);

    const enqueuePing = React.useCallback((ping: QueuedPing) => {
        const last = lastSentRef.current.ping;
        const distance = metersBetween(last, ping);
        const elapsed = Date.now() - lastSentRef.current.sentAt;

        if (last && distance < MIN_DISTANCE_METERS && elapsed < MIN_INTERVAL_MS) {
            setLastPing(ping);
            return;
        }

        const queue = readQueue(offerId);
        writeQueue(offerId, [...queue, ping]);
        setLastPing(ping);
        refreshQueuedCount();
        void syncQueue();
    }, [offerId, refreshQueuedCount, syncQueue]);

    const startTracking = React.useCallback(async () => {
        if (!('geolocation' in navigator)) {
            setError('Este navegador no soporta GPS');
            return;
        }

        if (watchIdRef.current != null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        setIsActive(false);
        setIsSyncing(true);
        setError(null);
        setPermissionState('prompt');

        try {
            const browserPermission = await getBrowserGeolocationPermission();

            if (browserPermission === 'denied') {
                setPermissionState('denied');
                setError('El navegador aun tiene bloqueada la ubicacion para KargaX. Cambia el permiso del sitio a Permitir y vuelve a iniciar GPS.');
                return;
            }

            const initialPosition = await requestCurrentPosition();
            const initialPing = buildPingFromPosition(initialPosition);
            setPermissionState('granted');
            setLastPing(initialPing);

            await postJson(`/api/trips/${offerId}/tracking/start`, {
                metadata: {
                    userAgent: navigator.userAgent,
                    source: 'live_trip_tracker',
                },
            });

            try {
                await postJson(`/api/trips/${offerId}/tracking/ping`, initialPing);
                lastSentRef.current = { ping: initialPing, sentAt: Date.now() };
                setLastSyncedAt(new Date().toISOString());
            } catch {
                const queue = readQueue(offerId);
                writeQueue(offerId, [...queue, initialPing]);
                refreshQueuedCount();
            }

            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    setPermissionState('granted');
                    setError(null);
                    enqueuePing(buildPingFromPosition(position));
                },
                (geoError) => {
                    if (geoError.code === geoError.PERMISSION_DENIED) {
                        if (watchIdRef.current != null) {
                            navigator.geolocation.clearWatch(watchIdRef.current);
                            watchIdRef.current = null;
                        }
                        setIsActive(false);
                        setPermissionState('denied');
                    } else {
                        setPermissionState('prompt');
                    }
                    setError(getGeolocationErrorMessage(geoError));
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 15_000,
                    timeout: 20_000,
                }
            );

            setIsActive(true);
            toast.success('GPS activo', 'Ubicacion confirmada y sincronizada para este viaje.');
        } catch (startError) {
            setIsActive(false);
            const maybeGeoError = startError as Partial<GeolocationPositionError>;
            if (typeof maybeGeoError.code === 'number') {
                setPermissionState(maybeGeoError.code === GeolocationPositionError.PERMISSION_DENIED ? 'denied' : 'prompt');
                setError(getGeolocationErrorMessage(startError as GeolocationPositionError));
            } else {
                setError(startError instanceof Error ? startError.message : 'No se pudo iniciar GPS');
            }
        } finally {
            setIsSyncing(false);
        }
    }, [enqueuePing, offerId, refreshQueuedCount]);

    const stopTracking = React.useCallback(async () => {
        if (watchIdRef.current != null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsActive(false);
        await syncQueue();
        await postJson(`/api/trips/${offerId}/tracking/stop`, {}).catch(() => null);
        toast.info('GPS pausado', 'Puedes activarlo de nuevo si el viaje sigue en curso.');
    }, [offerId, syncQueue]);

    React.useEffect(() => {
        refreshQueuedCount();
        setIsOnline(navigator.onLine);
        const handleOnline = () => {
            setIsOnline(true);
            void syncQueue();
        };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (watchIdRef.current != null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [refreshQueuedCount, syncQueue]);

    React.useEffect(() => {
        if (!navigator.permissions?.query) return;

        let permissionStatus: PermissionStatus | null = null;
        let cancelled = false;
        let handlePermissionChange: (() => void) | null = null;

        navigator.permissions.query({ name: 'geolocation' as PermissionName })
            .then((status) => {
                if (cancelled) return;

                permissionStatus = status;
                setPermissionState(status.state);

                handlePermissionChange = () => {
                    setPermissionState(status.state);
                    if (status.state !== 'denied') {
                        setError(null);
                    }
                };

                status.addEventListener('change', handlePermissionChange);
            })
            .catch(() => null);

        return () => {
            cancelled = true;
            if (permissionStatus && handlePermissionChange) {
                permissionStatus.removeEventListener('change', handlePermissionChange);
            }
        };
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        fetch(`/api/trips/${offerId}/tracking?limit=1`)
            .then((response) => response.ok ? response.json() : null)
            .then((payload) => {
                if (!cancelled) {
                    setLatestRemote(payload?.data?.latestPing || null);
                }
            })
            .catch(() => null);
        return () => {
            cancelled = true;
        };
    }, [offerId]);

    const visiblePing = lastPing || (latestRemote ? {
        latitude: latestRemote.latitude,
        longitude: latestRemote.longitude,
        accuracyMeters: latestRemote.accuracy_meters,
        speedMps: null,
        headingDegrees: null,
        capturedAt: latestRemote.captured_at,
        metadata: {},
    } : null);
    const mapsUrl = visiblePing
        ? `https://www.google.com/maps?q=${visiblePing.latitude},${visiblePing.longitude}`
        : null;

    return (
        <Card className={cn('kx-trip-panel luxury-panel border-white/10 p-4 text-white shadow-[0_28px_80px_-54px_rgba(0,0,0,.9)] min-[380px]:p-5', compact && 'p-4')}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg min-[380px]:h-11 min-[380px]:w-11',
                        isActive ? 'border border-white bg-white text-zinc-950' : 'border border-white/12 bg-white/[0.06] text-white/75'
                    )}>
                        {isActive ? <Radio className="h-5 w-5" /> : <LocateFixed className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-white">Rastreo GPS del viaje</h3>
                            <Badge variant={isActive ? 'primary' : 'secondary'} size="xs">
                                {isActive ? 'Activo' : 'Pausado'}
                            </Badge>
                            {!isOnline && (
                                <Badge variant="outline" size="xs">
                                    <WifiOff className="h-3 w-3" /> Sin conexion
                                </Badge>
                            )}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-white/62">
                            GPS activo en primer plano. Si el telefono bloquea el navegador, KargaX conserva lo pendiente y sincroniza al volver.
                        </p>
                    </div>
                </div>
                <div className="kx-trip-action-row lg:justify-end">
                    {isActive ? (
                        <Button variant="outline" onClick={stopTracking} disabled={isSyncing} className="kx-touch-target">
                            <PauseCircle className="h-4 w-4" />
                            Pausar
                        </Button>
                    ) : (
                        <Button onClick={startTracking} disabled={isSyncing} className="kx-touch-target">
                            <LocateFixed className="h-4 w-4" />
                            Iniciar GPS
                        </Button>
                    )}
                    <Button variant="ghost" onClick={() => void syncQueue()} disabled={isSyncing} className="kx-touch-target">
                        <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                    </Button>
                </div>
            </div>

            <div className="kx-trip-metrics mt-5 grid gap-3">
                <div className="rounded-lg border border-white/12 bg-white/8 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/52">
                        <ShieldCheck className="h-4 w-4" /> Permiso
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">{getPermissionLabel(permissionState)}</p>
                </div>
                <div className="rounded-lg border border-white/12 bg-white/8 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/52">
                        <Activity className="h-4 w-4" /> Precision
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">
                        {visiblePing?.accuracyMeters ? `${Math.round(visiblePing.accuracyMeters)} m` : 'Pendiente'}
                    </p>
                </div>
                <div className="rounded-lg border border-white/12 bg-white/8 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/52">
                        <Clock className="h-4 w-4" /> Ultima sincronizacion
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">{formatTime(lastSyncedAt || visiblePing?.capturedAt || null)}</p>
                </div>
                <div className="rounded-lg border border-white/12 bg-white/8 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/52">
                        <Radio className="h-4 w-4" /> Cola local
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">{queuedCount} pings</p>
                </div>
            </div>

            {(error || permissionState === 'denied') && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-950 shadow-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    <span>{error || 'Permiso de ubicacion denegado. Activalo en el navegador para reportar el viaje.'}</span>
                </div>
            )}

            {mapsUrl && (
                <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/72"
                >
                    <CheckCircle2 className="h-4 w-4" />
                    Ultima ubicacion registrada
                    <ExternalLink className="h-4 w-4" />
                </a>
            )}
        </Card>
    );
}

export default LiveTripTracker;
