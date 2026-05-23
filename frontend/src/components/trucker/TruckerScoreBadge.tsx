'use client';

import * as React from 'react';
import { Award, CheckCircle2, Shield, Star, TrendingUp } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { cn } from '@/lib/utils';

interface TruckerScore {
    score: number;
    tier: 'bronze' | 'silver' | 'gold' | 'diamond';
    completed_trips: number;
    on_time_deliveries: number;
    incident_free_deliveries: number;
    cancellations: number;
    calculated_at: string;
}

const tierConfig = {
    bronze: { label: 'Bronce', min: 0, next: 11, color: 'text-orange-700', bg: 'bg-orange-100', badge: 'secondary' as const },
    silver: { label: 'Plata', min: 11, next: 51, color: 'text-slate-700', bg: 'bg-slate-100', badge: 'default' as const },
    gold: { label: 'Oro', min: 51, next: 200, color: 'text-amber-700', bg: 'bg-amber-100', badge: 'warning' as const },
    diamond: { label: 'Diamante', min: 200, next: null, color: 'text-blue-700', bg: 'bg-blue-100', badge: 'info' as const },
};

function progressToNext(score: TruckerScore) {
    const config = tierConfig[score.tier];
    if (!config.next) return 100;
    const range = config.next - config.min;
    return Math.max(0, Math.min(100, ((score.completed_trips - config.min) / range) * 100));
}

function nextLabel(score: TruckerScore) {
    const config = tierConfig[score.tier];
    if (!config.next) return 'Nivel maximo';
    return `${Math.max(config.next - score.completed_trips, 0)} viajes para subir`;
}

export function TruckerScoreBadge({
    className,
    compact = false,
    truckerId,
}: {
    className?: string;
    compact?: boolean;
    truckerId?: string;
}) {
    const [score, setScore] = React.useState<TruckerScore | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const url = truckerId ? `/api/trucker/score?truckerId=${encodeURIComponent(truckerId)}` : '/api/trucker/score';
        fetch(url)
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload?.error || 'No se pudo calcular reputacion');
                return payload?.data as TruckerScore;
            })
            .then((data) => {
                if (!cancelled) {
                    setScore(data);
                    setError(null);
                }
            })
            .catch((fetchError) => {
                if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'Score no disponible');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [truckerId]);

    if (loading) {
        return (
            <Card className={cn('p-5', className)}>
                <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            </Card>
        );
    }

    if (error || !score) {
        return (
            <Card className={cn('border-slate-200 bg-slate-50 p-5', className)}>
                <div className="flex items-start gap-3">
                    <Shield className="mt-0.5 h-5 w-5 text-slate-500" />
                    <div>
                        <p className="font-semibold text-slate-900">Reputacion en preparacion</p>
                        <p className="mt-1 text-sm text-slate-600">{error || 'Aun no hay datos suficientes.'}</p>
                    </div>
                </div>
            </Card>
        );
    }

    const config = tierConfig[score.tier];
    const progress = progressToNext(score);
    const roundedScore = Math.round(score.score);

    if (compact) {
        return (
            <div className={cn('inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm', className)}>
                <Award className={cn('h-4 w-4', config.color)} />
                <span className="text-sm font-bold text-slate-900">{roundedScore}/100</span>
                <Badge variant={config.badge} size="xs">{config.label}</Badge>
            </div>
        );
    }

    return (
        <Card className={cn('overflow-hidden border-slate-200 bg-white p-0', className)}>
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', config.bg, config.color)}>
                            <Award className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">Score de transportador</p>
                            <p className="text-xs text-slate-500">Sin metricas de credito ni adelantos.</p>
                        </div>
                    </div>
                    <Badge variant={config.badge} size="sm">{config.label}</Badge>
                </div>
            </div>

            <div className="p-5">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <div className="text-4xl font-black tracking-tight text-slate-950">{roundedScore}<span className="text-xl text-slate-400">/100</span></div>
                        <p className="mt-1 text-sm text-slate-500">{nextLabel(score)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{score.completed_trips}</p>
                        <p className="text-xs text-slate-500">viajes cerrados</p>
                    </div>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-emerald-50 p-3">
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                        <p className="mt-2 text-sm font-semibold text-slate-900">{score.on_time_deliveries}</p>
                        <p className="text-xs text-slate-500">a tiempo</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3">
                        <Star className="h-4 w-4 text-blue-700" />
                        <p className="mt-2 text-sm font-semibold text-slate-900">{score.incident_free_deliveries}</p>
                        <p className="text-xs text-slate-500">sin incidente</p>
                    </div>
                    <div className="rounded-xl bg-orange-50 p-3">
                        <TrendingUp className="h-4 w-4 text-orange-700" />
                        <p className="mt-2 text-sm font-semibold text-slate-900">{score.cancellations}</p>
                        <p className="text-xs text-slate-500">cancelaciones</p>
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default TruckerScoreBadge;
