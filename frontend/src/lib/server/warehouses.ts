import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillingPlan, WarehouseCapabilities, WarehouseRole } from '@/lib/warehouses/types';
import { createAdminNotification } from '@/lib/server/route-auth';
import type { BusinessTeamRole } from '@/lib/business-roles';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

interface AuthProfile {
    id: string;
    user_type: 'trucker' | 'business' | 'admin';
}

type SupabaseErrorLike = {
    code?: string | null;
    details?: string | null;
    hint?: string | null;
    message?: string | null;
};

export const BUSINESS_OPERATIONS_MIGRATION = '025_business_team_mfa_and_plan_checkout.sql';
export const BUSINESS_WAREHOUSE_BILLING_MIGRATION = '023_warehouse_management_and_saas.sql';
export const BUSINESS_PRIVATE_FLEET_MIGRATION = '035_private_fleet_b2b.sql';

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

export function isBusinessTeamMembersTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'business_team_members');
}

export function isBusinessFleetMembersTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'business_fleet_members');
}

export function isUserAppPreferencesTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'user_app_preferences');
}

export function isBillingPlanPaymentAttemptsTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'billing_plan_payment_attempts');
}

export function isBillingPlansTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'billing_plans');
}

export function isBusinessPlanSubscriptionsTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'business_plan_subscriptions');
}

export function isWarehousesTableMissing(error: unknown) {
    return isMissingSupabaseTable(error, 'warehouses');
}

export function getBusinessOperationsSetupMessage() {
    return `Aplica la migracion ${BUSINESS_OPERATIONS_MIGRATION} desde supabase/migrations para habilitar equipo interno, checkout de planes y preferencias de bodega.`;
}

export function getWarehouseBillingSetupMessage() {
    return `Aplica la migracion ${BUSINESS_WAREHOUSE_BILLING_MIGRATION} desde supabase/migrations para habilitar bodegas, planes y limites empresariales.`;
}

export function getBusinessPrivateFleetSetupMessage() {
    return `Aplica la migracion ${BUSINESS_PRIVATE_FLEET_MIGRATION} desde supabase/migrations para habilitar flota privada B2B, custodias y firmas.`;
}

interface BusinessPlanSubscriptionRecord {
    id: string;
    business_id: string;
    plan_code: string;
    status: string;
    current_period_start: string;
    current_period_end: string | null;
    created_at: string;
    updated_at: string;
    plan: BillingPlan | null;
}

interface BusinessTeamMemberSummary {
    id: string;
    business_id: string;
    user_id: string | null;
    invited_email: string;
    role: BusinessTeamRole;
    status: 'invited' | 'active' | 'suspended';
}

interface OwnerWarehouseRecord {
    id: string;
}

interface AssignedWarehouseRecord {
    warehouse_id: string;
    warehouses?: {
        business_id: string;
    } | null;
}

interface UserWarehousePreferenceRecord {
    active_warehouse_id: string | null;
}

export async function getBusinessTeamInfrastructureStatus(supabaseAdmin: AdminClient) {
    const { error } = await supabaseAdmin
        .from('business_team_members')
        .select('id', { count: 'exact', head: true });

    if (!error) {
        return {
            ready: true,
            message: null,
        };
    }

    if (isBusinessTeamMembersTableMissing(error)) {
        return {
            ready: false,
            message: getBusinessOperationsSetupMessage(),
        };
    }

    throw new Error(error.message || 'Could not verify business team infrastructure.');
}

export async function getBillingCheckoutInfrastructureStatus(supabaseAdmin: AdminClient) {
    const { error } = await supabaseAdmin
        .from('billing_plan_payment_attempts')
        .select('id', { count: 'exact', head: true });

    if (!error) {
        return {
            ready: true,
            message: null,
        };
    }

    if (isBillingPlanPaymentAttemptsTableMissing(error)) {
        return {
            ready: false,
            message: getBusinessOperationsSetupMessage(),
        };
    }

    throw new Error(error.message || 'Could not verify billing checkout infrastructure.');
}

export interface WarehouseAccessContext {
    warehouse: {
        id: string;
        business_id: string;
        code: string;
        name: string;
        status: string;
        flow_mode: string;
        department: string;
        city: string;
        address: string;
        description: string | null;
        notes: string | null;
        timezone: string;
        created_at: string;
        updated_at: string;
    };
    membershipRole: WarehouseRole | null;
    capabilities: WarehouseCapabilities;
    isOwner: boolean;
    isAdmin: boolean;
}

const EMPTY_WAREHOUSE_CAPABILITIES: WarehouseCapabilities = {
    viewWarehouseSummary: false,
    viewOperationalDetail: false,
    viewEvidence: false,
    exportData: false,
    manageWarehouseSettings: false,
    manageDocks: false,
    manageTeam: false,
    manageBilling: false,
    manageInventoryAdjustments: false,
    manageAppointments: false,
    manageReceipts: false,
    manageDispatches: false,
    manageTasks: false,
    manageIncidents: false,
};

