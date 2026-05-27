'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, Select, toast } from '@/components/ui';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsEmptyState,
    WmsFleetCard,
    WmsFleetDarkPanel,
    WmsFleetIdentity,
    WmsFleetInfoGrid,
    WmsFleetInfoItem,
    WmsFleetSection,
    WmsMetric,
    WmsMetricGrid,
    WmsPanelGrid,
    WmsProgress,
    WmsActionRow,
    WmsStatusBadge,
    WmsTextArea,
} from '@/components/warehouses/WarehouseExecutionLuxury';
import warehouseClient from '@/lib/warehouses/client';
import {
    buildWarehouseNumber,
    formatWarehouseDateTime,
    getReceiptStatusLabel,
    getWarehouseActionLabel,
    mapWarehouseErrorMessage,
} from '@/lib/warehouses/localization';

type ReceiptLineDraft = {
    skuCode: string;
    skuName: string;
    locationCode: string;
    expectedQty: string;
    receivedQty: string;
    damagedQty: string;
};

type ReceiptLinePayload = {
    skuCode: string;
    skuName: string;
    locationCode?: string;
    expectedQty: number;
    receivedQty: number;
    damagedQty: number;
};

const EMPTY_LINE: ReceiptLineDraft = {
    skuCode: '',
    skuName: '',
    locationCode: '',
    expectedQty: '',
    receivedQty: '',
    damagedQty: '',
};

