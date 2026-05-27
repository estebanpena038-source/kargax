'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Layers3, Loader2, Search, Wand2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, toast } from '@/components/ui';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsEmptyState,
    WmsFleetCard,
    WmsFleetDarkPanel,
    WmsFleetIdentity,
    WmsFleetInfoGrid,
    WmsFleetInfoItem,
    WmsFleetSection,
    WmsImageThumb,
    WmsMetric,
    WmsMetricGrid,
    WmsPanelGrid,
    WmsRiskNotice,
    WmsStatusBadge,
    WmsTextArea,
} from '@/components/warehouses/WarehouseExecutionLuxury';
import warehouseClient from '@/lib/warehouses/client';
import type { WarehouseSku, WarehouseSkuImage, WarehouseStockBalance } from '@/lib/warehouses/types';

interface InventorySkuCard {
    sku: WarehouseSku;
    totalOnHand: number;
    reservedQty: number;
    balances: WarehouseStockBalance[];
}

function normalizeSkuCode(value: string) {
    return value.trim().toUpperCase();
}

function aggregateStock(stock: WarehouseStockBalance[]): InventorySkuCard[] {
    const grouped = new Map<string, InventorySkuCard>();

    for (const balance of stock) {
        if (!balance.sku?.id) {
            continue;
        }

        const quantityOnHand = Number(balance.quantity_on_hand || 0);
        const quantityReserved = Number(balance.quantity_reserved || 0);

        if (quantityOnHand <= 0 && quantityReserved <= 0) {
            continue;
        }

        const skuKey = normalizeSkuCode(balance.sku.sku_code) || balance.sku.id;
        const current = grouped.get(skuKey);
        if (!current) {
            grouped.set(skuKey, {
                sku: balance.sku,
                totalOnHand: quantityOnHand,
                reservedQty: quantityReserved,
                balances: [balance],
            });
            continue;
        }

        current.totalOnHand += quantityOnHand;
        current.reservedQty += quantityReserved;
        current.balances.push(balance);
    }

    return Array.from(grouped.values()).sort((left, right) => right.totalOnHand - left.totalOnHand);
}

function findSkuTotal(stock: WarehouseStockBalance[], skuCode: string) {
    const normalized = normalizeSkuCode(skuCode);
    return stock
        .filter((balance) => normalizeSkuCode(balance.sku?.sku_code || '') === normalized)
        .reduce((sum, balance) => sum + Number(balance.quantity_on_hand || 0), 0);
}