const WAREHOUSE_ROLE_CAPABILITY_MATRIX: Record<WarehouseRole, WarehouseCapabilities> = {
    owner: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: true,
        manageWarehouseSettings: true,
        manageDocks: true,
        manageTeam: true,
        manageBilling: true,
        manageInventoryAdjustments: true,
        manageAppointments: true,
        manageReceipts: true,
        manageDispatches: true,
        manageTasks: true,
        manageIncidents: true,
    },
    manager: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: true,
        manageWarehouseSettings: true,
        manageDocks: true,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: true,
        manageAppointments: true,
        manageReceipts: true,
        manageDispatches: true,
        manageTasks: true,
        manageIncidents: true,
    },
    ops_manager: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: true,
        manageWarehouseSettings: false,
        manageDocks: false,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: false,
        manageAppointments: true,
        manageReceipts: false,
        manageDispatches: true,
        manageTasks: true,
        manageIncidents: true,
    },
    dispatcher: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: false,
        manageWarehouseSettings: false,
        manageDocks: false,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: false,
        manageAppointments: true,
        manageReceipts: false,
        manageDispatches: true,
        manageTasks: true,
        manageIncidents: true,
    },
    warehouse_manager: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: true,
        manageWarehouseSettings: true,
        manageDocks: true,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: true,
        manageAppointments: true,
        manageReceipts: true,
        manageDispatches: true,
        manageTasks: true,
        manageIncidents: true,
    },
    warehouse_operator: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: false,
        manageWarehouseSettings: false,
        manageDocks: false,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: false,
        manageAppointments: true,
        manageReceipts: true,
        manageDispatches: true,
        manageTasks: true,
        manageIncidents: true,
    },
    finance_accountant: {
        viewWarehouseSummary: true,
        viewOperationalDetail: false,
        viewEvidence: true,
        exportData: true,
        manageWarehouseSettings: false,
        manageDocks: false,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: false,
        manageAppointments: false,
        manageReceipts: false,
        manageDispatches: false,
        manageTasks: false,
        manageIncidents: false,
    },
    operator: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: false,
        manageWarehouseSettings: false,
        manageDocks: false,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: false,
        manageAppointments: true,
        manageReceipts: true,
        manageDispatches: true,
        manageTasks: true,
        manageIncidents: true,
    },
    auditor: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: true,
        manageWarehouseSettings: false,
        manageDocks: false,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: false,
        manageAppointments: false,
        manageReceipts: false,
        manageDispatches: false,
        manageTasks: false,
        manageIncidents: false,
    },
    viewer: {
        viewWarehouseSummary: true,
        viewOperationalDetail: false,
        viewEvidence: false,
        exportData: false,
        manageWarehouseSettings: false,
        manageDocks: false,
        manageTeam: false,
        manageBilling: false,
        manageInventoryAdjustments: false,
        manageAppointments: false,
        manageReceipts: false,
        manageDispatches: false,
        manageTasks: false,
        manageIncidents: false,
    },
    admin: {
        viewWarehouseSummary: true,
        viewOperationalDetail: true,
        viewEvidence: true,
        exportData: true,
        manageWarehouseSettings: true,
        manageDocks: true,
        manageTeam: true,
        manageBilling: true,
        manageInventoryAdjustments: true,
        manageAppointments: true,
        manageReceipts: true,
        manageDispatches: true,
        manageTasks: true,
        manageIncidents: true,
    },
};

export function getWarehouseCapabilities(role: WarehouseRole | null): WarehouseCapabilities {
    if (!role) {
        return { ...EMPTY_WAREHOUSE_CAPABILITIES };
    }

    return { ...WAREHOUSE_ROLE_CAPABILITY_MATRIX[role] };
}

export function hasWarehouseCapability(
    access: Pick<WarehouseAccessContext, 'capabilities'> | null,
    capability: keyof WarehouseCapabilities
) {
    return Boolean(access?.capabilities?.[capability]);
}

export function assertWarehouseCapability(
    access: Pick<WarehouseAccessContext, 'capabilities'> | null,
    capability: keyof WarehouseCapabilities,
    message = 'Warehouse action not permitted for this role.'
) {
    if (!hasWarehouseCapability(access, capability)) {
        throw new Error(message);
    }
}

export interface BusinessPlanSnapshot {
    subscription: BusinessPlanSubscriptionRecord | null;
    plans: BillingPlan[];
    teamSchemaReady: boolean;
    teamSchemaMessage: string | null;
    priceMonthlyCop: number;
    billingCurrencyCode: 'COP' | 'USD' | 'PEN' | 'BRL';
    effectiveLimits: {
        maxWarehouses: number | null;
        maxInternalUsers: number | null;
        maxMonthlyTrips: number | null;
        maxPrivateFleetDrivers: number | null;
    };
    limits: {
        activeWarehouses: number;
        maxWarehouses: number | null;
        activeInternalUsers: number;
        maxInternalUsers: number | null;
        monthlyTrips: number;
        maxMonthlyTrips: number | null;
        activePrivateFleetDrivers: number;
        maxPrivateFleetDrivers: number | null;
        entitlementState: 'pilot_active' | 'pilot_expired' | 'free' | 'paid';
        pilotActive: boolean;
        pilotExpiresAt: string | null;
        pilotDaysRemaining: number | null;
        recommendedPlan: string | null;
    };
}

export interface BusinessAccessContext {
    businessId: string | null;
    teamMember: BusinessTeamMemberSummary | null;
    isOwner: boolean;
    isAdmin: boolean;
    accessibleWarehouseIds: string[];
    activeWarehouseId: string | null;
}

const CHECKOUT_PATH = '/planes';

function getPlanPrice(plan: BillingPlan | null | undefined) {
    return Number(plan?.price_monthly_cop ?? 0) || Math.round(Number(plan?.price_monthly_usd || 0) * 4000);
}

type RawBillingPlanRecord = Partial<BillingPlan> & Record<string, unknown>;

function coerceFiniteNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function coerceNullableInteger(value: unknown) {
    if (value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function coerceBillingCurrency(value: unknown): BillingPlan['billing_currency_code'] {
    return ['COP', 'USD', 'PEN', 'BRL'].includes(String(value)) ? String(value) as BillingPlan['billing_currency_code'] : 'COP';
}

function coerceSupportTier(value: unknown): BillingPlan['support_tier'] {
    return ['email', 'priority', 'premium'].includes(String(value)) ? String(value) as BillingPlan['support_tier'] : 'email';
}

export function normalizeBillingPlan(plan: RawBillingPlanRecord): BillingPlan {
    const priceMonthlyUsd = coerceFiniteNumber(plan.price_monthly_usd, 0);

    return {
        code: String(plan.code || 'free'),
        name: String(plan.name || plan.code || 'Free'),
        tagline: typeof plan.tagline === 'string' ? plan.tagline : null,
        price_monthly_usd: priceMonthlyUsd,
        price_monthly_cop: coerceFiniteNumber(plan.price_monthly_cop, Math.round(priceMonthlyUsd * 4000)),
        billing_currency_code: coerceBillingCurrency(plan.billing_currency_code),
        max_warehouses: coerceNullableInteger(plan.max_warehouses),
        max_internal_users: coerceNullableInteger(plan.max_internal_users),
        max_monthly_trips: coerceNullableInteger(plan.max_monthly_trips),
        max_private_fleet_drivers: coerceNullableInteger(plan.max_private_fleet_drivers),
        includes_inventory: Boolean(plan.includes_inventory),
        includes_locations: Boolean(plan.includes_locations),
        includes_receipts: Boolean(plan.includes_receipts),
        includes_dispatches: Boolean(plan.includes_dispatches),
        includes_analytics: Boolean(plan.includes_analytics),
        includes_api_webhooks: Boolean(plan.includes_api_webhooks),
        includes_multi_client_3pl: Boolean(plan.includes_multi_client_3pl),
        is_public: plan.is_public !== false,
        support_tier: coerceSupportTier(plan.support_tier),
        feature_matrix: plan.feature_matrix && typeof plan.feature_matrix === 'object'
            ? plan.feature_matrix as Record<string, unknown>
            : {},
        created_at: typeof plan.created_at === 'string' ? plan.created_at : new Date(0).toISOString(),
        updated_at: typeof plan.updated_at === 'string' ? plan.updated_at : new Date(0).toISOString(),
    };
}

export function normalizeBillingPlans(plans: RawBillingPlanRecord[] | null | undefined) {
    return (plans || [])
        .map(normalizeBillingPlan)
        .filter((plan) => plan.is_public !== false)
        .sort((left, right) => getPlanPrice(left) - getPlanPrice(right));
}

export async function loadBillingPlans(supabaseAdmin: AdminClient) {
    const plansResponse = await supabaseAdmin
        .from('billing_plans')
        .select('*');

    if (plansResponse.error) {
        if (isBillingPlansTableMissing(plansResponse.error)) {
            throw new Error(getWarehouseBillingSetupMessage());
        }

        throw new Error(plansResponse.error.message || 'Could not load billing plans.');
    }

    return normalizeBillingPlans(plansResponse.data as RawBillingPlanRecord[] | null);
}

function formatPlanLimitMessage(limit: number, subject: string) {
    return `Limite de plan alcanzado. Tu plan actual permite ${limit} ${subject}.`;
}

type PlanLimitFeatureKey = 'warehouse_limit' | 'team_limit' | 'monthly_trip_limit' | 'private_fleet_limit';

export class PlanLimitError extends Error {
    readonly featureKey: PlanLimitFeatureKey;
    readonly currentUsage: number;
    readonly limitValue: number;
    readonly recommendedPlan: string | null;
    readonly checkoutPath = CHECKOUT_PATH;

    constructor(payload: {
        featureKey: PlanLimitFeatureKey;
        currentUsage: number;
        limitValue: number;
        subject: string;
        recommendedPlan: string | null;
    }) {
        super(formatPlanLimitMessage(payload.limitValue, payload.subject));
        this.name = 'PlanLimitError';
        this.featureKey = payload.featureKey;
        this.currentUsage = payload.currentUsage;
        this.limitValue = payload.limitValue;
        this.recommendedPlan = payload.recommendedPlan;
    }
}

export function isPlanLimitError(error: unknown): error is PlanLimitError {
    return error instanceof PlanLimitError || (
        Boolean(error) &&
        typeof error === 'object' &&
        (error as { name?: string }).name === 'PlanLimitError'
    );
}

export function getPlanLimitErrorDetails(error: PlanLimitError) {
    return {
        featureKey: error.featureKey,
        currentUsage: error.currentUsage,
        limitValue: error.limitValue,
        recommendedPlan: error.recommendedPlan,
        checkoutPath: error.checkoutPath,
    };
}

function getRecommendedPlanForUsage(
    snapshot: BusinessPlanSnapshot,
    usage: Partial<{
        activeWarehouses: number;
        activeInternalUsers: number;
        monthlyTrips: number;
        activePrivateFleetDrivers: number;
    }>
) {
    return resolveRecommendedPlan(snapshot.plans, {
        activeWarehouses: usage.activeWarehouses ?? snapshot.limits.activeWarehouses,
        activeInternalUsers: usage.activeInternalUsers ?? snapshot.limits.activeInternalUsers,
        monthlyTrips: usage.monthlyTrips ?? snapshot.limits.monthlyTrips,
        activePrivateFleetDrivers: usage.activePrivateFleetDrivers ?? snapshot.limits.activePrivateFleetDrivers,
    });
}

export function getPlanUsageBlockingReason(
    plan: BillingPlan,
    limits: BusinessPlanSnapshot['limits']
) {
    if (plan.max_warehouses !== null && limits.activeWarehouses > plan.max_warehouses) {
        return `Reduce bodegas activas: tienes ${limits.activeWarehouses} y ${plan.name} permite ${plan.max_warehouses}.`;
    }

    if (plan.max_internal_users !== null && limits.activeInternalUsers > plan.max_internal_users) {
        return `Reduce usuarios internos: tienes ${limits.activeInternalUsers} y ${plan.name} permite ${plan.max_internal_users}.`;
    }

    if (plan.max_monthly_trips !== null && limits.monthlyTrips > plan.max_monthly_trips) {
        return `Reduce viajes del mes: llevas ${limits.monthlyTrips} y ${plan.name} permite ${plan.max_monthly_trips}.`;
    }

    if (plan.max_private_fleet_drivers !== null && limits.activePrivateFleetDrivers > plan.max_private_fleet_drivers) {
        return `Reduce conductores privados: tienes ${limits.activePrivateFleetDrivers} y ${plan.name} permite ${plan.max_private_fleet_drivers}.`;
    }

    return null;
}

function getBillingPlanAction(
    targetPlan: BillingPlan,
    currentPlan: BillingPlan | null,
    limits: BusinessPlanSnapshot['limits']
) {
    if (currentPlan?.code === targetPlan.code) {
        return {
            action_state: 'current' as const,
            action_label: 'Plan actual',
            action_disabled_reason: null,
        };
    }

    const targetPrice = getPlanPrice(targetPlan);
    const currentPrice = getPlanPrice(currentPlan);

    // Downgrade: always check usage limits first
    if (targetPrice <= currentPrice) {
        const blockingReason = getPlanUsageBlockingReason(targetPlan, limits);

        if (blockingReason) {
            return {
                action_state: 'blocked_by_usage' as const,
                action_label: 'Ajusta tu uso',
                action_disabled_reason: blockingReason,
            };
        }

        return {
            action_state: 'switch_now' as const,
            action_label: targetPrice < currentPrice ? 'Cambiar sin pago adicional' : 'Cambiar ahora',
            action_disabled_reason: null,
        };
    }

    // Upgrade: requires payment via Mercado Pago checkout
    // Webhook at /api/payments/webhook handles billing_plan references
    // and auto-activates the plan upon approved payment
    return {
        action_state: 'checkout' as const,
        action_label: 'Activar plan',
        action_disabled_reason: null,
    };
}

function planAllowsUsage(plan: BillingPlan, limits: {
    activeWarehouses: number;
    activeInternalUsers: number;
    monthlyTrips: number;
    activePrivateFleetDrivers: number;
}) {
    return (
        (plan.max_warehouses === null || limits.activeWarehouses <= plan.max_warehouses) &&
        (plan.max_internal_users === null || limits.activeInternalUsers <= plan.max_internal_users) &&
        (plan.max_monthly_trips === null || limits.monthlyTrips <= plan.max_monthly_trips) &&
        (plan.max_private_fleet_drivers === null || limits.activePrivateFleetDrivers <= plan.max_private_fleet_drivers)
    );
}

function resolveRecommendedPlan(plans: BillingPlan[], limits: {
    activeWarehouses: number;
    activeInternalUsers: number;
    monthlyTrips: number;
    activePrivateFleetDrivers: number;
}) {
    return (
        plans
            .filter((plan) => plan.code !== 'free' && plan.is_public !== false)
            .sort((left, right) => getPlanPrice(left) - getPlanPrice(right))
            .find((plan) => planAllowsUsage(plan, limits))?.code
        || 'enterprise'
    );
}

export async function getBusinessPlanSnapshot(
    supabaseAdmin: AdminClient,
    businessId: string
): Promise<BusinessPlanSnapshot> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [normalizedPlans, subscriptionResponse, warehousesResponse, activeTeamCountResponse, monthlyTripsResponse, privateFleetCountResponse, pilotResponse] = await Promise.all([
        loadBillingPlans(supabaseAdmin),
        supabaseAdmin
            .from('business_plan_subscriptions')
            .select('id, business_id, plan_code, status, current_period_start, current_period_end, created_at, updated_at')
            .eq('business_id', businessId)
            .maybeSingle(),
        supabaseAdmin
            .from('warehouses')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('status', 'active'),
        supabaseAdmin
            .from('business_team_members')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('status', 'active'),
        supabaseAdmin
            .from('cargo_offers')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .gte('created_at', monthStart.toISOString()),
        supabaseAdmin
            .from('business_fleet_members')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('status', 'active'),
        supabaseAdmin
            .from('business_pilot_flags')
            .select('*')
            .eq('business_id', businessId)
            .maybeSingle(),
    ]);

    if (subscriptionResponse.error) {
        if (isBusinessPlanSubscriptionsTableMissing(subscriptionResponse.error)) {
            throw new Error(getWarehouseBillingSetupMessage());
        }

        throw new Error(subscriptionResponse.error.message || 'Could not load current business subscription.');
    }

    if (warehousesResponse.error) {
        if (isWarehousesTableMissing(warehousesResponse.error)) {
            throw new Error(getWarehouseBillingSetupMessage());
        }

        throw new Error(warehousesResponse.error.message || 'Could not load warehouse usage.');
    }

    if (monthlyTripsResponse.error) {
        throw new Error(monthlyTripsResponse.error.message || 'Could not load monthly trip usage.');
    }

    let teamSchemaReady = true;
    let teamSchemaMessage: string | null = null;
    let activeTeamCount = activeTeamCountResponse.count || 0;
    let activePrivateFleetDrivers = privateFleetCountResponse.count || 0;

    if (activeTeamCountResponse.error) {
        if (isBusinessTeamMembersTableMissing(activeTeamCountResponse.error)) {
            teamSchemaReady = false;
            teamSchemaMessage = getBusinessOperationsSetupMessage();
            activeTeamCount = 1;
        } else {
            throw new Error(activeTeamCountResponse.error.message || 'Could not load business team usage.');
        }
    }

    if (privateFleetCountResponse.error) {
        if (isBusinessFleetMembersTableMissing(privateFleetCountResponse.error)) {
            activePrivateFleetDrivers = 0;
        } else {
            throw new Error(privateFleetCountResponse.error.message || 'Could not load private fleet usage.');
        }
    }

    const subscriptionData = (subscriptionResponse.data as Omit<BusinessPlanSubscriptionRecord, 'plan'> | null) || null;
    const normalizedSubscription = subscriptionData
        ? {
            ...subscriptionData,
            plan: normalizedPlans.find((plan) => plan.code === subscriptionData.plan_code) || null,
        }
        : null;
    const pilotFlag = pilotResponse.error ? null : (pilotResponse.data as {
        enabled?: boolean | null;
        pilot_expires_at?: string | null;
        max_warehouses?: number | null;
        max_internal_users?: number | null;
        max_private_fleet_drivers?: number | null;
        max_monthly_trips?: number | null;
    } | null);
    const paidPlanActive = Boolean(
        normalizedSubscription?.status &&
        ['active', 'trialing'].includes(normalizedSubscription.status) &&
        normalizedSubscription.plan_code !== 'free'
    );
    const pilotActive = Boolean(
        !paidPlanActive &&
        pilotFlag?.enabled
        && (!pilotFlag.pilot_expires_at || new Date(pilotFlag.pilot_expires_at).getTime() > Date.now())
    );
    const pilotExpired = Boolean(
        !paidPlanActive &&
        pilotFlag?.enabled &&
        pilotFlag.pilot_expires_at &&
        new Date(pilotFlag.pilot_expires_at).getTime() <= Date.now()
    );
    const pilotDaysRemaining = pilotActive && pilotFlag?.pilot_expires_at
        ? Math.max(0, Math.ceil((new Date(pilotFlag.pilot_expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : null;
    const currentPlan =
        normalizedSubscription?.plan ||
        normalizedPlans.find((plan) => plan.code === 'free') ||
        null;
    const baseUsage = {
        activeWarehouses: warehousesResponse.count || 0,
        activeInternalUsers: activeTeamCount || 0,
        monthlyTrips: monthlyTripsResponse.count || 0,
        activePrivateFleetDrivers,
    };
    const recommendedPlan = resolveRecommendedPlan(normalizedPlans, baseUsage);
    const limits = {
        activeWarehouses: baseUsage.activeWarehouses,
        maxWarehouses: pilotActive ? (pilotFlag?.max_warehouses ?? 5) : (currentPlan?.max_warehouses ?? null),
        activeInternalUsers: baseUsage.activeInternalUsers,
        maxInternalUsers: pilotActive ? (pilotFlag?.max_internal_users ?? 20) : (currentPlan?.max_internal_users ?? null),
        monthlyTrips: baseUsage.monthlyTrips,
        maxMonthlyTrips: pilotActive ? (pilotFlag?.max_monthly_trips ?? 500) : (currentPlan?.max_monthly_trips ?? null),
        activePrivateFleetDrivers: baseUsage.activePrivateFleetDrivers,
        maxPrivateFleetDrivers: pilotActive ? (pilotFlag?.max_private_fleet_drivers ?? 50) : (currentPlan?.max_private_fleet_drivers ?? null),
        entitlementState: paidPlanActive ? 'paid' as const : pilotActive ? 'pilot_active' as const : pilotExpired ? 'pilot_expired' as const : 'free' as const,
        pilotActive,
        pilotExpiresAt: pilotFlag?.pilot_expires_at || null,
        pilotDaysRemaining,
        recommendedPlan,
    };
    const effectiveLimits = {
        maxWarehouses: limits.maxWarehouses,
        maxInternalUsers: limits.maxInternalUsers,
        maxMonthlyTrips: limits.maxMonthlyTrips,
        maxPrivateFleetDrivers: limits.maxPrivateFleetDrivers,
    };

    return {
        subscription: normalizedSubscription
            ? {
                ...normalizedSubscription,
                plan: currentPlan,
            }
            : currentPlan
                ? {
                    id: 'virtual-free-plan',
                    business_id: businessId,
                    plan_code: currentPlan.code,
                    status: 'active',
                    current_period_start: new Date().toISOString(),
                    current_period_end: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    plan: currentPlan,
                }
                : null,
        plans: normalizedPlans.map((plan) => ({
            ...plan,
            ...getBillingPlanAction(plan, currentPlan, limits),
        })),
        teamSchemaReady,
        teamSchemaMessage,
        priceMonthlyCop: getPlanPrice(currentPlan),
        billingCurrencyCode: currentPlan?.billing_currency_code || 'COP',
        effectiveLimits,
        limits,
    };
}

export async function resolveBusinessAccessContext(
    supabaseAdmin: AdminClient,
    authUserId: string,
    profile: AuthProfile | null
): Promise<BusinessAccessContext> {
    if (profile?.user_type === 'admin') {
        return {
            businessId: null,
            teamMember: null,
            isOwner: false,
            isAdmin: true,
            accessibleWarehouseIds: [],
            activeWarehouseId: null,
        };
    }

    if (profile?.user_type !== 'business') {
        return {
            businessId: null,
            teamMember: null,
            isOwner: false,
            isAdmin: false,
            accessibleWarehouseIds: [],
            activeWarehouseId: null,
        };
    }

    const [teamMemberResponse, ownerBusinessProfileResponse] = await Promise.all([
        supabaseAdmin
            .from('business_team_members')
            .select('id, business_id, user_id, invited_email, role, status')
            .eq('user_id', authUserId)
            .eq('status', 'active')
            .order('created_at', { ascending: true })
            .maybeSingle(),
        supabaseAdmin
            .from('business_profiles')
            .select('user_id')
            .eq('user_id', authUserId)
            .maybeSingle(),
    ]);

    if (ownerBusinessProfileResponse.error) {
        throw new Error(ownerBusinessProfileResponse.error.message || 'Could not resolve business profile.');
    }

    const teamMember = teamMemberResponse.error
        ? (() => {
            if (isBusinessTeamMembersTableMissing(teamMemberResponse.error)) {
                return null;
            }

            throw new Error(teamMemberResponse.error.message || 'Could not resolve business team membership.');
        })()
        : (teamMemberResponse.data as BusinessTeamMemberSummary | null);
    const ownerBusinessProfile = ownerBusinessProfileResponse.data as { user_id: string } | null;
    const businessId = teamMember?.business_id || ownerBusinessProfile?.user_id || null;
    const isOwner = teamMember?.role === 'owner' || businessId === authUserId;

    if (!businessId) {
        return {
            businessId: null,
            teamMember: null,
            isOwner: false,
            isAdmin: false,
            accessibleWarehouseIds: [],
            activeWarehouseId: null,
        };
    }

    const [warehouseMembershipsResponse, preferenceResponse] = await Promise.all([
        isOwner
            ? supabaseAdmin
                .from('warehouses')
                .select('id')
                .eq('business_id', businessId)
            : supabaseAdmin
                .from('warehouse_members')
                .select('warehouse_id, warehouses!inner(id, business_id)')
                .eq('user_id', authUserId)
                .eq('active', true),
        supabaseAdmin
            .from('user_app_preferences')
            .select('active_warehouse_id')
            .eq('user_id', authUserId)
            .maybeSingle(),
    ]);

    if (warehouseMembershipsResponse.error) {
        if (isWarehousesTableMissing(warehouseMembershipsResponse.error)) {
            throw new Error(getWarehouseBillingSetupMessage());
        }

        throw new Error(warehouseMembershipsResponse.error.message || 'Could not load warehouse memberships.');
    }

    const preference = preferenceResponse.error
        ? (() => {
            if (isUserAppPreferencesTableMissing(preferenceResponse.error)) {
                return null;
            }

            throw new Error(preferenceResponse.error.message || 'Could not load user warehouse preferences.');
        })()
        : (preferenceResponse.data as UserWarehousePreferenceRecord | null);
    const warehouseMemberships = (warehouseMembershipsResponse.data || []) as Array<OwnerWarehouseRecord | AssignedWarehouseRecord>;
    const accessibleWarehouseIds = isOwner
        ? (warehouseMemberships as OwnerWarehouseRecord[]).map((warehouse) => warehouse.id)
        : (warehouseMemberships as AssignedWarehouseRecord[])
            .filter((membership) => membership.warehouses?.business_id === businessId)
            .map((membership) => membership.warehouse_id);

    const activeWarehouseId = accessibleWarehouseIds.includes(preference?.active_warehouse_id || '')
        ? preference?.active_warehouse_id || null
        : accessibleWarehouseIds[0] || null;

    return {
        businessId,
        teamMember: teamMember || null,
        isOwner,
        isAdmin: false,
        accessibleWarehouseIds,
        activeWarehouseId,
    };
}

export async function ensureWarehouseAccess(
    supabaseAdmin: AdminClient,
    authUserId: string,
    profile: AuthProfile | null,
    warehouseId: string
): Promise<WarehouseAccessContext | null> {
    const { data: warehouse } = await supabaseAdmin
        .from('warehouses')
        .select('*')
        .eq('id', warehouseId)
        .maybeSingle();

    if (!warehouse) {
        return null;
    }

    const isAdmin = profile?.user_type === 'admin';
    const isOwner = warehouse.business_id === authUserId;

    if (isAdmin || isOwner) {
        const membershipRole: WarehouseRole = isAdmin ? 'admin' : 'owner';
        return {
            warehouse,
            membershipRole,
            capabilities: getWarehouseCapabilities(membershipRole),
            isOwner,
            isAdmin,
        };
    }

    const { data: membership } = await supabaseAdmin
        .from('warehouse_members')
        .select('role, active')
        .eq('warehouse_id', warehouseId)
        .eq('user_id', authUserId)
        .eq('active', true)
        .maybeSingle();

    if (!membership) {
        return null;
    }

    const membershipRole = membership.role as WarehouseRole;

    return {
        warehouse,
        membershipRole,
        capabilities: getWarehouseCapabilities(membershipRole),
        isOwner: false,
        isAdmin: false,
    };
}

export async function enforceWarehouseCreateLimit(
    supabaseAdmin: AdminClient,
    businessId: string
) {
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);

    if (
        snapshot.limits.maxWarehouses !== null &&
        snapshot.limits.activeWarehouses >= snapshot.limits.maxWarehouses
    ) {
        const nextUsage = snapshot.limits.activeWarehouses + 1;
        throw new PlanLimitError({
            featureKey: 'warehouse_limit',
            currentUsage: nextUsage,
            limitValue: snapshot.limits.maxWarehouses,
            subject: 'bodegas activas',
            recommendedPlan: getRecommendedPlanForUsage(snapshot, { activeWarehouses: nextUsage }),
        });
    }

    return snapshot;
}

export async function enforceWarehouseActivationLimit(
    supabaseAdmin: AdminClient,
    businessId: string,
    nextActivationDelta = 1
) {
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);

    if (
        snapshot.limits.maxWarehouses !== null &&
        snapshot.limits.activeWarehouses + nextActivationDelta > snapshot.limits.maxWarehouses
    ) {
        const nextUsage = snapshot.limits.activeWarehouses + nextActivationDelta;
        throw new PlanLimitError({
            featureKey: 'warehouse_limit',
            currentUsage: nextUsage,
            limitValue: snapshot.limits.maxWarehouses,
            subject: 'bodegas activas',
            recommendedPlan: getRecommendedPlanForUsage(snapshot, { activeWarehouses: nextUsage }),
        });
    }

    return snapshot;
}

export async function enforceBusinessTeamSeatLimit(
    supabaseAdmin: AdminClient,
    businessId: string,
    nextSeatDelta = 1
) {
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);

    if (
        snapshot.limits.maxInternalUsers !== null &&
        snapshot.limits.activeInternalUsers + nextSeatDelta > snapshot.limits.maxInternalUsers
    ) {
        const nextUsage = snapshot.limits.activeInternalUsers + nextSeatDelta;
        throw new PlanLimitError({
            featureKey: 'team_limit',
            currentUsage: nextUsage,
            limitValue: snapshot.limits.maxInternalUsers,
            subject: 'usuarios internos activos',
            recommendedPlan: getRecommendedPlanForUsage(snapshot, { activeInternalUsers: nextUsage }),
        });
    }

    return snapshot;
}

export async function enforceMonthlyTripLimit(
    supabaseAdmin: AdminClient,
    businessId: string,
    nextTripDelta = 1
) {
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);

    if (
        snapshot.limits.maxMonthlyTrips !== null &&
        snapshot.limits.monthlyTrips + nextTripDelta > snapshot.limits.maxMonthlyTrips
    ) {
        const nextUsage = snapshot.limits.monthlyTrips + nextTripDelta;
        throw new PlanLimitError({
            featureKey: 'monthly_trip_limit',
            currentUsage: nextUsage,
            limitValue: snapshot.limits.maxMonthlyTrips,
            subject: 'viajes al mes',
            recommendedPlan: getRecommendedPlanForUsage(snapshot, { monthlyTrips: nextUsage }),
        });
    }

    return snapshot;
}

export async function enforcePrivateFleetDriverLimit(
    supabaseAdmin: AdminClient,
    businessId: string,
    nextDriverDelta = 1
) {
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);

    if (
        snapshot.limits.maxPrivateFleetDrivers !== null &&
        snapshot.limits.activePrivateFleetDrivers + nextDriverDelta > snapshot.limits.maxPrivateFleetDrivers
    ) {
        const nextUsage = snapshot.limits.activePrivateFleetDrivers + nextDriverDelta;
        throw new PlanLimitError({
            featureKey: 'private_fleet_limit',
            currentUsage: nextUsage,
            limitValue: snapshot.limits.maxPrivateFleetDrivers,
            subject: 'conductores privados activos',
            recommendedPlan: getRecommendedPlanForUsage(snapshot, { activePrivateFleetDrivers: nextUsage }),
        });
    }

    return snapshot;
}