function toNumber(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeSkuCode(value: string) {
    return value.trim().toUpperCase();
}

function receiptTone(status: string) {
    if (status === 'closed') return 'strong' as const;
    if (status === 'cancelled') return 'muted' as const;
    return 'neutral' as const;
}

function validateLine(line: ReceiptLineDraft): string | null {
    const expectedQty = toNumber(line.expectedQty || '0');
    const receivedQty = toNumber(line.receivedQty);
    const damagedQty = toNumber(line.damagedQty || '0');

    if (!line.skuCode.trim() || !line.skuName.trim()) {
        return 'Agrega SKU y nombre antes de sumar la linea.';
    }

    if (!Number.isFinite(receivedQty) || receivedQty <= 0) {
        return 'La cantidad recibida debe ser mayor a cero.';
    }

    if (!Number.isFinite(expectedQty) || expectedQty < 0 || !Number.isFinite(damagedQty) || damagedQty < 0) {
        return 'Esperado y danado deben ser cantidades validas.';
    }

    if (damagedQty > receivedQty) {
        return 'La cantidad danada no puede superar lo recibido.';
    }

    return null;
}

export default function WarehouseReceiptsPage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;
    const [saving, setSaving] = React.useState(false);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [formError, setFormError] = React.useState('');
    const [form, setForm] = React.useState({ receiptNumber: '', offerId: '', notes: '' });
    const [lineDraft, setLineDraft] = React.useState<ReceiptLineDraft>(EMPTY_LINE);
    const [lines, setLines] = React.useState<ReceiptLinePayload[]>([]);

    const addLine = (existingSkuName?: string) => {
        const error = validateLine(lineDraft);
        if (error) {
            setFormError(error);
            return;
        }

        const normalizedSku = normalizeSkuCode(lineDraft.skuCode);
        const normalizedLocation = lineDraft.locationCode.trim().toUpperCase() || 'REC-01';
        const nextLine = {
            skuCode: normalizedSku,
            skuName: existingSkuName || lineDraft.skuName.trim(),
            locationCode: normalizedLocation,
            expectedQty: toNumber(lineDraft.expectedQty || '0'),
            receivedQty: toNumber(lineDraft.receivedQty),
            damagedQty: toNumber(lineDraft.damagedQty || '0'),
        };

        setFormError('');
        setLines((current) => {
            const duplicateIndex = current.findIndex((line) => (
                normalizeSkuCode(line.skuCode) === nextLine.skuCode &&
                (line.locationCode || 'REC-01').trim().toUpperCase() === normalizedLocation
            ));

            if (duplicateIndex === -1) {
                return [...current, nextLine];
            }

            return current.map((line, index) => {
                if (index !== duplicateIndex) {
                    return line;
                }

                return {
                    ...line,
                    skuName: nextLine.skuName,
                    expectedQty: line.expectedQty + nextLine.expectedQty,
                    receivedQty: line.receivedQty + nextLine.receivedQty,
                    damagedQty: line.damagedQty + nextLine.damagedQty,
                };
            });
        });
        setLineDraft(EMPTY_LINE);
    };

    return (
        <DashboardLayout pageTitle="Recepciones">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="receipts"
                renderSection={({ receipts, stock, capabilities, reload }) => {
                    const skuOptions = Array.from(stock.reduce((map, balance) => {
                        const skuCode = normalizeSkuCode(balance.sku?.sku_code || '');
                        if (!skuCode || !balance.sku?.name) {
                            return map;
                        }

                        const current = map.get(skuCode);
                        const quantity = Number(balance.quantity_on_hand || 0);
                        const locationCode = balance.location?.code || 'REC-01';
                        map.set(skuCode, {
                            value: skuCode,
                            label: `${skuCode} - ${balance.sku.name}`,
                            description: `${current ? current.totalOnHand + quantity : quantity} en stock`,
                            skuCode,
                            skuName: current?.skuName || balance.sku.name,
                            totalOnHand: current ? current.totalOnHand + quantity : quantity,
                            defaultLocationCode: current?.defaultLocationCode || locationCode,
                        });
                        return map;
                    }, new Map<string, {
                        value: string;
                        label: string;
                        description: string;
                        skuCode: string;
                        skuName: string;
                        totalOnHand: number;
                        defaultLocationCode: string;
                    }>()).values());
                    const selectedExistingSku = skuOptions.find((item) => item.value === normalizeSkuCode(lineDraft.skuCode));
                    const totalLines = receipts.reduce((sum, receipt) => sum + (receipt.lines?.length || 0), 0);
                    const receivedUnits = receipts.reduce((sum, receipt) => (
                        sum + (receipt.lines || []).reduce((lineSum, line) => lineSum + Number(line.received_qty || 0), 0)
                    ), 0);
                    const damagedUnits = receipts.reduce((sum, receipt) => (
                        sum + (receipt.lines || []).reduce((lineSum, line) => lineSum + Number(line.damaged_qty || 0), 0)
                    ), 0);
                    const closedReceipts = receipts.filter((receipt) => receipt.status === 'closed').length;

                    return (
                        <div className="space-y-4 sm:space-y-5">
                            <WmsMetricGrid>
                                <WmsMetric label="Recepciones" value={receipts.length} detail="Documentos registrados" />
                                <WmsMetric label="Lineas" value={totalLines} detail="Items recibidos" />
                                <WmsMetric label="Recibido" value={receivedUnits} detail="Unidades brutas" />
                                <WmsMetric label="Rechazado" value={damagedUnits} detail="Danado o no conforme" />
                            </WmsMetricGrid>

                            <WmsPanelGrid aside="wide">
                                <SectionCard title="Crear recepcion" description="Cada linea conserva esperado, recibido y rechazado antes de tocar stock.">
                                    <div className="space-y-4">
                                        <div className="grid gap-3">
                                            <Input
                                                label="Numero de recepcion"
                                                value={form.receiptNumber}
                                                onChange={(event) => setForm((current) => ({ ...current, receiptNumber: event.target.value.toUpperCase() }))}
                                                helperText="Si queda vacio, se genera automaticamente."
                                            />
                                            <Input
                                                label="Viaje vinculado"
                                                value={form.offerId}
                                                onChange={(event) => setForm((current) => ({ ...current, offerId: event.target.value }))}
                                                placeholder="Opcional"
                                            />
                                        </div>
                                        <WmsTextArea
                                            label="Notas operativas"
                                            value={form.notes}
                                            onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
                                            placeholder="Proveedor, documento, condicion de llegada o responsable."
                                            minHeight={84}
                                        />

                                        <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                            <div className="mb-4 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-zinc-950">Linea de recepcion</p>
                                                    <p className="text-xs text-zinc-500">Recibido menos rechazado entra al stock.</p>
                                                </div>
                                                <ClipboardCheck className="h-5 w-5 text-zinc-500" aria-hidden="true" />
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <Input
                                                        label="SKU"
                                                        value={lineDraft.skuCode}
                                                        onChange={(event) => {
                                                            const skuCode = normalizeSkuCode(event.target.value);
                                                            const existing = skuOptions.find((item) => item.value === skuCode);
                                                            setLineDraft((current) => ({
                                                                ...current,
                                                                skuCode,
                                                                skuName: existing?.skuName || current.skuName,
                                                                locationCode: current.locationCode || existing?.defaultLocationCode || '',
                                                            }));
                                                        }}
                                                        placeholder="ARR-001"
                                                    />
                                                    {skuOptions.length > 0 ? (
                                                        <div className="mt-3">
                                                            <Select
                                                                label="Seleccionar existente"
                                                                value=""
                                                                onChange={(value) => {
                                                                    const option = skuOptions.find((item) => item.value === value);
                                                                    if (!option) return;
                                                                    setLineDraft((current) => ({
                                                                        ...current,
                                                                        skuCode: option.skuCode,
                                                                        skuName: option.skuName,
                                                                        locationCode: current.locationCode || option.defaultLocationCode,
                                                                    }));
                                                                }}
                                                                options={skuOptions}
                                                                searchable
                                                                placeholder="Buscar SKU existente"
                                                            />
                                                        </div>
                                                    ) : null}
                                                    {selectedExistingSku ? (
                                                        <p className="mt-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600">
                                                            SKU existente: esta recepcion se sumara al producto actual. Stock actual: <span className="font-money text-zinc-950">{selectedExistingSku.totalOnHand}</span>.
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <Input label="Nombre" value={lineDraft.skuName} onChange={(event) => setLineDraft((current) => ({ ...current, skuName: event.target.value }))} />
                                                <Input label="Ubicacion" value={lineDraft.locationCode} onChange={(event) => setLineDraft((current) => ({ ...current, locationCode: event.target.value.toUpperCase() }))} placeholder="REC-01" />
                                                <div className="grid gap-3">
                                                    <Input label="Esperado" type="number" min={0} value={lineDraft.expectedQty} onChange={(event) => setLineDraft((current) => ({ ...current, expectedQty: event.target.value }))} />
                                                    <Input label="Recibido" type="number" min={0} value={lineDraft.receivedQty} onChange={(event) => setLineDraft((current) => ({ ...current, receivedQty: event.target.value }))} />
                                                    <Input label="Rechazado" type="number" min={0} value={lineDraft.damagedQty} onChange={(event) => setLineDraft((current) => ({ ...current, damagedQty: event.target.value }))} />
                                                </div>
                                            </div>
                                            {formError ? <p className="mt-3 text-sm font-medium text-zinc-950">{formError}</p> : null}
                                            <Button variant="outline" className="mt-4" leftIcon={<Plus className="h-4 w-4" />} onClick={() => addLine(selectedExistingSku?.skuName)}>
                                                Agregar linea
                                            </Button>
                                        </div>

                                        {lines.length ? (
                                            <div className="grid min-w-0 gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
                                                {lines.map((line, index) => (
                                                    <div key={`${line.skuCode}-${index}`} className="rounded-lg border border-zinc-200 bg-white p-3">
                                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-zinc-950">{line.skuCode} / {line.skuName}</p>
                                                                <p className="mt-1 text-xs text-zinc-500">
                                                                    Esperado {line.expectedQty} / recibido {line.receivedQty} / rechazado {line.damagedQty}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="rounded-md border border-zinc-200 p-2 text-zinc-500 transition hover:border-zinc-950 hover:text-zinc-950"
                                                                aria-label={`Quitar linea ${line.skuCode}`}
                                                                onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                                            >
                                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}

                                        <Button
                                            fullWidth
                                            isLoading={saving}
                                            disabled={!capabilities?.manageReceipts}
                                            onClick={async () => {
                                                if (!lines.length) {
                                                    setFormError('Agrega al menos una linea antes de registrar la recepcion.');
                                                    return;
                                                }

                                                setSaving(true);
                                                try {
                                                    await warehouseClient.createReceipt(warehouseId, {
                                                        ...form,
                                                        receiptNumber: form.receiptNumber.trim() || buildWarehouseNumber('REC'),
                                                        offerId: form.offerId.trim() || undefined,
                                                        notes: form.notes.trim() || undefined,
                                                        lines,
                                                    });
                                                    setForm({ receiptNumber: '', offerId: '', notes: '' });
                                                    setLines([]);
                                                    setFormError('');
                                                    toast.success('Recepcion creada', 'Cantidades y estados quedaron registrados.');
                                                    await reload();
                                                } catch (error) {
                                                    toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo crear la recepcion');
                                                } finally {
                                                    setSaving(false);
                                                }
                                            }}
                                        >
                                            Registrar recepcion
                                        </Button>
                                    </div>
                                </SectionCard>

                                <WmsFleetSection
                                    icon={ClipboardCheck}
                                    title="Recepciones registradas"
                                    description="Estado, unidades y lineas clave en una lectura lista para revisar."
                                    action={<WmsProgress label="Cierre de recepciones" value={closedReceipts} total={receipts.length} />}
                                >
                                    {receipts.length ? (
                                    <>
                                        {receipts.map((receipt) => {
                                            const linesReceived = (receipt.lines || []).reduce((sum, line) => sum + Number(line.received_qty || 0), 0);
                                            const linesDamaged = (receipt.lines || []).reduce((sum, line) => sum + Number(line.damaged_qty || 0), 0);
                                            const nextStatuses = receipt.status === 'draft' ? ['received', 'cancelled']
                                                : receipt.status === 'received' ? ['closed', 'cancelled']
                                                    : [];

                                            return (
                                                <WmsFleetCard
                                                    key={receipt.id}
                                                    identity={(
                                                        <WmsFleetIdentity
                                                            title={receipt.receipt_number}
                                                            subtitle={formatWarehouseDateTime(receipt.received_at)}
                                                            status={<WmsStatusBadge label={getReceiptStatusLabel(receipt.status)} tone={receiptTone(receipt.status)} />}
                                                            activity={receipt.offer_id ? `Viaje ${receipt.offer_id.slice(0, 8)}` : 'Sin viaje vinculado'}
                                                        />
                                                    )}
                                                    info={(
                                                        <WmsFleetInfoGrid>
                                                            <WmsFleetInfoItem label="Lineas" value={receipt.lines?.length || 0} />
                                                            <WmsFleetInfoItem label="Recibido" value={linesReceived} />
                                                            <WmsFleetInfoItem label="Rechazado" value={linesDamaged} />
                                                            <WmsFleetInfoItem
                                                                label="Detalle"
                                                                value={receipt.lines?.length ? (
                                                                    <div className="space-y-2 text-sm font-normal">
                                                                        {receipt.lines.slice(0, 3).map((line) => (
                                                                            <p key={line.id} className="truncate text-zinc-700">
                                                                                {line.sku_code_snapshot} / Rec {line.received_qty} / Rech {line.damaged_qty}
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                ) : 'Sin lineas'}
                                                                detail={receipt.lines && receipt.lines.length > 3 ? `+${receipt.lines.length - 3} lineas mas` : undefined}
                                                                className="min-[520px]:col-span-2 xl:col-span-1 2xl:col-span-2"
                                                            />
                                                        </WmsFleetInfoGrid>
                                                    )}
                                                    darkPanel={<WmsFleetDarkPanel label="Estado" value={getReceiptStatusLabel(receipt.status)} detail={receipt.status === 'closed' ? 'Stock cerrado y trazable.' : 'Pendiente de cierre operativo.'} />}
                                                    actions={capabilities?.manageReceipts && nextStatuses.length ? (
                                                        <WmsActionRow>
                                                            {nextStatuses.map((nextStatus) => (
                                                                <Button
                                                                    key={nextStatus}
                                                                    size="sm"
                                                                    variant={nextStatus === 'cancelled' ? 'outline' : 'secondary'}
                                                                    disabled={processingId === receipt.id}
                                                                    onClick={async () => {
                                                                        try {
                                                                            setProcessingId(receipt.id);
                                                                            await warehouseClient.updateReceipt(warehouseId, receipt.id, { status: nextStatus });
                                                                            toast.success('Recepcion actualizada');
                                                                            await reload();
                                                                        } catch (error) {
                                                                            toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo actualizar la recepcion');
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
                                            );
                                        })}
                                    </>
                                    ) : (
                                        <WmsEmptyState
                                            title="Aun no hay recepciones"
                                            description="Cuando ingrese mercancia, las lineas recibidas y rechazadas apareceran aqui."
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
