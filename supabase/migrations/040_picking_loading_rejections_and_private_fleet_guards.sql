-- =============================================================================
-- KARGAX - Picking loading rejections and private fleet guards
-- =============================================================================

DROP FUNCTION IF EXISTS public.register_item_loaded(
    UUID,
    UUID,
    VARCHAR(50),
    VARCHAR(200),
    INTEGER,
    TEXT,
    BOOLEAN,
    TEXT[],
    DECIMAL(10, 8),
    DECIMAL(11, 8)
);

DROP FUNCTION IF EXISTS public.register_item_loaded(
    UUID,
    UUID,
    VARCHAR(50),
    VARCHAR(200),
    INTEGER,
    TEXT,
    BOOLEAN,
    TEXT,
    TEXT,
    TEXT[],
    DECIMAL(10, 8),
    DECIMAL(11, 8)
);

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
        metadata
    ) VALUES (
        p_offer_id,
        p_trucker_id,
        v_event_type,
        p_latitude,
        p_longitude,
        p_accuracy_meters,
        jsonb_build_object('distance_meters', ROUND(v_distance), 'tolerance_meters', v_tolerance)
    );

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
        v_distance <= v_tolerance;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_item_loaded(
    p_offer_id UUID,
    p_trucker_id UUID,
    p_item_id VARCHAR(50),
    p_item_name VARCHAR(200),
    p_quantity INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_has_issue BOOLEAN DEFAULT FALSE,
    p_load_status TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL,
    p_photo_urls TEXT[] DEFAULT NULL,
    p_latitude DECIMAL(10, 8) DEFAULT NULL,
    p_longitude DECIMAL(11, 8) DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    loaded_count INTEGER
) AS $$
DECLARE
    v_offer RECORD;
    v_event_type VARCHAR(50);
    v_current_loaded INTEGER;
    v_existing_item JSONB;
    v_expected_qty INTEGER;
    v_effective_load_status TEXT;
    v_is_rejected BOOLEAN;
