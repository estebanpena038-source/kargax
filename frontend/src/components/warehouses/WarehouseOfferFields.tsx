'use client';

import * as React from 'react';
import { Building2 } from 'lucide-react';
import { Select } from '@/components/ui';
import warehouseClient from '@/lib/warehouses/client';
import type { Warehouse, WarehouseDock } from '@/lib/warehouses/types';

type WarehouseFieldName =
    | 'warehouseFlowMode'
    | 'originWarehouseId'
    | 'destinationWarehouseId'
    | 'originDockId'
    | 'destinationDockId';

interface WarehouseOfferFieldsProps {
    watch: (name: WarehouseFieldName) => string;
    setValue: (name: WarehouseFieldName, value: string) => void;
}

export function WarehouseOfferFields({ watch, setValue }: WarehouseOfferFieldsProps) {
    const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
    const [originDocks, setOriginDocks] = React.useState<WarehouseDock[]>([]);
    const [destinationDocks, setDestinationDocks] = React.useState<WarehouseDock[]>([]);

    const originWarehouseId = watch('originWarehouseId');
    const destinationWarehouseId = watch('destinationWarehouseId');

    React.useEffect(() => {
        warehouseClient
            .list()
            .then((result) => setWarehouses(result.data))
            .catch(() => setWarehouses([]));
    }, []);

    React.useEffect(() => {
        if (!originWarehouseId) {
            setOriginDocks([]);
            setValue('originDockId', '');
            return;
        }

        warehouseClient
            .listDocks(originWarehouseId)
            .then((result) => setOriginDocks(result))
            .catch(() => setOriginDocks([]));
    }, [originWarehouseId, setValue]);

    React.useEffect(() => {
        if (!destinationWarehouseId) {
            setDestinationDocks([]);
            setValue('destinationDockId', '');
            return;
        }

        warehouseClient
            .listDocks(destinationWarehouseId)
            .then((result) => setDestinationDocks(result))
            .catch(() => setDestinationDocks([]));
    }, [destinationWarehouseId, setValue]);

    const warehouseOptions = warehouses.map((warehouse) => ({
        value: warehouse.id,
        label: `${warehouse.code} - ${warehouse.name}`,
        description: `${warehouse.city}, ${warehouse.department}`,
    }));

    return (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Building2 className="h-5 w-5" />
                </div>
                <div>
                    <h4 className="font-semibold text-slate-900">Bodega KargaX</h4>
                    <p className="text-sm text-slate-500">Conecta origen y destino con muelles y agenda operativa.</p>
                </div>
            </div>

            <Select
                label="Modo de flujo"
                value={watch('warehouseFlowMode')}
                onChange={(value) => setValue('warehouseFlowMode', value)}
                options={[
                    { value: 'manual', label: 'Manual' },
                    { value: 'warehouse_managed', label: 'Warehouse managed' },
                    { value: '3pl', label: '3PL' },
                ]}
            />

            <div className="grid gap-4">
                <Select
                    label="Bodega origen"
                    value={watch('originWarehouseId')}
                    onChange={(value) => setValue('originWarehouseId', value)}
                    options={warehouseOptions}
                    placeholder="Selecciona bodega"
                    searchable
                />
                <Select
                    label="Muelle origen"
                    value={watch('originDockId')}
                    onChange={(value) => setValue('originDockId', value)}
                    options={originDocks.map((dock) => ({ value: dock.id, label: `${dock.code} - ${dock.name}` }))}
                    placeholder="Opcional"
                    disabled={!originWarehouseId}
                />
            </div>

            <div className="grid gap-4">
                <Select
                    label="Bodega destino"
                    value={watch('destinationWarehouseId')}
                    onChange={(value) => setValue('destinationWarehouseId', value)}
                    options={warehouseOptions}
                    placeholder="Selecciona bodega"
                    searchable
                />
                <Select
                    label="Muelle destino"
                    value={watch('destinationDockId')}
                    onChange={(value) => setValue('destinationDockId', value)}
                    options={destinationDocks.map((dock) => ({ value: dock.id, label: `${dock.code} - ${dock.name}` }))}
                    placeholder="Opcional"
                    disabled={!destinationWarehouseId}
                />
            </div>

            <p className="text-xs text-slate-500">
                Cuando el pago quede aprobado, KargaX puede crear automaticamente la cita de pickup y delivery para estas bodegas.
            </p>
        </div>
    );
}

export default WarehouseOfferFields;
