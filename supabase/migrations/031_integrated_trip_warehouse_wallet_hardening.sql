-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 031: INTEGRATED TRIP / WAREHOUSE / WALLET HARDENING
--
-- Goals:
-- 1. Harden transactions as the canonical ledger with dual snapshots
--    (available + pending).
-- 2. Make withdrawal processing auditable and reversible via ledger entries.
-- 3. Keep trip state machine aligned with payment/PIN truth and sync linked
--    warehouse appointments/tasks.
-- 4. Normalize historical offer states after the 030 flow guards.
-- =============================================================================

DO $$ BEGIN
    ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'withdrawal_reversal';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS pending_balance_before DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS pending_balance_after DECIMAL(15,2);

COMMENT ON COLUMN public.transactions.balance_before IS 'Saldo disponible antes de la transaccion';
COMMENT ON COLUMN public.transactions.balance_after IS 'Saldo disponible despues de la transaccion';
COMMENT ON COLUMN public.transactions.pending_balance_before IS 'Saldo pendiente antes de la transaccion';
COMMENT ON COLUMN public.transactions.pending_balance_after IS 'Saldo pendiente despues de la transaccion';

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(reference_id);

CREATE OR REPLACE FUNCTION public.hydrate_transaction_ledger_snapshots()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_wallet RECORD;
    v_metadata JSONB := COALESCE(NEW.metadata, '{}'::jsonb);
    v_gross_release NUMERIC(15,2);
BEGIN
    SELECT available_balance, pending_balance
    INTO v_wallet
    FROM public.wallets
    WHERE id = NEW.wallet_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet % not found for transaction insert', NEW.wallet_id;
    END IF;

    IF NEW.type = 'trip_pending' THEN
        NEW.pending_balance_after := COALESCE(NEW.pending_balance_after, COALESCE(v_wallet.pending_balance, 0));
        NEW.pending_balance_before := COALESCE(NEW.pending_balance_before, NEW.pending_balance_after - COALESCE(NEW.amount, 0));
    ELSIF NEW.type = 'trip_deposit' THEN
        v_gross_release := COALESCE(
            NULLIF(v_metadata->>'gross_release_amount', '')::NUMERIC,
            ABS(COALESCE(NEW.amount, 0))
        );
        NEW.pending_balance_after := COALESCE(NEW.pending_balance_after, COALESCE(v_wallet.pending_balance, 0));
        NEW.pending_balance_before := COALESCE(NEW.pending_balance_before, NEW.pending_balance_after + COALESCE(v_gross_release, 0));
    ELSE
        NEW.pending_balance_before := COALESCE(NEW.pending_balance_before, COALESCE(v_wallet.pending_balance, 0));
        NEW.pending_balance_after := COALESCE(NEW.pending_balance_after, COALESCE(v_wallet.pending_balance, 0));
    END IF;

    IF NEW.reference_id IS NULL AND NEW.offer_id IS NOT NULL AND NEW.type IN ('trip_pending', 'trip_deposit') THEN
        NEW.reference_id := NEW.offer_id::TEXT;
    END IF;

    IF NOT (v_metadata ? 'source_kind') THEN
        v_metadata := v_metadata || jsonb_build_object('source_kind', NEW.type::TEXT);
    END IF;

    IF NEW.offer_id IS NOT NULL AND NOT (v_metadata ? 'offer_id') THEN
        v_metadata := v_metadata || jsonb_build_object('offer_id', NEW.offer_id::TEXT);
    END IF;

    IF NEW.reference_id IS NOT NULL AND NOT (v_metadata ? 'reference_id') THEN
        v_metadata := v_metadata || jsonb_build_object('reference_id', NEW.reference_id);
    END IF;

    NEW.metadata := v_metadata;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_hydrate_ledger ON public.transactions;
CREATE TRIGGER trg_transactions_hydrate_ledger
    BEFORE INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.hydrate_transaction_ledger_snapshots();

