import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiError, getRequestId } from '@/lib/server/api-response';
import { isFounderCeoAllowed, requireAuthenticatedRoute } from '@/lib/server/route-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

export type StaffRole =
    | 'platform_owner'
    | 'ops_manager'
    | 'support_lead'
    | 'support_agent'
    | 'payout_reviewer'
    | 'payout_approver';

export type StaffCapability =
    | 'admin:overview'
    | 'advance:read'
    | 'advance:write'
    | 'incident:read'
    | 'incident:write'
    | 'notification:read'
    | 'notification:write'
    | 'payment:reconcile'
    | 'pin:resend'
    | 'platform:critical_settings'
    | 'payout:read'
    | 'payout:review'
    | 'payout:approve'
    | 'payout:mark_paid'
    | 'support:read'
    | 'support:reply'
    | 'support:internal_note'
    | 'support:assign'
    | 'support:escalate'
    | 'support:close'
    // Compatibility aliases while old routes are being retired.
    | 'payout:write'
    | 'settings:critical'
    | 'support:write'
    | 'treasury:adjust';

interface RequireStaffCapabilityOptions {
    requireAal2?: boolean;
}

interface StaffAuthContext {
    supabaseAdmin: AdminClient;
    authUser: {
        id: string;
        email: string | null;
    };
    profile: {
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        user_type: 'trucker' | 'business' | 'admin' | 'staff';
    } | null;
}

export interface StaffContext extends StaffAuthContext {
    staff: {
        roles: StaffRole[];
        capabilities: StaffCapability[];
        actorRole: StaffRole;
    };
    /**
     * Deprecated compatibility surface for routes created before staff was split
     * from admin. New code must use `staff`.
     */
    internalAdmin: {
        roles: StaffRole[];
        capabilities: StaffCapability[];
        actorRole: StaffRole;
    };
}

type StaffAuthResult =
    | { context: StaffContext }
    | { response: NextResponse };

const ROLE_PRIORITY: StaffRole[] = [
    'platform_owner',
    'ops_manager',
    'support_lead',
    'payout_approver',
    'payout_reviewer',
    'support_agent',
];

const CAPABILITY_ROLES: Record<StaffCapability, StaffRole[]> = {
    'admin:overview': ['platform_owner', 'ops_manager'],
    'advance:read': ['platform_owner', 'ops_manager'],
    'advance:write': ['platform_owner', 'ops_manager'],
    'incident:read': ['platform_owner', 'ops_manager', 'support_lead'],
    'incident:write': ['platform_owner', 'ops_manager', 'support_lead'],
    'notification:read': ['platform_owner', 'ops_manager', 'support_lead', 'payout_reviewer', 'payout_approver'],
    'notification:write': ['platform_owner', 'ops_manager'],
    'payment:reconcile': ['platform_owner', 'ops_manager', 'payout_approver'],
    'pin:resend': ['platform_owner', 'ops_manager', 'support_lead'],
    'platform:critical_settings': ['platform_owner'],
    'payout:read': ['platform_owner', 'ops_manager', 'payout_reviewer', 'payout_approver'],
    'payout:review': ['platform_owner', 'ops_manager', 'payout_reviewer', 'payout_approver'],
    'payout:approve': ['platform_owner', 'ops_manager', 'payout_approver'],
    'payout:mark_paid': ['platform_owner', 'ops_manager', 'payout_approver'],
    'support:read': ['platform_owner', 'ops_manager', 'support_lead', 'support_agent'],
    'support:reply': ['platform_owner', 'ops_manager', 'support_lead', 'support_agent'],
    'support:internal_note': ['platform_owner', 'ops_manager', 'support_lead', 'support_agent'],
    'support:assign': ['platform_owner', 'ops_manager', 'support_lead'],
    'support:escalate': ['platform_owner', 'ops_manager', 'support_lead'],
    'support:close': ['platform_owner', 'ops_manager', 'support_lead'],
    'payout:write': ['platform_owner', 'ops_manager', 'payout_approver'],
    'settings:critical': ['platform_owner'],
    'support:write': ['platform_owner', 'ops_manager', 'support_lead'],
    'treasury:adjust': ['platform_owner'],
};

function isMissingStaffTable(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const serialized = JSON.stringify(error).toLowerCase();
    return serialized.includes('staff_memberships')
        && (
            serialized.includes('does not exist')
            || serialized.includes('schema cache')
            || serialized.includes('pgrst')
        );
}

