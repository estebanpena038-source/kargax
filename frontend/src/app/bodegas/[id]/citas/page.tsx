'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { CalendarClock, Clock, Truck, UserRound, Warehouse } from 'lucide-react';
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

function StatusText({ value }: { value: string }) {
    return (
        <span className="w-fit max-w-full break-words rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 sm:tracking-[0.16em]">
            {value}
        </span>
    );
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
                        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] sm:gap-6">
                            <SectionCard title="Programar cita" description="Una ventana operativa debe quedar clara antes de tocar la bodega: tipo, muelle, horario y responsable.">
                                <div className="space-y-5">
                                    <div className="grid min-w-0 gap-4 md:grid-cols-2">
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

                            <div className="min-w-0 space-y-4 sm:space-y-6">
                                <SectionCard title="Agenda viva" description="Vista tipo calendario/lista para ejecutar el dia sin abrir detalles innecesarios.">
                                    <div className="space-y-3">
                                        {liveAppointments.map((appointment) => (
                                            <div key={appointment.id} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="break-words font-semibold text-zinc-950">{getAppointmentTypeLabel(appointment.appointment_type)}</p>
                                                            <StatusText value={getAppointmentStatusLabel(appointment.status)} />
                                                        </div>
                                                        <div className="mt-4 grid min-w-0 gap-3 text-sm text-zinc-600 sm:grid-cols-2">
                                                            <p className="flex items-start gap-2">
                                                                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                                <span className="min-w-0 break-words">{formatWarehouseDateTime(appointment.scheduled_start, countryCode)}</span>
                                                            </p>
                                                            <p className="flex items-start gap-2">
                                                                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                                <span className="min-w-0 break-words">{formatWarehouseDateTime(appointment.scheduled_end, countryCode)}</span>
                                                            </p>
                                                            <p className="flex items-start gap-2">
                                                                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                                <span className="min-w-0 break-words">{appointment.vehicle_plate || 'Sin placa'}</span>
                                                            </p>
                                                            <p className="flex items-start gap-2">
                                                                <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                                <span className="min-w-0 break-words">{appointment.dock?.name || 'Sin muelle'}</span>
                                                            </p>
                                                            <p className="flex items-start gap-2 sm:col-span-2">
                                                                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                                <span className="min-w-0 break-words">{appointment.trucker_name || appointment.contact_name || 'Sin responsable asignado'}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {capabilities?.manageAppointments ? (
                                                        <div className="flex min-w-0 flex-wrap gap-2 lg:shrink-0 lg:justify-end">
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
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))}
                                        {liveAppointments.length === 0 ? (
                                            <p className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
                                                No hay citas vivas. La agenda esta limpia.
                                            </p>
                                        ) : null}
                                    </div>
                                </SectionCard>

                                <SectionCard title="Cerradas y canceladas">
                                    <div className="space-y-3">
                                        {historicalAppointments.map((appointment) => (
                                            <div key={appointment.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="break-words font-semibold text-zinc-950">{getAppointmentTypeLabel(appointment.appointment_type)}</p>
                                                    <p className="mt-1 text-sm text-zinc-500">{formatWarehouseDateTime(appointment.scheduled_start, countryCode)}</p>
                                                </div>
                                                <StatusText value={getAppointmentStatusLabel(appointment.status)} />
                                            </div>
                                        ))}
                                        {historicalAppointments.length === 0 ? (
                                            <p className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
                                                Aun no hay historial cerrado.
                                            </p>
                                        ) : null}
                                    </div>
                                </SectionCard>
                            </div>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
