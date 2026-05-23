-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 018: ENHANCED DIGITAL PICKING SYSTEM
-- 
-- Sistema completo de picking digital con verificación GPS, fotos de evidencia,
-- y trazabilidad completa desde carga hasta entrega.
--
-- ARQUITECTURA:
-- - manifest_items: Estructura mejorada con estado de carga/entrega por item
-- - picking_events: Tabla de auditoría para cada acción de picking
-- - Columnas GPS para verificación de ubicación
-- - Soporte para fotos de evidencia y novedades
--
-- FLUJO:
-- 1. Empresa crea manifiesto con items (nombre, cantidad, SKU, foto)
-- 2. Camionero llega a origen → GPS verifica ubicación → Inicia carga
-- 3. Camionero marca cada item como cargado + fotos de novedad si aplica
-- 4. PIN de salida → Viaje inicia
-- 5. Camionero llega a destino → GPS verifica ubicación → Inicia descarga
-- 6. Camionero marca cada item como entregado/rechazado + fotos si rechazo
-- 7. PIN de entrega → Dinero liberado
--
-- =============================================================================

-- =============================================================================
-- SECTION 1: NUEVAS COLUMNAS EN CARGO_OFFERS
-- =============================================================================

-- 1.1 Coordenadas GPS de origen y destino
-- Estas se usan para verificar que el camionero realmente está en la ubicación
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS origin_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS origin_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS destination_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS destination_longitude DECIMAL(11, 8);

-- 1.2 Radio de tolerancia para GPS (en metros)
-- Default: 500 metros - ajustable por oferta
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS gps_tolerance_meters INTEGER DEFAULT 500;

-- 1.3 Timestamps de llegada física (verificada por GPS)
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS arrived_at_origin_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS arrived_at_destination_at TIMESTAMPTZ;

-- 1.4 Timestamps de inicio de carga/descarga
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS loading_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS loading_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unloading_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unloading_completed_at TIMESTAMPTZ;

-- 1.5 Coordenadas reales registradas del camionero
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS trucker_origin_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS trucker_origin_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS trucker_destination_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS trucker_destination_lng DECIMAL(11, 8);

-- 1.6 Resumen de picking (calculado automáticamente)
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS manifest_loaded_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS manifest_delivered_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS manifest_rejected_count INTEGER DEFAULT 0;

-- 1.7 Fotos generales del viaje (no asociadas a items específicos)
-- Formato: [{type: 'loading'|'unloading'|'general', url: string, timestamp: string, notes: string}]
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS trip_photos JSONB DEFAULT '[]';

-- 1.8 Notas del viaje
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS loading_notes TEXT,
ADD COLUMN IF NOT EXISTS unloading_notes TEXT;

-- =============================================================================
-- SECTION 2: TABLA picking_events (AUDITORÍA COMPLETA)
-- =============================================================================

-- Esta tabla registra CADA acción de picking para trazabilidad completa
-- Nunca se elimina, solo se agrega - inmutable para auditoría

CREATE TABLE IF NOT EXISTS public.picking_events (
    -- Identificador único del evento
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referencia a la oferta y camionero
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    trucker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tipo de evento (ENUM como string para flexibilidad)
    event_type VARCHAR(50) NOT NULL,
    -- Valores posibles:
    -- 'arrival_origin'      - Llegada a origen verificada por GPS
    -- 'loading_started'     - Inicio de carga
    -- 'item_loaded'         - Item cargado al camión
    -- 'item_load_issue'     - Novedad en item durante carga
    -- 'loading_completed'   - Carga finalizada
    -- 'arrival_destination' - Llegada a destino verificada por GPS
    -- 'unloading_started'   - Inicio de descarga
    -- 'item_delivered'      - Item entregado al cliente
    -- 'item_rejected'       - Item rechazado por cliente
    -- 'unloading_completed' - Descarga finalizada
    -- 'photo_added'         - Foto agregada como evidencia
    
    -- Referencia al item específico (si aplica)
    -- Este es el ID del item dentro del array manifest_items
    manifest_item_id VARCHAR(50),
    manifest_item_name VARCHAR(200),
    
    -- Cantidad afectada (para eventos de item)
    quantity INTEGER,
    
    -- Estado del item después del evento
    item_status VARCHAR(30),
    -- Valores: 'loaded', 'delivered', 'rejected', 'partial'
    
    -- Notas y observaciones
    notes TEXT,
    
    -- Motivo (para rechazos)
    rejection_reason VARCHAR(100),
    -- Valores: 'damaged', 'missing', 'wrong_item', 'customer_refused', 'other'
    
    -- Fotos asociadas al evento
    photo_urls TEXT[],
    
    -- Ubicación GPS al momento del evento
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    accuracy_meters DECIMAL(8, 2),
    
    -- Metadata adicional (flexible para futuras extensiones)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Índices serán creados después
    CONSTRAINT valid_event_type CHECK (
        event_type IN (
            'arrival_origin', 'loading_started', 'item_loaded', 'item_load_issue',
            'loading_completed', 'arrival_destination', 'unloading_started',
            'item_delivered', 'item_rejected', 'unloading_completed', 'photo_added'
        )
    )
);

