-- =============================================================================
-- KARGAX - WALLET MARKETPLACE PAYOUTS + PRIVATE EXTERNAL PROOFS
--
-- High-risk financial migration:
-- - separates marketplace withdrawable money from private-fleet external ledger
-- - adds payout queue metadata and provider reconciliation RPCs
-- - keeps private fleet payroll/proofs documentary by default
-- - replaces route completion RPCs without editing historical migrations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ledger rails and payout queue metadata
-- -----------------------------------------------------------------------------

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS money_rail TEXT,
    ADD COLUMN IF NOT EXISTS source_system TEXT,
    ADD COLUMN IF NOT EXISTS payout_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payout_attempt_id UUID,
    ADD COLUMN IF NOT EXISTS locked_for_payout BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS external_proof_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_transactions_money_rail
    ON public.transactions (money_rail, type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_payout_attempt_id
    ON public.transactions (payout_attempt_id)
    WHERE payout_attempt_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_marketplace_release_idempotency
    ON public.transactions ((metadata->>'idempotency_key'))
    WHERE type = 'trip_deposit'
      AND metadata ? 'idempotency_key';

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
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

ALTER TABLE public.payout_methods
    DROP CONSTRAINT IF EXISTS payout_methods_provider_preference_check,
    ADD CONSTRAINT payout_methods_provider_preference_check
        CHECK (provider_preference IN ('nequi', 'wompi', 'manual', 'cobre'));

ALTER TABLE public.payout_attempts
    DROP CONSTRAINT IF EXISTS payout_attempts_provider_check,
    ADD CONSTRAINT payout_attempts_provider_check
        CHECK (provider IN ('nequi', 'wompi', 'manual', 'cobre', 'bank_partner'));

ALTER TABLE public.payout_attempts
    DROP CONSTRAINT IF EXISTS payout_attempts_status_check,
    ADD CONSTRAINT payout_attempts_status_check
        CHECK (status IN ('requested', 'queued', 'processing', 'paid', 'failed', 'reversed', 'manual_review', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_payout_attempts_queue
    ON public.payout_attempts (status, next_retry_at, created_at)
    WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_payout_attempts_provider_transfer
    ON public.payout_attempts (provider, provider_transfer_id)
    WHERE provider_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_attempts_trucker
    ON public.payout_attempts (trucker_id, created_at DESC)
    WHERE trucker_id IS NOT NULL;

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
    ON public.private_fleet_payroll_runs (business_id, external_payment_status, created_at DESC);

ALTER TABLE public.trip_financial_allocations
    DROP CONSTRAINT IF EXISTS trip_financial_allocations_status_check,
    ADD CONSTRAINT trip_financial_allocations_status_check
        CHECK (status IN ('held_in_custody', 'released_to_wallet', 'refunded', 'external_proof_pending', 'paid_external'));

CREATE TABLE IF NOT EXISTS public.private_fleet_payment_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES public.private_fleet_payroll_runs(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    payment_method TEXT NOT NULL
        CHECK (payment_method IN ('nequi', 'bank_transfer', 'cash', 'other')),
    external_reference TEXT,
    amount_cop NUMERIC(15,2) NOT NULL CHECK (amount_cop > 0),
    proof_url TEXT,
    storage_path TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (status IN ('uploaded', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_private_fleet_payment_proofs_run
    ON public.private_fleet_payment_proofs(run_id, created_at DESC);

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
            FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

GRANT SELECT ON public.private_fleet_payment_proofs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.private_fleet_payment_proofs TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'private-fleet-payment-proofs',
    'private-fleet-payment-proofs',
    false,
    10485760,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Payout processor RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_payout_attempts(p_limit INTEGER DEFAULT 10)
RETURNS SETOF public.payout_attempts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH picked AS (
        SELECT id
        FROM public.payout_attempts
        WHERE status IN ('queued', 'failed')
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
          AND attempts_count < 5
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
AS $$
DECLARE
    v_attempt public.payout_attempts%ROWTYPE;
    v_transaction public.transactions%ROWTYPE;
    v_amount NUMERIC(15,2);
BEGIN
    SELECT *
    INTO v_attempt
    FROM public.payout_attempts
    WHERE id = p_payout_attempt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'payout_attempt_not_found';
    END IF;

    IF v_attempt.status = 'paid' THEN
        RETURN TRUE;
    END IF;

    SELECT *
    INTO v_transaction
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
AS $$
DECLARE
    v_attempt public.payout_attempts%ROWTYPE;
    v_next_status TEXT;
BEGIN
    SELECT *
    INTO v_attempt
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

GRANT EXECUTE ON FUNCTION public.claim_payout_attempts(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payout_paid(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payout_failed(UUID, TEXT, JSONB) TO service_role;

-- -----------------------------------------------------------------------------
-- Private fleet confirmation: no freight pending wallet balance
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_private_fleet_offer(
    p_offer_id UUID,
    p_trucker_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    payment_id UUID,
    expense_amount DECIMAL,
    freight_amount DECIMAL,
    pickup_pin VARCHAR,
    delivery_pin VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_payment_id UUID;
    v_wallet RECORD;
    v_balance_before DECIMAL(15,2);
    v_balance_after DECIMAL(15,2);
    v_transaction_id UUID;
    v_existing_expense_allocation RECORD;
    v_pickup_pin VARCHAR(4);
    v_delivery_pin VARCHAR(4);
BEGIN
    SELECT *
    INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    IF COALESCE(v_offer.is_private_fleet, FALSE) = FALSE THEN
        RETURN QUERY SELECT false, 'La oferta no pertenece a flota privada'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    IF COALESCE(v_offer.private_fleet_trucker_id, v_offer.assigned_trucker_id) <> p_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para confirmar este viaje'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    IF v_offer.status = 'completed' THEN
        RETURN QUERY SELECT false, 'El viaje ya fue completado'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, v_offer.pickup_pin, v_offer.delivery_pin;
        RETURN;
    END IF;

    IF v_offer.private_fleet_confirmed_at IS NOT NULL AND v_offer.pickup_pin IS NOT NULL AND v_offer.delivery_pin IS NOT NULL THEN
        SELECT p.id
        INTO v_payment_id
        FROM public.payments p
        WHERE p.offer_id = p_offer_id
        ORDER BY p.created_at DESC
        LIMIT 1;

        RETURN QUERY SELECT
            true,
            'El viaje privado ya estaba confirmado'::TEXT,
            v_payment_id,
            COALESCE(v_offer.expense_allowance_amount, 0),
            COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount)),
            v_offer.pickup_pin,
            v_offer.delivery_pin;
        RETURN;
    END IF;

    IF v_offer.status NOT IN ('assigned', 'reserved') THEN
        RETURN QUERY SELECT false, 'La oferta no esta lista para confirmacion'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    SELECT *
    INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_trucker_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.wallets (
            user_id,
            pending_balance,
            available_balance,
            total_earned,
            total_withdrawn,
            total_trips_completed
        ) VALUES (
            p_trucker_id,
            0,
            0,
            0,
            0,
            0
        )
        RETURNING * INTO v_wallet;
    END IF;

    v_pickup_pin := public.generate_secure_pin();
    v_delivery_pin := public.generate_secure_pin();

    WHILE v_delivery_pin = v_pickup_pin LOOP
        v_delivery_pin := public.generate_secure_pin();
    END LOOP;

    INSERT INTO public.payments (
        offer_id,
        payer_id,
        gateway,
        external_reference,
        subtotal,
        platform_fee,
        gateway_fee,
        total_amount,
        status,
        completed_at,
        gateway_response
    ) VALUES (
        p_offer_id,
        v_offer.business_id,
        'manual',
        'private-fleet-' || p_offer_id::TEXT,
        COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        0,
        0,
        COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        'completed',
        NOW(),
        jsonb_build_object(
            'source_kind', 'private_fleet_external_proof_required',
            'offer_id', p_offer_id::TEXT,
            'business_id', v_offer.business_id::TEXT,
            'trucker_id', p_trucker_id::TEXT
        )
    )
    RETURNING id INTO v_payment_id;

    UPDATE public.cargo_offers
    SET
        assigned_trucker_id = p_trucker_id,
        private_fleet_trucker_id = p_trucker_id,
        net_amount = COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        total_amount = COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.total_amount, 0)),
        platform_fee = 0,
        pickup_pin = v_pickup_pin,
        delivery_pin = v_delivery_pin,
        status = 'reserved',
        private_fleet_confirmed_at = NOW(),
        private_fleet_confirmed_by = p_trucker_id,
        updated_at = NOW()
    WHERE id = p_offer_id;

    INSERT INTO public.trip_financial_allocations (
        offer_id,
        business_id,
        trucker_id,
        payment_id,
        allocation_type,
        amount,
        status,
        metadata
    ) VALUES
    (
        p_offer_id,
        v_offer.business_id,
        p_trucker_id,
        v_payment_id,
        'freight_payment',
        COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        'external_proof_pending',
        jsonb_build_object('source_kind', 'private_fleet_external_freight')
    )
    ON CONFLICT (offer_id, allocation_type)
    DO UPDATE SET
        payment_id = COALESCE(EXCLUDED.payment_id, public.trip_financial_allocations.payment_id),
        amount = EXCLUDED.amount,
        status = CASE
            WHEN public.trip_financial_allocations.status IN ('released_to_wallet', 'paid_external') THEN public.trip_financial_allocations.status
            ELSE 'external_proof_pending'
        END,
        metadata = jsonb_strip_nulls(COALESCE(public.trip_financial_allocations.metadata, '{}'::jsonb) || EXCLUDED.metadata);

    INSERT INTO public.trip_financial_allocations (
        offer_id,
        business_id,
        trucker_id,
        allocation_type,
        amount,
        status,
        metadata
    ) VALUES (
        p_offer_id,
        v_offer.business_id,
        p_trucker_id,
        'expense_advance',
        COALESCE(v_offer.expense_allowance_amount, 0),
        CASE WHEN COALESCE(v_offer.expense_allowance_amount, 0) > 0 THEN 'held_in_custody' ELSE 'released_to_wallet' END,
        jsonb_build_object('source_kind', 'private_fleet_expense_hold')
    )
    ON CONFLICT (offer_id, allocation_type)
    DO UPDATE SET
        amount = EXCLUDED.amount,
        metadata = jsonb_strip_nulls(COALESCE(public.trip_financial_allocations.metadata, '{}'::jsonb) || EXCLUDED.metadata);

    IF v_offer.origin_appointment_id IS NOT NULL OR v_offer.destination_appointment_id IS NOT NULL THEN
        UPDATE public.warehouse_appointments
        SET payment_status = CASE
                WHEN payment_status = 'n_a' THEN payment_status
                ELSE 'reserved'
            END,
            updated_at = NOW()
        WHERE id IN (v_offer.origin_appointment_id, v_offer.destination_appointment_id);
    END IF;

    SELECT *
    INTO v_existing_expense_allocation
    FROM public.trip_financial_allocations
    WHERE offer_id = p_offer_id
      AND allocation_type = 'expense_advance'
    FOR UPDATE;

    IF COALESCE(v_offer.expense_allowance_amount, 0) > 0
       AND COALESCE(v_existing_expense_allocation.status, 'held_in_custody') <> 'released_to_wallet' THEN
        v_balance_before := COALESCE(v_wallet.available_balance, 0);
        v_balance_after := v_balance_before + COALESCE(v_offer.expense_allowance_amount, 0);

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
            external_proof_only
        ) VALUES (
            v_wallet.id,
            p_offer_id,
            'expense_advance',
            'completed',
            COALESCE(v_offer.expense_allowance_amount, 0),
            v_balance_before,
            v_balance_after,
            COALESCE(v_wallet.pending_balance, 0),
            COALESCE(v_wallet.pending_balance, 0),
            format('Viaticos liberados para viaje privado #%s', LEFT(p_offer_id::TEXT, 8)),
            p_offer_id::TEXT,
            jsonb_build_object(
                'source_kind', 'private_fleet_expense_release',
                'offer_id', p_offer_id::TEXT,
                'payment_id', v_payment_id::TEXT,
                'business_id', v_offer.business_id::TEXT
            ),
            'private_fleet_operational_expense',
            'private_fleet',
            FALSE,
            TRUE
        )
        RETURNING id INTO v_transaction_id;

        UPDATE public.trip_financial_allocations
        SET
            status = 'released_to_wallet',
            wallet_transaction_id = v_transaction_id,
            released_at = NOW(),
            metadata = jsonb_strip_nulls(
                COALESCE(metadata, '{}'::jsonb) ||
                jsonb_build_object(
                    'wallet_transaction_id', v_transaction_id::TEXT,
                    'released_reason', 'private_fleet_confirmation'
                )
            )
        WHERE id = v_existing_expense_allocation.id;

        PERFORM public.create_notification(
            p_trucker_id,
            'private_fleet_expense_released',
            'Viaticos disponibles',
            format('Has recibido %s en viaticos operativos para tu viaje privado.', COALESCE(v_offer.expense_allowance_amount, 0)),
            jsonb_build_object(
                'offer_id', p_offer_id,
                'payment_id', v_payment_id,
                'amount', COALESCE(v_offer.expense_allowance_amount, 0),
                'wallet_transaction_id', v_transaction_id
            )
        );
    END IF;

    RETURN QUERY SELECT
        true,
        'Viaje confirmado. El flete privado queda como liquidacion externa; los viaticos operativos se registran aparte.'::TEXT,
        v_payment_id,
        COALESCE(v_offer.expense_allowance_amount, 0),
        COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        v_pickup_pin,
        v_delivery_pin;
END;
$$;

COMMENT ON FUNCTION public.confirm_private_fleet_offer IS
'Confirma un viaje de flota privada sin crear saldo retirable por flete privado; solo registra liquidacion externa y viaticos operativos.';

-- -----------------------------------------------------------------------------
-- Delivery completion: marketplace release vs private external ledger
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
AS $$
DECLARE
    v_offer RECORD;
    v_wallet RECORD;
    v_payment_id UUID;
    v_max_attempts INTEGER := 5;
    v_release_amount DECIMAL(15,2);
    v_pending_before DECIMAL(15,2);
    v_available_before DECIMAL(15,2);
    v_available_after_deposit DECIMAL(15,2);
    v_available_after_repayment DECIMAL(15,2);
    v_repayment RECORD;
    v_effective_trucker_id UUID := COALESCE(p_trucker_id, auth.uid());
    v_freight_allocation_id UUID;
    v_transaction_id UUID;
    v_existing_release_id UUID;
    v_auto_enabled BOOLEAN := FALSE;
    v_default_method RECORD;
    v_default_method_found BOOLEAN := FALSE;
    v_withdrawal_id UUID;
    v_payout_attempt_id UUID;
    v_auto_payout_amount DECIMAL(15,2);
    v_canonical_method TEXT;
    v_auto_payout_key TEXT;
BEGIN
    SELECT *
    INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_effective_trucker_id IS NULL OR v_offer.assigned_trucker_id <> v_effective_trucker_id THEN
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

    IF v_offer.pin_attempts >= v_max_attempts THEN
        RETURN QUERY SELECT false, 'Demasiados intentos fallidos. Contacta soporte.'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.delivery_pin IS NULL THEN
        RETURN QUERY SELECT false, 'PIN de entrega no ha sido generado'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF UPPER(TRIM(v_offer.delivery_pin)) <> UPPER(TRIM(p_input_pin)) THEN
        UPDATE public.cargo_offers
        SET pin_attempts = pin_attempts + 1,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY
        SELECT
            false,
            format('PIN incorrecto. Intentos restantes: %s', v_max_attempts - v_offer.pin_attempts - 1)::TEXT,
            0::DECIMAL;
        RETURN;
    END IF;

    SELECT p.id
    INTO v_payment_id
    FROM public.payments p
    WHERE p.offer_id = p_offer_id
      AND p.status = 'completed'
    ORDER BY p.completed_at DESC NULLS LAST, p.created_at DESC
    LIMIT 1;

    IF COALESCE(v_offer.is_private_fleet, FALSE) = FALSE AND v_payment_id IS NULL THEN
        RETURN QUERY SELECT false, 'No existe pago confirmado para liberar este viaje'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    v_release_amount := COALESCE(v_offer.net_amount, v_offer.total_amount, 0);

    IF COALESCE(v_offer.is_private_fleet, FALSE) = TRUE THEN
        UPDATE public.trip_financial_allocations
        SET
            status = CASE
                WHEN status IN ('paid_external', 'released_to_wallet', 'refunded') THEN status
                ELSE 'external_proof_pending'
            END,
            released_at = CASE WHEN status = 'released_to_wallet' THEN released_at ELSE NULL END,
            payment_id = COALESCE(payment_id, v_payment_id),
            metadata = jsonb_strip_nulls(
                COALESCE(metadata, '{}'::jsonb) ||
                jsonb_build_object(
                    'delivery_closed_at', NOW(),
                    'proof_required', TRUE,
                    'released_reason', 'external_private_fleet_delivery_closed',
                    'released_amount', v_release_amount
                )
            )
        WHERE offer_id = p_offer_id
          AND allocation_type = 'freight_payment'
        RETURNING id INTO v_freight_allocation_id;
    ELSE
        SELECT id
        INTO v_existing_release_id
        FROM public.transactions
        WHERE offer_id = p_offer_id
          AND type = 'trip_deposit'
          AND (
              metadata->>'source_kind' IN ('marketplace_freight_release', 'trip_settlement')
              OR metadata->>'idempotency_key' = format('marketplace_release:%s:%s:%s', p_offer_id, COALESCE(v_payment_id::TEXT, 'no_payment'), v_offer.assigned_trucker_id)
          )
        LIMIT 1;

        IF v_existing_release_id IS NOT NULL THEN
            RETURN QUERY SELECT false, 'El pago de este viaje ya fue liberado'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;

        SELECT *
        INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_offer.assigned_trucker_id
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.wallets (
                user_id,
                pending_balance,
                available_balance,
                total_earned,
                total_withdrawn,
                total_trips_completed
            ) VALUES (
                v_offer.assigned_trucker_id,
                0,
                0,
                0,
                0,
                0
            )
            RETURNING * INTO v_wallet;
        END IF;

        v_pending_before := COALESCE(v_wallet.pending_balance, 0);
        v_available_before := COALESCE(v_wallet.available_balance, 0);
        v_available_after_deposit := v_available_before + v_release_amount;

        UPDATE public.wallets
        SET pending_balance = GREATEST(COALESCE(pending_balance, 0) - v_release_amount, 0),
            available_balance = v_available_after_deposit,
            total_earned = COALESCE(total_earned, 0) + v_release_amount,
            total_trips_completed = COALESCE(total_trips_completed, 0) + 1,
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
            external_proof_only
        ) VALUES (
            v_wallet.id,
            p_offer_id,
            'trip_deposit',
            'completed',
            v_release_amount,
            v_available_before,
            v_available_after_deposit,
            v_pending_before,
            GREATEST(v_pending_before - v_release_amount, 0),
            format('Pago operativo liberado por viaje #%s', LEFT(p_offer_id::TEXT, 8)),
            COALESCE(v_payment_id::TEXT, p_offer_id::TEXT),
            jsonb_strip_nulls(
                jsonb_build_object(
                    'source_kind', 'marketplace_freight_release',
                    'idempotency_key', format('marketplace_release:%s:%s:%s', p_offer_id, COALESCE(v_payment_id::TEXT, 'no_payment'), v_offer.assigned_trucker_id),
                    'payment_id', v_payment_id::TEXT,
                    'gross_release_amount', v_release_amount,
                    'offer_id', p_offer_id::TEXT
                )
            ),
            'marketplace_freelancer',
            'mercadopago',
            TRUE,
            FALSE
        )
        RETURNING id INTO v_transaction_id;

        SELECT *
        INTO v_repayment
        FROM public.apply_advance_repayments(v_wallet.id, p_offer_id, v_release_amount, 'marketplace_freight_release');

        SELECT COALESCE(available_balance, 0)
        INTO v_available_after_repayment
        FROM public.wallets
        WHERE id = v_wallet.id
        FOR UPDATE;

        SELECT COALESCE(enabled, FALSE)
        INTO v_auto_enabled
        FROM public.feature_flags
        WHERE key = 'automatic_payouts_enabled'
          AND (country_code = COALESCE(v_offer.country_code, 'CO') OR country_code IS NULL)
        ORDER BY CASE WHEN country_code = COALESCE(v_offer.country_code, 'CO') THEN 0 ELSE 1 END
        LIMIT 1;

        SELECT *
        INTO v_default_method
        FROM public.payment_methods
        WHERE user_id = v_offer.assigned_trucker_id
        ORDER BY is_default DESC, updated_at DESC
        LIMIT 1;
        v_default_method_found := FOUND;

        v_auto_payout_amount := LEAST(
            GREATEST(v_release_amount - COALESCE(v_repayment.total_applied, 0), 0),
            COALESCE(v_available_after_repayment, 0)
        );

        IF COALESCE(v_auto_enabled, FALSE) = TRUE
           AND v_default_method_found = TRUE
           AND v_auto_payout_amount >= 50000 THEN
            v_canonical_method := CASE
                WHEN v_default_method.method_type = 'nequi' THEN 'nequi'
                WHEN v_default_method.method_type = 'savings' AND LOWER(COALESCE(v_default_method.bank_name, '')) LIKE '%bancolombia%' THEN 'bancolombia_savings'
                WHEN v_default_method.method_type = 'checking' AND LOWER(COALESCE(v_default_method.bank_name, '')) LIKE '%bancolombia%' THEN 'bancolombia_checking'
                ELSE 'other_bank'
            END;
            v_auto_payout_key := format('marketplace_payout:%s:%s:%s:%s', p_offer_id, COALESCE(v_payment_id::TEXT, 'no_payment'), v_offer.assigned_trucker_id, v_auto_payout_amount::TEXT);

            UPDATE public.wallets
            SET available_balance = GREATEST(COALESCE(available_balance, 0) - v_auto_payout_amount, 0),
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
                p_offer_id,
                'withdrawal',
                'pending',
                v_auto_payout_amount * -1,
                v_available_after_repayment,
                GREATEST(v_available_after_repayment - v_auto_payout_amount, 0),
                GREATEST(v_pending_before - v_release_amount, 0),
                GREATEST(v_pending_before - v_release_amount, 0),
                format('Payout automatico por viaje #%s', LEFT(p_offer_id::TEXT, 8)),
                p_offer_id::TEXT,
                jsonb_strip_nulls(jsonb_build_object(
                    'source_kind', 'automatic_marketplace_payout',
                    'withdrawal_request_id', NULL,
                    'offer_id', p_offer_id::TEXT,
                    'payment_id', v_payment_id::TEXT,
                    'payment_method_id', v_default_method.id::TEXT,
                    'payout_method', v_canonical_method,
                    'payout_provider', 'cobre',
                    'automatic_payouts_enabled', TRUE
                )),
                'marketplace_freelancer',
                'cobre',
                FALSE,
                TRUE,
                FALSE
            )
            RETURNING id INTO v_withdrawal_id;

            INSERT INTO public.payout_attempts (
                wallet_transaction_id,
                user_id,
                provider,
                method,
                amount_cop,
                status,
                idempotency_key,
                source_kind,
                source_id,
                offer_id,
                payment_id,
                trucker_id,
                destination_snapshot,
                provider_payload
            ) VALUES (
                v_withdrawal_id,
                v_offer.assigned_trucker_id,
                'cobre',
                v_canonical_method,
                v_auto_payout_amount,
                'queued',
                v_auto_payout_key,
                'automatic_marketplace_payout',
                p_offer_id,
                p_offer_id,
                v_payment_id,
                v_offer.assigned_trucker_id,
                jsonb_strip_nulls(jsonb_build_object(
                    'payment_method_id', v_default_method.id::TEXT,
                    'method', v_canonical_method,
                    'bank_name', v_default_method.bank_name,
                    'account_number', v_default_method.account_number,
                    'account_holder_name', v_default_method.account_holder_name,
                    'document_type', COALESCE(v_default_method.document_type, 'CC'),
                    'document_number', v_default_method.document_number
                )),
                jsonb_strip_nulls(jsonb_build_object(
                    'payment_method_id', v_default_method.id::TEXT,
                    'account_number_last4', RIGHT(REGEXP_REPLACE(COALESCE(v_default_method.account_number, ''), '\D', '', 'g'), 4),
                    'document_number_last4', RIGHT(REGEXP_REPLACE(COALESCE(v_default_method.document_number, ''), '\D', '', 'g'), 4),
                    'automatic_payouts_enabled', TRUE
                ))
            )
            ON CONFLICT (idempotency_key)
            DO UPDATE SET updated_at = NOW()
            RETURNING id INTO v_payout_attempt_id;

            UPDATE public.transactions
            SET reference_id = v_withdrawal_id::TEXT,
                payout_attempt_id = v_payout_attempt_id,
                metadata = jsonb_strip_nulls(
                    COALESCE(metadata, '{}'::jsonb) ||
                    jsonb_build_object(
                        'withdrawal_request_id', v_withdrawal_id::TEXT,
                        'reference_id', v_withdrawal_id::TEXT,
                        'payout_attempt_id', v_payout_attempt_id::TEXT,
                        'payout_status', 'queued'
                    )
                )
            WHERE id = v_withdrawal_id;
        END IF;

        UPDATE public.trip_financial_allocations
        SET
            status = 'released_to_wallet',
            wallet_transaction_id = COALESCE(wallet_transaction_id, v_transaction_id),
            released_at = NOW(),
            payment_id = COALESCE(payment_id, v_payment_id),
            metadata = jsonb_strip_nulls(
                COALESCE(metadata, '{}'::jsonb) ||
                jsonb_build_object(
                    'released_reason', 'delivery_pin_verified',
                    'released_amount', v_release_amount
                )
            )
        WHERE offer_id = p_offer_id
          AND allocation_type = 'freight_payment'
        RETURNING id INTO v_freight_allocation_id;
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
            v_offer.assigned_trucker_id,
            'private_fleet_freight_released',
            'Viaje privado cerrado',
            'Tu viaje privado fue cerrado. La liquidacion del flete queda registrada para comprobante externo de tu empresa.',
            jsonb_build_object(
                'offer_id', p_offer_id,
                'payment_id', v_payment_id,
                'allocation_id', v_freight_allocation_id,
                'amount', v_release_amount,
                'external_proof_only', TRUE
            )
        );

        RETURN QUERY SELECT
            true,
            'Viaje privado completado. La liquidacion queda pendiente de comprobante externo.'::TEXT,
            0::DECIMAL;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        true,
        CASE
            WHEN COALESCE(v_repayment.total_applied, 0) > 0
                THEN format('Viaje completado. Se libero saldo operativo y se descontaron %s por adelantos.', v_repayment.total_applied)
            WHEN v_payout_attempt_id IS NOT NULL
                THEN 'Viaje completado. El payout automatico quedo en proceso.'
            ELSE 'Viaje completado. El saldo operativo quedo disponible para retiro.'
        END::TEXT,
        GREATEST(v_release_amount - COALESCE(v_repayment.total_applied, 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_private_fleet_offer(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin(UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin(UUID, VARCHAR, UUID) TO service_role;

-- -----------------------------------------------------------------------------
-- Conservative backfill labels only. No balance changes.
-- -----------------------------------------------------------------------------

UPDATE public.transactions
SET money_rail = CASE
        WHEN type IN ('trip_deposit', 'trip_pending') THEN 'marketplace_freelancer'
        WHEN type = 'private_fleet_salary' THEN 'private_fleet_external_or_legacy'
        WHEN type = 'expense_advance' THEN 'private_fleet_operational_expense'
        WHEN type = 'withdrawal' THEN 'wallet_withdrawal'
        ELSE COALESCE(money_rail, 'legacy')
    END,
    payout_eligible = CASE
        WHEN type = 'trip_deposit'
          AND COALESCE(metadata->>'source_kind', '') IN ('trip_settlement', 'marketplace_freight_release')
          AND COALESCE(external_proof_only, FALSE) = FALSE THEN TRUE
        ELSE COALESCE(payout_eligible, FALSE)
    END,
    external_proof_only = CASE
        WHEN type = 'private_fleet_salary' THEN TRUE
        ELSE COALESCE(external_proof_only, FALSE)
    END
WHERE money_rail IS NULL
   OR (type = 'trip_deposit' AND payout_eligible = FALSE)
   OR (type = 'private_fleet_salary' AND external_proof_only = FALSE);

COMMENT ON COLUMN public.transactions.money_rail IS
'Financial rail label. marketplace_freelancer is withdrawable; private_fleet_external/proof rails are documentary or operational only.';

COMMENT ON COLUMN public.private_fleet_payroll_runs.payment_mode IS
'external_proof means the company pays outside KargaX and uploads proof. mercadopago_funded is legacy/explicit wallet-funded mode.';
