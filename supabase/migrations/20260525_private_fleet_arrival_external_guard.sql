-- =============================================================================
-- KARGAX - PRIVATE FLEET ARRIVAL EXTERNAL PAYMENT GUARD
--
-- Fix:
-- - marketplace still requires completed payment before origin arrival
-- - private fleet does not require Mercado Pago/internal payment because it is
--   settled by external proof
-- =============================================================================

-- Keep this corrective migration self-contained. Some staging/prod databases may
-- have the new arrival function without the private-assignment columns from the
-- 20260522 package, which makes SELECT * INTO v_offer fail at runtime when the
-- function reads v_offer.private_fleet_assignment_status.
ALTER TABLE public.cargo_offers
    ADD COLUMN IF NOT EXISTS private_fleet_assignment_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS private_fleet_rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS private_fleet_rejected_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS private_fleet_rejection_reason TEXT;

ALTER TABLE public.cargo_offers
    DROP CONSTRAINT IF EXISTS cargo_offers_private_fleet_assignment_status_check,
    ADD CONSTRAINT cargo_offers_private_fleet_assignment_status_check
        CHECK (private_fleet_assignment_status IN ('pending', 'accepted', 'rejected'));

UPDATE public.cargo_offers
SET private_fleet_assignment_status = 'accepted'
WHERE is_private_fleet = TRUE
  AND (
      private_fleet_confirmed_at IS NOT NULL
      OR status IN ('reserved', 'in_progress', 'completed')
  )
  AND private_fleet_assignment_status <> 'accepted';

UPDATE public.cargo_offers
SET private_fleet_assignment_status = 'pending'
WHERE is_private_fleet = TRUE
  AND status = 'assigned'
  AND private_fleet_confirmed_at IS NULL
  AND private_fleet_assignment_status <> 'rejected';

CREATE INDEX IF NOT EXISTS idx_cargo_offers_private_assignment_status
    ON public.cargo_offers(is_private_fleet, private_fleet_assignment_status, private_fleet_trucker_id, status);