BEGIN
    SELECT * INTO v_offer FROM public.cargo_offers WHERE id = p_offer_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0;
        RETURN;
    END IF;

    IF p_trucker_id IS NULL OR (
        v_offer.assigned_trucker_id IS DISTINCT FROM p_trucker_id
        AND v_offer.private_fleet_trucker_id IS DISTINCT FROM p_trucker_id
    ) THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta oferta'::TEXT, 0;
        RETURN;
    END IF;

    IF v_offer.arrived_at_origin_at IS NULL THEN
        RETURN QUERY SELECT false, 'Debes registrar tu llegada al origen primero'::TEXT, 0;
        RETURN;
    END IF;

    IF v_offer.pickup_verified_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 'La carga ya fue verificada. No puedes modificar el picking.'::TEXT, 0;
        RETURN;
    END IF;

    UPDATE public.cargo_offers
    SET manifest_items = public.kargax_normalize_manifest_items(manifest_items)
    WHERE id = p_offer_id;

    SELECT item INTO v_existing_item
    FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id
      AND item->>'id' = p_item_id
    LIMIT 1;

    IF v_existing_item IS NULL THEN
        RETURN QUERY SELECT false, 'Item no encontrado en el manifiesto'::TEXT, COALESCE(v_offer.manifest_loaded_count, 0);
        RETURN;
    END IF;

    IF COALESCE(v_existing_item->>'loadedAt', '') <> '' THEN
        SELECT COUNT(*)::INTEGER INTO v_current_loaded
        FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
        WHERE co.id = p_offer_id
          AND COALESCE(item->>'loadedAt', '') <> '';

        UPDATE public.cargo_offers
        SET manifest_loaded_count = v_current_loaded,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY SELECT true, format('Item "%s" ya estaba registrado en carga', p_item_name)::TEXT, v_current_loaded;
        RETURN;
    END IF;

    v_expected_qty := COALESCE(NULLIF(v_existing_item->>'quantity', '')::INTEGER, GREATEST(1, p_quantity));
    v_effective_load_status := LOWER(COALESCE(NULLIF(p_load_status, ''), CASE WHEN p_has_issue THEN 'issue' ELSE 'loaded' END));
    v_is_rejected := v_effective_load_status = 'rejected';

    IF v_is_rejected AND COALESCE(NULLIF(TRIM(COALESCE(p_rejection_reason, p_notes, '')), ''), '') = '' THEN
        RETURN QUERY SELECT false, 'Debes indicar el motivo del rechazo de carga'::TEXT, COALESCE(v_offer.manifest_loaded_count, 0);
        RETURN;
    END IF;

    IF v_is_rejected AND (p_photo_urls IS NULL OR array_length(p_photo_urls, 1) IS NULL) THEN
        RETURN QUERY SELECT false, 'Debes agregar fotos como evidencia del rechazo de carga'::TEXT, COALESCE(v_offer.manifest_loaded_count, 0);
        RETURN;
    END IF;

    v_event_type := CASE
        WHEN v_is_rejected THEN 'item_load_issue'
        WHEN v_effective_load_status = 'issue' OR p_has_issue THEN 'item_load_issue'
        ELSE 'item_loaded'
    END;

    INSERT INTO public.picking_events (
        offer_id, trucker_id, event_type,
        manifest_item_id, manifest_item_name,
        quantity, item_status, notes, photo_urls,
        latitude, longitude, rejection_reason
    ) VALUES (
        p_offer_id, p_trucker_id, v_event_type,
        p_item_id, p_item_name,
        CASE WHEN v_is_rejected THEN 0 ELSE LEAST(GREATEST(1, p_quantity), v_expected_qty) END,
        CASE
            WHEN v_is_rejected THEN 'rejected'
            WHEN v_effective_load_status = 'issue' OR p_has_issue THEN 'issue'
            ELSE 'loaded'
        END,
        COALESCE(p_notes, ''),
        p_photo_urls,
        p_latitude,
        p_longitude,
        CASE WHEN v_is_rejected THEN COALESCE(NULLIF(p_rejection_reason, ''), NULLIF(p_notes, ''), 'Rechazo de carga') ELSE NULL END
    );

    UPDATE public.cargo_offers
    SET
        manifest_items = (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'id' = p_item_id THEN
                        item || jsonb_build_object(
                            'loadedAt', NOW()::TEXT,
                            'loadedQty', CASE WHEN v_is_rejected THEN 0 ELSE LEAST(GREATEST(1, p_quantity), v_expected_qty) END,
                            'loadNotes', COALESCE(p_notes, ''),
                            'loadPhotos', COALESCE(to_jsonb(p_photo_urls), '[]'::jsonb),
                            'hasIssue', (v_effective_load_status = 'issue' OR v_is_rejected OR p_has_issue),
                            'loadStatus', CASE
                                WHEN v_is_rejected THEN 'rejected'
                                WHEN v_effective_load_status = 'issue' OR p_has_issue THEN 'issue'
                                ELSE 'loaded'
                            END,
                            'loadRejectionReason', CASE
                                WHEN v_is_rejected THEN COALESCE(NULLIF(p_rejection_reason, ''), NULLIF(p_notes, ''), 'Rechazo de carga')
                                ELSE NULL
                            END,
                            'isLoaded', NOT v_is_rejected
                        )
                    ELSE item
                END
                ORDER BY ordinality
            )
            FROM jsonb_array_elements(manifest_items) WITH ORDINALITY AS manifest(item, ordinality)
        ),
        loading_started_at = COALESCE(loading_started_at, NOW()),
        updated_at = NOW()
    WHERE id = p_offer_id;

    SELECT COUNT(*)::INTEGER INTO v_current_loaded
    FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id
      AND COALESCE(item->>'loadedAt', '') <> '';

    UPDATE public.cargo_offers
    SET manifest_loaded_count = v_current_loaded
    WHERE id = p_offer_id;

    RETURN QUERY
    SELECT
        true,
        CASE
            WHEN v_is_rejected THEN format('Item "%s" registrado como rechazo en carga', p_item_name)::TEXT
            WHEN v_effective_load_status = 'issue' OR p_has_issue THEN format('Item "%s" registrado con novedad en carga', p_item_name)::TEXT
            ELSE format('Item "%s" registrado como cargado', p_item_name)::TEXT
        END,
        v_current_loaded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.register_item_delivered(
    p_offer_id UUID,
    p_trucker_id UUID,
    p_item_id VARCHAR(50),
    p_item_name VARCHAR(200),
    p_delivered_qty INTEGER,
    p_rejected_qty INTEGER DEFAULT 0,
    p_rejection_reason VARCHAR(100) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_photo_urls TEXT[] DEFAULT NULL,
    p_latitude DECIMAL(10, 8) DEFAULT NULL,
    p_longitude DECIMAL(11, 8) DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    delivered_count INTEGER,
    rejected_count INTEGER
) AS $$
DECLARE
    v_offer RECORD;
    v_current_delivered INTEGER;
    v_current_rejected INTEGER;
    v_existing_item JSONB;
    v_expected_qty INTEGER;
    v_safe_delivered_qty INTEGER;
    v_safe_rejected_qty INTEGER;
