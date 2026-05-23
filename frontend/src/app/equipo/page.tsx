'use client';

import * as React from 'react';
import { AlertTriangle, Building2, CheckCircle2, KeyRound, Loader2, MailPlus, Shield, UserPlus, Users, Warehouse } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PlanLimitPaywallDialog } from '@/components/billing/PlanLimitPaywallDialog';
import { AndeanPhoneInput, Button, Card, Input, Select, toast } from '@/components/ui';
import { EnterpriseHero, EnterpriseMetric, InlineNotice, SectionHeader, StatusPill } from '@/components/enterprise/EnterpriseLuxury';
import warehouseClient from '@/lib/warehouses/client';
import { isPlanLimitReachedError, type PlanLimitErrorDetails } from '@/lib/billing/plan-limits';
import type { BusinessTeamMember, BusinessTeamResponse } from '@/lib/warehouses/types';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { SupportedCountry } from '@/constants/countries';
import {
    BUSINESS_ROLE_CAPABILITIES,
    BUSINESS_ROLE_DESCRIPTIONS,
    BUSINESS_ROLE_LABELS,
    EDITABLE_BUSINESS_TEAM_ROLE_VALUES,
    toEditableBusinessTeamRole,
    type BusinessTeamRole,
    type EditableBusinessTeamRole,
} from '@/lib/business-roles';

type TeamRole = BusinessTeamRole;
type EditableTeamRole = EditableBusinessTeamRole;
type TeamLocale = 'es' | 'pt';

const ROLE_VALUES: EditableTeamRole[] = [...EDITABLE_BUSINESS_TEAM_ROLE_VALUES];
const COUNTRY_OPTIONS: Array<{ value: SupportedCountry; label: string }> = [
    { value: 'CO', label: 'Colombia' },
    { value: 'PE', label: 'Peru' },
    { value: 'EC', label: 'Ecuador' },
    { value: 'BR', label: 'Brasil' },
];
const DOCUMENT_TYPE_OPTIONS = [
    { value: '', label: 'Sin documento' },
    { value: 'CC', label: 'CC' },
    { value: 'CE', label: 'CE' },
    { value: 'NIT', label: 'NIT' },
    { value: 'DNI', label: 'DNI' },
    { value: 'CI', label: 'CI' },
    { value: 'CPF', label: 'CPF' },
    { value: 'PP', label: 'Pasaporte' },
];

type CreateTeamUserForm = {
    fullName: string;
    email: string;
    phone: string;
    countryCode: SupportedCountry;
    documentType: string;
    documentNumber: string;
    role: EditableTeamRole;
    password: string;
    warehouseIds: string[];
};

function getRoleFunctionList(role: EditableTeamRole) {
    const capabilities = BUSINESS_ROLE_CAPABILITIES[role];
    const functions: string[] = [];

    if (capabilities.canCreateMarketplaceOffers) functions.push('Publicar y gestionar ofertas');
    if (capabilities.canManagePrivateFleet) functions.push('Asignar flota privada');
    if (capabilities.canManageWarehouse || capabilities.canExecuteWarehouse) functions.push('Operar bodega/WMS');
    if (capabilities.canViewFinance) functions.push('Ver dinero y reportes');
    if (capabilities.canExportData) functions.push('Exportar evidencia y datos');
    if (capabilities.canViewIntelligence) functions.push('Ver inteligencia empresarial');

    return functions.length ? functions : ['Lectura limitada del workspace'];
}

