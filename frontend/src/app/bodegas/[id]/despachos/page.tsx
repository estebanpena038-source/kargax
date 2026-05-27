'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, PackageCheck, Plus, Route, Trash2, Truck, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AndeanPhoneInput, Button, Input, Select, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { validateAndeanPhoneValue } from '@/lib/phone/andean';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsMetric,
    WmsMetricGrid,
    WmsTextArea,
} from '@/components/warehouses/WarehouseExecutionLuxury';
import { COLOMBIAN_DEPARTMENTS, VEHICLE_TYPES, formatCOP, getCitiesByDepartment } from '@/constants/colombia';
import warehouseClient from '@/lib/warehouses/client';
import { cn } from '@/lib/utils';
import {
    mapWarehouseErrorMessage,
    resolveWarehouseCountry,
} from '@/lib/warehouses/localization';
import type { BusinessFleetMember, Warehouse, WarehouseStockBalance } from '@/lib/warehouses/types';

type DispatchTripMode = 'dispatch_only' | 'private_fleet_trip' | 'marketplace_offer';
type DispatchDestinationType = 'final_customer' | 'warehouse';
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
    destinationType: DispatchDestinationType;
    destinationWarehouseId: string;
    destinationAddress: string;
    destinationCity: string;
    destinationDepartment: string;
    destinationLatitude: number | null;
    destinationLongitude: number | null;
    vehicleType: string;
};

const DISPATCH_MODE_OPTIONS: Array<{ value: DispatchTripMode; label: string; description: string }> = [
    { value: 'dispatch_only', label: 'Solo despacho', description: 'Registra salida de inventario sin crear viaje.' },
    { value: 'private_fleet_trip', label: 'Crear viaje flota privada', description: 'Asigna conductor interno y crea el viaje automaticamente.' },
];

const DESTINATION_TYPE_OPTIONS: Array<{ value: DispatchDestinationType; label: string; description: string }> = [
    { value: 'final_customer', label: 'Cliente final', description: 'Direccion manual de entrega y contacto receptor.' },
    { value: 'warehouse', label: 'Otra bodega', description: 'Autocompleta destino desde una bodega activa de la empresa.' },
];

