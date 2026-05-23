'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    KeyRound,
    Loader2,
    Shield,
    Truck,
    UserPlus,
    Wallet,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PlanLimitPaywallDialog } from '@/components/billing/PlanLimitPaywallDialog';
import { AndeanPhoneInput, Button, Card, Input, Select, toast } from '@/components/ui';
import { EnterpriseHero, EnterpriseMetric, InlineNotice, SectionHeader, StatusPill } from '@/components/enterprise/EnterpriseLuxury';
import warehouseClient from '@/lib/warehouses/client';
import { isPlanLimitReachedError, type PlanLimitErrorDetails } from '@/lib/billing/plan-limits';
import type { BusinessFleetMember, BusinessFleetResponse } from '@/lib/warehouses/types';
import type { PrivateFleetPayrollResponse } from '@/lib/warehouses/types';
import { useAuthStore } from '@/features/auth/store/authStore';
import { formatCOP, VEHICLE_TYPES } from '@/constants/colombia';
import type { SupportedCountry } from '@/constants/countries';

const MEMBER_STATUS_OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'suspended', label: 'Suspendido' },
    { value: 'removed', label: 'Retirado' },
] as const;

const COMPENSATION_MODE_OPTIONS = [
    { value: 'salary_no_trip_pay', label: 'Contrato mensual' },
    { value: 'trip_pay', label: 'Pago por ruta' },
    { value: 'expenses_only', label: 'Solo gastos' },
    { value: 'trip_pay_plus_expenses', label: 'Ruta + gastos' },
] as const;

const COUNTRY_OPTIONS: Array<{ value: SupportedCountry; label: string }> = [
    { value: 'CO', label: 'Colombia' },
    { value: 'PE', label: 'Peru' },
    { value: 'EC', label: 'Ecuador' },
    { value: 'BR', label: 'Brasil' },
];

const DOCUMENT_TYPE_OPTIONS = [
    { value: 'CC', label: 'CC' },
    { value: 'CE', label: 'CE' },
    { value: 'NIT', label: 'NIT' },
    { value: 'DNI', label: 'DNI' },
    { value: 'CI', label: 'CI' },
    { value: 'CPF', label: 'CPF' },
    { value: 'PP', label: 'Pasaporte' },
];

const LICENSE_TYPE_OPTIONS = ['C1', 'C2', 'C3', 'B1', 'B2', 'B3'].map((value) => ({ value, label: value }));
const VEHICLE_TYPE_OPTIONS = VEHICLE_TYPES.map((vehicle) => ({ value: vehicle.code, label: vehicle.name }));

type CreateFleetDriverForm = {
    fullName: string;
    email: string;
    phone: string;
    countryCode: SupportedCountry;
    documentType: string;
    documentNumber: string;
    password: string;
    licenseNumber: string;
    licenseType: string;
    yearsExperience: string;
    vehiclePlate: string;
    internalDriverId: string;
    vehicleType: string;
    notes: string;
};

function getCompensationModeLabel(value?: string | null) {
    return COMPENSATION_MODE_OPTIONS.find((option) => option.value === value)?.label || 'Contrato mensual';
}

function StatusBadge({ status }: { status: BusinessFleetMember['status'] }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-700">
            {status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : null}
            {status === 'suspended' ? <AlertTriangle className="h-3 w-3" /> : null}
            {status}
        </span>
    );
}

function formatDateTime(value?: string | null) {
    return value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin actividad';
}

function driverName(member: BusinessFleetMember) {
    return member.user?.full_name || member.user?.email || 'Conductor privado';
}

