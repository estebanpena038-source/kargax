import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    HoldingApprovalRequest,
    HoldingBusinessCatalogItem,
    HoldingBusinessesResponse,
    HoldingCapabilities,
    HoldingFinancePolicyResponse,
    HoldingMember,
    HoldingMembersResponse,
    HoldingRole,
    HoldingSummaryResponse,
    HoldingApprovalsResponse,
} from '@/lib/warehouses/types';
import { getBillingCheckoutInfrastructureStatus, isBusinessTeamMembersTableMissing, resolveBillingPlanPriceCop } from '@/lib/server/warehouses';
import { createAdminNotification } from '@/lib/server/route-auth';
import { getNotificationRuntimeSnapshot, isStrictProductionEnvironment } from '@/lib/server/runtime-env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

interface AuthProfile {
    id: string;
    user_type: 'trucker' | 'business' | 'admin' | 'staff';
}

type SupabaseErrorLike = {
    code?: string | null;
    details?: string | null;
    hint?: string | null;
    message?: string | null;
};

type HoldingMembershipRow = {
    holding_account_id: string;
    role: Exclude<HoldingRole, 'admin'>;
};

type HoldingAccountRow = {
    id: string;
    legal_name: string;
    display_name: string;
    slug: string;
    country_code: string;
    status: 'active' | 'suspended';
    created_at: string;
    updated_at: string;
};

export const HOLDING_MIGRATION = '026_holding_accounts.sql';
export const HOLDING_GOVERNANCE_MIGRATION = '027_holding_governance.sql';
export const HOLDING_FINANCE_MIGRATION = '028_holding_finance_policies.sql';

function getSupabaseErrorText(error: unknown) {
    if (!error || typeof error !== 'object') {
        return '';
    }

    const candidate = error as SupabaseErrorLike;
    return [candidate.code, candidate.message, candidate.details, candidate.hint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function isMissingSupabaseTable(error: unknown, tableName: string) {
    const normalizedTableName = tableName.toLowerCase();
    const errorText = getSupabaseErrorText(error);

    return (
        errorText.includes(normalizedTableName) &&
        (
            errorText.includes('schema cache') ||
            errorText.includes('does not exist') ||
            errorText.includes(`relation "public.${normalizedTableName}"`) ||
            errorText.includes('pgrst205')
        )
    );
}

export function isHoldingAccountsTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'holding_accounts');
}

export function isHoldingAccountMembersTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'holding_account_members');
}

export function isHoldingBusinessLinksTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'holding_business_links');
}

export function isHoldingApprovalRequestsTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'holding_approval_requests');
}

export function isHoldingFinancePoliciesTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'holding_finance_policies');
}

export function getHoldingSetupMessage() {
    return `Aplica la migracion ${HOLDING_MIGRATION} desde supabase/migrations para habilitar holding multiempresa y vista corporativa.`;
}

export function getHoldingGovernanceSetupMessage() {
    return `Aplica la migracion ${HOLDING_GOVERNANCE_MIGRATION} desde supabase/migrations para habilitar aprobaciones corporativas.`;
}

export function getHoldingFinanceSetupMessage() {
    return `Aplica la migracion ${HOLDING_FINANCE_MIGRATION} desde supabase/migrations para habilitar politicas financieras corporativas.`;
}

export function canManageHoldingRole(role: HoldingRole | null) {
    return ['holding_owner', 'finance_admin', 'ops_admin', 'admin'].includes(role || '');
}

export function getHoldingCapabilities(role: HoldingRole | null): HoldingCapabilities | null {
    if (!role) {
        return null;
    }

    return {
        viewCorporateOverview: true,
        viewCorporateLedger: true,
        exportCorporateData: true,
        manageMembers: ['holding_owner', 'admin'].includes(role),
        manageBusinessLinks: ['holding_owner', 'ops_admin', 'admin'].includes(role),
        manageFinancePolicy: ['holding_owner', 'finance_admin', 'admin'].includes(role),
        manageTreasury: ['holding_owner', 'finance_admin', 'admin'].includes(role),
        approveFinanceQueue: ['holding_owner', 'finance_admin', 'admin'].includes(role),
        approveOpsQueue: ['holding_owner', 'ops_admin', 'admin'].includes(role),
        overrideEscalations: ['holding_owner', 'admin'].includes(role),
    };
}

export function canManageHoldingMembers(role: HoldingRole | null) {
    return Boolean(getHoldingCapabilities(role)?.manageMembers);
}

export function canManageHoldingBusinessLinks(role: HoldingRole | null) {
    return Boolean(getHoldingCapabilities(role)?.manageBusinessLinks);
}

export function canManageHoldingFinance(role: HoldingRole | null) {
    return Boolean(getHoldingCapabilities(role)?.manageFinancePolicy);
}

export function canApproveHoldingRequest(
    role: HoldingRole | null,
    requestType: HoldingApprovalRequest['request_type'],
    assignedTeam?: 'holding_owner' | 'finance_admin' | 'ops_admin' | null
) {
    const capabilities = getHoldingCapabilities(role);

    if (!capabilities) {
        return false;
    }

    if (capabilities.overrideEscalations) {
        return true;
    }

    const effectiveTeam = assignedTeam || getHoldingAssignedTeam(requestType);

    if (effectiveTeam === 'finance_admin') {
        return capabilities.approveFinanceQueue;
    }

    if (effectiveTeam === 'ops_admin') {
        return capabilities.approveOpsQueue;
    }

    return capabilities.overrideEscalations;
}

function getHoldingAssignedTeam(
    requestType: HoldingApprovalRequest['request_type']
): 'holding_owner' | 'finance_admin' | 'ops_admin' {
    if (['wallet_release', 'credit_policy', 'plan_upgrade'].includes(requestType)) {
        return 'finance_admin';
    }

    if (['business_link', 'ops_exception'].includes(requestType)) {
        return 'ops_admin';
    }

    return 'holding_owner';
}

function getHoldingSlaDueAt(priority: HoldingApprovalRequest['priority'], createdAt = new Date()) {
    const nextDate = new Date(createdAt);

    if (priority === 'critical') {
        nextDate.setMinutes(nextDate.getMinutes() + 5);
        return nextDate.toISOString();
    }

    if (priority === 'high') {
        nextDate.setMinutes(nextDate.getMinutes() + 30);
        return nextDate.toISOString();
    }

    if (priority === 'medium') {
        nextDate.setHours(nextDate.getHours() + 4);
        return nextDate.toISOString();
    }

    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate.toISOString();
}

function getHoldingApprovalTimingState(approval: Pick<
    HoldingApprovalRequest,
    'status' | 'priority' | 'created_at' | 'sla_due_at' | 'breached_at' | 'resolved_within_sla'
>) {
    const createdAt = new Date(approval.created_at);
    const slaDueAt = approval.sla_due_at ? new Date(approval.sla_due_at) : new Date(getHoldingSlaDueAt(approval.priority, createdAt));
    const now = new Date();

    if (approval.status !== 'pending') {
        return {
            sla_due_at: slaDueAt.toISOString(),
            aging_bucket: 'resolved' as const,
            breached_at: approval.breached_at,
            escalation_level: approval.breached_at ? 1 : 0,
            resolved_within_sla: approval.resolved_within_sla ?? (slaDueAt.getTime() >= now.getTime()),
        };
    }

    const baseDurationMs = Math.max(slaDueAt.getTime() - createdAt.getTime(), 60_000);
    const doubleDueAt = new Date(slaDueAt.getTime() + baseDurationMs);
    const warningThreshold = new Date(slaDueAt.getTime() - Math.min(baseDurationMs / 2, 15 * 60 * 1000));

    if (now.getTime() >= doubleDueAt.getTime()) {
        return {
            sla_due_at: slaDueAt.toISOString(),
            aging_bucket: 'double_breached' as const,
            breached_at: approval.breached_at || slaDueAt.toISOString(),
            escalation_level: 2,
            resolved_within_sla: null,
        };
    }

    if (now.getTime() > slaDueAt.getTime()) {
        return {
            sla_due_at: slaDueAt.toISOString(),
            aging_bucket: 'breached' as const,
            breached_at: approval.breached_at || slaDueAt.toISOString(),
            escalation_level: 1,
            resolved_within_sla: null,
        };
    }

    return {
        sla_due_at: slaDueAt.toISOString(),
        aging_bucket: now.getTime() >= warningThreshold.getTime() ? 'due_soon' as const : 'within_sla' as const,
        breached_at: null,
        escalation_level: 0,
        resolved_within_sla: null,
    };
}

function computeBusinessRisk(openIncidents: number, criticalIncidents: number, monthlyTrips: number) {
    const incidentRatePenalty = monthlyTrips > 0 ? Math.min(35, Math.round((openIncidents / monthlyTrips) * 100)) : openIncidents * 4;
    const criticalPenalty = criticalIncidents * 12;
    const volumeBonus = monthlyTrips >= 50 ? 6 : monthlyTrips >= 15 ? 3 : 0;
    const score = Math.max(0, Math.min(100, 100 - incidentRatePenalty - criticalPenalty + volumeBonus));

    if (criticalIncidents >= 2 || score < 45) {
        return {
            score,
            level: 'critical' as const,
            financeReadiness: 'blocked' as const,
        };
    }

    if (criticalIncidents >= 1 || score < 65) {
        return {
            score,
            level: 'high' as const,
            financeReadiness: 'watch' as const,
        };
    }

    if (score < 82) {
        return {
            score,
            level: 'medium' as const,
            financeReadiness: 'watch' as const,
        };
    }

    return {
        score,
        level: 'low' as const,
        financeReadiness: 'strong' as const,
    };
}