UPDATE public.transactions t
SET
    pending_balance_before = CASE
        WHEN t.type = 'trip_pending' THEN t.balance_before
        WHEN t.type = 'trip_deposit' THEN GREATEST(
            COALESCE(NULLIF(COALESCE(t.metadata, '{}'::jsonb)->>'gross_release_amount', '')::NUMERIC, ABS(t.amount)),
            0
        )
        ELSE 0
    END,
    pending_balance_after = CASE
        WHEN t.type = 'trip_pending' THEN t.balance_after
        WHEN t.type = 'trip_deposit' THEN 0
        ELSE 0
    END,
    reference_id = CASE
        WHEN t.reference_id IS NULL AND t.offer_id IS NOT NULL AND t.type IN ('trip_pending', 'trip_deposit')
            THEN t.offer_id::TEXT
        ELSE t.reference_id
    END,
    metadata = jsonb_strip_nulls(
        COALESCE(t.metadata, '{}'::jsonb) ||
        jsonb_build_object(
            'ledger_backfill', true,
            'ledger_backfill_version', '031',
            'source_kind', COALESCE(t.metadata->>'source_kind', t.type::TEXT),
            'offer_id', COALESCE(t.metadata->>'offer_id', t.offer_id::TEXT),
            'reference_id', COALESCE(t.metadata->>'reference_id', t.reference_id, t.offer_id::TEXT),
            'legacy_snapshot_mode', CASE
                WHEN t.type = 'trip_pending' THEN 'legacy_pending_from_balance_columns'
                WHEN t.type = 'trip_deposit' THEN 'estimated_release_amount'
                ELSE 'not_reconstructable'
            END
        )
    )
WHERE t.pending_balance_before IS NULL
   OR t.pending_balance_after IS NULL;

UPDATE public.transactions
SET
    pending_balance_before = COALESCE(pending_balance_before, 0),
    pending_balance_after = COALESCE(pending_balance_after, 0)
WHERE pending_balance_before IS NULL
   OR pending_balance_after IS NULL;

