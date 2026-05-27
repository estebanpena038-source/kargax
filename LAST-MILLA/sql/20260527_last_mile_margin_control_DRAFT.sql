-- =============================================================================
-- KARGAX - LAST MILE MARGIN CONTROL
-- Draft migration: 20260527_last_mile_margin_control.sql
-- Risk: HIGH (RLS, multi-company, billing feature matrix, financial analytics)
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.user_has_business_access(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(public.is_admin_user(auth.uid()), FALSE)
        OR auth.uid() = p_business_id
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = p_business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
        );
$$;

COMMENT ON FUNCTION public.user_has_business_access(UUID) IS
'Last-mile helper for RLS. Action-level permissions are enforced in Next API routes.';

CREATE TABLE IF NOT EXISTS public.last_mile_carriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    carrier_type TEXT NOT NULL CHECK (carrier_type IN ('private_fleet', 'marketplace', 'external_provider')),
    profile_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    fleet_member_id UUID REFERENCES public.business_fleet_members(id) ON DELETE SET NULL,
    legal_name TEXT,
    display_name TEXT NOT NULL,
    tax_id TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived', 'prospect')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_business_status ON public.last_mile_carriers(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_profile ON public.last_mile_carriers(business_id, profile_user_id) WHERE profile_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_last_mile_carriers_profile_per_business ON public.last_mile_carriers(business_id, carrier_type, profile_user_id) WHERE profile_user_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_last_mile_carriers_updated_at ON public.last_mile_carriers;
CREATE TRIGGER trg_last_mile_carriers_updated_at BEFORE UPDATE ON public.last_mile_carriers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.last_mile_route_lanes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    lane_key TEXT NOT NULL,
    origin_department TEXT,
    origin_city TEXT,
    origin_zone TEXT,
    origin_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    destination_department TEXT,
    destination_city TEXT,
    destination_zone TEXT,
    destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    vehicle_type TEXT,
    cargo_type TEXT,
    service_level TEXT NOT NULL DEFAULT 'standard' CHECK (service_level IN ('standard', 'express', 'refrigerated', 'fragile', 'custom')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, lane_key)
);

CREATE INDEX IF NOT EXISTS idx_last_mile_lanes_business_status ON public.last_mile_route_lanes(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_lanes_city_pair ON public.last_mile_route_lanes(business_id, origin_department, origin_city, destination_department, destination_city);
DROP TRIGGER IF EXISTS trg_last_mile_lanes_updated_at ON public.last_mile_route_lanes;
CREATE TRIGGER trg_last_mile_lanes_updated_at BEFORE UPDATE ON public.last_mile_route_lanes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.last_mile_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    carrier_id UUID NOT NULL REFERENCES public.last_mile_carriers(id) ON DELETE CASCADE,
    lane_id UUID REFERENCES public.last_mile_route_lanes(id) ON DELETE SET NULL,
    source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual', 'marketplace_observed', 'private_fleet_policy', 'renegotiated')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'superseded')),
    pricing_model TEXT NOT NULL DEFAULT 'per_trip' CHECK (pricing_model IN ('per_trip', 'per_km', 'per_kg', 'hybrid', 'monthly_retainer')),
    currency_code TEXT NOT NULL DEFAULT 'COP' CHECK (currency_code IN ('COP', 'USD', 'PEN', 'BRL')),
    base_rate_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (base_rate_cop >= 0),
    per_km_rate_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (per_km_rate_cop >= 0),
    per_kg_rate_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (per_kg_rate_cop >= 0),
    minimum_rate_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (minimum_rate_cop >= 0),
    maximum_rate_cop NUMERIC(15, 2) CHECK (maximum_rate_cop IS NULL OR maximum_rate_cop >= 0),
    fuel_surcharge_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (fuel_surcharge_cop >= 0),
    other_surcharge_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (other_surcharge_cop >= 0),
    payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    evidence_required JSONB NOT NULL DEFAULT jsonb_build_object('pickup_pin', true, 'delivery_pin', true, 'delivery_photo', true, 'delivery_signature', true, 'receiver_name', true, 'incident_required_when_exception', true),
    sla_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    penalty_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
    ends_at DATE,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT last_mile_contract_dates_check CHECK (ends_at IS NULL OR ends_at >= starts_at),
    CONSTRAINT last_mile_contract_max_min_check CHECK (maximum_rate_cop IS NULL OR maximum_rate_cop >= minimum_rate_cop)
);

