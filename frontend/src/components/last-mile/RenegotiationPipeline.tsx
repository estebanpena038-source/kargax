'use client';

import { ClipboardList } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import type { LastMileRecommendationStatus, LastMileRenegotiationRecommendation } from '@/lib/last-mile/types';

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const columns: Array<{ status: LastMileRecommendationStatus; label: string }> = [
    { status: 'open', label: 'Abierta' },
    { status: 'acknowledged', label: 'Tomada' },
    { status: 'in_negotiation', label: 'En negociación' },
    { status: 'accepted', label: 'Aceptada' },
    { status: 'closed', label: 'Cerrada' },
];

function formatMoney(value: number | null | undefined) {
    return money.format(Number(value || 0));
}

export function RenegotiationPipeline({
    renegotiations,
    canManage,
    onStatusChange,
}: {
    renegotiations: LastMileRenegotiationRecommendation[];
    canManage: boolean;
    onStatusChange: (id: string, status: LastMileRecommendationStatus, resolutionNote?: string | null) => void;
}) {
    return (
        <Card className="p-4 sm:p-5">
            <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-zinc-950" />
                        <h2 className="text-lg font-bold text-zinc-950">Pipeline de renegociación</h2>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Acciones sugeridas por sobrecosto, evidencia o desempeño.</p>
                </div>
                <Badge variant="outline">{renegotiations.length} casos</Badge>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-5">
                {columns.map((column) => {
                    const items = renegotiations.filter((item) => item.status === column.status);
                    return (
                        <div key={column.status} className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-zinc-950">{column.label}</h3>
                                <Badge variant="secondary">{items.length}</Badge>
                            </div>
                            <div className="mt-3 space-y-3">
                                {items.length === 0 ? (
                                    <p className="rounded-lg bg-white p-3 text-xs text-zinc-500">Sin casos.</p>
                                ) : items.slice(0, 4).map((item) => (
                                    <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                                        <p className="line-clamp-2 text-sm font-semibold text-zinc-950">{item.title}</p>
                                        <p className="mt-1 text-xs text-zinc-500">{item.carrier?.display_name || 'Proveedor'}</p>
                                        <p className="mt-2 font-money text-xs font-semibold text-zinc-950">{formatMoney(item.expected_saving_cop)} oportunidad</p>
                                        {canManage && item.status !== 'closed' ? (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {item.status !== 'in_negotiation' ? (
                                                    <Button size="xs" variant="outline" onClick={() => onStatusChange(item.id, 'in_negotiation')}>
                                                        Negociar
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    size="xs"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        const note = window.prompt('Nota de cierre para auditoría');
                                                        if (note?.trim()) onStatusChange(item.id, 'closed', note.trim());
                                                    }}
                                                >
                                                    Cerrar
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

export default RenegotiationPipeline;
