'use client';

import * as React from 'react';
import {
    Bell,
    FileText,
    RefreshCw,
    Route,
    ShieldCheck,
    TrendingDown,
} from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import {
    LAST_MILE_GUARDRAILS,
    LAST_MILE_PROCESS_STEPS,
    getLastMileProgressCopy,
} from '@/lib/last-mile/copy';

interface LastMileExplainerProps {
    month: string;
    totalTrips: number;
    observedTrips: number;
    canRunRecompute: boolean;
    isRecomputing: boolean;
    readOnly: boolean;
    onRecompute: () => void;
}

const stepIcons = [Route, ShieldCheck, FileText, TrendingDown, Bell] as const;

function safeCount(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
}

export function LastMileExplainer({
    month,
    totalTrips,
    observedTrips,
    canRunRecompute,
    isRecomputing,
    readOnly,
    onRecompute,
}: LastMileExplainerProps) {
    const displayTotalTrips = safeCount(totalTrips);
    const displayObservedTrips = safeCount(observedTrips);
    const progress = getLastMileProgressCopy({
        totalTrips: displayTotalTrips,
        observedTrips: displayObservedTrips,
    });
    const recomputeDisabled = readOnly || !canRunRecompute || displayTotalTrips <= 0;

    return (
        <Card className="overflow-hidden border-zinc-200 bg-white">
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="premium">Last Mile</Badge>
                        <Badge variant="outline">{month || 'Mes seleccionado'}</Badge>
                        <Badge variant={progress.tone === 'needs_recompute' ? 'premium' : 'outline'}>
                            {progress.title}
                        </Badge>
                        {readOnly ? <Badge variant="outline">Solo lectura</Badge> : null}
                    </div>

                    <h2 className="mt-4 max-w-2xl text-2xl font-bold leading-tight text-zinc-950">
                        Last Mile convierte viajes en decisiones.
                    </h2>

                    <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                        Toma tus viajes del mes, compara el costo real contra contratos y evidencia,
                        y te muestra dónde se está perdiendo margen. Si ves viajes pero no ves análisis,
                        falta recalcular el periodo para crear snapshots de margen.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Viajes del mes
                            </p>
                            <p className="mt-2 font-money text-2xl font-bold text-zinc-950">
                                {displayTotalTrips}
                            </p>
                        </div>

                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Analizados
                            </p>
                            <p className="mt-2 font-money text-2xl font-bold text-zinc-950">
                                {displayObservedTrips}
                            </p>
                        </div>

                        <div className="rounded-lg border border-zinc-950 bg-zinc-950 p-4 text-white">
                            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                                Siguiente paso
                            </p>
                            <p className="mt-2 text-sm font-semibold leading-5">
                                {progress.actionLabel}
                            </p>
                        </div>
                    </div>

                    <div aria-live="polite" className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-sm font-semibold text-zinc-950">{progress.title}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-600">{progress.description}</p>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button
                                onClick={onRecompute}
                                isLoading={isRecomputing}
                                disabled={recomputeDisabled}
                                leftIcon={<RefreshCw className="h-4 w-4" />}
                            >
                                {progress.actionLabel}
                            </Button>
                            {readOnly ? (
                                <p className="text-xs leading-5 text-zinc-500">
                                    Tu plan muestra lectura básica. Contratos, alertas y renegociaciones requieren Enterprise completo.
                                </p>
                            ) : !canRunRecompute ? (
                                <p className="text-xs leading-5 text-zinc-500">
                                    Tu rol puede ver Last Mile, pero no recalcular este periodo.
                                </p>
                            ) : (
                                <p className="text-xs leading-5 text-zinc-500">
                                    Recalcular no mueve wallet, pagos, liquidaciones ni marketplace.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="border-t border-zinc-200 bg-zinc-50 p-5 sm:p-6 lg:border-l lg:border-t-0">
                    <h3 className="text-sm font-bold text-zinc-950">Cómo funciona</h3>
                    <div className="mt-4 space-y-3">
                        {LAST_MILE_PROCESS_STEPS.map((step, index) => {
                            const Icon = stepIcons[index] || Route;
                            return (
                                <div key={step.title} className="flex gap-3 rounded-lg bg-white p-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200">
                                        <Icon className="h-4 w-4 text-zinc-950" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-zinc-950">{step.title}</p>
                                        <p className="mt-0.5 text-xs leading-5 text-zinc-500">{step.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-4">
                        <p className="text-sm font-bold text-zinc-950">Límites seguros</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Este panel analiza la operación. No ejecuta dinero ni cambia viajes.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {LAST_MILE_GUARDRAILS.map((item) => (
                                <span
                                    key={item}
                                    className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default LastMileExplainer;
