import type { SupabaseClient } from '@supabase/supabase-js';
import { getBusinessRoleCapabilities, type BusinessRole } from '@/lib/business-roles';
import {
    getBusinessPlanSnapshot,
    resolveBusinessAccessContext,
} from '@/lib/server/warehouses';
import { resolveScopedBusinessId } from '@/lib/server/route-auth';
import { LastMileError } from './errors';
import type { LastMileAccess } from '@/lib/last-mile/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

interface AuthProfile {
    id: string;
    user_type: 'trucker' | 'business' | 'admin' | 'staff';
}

type PlanLike = {
    feature_matrix?: Record<string, unknown> | null;
} | null;

type SubscriptionLike = {
    plan?: PlanLike;
} | null;

interface ResolveLastMileAccessInput {
    role: BusinessRole;
    isOwner: boolean;
    isAdmin: boolean;
    subscription: SubscriptionLike;
}

function readNumberFlag(value: unknown, fallback: number | null) {
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function getMonthRange(monthParam?: string | null) {
    const now = new Date();
    const base = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? new Date(`${monthParam}-01T00:00:00.000Z`)
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const month = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

    return { start, end, month };
}

export function buildLaneKey(input: {
    originDepartment?: string | null;
    originCity?: string | null;
    originZone?: string | null;
    destinationDepartment?: string | null;
    destinationCity?: string | null;
    destinationZone?: string | null;
    vehicleType?: string | null;
    cargoType?: string | null;
    serviceLevel?: string | null;
}) {
    const part = (value: string | null | undefined) => (value || '*').trim().toLowerCase();
    return [
        `${part(input.originDepartment)}:${part(input.originCity)}:${part(input.originZone)}`,
        `${part(input.destinationDepartment)}:${part(input.destinationCity)}:${part(input.destinationZone)}`,
        part(input.vehicleType),
        part(input.cargoType),
        part(input.serviceLevel || 'standard'),
    ].join('|');
}

export function getLastMileEntitlements(featureMatrix: Record<string, unknown> | null | undefined) {
    const matrix = featureMatrix || {};
    const canControl = Boolean(matrix.last_mile_margin_control);
    const canViewDashboard = Boolean(matrix.last_mile_margin_dashboard || matrix.last_mile_margin_control);

    return {
        canControl,
        canViewDashboard,
        readOnly: Boolean(matrix.last_mile_margin_read_only) && !canControl,
        canManageContracts: Boolean(matrix.last_mile_contracts),
        canViewScorecards: Boolean(matrix.last_mile_scorecards || matrix.last_mile_margin_dashboard || matrix.last_mile_margin_control),
        canGenerateAlerts: Boolean(matrix.last_mile_alerts),
        canManageRenegotiations: Boolean(matrix.last_mile_renegotiations),
        canExport: Boolean(matrix.last_mile_exports),
        monthlyAlertLimit: readNumberFlag(matrix.last_mile_monthly_alert_limit, 0),
        activeContractLimit: readNumberFlag(matrix.last_mile_active_contract_limit, 0),
    };
}

export function resolveLastMileAccess(input: ResolveLastMileAccessInput): LastMileAccess {
    const caps = getBusinessRoleCapabilities(input.role);
    const entitlements = getLastMileEntitlements(input.subscription?.plan?.feature_matrix || {});
    const isFinancialRole = input.isAdmin || input.isOwner || caps.canViewFinance || input.role === 'manager';
    const canViewByRole = input.isAdmin || input.isOwner || caps.canViewFinance || caps.canViewOperations || caps.canViewIntelligence;
    const canManageByRole = input.isAdmin || input.isOwner || input.role === 'manager';
    const enabled = input.isAdmin || entitlements.canControl;
    const readOnly = !enabled && entitlements.readOnly;

    return {
        enabled,
        readOnly,
        canViewDashboard: canViewByRole && (enabled || readOnly || entitlements.canViewDashboard),
        canViewFinancials: isFinancialRole && (enabled || readOnly),
        canManageContracts: enabled && entitlements.canManageContracts && canManageByRole,
        canRunRecompute: enabled && (input.isAdmin || input.isOwner || input.role === 'manager' || input.role === 'finance_accountant'),
        canViewScorecards: canViewByRole && (enabled || readOnly) && entitlements.canViewScorecards,
        canGenerateAlerts: enabled && entitlements.canGenerateAlerts,
        canManageRenegotiations: enabled && entitlements.canManageRenegotiations && (
            input.isAdmin || input.isOwner || ['manager', 'ops_manager', 'dispatcher', 'finance_accountant'].includes(input.role)
        ),
        canExport: enabled && entitlements.canExport && (input.isAdmin || caps.canExportFinance || caps.canExportData),
        monthlyAlertLimit: entitlements.monthlyAlertLimit,
        activeContractLimit: entitlements.activeContractLimit,
        recommendedPlan: 'enterprise',
    };
}

export function assertLastMileView(access: LastMileAccess) {
    if (!access.canViewDashboard) {
        throw new LastMileError('Control de margen esta disponible para roles business/admin con plan habilitado.', {
            status: access.enabled || access.readOnly ? 403 : 402,
            code: access.enabled || access.readOnly ? 'LAST_MILE_ROLE_REQUIRED' : 'LAST_MILE_PAYWALL',
            details: {
                recommendedPlan: access.recommendedPlan,
                checkoutPath: '/planes',
            },
        });
    }
}

export function assertLastMileManageContracts(access: LastMileAccess) {
    assertLastMileView(access);
    if (!access.canManageContracts) {
        throw new LastMileError('Tu rol o plan no puede administrar contratos de margen.', {
            status: access.enabled ? 403 : 402,
            code: access.enabled ? 'LAST_MILE_CONTRACT_FORBIDDEN' : 'LAST_MILE_PAYWALL',
        });
    }
}

export function assertLastMileRecompute(access: LastMileAccess) {
    assertLastMileView(access);
    if (!access.canRunRecompute) {
        throw new LastMileError('Tu rol no puede recalcular snapshots de margen.', {
            status: 403,
            code: 'LAST_MILE_RECOMPUTE_FORBIDDEN',
        });
    }
}

export function assertLastMileRenegotiation(access: LastMileAccess) {
    assertLastMileView(access);
    if (!access.canManageRenegotiations) {
        throw new LastMileError('Tu plan o rol no puede gestionar renegociaciones.', {
            status: access.enabled ? 403 : 402,
            code: access.enabled ? 'LAST_MILE_RENEGOTIATION_FORBIDDEN' : 'LAST_MILE_PAYWALL',
        });
    }
}

export async function resolveLastMileRouteContext(
    supabaseAdmin: AdminClient,
    authUserId: string,
    profile: AuthProfile | null,
    requestedBusinessId?: string | null
) {
    if (!profile || !['business', 'admin'].includes(profile.user_type)) {
        throw new LastMileError('Solo empresas o admins pueden acceder a Control de margen.', {
            status: 403,
            code: 'LAST_MILE_ROLE_REQUIRED',
        });
    }

    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUserId, profile);
    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId,
        resolvedBusinessId: businessAccess.businessId,
        profile,
    });

    if ('error' in scopedBusiness) {
        throw new LastMileError(scopedBusiness.error || 'Business scope error', {
            status: scopedBusiness.status,
            code: 'LAST_MILE_BUSINESS_SCOPE_ERROR',
        });
    }

    const businessId = scopedBusiness.businessId;
    const effectiveRole = profile.user_type === 'admin'
        ? 'admin'
        : businessAccess.isOwner
            ? 'owner'
            : businessAccess.teamMember?.role || 'viewer';
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);
    const access = resolveLastMileAccess({
        role: effectiveRole,
        isOwner: businessAccess.isOwner,
        isAdmin: profile.user_type === 'admin',
        subscription: snapshot.subscription,
    });

    return {
        businessId,
        businessAccess,
        effectiveRole,
        snapshot,
        access,
    };
}
