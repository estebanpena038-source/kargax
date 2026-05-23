'use client';

import * as React from 'react';
import {
    AlertTriangle,
    ArrowUpRight,
    Banknote,
    Bell,
    CheckCircle2,
    ClipboardList,
    CreditCard,
    Headphones,
    LifeBuoy,
    Loader2,
    RefreshCw,
    Shield,
    Truck,
    Wallet,
    Warehouse,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { formatCOP } from '@/constants/colombia';
import { extractApiErrorMessage, unwrapApiEnvelope } from '@/lib/contracts/api';
import type {
    AdminOverviewResponse,
    PlatformIncident,
    RiskRegisterItem,
    RunbookSummary,
    SupportRequest,
} from '@/lib/platform/types';

interface AdminNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    processed: boolean;
    data?: Record<string, unknown>;
    created_at: string;
}

interface WithdrawalItem {
    id: string;
    status: string;
    requested_amount: number;
    created_at: string;
    description: string;
    reference_id?: string | null;
    balance_before?: number;
    balance_after?: number;
    pending_balance_before?: number;
    pending_balance_after?: number;
    source_kind?: string;
    source_reference?: string;
    withdrawal_snapshot?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    trucker: {
        id: string;
        fullName: string;
        email: string;
        phone: string | null;
    } | null;
    wallet?: {
        available_balance: number;
        total_withdrawn: number;
    } | null;
}

type HealthLabel = 'OK' | 'Atencion' | 'Bloqueado';

const SEVERITY_WEIGHT: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

const STATUS_WEIGHT: Record<string, number> = {
    open: 0,
    investigating: 1,
    resolved: 2,
    closed: 3,
};

function formatNumber(value: number) {
    return new Intl.NumberFormat('es-CO', {
        maximumFractionDigits: 0,
    }).format(value || 0);
}

