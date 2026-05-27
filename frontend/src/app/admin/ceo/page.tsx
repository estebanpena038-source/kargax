'use client';

import * as React from 'react';
import {
    AlertTriangle,
    BarChart3,
    Banknote,
    Building2,
    Crown,
    Gauge,
    Landmark,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Truck,
    Users,
    WalletCards,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { formatCOP } from '@/constants/colombia';
import { extractApiErrorMessage, unwrapApiEnvelope } from '@/lib/contracts/api';
import type { AdminCeoOverviewResponse } from '@/lib/platform/types';

type ExecutiveLabel = 'OK' | 'Atencion' | 'Bloqueado';

function formatNumber(value: number) {
    return new Intl.NumberFormat('es-CO', {
        maximumFractionDigits: 0,
    }).format(value || 0);
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatPercent(value: number, total: number) {
    if (!total) return '0%';
    return `${Math.round((value / total) * 100)}%`;
}

function getExecutiveLabel(value: number, blockedAt = 1): ExecutiveLabel {
    if (value >= blockedAt) return 'Bloqueado';
    if (value > 0) return 'Atencion';
    return 'OK';
}

function ExecutivePill({ label }: { label: ExecutiveLabel | string }) {
    return (
        <span className="inline-flex max-w-full shrink-0 items-center rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-zinc-950 sm:px-3 sm:text-xs">
            {label}
        </span>
    );
}

function MetricCard({
    label,
    value,
    detail,
    icon: Icon,
    labelState,
}: {
    label: string;
    value: string;
    detail: string;
    icon: React.ElementType;
    labelState?: ExecutiveLabel;
}) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5">
            <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                    <p className="mt-3 break-words text-[clamp(1.35rem,6vw,1.65rem)] font-semibold leading-tight text-zinc-950">{value}</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50">
                    <Icon className="h-5 w-5 text-zinc-950" />
                </span>
            </div>
            <div className="mt-4 flex flex-col items-start gap-3 min-[460px]:flex-row min-[460px]:justify-between">
                <p className="text-sm leading-6 text-zinc-600">{detail}</p>
                {labelState ? <ExecutivePill label={labelState} /> : null}
            </div>
        </div>
    );
}

function CountRow({
    label,
    value,
    format = 'number',
    strong,
}: {
    label: string;
    value: number;
    format?: 'number' | 'cop';
    strong?: boolean;
}) {
    return (
        <div className="flex min-w-0 items-center justify-between gap-4 border-b border-zinc-200 py-3 last:border-b-0">
            <span className="text-sm text-zinc-600">{label}</span>
            <span className={`${format === 'cop' ? 'font-money' : ''} min-w-0 break-words text-right text-sm font-semibold ${strong ? 'text-zinc-950' : 'text-zinc-800'}`}>
                {format === 'cop' ? formatCOP(value) : formatNumber(value)}
            </span>
        </div>
    );
}

