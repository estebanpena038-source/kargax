-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 030: PAYMENT & TRIP FLOW GUARDS
--
-- Fixes:
-- 1. Notification triggers referenced a non-existent `users` table.
-- 2. Truckers could register GPS arrival on accepted-but-unpaid offers.
-- 3. Historical offers could remain in operational statuses without a
--    confirmed payment, making the UI look "paid" when it was not.
-- 4. Re-assert the secure accept flow so acceptance never starts the trip.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_profile_display_name(
    p_user_id UUID,
    p_default TEXT DEFAULT 'Usuario'
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        NULLIF(BTRIM(up.full_name), ''),
        NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
        p_default
    )
    FROM (SELECT p_user_id AS id) seed
    LEFT JOIN public.user_profiles up ON up.id = seed.id
    LEFT JOIN auth.users au ON au.id = seed.id;
$$;

COMMENT ON FUNCTION public.get_profile_display_name IS
'Resuelve el nombre visible de un usuario usando user_profiles y auth.users.';

CREATE OR REPLACE FUNCTION public.accept_application_with_message(
    p_offer_id UUID,
    p_application_id UUID,
    p_message_content TEXT,
    p_business_response TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trucker_id UUID;
    v_business_id UUID;
    v_p1_id UUID;
    v_p2_id UUID;
    v_conversation_id UUID;
    v_message_id UUID;
    v_offer_status TEXT;
BEGIN
    SELECT trucker_id INTO v_trucker_id
    FROM public.offer_applications
    WHERE id = p_application_id
      AND offer_id = p_offer_id;

    IF v_trucker_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aplicacion no encontrada');
    END IF;

    SELECT business_id, status INTO v_business_id, v_offer_status
    FROM public.cargo_offers
    WHERE id = p_offer_id;

    IF v_business_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Oferta no encontrada');
    END IF;

    IF v_offer_status NOT IN ('active', 'draft') THEN
        RETURN jsonb_build_object('success', false, 'error', 'La oferta ya fue procesada');
    END IF;

    UPDATE public.offer_applications
    SET
        status = 'accepted',
        business_response = COALESCE(p_business_response, 'Aceptado'),
        responded_at = NOW()
    WHERE id = p_application_id;

    UPDATE public.cargo_offers
    SET
        assigned_trucker_id = v_trucker_id,
        updated_at = NOW()
    WHERE id = p_offer_id;

    UPDATE public.offer_applications
    SET
        status = 'rejected',
        business_response = 'Otro transportador fue seleccionado',
        responded_at = NOW()
    WHERE offer_id = p_offer_id
      AND id != p_application_id
      AND status = 'pending';

    SELECT
        CASE WHEN v_business_id < v_trucker_id THEN v_business_id ELSE v_trucker_id END,
        CASE WHEN v_business_id < v_trucker_id THEN v_trucker_id ELSE v_business_id END
    INTO v_p1_id, v_p2_id;

    SELECT id INTO v_conversation_id
    FROM public.conversations
    WHERE participant1_id = v_p1_id
      AND participant2_id = v_p2_id
      AND offer_id = p_offer_id;

    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (participant1_id, participant2_id, offer_id)
        VALUES (v_p1_id, v_p2_id, p_offer_id)
        RETURNING id INTO v_conversation_id;
    END IF;

    INSERT INTO public.messages (conversation_id, sender_id, content, message_type)
    VALUES (v_conversation_id, v_business_id, p_message_content, 'text')
    RETURNING id INTO v_message_id;

    PERFORM public.create_notification(
        v_trucker_id,
        'application_accepted',
        'Tu postulacion fue aceptada',
        'Has sido seleccionado para un viaje. Esperando confirmacion de pago.',
        jsonb_build_object(
            'offer_id', p_offer_id,
            'application_id', p_application_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'applicationId', p_application_id,
            'conversationId', v_conversation_id,
            'messageId', v_message_id,
            'truckerId', v_trucker_id,
            'requiresPayment', true
        )
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.accept_application_with_message IS
'Acepta la postulacion y crea conversacion. No mueve la oferta a viaje iniciado sin pago confirmado.';

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
BEGIN
    SELECT * INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0, false;
        RETURN;
    END IF;

    IF v_offer.assigned_trucker_id != p_trucker_id THEN
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

    IF p_location_type = 'origin' AND NOT v_has_completed_payment AND v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT
            false,
            'El viaje aun no tiene pago confirmado. Espera la confirmacion antes de iniciar.'::TEXT,
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
        v_distance := 0;
    ELSE
        v_distance := 6371000 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(p_latitude - v_target_lat) / 2), 2) +
            COS(RADIANS(v_target_lat)) * COS(RADIANS(p_latitude)) *
            POWER(SIN(RADIANS(p_longitude - v_target_lng) / 2), 2)
        ));
    END IF;

    INSERT INTO public.picking_events (
        offer_id,
        trucker_id,
        event_type,
        latitude,
        longitude,
        accuracy_meters,
        notes,
        metadata
    ) VALUES (
        p_offer_id,
        p_trucker_id,
        v_event_type,
        p_latitude,
        p_longitude,
        p_accuracy_meters,
        CASE
            WHEN v_distance > v_tolerance
                THEN format('Llegada registrada a %s metros de la ubicacion esperada', v_distance::INTEGER)
            ELSE 'Llegada verificada correctamente'
        END,
        jsonb_build_object(
            'distance_meters', v_distance::INTEGER,
            'tolerance_meters', v_tolerance,
            'within_tolerance', v_distance <= v_tolerance
        )
    );

    IF p_location_type = 'origin' THEN
        UPDATE public.cargo_offers
        SET
            arrived_at_origin_at = NOW(),
            trucker_origin_lat = p_latitude,
            trucker_origin_lng = p_longitude,
            updated_at = NOW()
        WHERE id = p_offer_id;
    ELSE
        UPDATE public.cargo_offers
        SET
            arrived_at_destination_at = NOW(),
            trucker_destination_lat = p_latitude,
            trucker_destination_lng = p_longitude,
            updated_at = NOW()
        WHERE id = p_offer_id;
    END IF;

    RETURN QUERY SELECT
        true,
        CASE
            WHEN v_distance <= v_tolerance
                THEN 'Ubicacion verificada. Puedes iniciar.'::TEXT
            ELSE format('Registrado. Distancia: %s metros (tolerancia: %s metros)', v_distance::INTEGER, v_tolerance)::TEXT
        END,
        v_distance::INTEGER,
        v_distance <= v_tolerance;
