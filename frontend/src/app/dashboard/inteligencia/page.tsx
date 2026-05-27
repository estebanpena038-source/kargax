'use client';

import * as React from 'react';
import { BarChart3, Download, FileText, Loader2, Lock, RefreshCw, Route, Shield, Truck, Users, Wallet } from 'lucide-react';
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
import { DeliveryRiskBadge, EvidenceQualityBadge, ExecutiveAlertsPanel, NextBestActionPanel } from '@/components/algorithms';
import { useAuthStore } from '@/features/auth/store/authStore';
import warehouseClient from '@/lib/warehouses/client';
import type { WarehouseAccessResponse } from '@/lib/warehouses/types';
import type { AlgorithmRiskLevel, EvidenceQualityStatus, ExecutiveAlert, NextBestAction, OperationRail } from '@/algorithms/shared/types';
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

interface AlgorithmOfferRecord {
    offerId: string;
    businessId: string;
    status: string | null;
    rail: OperationRail;
    cargoType: string | null;
    originLabel: string;
    destinationLabel: string;
    updatedAt: string | null;
    risk: {
        score: number;
        riskLevel: AlgorithmRiskLevel;
        reasons: Array<{ code: string; label: string }>;
    };
    evidence: {
        score: number;
        status: EvidenceQualityStatus;
        missingRequirements: Array<{ code: string; label: string }>;
        warnings: Array<{ code: string; label: string }>;
    };
}

interface AlgorithmsOverviewPayload {
    generatedAt: string;
    summary: {
        evaluatedOffers: number;
        criticalRisks: number;
        highRisks: number;
        incompleteEvidence: number;
        nextActions: number;
        executiveAlerts: number;
    };
    deliveryRisks: AlgorithmOfferRecord[];
    nextBestActions: NextBestAction[];
    executiveAlerts: ExecutiveAlert[];
    snapshotPersistence: 'stored' | 'skipped';
}

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const TAB_LABELS: Record<BusinessIntelligenceTab, string> = {
    overview: 'Resumen ejecutivo',
    marketplace: 'Marketplace',
    private_fleet: 'Flota privada',
    warehouse: 'Bodega',
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
        const week = `Semana ${Math.floor((created.getDate() - 1) / 7) + 1}`;
        const current = buckets.get(week) || { week, trips: 0, amount: 0 };
        current.trips += 1;
        current.amount += Number(trip.total_amount || 0);
        buckets.set(week, current);
    }
    return [...buckets.values()].sort((a, b) => Number(a.week.replace(/\D/g, '')) - Number(b.week.replace(/\D/g, '')));
}

function topTruckers(trips: ReportRow[]) {
    const truckers = new Map<string, { truckerId: string; name: string; trips: number; amount: number }>();
    for (const trip of trips) {
        const truckerId = trip.assigned_trucker_id || trip.private_fleet_trucker_id;
        if (!truckerId) continue;
        const current = truckers.get(truckerId) || { truckerId, name: driverLabel(trip), trips: 0, amount: 0 };
        current.trips += 1;
        current.amount += Number(trip.net_amount || trip.total_amount || 0);
        truckers.set(truckerId, current);
    }
    return [...truckers.values()].sort((a, b) => b.trips - a.trips || b.amount - a.amount).slice(0, 5);
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
            'Donde crece la operacion y donde se queda valor quieto?',
            'Que rutas, conductores y flujos generan mas volumen este mes?',
            'Que necesita seguimiento: marketplace, flota privada, bodega o contabilidad?',
        ];
    }

    if (role === 'finance_accountant') {
        return [
            'Cuanto debe reconocer contabilidad por fletes, fees, pagos privados y retiros?',
            'Que viajes estan listos para soportes y PDF mensual?',
            'Que pagos o retiros requieren conciliacion antes del cierre?',
        ];
    }

    if (role === 'ops_manager' || role === 'dispatcher') {
        return [
            'Que viajes siguen abiertos y necesitan seguimiento operativo?',
            'Que rutas y conductores concentran mayor carga de trabajo?',
            'Donde falta evidencia de cargue, entrega o novedad?',
        ];
    }

    return [
        'Como se mueve la operacion este mes?',
        'Que viajes se completaron y cuales siguen activos?',
        'Que informacion puedo consultar sin tocar datos sensibles?',
    ];
}

