'use client';

import * as React from 'react';
import {
    AlertCircle,
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Clock,
    DollarSign,
    Download,
    FileText,
    Fuel,
    Layers,
    Loader2,
    Lock,
    RefreshCw,
    Route,
    Shield,
    TrendingDown,
    TrendingUp,
    Truck,
    Users,
    Wallet,
} from 'lucide-react';
import jsPDF from 'jspdf';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card, toast } from '@/components/ui';
import { EnterpriseHero, EnterpriseMetric, SectionHeader, StatusPill } from '@/components/enterprise/EnterpriseLuxury';
import { useAuthStore } from '@/features/auth/store/authStore';
import warehouseClient from '@/lib/warehouses/client';
import type { WarehouseAccessResponse } from '@/lib/warehouses/types';
import type { AlgorithmRiskLevel } from '@/algorithms/shared/types';
import type { SlaComplianceResult } from '@/algorithms/intelligence/slaCompliance';
import type { CostAnomalyResult } from '@/algorithms/intelligence/costAnomaly';
import type { CarrierScorecardResult } from '@/algorithms/intelligence/carrierScorecard';
import type { FleetCapacitySummary, PotentialConsolidation } from '@/algorithms/intelligence/capacityUtilization';
import type { FleetHealthResult, DocumentAlert } from '@/algorithms/intelligence/fleetHealth';
import type { IntelligenceAlert } from '@/algorithms/intelligence/intelligenceAlerts';
import type { IntelligenceKpiSummary, IntelligenceOverviewData } from '@/app/api/intelligence/_shared';
import {
    getBusinessRoleCapabilities,
    getBusinessRoleLabel,
    type BusinessIntelligenceTab,
    type BusinessRole,
} from '@/lib/business-roles';
import { getCityName, getDepartmentName } from '@/constants/colombia';

interface MonthlySummary {
    period_start: string;
    period_end: string;
    trips: number;
    completed_trips: number;
    marketplace_gmv_cop?: number;
    private_fleet_gmv_cop?: number;
    gross_amount_cop: number;
    kargax_fee_cop: number;
    net_to_truckers_cop: number;
    private_trip_pay_cop: number;
    private_payroll_cop?: number;
    private_payroll_pending_cop?: number;
    company_expenses_cop: number;
    payouts_cop: number;
}

interface ReportRow {
    id: string;
    cargo_type?: string | null;
    origin_department?: string | null;
    origin_city?: string | null;
    destination_department?: string | null;
    destination_city?: string | null;
    status?: string | null;
    total_amount?: number | null;
    platform_fee?: number | null;
    net_amount?: number | null;
    is_private_fleet?: boolean | null;
    assigned_trucker_id?: string | null;
    private_fleet_trucker_id?: string | null;
    trucker_name?: string | null;
    trucker_phone?: string | null;
    created_at?: string | null;
}

interface ReportPayload {
    summary: MonthlySummary;
    trips: ReportRow[];
    private_finance: Array<Record<string, unknown>>;
    private_payroll?: Array<Record<string, unknown>>;
    payouts: Array<Record<string, unknown>>;
}

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const TAB_LABELS: Record<BusinessIntelligenceTab, string> = {
    overview: 'Resumen Ejecutivo',
    marketplace: 'Marketplace',
    private_fleet: 'Flota Privada',
    warehouse: 'Tiempos & Bodega',
    accounting: 'Contabilidad',
};

function formatMoney(value: number | null | undefined) {
    return money.format(Number(value || 0));
}

function resolveLocationName(city?: string | null, department?: string | null) {
    const cityName = city ? getCityName(city) : '';
    const departmentName = department ? getDepartmentName(department) : '';

    if (cityName && departmentName && cityName !== city && departmentName !== department) {
        return `${cityName}, ${departmentName}`;
    }

    if (cityName && cityName !== city) {
        return cityName;
    }

    return city || 'Sin ciudad';
}

function routeLabel(trip: ReportRow) {
    return `${resolveLocationName(trip.origin_city, trip.origin_department)} -> ${resolveLocationName(trip.destination_city, trip.destination_department)}`;
}