export async function enforcePlanFeature(
    supabaseAdmin: AdminClient,
    businessId: string,
    feature: 'includes_inventory' | 'includes_locations' | 'includes_receipts' | 'includes_dispatches' | 'includes_analytics'
) {
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);
    const currentPlan = snapshot.subscription?.plan;

    if (!currentPlan?.[feature]) {
        throw new Error('Current plan does not include this warehouse capability.');
    }

    return snapshot;
}

export async function setActiveWarehousePreference(
    supabaseAdmin: AdminClient,
    userId: string,
    warehouseId: string | null
) {
    const { error } = await supabaseAdmin
        .from('user_app_preferences')
        .upsert(
            {
                user_id: userId,
                active_warehouse_id: warehouseId,
            },
            { onConflict: 'user_id' }
        );

    if (error && !isUserAppPreferencesTableMissing(error)) {
        throw new Error(error.message);
    }
}

export async function getOrCreateWarehouseSku(
    supabaseAdmin: AdminClient,
    businessId: string,
    payload: {
        skuCode: string;
        skuName: string;
        unit?: string;
        description?: string;
    }
) {
    const { data: existingSku } = await supabaseAdmin
        .from('warehouse_skus')
        .select('*')
        .eq('business_id', businessId)
        .eq('sku_code', payload.skuCode)
        .maybeSingle();

    if (existingSku) {
        return existingSku;
    }

    const { data: sku, error } = await supabaseAdmin
        .from('warehouse_skus')
        .insert({
            business_id: businessId,
            sku_code: payload.skuCode,
            name: payload.skuName,
            unit: payload.unit || 'unidad',
            description: payload.description || null,
        })
        .select('*')
        .single();

    if (error || !sku) {
        throw new Error(error?.message || 'Could not create SKU');
    }

    return sku;
}

