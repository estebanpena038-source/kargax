'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Anchor, CheckCircle2, Plus, Warehouse } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, Select, Switch, toast } from '@/components/ui';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import warehouseClient from '@/lib/warehouses/client';
import { getDockTypeLabel, mapWarehouseErrorMessage } from '@/lib/warehouses/localization';
import type { WarehouseDock } from '@/lib/warehouses/types';

function getDockStatusLabel(status: WarehouseDock['status']) {
    const labels: Record<WarehouseDock['status'], string> = {
        available: 'Disponible',
        occupied: 'Ocupado',
        maintenance: 'Mantenimiento',
    };

    return labels[status] || status;
}

function getDockBorderClass(status: WarehouseDock['status']) {
    if (status === 'available') {
        return 'border-zinc-950 bg-white';
    }

    if (status === 'maintenance') {
        return 'border-dashed border-zinc-300 bg-zinc-50';
    }

    return 'border-zinc-300 bg-white';
}

export default function WarehouseDocksPage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;
    const [form, setForm] = React.useState({ code: '', name: '', dockType: 'mixed', isDefault: false });
    const [saving, setSaving] = React.useState(false);

    return (
        <DashboardLayout pageTitle="Muelles">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="docks"
                renderSection={({ docks, capabilities, reload }) => {
                    const availableDocks = docks.filter((dock) => dock.status === 'available').length;
                    const occupiedDocks = docks.filter((dock) => dock.status === 'occupied').length;
                    const maintenanceDocks = docks.filter((dock) => dock.status === 'maintenance').length;

                    return (
                        <div className="min-w-0 space-y-4 sm:space-y-6">
                            <div className="grid min-w-0 gap-4 min-[520px]:grid-cols-3">
                                <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Disponibles</p>
                                    <p className="mt-3 break-words font-money text-2xl font-semibold text-zinc-950 sm:text-3xl">{availableDocks}</p>
                                </div>
                                <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Ocupados</p>
                                    <p className="mt-3 break-words font-money text-2xl font-semibold text-zinc-950 sm:text-3xl">{occupiedDocks}</p>
                                </div>
                                <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
                                    <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Mantenimiento</p>
                                    <p className="mt-3 break-words font-money text-2xl font-semibold text-zinc-950 sm:text-3xl">{maintenanceDocks}</p>
                                </div>
                            </div>

                            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-6">
                                <SectionCard title="Crear muelle" description="Simple, estable y sin friccion: codigo, nombre, tipo y si sera el principal.">
                                    <div className="space-y-4">
                                        <Input label="Codigo" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="M-01" />
                                        <Input label="Nombre" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Muelle norte" />
                                        <Select
                                            label="Tipo"
                                            value={form.dockType}
                                            onChange={(value) => setForm((current) => ({ ...current, dockType: value }))}
                                            options={[
                                                { value: 'loading', label: 'Carga' },
                                                { value: 'unloading', label: 'Descarga' },
                                                { value: 'mixed', label: 'Mixto' },
                                            ]}
                                        />
                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <Switch
                                                label="Muelle principal"
                                                description="Aparece como referencia para programacion rapida."
                                                checked={form.isDefault}
                                                onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: checked }))}
                                            />
                                        </div>
                                        <Button
                                            fullWidth
                                            isLoading={saving}
                                            disabled={!capabilities?.manageDocks}
                                            leftIcon={<Plus className="h-4 w-4" />}
                                            onClick={async () => {
                                                setSaving(true);
                                                try {
                                                    await warehouseClient.createDock(warehouseId, form);
                                                    setForm({ code: '', name: '', dockType: 'mixed', isDefault: false });
                                                    toast.success('Muelle creado');
                                                    await reload();
                                                } catch (error) {
                                                    toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo crear el muelle');
                                                } finally {
                                                    setSaving(false);
                                                }
                                            }}
                                        >
                                            Crear muelle
                                        </Button>
                                    </div>
                                </SectionCard>

                                <SectionCard title="Mapa de muelles" description="Grid estable: disponibilidad comunicada por borde, peso y texto; nunca solo color.">
                                    <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
                                        {docks.map((dock) => (
                                            <div
                                                key={dock.id}
                                                className={`flex min-h-[190px] min-w-0 flex-col justify-between rounded-lg border-2 p-4 sm:p-5 ${getDockBorderClass(dock.status)}`}
                                            >
                                                <div>
                                                    <div className="mb-4 flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="break-words font-money text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.2em]">{dock.code}</p>
                                                            <h3 className="mt-2 break-words text-lg font-semibold text-zinc-950">{dock.name}</h3>
                                                        </div>
                                                        <Warehouse className="h-5 w-5 shrink-0 text-zinc-950" />
                                                    </div>
                                                    <div className="space-y-2 text-sm text-zinc-600">
                                                        <p className="break-words"><span className="text-zinc-400">Tipo:</span> {getDockTypeLabel(dock.dock_type)}</p>
                                                        <p className="break-words"><span className="text-zinc-400">Estado:</span> <span className="font-semibold text-zinc-950">{getDockStatusLabel(dock.status)}</span></p>
                                                    </div>
                                                </div>
                                                <div className="mt-5 flex flex-col gap-3 border-t border-zinc-200 pt-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                                                    <span className="break-words text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:tracking-[0.16em]">
                                                        {dock.is_default ? 'Principal' : 'Secundario'}
                                                    </span>
                                                    {dock.status === 'available' ? <CheckCircle2 className="h-5 w-5 text-zinc-950" /> : <Anchor className="h-5 w-5 text-zinc-500" />}
                                                </div>
                                            </div>
                                        ))}
                                        {docks.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
                                                No hay muelles registrados. Crea el primero para que citas y agenda tengan un punto fisico de control.
                                            </div>
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