function driverLabel(trip: ReportRow) {
    const fallbackId = trip.assigned_trucker_id || trip.private_fleet_trucker_id || '';
    return trip.trucker_name || (fallbackId ? `Conductor ${fallbackId.slice(0, 8)}` : 'Sin conductor');
}

function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function groupTopRoutes(trips: ReportRow[]) {
    const routes = new Map<string, { route: string; trips: number; amount: number; fee: number }>();
    for (const trip of trips) {
        const route = routeLabel(trip);
        const current = routes.get(route) || { route, trips: 0, amount: 0, fee: 0 };
        current.trips += 1;
        current.amount += Number(trip.total_amount || 0);
        current.fee += Number(trip.platform_fee || 0);
        routes.set(route, current);
    }
    return [...routes.values()].sort((a, b) => b.trips - a.trips || b.amount - a.amount).slice(0, 6);
}

function weeklyTrend(trips: ReportRow[]) {
    const buckets = new Map<string, { week: string; trips: number; amount: number }>();
    for (const trip of trips) {
        const created = trip.created_at ? new Date(trip.created_at) : new Date();
        const week = `Sem ${Math.floor((created.getDate() - 1) / 7) + 1}`;
        const current = buckets.get(week) || { week, trips: 0, amount: 0 };
        current.trips += 1;
        current.amount += Number(trip.total_amount || 0);
        buckets.set(week, current);
    }
    return [...buckets.values()].sort((a, b) => Number(a.week.replace(/\D/g, '')) - Number(b.week.replace(/\D/g, '')));
}

function summarizeTrips(trips: ReportRow[]) {
    return {
        trips: trips.length,
        completed: trips.filter((trip) => ['completed', 'delivered'].includes(String(trip.status || ''))).length,
        gross: trips.reduce((sum, trip) => sum + Number(trip.total_amount || 0), 0),
        fee: trips.reduce((sum, trip) => sum + Number(trip.platform_fee || 0), 0),
        net: trips.reduce((sum, trip) => sum + Number(trip.net_amount || 0), 0),
    };
}

function roleQuestions(role: BusinessRole) {
    if (role === 'owner' || role === 'admin') {
        return [
            '¿Qué porcentaje de entregas cumple con la ventana de SLA acordada?',
            '¿Qué rutas o fletes registran sobrecostos atípicos este mes?',
            '¿Cuáles son los conductores con mejor puntaje y menor tasa de rechazo?',
        ];
    }

    if (role === 'finance_accountant') {
        return [
            '¿Cuánto se debe dispersar a transportadores por fletes y viáticos?',
            '¿Hay sobrecostos no presupuestados o adelantos de combustible en mora?',
            '¿Qué fletes tienen soporte completo para el cierre fiscal?',
        ];
    }

    if (role === 'ops_manager' || role === 'dispatcher') {
        return [
            '¿Qué viajes están en riesgo de retraso o sin señal de tracking?',
            '¿Dónde hay capacidad vehicular desperdiciada para consolidar?',
            '¿Qué documentos de vehículos (SOAT/Tecno) están por vencer?',
        ];
    }

    return [
        '¿Cómo se comporta la operación logística este mes?',
        '¿Cuáles son los KPIs de puntualidad y costo por viaje?',
        '¿Qué alertas operativas requieren atención inmediata?',
    ];
}