export default function FleetDashboardPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const [loading, setLoading] = React.useState(true);
    const [creatingDriver, setCreatingDriver] = React.useState(false);
    const [memberActionId, setMemberActionId] = React.useState<string | null>(null);
    const [fleetResponse, setFleetResponse] = React.useState<BusinessFleetResponse | null>(null);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [paywallMessage, setPaywallMessage] = React.useState<string | null>(null);
    const [planLimitDetails, setPlanLimitDetails] = React.useState<PlanLimitErrorDetails | null>(null);
    const [planLimitOpen, setPlanLimitOpen] = React.useState(false);
    const [payrollResponse, setPayrollResponse] = React.useState<PrivateFleetPayrollResponse | null>(null);
    const [payrollAction, setPayrollAction] = React.useState<string | null>(null);
    const [createDriverForm, setCreateDriverForm] = React.useState<CreateFleetDriverForm>({
        fullName: '',
        email: '',
        phone: '',
        countryCode: user?.country || 'CO',
        documentType: 'CC',
        documentNumber: '',
        password: '',
        licenseNumber: '',
        licenseType: 'C2',
        yearsExperience: '',
        vehiclePlate: '',
        internalDriverId: '',
        vehicleType: VEHICLE_TYPES[0]?.code || '',
        notes: '',
    });
    const [driverInviteCode, setDriverInviteCode] = React.useState('');
    const [driverInternalId, setDriverInternalId] = React.useState('');
    const [driverVehiclePlate, setDriverVehiclePlate] = React.useState('');
    const [driverOfferId, setDriverOfferId] = React.useState('');
    const [driverAction, setDriverAction] = React.useState<'accept' | 'confirm' | null>(null);
    const [drafts, setDrafts] = React.useState<Record<string, {
        status: BusinessFleetMember['status'];
        internalDriverId: string;
        vehiclePlate: string;
        notes: string;
        defaultCompensationMode: NonNullable<BusinessFleetMember['default_compensation_mode']>;
        monthlySalaryAmount: string;
        payrollDay: string;
        payrollNotes: string;
    }>>({});

    const loadFleet = React.useCallback(async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const [response, payroll] = await Promise.all([
                warehouseClient.getBusinessFleet(),
                warehouseClient.getPrivateFleetPayroll().catch(() => null),
            ]);
            setFleetResponse(response);
            setPayrollResponse(payroll);
            setPaywallMessage(null);
            setDrafts(
                Object.fromEntries(
                    (response.data || []).map((member) => [
                        member.id,
                        {
                            status: member.status,
                            internalDriverId: member.internal_driver_id || '',
                            vehiclePlate: member.vehicle_plate || '',
                            notes: member.notes || '',
                            defaultCompensationMode: member.default_compensation_mode || 'salary_no_trip_pay',
                            monthlySalaryAmount: member.monthly_salary_amount ? String(Math.round(Number(member.monthly_salary_amount))) : '',
                            payrollDay: member.payroll_day ? String(member.payroll_day) : '30',
                            payrollNotes: member.payroll_notes || '',
                        },
                    ])
                )
            );
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la flota privada');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (user?.userType === 'trucker') {
            return;
        }

        void loadFleet();
    }, [loadFleet, user?.userType]);

    React.useEffect(() => {
        if (user?.userType === 'trucker') {
            router.replace('/viajes-asignados');
        }
    }, [router, user?.userType]);

    const activeMembers = React.useMemo(
        () => (fleetResponse?.data || []).filter((member) => member.status === 'active'),
        [fleetResponse?.data]
    );
    const payrollSchemaReady = fleetResponse?.payrollSchemaReady !== false;
    const canUsePayrollControls = Boolean(fleetResponse?.canManagePayroll && payrollSchemaReady);

    const updateCreateDriverForm = React.useCallback(<K extends keyof CreateFleetDriverForm>(
        key: K,
        value: CreateFleetDriverForm[K]
    ) => {
        setCreateDriverForm((current) => ({
            ...current,
            [key]: value,
        }));
    }, []);

    const handleCreateDriver = React.useCallback(async () => {
        setCreatingDriver(true);
        setPaywallMessage(null);
        try {
            await warehouseClient.createBusinessFleetDriver({
                fullName: createDriverForm.fullName,
                email: createDriverForm.email,
                phone: createDriverForm.phone,
                countryCode: createDriverForm.countryCode,
                documentType: createDriverForm.documentType,
                documentNumber: createDriverForm.documentNumber,
                password: createDriverForm.password,
                licenseNumber: createDriverForm.licenseNumber,
                licenseType: createDriverForm.licenseType,
                yearsExperience: createDriverForm.yearsExperience ? Number(createDriverForm.yearsExperience) : 0,
                vehiclePlate: createDriverForm.vehiclePlate,
                internalDriverId: createDriverForm.internalDriverId || null,
                vehicleType: createDriverForm.vehicleType || null,
                notes: createDriverForm.notes || null,
            });
            setCreateDriverForm({
                fullName: '',
                email: '',
                phone: '',
                countryCode: user?.country || 'CO',
                documentType: 'CC',
                documentNumber: '',
                password: '',
                licenseNumber: '',
                licenseType: 'C2',
                yearsExperience: '',
                vehiclePlate: '',
                internalDriverId: '',
                vehicleType: VEHICLE_TYPES[0]?.code || '',
                notes: '',
            });
            toast.success('Conductor creado', 'Ya puede iniciar sesion con correo y contrasena.');
            await loadFleet();
        } catch (error) {
            if (isPlanLimitReachedError(error)) {
                setPlanLimitDetails(error.details);
                setPlanLimitOpen(true);
                toast.error('Limite de plan', error.message);
                return;
            }

            const message = error instanceof Error ? error.message : 'No se pudo crear el conductor';
            setPaywallMessage(message);
            toast.error('Flota privada', message);
        } finally {
            setCreatingDriver(false);
        }
    }, [createDriverForm, loadFleet, user?.country]);

    if (user?.userType === 'trucker') {
        return (
            <DashboardLayout pageTitle="Viajes asignados">
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    <div>
                        <p className="font-semibold text-zinc-950">Redirigiendo a Viajes asignados</p>
                        <p className="mt-1 text-sm text-zinc-500">La flota del conductor privado se gestiona desde sus rutas asignadas.</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Flota privada">
            <div className="space-y-6">
                <EnterpriseHero
                    eyebrow="Private Fleet OS"
                    title="Flota privada como activo empresarial"
                    description="Invita conductores, gobierna estados, observa compensacion operativa y conserva viajes directos dentro de una capa seria de control."
                    icon={Shield}
                    meta={[
                        { label: 'Conductores activos', value: fleetResponse?.stats.activeDrivers ?? 0, detail: 'Alta y estado controlados' },
                        { label: 'Viajes activos', value: fleetResponse?.stats.activeTrips ?? 0, detail: 'Asignacion privada' },
                    ]}
                />

                {loading ? (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    </div>
                ) : loadError ? (
                    <InlineNotice
                        tone="warning"
                        title="Flota privada pendiente de activacion"
                        description={loadError}
                    />
                ) : (
                    <>
                        <div className="grid kx-enterprise-grid gap-4">
                            <EnterpriseMetric
                                label="Compensacion operativa"
                                value={formatCOP(fleetResponse?.stats.expenseAdvancedThisMonthCop || 0)}
                                detail="Registrada este mes para viajes privados."
                                icon={Wallet}
                            />
                            <EnterpriseMetric
                                label="Viajes privados completados"
                                value={fleetResponse?.stats.privateTripsCompleted || 0}
                                detail="Cerrados con evidencia operativa."
                                icon={Truck}
                            />
                            <EnterpriseMetric
                                label="Flete cerrado"
                                value={formatCOP(fleetResponse?.stats.freightSettledThisMonthCop || 0)}
                                detail="Reconocido por el ciclo financiero."
                                icon={Shield}
                            />
                            <EnterpriseMetric
                                label="Nomina liberada"
                                value={formatCOP(fleetResponse?.stats.payrollReleasedThisMonthCop || payrollResponse?.summary.releasedThisMonthCop || 0)}
                                detail={`${payrollResponse?.summary.configuredDrivers || 0} conductores configurados`}
                                icon={Wallet}
                            />
                            <EnterpriseMetric
                                label="Capacidad del plan"
                                value={`${fleetResponse?.limits.activePrivateFleetDrivers ?? 0} / ${fleetResponse?.limits.maxPrivateFleetDrivers ?? 'Sin limite'}`}
                                detail={fleetResponse?.subscription?.plan?.name || 'Plan actual'}
                                icon={UserPlus}
                            />
                        </div>

                        {fleetResponse?.limits?.entitlementState === 'pilot_active' ? (
                            <InlineNotice
                                title="Launch Pilot activo"
                                description={`Quedan ${fleetResponse.limits.pilotDaysRemaining ?? 0} dias para validar hasta ${fleetResponse.limits.maxPrivateFleetDrivers ?? 50} conductores privados antes de pasar a Free o activar Pro.`}
                            />
                        ) : null}

                        <div className="space-y-5">
                            <Card className="kx-enterprise-card overflow-hidden p-0 shadow-[0_28px_80px_-52px_rgba(10,10,10,.62)]">
                                <div className="border-b border-zinc-100 p-4 min-[380px]:p-5 sm:p-6">
                                    <SectionHeader
                                        icon={Truck}
                                        title="Conductores privados"
                                        description="Activos privados en tarjetas simples: estado, placa, compensacion, viajes y ultima actividad."
                                    />
                                </div>

                                <div className="grid gap-3 p-4 min-[380px]:p-5 sm:p-6">
                                    {!fleetResponse?.data?.length ? (
                                        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                                            <p className="font-semibold text-zinc-950">Aun no tienes conductores privados</p>
                                            <p className="mt-2 text-sm leading-6 text-zinc-500">
                                                Crea el primer conductor en el bloque de alta directa. Luego aparece aqui como activo empresarial.
                                            </p>
                                        </div>
                                    ) : null}
                                    {(fleetResponse?.data || []).map((member) => (
                                        <div key={member.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_16px_44px_-38px_rgba(10,10,10,.55)] md:p-5">
                                            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,.8fr)_minmax(18rem,.8fr)] xl:items-stretch">
                                                <div className="flex min-w-0 flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-lg font-semibold text-zinc-950">{driverName(member)}</p>
                                                            <p className="mt-1 font-money text-xs text-zinc-500">{member.internal_driver_id || 'Sin ID interno'}</p>
                                                        </div>
                                                        <StatusBadge status={member.status} />
                                                    </div>
                                                    <p className="mt-5 font-money text-xs text-zinc-500">
                                                        Ultima actividad: {formatDateTime(member.updated_at)}
                                                    </p>
                                                </div>

                                                <div className="grid gap-3 min-[520px]:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                                    <div className="rounded-lg border border-zinc-200 bg-white p-4">
                                                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Placa</p>
                                                        <p className="font-money mt-2 text-lg font-semibold text-zinc-950">{member.vehicle_plate || 'Pendiente'}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-zinc-200 bg-white p-4">
                                                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Viajes</p>
                                                        <p className="font-money mt-2 text-lg font-semibold text-zinc-950">{member.activeTrips || 0} activos</p>
                                                        <p className="mt-1 text-xs text-zinc-500">{member.privateTripsCompleted || 0} completados</p>
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4 text-white">
                                                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Compensacion</p>
                                                    <p className="mt-2 text-lg font-semibold">{getCompensationModeLabel(member.default_compensation_mode)}</p>
                                                    <div className="mt-4 grid gap-3 text-xs text-white/70 min-[520px]:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                                        <p>Salario {formatCOP(Number(member.monthly_salary_amount || 0))}</p>
                                                        <p>Gastos {formatCOP(member.totalExpenseAdvancedCop || 0)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {activeMembers.length > 0 ? (
                                    <div className="grid gap-4 border-t border-zinc-100 bg-zinc-50 p-4 min-[380px]:p-5 sm:p-6">
                                        {activeMembers.map((member) => {
                                            const draft = drafts[member.id] || {
                                                status: member.status,
                                                internalDriverId: member.internal_driver_id || '',
                                                vehiclePlate: member.vehicle_plate || '',
                                                notes: member.notes || '',
                                                defaultCompensationMode: member.default_compensation_mode || 'salary_no_trip_pay',
                                                monthlySalaryAmount: member.monthly_salary_amount ? String(Math.round(Number(member.monthly_salary_amount))) : '',
                                                payrollDay: member.payroll_day ? String(member.payroll_day) : '30',
                                                payrollNotes: member.payroll_notes || '',
                                            };

                                            return (
                                                <div key={`editor-${member.id}`} className="kx-enterprise-card rounded-lg border border-zinc-200 bg-white p-4">
                                                    <div className="flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                                                        <div className="kx-enterprise-copy">
                                                            <p className="font-semibold text-zinc-950">{driverName(member)}</p>
                                                            <p className="mt-1 font-money text-xs text-zinc-500">
                                                                Compensacion: {formatCOP(member.totalExpenseAdvancedCop || 0)}
                                                            </p>
                                                        </div>
                                                        <StatusBadge status={draft.status} />
                                                    </div>

                                                    <div className="mt-4 grid gap-3">
                                                        <Select
                                                            label="Estado"
                                                            value={draft.status}
                                                            onChange={(value) => {
                                                                setDrafts((current) => ({
                                                                    ...current,
                                                                    [member.id]: { ...draft, status: value as BusinessFleetMember['status'] },
                                                                }));
                                                            }}
                                                            options={MEMBER_STATUS_OPTIONS.map((option) => ({
                                                                value: option.value,
                                                                label: option.label,
                                                            }))}
                                                        />
                                                        <Input
                                                            label="ID interno"
                                                            value={draft.internalDriverId}
                                                            onChange={(event) => {
                                                                const value = event.target.value;
                                                                setDrafts((current) => ({
                                                                    ...current,
                                                                    [member.id]: { ...draft, internalDriverId: value },
                                                                }));
                                                            }}
                                                        />
                                                        <Input
                                                            label="Placa"
                                                            value={draft.vehiclePlate}
                                                            onChange={(event) => {
                                                                const value = event.target.value.toUpperCase();
                                                                setDrafts((current) => ({
                                                                    ...current,
                                                                    [member.id]: { ...draft, vehiclePlate: value },
                                                                }));
                                                            }}
                                                            className="font-money uppercase"
                                                        />
                                                        <Input
                                                            label="Notas"
                                                            value={draft.notes}
                                                            onChange={(event) => {
                                                                const value = event.target.value;
                                                                setDrafts((current) => ({
                                                                    ...current,
                                                                    [member.id]: { ...draft, notes: value },
                                                                }));
                                                            }}
                                                        />
                                                        <Select
                                                            label="Compensacion default"
                                                            value={draft.defaultCompensationMode}
                                                            onChange={(value) => {
                                                                setDrafts((current) => ({
                                                                    ...current,
                                                                    [member.id]: {
                                                                        ...draft,
                                                                        defaultCompensationMode: value as NonNullable<BusinessFleetMember['default_compensation_mode']>,
                                                                    },
                                                                }));
                                                            }}
                                                            options={COMPENSATION_MODE_OPTIONS.map((option) => ({
                                                                value: option.value,
                                                                label: option.label,
                                                            }))}
                                                            disabled={!canUsePayrollControls}
                                                        />
                                                        <div className="grid gap-3 min-[420px]:grid-cols-[1fr_.45fr]">
                                                            <Input
                                                                label="Salario mensual COP"
                                                                inputMode="numeric"
                                                                value={draft.monthlySalaryAmount}
                                                                onChange={(event) => {
                                                                    const value = event.target.value.replace(/\D/g, '');
                                                                    setDrafts((current) => ({
                                                                        ...current,
                                                                        [member.id]: { ...draft, monthlySalaryAmount: value },
                                                                    }));
                                                                }}
                                                                disabled={!canUsePayrollControls}
                                                            />
                                                            <Input
                                                                label="Dia pago"
                                                                inputMode="numeric"
                                                                value={draft.payrollDay}
                                                                onChange={(event) => {
                                                                    const value = event.target.value.replace(/\D/g, '').slice(0, 2);
                                                                    setDrafts((current) => ({
                                                                        ...current,
                                                                        [member.id]: { ...draft, payrollDay: value },
                                                                    }));
                                                                }}
                                                                disabled={!canUsePayrollControls}
                                                            />
                                                        </div>
                                                        <Input
                                                            label="Notas de nomina"
                                                            value={draft.payrollNotes}
                                                            onChange={(event) => {
                                                                const value = event.target.value;
                                                                setDrafts((current) => ({
                                                                    ...current,
                                                                    [member.id]: { ...draft, payrollNotes: value },
                                                                }));
                                                            }}
                                                            disabled={!canUsePayrollControls}
                                                        />
                                                        <Button
                                                            variant="secondary"
                                                            isLoading={memberActionId === member.id}
                                                            disabled={!fleetResponse?.canManageFleet && !canUsePayrollControls}
                                                            onClick={async () => {
                                                                setMemberActionId(member.id);
                                                                try {
                                                                    const payload: Parameters<typeof warehouseClient.updateBusinessFleetMember>[1] = {};

                                                                    if (fleetResponse?.canManageFleet) {
                                                                        payload.status = draft.status;
                                                                        payload.internalDriverId = draft.internalDriverId || null;
                                                                        payload.vehiclePlate = draft.vehiclePlate || null;
                                                                        payload.notes = draft.notes || null;
                                                                    }

                                                                    if (canUsePayrollControls) {
                                                                        payload.defaultCompensationMode = draft.defaultCompensationMode;
                                                                        payload.monthlySalaryAmount = draft.monthlySalaryAmount ? Number(draft.monthlySalaryAmount) : 0;
                                                                        payload.monthlySalaryCurrency = 'COP';
                                                                        payload.payrollDay = draft.payrollDay ? Number(draft.payrollDay) : 30;
                                                                        payload.payrollNotes = draft.payrollNotes || null;
                                                                    }

                                                                    await warehouseClient.updateBusinessFleetMember(member.id, payload);
                                                                    toast.success('Flota actualizada', 'Los cambios del conductor quedaron guardados.');
                                                                    await loadFleet();
                                                                } catch (error) {
                                                                    if (isPlanLimitReachedError(error)) {
                                                                        setPlanLimitDetails(error.details);
                                                                        setPlanLimitOpen(true);
                                                                        toast.error('Limite de plan', error.message);
                                                                        return;
                                                                    }

                                                                    toast.error('Flota privada', error instanceof Error ? error.message : 'No se pudo guardar');
                                                                } finally {
                                                                    setMemberActionId(null);
                                                                }
                                                            }}
                                                        >
                                                            Guardar cambios
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </Card>

                            <>
                                <Card className="kx-enterprise-card overflow-hidden p-4 shadow-[0_28px_80px_-52px_rgba(10,10,10,.62)] min-[380px]:p-5 sm:p-6">
                                    <SectionHeader
                                        icon={UserPlus}
                                        title="Crear conductor privado"
                                        description="Alta directa con usuario, contrasena inicial, licencia, documento y placa. No depende de invitacion ni magic link."
                                    />

                                    <div className="mt-5 grid gap-4 xl:grid-cols-3">
                                        <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Identidad</p>
                                            <Input
                                                label="Nombre completo"
                                                value={createDriverForm.fullName}
                                                onChange={(event) => updateCreateDriverForm('fullName', event.target.value)}
                                                placeholder="Carlos Transportes"
                                            />
                                            <Input
                                                label="Correo"
                                                type="email"
                                                value={createDriverForm.email}
                                                onChange={(event) => updateCreateDriverForm('email', event.target.value)}
                                                placeholder="conductor@empresa.com"
                                            />
                                            <AndeanPhoneInput
                                                label="Telefono"
                                                value={createDriverForm.phone}
                                                onChange={(value) => updateCreateDriverForm('phone', value)}
                                                onCountryChange={(value) => updateCreateDriverForm('countryCode', value)}
                                                defaultCountryCode={createDriverForm.countryCode}
                                                helperText="Prefijos disponibles: CO +57, PE +51, EC +593, BR +55."
                                            />
                                            <Input
                                                label="Contrasena inicial"
                                                type="password"
                                                value={createDriverForm.password}
                                                onChange={(event) => updateCreateDriverForm('password', event.target.value)}
                                                placeholder="Minimo 10 caracteres"
                                                leftIcon={<KeyRound className="h-5 w-5" />}
                                                showPasswordToggle
                                                helperText="El conductor entra con correo y contrasena. No se envia enlace por email."
                                            />
                                        </div>

                                        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Documento y licencia</p>
                                            <div className="grid gap-3 min-[520px]:grid-cols-2">
                                                <Select
                                                    label="Pais"
                                                    value={createDriverForm.countryCode}
                                                    onChange={(value) => updateCreateDriverForm('countryCode', value as SupportedCountry)}
                                                    options={COUNTRY_OPTIONS}
                                                />
                                                <Select
                                                    label="Documento"
                                                    value={createDriverForm.documentType}
                                                    onChange={(value) => updateCreateDriverForm('documentType', value)}
                                                    options={DOCUMENT_TYPE_OPTIONS}
                                                />
                                            </div>
                                            <Input
                                                label="Numero de documento"
                                                value={createDriverForm.documentNumber}
                                                onChange={(event) => updateCreateDriverForm('documentNumber', event.target.value)}
                                                placeholder="Documento del conductor"
                                            />
                                            <div className="grid gap-3 min-[520px]:grid-cols-2">
                                                <Input
                                                    label="Licencia"
                                                    value={createDriverForm.licenseNumber}
                                                    onChange={(event) => updateCreateDriverForm('licenseNumber', event.target.value)}
                                                    placeholder="Numero de licencia"
                                                />
                                                <Select
                                                    label="Categoria"
                                                    value={createDriverForm.licenseType}
                                                    onChange={(value) => updateCreateDriverForm('licenseType', value)}
                                                    options={LICENSE_TYPE_OPTIONS}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Vehiculo y operacion</p>
                                            <div className="grid gap-3 min-[520px]:grid-cols-2">
                                                <Input
                                                    label="Placa"
                                                    value={createDriverForm.vehiclePlate}
                                                    onChange={(event) => updateCreateDriverForm('vehiclePlate', event.target.value.toUpperCase())}
                                                    placeholder="ABC123"
                                                    className="font-money uppercase"
                                                />
                                                <Input
                                                    label="ID interno"
                                                    value={createDriverForm.internalDriverId}
                                                    onChange={(event) => updateCreateDriverForm('internalDriverId', event.target.value)}
                                                    placeholder="DR-024"
                                                />
                                            </div>
                                            <div className="grid gap-3 min-[520px]:grid-cols-2">
                                                <Select
                                                    label="Tipo de vehiculo"
                                                    value={createDriverForm.vehicleType}
                                                    onChange={(value) => updateCreateDriverForm('vehicleType', value)}
                                                    options={VEHICLE_TYPE_OPTIONS}
                                                />
                                                <Input
                                                    label="Anios de experiencia"
                                                    inputMode="numeric"
                                                    value={createDriverForm.yearsExperience}
                                                    onChange={(event) => updateCreateDriverForm('yearsExperience', event.target.value.replace(/\D/g, '').slice(0, 2))}
                                                    placeholder="5"
                                                />
                                            </div>
                                            <Input
                                                label="Notas"
                                                value={createDriverForm.notes}
                                                onChange={(event) => updateCreateDriverForm('notes', event.target.value)}
                                                placeholder="Contrato, turno, base operativa"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-5 flex justify-end">
                                        <Button
                                            fullWidth
                                            className="sm:w-auto"
                                            leftIcon={<UserPlus className="h-4 w-4" />}
                                            isLoading={creatingDriver}
                                            disabled={!fleetResponse?.canManageFleet}
                                            onClick={handleCreateDriver}
                                        >
                                            Crear conductor
                                        </Button>
                                    </div>
                                </Card>

                                {paywallMessage ? (
                                    <InlineNotice
                                        tone="warning"
                                        title="Limite de plan alcanzado"
                                        description={paywallMessage}
                                        action={(
                                            <Button
                                                rightIcon={<ArrowUpRight className="h-4 w-4" />}
                                                onClick={() => {
                                                    window.location.href = '/planes';
                                                }}
                                            >
                                                Ver planes
                                            </Button>
                                        )}
                                    />
                                ) : null}

                                <Card className="kx-enterprise-card overflow-hidden p-4 shadow-[0_28px_80px_-52px_rgba(10,10,10,.62)] min-[380px]:p-5 sm:p-6">
                                    <SectionHeader
                                        icon={Wallet}
                                        title="Nomina flota privada"
                                        description="Corrida mensual separada de las rutas. Se aprueba, fondea y libera a la billetera del conductor."
                                    />
                                    {payrollResponse ? (
                                        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
                                            <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
                                                <div className="grid kx-enterprise-grid-dense gap-3">
                                                    <EnterpriseMetric
                                                        label="Configurados"
                                                        value={payrollResponse.summary.configuredDrivers}
                                                        detail="Con salario mensual"
                                                    />
                                                    <EnterpriseMetric
                                                        label="Liberado"
                                                        value={formatCOP(payrollResponse.summary.releasedThisMonthCop)}
                                                        detail="Nomina a billeteras"
                                                    />
                                                </div>
                                                <Button
                                                    fullWidth
                                                    disabled={!payrollResponse.canManagePayroll || !payrollSchemaReady}
                                                    isLoading={payrollAction === 'create'}
                                                    leftIcon={<Wallet className="h-4 w-4" />}
                                                    onClick={async () => {
                                                        setPayrollAction('create');
                                                        try {
                                                            await warehouseClient.createPrivateFleetPayroll();
                                                            toast.success('Nomina creada', 'La corrida quedo en borrador para aprobacion.');
                                                            await loadFleet();
                                                        } catch (error) {
                                                            toast.error('Nomina privada', error instanceof Error ? error.message : 'No se pudo crear nomina');
                                                        } finally {
                                                            setPayrollAction(null);
                                                        }
                                                    }}
                                                >
                                                    Crear nomina mensual
                                                </Button>
                                            </div>

                                            <div className="grid gap-3">
                                                {payrollResponse.runs.length ? payrollResponse.runs.slice(0, 3).map((run) => (
                                                    <div key={run.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_16px_44px_-38px_rgba(10,10,10,.55)]">
                                                        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                                                            <div className="min-w-0">
                                                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                    <div className="min-w-0">
                                                                        <p className="font-money text-sm font-semibold text-zinc-950">
                                                                            {run.period_start} - {run.period_end}
                                                                        </p>
                                                                        <p className="mt-1 text-xs text-zinc-500">
                                                                            {formatCOP(Number(run.gross_amount || 0))} nomina + {formatCOP(Number(run.processing_fee_amount || 0))} fee
                                                                        </p>
                                                                    </div>
                                                                    <StatusPill>{run.status}</StatusPill>
                                                                </div>
                                                            </div>
                                                            <div className="grid gap-2 min-[420px]:grid-cols-2 lg:min-w-[14rem]">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={!payrollResponse.canManagePayroll || !payrollSchemaReady || !['draft', 'failed'].includes(run.status)}
                                                                    isLoading={payrollAction === `approve-${run.id}`}
                                                                    onClick={async () => {
                                                                        setPayrollAction(`approve-${run.id}`);
                                                                        try {
                                                                            await warehouseClient.approvePrivateFleetPayroll(run.id);
                                                                            toast.success('Nomina aprobada', 'Ya puedes fondearla.');
                                                                            await loadFleet();
                                                                        } catch (error) {
                                                                            toast.error('Nomina privada', error instanceof Error ? error.message : 'No se pudo aprobar');
                                                                        } finally {
                                                                            setPayrollAction(null);
                                                                        }
                                                                    }}
                                                                >
                                                                    Aprobar
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    disabled={!payrollResponse.canManagePayroll || !payrollSchemaReady || !['approved', 'checkout_pending'].includes(run.status)}
                                                                    isLoading={payrollAction === `checkout-${run.id}`}
                                                                    onClick={async () => {
                                                                        setPayrollAction(`checkout-${run.id}`);
                                                                        try {
                                                                            const checkout = await warehouseClient.checkoutPrivateFleetPayroll(run.id);
                                                                            const checkoutUrl = checkout.preference.init_point || checkout.preference.sandbox_init_point;
                                                                            if (checkoutUrl) {
                                                                                window.location.href = checkoutUrl;
                                                                                return;
                                                                            }
                                                                            toast.success('Checkout creado', 'No se recibio URL de pago; revisa Mercado Pago.');
                                                                            await loadFleet();
                                                                        } catch (error) {
                                                                            toast.error('Nomina privada', error instanceof Error ? error.message : 'No se pudo crear checkout');
                                                                        } finally {
                                                                            setPayrollAction(null);
                                                                        }
                                                                    }}
                                                                >
                                                                    Fondear
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                                                        <p className="font-semibold text-zinc-950">Aun no hay corridas de nomina</p>
                                                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                                                            Crea la nomina mensual cuando tengas conductores con salario configurado.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="mt-4 text-sm leading-6 text-zinc-500">
                                            {payrollSchemaReady
                                                ? 'La nomina privada aparece para owner, admin o contabilidad con MFA.'
                                                : 'Aplica la migracion 048_private_fleet_payroll.sql para activar nomina mensual.'}
                                        </p>
                                    )}
                                </Card>
                            </>
                        </div>
                    </>
                )}
            </div>
            <PlanLimitPaywallDialog
                open={planLimitOpen}
                onOpenChange={setPlanLimitOpen}
                details={planLimitDetails}
            />
        </DashboardLayout>
    );
}
