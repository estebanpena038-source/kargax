'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Link2, PackageCheck, Plus, Route, Trash2, Truck, Users, Wallet } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AndeanPhoneInput, Button, Input, Select, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { validateAndeanPhoneValue } from '@/lib/phone/andean';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsCompletionMark,
    WmsEmptyState,
    WmsMetric,
    WmsMetricGrid,
    WmsActionRow,
    WmsStatusBadge,
    WmsTextArea,
} from '@/components/warehouses/WarehouseExecutionLuxury';
import { VEHICLE_TYPES, formatCOP } from '@/constants/colombia';
import warehouseClient from '@/lib/warehouses/client';
import { cn } from '@/lib/utils';
import {
    buildWarehouseNumber,
    formatWarehouseDateTime,
    getDispatchStatusLabel,
    getWarehouseActionLabel,
    mapWarehouseErrorMessage,
    resolveWarehouseCountry,
} from '@/lib/warehouses/localization';
import type { BusinessFleetMember, WarehouseDispatchLine, WarehouseDispatchOrder, WarehouseStockBalance } from '@/lib/warehouses/types';

type DispatchTripMode = 'dispatch_only' | 'private_fleet_trip' | 'marketplace_offer';
type CompensationMode = 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses';
type ExpenseReleasePolicy = 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual';

type DispatchLinePayload = {
    skuCode: string;
    skuName: string;
    locationCode?: string;
    requestedQty: number;
    pickedQty: number;
    dispatchedQty: number;
    rejectedQty: number;
};

type DispatchFormState = {
    dispatchNumber: string;
    offerId: string;
    scheduledAt: string;
    deliveryAt: string;
    notes: string;
    dispatchTripMode: DispatchTripMode;
    privateFleetTruckerId: string;
    compensationMode: CompensationMode;
    expensesReleasePolicy: ExpenseReleasePolicy;
    freightPaymentAmount: string;
    expenseAllowanceAmount: string;
    pickupContactName: string;
    pickupContactPhone: string;
    deliveryContactName: string;
    deliveryContactPhone: string;
    destinationAddress: string;
    destinationCity: string;
    destinationDepartment: string;
    vehicleType: string;
};

const DISPATCH_MODE_OPTIONS: Array<{ value: DispatchTripMode; label: string; description: string }> = [
    { value: 'dispatch_only', label: 'Solo despacho', description: 'Registra salida de inventario sin crear viaje.' },
    { value: 'private_fleet_trip', label: 'Crear viaje flota privada', description: 'Asigna conductor interno y crea el viaje automaticamente.' },
];

const DISPATCH_MODE_LABELS: Record<DispatchTripMode, string> = {
    dispatch_only: 'Solo despacho',
    private_fleet_trip: 'Crear viaje flota privada',
    marketplace_offer: 'Marketplace',
};

const COMPENSATION_MODE_OPTIONS: Array<{ value: CompensationMode; label: string; description: string }> = [
    { value: 'salary_no_trip_pay', label: 'Nomina mensual', description: 'Sin pago por ruta ni viaticos dentro del viaje.' },
    { value: 'trip_pay', label: 'Pago por ruta', description: 'Flete privado para este viaje.' },
    { value: 'expenses_only', label: 'Solo viaticos', description: 'Entrega gastos operativos sin flete.' },
    { value: 'trip_pay_plus_expenses', label: 'Ruta + viaticos', description: 'Flete privado y gastos del viaje.' },
];

const EXPENSE_RELEASE_POLICY_OPTIONS: Array<{ value: ExpenseReleasePolicy; label: string; description: string }> = [
    { value: 'acceptance', label: 'Al aceptar viaje', description: 'Disponible cuando el conductor confirma.' },
    { value: 'pickup_pin', label: 'Al cargar', description: 'Disponible al validar PIN/POD de cargue.' },
    { value: 'delivery_pod', label: 'Al entregar', description: 'Disponible al cerrar la entrega.' },
    { value: 'manual', label: 'Manual', description: 'Finanzas lo libera cuando corresponda.' },
];

const VEHICLE_TYPE_OPTIONS = VEHICLE_TYPES.map((vehicle) => ({
    value: vehicle.code,
    label: vehicle.name,
    description: `${vehicle.capacityTons} ton / ${vehicle.volumeM3} m3`,
}));

function aggregateDispatchableStock(stock: WarehouseStockBalance[]) {
    return stock
        .filter((balance) => balance.sku?.sku_code && balance.sku?.name && Number(balance.quantity_on_hand || 0) > 0)
        .map((balance) => ({
            balance,
            skuCode: balance.sku!.sku_code,
            skuName: balance.sku!.name,
            locationCode: balance.location?.code || '',
            availableQty: Number(balance.quantity_on_hand || 0),
        }));
}

function dispatchTone(status: WarehouseDispatchOrder['status']) {
    if (status === 'dispatched') return 'strong' as const;
    if (status === 'cancelled') return 'muted' as const;
    return 'neutral' as const;
}

