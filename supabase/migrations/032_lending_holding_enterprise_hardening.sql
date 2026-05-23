BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- Holding governance hardening
-- =============================================================================

ALTER TABLE public.holding_finance_policies
    ADD COLUMN IF NOT EXISTS max_business_exposure_cop NUMERIC(15,2) NOT NULL DEFAULT 15000000.00
        CHECK (max_business_exposure_cop >= 0);

ALTER TABLE public.holding_business_links
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'linked'
        CHECK (status IN ('linked', 'unlinked')),
    ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS unlinked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS unlink_reason TEXT;

UPDATE public.holding_business_links
SET status = COALESCE(status, 'linked')
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_holding_business_links_holding_status
    ON public.holding_business_links(holding_account_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_holding_business_links_business_status
    ON public.holding_business_links(business_id, status, updated_at DESC);

ALTER TABLE public.holding_approval_requests
    ADD COLUMN IF NOT EXISTS assigned_team TEXT NOT NULL DEFAULT 'holding_owner'
        CHECK (assigned_team IN ('holding_owner', 'finance_admin', 'ops_admin')),
    ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS aging_bucket TEXT NOT NULL DEFAULT 'within_sla'
        CHECK (aging_bucket IN ('within_sla', 'due_soon', 'breached', 'double_breached', 'resolved')),
    ADD COLUMN IF NOT EXISTS breached_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalation_level INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resolved_within_sla BOOLEAN,
    ADD COLUMN IF NOT EXISTS source_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_holding_approval_requests_sla
    ON public.holding_approval_requests(holding_account_id, status, priority, sla_due_at);

CREATE INDEX IF NOT EXISTS idx_holding_approval_requests_team_status
    ON public.holding_approval_requests(holding_account_id, assigned_team, status, created_at DESC);

WITH assignment AS (
    SELECT
        har.id,
        CASE
            WHEN har.request_type IN ('wallet_release', 'credit_policy', 'plan_upgrade') THEN 'finance_admin'
            WHEN har.request_type IN ('business_link', 'ops_exception') THEN 'ops_admin'
            ELSE 'holding_owner'
        END AS assigned_team,
        CASE COALESCE(har.priority, 'medium')
            WHEN 'critical' THEN har.created_at + INTERVAL '5 minutes'
            WHEN 'high' THEN har.created_at + INTERVAL '30 minutes'
            WHEN 'medium' THEN har.created_at + INTERVAL '4 hours'
            ELSE har.created_at + INTERVAL '1 day'
        END AS sla_due_at,
        CASE
            WHEN har.status <> 'pending' THEN 'resolved'
            WHEN NOW() > CASE COALESCE(har.priority, 'medium')
                WHEN 'critical' THEN har.created_at + INTERVAL '10 minutes'
                WHEN 'high' THEN har.created_at + INTERVAL '1 hour'
                WHEN 'medium' THEN har.created_at + INTERVAL '8 hours'
                ELSE har.created_at + INTERVAL '2 days'
            END THEN 'double_breached'
            WHEN NOW() > CASE COALESCE(har.priority, 'medium')
                WHEN 'critical' THEN har.created_at + INTERVAL '5 minutes'
                WHEN 'high' THEN har.created_at + INTERVAL '30 minutes'
                WHEN 'medium' THEN har.created_at + INTERVAL '4 hours'
                ELSE har.created_at + INTERVAL '1 day'
            END THEN 'breached'
            WHEN NOW() > CASE COALESCE(har.priority, 'medium')
                WHEN 'critical' THEN har.created_at + INTERVAL '2 minutes'
                WHEN 'high' THEN har.created_at + INTERVAL '15 minutes'
                WHEN 'medium' THEN har.created_at + INTERVAL '3 hours 30 minutes'
                ELSE har.created_at + INTERVAL '23 hours'
            END THEN 'due_soon'
            ELSE 'within_sla'
        END AS aging_bucket,
        CASE
            WHEN har.status = 'pending' AND NOW() > CASE COALESCE(har.priority, 'medium')
                WHEN 'critical' THEN har.created_at + INTERVAL '5 minutes'
                WHEN 'high' THEN har.created_at + INTERVAL '30 minutes'
                WHEN 'medium' THEN har.created_at + INTERVAL '4 hours'
                ELSE har.created_at + INTERVAL '1 day'
            END THEN COALESCE(har.breached_at, CASE COALESCE(har.priority, 'medium')
                WHEN 'critical' THEN har.created_at + INTERVAL '5 minutes'
                WHEN 'high' THEN har.created_at + INTERVAL '30 minutes'
                WHEN 'medium' THEN har.created_at + INTERVAL '4 hours'
                ELSE har.created_at + INTERVAL '1 day'
            END)
            ELSE har.breached_at
        END AS breached_at,
        CASE
            WHEN har.status <> 'pending' THEN COALESCE(har.escalation_level, 0)
            WHEN NOW() > CASE COALESCE(har.priority, 'medium')
                WHEN 'critical' THEN har.created_at + INTERVAL '10 minutes'
                WHEN 'high' THEN har.created_at + INTERVAL '1 hour'
                WHEN 'medium' THEN har.created_at + INTERVAL '8 hours'
                ELSE har.created_at + INTERVAL '2 days'
            END THEN 2
            WHEN NOW() > CASE COALESCE(har.priority, 'medium')
                WHEN 'critical' THEN har.created_at + INTERVAL '5 minutes'
                WHEN 'high' THEN har.created_at + INTERVAL '30 minutes'
                WHEN 'medium' THEN har.created_at + INTERVAL '4 hours'
                ELSE har.created_at + INTERVAL '1 day'
            END THEN 1
            ELSE 0
        END AS escalation_level,
        CASE
            WHEN har.status = 'pending' THEN NULL
            ELSE COALESCE(
                har.resolved_within_sla,
                har.decided_at IS NOT NULL
                AND har.decided_at <= CASE COALESCE(har.priority, 'medium')
                    WHEN 'critical' THEN har.created_at + INTERVAL '5 minutes'
                    WHEN 'high' THEN har.created_at + INTERVAL '30 minutes'
                    WHEN 'medium' THEN har.created_at + INTERVAL '4 hours'
                    ELSE har.created_at + INTERVAL '1 day'
                END
            )
        END AS resolved_within_sla,
        COALESCE(har.source_reference, har.payload->>'referenceId', har.business_id::TEXT, har.id::TEXT) AS source_reference
    FROM public.holding_approval_requests har
)
UPDATE public.holding_approval_requests har
SET assigned_team = assignment.assigned_team,
    sla_due_at = COALESCE(har.sla_due_at, assignment.sla_due_at),
    aging_bucket = assignment.aging_bucket,
    breached_at = assignment.breached_at,
    escalation_level = assignment.escalation_level,
    resolved_within_sla = assignment.resolved_within_sla,
    source_reference = assignment.source_reference
FROM assignment
WHERE har.id = assignment.id;

COMMENT ON COLUMN public.holding_finance_policies.max_business_exposure_cop IS 'Tope maximo agregado por empresa dentro del holding';
COMMENT ON COLUMN public.holding_business_links.status IS 'Relacion actual del negocio con el holding: linked o unlinked';
COMMENT ON COLUMN public.holding_approval_requests.assigned_team IS 'Equipo responsable por defecto de la decision corporativa';
COMMENT ON COLUMN public.holding_approval_requests.sla_due_at IS 'Fecha limite de SLA segun prioridad de la solicitud';
COMMENT ON COLUMN public.holding_approval_requests.aging_bucket IS 'Estado operativo de SLA para la cola corporativa';

-- =============================================================================
-- Lending hardening
-- =============================================================================

ALTER TABLE public.fuel_advances
    ADD COLUMN IF NOT EXISTS risk_band TEXT NOT NULL DEFAULT 'medium'
        CHECK (risk_band IN ('low', 'medium', 'high', 'critical')),
    ADD COLUMN IF NOT EXISTS policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS exposure_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_fuel_advances_risk_status
    ON public.fuel_advances(status, risk_band, due_at);

COMMENT ON COLUMN public.fuel_advances.policy_snapshot IS 'Snapshot de politica usada al evaluar o aprobar el adelanto';
COMMENT ON COLUMN public.fuel_advances.exposure_snapshot IS 'Snapshot de exposicion por trucker, negocio, holding y portafolio';

-- =============================================================================
-- Ledger metadata backfill
-- =============================================================================

UPDATE public.transactions
SET metadata = jsonb_strip_nulls(
    COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
        'source_kind', COALESCE(metadata->>'source_kind', type::TEXT),
        'source_reference', COALESCE(metadata->>'source_reference', reference_id, offer_id::TEXT, id::TEXT),
        'reference_id', COALESCE(metadata->>'reference_id', reference_id, offer_id::TEXT, id::TEXT)
    )
)
WHERE NOT (COALESCE(metadata, '{}'::jsonb) ? 'source_reference')
   OR NOT (COALESCE(metadata, '{}'::jsonb) ? 'source_kind');

