'use client';

import { Activity } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import type { LastMileRouteCostSnapshot } from '@/lib/last-mile/types';

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

function formatMoney(value: number | null | undefined) {
    return money.format(Number(value || 0));
}

function routeLabel(snapshot: LastMileRouteCostSnapshot) {
    if (!snapshot.lane) return 'Ruta sin clasificar';
    return `${snapshot.lane.origin_city || 'Origen'} -> ${snapshot.lane.destination_city || 'Destino'}`;
}

export function RouteCostSnapshotsTable({ snapshots }: { snapshots: LastMileRouteCostSnapshot[] }) {
    return (
        <Card className="overflow-hidden">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-100 p-4 sm:p-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-zinc-950" />
                        <h2 className="text-lg font-bold text-zinc-950">Snapshots por viaje</h2>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Lectura de costos y evidencia. No modifica pagos ni wallet.</p>
                </div>
                <Badge variant="outline">{snapshots.length} registros</Badge>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] text-sm">
                    <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                        <tr>
                            <th className="px-5 py-3">Ruta</th>
                            <th className="px-5 py-3">Proveedor</th>
                            <th className="px-5 py-3">Estado</th>
                            <th className="px-5 py-3 text-right">Esperado</th>
                            <th className="px-5 py-3 text-right">Final</th>
                            <th className="px-5 py-3 text-right">Sobrecosto</th>
                            <th className="px-5 py-3 text-right">Evidencia</th>
                            <th className="px-5 py-3">Observado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {snapshots.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-5 py-8 text-center text-zinc-500">
                                    Sin snapshots en este periodo.
                                </td>
                            </tr>
                        ) : snapshots.slice(0, 30).map((snapshot) => (
                            <tr key={snapshot.id}>
                                <td className="px-5 py-4 font-semibold text-zinc-950">{routeLabel(snapshot)}</td>
                                <td className="px-5 py-4 text-zinc-600">{snapshot.carrier?.display_name || 'Sin proveedor'}</td>
                                <td className="px-5 py-4"><Badge variant="outline">{snapshot.execution_status}</Badge></td>
                                <td className="px-5 py-4 text-right font-money">{formatMoney(snapshot.expected_cost_cop)}</td>
                                <td className="px-5 py-4 text-right font-money">{formatMoney(snapshot.final_cost_cop)}</td>
                                <td className="px-5 py-4 text-right font-money font-semibold text-zinc-950">{formatMoney(snapshot.overrun_cop)}</td>
                                <td className="px-5 py-4 text-right font-money">{Math.round(snapshot.evidence_score)}%</td>
                                <td className="px-5 py-4 text-zinc-600">{new Date(snapshot.observed_at).toLocaleDateString('es-CO')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

export default RouteCostSnapshotsTable;