function formatDateTime(value?: string | null) {
    if (!value) return 'n/a';

    return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function getHealthLabel(status?: string | null): HealthLabel {
    const normalized = String(status || '').toLowerCase();

    if (['blocked', 'critical', 'error'].includes(normalized)) {
        return 'Bloqueado';
    }

    if ([
        'warning',
        'partial',
        'needs_evidence',
        'pending_manual',
        'pending',
        'manual_review',
        'open',
        'investigating',
        'queued',
        'high',
        'medium',
    ].includes(normalized)) {
        return 'Atencion';
    }

    return 'OK';
}

function getDomainHealth(critical: number, open: number, queue: number): HealthLabel {
    if (critical > 0) return 'Bloqueado';
    if (open > 0 || queue > 0) return 'Atencion';
    return 'OK';
}

function sortIncidents(incidents: PlatformIncident[]) {
    return [...incidents].sort((a, b) => {
        const severityDelta = (SEVERITY_WEIGHT[a.severity] ?? 9) - (SEVERITY_WEIGHT[b.severity] ?? 9);
        if (severityDelta !== 0) return severityDelta;

        const statusDelta = (STATUS_WEIGHT[a.status] ?? 9) - (STATUS_WEIGHT[b.status] ?? 9);
        if (statusDelta !== 0) return statusDelta;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

function getRiskDecision(risk: RiskRegisterItem) {
    if (risk.blocker && risk.status !== 'mitigated') {
        return 'Decision: owner, fecha y evidencia antes de avanzar.';
    }

    if (risk.status === 'partial') {
        return 'Decision: cerrar mitigacion o declarar bloqueo.';
    }

    if (risk.status === 'mitigated') {
        return 'Decision: conservar monitoreo y prueba mensual.';
    }

    return 'Decision: revisar senal temprana y abrir responsable.';
}

function StatusPill({ label, detail }: { label: HealthLabel | string; detail?: string }) {
    return (
        <span className="inline-flex max-w-full shrink-0 items-center gap-2 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-zinc-950 sm:px-3 sm:text-xs">
            {label}
            {detail ? <span className="min-w-0 truncate font-normal normal-case tracking-normal text-zinc-500">{detail}</span> : null}
        </span>
    );
}

function SectionHeader({
    eyebrow,
    title,
    detail,
    action,
}: {
    eyebrow?: string;
    title: string;
    detail?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-3 border-b border-zinc-200 pb-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
                {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{eyebrow}</p> : null}
                <h2 className="mt-1 text-base font-semibold text-zinc-950 sm:text-lg">{title}</h2>
                {detail ? <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">{detail}</p> : null}
            </div>
            {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
        </div>
    );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
    return (
        <div className="py-10 text-center text-sm text-zinc-500">
            {children}
        </div>
    );
}

function LoadingLine({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
            {children}
        </div>
    );
}

function ActionInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
        />
    );
}

export default function AdminPage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = React.useState(true);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [withdrawals, setWithdrawals] = React.useState<WithdrawalItem[]>([]);
    const [notifications, setNotifications] = React.useState<AdminNotification[]>([]);
    const [overview, setOverview] = React.useState<AdminOverviewResponse | null>(null);
    const [incidentFilter, setIncidentFilter] = React.useState<'all' | 'open' | 'resolved'>('open');
    const [paymentId, setPaymentId] = React.useState('');
    const [offerIdForPayment, setOfferIdForPayment] = React.useState('');
    const [offerIdForPins, setOfferIdForPins] = React.useState('');

    const loadAdminData = React.useCallback(async () => {
        if (!user) {
            setLoading(true);
            return;
        }

        if (user.userType !== 'admin') {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Sesion no disponible');
            }

            const headers = {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            };

            const [withdrawalsResponse, notificationsResponse, overviewResponse] = await Promise.all([
                fetch('/api/admin/withdrawals', { headers }),
                fetch('/api/admin/notifications', { headers }),
                fetch('/api/admin/overview', { headers }),
            ]);

            const withdrawalsData = await withdrawalsResponse.json();
            const notificationsData = await notificationsResponse.json();
            const overviewData = await overviewResponse.json();

            if (!withdrawalsResponse.ok) {
                throw new Error(withdrawalsData.error || 'No se pudo cargar retiros');
            }

            if (!notificationsResponse.ok) {
                throw new Error(notificationsData.error || 'No se pudieron cargar notificaciones');
            }

            if (!overviewResponse.ok) {
                throw new Error(extractApiErrorMessage(overviewData, 'No se pudo cargar el control tower'));
            }

            setWithdrawals(withdrawalsData.data || []);
            setNotifications(notificationsData.data || []);
            setOverview(unwrapApiEnvelope<AdminOverviewResponse>(overviewData) || overviewData.data || overviewData);
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo cargar admin');
        } finally {
            setLoading(false);
        }
    }, [user]);

    React.useEffect(() => {
        loadAdminData();
    }, [loadAdminData]);

    const withAdminHeaders = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error('Sesion no disponible');
        }

        return {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        };
    };

    const processWithdrawal = async (id: string, action: 'approve' | 'reject') => {
        try {
            setProcessingId(id);
            const headers = await withAdminHeaders();
            const response = await fetch(`/api/admin/withdrawals/${id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ action }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(extractApiErrorMessage(result, 'No se pudo procesar el retiro'));
            }

            toast.success(
                action === 'approve' ? 'Retiro aprobado' : 'Retiro rechazado',
                'La cola administrativa se actualizo correctamente'
            );
            await loadAdminData();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo procesar el retiro');
        } finally {
            setProcessingId(null);
        }
    };

    const updateNotification = async (id: string, payload: { read?: boolean; processed?: boolean }) => {
        try {
            setProcessingId(id);
            const headers = await withAdminHeaders();
            const response = await fetch(`/api/admin/notifications/${id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(extractApiErrorMessage(result, 'No se pudo actualizar la notificacion'));
            }

            await loadAdminData();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo actualizar la notificacion');
        } finally {
            setProcessingId(null);
        }
    };

    const replayIncident = async (incidentId: string) => {
        try {
            setProcessingId(`incident-${incidentId}`);
            const headers = await withAdminHeaders();
            const response = await fetch(`/api/admin/incidents/${incidentId}/replay`, {
                method: 'POST',
                headers,
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(extractApiErrorMessage(payload, 'No se pudo ejecutar el replay'));
            }

            toast.success('Replay ejecutado', 'El incidente se reproceso con la accion segura configurada.');
            await loadAdminData();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo ejecutar el replay');
        } finally {
            setProcessingId(null);
        }
    };

    const resendPins = async () => {
        if (!offerIdForPins) {
            toast.error('Oferta requerida', 'Ingresa el ID de la oferta');
            return;
        }

        try {
            setProcessingId('pins');
            const headers = await withAdminHeaders();
            const response = await fetch('/api/admin/pins/resend', {
                method: 'POST',
                headers,
                body: JSON.stringify({ offerId: offerIdForPins }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(extractApiErrorMessage(result, 'No se pudo reenviar el PIN'));
            }

            toast.success('PIN reenviado', 'Se ejecuto el reenvio de notificaciones');
            setOfferIdForPins('');
            await loadAdminData();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo reenviar el PIN');
        } finally {
            setProcessingId(null);
        }
    };

    const reconcilePayment = async () => {
        if (!paymentId && !offerIdForPayment) {
            toast.error('Dato requerido', 'Ingresa paymentId u offerId');
            return;
        }

        try {
            setProcessingId('reconcile');
            const headers = await withAdminHeaders();
            const response = await fetch('/api/admin/payments/reconcile', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    paymentId: paymentId || undefined,
                    offerId: offerIdForPayment || undefined,
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(extractApiErrorMessage(payload, 'No se pudo reconciliar el pago'));
            }

            const result = unwrapApiEnvelope<{ alreadyReconciled?: boolean }>(payload);

            toast.success('Pago conciliado', result?.alreadyReconciled ? 'El pago ya estaba conciliado' : 'La conciliacion se ejecuto');
            setPaymentId('');
            setOfferIdForPayment('');
            await loadAdminData();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo reconciliar el pago');
        } finally {
            setProcessingId(null);
        }
    };

    if (user && user.userType !== 'admin') {
        return (
            <DashboardLayout pageTitle="Admin">
                <div className="mx-auto max-w-2xl rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
                    <Shield className="mx-auto mb-4 h-10 w-10 text-zinc-950" />
                    <h1 className="text-xl font-semibold text-zinc-950">Acceso restringido</h1>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">Este panel solo esta disponible para administradores.</p>
                </div>
            </DashboardLayout>
        );
    }

    const incidents = overview?.incidents || [];
    const visibleIncidents = sortIncidents(incidents.filter((incident) => {
        if (incidentFilter === 'all') {
            return true;
        }

        if (incidentFilter === 'open') {
            return ['open', 'investigating'].includes(incident.status);
        }

        return ['resolved', 'closed'].includes(incident.status);
    }));
    const openIncidents = sortIncidents(incidents.filter((incident) => ['open', 'investigating'].includes(incident.status)));
    const criticalIncidents = openIncidents.filter((incident) => ['critical', 'high'].includes(incident.severity));
    const supportBacklog = (overview?.support_requests || []).filter((request) =>
        ['open', 'investigating', 'waiting_customer'].includes(request.status)
    );
    const topBlockers = overview?.risk_summary.top_blockers || [];
    const readinessItems = [...(overview?.launch_readiness.items || [])].sort((a, b) => {
        if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
        return getHealthLabel(b.status).localeCompare(getHealthLabel(a.status));
    });
    const launchHealth = getHealthLabel(overview?.launch_readiness.status || 'warning');
    const launchDecision = launchHealth === 'Bloqueado'
        ? 'No lanzar hasta cerrar bloqueadores.'
        : launchHealth === 'Atencion'
            ? 'Lanzar solo con owner y evidencia del riesgo.'
            : 'Listo para operar con monitoreo activo.';
    const domainByKey = new Map((overview?.domains || []).map((domain) => [domain.key, domain]));
    const tripsQueue = Number(overview?.ceo_control_tower?.operations.offers_in_progress || 0)
        + Number(overview?.ceo_control_tower?.operations.offers_assigned || 0);
    const tripIncidents = incidents.filter((incident) => incident.domain === 'market' && ['open', 'investigating'].includes(incident.status));
    const requiredDomains = [
        {
            key: 'payments',
            title: 'Pagos',
            detail: 'Webhook, seleccion de pago y conciliacion.',
            icon: Banknote,
            incidentsOpen: domainByKey.get('payments')?.incidents_open || 0,
            incidentsCritical: domainByKey.get('payments')?.incidents_critical || 0,
            queueOpen: domainByKey.get('payments')?.queue_open || 0,
            queueLabel: 'casos',
        },
        {
            key: 'wallet',
            title: 'Wallet',
            detail: 'Retiros, saldos y timeline financiero.',
            icon: Wallet,
            incidentsOpen: domainByKey.get('wallet')?.incidents_open || 0,
            incidentsCritical: domainByKey.get('wallet')?.incidents_critical || 0,
            queueOpen: overview?.summary.pending_withdrawals || 0,
            queueLabel: 'retiros',
        },
        {
            key: 'trips',
            title: 'Trips',
            detail: 'Viajes asignados, en curso y evidencia.',
            icon: Truck,
            incidentsOpen: tripIncidents.length,
            incidentsCritical: tripIncidents.filter((incident) => incident.severity === 'critical').length,
            queueOpen: tripsQueue,
            queueLabel: 'en movimiento',
        },
        {
            key: 'support',
            title: 'Soporte',
            detail: 'Casos abiertos y SLA de cliente.',
            icon: Headphones,
            incidentsOpen: domainByKey.get('support')?.incidents_open || 0,
            incidentsCritical: domainByKey.get('support')?.incidents_critical || 0,
            queueOpen: supportBacklog.length,
            queueLabel: 'casos',
        },
        {
            key: 'warehouse',
            title: 'Bodegas',
            detail: 'Recepcion, picking, muelles y despachos.',
            icon: Warehouse,
            incidentsOpen: domainByKey.get('warehouse')?.incidents_open || 0,
            incidentsCritical: domainByKey.get('warehouse')?.incidents_critical || 0,
            queueOpen: 0,
            queueLabel: 'cola',
        },
    ];
    const topOperationalRisks: Array<
        | { type: 'incident'; key: string; title: string; detail: string; label: string; decision: string }
        | { type: 'risk'; key: string; title: string; detail: string; label: string; decision: string }
    > = [
            ...criticalIncidents.slice(0, 3).map((incident) => ({
                type: 'incident' as const,
                key: incident.id,
                title: incident.title,
                detail: `${incident.domain} / runbook ${incident.runbook_key}`,
                label: getHealthLabel(incident.severity),
                decision: incident.replayable ? 'Decision: ejecutar replay seguro o escalar owner.' : 'Decision: abrir runbook y asignar responsable.',
            })),
            ...topBlockers.slice(0, 4).map((risk) => ({
                type: 'risk' as const,
                key: risk.key,
                title: risk.risk,
                detail: `${risk.owner} / ${risk.early_signal}`,
                label: getHealthLabel(risk.status),
                decision: getRiskDecision(risk),
            })),
        ].slice(0, 5);

    return (
        <DashboardLayout pageTitle="Operaciones KargaX">
            <div className="mx-auto w-full max-w-[118rem] space-y-5 sm:space-y-6 xl:space-y-7">
                <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Admin interno</p>
                        <h1 className="mt-2 text-[clamp(1.75rem,7vw,2.35rem)] font-semibold leading-tight tracking-normal text-zinc-950">Operaciones KargaX</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                            Incidentes, pagos, wallet, soporte, bodegas y readiness ordenados por impacto real.
                        </p>
                    </div>
                    <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <p className="text-xs text-zinc-500">
                            {overview ? `Actualizado ${formatDateTime(overview.generated_at)}` : 'Esperando datos'}
                        </p>
                        <Button variant="outline" onClick={loadAdminData} disabled={loading} className="w-full sm:w-auto">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </Button>
                    </div>
                </div>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
                    <div className="luxury-panel rounded-lg p-4 text-white shadow-[0_26px_70px_-46px_rgba(10,10,10,.9)] min-[380px]:p-5 sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5 text-white/70" />
                                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Launch readiness</p>
                            </div>
                            <span className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                {launchHealth}
                            </span>
                        </div>
                        <p className="mt-5 max-w-3xl text-[clamp(1.55rem,7vw,2.35rem)] font-semibold leading-tight sm:mt-6">
                            {launchDecision}
                        </p>
                        <div className="mt-6 grid gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">
                            <div className="border-t border-white/15 pt-3">
                                <p className="text-xs uppercase tracking-wide text-white/45">Incidentes</p>
                                <p className="mt-1 text-2xl font-semibold">{formatNumber(overview?.summary.incident_backlog || 0)}</p>
                            </div>
                            <div className="border-t border-white/15 pt-3">
                                <p className="text-xs uppercase tracking-wide text-white/45">Soporte</p>
                                <p className="mt-1 text-2xl font-semibold">{formatNumber(overview?.summary.support_backlog || 0)}</p>
                            </div>
                            <div className="border-t border-white/15 pt-3">
                                <p className="text-xs uppercase tracking-wide text-white/45">Retiros</p>
                                <p className="mt-1 text-2xl font-semibold">{formatNumber(overview?.summary.pending_withdrawals || 0)}</p>
                            </div>
                            <div className="border-t border-white/15 pt-3">
                                <p className="text-xs uppercase tracking-wide text-white/45">Aprobaciones</p>
                                <p className="mt-1 text-2xl font-semibold">{formatNumber(overview?.summary.approvals_breached || 0)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Riesgos arriba</p>
                                <h2 className="mt-1 text-lg font-semibold text-zinc-950">Lo que decide el dia</h2>
                            </div>
                            <AlertTriangle className="h-5 w-5 text-zinc-950" />
                        </div>
                        <div className="divide-y divide-zinc-200">
                            {loading ? (
                                <LoadingLine>Cargando riesgos...</LoadingLine>
                            ) : topOperationalRisks.length === 0 ? (
                                <EmptyLine>No hay riesgos criticos abiertos.</EmptyLine>
                            ) : (
                                topOperationalRisks.map((item) => (
                                    <div key={`${item.type}-${item.key}`} className="py-4">
                                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-zinc-950">{item.title}</p>
                                                <p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p>
                                            </div>
                                            <StatusPill label={item.label} />
                                        </div>
                                        <p className="mt-2 text-xs font-medium text-zinc-700">{item.decision}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                    {requiredDomains.map((domain) => {
                        const Icon = domain.icon;
                        const label = getDomainHealth(domain.incidentsCritical, domain.incidentsOpen, domain.queueOpen);

                        return (
                            <div key={domain.key} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50">
                                        <Icon className="h-5 w-5 text-zinc-950" />
                                    </div>
                                    <StatusPill label={label} />
                                </div>
                                <h3 className="mt-4 text-base font-semibold text-zinc-950">{domain.title}</h3>
                                <p className="mt-1 min-h-10 text-sm leading-5 text-zinc-600">{domain.detail}</p>
                                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4">
                                    <div>
                                        <p className="text-xs text-zinc-500">Incidentes</p>
                                        <p className="mt-1 text-xl font-semibold text-zinc-950">{formatNumber(domain.incidentsOpen)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500">{domain.queueLabel}</p>
                                        <p className="mt-1 text-xl font-semibold text-zinc-950">{formatNumber(domain.queueOpen)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </section>

                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                    <SectionHeader
                        eyebrow="Readiness"
                        title="Checklist operativo antes de produccion"
                        detail="Los bloqueos suben primero. La salud se lee por label, no por color."
                        action={<StatusPill label={launchHealth} />}
                    />
                    {loading ? (
                        <LoadingLine>Cargando readiness...</LoadingLine>
                    ) : readinessItems.length === 0 ? (
                        <EmptyLine>No hay items de readiness.</EmptyLine>
                    ) : (
                        <>
                            <div className="mt-4 grid gap-3 md:hidden">
                                {readinessItems.map((item) => (
                                    <article key={item.key} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-zinc-950">{item.title}</p>
                                                <p className="mt-1 text-sm leading-6 text-zinc-600">{item.detail}</p>
                                            </div>
                                            <StatusPill label={getHealthLabel(item.status)} />
                                        </div>
                                        <dl className="mt-4 grid gap-3 text-xs text-zinc-600 min-[460px]:grid-cols-2">
                                            <div>
                                                <dt className="font-semibold uppercase tracking-wide text-zinc-500">Fuente</dt>
                                                <dd className="mt-1">{item.source}</dd>
                                            </div>
                                            <div>
                                                <dt className="font-semibold uppercase tracking-wide text-zinc-500">Bloquea</dt>
                                                <dd className="mt-1 font-medium text-zinc-950">{item.blocking ? 'Si' : 'No'}</dd>
                                            </div>
                                            <div className="min-[460px]:col-span-2">
                                                <dt className="font-semibold uppercase tracking-wide text-zinc-500">Evidencia</dt>
                                                <dd className="mt-1 break-all">{item.evidence_path || 'manual'}</dd>
                                            </div>
                                        </dl>
                                    </article>
                                ))}
                            </div>
                            <div className="mt-4 hidden overflow-x-auto md:block">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                                    <tr>
                                        <th className="py-3 pr-4 font-semibold">Item</th>
                                        <th className="px-4 py-3 font-semibold">Estado</th>
                                        <th className="px-4 py-3 font-semibold">Fuente</th>
                                        <th className="px-4 py-3 font-semibold">Bloquea</th>
                                        <th className="py-3 pl-4 font-semibold">Evidencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200">
                                    {readinessItems.map((item) => (
                                        <tr key={item.key} className="align-top">
                                            <td className="py-4 pr-4">
                                                <p className="font-semibold text-zinc-950">{item.title}</p>
                                                <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">{item.detail}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <StatusPill label={getHealthLabel(item.status)} detail={item.status} />
                                            </td>
                                            <td className="px-4 py-4 text-zinc-600">{item.source}</td>
                                            <td className="px-4 py-4 font-medium text-zinc-950">{item.blocking ? 'Si' : 'No'}</td>
                                            <td className="py-4 pl-4 text-xs leading-5 text-zinc-500">{item.evidence_path || 'manual'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </>
                    )}
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] xl:gap-6">
                    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Incidentes"
                            title="Platform incidents"
                            detail="Ordenados por severidad, estado y recencia."
                            action={(
                                <div className="grid w-full grid-cols-3 rounded-lg border border-zinc-200 bg-zinc-50 p-1 sm:w-auto">
                                    {(['open', 'resolved', 'all'] as const).map((filter) => (
                                        <button
                                            key={filter}
                                            type="button"
                                            onClick={() => setIncidentFilter(filter)}
                                            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition sm:px-3 ${
                                                incidentFilter === filter
                                                    ? 'bg-zinc-950 text-white shadow-sm'
                                                    : 'text-zinc-600 hover:text-zinc-950'
                                            }`}
                                        >
                                            {filter}
                                        </button>
                                    ))}
                                </div>
                            )}
                        />

                        {loading ? (
                            <LoadingLine>Cargando incidentes...</LoadingLine>
                        ) : visibleIncidents.length === 0 ? (
                            <EmptyLine>No hay incidentes para este filtro.</EmptyLine>
                        ) : (
                            <div className="mt-4 divide-y divide-zinc-200">
                                {visibleIncidents.map((incident: PlatformIncident) => (
                                    <div key={incident.id} className="py-4">
                                        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold text-zinc-950">{incident.title}</p>
                                                    <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600">{incident.domain}</span>
                                                    <StatusPill label={getHealthLabel(incident.severity)} detail={incident.severity} />
                                                    <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600">{incident.status}</span>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">{incident.detail || 'Sin detalle adicional'}</p>
                                                <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">
                                                    Runbook {incident.runbook_key} / requestId {incident.request_id}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                                                {incident.replayable ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => replayIncident(incident.id)}
                                                        disabled={processingId === `incident-${incident.id}`}
                                                    >
                                                        Replay seguro
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs uppercase tracking-wide text-zinc-500">No replay</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <aside className="space-y-5 xl:space-y-6">
                        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                            <SectionHeader
                                eyebrow="Runbooks"
                                title="Respuesta operativa"
                                detail="SLA, owner y archivo de recuperacion."
                                action={<LifeBuoy className="h-5 w-5 text-zinc-950" />}
                            />
                            <div className="mt-4 divide-y divide-zinc-200">
                                {(overview?.runbooks || []).slice(0, 6).map((runbook: RunbookSummary) => (
                                    <div key={runbook.key} className="py-3">
                                        <div className="flex min-w-0 flex-col gap-2 min-[460px]:flex-row min-[460px]:items-start min-[460px]:justify-between">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-zinc-950">{runbook.title}</p>
                                                <p className="mt-1 text-sm text-zinc-600">{runbook.domain} / SLA {runbook.sla}</p>
                                            </div>
                                            <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600">{runbook.owner}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-zinc-500">{runbook.file_path}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                            <SectionHeader
                                eyebrow="Soporte"
                                title="Cola abierta"
                                detail="Los casos visibles son los que todavia pueden romper confianza."
                                action={<Headphones className="h-5 w-5 text-zinc-950" />}
                            />
                            {supportBacklog.length === 0 ? (
                                <EmptyLine>No hay casos abiertos.</EmptyLine>
                            ) : (
                                <>
                                    <div className="mt-4 grid gap-3 md:hidden">
                                        {supportBacklog.slice(0, 6).map((request: SupportRequest) => (
                                            <article key={request.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                <p className="font-semibold text-zinc-950">{request.subject}</p>
                                                <p className="mt-1 text-xs leading-5 text-zinc-500">{request.requester_name} / {request.requester_email}</p>
                                                <div className="mt-4 grid gap-3 text-xs text-zinc-600 min-[460px]:grid-cols-2">
                                                    <div>
                                                        <p className="font-semibold uppercase tracking-wide text-zinc-500">Prioridad</p>
                                                        <p className="mt-1 text-zinc-800">{request.priority}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold uppercase tracking-wide text-zinc-500">SLA</p>
                                                        <p className="mt-1">{formatDateTime(request.sla_due_at)}</p>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                    <div className="mt-4 hidden overflow-x-auto md:block">
                                        <table className="w-full min-w-[520px] text-left text-sm">
                                            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                                                <tr>
                                                    <th className="py-3 pr-3 font-semibold">Caso</th>
                                                    <th className="px-3 py-3 font-semibold">Prioridad</th>
                                                    <th className="py-3 pl-3 font-semibold">SLA</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-200">
                                                {supportBacklog.slice(0, 6).map((request: SupportRequest) => (
                                                    <tr key={request.id}>
                                                        <td className="py-3 pr-3">
                                                            <p className="font-semibold text-zinc-950">{request.subject}</p>
                                                            <p className="mt-1 text-xs text-zinc-500">{request.requester_name} / {request.requester_email}</p>
                                                        </td>
                                                        <td className="px-3 py-3 text-zinc-700">{request.priority}</td>
                                                        <td className="py-3 pl-3 text-xs text-zinc-500">{formatDateTime(request.sla_due_at)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </section>
                    </aside>
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] xl:gap-6">
                    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Tesoreria"
                            title="Retiros pendientes"
                            detail="Revision manual con saldos antes/despues para evitar decisiones ciegas."
                            action={<Wallet className="h-5 w-5 text-zinc-950" />}
                        />

                        {loading ? (
                            <LoadingLine>Cargando retiros...</LoadingLine>
                        ) : withdrawals.length === 0 ? (
                            <EmptyLine>No hay retiros pendientes o historicos.</EmptyLine>
                        ) : (
                            <>
                                <div className="mt-4 grid gap-3 lg:hidden">
                                    {withdrawals.map((item) => (
                                        <article key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="flex min-w-0 flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                                                <div className="min-w-0">
                                                    <p className="font-money text-lg font-semibold text-zinc-950">{formatCOP(item.requested_amount)}</p>
                                                    <p className="mt-1 text-sm leading-5 text-zinc-600">{item.description}</p>
                                                    <p className="mt-1 text-xs text-zinc-500">
                                                        {formatDateTime(item.created_at)} / {(item.source_reference || item.reference_id || '').slice(0, 8)}
                                                    </p>
                                                </div>
                                                <StatusPill label={getHealthLabel(item.status)} detail={item.status} />
                                            </div>
                                            <div className="mt-4 grid gap-3 text-xs text-zinc-600 min-[560px]:grid-cols-2">
                                                <div>
                                                    <p className="font-semibold uppercase tracking-wide text-zinc-500">Solicitante</p>
                                                    <p className="mt-1 font-semibold text-zinc-950">{item.trucker?.fullName || 'Sin nombre'}</p>
                                                    <p className="mt-1 break-all text-zinc-500">{item.trucker?.email || 'sin correo'}</p>
                                                </div>
                                                <div>
                                                    <p className="font-semibold uppercase tracking-wide text-zinc-500">Saldo</p>
                                                    <p className="mt-1">Disponible: {formatCOP(item.balance_before || 0)} {'->'} {formatCOP(item.balance_after || 0)}</p>
                                                    <p>Pendiente: {formatCOP(item.pending_balance_before || 0)} {'->'} {formatCOP(item.pending_balance_after || 0)}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {item.status === 'pending' ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => processWithdrawal(item.id, 'reject')}
                                                            disabled={processingId === item.id}
                                                            className="flex-1 min-[420px]:flex-none"
                                                        >
                                                            Rechazar
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => processWithdrawal(item.id, 'approve')}
                                                            disabled={processingId === item.id}
                                                            className="flex-1 min-[420px]:flex-none"
                                                        >
                                                            Aprobar
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Cerrado</span>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                                <div className="mt-4 hidden overflow-x-auto lg:block">
                                <table className="w-full min-w-[820px] text-left text-sm">
                                    <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                                        <tr>
                                            <th className="py-3 pr-4 font-semibold">Retiro</th>
                                            <th className="px-4 py-3 font-semibold">Solicitante</th>
                                            <th className="px-4 py-3 font-semibold">Saldo</th>
                                            <th className="px-4 py-3 font-semibold">Estado</th>
                                            <th className="py-3 pl-4 text-right font-semibold">Accion</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200">
                                        {withdrawals.map((item) => (
                                            <tr key={item.id} className="align-top">
                                                <td className="py-4 pr-4">
                                                    <p className="font-money text-base font-semibold text-zinc-950">{formatCOP(item.requested_amount)}</p>
                                                    <p className="mt-1 text-sm leading-5 text-zinc-600">{item.description}</p>
                                                    <p className="mt-1 text-xs text-zinc-500">
                                                        {formatDateTime(item.created_at)} / {(item.source_reference || item.reference_id || '').slice(0, 8)}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="font-semibold text-zinc-950">{item.trucker?.fullName || 'Sin nombre'}</p>
                                                    <p className="mt-1 text-xs text-zinc-500">{item.trucker?.email || 'sin correo'}</p>
                                                </td>
                                                <td className="px-4 py-4 text-xs leading-5 text-zinc-600">
                                                    <p>Disponible: {formatCOP(item.balance_before || 0)} {'->'} {formatCOP(item.balance_after || 0)}</p>
                                                    <p>Pendiente: {formatCOP(item.pending_balance_before || 0)} {'->'} {formatCOP(item.pending_balance_after || 0)}</p>
                                                    {item.withdrawal_snapshot?.admin_action ? (
                                                        <p>Accion admin: {String(item.withdrawal_snapshot.admin_action)}</p>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <StatusPill label={getHealthLabel(item.status)} detail={item.status} />
                                                </td>
                                                <td className="py-4 pl-4">
                                                    <div className="flex justify-end gap-2">
                                                        {item.status === 'pending' ? (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => processWithdrawal(item.id, 'reject')}
                                                                    disabled={processingId === item.id}
                                                                >
                                                                    Rechazar
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => processWithdrawal(item.id, 'approve')}
                                                                    disabled={processingId === item.id}
                                                                >
                                                                    Aprobar
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs uppercase tracking-wide text-zinc-500">Cerrado</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            </>
                        )}
                    </section>

                    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Alertas"
                            title="Alertas operativas"
                            detail="Marcar lectura o procesamiento no altera el payload de origen."
                            action={<Bell className="h-5 w-5 text-zinc-950" />}
                        />

                        {loading ? (
                            <LoadingLine>Cargando alertas...</LoadingLine>
                        ) : notifications.length === 0 ? (
                            <EmptyLine>No hay alertas administrativas.</EmptyLine>
                        ) : (
                            <div className="mt-4 divide-y divide-zinc-200">
                                {notifications.slice(0, 8).map((notification) => (
                                    <div key={notification.id} className="py-4">
                                        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-zinc-950" />
                                                    <p className="font-semibold text-zinc-950">{notification.title}</p>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">{notification.message}</p>
                                                <p className="mt-1 text-xs text-zinc-500">
                                                    {formatDateTime(notification.created_at)} / {notification.type}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col gap-2 min-[420px]:flex-row md:justify-end">
                                                {!notification.read && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateNotification(notification.id, { read: true })}
                                                        disabled={processingId === notification.id}
                                                        className="w-full min-[420px]:w-auto"
                                                    >
                                                        Marcar leida
                                                    </Button>
                                                )}
                                                {!notification.processed && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => updateNotification(notification.id, { processed: true, read: true })}
                                                        disabled={processingId === notification.id}
                                                        className="w-full min-[420px]:w-auto"
                                                    >
                                                        Procesada
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </section>

                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                    <SectionHeader
                        eyebrow="Admin actions"
                        title="Acciones administrativas"
                        detail="Comandos seguros, abajo de la lectura operativa. Los cuerpos enviados a API se conservan."
                        action={<CreditCard className="h-5 w-5 text-zinc-950" />}
                    />
                    <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Banknote className="h-5 w-5 text-zinc-950" />
                                <h3 className="font-semibold text-zinc-950">Conciliacion de pagos</h3>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <ActionInput
                                    value={paymentId}
                                    onChange={(event) => setPaymentId(event.target.value)}
                                    placeholder="paymentId"
                                />
                                <ActionInput
                                    value={offerIdForPayment}
                                    onChange={(event) => setOfferIdForPayment(event.target.value)}
                                    placeholder="offerId alternativo"
                                />
                            </div>
                            <Button onClick={reconcilePayment} disabled={processingId === 'reconcile'} className="w-full sm:w-auto">
                                <ArrowUpRight className="h-4 w-4" />
                                Conciliar pago
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-zinc-950" />
                                <h3 className="font-semibold text-zinc-950">Reenvio de PIN</h3>
                            </div>
                            <ActionInput
                                value={offerIdForPins}
                                onChange={(event) => setOfferIdForPins(event.target.value)}
                                placeholder="offerId"
                            />
                            <Button onClick={resendPins} disabled={processingId === 'pins'} className="w-full sm:w-auto">
                                <ArrowUpRight className="h-4 w-4" />
                                Reenviar PIN
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </DashboardLayout>
    );
}