ALTER TABLE public.transactions
    ALTER COLUMN pending_balance_before SET DEFAULT 0,
    ALTER COLUMN pending_balance_before SET NOT NULL,
    ALTER COLUMN pending_balance_after SET DEFAULT 0,
    ALTER COLUMN pending_balance_after SET NOT NULL;

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
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
AS $$
DECLARE
    v_wallet RECORD;
    v_request_id UUID;
    v_balance_before NUMERIC(15,2);
    v_balance_after NUMERIC(15,2);
    v_method_label TEXT;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN QUERY SELECT false, 'Monto invalido'::TEXT, NULL::UUID, 0::NUMERIC;
        RETURN;
    END IF;

    SELECT *
    INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Billetera no encontrada'::TEXT, NULL::UUID, 0::NUMERIC;
        RETURN;
    END IF;

    IF p_amount > COALESCE(v_wallet.available_balance, 0) THEN
        RETURN QUERY SELECT false, 'Saldo insuficiente'::TEXT, NULL::UUID, COALESCE(v_wallet.available_balance, 0);
        RETURN;
    END IF;

    v_balance_before := COALESCE(v_wallet.available_balance, 0);
    v_balance_after := v_balance_before - p_amount;
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
        description,
        metadata
    ) VALUES (
        v_wallet.id,
        NULL,
        'withdrawal',
        'pending',
        p_amount * -1,
        v_balance_before,
        v_balance_after,
        format('Solicitud de retiro a %s', v_method_label),
        jsonb_strip_nulls(
            COALESCE(p_payment_details, '{}'::jsonb) ||
            jsonb_build_object(
                'payment_method', p_payment_method,
                'requested_by', p_user_id,
                'requested_at', NOW(),
                'source_kind', 'withdrawal_request'
            )
        )
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

    RETURN QUERY SELECT true, 'Solicitud de retiro creada'::TEXT, v_request_id, v_balance_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_withdrawal_request(
    p_transaction_id UUID,
    p_admin_id UUID,
    p_action TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    request_id UUID,
    reversal_transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction RECORD;
    v_wallet RECORD;
    v_amount NUMERIC(15,2);
    v_note TEXT := NULLIF(BTRIM(p_note), '');
    v_reversal_id UUID := NULL;
    v_metadata JSONB;
    v_balance_before NUMERIC(15,2);
    v_balance_after NUMERIC(15,2);
BEGIN
    IF p_action NOT IN ('approve', 'reject', 'cancel') THEN
        RETURN QUERY SELECT false, 'Accion invalida'::TEXT, NULL::UUID, NULL::UUID;
        RETURN;
    END IF;

    SELECT *
    INTO v_transaction
    FROM public.transactions
    WHERE id = p_transaction_id
      AND type = 'withdrawal'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Solicitud de retiro no encontrada'::TEXT, NULL::UUID, NULL::UUID;
        RETURN;
    END IF;

    IF v_transaction.status <> 'pending' THEN
        RETURN QUERY SELECT false, 'La solicitud ya fue procesada'::TEXT, v_transaction.id, NULL::UUID;
        RETURN;
    END IF;

    SELECT *
    INTO v_wallet
    FROM public.wallets
    WHERE id = v_transaction.wallet_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Billetera no encontrada'::TEXT, v_transaction.id, NULL::UUID;
        RETURN;
    END IF;

    v_amount := ABS(COALESCE(v_transaction.amount, 0));
    v_metadata := jsonb_strip_nulls(
        COALESCE(v_transaction.metadata, '{}'::jsonb) ||
        jsonb_build_object(
            'admin_action', p_action,
            'admin_note', v_note,
            'processed_by', p_admin_id,
            'processed_at', NOW(),
            'withdrawal_request_id', v_transaction.id::TEXT,
            'reference_id', COALESCE(v_transaction.reference_id, v_transaction.id::TEXT)
        )
    );

    IF p_action = 'approve' THEN
        UPDATE public.transactions
        SET status = 'completed',
            metadata = v_metadata
        WHERE id = v_transaction.id;

        UPDATE public.wallets
        SET total_withdrawn = COALESCE(total_withdrawn, 0) + v_amount,
            updated_at = NOW()
        WHERE id = v_wallet.id;

        RETURN QUERY SELECT true, 'Retiro aprobado'::TEXT, v_transaction.id, NULL::UUID;
        RETURN;
    END IF;

    UPDATE public.transactions
    SET status = 'cancelled',
        metadata = v_metadata
    WHERE id = v_transaction.id;

    v_balance_before := COALESCE(v_wallet.available_balance, 0);
    v_balance_after := v_balance_before + v_amount;

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
        description,
        reference_id,
        metadata
    ) VALUES (
        v_wallet.id,
        v_transaction.offer_id,
        'withdrawal_reversal',
        'completed',
        v_amount,
        v_balance_before,
        v_balance_after,
        CASE
            WHEN p_action = 'cancel' THEN 'Reversion por cancelacion administrativa de retiro'
            ELSE 'Reversion por rechazo administrativo de retiro'
        END,
        v_transaction.id::TEXT,
        jsonb_strip_nulls(
            jsonb_build_object(
                'source_kind', 'withdrawal_reversal',
                'withdrawal_request_id', v_transaction.id::TEXT,
                'original_transaction_id', v_transaction.id::TEXT,
                'admin_action', p_action,
                'admin_note', v_note,
                'processed_by', p_admin_id,
                'processed_at', NOW()
            )
        )
    )
    RETURNING id INTO v_reversal_id;

    RETURN QUERY
    SELECT
        true,
        CASE
            WHEN p_action = 'cancel' THEN 'Retiro cancelado y saldo restituido.'::TEXT
            ELSE 'Retiro rechazado y saldo restituido.'::TEXT
        END,
        v_transaction.id,
        v_reversal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_wallet_adjustment(
    p_wallet_id UUID,
    p_amount NUMERIC,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_offer_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    transaction_id UUID,
    balance_after NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_balance_before NUMERIC(15,2);
    v_balance_after NUMERIC(15,2);
    v_transaction_id UUID;
BEGIN
    IF p_amount IS NULL OR p_amount = 0 THEN
        RETURN QUERY SELECT false, NULL::UUID, 0::NUMERIC;
        RETURN;
    END IF;

    SELECT *
    INTO v_wallet
    FROM public.wallets
    WHERE id = p_wallet_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, 0::NUMERIC;
        RETURN;
    END IF;

    v_balance_before := COALESCE(v_wallet.available_balance, 0);
    v_balance_after := v_balance_before + p_amount;

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
        description,
        reference_id,
        metadata
    ) VALUES (
        v_wallet.id,
        p_offer_id,
        'adjustment',
        'completed',
        p_amount,
        v_balance_before,
        v_balance_after,
        p_description,
        p_reference_id,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_transaction_id;

    RETURN QUERY SELECT true, v_transaction_id, v_balance_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_successful_payment(
    p_payment_id UUID,
    p_external_id VARCHAR DEFAULT NULL,
    p_gateway_response JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    pickup_pin VARCHAR,
    delivery_pin VARCHAR,
    offer_id UUID,
    trucker_id UUID,
    pickup_contact_phone VARCHAR,
    pickup_contact_name VARCHAR,
    delivery_contact_phone VARCHAR,
    delivery_contact_name VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_offer RECORD;
    v_pickup_pin VARCHAR(4);
    v_delivery_pin VARCHAR(4);
    v_wallet_id UUID;
    v_available_balance NUMERIC(15,2);
BEGIN
    SELECT *
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            false,
            'Pago no encontrado'::TEXT,
            NULL::VARCHAR, NULL::VARCHAR, NULL::UUID, NULL::UUID,
            NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    IF v_payment.status = 'completed' THEN
        SELECT *
        INTO v_offer
        FROM public.cargo_offers
        WHERE id = v_payment.offer_id;

        RETURN QUERY SELECT
            true,
            'Pago ya fue procesado'::TEXT,
            v_offer.pickup_pin,
            v_offer.delivery_pin,
            v_offer.id,
            v_offer.assigned_trucker_id,
            v_offer.pickup_contact_phone,
            v_offer.pickup_contact_name,
            v_offer.delivery_contact_phone,
            v_offer.delivery_contact_name;
        RETURN;
    END IF;

    IF v_payment.status <> 'pending' THEN
        RETURN QUERY SELECT
            false,
            'Estado de pago invalido'::TEXT,
            NULL::VARCHAR, NULL::VARCHAR, NULL::UUID, NULL::UUID,
            NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    SELECT *
    INTO v_offer
    FROM public.cargo_offers
    WHERE id = v_payment.offer_id
    FOR UPDATE;

    v_pickup_pin := public.generate_secure_pin();
    v_delivery_pin := public.generate_secure_pin();

    WHILE v_delivery_pin = v_pickup_pin LOOP
        v_delivery_pin := public.generate_secure_pin();
    END LOOP;

    UPDATE public.payments
    SET status = 'completed',
        external_id = p_external_id,
        gateway_response = p_gateway_response,
        completed_at = NOW()
    WHERE id = p_payment_id;

    UPDATE public.cargo_offers
    SET pickup_pin = v_pickup_pin,
        delivery_pin = v_delivery_pin,
        status = 'reserved',
        updated_at = NOW()
    WHERE id = v_offer.id;

    SELECT id, available_balance
    INTO v_wallet_id, v_available_balance
    FROM public.wallets
    WHERE user_id = v_offer.assigned_trucker_id
    FOR UPDATE;

    IF v_wallet_id IS NOT NULL THEN
        UPDATE public.wallets
        SET pending_balance = pending_balance + v_payment.subtotal,
            updated_at = NOW()
        WHERE id = v_wallet_id;

        INSERT INTO public.transactions (
            wallet_id,
            offer_id,
            type,
            amount,
            balance_before,
            balance_after,
            description,
            reference_id,
            metadata
        ) VALUES (
            v_wallet_id,
            v_offer.id,
            'trip_pending',
            v_payment.subtotal,
            COALESCE(v_available_balance, 0),
            COALESCE(v_available_balance, 0),
            format('Pago asegurado para viaje #%s', LEFT(v_offer.id::TEXT, 8)),
            p_payment_id::TEXT,
            jsonb_strip_nulls(
                jsonb_build_object(
                    'source_kind', 'payment_capture',
                    'payment_id', p_payment_id::TEXT,
                    'payment_external_id', p_external_id,
                    'offer_id', v_offer.id::TEXT
                )
            )
        );
    END IF;

    UPDATE public.warehouse_appointments
    SET payment_status = CASE
            WHEN payment_status = 'n_a' THEN payment_status
            ELSE 'reserved'
        END,
        updated_at = NOW()
    WHERE id IN (v_offer.origin_appointment_id, v_offer.destination_appointment_id);

    RETURN QUERY SELECT
        true,
        'Pago exitoso. PINs generados. Carga reservada.'::TEXT,
        v_pickup_pin,
        v_delivery_pin,
        v_offer.id,
        v_offer.assigned_trucker_id,
        v_offer.pickup_contact_phone,
        v_offer.pickup_contact_name,
        v_offer.delivery_contact_phone,
        v_offer.delivery_contact_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_pickup_pin(
    p_offer_id UUID,
    p_input_pin VARCHAR(6),
    p_trucker_id UUID DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    offer_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_max_attempts INTEGER := 5;
    v_effective_trucker_id UUID := COALESCE(p_trucker_id, auth.uid());
BEGIN
    SELECT *
    INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_effective_trucker_id IS NULL OR v_offer.assigned_trucker_id <> v_effective_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta operacion'::TEXT, v_offer.status::TEXT;
        RETURN;
    END IF;

    IF v_offer.status NOT IN ('reserved', 'in_progress', 'active') AND v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT false, 'La oferta no esta en estado valido para pickup'::TEXT, v_offer.status::TEXT;
        RETURN;
    END IF;

    IF v_offer.pickup_verified_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 'El pickup ya fue verificado'::TEXT, v_offer.status::TEXT;
        RETURN;
    END IF;

    IF v_offer.pin_attempts >= v_max_attempts THEN
        RETURN QUERY SELECT false, 'Demasiados intentos fallidos. Contacta soporte.'::TEXT, v_offer.status::TEXT;
        RETURN;
    END IF;

    IF v_offer.pickup_pin IS NULL THEN
        RETURN QUERY SELECT false, 'PIN de pickup no ha sido generado'::TEXT, v_offer.status::TEXT;
        RETURN;
    END IF;

    IF UPPER(TRIM(v_offer.pickup_pin)) <> UPPER(TRIM(p_input_pin)) THEN
        UPDATE public.cargo_offers
        SET pin_attempts = pin_attempts + 1,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY
        SELECT
            false,
            format('PIN incorrecto. Intentos restantes: %s', v_max_attempts - v_offer.pin_attempts - 1)::TEXT,
            v_offer.status::TEXT;
        RETURN;
    END IF;

    UPDATE public.cargo_offers
    SET status = 'in_progress',
        pickup_verified_at = NOW(),
        pin_attempts = 0,
        updated_at = NOW()
    WHERE id = p_offer_id;

    IF v_offer.origin_appointment_id IS NOT NULL THEN
        UPDATE public.warehouse_appointments
        SET status = 'completed',
            actual_start_at = COALESCE(actual_start_at, NOW()),
            actual_end_at = COALESCE(actual_end_at, NOW()),
            checked_in_at = COALESCE(checked_in_at, NOW()),
            checked_out_at = COALESCE(checked_out_at, NOW()),
            payment_status = CASE
                WHEN payment_status = 'n_a' THEN payment_status
                ELSE 'reserved'
            END,
            updated_at = NOW()
        WHERE id = v_offer.origin_appointment_id
          AND status <> 'cancelled';
    END IF;

    UPDATE public.warehouse_tasks
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
                'completed_from_offer_event', 'pickup_pin_verified',
                'offer_id', p_offer_id::TEXT,
                'appointment_id', v_offer.origin_appointment_id::TEXT
            )
        ),
        updated_at = NOW()
    WHERE offer_id = p_offer_id
      AND status IN ('open', 'in_progress', 'blocked')
      AND task_type IN ('check_in', 'loading', 'picking');

    RETURN QUERY
    SELECT
        true,
        'Pickup verificado. Viaje iniciado correctamente.'::TEXT,
        'in_progress'::TEXT;
END;
$$;

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
    v_wallet_id UUID;
    v_payment_id UUID;
    v_max_attempts INTEGER := 5;
    v_release_amount DECIMAL(15,2);
    v_available_before DECIMAL(15,2);
    v_available_after_deposit DECIMAL(15,2);
    v_repayment RECORD;
    v_effective_trucker_id UUID := COALESCE(p_trucker_id, auth.uid());
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

    SELECT id, available_balance
    INTO v_wallet_id, v_available_before
    FROM public.wallets
    WHERE user_id = v_offer.assigned_trucker_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN QUERY SELECT false, 'Billetera del camionero no encontrada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    SELECT p.id
    INTO v_payment_id
    FROM public.payments p
    WHERE p.offer_id = p_offer_id
      AND p.status = 'completed'
    ORDER BY p.completed_at DESC NULLS LAST, p.created_at DESC
    LIMIT 1;

    v_release_amount := COALESCE(v_offer.net_amount, v_offer.total_amount);
    v_available_after_deposit := v_available_before + v_release_amount;

    UPDATE public.wallets
    SET pending_balance = pending_balance - v_release_amount,
        available_balance = v_available_after_deposit,
        total_earned = total_earned + v_release_amount,
        total_trips_completed = total_trips_completed + 1,
        updated_at = NOW()
    WHERE id = v_wallet_id;

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
        v_wallet_id,
        p_offer_id,
        'trip_deposit',
        'completed',
        v_release_amount,
        v_available_before,
        v_available_after_deposit,
        format('Pago liberado por viaje #%s', LEFT(p_offer_id::TEXT, 8)),
        COALESCE(v_payment_id::TEXT, p_offer_id::TEXT),
        jsonb_strip_nulls(
            jsonb_build_object(
                'source_kind', 'trip_settlement',
                'payment_id', v_payment_id::TEXT,
                'gross_release_amount', v_release_amount,
                'offer_id', p_offer_id::TEXT
            )
        )
    );

    SELECT *
    INTO v_repayment
    FROM public.apply_advance_repayments(v_wallet_id, p_offer_id, v_release_amount, 'trip_settlement');

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

    RETURN QUERY
    SELECT
        true,
        CASE
            WHEN COALESCE(v_repayment.total_applied, 0) > 0
                THEN format('Viaje completado. Se liberaron %s y se descontaron %s por adelantos.', v_release_amount, v_repayment.total_applied)
            ELSE 'Viaje completado. El pago fue liberado a tu billetera.'
        END::TEXT,
        GREATEST(v_release_amount - COALESCE(v_repayment.total_applied, 0), 0);
END;
$$;

WITH payment_state AS (
    SELECT
        p.offer_id,
        BOOL_OR(p.status = 'completed') AS has_completed_payment
    FROM public.payments p
    GROUP BY p.offer_id
)
UPDATE public.cargo_offers co
SET
    status = (
        CASE
            WHEN COALESCE(ps.has_completed_payment, false) = false THEN 'active'
            WHEN co.delivery_verified_at IS NOT NULL THEN 'completed'
            WHEN co.pickup_verified_at IS NOT NULL THEN 'in_progress'
            ELSE 'reserved'
        END
    )::public.offer_status,
    pickup_pin = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.pickup_pin
        ELSE NULL
    END,
    delivery_pin = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.delivery_pin
        ELSE NULL
    END,
    pickup_verified_at = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.pickup_verified_at
        ELSE NULL
    END,
    delivery_verified_at = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.delivery_verified_at
        ELSE NULL
    END,
    arrived_at_origin_at = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.arrived_at_origin_at
        ELSE NULL
    END,
    arrived_at_destination_at = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.arrived_at_destination_at
        ELSE NULL
    END,
    loading_started_at = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.loading_started_at
        ELSE NULL
    END,
    loading_completed_at = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.loading_completed_at
        ELSE NULL
    END,
    unloading_started_at = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.unloading_started_at
        ELSE NULL
    END,
    unloading_completed_at = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN co.unloading_completed_at
        ELSE NULL
    END,
    manifest_loaded_count = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN COALESCE(co.manifest_loaded_count, 0)
        ELSE 0
    END,
    manifest_delivered_count = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN COALESCE(co.manifest_delivered_count, 0)
        ELSE 0
    END,
    manifest_rejected_count = CASE
        WHEN COALESCE(ps.has_completed_payment, false) THEN COALESCE(co.manifest_rejected_count, 0)
        ELSE 0
    END,
    updated_at = NOW()
FROM payment_state ps
WHERE ps.offer_id = co.id
  AND (
      co.status::TEXT <> CASE
          WHEN COALESCE(ps.has_completed_payment, false) = false THEN 'active'
          WHEN co.delivery_verified_at IS NOT NULL THEN 'completed'
          WHEN co.pickup_verified_at IS NOT NULL THEN 'in_progress'
          ELSE 'reserved'
      END
      OR (COALESCE(ps.has_completed_payment, false) = false AND (
          co.pickup_pin IS NOT NULL
          OR co.delivery_pin IS NOT NULL
          OR co.pickup_verified_at IS NOT NULL
          OR co.delivery_verified_at IS NOT NULL
          OR co.arrived_at_origin_at IS NOT NULL
          OR co.arrived_at_destination_at IS NOT NULL
      ))
  );

UPDATE public.cargo_offers co
SET
    status = 'active',
    pickup_pin = NULL,
    delivery_pin = NULL,
    pickup_verified_at = NULL,
    delivery_verified_at = NULL,
    arrived_at_origin_at = NULL,
    arrived_at_destination_at = NULL,
    loading_started_at = NULL,
    loading_completed_at = NULL,
    unloading_started_at = NULL,
    unloading_completed_at = NULL,
    manifest_loaded_count = 0,
    manifest_delivered_count = 0,
    manifest_rejected_count = 0,
    updated_at = NOW()
WHERE NOT EXISTS (
        SELECT 1
        FROM public.payments p
        WHERE p.offer_id = co.id
          AND p.status = 'completed'
    )
  AND (
        co.status::TEXT <> 'active'
        OR co.pickup_pin IS NOT NULL
        OR co.delivery_pin IS NOT NULL
        OR co.pickup_verified_at IS NOT NULL
        OR co.delivery_verified_at IS NOT NULL
        OR co.arrived_at_origin_at IS NOT NULL
        OR co.arrived_at_destination_at IS NOT NULL
    );

REVOKE EXECUTE ON FUNCTION public.create_withdrawal_request FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal_request FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_request TO service_role;
REVOKE EXECUTE ON FUNCTION public.apply_wallet_adjustment FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_wallet_adjustment TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_successful_payment FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_successful_payment TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_pickup_pin TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pickup_pin TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin TO service_role;