CREATE INDEX IF NOT EXISTS idx_last_mile_contracts_business_status ON public.last_mile_contracts(business_id, status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_contracts_carrier_lane ON public.last_mile_contracts(business_id, carrier_id, lane_id, status);
CREATE INDEX IF NOT EXISTS idx_last_mile_contracts_expiry ON public.last_mile_contracts(business_id, ends_at) WHERE ends_at IS NOT NULL;
DROP TRIGGER IF EXISTS trg_last_mile_contracts_updated_at ON public.last_mile_contracts;
CREATE TRIGGER trg_last_mile_contracts_updated_at BEFORE UPDATE ON public.last_mile_contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.last_mile_contract_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.last_mile_contracts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'activated', 'rate_changed', 'renegotiation_requested', 'renegotiated', 'paused', 'expired', 'manual_note')),
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reason TEXT,
    old_snapshot JSONB,
    new_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_last_mile_contract_events_business ON public.last_mile_contract_events(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_contract_events_contract ON public.last_mile_contract_events(contract_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.last_mile_trip_cost_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    carrier_id UUID REFERENCES public.last_mile_carriers(id) ON DELETE SET NULL,
    lane_id UUID REFERENCES public.last_mile_route_lanes(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES public.last_mile_contracts(id) ON DELETE SET NULL,
    source_kind TEXT NOT NULL DEFAULT 'sync' CHECK (source_kind IN ('cargo_offer', 'payment', 'private_fleet_allocation', 'manual_adjustment', 'sync')),
    execution_status TEXT NOT NULL DEFAULT 'planned' CHECK (execution_status IN ('planned', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed')),
    currency_code TEXT NOT NULL DEFAULT 'COP' CHECK (currency_code IN ('COP', 'USD', 'PEN', 'BRL')),
    agreed_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (agreed_cost_cop >= 0),
    expected_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (expected_cost_cop >= 0),
    final_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (final_cost_cop >= 0),
    platform_fee_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (platform_fee_cop >= 0),
    payout_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (payout_cost_cop >= 0),
    private_expense_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (private_expense_cost_cop >= 0),
    incident_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (incident_cost_cop >= 0),
    overrun_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    overrun_pct NUMERIC(10, 4) NOT NULL DEFAULT 0,
    evidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (evidence_score BETWEEN 0 AND 100),
    on_time_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (on_time_score BETWEEN 0 AND 100),
    completion_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (completion_score BETWEEN 0 AND 100),
    provider_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (provider_score BETWEEN 0 AND 100),
    contract_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    incident_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_last_mile_observations_business_period ON public.last_mile_trip_cost_observations(business_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_observations_carrier ON public.last_mile_trip_cost_observations(business_id, carrier_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_observations_lane ON public.last_mile_trip_cost_observations(business_id, lane_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_observations_contract ON public.last_mile_trip_cost_observations(contract_id, observed_at DESC);
DROP TRIGGER IF EXISTS trg_last_mile_observations_updated_at ON public.last_mile_trip_cost_observations;
CREATE TRIGGER trg_last_mile_observations_updated_at BEFORE UPDATE ON public.last_mile_trip_cost_observations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.last_mile_provider_score_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    carrier_id UUID NOT NULL REFERENCES public.last_mile_carriers(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    completed_trips INTEGER NOT NULL DEFAULT 0 CHECK (completed_trips >= 0),
    cancelled_trips INTEGER NOT NULL DEFAULT 0 CHECK (cancelled_trips >= 0),
    disputed_trips INTEGER NOT NULL DEFAULT 0 CHECK (disputed_trips >= 0),
    incident_count INTEGER NOT NULL DEFAULT 0 CHECK (incident_count >= 0),
    evidence_complete_rate NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (evidence_complete_rate BETWEEN 0 AND 100),
    on_time_rate NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (on_time_rate BETWEEN 0 AND 100),
    avg_agreed_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    avg_final_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    avg_overrun_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    avg_overrun_pct NUMERIC(10, 4) NOT NULL DEFAULT 0,
    p95_final_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    estimated_leakage_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT last_mile_score_period_check CHECK (period_end >= period_start),
    UNIQUE (business_id, carrier_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_last_mile_scorecards_business_period ON public.last_mile_provider_score_snapshots(business_id, period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_scorecards_carrier ON public.last_mile_provider_score_snapshots(carrier_id, period_start DESC);

CREATE TABLE IF NOT EXISTS public.last_mile_renegotiation_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    carrier_id UUID REFERENCES public.last_mile_carriers(id) ON DELETE SET NULL,
    lane_id UUID REFERENCES public.last_mile_route_lanes(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES public.last_mile_contracts(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cost_overrun', 'incident_rate', 'evidence_missing', 'volume_discount', 'supplier_underperformance', 'contract_expiring', 'benchmark_gap')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_negotiation', 'accepted', 'rejected', 'closed')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    detected_metric JSONB NOT NULL DEFAULT '{}'::jsonb,
    expected_saving_cop NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (expected_saving_cop >= 0),
    confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
    recommended_action TEXT,
    opened_by_system BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    due_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    dedupe_key TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT last_mile_recommendation_period_check CHECK (period_end >= period_start),
    UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_last_mile_recommendations_business_status ON public.last_mile_renegotiation_recommendations(business_id, status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_recommendations_carrier_period ON public.last_mile_renegotiation_recommendations(carrier_id, period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_recommendations_contract ON public.last_mile_renegotiation_recommendations(contract_id, status, created_at DESC);
DROP TRIGGER IF EXISTS trg_last_mile_recommendations_updated_at ON public.last_mile_renegotiation_recommendations;
CREATE TRIGGER trg_last_mile_recommendations_updated_at BEFORE UPDATE ON public.last_mile_renegotiation_recommendations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.last_mile_analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    run_type TEXT NOT NULL DEFAULT 'manual' CHECK (run_type IN ('manual', 'scheduled', 'offer_completed', 'backfill')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    period_start DATE,
    period_end DATE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    started_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    processed_offers INTEGER NOT NULL DEFAULT 0 CHECK (processed_offers >= 0),
    created_observations INTEGER NOT NULL DEFAULT 0 CHECK (created_observations >= 0),
    updated_observations INTEGER NOT NULL DEFAULT 0 CHECK (updated_observations >= 0),
    created_recommendations INTEGER NOT NULL DEFAULT 0 CHECK (created_recommendations >= 0),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_last_mile_runs_business_created ON public.last_mile_analysis_runs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_last_mile_runs_status ON public.last_mile_analysis_runs(status, created_at DESC);

ALTER TABLE public.last_mile_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_mile_route_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_mile_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_mile_contract_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_mile_trip_cost_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_mile_provider_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_mile_renegotiation_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_mile_analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Last mile carriers scoped by business" ON public.last_mile_carriers;
CREATE POLICY "Last mile carriers scoped by business" ON public.last_mile_carriers FOR ALL TO authenticated USING (public.user_has_business_access(business_id)) WITH CHECK (public.user_has_business_access(business_id));
DROP POLICY IF EXISTS "Last mile lanes scoped by business" ON public.last_mile_route_lanes;
CREATE POLICY "Last mile lanes scoped by business" ON public.last_mile_route_lanes FOR ALL TO authenticated USING (public.user_has_business_access(business_id)) WITH CHECK (public.user_has_business_access(business_id));
DROP POLICY IF EXISTS "Last mile contracts scoped by business" ON public.last_mile_contracts;
CREATE POLICY "Last mile contracts scoped by business" ON public.last_mile_contracts FOR ALL TO authenticated USING (public.user_has_business_access(business_id)) WITH CHECK (public.user_has_business_access(business_id));
DROP POLICY IF EXISTS "Last mile contract events scoped by business" ON public.last_mile_contract_events;
CREATE POLICY "Last mile contract events scoped by business" ON public.last_mile_contract_events FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
DROP POLICY IF EXISTS "Last mile observations scoped by business" ON public.last_mile_trip_cost_observations;
CREATE POLICY "Last mile observations scoped by business" ON public.last_mile_trip_cost_observations FOR ALL TO authenticated USING (public.user_has_business_access(business_id)) WITH CHECK (public.user_has_business_access(business_id));
DROP POLICY IF EXISTS "Last mile scorecards scoped by business" ON public.last_mile_provider_score_snapshots;
CREATE POLICY "Last mile scorecards scoped by business" ON public.last_mile_provider_score_snapshots FOR ALL TO authenticated USING (public.user_has_business_access(business_id)) WITH CHECK (public.user_has_business_access(business_id));
DROP POLICY IF EXISTS "Last mile recommendations scoped by business" ON public.last_mile_renegotiation_recommendations;
CREATE POLICY "Last mile recommendations scoped by business" ON public.last_mile_renegotiation_recommendations FOR ALL TO authenticated USING (public.user_has_business_access(business_id)) WITH CHECK (public.user_has_business_access(business_id));
DROP POLICY IF EXISTS "Last mile runs scoped by business" ON public.last_mile_analysis_runs;
CREATE POLICY "Last mile runs scoped by business" ON public.last_mile_analysis_runs FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));

UPDATE public.billing_plans
SET feature_matrix = jsonb_strip_nulls(
    COALESCE(feature_matrix, '{}'::jsonb) ||
    jsonb_build_object(
        'last_mile_margin_control', CASE WHEN code = 'enterprise' THEN true ELSE false END,
        'last_mile_margin_control_read_only', CASE WHEN code = 'scale' THEN true ELSE false END,
        'last_mile_contract_limit', CASE WHEN code = 'free' THEN 0 WHEN code = 'growth' THEN 0 WHEN code = 'scale' THEN 10 WHEN code = 'enterprise' THEN NULL ELSE 0 END,
        'last_mile_alerts', CASE WHEN code IN ('scale', 'enterprise') THEN true ELSE false END,
        'last_mile_renegotiation', CASE WHEN code = 'enterprise' THEN true ELSE false END
    )
),
updated_at = NOW()
WHERE code IN ('free', 'growth', 'scale', 'enterprise');

COMMIT;