function createPdf(report: ReportPayload, companyName: string, month: string) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 48;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('KargaX - Reporte mensual', 48, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${companyName || 'Empresa'}`, 48, y + 22);
    doc.text(`Periodo: ${report.summary.period_start} a ${report.summary.period_end}`, 48, y + 38);
    y += 76;

    const metrics = [
        ['Viajes', report.summary.trips.toString()],
        ['Completados', report.summary.completed_trips.toString()],
        ['Fletes', formatMoney(report.summary.gross_amount_cop)],
        ['Fee KargaX', formatMoney(report.summary.kargax_fee_cop)],
        ['Neto conductores', formatMoney(report.summary.net_to_truckers_cop)],
        ['Gastos viaje', formatMoney(report.summary.company_expenses_cop)],
        ['Payouts', formatMoney(report.summary.payouts_cop)],
    ];

    doc.setFont('helvetica', 'bold');
    doc.text('Resumen financiero', 48, y);
    y += 22;
    doc.setFont('helvetica', 'normal');
    for (const [label, value] of metrics) {
        doc.text(label, 48, y);
        doc.text(value, pageWidth - 48, y, { align: 'right' });
        y += 18;
    }

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('Viajes', 48, y);
    y += 22;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    for (const trip of report.trips.slice(0, 24)) {
        if (y > 760) {
            doc.addPage();
            y = 48;
        }
        doc.text(routeLabel(trip).slice(0, 58), 48, y);
        doc.text(String(trip.status || 'estado'), 280, y);
        doc.text(formatMoney(trip.total_amount), pageWidth - 48, y, { align: 'right' });
        y += 16;
    }

    doc.save(`KargaX_Reporte_${month}_${(companyName || 'Empresa').replace(/\s+/g, '_')}.pdf`);
}

export default function InteligenciaDashboardPage() {
    const { user } = useAuthStore();
    const [month, setMonth] = React.useState(currentMonth());
    const [report, setReport] = React.useState<ReportPayload | null>(null);
    const [algorithms, setAlgorithms] = React.useState<AlgorithmsOverviewPayload | null>(null);
    const [access, setAccess] = React.useState<WarehouseAccessResponse | null>(null);
    const [activeTab, setActiveTab] = React.useState<BusinessIntelligenceTab>('overview');
    const [loading, setLoading] = React.useState(true);

    const loadReport = React.useCallback(async () => {
        setLoading(true);
        try {
            const [accessPayload, response] = await Promise.all([
                warehouseClient.getWarehouseAccess().catch(() => null),
                fetch(`/api/reports/business-monthly?month=${month}`),
            ]);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error || 'No se pudo cargar el reporte mensual');
            }
            let algorithmsData: AlgorithmsOverviewPayload | null = null;
            const algorithmParams = new URLSearchParams({ month });
            if (accessPayload?.businessId) {
                algorithmParams.set('businessId', accessPayload.businessId);
            }
            try {
                const algorithmsResponse = await fetch(`/api/algorithms/lastmile/overview?${algorithmParams.toString()}`);
                const algorithmsPayload = await algorithmsResponse.json().catch(() => ({}));
                algorithmsData = algorithmsResponse.ok ? algorithmsPayload.data as AlgorithmsOverviewPayload : null;
            } catch {
                algorithmsData = null;
            }
            setAccess(accessPayload);
            setReport(payload.data as ReportPayload);
            setAlgorithms(algorithmsData);
        } catch (error) {
            setAlgorithms(null);
            toast.error('Inteligencia', error instanceof Error ? error.message : 'Reporte no disponible');
        } finally {
            setLoading(false);
        }
    }, [month]);

    React.useEffect(() => {
        void loadReport();
    }, [loadReport]);

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
    const marketplaceSummary = React.useMemo(() => summarizeTrips(marketplaceTrips), [marketplaceTrips]);
    const privateFleetSummary = React.useMemo(() => summarizeTrips(privateFleetTrips), [privateFleetTrips]);
    const analyticsTrips = React.useMemo(() => {
        if (activeTab === 'marketplace') return marketplaceTrips;
        if (activeTab === 'private_fleet' || activeTab === 'warehouse') return privateFleetTrips;
        return report?.trips || [];
    }, [activeTab, marketplaceTrips, privateFleetTrips, report?.trips]);
    const routes = React.useMemo(() => groupTopRoutes(analyticsTrips), [analyticsTrips]);
    const trend = React.useMemo(() => weeklyTrend(analyticsTrips), [analyticsTrips]);
    const truckers = React.useMemo(() => topTruckers(analyticsTrips), [analyticsTrips]);
    const algorithmTrips = React.useMemo(() => {
        const records = algorithms?.deliveryRisks || [];
        if (activeTab === 'marketplace') return records.filter((record) => record.rail === 'marketplace');
        if (activeTab === 'private_fleet' || activeTab === 'warehouse') return records.filter((record) => record.rail === 'private_fleet');
        return records;
    }, [activeTab, algorithms?.deliveryRisks]);
    const topAlgorithmTrips = React.useMemo(() => (
        [...algorithmTrips].sort((left, right) => right.risk.score - left.risk.score).slice(0, 6)
    ), [algorithmTrips]);

    React.useEffect(() => {
        if (!availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0] || 'overview');
        }
    }, [activeTab, availableTabs]);

    return (
        <DashboardLayout
            pageTitle="Inteligencia"
            headerActions={(
                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                    <input
                        type="month"
                        value={month}
                        onChange={(event) => setMonth(event.target.value)}
                        className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 font-money text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10 sm:flex-none"
                    />
                    <Button variant="outline" size="icon" onClick={() => void loadReport()} disabled={loading} aria-label="Actualizar reporte">
                        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    </Button>
                </div>
            )}
        >
            {loading || !report ? (
                <div className="flex min-h-[420px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                </div>
            ) : (
                <div className="space-y-6">
                    <EnterpriseHero
                        eyebrow="Business Intelligence"
                        title="Resumen mensual listo para gerencia"
                        description={`Vista ajustada para ${roleLabel}: viajes, fee KargaX, wallet, rutas top y soporte exportable segun permisos.`}
                        icon={BarChart3}
                        meta={[
                            { label: 'Periodo', value: month, detail: `${report.summary.period_start} / ${report.summary.period_end}` },
                            { label: 'Viajes', value: report.summary.trips, detail: `${report.summary.completed_trips} cerrados` },
                            { label: 'Fee KargaX', value: formatMoney(report.summary.kargax_fee_cop), detail: 'Ingreso de plataforma' },
                        ]}
                        actions={(
                            <Button
                                variant="secondary"
                                disabled={!canExportPdf}
                                leftIcon={canExportPdf ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                onClick={() => createPdf(report, user?.fullName || 'Empresa', month)}
                            >
                                {canExportPdf ? 'Exportar PDF' : 'PDF restringido'}
                            </Button>
                        )}
                    />

                    <section className="kx-enterprise-card rounded-lg border border-zinc-200 bg-white p-2">
                        <div className="grid kx-enterprise-grid-dense gap-2">
                            {availableTabs.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`rounded-md px-4 py-3 text-left text-sm font-semibold transition ${
                                        activeTab === tab
                                            ? 'bg-zinc-950 text-white shadow-sm'
                                            : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                                    }`}
                                >
                                    {TAB_LABELS[tab]}
                                </button>
                            ))}
                        </div>
                    </section>

                    {algorithms ? (
                        <>
                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
                                <ExecutiveAlertsPanel
                                    alerts={algorithms.executiveAlerts}
                                    generatedAt={algorithms.generatedAt}
                                    snapshotPersistence={algorithms.snapshotPersistence}
                                />
                                <NextBestActionPanel actions={algorithms.nextBestActions} />
                            </div>

                            <Card className="kx-enterprise-card p-4 min-[380px]:p-5">
                                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <SectionHeader
                                        icon={Shield}
                                        title="Control P0 de entrega y POD"
                                        description="Riesgo, proxima accion y calidad de evidencia calculados bajo permisos de empresa."
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <StatusPill>{algorithms.summary.evaluatedOffers} viajes evaluados</StatusPill>
                                        <StatusPill>{algorithms.summary.incompleteEvidence} POD por revisar</StatusPill>
                                    </div>
                                </div>

                                {topAlgorithmTrips.length === 0 ? (
                                    <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                                        Sin viajes evaluables para esta vista.
                                    </p>
                                ) : (
                                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                        {topAlgorithmTrips.map((record) => (
                                            <div key={record.offerId} className="rounded-lg border border-zinc-200 bg-white p-4">
                                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-zinc-950">
                                                            {record.originLabel} &gt; {record.destinationLabel}
                                                        </p>
                                                        <p className="mt-1 text-xs text-zinc-500">
                                                            {record.cargoType || 'Carga'} - {record.rail === 'private_fleet' ? 'Flota privada' : 'Marketplace'} - {record.status || 'sin estado'}
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 flex-wrap gap-2">
                                                        <DeliveryRiskBadge riskLevel={record.risk.riskLevel} />
                                                        <EvidenceQualityBadge status={record.evidence.status} />
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid gap-2 text-sm text-zinc-600">
                                                    {(record.risk.reasons[0] || record.evidence.missingRequirements[0] || record.evidence.warnings[0]) ? (
                                                        <p className="leading-6">
                                                            {record.risk.reasons[0]?.label
                                                                || record.evidence.missingRequirements[0]?.label
                                                                || record.evidence.warnings[0]?.label}
                                                        </p>
                                                    ) : (
                                                        <p className="leading-6">Entrega sin bloqueos P0 detectados.</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </>
                    ) : null}

                    <div className="grid kx-enterprise-grid gap-4">
                        <EnterpriseMetric label="Fletes pagados" value={formatMoney(report.summary.gross_amount_cop)} detail="Marketplace + flota privada" icon={Wallet} />
                        <EnterpriseMetric label="GMV marketplace" value={formatMoney(report.summary.marketplace_gmv_cop)} detail="Comisionable por plataforma" icon={BarChart3} />
                        <EnterpriseMetric label="Nomina privada" value={formatMoney(report.summary.private_payroll_cop)} detail={`${formatMoney(report.summary.private_payroll_pending_cop)} pendiente`} icon={Users} />
                        <EnterpriseMetric label="Fee KargaX" value={formatMoney(report.summary.kargax_fee_cop)} detail="Ingreso mensual" icon={BarChart3} />
                        <EnterpriseMetric label="Wallet / payouts" value={formatMoney(report.summary.payouts_cop)} detail="Movimiento validado por reporte" icon={Shield} />
                        <EnterpriseMetric label="Gastos viaje" value={formatMoney(report.summary.company_expenses_cop)} detail="Compensacion y operacion" icon={FileText} />
                        <EnterpriseMetric label="Rutas top" value={routes.length} detail={`${analyticsTrips.length} registros filtrados`} icon={Route} />
                    </div>

                    <Card className="kx-enterprise-card p-4 min-[380px]:p-5">
                        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <SectionHeader
                                icon={Shield}
                                title={`Preguntas ejecutivas para ${roleLabel}`}
                                description="La vista prioriza decisiones. Finanzas quedan protegidas si el rol no tiene permiso."
                            />
                            <StatusPill>{roleCapabilities.canViewFinance ? 'Finanzas visibles' : 'Finanzas protegidas'}</StatusPill>
                        </div>
                        <div className="mt-4 grid kx-enterprise-grid gap-3">
                            {questions.map((question) => (
                                <div key={question} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
                                    {question}
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="grid kx-enterprise-grid gap-4">
                        <Card className="kx-enterprise-card p-4 min-[380px]:p-5">
                            <SectionHeader icon={Truck} title="Marketplace" description="Fletes externos, comision de plataforma y neto operativo." />
                            <div className="mt-5 grid kx-enterprise-grid-dense gap-3">
                                <EnterpriseMetric label="Viajes" value={marketplaceSummary.trips} detail={`${marketplaceSummary.completed} cerrados`} />
                                <EnterpriseMetric label="Fee" value={formatMoney(marketplaceSummary.fee)} detail="Ingreso marketplace" />
                                <EnterpriseMetric label="Neto" value={formatMoney(marketplaceSummary.net)} detail="Conductores" />
                            </div>
                        </Card>

                        <Card className="kx-enterprise-card p-4 min-[380px]:p-5">
                            <SectionHeader icon={Wallet} title="Flota privada" description="Viajes internos, pagos privados y evidencia operacional." />
                            <div className="mt-5 grid kx-enterprise-grid-dense gap-3">
                                <EnterpriseMetric label="Viajes" value={privateFleetSummary.trips} detail={`${privateFleetSummary.completed} cerrados`} />
                                <EnterpriseMetric label="Pago privado" value={formatMoney(report.summary.private_trip_pay_cop)} detail="Nomina/viaje" />
                                <EnterpriseMetric label="Nomina mensual" value={formatMoney(report.summary.private_payroll_cop)} detail="Contrato mensual" />
                                <EnterpriseMetric label="Gastos" value={formatMoney(report.summary.company_expenses_cop)} detail="Empresa" />
                            </div>
                        </Card>
                    </div>

                    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
                        <Card className="kx-chart-shell p-4 min-[380px]:p-5">
                            <SectionHeader icon={BarChart3} title={`Tendencia semanal - ${TAB_LABELS[activeTab]}`} />
                            <div className="mt-4 h-64 min-w-0 min-[420px]:h-72">
                                {trend.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trend}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                                            <XAxis dataKey="week" tick={{ fill: '#52525b', fontSize: 12 }} />
                                            <YAxis tick={{ fill: '#52525b', fontSize: 12 }} />
                                            <Tooltip formatter={(value, name) => name === 'amount' ? formatMoney(Number(value)) : value} />
                                            <Line type="monotone" dataKey="trips" stroke="#0a0a0a" strokeWidth={3} dot={{ fill: '#0a0a0a' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center rounded-lg bg-zinc-50 text-sm text-zinc-500">
                                        Sin viajes para esta vista.
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card className="kx-chart-shell p-4 min-[380px]:p-5">
                            <SectionHeader icon={Route} title={`Rutas principales - ${TAB_LABELS[activeTab]}`} />
                            <div className="mt-4 h-64 min-w-0 min-[420px]:h-72">
                                {routes.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={routes} layout="vertical" margin={{ left: 4, right: 12 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                                            <XAxis type="number" tick={{ fill: '#52525b', fontSize: 12 }} />
                                            <YAxis dataKey="route" type="category" width={140} tick={{ fill: '#52525b', fontSize: 10 }} />
                                            <Tooltip formatter={(value, name) => name === 'amount' || name === 'fee' ? formatMoney(Number(value)) : value} />
                                            <Bar dataKey="trips" fill="#0a0a0a" radius={[0, 6, 6, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center rounded-lg bg-zinc-50 text-sm text-zinc-500">
                                        Sin rutas para esta vista.
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    <Card className="kx-enterprise-card p-4 min-[380px]:p-5">
                        <SectionHeader icon={Users} title="Top conductores" description="Ordenado por viajes y monto operativo del periodo." />
                        {truckers.length === 0 ? (
                            <p className="mt-4 text-sm text-zinc-500">Aun no hay conductores asociados en este periodo.</p>
                        ) : (
                            <div className="mt-4 grid kx-enterprise-grid-dense gap-3">
                                {truckers.map((trucker, index) => (
                                    <div key={trucker.truckerId} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">#{index + 1}</p>
                                        <p className="mt-2 truncate text-sm font-bold text-zinc-950">{trucker.name}</p>
                                        <p className="mt-1 font-money text-xs text-zinc-500">{trucker.trips} viajes</p>
                                        <p className="mt-2 font-money text-sm font-semibold text-zinc-950">{formatMoney(trucker.amount)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="flex min-w-0 flex-col gap-3 border-b border-zinc-100 p-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:p-5">
                            <SectionHeader icon={FileText} title="Viajes del periodo" />
                            <StatusPill>{analyticsTrips.length} registros</StatusPill>
                        </div>
                        <div className="kx-enterprise-table">
                            <table className="w-full min-w-[42rem] text-sm">
                                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <tr>
                                        <th className="px-5 py-3">Ruta</th>
                                        <th className="px-5 py-3">Tipo</th>
                                        <th className="px-5 py-3">Conductor</th>
                                        <th className="px-5 py-3">Estado</th>
                                        {roleCapabilities.canViewFinance ? (
                                            <>
                                                <th className="px-5 py-3 text-right">Flete</th>
                                                <th className="px-5 py-3 text-right">Fee</th>
                                                <th className="px-5 py-3 text-right">Neto</th>
                                            </>
                                        ) : null}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {analyticsTrips.map((trip) => (
                                        <tr key={trip.id}>
                                            <td className="px-5 py-4 font-medium text-zinc-950">{routeLabel(trip)}</td>
                                            <td className="px-5 py-4 text-zinc-600">{trip.is_private_fleet ? 'Flota privada' : 'Marketplace'}</td>
                                            <td className="px-5 py-4 text-zinc-600">{driverLabel(trip)}</td>
                                            <td className="px-5 py-4"><StatusPill>{trip.status || 'n/a'}</StatusPill></td>
                                            {roleCapabilities.canViewFinance ? (
                                                <>
                                                    <td className="px-5 py-4 text-right font-money">{formatMoney(trip.total_amount)}</td>
                                                    <td className="px-5 py-4 text-right font-money">{formatMoney(trip.platform_fee)}</td>
                                                    <td className="px-5 py-4 text-right font-money">{formatMoney(trip.net_amount)}</td>
                                                </>
                                            ) : null}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </DashboardLayout>
    );
}
