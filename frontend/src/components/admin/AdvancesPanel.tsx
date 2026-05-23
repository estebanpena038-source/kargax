'use client';

import * as React from 'react';
import { AlertTriangle, Coins, Loader2, PiggyBank, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button, toast } from '@/components/ui';
import { formatCOP } from '@/constants/colombia';
import { supabase } from '@/lib/supabase/client';
import type {
    AdvancePortfolioCohort,
    AdvancePortfolioMetrics,
    FuelAdvanceListItem,
    LendingSettingsSnapshot,
    LendingTreasurySnapshot,
} from '@/lib/advances/types';

interface AdminAdvanceItem extends FuelAdvanceListItem {
    trucker?: {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
    } | null;
}

async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Sesion no disponible');
    }

    return {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    };
}

export function AdvancesPanel() {
    const [loading, setLoading] = React.useState(true);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [treasury, setTreasury] = React.useState<LendingTreasurySnapshot | null>(null);
    const [settings, setSettings] = React.useState<LendingSettingsSnapshot | null>(null);
    const [metrics, setMetrics] = React.useState<AdvancePortfolioMetrics | null>(null);
    const [cohorts, setCohorts] = React.useState<AdvancePortfolioCohort[]>([]);
    const [advances, setAdvances] = React.useState<AdminAdvanceItem[]>([]);
    const [treasuryAmount, setTreasuryAmount] = React.useState('12000000');
    const [treasuryType, setTreasuryType] = React.useState<'funding' | 'withdrawal' | 'adjustment'>('funding');

    const loadData = React.useCallback(async () => {
        try {
            setLoading(true);
            const headers = await getAuthHeaders();
            const response = await fetch('/api/admin/advances', { headers });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'No se pudo cargar adelantos');
            }

            setTreasury(result.treasury || null);
            setSettings(result.settings || null);
            setMetrics(result.metrics || null);
            setCohorts(result.cohorts || []);
            setAdvances(result.data || []);
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo cargar adelantos');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const processAdvance = async (
        advanceId: string,
        action: 'approve' | 'reject' | 'mark_restructured' | 'write_off'
    ) => {
        try {
            setProcessingId(advanceId);
            const headers = await getAuthHeaders();
            const response = await fetch(`/api/admin/advances/${advanceId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ action }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'No se pudo procesar el adelanto');
            }

            toast.success('Adelanto actualizado', result.message || 'La cartera fue actualizada.');
            await loadData();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo procesar el adelanto');
        } finally {
            setProcessingId(null);
        }
    };

    const adjustTreasury = async () => {
        const amount = Number(treasuryAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Monto invalido', 'Ingresa un monto valido para la tesoreria.');
            return;
        }

        try {
            setProcessingId('treasury');
            const headers = await getAuthHeaders();
            const response = await fetch('/api/admin/treasury/adjust', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    amount,
                    adjustmentType: treasuryType,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'No se pudo ajustar la tesoreria');
            }

            toast.success('Tesoreria actualizada', 'El capital para adelantos quedo actualizado.');
            await loadData();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo ajustar la tesoreria');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Coins className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-lg font-semibold text-slate-900">KargaX Adelanto</h2>
                    </div>
                    <p className="text-sm text-slate-600">
                        Control de tesoreria, aprobaciones y seguimiento de la cartera de adelantos.
                    </p>
                </div>
                <Button variant="outline" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 mb-6">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">Capital disponible</p>
                    <p className="text-2xl font-bold text-emerald-900">{formatCOP(Number(treasury?.available_capital || 0))}</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-blue-700">Capital desplegado</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCOP(Number(treasury?.deployed_capital || 0))}</p>
                </div>
                <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-green-800">Interes recuperado</p>
                    <p className="text-2xl font-bold text-orange-900">{formatCOP(Number(treasury?.total_repaid_interest || 0))}</p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-4 mb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Deployment</p>
                    <p className="text-2xl font-bold text-slate-900">{Number(treasury?.deployment_percent || 0).toFixed(2)}%</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-amber-700">PAR7</p>
                    <p className="text-2xl font-bold text-amber-900">{Number(metrics?.par7Rate || 0).toFixed(2)}%</p>
                    <p className="mt-1 text-xs text-amber-800">{formatCOP(Number(metrics?.par7Amount || 0))}</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-orange-700">PAR30</p>
                    <p className="text-2xl font-bold text-orange-900">{Number(metrics?.par30Rate || 0).toFixed(2)}%</p>
                    <p className="mt-1 text-xs text-orange-800">{formatCOP(Number(metrics?.par30Amount || 0))}</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-red-700">NPL30</p>
                    <p className="text-2xl font-bold text-red-900">{Number(metrics?.npl30Rate || 0).toFixed(2)}%</p>
                    <p className="mt-1 text-xs text-red-800">{formatCOP(Number(metrics?.npl30Amount || 0))}</p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-1 lg:grid-cols-2 mb-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <PiggyBank className="w-4 h-4 text-slate-700" />
                        <h3 className="font-semibold text-slate-900">Ajustar tesoreria</h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[0.8fr_0.8fr_auto]">
                        <input
                            type="number"
                            value={treasuryAmount}
                            onChange={(event) => setTreasuryAmount(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600"
                        />
                        <select
                            value={treasuryType}
                            onChange={(event) => setTreasuryType(event.target.value as 'funding' | 'withdrawal' | 'adjustment')}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600"
                        >
                            <option value="funding">Fondear</option>
                            <option value="withdrawal">Retirar capital</option>
                            <option value="adjustment">Ajuste manual</option>
                        </select>
                        <Button onClick={adjustTreasury} isLoading={processingId === 'treasury'}>
                            Aplicar
                        </Button>
                    </div>
                    {settings && (
                        <p className="text-xs text-slate-500 mt-3">
                            Tasa actual {Number(settings.monthly_interest_rate_percent || 0).toFixed(2)}% mes · plazo max {settings.max_term_days} dias.
                        </p>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert className="w-4 h-4 text-slate-700" />
                        <h3 className="font-semibold text-slate-900">Resumen cartera</h3>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between"><span>Solicitudes</span><strong>{metrics?.requested || 0}</strong></div>
                        <div className="flex items-center justify-between"><span>Activos</span><strong>{metrics?.active || 0}</strong></div>
                        <div className="flex items-center justify-between"><span>En riesgo</span><strong>{metrics?.overdue || 0}</strong></div>
                        <div className="flex items-center justify-between"><span>Capital pendiente</span><strong>{formatCOP(Number(metrics?.outstandingPrincipal || 0))}</strong></div>
                        <div className="flex items-center justify-between"><span>Interes pendiente</span><strong>{formatCOP(Number(metrics?.outstandingInterest || 0))}</strong></div>
                        <div className="flex items-center justify-between"><span>Write-offs</span><strong>{formatCOP(Number(metrics?.writeOffAmount || 0))}</strong></div>
                    </div>
                </div>
            </div>

            {cohorts.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert className="w-4 h-4 text-slate-700" />
                        <h3 className="font-semibold text-slate-900">Cohortes de desembolso</h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {cohorts.slice(0, 4).map((cohort) => (
                            <div key={cohort.cohort_month} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                                <p className="text-xs uppercase tracking-wide text-slate-500">{cohort.cohort_month}</p>
                                <p className="mt-2 font-semibold text-slate-900">{cohort.disbursed_count} desembolsos</p>
                                <p className="mt-1">Desembolsado: {formatCOP(Number(cohort.principal_disbursed || 0))}</p>
                                <p>Outstanding: {formatCOP(Number(cohort.outstanding_amount || 0))}</p>
                                <p>PAR30: {formatCOP(Number(cohort.par30_amount || 0))}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="py-10 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
                    Cargando adelantos...
                </div>
            ) : advances.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    No hay adelantos registrados todavia.
                </div>
            ) : (
                <div className="space-y-4">
                    {advances.map((advance) => (
                        <div key={advance.id} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                            ['overdue', 'at_risk'].includes(advance.status)
                                                ? 'bg-red-100 text-red-700'
                                                : advance.status === 'requested'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {advance.status}
                                        </span>
                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                            advance.risk_band === 'critical'
                                                ? 'bg-red-100 text-red-700'
                                                : advance.risk_band === 'high'
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : advance.risk_band === 'medium'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                            {advance.risk_band}
                                        </span>
                                        <p className="font-semibold text-slate-900">{formatCOP(advance.principal_amount)}</p>
                                    </div>
                                    <p className="text-sm text-slate-700">
                                        {advance.trucker?.full_name || 'Sin nombre'} · {advance.origin_offer?.cargo_type || 'Viaje'}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {advance.origin_offer?.origin_city || 'Origen'} → {advance.origin_offer?.destination_city || 'Destino'}
                                    </p>
                                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                                        <span>Capital pendiente: {formatCOP(advance.principal_outstanding)}</span>
                                        <span>Interes pendiente: {formatCOP(advance.interest_outstanding)}</span>
                                        <span>Vence: {new Date(advance.due_at).toLocaleDateString('es-CO')}</span>
                                        <span>Aging: {advance.aging_bucket || 'current'}</span>
                                        <span>PAR30: {advance.par30 ? 'si' : 'no'}</span>
                                        <span>Holding: {advance.linked_holding_account_id ? advance.linked_holding_account_id.slice(0, 8) : 'sin link'}</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                        <span>Exp. trucker: {formatCOP(Number(advance.exposure_by_trucker || 0))}</span>
                                        <span>Exp. negocio: {formatCOP(Number(advance.exposure_by_business || 0))}</span>
                                        <span>Exp. holding: {formatCOP(Number(advance.exposure_by_holding || 0))}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {advance.status === 'requested' && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => processAdvance(advance.id, 'reject')}
                                                disabled={processingId === advance.id}
                                            >
                                                Rechazar
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => processAdvance(advance.id, 'approve')}
                                                disabled={processingId === advance.id}
                                            >
                                                Aprobar
                                            </Button>
                                        </>
                                    )}
                                    {['disbursed', 'overdue', 'at_risk', 'restructured'].includes(advance.status) && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => processAdvance(advance.id, 'mark_restructured')}
                                                disabled={processingId === advance.id}
                                            >
                                                Reestructurar
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => processAdvance(advance.id, 'write_off')}
                                                disabled={processingId === advance.id}
                                            >
                                                Castigar
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {['overdue', 'at_risk'].includes(advance.status) && (
                                <div className="flex items-start gap-2 mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                                    Este adelanto requiere seguimiento manual. El camionero queda bloqueado para nuevas solicitudes hasta resolverlo.
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
