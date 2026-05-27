'use client';

import { AlertTriangle, BadgeDollarSign, ClipboardCheck, FileWarning, Route, Truck } from 'lucide-react';
import { Card } from '@/components/ui';
import type { LastMileDashboardResponse } from '@/lib/last-mile/types';

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 1,
});

function formatMoney(value: number | null | undefined) {
    return money.format(Number(value || 0));
}

function formatPercent(value: number | null | undefined) {
    return `${percent.format(Number(value || 0))}%`;
}

export function LastMileKpiCards({ dashboard }: { dashboard: LastMileDashboardResponse }) {
    const metrics = dashboard.metrics;
    const cards = [
        {
            label: 'Fuga estimada',
            value: formatMoney(metrics.leakageCop),
            detail: `${formatPercent(metrics.avgOverrunPct)} sobrecosto observado`,
            icon: AlertTriangle,
        },
        {
            label: 'Viajes observados',
            value: metrics.observedTrips.toLocaleString('es-CO'),
            detail: `${metrics.totalTrips.toLocaleString('es-CO')} viajes del periodo`,
            icon: Truck,
        },
        {
            label: 'Costo final',
            value: formatMoney(metrics.totalFinalCostCop),
            detail: `${formatMoney(metrics.totalExpectedCostCop)} costo esperado`,
            icon: BadgeDollarSign,
        },
        {
            label: 'Evidencia completa',
            value: formatPercent(metrics.evidenceCompleteRate),
            detail: 'POD, firma, fotos y eventos',
            icon: ClipboardCheck,
        },
        {
            label: 'Alertas abiertas',
            value: metrics.openRecommendations.toLocaleString('es-CO'),
            detail: `${metrics.criticalRecommendations} críticas`,
            icon: FileWarning,
        },
        {
            label: 'Contratos por vencer',
            value: metrics.expiringContracts.toLocaleString('es-CO'),
            detail: 'Próximos 30 días',
            icon: Route,
        },
    ];

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((item) => {
                const Icon = item.icon;
                return (
                    <Card key={item.label} className="p-4">
                        <div className="flex min-w-0 items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase text-zinc-500">{item.label}</p>
                                <p className="mt-2 break-words font-money text-2xl font-bold text-zinc-950">{item.value}</p>
                                <p className="mt-1 text-sm text-zinc-500">{item.detail}</p>
                            </div>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
                                <Icon className="h-5 w-5" />
                            </span>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}

export default LastMileKpiCards;