END;
$$;

COMMENT ON FUNCTION public.register_arrival IS
'Registra llegada GPS solo cuando la oferta ya tiene un pago confirmado.';

UPDATE public.cargo_offers co
SET
    status = 'active',
    arrived_at_origin_at = NULL,
    arrived_at_destination_at = NULL,
    loading_started_at = NULL,
    loading_completed_at = NULL,
    unloading_started_at = NULL,
    unloading_completed_at = NULL,
    trucker_origin_lat = NULL,
    trucker_origin_lng = NULL,
    trucker_destination_lat = NULL,
    trucker_destination_lng = NULL,
    manifest_loaded_count = 0,
    manifest_delivered_count = 0,
    manifest_rejected_count = 0,
    updated_at = NOW()
WHERE co.status IN ('reserved', 'in_progress')
  AND co.pickup_verified_at IS NULL
  AND co.delivery_verified_at IS NULL
  AND co.pickup_pin IS NULL
  AND co.delivery_pin IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.offer_id = co.id
        AND p.status = 'completed'
  );

CREATE OR REPLACE FUNCTION public.notify_on_loading_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_manifest_summary JSONB;
    v_trucker_name TEXT;
    v_total_items INTEGER;
    v_loaded_items INTEGER;
    v_issues INTEGER;
