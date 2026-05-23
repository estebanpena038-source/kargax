'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    BarChart3,
    CalendarClock,
    ClipboardList,
    Loader2,
    MapPin,
    ShieldAlert,
    Warehouse,
} from 'lucide-react';
import { Card, toast } from '@/components/ui';
import { getFlowModeLabel, formatWarehouseDateTime } from '@/lib/warehouses/localization';
import warehouseClient from '@/lib/warehouses/client';
import type {
    Warehouse as WarehouseType,
    WarehouseAppointment,
    WarehouseCapabilities,
    WarehouseDetailResponse,
    WarehouseDispatchOrder,
    WarehouseDock,
    WarehouseIncident,
    WarehouseRole,
    WarehouseReceipt,
    WarehouseStockBalance,
    WarehouseTask,
} from '@/lib/warehouses/types';

export type WarehouseSectionKey =
    | 'overview'
    | 'appointments'
    | 'docks'
    | 'inventory'
    | 'receipts'
    | 'picking'
    | 'dispatches'
    | 'incidents'
    | 'analytics';

const SECTION_LINKS: Array<{ key: WarehouseSectionKey; label: string; suffix: string }> = [
    { key: 'overview', label: 'Resumen', suffix: '' },
    { key: 'appointments', label: 'Citas', suffix: '/citas' },
    { key: 'docks', label: 'Muelles', suffix: '/muelles' },
    { key: 'inventory', label: 'Inventario', suffix: '/inventario' },
    { key: 'receipts', label: 'Recepciones', suffix: '/recepciones' },
    { key: 'picking', label: 'Picking', suffix: '/picking' },
    { key: 'dispatches', label: 'Despachos', suffix: '/despachos' },
    { key: 'incidents', label: 'Incidentes', suffix: '/incidentes' },
    { key: 'analytics', label: 'Analitica', suffix: '/analitica' },
];

function formatDateTime(value?: string | null) {
    return formatWarehouseDateTime(value);
}

function MetricCard({
    icon: Icon,
    label,
    value,
    description,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    accent?: string;
    description?: string;
}) {
    return (
        <Card className="min-w-0 p-4 sm:p-5">
            <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                    <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">{label}</p>
                    <p className="mt-3 break-words font-money text-2xl font-semibold leading-none text-zinc-950 sm:text-3xl">{value}</p>
                    {description ? <p className="mt-2 text-sm text-zinc-500">{description}</p> : null}
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-950 sm:h-11 sm:w-11">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
            </div>
        </Card>
    );
}