-- Comentario de tabla
COMMENT ON TABLE public.picking_events IS 
'Registro de auditoría inmutable para todas las acciones de picking. 
Cada evento captura quién, qué, cuándo, dónde y por qué para trazabilidad completa.';

-- =============================================================================
-- SECTION 3: ÍNDICES PARA PERFORMANCE
-- =============================================================================

-- Índice principal por oferta (consulta más común)
CREATE INDEX IF NOT EXISTS idx_picking_events_offer_id 
ON public.picking_events(offer_id);

-- Índice por camionero
CREATE INDEX IF NOT EXISTS idx_picking_events_trucker_id 
ON public.picking_events(trucker_id);

-- Índice por tipo de evento
CREATE INDEX IF NOT EXISTS idx_picking_events_type 
ON public.picking_events(event_type);

-- Índice compuesto para búsquedas de timeline
CREATE INDEX IF NOT EXISTS idx_picking_events_timeline 
ON public.picking_events(offer_id, created_at DESC);

-- Índice para items específicos
CREATE INDEX IF NOT EXISTS idx_picking_events_item 
ON public.picking_events(offer_id, manifest_item_id);

-- =============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilitar RLS
ALTER TABLE public.picking_events ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay (para re-ejecución segura)
DROP POLICY IF EXISTS picking_events_insert_trucker ON public.picking_events;
DROP POLICY IF EXISTS picking_events_select_trucker ON public.picking_events;
DROP POLICY IF EXISTS picking_events_select_business ON public.picking_events;

-- Política: Camioneros pueden insertar eventos de sus viajes
CREATE POLICY picking_events_insert_trucker ON public.picking_events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        trucker_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.cargo_offers co
            WHERE co.id = offer_id
            AND co.assigned_trucker_id = auth.uid()
        )
    );

-- Política: Camioneros pueden ver eventos de sus viajes
CREATE POLICY picking_events_select_trucker ON public.picking_events
    FOR SELECT
    TO authenticated
    USING (
        trucker_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.cargo_offers co
            WHERE co.id = offer_id
            AND co.business_id = auth.uid()
        )
    );

-- Política: Empresas pueden ver eventos de sus ofertas
CREATE POLICY picking_events_select_business ON public.picking_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.cargo_offers co
            WHERE co.id = offer_id
            AND co.business_id = auth.uid()
        )
    );

-- =============================================================================
-- SECTION 5: FUNCIONES DE PICKING
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 Función: Registrar llegada a ubicación
-- Verifica GPS y registra llegada
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION register_arrival(
    p_offer_id UUID,
    p_trucker_id UUID,
    p_location_type VARCHAR(20), -- 'origin' o 'destination'
    p_latitude DECIMAL(10, 8),
    p_longitude DECIMAL(11, 8),
    p_accuracy_meters DECIMAL(8, 2) DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    distance_meters INTEGER,
    within_tolerance BOOLEAN
) AS $$
DECLARE
    v_offer RECORD;
    v_target_lat DECIMAL(10, 8);
    v_target_lng DECIMAL(11, 8);
    v_distance DECIMAL(10, 2);
    v_tolerance INTEGER;
    v_event_type VARCHAR(50);
    v_arrival_column TEXT;
    v_trucker_lat_column TEXT;
    v_trucker_lng_column TEXT;