function getDispatchExtra(dispatchItem: WarehouseDispatchOrder) {
    return dispatchItem as WarehouseDispatchOrder & {
        dispatch_trip_mode?: DispatchTripMode | null;
        trip_creation_status?: string | null;
        metadata?: {
            tripDetails?: Record<string, unknown> | null;
            dispatchTripMode?: DispatchTripMode;
        } | null;
    };
}

function getDispatchModeLabel(mode?: string | null) {
    return DISPATCH_MODE_LABELS[(mode || 'dispatch_only') as DispatchTripMode] || 'Solo despacho';
}

function getDriverName(member: BusinessFleetMember) {
    return member.user?.full_name || member.user?.email || 'Conductor privado';
}

function getCompensationModeLabel(value?: string | null) {
    return COMPENSATION_MODE_OPTIONS.find((option) => option.value === value)?.label || 'Nomina mensual';
}

function lineTotals(lines: DispatchLinePayload[]) {
    return lines.reduce((totals, line) => ({
        requested: totals.requested + line.requestedQty,
        picked: totals.picked + line.pickedQty,
        dispatched: totals.dispatched + line.dispatchedQty,
        rejected: totals.rejected + line.rejectedQty,
    }), {
        requested: 0,
        picked: 0,
        dispatched: 0,
        rejected: 0,
    });
}

function persistedLineTotals(lines?: WarehouseDispatchLine[]) {
    return (lines || []).reduce((totals, line) => ({
        requested: totals.requested + Number(line.requested_qty || 0),
        picked: totals.picked + Number(line.picked_qty || 0),
        dispatched: totals.dispatched + Number(line.dispatched_qty || 0),
        rejected: totals.rejected + Number(line.rejected_qty || 0),
    }), {
        requested: 0,
        picked: 0,
        dispatched: 0,
        rejected: 0,
    });
}