BEGIN
    SELECT * INTO v_offer FROM public.cargo_offers WHERE id = p_offer_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0, 0;
        RETURN;
    END IF;

    IF p_trucker_id IS NULL OR (
        v_offer.assigned_trucker_id IS DISTINCT FROM p_trucker_id
        AND v_offer.private_fleet_trucker_id IS DISTINCT FROM p_trucker_id
    ) THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta oferta'::TEXT, 0, 0;
        RETURN;
    END IF;

    IF v_offer.arrived_at_destination_at IS NULL THEN
        RETURN QUERY SELECT false, 'Debes registrar tu llegada al destino primero'::TEXT, 0, 0;
        RETURN;
    END IF;

    IF v_offer.delivery_verified_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 'La entrega ya fue verificada. No puedes modificar.'::TEXT, 0, 0;
        RETURN;
    END IF;

    IF p_rejected_qty > 0 AND (p_rejection_reason IS NULL OR p_rejection_reason = '') THEN
        RETURN QUERY SELECT false, 'Debes indicar el motivo del rechazo'::TEXT, 0, 0;
        RETURN;
    END IF;

    IF p_rejected_qty > 0 AND (p_photo_urls IS NULL OR array_length(p_photo_urls, 1) IS NULL) THEN
        RETURN QUERY SELECT false, 'Debes agregar fotos como evidencia del rechazo'::TEXT, 0, 0;
        RETURN;
    END IF;

    UPDATE public.cargo_offers
    SET manifest_items = public.kargax_normalize_manifest_items(manifest_items)
    WHERE id = p_offer_id;

    SELECT item INTO v_existing_item
    FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id
      AND item->>'id' = p_item_id
    LIMIT 1;

    IF v_existing_item IS NULL THEN
        RETURN QUERY SELECT false, 'Item no encontrado en el manifiesto'::TEXT, COALESCE(v_offer.manifest_delivered_count, 0), COALESCE(v_offer.manifest_rejected_count, 0);
        RETURN;
    END IF;

    IF COALESCE(v_existing_item->>'deliveredAt', '') <> ''
       OR COALESCE(NULLIF(v_existing_item->>'deliveredQty', '')::INTEGER, 0) > 0
       OR COALESCE(NULLIF(v_existing_item->>'rejectedQty', '')::INTEGER, 0) > 0 THEN
        SELECT
            COALESCE(SUM(COALESCE(NULLIF(item->>'deliveredQty', '')::INTEGER, 0)), 0)::INTEGER,
            COALESCE(SUM(COALESCE(NULLIF(item->>'rejectedQty', '')::INTEGER, 0)), 0)::INTEGER
        INTO v_current_delivered, v_current_rejected
        FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
        WHERE co.id = p_offer_id;

        UPDATE public.cargo_offers
        SET manifest_delivered_count = v_current_delivered,
            manifest_rejected_count = v_current_rejected,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY SELECT true, format('Item "%s" ya estaba registrado en entrega', p_item_name)::TEXT, v_current_delivered, v_current_rejected;
        RETURN;
    END IF;

    v_expected_qty := COALESCE(NULLIF(v_existing_item->>'loadedQty', '')::INTEGER, NULLIF(v_existing_item->>'quantity', '')::INTEGER, 0);
    v_safe_delivered_qty := GREATEST(COALESCE(p_delivered_qty, 0), 0);
    v_safe_rejected_qty := GREATEST(COALESCE(p_rejected_qty, 0), 0);

    IF v_expected_qty > 0 AND v_safe_delivered_qty + v_safe_rejected_qty > v_expected_qty THEN
        RETURN QUERY SELECT false, 'La suma entregada y rechazada excede la cantidad esperada'::TEXT, 0, 0;
        RETURN;
    END IF;

    INSERT INTO public.picking_events (
        offer_id, trucker_id, event_type,
        manifest_item_id, manifest_item_name,
        quantity, item_status, notes, rejection_reason, photo_urls,
        latitude, longitude
    ) VALUES (
        p_offer_id,
        p_trucker_id,
        CASE WHEN v_safe_rejected_qty > 0 THEN 'item_rejected' ELSE 'item_delivered' END,
        p_item_id,
        p_item_name,
        GREATEST(v_safe_delivered_qty, v_safe_rejected_qty),
        CASE
            WHEN v_safe_rejected_qty > 0 AND v_safe_delivered_qty > 0 THEN 'partial'
            WHEN v_safe_rejected_qty > 0 THEN 'rejected'
            ELSE 'delivered'
        END,
        p_notes,
        p_rejection_reason,
        p_photo_urls,
        p_latitude,
        p_longitude
    );

    UPDATE public.cargo_offers
    SET
        manifest_items = (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'id' = p_item_id THEN
                        item || jsonb_build_object(
                            'deliveredAt', NOW()::TEXT,
                            'deliveredQty', v_safe_delivered_qty,
                            'rejectedQty', v_safe_rejected_qty,
                            'rejectionReason', p_rejection_reason,
                            'deliveryNotes', COALESCE(p_notes, ''),
                            'deliveryPhotos', COALESCE(to_jsonb(p_photo_urls), '[]'::jsonb),
                            'deliveryStatus', CASE
                                WHEN v_safe_rejected_qty > 0 AND v_safe_delivered_qty > 0 THEN 'partial'
                                WHEN v_safe_rejected_qty > 0 THEN 'rejected'
                                ELSE 'complete'
                            END,
                            'isDelivered', true
                        )
                    ELSE item
                END
                ORDER BY ordinality
            )
            FROM jsonb_array_elements(manifest_items) WITH ORDINALITY AS manifest(item, ordinality)
        ),
        unloading_started_at = COALESCE(unloading_started_at, NOW()),
        updated_at = NOW()
    WHERE id = p_offer_id;

    SELECT
        COALESCE(SUM(COALESCE(NULLIF(item->>'deliveredQty', '')::INTEGER, 0)), 0)::INTEGER,
        COALESCE(SUM(COALESCE(NULLIF(item->>'rejectedQty', '')::INTEGER, 0)), 0)::INTEGER
    INTO v_current_delivered, v_current_rejected
    FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id;

    UPDATE public.cargo_offers
    SET manifest_delivered_count = v_current_delivered,
        manifest_rejected_count = v_current_rejected
    WHERE id = p_offer_id;

    RETURN QUERY SELECT true, format('Item "%s" registrado correctamente', p_item_name)::TEXT, v_current_delivered, v_current_rejected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.register_arrival(
    UUID,
    UUID,
    VARCHAR(20),
    DECIMAL(10, 8),
    DECIMAL(11, 8),
    DECIMAL(8, 2)
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_arrival(
    UUID,
    UUID,
    VARCHAR(20),
    DECIMAL(10, 8),
    DECIMAL(11, 8),
    DECIMAL(8, 2)
) TO service_role;

GRANT EXECUTE ON FUNCTION public.register_item_loaded(
    UUID,
    UUID,
    VARCHAR(50),
    VARCHAR(200),
    INTEGER,
    TEXT,
    BOOLEAN,
    TEXT,
    TEXT,
    TEXT[],
    DECIMAL(10, 8),
    DECIMAL(11, 8)
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_item_delivered(
    UUID,
    UUID,
    VARCHAR(50),
    VARCHAR(200),
    INTEGER,
    INTEGER,
    VARCHAR(100),
    TEXT,
    TEXT[],
    DECIMAL(10, 8),
    DECIMAL(11, 8)
) TO authenticated;
