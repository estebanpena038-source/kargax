'use client';

import { useParams } from 'next/navigation';
import { AlertTriangle, Boxes, CalendarClock, Package, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { MetricCard, SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    formatWarehouseDateTime,
    getAppointmentStatusLabel,
    getAppointmentTypeLabel,
    getDispatchStatusLabel,
    getIncidentSeverityLabel,
    getIncidentStatusLabel,
    getReceiptStatusLabel,
} from '@/lib/warehouses/localization';

export default function WarehouseOverviewPage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;

    return (
        <DashboardLayout pageTitle="Resumen de bodega">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="overview"
                renderSection={({ appointments, dispatches, incidents, receipts, stock, tasks }) => {
                    const upcomingAppointments = appointments
                        .filter((appointment) => appointment.status !== 'completed' && appointment.status !== 'cancelled')
                        .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
                        .slice(0, 5);
                    const recentReceipts = receipts.slice(0, 4);
                    const recentDispatches = dispatches.slice(0, 4);
                    const openIncidents = incidents
                        .filter((incident) => incident.status !== 'closed' && incident.status !== 'resolved')
                        .slice(0, 4);
                    const activeTasks = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress').length;
                    const stockUnits = stock.reduce((sum, balance) => sum + Number(balance.quantity_on_hand || 0), 0);

                    return (
                        <div className="min-w-0 space-y-4 sm:space-y-6">
                            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <MetricCard icon={CalendarClock} label="Proximas citas" value={upcomingAppointments.length} description="Ventanas vivas" />
                                <MetricCard icon={Boxes} label="Recepciones" value={receipts.length} description="Historial de entrada" />
                                <MetricCard icon={Package} label="Despachos" value={dispatches.length} description="Ordenes de salida" />
                                <MetricCard icon={AlertTriangle} label="Riesgos abiertos" value={openIncidents.length} description={`${activeTasks} tareas activas`} />
                            </div>

                            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] sm:gap-6">
                                <SectionCard title="Agenda inmediata" description="Las proximas ventanas operativas aparecen primero para que el equipo no busque entre ruido.">
                                    <div className="space-y-3">
                                        {upcomingAppointments.map((appointment) => (
                                            <div key={appointment.id} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="break-words font-semibold text-zinc-950">{getAppointmentTypeLabel(appointment.appointment_type)}</p>
                                                        <p className="mt-1 text-sm text-zinc-500">
                                                            {formatWarehouseDateTime(appointment.scheduled_start)} - {formatWarehouseDateTime(appointment.scheduled_end)}
                                                        </p>
                                                    </div>
                                                    <span className="w-fit max-w-full break-words rounded-md border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 sm:tracking-[0.16em]">
                                                        {getAppointmentStatusLabel(appointment.status)}
                                                    </span>
                                                </div>
                                                <div className="mt-4 grid min-w-0 gap-2 text-sm text-zinc-600 sm:grid-cols-3">
                                                    <p className="break-words"><span className="text-zinc-400">Responsable:</span> {appointment.trucker_name || appointment.contact_name || 'Sin asignar'}</p>
                                                    <p className="break-words"><span className="text-zinc-400">Placa:</span> {appointment.vehicle_plate || 'Sin placa'}</p>
                                                    <p className="break-words"><span className="text-zinc-400">Muelle:</span> {appointment.dock?.name || 'Sin muelle'}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {upcomingAppointments.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
                                                No hay citas proximas. La bodega queda en modo limpio hasta que se programe una ventana.
                                            </div>
                                        ) : null}
                                    </div>
                                </SectionCard>

                                <SectionCard title="Pulso operativo" description="Lectura corta para decidir sin abrir modulos de ejecucion.">
                                    <div className="space-y-4">
                                        <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Stock total</p>
                                            <p className="mt-3 break-words font-money text-2xl font-semibold text-zinc-950 sm:text-3xl">{stockUnits}</p>
                                            <p className="mt-2 text-sm text-zinc-500">{stock.length} saldos registrados</p>
                                        </div>
                                        <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Siguiente decision</p>
                                            <p className="mt-3 break-words text-sm leading-6 text-zinc-700">
                                                {openIncidents.length > 0
                                                    ? 'Resolver riesgo abierto antes de acelerar nuevas salidas.'
                                                    : upcomingAppointments.length > 0
                                                        ? 'Preparar muelle, responsable y ventana para la siguiente cita.'
                                                        : 'Programar la proxima ventana o mantener la bodega en observacion.'}
                                            </p>
                                        </div>
                                    </div>
                                </SectionCard>
                            </div>

                            <div className="grid min-w-0 gap-4 lg:grid-cols-2 sm:gap-6">
                                <SectionCard title="Recepciones recientes">
                                    <div className="space-y-3">
                                        {recentReceipts.map((receipt) => (
                                            <div key={receipt.id} className="min-w-0 rounded-lg border border-zinc-200 p-4">
                                                <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="break-words font-money text-sm font-semibold text-zinc-950">{receipt.receipt_number}</p>
                                                        <p className="mt-1 text-sm text-zinc-500">{formatWarehouseDateTime(receipt.received_at)}</p>
                                                    </div>
                                                    <span className="w-fit max-w-full break-words rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                                        {getReceiptStatusLabel(receipt.status)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {recentReceipts.length === 0 ? (
                                            <p className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">Sin recepciones recientes.</p>
                                        ) : null}
                                    </div>
                                </SectionCard>

                                <SectionCard title="Despachos recientes">
                                    <div className="space-y-3">
                                        {recentDispatches.map((dispatchItem) => (
                                            <div key={dispatchItem.id} className="min-w-0 rounded-lg border border-zinc-200 p-4">
                                                <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="break-words font-money text-sm font-semibold text-zinc-950">{dispatchItem.dispatch_number}</p>
                                                        <p className="mt-1 text-sm text-zinc-500">{formatWarehouseDateTime(dispatchItem.scheduled_at || dispatchItem.created_at)}</p>
                                                    </div>
                                                    <span className="w-fit max-w-full break-words rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                                        {getDispatchStatusLabel(dispatchItem.status)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {recentDispatches.length === 0 ? (
                                            <p className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">Sin despachos recientes.</p>
                                        ) : null}
                                    </div>
                                </SectionCard>
                            </div>

                            <SectionCard title="Riesgo e incidentes" description="Solo se muestran riesgos abiertos o en investigacion; si no hay riesgo, la pantalla descansa.">
                                <div className="space-y-3">
                                    {openIncidents.map((incident) => (
                                        <div key={incident.id} className="min-w-0 rounded-lg border border-zinc-300 bg-white p-4">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div className="min-w-0">
                                                    <p className="break-words font-semibold text-zinc-950">{incident.title}</p>
                                                    <p className="mt-1 break-words text-sm text-zinc-500">{incident.description}</p>
                                                </div>
                                                <div className="flex min-w-0 flex-wrap gap-2">
                                                    <span className="max-w-full break-words rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                                        {getIncidentSeverityLabel(incident.severity)}
                                                    </span>
                                                    <span className="max-w-full break-words rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                                        {getIncidentStatusLabel(incident.status)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {openIncidents.length === 0 ? (
                                        <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
                                            <ShieldCheck className="h-5 w-5 text-zinc-950" />
                                            No hay incidentes abiertos. Operacion limpia para el siguiente turno.
                                        </div>
                                    ) : null}
                                </div>
                            </SectionCard>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
