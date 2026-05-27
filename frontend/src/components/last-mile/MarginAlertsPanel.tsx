'use client';

import { AlertTriangle, CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import type { LastMileRecommendationStatus, LastMileRenegotiationRecommendation } from '@/lib/last-mile/types';

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const severityLabel: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Crítica',
};

function formatMoney(value: number | null | undefined) {
    return money.format(Number(value || 0));
}

function routeLabel(alert: LastMileRenegotiationRecommendation) {
    const lane = alert.lane;
    if (!lane) return 'Ruta general';
    return `${lane.origin_city || 'Origen'} -> ${lane.destination_city || 'Destino'}`;
}

export function MarginAlertsPanel({
    alerts,
    canManage,
    onStatusChange,
}: {
    alerts: LastMileRenegotiationRecommendation[];
    canManage: boolean;
    onStatusChange: (alertId: string, status: LastMileRecommendationStatus, resolutionNote?: string | null) => void;
}) {
    return (
        <Card className="overflow-hidden">
            <div className="flex min-w-0 items-start justify-between gap-4 border-b border-zinc-100 p-4 sm:p-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <MessageSquareWarning className="h-5 w-5 text-zinc-950" />
                        <h2 className="text-lg font-bold text-zinc-950">Alertas de margen</h2>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Sobrecosto observado, evidencia incompleta y oportunidades por proveedor.</p>
                </div>
                <Badge variant="outline">{alerts.length} abiertas</Badge>
            </div>
            <div className="divide-y divide-zinc-100">
                {alerts.length === 0 ? (
                    <div className="p-6 text-sm text-zinc-500">No hay alertas abiertas en este periodo.</div>
                ) : alerts.slice(0, 6).map((alert) => (
                    <div key={alert.id} className="p-4 sm:p-5">
                        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={alert.severity === 'critical' ? 'primary' : 'outline'} icon={<AlertTriangle />}>
                                        {severityLabel[alert.severity] || alert.severity}
                                    </Badge>
                                    <Badge variant="secondary">{alert.status.replace(/_/g, ' ')}</Badge>
                                </div>
                                <h3 className="mt-3 text-sm font-bold text-zinc-950">{alert.title}</h3>
                                <p className="mt-1 text-sm leading-6 text-zinc-600">{alert.description}</p>
                                <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                                    <span>{alert.carrier?.display_name || 'Proveedor sin nombre'}</span>
                                    <span>{routeLabel(alert)}</span>
                                    <span className="font-money">{formatMoney(alert.expected_saving_cop)} oportunidad</span>
                                </div>
                            </div>
                            {canManage ? (
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={() => onStatusChange(alert.id, 'acknowledged')}>
                                        Tomar
                                    </Button>
                                    <Button size="sm" onClick={() => onStatusChange(alert.id, 'in_negotiation')}>
                                        Negociar
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        leftIcon={<CheckCircle2 className="h-4 w-4" />}
                                        onClick={() => {
                                            const note = window.prompt('Nota de cierre para auditoría');
                                            if (note?.trim()) onStatusChange(alert.id, 'closed', note.trim());
                                        }}
                                    >
                                        Cerrar
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

export default MarginAlertsPanel;
