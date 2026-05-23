'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Clock3, Coins, Send, WalletCards } from 'lucide-react';
import { Button, toast } from '@/components/ui';
import { formatCOP } from '@/constants/colombia';
import { supabase } from '@/lib/supabase/client';
import type { AdvanceSummary, EligibleAdvanceOffer, FuelAdvanceListItem, LendingSettingsSnapshot } from '@/lib/advances/types';

interface AdvancesSectionProps {
    summary: AdvanceSummary | null;
    eligibleOffers: EligibleAdvanceOffer[];
    activeAdvances: FuelAdvanceListItem[];
    overdueAdvances: FuelAdvanceListItem[];
    settings: LendingSettingsSnapshot | null;
    onAdvanceRequested: () => Promise<void>;
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
    });
}

export function AdvancesSection({
    summary,
    eligibleOffers,
    activeAdvances,
    overdueAdvances,
    settings,
    onAdvanceRequested,
}: AdvancesSectionProps) {
    const searchParams = useSearchParams();
    const policySignals = React.useMemo(
        () => eligibleOffers.filter((item) => !item.eligible || item.decision !== 'approved'),
        [eligibleOffers]
    );
    const eligibleOnly = React.useMemo(
        () => eligibleOffers.filter((item) => item.eligible && item.max_advance_amount > 0),
        [eligibleOffers]
    );
    const [selectedOfferId, setSelectedOfferId] = React.useState(eligibleOnly[0]?.offer_id || '');
    const [requestedAmount, setRequestedAmount] = React.useState('');
    const [requesting, setRequesting] = React.useState(false);

    React.useEffect(() => {
        const requestedOfferId = searchParams?.get('advanceOfferId');

        if (requestedOfferId && eligibleOnly.some((item) => item.offer_id === requestedOfferId)) {
            setSelectedOfferId(requestedOfferId);
            return;
        }

        if (!selectedOfferId && eligibleOnly[0]?.offer_id) {
            setSelectedOfferId(eligibleOnly[0].offer_id);
        }
    }, [eligibleOnly, searchParams, selectedOfferId]);

    const selectedOffer = eligibleOnly.find((item) => item.offer_id === selectedOfferId) || eligibleOnly[0] || null;

    React.useEffect(() => {
        if (selectedOffer) {
            setRequestedAmount(String(Math.floor(selectedOffer.max_advance_amount)));
        }
    }, [selectedOffer?.offer_id]);

    const handleSubmit = async () => {
        if (!selectedOffer) {
            toast.error('Sin oferta elegible', 'No tienes una oferta reservada disponible para adelanto.');
            return;
        }

        const amount = Number(requestedAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Monto invalido', 'Ingresa un monto valido para el adelanto.');
            return;
        }

        if (amount > Number(selectedOffer.max_advance_amount || 0)) {
            toast.error('Monto excedido', 'El monto supera tu cupo para esa oferta.');
            return;
        }

        try {
            setRequesting(true);
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('Sesion no disponible');
            }

            const response = await fetch('/api/advances', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    originOfferId: selectedOffer.offer_id,
                    amount,
                    termDays: settings?.max_term_days || selectedOffer.max_term_days || 30,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'No se pudo solicitar el adelanto');
            }

            toast.success('Solicitud enviada', 'Tu adelanto quedo en revision administrativa.');
            await onAdvanceRequested();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo solicitar el adelanto');
        } finally {
            setRequesting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                    <div>
                        <div className="flex items-center gap-2 text-slate-900 mb-1">
                            <WalletCards className="w-5 h-5 text-green-600" />
                            <h3 className="text-lg font-semibold">KargaX Adelanto</h3>
                        </div>
                        <p className="text-sm text-slate-500">
                            Capital de trabajo corto sobre viajes reservados. El cobro se descuenta desde tus viajes.
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Cupo maximo visible</p>
                        <p className="text-2xl font-bold text-slate-900">{formatCOP(summary?.maxEligibleAmount || 0)}</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4 mb-5">
                    <div className="rounded-xl bg-green-50 border border-green-100 p-4">
                        <p className="text-xs uppercase tracking-wide text-green-800">Ofertas elegibles</p>
                        <p className="text-xl font-semibold text-orange-900">{summary?.eligibleOffersCount || 0}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-700">Tasa mensual</p>
                        <p className="text-xl font-semibold text-blue-900">
                            {Number(summary?.monthlyInterestRatePercent || settings?.monthly_interest_rate_percent || 0).toFixed(2)}%
                        </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                        <p className="text-xs uppercase tracking-wide text-emerald-700">Plazo maximo</p>
                        <p className="text-xl font-semibold text-emerald-900">{summary?.maxTermDays || settings?.max_term_days || 30} dias</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Saldo pendiente</p>
                        <p className="text-xl font-semibold text-slate-900">{formatCOP(summary?.totalOutstanding || 0)}</p>
                    </div>
                </div>

                {overdueAdvances.length > 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 mb-5">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                            <p className="font-medium text-red-900">Tienes adelantos en seguimiento</p>
                            <p className="text-sm text-red-700">
                                Mientras exista mora o riesgo, no podras pedir nuevos adelantos ni retirar fondos sin barrido previo.
                            </p>
                        </div>
                    </div>
                )}

                {eligibleOnly.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_auto]">
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Oferta reservada</span>
                                <select
                                    value={selectedOfferId}
                                    onChange={(event) => setSelectedOfferId(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600"
                                >
                                    {eligibleOnly.map((offer) => (
                                        <option key={offer.offer_id} value={offer.offer_id}>
                                            {offer.cargo_type} · {offer.origin_city} → {offer.destination_city}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Monto solicitado</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={selectedOffer?.max_advance_amount || undefined}
                                    value={requestedAmount}
                                    onChange={(event) => setRequestedAmount(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600"
                                />
                                {selectedOffer && (
                                    <p className="text-xs text-slate-500">
                                        Maximo para esta oferta: {formatCOP(selectedOffer.max_advance_amount)}
                                    </p>
                                )}
                            </label>

                            <div className="flex items-end">
                                <Button onClick={handleSubmit} isLoading={requesting} className="w-full md:w-auto">
                                    <Send className="w-4 h-4" />
                                    Solicitar
                                </Button>
                            </div>
                        </div>

                        {selectedOffer ? (
                            <div className="mt-4 grid gap-3 md:grid-cols-4">
                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Decision</p>
                                    <p className="mt-1 font-semibold text-slate-900">{selectedOffer.decision}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Riesgo</p>
                                    <p className="mt-1 font-semibold text-slate-900">{selectedOffer.risk_band}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Exp. negocio</p>
                                    <p className="mt-1 font-semibold text-slate-900">{formatCOP(selectedOffer.exposure_by_business)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Deployment</p>
                                    <p className="mt-1 font-semibold text-slate-900">{Number(selectedOffer.portfolio_deployment_percent || 0).toFixed(2)}%</p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        No hay viajes reservados elegibles en este momento. Configura tu metodo de retiro y espera a que se confirme un pago.
                    </div>
                )}

                {policySignals.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">Lectura de politica y riesgo</p>
                        <div className="mt-3 space-y-3">
                            {policySignals.slice(0, 3).map((offer) => (
                                <div key={offer.offer_id} className="rounded-xl border border-amber-200 bg-white/80 p-3 text-sm text-amber-900">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold">{offer.cargo_type}</span>
                                        <span>{offer.origin_city} → {offer.destination_city}</span>
                                    </div>
                                    <p className="mt-1">
                                        Decision {offer.decision} | Riesgo {offer.risk_band} | Motivo {offer.reason || 'revision manual'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Coins className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Adelantos activos</h3>
                </div>

                {activeAdvances.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        Aun no tienes adelantos activos. Cuando se apruebe uno, aqui veras saldo pendiente, vencimiento y repagos.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activeAdvances.map((advance) => (
                            <div key={advance.id} className="rounded-xl border border-slate-200 p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <p className="font-semibold text-slate-900">
                                            {formatCOP(Number(advance.principal_outstanding || 0) + Number(advance.interest_outstanding || 0))}
                                        </p>
                                        <p className="text-sm text-slate-600">
                                            {advance.origin_offer?.cargo_type || 'Viaje'} · {advance.origin_offer?.origin_city || 'Origen'} → {advance.origin_offer?.destination_city || 'Destino'}
                                        </p>
                                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                                            <span>Capital pendiente: {formatCOP(advance.principal_outstanding)}</span>
                                            <span>Interes pendiente: {formatCOP(advance.interest_outstanding)}</span>
                                            <span>Tasa: {Number(advance.monthly_interest_rate_percent || 0).toFixed(2)}% mes</span>
                                            <span>Waterfall: interes {'->'} principal</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                            ['overdue', 'at_risk'].includes(advance.status)
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {advance.status}
                                        </span>
                                        <p className="mt-2 flex items-center justify-end gap-1 text-xs text-slate-500">
                                            <Clock3 className="w-3.5 h-3.5" />
                                            Vence {formatDate(advance.due_at)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Aging {advance.aging_bucket || 'current'} | Riesgo {advance.risk_band}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <p className="text-xs text-slate-400">
                            Los repagos aparecen automaticamente en tus movimientos de billetera como capital e intereses.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
