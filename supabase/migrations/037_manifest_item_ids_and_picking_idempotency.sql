-- =============================================================================
-- KARGAX - Manifest item IDs and picking idempotency hardening
-- =============================================================================
-- Guarantees every manifest item has a stable ID and prevents repeated picking
-- submissions from inflating counters or inspection reports.

CREATE OR REPLACE FUNCTION public.kargax_manifest_item_id(p_name TEXT, p_index BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT 'manifest-' || p_index || '-' || COALESCE(
        NULLIF(
            regexp_replace(
                lower(regexp_replace(COALESCE(p_name, 'item'), '[^[:alnum:]]+', '-', 'g')),
                '(^-+|-+$)',
                '',
                'g'
            ),
            ''
        ),
        'item'
    );
$$;

CREATE OR REPLACE FUNCTION public.kargax_normalize_manifest_items(p_manifest JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN COALESCE(item->>'id', '') <> '' THEN item
                ELSE item || jsonb_build_object('id', public.kargax_manifest_item_id(item->>'name', ordinality))
            END
            ORDER BY ordinality
        ),
        '[]'::jsonb
    )
    FROM jsonb_array_elements(COALESCE(p_manifest, '[]'::jsonb)) WITH ORDINALITY AS manifest(item, ordinality);
$$;

UPDATE public.cargo_offers
SET
    manifest_items = public.kargax_normalize_manifest_items(manifest_items),
    updated_at = NOW()
WHERE manifest_items IS NOT NULL
  AND jsonb_typeof(manifest_items) = 'array'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(manifest_items) AS item
      WHERE COALESCE(item->>'id', '') = ''
  );

