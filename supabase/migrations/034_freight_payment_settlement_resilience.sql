-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 034: FREIGHT PAYMENT SETTLEMENT RESILIENCE
--
-- Goals:
-- 1. Allow approved-provider reconciliation to close payments that were left in
--    pending/processing/failed/expired by out-of-order gateway events.
-- 2. Persist Mercado Pago as the canonical gateway for freight payments created
--    through the checkout flow.
-- 3. Keep preparation idempotent while refreshing pending payment metadata.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prepare_offer_for_payment(
    p_offer_id UUID,
    p_application_id UUID,
    p_business_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    payment_id UUID,
    trucker_id UUID,
    total_amount DECIMAL,
    platform_fee DECIMAL,
    trucker_amount DECIMAL,
    pickup_contact_name TEXT,
    pickup_contact_phone TEXT,
    delivery_contact_name TEXT,
    delivery_contact_phone TEXT
) AS $$
DECLARE
    v_offer RECORD;
    v_application RECORD;
    v_payment_id UUID;
    v_platform_fee DECIMAL;
    v_total DECIMAL;
    v_platform_fee_percent DECIMAL := 10;
    v_existing_payment_id UUID;
BEGIN
    SELECT * INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            false, 'Oferta no encontrada'::TEXT,
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_offer.business_id <> p_business_id THEN
        RETURN QUERY SELECT
            false, 'No tienes permiso para esta oferta'::TEXT,
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_offer.status NOT IN ('active') THEN
        SELECT id INTO v_existing_payment_id
        FROM public.payments
        WHERE offer_id = p_offer_id
          AND status = 'pending';

        IF v_existing_payment_id IS NOT NULL THEN
            SELECT * INTO v_offer
            FROM public.cargo_offers
            WHERE id = p_offer_id;

            v_platform_fee := COALESCE(v_offer.platform_fee, ROUND(v_offer.total_amount * v_platform_fee_percent / 100, 2));
            v_total := v_offer.total_amount + v_platform_fee;

            UPDATE public.payments
            SET gateway = 'mercadopago',
                payer_id = p_business_id,
                subtotal = v_offer.total_amount,
                platform_fee = v_platform_fee,
                total_amount = v_total,
                updated_at = NOW()
            WHERE id = v_existing_payment_id
              AND status = 'pending';

            RETURN QUERY SELECT
                true,
                'Pago pendiente encontrado'::TEXT,
                v_existing_payment_id,
                v_offer.assigned_trucker_id,
                v_total,
                v_platform_fee,
                v_offer.total_amount,
                v_offer.pickup_contact_name::TEXT,
                v_offer.pickup_contact_phone::TEXT,
                v_offer.delivery_contact_name::TEXT,
                v_offer.delivery_contact_phone::TEXT;
            RETURN;
        END IF;

        RETURN QUERY SELECT
            false, 'La oferta no esta disponible para pago'::TEXT,
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    SELECT * INTO v_application
    FROM public.offer_applications
    WHERE id = p_application_id
      AND offer_id = p_offer_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            false, 'Postulacion no encontrada'::TEXT,
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_application.status NOT IN ('pending', 'accepted') THEN
        RETURN QUERY SELECT
            false, 'Esta postulacion ya fue procesada'::TEXT,
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    v_platform_fee := ROUND(v_offer.total_amount * v_platform_fee_percent / 100, 2);
    v_total := v_offer.total_amount + v_platform_fee;

    IF v_application.status = 'pending' THEN
        UPDATE public.offer_applications
        SET status = 'accepted',
            business_response = 'Seleccionado para pago',
            responded_at = NOW(),
            updated_at = NOW()
        WHERE id = p_application_id;

        UPDATE public.offer_applications
        SET status = 'rejected',
            business_response = 'Otro transportador fue seleccionado',
            responded_at = NOW()
        WHERE offer_id = p_offer_id
          AND id <> p_application_id
          AND status = 'pending';
    END IF;

    UPDATE public.cargo_offers
    SET assigned_trucker_id = v_application.trucker_id,
        platform_fee = v_platform_fee,
        net_amount = v_offer.total_amount,
        updated_at = NOW()
    WHERE id = p_offer_id;

    SELECT id INTO v_existing_payment_id
    FROM public.payments
    WHERE offer_id = p_offer_id
      AND status IN ('pending', 'completed');

    IF v_existing_payment_id IS NULL THEN
        INSERT INTO public.payments (
            offer_id,
            payer_id,
            gateway,
            subtotal,
            platform_fee,
            total_amount,
            status
        ) VALUES (
            p_offer_id,
            p_business_id,
            'mercadopago',
            v_offer.total_amount,
            v_platform_fee,
            v_total,
            'pending'
        ) RETURNING id INTO v_payment_id;
    ELSE
        v_payment_id := v_existing_payment_id;

        UPDATE public.payments
        SET gateway = 'mercadopago',
            payer_id = CASE WHEN status = 'pending' THEN p_business_id ELSE payer_id END,
            subtotal = CASE WHEN status = 'pending' THEN v_offer.total_amount ELSE subtotal END,
            platform_fee = CASE WHEN status = 'pending' THEN v_platform_fee ELSE platform_fee END,
            total_amount = CASE WHEN status = 'pending' THEN v_total ELSE total_amount END,
            updated_at = NOW()
        WHERE id = v_payment_id;
    END IF;

    SELECT * INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id;

    RETURN QUERY SELECT
        true,
        'Oferta preparada para pago'::TEXT,
        v_payment_id,
        v_application.trucker_id,
        v_total,
        v_platform_fee,
        v_offer.total_amount,
        v_offer.pickup_contact_name::TEXT,
        v_offer.pickup_contact_phone::TEXT,
        v_offer.delivery_contact_name::TEXT,
        v_offer.delivery_contact_phone::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
        false, SQLERRM::TEXT,
        NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
        NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

    IF v_payment.status NOT IN ('pending', 'processing', 'failed', 'expired') THEN
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
        gateway = 'mercadopago',
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

GRANT EXECUTE ON FUNCTION public.prepare_offer_for_payment(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_successful_payment(UUID, VARCHAR, JSONB) TO service_role;

COMMENT ON FUNCTION public.prepare_offer_for_payment IS
'Prepara la oferta para pago de flete con gateway Mercado Pago y refresca el pago pendiente reutilizable.';

COMMENT ON FUNCTION public.process_successful_payment IS
'Concilia un pago aprobado de flete aun si la pasarela envio estados intermedios antes de la aprobacion final.';
