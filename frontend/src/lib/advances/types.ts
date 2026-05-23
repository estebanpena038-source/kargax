export type FuelAdvanceStatus =
    | 'requested'
    | 'disbursed'
    | 'rejected'
    | 'cancelled'
    | 'completed'
    | 'overdue'
    | 'at_risk'
    | 'restructured'
    | 'written_off';

export type AdvanceRiskBand = 'low' | 'medium' | 'high' | 'critical';

export type AdvanceDecision = 'manual_review' | 'blocked' | 'approved';

export type AdvanceAgingBucket =
    | 'requested'
    | 'current'
    | 'overdue_1_7'
    | 'at_risk_8_30'
    | 'write_off_candidate_31_plus'
    | 'completed'
    | 'written_off';

export interface AdvanceExposureSnapshot {
    trucker: number;
    business: number;
    holding: number;
    portfolio_deployment_percent: number;
    holding_account_id?: string | null;
}

export interface AdvancePolicySnapshot {
    policy_source: string;
    monthly_interest_rate_percent?: number;
    max_term_days?: number;
    requested_amount_cap?: number;
    decision?: string;
    max_single_advance_cop?: number;
    max_business_exposure_cop?: number;
    max_holding_exposure_cop?: number;
    portfolio_deployment_limit_percent?: number;
    approved_at?: string;
    approved_by?: string;
}

export interface EligibleAdvanceOffer {
    offer_id: string;
    subtotal: number;
    max_advance_amount: number;
    monthly_interest_rate_percent: number;
    max_term_days: number;
    eligible: boolean;
    reason: string | null;
    due_at: string;
    origin_city: string;
    destination_city: string;
    cargo_type: string;
    risk_band: AdvanceRiskBand;
    decision: AdvanceDecision;
    policy_source: string;
    exposure_by_trucker: number;
    exposure_by_business: number;
    exposure_by_holding: number;
    portfolio_deployment_percent: number;
}

export interface FuelAdvanceRepaymentItem {
    id: string;
    advance_id: string;
    wallet_id: string;
    offer_id: string | null;
    source: 'trip_settlement' | 'wallet_sweep' | 'admin_adjustment';
    principal_paid: number;
    interest_paid: number;
    balance_after_principal: number;
    balance_after_interest: number;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface FuelAdvanceListItem {
    id: string;
    trucker_id: string;
    wallet_id: string;
    origin_offer_id: string;
    status: FuelAdvanceStatus;
    principal_amount: number;
    monthly_interest_rate_percent: number;
    term_days: number;
    approved_at: string | null;
    disbursed_at: string | null;
    due_at: string;
    principal_outstanding: number;
    interest_outstanding: number;
    total_due_at_maturity: number;
    requested_by: string;
    approved_by: string | null;
    rejected_reason: string | null;
    risk_band: AdvanceRiskBand;
    policy_snapshot: AdvancePolicySnapshot | null;
    exposure_snapshot: AdvanceExposureSnapshot | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    overdue_days?: number;
    aging_bucket?: AdvanceAgingBucket;
    cohort_month?: string;
    exposure_by_trucker?: number;
    exposure_by_business?: number;
    exposure_by_holding?: number;
    linked_holding_account_id?: string | null;
    linked_business_id?: string | null;
    par7?: boolean;
    par30?: boolean;
    npl30?: boolean;
    origin_offer?: {
        id: string;
        business_id?: string | null;
        origin_city: string;
        destination_city: string;
        cargo_type: string;
        pickup_date: string | null;
        delivery_date: string | null;
        status: string | null;
    } | null;
    trucker?: {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
    } | null;
    repayments?: FuelAdvanceRepaymentItem[];
}

export interface LendingSettingsSnapshot {
    monthly_interest_rate_percent: number;
    max_term_days: number;
    portfolio_deployment_limit_percent: number;
    first_advance_cap_cop: number;
    repeat_advance_cap_cop: number;
    initial_ltv_percent: number;
    repeat_ltv_percent: number;
    minimum_completed_trips_for_repeat: number;
}

export interface LendingTreasurySnapshot {
    available_capital: number;
    reserved_capital: number;
    deployed_capital: number;
    total_repaid_principal: number;
    total_repaid_interest: number;
    deployment_percent?: number;
}

export interface AdvanceSummary {
    activeCount: number;
    overdueCount: number;
    outstandingPrincipal: number;
    outstandingInterest: number;
    totalOutstanding: number;
    eligibleOffersCount: number;
    blockedOffersCount: number;
    manualReviewOffersCount: number;
    maxEligibleAmount: number;
    monthlyInterestRatePercent: number;
    maxTermDays: number;
}

export interface AdvancePortfolioCohort {
    cohort_month: string;
    disbursed_count: number;
    principal_disbursed: number;
    outstanding_amount: number;
    par7_amount: number;
    par30_amount: number;
    npl30_amount: number;
    write_off_amount: number;
    recovered_interest: number;
}

export interface AdvancePortfolioMetrics {
    requested: number;
    active: number;
    overdue: number;
    completed: number;
    outstandingPrincipal: number;
    outstandingInterest: number;
    par7Amount: number;
    par30Amount: number;
    npl30Amount: number;
    par7Rate: number;
    par30Rate: number;
    npl30Rate: number;
    writeOffAmount: number;
    recoveredPrincipal: number;
    recoveredInterest: number;
}
