'use client';

import { useParams } from 'next/navigation';
import { BarChart3, CalendarClock, ClipboardList, Package, ShieldAlert, Warehouse } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { MetricCard, SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';

function clampPercent(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

export default function WarehouseAnalyticsPage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;

    return (
        <DashboardLayout pageTitle="Analitica de bodega">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="analytics"
                renderSection={({ appointments, dispatches, incidents, receipts, stock, tasks, docks, detail }) => {
                    const scheduledAppointments = appointments.filter((item) => item.status === 'scheduled').length;
                    const completedAppointments = appointments.filter((item) => item.status === 'completed').length;
                    const criticalIncidents = incidents.filter((item) => item.severity === 'critical' && item.status !== 'closed').length;
                    const openTasks = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress').length;
                    const dispatchedUnits = dispatches.reduce(
                        (sum, dispatchItem) =>
                            sum +
                            (dispatchItem.lines || []).reduce(
                                (lineSum, line) => lineSum + Number(line.dispatched_qty || 0),
                                0
                            ),
                        0
                    );
                    const stockUnits = stock.reduce((sum, balance) => sum + Number(balance.quantity_on_hand || 0), 0);
                    const completedRate = clampPercent(appointments.length ? (completedAppointments / appointments.length) * 100 : 0);
                    const dockAvailabilityRate = clampPercent(docks.length ? (docks.filter((dock) => dock.status === 'available').length / docks.length) * 100 : 0);
                    const dispatchReadyRate = clampPercent(dispatches.length ? (dispatches.filter((item) => item.status === 'ready' || item.status === 'dispatched').length / dispatches.length) * 100 : 0);
                    const incidentCleanRate = clampPercent(incidents.length ? (incidents.filter((item) => item.status === 'closed' || item.status === 'resolved').length / incidents.length) * 100 : 100);
                    const chartRows = [
                        { label: 'Cumplimiento de citas', value: completedRate, detail: `${completedAppointments}/${appointments.length || 0}` },
                        { label: 'Muelles disponibles', value: dockAvailabilityRate, detail: `${docks.filter((dock) => dock.status === 'available').length}/${docks.length || 0}` },
                        { label: 'Despacho listo', value: dispatchReadyRate, detail: `${dispatches.filter((item) => item.status === 'ready' || item.status === 'dispatched').length}/${dispatches.length || 0}` },
                        { label: 'Riesgo cerrado', value: incidentCleanRate, detail: `${incidents.filter((item) => item.status === 'closed' || item.status === 'resolved').length}/${incidents.length || 0}` },
                    ];
                    const businessReading = criticalIncidents > 0
                        ? 'Prioridad ejecutiva: contener incidentes criticos antes de empujar mas volumen.'
                        : scheduledAppointments > completedAppointments
                            ? 'La bodega tiene agenda viva; la oportunidad esta en proteger puntualidad y asignacion de muelle.'
                            : 'La bodega esta serena: buen momento para revisar capacidad, clientes y proximo crecimiento.';

                    return (
                        <div className="min-w-0 space-y-4 sm:space-y-6">
                            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <MetricCard icon={BarChart3} label="Citas completadas" value={completedAppointments} description={`${completedRate}% del historial`} />
                                <MetricCard icon={ClipboardList} label="Citas pendientes" value={scheduledAppointments} description="Ventanas por ejecutar" />
                                <MetricCard icon={ShieldAlert} label="Criticos abiertos" value={criticalIncidents} description="Riesgo visible" />
                                <MetricCard icon={Package} label="Unidades despachadas" value={dispatchedUnits} description="Salida acumulada" />
                            </div>

                            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] sm:gap-6">
                                <SectionCard title="Lectura de negocio" description="Resumen ejecutivo corto, sin tablero ruidoso.">
                                    <div className="space-y-5">
                                        <p className="break-words text-base font-semibold leading-7 text-zinc-950 sm:text-lg">{businessReading}</p>
                                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                                            <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Plan actual</p>
                                                <p className="mt-3 break-words text-base font-semibold text-zinc-950 sm:text-lg">{detail?.subscription?.plan?.name || detail?.subscription?.plan_code || 'Free'}</p>
                                            </div>
                                            <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Inventario avanzado</p>
                                                <p className="mt-3 break-words text-base font-semibold text-zinc-950 sm:text-lg">{detail?.subscription?.plan?.includes_inventory ? 'Activo' : 'No incluido'}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm leading-6 text-zinc-500">
                                            Este comando convierte citas, muelles, recepciones, despachos e incidentes en una lectura de control. La ejecucion profunda queda en las vistas WMS del siguiente sprint.
                                        </p>
                                    </div>
                                </SectionCard>

                                <SectionCard title="Grafica monocroma" description="Barras estables: el borde y el peso comunican prioridad sin depender de color.">
                                    <div className="space-y-5">
                                        {chartRows.map((row) => (
                                            <div key={row.label}>
                                                <div className="mb-2 flex flex-col gap-1 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                                                    <span className="break-words font-medium text-zinc-700">{row.label}</span>
                                                    <span className="break-words font-money text-zinc-950">{row.detail} / {row.value}%</span>
                                                </div>
                                                <div className="h-3 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                                                    <div
                                                        className="h-full rounded-md bg-zinc-950 transition-all"
                                                        style={{ width: `${row.value}%` }}
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            </div>

                            <SectionCard title="Pulso comercial" description="Base real para pricing, expansion y conversacion con clientes enterprise.">
                                <div className="grid min-w-0 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-4">
                                    <div className="min-w-0 rounded-lg border border-zinc-200 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Recepciones</p>
                                        <p className="mt-3 break-words font-money text-2xl font-semibold text-zinc-950">{receipts.length}</p>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-zinc-200 p-4">
                                        <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Tareas abiertas</p>
                                        <p className="mt-3 break-words font-money text-2xl font-semibold text-zinc-950">{openTasks}</p>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-zinc-200 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Stock total</p>
                                        <p className="mt-3 break-words font-money text-2xl font-semibold text-zinc-950">{stockUnits}</p>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-zinc-200 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Muelles</p>
                                        <p className="mt-3 break-words font-money text-2xl font-semibold text-zinc-950">{docks.length}</p>
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Senales que importan">
                                <div className="grid min-w-0 gap-3 md:grid-cols-3">
                                    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
                                        <CalendarClock className="mb-3 h-5 w-5 text-zinc-950" />
                                        <p className="font-semibold text-zinc-950">Puntualidad</p>
                                        <p className="mt-2 text-sm leading-6 text-zinc-500">Las citas pendientes indican si el turno necesita foco de muelles o limpieza de agenda.</p>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
                                        <Warehouse className="mb-3 h-5 w-5 text-zinc-950" />
                                        <p className="font-semibold text-zinc-950">Capacidad</p>
                                        <p className="mt-2 text-sm leading-6 text-zinc-500">Muelles y stock total muestran si la operacion tiene aire o esta llegando a saturacion.</p>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
                                        <ShieldAlert className="mb-3 h-5 w-5 text-zinc-950" />
                                        <p className="font-semibold text-zinc-950">Riesgo</p>
                                        <p className="mt-2 text-sm leading-6 text-zinc-500">Incidentes criticos quedan visibles como excepciones ejecutivas, nunca escondidas por estetica.</p>
                                    </div>
                                </div>
                            </SectionCard>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
