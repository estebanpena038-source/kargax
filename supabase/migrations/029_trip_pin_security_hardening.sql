-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 029: TRIP PIN SECURITY HARDENING
-- Enforce assigned trucker validation even when the client omits p_trucker_id.
-- =============================================================================

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
    SELECT * INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_effective_trucker_id IS NULL OR v_offer.assigned_trucker_id != v_effective_trucker_id THEN
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

    IF UPPER(TRIM(v_offer.pickup_pin)) != UPPER(TRIM(p_input_pin)) THEN
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
    v_max_attempts INTEGER := 5;
    v_release_amount DECIMAL(15,2);
    v_available_before DECIMAL(15,2);
    v_available_after_deposit DECIMAL(15,2);
    v_repayment RECORD;
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

    IF v_effective_trucker_id IS NULL OR v_offer.assigned_trucker_id != v_effective_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta operacion'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT false, 'Primero debes verificar el pickup'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.status != 'in_progress' THEN
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

    IF UPPER(TRIM(v_offer.delivery_pin)) != UPPER(TRIM(p_input_pin)) THEN
        UPDATE public.cargo_offers
        SET pin_attempts = pin_attempts + 1,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY
        SELECT false, format('PIN incorrecto. Intentos restantes: %s', v_max_attempts - v_offer.pin_attempts - 1)::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    SELECT id, available_balance INTO v_wallet_id, v_available_before
    FROM public.wallets
    WHERE user_id = v_offer.assigned_trucker_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN QUERY SELECT false, 'Billetera del camionero no encontrada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

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
        wallet_id, offer_id, type, status, amount, balance_before, balance_after, description, metadata
    ) VALUES (
        v_wallet_id,
        p_offer_id,
        'trip_deposit',
        'completed',
        v_release_amount,
        v_available_before,
        v_available_after_deposit,
        format('Pago liberado por viaje #%s', LEFT(p_offer_id::TEXT, 8)),
        jsonb_build_object('gross_release_amount', v_release_amount)
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
