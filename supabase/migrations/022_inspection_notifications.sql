-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 022: INSPECTION NOTIFICATIONS
-- 
-- Sistema de notificaciones para reportes de inspección.
-- Notifica a las empresas (business) cuando los camioneros completan
-- inspecciones de carga y entrega, incluyendo resumen de items.
--
-- NUEVOS TIPOS DE NOTIFICACIÓN:
-- - inspection_loading_completed: Carga completada con detalles
-- - inspection_delivery_completed: Entrega completada con detalles
-- - inspection_issue_reported: Problema reportado durante picking
--
-- =============================================================================

-- =============================================================================
-- SECTION 1: EXTENDER TIPOS DE NOTIFICACIÓN
-- =============================================================================

-- Recrear la tabla con los nuevos tipos de notificación
-- Primero eliminamos el CHECK constraint existente y añadimos uno nuevo

ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    -- Tipos existentes
    'application_received',
    'application_accepted', 
    'application_rejected',
    'offer_published',
    'offer_expired',
    'new_message',
    -- Nuevos tipos de inspección
    'inspection_loading_completed',
    'inspection_delivery_completed',
    'inspection_issue_reported',
    'trip_started',
    'trip_completed'
));

-- Añadir índice para buscar notificaciones por tipo
CREATE INDEX IF NOT EXISTS idx_notifications_type 
    ON notifications(user_id, type);

-- =============================================================================
-- SECTION 2: FUNCIÓN HELPER - Calcular resumen de manifiesto
-- =============================================================================

-- Esta función calcula estadísticas de los items del manifiesto
CREATE OR REPLACE FUNCTION calculate_manifest_summary(p_manifest_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total INTEGER := 0;
    v_loaded INTEGER := 0;
    v_delivered INTEGER := 0;
    v_rejected INTEGER := 0;
    v_with_issues INTEGER := 0;
    v_item JSONB;
BEGIN
    -- Contar items
    IF p_manifest_items IS NULL OR jsonb_array_length(p_manifest_items) = 0 THEN
        RETURN jsonb_build_object(
            'total', 0,
            'loaded', 0,
            'delivered', 0,
            'rejected', 0,
            'withIssues', 0,
            'loadingCompliancePercent', 0,
            'deliveryCompliancePercent', 0
        );
    END IF;
    
    v_total := jsonb_array_length(p_manifest_items);
    
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_manifest_items)
    LOOP
        -- Contar cargados
        IF (v_item->>'loadedQty')::INTEGER > 0 THEN
            v_loaded := v_loaded + 1;
        END IF;
        
        -- Contar con novedades
        IF (v_item->>'hasIssue')::BOOLEAN = true THEN
            v_with_issues := v_with_issues + 1;
        END IF;
        
        -- Contar entregados
        IF (v_item->>'deliveredQty')::INTEGER > 0 THEN
            v_delivered := v_delivered + 1;
        END IF;
        
        -- Contar rechazados
        IF (v_item->>'rejectedQty')::INTEGER > 0 AND 
           COALESCE((v_item->>'deliveredQty')::INTEGER, 0) = 0 THEN
            v_rejected := v_rejected + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'total', v_total,
        'loaded', v_loaded,
        'delivered', v_delivered,
        'rejected', v_rejected,
        'withIssues', v_with_issues,
        'loadingCompliancePercent', CASE WHEN v_total > 0 THEN ROUND((v_loaded::DECIMAL / v_total) * 100) ELSE 0 END,
        'deliveryCompliancePercent', CASE WHEN v_total > 0 THEN ROUND((v_delivered::DECIMAL / v_total) * 100) ELSE 0 END
    );
END;
$$;

COMMENT ON FUNCTION calculate_manifest_summary IS 
    'Calcula estadísticas de resumen del manifiesto de carga para notificaciones';