-- =============================================================================
-- Helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compute_holding_approval_assignment(
    p_request_type TEXT,
    p_priority TEXT
)
RETURNS TABLE(
    assigned_team TEXT,
    sla_due_at TIMESTAMPTZ,
    aging_bucket TEXT,
    escalation_level INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_team TEXT;
    v_sla INTERVAL;
BEGIN
    v_team := CASE
        WHEN p_request_type IN ('wallet_release', 'credit_policy', 'plan_upgrade') THEN 'finance_admin'
        WHEN p_request_type IN ('business_link', 'ops_exception') THEN 'ops_admin'
        ELSE 'holding_owner'
    END;

    v_sla := CASE COALESCE(p_priority, 'medium')
        WHEN 'critical' THEN INTERVAL '5 minutes'
        WHEN 'high' THEN INTERVAL '30 minutes'
        WHEN 'medium' THEN INTERVAL '4 hours'
        ELSE INTERVAL '1 day'
    END;

    RETURN QUERY
    SELECT
        v_team,
        NOW() + v_sla,
        'within_sla'::TEXT,
        0;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_holding_approval_aging(
    p_status TEXT,
    p_sla_due_at TIMESTAMPTZ,
    p_breached_at TIMESTAMPTZ
)
RETURNS TABLE(
    aging_bucket TEXT,
    breached_at TIMESTAMPTZ,
    escalation_level INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_warning_window INTERVAL := INTERVAL '15 minutes';
    v_double_window INTERVAL := INTERVAL '15 minutes';
BEGIN
    IF p_status IS DISTINCT FROM 'pending' OR p_sla_due_at IS NULL THEN
        RETURN QUERY SELECT 'resolved'::TEXT, p_breached_at, COALESCE(CASE WHEN p_breached_at IS NOT NULL THEN 1 ELSE 0 END, 0);
        RETURN;
    END IF;

    IF p_breached_at IS NOT NULL THEN
        v_double_window := GREATEST(p_sla_due_at - p_breached_at, INTERVAL '15 minutes');
    END IF;

    IF v_now <= p_sla_due_at THEN
        RETURN QUERY
        SELECT
            CASE
                WHEN v_now >= p_sla_due_at - v_warning_window THEN 'due_soon'
                ELSE 'within_sla'
            END,
            p_breached_at,
            0;
        RETURN;
    END IF;

    IF p_breached_at IS NULL THEN
        RETURN QUERY SELECT 'breached'::TEXT, v_now, 1;
        RETURN;
    END IF;

    IF v_now >= p_breached_at + v_double_window THEN
        RETURN QUERY SELECT 'double_breached'::TEXT, p_breached_at, 2;
        RETURN;
    END IF;

    RETURN QUERY SELECT 'breached'::TEXT, p_breached_at, 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_advance_aging_bucket(
    p_status TEXT,
    p_due_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_days INTEGER;
BEGIN
    IF p_status = 'written_off' THEN
        RETURN 'written_off';
    END IF;

    IF p_status = 'completed' THEN
        RETURN 'completed';
    END IF;

    IF p_status = 'requested' THEN
        RETURN 'requested';
    END IF;

    IF p_due_at IS NULL OR p_due_at >= NOW() THEN
        RETURN 'current';
    END IF;

    v_days := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - p_due_at)) / 86400)::INTEGER);

    IF v_days <= 7 THEN
        RETURN 'overdue_1_7';
    END IF;

    IF v_days <= 30 THEN
        RETURN 'at_risk_8_30';
    END IF;

    RETURN 'write_off_candidate_31_plus';