const TEAM_COPY: Record<TeamLocale, {
    eyebrow: string;
    heroTitle: string;
    heroDescription: string;
    users: string;
    warehouses: string;
    inviteTitle: string;
    inviteDescription: string;
    emailLabel: string;
    roleLabel: string;
    inviteButton: string;
    inviteSuccessTitle: string;
    inviteSuccessDescription: string;
    emptyTitle: string;
    emptyDescription: string;
    currentRole: string;
    assignedWarehouses: string;
    assignedWarehousesDescription: string;
    saveWarehouses: string;
    assignmentsUpdated: string;
    pendingMember: string;
    suspendedInvitation: string;
    reactivate: string;
    suspend: string;
    resendInvite: string;
    cancelInvite: string;
    loadError: string;
    inviteError: string;
    updateRoleError: string;
    updateStatusError: string;
    updateWarehousesError: string;
    ownerOnlyTitle: string;
    ownerOnlyDescription: string;
    truckerOnlyTitle: string;
    truckerOnlyDescription: string;
    roleLabels: Record<TeamRole, string>;
    roleDescriptions: Record<TeamRole, string>;
    statusLabels: Record<BusinessTeamMember['status'], string>;
}> = {
    es: {
        eyebrow: 'Control de equipo',
        heroTitle: 'Crea un equipo por empresa, rol y bodega',
        heroDescription: 'El propietario crea usuarios, define permisos y reparte acceso granular a cada sede operativa.',
        users: 'Usuarios',
        warehouses: 'Bodegas',
        inviteTitle: 'Crear usuario interno',
        inviteDescription: 'Crea el acceso con rol, datos operativos, bodegas y contrasena inicial. No se envia magic link.',
        emailLabel: 'Correo del miembro',
        roleLabel: 'Rol empresarial',
        inviteButton: 'Crear usuario',
        inviteSuccessTitle: 'Usuario creado',
        inviteSuccessDescription: 'El miembro ya puede iniciar sesion con correo y contrasena.',
        emptyTitle: 'Tu equipo aun no tiene miembros internos',
        emptyDescription: 'Crea operaciones, inventario o auditoria y reparte acceso por bodega desde aqui.',
        currentRole: 'Rol actual',
        assignedWarehouses: 'Bodegas asignadas',
        assignedWarehousesDescription: 'Solo estas bodegas aparecen en el workspace del miembro.',
        saveWarehouses: 'Guardar bodegas',
        assignmentsUpdated: 'Asignaciones actualizadas',
        pendingMember: 'Este miembro aun no acepta la invitacion. Cuando active su cuenta podras asignarle bodegas.',
        suspendedInvitation: 'La invitacion esta pausada. Reenviala para retomar el acceso antes de asignar bodegas.',
        reactivate: 'Reactivar',
        suspend: 'Suspender',
        resendInvite: 'Invitacion legacy',
        cancelInvite: 'Cancelar invitacion',
        loadError: 'No se pudo cargar el equipo',
        inviteError: 'No se pudo crear el usuario',
        updateRoleError: 'No se pudo actualizar el rol',
        updateStatusError: 'No se pudo actualizar el estado',
        updateWarehousesError: 'No se pudo actualizar el acceso a bodegas',
        ownerOnlyTitle: 'Solo el propietario o admin maneja el equipo',
        ownerOnlyDescription: 'Tu cuenta puede operar la bodega, pero no crear usuarios internos ni reasignar permisos.',
        truckerOnlyTitle: 'Equipo interno solo para empresas',
        truckerOnlyDescription: 'Desde aqui la empresa arma el equipo de bodega y asigna accesos por sede.',
        roleLabels: BUSINESS_ROLE_LABELS.es,
        roleDescriptions: BUSINESS_ROLE_DESCRIPTIONS.es,
        statusLabels: {
            active: 'Activo',
            invited: 'Pendiente',
            suspended: 'Suspendido',
        },
    },
    pt: {
        eyebrow: 'Controle de equipe',
        heroTitle: 'Crie uma equipe por empresa, papel e armazem',
        heroDescription: 'O proprietario cria usuarios, define permissoes e distribui acesso granular por unidade operacional.',
        users: 'Usuarios',
        warehouses: 'Armazens',
        inviteTitle: 'Criar usuario interno',
        inviteDescription: 'Crie o acesso com papel, dados operacionais, armazens e senha inicial. Sem magic link.',
        emailLabel: 'Email do membro',
        roleLabel: 'Papel empresarial',
        inviteButton: 'Criar usuario',
        inviteSuccessTitle: 'Usuario criado',
        inviteSuccessDescription: 'O membro ja pode entrar com email e senha.',
        emptyTitle: 'Sua equipe ainda nao tem membros internos',
        emptyDescription: 'Crie operacao, inventario ou auditoria e distribua acesso por armazem aqui.',
        currentRole: 'Papel atual',
        assignedWarehouses: 'Armazens atribuidos',
        assignedWarehousesDescription: 'Somente estes armazens aparecem no workspace do membro.',
        saveWarehouses: 'Salvar armazens',
        assignmentsUpdated: 'Atribuicoes atualizadas',
        pendingMember: 'Este membro ainda nao aceitou o convite. Quando ativar a conta, voce podera atribuir armazens.',
        suspendedInvitation: 'O convite esta pausado. Reenvie-o para retomar o acesso antes de atribuir armazens.',
        reactivate: 'Reativar',
        suspend: 'Suspender',
        resendInvite: 'Convite legado',
        cancelInvite: 'Cancelar convite',
        loadError: 'Nao foi possivel carregar a equipe',
        inviteError: 'Nao foi possivel criar o usuario',
        updateRoleError: 'Nao foi possivel atualizar o papel',
        updateStatusError: 'Nao foi possivel atualizar o status',
        updateWarehousesError: 'Nao foi possivel atualizar o acesso aos armazens',
        ownerOnlyTitle: 'Somente o proprietario ou admin gerencia a equipe',
        ownerOnlyDescription: 'Sua conta pode operar o armazem, mas nao criar usuarios internos nem redistribuir permissoes.',
        truckerOnlyTitle: 'Equipe interna somente para empresas',
        truckerOnlyDescription: 'Aqui a empresa monta a equipe de armazem e atribui acessos por unidade.',
        roleLabels: BUSINESS_ROLE_LABELS.pt,
        roleDescriptions: BUSINESS_ROLE_DESCRIPTIONS.pt,
        statusLabels: {
            active: 'Ativo',
            invited: 'Pendente',
            suspended: 'Suspenso',
        },
    },
};

