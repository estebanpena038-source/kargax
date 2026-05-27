'use client';

import { useParams } from 'next/navigation';
import { AlertTriangle, Boxes, CalendarClock, Package } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { MetricCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsEmptyState,
    WmsFleetCard,
    WmsFleetDarkPanel,
    WmsFleetIdentity,
    WmsFleetInfoGrid,
    WmsFleetSection,
    WmsStatusBadge,
} from '@/components/warehouses/WarehouseExecutionLuxury';
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
                        <div className="min-w-0 space-y-4 sm:space-y-5">
                            <div className="grid min-w-0 gap-4">
                                <MetricCard icon={CalendarClock} label="Proximas citas" value={upcomingAppointments.length} description="Ventanas vivas" />
                                <MetricCard icon={Boxes} label="Recepciones" value={receipts.length} description="Historial de entrada" />
                                <MetricCard icon={Package} label="Despachos" value={dispatches.length} description="Ordenes de salida" />
                                <MetricCard icon={AlertTriangle} label="Riesgos abiertos" value={openIncidents.length} description={`${activeTasks} tareas activas`} />
                            </div>

                            <div className="grid min-w-0 gap-4 sm:gap-5">
                                <WmsFleetSection icon={CalendarClock} title="Agenda inmediata" description="Ventanas, responsables y muelles en lectura rapida.">
                                    {upcomingAppointments.map((appointment) => (
                                        <WmsFleetCard
                                            key={appointment.id}
                                            identity={(
                                                <WmsFleetIdentity
                                                    title={getAppointmentTypeLabel(appointment.appointment_type)}
                                                    subtitle={`${formatWarehouseDateTime(appointment.scheduled_start)} - ${formatWarehouseDateTime(appointment.scheduled_end)}`}
                                                    status={<WmsStatusBadge label={getAppointmentStatusLabel(appointment.status)} />}
                                                />
                                            )}
                                            info={(
                                                <WmsFleetInfoGrid
                                                    items={[
                                                        { label: 'Responsable', value: appointment.trucker_name || appointment.contact_name || 'Sin asignar' },
                                                        { label: 'Placa', value: appointment.vehicle_plate || 'Sin placa' },
                                                    ]}
                                                />
                                            )}
                                            darkPanel={<WmsFleetDarkPanel label="Muelle" value={appointment.dock?.name || 'Sin muelle'} detail="Preparar punto de control antes del check-in." />}
                                        />
                                    ))}
                                    {upcomingAppointments.length === 0 ? (
                                        <WmsEmptyState title="Agenda despejada" description="No hay citas proximas. Programa una ventana cuando el turno lo necesite." />
                                    ) : null}
                                </WmsFleetSection>

                                <WmsFleetSection icon={Boxes} title="Pulso operativo" description="Capacidad, stock y siguiente decision sin ruido.">
                                    <WmsFleetCard
                                        columns={2}
                                        identity={<WmsFleetIdentity title="Stock total" subtitle={`${stock.length} saldos registrados`} activity="Lectura ejecutiva de bodega" />}
                                        darkPanel={(
                                            <WmsFleetDarkPanel
                                                label="Siguiente decision"
                                                value={stockUnits}
                                                detail={openIncidents.length > 0
                                                    ? 'Resolver riesgo abierto antes de acelerar nuevas salidas.'
                                                    : upcomingAppointments.length > 0
                                                        ? 'Preparar muelle, responsable y ventana para la siguiente cita.'
                                                        : 'Programar la proxima ventana o mantener la bodega en observacion.'}
                                            />
                                        )}
                                    />
                                </WmsFleetSection>
                            </div>

                            <div className="grid min-w-0 gap-4 sm:gap-5">
                                <WmsFleetSection icon={Boxes} title="Recepciones recientes">
                                    {recentReceipts.map((receipt) => (
                                        <WmsFleetCard
                                            key={receipt.id}
                                            columns={2}
                                            identity={(
                                                <WmsFleetIdentity
                                                    title={receipt.receipt_number}
                                                    subtitle={formatWarehouseDateTime(receipt.received_at)}
                                                    status={<WmsStatusBadge label={getReceiptStatusLabel(receipt.status)} />}
                                                />
                                            )}
                                            darkPanel={<WmsFleetDarkPanel label="Estado" value={getReceiptStatusLabel(receipt.status)} detail="Entrada registrada en WMS." />}
                                        />
                                    ))}
                                    {recentReceipts.length === 0 ? (
                                        <WmsEmptyState title="Sin recepciones recientes" description="Las entradas cerradas apareceran aqui." />
                                    ) : null}
                                </WmsFleetSection>

                                <WmsFleetSection icon={Package} title="Despachos recientes">
                                    {recentDispatches.map((dispatchItem) => (
                                        <WmsFleetCard
                                            key={dispatchItem.id}
                                            columns={2}
                                            identity={(
                                                <WmsFleetIdentity
                                                    title={dispatchItem.dispatch_number}
                                                    subtitle={formatWarehouseDateTime(dispatchItem.scheduled_at || dispatchItem.created_at)}
                                                    status={<WmsStatusBadge label={getDispatchStatusLabel(dispatchItem.status)} />}
                                                />
                                            )}
                                            darkPanel={<WmsFleetDarkPanel label="Estado" value={getDispatchStatusLabel(dispatchItem.status)} detail="Salida registrada para seguimiento." />}
                                        />
                                    ))}
                                    {recentDispatches.length === 0 ? (
                                        <WmsEmptyState title="Sin despachos recientes" description="Las salidas registradas apareceran aqui." />
                                    ) : null}
                                </WmsFleetSection>
                            </div>

                            <WmsFleetSection icon={AlertTriangle} title="Riesgo e incidentes" description="Excepciones abiertas con severidad y estado visibles.">
                                {openIncidents.map((incident) => (
                                    <WmsFleetCard
                                        key={incident.id}
                                        identity={(
                                            <WmsFleetIdentity
                                                title={incident.title}
                                                subtitle={<span className="line-clamp-2">{incident.description}</span>}
                                                status={<WmsStatusBadge label={getIncidentSeverityLabel(incident.severity)} tone={incident.severity === 'critical' ? 'critical' : 'neutral'} />}
                                            />
                                        )}
                                        info={<WmsFleetInfoGrid items={[{ label: 'Estado', value: getIncidentStatusLabel(incident.status) }]} />}
                                        darkPanel={<WmsFleetDarkPanel label="Riesgo" value={getIncidentSeverityLabel(incident.severity)} detail="Debe permanecer visible hasta su cierre." />}
                                    />
                                ))}
                                {openIncidents.length === 0 ? (
                                    <WmsEmptyState title="Operacion limpia" description="No hay incidentes abiertos para el siguiente turno." />
                                ) : null}
                            </WmsFleetSection>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