function normalizeRole(value: unknown): StaffRole | null {
    return value === 'platform_owner'
        || value === 'ops_manager'
        || value === 'support_lead'
        || value === 'support_agent'
        || value === 'payout_reviewer'
        || value === 'payout_approver'
        ? value
        : null;
}

function sortRoles(roles: Iterable<StaffRole>) {
    const roleSet = new Set(roles);
    return ROLE_PRIORITY.filter((role) => roleSet.has(role));
}

export function getCapabilitiesForStaffRoles(roles: StaffRole[]) {
    return (Object.entries(CAPABILITY_ROLES) as Array<[StaffCapability, StaffRole[]]>)
        .filter(([, allowedRoles]) => allowedRoles.some((role) => roles.includes(role)))
        .map(([capability]) => capability);
}

export async function resolveStaffRoles(context: StaffAuthContext) {
    const roles = new Set<StaffRole>();

    if (isFounderCeoAllowed(context)) {
        roles.add('platform_owner');
    }

    if (context.profile?.user_type !== 'staff' && context.profile?.user_type !== 'admin') {
        return sortRoles(roles);
    }

    const { data, error } = await context.supabaseAdmin
        .from('staff_memberships')
        .select('role')
        .eq('user_id', context.authUser.id)
        .eq('status', 'active');

    if (error) {
        if (!isMissingStaffTable(error)) {
            console.warn('[staff][roles]', error.message || error);
        }
        return sortRoles(roles);
    }

    for (const row of data || []) {
        const role = normalizeRole((row as { role?: unknown }).role);
        if (role) {
            roles.add(role);
        }
    }

    return sortRoles(roles);
}

export async function requireStaffCapability(
    request: NextRequest,
    capability: StaffCapability,
    options: RequireStaffCapabilityOptions = {}
): Promise<StaffAuthResult> {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request, {
        requireAal2: options.requireAal2 ?? false,
    });

    if ('response' in auth) {
        return auth;
    }

    const roles = await resolveStaffRoles(auth.context);
    const capabilities = getCapabilitiesForStaffRoles(roles);

    if (!capabilities.includes(capability)) {
        return {
            response: apiError('No tienes permiso para ejecutar esta accion interna.', {
                requestId,
                status: 403,
                code: 'STAFF_CAPABILITY_REQUIRED',
                details: {
                    capability,
                    roles,
                },
            }),
        };
    }

    const staff = {
        roles,
        capabilities,
        actorRole: roles[0] || ('support_agent' as StaffRole),
    };

    return {
        context: {
            ...auth.context,
            staff,
            internalAdmin: staff,
        },
    };
}

export function hasStaffCapability(
    roles: StaffRole[],
    capability: StaffCapability
) {
    return getCapabilitiesForStaffRoles(roles).includes(capability);
}

export function getRequestAuditMetadata(request: NextRequest) {
    return {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || null,
        userAgent: request.headers.get('user-agent') || null,
    };
}

export async function recordStaffAuditEvent(
    supabaseAdmin: AdminClient,
    payload: {
        actorId?: string | null;
        actorRole?: StaffRole | string | null;
        capability?: StaffCapability | string | null;
        targetType: string;
        targetId?: string | null;
        previousState?: Record<string, unknown>;
        newState?: Record<string, unknown>;
        reason?: string | null;
        ipAddress?: string | null;
        userAgent?: string | null;
    }
) {
    const { error } = await supabaseAdmin
        .from('staff_audit_events')
        .insert({
            actor_id: payload.actorId || null,
            actor_role: payload.actorRole || null,
            capability: payload.capability || null,
            target_type: payload.targetType,
            target_id: payload.targetId || null,
            previous_state: payload.previousState || {},
            new_state: payload.newState || {},
            reason: payload.reason || null,
            ip_address: payload.ipAddress || null,
            user_agent: payload.userAgent || null,
        });

    if (error && !isMissingStaffTable(error)) {
        console.warn('[staff-audit][insert]', error.message || error);
    }
}

// Deprecated aliases kept while older imports are removed.
export type InternalAdminRole = StaffRole;
export type InternalAdminCapability = StaffCapability;
export const getCapabilitiesForRoles = getCapabilitiesForStaffRoles;
export const resolveInternalAdminRoles = resolveStaffRoles;
export const hasInternalAdminCapability = hasStaffCapability;
