'use client';

import { Archive, FileText } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import type { LastMileContract } from '@/lib/last-mile/types';

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

function formatMoney(value: number | null | undefined) {
    return money.format(Number(value || 0));
}

function routeLabel(contract: LastMileContract) {
    if (!contract.lane) return 'Todas las rutas';
    return `${contract.lane.origin_city || 'Origen'} -> ${contract.lane.destination_city || 'Destino'}`;
}

export function ContractsTable({
    contracts,
    canManage,
    onArchive,
}: {
    contracts: LastMileContract[];
    canManage: boolean;
    onArchive: (contractId: string) => void;
}) {
    return (
        <Card className="overflow-hidden">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-100 p-4 sm:p-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-zinc-950" />
                        <h2 className="text-lg font-bold text-zinc-950">Contratos de margen</h2>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Tarifas pactadas para comparar contra costo observado.</p>
                </div>
                <Badge variant="outline">{contracts.length} contratos</Badge>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[58rem] text-sm">
                    <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                        <tr>
                            <th className="px-5 py-3">Proveedor</th>
                            <th className="px-5 py-3">Ruta</th>
                            <th className="px-5 py-3">Estado</th>
                            <th className="px-5 py-3">Modelo</th>
                            <th className="px-5 py-3 text-right">Base</th>
                            <th className="px-5 py-3">Vigencia</th>
                            {canManage ? <th className="px-5 py-3 text-right">Acción</th> : null}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan={canManage ? 7 : 6} className="px-5 py-8 text-center text-zinc-500">
                                    Sin contratos registrados.
                                </td>
                            </tr>
                        ) : contracts.map((contract) => (
                            <tr key={contract.id}>
                                <td className="px-5 py-4 font-semibold text-zinc-950">{contract.carrier?.display_name || 'Proveedor'}</td>
                                <td className="px-5 py-4 text-zinc-600">{routeLabel(contract)}</td>
                                <td className="px-5 py-4"><Badge variant={contract.status === 'active' ? 'primary' : 'outline'}>{contract.status}</Badge></td>
                                <td className="px-5 py-4 text-zinc-600">{contract.pricing_model.replace(/_/g, ' ')}</td>
                                <td className="px-5 py-4 text-right font-money">{formatMoney(contract.base_rate_cop)}</td>
                                <td className="px-5 py-4 text-zinc-600">
                                    {contract.starts_at} / {contract.ends_at || 'sin cierre'}
                                </td>
                                {canManage ? (
                                    <td className="px-5 py-4 text-right">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            leftIcon={<Archive className="h-4 w-4" />}
                                            onClick={() => onArchive(contract.id)}
                                            disabled={contract.status === 'superseded'}
                                        >
                                            Archivar
                                        </Button>
                                    </td>
                                ) : null}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

export default ContractsTable;