const COMPENSATION_MODE_OPTIONS: Array<{ value: CompensationMode; label: string; description: string }> = [
    { value: 'salary_no_trip_pay', label: 'Nomina mensual', description: 'Se liquida por nomina externa, sin montos dentro del viaje.' },
    { value: 'trip_pay', label: 'Pago por ruta', description: 'Flete privado pendiente de comprobante externo.' },
    { value: 'expenses_only', label: 'Solo viaticos', description: 'Gastos privados pendientes de comprobante externo.' },
    { value: 'trip_pay_plus_expenses', label: 'Ruta + viaticos', description: 'Flete y gastos privados con comprobante externo.' },
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

export default function WarehouseDispatchesPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const warehouseId = params?.id as string;
    const { user } = useAuthStore();
    const countryCode = resolveWarehouseCountry(user?.country);
    const [saving, setSaving] = React.useState(false);
    const [formError, setFormError] = React.useState('');
    const [showAdvancedOfferLink, setShowAdvancedOfferLink] = React.useState(false);
    const [fleetMembers, setFleetMembers] = React.useState<BusinessFleetMember[]>([]);
    const [fleetLoading, setFleetLoading] = React.useState(false);
    const [fleetError, setFleetError] = React.useState<string | null>(null);
    const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
    const [warehousesLoading, setWarehousesLoading] = React.useState(false);
    const [warehousesError, setWarehousesError] = React.useState<string | null>(null);
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
        destinationType: 'final_customer',
        destinationWarehouseId: '',
        destinationAddress: '',
        destinationCity: '',
        destinationDepartment: '',
        destinationLatitude: null,
        destinationLongitude: null,
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

        const loadDispatchContext = async () => {
            setFleetLoading(true);
            setWarehousesLoading(true);
            setFleetError(null);
            setWarehousesError(null);
            try {
                const [fleetResponse, warehouseResponse] = await Promise.all([
                    warehouseClient.getBusinessFleet(),
                    warehouseClient.list(),
                ]);
                if (!cancelled) {
                    setFleetMembers(fleetResponse.data || []);
                    setWarehouses(warehouseResponse.data || []);
                }
            } catch (error) {
                if (!cancelled) {
                    const message = error instanceof Error ? error.message : 'No se pudo cargar flota y bodegas';
                    setFleetError(message);
                    setWarehousesError(message);
                }
            } finally {
                if (!cancelled) {
                    setFleetLoading(false);
                    setWarehousesLoading(false);
                }
            }
        };

        void loadDispatchContext();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <DashboardLayout pageTitle="Despachos">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="dispatches"
                renderSection={({ warehouse, stock, capabilities, reload }) => {
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
                    const destinationWarehouseOptions = warehouses
                        .filter((item) => item.id !== warehouseId && item.status === 'active')
                        .map((item) => ({
                            value: item.id,
                            label: item.name,
                            description: `${item.code} / ${item.city}, ${item.department}`,
                        }));
                    const selectedDestinationWarehouse = warehouses.find((item) => item.id === form.destinationWarehouseId) || null;
                    const selectedDriver = activeFleetMembers.find((member) => member.trucker_id === form.privateFleetTruckerId);
                    const draftTotals = lineTotals(lines);
                    const privateTripDraft = form.dispatchTripMode === 'private_fleet_trip';
                    const allowsTripPay = form.compensationMode === 'trip_pay' || form.compensationMode === 'trip_pay_plus_expenses';
                    const allowsExpenses = form.compensationMode === 'expenses_only' || form.compensationMode === 'trip_pay_plus_expenses';
                    const freightAmount = Number(form.freightPaymentAmount || 0);
                    const expenseAmount = Number(form.expenseAllowanceAmount || 0);
                    const normalizedFreightAmount = allowsTripPay ? freightAmount : 0;
                    const normalizedExpenseAmount = allowsExpenses ? expenseAmount : 0;
                    const destinationDepartmentOptions = COLOMBIAN_DEPARTMENTS.map((department) => ({
                        value: department.code,
                        label: department.name,
                        description: department.capital,
                    }));
                    const destinationCities = form.destinationDepartment ? getCitiesByDepartment(form.destinationDepartment) : [];
                    const destinationCityOptions = destinationCities.map((city) => ({
                        value: city.code,
                        label: city.name,
                    }));
                    const selectedDestinationDepartment = COLOMBIAN_DEPARTMENTS.find((department) => department.code === form.destinationDepartment);
                    const selectedDestinationCity = destinationCities.find((city) => city.code === form.destinationCity);
                    const destinationDepartmentLabel = selectedDestinationDepartment?.name || form.destinationDepartment.trim();
                    const destinationCityLabel = selectedDestinationCity?.name || form.destinationCity.trim();

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
                        <div className="space-y-4 sm:space-y-5">
                            <SectionCard
                                title="Crear despacho y viaje privado"
                                description={`Dos caminos claros: con bodega sale desde ${warehouse?.name || 'inventario'}; sin bodega crea una ruta directa para flota privada.`}
                            >
                                    <div className="space-y-4">
                                        <WmsMetricGrid dense>
                                        <WmsMetric label="Stock apto" value={dispatchableStock.length} detail="Saldos disponibles" />
                                        <WmsMetric label="Lineas" value={lines.length} detail="Borrador actual" />
                                        <WmsMetric label="Unidades" value={draftTotals.dispatched} detail="A despachar" />
                                        <WmsMetric label="Conductor" value={privateTripDraft ? (selectedDriver ? 'Listo' : 'Pendiente') : 'No aplica'} detail="Asignacion privada" />
                                    </WmsMetricGrid>

                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3.5">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex min-w-0 flex-1 flex-col justify-between rounded-lg border border-zinc-950 bg-white p-3.5 shadow-none">
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
                                                className="flex min-w-0 flex-1 flex-col justify-between rounded-lg border border-zinc-200 bg-white p-3.5 text-left transition hover:border-zinc-950"
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

                                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5">
                                        <div className="flex flex-col gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-zinc-950">Modo de salida desde bodega</p>
                                                <p className="mt-1 text-sm text-zinc-500">Elige si solo baja inventario o si tambien crea viaje privado.</p>
                                            </div>
                                            <div className="flex flex-col gap-2">
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
                                                                ? 'border-zinc-950 bg-zinc-950 text-white shadow-none'
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

                                    <div className="grid gap-3.5">
                                        <div className="space-y-3.5 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                                <Truck className="h-4 w-4" aria-hidden="true" />
                                                Datos del despacho
                                            </div>
                                            <div className="grid gap-3">
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

                                        <div className="space-y-3.5 rounded-lg border border-zinc-200 bg-white p-3.5">
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
                                                    <div className="grid gap-3">
                                                        <Select
                                                            label="Modo de liquidacion privada"
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
                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                                            <p className="text-sm font-semibold text-zinc-950">Nomina mensual activa</p>
                                                            <p className="mt-1 text-sm leading-6 text-zinc-500">
                                                                Este viaje solo asigna la operacion. No crea pago por ruta, no crea viaticos y no libera dinero al aceptar.
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                    {form.compensationMode !== 'salary_no_trip_pay' ? (
                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                                            <p className="text-sm font-semibold text-zinc-950">Comprobante externo requerido</p>
                                                            <p className="mt-1 text-sm leading-6 text-zinc-500">
                                                                Finanzas registra el pago externo despues. KargaX no crea saldo retirable ni payout por este viaje privado.
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                    <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                                        <Select
                                                            label="Destino del viaje privado"
                                                            value={form.destinationType}
                                                            onChange={(value) => {
                                                                const nextDestinationType = value as DispatchDestinationType;
                                                                setForm((current) => ({
                                                                    ...current,
                                                                    destinationType: nextDestinationType,
                                                                    destinationWarehouseId: nextDestinationType === 'warehouse' ? current.destinationWarehouseId : '',
                                                                    destinationAddress: nextDestinationType === 'warehouse' ? current.destinationAddress : '',
                                                                    destinationCity: nextDestinationType === 'warehouse' ? current.destinationCity : '',
                                                                    destinationDepartment: nextDestinationType === 'warehouse' ? current.destinationDepartment : '',
                                                                    destinationLatitude: nextDestinationType === 'warehouse' ? current.destinationLatitude : null,
                                                                    destinationLongitude: nextDestinationType === 'warehouse' ? current.destinationLongitude : null,
                                                                }));
                                                            }}
                                                            options={DESTINATION_TYPE_OPTIONS}
                                                        />
                                                        {form.destinationType === 'warehouse' ? (
                                                            <>
                                                                <Select
                                                                    label="Bodega destino"
                                                                    value={form.destinationWarehouseId}
                                                                    onChange={(value) => {
                                                                        const nextWarehouse = warehouses.find((item) => item.id === value);
                                                                        setForm((current) => ({
                                                                            ...current,
                                                                            destinationWarehouseId: value,
                                                                            destinationAddress: nextWarehouse?.address || '',
                                                                            destinationCity: nextWarehouse?.city || '',
                                                                            destinationDepartment: nextWarehouse?.department || '',
                                                                            destinationLatitude: nextWarehouse?.latitude ?? null,
                                                                            destinationLongitude: nextWarehouse?.longitude ?? null,
                                                                        }));
                                                                    }}
                                                                    options={destinationWarehouseOptions}
                                                                    placeholder={warehousesLoading ? 'Cargando bodegas...' : 'Selecciona bodega destino'}
                                                                    isLoading={warehousesLoading}
                                                                    disabled={warehousesLoading || destinationWarehouseOptions.length === 0}
                                                                    searchable
                                                                />
                                                                {warehousesError ? (
                                                                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warehousesError}</p>
                                                                ) : null}
                                                                {!warehousesLoading && destinationWarehouseOptions.length === 0 ? (
                                                                    <p className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">No hay otra bodega activa para conectar este despacho.</p>
                                                                ) : null}
                                                                {selectedDestinationWarehouse ? (
                                                                    <div className="rounded-lg border border-zinc-200 bg-white p-3">
                                                                        <p className="font-semibold text-zinc-950">{selectedDestinationWarehouse.name}</p>
                                                                        <p className="mt-1 text-sm leading-6 text-zinc-500">
                                                                            {selectedDestinationWarehouse.address} / {selectedDestinationWarehouse.city}, {selectedDestinationWarehouse.department}
                                                                        </p>
                                                                    </div>
                                                                ) : null}
                                                            </>
                                                        ) : null}
                                                    </div>
                                                    <div className="grid gap-3">
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
                                                    <div className="grid gap-3">
                                                        <Input
                                                            label={form.destinationType === 'warehouse' ? 'Direccion bodega destino' : 'Destino'}
                                                            value={form.destinationAddress}
                                                            onChange={(event) => setForm((current) => ({
                                                                ...current,
                                                                destinationAddress: event.target.value,
                                                                destinationLatitude: null,
                                                                destinationLongitude: null,
                                                            }))}
                                                            placeholder="Direccion de entrega"
                                                            disabled={form.destinationType === 'warehouse'}
                                                        />
                                                        <Input
                                                            label="Entrega estimada"
                                                            type="datetime-local"
                                                            value={form.deliveryAt}
                                                            onChange={(event) => setForm((current) => ({ ...current, deliveryAt: event.target.value }))}
                                                        />
                                                        {form.destinationType === 'warehouse' ? (
                                                            <div className="grid gap-3">
                                                                <Input label="Departamento destino" value={form.destinationDepartment} disabled />
                                                                <Input label="Ciudad destino" value={form.destinationCity} disabled />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Select
                                                                    label="Departamento destino"
                                                                    value={form.destinationDepartment}
                                                                    onChange={(value) => setForm((current) => ({
                                                                        ...current,
                                                                        destinationDepartment: value,
                                                                        destinationCity: '',
                                                                        destinationLatitude: null,
                                                                        destinationLongitude: null,
                                                                    }))}
                                                                    options={destinationDepartmentOptions}
                                                                    placeholder="Selecciona departamento"
                                                                    searchable
                                                                />
                                                                <Select
                                                                    label="Ciudad destino"
                                                                    value={form.destinationCity}
                                                                    onChange={(value) => setForm((current) => ({
                                                                        ...current,
                                                                        destinationCity: value,
                                                                        destinationLatitude: null,
                                                                        destinationLongitude: null,
                                                                    }))}
                                                                    options={destinationCityOptions}
                                                                    placeholder={form.destinationDepartment ? 'Selecciona ciudad' : 'Primero el departamento'}
                                                                    disabled={!form.destinationDepartment}
                                                                    searchable
                                                                />
                                                            </>
                                                        )}
                                                        <Select
                                                            label="Vehiculo"
                                                            value={form.vehicleType}
                                                            onChange={(value) => setForm((current) => ({ ...current, vehicleType: value }))}
                                                            options={VEHICLE_TYPE_OPTIONS}
                                                            searchable
                                                        />
                                                    </div>
                                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
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
                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-3.5 text-white">
                                                            <div className="flex flex-col gap-3">
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
                                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                                    <p className="text-sm font-semibold text-zinc-950">Solo despacho activo</p>
                                                    <p className="mt-1 text-sm leading-6 text-zinc-500">No se crea viaje ni se notifica conductor. Cambia a “Crear viaje flota privada” para asignar esta salida.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5">
                                        <div className="mb-4 flex flex-col gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-zinc-950">Linea de despacho</p>
                                                <p className="mt-1 text-xs text-zinc-500">Selecciona stock disponible. El sistema no permite despachar mas del saldo.</p>
                                            </div>
                                            <Truck className="h-5 w-5 text-zinc-500" aria-hidden="true" />
                                        </div>
                                        <div className="grid gap-3">
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
                                            <div className="grid gap-3">
                                                <Input label="Nombre" value={lineDraft.skuName} disabled />
                                                <Input label="Ubicacion" value={lineDraft.locationCode || 'Sin ubicacion'} disabled />
                                            </div>
                                        </div>
                                        <div className="mt-3 grid gap-3">
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
                                            <div className="grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
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

                                            if (privateTripDraft && !form.offerId.trim() && form.destinationType === 'warehouse' && !form.destinationWarehouseId.trim()) {
                                                setFormError('Selecciona la bodega destino para crear el viaje bodega a bodega.');
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
                                                    dispatchNumber: form.dispatchNumber.trim() || undefined,
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
                                                        destinationType: form.destinationType,
                                                        destinationWarehouseId: form.destinationType === 'warehouse' ? form.destinationWarehouseId.trim() || undefined : undefined,
                                                        destinationAddress: form.destinationAddress.trim() || undefined,
                                                        destinationCity: destinationCityLabel || undefined,
                                                        destinationDepartment: destinationDepartmentLabel || undefined,
                                                        destinationLatitude: form.destinationLatitude,
                                                        destinationLongitude: form.destinationLongitude,
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
                                                    destinationType: 'final_customer',
                                                    destinationWarehouseId: '',
                                                    destinationAddress: '',
                                                    destinationCity: '',
                                                    destinationDepartment: '',
                                                    destinationLatitude: null,
                                                    destinationLongitude: null,
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
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