CREATE OR REPLACE FUNCTION register_item_loaded(
    p_offer_id UUID,
    p_trucker_id UUID,
    p_item_id VARCHAR(50),
    p_item_name VARCHAR(200),
    p_quantity INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_has_issue BOOLEAN DEFAULT FALSE,
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
BEGIN
    SELECT * INTO v_offer FROM cargo_offers WHERE id = p_offer_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0;
        RETURN;
    END IF;

    IF v_offer.assigned_trucker_id != p_trucker_id THEN
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

    UPDATE cargo_offers
    SET manifest_items = public.kargax_normalize_manifest_items(manifest_items)
    WHERE id = p_offer_id;

    SELECT item INTO v_existing_item
    FROM cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id
      AND item->>'id' = p_item_id
    LIMIT 1;

    IF v_existing_item IS NULL THEN
        RETURN QUERY SELECT false, 'Item no encontrado en el manifiesto'::TEXT, COALESCE(v_offer.manifest_loaded_count, 0);
        RETURN;
    END IF;

    IF COALESCE(v_existing_item->>'loadedAt', '') <> '' OR COALESCE(NULLIF(v_existing_item->>'loadedQty', '')::INTEGER, 0) > 0 THEN
        SELECT COUNT(*)::INTEGER INTO v_current_loaded
        FROM cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
        WHERE co.id = p_offer_id
          AND (COALESCE(item->>'loadedAt', '') <> '' OR COALESCE(NULLIF(item->>'loadedQty', '')::INTEGER, 0) > 0);

        UPDATE cargo_offers
        SET manifest_loaded_count = v_current_loaded, updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY SELECT true, format('Item "%s" ya estaba registrado como cargado', p_item_name)::TEXT, v_current_loaded;
        RETURN;
    END IF;

    v_event_type := CASE WHEN p_has_issue THEN 'item_load_issue' ELSE 'item_loaded' END;

    INSERT INTO picking_events (
        offer_id, trucker_id, event_type,
        manifest_item_id, manifest_item_name,
        quantity, item_status, notes, photo_urls,
        latitude, longitude
    ) VALUES (
        p_offer_id, p_trucker_id, v_event_type,
        p_item_id, p_item_name,
        GREATEST(1, p_quantity),
        CASE WHEN p_has_issue THEN 'issue' ELSE 'loaded' END,
        p_notes, p_photo_urls,
        p_latitude, p_longitude
    );

    UPDATE cargo_offers
    SET
        manifest_items = (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'id' = p_item_id THEN
                        item || jsonb_build_object(
                            'loadedAt', NOW()::TEXT,
                            'loadedQty', LEAST(GREATEST(1, p_quantity), COALESCE(NULLIF(item->>'quantity', '')::INTEGER, GREATEST(1, p_quantity))),
                            'loadNotes', COALESCE(p_notes, ''),
                            'loadPhotos', COALESCE(p_photo_urls, ARRAY[]::TEXT[]),
                            'hasIssue', p_has_issue
                        )
                    ELSE item
                END
                ORDER BY ordinality
            )
            FROM jsonb_array_elements(manifest_items) WITH ORDINALITY AS manifest(item, ordinality)
        ),
        updated_at = NOW()
    WHERE id = p_offer_id;

    SELECT COUNT(*)::INTEGER INTO v_current_loaded
    FROM cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id
      AND (COALESCE(item->>'loadedAt', '') <> '' OR COALESCE(NULLIF(item->>'loadedQty', '')::INTEGER, 0) > 0);

    UPDATE cargo_offers
    SET manifest_loaded_count = v_current_loaded
    WHERE id = p_offer_id;

    RETURN QUERY SELECT true, format('Item "%s" registrado como cargado', p_item_name)::TEXT, v_current_loaded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION register_item_delivered(
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
    SELECT * INTO v_offer FROM cargo_offers WHERE id = p_offer_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0, 0;
        RETURN;
    END IF;

    IF v_offer.assigned_trucker_id != p_trucker_id THEN
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

    UPDATE cargo_offers
    SET manifest_items = public.kargax_normalize_manifest_items(manifest_items)
    WHERE id = p_offer_id;

    SELECT item INTO v_existing_item
    FROM cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
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
        FROM cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
        WHERE co.id = p_offer_id;

        UPDATE cargo_offers
        SET manifest_delivered_count = v_current_delivered,
            manifest_rejected_count = v_current_rejected,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY SELECT true, format('Item "%s" ya estaba registrado en entrega', p_item_name)::TEXT, v_current_delivered, v_current_rejected;
        RETURN;
    END IF;

    v_expected_qty := GREATEST(1, COALESCE(NULLIF(v_existing_item->>'quantity', '')::INTEGER, p_delivered_qty + p_rejected_qty, 1));
    v_safe_rejected_qty := LEAST(GREATEST(0, p_rejected_qty), v_expected_qty);
    v_safe_delivered_qty := LEAST(GREATEST(0, p_delivered_qty), v_expected_qty - v_safe_rejected_qty);

    IF v_safe_delivered_qty > 0 THEN
        INSERT INTO picking_events (
            offer_id, trucker_id, event_type,
            manifest_item_id, manifest_item_name,
            quantity, item_status, notes,
            latitude, longitude
        ) VALUES (
            p_offer_id, p_trucker_id, 'item_delivered',
            p_item_id, p_item_name,
            v_safe_delivered_qty, 'delivered', p_notes,
            p_latitude, p_longitude
        );
    END IF;

    IF v_safe_rejected_qty > 0 THEN
        INSERT INTO picking_events (
            offer_id, trucker_id, event_type,
            manifest_item_id, manifest_item_name,
            quantity, item_status,
            notes, rejection_reason, photo_urls,
            latitude, longitude
        ) VALUES (
            p_offer_id, p_trucker_id, 'item_rejected',
            p_item_id, p_item_name,
            v_safe_rejected_qty, 'rejected',
            p_notes, p_rejection_reason, p_photo_urls,
            p_latitude, p_longitude
        );
    END IF;

    UPDATE cargo_offers
    SET
        manifest_items = (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'id' = p_item_id THEN
                        item || jsonb_build_object(
                            'deliveredAt', NOW()::TEXT,
                            'deliveredQty', v_safe_delivered_qty,
                            'rejectedQty', v_safe_rejected_qty,
                            'rejectionReason', COALESCE(p_rejection_reason, ''),
                            'deliveryNotes', COALESCE(p_notes, ''),
                            'deliveryPhotos', COALESCE(p_photo_urls, ARRAY[]::TEXT[]),
                            'deliveryStatus', CASE
                                WHEN v_safe_rejected_qty = 0 THEN 'complete'
                                WHEN v_safe_delivered_qty = 0 THEN 'rejected'
                                ELSE 'partial'
                            END
                        )
                    ELSE item
                END
                ORDER BY ordinality
            )
            FROM jsonb_array_elements(manifest_items) WITH ORDINALITY AS manifest(item, ordinality)
        ),
        updated_at = NOW()
    WHERE id = p_offer_id;

    SELECT
        COALESCE(SUM(COALESCE(NULLIF(item->>'deliveredQty', '')::INTEGER, 0)), 0)::INTEGER,
        COALESCE(SUM(COALESCE(NULLIF(item->>'rejectedQty', '')::INTEGER, 0)), 0)::INTEGER
    INTO v_current_delivered, v_current_rejected
    FROM cargo_offers co, jsonb_array_elements(co.manifest_items) AS item
    WHERE co.id = p_offer_id;

    UPDATE cargo_offers
    SET manifest_delivered_count = v_current_delivered,
        manifest_rejected_count = v_current_rejected
    WHERE id = p_offer_id;

    RETURN QUERY SELECT true, format('Item "%s": %s entregados, %s rechazados', p_item_name, v_safe_delivered_qty, v_safe_rejected_qty)::TEXT, v_current_delivered, v_current_rejected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.kargax_manifest_item_id(TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kargax_normalize_manifest_items(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION register_item_loaded TO authenticated;
GRANT EXECUTE ON FUNCTION register_item_delivered TO authenticated;
