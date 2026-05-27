'use client';

import { useParams } from 'next/navigation';
import { BarChart3, ClipboardList, Package, ShieldAlert } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { MetricCard, SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsFleetCard,
    WmsFleetDarkPanel,
    WmsFleetIdentity,
    WmsFleetInfoGrid,
    WmsFleetSection,
    WmsMetric,
    WmsMetricGrid,
    WmsProgress,
} from '@/components/warehouses/WarehouseExecutionLuxury';

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
                        <div className="min-w-0 space-y-4 sm:space-y-5">
                            <div className="grid min-w-0 gap-4">
                                <MetricCard icon={BarChart3} label="Citas completadas" value={completedAppointments} description={`${completedRate}% del historial`} />
                                <MetricCard icon={ClipboardList} label="Citas pendientes" value={scheduledAppointments} description="Ventanas por ejecutar" />
                                <MetricCard icon={ShieldAlert} label="Criticos abiertos" value={criticalIncidents} description="Riesgo visible" />
                                <MetricCard icon={Package} label="Unidades despachadas" value={dispatchedUnits} description="Salida acumulada" />
                            </div>

                            <div className="grid min-w-0 gap-4 sm:gap-5">
                                <SectionCard title="Lectura de negocio" description="Resumen ejecutivo corto, sin tablero ruidoso.">
                                    <div className="space-y-5">
                                        <p className="break-words text-base font-semibold leading-7 text-zinc-950 sm:text-lg">{businessReading}</p>
                                        <div className="grid min-w-0 gap-3">
                                            <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Plan actual</p>
                                                <p className="mt-3 break-words text-base font-semibold text-zinc-950 sm:text-lg">{detail?.subscription?.plan?.name || detail?.subscription?.plan_code || 'Free'}</p>
                                            </div>
                                            <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                                <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Inventario avanzado</p>
                                                <p className="mt-3 break-words text-base font-semibold text-zinc-950 sm:text-lg">{detail?.subscription?.plan?.includes_inventory ? 'Activo' : 'No incluido'}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm leading-6 text-zinc-500">
                                            Este comando convierte citas, muelles, recepciones, despachos e incidentes en una lectura de control. La ejecucion profunda queda en las vistas WMS del siguiente sprint.
                                        </p>
                                    </div>
                                </SectionCard>

                                <SectionCard title="Indicadores de control" description="Avance, capacidad y riesgo en lectura rapida.">
                                    <div className="space-y-5">
                                        {chartRows.map((row) => (
                                            <WmsProgress key={row.label} label={`${row.label} / ${row.detail}`} value={row.value} total={100} />
                                        ))}
                                    </div>
                                </SectionCard>
                            </div>

                            <SectionCard title="Pulso comercial" description="Base real para pricing, expansion y conversacion con clientes enterprise.">
                                <WmsMetricGrid>
                                    <WmsMetric label="Recepciones" value={receipts.length} />
                                    <WmsMetric label="Tareas abiertas" value={openTasks} />
                                    <WmsMetric label="Stock total" value={stockUnits} />
                                    <WmsMetric label="Muelles" value={docks.length} />
                                </WmsMetricGrid>
                            </SectionCard>

                            <WmsFleetSection icon={BarChart3} title="Senales que importan">
                                <WmsFleetCard
                                    identity={<WmsFleetIdentity title="Puntualidad" subtitle="Las citas pendientes indican si el turno necesita foco de muelles o limpieza de agenda." />}
                                    info={<WmsFleetInfoGrid items={[{ label: 'Pendientes', value: scheduledAppointments }, { label: 'Completadas', value: completedAppointments }]} />}
                                    darkPanel={<WmsFleetDarkPanel label="Cumplimiento" value={`${completedRate}%`} detail={chartRows[0]?.detail} />}
                                />
                                <WmsFleetCard
                                    identity={<WmsFleetIdentity title="Capacidad" subtitle="Muelles y stock total muestran si la operacion tiene aire o esta llegando a saturacion." />}
                                    info={<WmsFleetInfoGrid items={[{ label: 'Muelles', value: docks.length }, { label: 'Stock', value: stockUnits }]} />}
                                    darkPanel={<WmsFleetDarkPanel label="Disponibilidad" value={`${dockAvailabilityRate}%`} detail={chartRows[1]?.detail} />}
                                />
                                <WmsFleetCard
                                    identity={<WmsFleetIdentity title="Riesgo" subtitle="Incidentes criticos quedan visibles como excepciones ejecutivas." />}
                                    info={<WmsFleetInfoGrid items={[{ label: 'Criticos', value: criticalIncidents }, { label: 'Incidentes', value: incidents.length }]} />}
                                    darkPanel={<WmsFleetDarkPanel label="Riesgo cerrado" value={`${incidentCleanRate}%`} detail={chartRows[3]?.detail} />}
                                />
                            </WmsFleetSection>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
