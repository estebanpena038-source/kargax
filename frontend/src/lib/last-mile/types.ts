export type LastMileCarrierType = 'private_fleet' | 'marketplace' | 'external_provider';
export type LastMileCarrierStatus = 'active' | 'suspended' | 'archived' | 'prospect';
export type LastMileLaneStatus = 'active' | 'archived';
export type LastMileServiceLevel = 'standard' | 'express' | 'refrigerated' | 'fragile' | 'custom';
export type LastMileContractStatus = 'draft' | 'active' | 'paused' | 'expired' | 'superseded';
export type LastMilePricingModel = 'per_trip' | 'per_km' | 'per_kg' | 'hybrid' | 'monthly_retainer';
export type LastMileCurrencyCode = 'COP' | 'USD' | 'PEN' | 'BRL';
export type LastMileRecommendationStatus = 'open' | 'acknowledged' | 'in_negotiation' | 'accepted' | 'rejected' | 'closed';
export type LastMileRecommendationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type LastMileTriggerType =
    | 'cost_overrun'
    | 'incident_rate'
    | 'evidence_missing'
    | 'volume_discount'
    | 'supplier_underperformance'
    | 'contract_expiring'
    | 'benchmark_gap';

export interface LastMileAccess {
    enabled: boolean;
    readOnly: boolean;
    canViewDashboard: boolean;
    canViewFinancials: boolean;
    canManageContracts: boolean;
    canRunRecompute: boolean;
    canViewScorecards: boolean;
    canGenerateAlerts: boolean;
    canManageRenegotiations: boolean;
    canExport: boolean;
    monthlyAlertLimit: number | null;
    activeContractLimit: number | null;
    recommendedPlan: string;
}

