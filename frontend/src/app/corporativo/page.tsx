'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    ArrowRight,
    BadgeDollarSign,
    Building2,
    CheckCircle2,
    CircleAlert,
    Loader2,
    Package,
    ShieldCheck,
    Sparkles,
    Truck,
    Wallet,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Badge, Button, Card, Input, Select, Switch, toast } from '@/components/ui';
import { EnterpriseHero, EnterpriseMetric, InlineNotice } from '@/components/enterprise/EnterpriseLuxury';
import { useAuthStore } from '@/features/auth/store/authStore';
import warehouseClient from '@/lib/warehouses/client';
import type {
    HoldingApprovalRequest,
    HoldingBusinessSummary,
    HoldingMember,
    HoldingSummaryResponse,
} from '@/lib/warehouses/types';

type RelationshipType = 'parent' | 'subsidiary' | 'brand' | 'operator';
type ApprovalDecision = 'approved' | 'rejected' | 'cancelled';
type ApprovalPriority = HoldingApprovalRequest['priority'];
type ApprovalRequestType = HoldingApprovalRequest['request_type'];
type OpsAdvanceAction = 'approve' | 'reject' | 'mark_restructured' | 'write_off';

const dateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const copFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});
const relationshipOptions = [
    { value: 'subsidiary', label: 'Subsidiaria' },
    { value: 'parent', label: 'Matriz' },
    { value: 'brand', label: 'Marca' },
    { value: 'operator', label: 'Operador' },
];

const holdingRoleOptions = [
    { value: 'holding_owner', label: 'Holding Owner' },
    { value: 'finance_admin', label: 'Finance Admin' },
    { value: 'ops_admin', label: 'Ops Admin' },
    { value: 'analyst', label: 'Analyst' },
];