BEGIN
    -- Obtener oferta
    SELECT * INTO v_offer FROM cargo_offers WHERE id = p_offer_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0, false;
        RETURN;
    END IF;
    
    -- Validar que es el camionero asignado
    IF v_offer.assigned_trucker_id != p_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta oferta'::TEXT, 0, false;
        RETURN;
    END IF;
    
    -- Determinar ubicación objetivo según tipo
    IF p_location_type = 'origin' THEN
        v_target_lat := v_offer.origin_latitude;
        v_target_lng := v_offer.origin_longitude;
        v_event_type := 'arrival_origin';
        
        -- Verificar que no haya llegado ya
        IF v_offer.arrived_at_origin_at IS NOT NULL THEN
            RETURN QUERY SELECT true, 'Ya habías registrado tu llegada al origen'::TEXT, 0, true;
            RETURN;
        END IF;
    ELSIF p_location_type = 'destination' THEN
        v_target_lat := v_offer.destination_latitude;
        v_target_lng := v_offer.destination_longitude;
        v_event_type := 'arrival_destination';
        
        -- Verificar que ya haya pasado por origen
        IF v_offer.pickup_verified_at IS NULL THEN
            RETURN QUERY SELECT false, 'Primero debes completar la carga en origen'::TEXT, 0, false;
            RETURN;
        END IF;
        
        -- Verificar que no haya llegado ya
        IF v_offer.arrived_at_destination_at IS NOT NULL THEN
            RETURN QUERY SELECT true, 'Ya habías registrado tu llegada al destino'::TEXT, 0, true;
            RETURN;
        END IF;
    ELSE
        RETURN QUERY SELECT false, 'Tipo de ubicación inválido'::TEXT, 0, false;
        RETURN;
    END IF;
    
    -- Obtener tolerancia
    v_tolerance := COALESCE(v_offer.gps_tolerance_meters, 500);
    
    -- Si no hay coordenadas configuradas, aceptar siempre (skip GPS check)
    IF v_target_lat IS NULL OR v_target_lng IS NULL THEN
        v_distance := 0;
    ELSE
        -- Calcular distancia usando fórmula Haversine (en metros)
        v_distance := 6371000 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(p_latitude - v_target_lat) / 2), 2) +
            COS(RADIANS(v_target_lat)) * COS(RADIANS(p_latitude)) *
            POWER(SIN(RADIANS(p_longitude - v_target_lng) / 2), 2)
        ));
    END IF;
    
    -- Registrar evento de llegada
    INSERT INTO picking_events (
        offer_id, trucker_id, event_type,
        latitude, longitude, accuracy_meters,
        notes, metadata
    ) VALUES (
        p_offer_id, p_trucker_id, v_event_type,
        p_latitude, p_longitude, p_accuracy_meters,
        CASE WHEN v_distance > v_tolerance 
            THEN format('Llegada registrada a %s metros de la ubicación esperada', v_distance::INTEGER)
            ELSE 'Llegada verificada correctamente'
        END,
        jsonb_build_object(
            'distance_meters', v_distance::INTEGER,
            'tolerance_meters', v_tolerance,
            'within_tolerance', v_distance <= v_tolerance
        )
    );
    
    -- Actualizar oferta con timestamp y coordenadas
    IF p_location_type = 'origin' THEN
        UPDATE cargo_offers SET
            arrived_at_origin_at = NOW(),
            trucker_origin_lat = p_latitude,
            trucker_origin_lng = p_longitude,
            updated_at = NOW()
        WHERE id = p_offer_id;
    ELSE
        UPDATE cargo_offers SET
            arrived_at_destination_at = NOW(),
            trucker_destination_lat = p_latitude,
            trucker_destination_lng = p_longitude,
            updated_at = NOW()
        WHERE id = p_offer_id;
    END IF;
    
    -- Retornar resultado
    RETURN QUERY SELECT 
        true,
        CASE WHEN v_distance <= v_tolerance 
            THEN '¡Ubicación verificada! Puedes iniciar.'::TEXT
            ELSE format('Registrado. Distancia: %s metros (tolerancia: %s metros)', v_distance::INTEGER, v_tolerance)::TEXT
        END,
        v_distance::INTEGER,
        v_distance <= v_tolerance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 5.2 Función: Registrar evento de picking (carga de item)