export async function getOrCreateWarehouseLocation(
    supabaseAdmin: AdminClient,
    warehouseId: string,
    payload: {
        locationCode?: string | null;
        locationType?: 'receiving' | 'storage' | 'picking' | 'dispatch' | 'quarantine';
    }
) {
    if (!payload.locationCode) {
        return null;
    }

    const { data: existingLocation } = await supabaseAdmin
        .from('warehouse_locations')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .eq('code', payload.locationCode)
        .maybeSingle();

    if (existingLocation) {
        return existingLocation;
    }

    const { data: location, error } = await supabaseAdmin
        .from('warehouse_locations')
        .insert({
            warehouse_id: warehouseId,
            code: payload.locationCode,
            location_type: payload.locationType || 'storage',
            status: 'active',
        })
        .select('*')
        .single();

    if (error || !location) {
        throw new Error(error?.message || 'Could not create warehouse location');
    }

    return location;
}

export async function applyStockDelta(
    supabaseAdmin: AdminClient,
    payload: {
        warehouseId: string;
        businessId: string;
        skuCode: string;
        skuName: string;
        quantityDelta: number;
        locationCode?: string | null;
        locationType?: 'receiving' | 'storage' | 'picking' | 'dispatch' | 'quarantine';
        lotCode?: string | null;
        expiresAt?: string | null;
        movementType: 'receipt' | 'dispatch' | 'adjustment' | 'return' | 'reservation' | 'release';
        referenceType?: string | null;
        referenceId?: string | null;
        performedBy?: string | null;
        notes?: string | null;
        metadata?: Record<string, unknown>;
    }
) {
    const sku = await getOrCreateWarehouseSku(supabaseAdmin, payload.businessId, {
        skuCode: payload.skuCode,
        skuName: payload.skuName,
    });

    const location = await getOrCreateWarehouseLocation(supabaseAdmin, payload.warehouseId, {
        locationCode: payload.locationCode,
        locationType: payload.locationType,
    });

    const { data: existingBalances } = await supabaseAdmin
        .from('warehouse_stock_balances')
        .select('*')
        .eq('warehouse_id', payload.warehouseId)
        .eq('sku_id', sku.id);

    const currentBalance = (existingBalances || []).find((balance) => {
        const sameLocation = (balance.location_id || null) === (location?.id || null);
        const sameLot = (balance.lot_code || null) === (payload.lotCode || null);
        return sameLocation && sameLot;
    });

    const currentOnHand = Number(currentBalance?.quantity_on_hand || 0);
    const nextOnHand = currentOnHand + payload.quantityDelta;

    if (nextOnHand < 0) {
        throw new Error(`Insufficient stock for SKU ${payload.skuCode}`);
    }

    let balanceRecord = currentBalance;

    if (balanceRecord) {
        const { data: updatedBalance, error: updateError } = await supabaseAdmin
            .from('warehouse_stock_balances')
            .update({
                quantity_on_hand: nextOnHand,
                expires_at: payload.expiresAt || balanceRecord.expires_at || null,
            })
            .eq('id', balanceRecord.id)
            .select('*')
            .single();

        if (updateError || !updatedBalance) {
            throw new Error(updateError?.message || 'Could not update stock balance');
        }

        balanceRecord = updatedBalance;
    } else {
        const { data: createdBalance, error: createError } = await supabaseAdmin
            .from('warehouse_stock_balances')
            .insert({
                warehouse_id: payload.warehouseId,
                sku_id: sku.id,
                location_id: location?.id || null,
                lot_code: payload.lotCode || null,
                expires_at: payload.expiresAt || null,
                quantity_on_hand: nextOnHand,
                quantity_reserved: 0,
            })
            .select('*')
            .single();

        if (createError || !createdBalance) {
            throw new Error(createError?.message || 'Could not create stock balance');
        }

        balanceRecord = createdBalance;
    }

    const { error: movementError } = await supabaseAdmin.from('warehouse_stock_movements').insert({
        warehouse_id: payload.warehouseId,
        sku_id: sku.id,
        location_id: location?.id || null,
        movement_type: payload.movementType,
        quantity_delta: payload.quantityDelta,
        reference_type: payload.referenceType || null,
        reference_id: payload.referenceId || null,
        performed_by: payload.performedBy || null,
        notes: payload.notes || null,
        metadata: payload.metadata || {},
    });

    if (movementError) {
        throw new Error(movementError.message);
    }

    return {
        ...balanceRecord,
        quantity_on_hand: nextOnHand,
        sku,
        location,
    };
}

export async function createWarehouseIncidentNotification(
    supabaseAdmin: AdminClient,
    payload: {
        warehouseId: string;
        warehouseName: string;
        incidentId: string;
        title: string;
        severity: string;
        offerId?: string | null;
    }
) {
    await createAdminNotification(supabaseAdmin, {
        type: 'warehouse_incident',
        title: `Warehouse incident: ${payload.title}`,
        message: `${payload.warehouseName} reported a ${payload.severity} severity incident.`,
        data: {
            warehouseId: payload.warehouseId,
            incidentId: payload.incidentId,
            offerId: payload.offerId || null,
            severity: payload.severity,
        },
    });
}