const approvalPriorityOptions = [
    { value: 'low', label: 'Baja' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' },
    { value: 'critical', label: 'Critica' },
];

const approvalRequestTypeOptions = [
    { value: 'custom', label: 'Solicitud personalizada' },
    { value: 'credit_policy', label: 'Politica financiera' },
    { value: 'wallet_release', label: 'Liberacion de wallet' },
    { value: 'plan_upgrade', label: 'Cambio comercial' },
    { value: 'ops_exception', label: 'Excepcion operativa' },
];

const planOptions = [
    {
        value: 'free',
        label: 'Free',
        description: '1 bodega, 3 usuarios, 3 conductores privados y 25 viajes al mes',
        priceCop: 0,
    },
    {
        value: 'growth',
        label: 'Pro',
        description: '5 bodegas, 20 usuarios, 20 conductores privados y 500 viajes al mes',
        priceCop: 149000,
    },
    {
        value: 'scale',
        label: 'Scale',
        description: '25 bodegas, 100 usuarios, flota privada ilimitada y 5.000 viajes al mes',
        priceCop: 399000,
    },
    {
        value: 'enterprise',
        label: 'Enterprise',
        description: 'Holding multiempresa y capacidad sin limite',
        priceCop: 1200000,
    },
];

const opsActionOptions = [
    { value: 'approve', label: 'Aprobar adelanto' },
    { value: 'reject', label: 'Rechazar adelanto' },
    { value: 'mark_restructured', label: 'Marcar reestructurado' },
    { value: 'write_off', label: 'Castigar cartera' },
];

function formatDate(value: string | null) {
    return value ? dateFormatter.format(new Date(value)) : 'Sin fecha';
}

function formatCop(value: number | null | undefined) {
    return copFormatter.format(Number(value || 0));
}

function getRiskVariant(value: HoldingBusinessSummary['risk_level']) {
    if (value === 'low') {
        return 'success';
    }

    if (value === 'medium') {
        return 'warning';
    }

    if (value === 'high') {
        return 'secondary';
    }

    return 'error';
}

function getFinanceVariant(value: HoldingBusinessSummary['finance_readiness']) {
    if (value === 'strong') {
        return 'success';
    }

    if (value === 'watch') {
        return 'warning';
    }

    return 'error';
}

function getStatusVariant(value: HoldingApprovalRequest['status'] | HoldingMember['status']) {
    if (value === 'approved' || value === 'active') {
        return 'success';
    }

    if (value === 'pending' || value === 'invited') {
        return 'warning';
    }

    return 'error';
}

function getReadinessVariant(isReady: boolean) {
    return isReady ? 'success' : 'warning';
}

function getApprovalAgingVariant(value: HoldingApprovalRequest['aging_bucket']) {
    if (value === 'within_sla' || value === 'resolved') {
        return 'success';
    }

    if (value === 'due_soon') {
        return 'warning';
    }

    if (value === 'breached') {
        return 'secondary';
    }

    return 'error';
}

function getAssignedTeamLabel(value: HoldingApprovalRequest['assigned_team']) {
    if (value === 'finance_admin') {
        return 'Finance queue';
    }

    if (value === 'ops_admin') {
        return 'Ops queue';
    }

    return 'Owner queue';
}

function getPlanMeta(planCode: string) {
    return planOptions.find((plan) => plan.value === planCode) || planOptions[0];
}

function getApprovalContextLabel(approval: HoldingApprovalRequest) {
    if (approval.request_type === 'plan_upgrade') {
        const planCode = typeof approval.payload.planCode === 'string' ? approval.payload.planCode : '';
        const plan = getPlanMeta(planCode);
        return `Plan objetivo: ${plan.label} (${formatCop(plan.priceCop)}/mes)`;
    }

    if (approval.request_type === 'wallet_release') {
        const amount = Number(approval.payload.amount || 0);
        return `Liberacion solicitada: ${formatCop(amount)}`;
    }

    if (approval.request_type === 'ops_exception') {
        const action = typeof approval.payload.advanceAction === 'string'
            ? approval.payload.advanceAction
            : 'custom';
        const advanceId = typeof approval.payload.advanceId === 'string'
            ? approval.payload.advanceId
            : 'sin-adelanto';
        return `Operacion: ${action} | Adelanto: ${advanceId.slice(0, 8)}`;
    }

    if (approval.request_type === 'credit_policy') {
        const limit = Number(approval.payload.maxSingleAdvanceCop || 0);
        const businessCap = Number(approval.payload.maxBusinessExposureCop || 0);
        return `Tope por adelanto: ${formatCop(limit)} | Tope por empresa: ${formatCop(businessCap)}`;
    }

    return `${approval.request_type} | ${formatDate(approval.created_at)}`;
}

function Metric({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
    return (
        <EnterpriseMetric label={title} value={value} detail={hint} />
    );
}

export default function CorporatePage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState<string | null>(null);
    const [summary, setSummary] = React.useState<HoldingSummaryResponse | null>(null);
    const [businesses, setBusinesses] = React.useState<Awaited<ReturnType<typeof warehouseClient.getHoldingBusinesses>> | null>(null);
    const [members, setMembers] = React.useState<Awaited<ReturnType<typeof warehouseClient.getHoldingMembers>> | null>(null);
    const [approvals, setApprovals] = React.useState<Awaited<ReturnType<typeof warehouseClient.getHoldingApprovals>> | null>(null);
    const [financePolicy, setFinancePolicy] = React.useState<Awaited<ReturnType<typeof warehouseClient.getHoldingFinancePolicy>> | null>(null);
    const [holdingId, setHoldingId] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [role, setRole] = React.useState<HoldingMember['role']>('analyst');
    const [businessId, setBusinessId] = React.useState('');
    const [relationship, setRelationship] = React.useState<RelationshipType>('subsidiary');
    const [requestTitle, setRequestTitle] = React.useState('');
    const [requestDescription, setRequestDescription] = React.useState('');
    const [requestType, setRequestType] = React.useState<ApprovalRequestType>('custom');
    const [requestPriority, setRequestPriority] = React.useState<ApprovalPriority>('medium');
    const [requestBusinessId, setRequestBusinessId] = React.useState('');
    const [requestPlanCode, setRequestPlanCode] = React.useState('scale');
    const [requestAmount, setRequestAmount] = React.useState('1500000');
    const [requestAdvanceId, setRequestAdvanceId] = React.useState('');
    const [requestAdvanceAction, setRequestAdvanceAction] = React.useState<OpsAdvanceAction>('approve');
    const [requestNote, setRequestNote] = React.useState('');
    const [decisionNotes, setDecisionNotes] = React.useState<Record<string, string>>({});
    const [memberRoleDrafts, setMemberRoleDrafts] = React.useState<Record<string, HoldingMember['role']>>({});
    const [maxSingleAdvanceCop, setMaxSingleAdvanceCop] = React.useState('800000');
    const [maxBusinessExposureCop, setMaxBusinessExposureCop] = React.useState('15000000');
    const [maxPortfolioExposureCop, setMaxPortfolioExposureCop] = React.useState('50000000');
    const [walletReleaseLimitCop, setWalletReleaseLimitCop] = React.useState('5000000');
    const [autoApprovePlanUpgradesUntilUsd, setAutoApprovePlanUpgradesUntilUsd] = React.useState('1200000');
    const [allowHighRiskOperations, setAllowHighRiskOperations] = React.useState(false);
    const [allowCriticalRiskOperations, setAllowCriticalRiskOperations] = React.useState(false);

    const activeHoldingId = holdingId || summary?.account?.id || undefined;
    const linkedBusinesses = React.useMemo(() => summary?.businesses || [], [summary]);
    const holdingCapabilities = summary?.capabilities || approvals?.capabilities || businesses?.capabilities || members?.capabilities || financePolicy?.capabilities || null;
    const canDecideApproval = React.useCallback((approval: HoldingApprovalRequest) => {
        if (!holdingCapabilities) {
            return false;
        }

        if (holdingCapabilities.overrideEscalations) {
            return true;
        }

        if (approval.assigned_team === 'finance_admin') {
            return holdingCapabilities.approveFinanceQueue;
        }

        if (approval.assigned_team === 'ops_admin') {
            return holdingCapabilities.approveOpsQueue;
        }

        return holdingCapabilities.overrideEscalations;
    }, [holdingCapabilities]);

    const linkedBusinessOptions = React.useMemo(
        () => linkedBusinesses.map((item) => ({
            value: item.business_id,
            label: item.company_name,
            description: `${item.plan_name} | Riesgo ${item.risk_level} | ${item.city || 'Sin ciudad'}`,
        })),
        [linkedBusinesses]
    );

    const selectedRequestBusiness = React.useMemo(
        () => linkedBusinesses.find((item) => item.business_id === requestBusinessId) || null,
        [linkedBusinesses, requestBusinessId]
    );

    const selectedRequestPlan = React.useMemo(
        () => planOptions.find((plan) => plan.value === requestPlanCode) || planOptions[2],
        [requestPlanCode]
    );

    const load = React.useCallback(async (requestedHoldingId?: string) => {
        setLoading(true);

        try {
            const [nextSummary, nextBusinesses, nextMembers, nextApprovals, nextFinancePolicy] = await Promise.all([
                warehouseClient.getHoldingSummary(requestedHoldingId),
                warehouseClient.getHoldingBusinesses(requestedHoldingId),
                warehouseClient.getHoldingMembers(requestedHoldingId),
                warehouseClient.getHoldingApprovals(requestedHoldingId),
                warehouseClient.getHoldingFinancePolicy(requestedHoldingId),
            ]);

            setSummary(nextSummary);
            setBusinesses(nextBusinesses);
            setMembers(nextMembers);
            setApprovals(nextApprovals);
            setFinancePolicy(nextFinancePolicy);
            setHoldingId((current) => current || nextSummary.account?.id || nextSummary.accounts[0]?.id || '');
            setMemberRoleDrafts(
                Object.fromEntries((nextMembers.data || []).map((member) => [member.id, member.role]))
            );

            if (nextFinancePolicy.data) {
                setMaxSingleAdvanceCop(String(nextFinancePolicy.data.max_single_advance_cop || 0));
                setMaxBusinessExposureCop(String(nextFinancePolicy.data.max_business_exposure_cop || 0));
                setMaxPortfolioExposureCop(String(nextFinancePolicy.data.max_portfolio_exposure_cop || 0));
                setWalletReleaseLimitCop(String(nextFinancePolicy.data.wallet_release_limit_cop || 0));
                setAutoApprovePlanUpgradesUntilUsd(String(nextFinancePolicy.data.auto_approve_plan_upgrades_until_usd || 0));
                setAllowHighRiskOperations(Boolean(nextFinancePolicy.data.allow_high_risk_operations));
                setAllowCriticalRiskOperations(Boolean(nextFinancePolicy.data.allow_critical_risk_operations));
            }
        } catch (error) {
            toast.error('Corporativo', error instanceof Error ? error.message : 'No se pudo cargar la vista corporativa');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load(holdingId || undefined);
    }, [holdingId, load]);

    const runAction = React.useCallback(async (key: string, job: () => Promise<void>) => {
        setBusy(key);

        try {
            await job();
        } catch (error) {
            toast.error('Corporativo', error instanceof Error ? error.message : 'No se pudo completar la accion');
        } finally {
            setBusy(null);
        }
    }, []);

    const resetRequestComposer = React.useCallback(() => {
        setRequestTitle('');
        setRequestDescription('');
        setRequestPriority('medium');
        setRequestBusinessId('');
        setRequestPlanCode('scale');
        setRequestAmount('1500000');
        setRequestAdvanceId('');
        setRequestAdvanceAction('approve');
        setRequestNote('');
        setRequestType('custom');
    }, []);

    const handleLinkBusiness = React.useCallback(async () => {
        if (!businessId) {
            toast.warning('Corporativo', 'Selecciona una empresa');
            return;
        }

        const response = await warehouseClient.linkHoldingBusiness({
            holdingId: activeHoldingId,
            businessId,
            relationshipType: relationship,
        });

        toast.success(
            'Corporativo',
            response.mode === 'linked' ? 'Empresa vinculada con exito' : 'Solicitud enviada a aprobacion'
        );
        setBusinessId('');
        await load(activeHoldingId);
    }, [activeHoldingId, businessId, load, relationship]);

    const handleInviteMember = React.useCallback(async () => {
        if (!email.trim()) {
            toast.warning('Corporativo', 'Escribe un correo');
            return;
        }

        const response = await warehouseClient.inviteHoldingMember({
            holdingId: activeHoldingId,
            email: email.trim(),
            role,
        });

        toast.success(
            'Corporativo',
            response.mode === 'linked_existing_user' ? 'Miembro agregado al holding' : 'Invitacion enviada'
        );
        setEmail('');
        await load(activeHoldingId);
    }, [activeHoldingId, email, load, role]);

    const handleFinancePolicySave = React.useCallback(async () => {
        await warehouseClient.updateHoldingFinancePolicy({
            holdingId: activeHoldingId,
            maxSingleAdvanceCop: Number(maxSingleAdvanceCop || 0),
            maxBusinessExposureCop: Number(maxBusinessExposureCop || 0),
            maxPortfolioExposureCop: Number(maxPortfolioExposureCop || 0),
            walletReleaseLimitCop: Number(walletReleaseLimitCop || 0),
            autoApprovePlanUpgradesUntilUsd: Number(autoApprovePlanUpgradesUntilUsd || 0),
            allowHighRiskOperations,
            allowCriticalRiskOperations,
        });

        toast.success('Corporativo', 'Politica financiera actualizada');
        await load(activeHoldingId);
    }, [
        activeHoldingId,
        allowCriticalRiskOperations,
        allowHighRiskOperations,
        autoApprovePlanUpgradesUntilUsd,
        load,
        maxBusinessExposureCop,
        maxPortfolioExposureCop,
        maxSingleAdvanceCop,
        walletReleaseLimitCop,
    ]);

    const handleMemberRoleSave = React.useCallback(async (member: HoldingMember) => {
        const nextRole = memberRoleDrafts[member.id] || member.role;

        if (nextRole === member.role) {
            toast.warning('Corporativo', 'El rol no cambio');
            return;
        }

        await warehouseClient.updateHoldingMember(member.id, {
            holdingId: activeHoldingId,
            role: nextRole,
        });

        toast.success('Corporativo', 'Rol corporativo actualizado');
        await load(activeHoldingId);
    }, [activeHoldingId, load, memberRoleDrafts]);

    const handleMemberStatusToggle = React.useCallback(async (member: HoldingMember) => {
        if (member.user_id && member.user_id === user?.id && member.status === 'active') {
            toast.warning('Corporativo', 'No puedes suspender tu propio acceso');
            return;
        }

        const nextStatus = member.status === 'active' ? 'suspended' : 'active';

        await warehouseClient.updateHoldingMember(member.id, {
            holdingId: activeHoldingId,
            status: nextStatus,
        });

        toast.success(
            'Corporativo',
            nextStatus === 'active' ? 'Miembro reactivado' : 'Miembro suspendido'
        );
        await load(activeHoldingId);
    }, [activeHoldingId, load, user?.id]);

    const handleApprovalDecision = React.useCallback(async (approval: HoldingApprovalRequest, status: ApprovalDecision) => {
        const decisionNote = decisionNotes[approval.id]?.trim() || undefined;

        await warehouseClient.updateHoldingApproval(approval.id, {
            holdingId: activeHoldingId,
            status,
            decisionNote,
        });

        setDecisionNotes((current) => ({
            ...current,
            [approval.id]: '',
        }));

        toast.success(
            'Corporativo',
            status === 'approved'
                ? 'Solicitud aprobada'
                : status === 'rejected'
                    ? 'Solicitud rechazada'
                    : 'Solicitud cancelada'
        );
        await load(activeHoldingId);
    }, [activeHoldingId, decisionNotes, load]);

    const handleCreateApproval = React.useCallback(async () => {
        let title = requestTitle.trim();
        const description = requestDescription.trim() || undefined;
        const businessName = selectedRequestBusiness?.company_name || 'la empresa seleccionada';
        const businessIdForRequest = requestBusinessId || undefined;
        let payload: Record<string, unknown> = {};

        if (requestType === 'custom' && !title) {
            toast.warning('Corporativo', 'Escribe un titulo para la solicitud');
            return;
        }

        if (requestType === 'credit_policy') {
            title = title || 'Actualizar politica financiera corporativa';
            payload = {
                maxSingleAdvanceCop: Number(maxSingleAdvanceCop || 0),
                maxBusinessExposureCop: Number(maxBusinessExposureCop || 0),
                maxPortfolioExposureCop: Number(maxPortfolioExposureCop || 0),
                walletReleaseLimitCop: Number(walletReleaseLimitCop || 0),
                autoApprovePlanUpgradesUntilUsd: Number(autoApprovePlanUpgradesUntilUsd || 0),
                allowHighRiskOperations,
                allowCriticalRiskOperations,
            };
        }

        if (requestType === 'plan_upgrade') {
            if (!requestBusinessId) {
                toast.warning('Corporativo', 'Selecciona una empresa para el cambio comercial');
                return;
            }

            title = title || `Activar ${selectedRequestPlan.label} para ${businessName}`;
            payload = {
                businessId: requestBusinessId,
                planCode: selectedRequestPlan.value,
                targetPlanName: selectedRequestPlan.label,
                monthlyPriceCop: selectedRequestPlan.priceCop,
                monthlyPriceUsd: Math.round(selectedRequestPlan.priceCop / 4000),
                note: requestNote.trim() || null,
            };
        }

        if (requestType === 'wallet_release') {
            const amount = Number(requestAmount || 0);

            if (!requestBusinessId || amount <= 0) {
                toast.warning('Corporativo', 'Selecciona empresa y valor para la liberacion');
                return;
            }

            title = title || `Liberar saldo a ${businessName}`;
            payload = {
                businessId: requestBusinessId,
                userId: requestBusinessId,
                amount,
                description: requestNote.trim() || `Liberacion corporativa para ${businessName}`,
            };
        }

        if (requestType === 'ops_exception') {
            if (!requestBusinessId || !requestAdvanceId.trim()) {
                toast.warning('Corporativo', 'Selecciona empresa y escribe el adelanto');
                return;
            }

            title = title || `Excepcion operativa ${requestAdvanceAction} para ${businessName}`;
            payload = {
                businessId: requestBusinessId,
                advanceId: requestAdvanceId.trim(),
                advanceAction: requestAdvanceAction,
                note: requestNote.trim() || null,
            };
        }

        if (requestType === 'custom') {
            payload = requestNote.trim() ? { note: requestNote.trim() } : {};
        }

        const response = await warehouseClient.createHoldingApproval({
            holdingId: activeHoldingId,
            businessId: businessIdForRequest,
            requestType,
            priority: requestPriority,
            title,
            description,
            payload,
        });

        toast.success(
            'Corporativo',
            response.mode === 'auto_approved'
                ? 'Solicitud autoaprobada por politica financiera'
                : 'Solicitud creada y enviada a cola de decision'
        );
        resetRequestComposer();
        await load(activeHoldingId);
    }, [
        activeHoldingId,
        allowCriticalRiskOperations,
        allowHighRiskOperations,
        autoApprovePlanUpgradesUntilUsd,
        load,
        maxBusinessExposureCop,
        maxPortfolioExposureCop,
        maxSingleAdvanceCop,
        requestAdvanceAction,
        requestAdvanceId,
        requestAmount,
        requestBusinessId,
        requestDescription,
        requestNote,
        requestPriority,
        requestTitle,
        requestType,
        resetRequestComposer,
        selectedRequestBusiness,
        selectedRequestPlan,
        walletReleaseLimitCop,
    ]);

    if (user?.userType === 'trucker') {
        return (
            <DashboardLayout pageTitle="Corporativo">
                <div className="rounded-lg border border-zinc-200 bg-white p-5 text-center sm:p-8 md:p-10">
                    <Building2 className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
                    <h1 className="text-2xl font-bold text-slate-900">La vista corporativa es solo para empresas</h1>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Corporativo">
            <div className="space-y-6">
                <EnterpriseHero
                    eyebrow="Corporate Control Tower"
                    title="Opera tu red multiempresa desde una sola capa"
                    description="Vincula empresas, define politica financiera, autoriza cambios comerciales y ejecuta decisiones operativas desde la consola corporativa."
                    icon={Sparkles}
                    meta={[
                        { label: 'Holding activo', value: summary?.account?.display_name || 'Sin holding', detail: summary?.role || 'Acceso corporativo' },
                        { label: 'Aprobaciones', value: summary?.approvals.pending || 0, detail: `${summary?.approvals.critical || 0} criticas | ${summary?.approvals.breached || 0} SLA breach` },
                    ]}
                />

                {loading ? (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    </div>
                ) : !summary?.ready ? (
                    <InlineNotice
                        tone="warning"
                        title="Holding corporativo pendiente"
                        description={summary?.message || 'Falta aplicar la migracion del modelo holding.'}
                    />
                ) : !summary.hasHoldingAccess ? (
                    <Card className="p-5 text-center sm:p-8 md:p-10">
                        <Building2 className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
                        <h2 className="text-2xl font-bold text-slate-900">Aun no tienes una red corporativa conectada</h2>
                    </Card>
                ) : (
                    <>
                        {!summary.featureEnabled ? (
                            <InlineNotice
                                tone="warning"
                                title="Enterprise desbloquea la capa total"
                                description="Multiempresa, aprobaciones, politicas y capacidad sin limite."
                                action={(
                                    <Button asChild>
                                        <Link href="/planes">
                                            Ver Enterprise
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                )}
                            />
                        ) : null}

                        <div className="grid kx-enterprise-grid-dense gap-4">
                            <Metric title="Empresas" value={summary.stats.totalBusinesses} />
                            <Metric title="Bodegas" value={summary.stats.totalWarehouses} />
                            <Metric title="Equipo" value={summary.stats.totalActiveInternalUsers} />
                            <Metric title="Viajes" value={summary.stats.totalMonthlyTrips} />
                            <Metric title="Incidentes" value={summary.stats.openIncidents} />
                            <Metric title="Miembros" value={summary.stats.activeHoldingMembers} />
                            <Metric title="Aprobaciones" value={summary.approvals.pending} hint={`${summary.approvals.breached} breach | ${summary.approvals.doubleBreached} doble`} />
                        </div>

                        <div className="grid kx-enterprise-grid gap-6">
                            <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                <div className="mb-5 flex min-w-0 items-start gap-3">
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div className="kx-enterprise-copy">
                                        <h2 className="text-xl font-semibold text-slate-900">Torre de control</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Citas, OTIF, muelles, pagos y negocios en riesgo desde una sola vista.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid kx-enterprise-grid-dense gap-4">
                                    <Metric title="Citas hoy" value={summary.controlTower.appointmentsToday} />
                                    <Metric title="Activas" value={summary.controlTower.activeAppointments} />
                                    <Metric title="Retrasadas" value={summary.controlTower.delayedAppointments} />
                                    <Metric title="OTIF" value={`${summary.controlTower.otifRate}%`} />
                                    <Metric title="Muelles ocupados" value={`${summary.controlTower.dockOccupancyRate}%`} />
                                </div>

                                <div className="mt-4 grid kx-enterprise-grid-dense gap-4">
                                    <Metric title="Pagos listos" value={`${summary.controlTower.paymentReadyRate}%`} />
                                    <Metric title="Pagos pendientes" value={summary.controlTower.paymentPendingAppointments} />
                                    <Metric title="Empresas en riesgo" value={summary.controlTower.atRiskBusinesses} />
                                </div>
                            </Card>

                            <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                <div className="mb-5 flex min-w-0 items-start gap-3">
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
                                        <AlertTriangle className="h-5 w-5" />
                                    </div>
                                    <div className="kx-enterprise-copy">
                                        <h2 className="text-xl font-semibold text-slate-900">Alertas prioritarias</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Incidentes abiertos, retrasos y bloqueos de pago que requieren accion.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {(summary.alerts || []).length ? summary.alerts.map((alert) => (
                                        <div key={alert.id} className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-slate-900">{alert.title}</p>
                                                <Badge variant={alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'secondary' : alert.severity === 'medium' ? 'warning' : 'outline'}>
                                                    {alert.severity}
                                                </Badge>
                                            </div>
                                            <p className="mt-2 text-sm text-slate-600">{alert.business_name}</p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {alert.warehouse_name ? `${alert.warehouse_name} | ` : ''}{alert.detail}
                                            </p>
                                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                                                {alert.type} | {formatDate(alert.created_at)}
                                            </p>
                                        </div>
                                    )) : (
                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                                            Sin alertas prioritarias. La red va limpia en este momento.
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>

                        <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                            <div className="mb-5 flex min-w-0 items-start gap-3">
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
                                    <BadgeDollarSign className="h-5 w-5" />
                                </div>
                                <div className="kx-enterprise-copy">
                                    <h2 className="text-xl font-semibold text-slate-900">Consola fintech</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Saldos operativos, revenue de plataforma, liberaciones y cartera de fuel advances por la red.
                                    </p>
                                </div>
                            </div>

                            <div className="grid kx-enterprise-grid-dense gap-4">
                                <Metric title="Custodia cobrada" value={formatCop(summary.fintech.custodyCollectedCop)} />
                                <Metric title="Custodia pendiente" value={formatCop(summary.fintech.custodyPendingCop)} />
                                <Metric title="Revenue plataforma" value={formatCop(summary.fintech.platformRevenueCop)} />
                                <Metric title="Wallet disponible" value={formatCop(summary.fintech.walletAvailableCop)} />
                                <Metric title="Cartera advances" value={formatCop(summary.fintech.advanceOutstandingCop)} />
                                <Metric title="Conciliacion" value={`${summary.fintech.reconciledPaymentsRate}%`} />
                            </div>

                            <div className="mt-4 grid kx-enterprise-grid-dense gap-4">
                                <Metric title="Wallet pendiente" value={formatCop(summary.fintech.walletPendingCop)} />
                                <Metric title="Retiros pendientes" value={formatCop(summary.fintech.pendingWithdrawalsCop)} />
                                <Metric title="Advances vencidos" value={formatCop(summary.fintech.advanceOverdueCop)} />
                                <Metric title="Advances activos" value={summary.fintech.activeAdvanceCount} />
                            </div>

                            <div className="mt-4 grid kx-enterprise-grid-dense gap-4">
                                <Metric title="PAR7" value={`${summary.fintech.par7Rate}%`} hint={formatCop(summary.fintech.par7Amount)} />
                                <Metric title="PAR30" value={`${summary.fintech.par30Rate}%`} hint={formatCop(summary.fintech.par30Amount)} />
                                <Metric title="NPL30" value={`${summary.fintech.npl30Rate}%`} hint={formatCop(summary.fintech.npl30Amount)} />
                                <Metric title="Write-offs" value={formatCop(summary.fintech.writeOffAmount)} />
                                <Metric title="Principal recuperado" value={formatCop(summary.fintech.recoveredPrincipalCop)} />
                            </div>
                        </Card>

                        <div className="grid kx-enterprise-grid gap-6">
                            <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                <div className="mb-5 flex min-w-0 items-start gap-3">
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
                                        <Truck className="h-5 w-5" />
                                    </div>
                                    <div className="kx-enterprise-copy">
                                        <h2 className="text-xl font-semibold text-slate-900">Marketplace + 3PL</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Colocacion comercial, clientes multi-cuenta, recepciones y despacho por la red.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid kx-enterprise-grid-dense gap-4">
                                    <Metric title="Ofertas publicadas" value={summary.marketplace.publishedOffers} />
                                    <Metric title="Ofertas asignadas" value={summary.marketplace.assignedOffers} />
                                    <Metric title="En transito" value={summary.marketplace.inTransitOffers} />
                                    <Metric title="Entregadas" value={summary.marketplace.deliveredOffers} />
                                    <Metric title="Fill rate" value={`${summary.marketplace.fillRate}%`} />
                                    <Metric title="Ofertas 3PL" value={summary.marketplace.threePlOffers} />
                                </div>

                                <div className="mt-4 grid kx-enterprise-grid-dense gap-4">
                                    <Metric title="Clientes" value={summary.marketplace.clientAccounts} />
                                    <Metric title="Clientes activos" value={summary.marketplace.activeClientAccounts} />
                                    <Metric title="Recepciones" value={summary.marketplace.receiptsProcessed} />
                                    <Metric title="Despachos" value={summary.marketplace.dispatchesProcessed} />
                                    <Metric title="Dispatch ready" value={`${summary.marketplace.dispatchReadyRate}%`} />
                                    <Metric title="Negocios multi-cliente" value={summary.marketplace.multiClientBusinesses} />
                                </div>
                            </Card>

                            <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                <div className="mb-5 flex min-w-0 items-start gap-3">
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div className="kx-enterprise-copy">
                                        <h2 className="text-xl font-semibold text-slate-900">Estado de pagos</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Semáforo operativo de checkout, webhooks, notificaciones y cierre de ciclo de pago.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid kx-enterprise-grid gap-3">
                                    <div className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="flex items-center gap-2">
                                            {summary.paymentsReadiness.ready ? (
                                                <CheckCircle2 className="h-5 w-5 text-zinc-700" />
                                            ) : (
                                                <CircleAlert className="h-5 w-5 text-zinc-700" />
                                            )}
                                            <p className="font-semibold text-slate-900">
                                                {summary.paymentsReadiness.ready ? 'Infraestructura de pagos operativa' : 'Hay bloqueos en la infraestructura de pagos'}
                                            </p>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-500">
                                            Checkout, webhooks, planes y notificaciones de PIN verificados en producción.
                                        </p>
                                    </div>

                                    <div className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <p className="text-sm font-semibold text-slate-900">Dominio publico</p>
                                        <Badge className="mt-2" variant={getReadinessVariant(summary.paymentsReadiness.productionLikeUrl)}>
                                            {summary.paymentsReadiness.productionLikeUrl ? 'URL HTTPS valida' : 'URL temporal o local'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Badge variant={getReadinessVariant(summary.paymentsReadiness.checkoutReady)}>
                                        Checkout {summary.paymentsReadiness.checkoutReady ? 'listo' : 'pendiente'}
                                    </Badge>
                                    <Badge variant={getReadinessVariant(summary.paymentsReadiness.freightWebhookReady)}>
                                        Webhook fletes {summary.paymentsReadiness.freightWebhookReady ? 'listo' : 'pendiente'}
                                    </Badge>
                                    <Badge variant={getReadinessVariant(summary.paymentsReadiness.billingWebhookReady)}>
                                        Webhook planes {summary.paymentsReadiness.billingWebhookReady ? 'listo' : 'pendiente'}
                                    </Badge>
                                    <Badge variant={getReadinessVariant(summary.paymentsReadiness.notificationsReady)}>
                                        Notificaciones {summary.paymentsReadiness.notificationsReady ? 'listas' : 'pendientes'}
                                    </Badge>
                                </div>

                                <div className="mt-4 space-y-3">
                                    {summary.paymentsReadiness.missingKeys.length ? (
                                        <div className="rounded-lg border border-zinc-300 bg-zinc-100 p-4">
                                            <p className="text-sm font-semibold text-zinc-950">Faltantes de entorno</p>
                                            <p className="mt-2 text-sm text-zinc-700">
                                                {summary.paymentsReadiness.missingKeys.join(' | ')}
                                            </p>
                                        </div>
                                    ) : null}

                                    {summary.paymentsReadiness.warnings.length ? (
                                        <div className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <p className="text-sm font-semibold text-slate-900">Observaciones operativas</p>
                                            <div className="mt-2 space-y-2">
                                                {summary.paymentsReadiness.warnings.map((warning) => (
                                                    <p key={warning} className="text-sm text-slate-600">
                                                        {warning}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                                            Sin alertas. La infraestructura de cobros está operativa.
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>

                        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
                            <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                <div className="mb-5 flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                    <div className="kx-enterprise-copy">
                                        <h2 className="text-xl font-semibold text-slate-900">Empresas del holding</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Riesgo, salud financiera, indicadores operativos y posicionamiento comercial.
                                        </p>
                                    </div>

                                    {summary.accounts.length > 1 ? (
                                        <Select
                                            value={activeHoldingId}
                                            onChange={setHoldingId}
                                            options={summary.accounts.map((account) => ({
                                                value: account.id,
                                                label: account.display_name,
                                                description: account.role,
                                            }))}
                                        />
                                    ) : null}
                                </div>

                                <div className="space-y-4">
                                    {linkedBusinesses.map((business) => (
                                        <div key={business.business_id} className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
                                            <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                <div className="kx-enterprise-copy">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-lg font-semibold text-slate-900">{business.company_name}</h3>
                                                        <Badge variant="outline">{business.relationship_type}</Badge>
                                                        <Badge variant={getRiskVariant(business.risk_level)}>Riesgo {business.risk_level}</Badge>
                                                        <Badge variant={getFinanceVariant(business.finance_readiness)}>
                                                            Finanzas {business.finance_readiness}
                                                        </Badge>
                                                    </div>

                                                    <p className="mt-2 text-sm text-slate-500">
                                                        {business.city || 'Sin ciudad'}, {business.department || 'Sin departamento'}
                                                    </p>
                                                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                                        {business.plan_name} | {business.subscription_status}
                                                    </p>
                                                    <p className="mt-2 font-money text-sm text-slate-600">
                                                        OTIF {business.otif_rate}% | Muelles {business.dock_occupancy_rate}% | Citas hoy {business.appointments_today} | Retrasos {business.delayed_appointments} | Pago listo {business.payment_ready_rate}%
                                                    </p>
                                                    <p className="mt-1 font-money text-sm text-slate-600">
                                                        Custodia {formatCop(business.custody_collected_cop)} | Wallet {formatCop(business.wallet_available_cop)} | Cartera {formatCop(business.advance_outstanding_cop)} | Advances activos {business.active_advance_count}
                                                    </p>
                                                    <p className="mt-1 font-money text-sm text-slate-600">
                                                        PAR7 {business.par7_rate || 0}% | PAR30 {business.par30_rate || 0}% | NPL30 {business.npl30_rate || 0}% | Vencido {formatCop(business.advance_overdue_cop)}
                                                    </p>
                                                    <p className="mt-1 font-money text-sm text-slate-600">
                                                        Marketplace {business.marketplace_published_offers} | Fill {business.marketplace_fill_rate}% | 3PL {business.three_pl_offers} | Clientes activos {business.active_client_accounts}
                                                    </p>
                                                    <p className="mt-1 font-money text-sm text-slate-600">
                                                        Recepciones {business.receipts_processed} | Despachos {business.dispatches_processed} | Ready despacho {business.dispatch_ready_rate}% | Entregadas {business.marketplace_delivered_offers}
                                                    </p>
                                                </div>

                                                <div className="kx-enterprise-actions xl:justify-end">
                                                    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                                                        {business.feature_enabled ? (
                                                            <span className="inline-flex items-center gap-2 font-semibold text-zinc-700">
                                                                <ShieldCheck className="h-4 w-4" />
                                                                Multiempresa activa
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-2 font-semibold text-zinc-700">
                                                                <AlertTriangle className="h-4 w-4" />
                                                                Enterprise recomendado
                                                            </span>
                                                        )}
                                                    </div>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setRequestType('plan_upgrade');
                                                            setRequestBusinessId(business.business_id);
                                                            setRequestPlanCode('enterprise');
                                                            setRequestTitle(`Activar Enterprise para ${business.company_name}`);
                                                        }}
                                                    >
                                                        Escalar plan
                                                    </Button>

                                                    {businesses?.capabilities?.manageBusinessLinks ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            isLoading={busy === `unlink-${business.business_id}`}
                                                            onClick={() => void runAction(`unlink-${business.business_id}`, async () => {
                                                                if (!window.confirm(`Vas a desvincular a ${business.company_name}. Deseas continuar?`)) {
                                                                    return;
                                                                }

                                                                await warehouseClient.unlinkHoldingBusiness(business.business_id, {
                                                                    holdingId: activeHoldingId,
                                                                });
                                                                toast.success('Corporativo', 'Empresa desvinculada');
                                                                await load(activeHoldingId);
                                                            })}
                                                        >
                                                            Desvincular
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="mt-4 grid kx-enterprise-grid-dense gap-3">
                                                {[
                                                    ['Bodegas', business.warehouses],
                                                    ['Equipo', business.active_internal_users],
                                                    ['Viajes', business.monthly_trips],
                                                    ['Incidentes', business.open_incidents],
                                                    ['Criticos', business.critical_incidents],
                                                    ['Score', business.risk_score],
                                                ].map(([label, value]) => (
                                                    <div key={String(label)} className="kx-enterprise-card rounded-lg border border-zinc-200 bg-white p-4">
                                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
                                                        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <div className="min-w-0 space-y-6">
                                <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                    <h2 className="text-xl font-semibold text-slate-900">Vincular empresa</h2>
                                    <div className="mt-4 space-y-4">
                                        <Select
                                            value={businessId}
                                            onChange={setBusinessId}
                                            searchable
                                            placeholder="Selecciona una empresa"
                                            options={(businesses?.catalog || []).map((catalogItem) => ({
                                                value: catalogItem.business_id,
                                                label: catalogItem.company_name,
                                                description: catalogItem.current_holding_name
                                                    ? `Ya esta en ${catalogItem.current_holding_name}`
                                                    : `${catalogItem.city || 'Sin ciudad'} | ${catalogItem.plan_name}`,
                                                disabled: Boolean(
                                                    catalogItem.current_holding_id &&
                                                    catalogItem.current_holding_id !== (activeHoldingId || null)
                                                ),
                                            }))}
                                        />

                                        <Select
                                            value={relationship}
                                            onChange={(value) => setRelationship(value as RelationshipType)}
                                            options={relationshipOptions}
                                        />

                                            <Button
                                                variant="dark"
                                                fullWidth
                                                isLoading={busy === 'link'}
                                                disabled={!businesses?.catalog.length}
                                            onClick={() => void runAction('link', handleLinkBusiness)}
                                        >
                                            {businesses?.canLinkDirectly ? 'Vincular empresa' : 'Enviar a aprobacion'}
                                        </Button>
                                    </div>
                                </Card>

                                <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                    <h2 className="text-xl font-semibold text-slate-900">Miembros corporativos</h2>
                                    <div className="mt-4 space-y-4">
                                        <Input
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            placeholder="equipo@empresa.com"
                                        />

                                        <Select
                                            value={role}
                                            onChange={(value) => setRole(value as HoldingMember['role'])}
                                            options={holdingRoleOptions}
                                        />

                                        <Button
                                            variant="dark"
                                            fullWidth
                                            isLoading={busy === 'invite'}
                                            disabled={!members?.capabilities?.manageMembers}
                                            onClick={() => void runAction('invite', handleInviteMember)}
                                        >
                                            Invitar miembro
                                        </Button>

                                        <div className="space-y-3">
                                            {(members?.data || []).map((member) => {
                                                const nextRole = memberRoleDrafts[member.id] || member.role;

                                                return (
                                                    <div key={member.id} className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-semibold text-slate-900">
                                                                {member.user?.full_name || member.invited_email}
                                                            </p>
                                                            <Badge variant={getStatusVariant(member.status)}>{member.status}</Badge>
                                                            <Badge variant="outline">{member.role}</Badge>
                                                        </div>

                                                        <p className="mt-2 text-sm text-slate-500">{member.invited_email}</p>
                                                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                                                            Alta: {formatDate(member.accepted_at || member.created_at)}
                                                        </p>

                                                        {members?.capabilities?.manageMembers ? (
                                                            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                                                                <Select
                                                                    value={nextRole}
                                                                    onChange={(value) => setMemberRoleDrafts((current) => ({
                                                                        ...current,
                                                                        [member.id]: value as HoldingMember['role'],
                                                                    }))}
                                                                    options={holdingRoleOptions}
                                                                />

                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={nextRole === member.role}
                                                                    isLoading={busy === `member-role-${member.id}`}
                                                                    onClick={() => void runAction(`member-role-${member.id}`, async () => {
                                                                        await handleMemberRoleSave(member);
                                                                    })}
                                                                >
                                                                    Guardar rol
                                                                </Button>

                                                                <Button
                                                                    variant={member.status === 'active' ? 'secondary' : 'success'}
                                                                    size="sm"
                                                                    isLoading={busy === `member-status-${member.id}`}
                                                                    onClick={() => void runAction(`member-status-${member.id}`, async () => {
                                                                        await handleMemberStatusToggle(member);
                                                                    })}
                                                                >
                                                                    {member.status === 'active' ? 'Suspender' : 'Reactivar'}
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Card>

                                <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
                                            <Wallet className="h-5 w-5" />
                                        </div>
                                        <div className="kx-enterprise-copy">
                                            <h2 className="text-xl font-semibold text-slate-900">Politica financiera</h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Define topes corporativos para adelantos, exposicion y automatizaciones.
                                            </p>
                                        </div>
                                    </div>

                                    {!financePolicy?.ready ? (
                                        <div className="mt-4 rounded-lg border border-zinc-300 bg-zinc-100 p-4 text-sm text-zinc-700">
                                            {financePolicy?.message || 'Falta habilitar la capa financiera corporativa.'}
                                        </div>
                                    ) : (
                                        <div className="mt-4 space-y-4">
                                            <Input
                                                label="Maximo por adelanto"
                                                type="number"
                                                value={maxSingleAdvanceCop}
                                                onChange={(event) => setMaxSingleAdvanceCop(event.target.value)}
                                                helperText={`Actual: ${formatCop(Number(maxSingleAdvanceCop || 0))}`}
                                            />
                                            <Input
                                                label="Exposicion maxima por empresa"
                                                type="number"
                                                value={maxBusinessExposureCop}
                                                onChange={(event) => setMaxBusinessExposureCop(event.target.value)}
                                                helperText={`Cap duro por negocio: ${formatCop(Number(maxBusinessExposureCop || 0))}`}
                                            />
                                            <Input
                                                label="Exposicion maxima de cartera"
                                                type="number"
                                                value={maxPortfolioExposureCop}
                                                onChange={(event) => setMaxPortfolioExposureCop(event.target.value)}
                                                helperText={`Actual: ${formatCop(Number(maxPortfolioExposureCop || 0))}`}
                                            />
                                            <Input
                                                label="Auto liberacion de wallet hasta"
                                                type="number"
                                                value={walletReleaseLimitCop}
                                                onChange={(event) => setWalletReleaseLimitCop(event.target.value)}
                                                helperText={`Todo release hasta ${formatCop(Number(walletReleaseLimitCop || 0))} se puede autoaprobar desde la cola.`}
                                            />
                                            <Input
                                                label="Auto activacion de planes hasta"
                                                type="number"
                                                value={autoApprovePlanUpgradesUntilUsd}
                                                onChange={(event) => setAutoApprovePlanUpgradesUntilUsd(event.target.value)}
                                                helperText={`Todo ajuste comercial hasta ${formatCop(Number(autoApprovePlanUpgradesUntilUsd || 0))} puede salir inmediato.`}
                                            />

                                            <div className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                <div className="space-y-4">
                                                    <Switch
                                                        checked={allowHighRiskOperations}
                                                        onCheckedChange={setAllowHighRiskOperations}
                                                        label="Permitir operaciones de alto riesgo"
                                                        description="Si se apaga, los casos high deben esperar decision humana."
                                                    />
                                                    <Switch
                                                        checked={allowCriticalRiskOperations}
                                                        onCheckedChange={setAllowCriticalRiskOperations}
                                                        label="Permitir operaciones criticas"
                                                        description="Si se apaga, los casos criticos nunca deben correr sin escalamiento."
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                variant="dark"
                                                fullWidth
                                                isLoading={busy === 'finance-policy'}
                                                disabled={!financePolicy.capabilities?.manageFinancePolicy}
                                                onClick={() => void runAction('finance-policy', handleFinancePolicySave)}
                                            >
                                                Guardar politica
                                            </Button>
                                        </div>
                                    )}
                                </Card>

                                <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
                                            <BadgeDollarSign className="h-5 w-5" />
                                        </div>
                                        <div className="kx-enterprise-copy">
                                            <h2 className="text-xl font-semibold text-slate-900">Aprobaciones y playbooks</h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                La cola ejecuta cambios comerciales, liberaciones y excepciones reales.
                                            </p>
                                        </div>
                                    </div>

                                    {!approvals?.ready ? (
                                        <div className="mt-4 rounded-lg border border-zinc-300 bg-zinc-100 p-4 text-sm text-zinc-700">
                                            {approvals?.message || 'Falta habilitar gobernanza corporativa.'}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mt-4 space-y-3">
                                                {(approvals.data || []).slice(0, 6).map((approval) => (
                                                    <div key={approval.id} className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-semibold text-slate-900">{approval.title}</p>
                                                            <Badge variant={getStatusVariant(approval.status)}>{approval.status}</Badge>
                                                            <Badge variant="outline">{approval.priority}</Badge>
                                                            <Badge variant={getApprovalAgingVariant(approval.aging_bucket)}>{approval.aging_bucket}</Badge>
                                                            <Badge variant="outline">{getAssignedTeamLabel(approval.assigned_team)}</Badge>
                                                        </div>

                                                        <p className="mt-2 text-sm text-slate-500">{getApprovalContextLabel(approval)}</p>
                                                        {approval.description ? (
                                                            <p className="mt-2 text-sm text-slate-600">{approval.description}</p>
                                                        ) : null}

                                                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                                                            Creada {formatDate(approval.created_at)}
                                                            {approval.sla_due_at ? ` | SLA ${formatDate(approval.sla_due_at)}` : ''}
                                                            {approval.decided_at ? ` | Decidida ${formatDate(approval.decided_at)}` : ''}
                                                            {approval.source_reference ? ` | Ref ${approval.source_reference.slice(0, 8)}` : ''}
                                                        </p>
                                                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                                                            Escalacion {approval.escalation_level} {approval.breached_at ? `| Breach ${formatDate(approval.breached_at)}` : ''}
                                                        </p>

                                                        {canDecideApproval(approval) && approval.status === 'pending' ? (
                                                            <div className="mt-4 space-y-3">
                                                                <Input
                                                                    value={decisionNotes[approval.id] || ''}
                                                                    onChange={(event) => setDecisionNotes((current) => ({
                                                                        ...current,
                                                                        [approval.id]: event.target.value,
                                                                    }))}
                                                                    placeholder="Nota de decision opcional"
                                                                />

                                                                <div className="flex flex-wrap gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="success"
                                                                        isLoading={busy === `approve-${approval.id}`}
                                                                        onClick={() => void runAction(`approve-${approval.id}`, async () => {
                                                                            await handleApprovalDecision(approval, 'approved');
                                                                        })}
                                                                    >
                                                                        Aprobar
                                                                    </Button>

                                                                    <Button
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        isLoading={busy === `reject-${approval.id}`}
                                                                        onClick={() => void runAction(`reject-${approval.id}`, async () => {
                                                                            await handleApprovalDecision(approval, 'rejected');
                                                                        })}
                                                                    >
                                                                        Rechazar
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-6 space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-slate-900">Nueva solicitud corporativa</h3>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        Usa formularios accionables. Si la politica lo permite, algunas salen autoaprobadas.
                                                    </p>
                                                </div>

                                                <div className="grid kx-enterprise-grid gap-4">
                                                    <Select
                                                        value={requestType}
                                                        onChange={(value) => setRequestType(value as ApprovalRequestType)}
                                                        options={approvalRequestTypeOptions}
                                                    />
                                                    <Select
                                                        value={requestPriority}
                                                        onChange={(value) => setRequestPriority(value as ApprovalPriority)}
                                                        options={approvalPriorityOptions}
                                                    />
                                                </div>

                                                <Input
                                                    value={requestTitle}
                                                    onChange={(event) => setRequestTitle(event.target.value)}
                                                    placeholder="Titulo interno de la solicitud"
                                                />

                                                <textarea
                                                    value={requestDescription}
                                                    onChange={(event) => setRequestDescription(event.target.value)}
                                                    placeholder="Descripcion ejecutiva opcional"
                                                    className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20"
                                                />

                                                {(requestType === 'plan_upgrade' || requestType === 'wallet_release' || requestType === 'ops_exception') ? (
                                                    <Select
                                                        value={requestBusinessId}
                                                        onChange={setRequestBusinessId}
                                                        placeholder="Selecciona empresa"
                                                        options={linkedBusinessOptions}
                                                    />
                                                ) : null}

                                                {requestType === 'plan_upgrade' ? (
                                                    <>
                                                        <Select
                                                            value={requestPlanCode}
                                                            onChange={setRequestPlanCode}
                                                            options={planOptions.map((plan) => ({
                                                                value: plan.value,
                                                                label: plan.label,
                                                                description: `${plan.description} | ${formatCop(plan.priceCop)}/mes + IVA si aplica`,
                                                            }))}
                                                        />

                                                        <Input
                                                            value={requestNote}
                                                            onChange={(event) => setRequestNote(event.target.value)}
                                                            placeholder="Motivo comercial del cambio"
                                                        />

                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                                                            Todo cambio comercial hasta {formatCop(Number(autoApprovePlanUpgradesUntilUsd || 0))}
                                                            puede salir inmediato si lo inicia un manager corporativo.
                                                        </div>
                                                    </>
                                                ) : null}

                                                {requestType === 'wallet_release' ? (
                                                    <>
                                                        <Input
                                                            type="number"
                                                            value={requestAmount}
                                                            onChange={(event) => setRequestAmount(event.target.value)}
                                                            placeholder="Monto a liberar"
                                                            helperText={`Politica actual: ${formatCop(Number(walletReleaseLimitCop || 0))}`}
                                                        />

                                                        <Input
                                                            value={requestNote}
                                                            onChange={(event) => setRequestNote(event.target.value)}
                                                            placeholder="Motivo de la liberacion"
                                                        />

                                                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                                                            Las liberaciones hasta {formatCop(Number(walletReleaseLimitCop || 0))} pueden autoaprobarse.
                                                        </div>
                                                    </>
                                                ) : null}

                                                {requestType === 'ops_exception' ? (
                                                    <>
                                                        <Input
                                                            value={requestAdvanceId}
                                                            onChange={(event) => setRequestAdvanceId(event.target.value)}
                                                            placeholder="ID del adelanto"
                                                        />

                                                        <Select
                                                            value={requestAdvanceAction}
                                                            onChange={(value) => setRequestAdvanceAction(value as OpsAdvanceAction)}
                                                            options={opsActionOptions}
                                                        />

                                                        <Input
                                                            value={requestNote}
                                                            onChange={(event) => setRequestNote(event.target.value)}
                                                            placeholder="Nota operativa para la decision"
                                                        />
                                                    </>
                                                ) : null}

                                                {requestType === 'credit_policy' ? (
                                                    <div className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                                                        Esta solicitud tomara los valores actuales de la Politica financiera y los pasara a cola de decision.
                                                    </div>
                                                ) : null}

                                                {requestType === 'custom' ? (
                                                    <Input
                                                        value={requestNote}
                                                        onChange={(event) => setRequestNote(event.target.value)}
                                                        placeholder="Nota opcional para contexto"
                                                    />
                                                ) : null}

                                                {selectedRequestBusiness ? (
                                                    <div className="kx-enterprise-card rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-semibold text-slate-900">{selectedRequestBusiness.company_name}</span>
                                                            <Badge variant={getRiskVariant(selectedRequestBusiness.risk_level)}>
                                                                Riesgo {selectedRequestBusiness.risk_level}
                                                            </Badge>
                                                            <Badge variant={getFinanceVariant(selectedRequestBusiness.finance_readiness)}>
                                                                Finanzas {selectedRequestBusiness.finance_readiness}
                                                            </Badge>
                                                        </div>
                                                        <p className="mt-2">
                                                            Plan actual: {selectedRequestBusiness.plan_name} | Bodegas: {selectedRequestBusiness.warehouses} | Viajes: {selectedRequestBusiness.monthly_trips}
                                                        </p>
                                                    </div>
                                                ) : null}

                                                <Button
                                                    variant="dark"
                                                    fullWidth
                                                    isLoading={busy === 'request'}
                                                    onClick={() => void runAction('request', handleCreateApproval)}
                                                >
                                                    Crear solicitud
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </Card>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
