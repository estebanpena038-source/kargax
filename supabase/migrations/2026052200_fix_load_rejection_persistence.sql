BEGIN;

CREATE OR REPLACE FUNCTION public.kargax_jsonb_nonnegative_int(p_item JSONB, p_key TEXT)
RETURNS INTEGER AS $$
    SELECT CASE
        WHEN p_item IS NULL THEN NULL
        WHEN COALESCE(p_item->>p_key, '') ~ '^-?[0-9]+$' THEN GREATEST(0, (p_item->>p_key)::INTEGER)
        ELSE NULL
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.kargax_manifest_item_is_load_rejected(p_item JSONB)
RETURNS BOOLEAN AS $$
    SELECT CASE
        WHEN p_item IS NULL THEN FALSE
        ELSE
            LOWER(COALESCE(p_item->>'loadStatus', '')) IN ('rejected', 'rechazado_en_origen')
            OR NULLIF(TRIM(COALESCE(p_item->>'loadRejectionReason', '')), '') IS NOT NULL
            OR LOWER(COALESCE(p_item->>'loadNotes', '')) LIKE '%rechaz%'
            OR (
                public.kargax_jsonb_nonnegative_int(p_item, 'loadedQty') = 0
                AND (
                    COALESCE(p_item->>'loadedAt', '') <> ''
                    OR COALESCE(p_item->>'loadRejectionReason', '') <> ''
                )
            )
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.kargax_manifest_item_load_rejected_qty(p_item JSONB)
RETURNS INTEGER AS $$
    SELECT CASE
        WHEN public.kargax_manifest_item_is_load_rejected(p_item)
            THEN COALESCE(public.kargax_jsonb_nonnegative_int(p_item, 'quantity'), 0)
        ELSE 0
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.kargax_manifest_item_deliverable_qty(p_item JSONB)
RETURNS INTEGER AS $$
    SELECT CASE
        WHEN p_item IS NULL THEN 0
        WHEN public.kargax_manifest_item_is_load_rejected(p_item) THEN 0
        WHEN public.kargax_jsonb_nonnegative_int(p_item, 'loadedQty') IS NOT NULL
            THEN public.kargax_jsonb_nonnegative_int(p_item, 'loadedQty')
        ELSE COALESCE(public.kargax_jsonb_nonnegative_int(p_item, 'quantity'), 0)
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.kargax_manifest_item_rejected_qty(p_item JSONB)
RETURNS INTEGER AS $$
    SELECT CASE
        WHEN p_item IS NULL THEN 0
        WHEN public.kargax_manifest_item_is_load_rejected(p_item)
            THEN public.kargax_manifest_item_load_rejected_qty(p_item)
        ELSE COALESCE(public.kargax_jsonb_nonnegative_int(p_item, 'rejectedQty'), 0)
    END;
$$ LANGUAGE sql IMMUTABLE;

WITH expanded AS (
    SELECT
        co.id,
        manifest.item,
        manifest.ordinality
    FROM public.cargo_offers co
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(co.manifest_items) = 'array' THEN co.manifest_items
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS manifest(item, ordinality)
),
cleaned AS (
    SELECT
        id,
        ordinality,
        CASE
            WHEN public.kargax_manifest_item_is_load_rejected(item) THEN
                item
                - 'deliveredAt'
                - 'deliveredQty'
                - 'rejectedQty'
                - 'rejectionReason'
                - 'deliveryNotes'
                - 'deliveryPhotos'
                - 'deliveryStatus'
                - 'isDelivered'
                || jsonb_build_object(
                    'loadedAt', COALESCE(NULLIF(item->>'loadedAt', ''), NOW()::TEXT),
                    'loadedQty', 0,
                    'loadStatus', 'rejected',
                    'isLoaded', FALSE,
                    'hasIssue', TRUE,
                    'loadRejectionReason', COALESCE(
                        NULLIF(TRIM(item->>'loadRejectionReason'), ''),
                        NULLIF(TRIM(item->>'loadNotes'), ''),
                        'Carga rechazada en bodega.'
                    )
                )
            ELSE item
        END AS item
    FROM expanded
),
aggregated AS (
    SELECT
        id,
        jsonb_agg(item ORDER BY ordinality) AS manifest_items,
        COALESCE(COUNT(*) FILTER (WHERE COALESCE(item->>'loadedAt', '') <> ''), 0)::INTEGER AS loaded_count,
        COALESCE(SUM(
            CASE
                WHEN public.kargax_manifest_item_is_load_rejected(item) THEN 0
                ELSE COALESCE(public.kargax_jsonb_nonnegative_int(item, 'deliveredQty'), 0)
            END
        ), 0)::INTEGER AS delivered_count,
        COALESCE(SUM(public.kargax_manifest_item_rejected_qty(item)), 0)::INTEGER AS rejected_count
    FROM cleaned
    GROUP BY id
)
UPDATE public.cargo_offers co
SET
    manifest_items = aggregated.manifest_items,
    manifest_loaded_count = aggregated.loaded_count,
    manifest_delivered_count = aggregated.delivered_count,
    manifest_rejected_count = aggregated.rejected_count,
    updated_at = NOW()
