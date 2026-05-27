import { ArrowRight, BellRing, ShieldCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { SectionHeader, StatusPill } from '@/components/enterprise/EnterpriseLuxury';
import { DeliveryRiskBadge } from '@/components/algorithms/DeliveryRiskBadge';
import type { ExecutiveAlert } from '@/algorithms/shared/types';

export function ExecutiveAlertsPanel({
    alerts,
    generatedAt,
    snapshotPersistence,
}: {
    alerts: ExecutiveAlert[];
    generatedAt?: string | null;
    snapshotPersistence?: 'stored' | 'skipped' | null;
}) {
    const generatedLabel = generatedAt
        ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(generatedAt))
        : 'on-demand';

    return (
        <Card className="kx-enterprise-card p-4 min-[380px]:p-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionHeader
                    icon={BellRing}
                    title="Alertas ejecutivas"
                    description="Riesgo de entrega, evidencia POD y control de capacidad en modo lectura."
                />
                <div className="flex flex-wrap gap-2">
                    <StatusPill>{generatedLabel}</StatusPill>
                    <StatusPill>{snapshotPersistence === 'stored' ? 'Historial guardado' : 'On-demand'}</StatusPill>
                </div>
            </div>

            {alerts.length === 0 ? (
                <div className="mt-4 flex min-w-0 items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-emerald-900">Sin alertas P0</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-800">
                            La torre de control no detecta bloqueos ejecutivos en los viajes evaluados.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {alerts.slice(0, 4).map((alert) => (
                        <div key={alert.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <DeliveryRiskBadge riskLevel={alert.severity} />
                                {alert.rail ? (
                                    <span className="font-money text-xs font-semibold uppercase text-zinc-500">
                                        {alert.rail === 'private_fleet' ? 'Flota privada' : 'Marketplace'}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-3 text-sm font-bold text-zinc-950">{alert.title}</p>
                            <p className="mt-1 text-sm leading-6 text-zinc-600">{alert.description}</p>
                            <Button asChild variant="ghost" size="sm" className="mt-3 px-0">
                                <a href={alert.href}>
                                    {alert.actionLabel}
                                    <ArrowRight className="h-4 w-4" />
                                </a>
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