export interface LastMileCarrier {
    id: string;
    business_id: string;
    provider_key: string;
    carrier_type: LastMileCarrierType;
    profile_user_id: string | null;
    fleet_member_id: string | null;
    legal_name: string | null;
    display_name: string;
    tax_id: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    status: LastMileCarrierStatus;
    metadata: Record<string, unknown>;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface LastMileRouteLane {
    id: string;
    business_id: string;
    lane_key: string;
    origin_department: string | null;
    origin_city: string | null;
    origin_zone: string | null;
    origin_warehouse_id: string | null;
    destination_department: string | null;
    destination_city: string | null;
    destination_zone: string | null;
    destination_warehouse_id: string | null;
    vehicle_type: string | null;
    cargo_type: string | null;
    service_level: LastMileServiceLevel;
    status: LastMileLaneStatus;
    metadata: Record<string, unknown>;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface LastMileContract {
    id: string;
    business_id: string;
    carrier_id: string;
    lane_id: string | null;
    source_kind: 'manual' | 'marketplace_observed' | 'private_fleet_policy' | 'renegotiated';
    status: LastMileContractStatus;
    pricing_model: LastMilePricingModel;
    currency_code: LastMileCurrencyCode;
    base_rate_cop: number;
    per_km_rate_cop: number;
    per_kg_rate_cop: number;
    minimum_rate_cop: number;
    maximum_rate_cop: number | null;
    fuel_surcharge_cop: number;
    other_surcharge_cop: number;
    payment_terms_days: number;
    evidence_required: Record<string, unknown>;
    sla_rules: Record<string, unknown>;
    penalty_rules: Record<string, unknown>;
    starts_at: string;
    ends_at: string | null;
    notes: string | null;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    carrier?: LastMileCarrier | null;
    lane?: LastMileRouteLane | null;
}

export interface CreateLastMileContractPayload {
    businessId?: string;
    carrierId?: string;
    carrierType?: LastMileCarrierType;
    providerKey?: string;
    providerName?: string;
    legalName?: string | null;
    profileUserId?: string | null;
    fleetMemberId?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    laneId?: string | null;
    originDepartment?: string | null;
    originCity?: string | null;
    originZone?: string | null;
    originWarehouseId?: string | null;
    destinationDepartment?: string | null;
    destinationCity?: string | null;
    destinationZone?: string | null;
    destinationWarehouseId?: string | null;
    vehicleType?: string | null;
    cargoType?: string | null;
    serviceLevel?: LastMileServiceLevel;
    sourceKind?: LastMileContract['source_kind'];
    status?: LastMileContractStatus;
    pricingModel: LastMilePricingModel;
    currencyCode?: LastMileCurrencyCode;
    baseRateCop: number;
    perKmRateCop?: number;
    perKgRateCop?: number;
    minimumRateCop?: number;
    maximumRateCop?: number | null;
    fuelSurchargeCop?: number;
    otherSurchargeCop?: number;
    paymentTermsDays?: number;
    evidenceRequired?: Record<string, unknown>;
    slaRules?: Record<string, unknown>;
    penaltyRules?: Record<string, unknown>;
    startsAt: string;
    endsAt?: string | null;
    notes?: string | null;
}

export interface LastMileRouteCostSnapshot {
    id: string;
    business_id: string;
    offer_id: string;
    carrier_id: string | null;
    lane_id: string | null;
    contract_id: string | null;
    execution_status: 'planned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
    currency_code: LastMileCurrencyCode;
    agreed_cost_cop: number;
    expected_cost_cop: number;
    final_cost_cop: number;
    platform_fee_cop: number;
    payout_cost_cop: number;
    private_expense_cost_cop: number;
    incident_cost_cop: number;
    overrun_cop: number;
    overrun_pct: number;
    evidence_score: number;
    on_time_score: number;
    completion_score: number;
    provider_score: number;
    observed_at: string;
    created_at: string;
    updated_at: string;
    carrier?: LastMileCarrier | null;
    lane?: LastMileRouteLane | null;
    contract?: LastMileContract | null;
}

export interface LastMileProviderScoreSnapshot {
    id: string;
    business_id: string;
    carrier_id: string;
    period_start: string;
    period_end: string;
    completed_trips: number;
    cancelled_trips: number;
    disputed_trips: number;
    incident_count: number;
    evidence_complete_rate: number;
    on_time_rate: number;
    avg_agreed_cost_cop: number;
    avg_final_cost_cop: number;
    avg_overrun_cop: number;
    avg_overrun_pct: number;
    p95_final_cost_cop: number;
    estimated_leakage_cop: number;
    score: number;
    generated_at: string;
    created_at: string;
    carrier?: LastMileCarrier | null;
}

export interface LastMileRenegotiationRecommendation {
    id: string;
    business_id: string;
    carrier_id: string | null;
    lane_id: string | null;
    contract_id: string | null;
    period_start: string;
    period_end: string;
    trigger_type: LastMileTriggerType;
    severity: LastMileRecommendationSeverity;
    status: LastMileRecommendationStatus;
    title: string;
    description: string;
    detected_metric: Record<string, unknown>;
    expected_saving_cop: number;
    confidence_score: number;
    recommended_action: string | null;
    opened_by_system: boolean;
    assigned_to: string | null;
    due_at: string | null;
    resolved_at: string | null;
    resolution_note: string | null;
    dedupe_key: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    carrier?: LastMileCarrier | null;
    lane?: LastMileRouteLane | null;
    contract?: LastMileContract | null;
}

export interface LastMileDashboardResponse {
    ready: boolean;
    message: string | null;
    businessId: string | null;
    period: {
        start: string;
        end: string;
        month: string;
    };
    access: LastMileAccess;
    metrics: {
        totalTrips: number;
        observedTrips: number;
        totalAgreedCostCop: number;
        totalExpectedCostCop: number;
        totalFinalCostCop: number;
        leakageCop: number;
        avgOverrunPct: number;
        evidenceCompleteRate: number;
        openRecommendations: number;
        criticalRecommendations: number;
        expiringContracts: number;
    };
    topRoutes: Array<{
        laneId: string | null;
        label: string;
        trips: number;
        leakageCop: number;
        avgOverrunPct: number;
        evidenceCompleteRate: number;
    }>;
    topCarriers: Array<{
        carrierId: string | null;
        name: string;
        type: string | null;
        trips: number;
        leakageCop: number;
        score: number;
        evidenceCompleteRate: number;
    }>;
    contracts: LastMileContract[];
    snapshots: LastMileRouteCostSnapshot[];
    scorecards: LastMileProviderScoreSnapshot[];
    alerts: LastMileRenegotiationRecommendation[];
    renegotiations: LastMileRenegotiationRecommendation[];
}

export interface LastMileRecomputeResult {
    runId: string;
    dryRun: boolean;
    processedOffers: number;
    createdObservations: number;
    updatedObservations: number;
    createdRecommendations: number;
    processedBusinessIds?: string[];
}
