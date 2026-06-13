'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    Archive,
    ArrowRight,
    BarChart3,
    Building2,
    ChevronRight,
    LockKeyhole,
    MapPin,
    Package,
    Pencil,
    Plus,
    RotateCcw,
    ShieldCheck,
    Warehouse,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import {
    Badge,
    Button,
    Card,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Input,
    Select,
    toast,
} from '@/components/ui';
import { PlanLimitPaywallDialog } from '@/components/billing/PlanLimitPaywallDialog';
import LocationSelector from '@/components/location/LocationSelector';
import { getCountryConfig, type CountryConfig } from '@/constants/countries';
import { useAuthStore } from '@/features/auth/store/authStore';
import warehouseClient from '@/lib/warehouses/client';
import { CoordinatePicker } from '@/components/maps/CoordinatePicker';
import { isPlanLimitReachedError, type PlanLimitErrorDetails } from '@/lib/billing/plan-limits';
import type { GeoZoneType, LocationSelectorValue } from '@/lib/geo/types';
import {
    getCityDisplayName,
    getCityOptions,
    getFlowModeLabel,
    getSubdivisionDisplayName,
    getSubdivisionOptions,
    resolveWarehouseCountry,
} from '@/lib/warehouses/localization';
import type { BusinessPlanSubscription, Warehouse as WarehouseType, WarehouseListResponse } from '@/lib/warehouses/types';

type WarehouseFormState = {
    code: string;
    name: string;
    department: string;
    city: string;
    address: string;
    departmentId: string | null;
    municipalityId: string | null;
    localZoneId: string | null;
    localZoneName: string;
    localZoneType: GeoZoneType | '';
    addressReference: string;
    latitude: number | null;
    longitude: number | null;
    gpsToleranceMeters: string;
    description: string;
    flowMode: 'warehouse_managed' | 'manual' | '3pl';
    status: 'active' | 'inactive' | 'maintenance';
};

type WarehouseFormFieldsProps = {
    form: WarehouseFormState;
    countryConfig: CountryConfig;
    subdivisionOptions: Array<{ value: string; label: string; description?: string }>;
    cityOptions: Array<{ value: string; label: string; description?: string }>;
    onChange: (patch: Partial<WarehouseFormState>) => void;
    includeStatus?: boolean;
};

const EMPTY_CREATE_FORM: WarehouseFormState = {
    code: '',
    name: '',
    department: '',
    city: '',
    address: '',
    departmentId: null,
    municipalityId: null,
    localZoneId: null,
    localZoneName: '',
    localZoneType: '',
    addressReference: '',
    latitude: null,
    longitude: null,
    gpsToleranceMeters: '500',
    description: '',
    flowMode: 'warehouse_managed',
    status: 'active',
};

const FLOW_MODE_OPTIONS = [
    { value: 'warehouse_managed', label: 'Gestionada por KargaX' },
    { value: 'manual', label: 'Operacion manual' },
    { value: '3pl', label: 'Operador 3PL' },
] as const;

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activa' },
    { value: 'inactive', label: 'Archivada' },
    { value: 'maintenance', label: 'Mantenimiento' },
] as const;

const EMPTY_LIMITS: WarehouseListResponse['limits'] = {
    activeWarehouses: 0,
    maxWarehouses: null,
    activeInternalUsers: 0,
    maxInternalUsers: null,
    monthlyTrips: 0,
    maxMonthlyTrips: null,
    activePrivateFleetDrivers: 0,
    maxPrivateFleetDrivers: null,
};

function getStatusBadgeVariant(status: WarehouseType['status']) {
    if (status === 'active') return 'primary';
    if (status === 'maintenance') return 'outline';
    return 'default';
}