-- -----------------------------------------------------------------------------

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
BEGIN
    -- Obtener oferta con lock
    SELECT * INTO v_offer FROM cargo_offers WHERE id = p_offer_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Validar camionero
    IF v_offer.assigned_trucker_id != p_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta oferta'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Verificar que haya llegado al origen
    IF v_offer.arrived_at_origin_at IS NULL THEN
        RETURN QUERY SELECT false, 'Debes registrar tu llegada al origen primero'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Verificar que no esté ya verificado el pickup
    IF v_offer.pickup_verified_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 'La carga ya fue verificada. No puedes modificar el picking.'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Determinar tipo de evento
    v_event_type := CASE WHEN p_has_issue THEN 'item_load_issue' ELSE 'item_loaded' END;
    
    -- Insertar evento
    INSERT INTO picking_events (
        offer_id, trucker_id, event_type,
        manifest_item_id, manifest_item_name,
        quantity, item_status, notes, photo_urls,
        latitude, longitude
    ) VALUES (
        p_offer_id, p_trucker_id, v_event_type,
        p_item_id, p_item_name,
        p_quantity, 
        CASE WHEN p_has_issue THEN 'issue' ELSE 'loaded' END,
        p_notes, p_photo_urls,
        p_latitude, p_longitude
    );
    
    -- Actualizar manifest_items en la oferta
    UPDATE cargo_offers SET
        manifest_items = (
            SELECT jsonb_agg(
                CASE 
                    WHEN (item->>'id')::TEXT = p_item_id THEN
                        item || jsonb_build_object(
                            'loadedAt', NOW()::TEXT,
                            'loadedQty', p_quantity,
                            'loadNotes', COALESCE(p_notes, ''),
                            'loadPhotos', COALESCE(p_photo_urls, ARRAY[]::TEXT[]),
                            'hasIssue', p_has_issue
                        )
                    ELSE item
                END
            )
            FROM jsonb_array_elements(manifest_items) AS item
        ),
        manifest_loaded_count = manifest_loaded_count + 1,
        updated_at = NOW()
    WHERE id = p_offer_id;
    
    -- Obtener conteo actual
    SELECT manifest_loaded_count INTO v_current_loaded 
    FROM cargo_offers WHERE id = p_offer_id;
    
    RETURN QUERY SELECT 
        true, 
        format('Item "%s" registrado como cargado', p_item_name)::TEXT,
        v_current_loaded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 5.3 Función: Registrar entrega de item
-- -----------------------------------------------------------------------------

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
BEGIN
    -- Obtener oferta con lock
    SELECT * INTO v_offer FROM cargo_offers WHERE id = p_offer_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Validar camionero
    IF v_offer.assigned_trucker_id != p_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta oferta'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Verificar que haya llegado al destino
    IF v_offer.arrived_at_destination_at IS NULL THEN
        RETURN QUERY SELECT false, 'Debes registrar tu llegada al destino primero'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Verificar que no esté ya verificada la entrega
    IF v_offer.delivery_verified_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 'La entrega ya fue verificada. No puedes modificar.'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Si hay rechazados sin razón, requerir motivo
    IF p_rejected_qty > 0 AND (p_rejection_reason IS NULL OR p_rejection_reason = '') THEN
        RETURN QUERY SELECT false, 'Debes indicar el motivo del rechazo'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Si hay rechazados sin fotos, requerirlas
    IF p_rejected_qty > 0 AND (p_photo_urls IS NULL OR array_length(p_photo_urls, 1) IS NULL) THEN
        RETURN QUERY SELECT false, 'Debes agregar fotos como evidencia del rechazo'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Insertar evento de entrega
    IF p_delivered_qty > 0 THEN
        INSERT INTO picking_events (
            offer_id, trucker_id, event_type,
            manifest_item_id, manifest_item_name,
            quantity, item_status, notes,
            latitude, longitude
        ) VALUES (
            p_offer_id, p_trucker_id, 'item_delivered',
            p_item_id, p_item_name,
            p_delivered_qty, 'delivered', p_notes,
            p_latitude, p_longitude
        );
    END IF;
    
    -- Insertar evento de rechazo si aplica
    IF p_rejected_qty > 0 THEN
        INSERT INTO picking_events (
            offer_id, trucker_id, event_type,
            manifest_item_id, manifest_item_name,
            quantity, item_status, 
            notes, rejection_reason, photo_urls,
            latitude, longitude
        ) VALUES (
            p_offer_id, p_trucker_id, 'item_rejected',
            p_item_id, p_item_name,
            p_rejected_qty, 'rejected',
            p_notes, p_rejection_reason, p_photo_urls,
            p_latitude, p_longitude
        );
    END IF;
    
    -- Actualizar manifest_items en la oferta
    UPDATE cargo_offers SET
        manifest_items = (
            SELECT jsonb_agg(
                CASE 
                    WHEN (item->>'id')::TEXT = p_item_id THEN
                        item || jsonb_build_object(
                            'deliveredAt', NOW()::TEXT,
                            'deliveredQty', p_delivered_qty,
                            'rejectedQty', p_rejected_qty,
                            'rejectionReason', COALESCE(p_rejection_reason, ''),
                            'deliveryNotes', COALESCE(p_notes, ''),
                            'deliveryPhotos', COALESCE(p_photo_urls, ARRAY[]::TEXT[]),
                            'deliveryStatus', CASE 
                                WHEN p_rejected_qty = 0 THEN 'complete'
                                WHEN p_delivered_qty = 0 THEN 'rejected'
                                ELSE 'partial'
                            END
                        )
                    ELSE item
                END
            )
            FROM jsonb_array_elements(manifest_items) AS item
        ),
        manifest_delivered_count = manifest_delivered_count + p_delivered_qty,
        manifest_rejected_count = manifest_rejected_count + p_rejected_qty,
        updated_at = NOW()
    WHERE id = p_offer_id;
    
    -- Obtener conteos actuales
    SELECT manifest_delivered_count, manifest_rejected_count 
    INTO v_current_delivered, v_current_rejected
    FROM cargo_offers WHERE id = p_offer_id;
    
    RETURN QUERY SELECT 
        true, 
        format('Item "%s": %s entregados, %s rechazados', p_item_name, p_delivered_qty, p_rejected_qty)::TEXT,
        v_current_delivered,
        v_current_rejected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 5.4 Función: Agregar foto de evidencia general
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION add_trip_photo(
    p_offer_id UUID,
    p_trucker_id UUID,
    p_photo_url TEXT,
    p_photo_type VARCHAR(30), -- 'loading', 'unloading', 'general', 'issue'
    p_notes TEXT DEFAULT NULL,
    p_latitude DECIMAL(10, 8) DEFAULT NULL,
    p_longitude DECIMAL(11, 8) DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    total_photos INTEGER
) AS $$
DECLARE
    v_offer RECORD;
    v_new_photo JSONB;
    v_photo_count INTEGER;