export default function WarehouseDispatchesPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const warehouseId = params?.id as string;
    const { user } = useAuthStore();
    const countryCode = resolveWarehouseCountry(user?.country);
    const [saving, setSaving] = React.useState(false);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [formError, setFormError] = React.useState('');
    const [showAdvancedOfferLink, setShowAdvancedOfferLink] = React.useState(false);
    const [fleetMembers, setFleetMembers] = React.useState<BusinessFleetMember[]>([]);
    const [fleetLoading, setFleetLoading] = React.useState(false);
    const [fleetError, setFleetError] = React.useState<string | null>(null);
    const [form, setForm] = React.useState<DispatchFormState>({
        dispatchNumber: '',
        offerId: '',
        scheduledAt: '',
        deliveryAt: '',
        notes: '',
        dispatchTripMode: 'dispatch_only' as DispatchTripMode,
        privateFleetTruckerId: '',
        compensationMode: 'salary_no_trip_pay' as CompensationMode,
        expensesReleasePolicy: 'acceptance' as ExpenseReleasePolicy,
        freightPaymentAmount: '',
        expenseAllowanceAmount: '',
        pickupContactName: '',
        pickupContactPhone: '',
        deliveryContactName: '',
        deliveryContactPhone: '',
        destinationAddress: '',
        destinationCity: '',
        destinationDepartment: '',
        vehicleType: VEHICLE_TYPE_OPTIONS[0]?.value || 'TURBO',
    });
    const [lineDraft, setLineDraft] = React.useState({
        stockKey: '',
        skuCode: '',
        skuName: '',
        locationCode: '',
        requestedQty: '',
        pickedQty: '',
        dispatchedQty: '',
        rejectedQty: '',
        availableQty: 0,
    });
    const [lines, setLines] = React.useState<DispatchLinePayload[]>([]);

    React.useEffect(() => {
        let cancelled = false;

        const loadFleet = async () => {
            setFleetLoading(true);
            setFleetError(null);
            try {
                const response = await warehouseClient.getBusinessFleet();
                if (!cancelled) {
                    setFleetMembers(response.data || []);
                }
            } catch (error) {
                if (!cancelled) {
                    setFleetError(error instanceof Error ? error.message : 'No se pudo cargar la flota privada');
                }
            } finally {
                if (!cancelled) {
                    setFleetLoading(false);
                }
            }
        };

        void loadFleet();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <DashboardLayout pageTitle="Despachos">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="dispatches"
                renderSection={({ warehouse, dispatches, stock, capabilities, reload }) => {
                    const dispatchableStock = aggregateDispatchableStock(stock);
                    const stockOptions = dispatchableStock.map((item) => ({
                        value: item.balance.id,
                        label: `${item.skuCode} - ${item.skuName}`,
                        description: `${item.locationCode || 'Sin ubicacion'} / disponible ${item.availableQty}`,
                    }));
                    const activeFleetMembers = fleetMembers.filter((member) => member.status === 'active');
                    const privateFleetOptions = activeFleetMembers.map((member) => ({
                        value: member.trucker_id,
                        label: getDriverName(member),
                        description: [
                            member.internal_driver_id ? `ID ${member.internal_driver_id}` : null,
                            member.vehicle_plate ? `Placa ${member.vehicle_plate}` : null,
                            member.user?.phone || null,
                        ].filter(Boolean).join(' / ') || 'Conductor activo de la empresa',
                    }));
                    const selectedDriver = activeFleetMembers.find((member) => member.trucker_id === form.privateFleetTruckerId);
                    const draftTotals = lineTotals(lines);
                    const dispatchedOrders = dispatches.filter((dispatchItem) => dispatchItem.status === 'dispatched').length;
                    const connectedOrders = dispatches.filter((dispatchItem) => Boolean(dispatchItem.offer_id)).length;
                    const privateTripDraft = form.dispatchTripMode === 'private_fleet_trip';
                    const allowsTripPay = form.compensationMode === 'trip_pay' || form.compensationMode === 'trip_pay_plus_expenses';
                    const allowsExpenses = form.compensationMode === 'expenses_only' || form.compensationMode === 'trip_pay_plus_expenses';
                    const freightAmount = Number(form.freightPaymentAmount || 0);
                    const expenseAmount = Number(form.expenseAllowanceAmount || 0);
                    const normalizedFreightAmount = allowsTripPay ? freightAmount : 0;
                    const normalizedExpenseAmount = allowsExpenses ? expenseAmount : 0;

                    const addLine = () => {
                        const requestedQty = Number(lineDraft.requestedQty || 0);
                        const pickedQty = Number(lineDraft.pickedQty || lineDraft.requestedQty || 0);
                        const dispatchedQty = Number(lineDraft.dispatchedQty || lineDraft.pickedQty || lineDraft.requestedQty || 0);
                        const rejectedQty = Number(lineDraft.rejectedQty || 0);

                        setFormError('');

                        if (!lineDraft.skuCode) {
                            setFormError('Selecciona un SKU con stock disponible.');
                            return;
                        }

                        if (![requestedQty, pickedQty, dispatchedQty, rejectedQty].every(Number.isFinite) || requestedQty <= 0 || pickedQty < 0 || dispatchedQty <= 0 || rejectedQty < 0) {
                            setFormError('Solicitado, picked, despachado y rechazado deben ser cantidades validas.');
                            return;
                        }

                        if (dispatchedQty > lineDraft.availableQty) {
                            setFormError(`Solo hay ${lineDraft.availableQty} unidades disponibles para ${lineDraft.skuCode}.`);
                            return;
                        }

                        if (pickedQty > requestedQty || dispatchedQty > pickedQty || rejectedQty > requestedQty) {
                            setFormError('La linea no puede despachar mas de lo picked ni rechazar mas de lo solicitado.');
                            return;
                        }

                        setLines((current) => [
                            ...current,
                            {
                                skuCode: lineDraft.skuCode,
                                skuName: lineDraft.skuName,
                                locationCode: lineDraft.locationCode || undefined,
                                requestedQty,
                                pickedQty,
                                dispatchedQty,
                                rejectedQty,
                            },
                        ]);

                        setLineDraft({ stockKey: '', skuCode: '', skuName: '', locationCode: '', requestedQty: '', pickedQty: '', dispatchedQty: '', rejectedQty: '', availableQty: 0 });
                    };

                    return (
                        <div className="space-y-5">
                            <SectionCard
                                title="Crear despacho y viaje privado"
                                description={`Dos caminos claros: con bodega sale desde ${warehouse?.name || 'inventario'}; sin bodega crea una ruta directa para flota privada.`}
                            >
                                <div className="space-y-5">
                                    <WmsMetricGrid dense>
                                        <WmsMetric label="Despachos" value={dispatches.length} detail="Ordenes creadas" />
                                        <WmsMetric label="Ejecutados" value={dispatchedOrders} detail="Salida confirmada" />
                                        <WmsMetric label="Con viaje" value={connectedOrders} detail="OfferId enlazado" />
                                        <WmsMetric label="Stock apto" value={dispatchableStock.length} detail="Saldos disponibles" />
                                    </WmsMetricGrid>

                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                                            <div className="flex min-w-0 flex-1 flex-col justify-between rounded-lg border border-zinc-950 bg-white p-4 shadow-[0_18px_50px_-42px_rgba(10,10,10,.7)]">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
                                                        <PackageCheck className="h-5 w-5" aria-hidden="true" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-zinc-950">Con bodega</p>
                                                        <p className="mt-1 text-sm leading-6 text-zinc-500">Despacha stock real y, si eliges flota privada, nace el viaje asignado al conductor.</p>
                                                    </div>
                                                </div>
                                                <p className="mt-4 font-money text-xs text-zinc-500">Flujo actual de este bloque.</p>
                                            </div>

                                            <button
                                                type="button"
                                                className="flex min-w-0 flex-1 flex-col justify-between rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-950 hover:shadow-[0_18px_50px_-42px_rgba(10,10,10,.7)]"
                                                onClick={() => {
                                                    router.push('/ofertas/publicar?assignmentMode=private&warehouseFlowMode=manual');
                                                }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-950">
                                                        <Route className="h-5 w-5" aria-hidden="true" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-zinc-950">Sin bodega</p>
                                                        <p className="mt-1 text-sm leading-6 text-zinc-500">Ruta directa privada: no toca inventario; selecciona conductor, manifiesto y compensacion.</p>
                                                    </div>
                                                </div>
                                                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                                    Crear ruta directa
                                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-zinc-200 bg-white p-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-zinc-950">Modo de salida desde bodega</p>
                                                <p className="mt-1 text-sm text-zinc-500">Elige si solo baja inventario o si tambien crea viaje privado.</p>
                                            </div>
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                {DISPATCH_MODE_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            if (option.value === 'dispatch_only') {
                                                                setShowAdvancedOfferLink(false);
                                                            }
                                                            setForm((current) => ({
                                                                ...current,
                                                                dispatchTripMode: option.value,
                                                                offerId: option.value === 'dispatch_only' ? '' : current.offerId,
                                                            }));
                                                            setFormError('');
                                                        }}
                                                        className={cn(
                                                            'min-w-0 rounded-lg border px-4 py-3 text-left transition sm:min-w-[13rem]',
                                                            form.dispatchTripMode === option.value
                                                                ? 'border-zinc-950 bg-zinc-950 text-white shadow-[0_18px_50px_-42px_rgba(10,10,10,.7)]'
                                                                : 'border-zinc-200 bg-white text-zinc-950 hover:border-zinc-950'
                                                        )}
                                                    >
                                                        <span className="flex items-center gap-2 text-sm font-semibold">
                                                            {form.dispatchTripMode === option.value ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
                                                            {option.label}
                                                        </span>
                                                        <span className={cn('mt-1 block text-xs leading-5', form.dispatchTripMode === option.value ? 'text-zinc-300' : 'text-zinc-500')}>
                                                            {option.description}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
                                        <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                                <Truck className="h-4 w-4" aria-hidden="true" />
                                                Datos del despacho
                                            </div>
                                            <div className="grid gap-3 min-[560px]:grid-cols-2">
                                                <Input
                                                    label="Numero de despacho"
                                                    value={form.dispatchNumber}
                                                    onChange={(event) => setForm((current) => ({ ...current, dispatchNumber: event.target.value.toUpperCase() }))}
                                                    helperText="Si queda vacio, se genera automaticamente."
                                                />
                                                <Input
                                                    label="Programado para"
                                                    type="datetime-local"
                                                    value={form.scheduledAt}
                                                    onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                                                />
                                            </div>
                                            <WmsTextArea
                                                label="Notas de despacho"
                                                value={form.notes}
                                                onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
                                                placeholder="Condiciones de salida, sello, responsable o documento."
                                                minHeight={84}
                                            />
                                        </div>

                                        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                                <Users className="h-4 w-4" aria-hidden="true" />
                                                Viaje flota privada
                                            </div>
                                            {privateTripDraft ? (
                                                <>
                                                    <Select
                                                        label="Conductor privado"
                                                        value={form.privateFleetTruckerId}
                                                        onChange={(value) => {
                                                            const nextDriver = activeFleetMembers.find((member) => member.trucker_id === value);
                                                            const nextCompensationMode = (nextDriver?.default_compensation_mode || 'salary_no_trip_pay') as CompensationMode;

                                                            setForm((current) => ({
                                                                ...current,
                                                                privateFleetTruckerId: value,
                                                                compensationMode: nextCompensationMode,
                                                                freightPaymentAmount: nextCompensationMode === 'trip_pay' || nextCompensationMode === 'trip_pay_plus_expenses'
                                                                    ? current.freightPaymentAmount
                                                                    : '',
                                                                expenseAllowanceAmount: nextCompensationMode === 'expenses_only' || nextCompensationMode === 'trip_pay_plus_expenses'
                                                                    ? current.expenseAllowanceAmount
                                                                    : '',
                                                            }));
                                                        }}
                                                        options={privateFleetOptions}
                                                        placeholder={fleetLoading ? 'Cargando conductores...' : 'Selecciona conductor'}
                                                        isLoading={fleetLoading}
                                                        disabled={fleetLoading || privateFleetOptions.length === 0}
                                                        searchable
                                                    />
                                                    {fleetError ? (
                                                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{fleetError}</p>
                                                    ) : null}
                                                    {!fleetLoading && privateFleetOptions.length === 0 ? (
                                                        <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">No hay conductores privados activos. Crea uno en Flota privada antes de asignar viajes.</p>
                                                    ) : null}
                                                    {selectedDriver ? (
                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                                            <p className="font-semibold text-zinc-950">{getDriverName(selectedDriver)}</p>
                                                            <p className="mt-1 font-money text-xs text-zinc-500">
                                                                {selectedDriver.internal_driver_id || 'Sin ID interno'} / {selectedDriver.vehicle_plate || 'Sin placa'} / {getCompensationModeLabel(selectedDriver.default_compensation_mode)}
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                    <div className="grid gap-3 min-[560px]:grid-cols-2">
                                                        <Select
                                                            label="Modo de pago"
                                                            value={form.compensationMode}
                                                            onChange={(value) => {
                                                                const nextCompensationMode = value as CompensationMode;

                                                                setForm((current) => ({
                                                                    ...current,
                                                                    compensationMode: nextCompensationMode,
                                                                    freightPaymentAmount: nextCompensationMode === 'trip_pay' || nextCompensationMode === 'trip_pay_plus_expenses'
                                                                        ? current.freightPaymentAmount
                                                                        : '',
                                                                    expenseAllowanceAmount: nextCompensationMode === 'expenses_only' || nextCompensationMode === 'trip_pay_plus_expenses'
                                                                        ? current.expenseAllowanceAmount
                                                                        : '',
                                                                    expensesReleasePolicy: nextCompensationMode === 'salary_no_trip_pay'
                                                                        ? 'acceptance'
                                                                        : current.expensesReleasePolicy,
                                                                }));
                                                            }}
                                                            options={COMPENSATION_MODE_OPTIONS}
                                                        />
                                                        {allowsExpenses ? (
                                                            <Select
                                                                label="Liberar viaticos"
                                                                value={form.expensesReleasePolicy}
                                                                onChange={(value) => setForm((current) => ({ ...current, expensesReleasePolicy: value as ExpenseReleasePolicy }))}
                                                                options={EXPENSE_RELEASE_POLICY_OPTIONS}
                                                            />
                                                        ) : null}
                                                        {allowsTripPay ? (
                                                            <Input
                                                                label="Pago por ruta"
                                                                inputMode="numeric"
                                                                value={form.freightPaymentAmount}
                                                                onChange={(event) => setForm((current) => ({ ...current, freightPaymentAmount: event.target.value.replace(/\D/g, '') }))}
                                                                placeholder="0"
                                                            />
                                                        ) : null}
                                                        {allowsExpenses ? (
                                                            <Input
                                                                label="Viaticos"
                                                                inputMode="numeric"
                                                                value={form.expenseAllowanceAmount}
                                                                onChange={(event) => setForm((current) => ({ ...current, expenseAllowanceAmount: event.target.value.replace(/\D/g, '') }))}
                                                                placeholder="0"
                                                            />
                                                        ) : null}
                                                    </div>
                                                    {form.compensationMode === 'salary_no_trip_pay' ? (
                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                            <p className="text-sm font-semibold text-zinc-950">Nomina mensual activa</p>
                                                            <p className="mt-1 text-sm leading-6 text-zinc-500">
                                                                Este viaje solo asigna la operacion. No crea pago por ruta, no crea viaticos y no libera dinero al aceptar.
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                    <div className="grid gap-3 min-[560px]:grid-cols-2">
                                                        <Input
                                                            label="Responsable de origen"
                                                            value={form.pickupContactName}
                                                            onChange={(event) => setForm((current) => ({ ...current, pickupContactName: event.target.value }))}
                                                            placeholder="Nombre del jefe de bodega"
                                                        />
                                                        <AndeanPhoneInput
                                                            label="Telefono origen"
                                                            value={form.pickupContactPhone}
                                                            onChange={(value) => setForm((current) => ({ ...current, pickupContactPhone: value }))}
                                                            defaultCountryCode={countryCode}
                                                            helperText="Este contacto recibe el PIN de salida."
                                                        />
                                                        <Input
                                                            label="Responsable de entrega"
                                                            value={form.deliveryContactName}
                                                            onChange={(event) => setForm((current) => ({ ...current, deliveryContactName: event.target.value }))}
                                                            placeholder="Nombre del receptor"
                                                        />
                                                        <AndeanPhoneInput
                                                            label="Telefono entrega"
                                                            value={form.deliveryContactPhone}
                                                            onChange={(value) => setForm((current) => ({ ...current, deliveryContactPhone: value }))}
                                                            defaultCountryCode={countryCode}
                                                            helperText="Este contacto recibe el PIN de entrega."
                                                        />
                                                    </div>
                                                    <div className="grid gap-3 min-[560px]:grid-cols-2">
                                                        <Input
                                                            label="Destino"
                                                            value={form.destinationAddress}
                                                            onChange={(event) => setForm((current) => ({ ...current, destinationAddress: event.target.value }))}
                                                            placeholder="Direccion de entrega"
                                                        />
                                                        <Input
                                                            label="Entrega estimada"
                                                            type="datetime-local"
                                                            value={form.deliveryAt}
                                                            onChange={(event) => setForm((current) => ({ ...current, deliveryAt: event.target.value }))}
                                                        />
                                                        <Input
                                                            label="Ciudad destino"
                                                            value={form.destinationCity}
                                                            onChange={(event) => setForm((current) => ({ ...current, destinationCity: event.target.value }))}
                                                        />
                                                        <Input
                                                            label="Departamento"
                                                            value={form.destinationDepartment}
                                                            onChange={(event) => setForm((current) => ({ ...current, destinationDepartment: event.target.value }))}
                                                        />
                                                        <Select
                                                            label="Vehiculo"
                                                            value={form.vehicleType}
                                                            onChange={(value) => setForm((current) => ({ ...current, vehicleType: value }))}
                                                            options={VEHICLE_TYPE_OPTIONS}
                                                            searchable
                                                        />
                                                    </div>
                                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                        <button
                                                            type="button"
                                                            className="text-sm font-semibold text-zinc-950 underline-offset-4 hover:underline"
                                                            onClick={() => setShowAdvancedOfferLink((current) => !current)}
                                                        >
                                                            {showAdvancedOfferLink ? 'Ocultar viaje ya creado' : 'Conectar viaje ya creado'}
                                                        </button>
                                                        {showAdvancedOfferLink ? (
                                                            <Input
                                                                className="mt-3"
                                                                label="OfferId existente"
                                                                value={form.offerId}
                                                                onChange={(event) => setForm((current) => ({ ...current, offerId: event.target.value }))}
                                                                placeholder="Opcional, solo si ya existe"
                                                            />
                                                        ) : null}
                                                    </div>
                                                    {form.compensationMode !== 'salary_no_trip_pay' ? (
                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-white">
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div>
                                                                    <p className="text-sm font-semibold">Resumen privado</p>
                                                                    <p className="mt-1 text-xs text-zinc-300">{getCompensationModeLabel(form.compensationMode)} / {selectedDriver ? getDriverName(selectedDriver) : 'Sin conductor seleccionado'}</p>
                                                                </div>
                                                                <div className="font-money text-sm text-zinc-200">
                                                                    {allowsTripPay ? `${formatCOP(normalizedFreightAmount)} ruta` : null}
                                                                    {allowsTripPay && allowsExpenses ? ' / ' : null}
                                                                    {allowsExpenses ? `${formatCOP(normalizedExpenseAmount)} viaticos` : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                    <p className="text-sm font-semibold text-zinc-950">Solo despacho activo</p>
                                                    <p className="mt-1 text-sm leading-6 text-zinc-500">No se crea viaje ni se notifica conductor. Cambia a “Crear viaje flota privada” para asignar esta salida.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
                                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-zinc-950">Linea de despacho</p>
                                                <p className="mt-1 text-xs text-zinc-500">Selecciona stock disponible. El sistema no permite despachar mas del saldo.</p>
                                            </div>
                                            <Truck className="h-5 w-5 text-zinc-500" aria-hidden="true" />
                                        </div>
                                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
                                            <Select
                                                label="SKU disponible"
                                                value={lineDraft.stockKey}
                                                onChange={(value) => {
                                                    const selected = dispatchableStock.find((item) => item.balance.id === value);
                                                    if (!selected) return;
                                                    setLineDraft((current) => ({
                                                        ...current,
                                                        stockKey: value,
                                                        skuCode: selected.skuCode,
                                                        skuName: selected.skuName,
                                                        locationCode: selected.locationCode,
                                                        requestedQty: '',
                                                        pickedQty: '',
                                                        dispatchedQty: '',
                                                        rejectedQty: '',
                                                        availableQty: selected.availableQty,
                                                    }));
                                                }}
                                                options={stockOptions}
                                                searchable
                                                placeholder="Selecciona SKU"
                                            />
                                            <div className="grid gap-3 min-[560px]:grid-cols-2">
                                                <Input label="Nombre" value={lineDraft.skuName} disabled />
                                                <Input label="Ubicacion" value={lineDraft.locationCode || 'Sin ubicacion'} disabled />
                                            </div>
                                        </div>
                                        <div className="mt-3 grid gap-3 min-[560px]:grid-cols-2 xl:grid-cols-5">
                                            <Input label="Disponible" value={lineDraft.availableQty ? String(lineDraft.availableQty) : ''} disabled />
                                            <Input label="Solicitado" type="number" min={0} value={lineDraft.requestedQty} onChange={(event) => setLineDraft((current) => ({ ...current, requestedQty: event.target.value }))} />
                                            <Input label="Picked" type="number" min={0} value={lineDraft.pickedQty} onChange={(event) => setLineDraft((current) => ({ ...current, pickedQty: event.target.value }))} helperText="Si queda vacio, usa solicitado." />
                                            <Input label="Despachado" type="number" min={0} value={lineDraft.dispatchedQty} onChange={(event) => setLineDraft((current) => ({ ...current, dispatchedQty: event.target.value }))} helperText="Si queda vacio, usa picked." />
                                            <Input label="Rechazado" type="number" min={0} value={lineDraft.rejectedQty} onChange={(event) => setLineDraft((current) => ({ ...current, rejectedQty: event.target.value }))} />
                                        </div>
                                        {formError ? <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm font-medium text-zinc-950">{formError}</p> : null}
                                        <Button variant="outline" className="mt-4" leftIcon={<Plus className="h-4 w-4" />} onClick={addLine}>
                                            Agregar linea
                                        </Button>
                                    </div>

                                    {lines.length ? (
                                        <div className="space-y-3">
                                            <WmsMetricGrid dense>
                                                <WmsMetric label="Solicitado" value={draftTotals.requested} />
                                                <WmsMetric label="Picked" value={draftTotals.picked} />
                                                <WmsMetric label="Despacho" value={draftTotals.dispatched} />
                                                <WmsMetric label="Rechazo" value={draftTotals.rejected} />
                                            </WmsMetricGrid>
                                            <div className="grid gap-3">
                                                {lines.map((line, index) => (
                                                    <div key={`${line.skuCode}-${index}`} className="rounded-lg border border-zinc-200 bg-white p-3">
                                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-zinc-950">{line.skuCode} / {line.skuName}</p>
                                                                <p className="mt-1 font-money text-xs text-zinc-500">
                                                                    Sol {line.requestedQty} / Pick {line.pickedQty} / Disp {line.dispatchedQty} / Rech {line.rejectedQty}
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
                                        </div>
                                    ) : null}

                                    <Button
                                        fullWidth
                                        isLoading={saving}
                                        disabled={!capabilities?.manageDispatches}
                                        leftIcon={privateTripDraft ? <Route className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                                        onClick={async () => {
                                            const requiresTripPay = form.compensationMode === 'trip_pay' || form.compensationMode === 'trip_pay_plus_expenses';
                                            const requiresExpenses = form.compensationMode === 'expenses_only' || form.compensationMode === 'trip_pay_plus_expenses';

                                            if (!lines.length) {
                                                setFormError('Agrega al menos una linea con stock disponible.');
                                                return;
                                            }

                                            if (privateTripDraft && !form.offerId.trim() && !form.privateFleetTruckerId.trim()) {
                                                setFormError('Selecciona un conductor privado activo para crear el viaje.');
                                                return;
                                            }

                                            if (privateTripDraft && !form.offerId.trim() && (!form.destinationAddress.trim() || !form.destinationCity.trim() || !form.destinationDepartment.trim())) {
                                                setFormError('Completa destino, ciudad y departamento para crear el viaje privado.');
                                                return;
                                            }

                                            if (
                                                privateTripDraft
                                                && !form.offerId.trim()
                                                && (
                                                    !form.pickupContactName.trim()
                                                    || !form.deliveryContactName.trim()
                                                    || !validateAndeanPhoneValue(form.pickupContactPhone, countryCode)
                                                    || !validateAndeanPhoneValue(form.deliveryContactPhone, countryCode)
                                                )
                                            ) {
                                                setFormError('Completa responsable y telefono validos de origen y entrega para enviar los PIN.');
                                                return;
                                            }

                                            if (privateTripDraft && !form.offerId.trim() && requiresTripPay && freightAmount <= 0) {
                                                setFormError('Este modo requiere un pago por ruta mayor a cero.');
                                                return;
                                            }

                                            if (privateTripDraft && !form.offerId.trim() && requiresExpenses && expenseAmount <= 0) {
                                                setFormError('Este modo requiere un valor de viaticos mayor a cero.');
                                                return;
                                            }

                                            setSaving(true);
                                            try {
                                                await warehouseClient.createDispatch(warehouseId, {
                                                    dispatchNumber: form.dispatchNumber.trim() || buildWarehouseNumber('DSP'),
                                                    offerId: form.offerId.trim() || undefined,
                                                    scheduledAt: form.scheduledAt || undefined,
                                                    notes: form.notes.trim() || undefined,
                                                    dispatchTripMode: form.dispatchTripMode,
                                                    tripDetails: form.dispatchTripMode === 'dispatch_only' ? undefined : {
                                                        privateFleetTruckerId: form.privateFleetTruckerId.trim() || undefined,
                                                        compensationMode: form.compensationMode,
                                                        expensesReleasePolicy: form.expensesReleasePolicy,
                                                        freightPaymentAmount: normalizedFreightAmount,
                                                        expenseAllowanceAmount: normalizedExpenseAmount,
                                                        pickupContactName: form.pickupContactName.trim() || undefined,
                                                        pickupContactPhone: form.pickupContactPhone.trim() || undefined,
                                                        deliveryContactName: form.deliveryContactName.trim() || undefined,
                                                        deliveryContactPhone: form.deliveryContactPhone.trim() || undefined,
                                                        destinationAddress: form.destinationAddress.trim() || undefined,
                                                        destinationCity: form.destinationCity.trim() || undefined,
                                                        destinationDepartment: form.destinationDepartment.trim() || undefined,
                                                        vehicleType: form.vehicleType.trim() || undefined,
                                                        deliveryAt: form.deliveryAt || undefined,
                                                    },
                                                    lines,
                                                });
                                                setForm({
                                                    dispatchNumber: '',
                                                    offerId: '',
                                                    scheduledAt: '',
                                                    deliveryAt: '',
                                                    notes: '',
                                                    dispatchTripMode: 'dispatch_only',
                                                    privateFleetTruckerId: '',
                                                    compensationMode: 'salary_no_trip_pay',
                                                    expensesReleasePolicy: 'acceptance',
                                                    freightPaymentAmount: '',
                                                    expenseAllowanceAmount: '',
                                                    pickupContactName: '',
                                                    pickupContactPhone: '',
                                                    deliveryContactName: '',
                                                    deliveryContactPhone: '',
                                                    destinationAddress: '',
                                                    destinationCity: '',
                                                    destinationDepartment: '',
                                                    vehicleType: VEHICLE_TYPE_OPTIONS[0]?.value || 'TURBO',
                                                });
                                                setLines([]);
                                                setFormError('');
                                                toast.success(
                                                    privateTripDraft ? 'Despacho y viaje creados' : 'Despacho creado',
                                                    privateTripDraft ? 'El conductor privado recibira el viaje asignado.' : 'Stock, lineas y manifiesto quedaron registrados.'
                                                );
                                                await reload();
                                            } catch (error) {
                                                toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo crear el despacho');
                                            } finally {
                                                setSaving(false);
                                            }
                                        }}
                                    >
                                        {privateTripDraft ? 'Registrar despacho y crear viaje flota privada' : 'Registrar despacho'}
                                    </Button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Manifiestos y viajes creados" description="Una sola banda para revisar estado, lineas, stock despachado y enlace al viaje privado.">
                                <div className="space-y-4">
                                    {dispatches.map((dispatchItem) => {
                                        const extra = getDispatchExtra(dispatchItem);
                                        const totals = persistedLineTotals(dispatchItem.lines);
                                        const tripMode = extra.dispatch_trip_mode || extra.metadata?.dispatchTripMode || 'dispatch_only';
                                        const nextStatuses = dispatchItem.status === 'draft' ? ['picking', 'cancelled']
                                            : dispatchItem.status === 'picking' ? ['ready', 'cancelled']
                                                : dispatchItem.status === 'ready' ? ['dispatched', 'cancelled']
                                                    : [];

                                        return (
                                            <div key={dispatchItem.id} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_18px_50px_-46px_rgba(10,10,10,.55)]">
                                                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                                    <div className="flex min-w-0 items-start gap-3">
                                                        <WmsCompletionMark done={dispatchItem.status === 'dispatched'} />
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-semibold text-zinc-950">{dispatchItem.dispatch_number}</p>
                                                                <WmsStatusBadge label={getDispatchStatusLabel(dispatchItem.status)} tone={dispatchTone(dispatchItem.status)} />
                                                            </div>
                                                            <p className="mt-2 text-sm text-zinc-500">{formatWarehouseDateTime(dispatchItem.dispatched_at || dispatchItem.scheduled_at || dispatchItem.created_at)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[28rem]">
                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                                            <p className="inline-flex items-center gap-1 font-money text-sm text-zinc-600">
                                                                <Link2 className="h-4 w-4" aria-hidden="true" />
                                                                {dispatchItem.offer_id ? dispatchItem.offer_id.slice(0, 8) : 'sin viaje'}
                                                            </p>
                                                            <p className="mt-1 text-xs text-zinc-500">{getDispatchModeLabel(tripMode)}</p>
                                                        </div>
                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                                            <p className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-950">
                                                                <Wallet className="h-4 w-4" aria-hidden="true" />
                                                                {extra.trip_creation_status || 'no solicitado'}
                                                            </p>
                                                            <p className="mt-1 text-xs text-zinc-500">Estado de creacion de viaje</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <WmsMetricGrid dense className="mt-4">
                                                    <WmsMetric label="Solicitado" value={totals.requested} />
                                                    <WmsMetric label="Picked" value={totals.picked} />
                                                    <WmsMetric label="Despacho" value={totals.dispatched} />
                                                    <WmsMetric label="Rechazo" value={totals.rejected} />
                                                </WmsMetricGrid>

                                                {dispatchItem.lines?.length ? (
                                                    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                                                        {dispatchItem.lines.map((line: WarehouseDispatchLine) => (
                                                            <div key={line.id} className="grid min-w-0 gap-2 border-b border-zinc-100 px-3 py-3 last:border-b-0 min-[380px]:px-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-zinc-950">{line.sku_code_snapshot} / {line.sku_name_snapshot}</p>
                                                                    <p className="text-xs text-zinc-500">{line.location?.code || 'Sin ubicacion'}</p>
                                                                </div>
                                                                <p className="font-money text-sm text-zinc-600">
                                                                    Sol {line.requested_qty} / Disp {line.dispatched_qty} / Rech {line.rejected_qty}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}

                                                {capabilities?.manageDispatches && nextStatuses.length ? (
                                                    <WmsActionRow className="mt-4">
                                                        {nextStatuses.map((nextStatus) => (
                                                            <Button
                                                                key={nextStatus}
                                                                size="sm"
                                                                variant={nextStatus === 'cancelled' ? 'outline' : 'secondary'}
                                                                disabled={processingId === dispatchItem.id}
                                                                onClick={async () => {
                                                                    try {
                                                                        setProcessingId(dispatchItem.id);
                                                                        await warehouseClient.updateDispatch(warehouseId, dispatchItem.id, { status: nextStatus });
                                                                        toast.success('Despacho actualizado');
                                                                        await reload();
                                                                    } catch (error) {
                                                                        toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo actualizar el despacho');
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
                                            </div>
                                        );
                                    })}
                                    {dispatches.length === 0 ? (
                                        <WmsEmptyState
                                            title="Sin despachos"
                                            description="Crea un despacho desde stock disponible para activar manifiesto, picking, salida y viaje privado cuando aplique."
                                        />
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