function SectionCard({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="min-w-0 p-4 sm:p-6">
            <div className="mb-5">
                <h2 className="break-words text-base font-semibold text-zinc-950 sm:text-lg">{title}</h2>
                {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">{description}</p> : null}
            </div>
            {children}
        </Card>
    );
}

export interface WarehouseWorkspaceState {
    warehouse: WarehouseType | null;
    detail: WarehouseDetailResponse | null;
    role: WarehouseRole | null;
    capabilities: WarehouseCapabilities | null;
    docks: WarehouseDock[];
    appointments: WarehouseAppointment[];
    stock: WarehouseStockBalance[];
    receipts: WarehouseReceipt[];
    dispatches: WarehouseDispatchOrder[];
    tasks: WarehouseTask[];
    incidents: WarehouseIncident[];
    loading: boolean;
    reload: () => Promise<void>;
}

export function WarehouseWorkspace({
    warehouseId,
    section,
    renderSection,
}: {
    warehouseId: string;
    section: WarehouseSectionKey;
    renderSection: (state: WarehouseWorkspaceState) => React.ReactNode;
}) {
    const [loading, setLoading] = React.useState(true);
    const [warehouse, setWarehouse] = React.useState<WarehouseType | null>(null);
    const [detail, setDetail] = React.useState<WarehouseDetailResponse | null>(null);
    const [docks, setDocks] = React.useState<WarehouseDock[]>([]);
    const [appointments, setAppointments] = React.useState<WarehouseAppointment[]>([]);
    const [stock, setStock] = React.useState<WarehouseStockBalance[]>([]);
    const [receipts, setReceipts] = React.useState<WarehouseReceipt[]>([]);
    const [dispatches, setDispatches] = React.useState<WarehouseDispatchOrder[]>([]);
    const [tasks, setTasks] = React.useState<WarehouseTask[]>([]);
    const [incidents, setIncidents] = React.useState<WarehouseIncident[]>([]);

    const reload = React.useCallback(async () => {
        setLoading(true);
        try {
            const [detailData, dockData, appointmentData, stockData, receiptData, dispatchData, taskData, incidentData] =
                await Promise.all([
                    warehouseClient.get(warehouseId),
                    warehouseClient.listDocks(warehouseId),
                    warehouseClient.listAppointments(warehouseId),
                    warehouseClient.listStock(warehouseId),
                    warehouseClient.listReceipts(warehouseId),
                    warehouseClient.listDispatches(warehouseId),
                    warehouseClient.listTasks(warehouseId),
                    warehouseClient.listIncidents(warehouseId),
                ]);

            setDetail(detailData);
            setWarehouse(detailData.warehouse);
            setDocks(dockData);
            setAppointments(appointmentData);
            setStock(stockData);
            setReceipts(receiptData);
            setDispatches(dispatchData);
            setTasks(taskData);
            setIncidents(incidentData);
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo cargar la bodega');
        } finally {
            setLoading(false);
        }
    }, [warehouseId]);

    React.useEffect(() => {
        reload();
    }, [reload]);

    if (loading || !warehouse) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
            </div>
        );
    }

    const totalOnHand = stock.reduce((sum, item) => sum + Number(item.quantity_on_hand || 0), 0);
    const openTasks = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress').length;
    const openIncidents = incidents.filter((incident) => incident.status !== 'closed' && incident.status !== 'resolved').length;
    const planName = detail?.subscription?.plan?.name || detail?.subscription?.plan_code || 'Free';
    const activeAppointments = appointments.filter((appointment) => (
        appointment.status === 'scheduled' || appointment.status === 'checked_in' || appointment.status === 'in_progress'
    )).length;
    const dockAvailability = docks.length
        ? `${docks.filter((dock) => dock.status === 'available').length}/${docks.length}`
        : '0/0';

    return (
        <div className="wms-workspace min-w-0 space-y-4 sm:space-y-6">
            <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-950 bg-zinc-950 p-4 text-white shadow-[0_34px_90px_-52px_rgba(10,10,10,.9)] sm:p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="mb-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 sm:text-xs sm:tracking-[0.2em]">
                            <Warehouse className="h-4 w-4" />
                            <span className="min-w-0 break-words">KX Command / {warehouse.code}</span>
                        </div>
                        <h1 className="max-w-3xl break-words text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">{warehouse.name}</h1>
                        <p className="mt-3 flex max-w-3xl items-start gap-2 break-words text-sm leading-6 text-white/68">
                            <MapPin className="mt-1 h-4 w-4 shrink-0" />
                            <span>{warehouse.city}, {warehouse.department} - {warehouse.address}</span>
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <span className="max-w-full break-words rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white/74">
                                Flujo: {getFlowModeLabel(warehouse.flow_mode)}
                            </span>
                            <span className="max-w-full break-words rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white/74">
                                Plan: {planName}
                            </span>
                            <span className="max-w-full break-words rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white/74">
                                Estado: {warehouse.status}
                            </span>
                            <span className="max-w-full break-words rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white/74">
                                Stock: {totalOnHand}
                            </span>
                        </div>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[min(100%,430px)] lg:shrink-0">
                        {[
                            { label: 'Agenda activa', value: activeAppointments, icon: CalendarClock },
                            { label: 'Muelles libres', value: dockAvailability, icon: Warehouse },
                            { label: 'Tareas abiertas', value: openTasks, icon: ClipboardList },
                            { label: 'Riesgos abiertos', value: openIncidents, icon: ShieldAlert },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.06] p-3 sm:p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50 sm:text-xs sm:tracking-[0.18em]">{item.label}</p>
                                        <Icon className="h-4 w-4 text-white/56" aria-hidden="true" />
                                    </div>
                                    <p className="mt-4 break-words font-money text-2xl font-semibold leading-none text-white sm:text-3xl">{item.value}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="-mx-3 max-w-none overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:max-w-full sm:px-0">
                <div className="flex w-max max-w-none gap-2">
                {SECTION_LINKS.map((item) => {
                    const href = `/bodegas/${warehouseId}${item.suffix}`;
                    const active = item.key === section;
                    return (
                        <Link
                            key={item.key}
                            href={href}
                            className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                                active
                                    ? 'border-zinc-950 bg-zinc-950 text-white shadow-[0_16px_34px_-28px_rgba(10,10,10,.9)]'
                                    : 'border-zinc-200 bg-white/80 text-zinc-600 hover:border-zinc-950 hover:text-zinc-950'
                            }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
                </div>
            </div>

            {renderSection({
                warehouse,
                detail,
                role: detail?.role || null,
                capabilities: detail?.capabilities || null,
                docks,
                appointments,
                stock,
                receipts,
                dispatches,
                tasks,
                incidents,
                loading,
                reload,
            })}
        </div>
    );
}

export { MetricCard, SectionCard, formatDateTime, AlertTriangle, BarChart3, CalendarClock };
