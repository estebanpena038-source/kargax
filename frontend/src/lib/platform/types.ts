export type OperationDomain =
    | 'auth'
    | 'payments'
    | 'wallet'
    | 'payouts'
    | 'lending'
    | 'warehouse'
    | 'holding'
    | 'support'
    | 'platform'
    | 'onboarding'
    | 'market';

export type OperationStatus = 'queued' | 'success' | 'warning' | 'error';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type SupportPriority = 'low' | 'medium' | 'high' | 'critical';
export type SupportStatus = 'open' | 'investigating' | 'waiting_customer' | 'resolved' | 'closed';
export type ReplayAction =
    | 'reconcile_payment'
    | 'resend_pin'
    | 'retry_notification'
    | 'retry_webhook_follow_up'
    | 'rerun_settlement_side_effects';

export interface FeatureFlagSnapshot {
    key: string;
    enabled: boolean;
    scope: 'global' | 'country';
    source: 'env' | 'database' | 'default';
    description?: string | null;
    country_code?: string | null;
    payload?: Record<string, unknown> | null;
}

export type SupportedMarketCountryCode = 'CO' | 'PE' | 'EC' | 'BR';

export interface CountryRegistryEntry {
    country_code: SupportedMarketCountryCode;
    display_name: string;
    locale_default: string;
    currency_code: string;
    timezone_default: string;
    phone_country_code: string;
    phone_pattern: string;
    document_types: Array<{ code: string; label: string }>;
    fiscal_label: string;
    supported_rails: {
        payments: string[];
        payouts: string[];
        notifications: string[];
        billing: string[];
    };
    legal_links: {
        terms: string;
        privacy: string;
        support: string;
    };
    environment_urls: {
        app: string;
        checkout: string;
        support: string;
    };
    seed_regions: string[];
    feature_flags: Record<string, unknown>;
    is_backend_ready: boolean;
    is_visible: boolean;
}

export interface ProviderAdapterConfig {
    country_code: CountryRegistryEntry['country_code'];
    provider_kind: 'payments' | 'payouts' | 'notifications' | 'billing';
    adapter_key: string;
    status: 'active' | 'controlled' | 'placeholder' | 'disabled';
    config: Record<string, unknown>;
}

