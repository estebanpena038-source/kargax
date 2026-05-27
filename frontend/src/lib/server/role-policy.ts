import type { SupabaseClient } from '@supabase/supabase-js';
import {
    getBusinessRoleCapabilities,
    type BusinessRole,
    type BusinessRoleCapabilities,
} from '@/lib/business-roles';
import {
    resolveBusinessAccessContext,
    type BusinessAccessContext,
} from '@/lib/server/warehouses';
import { resolveScopedBusinessId } from '@/lib/server/route-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

export type RolePolicyProfile = {
    id: string;
    user_type: 'trucker' | 'business' | 'admin';
} | null;

export type RolePolicyScopeError = {
    error: string;
    status: 400 | 403;
};

export interface BusinessPolicyCapabilities extends BusinessRoleCapabilities {
    canViewPrivateFleet: boolean;
    canOperatePrivateFleet: boolean;
    canCreatePrivateFleetTrips: boolean;
    canManagePrivateFleetDrivers: boolean;
    canManagePrivateFleetOperationalProfile: boolean;
    canManagePrivateFleetMoney: boolean;
    canViewPrivateFleetMoney: boolean;
    canUploadPrivateFleetProofs: boolean;
    canClosePrivateFleetProofs: boolean;
    canViewPrivateFleetProofs: boolean;
    canCreateAnyOffer: boolean;
    canCreatePrivateOfferWithMoney: boolean;
    canViewBusinessMonthlyReport: boolean;
    canExportBusinessMonthlyReport: boolean;
}

export interface BusinessRolePolicy {
    access: BusinessAccessContext;
    businessId: string | null;
    effectiveRole: BusinessRole;
    baseCapabilities: BusinessRoleCapabilities;
    capabilities: BusinessPolicyCapabilities;
    scopeError: RolePolicyScopeError | null;
}

const OPERATIONAL_PRIVATE_FLEET_ROLES = new Set<BusinessRole>([
    'admin',
    'owner',
    'manager',
    'ops_manager',
    'dispatcher',
    'operator',
]);

const PRIVATE_FLEET_MONEY_ROLES = new Set<BusinessRole>([
    'admin',
    'owner',
    'finance_accountant',
]);

const PRIVATE_FLEET_MONEY_VIEW_ROLES = new Set<BusinessRole>([
    'admin',
    'owner',
    'manager',
    'finance_accountant',
    'auditor',
]);

export function resolveEffectiveBusinessRole(
    profile: RolePolicyProfile,
    access: Pick<BusinessAccessContext, 'isOwner' | 'teamMember' | 'isAdmin'>
): BusinessRole {
    if (profile?.user_type === 'admin' || access.isAdmin) {
        return 'admin';
    }

    if (access.isOwner) {
        return 'owner';
    }

    return access.teamMember?.role || 'viewer';
}

export function getBusinessPolicyCapabilities(role: BusinessRole): BusinessPolicyCapabilities {
    const baseCapabilities = getBusinessRoleCapabilities(role);
    const canManagePrivateFleetMoney = PRIVATE_FLEET_MONEY_ROLES.has(role);
    const canViewPrivateFleetMoney = canManagePrivateFleetMoney || PRIVATE_FLEET_MONEY_VIEW_ROLES.has(role);
    const canOperatePrivateFleet =
        OPERATIONAL_PRIVATE_FLEET_ROLES.has(role) &&
        baseCapabilities.canManagePrivateFleet &&
        !['finance_accountant', 'auditor', 'viewer'].includes(role);
    const canViewPrivateFleet =
        canOperatePrivateFleet ||
        canViewPrivateFleetMoney ||
        baseCapabilities.canManagePrivateFleet ||
        baseCapabilities.intelligenceTabs.includes('private_fleet');

    return {
        ...baseCapabilities,
        canViewPrivateFleet,
        canOperatePrivateFleet,
        canCreatePrivateFleetTrips: canOperatePrivateFleet,
        canManagePrivateFleetDrivers: role === 'admin' || role === 'owner',
        canManagePrivateFleetOperationalProfile: role === 'admin' || role === 'owner',
        canManagePrivateFleetMoney,
        canViewPrivateFleetMoney,
        canUploadPrivateFleetProofs: canManagePrivateFleetMoney,
        canClosePrivateFleetProofs: canManagePrivateFleetMoney,
        canViewPrivateFleetProofs: canViewPrivateFleet || baseCapabilities.canViewEvidence,
        canCreateAnyOffer: baseCapabilities.canCreateMarketplaceOffers || canOperatePrivateFleet,
        canCreatePrivateOfferWithMoney: canManagePrivateFleetMoney,
        canViewBusinessMonthlyReport: baseCapabilities.canViewIntelligence,
        canExportBusinessMonthlyReport: baseCapabilities.canExportData || baseCapabilities.canExportFinance,
    };
}

export function hasBusinessPolicyCapability(
    policy: Pick<BusinessRolePolicy, 'capabilities'> | null | undefined,
    capability: keyof BusinessPolicyCapabilities
) {
    return Boolean(policy?.capabilities?.[capability]);
}

export async function resolveBusinessRolePolicy(
    supabaseAdmin: AdminClient,
    authUserId: string,
    profile: RolePolicyProfile,
    options: {
        requestedBusinessId?: string | null;
        adminFallbackBusinessId?: string | null;
    } = {}
): Promise<BusinessRolePolicy> {
    const access = await resolveBusinessAccessContext(supabaseAdmin, authUserId, profile);
    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: options.requestedBusinessId,
        resolvedBusinessId: access.businessId,
        profile,
        adminFallbackBusinessId: options.adminFallbackBusinessId,
    });
    const scopeError = 'error' in scopedBusiness
        ? {
            error: scopedBusiness.error || 'Business scope error',
            status: scopedBusiness.status || 403,
        }
        : null;
    const businessId = 'businessId' in scopedBusiness ? scopedBusiness.businessId || null : null;
    const effectiveRole = resolveEffectiveBusinessRole(profile, access);
    const baseCapabilities = getBusinessRoleCapabilities(effectiveRole);

    return {
        access,
        businessId,
        effectiveRole,
        baseCapabilities,
        capabilities: getBusinessPolicyCapabilities(effectiveRole),
        scopeError,
    };
}