BEGIN
    -- Obtener oferta
    SELECT * INTO v_offer FROM cargo_offers WHERE id = p_offer_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Validar camionero
    IF v_offer.assigned_trucker_id != p_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta oferta'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Construir objeto de foto
    v_new_photo := jsonb_build_object(
        'url', p_photo_url,
        'type', p_photo_type,
        'notes', COALESCE(p_notes, ''),
        'timestamp', NOW()::TEXT,
        'latitude', p_latitude,
        'longitude', p_longitude
    );
    
    -- Agregar foto al array
    UPDATE cargo_offers SET
        trip_photos = COALESCE(trip_photos, '[]'::JSONB) || v_new_photo,
        updated_at = NOW()
    WHERE id = p_offer_id;
    
    -- Insertar evento
    INSERT INTO picking_events (
        offer_id, trucker_id, event_type,
        notes, photo_urls, latitude, longitude,
        metadata
    ) VALUES (
        p_offer_id, p_trucker_id, 'photo_added',
        p_notes, ARRAY[p_photo_url], p_latitude, p_longitude,
        jsonb_build_object('photo_type', p_photo_type)
    );
    
    -- Contar fotos
    SELECT jsonb_array_length(trip_photos) INTO v_photo_count
    FROM cargo_offers WHERE id = p_offer_id;
    
    RETURN QUERY SELECT true, 'Foto agregada correctamente'::TEXT, v_photo_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SECTION 6: PERMISOS
-- =============================================================================

GRANT EXECUTE ON FUNCTION register_arrival TO authenticated;
GRANT EXECUTE ON FUNCTION register_item_loaded TO authenticated;
GRANT EXECUTE ON FUNCTION register_item_delivered TO authenticated;
GRANT EXECUTE ON FUNCTION add_trip_photo TO authenticated;

-- =============================================================================
-- SECTION 7: COMENTARIOS
-- =============================================================================

COMMENT ON FUNCTION register_arrival IS 
'Registra la llegada del camionero a origen o destino, verificando GPS';

COMMENT ON FUNCTION register_item_loaded IS 
'Registra un item como cargado al camión durante el picking de origen';

COMMENT ON FUNCTION register_item_delivered IS 
'Registra un item como entregado o rechazado durante el picking de destino';

COMMENT ON FUNCTION add_trip_photo IS 
'Agrega una foto de evidencia general al viaje';

-- =============================================================================
-- END MIGRATION 018
-- =============================================================================