function toPercent(numerator: number, denominator: number) {
    if (!denominator) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function getEmptyControlTowerSnapshot() {
    return {
        appointmentsToday: 0,
        activeAppointments: 0,
        delayedAppointments: 0,
        otifRate: 0,
        dockOccupancyRate: 0,
        paymentReadyRate: 0,
        paymentPendingAppointments: 0,
        atRiskBusinesses: 0,
        blockedBusinesses: 0,
    };
}

function getEmptyFintechSnapshot() {
    return {
        completedPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        reconciledPaymentsRate: 0,
        custodyCollectedCop: 0,
        custodyPendingCop: 0,
        platformRevenueCop: 0,
        walletAvailableCop: 0,
        walletPendingCop: 0,
        pendingWithdrawalsCop: 0,
        advanceOutstandingCop: 0,
        advanceOverdueCop: 0,
        activeAdvanceCount: 0,
        par7Amount: 0,
        par30Amount: 0,
        npl30Amount: 0,
        par7Rate: 0,
        par30Rate: 0,
        npl30Rate: 0,
        writeOffAmount: 0,
        recoveredPrincipalCop: 0,
    };
}

function getEmptyMarketplaceSnapshot() {
    return {
        publishedOffers: 0,
        assignedOffers: 0,
        inTransitOffers: 0,
        deliveredOffers: 0,
        threePlOffers: 0,
        fillRate: 0,
        clientAccounts: 0,
        activeClientAccounts: 0,
        receiptsProcessed: 0,
        dispatchesProcessed: 0,
        dispatchReadyRate: 0,
        multiClientBusinesses: 0,
    };
}

function getPaymentsReadinessSnapshot(options: { billingInfrastructureReady: boolean }) {
    const missingKeys: string[] = [];
    const warnings: string[] = [];
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
    const notificationRuntime = getNotificationRuntimeSnapshot({ requestUrl: appUrl || undefined });
    const notificationProvider = notificationRuntime.effectiveProvider;
    const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const hasSupabaseAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const hasAccessToken = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
    const hasPublicKey = Boolean(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
    const hasWebhookSecret = Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET);
    const hasInternalApiKey = Boolean(process.env.INTERNAL_API_KEY);
    const hasTwilioCredentials = notificationRuntime.twilioConfigured;
    const manualPinDeliveryEnabled = notificationRuntime.manualPinDeliveryEnabled;
    const productionLikeUrl = Boolean(appUrl) && /^https:\/\//i.test(appUrl) && !/localhost/i.test(appUrl);
    const strictProduction = isStrictProductionEnvironment();

    if (!hasAccessToken) {
        missingKeys.push('MERCADOPAGO_ACCESS_TOKEN');
    }
    if (!hasPublicKey) {
        missingKeys.push('NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY');
    }
    if (!hasSupabaseUrl) {
        missingKeys.push('NEXT_PUBLIC_SUPABASE_URL');
    }
    if (!hasSupabaseAnon) {
        missingKeys.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    if (!hasServiceRole) {
        missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
    }
    if (!hasWebhookSecret) {
        missingKeys.push('MERCADOPAGO_WEBHOOK_SECRET');
    }
    if (!hasInternalApiKey) {
        missingKeys.push('INTERNAL_API_KEY');
    }

    if (!productionLikeUrl) {
        warnings.push('La URL publica aun no apunta a un dominio HTTPS estable.');
    } else if (/staging/i.test(appUrl)) {
        warnings.push('La URL p\u00fablica apunta a un subdominio de staging. Configura el dominio final para producci\u00f3n.');
    }

    if (!options.billingInfrastructureReady) {
        warnings.push('La infraestructura de cobro de planes aun no esta lista en base de datos.');
    }

    if ((notificationRuntime.stagingEnvironment || strictProduction || productionLikeUrl) && notificationProvider === 'twilio') {
        warnings.push('Twilio esta configurado, pero el modo fundador actual usa entrega manual de PIN.');
    }

    if ((strictProduction || productionLikeUrl) && notificationRuntime.requiresRealProvider && notificationProvider === 'console') {
        warnings.push('Las notificaciones de PIN siguen en modo console. Usa NOTIFICATION_PROVIDER=manual para operar sin Twilio.');
    }

    if ((strictProduction || productionLikeUrl) && notificationProvider === 'manual' && !manualPinDeliveryEnabled) {
        missingKeys.push('KARGAX_MANUAL_PIN_DELIVERY_ENABLED');
    }

    if (notificationProvider === 'twilio' && !hasTwilioCredentials) {
        missingKeys.push('TWILIO_*');
    }

    const checkoutReady = hasAccessToken && hasPublicKey && hasSupabaseUrl && hasSupabaseAnon && Boolean(appUrl);
    const webhookCoreReady = hasWebhookSecret && hasServiceRole && productionLikeUrl;
    const notificationsReady = notificationProvider === 'twilio'
        ? hasTwilioCredentials && hasInternalApiKey
        : notificationProvider === 'manual'
            ? manualPinDeliveryEnabled && hasInternalApiKey
            : !notificationRuntime.requiresRealProvider && notificationProvider === 'console';
    const freightWebhookReady = checkoutReady && webhookCoreReady && notificationsReady;
    const billingWebhookReady = checkoutReady && webhookCoreReady && options.billingInfrastructureReady;

    return {
        ready: checkoutReady && freightWebhookReady && billingWebhookReady,
        checkoutReady,
        freightWebhookReady,
        billingWebhookReady,
        notificationsReady,
        productionLikeUrl,
        missingKeys: Array.from(new Set(missingKeys)),
        warnings,
    };
}

export async function getHoldingInfrastructureStatus(supabaseAdmin: AdminClient) {
    const { error } = await supabaseAdmin
        .from('holding_accounts')
        .select('id', { count: 'exact', head: true });

    if (!error) {
        return {
            ready: true,
            message: null,
        };
    }

    if (isHoldingAccountsTableMissing(error)) {
        return {
            ready: false,
            message: getHoldingSetupMessage(),
        };
    }

    throw new Error(error.message || 'Could not verify holding infrastructure.');
}

export async function getHoldingGovernanceInfrastructureStatus(supabaseAdmin: AdminClient) {
    const { error } = await supabaseAdmin
        .from('holding_approval_requests')
        .select('id', { count: 'exact', head: true });

    if (!error) {
        return {
            ready: true,
            message: null,
        };
    }

    if (isHoldingApprovalRequestsTableMissing(error)) {
        return {
            ready: false,
            message: getHoldingGovernanceSetupMessage(),
        };
    }

    throw new Error(error.message || 'Could not verify holding governance infrastructure.');
}

export async function getHoldingFinanceInfrastructureStatus(supabaseAdmin: AdminClient) {
    const { error } = await supabaseAdmin
        .from('holding_finance_policies')
        .select('holding_account_id', { count: 'exact', head: true });

    if (!error) {
        return {
            ready: true,
            message: null,
        };
    }

    if (isHoldingFinancePoliciesTableMissing(error)) {
        return {
            ready: false,
            message: getHoldingFinanceSetupMessage(),
        };
    }

    throw new Error(error.message || 'Could not verify holding finance infrastructure.');
}

async function listAccessibleHoldingAccounts(
    supabaseAdmin: AdminClient,
    authUserId: string,
    profile: AuthProfile | null
) {
    if (profile?.user_type !== 'business' && profile?.user_type !== 'admin') {
        return {
            ready: true,
            message: null,
            accounts: [] as Array<{ id: string; display_name: string; slug: string; role: HoldingRole }>,
        };
    }

    if (profile?.user_type === 'admin') {
        const { data, error } = await supabaseAdmin
            .from('holding_accounts')
            .select('id, display_name, slug')
            .order('created_at', { ascending: true });

        if (error) {
            if (isHoldingAccountsTableMissing(error)) {
                return {
                    ready: false,
                    message: getHoldingSetupMessage(),
                    accounts: [] as Array<{ id: string; display_name: string; slug: string; role: HoldingRole }>,
                };
            }

            throw new Error(error.message || 'Could not list holding accounts.');
        }

        return {
            ready: true,
            message: null,
            accounts: (data || []).map((account) => ({
                id: account.id,
                display_name: account.display_name,
                slug: account.slug,
                role: 'admin' as const,
            })),
        };
    }

    const { data: memberships, error: membershipError } = await supabaseAdmin
        .from('holding_account_members')
        .select('holding_account_id, role')
        .eq('user_id', authUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

    if (membershipError) {
        if (isHoldingAccountMembersTableMissing(membershipError)) {
            return {
                ready: false,
                message: getHoldingSetupMessage(),
                accounts: [] as Array<{ id: string; display_name: string; slug: string; role: HoldingRole }>,
            };
        }

        throw new Error(membershipError.message || 'Could not load holding memberships.');
    }

    const typedMemberships = (memberships || []) as HoldingMembershipRow[];
    const holdingIds = typedMemberships.map((membership) => membership.holding_account_id);

    if (!holdingIds.length) {
        return {
            ready: true,
            message: null,
            accounts: [] as Array<{ id: string; display_name: string; slug: string; role: HoldingRole }>,
        };
    }

    const { data: accounts, error: accountsError } = await supabaseAdmin
        .from('holding_accounts')
        .select('id, display_name, slug')
        .in('id', holdingIds);

    if (accountsError) {
        if (isHoldingAccountsTableMissing(accountsError)) {
            return {
                ready: false,
                message: getHoldingSetupMessage(),
                accounts: [] as Array<{ id: string; display_name: string; slug: string; role: HoldingRole }>,
            };
        }

        throw new Error(accountsError.message || 'Could not load holding accounts.');
    }

    const membershipRoleMap = new Map(typedMemberships.map((membership) => [membership.holding_account_id, membership.role]));

    return {
        ready: true,
        message: null,
        accounts: (accounts || []).map((account) => ({
            id: account.id,
            display_name: account.display_name,
            slug: account.slug,
            role: membershipRoleMap.get(account.id) || 'analyst',
        })),
    };
}

export async function resolveHoldingAccessContext(
    supabaseAdmin: AdminClient,
    authUserId: string,
    profile: AuthProfile | null,
    requestedHoldingId?: string | null
) {
    const infrastructure = await listAccessibleHoldingAccounts(supabaseAdmin, authUserId, profile);
    const selectedAccount =
        (requestedHoldingId
            ? infrastructure.accounts.find((account) => account.id === requestedHoldingId)
            : infrastructure.accounts[0]) || null;

    return {
        ready: infrastructure.ready,
        message: infrastructure.message,
        accounts: infrastructure.accounts,
        hasHoldingAccess: Boolean(selectedAccount),
        holdingAccountId: selectedAccount?.id || null,
        role: selectedAccount?.role || null,
        capabilities: getHoldingCapabilities(selectedAccount?.role || null),
    };
}

async function getHoldingApprovalCounters(
    supabaseAdmin: AdminClient,
    holdingAccountId: string
) {
    const { data, error } = await supabaseAdmin
        .from('holding_approval_requests')
        .select('priority, status, created_at, sla_due_at, breached_at, resolved_within_sla')
        .eq('holding_account_id', holdingAccountId);

    if (error) {
        if (isHoldingApprovalRequestsTableMissing(error)) {
            return {
                pending: 0,
                critical: 0,
                breached: 0,
                doubleBreached: 0,
            };
        }

        throw new Error(error.message || 'Could not load holding approvals.');
    }

    const rows = (data || []) as Array<{
        priority: HoldingApprovalRequest['priority'];
        status: HoldingApprovalRequest['status'];
        created_at: string;
        sla_due_at: string | null;
        breached_at: string | null;
        resolved_within_sla: boolean | null;
    }>;

    return rows.reduce(
        (accumulator, row) => {
            if (row.status === 'pending') {
                accumulator.pending += 1;

                if (row.priority === 'critical') {
                    accumulator.critical += 1;
                }

                const timing = getHoldingApprovalTimingState(row);
                if (timing.aging_bucket === 'breached') {
                    accumulator.breached += 1;
                }

                if (timing.aging_bucket === 'double_breached') {
                    accumulator.doubleBreached += 1;
                }
            }

            return accumulator;
        },
        { pending: 0, critical: 0, breached: 0, doubleBreached: 0 }
    );
}

export async function getHoldingSummary(
    supabaseAdmin: AdminClient,
    holdingAccountId: string,
    role: HoldingRole | null,
    accounts: Array<{ id: string; display_name: string; slug: string; role: HoldingRole }>
): Promise<HoldingSummaryResponse> {
    const now = new Date();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const emptyControlTower = getEmptyControlTowerSnapshot();
    const emptyFintech = getEmptyFintechSnapshot();
    const emptyMarketplace = getEmptyMarketplaceSnapshot();
    const capabilities = getHoldingCapabilities(role);

    const [
        { data: account, error: accountError },
        { data: links, error: linksError },
        { count: activeMembersCount, error: activeMembersError },
        approvalCounters,
        billingInfrastructure,
    ] = await Promise.all([
        supabaseAdmin
            .from('holding_accounts')
            .select('id, legal_name, display_name, slug, country_code, status, created_at, updated_at')
            .eq('id', holdingAccountId)
            .maybeSingle(),
        supabaseAdmin
            .from('holding_business_links')
            .select('business_id, relationship_type')
            .eq('holding_account_id', holdingAccountId)
            .eq('status', 'linked')
            .order('created_at', { ascending: true }),
        supabaseAdmin
            .from('holding_account_members')
            .select('id', { count: 'exact', head: true })
            .eq('holding_account_id', holdingAccountId)
            .eq('status', 'active'),
        getHoldingApprovalCounters(supabaseAdmin, holdingAccountId),
        getBillingCheckoutInfrastructureStatus(supabaseAdmin),
    ]);

    if (accountError) {
        if (isHoldingAccountsTableMissing(accountError)) {
            throw new Error(getHoldingSetupMessage());
        }

        throw new Error(accountError.message || 'Could not load holding account.');
    }

    if (linksError) {
        if (isHoldingBusinessLinksTableMissing(linksError)) {
            throw new Error(getHoldingSetupMessage());
        }

        throw new Error(linksError.message || 'Could not load holding business links.');
    }

    if (activeMembersError) {
        if (isHoldingAccountMembersTableMissing(activeMembersError)) {
            throw new Error(getHoldingSetupMessage());
        }

        throw new Error(activeMembersError.message || 'Could not load holding members.');
    }

    const typedAccount = account as HoldingAccountRow | null;
    const typedLinks = (links || []) as Array<{ business_id: string; relationship_type: 'parent' | 'subsidiary' | 'brand' | 'operator' }>;
    const businessIds = typedLinks.map((link) => link.business_id);
    const paymentsReadiness = getPaymentsReadinessSnapshot({
        billingInfrastructureReady: billingInfrastructure.ready,
    });

    if (!typedAccount) {
        return {
            ready: true,
            message: null,
            hasHoldingAccess: false,
            role,
            capabilities,
            featureEnabled: false,
            account: null,
            stats: {
                totalBusinesses: 0,
                totalWarehouses: 0,
                totalActiveInternalUsers: 0,
                totalMonthlyTrips: 0,
                openIncidents: 0,
                criticalIncidents: 0,
                activeHoldingMembers: activeMembersCount || 0,
            },
            accounts,
            businesses: [],
            controlTower: emptyControlTower,
            fintech: emptyFintech,
            marketplace: emptyMarketplace,
            paymentsReadiness,
            alerts: [],
            recommendedPlanCode: 'enterprise',
            approvals: approvalCounters,
        };
    }

    if (!businessIds.length) {
        return {
            ready: true,
            message: null,
            hasHoldingAccess: true,
            role,
            capabilities,
            featureEnabled: false,
            account: typedAccount,
            stats: {
                totalBusinesses: 0,
                totalWarehouses: 0,
                totalActiveInternalUsers: 0,
                totalMonthlyTrips: 0,
                openIncidents: 0,
                criticalIncidents: 0,
                activeHoldingMembers: activeMembersCount || 0,
            },
            accounts,
            businesses: [],
            controlTower: emptyControlTower,
            fintech: emptyFintech,
            marketplace: emptyMarketplace,
            paymentsReadiness,
            alerts: [],
            recommendedPlanCode: 'enterprise',
            approvals: approvalCounters,
        };
    }

    const [
        profilesResponse,
        subscriptionsResponse,
        plansResponse,
        warehousesResponse,
        teamMembersResponse,
        offersResponse,
    ] = await Promise.all([
        supabaseAdmin
            .from('business_profiles')
            .select('user_id, company_name, city, department')
            .in('user_id', businessIds),
        supabaseAdmin
            .from('business_plan_subscriptions')
            .select('business_id, plan_code, status, current_period_end')
            .in('business_id', businessIds),
        supabaseAdmin
            .from('billing_plans')
            .select('code, name, price_monthly_cop, price_monthly_usd, feature_matrix'),
        supabaseAdmin
            .from('warehouses')
            .select('id, business_id, name, status')
            .in('business_id', businessIds),
        supabaseAdmin
            .from('business_team_members')
            .select('id, business_id, status')
            .in('business_id', businessIds)
            .eq('status', 'active'),
        supabaseAdmin
            .from('cargo_offers')
            .select('id, business_id, status, warehouse_flow_mode, created_at')
            .in('business_id', businessIds)
            .gte('created_at', monthStart.toISOString()),
    ]);

    if (profilesResponse.error) {
        throw new Error(profilesResponse.error.message || 'Could not load business profiles.');
    }

    if (subscriptionsResponse.error) {
        throw new Error(subscriptionsResponse.error.message || 'Could not load business subscriptions.');
    }

    if (plansResponse.error) {
        throw new Error(plansResponse.error.message || 'Could not load billing plan catalog.');
    }

    if (warehousesResponse.error) {
        throw new Error(warehousesResponse.error.message || 'Could not load holding warehouses.');
    }

    let teamMemberRows = (teamMembersResponse.data || []) as Array<{ id: string; business_id: string; status: string }>;
    if (teamMembersResponse.error) {
        if (!isBusinessTeamMembersTableMissing(teamMembersResponse.error)) {
            throw new Error(teamMembersResponse.error.message || 'Could not load holding team members.');
        }
        teamMemberRows = [];
    }

    if (offersResponse.error) {
        throw new Error(offersResponse.error.message || 'Could not load monthly trip volume.');
    }

    const warehouseRows = (warehousesResponse.data || []) as Array<{ id: string; business_id: string; name: string; status: string }>;
    const warehouseIds = warehouseRows.map((warehouse) => warehouse.id);

    let incidentRows: Array<{
        id: string;
        warehouse_id: string;
        appointment_id: string | null;
        incident_type: string;
        status: string;
        severity: string;
        title: string;
        created_at: string;
    }> = [];
    let appointmentRows: Array<{
        id: string;
        warehouse_id: string;
        appointment_type: 'pickup' | 'delivery' | 'receipt' | 'dispatch';
        status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';
        scheduled_start: string;
        scheduled_end: string;
        actual_end_at: string | null;
        payment_status: 'pending' | 'reserved' | 'completed' | 'n_a';
        created_at: string;
    }> = [];
    let dockRows: Array<{
        id: string;
        warehouse_id: string;
        status: 'available' | 'occupied' | 'maintenance';
    }> = [];

    if (warehouseIds.length) {
        const [
            { data: incidents, error: incidentsError },
            { data: appointments, error: appointmentsError },
            { data: docks, error: docksError },
        ] = await Promise.all([
            supabaseAdmin
                .from('warehouse_incidents')
                .select('id, warehouse_id, appointment_id, incident_type, status, severity, title, created_at')
                .in('warehouse_id', warehouseIds),
            supabaseAdmin
                .from('warehouse_appointments')
                .select('id, warehouse_id, appointment_type, status, scheduled_start, scheduled_end, actual_end_at, payment_status, created_at')
                .in('warehouse_id', warehouseIds)
                .gte('created_at', monthStart.toISOString()),
            supabaseAdmin
                .from('warehouse_docks')
                .select('id, warehouse_id, status')
                .in('warehouse_id', warehouseIds),
        ]);

        if (incidentsError) {
            throw new Error(incidentsError.message || 'Could not load holding incidents.');
        }

        if (appointmentsError) {
            throw new Error(appointmentsError.message || 'Could not load holding appointments.');
        }

        if (docksError) {
            throw new Error(docksError.message || 'Could not load holding docks.');
        }

        incidentRows = (incidents || []) as typeof incidentRows;
        appointmentRows = (appointments || []) as typeof appointmentRows;
        dockRows = (docks || []) as typeof dockRows;
    }

    const monthlyOfferRows = (offersResponse.data || []) as Array<{
        id: string;
        business_id: string;
        status: 'active' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
        warehouse_flow_mode: 'manual' | 'warehouse_managed' | '3pl' | null;
        created_at: string;
    }>;
    const monthlyOfferIds = monthlyOfferRows.map((offer) => offer.id);

    const [
        paymentsResponse,
        walletsResponse,
        advancesResponse,
        warehouseClientsResponse,
        warehouseReceiptsResponse,
        warehouseDispatchOrdersResponse,
    ] = await Promise.all([
        monthlyOfferIds.length
            ? supabaseAdmin
                .from('payments')
                .select('id, offer_id, status, subtotal, platform_fee, total_amount, completed_at, created_at')
                .in('offer_id', monthlyOfferIds)
            : Promise.resolve({ data: [], error: null }),
        businessIds.length
            ? supabaseAdmin
                .from('wallets')
                .select('id, user_id, available_balance, pending_balance')
                .in('user_id', businessIds)
            : Promise.resolve({ data: [], error: null }),
        businessIds.length
            ? supabaseAdmin
                .from('fuel_advances')
                .select(`
                    id,
                    status,
                    due_at,
                    principal_outstanding,
                    interest_outstanding,
                    total_due_at_maturity,
                    origin_offer:origin_offer_id (
                        id,
                        business_id
                    )
                `)
            : Promise.resolve({ data: [], error: null }),
        businessIds.length
            ? supabaseAdmin
                .from('warehouse_clients')
                .select('id, business_id, created_at')
                .in('business_id', businessIds)
            : Promise.resolve({ data: [], error: null }),
        warehouseIds.length
            ? supabaseAdmin
                .from('warehouse_receipts')
                .select('id, warehouse_id, client_id, status, created_at')
                .in('warehouse_id', warehouseIds)
                .gte('created_at', monthStart.toISOString())
            : Promise.resolve({ data: [], error: null }),
        warehouseIds.length
            ? supabaseAdmin
                .from('warehouse_dispatch_orders')
                .select('id, warehouse_id, client_id, status, created_at')
                .in('warehouse_id', warehouseIds)
                .gte('created_at', monthStart.toISOString())
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (paymentsResponse.error) {
        throw new Error(paymentsResponse.error.message || 'Could not load holding payments.');
    }

    if (walletsResponse.error) {
        throw new Error(walletsResponse.error.message || 'Could not load holding wallets.');
    }

    if (advancesResponse.error) {
        throw new Error(advancesResponse.error.message || 'Could not load holding fuel advances.');
    }

    if (warehouseClientsResponse.error) {
        throw new Error(warehouseClientsResponse.error.message || 'Could not load warehouse clients.');
    }

    if (warehouseReceiptsResponse.error) {
        throw new Error(warehouseReceiptsResponse.error.message || 'Could not load warehouse receipts.');
    }

    if (warehouseDispatchOrdersResponse.error) {
        throw new Error(warehouseDispatchOrdersResponse.error.message || 'Could not load warehouse dispatch orders.');
    }

    const walletRows = (walletsResponse.data || []) as Array<{
        id: string;
        user_id: string;
        available_balance: number;
        pending_balance: number;
    }>;
    const walletIds = walletRows.map((wallet) => wallet.id);
    const { data: walletTransactions, error: walletTransactionsError } = walletIds.length
        ? await supabaseAdmin
            .from('transactions')
            .select('wallet_id, type, status, amount')
            .in('wallet_id', walletIds)
            .eq('type', 'withdrawal')
            .eq('status', 'pending')
        : { data: [], error: null };

    if (walletTransactionsError) {
        throw new Error(walletTransactionsError.message || 'Could not load wallet transactions.');
    }

    const profileMap = new Map(((profilesResponse.data || []) as Array<{ user_id: string; company_name: string; city: string | null; department: string | null }>).map((profile) => [profile.user_id, profile]));
    const subscriptionMap = new Map(((subscriptionsResponse.data || []) as Array<{ business_id: string; plan_code: string; status: 'active' | 'trialing' | 'paused' | 'cancelled'; current_period_end: string | null }>).map((subscription) => [subscription.business_id, subscription]));
    const planMap = new Map(((plansResponse.data || []) as Array<{ code: string; name: string; price_monthly_cop?: number | null; price_monthly_usd: number; feature_matrix: Record<string, unknown> | null }>).map((plan) => [plan.code, plan]));
    const warehouseCountMap = new Map<string, number>();
    const teamCountMap = new Map<string, number>();
    const tripCountMap = new Map<string, number>();
    const incidentCountMap = new Map<string, { open: number; critical: number }>();
    const warehouseBusinessMap = new Map(warehouseRows.map((warehouse) => [warehouse.id, warehouse.business_id]));
    const warehouseNameMap = new Map(warehouseRows.map((warehouse) => [warehouse.id, warehouse.name]));
    const offerBusinessMap = new Map(monthlyOfferRows.map((offer) => [offer.id, offer.business_id]));
    const paymentMetricsMap = new Map<string, {
        completedPayments: number;
        pendingPayments: number;
        failedPayments: number;
        custodyCollectedCop: number;
        custodyPendingCop: number;
        platformRevenueCop: number;
    }>();
    const walletMetricsMap = new Map<string, {
        walletAvailableCop: number;
        walletPendingCop: number;
        pendingWithdrawalsCop: number;
    }>();
    const advanceMetricsMap = new Map<string, {
        advanceOutstandingCop: number;
        advanceOverdueCop: number;
        activeAdvanceCount: number;
        par7AmountCop: number;
        par30AmountCop: number;
        npl30AmountCop: number;
        writeOffAmountCop: number;
    }>();
    const marketplaceMetricsMap = new Map<string, {
        publishedOffers: number;
        assignedOffers: number;
        inTransitOffers: number;
        deliveredOffers: number;
        threePlOffers: number;
        clientAccounts: number;
        activeClientIds: Set<string>;
        receiptsProcessed: number;
        dispatchesProcessed: number;
        dispatchTracked: number;
        dispatchReady: number;
        dispatchBacklog: number;
    }>();
    const businessControlTowerMap = new Map<string, {
        appointmentsToday: number;
        activeAppointments: number;
        delayedAppointments: number;
        completedAppointments: number;
        onTimeAppointments: number;
        appointmentsWithIncident: number;
        paymentTrackedAppointments: number;
        paymentReadyAppointments: number;
        paymentPendingAppointments: number;
        totalDocks: number;
        occupiedDocks: number;
    }>();
    const alertRows: Array<{
        id: string;
        type: 'incident' | 'delay' | 'payment' | 'marketplace' | '3pl';
        severity: 'low' | 'medium' | 'high' | 'critical';
        business_id: string;
        warehouse_id: string | null;
        title: string;
        detail: string;
        created_at: string | null;
    }> = [];

    for (const warehouse of warehouseRows) {
        warehouseCountMap.set(warehouse.business_id, (warehouseCountMap.get(warehouse.business_id) || 0) + 1);
    }

    for (const member of teamMemberRows) {
        teamCountMap.set(member.business_id, (teamCountMap.get(member.business_id) || 0) + 1);
    }

    for (const offer of (offersResponse.data || []) as Array<{ business_id: string }>) {
        tripCountMap.set(offer.business_id, (tripCountMap.get(offer.business_id) || 0) + 1);
    }

    for (const offer of monthlyOfferRows) {
        const current = marketplaceMetricsMap.get(offer.business_id) || {
            publishedOffers: 0,
            assignedOffers: 0,
            inTransitOffers: 0,
            deliveredOffers: 0,
            threePlOffers: 0,
            clientAccounts: 0,
            activeClientIds: new Set<string>(),
            receiptsProcessed: 0,
            dispatchesProcessed: 0,
            dispatchTracked: 0,
            dispatchReady: 0,
            dispatchBacklog: 0,
        };

        current.publishedOffers += 1;

        if (['assigned', 'in_transit', 'delivered'].includes(offer.status)) {
            current.assignedOffers += 1;
        }

        if (offer.status === 'in_transit') {
            current.inTransitOffers += 1;
        }

        if (offer.status === 'delivered') {
            current.deliveredOffers += 1;
        }

        if (offer.warehouse_flow_mode === '3pl') {
            current.threePlOffers += 1;
        }

        marketplaceMetricsMap.set(offer.business_id, current);
    }

    for (const client of (warehouseClientsResponse.data || []) as Array<{
        id: string;
        business_id: string;
        created_at: string;
    }>) {
        const current = marketplaceMetricsMap.get(client.business_id) || {
            publishedOffers: 0,
            assignedOffers: 0,
            inTransitOffers: 0,
            deliveredOffers: 0,
            threePlOffers: 0,
            clientAccounts: 0,
            activeClientIds: new Set<string>(),
            receiptsProcessed: 0,
            dispatchesProcessed: 0,
            dispatchTracked: 0,
            dispatchReady: 0,
            dispatchBacklog: 0,
        };

        current.clientAccounts += 1;
        marketplaceMetricsMap.set(client.business_id, current);
    }

    for (const receipt of (warehouseReceiptsResponse.data || []) as Array<{
        id: string;
        warehouse_id: string;
        client_id: string | null;
        status: 'draft' | 'received' | 'closed' | 'cancelled';
        created_at: string;
    }>) {
        const businessId = warehouseBusinessMap.get(receipt.warehouse_id);

        if (!businessId) {
            continue;
        }

        const current = marketplaceMetricsMap.get(businessId) || {
            publishedOffers: 0,
            assignedOffers: 0,
            inTransitOffers: 0,
            deliveredOffers: 0,
            threePlOffers: 0,
            clientAccounts: 0,
            activeClientIds: new Set<string>(),
            receiptsProcessed: 0,
            dispatchesProcessed: 0,
            dispatchTracked: 0,
            dispatchReady: 0,
            dispatchBacklog: 0,
        };

        if (receipt.client_id && receipt.status !== 'cancelled') {
            current.activeClientIds.add(receipt.client_id);
        }

        if (['received', 'closed'].includes(receipt.status)) {
            current.receiptsProcessed += 1;
        }

        marketplaceMetricsMap.set(businessId, current);
    }

    for (const dispatchOrder of (warehouseDispatchOrdersResponse.data || []) as Array<{
        id: string;
        warehouse_id: string;
        client_id: string | null;
        status: 'draft' | 'picking' | 'ready' | 'dispatched' | 'cancelled';
        created_at: string;
    }>) {
        const businessId = warehouseBusinessMap.get(dispatchOrder.warehouse_id);

        if (!businessId) {
            continue;
        }

        const current = marketplaceMetricsMap.get(businessId) || {
            publishedOffers: 0,
            assignedOffers: 0,
            inTransitOffers: 0,
            deliveredOffers: 0,
            threePlOffers: 0,
            clientAccounts: 0,
            activeClientIds: new Set<string>(),
            receiptsProcessed: 0,
            dispatchesProcessed: 0,
            dispatchTracked: 0,
            dispatchReady: 0,
            dispatchBacklog: 0,
        };

        if (dispatchOrder.client_id && dispatchOrder.status !== 'cancelled') {
            current.activeClientIds.add(dispatchOrder.client_id);
        }

        if (dispatchOrder.status !== 'cancelled') {
            current.dispatchTracked += 1;
        }

        if (['ready', 'dispatched'].includes(dispatchOrder.status)) {
            current.dispatchReady += 1;
            current.dispatchesProcessed += 1;
        }

        if (['draft', 'picking'].includes(dispatchOrder.status)) {
            current.dispatchBacklog += 1;
        }

        marketplaceMetricsMap.set(businessId, current);
    }

    for (const payment of (paymentsResponse.data || []) as Array<{
        id: string;
        offer_id: string;
        status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'expired';
        subtotal: number;
        platform_fee: number;
        total_amount: number;
        completed_at: string | null;
        created_at: string;
    }>) {
        const businessId = offerBusinessMap.get(payment.offer_id);

        if (!businessId) {
            continue;
        }

        const current = paymentMetricsMap.get(businessId) || {
            completedPayments: 0,
            pendingPayments: 0,
            failedPayments: 0,
            custodyCollectedCop: 0,
            custodyPendingCop: 0,
            platformRevenueCop: 0,
        };

        if (payment.status === 'completed') {
            current.completedPayments += 1;
            current.custodyCollectedCop += Number(payment.total_amount || 0);
            current.platformRevenueCop += Number(payment.platform_fee || 0);
        } else if (['pending', 'processing'].includes(payment.status)) {
            current.pendingPayments += 1;
            current.custodyPendingCop += Number(payment.total_amount || 0);
        } else if (['failed', 'expired', 'refunded'].includes(payment.status)) {
            current.failedPayments += 1;
        }

        paymentMetricsMap.set(businessId, current);
    }

    const pendingWithdrawalMap = new Map<string, number>();
    for (const transaction of (walletTransactions || []) as Array<{
        wallet_id: string;
        amount: number;
    }>) {
        pendingWithdrawalMap.set(
            transaction.wallet_id,
            (pendingWithdrawalMap.get(transaction.wallet_id) || 0) + Number(transaction.amount || 0)
        );
    }

    for (const wallet of walletRows) {
        walletMetricsMap.set(wallet.user_id, {
            walletAvailableCop: Number(wallet.available_balance || 0),
            walletPendingCop: Number(wallet.pending_balance || 0),
            pendingWithdrawalsCop: pendingWithdrawalMap.get(wallet.id) || 0,
        });
    }

    for (const advance of (advancesResponse.data || []) as Array<Record<string, unknown>>) {
        const originOffer = Array.isArray(advance.origin_offer)
            ? advance.origin_offer[0] as { id: string; business_id: string } | undefined
            : advance.origin_offer as { id: string; business_id: string } | undefined;
        const businessId = originOffer?.business_id;

        if (!businessId) {
            continue;
        }

        const current = advanceMetricsMap.get(businessId) || {
            advanceOutstandingCop: 0,
            advanceOverdueCop: 0,
            activeAdvanceCount: 0,
            par7AmountCop: 0,
            par30AmountCop: 0,
            npl30AmountCop: 0,
            writeOffAmountCop: 0,
        };
        const advanceStatus = String(advance.status || '');
        const outstandingAmount = Number(advance.principal_outstanding || 0) + Number(advance.interest_outstanding || 0);
        const dueAt = typeof advance.due_at === 'string' ? new Date(advance.due_at) : null;
        const overdueDays = dueAt && !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < now.getTime()
            ? Math.max(1, Math.floor((now.getTime() - dueAt.getTime()) / 86_400_000))
            : 0;

        if (['disbursed', 'overdue', 'at_risk', 'restructured'].includes(advanceStatus)) {
            current.advanceOutstandingCop += outstandingAmount;
            current.activeAdvanceCount += 1;
        }

        if (overdueDays >= 7 && ['disbursed', 'overdue', 'at_risk', 'restructured'].includes(advanceStatus)) {
            current.par7AmountCop += outstandingAmount;
        }

        if (overdueDays >= 30 && ['disbursed', 'overdue', 'at_risk', 'restructured'].includes(advanceStatus)) {
            current.par30AmountCop += outstandingAmount;
            current.npl30AmountCop += outstandingAmount;
        }

        if (['overdue', 'at_risk'].includes(advanceStatus)) {
            current.advanceOverdueCop += outstandingAmount;
            alertRows.push({
                id: `advance-${String(advance.id)}`,
                type: 'payment',
                severity: advanceStatus === 'at_risk' ? 'critical' : 'high',
                business_id: businessId,
                warehouse_id: null,
                title: `Adelanto ${advanceStatus === 'at_risk' ? 'en riesgo' : 'vencido'}`,
                detail: `Exposicion ${outstandingAmount}`,
                created_at: typeof advance.due_at === 'string' ? advance.due_at : null,
            });
        }

        if (advanceStatus === 'written_off') {
            current.writeOffAmountCop += Math.max(
                outstandingAmount,
                Number(advance.total_due_at_maturity || 0)
            );
        }

        advanceMetricsMap.set(businessId, current);
    }

    for (const incident of incidentRows) {
        const businessId = warehouseBusinessMap.get(incident.warehouse_id);

        if (!businessId || ['resolved', 'closed'].includes(incident.status)) {
            continue;
        }

        const current = incidentCountMap.get(businessId) || { open: 0, critical: 0 };
        current.open += 1;

        if (['high', 'critical'].includes(incident.severity)) {
            current.critical += 1;
        }

        incidentCountMap.set(businessId, current);

        alertRows.push({
            id: incident.id,
            type: incident.incident_type === 'payment_hold' ? 'payment' : 'incident',
            severity: ['high', 'critical'].includes(incident.severity)
                ? incident.severity as 'high' | 'critical'
                : incident.severity === 'medium'
                    ? 'medium'
                    : 'low',
            business_id: businessId,
            warehouse_id: incident.warehouse_id,
            title: incident.title,
            detail: `${incident.incident_type} | ${incident.status}`,
            created_at: incident.created_at,
        });
    }

    const incidentAppointmentIds = new Set(
        incidentRows
            .filter((incident) => incident.appointment_id)
            .map((incident) => incident.appointment_id as string)
    );

    for (const dock of dockRows) {
        const businessId = warehouseBusinessMap.get(dock.warehouse_id);

        if (!businessId) {
            continue;
        }

        const current = businessControlTowerMap.get(businessId) || {
            appointmentsToday: 0,
            activeAppointments: 0,
            delayedAppointments: 0,
            completedAppointments: 0,
            onTimeAppointments: 0,
            appointmentsWithIncident: 0,
            paymentTrackedAppointments: 0,
            paymentReadyAppointments: 0,
            paymentPendingAppointments: 0,
            totalDocks: 0,
            occupiedDocks: 0,
        };

        current.totalDocks += 1;
        if (dock.status === 'occupied') {
            current.occupiedDocks += 1;
        }

        businessControlTowerMap.set(businessId, current);
    }

    for (const appointment of appointmentRows) {
        const businessId = warehouseBusinessMap.get(appointment.warehouse_id);

        if (!businessId) {
            continue;
        }

        const current = businessControlTowerMap.get(businessId) || {
            appointmentsToday: 0,
            activeAppointments: 0,
            delayedAppointments: 0,
            completedAppointments: 0,
            onTimeAppointments: 0,
            appointmentsWithIncident: 0,
            paymentTrackedAppointments: 0,
            paymentReadyAppointments: 0,
            paymentPendingAppointments: 0,
            totalDocks: 0,
            occupiedDocks: 0,
        };

        const scheduledStart = new Date(appointment.scheduled_start);
        const scheduledEnd = new Date(appointment.scheduled_end);
        const actualEnd = appointment.actual_end_at ? new Date(appointment.actual_end_at) : null;
        const isToday = scheduledStart >= dayStart && scheduledStart < dayEnd;
        const isDelayed = scheduledEnd < now && !['completed', 'cancelled'].includes(appointment.status);
        const hasIncident = incidentAppointmentIds.has(appointment.id);

        if (isToday) {
            current.appointmentsToday += 1;
        }

        if (['checked_in', 'in_progress'].includes(appointment.status)) {
            current.activeAppointments += 1;
        }

        if (isDelayed) {
            current.delayedAppointments += 1;
            alertRows.push({
                id: `delay-${appointment.id}`,
                type: 'delay',
                severity: 'high',
                business_id: businessId,
                warehouse_id: appointment.warehouse_id,
                title: `Cita retrasada ${appointment.appointment_type}`,
                detail: `Vencio ${appointment.scheduled_end}`,
                created_at: appointment.scheduled_end,
            });
        }

        if (appointment.status === 'completed') {
            current.completedAppointments += 1;

            if (actualEnd && actualEnd.getTime() <= scheduledEnd.getTime() && !hasIncident) {
                current.onTimeAppointments += 1;
            }
        }

        if (hasIncident) {
            current.appointmentsWithIncident += 1;
        }

        if (appointment.payment_status !== 'n_a') {
            current.paymentTrackedAppointments += 1;

            if (['reserved', 'completed'].includes(appointment.payment_status)) {
                current.paymentReadyAppointments += 1;
            }

            if (appointment.payment_status === 'pending') {
                current.paymentPendingAppointments += 1;
                alertRows.push({
                    id: `payment-${appointment.id}`,
                    type: 'payment',
                    severity: 'medium',
                    business_id: businessId,
                    warehouse_id: appointment.warehouse_id,
                    title: `Pago pendiente en cita ${appointment.appointment_type}`,
                    detail: `Estado ${appointment.payment_status}`,
                    created_at: appointment.created_at,
                });
            }
        }

        businessControlTowerMap.set(businessId, current);
    }

    const businesses = typedLinks.map((link) => {
        const profile = profileMap.get(link.business_id);
        const subscription = subscriptionMap.get(link.business_id);
        const plan = planMap.get(subscription?.plan_code || 'free') || planMap.get('free');
        const incidents = incidentCountMap.get(link.business_id) || { open: 0, critical: 0 };
        const paymentMetrics = paymentMetricsMap.get(link.business_id) || {
            completedPayments: 0,
            pendingPayments: 0,
            failedPayments: 0,
            custodyCollectedCop: 0,
            custodyPendingCop: 0,
            platformRevenueCop: 0,
        };
        const walletMetrics = walletMetricsMap.get(link.business_id) || {
            walletAvailableCop: 0,
            walletPendingCop: 0,
            pendingWithdrawalsCop: 0,
        };
        const advanceMetrics = advanceMetricsMap.get(link.business_id) || {
            advanceOutstandingCop: 0,
            advanceOverdueCop: 0,
            activeAdvanceCount: 0,
            par7AmountCop: 0,
            par30AmountCop: 0,
            npl30AmountCop: 0,
            writeOffAmountCop: 0,
        };
        const marketplaceMetrics = marketplaceMetricsMap.get(link.business_id) || {
            publishedOffers: 0,
            assignedOffers: 0,
            inTransitOffers: 0,
            deliveredOffers: 0,
            threePlOffers: 0,
            clientAccounts: 0,
            activeClientIds: new Set<string>(),
            receiptsProcessed: 0,
            dispatchesProcessed: 0,
            dispatchTracked: 0,
            dispatchReady: 0,
            dispatchBacklog: 0,
        };
        const controlTower = businessControlTowerMap.get(link.business_id) || {
            appointmentsToday: 0,
            activeAppointments: 0,
            delayedAppointments: 0,
            completedAppointments: 0,
            onTimeAppointments: 0,
            appointmentsWithIncident: 0,
            paymentTrackedAppointments: 0,
            paymentReadyAppointments: 0,
            paymentPendingAppointments: 0,
            totalDocks: 0,
            occupiedDocks: 0,
        };
        const featureEnabled = Boolean(plan?.feature_matrix && (plan.feature_matrix as Record<string, unknown>).holding_multiempresa);

        const risk = computeBusinessRisk(
            incidents.open,
            incidents.critical,
            tripCountMap.get(link.business_id) || 0
        );

        const activeClientAccounts = marketplaceMetrics.activeClientIds.size;
        const marketplaceFillRate = toPercent(
            marketplaceMetrics.assignedOffers,
            marketplaceMetrics.publishedOffers
        );
        const dispatchReadyRate = toPercent(
            marketplaceMetrics.dispatchReady,
            marketplaceMetrics.dispatchTracked
        );

        if (marketplaceMetrics.dispatchBacklog >= 3) {
            alertRows.push({
                id: `dispatch-backlog-${link.business_id}`,
                type: '3pl',
                severity: marketplaceMetrics.dispatchBacklog >= 8 ? 'high' : 'medium',
                business_id: link.business_id,
                warehouse_id: null,
                title: 'Backlog de despacho 3PL',
                detail: `${marketplaceMetrics.dispatchBacklog} ordenes siguen en draft o picking.`,
                created_at: new Date().toISOString(),
            });
        }

        if (marketplaceMetrics.publishedOffers >= 5 && marketplaceFillRate < 50) {
            alertRows.push({
                id: `marketplace-fill-${link.business_id}`,
                type: 'marketplace',
                severity: marketplaceFillRate < 30 ? 'high' : 'medium',
                business_id: link.business_id,
                warehouse_id: null,
                title: 'Oferta comercial con baja colocacion',
                detail: `Fill rate ${marketplaceFillRate}% en ${marketplaceMetrics.publishedOffers} ofertas del mes.`,
                created_at: new Date().toISOString(),
            });
        }

        return {
            business_id: link.business_id,
            company_name: profile?.company_name || `Empresa ${link.business_id.slice(0, 8)}`,
            city: profile?.city || null,
            department: profile?.department || null,
            relationship_type: link.relationship_type,
            plan_code: subscription?.plan_code || 'free',
            plan_name: plan?.name || 'Free',
            feature_enabled: featureEnabled,
            warehouses: warehouseCountMap.get(link.business_id) || 0,
            active_internal_users: teamCountMap.get(link.business_id) || 0,
            monthly_trips: tripCountMap.get(link.business_id) || 0,
            open_incidents: incidents.open,
            critical_incidents: incidents.critical,
            subscription_status: subscription?.status || 'active',
            current_period_end: subscription?.current_period_end || null,
            risk_score: risk.score,
            risk_level: risk.level,
            finance_readiness: risk.financeReadiness,
            appointments_today: controlTower.appointmentsToday,
            active_appointments: controlTower.activeAppointments,
            delayed_appointments: controlTower.delayedAppointments,
            otif_rate: toPercent(controlTower.onTimeAppointments, controlTower.completedAppointments),
            dock_occupancy_rate: toPercent(controlTower.occupiedDocks, controlTower.totalDocks),
            payment_ready_rate: toPercent(controlTower.paymentReadyAppointments, controlTower.paymentTrackedAppointments),
            payment_pending_appointments: controlTower.paymentPendingAppointments,
            custody_collected_cop: paymentMetrics.custodyCollectedCop,
            custody_pending_cop: paymentMetrics.custodyPendingCop,
            platform_revenue_cop: paymentMetrics.platformRevenueCop,
            wallet_available_cop: walletMetrics.walletAvailableCop,
            wallet_pending_cop: walletMetrics.walletPendingCop,
            pending_withdrawals_cop: walletMetrics.pendingWithdrawalsCop,
            advance_outstanding_cop: advanceMetrics.advanceOutstandingCop,
            advance_overdue_cop: advanceMetrics.advanceOverdueCop,
            active_advance_count: advanceMetrics.activeAdvanceCount,
            par7_amount_cop: advanceMetrics.par7AmountCop,
            par30_amount_cop: advanceMetrics.par30AmountCop,
            npl30_amount_cop: advanceMetrics.npl30AmountCop,
            par7_rate: toPercent(advanceMetrics.par7AmountCop, advanceMetrics.advanceOutstandingCop),
            par30_rate: toPercent(advanceMetrics.par30AmountCop, advanceMetrics.advanceOutstandingCop),
            npl30_rate: toPercent(advanceMetrics.npl30AmountCop, advanceMetrics.advanceOutstandingCop),
            marketplace_published_offers: marketplaceMetrics.publishedOffers,
            marketplace_assigned_offers: marketplaceMetrics.assignedOffers,
            marketplace_delivered_offers: marketplaceMetrics.deliveredOffers,
            marketplace_fill_rate: marketplaceFillRate,
            three_pl_offers: marketplaceMetrics.threePlOffers,
            three_pl_clients: marketplaceMetrics.clientAccounts,
            active_client_accounts: activeClientAccounts,
            receipts_processed: marketplaceMetrics.receiptsProcessed,
            dispatches_processed: marketplaceMetrics.dispatchesProcessed,
            dispatch_ready_rate: dispatchReadyRate,
        };
    });

    const featureEnabled = businesses.some((business) => business.feature_enabled);
    const rankedAlerts = alertRows
        .map((alert) => ({
            ...alert,
            business_name: profileMap.get(alert.business_id)?.company_name || `Empresa ${alert.business_id.slice(0, 8)}`,
            warehouse_name: alert.warehouse_id ? warehouseNameMap.get(alert.warehouse_id) || null : null,
        }))
        .sort((left, right) => {
            const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
            const severityDelta = severityWeight[right.severity] - severityWeight[left.severity];

            if (severityDelta !== 0) {
                return severityDelta;
            }

            return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
        })
        .slice(0, 6);

    const paymentMetricRows = Array.from(paymentMetricsMap.values());
    const controlTowerRows = Array.from(businessControlTowerMap.values());
    const controlTower = {
        appointmentsToday: controlTowerRows.reduce((sum, row) => sum + row.appointmentsToday, 0),
        activeAppointments: controlTowerRows.reduce((sum, row) => sum + row.activeAppointments, 0),
        delayedAppointments: controlTowerRows.reduce((sum, row) => sum + row.delayedAppointments, 0),
        otifRate: toPercent(
            controlTowerRows.reduce((sum, row) => sum + row.onTimeAppointments, 0),
            controlTowerRows.reduce((sum, row) => sum + row.completedAppointments, 0)
        ),
        dockOccupancyRate: toPercent(
            controlTowerRows.reduce((sum, row) => sum + row.occupiedDocks, 0),
            controlTowerRows.reduce((sum, row) => sum + row.totalDocks, 0)
        ),
        paymentReadyRate: toPercent(
            controlTowerRows.reduce((sum, row) => sum + row.paymentReadyAppointments, 0),
            controlTowerRows.reduce((sum, row) => sum + row.paymentTrackedAppointments, 0)
        ),
        paymentPendingAppointments: controlTowerRows.reduce((sum, row) => sum + row.paymentPendingAppointments, 0),
        atRiskBusinesses: businesses.filter((business) => ['high', 'critical'].includes(business.risk_level)).length,
        blockedBusinesses: businesses.filter((business) => business.finance_readiness === 'blocked').length,
    };
    const fintech = {
        completedPayments: paymentMetricRows.reduce((sum, business) => sum + business.completedPayments, 0),
        pendingPayments: paymentMetricRows.reduce((sum, business) => sum + business.pendingPayments, 0),
        failedPayments: paymentMetricRows.reduce((sum, business) => sum + business.failedPayments, 0),
        reconciledPaymentsRate: toPercent(
            paymentMetricRows.reduce((sum, business) => sum + business.completedPayments, 0),
            paymentMetricRows.reduce(
                (sum, business) => sum + business.completedPayments + business.pendingPayments + business.failedPayments,
                0
            )
        ),
        custodyCollectedCop: businesses.reduce((sum, business) => sum + business.custody_collected_cop, 0),
        custodyPendingCop: businesses.reduce((sum, business) => sum + business.custody_pending_cop, 0),
        platformRevenueCop: businesses.reduce((sum, business) => sum + business.platform_revenue_cop, 0),
        walletAvailableCop: businesses.reduce((sum, business) => sum + business.wallet_available_cop, 0),
        walletPendingCop: businesses.reduce((sum, business) => sum + business.wallet_pending_cop, 0),
        pendingWithdrawalsCop: businesses.reduce((sum, business) => sum + business.pending_withdrawals_cop, 0),
        advanceOutstandingCop: businesses.reduce((sum, business) => sum + business.advance_outstanding_cop, 0),
        advanceOverdueCop: businesses.reduce((sum, business) => sum + business.advance_overdue_cop, 0),
        activeAdvanceCount: businesses.reduce((sum, business) => sum + business.active_advance_count, 0),
        par7Amount: businesses.reduce((sum, business) => sum + Number(business.par7_amount_cop || 0), 0),
        par30Amount: businesses.reduce((sum, business) => sum + Number(business.par30_amount_cop || 0), 0),
        npl30Amount: businesses.reduce((sum, business) => sum + Number(business.npl30_amount_cop || 0), 0),
        par7Rate: toPercent(
            businesses.reduce((sum, business) => sum + Number(business.par7_amount_cop || 0), 0),
            businesses.reduce((sum, business) => sum + business.advance_outstanding_cop, 0)
        ),
        par30Rate: toPercent(
            businesses.reduce((sum, business) => sum + Number(business.par30_amount_cop || 0), 0),
            businesses.reduce((sum, business) => sum + business.advance_outstanding_cop, 0)
        ),
        npl30Rate: toPercent(
            businesses.reduce((sum, business) => sum + Number(business.npl30_amount_cop || 0), 0),
            businesses.reduce((sum, business) => sum + business.advance_outstanding_cop, 0)
        ),
        writeOffAmount: Array.from(advanceMetricsMap.values()).reduce((sum, business) => sum + business.writeOffAmountCop, 0),
        recoveredPrincipalCop: 0,
    };
    const marketplace = {
        publishedOffers: businesses.reduce((sum, business) => sum + business.marketplace_published_offers, 0),
        assignedOffers: businesses.reduce((sum, business) => sum + business.marketplace_assigned_offers, 0),
        inTransitOffers: Array.from(marketplaceMetricsMap.values()).reduce((sum, business) => sum + business.inTransitOffers, 0),
        deliveredOffers: businesses.reduce((sum, business) => sum + business.marketplace_delivered_offers, 0),
        threePlOffers: businesses.reduce((sum, business) => sum + business.three_pl_offers, 0),
        fillRate: toPercent(
            businesses.reduce((sum, business) => sum + business.marketplace_assigned_offers, 0),
            businesses.reduce((sum, business) => sum + business.marketplace_published_offers, 0)
        ),
        clientAccounts: businesses.reduce((sum, business) => sum + business.three_pl_clients, 0),
        activeClientAccounts: businesses.reduce((sum, business) => sum + business.active_client_accounts, 0),
        receiptsProcessed: businesses.reduce((sum, business) => sum + business.receipts_processed, 0),
        dispatchesProcessed: businesses.reduce((sum, business) => sum + business.dispatches_processed, 0),
        dispatchReadyRate: toPercent(
            Array.from(marketplaceMetricsMap.values()).reduce((sum, business) => sum + business.dispatchReady, 0),
            Array.from(marketplaceMetricsMap.values()).reduce((sum, business) => sum + business.dispatchTracked, 0)
        ),
        multiClientBusinesses: businesses.filter((business) => business.three_pl_clients >= 2).length,
    };

    return {
        ready: true,
        message: null,
        hasHoldingAccess: true,
        role,
        capabilities,
        featureEnabled,
        account: typedAccount,
        stats: {
            totalBusinesses: businesses.length,
            totalWarehouses: businesses.reduce((sum, business) => sum + business.warehouses, 0),
            totalActiveInternalUsers: businesses.reduce((sum, business) => sum + business.active_internal_users, 0),
            totalMonthlyTrips: businesses.reduce((sum, business) => sum + business.monthly_trips, 0),
            openIncidents: businesses.reduce((sum, business) => sum + business.open_incidents, 0),
            criticalIncidents: businesses.reduce((sum, business) => sum + business.critical_incidents, 0),
            activeHoldingMembers: activeMembersCount || 0,
        },
        accounts,
        businesses,
        controlTower,
        fintech,
        marketplace,
        paymentsReadiness,
        alerts: rankedAlerts,
        recommendedPlanCode: featureEnabled ? null : 'enterprise',
        approvals: approvalCounters,
    };
}

type HoldingRelationshipType = 'parent' | 'subsidiary' | 'brand' | 'operator';

type HoldingApprovalRequestType =
    | 'business_link'
    | 'credit_policy'
    | 'wallet_release'
    | 'plan_upgrade'
    | 'ops_exception'
    | 'custom';

type HoldingApprovalPriority = 'low' | 'medium' | 'high' | 'critical';

type HoldingApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

type HoldingFinancePolicyRecord = {
    holding_account_id: string;
    max_single_advance_cop: number;
    max_business_exposure_cop: number;
    max_portfolio_exposure_cop: number;
    wallet_release_limit_cop: number;
    auto_approve_plan_upgrades_until_usd: number;
    allow_high_risk_operations: boolean;
    allow_critical_risk_operations: boolean;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
};

function isHoldingRelationshipType(value: unknown): value is HoldingRelationshipType {
    return ['parent', 'subsidiary', 'brand', 'operator'].includes(String(value));
}

async function getManageableBusinessIdsForUser(
    supabaseAdmin: AdminClient,
    authUserId: string,
    profile: AuthProfile | null,
    holdingAccountId?: string | null
) {
    const manageableIds = new Set<string>();

    if (profile?.user_type === 'admin') {
        const { data, error } = await supabaseAdmin
            .from('business_profiles')
            .select('user_id');

        if (error) {
            throw new Error(error.message || 'Could not load business catalog.');
        }

        for (const row of (data || []) as Array<{ user_id: string }>) {
            manageableIds.add(row.user_id);
        }

        return Array.from(manageableIds);
    }

    if (profile?.user_type !== 'business') {
        return [];
    }

    const ownerBusinessId = profile.id || authUserId;
    manageableIds.add(ownerBusinessId);

    const { data: managerMemberships, error: managerMembershipsError } = await supabaseAdmin
        .from('business_team_members')
        .select('business_id')
        .eq('user_id', authUserId)
        .eq('status', 'active')
        .in('role', ['owner', 'manager']);

    if (managerMembershipsError) {
        if (!isBusinessTeamMembersTableMissing(managerMembershipsError)) {
            throw new Error(managerMembershipsError.message || 'Could not load managed businesses.');
        }
    } else {
        for (const row of (managerMemberships || []) as Array<{ business_id: string }>) {
            manageableIds.add(row.business_id);
        }
    }

    if (holdingAccountId) {
        const { data: linkedBusinesses, error: linkedBusinessesError } = await supabaseAdmin
            .from('holding_business_links')
            .select('business_id')
            .eq('holding_account_id', holdingAccountId)
            .eq('status', 'linked');

        if (linkedBusinessesError) {
            if (!isHoldingBusinessLinksTableMissing(linkedBusinessesError)) {
                throw new Error(linkedBusinessesError.message || 'Could not load linked businesses.');
            }
        } else {
            for (const row of (linkedBusinesses || []) as Array<{ business_id: string }>) {
                manageableIds.add(row.business_id);
            }
        }
    }

    return Array.from(manageableIds);
}

export async function getHoldingBusinesses(
    supabaseAdmin: AdminClient,
    authUserId: string,
    profile: AuthProfile | null,
    holdingAccountId: string,
    role: HoldingRole | null,
    accounts: Array<{ id: string; display_name: string; slug: string; role: HoldingRole }>
): Promise<HoldingBusinessesResponse> {
    const summary = await getHoldingSummary(
        supabaseAdmin,
        holdingAccountId,
        role,
        accounts
    );

    const canManageHolding = canManageHoldingRole(role);
    const capabilities = getHoldingCapabilities(role);
    const manageableBusinessIds = await getManageableBusinessIdsForUser(
        supabaseAdmin,
        authUserId,
        profile,
        holdingAccountId
    );

    if (!manageableBusinessIds.length && profile?.user_type !== 'admin') {
        return {
            ready: true,
            message: null,
            holdingAccountId,
            role,
            canManageHolding,
            canLinkDirectly: Boolean(capabilities?.manageBusinessLinks),
            capabilities,
            linked: summary.businesses,
            catalog: [],
        };
    }

    const businessProfilesQuery = supabaseAdmin
        .from('business_profiles')
        .select('user_id, company_name, city, department')
        .order('company_name', { ascending: true });

    const businessProfilesResponse = profile?.user_type === 'admin'
        ? await businessProfilesQuery
        : await businessProfilesQuery.in('user_id', manageableBusinessIds);

    if (businessProfilesResponse.error) {
        throw new Error(businessProfilesResponse.error.message || 'Could not load business catalog.');
    }

    const businessProfiles = (businessProfilesResponse.data || []) as Array<{
        user_id: string;
        company_name: string;
        city: string | null;
        department: string | null;
    }>;
    const catalogBusinessIds = businessProfiles.map((profileRow) => profileRow.user_id);

    if (!catalogBusinessIds.length) {
        return {
            ready: true,
            message: null,
            holdingAccountId,
            role,
            canManageHolding,
            canLinkDirectly: Boolean(capabilities?.manageBusinessLinks),
            capabilities,
            linked: summary.businesses,
            catalog: [],
        };
    }

    const [subscriptionsResponse, plansResponse, linkedBusinessesResponse] = await Promise.all([
        supabaseAdmin
            .from('business_plan_subscriptions')
            .select('business_id, plan_code')
            .in('business_id', catalogBusinessIds),
        supabaseAdmin
            .from('billing_plans')
            .select('code, name, feature_matrix'),
        supabaseAdmin
            .from('holding_business_links')
            .select('holding_account_id, business_id, relationship_type, status')
            .in('business_id', catalogBusinessIds),
    ]);

    if (subscriptionsResponse.error) {
        throw new Error(subscriptionsResponse.error.message || 'Could not load plan catalog.');
    }

    if (plansResponse.error) {
        throw new Error(plansResponse.error.message || 'Could not load billing plans.');
    }

    if (linkedBusinessesResponse.error) {
        if (isHoldingBusinessLinksTableMissing(linkedBusinessesResponse.error)) {
            throw new Error(getHoldingSetupMessage());
        }

        throw new Error(linkedBusinessesResponse.error.message || 'Could not load holding business links.');
    }

    const subscriptions = (subscriptionsResponse.data || []) as Array<{
        business_id: string;
        plan_code: string;
    }>;
    const plans = (plansResponse.data || []) as Array<{
        code: string;
        name: string;
        feature_matrix: Record<string, unknown> | null;
    }>;
    const linkedBusinesses = (linkedBusinessesResponse.data || []) as Array<{
        holding_account_id: string;
        business_id: string;
        relationship_type: HoldingRelationshipType;
        status?: 'linked' | 'unlinked' | null;
    }>;
    const activeLinkedBusinesses = linkedBusinesses.filter((row) => (row.status || 'linked') === 'linked');
    const currentHoldingIds = Array.from(new Set(activeLinkedBusinesses.map((row) => row.holding_account_id)));

    const { data: holdingAccounts, error: holdingAccountsError } = currentHoldingIds.length
        ? await supabaseAdmin
            .from('holding_accounts')
            .select('id, display_name')
            .in('id', currentHoldingIds)
        : { data: [], error: null };

    if (holdingAccountsError) {
        throw new Error(holdingAccountsError.message || 'Could not load holding account names.');
    }

    const subscriptionMap = new Map(subscriptions.map((subscription) => [subscription.business_id, subscription.plan_code]));
    const planMap = new Map(plans.map((plan) => [plan.code, plan]));
    const linkedBusinessMap = new Map(activeLinkedBusinesses.map((row) => [row.business_id, row]));
    const holdingAccountNameMap = new Map(((holdingAccounts || []) as Array<{ id: string; display_name: string }>).map((account) => [account.id, account.display_name]));
    const linkedBusinessIds = new Set(summary.businesses.map((business) => business.business_id));

    const catalog = businessProfiles
        .filter((profileRow) => !linkedBusinessIds.has(profileRow.user_id))
        .map((profileRow) => {
            const linkedBusiness = linkedBusinessMap.get(profileRow.user_id);
            const planCode = subscriptionMap.get(profileRow.user_id) || 'free';
            const plan = planMap.get(planCode) || planMap.get('free');

            return {
                business_id: profileRow.user_id,
                company_name: profileRow.company_name || `Empresa ${profileRow.user_id.slice(0, 8)}`,
                city: profileRow.city || null,
                department: profileRow.department || null,
                current_holding_id: linkedBusiness?.holding_account_id || null,
                current_holding_name: linkedBusiness?.holding_account_id
                    ? holdingAccountNameMap.get(linkedBusiness.holding_account_id) || null
                    : null,
                relationship_type: linkedBusiness?.relationship_type || null,
                plan_code: planCode,
                plan_name: plan?.name || 'Free',
                holding_feature_enabled: Boolean(
                    plan?.feature_matrix &&
                    (plan.feature_matrix as Record<string, unknown>).holding_multiempresa
                ),
            } satisfies HoldingBusinessCatalogItem;
        });

    return {
        ready: true,
        message: null,
        holdingAccountId,
        role,
        canManageHolding,
        canLinkDirectly: Boolean(capabilities?.manageBusinessLinks),
        capabilities,
        linked: summary.businesses,
        catalog,
    };
}

export async function linkBusinessToHolding(
    supabaseAdmin: AdminClient,
    payload: {
        holdingAccountId: string;
        businessId: string;
        relationshipType: HoldingRelationshipType;
        createdBy: string;
    }
) {
    const { data: existingLink, error: existingLinkError } = await supabaseAdmin
        .from('holding_business_links')
        .select('id, holding_account_id, business_id, status')
        .eq('business_id', payload.businessId)
        .maybeSingle();

    if (existingLinkError && !isHoldingBusinessLinksTableMissing(existingLinkError)) {
        throw new Error(existingLinkError.message || 'Could not verify holding link.');
    }

    if (
        existingLink?.holding_account_id &&
        existingLink.holding_account_id !== payload.holdingAccountId &&
        (existingLink.status || 'linked') === 'linked'
    ) {
        throw new Error('Esta empresa ya pertenece a otro holding y primero debe desvincularse.');
    }

    const response = existingLink?.id
        ? await supabaseAdmin
            .from('holding_business_links')
            .update({
                relationship_type: payload.relationshipType,
                created_by: payload.createdBy,
                status: 'linked',
                unlinked_at: null,
                unlinked_by: null,
                unlink_reason: null,
            })
            .eq('id', existingLink.id)
            .select('*')
            .single()
        : await supabaseAdmin
            .from('holding_business_links')
            .insert({
                holding_account_id: payload.holdingAccountId,
                business_id: payload.businessId,
                relationship_type: payload.relationshipType,
                created_by: payload.createdBy,
                status: 'linked',
            })
            .select('*')
            .single();

    if (response.error || !response.data) {
        throw new Error(response.error?.message || 'Could not link business to holding.');
    }

    return response.data;
}

export async function unlinkBusinessFromHolding(
    supabaseAdmin: AdminClient,
    payload: {
        holdingAccountId: string;
        businessId: string;
        unlinkedBy: string;
        reason?: string | null;
    }
) {
    const [pendingApprovalsResponse, businessOfferIdsResponse, walletIdsResponse] = await Promise.all([
        supabaseAdmin
            .from('holding_approval_requests')
            .select('id', { count: 'exact', head: true })
            .eq('holding_account_id', payload.holdingAccountId)
            .eq('business_id', payload.businessId)
            .eq('status', 'pending'),
        supabaseAdmin
            .from('cargo_offers')
            .select('id')
            .eq('business_id', payload.businessId),
        supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', payload.businessId),
    ]);

    if (pendingApprovalsResponse.error) {
        throw new Error(pendingApprovalsResponse.error.message || 'Could not verify pending approvals.');
    }

    if (businessOfferIdsResponse.error) {
        throw new Error(businessOfferIdsResponse.error.message || 'Could not verify business offers.');
    }

    if (walletIdsResponse.error) {
        throw new Error(walletIdsResponse.error.message || 'Could not verify linked wallets.');
    }

    const walletIds = ((walletIdsResponse.data || []) as Array<{ id: string }>).map((row) => row.id);
    const businessOfferIds = ((businessOfferIdsResponse.data || []) as Array<{ id: string }>).map((row) => row.id);
    const activeAdvancesResponse = businessOfferIds.length
        ? await supabaseAdmin
            .from('fuel_advances')
            .select('id', { count: 'exact', head: true })
            .in('origin_offer_id', businessOfferIds)
            .in('status', ['requested', 'disbursed', 'overdue', 'at_risk', 'restructured'])
        : { count: 0, error: null };
    const pendingWithdrawalsResponse = walletIds.length
        ? await supabaseAdmin
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .in('wallet_id', walletIds)
            .eq('type', 'withdrawal')
            .eq('status', 'pending')
        : { count: 0, error: null };

    if (pendingWithdrawalsResponse.error) {
        throw new Error(pendingWithdrawalsResponse.error.message || 'Could not verify pending withdrawals.');
    }

    if ((pendingApprovalsResponse.count || 0) > 0) {
        throw new Error('No puedes desvincular la empresa mientras existan aprobaciones corporativas pendientes.');
    }

    if (activeAdvancesResponse.error) {
        throw new Error(activeAdvancesResponse.error.message || 'Could not verify active advances.');
    }

    if ((activeAdvancesResponse.count || 0) > 0) {
        throw new Error('No puedes desvincular la empresa mientras tenga exposiciones activas de adelantos.');
    }

    if ((pendingWithdrawalsResponse.count || 0) > 0) {
        throw new Error('No puedes desvincular la empresa mientras existan retiros pendientes.');
    }

    const { data, error } = await supabaseAdmin
        .from('holding_business_links')
        .update({
            status: 'unlinked',
            unlinked_at: new Date().toISOString(),
            unlinked_by: payload.unlinkedBy,
            unlink_reason: payload.reason || 'Unlink solicitado desde consola corporativa',
        })
        .eq('holding_account_id', payload.holdingAccountId)
        .eq('business_id', payload.businessId)
        .eq('status', 'linked')
        .select('*')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Could not unlink business from holding.');
    }

    if (!data) {
        throw new Error('The business is not currently linked to this holding account.');
    }

    return data;
}

export async function getHoldingFinancePolicy(
    supabaseAdmin: AdminClient,
    holdingAccountId: string,
    role: HoldingRole | null
): Promise<HoldingFinancePolicyResponse> {
    const financeStatus = await getHoldingFinanceInfrastructureStatus(supabaseAdmin);

    if (!financeStatus.ready) {
        return {
            ready: false,
            message: financeStatus.message,
            holdingAccountId,
            role,
            canManageHolding: canManageHoldingRole(role),
            capabilities: getHoldingCapabilities(role),
            data: null,
        };
    }

    const { data, error } = await supabaseAdmin
        .from('holding_finance_policies')
        .select('*')
        .eq('holding_account_id', holdingAccountId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Could not load holding finance policy.');
    }

    return {
        ready: true,
        message: null,
        holdingAccountId,
        role,
        canManageHolding: canManageHoldingRole(role),
        capabilities: getHoldingCapabilities(role),
        data: (data as HoldingFinancePolicyRecord | null) || null,
    };
}

export async function upsertHoldingFinancePolicy(
    supabaseAdmin: AdminClient,
    payload: {
        holdingAccountId: string;
        updatedBy: string;
        maxSingleAdvanceCop: number;
        maxBusinessExposureCop: number;
        maxPortfolioExposureCop: number;
        walletReleaseLimitCop: number;
        autoApprovePlanUpgradesUntilUsd: number;
        allowHighRiskOperations: boolean;
        allowCriticalRiskOperations: boolean;
    }
) {
    const financeStatus = await getHoldingFinanceInfrastructureStatus(supabaseAdmin);

    if (!financeStatus.ready) {
        throw new Error(financeStatus.message || 'Holding finance infrastructure is not ready.');
    }

    const { data, error } = await supabaseAdmin
        .from('holding_finance_policies')
        .upsert({
            holding_account_id: payload.holdingAccountId,
            max_single_advance_cop: payload.maxSingleAdvanceCop,
            max_business_exposure_cop: payload.maxBusinessExposureCop,
            max_portfolio_exposure_cop: payload.maxPortfolioExposureCop,
            wallet_release_limit_cop: payload.walletReleaseLimitCop,
            auto_approve_plan_upgrades_until_usd: payload.autoApprovePlanUpgradesUntilUsd,
            allow_high_risk_operations: payload.allowHighRiskOperations,
            allow_critical_risk_operations: payload.allowCriticalRiskOperations,
            updated_by: payload.updatedBy,
        }, { onConflict: 'holding_account_id' })
        .select('*')
        .single();

    if (error || !data) {
        throw new Error(error?.message || 'Could not update holding finance policy.');
    }

    return data as HoldingFinancePolicyRecord;
}

async function activateBusinessPlanSubscription(
    supabaseAdmin: AdminClient,
    payload: {
        businessId: string;
        planCode: string;
    }
) {
    const { data: plan, error: planError } = await supabaseAdmin
        .from('billing_plans')
        .select('code, name, price_monthly_cop, price_monthly_usd, feature_matrix')
        .eq('code', payload.planCode)
        .maybeSingle();

    if (planError) {
        throw new Error(planError.message || 'Could not validate billing plan.');
    }

    if (!plan) {
        throw new Error('Target billing plan not found.');
    }

    const now = new Date();
    const { data: existingSubscription, error: existingSubscriptionError } = await supabaseAdmin
        .from('business_plan_subscriptions')
        .select('*')
        .eq('business_id', payload.businessId)
        .maybeSingle();

    if (existingSubscriptionError) {
        throw new Error(existingSubscriptionError.message || 'Could not load business subscription.');
    }

    const currentPeriodEnd = existingSubscription?.current_period_end
        ? new Date(existingSubscription.current_period_end)
        : null;
    const baseDate =
        currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime()
            ? currentPeriodEnd
            : now;
    const nextPeriodEnd = new Date(baseDate);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    const subscriptionPayload = {
        business_id: payload.businessId,
        plan_code: payload.planCode,
        status: 'active' as const,
        current_period_start: now.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
    };

    const response = existingSubscription?.id
        ? await supabaseAdmin
            .from('business_plan_subscriptions')
            .update(subscriptionPayload)
            .eq('id', existingSubscription.id)
            .select('*')
            .single()
        : await supabaseAdmin
            .from('business_plan_subscriptions')
            .insert(subscriptionPayload)
            .select('*')
            .single();

    if (response.error || !response.data) {
        throw new Error(response.error?.message || 'Could not activate business plan.');
    }

    return {
        subscription: response.data,
        planName: plan.name,
        priceMonthlyCop: resolveBillingPlanPriceCop({
            price_monthly_cop: Number(plan.price_monthly_cop || 0),
            price_monthly_usd: Number(plan.price_monthly_usd || 0),
            feature_matrix: typeof plan.feature_matrix === 'object' && plan.feature_matrix ? plan.feature_matrix : {},
        }),
        priceMonthlyUsd: Number(plan.price_monthly_usd || 0),
    };
}

async function applyWalletReleaseAdjustment(
    supabaseAdmin: AdminClient,
    payload: {
        approvalId: string;
        holdingAccountId: string;
        decidedBy: string;
        amount: number;
        walletId?: string | null;
        userId?: string | null;
        description?: string | null;
        metadata?: Record<string, unknown>;
    }
) {
    if (!payload.amount || payload.amount <= 0) {
        throw new Error('Wallet release amount must be greater than zero.');
    }

    let walletId = payload.walletId || null;

    if (!walletId && payload.userId) {
        const { data: walletByUser, error: walletByUserError } = await supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', payload.userId)
            .maybeSingle();

        if (walletByUserError) {
            throw new Error(walletByUserError.message || 'Could not resolve target wallet.');
        }

        walletId = walletByUser?.id || null;
    }

    if (!walletId) {
        throw new Error('Wallet release requires walletId or userId.');
    }

    const { data: adjustmentResult, error: adjustmentError } = await supabaseAdmin.rpc('apply_wallet_adjustment', {
        p_wallet_id: walletId,
        p_amount: payload.amount,
        p_description: payload.description || `Liberacion corporativa de saldo por holding ${payload.holdingAccountId.slice(0, 8)}`,
        p_reference_id: payload.approvalId,
        p_offer_id: null,
        p_metadata: {
            source_kind: 'holding_wallet_release',
            holding_account_id: payload.holdingAccountId,
            approved_by: payload.decidedBy,
            ...(payload.metadata || {}),
        },
    });

    const adjustment = Array.isArray(adjustmentResult) ? adjustmentResult[0] : null;

    if (adjustmentError || !adjustment?.success) {
        throw new Error(adjustmentError?.message || 'Could not record wallet release transaction.');
    }

    await createAdminNotification(supabaseAdmin, {
        type: 'holding_wallet_release',
        title: 'Liberacion corporativa aplicada',
        message: `Se acredito un ajuste de billetera por ${payload.amount} desde una aprobacion corporativa.`,
        data: {
            approval_id: payload.approvalId,
            holding_account_id: payload.holdingAccountId,
            wallet_id: walletId,
            amount: payload.amount,
            approved_by: payload.decidedBy,
        },
    });

    return {
        walletId,
        balanceAfter: Number(adjustment.balance_after || 0),
    };
}

async function applyHoldingOpsException(
    supabaseAdmin: AdminClient,
    payload: {
        approvalId: string;
        holdingAccountId: string;
        decidedBy: string;
        approvalPayload: Record<string, unknown>;
    }
) {
    const advanceId = typeof payload.approvalPayload.advanceId === 'string'
        ? payload.approvalPayload.advanceId
        : null;
    const action = typeof payload.approvalPayload.advanceAction === 'string'
        ? payload.approvalPayload.advanceAction
        : null;
    const note = typeof payload.approvalPayload.note === 'string'
        ? payload.approvalPayload.note
        : null;

    if (advanceId && action) {
        if (action === 'approve') {
            const { data, error } = await supabaseAdmin.rpc('approve_fuel_advance', {
                p_advance_id: advanceId,
                p_admin_id: payload.decidedBy,
                p_note: note,
            });

            if (error || !data?.[0]?.success) {
                throw new Error(error?.message || data?.[0]?.message || 'Could not approve fuel advance.');
            }
        } else if (action === 'reject') {
            const { data, error } = await supabaseAdmin.rpc('reject_fuel_advance', {
                p_advance_id: advanceId,
                p_admin_id: payload.decidedBy,
                p_reason: note,
            });

            if (error || !data) {
                throw new Error(error?.message || 'Could not reject fuel advance.');
            }
        } else if (action === 'mark_restructured') {
            const { data, error } = await supabaseAdmin.rpc('restructure_fuel_advance', {
                p_advance_id: advanceId,
                p_admin_id: payload.decidedBy,
                p_note: note,
            });

            if (error || !data) {
                throw new Error(error?.message || 'Could not restructure fuel advance.');
            }
        } else if (action === 'write_off') {
            const { data, error } = await supabaseAdmin.rpc('write_off_fuel_advance', {
                p_advance_id: advanceId,
                p_admin_id: payload.decidedBy,
                p_note: note,
            });

            if (error || !data) {
                throw new Error(error?.message || 'Could not write off fuel advance.');
            }
        }
    }

    await createAdminNotification(supabaseAdmin, {
        type: 'holding_ops_exception',
        title: 'Excepcion operativa corporativa',
        message: 'Se aprobo una excepcion operativa desde el holding.',
        data: {
            approval_id: payload.approvalId,
            holding_account_id: payload.holdingAccountId,
            advance_id: advanceId,
            action,
            approved_by: payload.decidedBy,
            note,
        },
    });
}

export async function getHoldingMembers(
    supabaseAdmin: AdminClient,
    holdingAccountId: string,
    role: HoldingRole | null
): Promise<HoldingMembersResponse> {
    const { data, error } = await supabaseAdmin
        .from('holding_account_members')
        .select(`
            id,
            holding_account_id,
            user_id,
            invited_email,
            role,
            status,
            invited_by,
            accepted_at,
            created_at,
            updated_at,
            user:user_profiles!holding_account_members_user_id_fkey(
                id,
                email,
                full_name,
                phone,
                avatar_url
            )
        `)
        .eq('holding_account_id', holdingAccountId)
        .order('created_at', { ascending: true });

    if (error) {
        if (isHoldingAccountMembersTableMissing(error)) {
            throw new Error(getHoldingSetupMessage());
        }

        throw new Error(error.message || 'Could not load holding members.');
    }

    const members = ((data || []) as Array<{
        id: string;
        holding_account_id: string;
        user_id: string | null;
        invited_email: string;
        role: HoldingMember['role'];
        status: HoldingMember['status'];
        invited_by: string | null;
        accepted_at: string | null;
        created_at: string;
        updated_at: string;
        user?: HoldingMember['user'] | HoldingMember['user'][];
    }>).map((member) => ({
        ...member,
        user: Array.isArray(member.user) ? member.user[0] || null : member.user || null,
    })).sort((left, right) => {
        if (left.status !== right.status) {
            return left.status === 'active' ? -1 : right.status === 'active' ? 1 : 0;
        }

        return left.invited_email.localeCompare(right.invited_email);
    });

    return {
        ready: true,
        message: null,
        holdingAccountId,
        role,
        canManageHolding: canManageHoldingRole(role),
        capabilities: getHoldingCapabilities(role),
        data: members,
    };
}

export async function getHoldingApprovals(
    supabaseAdmin: AdminClient,
    holdingAccountId: string,
    role: HoldingRole | null
): Promise<HoldingApprovalsResponse> {
    const governanceStatus = await getHoldingGovernanceInfrastructureStatus(supabaseAdmin);

    if (!governanceStatus.ready) {
        return {
            ready: false,
            message: governanceStatus.message,
            holdingAccountId,
            role,
            canManageHolding: canManageHoldingRole(role),
            capabilities: getHoldingCapabilities(role),
            data: [],
        };
    }

    const { data, error } = await supabaseAdmin
        .from('holding_approval_requests')
        .select('*')
        .eq('holding_account_id', holdingAccountId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message || 'Could not load holding approvals.');
    }

    const priorityWeight: Record<HoldingApprovalPriority, number> = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
    };
    const statusWeight: Record<HoldingApprovalStatus, number> = {
        pending: 4,
        approved: 3,
        rejected: 2,
        cancelled: 1,
    };

    const rows = ((data || []) as HoldingApprovalRequest[]).map((row) => {
        const timing = getHoldingApprovalTimingState({
            status: row.status,
            priority: row.priority,
            created_at: row.created_at,
            sla_due_at: row.sla_due_at,
            breached_at: row.breached_at,
            resolved_within_sla: row.resolved_within_sla,
        });

        return {
            ...row,
            assigned_team: row.assigned_team || getHoldingAssignedTeam(row.request_type),
            sla_due_at: timing.sla_due_at,
            aging_bucket: timing.aging_bucket,
            breached_at: timing.breached_at,
            escalation_level: timing.escalation_level,
            resolved_within_sla: timing.resolved_within_sla,
            source_reference: row.source_reference || (typeof row.payload?.referenceId === 'string' ? row.payload.referenceId : row.business_id),
        };
    }).sort((left, right) => {
        const statusDelta = statusWeight[right.status] - statusWeight[left.status];
        if (statusDelta !== 0) {
            return statusDelta;
        }

        const priorityDelta = priorityWeight[right.priority] - priorityWeight[left.priority];
        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

    return {
        ready: true,
        message: null,
        holdingAccountId,
        role,
        canManageHolding: canManageHoldingRole(role),
        capabilities: getHoldingCapabilities(role),
        data: rows,
    };
}

export async function createHoldingApproval(
    supabaseAdmin: AdminClient,
    payload: {
        holdingAccountId: string;
        businessId?: string | null;
        requestType: HoldingApprovalRequestType;
        priority?: HoldingApprovalPriority;
        title: string;
        description?: string | null;
        requestPayload?: Record<string, unknown>;
        requestedBy: string;
    }
) {
    const governanceStatus = await getHoldingGovernanceInfrastructureStatus(supabaseAdmin);

    if (!governanceStatus.ready) {
        throw new Error(governanceStatus.message || 'Holding governance is not ready.');
    }

    const requestedAssignedTeam = getHoldingAssignedTeam(payload.requestType);
    const normalizedPriority = payload.priority || 'medium';
    const sourceReference = typeof payload.requestPayload?.referenceId === 'string'
        ? payload.requestPayload.referenceId
        : payload.businessId || null;
    const { count: assignedTeamCount, error: assignedTeamError } = await supabaseAdmin
        .from('holding_account_members')
        .select('id', { count: 'exact', head: true })
        .eq('holding_account_id', payload.holdingAccountId)
        .eq('role', requestedAssignedTeam)
        .eq('status', 'active');

    if (assignedTeamError && !isHoldingAccountMembersTableMissing(assignedTeamError)) {
        throw new Error(assignedTeamError.message || 'Could not resolve assigned approval team.');
    }

    const assignedTeam = (assignedTeamCount || 0) > 0 ? requestedAssignedTeam : 'holding_owner';

    const { data, error } = await supabaseAdmin
        .from('holding_approval_requests')
        .insert({
            holding_account_id: payload.holdingAccountId,
            business_id: payload.businessId || null,
            request_type: payload.requestType,
            priority: normalizedPriority,
            status: 'pending',
            title: payload.title,
            description: payload.description || null,
            payload: payload.requestPayload || {},
            requested_by: payload.requestedBy,
            assigned_team: assignedTeam,
            sla_due_at: getHoldingSlaDueAt(normalizedPriority),
            aging_bucket: 'within_sla',
            escalation_level: 0,
            source_reference: sourceReference,
        })
        .select('*')
        .single();

    if (error || !data) {
        throw new Error(error?.message || 'Could not create approval request.');
    }

    const createdApproval = {
        ...(data as HoldingApprovalRequest),
        assigned_team: (data as HoldingApprovalRequest).assigned_team || assignedTeam,
        source_reference: (data as HoldingApprovalRequest).source_reference || sourceReference,
    };

    await createAdminNotification(supabaseAdmin, {
        type: 'holding_approval_created',
        title: 'Nueva aprobacion corporativa',
        message: `La solicitud ${payload.title} entro a la cola ${assignedTeam}.`,
        data: {
            approval_id: createdApproval.id,
            holding_account_id: payload.holdingAccountId,
            assigned_team: createdApproval.assigned_team,
            priority: normalizedPriority,
            sla_due_at: createdApproval.sla_due_at,
            source_reference: createdApproval.source_reference,
        },
    });

    return createdApproval;
}

export async function decideHoldingApproval(
    supabaseAdmin: AdminClient,
    payload: {
        approvalId: string;
        holdingAccountId: string;
        status: Exclude<HoldingApprovalStatus, 'pending'>;
        decisionNote?: string | null;
        assignedTo?: string | null;
        decidedBy: string;
    }
) {
    const governanceStatus = await getHoldingGovernanceInfrastructureStatus(supabaseAdmin);

    if (!governanceStatus.ready) {
        throw new Error(governanceStatus.message || 'Holding governance is not ready.');
    }

    const { data: approval, error: approvalError } = await supabaseAdmin
        .from('holding_approval_requests')
        .select('*')
        .eq('id', payload.approvalId)
        .eq('holding_account_id', payload.holdingAccountId)
        .maybeSingle();

    if (approvalError) {
        throw new Error(approvalError.message || 'Could not load approval request.');
    }

    if (!approval) {
        throw new Error('Approval request not found.');
    }

    if (approval.status !== 'pending') {
        throw new Error('This approval request is no longer pending.');
    }

    if (payload.status === 'approved') {
        const approvalPayload = (approval.payload || {}) as Record<string, unknown>;

        if (approval.request_type === 'business_link') {
            const businessId = approval.business_id || String(approvalPayload.businessId || '');
            const relationshipType = isHoldingRelationshipType(approvalPayload.relationshipType)
                ? approvalPayload.relationshipType
                : 'subsidiary';

            if (!businessId) {
                throw new Error('The business link approval does not include a target company.');
            }

            await linkBusinessToHolding(supabaseAdmin, {
                holdingAccountId: approval.holding_account_id,
                businessId,
                relationshipType,
                createdBy: payload.decidedBy,
            });
        } else if (approval.request_type === 'credit_policy') {
            await upsertHoldingFinancePolicy(supabaseAdmin, {
                holdingAccountId: approval.holding_account_id,
                updatedBy: payload.decidedBy,
                maxSingleAdvanceCop: Number(approvalPayload.maxSingleAdvanceCop || 0),
                maxBusinessExposureCop: Number(approvalPayload.maxBusinessExposureCop || 0),
                maxPortfolioExposureCop: Number(approvalPayload.maxPortfolioExposureCop || 0),
                walletReleaseLimitCop: Number(approvalPayload.walletReleaseLimitCop || 0),
                autoApprovePlanUpgradesUntilUsd: Number(approvalPayload.autoApprovePlanUpgradesUntilUsd || 0),
                allowHighRiskOperations: Boolean(approvalPayload.allowHighRiskOperations),
                allowCriticalRiskOperations: Boolean(approvalPayload.allowCriticalRiskOperations),
            });
        } else if (approval.request_type === 'plan_upgrade') {
            const businessId = approval.business_id || String(approvalPayload.businessId || '');
            const planCode = typeof approvalPayload.planCode === 'string' ? approvalPayload.planCode : '';

            if (!businessId || !planCode) {
                throw new Error('The plan upgrade approval does not include businessId and planCode.');
            }

            const planActivation = await activateBusinessPlanSubscription(supabaseAdmin, {
                businessId,
                planCode,
            });

            await createAdminNotification(supabaseAdmin, {
                type: 'holding_plan_upgrade',
                title: 'Plan empresarial activado desde holding',
                message: `Se activo el plan ${planActivation.planName} para la empresa ${businessId}.`,
                data: {
                    approval_id: approval.id,
                    business_id: businessId,
                    plan_code: planCode,
                    approved_by: payload.decidedBy,
                    price_monthly_cop: planActivation.priceMonthlyCop,
                    price_monthly_usd: planActivation.priceMonthlyUsd,
                },
            });
        } else if (approval.request_type === 'wallet_release') {
            await applyWalletReleaseAdjustment(supabaseAdmin, {
                approvalId: approval.id,
                holdingAccountId: approval.holding_account_id,
                decidedBy: payload.decidedBy,
                amount: Number(approvalPayload.amount || 0),
                walletId: typeof approvalPayload.walletId === 'string' ? approvalPayload.walletId : null,
                userId: typeof approvalPayload.userId === 'string' ? approvalPayload.userId : null,
                description: typeof approvalPayload.description === 'string' ? approvalPayload.description : approval.title,
                metadata: approvalPayload,
            });
        } else if (approval.request_type === 'ops_exception') {
            await applyHoldingOpsException(supabaseAdmin, {
                approvalId: approval.id,
                holdingAccountId: approval.holding_account_id,
                decidedBy: payload.decidedBy,
                approvalPayload,
            });
        }
    }

    const timing = getHoldingApprovalTimingState({
        status: approval.status,
        priority: approval.priority,
        created_at: approval.created_at,
        sla_due_at: approval.sla_due_at,
        breached_at: approval.breached_at,
        resolved_within_sla: approval.resolved_within_sla,
    });

    const { data: updatedApproval, error: updateError } = await supabaseAdmin
        .from('holding_approval_requests')
        .update({
            status: payload.status,
            assigned_to: payload.assignedTo || approval.assigned_to || null,
            assigned_team: approval.assigned_team || getHoldingAssignedTeam(approval.request_type),
            decided_by: payload.decidedBy,
            decided_at: new Date().toISOString(),
            decision_note: payload.decisionNote || null,
            aging_bucket: 'resolved',
            resolved_within_sla: timing.aging_bucket === 'within_sla' || timing.aging_bucket === 'due_soon',
            breached_at: timing.breached_at,
            escalation_level: timing.escalation_level,
            source_reference: approval.source_reference || approval.business_id || null,
        })
        .eq('id', approval.id)
        .select('*')
        .single();

    if (updateError || !updatedApproval) {
        throw new Error(updateError?.message || 'Could not update approval request.');
    }

    return updatedApproval as HoldingApprovalRequest;
}