function getStatusLabel(status: WarehouseType['status']) {
    return STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

function toWarehouseFormState(warehouse: WarehouseType): WarehouseFormState {
    return {
        code: warehouse.code,
        name: warehouse.name,
        department: warehouse.department,
        city: warehouse.city,
        address: warehouse.address,
        departmentId: warehouse.department_id || null,
        municipalityId: warehouse.municipality_id || null,
        localZoneId: warehouse.local_zone_id || null,
        localZoneName: warehouse.local_zone_name_legacy || '',
        localZoneType: '',
        addressReference: warehouse.address_reference || '',
        latitude: warehouse.latitude,
        longitude: warehouse.longitude,
        gpsToleranceMeters: String(warehouse.gps_tolerance_meters || 500),
        description: warehouse.description || '',
        flowMode: warehouse.flow_mode,
        status: warehouse.status,
    };
}

function WarehouseFormFields({
    form,
    countryConfig,
    subdivisionOptions,
    cityOptions,
    onChange,
    includeStatus = false,
}: WarehouseFormFieldsProps) {
    const isColombia = countryConfig.code === 'CO';
    const departmentDisplayName = getSubdivisionDisplayName(countryConfig.code, form.department) || form.department;
    const cityDisplayName = getCityDisplayName(countryConfig.code, form.city) || form.city;
    const locationValue = React.useMemo<LocationSelectorValue>(() => ({
        countryCode: 'CO',
        departmentId: form.departmentId,
        departmentName: departmentDisplayName,
        municipalityId: form.municipalityId,
        municipalityName: cityDisplayName,
        localZoneId: form.localZoneId,
        localZoneName: form.localZoneName,
        localZoneType: form.localZoneType,
        exactAddress: form.address,
        reference: form.addressReference,
        isManualZone: Boolean(form.localZoneName && !form.localZoneId),
    }), [cityDisplayName, departmentDisplayName, form]);

    const handleLocationChange = React.useCallback((location: LocationSelectorValue) => {
        onChange({
            department: location.departmentName || '',
            city: location.municipalityName || '',
            address: location.exactAddress || '',
            departmentId: location.departmentId || null,
            municipalityId: location.municipalityId || null,
            localZoneId: location.localZoneId || null,
            localZoneName: location.localZoneName || '',
            localZoneType: location.localZoneType || '',
            addressReference: location.reference || '',
            latitude: null,
            longitude: null,
        });
    }, [onChange]);

    return (
        <div className="space-y-5">
            <div className="grid min-w-0 gap-4">
                <Input label="Pais" value={countryConfig.name} disabled />
                <Input
                    label="Codigo"
                    value={form.code}
                    onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
                    placeholder="KX-BOG-01"
                />
                <Input
                    label="Nombre"
                    value={form.name}
                    onChange={(event) => onChange({ name: event.target.value })}
                    placeholder="Centro logistico norte"
                />
                {isColombia ? (
                    <LocationSelector
                        value={locationValue}
                        onChange={handleLocationChange}
                        mode="bodega"
                        required
                        allowManualZone
                        showExactAddress
                        showReference
                        defaultDepartment={departmentDisplayName}
                        defaultMunicipality={cityDisplayName}
                    />
                ) : (
                    <>
                        <Select
                            label={countryConfig.subdivisionLabel}
                            value={form.department}
                            onChange={(value) => onChange({ department: value, city: '', latitude: null, longitude: null })}
                            options={subdivisionOptions}
                            searchable
                            placeholder={`Selecciona ${countryConfig.subdivisionLabel.toLowerCase()}`}
                        />
                        <Select
                            label={countryConfig.cityLabel}
                            value={form.city}
                            onChange={(value) => onChange({ city: value, latitude: null, longitude: null })}
                            options={cityOptions}
                            searchable
                            disabled={!form.department}
                            placeholder={`Selecciona ${countryConfig.cityLabel.toLowerCase()}`}
                        />
                        <Input
                            label="Direccion"
                            value={form.address}
                            onChange={(event) => onChange({ address: event.target.value, latitude: null, longitude: null })}
                            placeholder="Direccion operativa"
                        />
                    </>
                )}
                <Input
                    label="Radio GPS permitido (m)"
                    inputMode="numeric"
                    value={form.gpsToleranceMeters}
                    onChange={(event) => onChange({ gpsToleranceMeters: event.target.value.replace(/\D/g, '') })}
                    placeholder="500"
                />
                <Select
                    label="Modo operativo"
                    value={form.flowMode}
                    onChange={(value) => onChange({ flowMode: value as WarehouseFormState['flowMode'] })}
                    options={FLOW_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                />
                {includeStatus ? (
                    <Select
                        label="Estado"
                        value={form.status}
                        onChange={(value) => onChange({ status: value as WarehouseFormState['status'] })}
                        options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    />
                ) : null}
            </div>
            <CoordinatePicker
                label="Coordenadas GPS de la bodega"
                address={form.address}
                city={cityDisplayName}
                department={departmentDisplayName}
                countryCode={countryConfig.code}
                value={{
                    latitude: form.latitude,
                    longitude: form.longitude,
                }}
                onChange={(coords) => onChange({
                    latitude: coords.latitude ?? null,
                    longitude: coords.longitude ?? null,
                })}
                helperText="Este punto se usa para bloquear la carga hasta que el conductor llegue realmente a la bodega."
                required
            />
            <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700" htmlFor="warehouse-description">
                    Descripcion operativa
                </label>
                <textarea
                    id="warehouse-description"
                    value={form.description}
                    onChange={(event) => onChange({ description: event.target.value })}
                    className="min-h-[112px] w-full min-w-0 rounded-lg border border-zinc-200 bg-white/90 px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
                    placeholder="Notas de capacidad, horarios, clientes o flujo principal."
                />
            </div>
        </div>
    );
}

export default function WarehousesPage() {
    const { user } = useAuthStore();
    const countryCode = resolveWarehouseCountry(user?.country);
    const countryConfig = getCountryConfig(countryCode);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [changingStatusId, setChangingStatusId] = React.useState<string | null>(null);
    const [warehouses, setWarehouses] = React.useState<WarehouseType[]>([]);
    const [subscription, setSubscription] = React.useState<BusinessPlanSubscription | null>(null);
    const [canManageWarehouses, setCanManageWarehouses] = React.useState(false);
    const [limits, setLimits] = React.useState<WarehouseListResponse['limits']>(EMPTY_LIMITS);
    const [planLimitDetails, setPlanLimitDetails] = React.useState<PlanLimitErrorDetails | null>(null);
    const [planLimitOpen, setPlanLimitOpen] = React.useState(false);
    const [createForm, setCreateForm] = React.useState<WarehouseFormState>(EMPTY_CREATE_FORM);
    const [editingWarehouse, setEditingWarehouse] = React.useState<WarehouseType | null>(null);
    const [editForm, setEditForm] = React.useState<WarehouseFormState>(EMPTY_CREATE_FORM);
    const [showForm, setShowForm] = React.useState(false);
    const subdivisionOptions = React.useMemo(() => getSubdivisionOptions(countryCode), [countryCode]);
    const createCityOptions = React.useMemo(() => getCityOptions(countryCode, createForm.department), [countryCode, createForm.department]);
    const editCityOptions = React.useMemo(() => getCityOptions(countryCode, editForm.department), [countryCode, editForm.department]);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const result = await warehouseClient.list();
            setWarehouses(Array.isArray(result.data) ? result.data : []);
            setSubscription(result.subscription ?? null);
            setCanManageWarehouses(Boolean(result.isOwner || result.role === 'admin'));
            setLimits(result.limits ?? EMPTY_LIMITS);
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudieron cargar las bodegas');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    const activeWarehouseCount = warehouses.filter((warehouse) => warehouse.status === 'active').length;
    const maintenanceWarehouseCount = warehouses.filter((warehouse) => warehouse.status === 'maintenance').length;
    const inactiveWarehouseCount = warehouses.filter((warehouse) => warehouse.status === 'inactive').length;
    const canCreateWarehouse = canManageWarehouses && (limits.maxWarehouses === null || limits.activeWarehouses < limits.maxWarehouses);
    const planUsageCopy = limits.maxWarehouses === null
        ? `${limits.activeWarehouses} activas`
        : `${limits.activeWarehouses} / ${limits.maxWarehouses} activas`;
    let planDisplayName = subscription?.plan?.name || 'Free';

    if (limits.entitlementState === 'pilot_active') {
        planDisplayName = `Acceso Operativo (${limits.pilotDaysRemaining ?? 14} dias)`;
    } else if (limits.entitlementState === 'pilot_expired') {
        planDisplayName = 'Free - Acceso Operativo finalizado';
    }

    const handleCreateWarehouse = async () => {
        if (!canCreateWarehouse) return;

        if (!Number.isFinite(Number(createForm.latitude)) || !Number.isFinite(Number(createForm.longitude))) {
            toast.error('Coordenadas requeridas', 'Confirma el punto GPS de la bodega antes de crearla.');
            return;
        }

        setSubmitting(true);
        try {
            await warehouseClient.create({
                code: createForm.code,
                name: createForm.name,
                department: createForm.department,
                city: createForm.city,
                address: createForm.address,
                departmentId: createForm.departmentId,
                municipalityId: createForm.municipalityId,
                localZoneId: createForm.localZoneId,
                localZoneName: createForm.localZoneName,
                localZoneType: createForm.localZoneType,
                addressReference: createForm.addressReference,
                latitude: createForm.latitude,
                longitude: createForm.longitude,
                gpsToleranceMeters: Number(createForm.gpsToleranceMeters || 500),
                description: createForm.description,
                flowMode: createForm.flowMode,
            });
            setCreateForm(EMPTY_CREATE_FORM);
            setShowForm(false);
            toast.success('Bodega creada', 'La nueva bodega ya cuenta dentro del uso activo de tu plan.');
            await loadData();
        } catch (error) {
            if (isPlanLimitReachedError(error)) {
                setPlanLimitDetails(error.details);
                setPlanLimitOpen(true);
                toast.error('Limite de plan', error.message);
                return;
            }

            toast.error('Error', error instanceof Error ? error.message : 'No se pudo crear la bodega');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenEdit = (warehouse: WarehouseType) => {
        setEditingWarehouse(warehouse);
        setEditForm(toWarehouseFormState(warehouse));
    };

    const handleSaveEdit = async () => {
        if (!editingWarehouse) return;

        if (!Number.isFinite(Number(editForm.latitude)) || !Number.isFinite(Number(editForm.longitude))) {
            toast.error('Coordenadas requeridas', 'Confirma el punto GPS de la bodega antes de guardar.');
            return;
        }

        setEditing(true);
        try {
            await warehouseClient.update(editingWarehouse.id, {
                code: editForm.code,
                name: editForm.name,
                department: editForm.department,
                city: editForm.city,
                address: editForm.address,
                departmentId: editForm.departmentId,
                municipalityId: editForm.municipalityId,
                localZoneId: editForm.localZoneId,
                localZoneName: editForm.localZoneName,
                localZoneType: editForm.localZoneType,
                addressReference: editForm.addressReference,
                latitude: editForm.latitude,
                longitude: editForm.longitude,
                gpsToleranceMeters: Number(editForm.gpsToleranceMeters || 500),
                description: editForm.description,
                flowMode: editForm.flowMode,
                status: editForm.status,
            });
            toast.success('Bodega actualizada', 'Los cambios quedaron guardados.');
            setEditingWarehouse(null);
            await loadData();
        } catch (error) {
            toast.error('Error', error instanceof Error ? error.message : 'No se pudo actualizar la bodega');
        } finally {
            setEditing(false);
        }
    };

    const handleStatusChange = async (warehouse: WarehouseType, nextStatus: WarehouseType['status']) => {
        setChangingStatusId(warehouse.id);
        try {
            await warehouseClient.update(warehouse.id, { status: nextStatus });
            toast.success(
                nextStatus === 'active' ? 'Bodega reactivada' : 'Bodega archivada',
                nextStatus === 'active'
                    ? 'La bodega vuelve a contar dentro del uso activo del plan.'
                    : 'La bodega conserva su historial y deja de contar como uso activo.'
            );
            await loadData();
        } catch (error) {
            if (isPlanLimitReachedError(error)) {
                setPlanLimitDetails(error.details);
                setPlanLimitOpen(true);
                toast.error('Limite de plan', error.message);
                return;
            }

            toast.error('Error', error instanceof Error ? error.message : 'No se pudo actualizar el estado de la bodega');
        } finally {
            setChangingStatusId(null);
        }
    };

    if (user?.userType === 'trucker') {
        return (
            <DashboardLayout pageTitle="Bodegas">
                <EmptyState
                    icon={Warehouse}
                    title="Modulo para empresas y operadores"
                    description="Las bodegas de KargaX conectan viaje, evidencia e inventario del lado business/admin."
                />
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Bodegas KargaX">
            <div className="min-w-0 space-y-4 sm:space-y-6">
                <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_24px_70px_-52px_rgba(10,10,10,.55)] sm:p-6 md:p-8">
                    <div className="flex flex-col gap-6">
                        <div className="min-w-0 max-w-3xl">
                            <div className="mb-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 sm:text-xs sm:tracking-[0.2em]">
                                <span className="font-money text-zinc-950">KX</span>
                                <span className="break-words">Warehouse Command</span>
                            </div>
                            <h1 className="break-words text-2xl font-semibold leading-tight text-zinc-950 sm:text-3xl md:text-4xl">
                                Sala de control fisica para operar bodegas sin ruido.
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500">
                                Cada bodega vive como una unidad de mando: plan, ubicacion, flujo, permisos y siguiente accion claros desde el primer vistazo.
                            </p>
                        </div>
                        <div className="grid min-w-0 gap-3">
                            <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Plan</p>
                                <p className="mt-3 break-words text-base font-semibold text-zinc-950 sm:text-lg">{planDisplayName}</p>
                            </div>
                            <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Uso</p>
                                <p className="mt-3 break-words font-money text-base font-semibold text-zinc-950 sm:text-lg">{planUsageCopy}</p>
                            </div>
                            <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Pais</p>
                                <p className="mt-3 break-words text-base font-semibold text-zinc-950 sm:text-lg">{countryConfig.name}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid gap-4">
                    <Card className="min-w-0 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Activas</p>
                                <p className="mt-3 font-money text-2xl font-semibold text-zinc-950 sm:text-3xl">{activeWarehouseCount}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-200 p-3 text-zinc-950">
                                <Warehouse className="h-5 w-5" />
                            </div>
                        </div>
                    </Card>
                    <Card className="min-w-0 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Mantenimiento</p>
                                <p className="mt-3 font-money text-2xl font-semibold text-zinc-950 sm:text-3xl">{maintenanceWarehouseCount}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-200 p-3 text-zinc-950">
                                <Package className="h-5 w-5" />
                            </div>
                        </div>
                    </Card>
                    <Card className="min-w-0 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Archivadas</p>
                                <p className="mt-3 font-money text-2xl font-semibold text-zinc-950 sm:text-3xl">{inactiveWarehouseCount}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-200 p-3 text-zinc-950">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                        </div>
                    </Card>
                </div>

                {limits.entitlementState === 'pilot_active' ? (
                    <Card className="min-w-0 border-zinc-950 p-4 sm:p-5">
                        <div className="flex flex-col gap-3">
                            <div>
                                <p className="font-semibold text-zinc-950">Acceso Operativo activo</p>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Quedan {limits.pilotDaysRemaining ?? 0} dias con capacidad operativa temporal. Tus datos se conservan al vencer; solo se limita crear capacidad nueva fuera del plan.
                                </p>
                            </div>
                            <ShieldCheck className="h-5 w-5 text-zinc-950" />
                        </div>
                    </Card>
                ) : null}

                <div className="flex min-w-0 flex-col gap-4">
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-zinc-950">Red operativa</h2>
                        <p className="mt-1 text-sm text-zinc-500">
                            {activeWarehouseCount} activas, {maintenanceWarehouseCount} en mantenimiento y {inactiveWarehouseCount} archivadas.
                        </p>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-2">
                        {canCreateWarehouse ? (
                            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
                                Crear bodega
                            </Button>
                        ) : canManageWarehouses ? (
                            <Button asChild variant="outline">
                                <Link href="/planes">
                                    Actualizar plan <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        ) : (
                            <Badge variant="outline" size="lg" icon={<LockKeyhole className="h-3.5 w-3.5" />}>
                                Solo owner/admin
                            </Badge>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="grid gap-4">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="skeleton h-64 rounded-lg" />
                        ))}
                    </div>
                ) : warehouses.length === 0 ? (
                    <EmptyState
                        icon={Warehouse}
                        title="Aun no tienes bodegas"
                        description="Crea la primera sala de control para citas, muelles e inventario conectado."
                        action={
                            canCreateWarehouse ? (
                                <Button onClick={() => setShowForm(true)} leftIcon={<Plus className="h-4 w-4" />}>
                                    Crear primera bodega
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <div className="grid min-w-0 gap-4">
                        {warehouses.map((warehouse, index) => (
                            <motion.div
                                key={warehouse.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.04 }}
                            >
                                <Card variant="interactive" className="flex h-full min-w-0 flex-col p-4 sm:p-5">
                                    <div className="mb-5 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-words font-money text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.2em]">{warehouse.code}</p>
                                            <h3 className="mt-2 break-words text-lg font-semibold text-zinc-950">{warehouse.name}</h3>
                                        </div>
                                        <Badge variant={getStatusBadgeVariant(warehouse.status)} size="sm">
                                            {getStatusLabel(warehouse.status)}
                                        </Badge>
                                    </div>

                                    <div className="space-y-3 text-sm text-zinc-600">
                                        <p className="flex items-start gap-2">
                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                            <span className="min-w-0 break-words">{getCityDisplayName(countryCode, warehouse.city)}, {getSubdivisionDisplayName(countryCode, warehouse.department)}</span>
                                        </p>
                                        <p className="flex items-start gap-2">
                                            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                            <span className="min-w-0 break-words">{warehouse.address}</span>
                                        </p>
                                    </div>

                                    <div className="mt-5 grid gap-2">
                                        <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:tracking-[0.16em]">Modo</p>
                                            <p className="mt-2 break-words text-sm font-semibold text-zinc-950">{getFlowModeLabel(warehouse.flow_mode)}</p>
                                        </div>
                                        <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:tracking-[0.16em]">Estado</p>
                                            <p className="mt-2 break-words text-sm font-semibold text-zinc-950">{getStatusLabel(warehouse.status)}</p>
                                        </div>
                                    </div>

                                    <p className="mt-4 min-h-[48px] text-sm leading-6 text-zinc-500">
                                        {warehouse.status === 'inactive'
                                            ? 'Archivada: conserva historial y deja de contar como uso activo.'
                                            : warehouse.description || 'Sin descripcion operativa registrada.'}
                                    </p>

                                    <div className="mt-auto flex min-w-0 flex-wrap gap-2 pt-5">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/bodegas/${warehouse.id}`}>
                                                Ver comando <ChevronRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        {canManageWarehouses ? (
                                            <>
                                                <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => handleOpenEdit(warehouse)}>
                                                    Editar
                                                </Button>
                                                {warehouse.status === 'inactive' ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        leftIcon={<RotateCcw className="h-4 w-4" />}
                                                        isLoading={changingStatusId === warehouse.id}
                                                        onClick={() => handleStatusChange(warehouse, 'active')}
                                                    >
                                                        Reactivar
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        leftIcon={<Archive className="h-4 w-4" />}
                                                        isLoading={changingStatusId === warehouse.id}
                                                        onClick={() => handleStatusChange(warehouse, 'inactive')}
                                                    >
                                                        Archivar
                                                    </Button>
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                <Dialog open={showForm && canCreateWarehouse} onOpenChange={setShowForm}>
                    <DialogContent size="lg">
                        <DialogHeader>
                            <DialogTitle>Nueva bodega</DialogTitle>
                            <DialogDescription>
                                Define una unidad operativa clara: pais, ubicacion, modo y direccion antes de abrir ejecucion.
                            </DialogDescription>
                        </DialogHeader>
                        <WarehouseFormFields
                            form={createForm}
                            countryConfig={countryConfig}
                            subdivisionOptions={subdivisionOptions}
                            cityOptions={createCityOptions}
                            onChange={(patch) => setCreateForm((current) => ({ ...current, ...patch }))}
                        />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button isLoading={submitting} onClick={handleCreateWarehouse} leftIcon={<Plus className="h-4 w-4" />}>
                                Crear bodega
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={Boolean(editingWarehouse)} onOpenChange={(open) => {
                    if (!open) {
                        setEditingWarehouse(null);
                    }
                }}>
                    <DialogContent size="lg">
                        <DialogHeader>
                            <DialogTitle>Editar bodega</DialogTitle>
                            <DialogDescription>
                                Actualiza datos operativos, estado y modo de trabajo conservando la trazabilidad.
                            </DialogDescription>
                        </DialogHeader>
                        <WarehouseFormFields
                            form={editForm}
                            countryConfig={countryConfig}
                            subdivisionOptions={subdivisionOptions}
                            cityOptions={editCityOptions}
                            includeStatus
                            onChange={(patch) => setEditForm((current) => ({ ...current, ...patch }))}
                        />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingWarehouse(null)}>Cancelar</Button>
                            <Button isLoading={editing} onClick={handleSaveEdit}>Guardar cambios</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <PlanLimitPaywallDialog
                open={planLimitOpen}
                onOpenChange={setPlanLimitOpen}
                details={planLimitDetails}
            />
        </DashboardLayout>
    );
}