-- =============================================================================
-- SECTION 3: TRIGGER - Notificar cuando se completa la carga (pickup_verified)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_loading_completed()
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
    -- Solo ejecutar cuando se verifica el pickup_verified_at y antes era NULL
    IF NEW.pickup_verified_at IS NOT NULL AND OLD.pickup_verified_at IS NULL THEN
        
        -- Calcular resumen del manifiesto
        v_manifest_summary := calculate_manifest_summary(NEW.manifest_items);
        v_total_items := (v_manifest_summary->>'total')::INTEGER;
        v_loaded_items := (v_manifest_summary->>'loaded')::INTEGER;
        v_issues := (v_manifest_summary->>'withIssues')::INTEGER;
        
        -- Obtener nombre del camionero
        SELECT COALESCE(u.full_name, au.raw_user_meta_data->>'full_name', 'Transportador')
        INTO v_trucker_name
        FROM users u
        LEFT JOIN auth.users au ON au.id = u.id
        WHERE u.id = NEW.assigned_trucker_id;
        
        IF v_trucker_name IS NULL THEN
            v_trucker_name := 'Transportador';
        END IF;
        
        -- Crear notificación para el business
        PERFORM create_notification(
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
        
        RAISE NOTICE 'Notification sent for loading completed: offer_id=%, business_id=%', NEW.id, NEW.business_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger para notificación de carga
DROP TRIGGER IF EXISTS trg_notify_loading_completed ON cargo_offers;
CREATE TRIGGER trg_notify_loading_completed
    AFTER UPDATE ON cargo_offers
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_loading_completed();

COMMENT ON FUNCTION notify_on_loading_completed IS 
    'Notifica al business cuando el camionero completa la carga (PIN de pickup verificado)';

-- =============================================================================
-- SECTION 4: TRIGGER - Notificar cuando se completa la entrega (delivery_verified)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_delivery_completed()
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
    -- Solo ejecutar cuando se verifica el delivery_verified_at y antes era NULL
    IF NEW.delivery_verified_at IS NOT NULL AND OLD.delivery_verified_at IS NULL THEN
        
        -- Calcular resumen del manifiesto
        v_manifest_summary := calculate_manifest_summary(NEW.manifest_items);
        v_total_items := (v_manifest_summary->>'total')::INTEGER;
        v_delivered_items := (v_manifest_summary->>'delivered')::INTEGER;
        v_rejected_items := (v_manifest_summary->>'rejected')::INTEGER;
        
        -- Obtener nombre del camionero
        SELECT COALESCE(u.full_name, au.raw_user_meta_data->>'full_name', 'Transportador')
        INTO v_trucker_name
        FROM users u
        LEFT JOIN auth.users au ON au.id = u.id
        WHERE u.id = NEW.assigned_trucker_id;
        
        IF v_trucker_name IS NULL THEN
            v_trucker_name := 'Transportador';
        END IF;
        
        -- Construir mensaje según resultado
        IF v_rejected_items > 0 THEN
            v_message := v_trucker_name || ' entregó ' || v_delivered_items || ' items en ' || 
                         NEW.destination_city || '. ' || v_rejected_items || ' items rechazados.';
        ELSE
            v_message := v_trucker_name || ' entregó exitosamente todos los items (' || 
                         v_delivered_items || '/' || v_total_items || ') en ' || NEW.destination_city || '.';
        END IF;
        
        -- Crear notificación para el business
        PERFORM create_notification(
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
        
        RAISE NOTICE 'Notification sent for delivery completed: offer_id=%, business_id=%', NEW.id, NEW.business_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger para notificación de entrega
DROP TRIGGER IF EXISTS trg_notify_delivery_completed ON cargo_offers;
CREATE TRIGGER trg_notify_delivery_completed
    AFTER UPDATE ON cargo_offers
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_delivery_completed();

COMMENT ON FUNCTION notify_on_delivery_completed IS 
    'Notifica al business cuando el camionero completa la entrega (PIN de delivery verificado)';

-- =============================================================================
-- SECTION 5: TRIGGER - Notificar cuando hay rechazos significativos
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_inspection_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_trucker_name TEXT;
BEGIN
    -- Solo ejecutar para eventos de rechazo
    IF NEW.event_type = 'item_rejected' THEN
        
        -- Obtener información de la oferta
        SELECT * INTO v_offer FROM cargo_offers WHERE id = NEW.offer_id;
        
        IF v_offer IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Obtener nombre del camionero
        SELECT COALESCE(u.full_name, 'Transportador')
        INTO v_trucker_name
        FROM users u
        WHERE u.id = NEW.trucker_id;
        
        -- Crear notificación para el business
        PERFORM create_notification(
            v_offer.business_id,
            'inspection_issue_reported',
            'Item rechazado: ' || COALESCE(NEW.manifest_item_name, 'Item'),
            v_trucker_name || ' reportó un rechazo en ' || v_offer.destination_city || 
            '. Motivo: ' || COALESCE(
                CASE NEW.rejection_reason
                    WHEN 'damaged' THEN 'Dañado'
                    WHEN 'missing' THEN 'Faltante'
                    WHEN 'wrong_item' THEN 'Item equivocado'
                    WHEN 'customer_refused' THEN 'Cliente rechazó'
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

-- Crear trigger para notificación de rechazos
DROP TRIGGER IF EXISTS trg_notify_inspection_issue ON picking_events;
CREATE TRIGGER trg_notify_inspection_issue
    AFTER INSERT ON picking_events
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_inspection_issue();

COMMENT ON FUNCTION notify_on_inspection_issue IS 
    'Notifica al business cuando hay un rechazo de item durante la inspección';

-- =============================================================================
-- SECTION 6: TRIGGER - Notificar inicio de viaje (llegada a origen)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_trip_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trucker_name TEXT;
BEGIN
    -- Solo ejecutar cuando arrived_at_origin_at se llena por primera vez
    IF NEW.arrived_at_origin_at IS NOT NULL AND OLD.arrived_at_origin_at IS NULL THEN
        
        -- Obtener nombre del camionero
        SELECT COALESCE(u.full_name, au.raw_user_meta_data->>'full_name', 'Transportador')
        INTO v_trucker_name
        FROM users u
        LEFT JOIN auth.users au ON au.id = u.id
        WHERE u.id = NEW.assigned_trucker_id;
        
        IF v_trucker_name IS NULL THEN
            v_trucker_name := 'Transportador';
        END IF;
        
        -- Crear notificación para el business
        PERFORM create_notification(
            NEW.business_id,
            'trip_started',
            'Viaje iniciado - ' || NEW.origin_city || ' a ' || NEW.destination_city,
            v_trucker_name || ' ha llegado al punto de origen en ' || NEW.origin_city || 
            ' y comenzará la carga.',
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

-- Crear trigger
DROP TRIGGER IF EXISTS trg_notify_trip_started ON cargo_offers;
CREATE TRIGGER trg_notify_trip_started
    AFTER UPDATE ON cargo_offers
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_trip_started();

-- =============================================================================
-- SECTION 7: TRIGGER - Viaje completado
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_trip_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trucker_name TEXT;
    v_manifest_summary JSONB;
    v_duration_hours DECIMAL;
BEGIN
    -- Solo ejecutar cuando status cambia a 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        
        -- Calcular duración del viaje
        IF NEW.arrived_at_origin_at IS NOT NULL AND NEW.delivery_verified_at IS NOT NULL THEN
            v_duration_hours := EXTRACT(EPOCH FROM (NEW.delivery_verified_at - NEW.arrived_at_origin_at)) / 3600;
        END IF;
        
        -- Calcular resumen del manifiesto
        v_manifest_summary := calculate_manifest_summary(NEW.manifest_items);
        
        -- Obtener nombre del camionero
        SELECT COALESCE(u.full_name, 'Transportador')
        INTO v_trucker_name
        FROM users u
        WHERE u.id = NEW.assigned_trucker_id;
        
        -- Crear notificación para el business
        PERFORM create_notification(
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

-- Crear trigger
DROP TRIGGER IF EXISTS trg_notify_trip_completed ON cargo_offers;
CREATE TRIGGER trg_notify_trip_completed
    AFTER UPDATE ON cargo_offers
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_trip_completed();

-- =============================================================================
-- SECTION 8: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION calculate_manifest_summary TO authenticated;

-- =============================================================================
-- SECTION 9: COMENTARIOS FINALES
-- =============================================================================

COMMENT ON TRIGGER trg_notify_loading_completed ON cargo_offers IS 
    'Notifica cuando carga completada (pickup_verified_at)';

COMMENT ON TRIGGER trg_notify_delivery_completed ON cargo_offers IS 
    'Notifica cuando entrega completada (delivery_verified_at)';

COMMENT ON TRIGGER trg_notify_trip_started ON cargo_offers IS 
    'Notifica cuando camionero llega a origen (arrived_at_origin_at)';

COMMENT ON TRIGGER trg_notify_trip_completed ON cargo_offers IS 
    'Notifica cuando viaje completado (status = completed)';

-- =============================================================================
-- FIN DE MIGRACIÓN 022
-- =============================================================================