END;
$$;

-- =============================================================================
-- Rework advance eligibility
-- =============================================================================

-- The 024 baseline defines get_fuel_advance_eligibility(uuid) with a smaller
-- OUT signature, so changing it with CREATE OR REPLACE fails on existing DBs.
-- request_fuel_advance(uuid, uuid, numeric, integer) depends on that function,
-- so we drop both before recreating them in this migration.
DROP FUNCTION IF EXISTS public.request_fuel_advance(UUID, UUID, NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS public.get_fuel_advance_eligibility(UUID);

CREATE OR REPLACE FUNCTION public.get_fuel_advance_eligibility(p_trucker_id UUID)
RETURNS TABLE(
    offer_id UUID,
    subtotal DECIMAL,
    max_advance_amount DECIMAL,
    monthly_interest_rate_percent DECIMAL,
    max_term_days INTEGER,
    eligible BOOLEAN,
    reason TEXT,
    due_at TIMESTAMPTZ,
    origin_city TEXT,
    destination_city TEXT,
    cargo_type TEXT,
    risk_band TEXT,
    decision TEXT,
    policy_source TEXT,
    exposure_by_trucker DECIMAL,
    exposure_by_business DECIMAL,
    exposure_by_holding DECIMAL,
    portfolio_deployment_percent DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings public.lending_settings%ROWTYPE;
    v_treasury public.lending_treasury%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_has_payment_method BOOLEAN := FALSE;
    v_has_open_advance BOOLEAN := FALSE;
    v_has_overdue_advance BOOLEAN := FALSE;
    v_has_recent_write_off BOOLEAN := FALSE;
    v_total_trips INTEGER := 0;
    v_is_repeat BOOLEAN := FALSE;
BEGIN
    PERFORM public.mark_overdue_fuel_advances();

    SELECT * INTO v_settings
    FROM public.lending_settings
    WHERE id = 'default';

    SELECT * INTO v_treasury
    FROM public.lending_treasury
    WHERE id = 'default';

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_trucker_id;

    IF v_wallet.id IS NOT NULL THEN
        v_total_trips := COALESCE(v_wallet.total_trips_completed, 0);
    END IF;

    v_is_repeat := v_total_trips >= COALESCE(v_settings.minimum_completed_trips_for_repeat, 3);

    SELECT EXISTS (
        SELECT 1
        FROM public.payment_methods
        WHERE user_id = p_trucker_id
    ) INTO v_has_payment_method;

    SELECT EXISTS (
        SELECT 1
        FROM public.fuel_advances
        WHERE trucker_id = p_trucker_id
          AND status IN ('requested', 'disbursed', 'overdue', 'at_risk', 'restructured')
    ) INTO v_has_open_advance;

    SELECT EXISTS (
        SELECT 1
        FROM public.fuel_advances
        WHERE trucker_id = p_trucker_id
          AND status IN ('overdue', 'at_risk')
    ) INTO v_has_overdue_advance;

    SELECT EXISTS (
        SELECT 1
        FROM public.fuel_advances
        WHERE trucker_id = p_trucker_id
          AND status = 'written_off'
          AND updated_at >= NOW() - INTERVAL '90 days'
    ) INTO v_has_recent_write_off;

    RETURN QUERY
    WITH offer_base AS (
        SELECT
            co.id AS offer_id,
            co.business_id,
            p.subtotal,
            co.origin_city::TEXT AS origin_city,
            co.destination_city::TEXT AS destination_city,
            co.cargo_type::TEXT AS cargo_type,
            (
                CASE
                    WHEN v_has_overdue_advance THEN 0::DECIMAL
                    WHEN v_has_open_advance THEN 0::DECIMAL
                    WHEN v_has_recent_write_off THEN 0::DECIMAL
                    WHEN NOT v_has_payment_method THEN 0::DECIMAL
                    ELSE LEAST(
                        ROUND(
                            p.subtotal
                            * (CASE WHEN v_is_repeat THEN v_settings.repeat_ltv_percent ELSE v_settings.initial_ltv_percent END)
                            / 100.0,
                            2
                        ),
                        CASE
                            WHEN v_is_repeat THEN v_settings.repeat_advance_cap_cop
                            ELSE v_settings.first_advance_cap_cop
                        END
                    )
                END
            ) AS global_cap
        FROM public.cargo_offers co
        JOIN public.payments p
          ON p.offer_id = co.id
         AND p.status = 'completed'
        WHERE co.assigned_trucker_id = p_trucker_id
          AND co.status = 'reserved'
          AND NOT EXISTS (
              SELECT 1
              FROM public.fuel_advances fa
              WHERE fa.origin_offer_id = co.id
                AND fa.status IN ('requested', 'disbursed', 'overdue', 'at_risk', 'restructured', 'completed')
          )
    ),
    offer_policy AS (
        SELECT
            ob.*,
            hbl.holding_account_id,
            hfp.max_single_advance_cop,
            hfp.max_business_exposure_cop,
            hfp.max_portfolio_exposure_cop,
            COALESCE((
                SELECT SUM(COALESCE(fa.principal_outstanding, 0) + COALESCE(fa.interest_outstanding, 0))
                FROM public.fuel_advances fa
                JOIN public.cargo_offers co2 ON co2.id = fa.origin_offer_id
                WHERE fa.trucker_id = p_trucker_id
                  AND fa.status IN ('disbursed', 'overdue', 'at_risk', 'restructured')
            ), 0) AS exposure_by_trucker,
            COALESCE((
                SELECT SUM(COALESCE(fa.principal_outstanding, 0) + COALESCE(fa.interest_outstanding, 0))
                FROM public.fuel_advances fa
                JOIN public.cargo_offers co3 ON co3.id = fa.origin_offer_id
                WHERE co3.business_id = ob.business_id
                  AND fa.status IN ('disbursed', 'overdue', 'at_risk', 'restructured')
            ), 0) AS exposure_by_business,
            COALESCE((
                SELECT SUM(COALESCE(fa.principal_outstanding, 0) + COALESCE(fa.interest_outstanding, 0))
                FROM public.fuel_advances fa
                JOIN public.cargo_offers co4 ON co4.id = fa.origin_offer_id
                JOIN public.holding_business_links hbl2
                  ON hbl2.business_id = co4.business_id
                 AND hbl2.status = 'linked'
                WHERE hbl2.holding_account_id = hbl.holding_account_id
                  AND fa.status IN ('disbursed', 'overdue', 'at_risk', 'restructured')
            ), 0) AS exposure_by_holding
        FROM offer_base ob
        LEFT JOIN public.holding_business_links hbl
          ON hbl.business_id = ob.business_id
         AND hbl.status = 'linked'
        LEFT JOIN public.holding_finance_policies hfp
          ON hfp.holding_account_id = hbl.holding_account_id
    ),
    offer_decision AS (
        SELECT
            op.offer_id,
            op.subtotal,
            LEAST(
                op.global_cap,
                COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)
            ) AS max_advance_amount,
            v_settings.monthly_interest_rate_percent,
            v_settings.max_term_days,
            CASE
                WHEN op.global_cap <= 0 THEN FALSE
                WHEN v_treasury.available_capital <= 0 THEN FALSE
                WHEN v_treasury.available_capital < LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)) THEN FALSE
                WHEN COALESCE(op.max_business_exposure_cop, 0) > 0
                     AND op.exposure_by_business + LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)) > op.max_business_exposure_cop THEN FALSE
                WHEN COALESCE(op.max_portfolio_exposure_cop, 0) > 0
                     AND op.exposure_by_holding + LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)) > op.max_portfolio_exposure_cop THEN FALSE
                ELSE TRUE
            END AS eligible,
            CASE
                WHEN v_has_recent_write_off THEN 'Tienes un write-off reciente y quedas bloqueado temporalmente'
                WHEN v_has_overdue_advance THEN 'Tienes un adelanto vencido o en riesgo'
                WHEN v_has_open_advance THEN 'Ya tienes un adelanto abierto'
                WHEN NOT v_has_payment_method THEN 'Configura un metodo de retiro en tu billetera'
                WHEN v_treasury.available_capital <= 0 THEN 'La tesoreria no tiene capital disponible'
                WHEN v_treasury.available_capital < LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)) THEN 'Tesoreria insuficiente para este adelanto'
                WHEN COALESCE(op.max_business_exposure_cop, 0) > 0
                     AND op.exposure_by_business + LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)) > op.max_business_exposure_cop THEN 'La empresa ya supera el tope duro de exposicion'
                WHEN COALESCE(op.max_portfolio_exposure_cop, 0) > 0
                     AND op.exposure_by_holding + LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)) > op.max_portfolio_exposure_cop THEN 'El holding ya supera el tope duro de exposicion'
                WHEN v_is_repeat THEN 'Aprobacion sujeta a revision administrativa'
                ELSE 'Primera solicitud: pasa a revision administrativa'
            END AS reason,
            NOW() + make_interval(days => v_settings.max_term_days) AS due_at,
            op.origin_city,
            op.destination_city,
            op.cargo_type,
            CASE
                WHEN v_has_recent_write_off THEN 'critical'
                WHEN v_has_overdue_advance THEN 'critical'
                WHEN v_has_open_advance THEN 'high'
                WHEN NOT v_has_payment_method THEN 'high'
                WHEN COALESCE(op.max_portfolio_exposure_cop, 0) > 0
                     AND op.exposure_by_holding >= op.max_portfolio_exposure_cop * 0.85 THEN 'high'
                WHEN COALESCE(op.max_business_exposure_cop, 0) > 0
                     AND op.exposure_by_business >= op.max_business_exposure_cop * 0.85 THEN 'high'
                WHEN NOT v_is_repeat THEN 'medium'
                ELSE 'low'
            END AS risk_band,
            CASE
                WHEN op.global_cap <= 0
                  OR v_has_recent_write_off
                  OR v_has_overdue_advance
                  OR v_has_open_advance
                  OR NOT v_has_payment_method
                  OR v_treasury.available_capital <= 0
                  OR v_treasury.available_capital < LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap))
                  OR (
                      COALESCE(op.max_business_exposure_cop, 0) > 0
                      AND op.exposure_by_business + LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)) > op.max_business_exposure_cop
                  )
                  OR (
                      COALESCE(op.max_portfolio_exposure_cop, 0) > 0
                      AND op.exposure_by_holding + LEAST(op.global_cap, COALESCE(NULLIF(op.max_single_advance_cop, 0), op.global_cap)) > op.max_portfolio_exposure_cop
                  )
                    THEN 'blocked'
                ELSE 'manual_review'
            END AS decision,
            CASE
                WHEN op.holding_account_id IS NOT NULL THEN 'holding_finance_policy'
                ELSE 'global_lending_settings'
            END AS policy_source,
            op.exposure_by_trucker,
            op.exposure_by_business,
            op.exposure_by_holding,
            CASE
                WHEN (COALESCE(v_treasury.available_capital, 0) + COALESCE(v_treasury.deployed_capital, 0) + COALESCE(v_treasury.reserved_capital, 0)) > 0 THEN
                    ROUND(
                        (
                            COALESCE(v_treasury.deployed_capital, 0)
                            / (COALESCE(v_treasury.available_capital, 0) + COALESCE(v_treasury.deployed_capital, 0) + COALESCE(v_treasury.reserved_capital, 0))
                        ) * 100.0,
                        2
                    )
                ELSE 0
            END AS portfolio_deployment_percent
        FROM offer_policy op
    )
    SELECT * FROM offer_decision
    ORDER BY due_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_fuel_advance(
    p_trucker_id UUID,
    p_origin_offer_id UUID,
    p_requested_amount DECIMAL DEFAULT NULL,
    p_term_days INTEGER DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    advance_id UUID,
    principal_amount DECIMAL,
    monthly_interest_rate_percent DECIMAL,
    total_due DECIMAL,
    due_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet public.wallets%ROWTYPE;
    v_settings public.lending_settings%ROWTYPE;
    v_eligibility RECORD;
    v_term_days INTEGER;
    v_principal DECIMAL(15,2);
    v_interest DECIMAL(15,2);
    v_due_at TIMESTAMPTZ;
    v_advance_id UUID;
BEGIN
    PERFORM public.mark_overdue_fuel_advances();

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_trucker_id
    FOR UPDATE;

    IF v_wallet.id IS NULL THEN
        RETURN QUERY SELECT false, 'Billetera no encontrada'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    SELECT * INTO v_settings
    FROM public.lending_settings
    WHERE id = 'default';

    SELECT * INTO v_eligibility
    FROM public.get_fuel_advance_eligibility(p_trucker_id)
    WHERE offer_id = p_origin_offer_id
    LIMIT 1;

    IF v_eligibility.offer_id IS NULL THEN
        RETURN QUERY SELECT false, 'La oferta no es elegible para adelanto'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF COALESCE(v_eligibility.decision, 'blocked') = 'blocked' OR NOT COALESCE(v_eligibility.eligible, false) THEN
        RETURN QUERY SELECT false, COALESCE(v_eligibility.reason, 'La oferta no es elegible para adelanto')::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    v_term_days := LEAST(COALESCE(NULLIF(p_term_days, 0), v_settings.max_term_days), v_settings.max_term_days);
    v_principal := COALESCE(NULLIF(p_requested_amount, 0), v_eligibility.max_advance_amount);

    IF v_principal <= 0 THEN
        RETURN QUERY SELECT false, 'El monto solicitado no es valido'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_principal > v_eligibility.max_advance_amount THEN
        RETURN QUERY SELECT false, 'El monto solicitado supera tu cupo disponible'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    v_due_at := NOW() + make_interval(days => v_term_days);
    v_interest := ROUND(v_principal * v_settings.monthly_interest_rate_percent / 100.0 * v_term_days / 30.0, 2);

    INSERT INTO public.fuel_advances (
        trucker_id,
        wallet_id,
        origin_offer_id,
        status,
        principal_amount,
        monthly_interest_rate_percent,
        term_days,
        due_at,
        principal_outstanding,
        interest_outstanding,
        total_due_at_maturity,
        requested_by,
        risk_band,
        policy_snapshot,
        exposure_snapshot,
        metadata
    )
    VALUES (
        p_trucker_id,
        v_wallet.id,
        p_origin_offer_id,
        'requested',
        v_principal,
        v_settings.monthly_interest_rate_percent,
        v_term_days,
        v_due_at,
        v_principal,
        v_interest,
        v_principal + v_interest,
        p_trucker_id,
        COALESCE(v_eligibility.risk_band, 'medium'),
        jsonb_build_object(
            'policy_source', COALESCE(v_eligibility.policy_source, 'global_lending_settings'),
            'monthly_interest_rate_percent', v_settings.monthly_interest_rate_percent,
            'max_term_days', v_settings.max_term_days,
            'requested_amount_cap', v_eligibility.max_advance_amount,
            'decision', COALESCE(v_eligibility.decision, 'manual_review')
        ),
        jsonb_build_object(
            'trucker', COALESCE(v_eligibility.exposure_by_trucker, 0),
            'business', COALESCE(v_eligibility.exposure_by_business, 0),
            'holding', COALESCE(v_eligibility.exposure_by_holding, 0),
            'portfolio_deployment_percent', COALESCE(v_eligibility.portfolio_deployment_percent, 0)
        ),
        jsonb_build_object(
            'decision', COALESCE(v_eligibility.decision, 'manual_review'),
            'decision_reason', v_eligibility.reason,
            'policy_source', COALESCE(v_eligibility.policy_source, 'global_lending_settings'),
            'source_kind', 'advance_request',
            'source_reference', p_origin_offer_id::TEXT
        )
    )
    RETURNING id INTO v_advance_id;

    INSERT INTO public.admin_notifications (type, title, message, data, read, processed)
    VALUES (
        'advance_request',
        'Nueva solicitud de adelanto',
        format('El transportador %s solicito un adelanto por %s.', LEFT(p_trucker_id::TEXT, 8), to_char(v_principal, 'FM999G999G999D00')),
        jsonb_build_object(
            'advance_id', v_advance_id,
            'trucker_id', p_trucker_id,
            'offer_id', p_origin_offer_id,
            'principal_amount', v_principal,
            'term_days', v_term_days,
            'monthly_interest_rate_percent', v_settings.monthly_interest_rate_percent,
            'total_due', v_principal + v_interest,
            'due_at', v_due_at,
            'risk_band', COALESCE(v_eligibility.risk_band, 'medium'),
            'policy_source', COALESCE(v_eligibility.policy_source, 'global_lending_settings'),
            'decision', COALESCE(v_eligibility.decision, 'manual_review')
        ),
        false,
        false
    );

    RETURN QUERY
    SELECT true, 'Solicitud enviada para revision administrativa'::TEXT, v_advance_id, v_principal, v_settings.monthly_interest_rate_percent, v_principal + v_interest, v_due_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_fuel_advance(
    p_advance_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    wallet_id UUID,
    amount_disbursed DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_advance public.fuel_advances%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_treasury public.lending_treasury%ROWTYPE;
    v_settings public.lending_settings%ROWTYPE;
    v_total_capital DECIMAL(15,2);
    v_next_deployment_percent DECIMAL(8,4);
    v_balance_before DECIMAL(15,2);
    v_offer_business_id UUID;
    v_holding_account_id UUID;
    v_policy RECORD;
    v_business_exposure DECIMAL(15,2) := 0;
    v_holding_exposure DECIMAL(15,2) := 0;
    v_trucker_exposure DECIMAL(15,2) := 0;
BEGIN
    PERFORM public.mark_overdue_fuel_advances();

    SELECT * INTO v_advance
    FROM public.fuel_advances
    WHERE id = p_advance_id
    FOR UPDATE;

    IF v_advance.id IS NULL THEN
        RETURN QUERY SELECT false, 'Adelanto no encontrado'::TEXT, NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_advance.status <> 'requested' THEN
        RETURN QUERY SELECT false, 'La solicitud ya fue procesada'::TEXT, v_advance.wallet_id, 0::DECIMAL;
        RETURN;
    END IF;

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE id = v_advance.wallet_id
    FOR UPDATE;

    SELECT * INTO v_treasury
    FROM public.lending_treasury
    WHERE id = 'default'
    FOR UPDATE;

    SELECT * INTO v_settings
    FROM public.lending_settings
    WHERE id = 'default';

    SELECT business_id INTO v_offer_business_id
    FROM public.cargo_offers
    WHERE id = v_advance.origin_offer_id;

    SELECT hbl.holding_account_id,
           hfp.max_single_advance_cop,
           hfp.max_business_exposure_cop,
           hfp.max_portfolio_exposure_cop
    INTO v_policy
    FROM public.holding_business_links hbl
    LEFT JOIN public.holding_finance_policies hfp
      ON hfp.holding_account_id = hbl.holding_account_id
    WHERE hbl.business_id = v_offer_business_id
      AND hbl.status = 'linked'
    LIMIT 1;

    v_holding_account_id := v_policy.holding_account_id;

    SELECT COALESCE(SUM(COALESCE(principal_outstanding, 0) + COALESCE(interest_outstanding, 0)), 0)
    INTO v_trucker_exposure
    FROM public.fuel_advances
    WHERE trucker_id = v_advance.trucker_id
      AND status IN ('disbursed', 'overdue', 'at_risk', 'restructured');

    SELECT COALESCE(SUM(COALESCE(fa.principal_outstanding, 0) + COALESCE(fa.interest_outstanding, 0)), 0)
    INTO v_business_exposure
    FROM public.fuel_advances fa
    JOIN public.cargo_offers co ON co.id = fa.origin_offer_id
    WHERE co.business_id = v_offer_business_id
      AND fa.id <> v_advance.id
      AND fa.status IN ('disbursed', 'overdue', 'at_risk', 'restructured');

    IF v_holding_account_id IS NOT NULL THEN
        SELECT COALESCE(SUM(COALESCE(fa.principal_outstanding, 0) + COALESCE(fa.interest_outstanding, 0)), 0)
        INTO v_holding_exposure
        FROM public.fuel_advances fa
        JOIN public.cargo_offers co ON co.id = fa.origin_offer_id
        JOIN public.holding_business_links hbl
          ON hbl.business_id = co.business_id
         AND hbl.status = 'linked'
        WHERE hbl.holding_account_id = v_holding_account_id
          AND fa.id <> v_advance.id
          AND fa.status IN ('disbursed', 'overdue', 'at_risk', 'restructured');
    END IF;

    IF v_treasury.available_capital < v_advance.principal_amount THEN
        RETURN QUERY SELECT false, 'Tesoreria insuficiente para aprobar este adelanto'::TEXT, v_wallet.id, 0::DECIMAL;
        RETURN;
    END IF;

    IF COALESCE(v_policy.max_business_exposure_cop, 0) > 0
       AND v_business_exposure + v_advance.principal_amount > v_policy.max_business_exposure_cop THEN
        RETURN QUERY SELECT false, 'La empresa supera el tope duro de exposicion para aprobar este adelanto'::TEXT, v_wallet.id, 0::DECIMAL;
        RETURN;
    END IF;

    IF COALESCE(v_policy.max_portfolio_exposure_cop, 0) > 0
       AND v_holding_exposure + v_advance.principal_amount > v_policy.max_portfolio_exposure_cop THEN
        RETURN QUERY SELECT false, 'El holding supera el tope duro de exposicion para aprobar este adelanto'::TEXT, v_wallet.id, 0::DECIMAL;
        RETURN;
    END IF;

    v_total_capital := v_treasury.available_capital + v_treasury.deployed_capital + v_treasury.reserved_capital;
    IF v_total_capital > 0 THEN
        v_next_deployment_percent := ((v_treasury.deployed_capital + v_advance.principal_amount) / v_total_capital) * 100.0;
        IF v_next_deployment_percent > v_settings.portfolio_deployment_limit_percent THEN
            RETURN QUERY SELECT false, 'La aprobacion supera el limite de despliegue del portafolio'::TEXT, v_wallet.id, 0::DECIMAL;
            RETURN;
        END IF;
    END IF;

    UPDATE public.lending_treasury
    SET available_capital = available_capital - v_advance.principal_amount,
        deployed_capital = deployed_capital + v_advance.principal_amount,
        updated_at = NOW()
    WHERE id = 'default';

    v_balance_before := COALESCE(v_wallet.available_balance, 0);

    UPDATE public.wallets
    SET available_balance = available_balance + v_advance.principal_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO public.transactions (
        wallet_id,
        offer_id,
        type,
        status,
        amount,
        balance_before,
        balance_after,
        description,
        reference_id,
        metadata
    ) VALUES (
        v_wallet.id,
        v_advance.origin_offer_id,
        'advance_disbursement',
        'completed',
        v_advance.principal_amount,
        v_balance_before,
        v_balance_before + v_advance.principal_amount,
        format('Adelanto KargaX aprobado para viaje #%s', LEFT(v_advance.origin_offer_id::TEXT, 8)),
        v_advance.id::TEXT,
        jsonb_build_object(
            'advance_id', v_advance.id,
            'approved_by', p_admin_id,
            'note', p_note,
            'source_kind', 'advance_disbursement',
            'source_reference', v_advance.id::TEXT,
            'policy_snapshot', jsonb_build_object(
                'policy_source', COALESCE(v_advance.policy_snapshot->>'policy_source', CASE WHEN v_holding_account_id IS NOT NULL THEN 'holding_finance_policy' ELSE 'global_lending_settings' END),
                'portfolio_deployment_limit_percent', v_settings.portfolio_deployment_limit_percent,
                'max_single_advance_cop', COALESCE(v_policy.max_single_advance_cop, 0),
                'max_business_exposure_cop', COALESCE(v_policy.max_business_exposure_cop, 0),
                'max_holding_exposure_cop', COALESCE(v_policy.max_portfolio_exposure_cop, 0)
            ),
            'exposure_snapshot', jsonb_build_object(
                'trucker', v_trucker_exposure,
                'business', v_business_exposure,
                'holding', v_holding_exposure,
                'portfolio_deployment_percent', COALESCE(v_next_deployment_percent, 0)
            )
        )
    );

    UPDATE public.fuel_advances
    SET status = 'disbursed',
        approved_at = NOW(),
        disbursed_at = NOW(),
        approved_by = p_admin_id,
        risk_band = COALESCE(NULLIF(v_advance.risk_band, ''), 'medium'),
        policy_snapshot = jsonb_strip_nulls(
            COALESCE(v_advance.policy_snapshot, '{}'::jsonb)
            || jsonb_build_object(
                'approved_at', NOW(),
                'approved_by', p_admin_id,
                'approval_note', p_note,
                'policy_source', COALESCE(v_advance.policy_snapshot->>'policy_source', CASE WHEN v_holding_account_id IS NOT NULL THEN 'holding_finance_policy' ELSE 'global_lending_settings' END),
                'max_single_advance_cop', COALESCE(v_policy.max_single_advance_cop, 0),
                'max_business_exposure_cop', COALESCE(v_policy.max_business_exposure_cop, 0),
                'max_holding_exposure_cop', COALESCE(v_policy.max_portfolio_exposure_cop, 0),
                'portfolio_deployment_limit_percent', v_settings.portfolio_deployment_limit_percent
            )
        ),
        exposure_snapshot = jsonb_strip_nulls(
            COALESCE(v_advance.exposure_snapshot, '{}'::jsonb)
            || jsonb_build_object(
                'trucker', v_trucker_exposure,
                'business', v_business_exposure,
                'holding', v_holding_exposure,
                'portfolio_deployment_percent', COALESCE(v_next_deployment_percent, 0),
                'holding_account_id', v_holding_account_id
            )
        ),
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
            'approval_note', p_note,
            'source_kind', 'advance_disbursement',
            'source_reference', v_advance.id::TEXT
        )
    WHERE id = v_advance.id;

    RETURN QUERY SELECT true, 'Adelanto aprobado y abonado a la billetera'::TEXT, v_wallet.id, v_advance.principal_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.restructure_fuel_advance(
    p_advance_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings public.lending_settings%ROWTYPE;
    v_advance public.fuel_advances%ROWTYPE;
    v_updated INTEGER := 0;
BEGIN
    SELECT * INTO v_settings FROM public.lending_settings WHERE id = 'default';
    SELECT * INTO v_advance FROM public.fuel_advances WHERE id = p_advance_id FOR UPDATE;

    UPDATE public.fuel_advances
    SET status = 'restructured',
        due_at = NOW() + make_interval(days => v_settings.max_term_days),
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
            'restructured_at', NOW(),
            'restructured_by', p_admin_id,
            'restructure_note', p_note,
            'previous_status', v_advance.status
        ),
        policy_snapshot = COALESCE(policy_snapshot, '{}'::jsonb) || jsonb_build_object(
            'restructured_at', NOW(),
            'restructured_by', p_admin_id,
            'previous_status', v_advance.status
        )
    WHERE id = p_advance_id
      AND status IN ('disbursed', 'overdue', 'at_risk', 'restructured');

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_off_fuel_advance(
    p_advance_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_advance public.fuel_advances%ROWTYPE;
    v_updated INTEGER := 0;
BEGIN
    SELECT * INTO v_advance
    FROM public.fuel_advances
    WHERE id = p_advance_id
    FOR UPDATE;

    IF v_advance.id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_advance.status IN ('completed', 'rejected', 'cancelled', 'written_off') THEN
        RETURN FALSE;
    END IF;

    UPDATE public.lending_treasury
    SET deployed_capital = GREATEST(deployed_capital - COALESCE(v_advance.principal_outstanding, 0), 0),
        updated_at = NOW()
    WHERE id = 'default';

    UPDATE public.fuel_advances
    SET status = 'written_off',
        principal_outstanding = 0,
        interest_outstanding = 0,
        risk_band = 'critical',
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
            'written_off_at', NOW(),
            'written_off_by', p_admin_id,
            'write_off_note', p_note,
            'previous_status', v_advance.status
        ),
        policy_snapshot = COALESCE(policy_snapshot, '{}'::jsonb) || jsonb_build_object(
            'written_off_at', NOW(),
            'written_off_by', p_admin_id,
            'previous_status', v_advance.status
        )
    WHERE id = p_advance_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_overdue_fuel_advances()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    WITH updated AS (
        UPDATE public.fuel_advances
        SET status = CASE
                WHEN due_at < NOW() - INTERVAL '7 days' THEN 'at_risk'
                WHEN due_at < NOW() THEN 'overdue'
                ELSE status
            END,
            updated_at = NOW()
        WHERE status IN ('disbursed', 'overdue', 'restructured', 'at_risk')
          AND due_at < NOW()
          AND status IS DISTINCT FROM CASE
                WHEN due_at < NOW() - INTERVAL '7 days' THEN 'at_risk'
                WHEN due_at < NOW() THEN 'overdue'
                ELSE status
            END
        RETURNING id, trucker_id, status
    )
    SELECT COUNT(*) INTO v_count FROM updated;

    INSERT INTO public.admin_notifications (type, title, message, data, read, processed)
    SELECT
        'advance_overdue',
        CASE WHEN u.status = 'at_risk' THEN 'Adelanto en riesgo' ELSE 'Adelanto vencido' END,
        format('El adelanto %s requiere seguimiento de cobranza.', LEFT(u.id::TEXT, 8)),
        jsonb_build_object(
            'advance_id', u.id,
            'trucker_id', u.trucker_id,
            'status', u.status
        ),
        false,
        false
    FROM updated u;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fuel_advance_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fuel_advance_eligibility TO service_role;
GRANT EXECUTE ON FUNCTION public.request_fuel_advance TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_fuel_advance TO service_role;

COMMIT;