function SkuImageDropzone({
    skuId,
    disabled,
    imageCount,
    onUploaded,
}: {
    skuId: string;
    disabled: boolean;
    imageCount: number;
    onUploaded: () => Promise<void>;
}) {
    const [uploading, setUploading] = React.useState(false);
    const limitReached = imageCount >= 5;

    const onDrop = React.useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) {
            return;
        }

        setUploading(true);
        try {
            await warehouseClient.uploadSkuImage(skuId, file);
            toast.success('Inventario', 'Imagen asociada al SKU.');
            await onUploaded();
        } catch (error) {
            toast.error('Inventario', error instanceof Error ? error.message : 'No se pudo subir la imagen');
        } finally {
            setUploading(false);
        }
    }, [onUploaded, skuId]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected: () => toast.warning('Imagen no aceptada', 'Usa JPG, PNG o WEBP de maximo 8MB.'),
        disabled: disabled || uploading || limitReached,
        maxFiles: 1,
        maxSize: 8 * 1024 * 1024,
        accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
        },
    });

    return (
        <div
            {...getRootProps()}
            className={`flex min-h-14 items-center justify-center rounded-lg border border-dashed px-3 py-2 text-center transition ${
                disabled || limitReached
                    ? 'cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400'
                    : isDragActive
                        ? 'border-zinc-950 bg-white text-zinc-950'
                        : 'cursor-pointer border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-zinc-950 hover:bg-white'
            }`}
        >
            <input {...getInputProps()} />
            {uploading ? (
                <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Subiendo imagen
                </div>
            ) : (
                <div className="flex min-w-0 items-center justify-center gap-3">
                    <ImagePlus className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-medium">{limitReached ? 'Galeria completa' : 'Agregar imagen de SKU'}</p>
                        <p className="truncate text-xs text-zinc-500">JPG, PNG o WEBP. {imageCount}/5 imagenes.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function WarehouseInventoryPage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;
    const [saving, setSaving] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [formError, setFormError] = React.useState('');
    const [form, setForm] = React.useState({
        skuCode: '',
        skuName: '',
        locationCode: '',
        quantityDelta: '',
        notes: '',
    });

    return (
        <DashboardLayout pageTitle="Inventario">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="inventory"
                renderSection={({ stock, detail, reload }) => {
                    const plan = detail?.subscription?.plan;
                    const hasInventory = Boolean(plan?.includes_inventory);
                    const inventoryCards = aggregateStock(stock).filter((item) => {
                        const needle = search.trim().toLowerCase();
                        if (!needle) return true;
                        return item.sku.sku_code.toLowerCase().includes(needle) || item.sku.name.toLowerCase().includes(needle);
                    });
                    const totalOnHand = stock.reduce((sum, item) => sum + Number(item.quantity_on_hand || 0), 0);
                    const totalReserved = stock.reduce((sum, item) => sum + Number(item.quantity_reserved || 0), 0);

                    const submitAdjustment = async () => {
                        const delta = Number(form.quantityDelta);
                        const normalizedSku = form.skuCode.trim().toUpperCase();
                        const existingTotal = findSkuTotal(stock, normalizedSku);

                        setFormError('');

                        if (!normalizedSku || !form.skuName.trim()) {
                            setFormError('SKU y nombre son obligatorios para conservar trazabilidad.');
                            return;
                        }

                        if (!Number.isFinite(delta) || delta === 0) {
                            setFormError('El ajuste debe ser una cantidad valida y diferente de cero.');
                            return;
                        }

                        if (delta < 0 && existingTotal + delta < 0) {
                            setFormError(`El ajuste dejaria el SKU ${normalizedSku} con stock negativo. Disponible actual: ${existingTotal}.`);
                            return;
                        }

                        if (form.notes.trim().length < 12) {
                            setFormError('Agrega una justificacion concreta antes de aplicar el ajuste.');
                            return;
                        }

                        setSaving(true);
                        try {
                            await warehouseClient.adjustStock(warehouseId, {
                                ...form,
                                skuCode: normalizedSku,
                                skuName: form.skuName.trim(),
                                locationCode: form.locationCode.trim().toUpperCase(),
                                quantityDelta: delta,
                                notes: form.notes.trim(),
                            });
                            setForm({ skuCode: '', skuName: '', locationCode: '', quantityDelta: '', notes: '' });
                            toast.success('Inventario', 'Stock actualizado con justificacion.');
                            await reload();
                        } catch (error) {
                            toast.error('Inventario', error instanceof Error ? error.message : 'No se pudo actualizar el stock');
                        } finally {
                            setSaving(false);
                        }
                    };

                    return (
                        <div className="space-y-4 sm:space-y-5">
                            {!hasInventory ? (
                                <WmsRiskNotice
                                    title="Inventario avanzado requiere plan con WMS"
                                    description="La vista conserva lectura operativa. Para ajustar stock e imagenes de SKU, activa un plan con inventario."
                                />
                            ) : null}

                            <WmsMetricGrid>
                                <WmsMetric label="Stock disponible" value={totalOnHand} detail="Unidades en saldos activos" />
                                <WmsMetric label="Reservado" value={totalReserved} detail="Separado para ejecucion" />
                                <WmsMetric label="SKUs visibles" value={aggregateStock(stock).length} detail="Catalogo con balance" />
                            </WmsMetricGrid>

                            <WmsPanelGrid>
                                <SectionCard
                                    title="Ajuste con justificacion"
                                    description="Movimiento manual controlado. Cantidades invalidas no avanzan."
                                >
                                    <div className="space-y-3">
                                        <Input
                                            label="SKU"
                                            value={form.skuCode}
                                            onChange={(event) => setForm((current) => ({ ...current, skuCode: event.target.value.toUpperCase() }))}
                                            disabled={!hasInventory}
                                            placeholder="SKU-001"
                                        />
                                        <Input
                                            label="Nombre"
                                            value={form.skuName}
                                            onChange={(event) => setForm((current) => ({ ...current, skuName: event.target.value }))}
                                            disabled={!hasInventory}
                                            placeholder="Nombre operativo del item"
                                        />
                                        <Input
                                            label="Ubicacion"
                                            value={form.locationCode}
                                            onChange={(event) => setForm((current) => ({ ...current, locationCode: event.target.value.toUpperCase() }))}
                                            disabled={!hasInventory}
                                            placeholder="A1-01"
                                        />
                                        <Input
                                            label="Cantidad de ajuste"
                                            type="number"
                                            value={form.quantityDelta}
                                            onChange={(event) => setForm((current) => ({ ...current, quantityDelta: event.target.value }))}
                                            helperText="Usa positivo para ingreso y negativo para descuento."
                                            disabled={!hasInventory}
                                        />
                                        <WmsTextArea
                                            label="Justificacion"
                                            value={form.notes}
                                            onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
                                            placeholder="Motivo del ajuste, documento o conteo fisico."
                                            disabled={!hasInventory}
                                        />
                                        {formError ? <p className="text-sm font-medium text-zinc-950">{formError}</p> : null}
                                        <Button fullWidth isLoading={saving} disabled={!hasInventory} onClick={submitAdjustment}>
                                            Aplicar ajuste
                                        </Button>
                                        {!hasInventory ? (
                                            <Link href="/planes" className="block">
                                                <Button fullWidth variant="outline" rightIcon={<Wand2 className="h-4 w-4" />}>
                                                    Ver planes
                                                </Button>
                                            </Link>
                                        ) : null}
                                    </div>
                                </SectionCard>

                                <WmsFleetSection
                                    icon={Layers3}
                                    title="Catalogo visual"
                                    description="SKU, stock, ubicaciones e imagenes en una vista rapida."
                                    action={(
                                        <Input
                                            label=""
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Buscar por SKU o nombre"
                                            leftIcon={<Search className="h-4 w-4" />}
                                        />
                                    )}
                                >

                                    {inventoryCards.length ? (
                                    <>
                                        {inventoryCards.map((item) => {
                                            const images = item.sku.images || [];
                                            const coverImage = images.find((image) => image.is_cover) || images[0] || null;
                                            const locations = new Set(item.balances.map((balance) => balance.location?.code || 'Sin ubicacion')).size;
                                            const lots = new Set(item.balances.map((balance) => balance.lot_code || 'std')).size;

                                            return (
                                                <WmsFleetCard
                                                    key={item.sku.id}
                                                    identity={(
                                                        <WmsFleetIdentity
                                                            title={item.sku.name}
                                                            subtitle={item.sku.description || 'SKU listo para recepcion, picking y despacho.'}
                                                            status={<WmsStatusBadge label={item.sku.sku_code} tone="strong" />}
                                                            media={<WmsImageThumb src={coverImage?.public_url} alt={item.sku.name} caption={coverImage ? 'Portada' : 'Sin portada'} />}
                                                        />
                                                    )}
                                                    info={(
                                                        <WmsFleetInfoGrid>
                                                            <WmsFleetInfoItem label="Reservado" value={item.reservedQty} />
                                                            <WmsFleetInfoItem label="Ubicaciones" value={locations} />
                                                            <WmsFleetInfoItem label="Lotes" value={lots} />
                                                            <WmsFleetInfoItem
                                                                label="Saldo por ubicacion"
                                                                value={(
                                                                    <div className="flex min-w-0 flex-wrap gap-2 text-sm">
                                                                        {item.balances.map((balance) => (
                                                                            <span key={balance.id} className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                                                                                <Layers3 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                                                                                {balance.location?.code || 'Sin ubicacion'} / <span className="font-money text-zinc-950">{balance.quantity_on_hand}</span>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                className="min-[520px]:col-span-2 xl:col-span-1 2xl:col-span-2"
                                                            />
                                                        </WmsFleetInfoGrid>
                                                    )}
                                                    darkPanel={<WmsFleetDarkPanel label="Disponible" value={item.totalOnHand} detail={`${images.length}/5 imagenes asociadas`} />}
                                                    actions={(
                                                        <div className="grid min-w-0 gap-3">
                                                            {hasInventory ? (
                                                                <SkuImageDropzone skuId={item.sku.id} disabled={!hasInventory} imageCount={images.length} onUploaded={reload} />
                                                            ) : null}
                                                            {images.length ? (
                                                                <div className="flex min-w-0 gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                                                                    {images.map((image: WarehouseSkuImage) => (
                                                                        <div key={image.id} className="w-24 shrink-0">
                                                                            <WmsImageThumb
                                                                                src={image.public_url}
                                                                                alt={item.sku.name}
                                                                                caption={image.is_cover ? 'Portada' : `Foto ${image.sort_order + 1}`}
                                                                                onDelete={hasInventory ? async () => {
                                                                                    try {
                                                                                        await warehouseClient.deleteSkuImage(image.id);
                                                                                        toast.success('Inventario', 'Imagen eliminada');
                                                                                        await reload();
                                                                                    } catch (error) {
                                                                                        toast.error('Inventario', error instanceof Error ? error.message : 'No se pudo eliminar la imagen');
                                                                                    }
                                                                                } : undefined}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                />
                                            );
                                        })}
                                    </>
                                    ) : (
                                        <WmsEmptyState
                                            title={search ? 'Sin coincidencias' : 'Catalogo listo para el primer SKU'}
                                            description={search ? 'Ajusta la busqueda por codigo o nombre.' : 'Haz un ajuste justificado para crear saldo y activar el catalogo visual.'}
                                        />
                                    )}
                                </WmsFleetSection>
                            </WmsPanelGrid>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