ALTER TABLE public.cargo_offers
    ADD COLUMN IF NOT EXISTS origin_latitude DECIMAL(10, 8),
    ADD COLUMN IF NOT EXISTS origin_longitude DECIMAL(11, 8),
    ADD COLUMN IF NOT EXISTS destination_latitude DECIMAL(10, 8),
    ADD COLUMN IF NOT EXISTS destination_longitude DECIMAL(11, 8),
    ADD COLUMN IF NOT EXISTS gps_tolerance_meters INTEGER DEFAULT 500,
    ADD COLUMN IF NOT EXISTS arrived_at_origin_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS arrived_at_destination_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS loading_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS unloading_started_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.register_arrival(
    p_offer_id UUID,
    p_trucker_id UUID,
    p_location_type VARCHAR(20),
    p_latitude DECIMAL(10, 8),
    p_longitude DECIMAL(11, 8),
    p_accuracy_meters DECIMAL(8, 2) DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    distance_meters INTEGER,
    within_tolerance BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_target_lat DECIMAL(10, 8);
    v_target_lng DECIMAL(11, 8);
    v_distance DECIMAL(10, 2);
    v_tolerance INTEGER;
    v_event_type VARCHAR(50);
    v_has_completed_payment BOOLEAN := FALSE;
    v_requires_completed_payment BOOLEAN := TRUE;
    v_private_assignment_ready BOOLEAN := FALSE;
    v_max_accuracy INTEGER := 150;
BEGIN
    SELECT *
    INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0, false;
        RETURN;
    END IF;

    IF p_trucker_id IS NULL OR (
        v_offer.assigned_trucker_id IS DISTINCT FROM p_trucker_id
        AND v_offer.private_fleet_trucker_id IS DISTINCT FROM p_trucker_id
    ) THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta oferta'::TEXT, 0, false;
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.payments p
        WHERE p.offer_id = p_offer_id
          AND p.status = 'completed'
    )
    INTO v_has_completed_payment;

    v_requires_completed_payment := COALESCE(v_offer.is_private_fleet, FALSE) = FALSE;
    v_private_assignment_ready := COALESCE(v_offer.is_private_fleet, FALSE) = TRUE
        AND (
            COALESCE(v_offer.private_fleet_assignment_status, 'accepted') = 'accepted'
            OR v_offer.private_fleet_confirmed_at IS NOT NULL
            OR v_offer.status IN ('assigned', 'reserved', 'in_progress')
        );

    IF p_location_type = 'origin'
       AND v_requires_completed_payment
       AND NOT v_has_completed_payment
       AND v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT
            false,
            'El viaje aun no tiene pago confirmado. Espera la confirmacion antes de iniciar.'::TEXT,
            0,
            false;
        RETURN;
    END IF;

    IF p_location_type = 'origin'
       AND COALESCE(v_offer.is_private_fleet, FALSE) = TRUE
       AND NOT v_private_assignment_ready
       AND v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT
            false,
            'El viaje privado aun no esta aceptado por el conductor.'::TEXT,
            0,
            false;
        RETURN;
    END IF;

    IF p_location_type = 'origin' THEN
        v_target_lat := v_offer.origin_latitude;
        v_target_lng := v_offer.origin_longitude;
        v_event_type := 'arrival_origin';

        IF v_offer.arrived_at_origin_at IS NOT NULL THEN
            RETURN QUERY SELECT true, 'Ya habias registrado tu llegada al origen'::TEXT, 0, true;
            RETURN;
        END IF;
    ELSIF p_location_type = 'destination' THEN
        v_target_lat := v_offer.destination_latitude;
        v_target_lng := v_offer.destination_longitude;
        v_event_type := 'arrival_destination';

        IF v_offer.pickup_verified_at IS NULL THEN
            RETURN QUERY SELECT false, 'Primero debes completar la carga en origen'::TEXT, 0, false;
            RETURN;
        END IF;

        IF v_offer.arrived_at_destination_at IS NOT NULL THEN
            RETURN QUERY SELECT true, 'Ya habias registrado tu llegada al destino'::TEXT, 0, true;
            RETURN;
        END IF;
    ELSE
        RETURN QUERY SELECT false, 'Tipo de ubicacion invalido'::TEXT, 0, false;
        RETURN;
    END IF;

    v_tolerance := COALESCE(v_offer.gps_tolerance_meters, 500);

    IF v_target_lat IS NULL OR v_target_lng IS NULL THEN
        RETURN QUERY SELECT
            false,
            'Esta ruta no tiene coordenadas configuradas. La empresa debe completarlas.'::TEXT,
            0,
            false;
        RETURN;
    END IF;

    IF p_latitude IS NULL OR p_longitude IS NULL THEN
        RETURN QUERY SELECT false, 'No se recibieron coordenadas GPS del conductor.'::TEXT, 0, false;
        RETURN;
    END IF;

    IF p_accuracy_meters IS NOT NULL AND p_accuracy_meters > v_max_accuracy THEN
        INSERT INTO public.picking_events (
            offer_id,
            trucker_id,
            event_type,
            latitude,
            longitude,
            accuracy_meters,
            metadata
        ) VALUES (
            p_offer_id,
            p_trucker_id,
            v_event_type,
            p_latitude,
            p_longitude,
            p_accuracy_meters,
            jsonb_build_object(
                'rejected_reason', 'gps_accuracy_too_low',
                'max_accuracy_meters', v_max_accuracy
            )
        );

        RETURN QUERY SELECT
            false,
            format('La senal GPS esta imprecisa (+/- %sm). Espera mejor senal y vuelve a intentar.', ROUND(p_accuracy_meters))::TEXT,
            0,
            false;
        RETURN;
    END IF;

    v_distance := 6371000 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(p_latitude - v_target_lat) / 2), 2) +
        COS(RADIANS(v_target_lat)) * COS(RADIANS(p_latitude)) *
        POWER(SIN(RADIANS(p_longitude - v_target_lng) / 2), 2)
    ));

    INSERT INTO public.picking_events (
        offer_id,
        trucker_id,
        event_type,
        latitude,
        longitude,
        accuracy_meters,
        metadata
    ) VALUES (
        p_offer_id,
        p_trucker_id,
        v_event_type,
        p_latitude,
        p_longitude,
        p_accuracy_meters,
        jsonb_build_object(
            'distance_meters', ROUND(v_distance),
            'tolerance_meters', v_tolerance,
            'within_tolerance', v_distance <= v_tolerance,
            'payment_required', v_requires_completed_payment,
            'private_fleet_external_proof', COALESCE(v_offer.is_private_fleet, FALSE)
        )
    );

    IF v_distance > v_tolerance THEN
        RETURN QUERY SELECT
            false,
            format('No has llegado al punto requerido. Distancia actual: %s m; radio permitido: %s m.', ROUND(v_distance), v_tolerance)::TEXT,
            ROUND(v_distance)::INTEGER,
            false;
        RETURN;
    END IF;

    IF p_location_type = 'origin' THEN
        UPDATE public.cargo_offers
        SET arrived_at_origin_at = NOW(),
            loading_started_at = COALESCE(loading_started_at, NOW()),
            updated_at = NOW()
        WHERE id = p_offer_id;
    ELSE
        UPDATE public.cargo_offers
        SET arrived_at_destination_at = NOW(),
            unloading_started_at = COALESCE(unloading_started_at, NOW()),
            updated_at = NOW()
        WHERE id = p_offer_id;
    END IF;

    RETURN QUERY
    SELECT
        true,
        'Llegada registrada correctamente'::TEXT,
        ROUND(v_distance)::INTEGER,
        true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_arrival(
    UUID,
    UUID,
    VARCHAR,
    DECIMAL,
    DECIMAL,
    DECIMAL
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_arrival(
    UUID,
    UUID,
    VARCHAR,
    DECIMAL,
    DECIMAL,
    DECIMAL
) TO service_role;

COMMENT ON FUNCTION public.register_arrival(UUID, UUID, VARCHAR, DECIMAL, DECIMAL, DECIMAL) IS
'Registra llegada GPS. Marketplace requiere pago confirmado; flota privada usa liquidacion externa y no requiere payment completed.';
