'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Plus, Warehouse } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, Select, Switch, toast } from '@/components/ui';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsEmptyState,
    WmsFleetCard,
    WmsFleetDarkPanel,
    WmsFleetIdentity,
    WmsFleetInfoGrid,
    WmsFleetSection,
    WmsMetric,
    WmsMetricGrid,
    WmsStatusBadge,
} from '@/components/warehouses/WarehouseExecutionLuxury';
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

function dockTone(status: WarehouseDock['status']) {
    if (status === 'available') return 'strong' as const;
    if (status === 'maintenance') return 'muted' as const;
    return 'neutral' as const;
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
                        <div className="min-w-0 space-y-4 sm:space-y-5">
                            <WmsMetricGrid>
                                <WmsMetric label="Disponibles" value={availableDocks} />
                                <WmsMetric label="Ocupados" value={occupiedDocks} />
                                <WmsMetric label="Mantenimiento" value={maintenanceDocks} />
                            </WmsMetricGrid>

                            <div className="grid min-w-0 gap-4 sm:gap-5">
                                <SectionCard title="Crear muelle" description="Define codigo, nombre, tipo y prioridad del muelle.">
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
                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
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

                                <WmsFleetSection icon={Warehouse} title="Mapa de muelles" description="Disponibilidad, tipo y prioridad en una lectura limpia para operar el turno.">
                                    {docks.length ? (
                                    <>
                                        {docks.map((dock) => (
                                            <WmsFleetCard
                                                key={dock.id}
                                                columns={2}
                                                identity={(
                                                    <WmsFleetIdentity
                                                        eyebrow={dock.code}
                                                        title={dock.name}
                                                        subtitle="Punto fisico para programacion y control de turno."
                                                        status={<WmsStatusBadge label={getDockStatusLabel(dock.status)} tone={dockTone(dock.status)} />}
                                                    />
                                                )}
                                                info={(
                                                    <WmsFleetInfoGrid
                                                        items={[
                                                            { label: 'Tipo', value: getDockTypeLabel(dock.dock_type) },
                                                            { label: 'Prioridad', value: dock.is_default ? 'Principal' : 'Secundario' },
                                                        ]}
                                                    />
                                                )}
                                                darkPanel={(
                                                    <WmsFleetDarkPanel
                                                        label="Disponibilidad"
                                                        value={getDockStatusLabel(dock.status)}
                                                        detail={dock.status === 'available' ? 'Listo para asignar cita.' : dock.status === 'maintenance' ? 'Fuera de operacion hasta revision.' : 'Ocupado por operacion activa.'}
                                                    />
                                                )}
                                            />
                                        ))}
                                    </>
                                    ) : (
                                        <WmsEmptyState
                                            title="Sin muelles registrados"
                                            description="Crea el primero para que citas y agenda tengan un punto fisico de control."
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
