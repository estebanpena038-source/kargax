'use client';

import * as React from 'react';
import { ExternalLink, Loader2, MapPinned, Radio } from 'lucide-react';
import { Badge, Card } from '@/components/ui';

interface TrackingPing {
    latitude: number;
    longitude: number;
    accuracy_meters: number | null;
    captured_at: string;
}

interface TrackingSession {
    status: string;
    last_ping_at: string | null;
}

export function TrackingReadOnlyCard({ offerId }: { offerId: string }) {
    const [latestPing, setLatestPing] = React.useState<TrackingPing | null>(null);
    const [sessions, setSessions] = React.useState<TrackingSession[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(`/api/trips/${offerId}/tracking?limit=12`)
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload?.error || 'Rastreo no disponible');
                return payload?.data as { latestPing: TrackingPing | null; sessions: TrackingSession[] };
            })
            .then((data) => {
                if (!cancelled) {
                    setLatestPing(data.latestPing || null);
                    setSessions(data.sessions || []);
                    setError(null);
                }
            })
            .catch((fetchError) => {
                if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'Rastreo no disponible');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [offerId]);

    const activeSession = sessions.find((session) => session.status === 'active');
    const mapsUrl = latestPing ? `https://www.google.com/maps?q=${latestPing.latitude},${latestPing.longitude}` : null;

    return (
        <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <MapPinned className="h-5 w-5 text-zinc-800" />
                    <h3 className="font-semibold text-slate-900">Rastreo del viaje</h3>
                </div>
                <Badge variant={activeSession ? 'primary' : 'default'} size="xs">
                    {activeSession ? 'Activo' : 'Sin sesion activa'}
                </Badge>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Consultando ubicacion...
                </div>
            ) : error ? (
                <p className="text-sm leading-6 text-slate-500">{error}</p>
            ) : latestPing ? (
                <div className="space-y-3">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Radio className="h-4 w-4 text-zinc-800" />
                            Ultima ubicacion recibida
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                            {new Date(latestPing.captured_at).toLocaleString('es-CO')}
                            {latestPing.accuracy_meters ? ` | precision ${Math.round(latestPing.accuracy_meters)} m` : ''}
                        </p>
                    </div>
                    {mapsUrl && (
                        <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950 underline-offset-4 hover:underline"
                        >
                            Abrir en Google Maps
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    )}
                </div>
            ) : (
                <p className="text-sm leading-6 text-slate-500">
                    Aun no hay pings GPS. Cuando el conductor active el rastreo PWA, aqui aparecera la ultima ubicacion.
                </p>
            )}
        </Card>
    );
}

export default TrackingReadOnlyCard;