FROM aggregated
WHERE co.id = aggregated.id
  AND (
    co.manifest_items IS DISTINCT FROM aggregated.manifest_items
    OR COALESCE(co.manifest_loaded_count, 0) IS DISTINCT FROM aggregated.loaded_count
    OR COALESCE(co.manifest_delivered_count, 0) IS DISTINCT FROM aggregated.delivered_count
    OR COALESCE(co.manifest_rejected_count, 0) IS DISTINCT FROM aggregated.rejected_count
  );

UPDATE public.picking_events
SET
    event_type = 'item_load_issue',
    quantity = 0,
    item_status = 'rejected',
    rejection_reason = COALESCE(NULLIF(TRIM(rejection_reason), ''), NULLIF(TRIM(notes), ''), 'Carga rechazada en bodega.')
WHERE event_type = 'item_loaded'
  AND COALESCE(item_status, '') <> 'rejected'
  AND (
    LOWER(COALESCE(notes, '')) LIKE '%rechaz%'
    OR LOWER(COALESCE(rejection_reason, '')) LIKE '%rechaz%'
  );

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
    v_current_rejected INTEGER;
    v_existing_item JSONB;
    v_expected_qty INTEGER;
    v_effective_load_status TEXT;
    v_is_rejected BOOLEAN;
    v_rejection_text TEXT;
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

        SELECT COALESCE(SUM(public.kargax_manifest_item_rejected_qty(item)), 0)::INTEGER INTO v_current_rejected
        FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
        WHERE co.id = p_offer_id;

        UPDATE public.cargo_offers
        SET manifest_loaded_count = v_current_loaded,
            manifest_rejected_count = v_current_rejected,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY SELECT true, format('Item "%s" ya estaba registrado en carga', p_item_name)::TEXT, v_current_loaded;
        RETURN;
    END IF;

    v_expected_qty := COALESCE(public.kargax_jsonb_nonnegative_int(v_existing_item, 'quantity'), GREATEST(1, p_quantity));
    v_rejection_text := COALESCE(NULLIF(TRIM(p_rejection_reason), ''), NULLIF(TRIM(p_notes), ''), '');
    v_effective_load_status := LOWER(COALESCE(NULLIF(p_load_status, ''), CASE WHEN p_has_issue THEN 'issue' ELSE 'loaded' END));
    v_is_rejected := v_effective_load_status = 'rejected'
        OR NULLIF(TRIM(COALESCE(p_rejection_reason, '')), '') IS NOT NULL
        OR LOWER(COALESCE(p_notes, '')) LIKE '%rechaz%';

    IF v_is_rejected THEN
        v_effective_load_status := 'rejected';
    END IF;

    IF v_is_rejected AND v_rejection_text = '' THEN
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

    SELECT COALESCE(SUM(public.kargax_manifest_item_rejected_qty(item)), 0)::INTEGER INTO v_current_rejected
    FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id;

    UPDATE public.cargo_offers
    SET manifest_loaded_count = v_current_loaded,
        manifest_rejected_count = v_current_rejected
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

    v_expected_qty := public.kargax_manifest_item_deliverable_qty(v_existing_item);

    IF v_expected_qty = 0 THEN
        UPDATE public.cargo_offers
        SET manifest_items = (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'id' = p_item_id THEN
                        item
                        - 'deliveredAt'
                        - 'deliveredQty'
                        - 'rejectedQty'
                        - 'rejectionReason'
                        - 'deliveryNotes'
                        - 'deliveryPhotos'
                        - 'deliveryStatus'
                        - 'isDelivered'
                    ELSE item
                END
                ORDER BY ordinality
            )
            FROM jsonb_array_elements(manifest_items) WITH ORDINALITY AS manifest(item, ordinality)
        ),
        updated_at = NOW()
        WHERE id = p_offer_id;

        SELECT
            COALESCE(SUM(CASE WHEN public.kargax_manifest_item_is_load_rejected(item) THEN 0 ELSE COALESCE(public.kargax_jsonb_nonnegative_int(item, 'deliveredQty'), 0) END), 0)::INTEGER,
            COALESCE(SUM(public.kargax_manifest_item_rejected_qty(item)), 0)::INTEGER
        INTO v_current_delivered, v_current_rejected
        FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
        WHERE co.id = p_offer_id;

        UPDATE public.cargo_offers
        SET manifest_delivered_count = v_current_delivered,
            manifest_rejected_count = v_current_rejected,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY SELECT true, format('Item "%s" fue rechazado en carga y no es entregable', p_item_name)::TEXT, v_current_delivered, v_current_rejected;
        RETURN;
    END IF;

    IF COALESCE(v_existing_item->>'deliveredAt', '') <> ''
       OR COALESCE(public.kargax_jsonb_nonnegative_int(v_existing_item, 'deliveredQty'), 0) > 0
       OR COALESCE(public.kargax_jsonb_nonnegative_int(v_existing_item, 'rejectedQty'), 0) > 0 THEN
        SELECT
            COALESCE(SUM(CASE WHEN public.kargax_manifest_item_is_load_rejected(item) THEN 0 ELSE COALESCE(public.kargax_jsonb_nonnegative_int(item, 'deliveredQty'), 0) END), 0)::INTEGER,
            COALESCE(SUM(public.kargax_manifest_item_rejected_qty(item)), 0)::INTEGER
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

    v_safe_delivered_qty := GREATEST(COALESCE(p_delivered_qty, 0), 0);
    v_safe_rejected_qty := GREATEST(COALESCE(p_rejected_qty, 0), 0);

    IF v_safe_delivered_qty + v_safe_rejected_qty > v_expected_qty THEN
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
                            'isDelivered', v_safe_delivered_qty > 0
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
        COALESCE(SUM(CASE WHEN public.kargax_manifest_item_is_load_rejected(item) THEN 0 ELSE COALESCE(public.kargax_jsonb_nonnegative_int(item, 'deliveredQty'), 0) END), 0)::INTEGER,
        COALESCE(SUM(public.kargax_manifest_item_rejected_qty(item)), 0)::INTEGER
    INTO v_current_delivered, v_current_rejected
    FROM public.cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id;

    UPDATE public.cargo_offers
    SET manifest_delivered_count = v_current_delivered,
        manifest_rejected_count = v_current_rejected
    WHERE id = p_offer_id;

    RETURN QUERY
    SELECT
        true,
        CASE
            WHEN v_safe_rejected_qty > 0 THEN format('Item "%s" registrado con rechazo en entrega', p_item_name)::TEXT
            ELSE format('Item "%s" registrado como entregado', p_item_name)::TEXT
        END,
        v_current_delivered,
        v_current_rejected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.kargax_jsonb_nonnegative_int(JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kargax_manifest_item_is_load_rejected(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kargax_manifest_item_load_rejected_qty(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kargax_manifest_item_deliverable_qty(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kargax_manifest_item_rejected_qty(JSONB) TO authenticated, service_role;
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
) TO authenticated, service_role;
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
) TO authenticated, service_role;

COMMIT;