BEGIN
    IF NEW.pickup_verified_at IS NOT NULL AND OLD.pickup_verified_at IS NULL THEN
        v_manifest_summary := public.calculate_manifest_summary(NEW.manifest_items);
        v_total_items := (v_manifest_summary->>'total')::INTEGER;
        v_loaded_items := (v_manifest_summary->>'loaded')::INTEGER;
        v_issues := (v_manifest_summary->>'withIssues')::INTEGER;
        v_trucker_name := public.get_profile_display_name(NEW.assigned_trucker_id, 'Transportador');

        PERFORM public.create_notification(
            NEW.business_id,
            'inspection_loading_completed',
            'Carga completada - ' || v_loaded_items || '/' || v_total_items || ' items',
            v_trucker_name || ' ha completado la carga en ' || NEW.origin_city ||
            '. ' || CASE WHEN v_issues > 0 THEN v_issues || ' items con novedades.' ELSE 'Sin novedades.' END,
            jsonb_build_object(
                'offer_id', NEW.id,
                'trucker_id', NEW.assigned_trucker_id,
                'trucker_name', v_trucker_name,
                'origin_city', NEW.origin_city,
                'destination_city', NEW.destination_city,
                'summary', v_manifest_summary,
                'completed_at', NEW.pickup_verified_at,
                'has_issues', v_issues > 0
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_delivery_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_manifest_summary JSONB;
    v_trucker_name TEXT;
    v_total_items INTEGER;
    v_delivered_items INTEGER;
    v_rejected_items INTEGER;
    v_message TEXT;
BEGIN
    IF NEW.delivery_verified_at IS NOT NULL AND OLD.delivery_verified_at IS NULL THEN
        v_manifest_summary := public.calculate_manifest_summary(NEW.manifest_items);
        v_total_items := (v_manifest_summary->>'total')::INTEGER;
        v_delivered_items := (v_manifest_summary->>'delivered')::INTEGER;
        v_rejected_items := (v_manifest_summary->>'rejected')::INTEGER;
        v_trucker_name := public.get_profile_display_name(NEW.assigned_trucker_id, 'Transportador');

        IF v_rejected_items > 0 THEN
            v_message := v_trucker_name || ' entrego ' || v_delivered_items || ' items en ' ||
                NEW.destination_city || '. ' || v_rejected_items || ' items rechazados.';
        ELSE
            v_message := v_trucker_name || ' entrego exitosamente todos los items (' ||
                v_delivered_items || '/' || v_total_items || ') en ' || NEW.destination_city || '.';
        END IF;

        PERFORM public.create_notification(
            NEW.business_id,
            'inspection_delivery_completed',
            'Entrega completada - ' || v_delivered_items || '/' || v_total_items || ' items',
            v_message,
            jsonb_build_object(
                'offer_id', NEW.id,
                'trucker_id', NEW.assigned_trucker_id,
                'trucker_name', v_trucker_name,
                'origin_city', NEW.origin_city,
                'destination_city', NEW.destination_city,
                'summary', v_manifest_summary,
                'completed_at', NEW.delivery_verified_at,
                'has_rejections', v_rejected_items > 0,
                'total_amount', NEW.total_amount
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_inspection_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_trucker_name TEXT;
BEGIN
    IF NEW.event_type = 'item_rejected' THEN
        SELECT * INTO v_offer
        FROM public.cargo_offers
        WHERE id = NEW.offer_id;

        IF v_offer IS NULL THEN
            RETURN NEW;
        END IF;

        v_trucker_name := public.get_profile_display_name(NEW.trucker_id, 'Transportador');

        PERFORM public.create_notification(
            v_offer.business_id,
            'inspection_issue_reported',
            'Item rechazado: ' || COALESCE(NEW.manifest_item_name, 'Item'),
            v_trucker_name || ' reporto un rechazo en ' || v_offer.destination_city ||
            '. Motivo: ' || COALESCE(
                CASE NEW.rejection_reason
                    WHEN 'damaged' THEN 'Danado'
                    WHEN 'missing' THEN 'Faltante'
                    WHEN 'wrong_item' THEN 'Item equivocado'
                    WHEN 'customer_refused' THEN 'Cliente rechazo'
                    WHEN 'expired' THEN 'Expirado'
                    WHEN 'quality_issue' THEN 'Problema de calidad'
                    ELSE 'Otro'
                END,
                'No especificado'
            ),
            jsonb_build_object(
                'offer_id', NEW.offer_id,
                'event_id', NEW.id,
                'trucker_id', NEW.trucker_id,
                'item_name', NEW.manifest_item_name,
                'item_id', NEW.manifest_item_id,
                'quantity', NEW.quantity,
                'rejection_reason', NEW.rejection_reason,
                'notes', NEW.notes,
                'photo_urls', NEW.photo_urls,
                'location', jsonb_build_object(
                    'latitude', NEW.latitude,
                    'longitude', NEW.longitude
                )
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_trip_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trucker_name TEXT;
BEGIN
    IF NEW.arrived_at_origin_at IS NOT NULL AND OLD.arrived_at_origin_at IS NULL THEN
        v_trucker_name := public.get_profile_display_name(NEW.assigned_trucker_id, 'Transportador');

        PERFORM public.create_notification(
            NEW.business_id,
            'trip_started',
            'Viaje iniciado - ' || NEW.origin_city || ' a ' || NEW.destination_city,
            v_trucker_name || ' ha llegado al punto de origen en ' || NEW.origin_city ||
            ' y comenzara la carga.',
            jsonb_build_object(
                'offer_id', NEW.id,
                'trucker_id', NEW.assigned_trucker_id,
                'trucker_name', v_trucker_name,
                'origin_city', NEW.origin_city,
                'destination_city', NEW.destination_city,
                'arrived_at', NEW.arrived_at_origin_at,
                'gps_verified', jsonb_build_object(
                    'latitude', NEW.trucker_origin_lat,
                    'longitude', NEW.trucker_origin_lng
                )
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_trip_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trucker_name TEXT;
    v_manifest_summary JSONB;
    v_duration_hours DECIMAL;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        IF NEW.arrived_at_origin_at IS NOT NULL AND NEW.delivery_verified_at IS NOT NULL THEN
            v_duration_hours := EXTRACT(EPOCH FROM (NEW.delivery_verified_at - NEW.arrived_at_origin_at)) / 3600;
        END IF;

        v_manifest_summary := public.calculate_manifest_summary(NEW.manifest_items);
        v_trucker_name := public.get_profile_display_name(NEW.assigned_trucker_id, 'Transportador');

        PERFORM public.create_notification(
            NEW.business_id,
            'trip_completed',
            'Viaje completado exitosamente',
            'El viaje de ' || NEW.origin_city || ' a ' || NEW.destination_city ||
            ' ha sido completado por ' || COALESCE(v_trucker_name, 'el transportador') || '.',
            jsonb_build_object(
                'offer_id', NEW.id,
                'trucker_id', NEW.assigned_trucker_id,
                'trucker_name', v_trucker_name,
                'origin_city', NEW.origin_city,
                'destination_city', NEW.destination_city,
                'summary', v_manifest_summary,
                'completed_at', NEW.delivery_verified_at,
                'duration_hours', ROUND(COALESCE(v_duration_hours, 0)::NUMERIC, 1),
                'total_amount', NEW.total_amount
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_display_name TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_application_with_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_arrival TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_arrival TO service_role;
