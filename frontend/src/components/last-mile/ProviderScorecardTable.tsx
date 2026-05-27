'use client';

import { Medal } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import type { LastMileProviderScoreSnapshot } from '@/lib/last-mile/types';

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

function formatMoney(value: number | null | undefined) {
    return money.format(Number(value || 0));
}

function scoreBadge(score: number) {
    if (score >= 85) return 'Fuerte';
    if (score >= 70) return 'Vigilar';
    return 'Riesgo';
}

export function ProviderScorecardTable({ scorecards }: { scorecards: LastMileProviderScoreSnapshot[] }) {
    return (
        <Card className="overflow-hidden">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-100 p-4 sm:p-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Medal className="h-5 w-5 text-zinc-950" />
                        <h2 className="text-lg font-bold text-zinc-950">Scorecards de proveedores</h2>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Calidad, evidencia, puntualidad y fuga estimada.</p>
                </div>
                <Badge variant="outline">{scorecards.length} proveedores</Badge>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-sm">
                    <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                        <tr>
                            <th className="px-5 py-3">Proveedor</th>
                            <th className="px-5 py-3 text-right">Score</th>
                            <th className="px-5 py-3 text-right">Viajes</th>
                            <th className="px-5 py-3 text-right">Evidencia</th>
                            <th className="px-5 py-3 text-right">Sobrecosto prom.</th>
                            <th className="px-5 py-3 text-right">Fuga estimada</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {scorecards.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                                    Sin scorecards generados para este periodo.
                                </td>
                            </tr>
                        ) : scorecards.map((scorecard) => (
                            <tr key={scorecard.id}>
                                <td className="px-5 py-4 font-semibold text-zinc-950">
                                    {scorecard.carrier?.display_name || 'Proveedor'}
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <Badge variant={scorecard.score >= 85 ? 'primary' : 'outline'}>
                                        {Math.round(scorecard.score)} / {scoreBadge(scorecard.score)}
                                    </Badge>
                                </td>
                                <td className="px-5 py-4 text-right font-money">{scorecard.completed_trips}</td>
                                <td className="px-5 py-4 text-right font-money">{Math.round(scorecard.evidence_complete_rate)}%</td>
                                <td className="px-5 py-4 text-right font-money">{formatMoney(scorecard.avg_overrun_cop)}</td>
                                <td className="px-5 py-4 text-right font-money font-semibold text-zinc-950">{formatMoney(scorecard.estimated_leakage_cop)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

export default ProviderScorecardTable;
