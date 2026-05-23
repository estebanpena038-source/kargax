-- =============================================================================
-- KARGAX - TRABAJOIA GAP CLOSURE, LIVE TRACKING AND SETTLEMENT CONTRACT
-- =============================================================================
-- Sprints 29-31: close marketplace settlement to 8% net-to-trucker model,
-- add PWA live tracking, and keep express payment explicitly disabled.

INSERT INTO public.feature_flags (key, enabled, description, scope, country_code, payload)
VALUES
    (
        'express_payment_enabled',
        false,
        'Pago expres queda apagado para piloto hasta tener capital, disputa y aprobacion legal/financiera.',
        'global',
        NULL,
        jsonb_build_object('pilot_status', 'paused', 'requires', jsonb_build_array('capital_partner', 'dispute_rules', 'audited_cron'))
    ),
    (
        'live_trip_tracking_enabled',
        true,
        'Habilita tracking PWA foreground para viajes asignados.',
        'global',
        NULL,
        jsonb_build_object('mode', 'pwa_foreground', 'ping_seconds', 30, 'min_distance_meters', 250)
    )
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    payload = EXCLUDED.payload,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.trip_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    trucker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'stopped', 'completed')),
    source TEXT NOT NULL DEFAULT 'pwa'
        CHECK (source IN ('pwa', 'native_android', 'native_ios', 'admin_manual')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stopped_at TIMESTAMPTZ,
    last_ping_at TIMESTAMPTZ,
    last_latitude NUMERIC(10,8),
    last_longitude NUMERIC(11,8),
    last_accuracy_meters NUMERIC(8,2),
    last_speed_mps NUMERIC(8,2),
    last_heading_degrees NUMERIC(8,2),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trip_location_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.trip_tracking_sessions(id) ON DELETE CASCADE,
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    trucker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    latitude NUMERIC(10,8) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude NUMERIC(11,8) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    accuracy_meters NUMERIC(8,2),
    speed_mps NUMERIC(8,2),
    heading_degrees NUMERIC(8,2),
    battery_level NUMERIC(5,2) CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100)),
    source TEXT NOT NULL DEFAULT 'pwa'
        CHECK (source IN ('pwa', 'native_android', 'native_ios', 'admin_manual')),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_trip_tracking_sessions_offer
    ON public.trip_tracking_sessions(offer_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_tracking_sessions_trucker
    ON public.trip_tracking_sessions(trucker_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_trip_tracking_session
    ON public.trip_tracking_sessions(offer_id, trucker_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_trip_location_pings_offer_recent
    ON public.trip_location_pings(offer_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_location_pings_session_recent
    ON public.trip_location_pings(session_id, captured_at DESC);

ALTER TABLE public.trip_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_location_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip participants can read tracking sessions" ON public.trip_tracking_sessions;
CREATE POLICY "Trip participants can read tracking sessions"
    ON public.trip_tracking_sessions FOR SELECT TO authenticated
    USING (
        trucker_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.cargo_offers co
            WHERE co.id = offer_id
              AND co.business_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

DROP POLICY IF EXISTS "Trip participants can read location pings" ON public.trip_location_pings;
CREATE POLICY "Trip participants can read location pings"
    ON public.trip_location_pings FOR SELECT TO authenticated
    USING (
        trucker_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.cargo_offers co
            WHERE co.id = offer_id
              AND co.business_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

GRANT SELECT ON public.trip_tracking_sessions TO authenticated;
GRANT SELECT ON public.trip_location_pings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trip_tracking_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.trip_location_pings TO service_role;

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
    v_trucker_amount DECIMAL;
    v_total DECIMAL;
    v_platform_fee_percent DECIMAL := 8;
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

    IF COALESCE(v_offer.is_private_fleet, FALSE) THEN
        v_platform_fee := 0;
        v_trucker_amount := COALESCE(v_offer.freight_payment_amount, v_offer.net_amount, v_offer.total_amount, 0);
        v_total := COALESCE(v_offer.total_amount, v_trucker_amount, 0);
    ELSE
        v_total := COALESCE(v_offer.total_amount, 0);
        v_platform_fee := COALESCE(v_offer.platform_fee, ROUND(v_total * v_platform_fee_percent / 100, 2));
        v_trucker_amount := GREATEST(v_total - v_platform_fee, 0);
    END IF;

    IF v_offer.status NOT IN ('active') THEN
        SELECT id INTO v_existing_payment_id
        FROM public.payments
        WHERE offer_id = p_offer_id
          AND status = 'pending';

        IF v_existing_payment_id IS NOT NULL THEN
            UPDATE public.payments
            SET gateway = 'mercadopago',
                payer_id = p_business_id,
                subtotal = v_trucker_amount,
                platform_fee = v_platform_fee,
                total_amount = v_total,
                updated_at = NOW()
            WHERE id = v_existing_payment_id
              AND status = 'pending';

            RETURN QUERY SELECT
                true,
                'Pago pendiente encontrado'::TEXT,
                v_existing_payment_id,
                COALESCE(v_offer.assigned_trucker_id, v_offer.private_fleet_trucker_id),
                v_total,
                v_platform_fee,
                v_trucker_amount,
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
        net_amount = v_trucker_amount,
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb)
            || jsonb_build_object(
                'commission_rate', CASE WHEN COALESCE(is_private_fleet, FALSE) THEN 0 ELSE v_platform_fee_percent END,
                'gross_amount', v_total,
                'platform_fee', v_platform_fee,
                'net_amount', v_trucker_amount,
                'settlement_source', CASE WHEN COALESCE(is_private_fleet, FALSE) THEN 'private_fleet_saas' ELSE 'marketplace_8_percent' END
            )
        ),
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
            v_trucker_amount,
            v_platform_fee,
            v_total,
            'pending'
        ) RETURNING id INTO v_payment_id;
    ELSE
        v_payment_id := v_existing_payment_id;

        UPDATE public.payments
        SET gateway = 'mercadopago',
            payer_id = CASE WHEN status = 'pending' THEN p_business_id ELSE payer_id END,
            subtotal = CASE WHEN status = 'pending' THEN v_trucker_amount ELSE subtotal END,
            platform_fee = CASE WHEN status = 'pending' THEN v_platform_fee ELSE platform_fee END,
            total_amount = CASE WHEN status = 'pending' THEN v_total ELSE total_amount END,
            updated_at = NOW()
        WHERE id = v_payment_id;
    END IF;

    RETURN QUERY SELECT
        true,
        'Oferta preparada para pago'::TEXT,
        v_payment_id,
        v_application.trucker_id,
        v_total,
        v_platform_fee,
        v_trucker_amount,
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

GRANT EXECUTE ON FUNCTION public.prepare_offer_for_payment(UUID, UUID, UUID) TO authenticated;

COMMENT ON TABLE public.trip_tracking_sessions IS
'Sesiones de tracking foreground PWA/native por viaje.';

COMMENT ON TABLE public.trip_location_pings IS
'Pings de ubicacion recibidos desde PWA/native para trazabilidad de viaje.';

COMMENT ON FUNCTION public.prepare_offer_for_payment IS
'Prepara pago marketplace con contrato piloto: empresa paga gross total_amount, KargaX retiene 8%, transportador recibe neto.';
