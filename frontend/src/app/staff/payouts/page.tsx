'use client';

import * as React from 'react';
import { BadgeCheck, CheckCircle2, Clock, Eye, Loader2, RefreshCw, Search, Wallet, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { extractApiErrorMessage, unwrapApiEnvelope } from '@/lib/contracts/api';
import { formatCOP } from '@/constants/colombia';

type PayoutStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid' | 'failed' | 'cancelled';

interface DriverPayout {
    id: string;
    status: PayoutStatus;
    provider_status: string | null;
    value_earned_cop: number;
    platform_fee_cop: number;
    net_to_pay_cop: number;
    generated_at: string;
    paid_at: string | null;
    reference: string | null;
    failure_reason: string | null;
    destination: {
        method: string;
        provider: string;
        account_tail: string | null;
        holder: string | null;
    };
    driver: {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
    } | null;
    route: {
        id: string;
        business_id: string;
        origin_city: string;
        origin_department: string;
        destination_city: string;
        destination_department: string;
        cargo_description: string;
        status: string;
    } | null;
}

const STATUS_LABELS: Record<PayoutStatus | 'all', string> = {
    all: 'Todos',
    pending: 'Pendiente',
    under_review: 'Revision',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    paid: 'Pagado',
    failed: 'Fallido',
    cancelled: 'Cancelado',
};

const STATUS_STYLES: Record<PayoutStatus, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
    under_review: 'border-blue-200 bg-blue-50 text-blue-800',
    approved: 'border-zinc-200 bg-zinc-50 text-zinc-800',
    rejected: 'border-red-200 bg-red-50 text-red-800',
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    failed: 'border-red-200 bg-red-50 text-red-800',
    cancelled: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

function formatDate(value?: string | null) {
    if (!value) return 'n/a';
    return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default function AdminPayoutsPage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = React.useState(true);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<PayoutStatus | 'all'>('all');
    const [query, setQuery] = React.useState('');
    const [payouts, setPayouts] = React.useState<DriverPayout[]>([]);
    const [capabilities, setCapabilities] = React.useState<string[]>([]);

    const canReview = capabilities.includes('payout:review');
    const canApprove = capabilities.includes('payout:approve');
    const canMarkPaid = capabilities.includes('payout:mark_paid');

    React.useEffect(() => {
        let cancelled = false;

        const loadStaffAccess = async () => {
            if (!user || !['staff', 'admin'].includes(user.userType)) {
                setCapabilities([]);
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return;
                const response = await fetch('/api/staff/me', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                const payload = await response.json().catch(() => null);
                if (!cancelled && response.ok) {
                    setCapabilities(Array.isArray(payload?.data?.capabilities) ? payload.data.capabilities : []);
                }
            } catch {
                if (!cancelled) setCapabilities([]);
            }
        };

        void loadStaffAccess();

        return () => {
            cancelled = true;
        };
    }, [user]);

    const loadPayouts = React.useCallback(async () => {
        if (!user || !['staff', 'admin'].includes(user.userType)) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sesion no disponible');

            const params = new URLSearchParams();
            if (status !== 'all') params.set('status', status);

            const response = await fetch(`/api/staff/driver-payouts?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudieron cargar pagos'));
            setPayouts(unwrapApiEnvelope<DriverPayout[]>(payload) || []);
        } catch (error) {
            toast.error('Payouts', error instanceof Error ? error.message : 'No se pudieron cargar pagos');
        } finally {
            setLoading(false);
        }
    }, [status, user]);

    React.useEffect(() => {
        void loadPayouts();
    }, [loadPayouts]);

    const applyAction = async (payout: DriverPayout, action: 'approve' | 'reject' | 'cancel' | 'retry' | 'under_review' | 'mark_paid') => {
        const noteRequired = ['reject', 'cancel', 'under_review'].includes(action);
        const note = noteRequired ? window.prompt('Motivo u observacion interna') : window.prompt('Observacion interna opcional') || '';
        if (noteRequired && !note) return;

        let reference = '';
        if (action === 'mark_paid') {
            reference = window.prompt('Referencia de pago obligatoria') || '';
            if (!reference.trim()) {
                toast.error('Payouts', 'La referencia de pago es obligatoria');
                return;
            }
        }

        if (!window.confirm(`Confirmar accion: ${action}`)) return;

        setProcessingId(payout.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sesion no disponible');

            const response = await fetch(`/api/staff/driver-payouts/${payout.id}/action`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action,
                    note,
                    reference,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudo aplicar la accion'));
            toast.success('Payouts', 'Pago actualizado');
            await loadPayouts();
        } catch (error) {
            toast.error('Payouts', error instanceof Error ? error.message : 'No se pudo aplicar la accion');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredPayouts = payouts.filter((payout) => {
        const haystack = [
            payout.id,
            payout.driver?.full_name,
            payout.driver?.email,
            payout.route?.cargo_description,
            payout.route?.origin_city,
            payout.route?.destination_city,
            payout.reference,
        ].filter(Boolean).join(' ').toLowerCase();

        return !query.trim() || haystack.includes(query.trim().toLowerCase());
    });

    if (!user || !['staff', 'admin'].includes(user.userType)) {
        return (
            <DashboardLayout pageTitle="Pagos a drivers">
                <div className="rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
                    Necesitas una cuenta staff autorizada de KargaX para abrir esta vista.
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Pagos a drivers">
            <div className="space-y-6">
                <section className="rounded-lg border border-zinc-200 bg-white p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Operacion interna</p>
                            <h1 className="mt-1 text-2xl font-semibold text-zinc-950">Pagos a drivers</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                                Revisa solicitudes, aprueba, rechaza y marca pagos manuales con referencia. Los pagos reales siguen bloqueados por los gates de provider y ENV.
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => void loadPayouts()} disabled={loading}>
                            <RefreshCw className="h-4 w-4" />
                            Actualizar
                        </Button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-[220px_1fr]">
                        <label className="text-sm font-medium text-zinc-700">
                            Estado
                            <select
                                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                value={status}
                                onChange={(event) => setStatus(event.target.value as PayoutStatus | 'all')}
                            >
                                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm font-medium text-zinc-700">
                            Buscar
                            <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3">
                                <Search className="h-4 w-4 text-zinc-500" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                                    placeholder="Driver, ruta, correo o referencia"
                                />
                            </span>
                        </label>
                    </div>
                </section>

                <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    {loading ? (
                        <div className="flex items-center justify-center gap-3 p-10 text-sm text-zinc-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando pagos
                        </div>
                    ) : filteredPayouts.length === 0 ? (
                        <div className="p-10 text-center text-sm text-zinc-500">No hay pagos con estos filtros.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-left text-sm">
                                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                                    <tr>
                                        <th className="px-4 py-3">Driver</th>
                                        <th className="px-4 py-3">Ruta</th>
                                        <th className="px-4 py-3">Neto</th>
                                        <th className="px-4 py-3">Metodo</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {filteredPayouts.map((payout) => (
                                        <tr key={payout.id} className="align-top">
                                            <td className="px-4 py-4">
                                                <div className="font-medium text-zinc-950">{payout.driver?.full_name || 'Driver sin perfil'}</div>
                                                <div className="mt-1 text-xs text-zinc-500">{payout.driver?.email || payout.driver?.id || 'n/a'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="font-medium text-zinc-950">{payout.route?.cargo_description || 'Retiro wallet'}</div>
                                                <div className="mt-1 text-xs text-zinc-500">
                                                    {payout.route ? `${payout.route.origin_city} -> ${payout.route.destination_city}` : payout.id.slice(0, 8)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="font-semibold text-zinc-950">{formatCOP(payout.net_to_pay_cop)}</div>
                                                <div className="mt-1 text-xs text-zinc-500">Fee: {formatCOP(payout.platform_fee_cop || 0)}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700">
                                                    <Wallet className="h-3.5 w-3.5" />
                                                    {payout.destination.provider}/{payout.destination.method}
                                                </div>
                                                <div className="mt-1 text-xs text-zinc-500">{payout.destination.account_tail || 'Destino no visible'}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[payout.status]}`}>
                                                    {STATUS_LABELS[payout.status]}
                                                </span>
                                                {payout.failure_reason ? <div className="mt-1 max-w-[220px] text-xs text-red-600">{String(payout.failure_reason)}</div> : null}
                                            </td>
                                            <td className="px-4 py-4 text-xs text-zinc-500">
                                                <div>{formatDate(payout.generated_at)}</div>
                                                {payout.paid_at ? <div>Pagado: {formatDate(payout.paid_at)}</div> : null}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {payout.status === 'pending' && canApprove ? (
                                                        <>
                                                            <Button size="sm" onClick={() => void applyAction(payout, 'approve')} disabled={processingId === payout.id}>
                                                                <CheckCircle2 className="h-4 w-4" />
                                                                Aprobar
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => void applyAction(payout, 'reject')} disabled={processingId === payout.id}>
                                                                <XCircle className="h-4 w-4" />
                                                                Rechazar
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                    {['approved', 'under_review', 'failed'].includes(payout.status) && canMarkPaid ? (
                                                        <Button size="sm" onClick={() => void applyAction(payout, 'mark_paid')} disabled={processingId === payout.id}>
                                                            <BadgeCheck className="h-4 w-4" />
                                                            Marcar pagado
                                                        </Button>
                                                    ) : null}
                                                    {payout.status === 'failed' && canReview ? (
                                                        <Button size="sm" variant="outline" onClick={() => void applyAction(payout, 'retry')} disabled={processingId === payout.id}>
                                                            <RefreshCw className="h-4 w-4" />
                                                            Reintentar
                                                        </Button>
                                                    ) : null}
                                                    {payout.status === 'approved' && canReview ? (
                                                        <Button size="sm" variant="outline" onClick={() => void applyAction(payout, 'under_review')} disabled={processingId === payout.id}>
                                                            <Clock className="h-4 w-4" />
                                                            Revisar
                                                        </Button>
                                                    ) : null}
                                                    <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(payout.id)}>
                                                        <Eye className="h-4 w-4" />
                                                        ID
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </DashboardLayout>
    );
}
