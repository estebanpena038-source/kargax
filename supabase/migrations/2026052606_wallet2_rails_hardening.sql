-- =============================================================================
-- KARGAX - WALLET2.0 RAILS HARDENING
--
-- High-risk financial migration:
-- - marketplace is the only withdrawable wallet rail
-- - private fleet payroll/freight/expenses stay external-proof/documentary
-- - Mercado Pago webhook reconciles payments; route completion releases wallet
-- - no historical balance mutation is performed here
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Transactions: rails, payout eligibility, pending audit columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS pending_balance_before NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pending_balance_after NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS money_rail TEXT,
    ADD COLUMN IF NOT EXISTS source_system TEXT,
    ADD COLUMN IF NOT EXISTS payout_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payout_attempt_id UUID,
    ADD COLUMN IF NOT EXISTS locked_for_payout BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS external_proof_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_rail_status_created
    ON public.transactions(wallet_id, money_rail, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_payout_eligible
    ON public.transactions(wallet_id, payout_eligible, locked_for_payout, created_at DESC)
    WHERE payout_eligible = TRUE;

CREATE INDEX IF NOT EXISTS idx_transactions_payout_attempt_id
    ON public.transactions(payout_attempt_id)
    WHERE payout_attempt_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_marketplace_release_idempotency
    ON public.transactions((metadata->>'idempotency_key'))
    WHERE type = 'trip_deposit'
      AND metadata ? 'idempotency_key'
      AND COALESCE(metadata->>'source_kind', '') IN ('marketplace_freight_release', 'trip_settlement');

-- -----------------------------------------------------------------------------
-- Payout attempts: provider lifecycle and reconciliation metadata
-- -----------------------------------------------------------------------------

ALTER TABLE public.payout_attempts
    ADD COLUMN IF NOT EXISTS source_kind TEXT,
    ADD COLUMN IF NOT EXISTS source_id UUID,
    ADD COLUMN IF NOT EXISTS offer_id UUID,
    ADD COLUMN IF NOT EXISTS payment_id UUID,
    ADD COLUMN IF NOT EXISTS trucker_id UUID,
    ADD COLUMN IF NOT EXISTS provider_transfer_id TEXT,
    ADD COLUMN IF NOT EXISTS receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS destination_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS attempts_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS manual_review_at TIMESTAMPTZ;

ALTER TABLE public.payout_methods
    DROP CONSTRAINT IF EXISTS payout_methods_provider_preference_check,
    ADD CONSTRAINT payout_methods_provider_preference_check
        CHECK (provider_preference IN ('nequi', 'wompi', 'manual', 'cobre', 'bank_partner'));

ALTER TABLE public.payout_attempts
    DROP CONSTRAINT IF EXISTS payout_attempts_provider_check,
    ADD CONSTRAINT payout_attempts_provider_check
        CHECK (provider IN ('nequi', 'wompi', 'manual', 'cobre', 'bank_partner'));

ALTER TABLE public.payout_attempts
    DROP CONSTRAINT IF EXISTS payout_attempts_status_check,
    ADD CONSTRAINT payout_attempts_status_check
        CHECK (status IN ('requested', 'queued', 'processing', 'paid', 'failed', 'reversed', 'manual_review', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_attempts_idempotency_key
    ON public.payout_attempts(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_attempts_provider_transfer
    ON public.payout_attempts(provider, provider_transfer_id)
    WHERE provider_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_attempts_queue
    ON public.payout_attempts(status, next_retry_at, created_at)
    WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_payout_attempts_trucker_created
    ON public.payout_attempts(trucker_id, created_at DESC)
    WHERE trucker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_attempts_offer
    ON public.payout_attempts(offer_id, status)
    WHERE offer_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Private fleet external payroll/proof fields
-- -----------------------------------------------------------------------------

ALTER TABLE public.private_fleet_payroll_runs
    ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'external_proof',
    ADD COLUMN IF NOT EXISTS external_payment_status TEXT NOT NULL DEFAULT 'pending_external_pay',
    ADD COLUMN IF NOT EXISTS external_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS external_paid_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_payment_method TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_reference TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_proof_url TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_proof_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_note TEXT;

ALTER TABLE public.private_fleet_payroll_runs
    DROP CONSTRAINT IF EXISTS private_fleet_payroll_runs_status_check,
    ADD CONSTRAINT private_fleet_payroll_runs_status_check
        CHECK (status IN (
            'draft', 'approved', 'checkout_pending', 'funded', 'released', 'cancelled', 'failed',
            'pending_external_pay', 'proof_uploaded', 'paid_external', 'rejected'
        ));

ALTER TABLE public.private_fleet_payroll_runs
    DROP CONSTRAINT IF EXISTS private_fleet_payroll_runs_payment_mode_check,
    ADD CONSTRAINT private_fleet_payroll_runs_payment_mode_check
        CHECK (payment_mode IN ('external_proof', 'mercadopago_funded'));

ALTER TABLE public.private_fleet_payroll_runs
    DROP CONSTRAINT IF EXISTS private_fleet_payroll_runs_external_payment_status_check,
    ADD CONSTRAINT private_fleet_payroll_runs_external_payment_status_check
        CHECK (external_payment_status IN ('pending_external_pay', 'proof_uploaded', 'paid_external', 'rejected', 'cancelled'));

ALTER TABLE public.private_fleet_payroll_items
    DROP CONSTRAINT IF EXISTS private_fleet_payroll_items_status_check,
    ADD CONSTRAINT private_fleet_payroll_items_status_check
        CHECK (status IN ('pending', 'funded', 'released_to_wallet', 'cancelled', 'failed', 'proof_uploaded', 'paid_external', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_private_fleet_payroll_runs_external_status
    ON public.private_fleet_payroll_runs(business_id, external_payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_fleet_payroll_runs_payment_mode
    ON public.private_fleet_payroll_runs(payment_mode, status, created_at DESC);

ALTER TABLE public.trip_financial_allocations
    ADD COLUMN IF NOT EXISTS external_payment_status TEXT,
    ADD COLUMN IF NOT EXISTS external_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS external_paid_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_payment_method TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_reference TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_proof_url TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_proof_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_note TEXT;

ALTER TABLE public.trip_financial_allocations
    DROP CONSTRAINT IF EXISTS trip_financial_allocations_status_check,
    ADD CONSTRAINT trip_financial_allocations_status_check
        CHECK (status IN (
            'held_in_custody',
            'released_to_wallet',
            'refunded',
            'external_proof_pending',
            'proof_uploaded',
            'paid_external',
            'rejected',
            'cancelled'
        ));

ALTER TABLE public.trip_financial_allocations
    DROP CONSTRAINT IF EXISTS trip_financial_allocations_external_payment_status_check,
    ADD CONSTRAINT trip_financial_allocations_external_payment_status_check
        CHECK (
            external_payment_status IS NULL
            OR external_payment_status IN ('pending_external_pay', 'proof_uploaded', 'paid_external', 'rejected', 'cancelled')
        );

CREATE INDEX IF NOT EXISTS idx_trip_financial_allocations_external_status
    ON public.trip_financial_allocations(business_id, external_payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.private_fleet_payment_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    run_id UUID REFERENCES public.private_fleet_payroll_runs(id) ON DELETE CASCADE,
    allocation_id UUID REFERENCES public.trip_financial_allocations(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('nequi', 'bank_transfer', 'cash', 'other')),
    external_reference TEXT,
    amount_cop NUMERIC(15,2) NOT NULL CHECK (amount_cop > 0),
    proof_url TEXT,
    storage_path TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT private_fleet_payment_proofs_target_check
        CHECK (run_id IS NOT NULL OR allocation_id IS NOT NULL OR offer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_private_fleet_payment_proofs_run
    ON public.private_fleet_payment_proofs(run_id, created_at DESC)
    WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_private_fleet_payment_proofs_allocation
    ON public.private_fleet_payment_proofs(allocation_id, created_at DESC)
    WHERE allocation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_private_fleet_payment_proofs_business
    ON public.private_fleet_payment_proofs(business_id, created_at DESC);

ALTER TABLE public.private_fleet_payment_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Businesses and truckers can view private fleet payment proofs" ON public.private_fleet_payment_proofs;
CREATE POLICY "Businesses and truckers can view private fleet payment proofs"
    ON public.private_fleet_payment_proofs FOR SELECT TO authenticated
    USING (
        business_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = private_fleet_payment_proofs.business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
              AND btm.role IN ('owner', 'finance_accountant', 'auditor')
        )
        OR EXISTS (
            SELECT 1
            FROM public.private_fleet_payroll_items pfi
            WHERE pfi.run_id = private_fleet_payment_proofs.run_id
              AND pfi.trucker_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.trip_financial_allocations tfa
            WHERE tfa.id = private_fleet_payment_proofs.allocation_id
              AND tfa.trucker_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

GRANT SELECT ON public.private_fleet_payment_proofs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.private_fleet_payment_proofs TO service_role;

-- -----------------------------------------------------------------------------
-- Conservative backfill: labels and guards only, no balance changes
-- -----------------------------------------------------------------------------

UPDATE public.transactions
SET money_rail = CASE
        WHEN type = 'trip_deposit'
          AND COALESCE(metadata->>'source_kind', '') IN ('trip_settlement', 'marketplace_freight_release')
            THEN 'marketplace_freelancer'
        WHEN type = 'trip_pending'
            THEN 'marketplace_freelancer'
        WHEN type = 'private_fleet_salary'
            THEN 'private_fleet_external_or_legacy'
        WHEN COALESCE(metadata->>'source_kind', '') LIKE 'private_fleet%'
            THEN 'private_fleet_external_or_legacy'
        WHEN type = 'withdrawal'
            THEN COALESCE(money_rail, 'wallet_withdrawal')
        ELSE COALESCE(money_rail, 'legacy')
    END,
    source_system = COALESCE(source_system, 'wallet2_backfill'),
    payout_eligible = CASE
        WHEN type = 'trip_deposit'
          AND COALESCE(metadata->>'source_kind', '') IN ('trip_settlement', 'marketplace_freight_release')
          AND COALESCE(external_proof_only, FALSE) = FALSE
            THEN TRUE
        ELSE FALSE
    END,
    locked_for_payout = CASE
        WHEN type = 'private_fleet_salary'
          OR COALESCE(money_rail, '') LIKE 'private_fleet%'
          OR COALESCE(metadata->>'source_kind', '') LIKE 'private_fleet%'
            THEN FALSE
        ELSE COALESCE(locked_for_payout, FALSE)
    END,
    external_proof_only = CASE
        WHEN type = 'private_fleet_salary'
          OR COALESCE(money_rail, '') LIKE 'private_fleet%'
          OR COALESCE(metadata->>'source_kind', '') LIKE 'private_fleet%'
            THEN TRUE
        ELSE COALESCE(external_proof_only, FALSE)
    END,
    metadata = CASE
        WHEN type = 'private_fleet_salary'
          OR COALESCE(money_rail, '') LIKE 'private_fleet%'
          OR COALESCE(metadata->>'source_kind', '') LIKE 'private_fleet%'
            THEN jsonb_strip_nulls(
                COALESCE(metadata, '{}'::jsonb) ||
                jsonb_build_object(
                    'wallet2_guarded_at', NOW(),
                    'wallet2_guard_reason', 'private_fleet_non_withdrawable'
                )
            )
        ELSE metadata
    END
WHERE money_rail IS NULL
   OR payout_eligible = TRUE
   OR type = 'private_fleet_salary'
   OR COALESCE(metadata->>'source_kind', '') LIKE 'private_fleet%';

CREATE OR REPLACE FUNCTION public.normalize_wallet2_transaction_rails()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_source_kind TEXT;
BEGIN
    v_source_kind := COALESCE(NEW.metadata->>'source_kind', '');

    IF NEW.type = 'private_fleet_salary'
       OR COALESCE(NEW.money_rail, '') LIKE 'private_fleet%'
       OR v_source_kind LIKE 'private_fleet%' THEN
        NEW.money_rail := 'private_fleet_external_or_legacy';
        NEW.payout_eligible := FALSE;
        NEW.locked_for_payout := FALSE;
        NEW.external_proof_only := TRUE;
        NEW.source_system := COALESCE(NEW.source_system, 'private_fleet');
        NEW.metadata := jsonb_strip_nulls(
            COALESCE(NEW.metadata, '{}'::jsonb)
            || jsonb_build_object(
                'wallet2_guarded_at', COALESCE(NEW.created_at, NOW()),
                'wallet2_guard_reason', 'private_fleet_non_withdrawable'
            )
        );
        RETURN NEW;
    END IF;

    IF NEW.type = 'trip_pending' THEN
        NEW.money_rail := COALESCE(NULLIF(NEW.money_rail, 'legacy'), 'marketplace_freelancer');
        NEW.payout_eligible := FALSE;
        NEW.locked_for_payout := FALSE;
        NEW.external_proof_only := FALSE;
        NEW.source_system := COALESCE(NEW.source_system, 'mercado_pago');
        RETURN NEW;
    END IF;

    IF NEW.type = 'trip_deposit'
       AND v_source_kind IN ('trip_settlement', 'marketplace_freight_release') THEN
        NEW.money_rail := 'marketplace_freelancer';
        NEW.payout_eligible := COALESCE(NEW.payout_eligible, TRUE);
        NEW.external_proof_only := FALSE;
        NEW.source_system := COALESCE(NEW.source_system, 'route_completion');
        RETURN NEW;
    END IF;

    IF NEW.type = 'withdrawal' THEN
        NEW.money_rail := COALESCE(NULLIF(NEW.money_rail, 'legacy'), 'wallet_withdrawal');
        NEW.payout_eligible := FALSE;
        NEW.external_proof_only := FALSE;
        RETURN NEW;
    END IF;

    NEW.money_rail := COALESCE(NEW.money_rail, 'legacy');
    NEW.source_system := COALESCE(NEW.source_system, 'wallet2_default');
    NEW.payout_eligible := COALESCE(NEW.payout_eligible, FALSE);
    NEW.locked_for_payout := COALESCE(NEW.locked_for_payout, FALSE);
    NEW.external_proof_only := COALESCE(NEW.external_proof_only, FALSE);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_normalize_wallet2_transaction_rails ON public.transactions;
CREATE TRIGGER trigger_normalize_wallet2_transaction_rails
    BEFORE INSERT OR UPDATE OF type, metadata, money_rail, payout_eligible, locked_for_payout, external_proof_only
    ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_wallet2_transaction_rails();

-- -----------------------------------------------------------------------------
-- RPC: marketplace withdrawable balance and marketplace-only withdrawal request
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_marketplace_withdrawable_balance(p_wallet_id UUID)
RETURNS TABLE(
    available_cop NUMERIC,
    derived_balance_cop NUMERIC,
    legacy_wallet_available_cop NUMERIC,
    private_withdrawable_leak_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_eligible NUMERIC(15,2) := 0;
    v_withdrawals NUMERIC(15,2) := 0;
    v_private_leaks INTEGER := 0;
BEGIN
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE id = p_wallet_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::INTEGER;
        RETURN;
    END IF;

    SELECT COALESCE(SUM(GREATEST(amount, 0)), 0)
    INTO v_eligible
    FROM public.transactions
    WHERE wallet_id = p_wallet_id
      AND type = 'trip_deposit'
      AND status = 'completed'
      AND money_rail = 'marketplace_freelancer'
      AND payout_eligible = TRUE
      AND locked_for_payout = FALSE
      AND COALESCE(external_proof_only, FALSE) = FALSE;

    SELECT COALESCE(SUM(ABS(amount)), 0)
    INTO v_withdrawals
    FROM public.transactions
    WHERE wallet_id = p_wallet_id
      AND type = 'withdrawal'
      AND status IN ('pending', 'completed')
      AND money_rail = 'marketplace_freelancer';

    SELECT COUNT(*)::INTEGER
    INTO v_private_leaks
    FROM public.transactions
    WHERE wallet_id = p_wallet_id
      AND (
        type = 'private_fleet_salary'
        OR COALESCE(money_rail, '') LIKE 'private_fleet%'
        OR COALESCE(metadata->>'source_kind', '') LIKE 'private_fleet%'
        OR COALESCE(external_proof_only, FALSE) = TRUE
      )
      AND (payout_eligible = TRUE OR locked_for_payout = TRUE);

    RETURN QUERY SELECT
        GREATEST(LEAST(COALESCE(v_wallet.available_balance, 0), GREATEST(v_eligible - v_withdrawals, 0)), 0)::NUMERIC,
        GREATEST(v_eligible - v_withdrawals, 0)::NUMERIC,
        COALESCE(v_wallet.available_balance, 0)::NUMERIC,
        v_private_leaks;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_marketplace_withdrawal_request(
    p_user_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_payment_details JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    request_id UUID,
    available_balance_after NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_balance RECORD;
    v_request_id UUID;
    v_balance_before NUMERIC(15,2);
    v_balance_after NUMERIC(15,2);
    v_method_label TEXT;
    v_locked_for_payout BOOLEAN;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN QUERY SELECT false, 'Monto invalido'::TEXT, NULL::UUID, 0::NUMERIC;
        RETURN;
    END IF;

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Billetera no encontrada'::TEXT, NULL::UUID, 0::NUMERIC;
        RETURN;
    END IF;

    SELECT * INTO v_balance
    FROM public.get_marketplace_withdrawable_balance(v_wallet.id);

    IF p_amount > COALESCE(v_balance.available_cop, 0) THEN
        RETURN QUERY SELECT
            false,
            'Solo puedes retirar saldo marketplace confirmado. Las liquidaciones privadas quedan como comprobante externo.'::TEXT,
            NULL::UUID,
            COALESCE(v_balance.available_cop, 0)::NUMERIC;
        RETURN;
    END IF;

    v_balance_before := COALESCE(v_wallet.available_balance, 0);
    v_balance_after := v_balance_before - p_amount;
    v_locked_for_payout := LOWER(COALESCE(p_payment_details->>'automatic_payouts_enabled', 'false')) = 'true';
    v_method_label := CASE
        WHEN p_payment_method = 'nequi' THEN 'Nequi'
        WHEN p_payment_method = 'savings' THEN 'cuenta de ahorros'
        WHEN p_payment_method = 'checking' THEN 'cuenta corriente'
        ELSE 'metodo bancario'
    END;

    UPDATE public.wallets
    SET available_balance = v_balance_after,
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
        pending_balance_before,
        pending_balance_after,
        description,
        reference_id,
        metadata,
        money_rail,
        source_system,
        payout_eligible,
        locked_for_payout,
        external_proof_only
    ) VALUES (
        v_wallet.id,
        NULL,
        'withdrawal',
        'pending',
        p_amount * -1,
        v_balance_before,
        v_balance_after,
        COALESCE(v_wallet.pending_balance, 0),
        COALESCE(v_wallet.pending_balance, 0),
        format('Solicitud de retiro marketplace a %s', v_method_label),
        NULL,
        jsonb_strip_nulls(
            COALESCE(p_payment_details, '{}'::jsonb) ||
            jsonb_build_object(
                'payment_method', p_payment_method,
                'requested_by', p_user_id,
                'requested_at', NOW(),
                'source_kind', 'withdrawal_request',
                'rail_validation', 'marketplace_payout_eligible'
            )
        ),
        'marketplace_freelancer',
        COALESCE(p_payment_details->>'payout_provider', 'manual'),
        FALSE,
        v_locked_for_payout,
        FALSE
    )
    RETURNING id INTO v_request_id;

    UPDATE public.transactions
    SET reference_id = v_request_id::TEXT,
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
                'withdrawal_request_id', v_request_id::TEXT,
                'reference_id', v_request_id::TEXT
            )
        )
    WHERE id = v_request_id;

    RETURN QUERY SELECT true, 'Solicitud de retiro marketplace creada'::TEXT, v_request_id, v_balance_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_withdrawable_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_marketplace_withdrawal_request(UUID, NUMERIC, TEXT, JSONB) TO service_role;

-- -----------------------------------------------------------------------------
-- Payout processor RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_payout_attempts(p_limit INTEGER DEFAULT 10)
RETURNS SETOF public.payout_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH picked AS (
        SELECT id
        FROM public.payout_attempts
        WHERE status IN ('queued', 'failed')
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
          AND COALESCE(attempts_count, 0) < 5
        ORDER BY created_at ASC
        LIMIT GREATEST(LEAST(COALESCE(p_limit, 10), 50), 1)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.payout_attempts pa
    SET status = 'processing',
        processing_started_at = NOW(),
        attempts_count = COALESCE(pa.attempts_count, 0) + 1,
        updated_at = NOW()
    FROM picked
    WHERE pa.id = picked.id
    RETURNING pa.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_paid(
    p_payout_attempt_id UUID,
    p_provider_transfer_id TEXT DEFAULT NULL,
    p_receipt_url TEXT DEFAULT NULL,
    p_provider_response JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt public.payout_attempts%ROWTYPE;
    v_transaction public.transactions%ROWTYPE;
    v_amount NUMERIC(15,2);
BEGIN
    SELECT * INTO v_attempt
    FROM public.payout_attempts
    WHERE id = p_payout_attempt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'payout_attempt_not_found';
    END IF;

    IF v_attempt.status = 'paid' THEN
        RETURN TRUE;
    END IF;

    SELECT * INTO v_transaction
    FROM public.transactions
    WHERE id = v_attempt.wallet_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'wallet_transaction_not_found';
    END IF;

    v_amount := ABS(COALESCE(v_transaction.amount, 0));

    UPDATE public.payout_attempts
    SET status = 'paid',
        provider_transfer_id = COALESCE(p_provider_transfer_id, provider_transfer_id),
        provider_reference = COALESCE(p_provider_transfer_id, provider_reference),
        receipt_url = COALESCE(p_receipt_url, receipt_url),
        provider_response = COALESCE(p_provider_response, '{}'::jsonb),
        paid_at = COALESCE(paid_at, NOW()),
        failed_at = NULL,
        failure_code = NULL,
        failure_message = NULL,
        failure_reason = NULL,
        updated_at = NOW()
    WHERE id = v_attempt.id;

    UPDATE public.transactions
    SET status = 'completed',
        payout_attempt_id = v_attempt.id,
        locked_for_payout = FALSE,
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
                'payout_attempt_id', v_attempt.id::TEXT,
                'provider_transfer_id', p_provider_transfer_id,
                'receipt_url', p_receipt_url,
                'payout_status', 'paid',
                'payout_paid_at', NOW()
            )
        )
    WHERE id = v_transaction.id;

    UPDATE public.wallets
    SET total_withdrawn = COALESCE(total_withdrawn, 0) + v_amount,
        updated_at = NOW()
    WHERE id = v_transaction.wallet_id;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_failed(
    p_payout_attempt_id UUID,
    p_failure_reason TEXT DEFAULT NULL,
    p_provider_response JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt public.payout_attempts%ROWTYPE;
    v_next_status TEXT;
BEGIN
    SELECT * INTO v_attempt
    FROM public.payout_attempts
    WHERE id = p_payout_attempt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'payout_attempt_not_found';
    END IF;

    IF v_attempt.status = 'paid' THEN
        RETURN TRUE;
    END IF;

    v_next_status := CASE
        WHEN COALESCE(v_attempt.attempts_count, 0) >= 5 THEN 'manual_review'
        ELSE 'failed'
    END;

    UPDATE public.payout_attempts
    SET status = v_next_status,
        failure_reason = NULLIF(BTRIM(p_failure_reason), ''),
        failure_message = NULLIF(BTRIM(p_failure_reason), ''),
        provider_response = COALESCE(p_provider_response, '{}'::jsonb),
        failed_at = NOW(),
        manual_review_at = CASE WHEN v_next_status = 'manual_review' THEN NOW() ELSE manual_review_at END,
        next_retry_at = CASE
            WHEN v_next_status = 'failed' THEN NOW() + INTERVAL '15 minutes'
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = v_attempt.id;

    UPDATE public.transactions
    SET payout_attempt_id = v_attempt.id,
        locked_for_payout = TRUE,
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
                'payout_attempt_id', v_attempt.id::TEXT,
                'payout_status', v_next_status,
                'payout_failure_reason', NULLIF(BTRIM(p_failure_reason), '')
            )
        )
    WHERE id = v_attempt.wallet_transaction_id;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_manual_review(
    p_payout_attempt_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.payout_attempts
    SET status = 'manual_review',
        failure_reason = COALESCE(NULLIF(BTRIM(p_reason), ''), failure_reason),
        failure_message = COALESCE(NULLIF(BTRIM(p_reason), ''), failure_message),
        manual_review_at = NOW(),
        next_retry_at = NULL,
        updated_at = NOW()
    WHERE id = p_payout_attempt_id
      AND status <> 'paid';

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_payout_attempts(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payout_paid(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payout_failed(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payout_manual_review(UUID, TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- Delivery completion: close route only. Wallet release happens from server code.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_delivery_pin(
    p_offer_id UUID,
    p_input_pin VARCHAR(6),
    p_trucker_id UUID DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    amount_released DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offer RECORD;
    v_payment_id UUID;
    v_max_attempts INTEGER := 5;
    v_release_amount DECIMAL(15,2);
    v_effective_trucker_id UUID := COALESCE(p_trucker_id, auth.uid());
BEGIN
    SELECT * INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_effective_trucker_id IS NULL OR (
        v_offer.assigned_trucker_id IS DISTINCT FROM v_effective_trucker_id
        AND COALESCE(v_offer.private_fleet_trucker_id, v_offer.assigned_trucker_id) IS DISTINCT FROM v_effective_trucker_id
    ) THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta operacion'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT false, 'Primero debes verificar el pickup'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.status <> 'in_progress' THEN
        RETURN QUERY SELECT false, 'La oferta no esta en transito'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.delivery_verified_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 'La entrega ya fue verificada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF COALESCE(v_offer.pin_attempts, 0) >= v_max_attempts THEN
        RETURN QUERY SELECT false, 'Demasiados intentos fallidos. Contacta soporte.'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.delivery_pin IS NULL THEN
        RETURN QUERY SELECT false, 'PIN de entrega no ha sido generado'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF UPPER(TRIM(v_offer.delivery_pin)) <> UPPER(TRIM(p_input_pin)) THEN
        UPDATE public.cargo_offers
        SET pin_attempts = COALESCE(pin_attempts, 0) + 1,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY SELECT
            false,
            format('PIN incorrecto. Intentos restantes: %s', v_max_attempts - COALESCE(v_offer.pin_attempts, 0) - 1)::TEXT,
            0::DECIMAL;
        RETURN;
    END IF;

    SELECT p.id INTO v_payment_id
    FROM public.payments p
    WHERE p.offer_id = p_offer_id
      AND p.status = 'completed'
    ORDER BY p.completed_at DESC NULLS LAST, p.created_at DESC
    LIMIT 1;

    IF COALESCE(v_offer.is_private_fleet, FALSE) = FALSE AND v_payment_id IS NULL THEN
        RETURN QUERY SELECT false, 'No existe pago confirmado para liberar este viaje'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    v_release_amount := COALESCE(v_offer.net_amount, v_offer.freight_payment_amount, v_offer.total_amount, 0);

    IF COALESCE(v_offer.is_private_fleet, FALSE) = TRUE THEN
        UPDATE public.trip_financial_allocations
        SET status = CASE
                WHEN status IN ('paid_external', 'proof_uploaded', 'rejected', 'cancelled') THEN status
                ELSE 'external_proof_pending'
            END,
            external_payment_status = CASE
                WHEN external_payment_status IN ('paid_external', 'proof_uploaded', 'rejected', 'cancelled') THEN external_payment_status
                ELSE 'pending_external_pay'
            END,
            payment_id = COALESCE(payment_id, v_payment_id),
            metadata = jsonb_strip_nulls(
                COALESCE(metadata, '{}'::jsonb) ||
                jsonb_build_object(
                    'delivery_closed_at', NOW(),
                    'proof_required', TRUE,
                    'released_reason', 'external_private_fleet_delivery_closed',
                    'wallet_touched', FALSE
                )
            )
        WHERE offer_id = p_offer_id
          AND allocation_type IN ('freight_payment', 'trip_pay', 'expense_advance', 'company_expense');
    END IF;

    UPDATE public.cargo_offers
    SET status = 'completed',
        delivery_verified_at = NOW(),
        pin_attempts = 0,
        updated_at = NOW()
    WHERE id = p_offer_id;

    IF v_offer.destination_appointment_id IS NOT NULL THEN
        UPDATE public.warehouse_appointments
        SET status = 'completed',
            actual_start_at = COALESCE(actual_start_at, NOW()),
            actual_end_at = COALESCE(actual_end_at, NOW()),
            checked_in_at = COALESCE(checked_in_at, NOW()),
            checked_out_at = COALESCE(checked_out_at, NOW()),
            payment_status = CASE
                WHEN payment_status = 'n_a' THEN payment_status
                ELSE 'completed'
            END,
            updated_at = NOW()
        WHERE id = v_offer.destination_appointment_id
          AND status <> 'cancelled';
    END IF;

    UPDATE public.warehouse_tasks
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
                'completed_from_offer_event', 'delivery_pin_verified',
                'offer_id', p_offer_id::TEXT,
                'appointment_id', v_offer.destination_appointment_id::TEXT
            )
        ),
        updated_at = NOW()
    WHERE offer_id = p_offer_id
      AND status IN ('open', 'in_progress', 'blocked')
      AND task_type IN ('receiving', 'dispatch');

    UPDATE public.trucker_profiles
    SET total_trips = total_trips + 1,
        updated_at = NOW()
    WHERE user_id = v_offer.assigned_trucker_id;

    UPDATE public.business_profiles
    SET total_shipments = total_shipments + 1,
        updated_at = NOW()
    WHERE user_id = v_offer.business_id;

    IF COALESCE(v_offer.is_private_fleet, FALSE) = TRUE THEN
        PERFORM public.create_notification(
            v_effective_trucker_id,
            'private_fleet_freight_released',
            'Viaje privado cerrado',
            'Tu viaje privado fue cerrado. La liquidacion queda como comprobante externo de tu empresa.',
            jsonb_build_object(
                'offer_id', p_offer_id,
                'amount', v_release_amount,
                'external_proof_only', TRUE,
                'wallet_touched', FALSE
            )
        );

        RETURN QUERY SELECT
            true,
            'Viaje privado completado. La liquidacion queda pendiente de comprobante externo.'::TEXT,
            0::DECIMAL;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        true,
        'Viaje completado. El saldo marketplace se libera desde el servidor operativo.'::TEXT,
        v_release_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_delivery_pin(UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin(UUID, VARCHAR, UUID) TO service_role;

COMMENT ON COLUMN public.transactions.money_rail IS
'Financial rail label. marketplace_freelancer is withdrawable; private_fleet rails are documentary/external by default.';

COMMENT ON FUNCTION public.verify_delivery_pin(UUID, VARCHAR, UUID) IS
'Verifies delivery PIN and closes the route. Marketplace wallet release is handled by server code after route completion, not by Mercado Pago webhook.';

COMMIT;