export interface OperationEvent {
    id: string;
    request_id: string;
    actor_user_id: string | null;
    actor_type: 'system' | 'user' | 'admin' | 'internal' | 'anonymous';
    domain: OperationDomain;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    entity_ids: Record<string, unknown>;
    business_id: string | null;
    holding_account_id: string | null;
    country_code: string;
    status: OperationStatus;
    error_class: string | null;
    replayable: boolean;
    replay_action: ReplayAction | null;
    source_reference: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface PlatformIncident {
    id: string;
    operation_event_id: string | null;
    request_id: string;
    domain: OperationDomain;
    severity: IncidentSeverity;
    status: IncidentStatus;
    title: string;
    detail: string | null;
    runbook_key: string;
    replayable: boolean;
    replay_action: ReplayAction | null;
    replay_payload: Record<string, unknown>;
    business_id: string | null;
    holding_account_id: string | null;
    country_code: string;
    error_class: string | null;
    source_reference: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
    operation_event?: OperationEvent | null;
}

export interface SupportRequest {
    id: string;
    request_id: string;
    requester_name: string;
    requester_email: string;
    requested_by: string | null;
    business_id: string | null;
    holding_account_id: string | null;
    country_code: string;
    domain: Exclude<OperationDomain, 'auth'>;
    priority: SupportPriority;
    status: SupportStatus;
    preferred_contact_channel: 'email' | 'phone' | 'whatsapp' | 'slack';
    subject: string;
    description: string;
    sla_due_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface RunbookSummary {
    key: string;
    title: string;
    domain: OperationDomain;
    severity: IncidentSeverity;
    sla: string;
    owner: string;
    file_path: string;
}

export interface OnboardingChecklistItem {
    key: string;
    title: string;
    owner_team: 'implementation' | 'ops' | 'finance' | 'success' | 'admin';
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    notes?: string | null;
    callout?: string | null;
}

export interface OnboardingChecklist {
    motion: 'Enterprise B2B';
    onboarding_model: 'assisted_implementation';
    support_model: 'extended_hours_on_call_critical';
    persona: 'Owner/CEO' | 'Ops lead' | 'Finance lead';
    checklist: OnboardingChecklistItem[];
    bootstrap_path: string;
    playbook_path: string;
}

export interface MarketContext {
    current_country_code: CountryRegistryEntry['country_code'];
    current_locale: string;
    current_currency: string;
    timezone: string;
    country: CountryRegistryEntry;
    available_countries: CountryRegistryEntry[];
    provider_adapters: ProviderAdapterConfig[];
    feature_flags: FeatureFlagSnapshot[];
    visibility: {
        market_open: boolean;
        backend_ready: boolean;
        visible_in_ui: boolean;
    };
    commercial_motion: 'Enterprise B2B';
}

export interface DomainSlo {
    key: 'auth' | 'payments' | 'wallet' | 'warehouse' | 'admin_support';
    title: string;
    target: string;
    severity_owner: string;
    runbook_key: string;
}

export type LaunchReadinessStatus = 'passed' | 'warning' | 'blocked' | 'pending_manual';
export type SmokeJourneyStatus = 'ready' | 'needs_evidence' | 'blocked' | 'passed';
export type RiskStatus = 'open' | 'partial' | 'mitigated';
export type ScorecardGateStatus = 'passed' | 'partial' | 'blocked';

export interface LaunchReadinessItem {
    key: string;
    title: string;
    status: LaunchReadinessStatus;
    source: 'repo' | 'runtime' | 'env' | 'manual';
    blocking: boolean;
    detail: string;
    evidence_path?: string | null;
}

export interface LaunchReadinessSnapshot {
    status: Exclude<LaunchReadinessStatus, 'pending_manual'>;
    items: LaunchReadinessItem[];
}

export interface SmokeJourney {
    key: string;
    title: string;
    actors: string[];
    status: SmokeJourneyStatus;
    automation: 'manual' | 'hybrid';
    evidence_path: string;
    notes: string;
}

export interface SmokeSuiteSnapshot {
    status: Exclude<SmokeJourneyStatus, 'passed'>;
    journeys: SmokeJourney[];
}

export interface RiskRegisterItem {
    key: string;
    category: string;
    risk: string;
    owner: string;
    early_signal: string;
    mitigation: string;
    status: RiskStatus;
    review_cadence: string;
    blocker: boolean;
}

export interface RiskSummary {
    blockers_open: number;
    open_total: number;
    partially_mitigated: number;
    mitigated_total: number;
    top_blockers: RiskRegisterItem[];
    items: RiskRegisterItem[];
}

export interface ScorecardGate {
    key: string;
    title: string;
    sprint_range: string;
    status: ScorecardGateStatus;
    evidence_basis: string;
    criteria: string[];
    action_if_failed: string[];
}

export interface ScorecardMetric {
    key: string;
    label: string;
    formula: string;
    source: string;
    current_value: string;
    evidence_status: 'runtime' | 'repo' | 'manual_required';
    notes?: string | null;
}

export interface ScorecardSnapshot {
    generated_at: string;
    monthly_cadence: string;
    honesty_rule: string;
    gates: ScorecardGate[];
    metrics: ScorecardMetric[];
}

export interface AdminOverviewResponse {
    generated_at: string;
    request_id: string;
    domains: Array<{
        key: OperationDomain | 'admin_support';
        title: string;
        incidents_open: number;
        incidents_critical: number;
        queue_open: number;
        healthy: boolean;
    }>;
    incidents: PlatformIncident[];
    support_requests: SupportRequest[];
    flags: FeatureFlagSnapshot[];
    runbooks: RunbookSummary[];
    slos: DomainSlo[];
    summary: {
        pending_withdrawals: number;
        advances_at_risk: number;
        approvals_breached: number;
        incident_backlog: number;
        support_backlog: number;
    };
    launch_readiness: LaunchReadinessSnapshot;
    smoke_status: SmokeSuiteSnapshot;
    risk_summary: RiskSummary;
    scorecard_snapshot: ScorecardSnapshot;
    ceo_control_tower?: {
        environment: string;
        users: {
            total: number;
            businesses: number;
            truckers: number;
            admins: number;
            new_7d: number;
            new_30d: number;
        };
        operations: {
            offers_published: number;
            offers_assigned: number;
            offers_in_progress: number;
            offers_completed: number;
            offers_cancelled: number;
            dispatches_created: number;
            dispatches_linked_to_trips: number;
        };
        money: {
            gmv_cop: number;
            platform_fee_cop: number;
            net_to_truckers_cop: number;
            pending_withdrawals: number;
            payout_manual_review: number;
        };
        private_fleet: {
            active_drivers: number;
            private_offers: number;
        };
    };
}

export interface AdminCeoOverviewResponse {
    generatedAt: string;
    requestId: string;
    environment: string;
    users: {
        total: number;
        businesses: number;
        businessProfiles: number;
        truckers: number;
        admins: number;
        new7d: number;
        new30d: number;
    };
    trips: {
        total: number;
        marketplace: number;
        privateFleet: number;
        published: number;
        assigned: number;
        inProgress: number;
        completed: number;
        cancelled: number;
    };
    gmv: {
        marketplaceGmvCop: number;
        privateFleetGmvCop: number;
        totalGmvCop: number;
    };
    revenue: {
        marketplaceCommissionCop: number;
        collectedPlanRevenueCop: number;
        activeMrrCop: number;
        totalCollectedRevenueCop: number;
    };
    plans: {
        freeBusinesses: number;
        starterBusinesses: number;
        growthBusinesses: number;
        /** @deprecated Use growthBusinesses. Kept for old clients during rollout. */
        proBusinesses: number;
        scaleBusinesses: number;
        enterpriseBusinesses: number;
        otherPaidBusinesses: number;
        activePilotBusinesses: number;
        trialingPaidBusinesses: number;
        payingBusinesses: number;
    };
    health: {
        pendingWithdrawals: number;
        payoutsManualReview: number;
        openIncidents: number;
        criticalIncidents: number;
        openSupportRequests: number;
    };
    approvals: {
        pending: number;
        criticalPending: number;
        breached: number;
        dueSoon: number;
    };
    periods: {
        last30Days: {
            newUsers: number;
            trips: number;
            marketplaceGmvCop: number;
            privateFleetGmvCop: number;
            marketplaceCommissionCop: number;
            collectedPlanRevenueCop: number;
        };
        monthToDate: {
            trips: number;
            marketplaceGmvCop: number;
            privateFleetGmvCop: number;
            marketplaceCommissionCop: number;
            collectedPlanRevenueCop: number;
        };
    };
}
