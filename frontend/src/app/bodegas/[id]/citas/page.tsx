'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AndeanPhoneInput, Button, Input, Select, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import warehouseClient from '@/lib/warehouses/client';
import {
    formatWarehouseDateTime,
    getAppointmentStatusLabel,
    getAppointmentTypeLabel,
    getWarehouseActionLabel,
    mapWarehouseErrorMessage,
    resolveWarehouseCountry,
} from '@/lib/warehouses/localization';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsActionRow,
    WmsEmptyState,
    WmsFleetCard,
    WmsFleetDarkPanel,
    WmsFleetIdentity,
    WmsFleetInfoGrid,
    WmsFleetSection,
    WmsStatusBadge,
} from '@/components/warehouses/WarehouseExecutionLuxury';

function appointmentTone(status: string) {
    if (status === 'completed') return 'strong' as const;
    if (status === 'cancelled') return 'muted' as const;
    return 'neutral' as const;
}

export default function WarehouseAppointmentsPage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;
    const { user } = useAuthStore();
    const countryCode = resolveWarehouseCountry(user?.country);
    const [saving, setSaving] = React.useState(false);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [form, setForm] = React.useState({
        appointmentType: 'pickup',
        dockId: '',
        scheduledStart: '',
        scheduledEnd: '',
        offerId: '',
        vehiclePlate: '',
        truckerName: '',
        truckerPhone: '',
        contactName: '',
        contactPhone: '',
        notes: '',
    });

    return (
        <DashboardLayout pageTitle="Citas de bodega">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="appointments"
                renderSection={({ appointments, docks, capabilities, reload }) => {
                    const orderedAppointments = [...appointments].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
                    const liveAppointments = orderedAppointments.filter((appointment) => appointment.status !== 'completed' && appointment.status !== 'cancelled');
                    const historicalAppointments = orderedAppointments.filter((appointment) => appointment.status === 'completed' || appointment.status === 'cancelled').slice(-5).reverse();

                    return (
                        <div className="grid min-w-0 gap-4 sm:gap-5">
                            <SectionCard title="Programar cita" description="Una ventana operativa debe quedar clara antes de tocar la bodega: tipo, muelle, horario y responsable.">
                                <div className="space-y-5">
                                    <div className="grid min-w-0 gap-4">
                                        <Select
                                            label="Tipo"
                                            value={form.appointmentType}
                                            onChange={(value) => setForm((current) => ({ ...current, appointmentType: value }))}
                                            options={['pickup', 'delivery', 'receipt', 'dispatch'].map((value) => ({ value, label: getAppointmentTypeLabel(value as never) }))}
                                        />
                                        <Select
                                            label="Muelle"
                                            value={form.dockId}
                                            onChange={(value) => setForm((current) => ({ ...current, dockId: value }))}
                                            options={docks.map((dock) => ({ value: dock.id, label: `${dock.code} - ${dock.name}`, description: dock.status }))}
                                            placeholder="Selecciona muelle"
                                        />
                                        <Input label="Inicio" type="datetime-local" value={form.scheduledStart} onChange={(event) => setForm((current) => ({ ...current, scheduledStart: event.target.value }))} />
                                        <Input label="Fin" type="datetime-local" value={form.scheduledEnd} onChange={(event) => setForm((current) => ({ ...current, scheduledEnd: event.target.value }))} />
                                        <Input label="Viaje vinculado" value={form.offerId} onChange={(event) => setForm((current) => ({ ...current, offerId: event.target.value }))} helperText="Opcional. Usa Offer ID si viene de un viaje existente." />
                                        <Input label="Placa" value={form.vehiclePlate} onChange={(event) => setForm((current) => ({ ...current, vehiclePlate: event.target.value.toUpperCase() }))} />
                                        <Input label="Conductor" value={form.truckerName} onChange={(event) => setForm((current) => ({ ...current, truckerName: event.target.value }))} />
                                        <Input label="Contacto de bodega" value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
                                        <AndeanPhoneInput label="Telefono del conductor" value={form.truckerPhone} onChange={(value) => setForm((current) => ({ ...current, truckerPhone: value }))} defaultCountryCode={countryCode} />
                                        <AndeanPhoneInput label="Telefono del contacto" value={form.contactPhone} onChange={(value) => setForm((current) => ({ ...current, contactPhone: value }))} defaultCountryCode={countryCode} />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-zinc-700" htmlFor="appointment-notes">
                                            Notas operativas
                                        </label>
                                        <textarea
                                            id="appointment-notes"
                                            value={form.notes}
                                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                            className="min-h-[112px] w-full min-w-0 rounded-lg border border-zinc-200 bg-white/90 px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
                                            placeholder="Instrucciones de acceso, documentos o restriccion de muelle."
                                        />
                                    </div>
                                    <Button
                                        fullWidth
                                        isLoading={saving}
                                        disabled={!capabilities?.manageAppointments}
                                        onClick={async () => {
                                            setSaving(true);
                                            try {
                                                await warehouseClient.createAppointment(warehouseId, {
                                                    ...form,
                                                    offerId: form.offerId.trim() || undefined,
                                                });
                                                setForm({ appointmentType: 'pickup', dockId: '', scheduledStart: '', scheduledEnd: '', offerId: '', vehiclePlate: '', truckerName: '', truckerPhone: '', contactName: '', contactPhone: '', notes: '' });
                                                toast.success('Cita creada');
                                                await reload();
                                            } catch (error) {
                                                toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo crear la cita');
                                            } finally {
                                                setSaving(false);
                                            }
                                        }}
                                    >
                                        Programar cita
                                    </Button>
                                </div>
                            </SectionCard>

                            <div className="min-w-0 space-y-4 sm:space-y-5">
                                <WmsFleetSection icon={CalendarClock} title="Agenda viva" description="Horario, muelle, placa y responsable listos para ejecutar el turno.">
                                    {liveAppointments.length ? (
                                    <>
                                        {liveAppointments.map((appointment) => (
                                            <WmsFleetCard
                                                key={appointment.id}
                                                identity={(
                                                    <WmsFleetIdentity
                                                        title={getAppointmentTypeLabel(appointment.appointment_type)}
                                                        subtitle={`${formatWarehouseDateTime(appointment.scheduled_start, countryCode)} - ${formatWarehouseDateTime(appointment.scheduled_end, countryCode)}`}
                                                        status={<WmsStatusBadge label={getAppointmentStatusLabel(appointment.status)} tone={appointmentTone(appointment.status)} />}
                                                        activity={`Placa: ${appointment.vehicle_plate || 'Sin placa'}`}
                                                    />
                                                )}
                                                info={(
                                                    <WmsFleetInfoGrid
                                                        items={[
                                                            { label: 'Inicio', value: formatWarehouseDateTime(appointment.scheduled_start, countryCode) },
                                                            { label: 'Fin', value: formatWarehouseDateTime(appointment.scheduled_end, countryCode) },
                                                            { label: 'Muelle', value: appointment.dock?.name || 'Sin muelle' },
                                                            { label: 'Responsable', value: appointment.trucker_name || appointment.contact_name || 'Sin responsable asignado' },
                                                        ]}
                                                    />
                                                )}
                                                darkPanel={<WmsFleetDarkPanel label="Estado de cita" value={getAppointmentStatusLabel(appointment.status)} detail="Acciones disponibles segun etapa operativa." />}
                                                actions={capabilities?.manageAppointments ? (
                                                    <WmsActionRow>
                                                        {(appointment.status === 'scheduled' ? ['checked_in', 'cancelled']
                                                            : appointment.status === 'checked_in' ? ['in_progress', 'completed', 'cancelled']
                                                                : appointment.status === 'in_progress' ? ['completed', 'cancelled']
                                                                    : []
                                                        ).map((nextStatus) => (
                                                            <Button
                                                                key={nextStatus}
                                                                size="sm"
                                                                variant={nextStatus === 'cancelled' ? 'outline' : 'primary'}
                                                                disabled={processingId === appointment.id}
                                                                onClick={async () => {
                                                                    try {
                                                                        setProcessingId(appointment.id);
                                                                        await warehouseClient.updateAppointment(warehouseId, appointment.id, { status: nextStatus });
                                                                        toast.success('Cita actualizada');
                                                                        await reload();
                                                                    } catch (error) {
                                                                        toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo actualizar la cita');
                                                                    } finally {
                                                                        setProcessingId(null);
                                                                    }
                                                                }}
                                                            >
                                                                {getWarehouseActionLabel(nextStatus)}
                                                            </Button>
                                                        ))}
                                                    </WmsActionRow>
                                                ) : null}
                                            />
                                        ))}
                                    </>
                                    ) : (
                                        <WmsEmptyState
                                            title="Agenda limpia"
                                            description="No hay citas vivas para operar en este momento."
                                        />
                                    )}
                                </WmsFleetSection>

                                <WmsFleetSection icon={CalendarClock} title="Cerradas y canceladas">
                                    {historicalAppointments.length ? (
                                    <>
                                        {historicalAppointments.map((appointment) => (
                                            <WmsFleetCard
                                                key={appointment.id}
                                                columns={2}
                                                identity={(
                                                    <WmsFleetIdentity
                                                        title={getAppointmentTypeLabel(appointment.appointment_type)}
                                                        subtitle={formatWarehouseDateTime(appointment.scheduled_start, countryCode)}
                                                        status={<WmsStatusBadge label={getAppointmentStatusLabel(appointment.status)} tone={appointmentTone(appointment.status)} />}
                                                    />
                                                )}
                                                darkPanel={<WmsFleetDarkPanel label="Resultado" value={getAppointmentStatusLabel(appointment.status)} detail={appointment.dock?.name || 'Sin muelle'} />}
                                            />
                                        ))}
                                    </>
                                    ) : (
                                        <WmsEmptyState
                                            title="Sin historial cerrado"
                                            description="Las citas completadas o canceladas apareceran aqui."
                                        />
                                    )}
                                </WmsFleetSection>
                            </div>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