function SectionHeader({
    eyebrow,
    title,
    detail,
    action,
}: {
    eyebrow: string;
    title: string;
    detail?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-3 border-b border-zinc-200 pb-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{eyebrow}</p>
                <h2 className="mt-1 text-base font-semibold text-zinc-950 sm:text-lg">{title}</h2>
                {detail ? <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">{detail}</p> : null}
            </div>
            {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
        </div>
    );
}

function RatioBar({
    leftLabel,
    leftValue,
    rightLabel,
    rightValue,
}: {
    leftLabel: string;
    leftValue: number;
    rightLabel: string;
    rightValue: number;
}) {
    const total = leftValue + rightValue;
    const leftShare = total ? Math.max((leftValue / total) * 100, 2) : 50;

    return (
        <div>
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-zinc-700">{leftLabel}</span>
                <span className="font-medium text-zinc-700">{rightLabel}</span>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                <div className="bg-zinc-950" style={{ width: `${leftShare}%` }} />
                <div className="flex-1 bg-zinc-300" />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-zinc-500 min-[460px]:flex min-[460px]:items-center min-[460px]:justify-between">
                <span>{formatPercent(leftValue, total)} de {formatCOP(total)}</span>
                <span>{formatPercent(rightValue, total)} de {formatCOP(total)}</span>
            </div>
        </div>
    );
}

export default function AdminCeoPage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = React.useState(true);
    const [overview, setOverview] = React.useState<AdminCeoOverviewResponse | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const loadOverview = React.useCallback(async () => {
        if (!user) {
            setLoading(true);
            return;
        }

        if (user.userType !== 'admin') {
            setLoading(false);
            setError('Necesitas un usuario admin para abrir esta cabina.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Sesion no disponible');
            }

            const response = await fetch('/api/admin/ceo-overview', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(extractApiErrorMessage(payload, 'No se pudo cargar la cabina CEO'));
            }

            setOverview(unwrapApiEnvelope<AdminCeoOverviewResponse>(payload) || payload.data || payload);
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar la cabina CEO';
            setError(message);
            toast.error('CEO Control Tower', message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    React.useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    if (loading) {
        return (
            <DashboardLayout pageTitle="CEO KargaX">
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="text-center text-zinc-600">
                        <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-zinc-950" />
                        <p className="text-sm font-medium">Cargando cabina CEO...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !overview) {
        return (
            <DashboardLayout pageTitle="CEO KargaX">
                <div className="mx-auto max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
                    <ShieldCheck className="mx-auto h-10 w-10 text-zinc-950" />
                    <h1 className="mt-4 text-xl font-semibold text-zinc-950">Acceso CEO no habilitado</h1>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {error || 'Esta vista requiere usuario admin y allowlist founder-only.'}
                    </p>
                    <Button className="mt-5" variant="outline" onClick={loadOverview}>
                        Reintentar
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    const totalTrips = overview.trips.total || 0;
    const totalGmv = overview.gmv.totalGmvCop || 0;
    const marketplaceFee = overview.revenue.marketplaceCommissionCop || 0;
    const totalRevenue = overview.revenue.totalCollectedRevenueCop || 0;
    const totalBusinesses = overview.users.businessProfiles || overview.users.businesses;
    const approvals = overview.approvals || {
        pending: 0,
        criticalPending: 0,
        breached: 0,
        dueSoon: 0,
    };
    const estimatedOperatorBalance = Math.max(totalGmv - marketplaceFee, 0);
    const riskRows = [
        {
            key: 'critical_incidents',
            label: 'Incidentes criticos',
            value: overview.health.criticalIncidents,
            state: getExecutiveLabel(overview.health.criticalIncidents),
            decision: overview.health.criticalIncidents > 0
                ? 'Pausar release y abrir owner operativo ahora.'
                : 'Mantener monitoreo normal.',
        },
        {
            key: 'pending_payouts',
            label: 'Payouts en revision',
            value: overview.health.payoutsManualReview,
            state: getExecutiveLabel(overview.health.payoutsManualReview, 3),
            decision: overview.health.payoutsManualReview > 0
                ? 'Finance debe limpiar manual review antes del cierre diario.'
                : 'Sin decision inmediata.',
        },
        {
            key: 'pending_withdrawals',
            label: 'Retiros pendientes',
            value: overview.health.pendingWithdrawals,
            state: getExecutiveLabel(overview.health.pendingWithdrawals, 5),
            decision: overview.health.pendingWithdrawals > 0
                ? 'Aprobar o rechazar cola; no dejar dinero sin responsable.'
                : 'Caja operativa limpia.',
        },
        {
            key: 'approvals',
            label: 'Aprobaciones vencidas',
            value: approvals.breached,
            state: getExecutiveLabel(approvals.breached),
            decision: approvals.breached > 0
                ? 'Holding owner decide hoy o se bloquea expansion.'
                : approvals.pending > 0
                    ? 'Priorizar pendientes criticas y due soon.'
                    : 'Gobierno corporativo limpio.',
        },
        {
            key: 'support',
            label: 'Soporte abierto',
            value: overview.health.openSupportRequests,
            state: getExecutiveLabel(overview.health.openSupportRequests, 10),
            decision: overview.health.openSupportRequests > 0
                ? 'Success debe agrupar causa raiz y SLA.'
                : 'Sin backlog visible.',
        },
    ].sort((a, b) => {
        const rank: Record<ExecutiveLabel, number> = { Bloqueado: 0, Atencion: 1, OK: 2 };
        return rank[a.state] - rank[b.state] || b.value - a.value;
    });

    return (
        <DashboardLayout pageTitle="CEO KargaX">
            <div className="mx-auto w-full max-w-[118rem] space-y-5 sm:space-y-6 xl:space-y-7">
                <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white">
                                <Crown className="h-3.5 w-3.5" />
                                Founder only
                            </span>
                            <span className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950">
                                Solo lectura
                            </span>
                            <span className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">
                                {overview.environment}
                            </span>
                        </div>
                        <h1 className="mt-4 text-[clamp(1.75rem,7vw,2.35rem)] font-semibold leading-tight tracking-normal text-zinc-950">Vista CEO KargaX</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                            Dinero, viajes, payouts, incidentes y aprobaciones. Una pantalla para decidir.
                        </p>
                    </div>
                    <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <p className="text-xs text-zinc-500">
                            Actualizado {formatDateTime(overview.generatedAt)}
                        </p>
                        <Button variant="outline" onClick={loadOverview} disabled={loading} className="w-full sm:w-auto">
                            <RefreshCw className="h-4 w-4" />
                            Actualizar
                        </Button>
                    </div>
                </div>

                <section className="grid gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                    <MetricCard
                        icon={BarChart3}
                        label="GMV"
                        value={formatCOP(totalGmv)}
                        detail={`${formatCOP(overview.gmv.marketplaceGmvCop)} marketplace + ${formatCOP(overview.gmv.privateFleetGmvCop)} flota privada.`}
                    />
                    <MetricCard
                        icon={Banknote}
                        label="Fee cobrado"
                        value={formatCOP(marketplaceFee)}
                        detail={`${formatCOP(totalRevenue)} revenue total con planes incluidos.`}
                    />
                    <MetricCard
                        icon={Truck}
                        label="Viajes"
                        value={formatNumber(totalTrips)}
                        detail={`${formatNumber(overview.trips.marketplace)} marketplace / ${formatNumber(overview.trips.privateFleet)} privados.`}
                    />
                    <MetricCard
                        icon={WalletCards}
                        label="Payouts"
                        value={formatNumber(overview.health.payoutsManualReview)}
                        detail={`${formatNumber(overview.health.pendingWithdrawals)} retiros pendientes.`}
                        labelState={getExecutiveLabel(overview.health.payoutsManualReview, 3)}
                    />
                    <MetricCard
                        icon={AlertTriangle}
                        label="Incidentes"
                        value={formatNumber(overview.health.openIncidents)}
                        detail={`${formatNumber(overview.health.criticalIncidents)} criticos abiertos.`}
                        labelState={getExecutiveLabel(overview.health.criticalIncidents)}
                    />
                    <MetricCard
                        icon={ShieldCheck}
                        label="Aprobaciones"
                        value={formatNumber(approvals.pending)}
                        detail={`${formatNumber(approvals.breached)} vencidas / ${formatNumber(approvals.criticalPending)} criticas.`}
                        labelState={getExecutiveLabel(approvals.breached)}
                    />
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] xl:gap-6">
                    <div className="luxury-panel rounded-lg p-4 text-white shadow-[0_26px_70px_-46px_rgba(10,10,10,.9)] min-[380px]:p-5 sm:p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-white/55">Balance de dinero</p>
                                <h2 className="mt-2 text-[clamp(1.35rem,6vw,1.75rem)] font-semibold leading-tight text-white">Caja, fee y obligaciones visibles</h2>
                            </div>
                            <Landmark className="h-6 w-6 text-white/70" />
                        </div>
                        <div className="mt-6 grid gap-4 min-[560px]:grid-cols-2">
                            <div className="border-t border-white/15 pt-4">
                                <p className="text-xs uppercase tracking-wide text-white/45">GMV total</p>
                                <p className="font-money mt-2 break-words text-[clamp(1.5rem,8vw,1.9rem)] font-semibold leading-tight">{formatCOP(totalGmv)}</p>
                            </div>
                            <div className="border-t border-white/15 pt-4">
                                <p className="text-xs uppercase tracking-wide text-white/45">Fee marketplace</p>
                                <p className="font-money mt-2 break-words text-[clamp(1.5rem,8vw,1.9rem)] font-semibold leading-tight">{formatCOP(marketplaceFee)}</p>
                            </div>
                            <div className="border-t border-white/15 pt-4">
                                <p className="text-xs uppercase tracking-wide text-white/45">Planes cobrados</p>
                                <p className="font-money mt-2 break-words text-[clamp(1.5rem,8vw,1.9rem)] font-semibold leading-tight">{formatCOP(overview.revenue.collectedPlanRevenueCop)}</p>
                            </div>
                            <div className="border-t border-white/15 pt-4">
                                <p className="text-xs uppercase tracking-wide text-white/45">Estimado a operadores</p>
                                <p className="font-money mt-2 break-words text-[clamp(1.5rem,8vw,1.9rem)] font-semibold leading-tight">{formatCOP(estimatedOperatorBalance)}</p>
                            </div>
                        </div>
                        <p className="mt-5 text-xs leading-5 text-white/55">
                            MRR activo: {formatCOP(overview.revenue.activeMrrCop)}. La lectura separa caja cobrada, MRR y dinero operativo.
                        </p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Riesgos"
                            title="Decision sugerida"
                            detail="Lo critico se muestra primero aunque rompa la estetica."
                            action={<Gauge className="h-5 w-5 text-zinc-950" />}
                        />
                        <div className="mt-4 divide-y divide-zinc-200">
                            {riskRows.map((risk) => (
                                <div key={risk.key} className="py-4">
                                    <div className="flex min-w-0 flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-zinc-950">{risk.label}</p>
                                            <p className="mt-1 text-sm text-zinc-600">{risk.decision}</p>
                                        </div>
                                        <div className="shrink-0 min-[520px]:text-right">
                                            <p className="text-xl font-semibold text-zinc-950">{formatNumber(risk.value)}</p>
                                            <div className="mt-2">
                                                <ExecutivePill label={risk.state} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] xl:gap-6">
                    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Dinero movido"
                            title="Marketplace vs flota privada"
                            detail="GMV por origen y lectura del periodo actual."
                            action={<BarChart3 className="h-5 w-5 text-zinc-950" />}
                        />
                        <div className="mt-6 space-y-6">
                            <RatioBar
                                leftLabel="Marketplace"
                                leftValue={overview.gmv.marketplaceGmvCop}
                                rightLabel="Privados"
                                rightValue={overview.gmv.privateFleetGmvCop}
                            />
                            <div className="grid gap-3 min-[520px]:grid-cols-3">
                                <div className="border-t border-zinc-200 pt-4">
                                    <p className="text-xs text-zinc-500">Ultimos 30 dias</p>
                                    <p className="font-money mt-2 text-lg font-semibold text-zinc-950">
                                        {formatCOP(overview.periods.last30Days.marketplaceGmvCop + overview.periods.last30Days.privateFleetGmvCop)}
                                    </p>
                                </div>
                                <div className="border-t border-zinc-200 pt-4">
                                    <p className="text-xs text-zinc-500">Mes actual</p>
                                    <p className="font-money mt-2 text-lg font-semibold text-zinc-950">
                                        {formatCOP(overview.periods.monthToDate.marketplaceGmvCop + overview.periods.monthToDate.privateFleetGmvCop)}
                                    </p>
                                </div>
                                <div className="border-t border-zinc-200 pt-4">
                                    <p className="text-xs text-zinc-500">Fee mes</p>
                                    <p className="font-money mt-2 text-lg font-semibold text-zinc-950">
                                        {formatCOP(overview.periods.monthToDate.marketplaceCommissionCop)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Revenue"
                            title="Caja y recurrencia"
                            action={<Landmark className="h-5 w-5 text-zinc-950" />}
                        />
                        <div className="mt-5">
                            <CountRow label="Comision marketplace" value={overview.revenue.marketplaceCommissionCop} format="cop" strong />
                            <CountRow label="Planes cobrados" value={overview.revenue.collectedPlanRevenueCop} format="cop" />
                            <CountRow label="MRR activo" value={overview.revenue.activeMrrCop} format="cop" />
                            <CountRow label="Planes cobrados mes" value={overview.periods.monthToDate.collectedPlanRevenueCop} format="cop" />
                        </div>
                    </div>
                </section>

                <section className="grid gap-5 lg:grid-cols-3 xl:gap-6">
                    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Viajes"
                            title="Estado operativo"
                            action={<Truck className="h-5 w-5 text-zinc-950" />}
                        />
                        <div className="mt-5">
                            <CountRow label="Publicados" value={overview.trips.published} />
                            <CountRow label="Asignados / reservados" value={overview.trips.assigned} />
                            <CountRow label="En curso" value={overview.trips.inProgress} />
                            <CountRow label="Completados" value={overview.trips.completed} />
                            <CountRow label="Cancelados" value={overview.trips.cancelled} />
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Usuarios"
                            title="Oferta y demanda"
                            action={<Users className="h-5 w-5 text-zinc-950" />}
                        />
                        <div className="mt-5">
                            <CountRow label="Usuarios totales" value={overview.users.total} />
                            <CountRow label="Transportistas" value={overview.users.truckers} />
                            <CountRow label="Negocios" value={overview.users.businesses} />
                            <CountRow label="Empresas perfil" value={totalBusinesses} />
                            <CountRow label="Nuevos 30 dias" value={overview.users.new30d} />
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm min-[380px]:p-5 sm:p-6">
                        <SectionHeader
                            eyebrow="Planes"
                            title="Distribucion SaaS"
                            action={<Building2 className="h-5 w-5 text-zinc-950" />}
                        />
                        <div className="mt-5">
                            <CountRow label="Free" value={overview.plans.freeBusinesses} />
                            <CountRow label="Growth" value={overview.plans.proBusinesses} />
                            <CountRow label="Scale" value={overview.plans.scaleBusinesses} />
                            <CountRow label="Enterprise" value={overview.plans.enterpriseBusinesses} />
                            <CountRow label="Trialing pagos" value={overview.plans.trialingPaidBusinesses} />
                        </div>
                    </div>
                </section>
            </div>
        </DashboardLayout>
    );
}