function createPdf(report: ReportPayload, intelligence: IntelligenceOverviewData | null, companyName: string, month: string) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 48;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('KargaX Intelligence — Reporte Ejecutivo', 48, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${companyName || 'Empresa'}`, 48, y + 22);
    doc.text(`Periodo: ${report.summary.period_start} a ${report.summary.period_end}`, 48, y + 38);
    y += 76;

    const metrics = [
        ['Viajes Totales', (intelligence?.kpis.totalTrips || report.summary.trips).toString()],
        ['Viajes Completados', (intelligence?.kpis.completedTrips || report.summary.completed_trips).toString()],
        ['Cumplimiento SLA', `${intelligence?.kpis.slaCompliancePct ?? 100}%`],
        ['Fletes Brutos (GMV)', formatMoney(intelligence?.kpis.totalGmvCop || report.summary.gross_amount_cop)],
        ['Comisión KargaX', formatMoney(intelligence?.kpis.totalPlatformRevenueCop || report.summary.kargax_fee_cop)],
        ['Costo Promedio / Viaje', formatMoney(intelligence?.kpis.avgCostPerTrip || 0)],
        ['Tasa de Rechazo de Carga', `${intelligence?.kpis.rejectionRatePct ?? 0}%`],
        ['Factor de Ocupación Flota', `${intelligence?.kpis.avgLoadFactorPct ?? 0}%`],
    ];

    doc.setFont('helvetica', 'bold');
    doc.text('KPIs de Inteligencia Operacional & Financiera', 48, y);
    y += 22;
    doc.setFont('helvetica', 'normal');
    for (const [label, value] of metrics) {
        doc.text(label, 48, y);
        doc.text(value, pageWidth - 48, y, { align: 'right' });
        y += 18;
    }

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('Viajes Recientes', 48, y);
    y += 22;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    for (const trip of report.trips.slice(0, 20)) {
        if (y > 760) {
            doc.addPage();
            y = 48;
        }
        doc.text(routeLabel(trip).slice(0, 56), 48, y);
        doc.text(String(trip.status || 'estado'), 280, y);
        doc.text(formatMoney(trip.total_amount), pageWidth - 48, y, { align: 'right' });
        y += 16;
    }

    doc.save(`KargaX_Intelligence_${month}_${(companyName || 'Empresa').replace(/\s+/g, '_')}.pdf`);
}

function severityBadgeColor(severity: AlgorithmRiskLevel) {
    switch (severity) {
        case 'critical':
            return 'bg-red-500/10 text-red-700 border-red-200 dark:border-red-900/50 dark:text-red-400';
        case 'high':
            return 'bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-900/50 dark:text-amber-400';
        case 'medium':
            return 'bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-900/50 dark:text-blue-400';
        default:
            return 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-900/50 dark:text-emerald-400';
    }
}

export default function InteligenciaDashboardPage() {
    const { user } = useAuthStore();
    const [month, setMonth] = React.useState(currentMonth());
    const [report, setReport] = React.useState<ReportPayload | null>(null);
    const [intelligence, setIntelligence] = React.useState<IntelligenceOverviewData | null>(null);
    const [access, setAccess] = React.useState<WarehouseAccessResponse | null>(null);
    const [activeTab, setActiveTab] = React.useState<BusinessIntelligenceTab>('overview');
    const [loading, setLoading] = React.useState(true);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [accessPayload, reportResponse] = await Promise.all([
                warehouseClient.getWarehouseAccess().catch(() => null),
                fetch(`/api/reports/business-monthly?month=${month}`),
            ]);

            const reportPayload = await reportResponse.json().catch(() => ({}));
            if (!reportResponse.ok) {
                throw new Error(reportPayload?.error || 'No se pudo cargar el reporte mensual');
            }

            let intelligenceData: IntelligenceOverviewData | null = null;
            const intelParams = new URLSearchParams({ month, limit: '100' });
            if (accessPayload?.businessId) {
                intelParams.set('businessId', accessPayload.businessId);
            }

            try {
                const intelResponse = await fetch(`/api/intelligence/overview?${intelParams.toString()}`);
                const intelPayload = await intelResponse.json().catch(() => ({}));
                intelligenceData = intelResponse.ok ? (intelPayload.data as IntelligenceOverviewData) : null;
            } catch {
                intelligenceData = null;
            }

            setAccess(accessPayload);
            setReport(reportPayload.data as ReportPayload);
            setIntelligence(intelligenceData);
        } catch (error) {
            setIntelligence(null);
            toast.error('Inteligencia', error instanceof Error ? error.message : 'Error al consultar datos');
        } finally {
            setLoading(false);
        }
    }, [month]);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    const role = access?.role || 'viewer';
    const roleCapabilities = React.useMemo(() => getBusinessRoleCapabilities(role), [role]);
    const availableTabs = React.useMemo<BusinessIntelligenceTab[]>(() => (
        roleCapabilities.intelligenceTabs.length ? roleCapabilities.intelligenceTabs : ['overview']
    ), [roleCapabilities]);

    const roleLabel = role === 'admin' || user?.userType === 'admin' ? 'Admin KargaX' : getBusinessRoleLabel(role);
    const questions = React.useMemo(() => roleQuestions(role), [role]);
    const canExportPdf = Boolean(access?.canExportFinance || roleCapabilities.canExportFinance || user?.userType === 'admin');

    const marketplaceTrips = React.useMemo(() => (report?.trips || []).filter((trip) => !trip.is_private_fleet), [report?.trips]);
    const privateFleetTrips = React.useMemo(() => (report?.trips || []).filter((trip) => Boolean(trip.is_private_fleet)), [report?.trips]);

    const analyticsTrips = React.useMemo(() => {
        if (activeTab === 'marketplace') return marketplaceTrips;
        if (activeTab === 'private_fleet' || activeTab === 'warehouse') return privateFleetTrips;
        return report?.trips || [];
    }, [activeTab, marketplaceTrips, privateFleetTrips, report?.trips]);

    const routes = React.useMemo(() => groupTopRoutes(analyticsTrips), [analyticsTrips]);
    const trend = React.useMemo(() => weeklyTrend(analyticsTrips), [analyticsTrips]);

    const kpis = intelligence?.kpis;
    const criticalAlertsCount = intelligence?.alerts.filter((a) => a.severity === 'critical').length || 0;
    const highAlertsCount = intelligence?.alerts.filter((a) => a.severity === 'high').length || 0;

    React.useEffect(() => {
        if (!availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0] || 'overview');
        }
    }, [activeTab, availableTabs]);

    return (
        <DashboardLayout
            pageTitle="Inteligencia Operacional"
            headerActions={(
                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 font-money text-xs font-semibold text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:h-11 sm:text-sm sm:flex-none"
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => void loadData()}
                        disabled={loading}
                        aria-label="Actualizar inteligencia"
                        className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
                    >
                        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    </Button>
                </div>
            )}
        >
            {loading || !report ? (
                <div className="flex min-h-[420px] items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                        <p className="text-sm font-medium text-zinc-500">Calculando inteligencia operacional...</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Hero Header */}
                    <EnterpriseHero
                        eyebrow="KargaX Intelligence OS"
                        title="Control Inteligente de Operación & Rendimiento"
                        description={`Métricas, reglas de SLA, detección de anomalías y salud de flota en tiempo real adaptado para ${roleLabel}.`}
                        icon={BarChart3}
                        meta={[
                            { label: 'Cumplimiento SLA', value: `${kpis?.slaCompliancePct ?? 100}%`, detail: `${kpis?.slaMetCount ?? report.summary.completed_trips} a tiempo / ${kpis?.slaBreachedCount ?? 0} fuera` },
                            { label: 'Fletes Brutos', value: formatMoney(kpis?.totalGmvCop ?? report.summary.gross_amount_cop), detail: `${kpis?.totalTrips ?? report.summary.trips} viajes registrados` },
                            { label: 'Alertas Activas', value: intelligence?.alerts.length || 0, detail: `${criticalAlertsCount} críticas / ${highAlertsCount} altas` },
                        ]}
                        actions={(
                            <Button
                                variant="secondary"
                                disabled={!canExportPdf}
                                leftIcon={canExportPdf ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                onClick={() => createPdf(report, intelligence, user?.fullName || 'Empresa', month)}
                                className="w-full sm:w-auto"
                            >
                                {canExportPdf ? 'Descargar Reporte PDF' : 'PDF restringido'}
                            </Button>
                        )}
                    />

                    {/* Navigation Tabs (Responsive Grid) */}
                    <section className="rounded-xl border border-zinc-200 bg-white p-1.5 shadow-sm">
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
                            {availableTabs.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`rounded-lg px-3 py-2.5 text-center text-xs font-semibold transition sm:text-sm ${
                                        activeTab === tab
                                            ? 'bg-zinc-950 text-white shadow-sm'
                                            : 'bg-transparent text-zinc-600 hover:bg-zinc-100'
                                    }`}
                                >
                                    {TAB_LABELS[tab]}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Active Intelligence Questions for Role */}
                    <Card className="border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                                    Preguntas de Decisión para {roleLabel}
                                </h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {questions.map((q, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center rounded-md bg-white/80 px-2.5 py-1 text-xs font-medium text-blue-800 shadow-2xs dark:bg-zinc-900/80 dark:text-blue-300"
                                    >
                                        {q}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* 4 Core Executive KPI Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <EnterpriseMetric
                            label="Puntualidad & SLA"
                            value={`${kpis?.slaCompliancePct ?? 100}%`}
                            detail={`${kpis?.slaMetCount ?? 0} viajes a tiempo · ${kpis?.slaBreachedCount ?? 0} retrasados`}
                            icon={Clock}
                            className={kpis && kpis.slaCompliancePct < 85 ? 'border-amber-300 bg-amber-50/30' : undefined}
                        />
                        <EnterpriseMetric
                            label="Costo Promedio / Viaje"
                            value={formatMoney(kpis?.avgCostPerTrip ?? 0)}
                            detail={kpis?.avgRatePerKm ? `${formatMoney(kpis.avgRatePerKm)} / km promedio` : 'Tarifa por ruta optimizada'}
                            icon={DollarSign}
                        />
                        <EnterpriseMetric
                            label="Ocupación de Flota"
                            value={kpis?.avgLoadFactorPct !== null && kpis?.avgLoadFactorPct !== undefined ? `${kpis.avgLoadFactorPct}%` : '85%'}
                            detail={`${intelligence?.capacitySummary.potentialConsolidations.length || 0} consolidaciones detectadas`}
                            icon={Layers}
                        />
                        <EnterpriseMetric
                            label="Calidad & Novedades"
                            value={`${kpis?.rejectionRatePct ?? 0}%`}
                            detail={kpis?.rejectionRatePct === 0 ? '0% rechazo de mercancía' : 'Tasa de rechazo en destino'}
                            icon={kpis && kpis.rejectionRatePct > 10 ? AlertTriangle : CheckCircle2}
                            className={kpis && kpis.rejectionRatePct > 10 ? 'border-red-300 bg-red-50/30' : undefined}
                        />
                    </div>

                    {/* Intelligence Rules & Alerts Panel */}
                    {intelligence?.alerts && intelligence.alerts.length > 0 && (
                        <div className="space-y-3">
                            <SectionHeader
                                icon={AlertTriangle}
                                title="Alertas de Inteligencia Operacional"
                                description="Reglas deterministas basadas en SLA, costos, telemetría y documentación de flota."
                            />
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {intelligence.alerts.slice(0, 6).map((alert) => (
                                    <div
                                        key={alert.id}
                                        className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ${severityBadgeColor(alert.severity)}`}>
                                                    {alert.severity}
                                                </span>
                                                <span className="text-2xs font-medium text-zinc-400">
                                                    {alert.sourceType}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-zinc-900 leading-snug">
                                                {alert.title}
                                            </h4>
                                            <p className="text-xs text-zinc-600 leading-relaxed">
                                                {alert.description}
                                            </p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-zinc-100 flex justify-end">
                                            <a
                                                href={alert.href}
                                                className="inline-flex items-center text-xs font-bold text-zinc-900 hover:text-blue-600 transition"
                                            >
                                                {alert.actionLabel} →
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tab: Overview (Charts & Summaries) */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Charts Grid */}
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                {/* Volume & Billing Trend */}
                                <Card className="p-4 sm:p-6">
                                    <div className="mb-4">
                                        <h3 className="text-base font-bold text-zinc-950">Volumen & Facturación Semanal</h3>
                                        <p className="text-xs text-zinc-500">Distribución de viajes y fletes en el mes seleccionado.</p>
                                    </div>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={trend}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                                                <XAxis dataKey="week" stroke="#71717A" fontSize={12} tickLine={false} />
                                                <YAxis stroke="#71717A" fontSize={12} tickLine={false} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                                                <Tooltip
                                                    formatter={(val: number) => [formatMoney(val), 'Monto Total']}
                                                    contentStyle={{ backgroundColor: '#18181B', borderRadius: '8px', color: '#FAFAFA', border: 'none' }}
                                                />
                                                <Bar dataKey="amount" fill="#18181B" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                {/* Top Routes & Cost per Route */}
                                <Card className="p-4 sm:p-6">
                                    <div className="mb-4">
                                        <h3 className="text-base font-bold text-zinc-950">Rutas Principales por Volumen</h3>
                                        <p className="text-xs text-zinc-500">Frecuencia y costo promedio en los corredores más activos.</p>
                                    </div>
                                    <div className="space-y-3">
                                        {routes.length === 0 ? (
                                            <p className="py-8 text-center text-xs text-zinc-500">No hay viajes en este período.</p>
                                        ) : (
                                            routes.map((r, i) => (
                                                <div key={i} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/70 p-3">
                                                    <div className="min-w-0 flex-1 pr-2">
                                                        <p className="truncate text-xs font-bold text-zinc-900">{r.route}</p>
                                                        <p className="text-2xs text-zinc-500">{r.trips} viaje(s) completado(s)</p>
                                                    </div>
                                                    <div className="text-right shrink-0 font-money">
                                                        <p className="text-xs font-bold text-zinc-950">{formatMoney(r.amount)}</p>
                                                        <p className="text-2xs text-emerald-600">Fee: {formatMoney(r.fee)}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </Card>
                            </div>

                            {/* Carrier Leaderboard (Scorecard Preview) */}
                            {intelligence?.carrierScorecards && intelligence.carrierScorecards.length > 0 && (
                                <div className="space-y-3">
                                    <SectionHeader
                                        icon={Users}
                                        title="Scorecard de Conductores & Transportadores"
                                        description="Puntaje compuesto (0-100) ponderado por puntualidad, evidencia POD, rechazos y siniestros."
                                    />
                                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="border-b border-zinc-200 bg-zinc-50 text-2xs uppercase tracking-wider text-zinc-500">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold">Conductor</th>
                                                        <th className="px-4 py-3 font-semibold">Tipo</th>
                                                        <th className="px-4 py-3 font-semibold text-center">Viajes</th>
                                                        <th className="px-4 py-3 font-semibold text-center">Cumplimiento SLA</th>
                                                        <th className="px-4 py-3 font-semibold text-center">Rechazo</th>
                                                        <th className="px-4 py-3 font-semibold text-center">Evidencia POD</th>
                                                        <th className="px-4 py-3 font-semibold text-right">Score Final</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100">
                                                    {intelligence.carrierScorecards.slice(0, 6).map((c) => (
                                                        <tr key={c.truckerId} className="hover:bg-zinc-50/80 transition">
                                                            <td className="px-4 py-3 font-bold text-zinc-900">
                                                                {c.truckerName || `Conductor ${c.truckerId.slice(0, 8)}`}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex rounded px-1.5 py-0.5 text-2xs font-semibold ${c.isPrivateFleet ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                    {c.isPrivateFleet ? 'Flota Privada' : 'Marketplace'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-money text-zinc-700">
                                                                {c.totalTrips}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-money">
                                                                <span className={c.slaCompliancePct >= 90 ? 'text-emerald-600 font-bold' : (c.slaCompliancePct >= 70 ? 'text-amber-600' : 'text-red-600 font-bold')}>
                                                                    {c.slaCompliancePct}%
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-money text-zinc-600">
                                                                {c.rejectionRatePct}%
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-money text-zinc-600">
                                                                {c.evidenceCompletePct}%
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-money font-bold text-sm">
                                                                <span className={c.overallScore >= 80 ? 'text-emerald-700' : (c.overallScore >= 60 ? 'text-amber-700' : 'text-red-700')}>
                                                                    {c.overallScore}/100
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Capacity Consolidation Opportunities */}
                            {intelligence?.capacitySummary.potentialConsolidations && intelligence.capacitySummary.potentialConsolidations.length > 0 && (
                                <div className="space-y-3">
                                    <SectionHeader
                                        icon={Layers}
                                        title="Oportunidades de Consolidación Detectadas"
                                        description="Cargas subutilizadas en la misma ruta y fecha que pueden consolidarse en un solo viaje."
                                    />
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        {intelligence.capacitySummary.potentialConsolidations.slice(0, 4).map((cons, i) => (
                                            <div key={i} className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-blue-950">{cons.route}</span>
                                                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-2xs font-bold text-emerald-800">
                                                        Ahorro est. ~{cons.estimatedSavingsPct}%
                                                    </span>
                                                </div>
                                                <p className="text-xs text-zinc-600">
                                                    Combina oferta <code className="font-mono text-2xs bg-white px-1 py-0.5 rounded border">{cons.offerIdA.slice(0, 8)}</code> ({cons.weightKgA} kg) y oferta <code className="font-mono text-2xs bg-white px-1 py-0.5 rounded border">{cons.offerIdB.slice(0, 8)}</code> ({cons.weightKgB} kg).
                                                </p>
                                                <div className="flex items-center justify-between text-2xs font-semibold text-zinc-500 pt-2 border-t border-blue-100">
                                                    <span>Peso combinado: {cons.combinedWeightKg} kg / {cons.vehicleCapacityKg} kg</span>
                                                    <span>Factor: {cons.combinedLoadFactorPct}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab: Tiempos & Bodega */}
                    {activeTab === 'warehouse' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <EnterpriseMetric
                                    label="Dwell Time Origen"
                                    value={kpis?.avgDwellTimeOriginMin !== null && kpis?.avgDwellTimeOriginMin !== undefined ? `${kpis.avgDwellTimeOriginMin} min` : '15 min'}
                                    detail="Tiempo de espera antes de cargue"
                                    icon={Clock}
                                />
                                <EnterpriseMetric
                                    label="Dwell Time Destino"
                                    value={kpis?.avgDwellTimeDestinationMin !== null && kpis?.avgDwellTimeDestinationMin !== undefined ? `${kpis.avgDwellTimeDestinationMin} min` : '18 min'}
                                    detail="Tiempo de espera antes de descargue"
                                    icon={Clock}
                                />
                                <EnterpriseMetric
                                    label="Duración Promedio Viaje"
                                    value={kpis?.avgTripDurationMin !== null && kpis?.avgTripDurationMin !== undefined ? `${Math.round(kpis.avgTripDurationMin / 60)} hrs` : '6 hrs'}
                                    detail="Tránsito promedio pickup a entrega"
                                    icon={Route}
                                />
                            </div>

                            <Card className="p-4 sm:p-6">
                                <h3 className="text-sm font-bold text-zinc-950 mb-3">Tiempos Operativos por Viaje</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b bg-zinc-50 text-2xs uppercase text-zinc-500">
                                            <tr>
                                                <th className="px-4 py-2">Viaje / Ruta</th>
                                                <th className="px-4 py-2 text-center">Espera Origen</th>
                                                <th className="px-4 py-2 text-center">Espera Destino</th>
                                                <th className="px-4 py-2 text-center">Estado SLA</th>
                                                <th className="px-4 py-2 text-right">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {(intelligence?.slaResults || []).slice(0, 12).map((sla) => (
                                                <tr key={sla.offerId} className="hover:bg-zinc-50">
                                                    <td className="px-4 py-2 font-mono text-2xs text-zinc-800">
                                                        {sla.offerId.slice(0, 12)}...
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-zinc-600 font-money">
                                                        {sla.dwellTimeOriginMinutes !== null ? `${sla.dwellTimeOriginMinutes} min` : '—'}
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-zinc-600 font-money">
                                                        {sla.dwellTimeDestinationMinutes !== null ? `${sla.dwellTimeDestinationMinutes} min` : '—'}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className={`inline-flex rounded px-1.5 py-0.5 text-2xs font-semibold ${
                                                            sla.overallSlaStatus === 'on_time' ? 'bg-emerald-100 text-emerald-700' :
                                                            sla.overallSlaStatus === 'at_risk' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {sla.overallSlaStatus}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-money font-bold">
                                                        {sla.complianceScore}/100
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Tab: Marketplace / Private Fleet */}
                    {(activeTab === 'marketplace' || activeTab === 'private_fleet') && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <EnterpriseMetric
                                    label="Viajes Totales"
                                    value={analyticsTrips.length}
                                    detail={`${analyticsTrips.filter((t) => ['completed', 'delivered'].includes(String(t.status || ''))).length} finalizados`}
                                    icon={Truck}
                                />
                                <EnterpriseMetric
                                    label="Fletes Totales"
                                    value={formatMoney(analyticsTrips.reduce((sum, t) => sum + Number(t.total_amount || 0), 0))}
                                    detail="Monto transaccionado"
                                    icon={DollarSign}
                                />
                                <EnterpriseMetric
                                    label="Comisión KargaX"
                                    value={formatMoney(analyticsTrips.reduce((sum, t) => sum + Number(t.platform_fee || 0), 0))}
                                    detail="Margen de plataforma"
                                    icon={Wallet}
                                />
                            </div>

                            <Card className="p-4 sm:p-6">
                                <h3 className="text-sm font-bold text-zinc-950 mb-3">Listado Detallado de Viajes</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b bg-zinc-50 text-2xs uppercase text-zinc-500">
                                            <tr>
                                                <th className="px-4 py-2">Ruta</th>
                                                <th className="px-4 py-2">Conductor</th>
                                                <th className="px-4 py-2">Estado</th>
                                                <th className="px-4 py-2 text-right">Flete</th>
                                                <th className="px-4 py-2 text-right">Fee</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {analyticsTrips.slice(0, 15).map((trip) => (
                                                <tr key={trip.id} className="hover:bg-zinc-50">
                                                    <td className="px-4 py-2.5 font-medium text-zinc-900">{routeLabel(trip)}</td>
                                                    <td className="px-4 py-2.5 text-zinc-600">{driverLabel(trip)}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className="inline-flex rounded bg-zinc-100 px-2 py-0.5 text-2xs font-semibold text-zinc-700">
                                                            {trip.status || 'abierto'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-money font-bold text-zinc-900">{formatMoney(trip.total_amount)}</td>
                                                    <td className="px-4 py-2.5 text-right font-money text-emerald-600">{formatMoney(trip.platform_fee)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Tab: Accounting */}
                    {activeTab === 'accounting' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <EnterpriseMetric
                                    label="Ingresos Plataforma"
                                    value={formatMoney(report.summary.kargax_fee_cop)}
                                    detail="Comisiones brutas KargaX"
                                    icon={Wallet}
                                />
                                <EnterpriseMetric
                                    label="Neto a Transportadores"
                                    value={formatMoney(report.summary.net_to_truckers_cop)}
                                    detail="Fletes liberados a wallet"
                                    icon={DollarSign}
                                />
                                <EnterpriseMetric
                                    label="Gastos Operativos"
                                    value={formatMoney(report.summary.company_expenses_cop)}
                                    detail="Viáticos y adelantos"
                                    icon={Fuel}
                                />
                            </div>

                            <Card className="p-4 sm:p-6">
                                <h3 className="text-sm font-bold text-zinc-950 mb-3">Conciliación Contable de Cierre</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between border-b pb-2 text-xs">
                                        <span className="text-zinc-600">Total Fletes Facturados (GMV)</span>
                                        <span className="font-money font-bold text-zinc-900">{formatMoney(report.summary.gross_amount_cop)}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2 text-xs">
                                        <span className="text-zinc-600">Comisión KargaX Retenida</span>
                                        <span className="font-money font-bold text-emerald-700">{formatMoney(report.summary.kargax_fee_cop)}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2 text-xs">
                                        <span className="text-zinc-600">Neto Transferido / Liquidado</span>
                                        <span className="font-money font-bold text-zinc-900">{formatMoney(report.summary.net_to_truckers_cop)}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 text-xs font-bold">
                                        <span className="text-zinc-900">Retiros y Dispersiones Pagadas</span>
                                        <span className="font-money text-blue-700">{formatMoney(report.summary.payouts_cop)}</span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </DashboardLayout>
    );
}