function getTeamCopy(country?: SupportedCountry | null) {
    return TEAM_COPY[country === 'BR' ? 'pt' : 'es'];
}

function StatusBadge({ status, label }: { status: BusinessTeamMember['status']; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-700">
            {status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : null}
            {status === 'invited' ? <MailPlus className="h-3 w-3" /> : null}
            {status === 'suspended' ? <AlertTriangle className="h-3 w-3" /> : null}
            {label}
        </span>
    );
}

function hasAcceptedAccount(member: BusinessTeamMember) {
    return Boolean(member.user_id);
}

export default function TeamPage() {
    const { user } = useAuthStore();
    const copy = React.useMemo(() => getTeamCopy(user?.country), [user?.country]);
    const [loading, setLoading] = React.useState(true);
    const [submittingCreateUser, setSubmittingCreateUser] = React.useState(false);
    const [memberActionId, setMemberActionId] = React.useState<string | null>(null);
    const [teamResponse, setTeamResponse] = React.useState<BusinessTeamResponse | null>(null);
    const [createForm, setCreateForm] = React.useState<CreateTeamUserForm>({
        fullName: '',
        email: '',
        phone: '',
        countryCode: user?.country || 'CO',
        documentType: '',
        documentNumber: '',
        role: 'warehouse_operator',
        password: '',
        warehouseIds: [],
    });
    const [warehouseAssignments, setWarehouseAssignments] = React.useState<Record<string, string[]>>({});
    const [teamSchemaReady, setTeamSchemaReady] = React.useState(true);
    const [teamSchemaMessage, setTeamSchemaMessage] = React.useState<string | null>(null);
    const [planLimitDetails, setPlanLimitDetails] = React.useState<PlanLimitErrorDetails | null>(null);
    const [planLimitOpen, setPlanLimitOpen] = React.useState(false);

    const roleOptions = React.useMemo(
        () => ROLE_VALUES.map((value) => ({ value, label: copy.roleLabels[value] })),
        [copy]
    );
    const selectedRoleFunctions = React.useMemo(() => getRoleFunctionList(createForm.role), [createForm.role]);

    const updateCreateForm = React.useCallback(<K extends keyof CreateTeamUserForm>(
        key: K,
        value: CreateTeamUserForm[K]
    ) => {
        setCreateForm((current) => ({
            ...current,
            [key]: value,
        }));
    }, []);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const response = await warehouseClient.getBusinessTeam();
            setTeamResponse(response);
            setTeamSchemaReady(response.teamSchemaReady ?? true);
            setTeamSchemaMessage(response.teamSchemaMessage ?? null);
            setWarehouseAssignments(
                Object.fromEntries(
                    (response.data || []).map((member) => [
                        member.id,
                        (member.warehouse_memberships || [])
                            .filter((membership) => membership.active)
                            .map((membership) => membership.warehouse_id),
                    ])
                )
            );
        } catch (error) {
            toast.error('Equipo', error instanceof Error ? error.message : copy.loadError);
        } finally {
            setLoading(false);
        }
    }, [copy.loadError]);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    const updateMemberStatus = React.useCallback(async (member: BusinessTeamMember, status: 'active' | 'suspended') => {
        setMemberActionId(member.id);
        try {
            await warehouseClient.updateBusinessTeamMember(member.id, { status });
            await loadData();
        } catch (error) {
            if (isPlanLimitReachedError(error)) {
                setPlanLimitDetails(error.details);
                setPlanLimitOpen(true);
                toast.error('Limite de plan', error.message);
                return;
            }

            toast.error('Equipo', error instanceof Error ? error.message : copy.updateStatusError);
        } finally {
            setMemberActionId(null);
        }
    }, [copy.updateStatusError, loadData]);

    const handleCreateUser = React.useCallback(async () => {
        setSubmittingCreateUser(true);
        try {
            await warehouseClient.createBusinessTeamUser({
                fullName: createForm.fullName,
                email: createForm.email,
                phone: createForm.phone,
                countryCode: createForm.countryCode,
                documentType: createForm.documentType || null,
                documentNumber: createForm.documentNumber || null,
                role: createForm.role,
                password: createForm.password,
                warehouseIds: createForm.warehouseIds,
            });
            setCreateForm({
                fullName: '',
                email: '',
                phone: '',
                countryCode: user?.country || 'CO',
                documentType: '',
                documentNumber: '',
                role: 'warehouse_operator',
                password: '',
                warehouseIds: [],
            });
            toast.success(copy.inviteSuccessTitle, copy.inviteSuccessDescription);
            await loadData();
        } catch (error) {
            if (isPlanLimitReachedError(error)) {
                setPlanLimitDetails(error.details);
                setPlanLimitOpen(true);
                toast.error('Limite de plan', error.message);
                return;
            }

            toast.error('Equipo', error instanceof Error ? error.message : copy.inviteError);
        } finally {
            setSubmittingCreateUser(false);
        }
    }, [copy.inviteError, copy.inviteSuccessDescription, copy.inviteSuccessTitle, createForm, loadData, user?.country]);

    if (user?.userType === 'trucker') {
        return (
            <DashboardLayout pageTitle="Equipo">
                <div className="rounded-lg border border-zinc-200 bg-white p-5 text-center shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] sm:p-8 md:p-10">
                    <Users className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
                    <h1 className="text-2xl font-bold text-slate-900">{copy.truckerOnlyTitle}</h1>
                    <p className="mt-2 text-slate-600">{copy.truckerOnlyDescription}</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Equipo empresarial">
            <div className="space-y-6">
                <EnterpriseHero
                    eyebrow={copy.eyebrow}
                    title={copy.heroTitle}
                    description={copy.heroDescription}
                    icon={Shield}
                    meta={[
                        {
                            label: copy.users,
                            value: (
                                <>
                                    {teamResponse?.limits?.activeInternalUsers ?? 0}
                                    {teamResponse?.limits?.maxInternalUsers != null ? (
                                        <span className="text-base font-normal text-white/45"> / {teamResponse.limits.maxInternalUsers}</span>
                                    ) : null}
                                </>
                            ),
                            detail: teamResponse?.subscription?.plan?.name || 'Plan actual',
                        },
                        {
                            label: copy.warehouses,
                            value: teamResponse?.limits?.activeWarehouses ?? 0,
                            detail: 'Permisos granulares',
                        },
                    ]}
                />

                {teamResponse?.limits?.entitlementState === 'pilot_active' ? (
                    <InlineNotice
                        title="Launch Pilot activo"
                        description={`Quedan ${teamResponse.limits.pilotDaysRemaining ?? 0} dias para validar equipo, roles y bodegas con limites piloto antes de pasar a Free o pagar Pro.`}
                    />
                ) : null}

                {loading ? (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    </div>
                ) : !teamSchemaReady ? (
                    <div className="space-y-6">
                        <Card className="border-zinc-300 bg-zinc-100 p-5">
                            <div className="flex items-start gap-4">
                                <div className="rounded-md border border-zinc-200 bg-white p-2.5 text-zinc-700">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="font-semibold text-slate-900">Equipo interno pendiente de activacion</h2>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {teamSchemaMessage || 'Falta la migracion SQL que crea miembros internos, seats y preferencias de bodega.'}
                                    </p>
                                    <div className="mt-4 grid kx-enterprise-grid gap-3">
                                        <div className="rounded-lg border border-zinc-200 bg-white p-4">
                                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Paso 1</p>
                                            <p className="mt-2 text-sm font-medium text-slate-900">Aplica la migracion 025 desde supabase/migrations</p>
                                        </div>
                                        <div className="rounded-lg border border-zinc-200 bg-white p-4">
                                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Paso 2</p>
                                            <p className="mt-2 text-sm font-medium text-slate-900">Recarga la app para habilitar invitaciones, roles y seats</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div className="grid kx-enterprise-grid gap-4">
                            <Card className="p-5">
                                <Users className="h-8 w-8 text-zinc-700 mb-3" />
                                <h3 className="font-semibold text-slate-900">Invitaciones</h3>
                                <p className="mt-1 text-sm text-slate-500">Invitaciones por correo a usuarios internos</p>
                            </Card>
                            <Card className="p-5">
                                <Shield className="h-8 w-8 text-zinc-700 mb-3" />
                                <h3 className="font-semibold text-slate-900">Roles empresariales</h3>
                                <p className="mt-1 text-sm text-slate-500">Operacion, despacho, bodega, contabilidad y auditoria separados</p>
                            </Card>
                            <Card className="p-5">
                                <Warehouse className="h-8 w-8 text-zinc-700 mb-3" />
                                <h3 className="font-semibold text-slate-900">Control por bodega</h3>
                                <p className="mt-1 text-sm text-slate-500">Asignacion granular y control de seats</p>
                            </Card>
                        </div>
                    </div>
                ) : !teamResponse?.canManageTeam ? (
                    <Card className="p-5 text-center sm:p-8 md:p-10">
                        <Building2 className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
                        <h2 className="text-2xl font-bold text-slate-900">{copy.ownerOnlyTitle}</h2>
                        <p className="mt-2 text-slate-600">{copy.ownerOnlyDescription}</p>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <div className="grid kx-enterprise-grid gap-4">
                            <EnterpriseMetric
                                label="Seats usados"
                                value={`${teamResponse?.limits?.activeInternalUsers ?? 0}${teamResponse?.limits?.maxInternalUsers != null ? ` / ${teamResponse.limits.maxInternalUsers}` : ''}`}
                                detail="Usuarios internos activos para la empresa."
                                icon={Users}
                            />
                            <EnterpriseMetric
                                label="Bodegas con control"
                                value={teamResponse?.warehouses?.length ?? 0}
                                detail="Sedes disponibles para asignacion granular."
                                icon={Warehouse}
                            />
                            <EnterpriseMetric
                                label="Plan operativo"
                                value={teamResponse?.subscription?.plan?.name || 'Free'}
                                detail="Roles business intactos y limite aplicado por API."
                                icon={Shield}
                            />
                        </div>

                        <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                            <div className="mb-5">
                                <SectionHeader
                                    icon={UserPlus}
                                    title={copy.inviteTitle}
                                    description={copy.inviteDescription}
                                />
                            </div>

                            <div className="space-y-4">
                                <Input
                                    label="Nombre completo"
                                    value={createForm.fullName}
                                    onChange={(event) => updateCreateForm('fullName', event.target.value)}
                                    placeholder="Maria Operaciones"
                                />
                                <div className="grid kx-enterprise-grid gap-4">
                                    <Input
                                        label={copy.emailLabel}
                                        value={createForm.email}
                                        onChange={(event) => updateCreateForm('email', event.target.value)}
                                        placeholder="operacion@empresa.com"
                                        type="email"
                                    />
                                    <AndeanPhoneInput
                                        label="Telefono"
                                        value={createForm.phone}
                                        onChange={(value) => updateCreateForm('phone', value)}
                                        onCountryChange={(value) => updateCreateForm('countryCode', value)}
                                        defaultCountryCode={createForm.countryCode}
                                        helperText="Prefijos disponibles: CO +57, PE +51, EC +593, BR +55."
                                    />
                                </div>
                                <div className="grid kx-enterprise-grid gap-4">
                                    <Select
                                        label="Pais"
                                        value={createForm.countryCode}
                                        onChange={(value) => updateCreateForm('countryCode', value as SupportedCountry)}
                                        options={COUNTRY_OPTIONS}
                                    />
                                    <Select
                                        label="Tipo de documento"
                                        value={createForm.documentType}
                                        onChange={(value) => updateCreateForm('documentType', value)}
                                        options={DOCUMENT_TYPE_OPTIONS}
                                    />
                                    <Input
                                        label="Numero de documento"
                                        value={createForm.documentNumber}
                                        onChange={(event) => updateCreateForm('documentNumber', event.target.value)}
                                        placeholder="Opcional"
                                    />
                                </div>
                                <Input
                                    label="Contrasena inicial"
                                    type="password"
                                    value={createForm.password}
                                    onChange={(event) => updateCreateForm('password', event.target.value)}
                                    placeholder="Minimo 10 caracteres"
                                    leftIcon={<KeyRound className="h-5 w-5" />}
                                    showPasswordToggle
                                    helperText="El usuario entra con este correo y contrasena. No depende de magic link."
                                />
                                <Select
                                    label={copy.roleLabel}
                                    value={createForm.role}
                                    onChange={(value) => updateCreateForm('role', value as EditableTeamRole)}
                                    options={roleOptions}
                                />
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                    <p className="text-sm font-semibold text-slate-900">{copy.roleLabels[createForm.role]}</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{copy.roleDescriptions[createForm.role]}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedRoleFunctions.map((item) => (
                                            <span key={item} className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {teamResponse?.warehouses?.length ? (
                                    <div className="rounded-lg border border-zinc-200 bg-white p-4">
                                        <div className="mb-3 flex items-center gap-2">
                                            <Warehouse className="h-4 w-4 text-zinc-700" />
                                            <p className="text-sm font-semibold text-slate-900">Bodegas iniciales</p>
                                        </div>
                                        <div className="grid kx-enterprise-grid gap-3">
                                            {(teamResponse.warehouses || []).map((warehouse) => {
                                                const checked = createForm.warehouseIds.includes(warehouse.id);
                                                return (
                                                    <label key={warehouse.id} className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                                        <input
                                                            type="checkbox"
                                                            className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-950"
                                                            checked={checked}
                                                            onChange={(event) => {
                                                                const nextWarehouses = event.target.checked
                                                                    ? [...createForm.warehouseIds, warehouse.id]
                                                                    : createForm.warehouseIds.filter((warehouseId) => warehouseId !== warehouse.id);
                                                                updateCreateForm('warehouseIds', Array.from(new Set(nextWarehouses)));
                                                            }}
                                                        />
                                                        <span className="min-w-0 text-sm">
                                                            <span className="block font-semibold text-zinc-950">{warehouse.name}</span>
                                                            <span className="block text-xs text-zinc-500">{warehouse.code} - {warehouse.city}, {warehouse.department}</span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                                <Button
                                    fullWidth
                                    leftIcon={<UserPlus className="h-4 w-4" />}
                                    isLoading={submittingCreateUser}
                                    onClick={handleCreateUser}
                                >
                                    {copy.inviteButton}
                                </Button>
                            </div>
                        </Card>

                        <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                            <div className="mb-5">
                                <SectionHeader
                                    icon={Shield}
                                    title="Validacion de funciones por rol"
                                    description="La navegacion y las APIs filtran acciones por rol empresarial: bodega, dinero, operaciones, flota y reportes quedan separados."
                                />
                            </div>
                            <div className="grid kx-enterprise-grid gap-3">
                                {ROLE_VALUES.map((role) => (
                                    <div key={role} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <p className="text-sm font-semibold text-zinc-950">{copy.roleLabels[role]}</p>
                                        <p className="mt-1 text-xs leading-5 text-zinc-500">{copy.roleDescriptions[role]}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {getRoleFunctionList(role).map((item) => (
                                                <span key={item} className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <div className="space-y-4">
                            {!teamResponse?.data?.length ? (
                                <Card className="p-5 text-center sm:p-8">
                                    <Users className="mx-auto h-10 w-10 text-zinc-700" />
                                    <h3 className="mt-4 text-xl font-semibold text-slate-900">{copy.emptyTitle}</h3>
                                    <p className="mt-2 text-sm text-slate-500">{copy.emptyDescription}</p>
                                </Card>
                            ) : null}

                            {(teamResponse?.data || []).map((member) => {
                                const memberWarehouses = warehouseAssignments[member.id] || [];
                                const isOwner = member.role === 'owner';
                                const acceptedAccount = hasAcceptedAccount(member);
                                const showCancelInvite = !acceptedAccount && member.status === 'invited';
                                const showSuspend = acceptedAccount && member.status === 'active';
                                const showReactivate = acceptedAccount && member.status === 'suspended';
                                const roleLabel = copy.roleLabels[member.role as TeamRole] || member.role;

                                return (
                                    <Card key={member.id} className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                        <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="kx-enterprise-copy">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <h3 className="text-xl font-semibold text-slate-900">
                                                        {member.user?.full_name || member.invited_email}
                                                    </h3>
                                                    <StatusBadge status={member.status} label={copy.statusLabels[member.status]} />
                                                </div>
                                                <p className="mt-2 text-sm text-slate-500">{member.invited_email}</p>
                                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                                    {copy.currentRole}: {roleLabel}
                                                </p>
                                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                                    {copy.roleDescriptions[member.role as TeamRole] || copy.roleDescriptions.viewer}
                                                </p>
                                            </div>

                                            {!isOwner ? (
                                                <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:w-auto">
                                                    <Select
                                                        label={copy.roleLabel}
                                                        value={toEditableBusinessTeamRole(member.role)}
                                                        onChange={async (value) => {
                                                            setMemberActionId(member.id);
                                                            try {
                                                                await warehouseClient.updateBusinessTeamMember(member.id, {
                                                                    role: value as EditableTeamRole,
                                                                });
                                                                await loadData();
                                                            } catch (error) {
                                                                toast.error('Equipo', error instanceof Error ? error.message : copy.updateRoleError);
                                                            } finally {
                                                                setMemberActionId(null);
                                                            }
                                                        }}
                                                        options={roleOptions}
                                                        disabled={memberActionId === member.id}
                                                    />
                                                    <div className="flex flex-col gap-2">
                                                        {showCancelInvite ? (
                                                            <Button
                                                                variant="outline"
                                                                isLoading={memberActionId === member.id}
                                                                onClick={async () => {
                                                                    await updateMemberStatus(member, 'suspended');
                                                                }}
                                                            >
                                                                {copy.cancelInvite}
                                                            </Button>
                                                        ) : null}
                                                        {showSuspend ? (
                                                            <Button
                                                                variant="outline"
                                                                isLoading={memberActionId === member.id}
                                                                onClick={async () => {
                                                                    await updateMemberStatus(member, 'suspended');
                                                                }}
                                                            >
                                                                {copy.suspend}
                                                            </Button>
                                                        ) : null}
                                                        {showReactivate ? (
                                                            <Button
                                                                variant="primary"
                                                                isLoading={memberActionId === member.id}
                                                                onClick={async () => {
                                                                    await updateMemberStatus(member, 'active');
                                                                }}
                                                            >
                                                                {copy.reactivate}
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
                                            <div className="mb-4 flex items-center gap-3">
                                                <Warehouse className="h-5 w-5 text-zinc-700" />
                                                <div>
                                                    <p className="font-semibold text-slate-900">{copy.assignedWarehouses}</p>
                                                    <p className="text-sm text-slate-500">{copy.assignedWarehousesDescription}</p>
                                                </div>
                                            </div>

                                            {member.user_id ? (
                                                <>
                                                    <div className="grid kx-enterprise-grid gap-3">
                                                        {(teamResponse?.warehouses || []).map((warehouse) => {
                                                            const checked = memberWarehouses.includes(warehouse.id);
                                                            return (
                                                                <label key={warehouse.id} className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-950"
                                                                        checked={checked}
                                                                        onChange={(event) => {
                                                                            setWarehouseAssignments((current) => {
                                                                                const currentSelection = new Set(current[member.id] || []);
                                                                                if (event.target.checked) {
                                                                                    currentSelection.add(warehouse.id);
                                                                                } else {
                                                                                    currentSelection.delete(warehouse.id);
                                                                                }

                                                                                return {
                                                                                    ...current,
                                                                                    [member.id]: Array.from(currentSelection),
                                                                                };
                                                                            });
                                                                        }}
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <p className="font-semibold text-slate-900">{warehouse.name}</p>
                                                                            {checked ? <StatusPill>Asignada</StatusPill> : null}
                                                                        </div>
                                                                        <p className="text-sm text-slate-500">{warehouse.code} - {warehouse.city}, {warehouse.department}</p>
                                                                    </div>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>

                                                    <Button
                                                        className="mt-4"
                                                        variant="secondary"
                                                        isLoading={memberActionId === `${member.id}-warehouses`}
                                                        onClick={async () => {
                                                            setMemberActionId(`${member.id}-warehouses`);
                                                            try {
                                                                await warehouseClient.assignBusinessTeamWarehouses(member.id, memberWarehouses);
                                                                toast.success('Equipo', copy.assignmentsUpdated);
                                                                await loadData();
                                                            } catch (error) {
                                                                toast.error('Equipo', error instanceof Error ? error.message : copy.updateWarehousesError);
                                                            } finally {
                                                                setMemberActionId(null);
                                                            }
                                                        }}
                                                    >
                                                        {copy.saveWarehouses}
                                                    </Button>
                                                </>
                                            ) : (
                                                <p className="text-sm text-slate-500">
                                                    {member.status === 'suspended' ? copy.suspendedInvitation : copy.pendingMember}
                                                </p>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
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
