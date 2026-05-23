-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 014: PIN VERIFICATION SYSTEM
-- Stored procedures para verificación segura de PINs
-- El corazón del sistema de handshake
-- =============================================================================

-- =============================================================================
-- CONSTANTES
-- =============================================================================

    -- Máximo de intentos de PIN antes de bloquear
    DO $$ BEGIN
        PERFORM set_config('app.max_pin_attempts', '5', false);
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;

    -- =============================================================================
    -- FUNCIÓN: Verificar PIN de Recogida (Pickup)
    -- Llamada cuando el conductor ingresa el PIN en origen
    -- =============================================================================

    CREATE OR REPLACE FUNCTION verify_pickup_pin(
        p_offer_id UUID,
        p_input_pin VARCHAR(6),
        p_trucker_id UUID DEFAULT NULL
    )
    RETURNS TABLE(
        success BOOLEAN,
        message TEXT,
        offer_status TEXT
    ) AS $$
    DECLARE
        v_offer RECORD;
        v_max_attempts INTEGER := 5;
    BEGIN
        -- Obtener oferta con lock para evitar race conditions
        SELECT * INTO v_offer 
        FROM cargo_offers 
        WHERE id = p_offer_id
        FOR UPDATE;
        
        -- Validaciones básicas
        IF NOT FOUND THEN
            RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, NULL::TEXT;
            RETURN;
        END IF;
        
        -- Verificar que el camionero es el asignado
        IF p_trucker_id IS NOT NULL AND v_offer.assigned_trucker_id != p_trucker_id THEN
            RETURN QUERY SELECT false, 'No tienes permiso para esta operación'::TEXT, v_offer.status::TEXT;
            RETURN;
        END IF;
        
        -- Verificar estado correcto (must be 'reserved' after payment or 'in_progress')
        IF v_offer.status NOT IN ('reserved', 'in_progress') AND v_offer.pickup_verified_at IS NULL THEN
            -- If in another state that allows pickup
            IF v_offer.status NOT IN ('active') THEN
                RETURN QUERY SELECT false, 'La oferta no está en estado válido para pickup'::TEXT, v_offer.status::TEXT;
                RETURN;
            END IF;
        END IF;
        
        -- Ya fue verificado
        IF v_offer.pickup_verified_at IS NOT NULL THEN
            RETURN QUERY SELECT false, 'El pickup ya fue verificado'::TEXT, v_offer.status::TEXT;
            RETURN;
        END IF;
        
        -- Verificar límite de intentos
        IF v_offer.pin_attempts >= v_max_attempts THEN
            RETURN QUERY SELECT false, 'Demasiados intentos fallidos. Contacta soporte.'::TEXT, v_offer.status::TEXT;
            RETURN;
        END IF;
        
        -- Verificar PIN
        IF v_offer.pickup_pin IS NULL THEN
            RETURN QUERY SELECT false, 'PIN de pickup no ha sido generado'::TEXT, v_offer.status::TEXT;
            RETURN;
        END IF;
        
        IF UPPER(TRIM(v_offer.pickup_pin)) != UPPER(TRIM(p_input_pin)) THEN
            -- Incrementar intentos fallidos
            UPDATE cargo_offers SET
                pin_attempts = pin_attempts + 1,
                updated_at = NOW()
            WHERE id = p_offer_id;
            
            RETURN QUERY SELECT 
                false, 
                format('PIN incorrecto. Intentos restantes: %s', v_max_attempts - v_offer.pin_attempts - 1)::TEXT,
                v_offer.status::TEXT;
            RETURN;
        END IF;
        
        -- ¡PIN correcto! Actualizar estado
        UPDATE cargo_offers SET
            status = 'in_progress',
            pickup_verified_at = NOW(),
            pin_attempts = 0, -- Reset intentos
            updated_at = NOW()
        WHERE id = p_offer_id;
        
        RETURN QUERY SELECT 
            true, 
            '¡Pickup verificado! Viaje iniciado correctamente.'::TEXT,
            'in_progress'::TEXT;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- =============================================================================
    -- FUNCIÓN: Verificar PIN de Entrega (Delivery)
    -- Llamada cuando el conductor ingresa el PIN en destino
    -- ¡Libera el pago automáticamente!
    -- =============================================================================

    CREATE OR REPLACE FUNCTION verify_delivery_pin(
        p_offer_id UUID,
        p_input_pin VARCHAR(6),
        p_trucker_id UUID DEFAULT NULL
    )
    RETURNS TABLE(
        success BOOLEAN,
        message TEXT,
        amount_released DECIMAL
    ) AS $$
    DECLARE
        v_offer RECORD;
        v_wallet_id UUID;
        v_max_attempts INTEGER := 5;
    BEGIN
        -- Obtener oferta con lock
        SELECT * INTO v_offer 
        FROM cargo_offers 
        WHERE id = p_offer_id
        FOR UPDATE;
        
        -- Validaciones básicas
        IF NOT FOUND THEN
            RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;
        
        -- Verificar que el camionero es el asignado
        IF p_trucker_id IS NOT NULL AND v_offer.assigned_trucker_id != p_trucker_id THEN
            RETURN QUERY SELECT false, 'No tienes permiso para esta operación'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;
        
        -- Verificar que pickup fue verificado
        IF v_offer.pickup_verified_at IS NULL THEN
            RETURN QUERY SELECT false, 'Primero debes verificar el pickup'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;
        
        -- Verificar estado correcto
        IF v_offer.status != 'in_progress' THEN
            RETURN QUERY SELECT false, 'La oferta no está en tránsito'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;
        
        -- Ya fue verificado
        IF v_offer.delivery_verified_at IS NOT NULL THEN
            RETURN QUERY SELECT false, 'La entrega ya fue verificada'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;
        
        -- Verificar límite de intentos
        IF v_offer.pin_attempts >= v_max_attempts THEN
            RETURN QUERY SELECT false, 'Demasiados intentos fallidos. Contacta soporte.'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;
        
        -- Verificar PIN
        IF v_offer.delivery_pin IS NULL THEN
            RETURN QUERY SELECT false, 'PIN de entrega no ha sido generado'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;
        
        IF UPPER(TRIM(v_offer.delivery_pin)) != UPPER(TRIM(p_input_pin)) THEN
            -- Incrementar intentos fallidos
            UPDATE cargo_offers SET
                pin_attempts = pin_attempts + 1,
                updated_at = NOW()
            WHERE id = p_offer_id;
            
            RETURN QUERY SELECT 
                false, 
                format('PIN incorrecto. Intentos restantes: %s', v_max_attempts - v_offer.pin_attempts - 1)::TEXT,
                0::DECIMAL;
            RETURN;
        END IF;
        
        -- Obtener wallet del camionero
        SELECT id INTO v_wallet_id
        FROM wallets 
        WHERE user_id = v_offer.assigned_trucker_id;
        
        IF v_wallet_id IS NULL THEN
            RETURN QUERY SELECT false, 'Billetera del camionero no encontrada'::TEXT, 0::DECIMAL;
            RETURN;
        END IF;
        
        -- ¡PIN correcto! Mover dinero de pending a available
        UPDATE wallets SET
            pending_balance = pending_balance - COALESCE(v_offer.net_amount, v_offer.total_amount),
            available_balance = available_balance + COALESCE(v_offer.net_amount, v_offer.total_amount),
            total_earned = total_earned + COALESCE(v_offer.net_amount, v_offer.total_amount),
            total_trips_completed = total_trips_completed + 1,
            updated_at = NOW()
        WHERE id = v_wallet_id;
        
        -- Registrar transacción
        INSERT INTO transactions (
            wallet_id, offer_id, type, amount,
            balance_before, balance_after, description
        ) VALUES (
            v_wallet_id,
            p_offer_id,
            'trip_deposit',
            COALESCE(v_offer.net_amount, v_offer.total_amount),
            (SELECT available_balance - COALESCE(v_offer.net_amount, v_offer.total_amount) FROM wallets WHERE id = v_wallet_id),
            (SELECT available_balance FROM wallets WHERE id = v_wallet_id),
            format('Pago liberado por viaje #%s', LEFT(p_offer_id::TEXT, 8))
        );
        
        -- Actualizar oferta como completada
        UPDATE cargo_offers SET
            status = 'completed',
            delivery_verified_at = NOW(),
            pin_attempts = 0,
            updated_at = NOW()
        WHERE id = p_offer_id;
        
        -- Actualizar estadísticas del camionero
        UPDATE trucker_profiles SET
            total_trips = total_trips + 1,
            updated_at = NOW()
        WHERE user_id = v_offer.assigned_trucker_id;
        
        -- Actualizar estadísticas del negocio
        UPDATE business_profiles SET
            total_shipments = total_shipments + 1,
            updated_at = NOW()
        WHERE user_id = v_offer.business_id;
        
        RETURN QUERY SELECT 
            true, 
            '¡Viaje completado! El pago ha sido liberado a tu billetera.'::TEXT,
            COALESCE(v_offer.net_amount, v_offer.total_amount);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- =============================================================================
    -- FUNCIÓN: Obtener estado del viaje para el conductor
    -- =============================================================================

    CREATE OR REPLACE FUNCTION get_trip_status(p_offer_id UUID)
    RETURNS TABLE(
        offer_id UUID,
        status TEXT,
        pickup_verified BOOLEAN,
        delivery_verified BOOLEAN,
        pickup_verified_at TIMESTAMPTZ,
        delivery_verified_at TIMESTAMPTZ,
        pickup_contact_name VARCHAR,
        pickup_contact_phone VARCHAR,
        pickup_address VARCHAR,
        delivery_contact_name VARCHAR,
        delivery_contact_phone VARCHAR,
        delivery_address VARCHAR,
        manifest_items JSONB,
        amount DECIMAL
    ) AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            co.id,
            co.status::TEXT,
            co.pickup_verified_at IS NOT NULL,
            co.delivery_verified_at IS NOT NULL,
            co.pickup_verified_at,
            co.delivery_verified_at,
            co.pickup_contact_name,
            co.pickup_contact_phone,
            co.origin_address,
            co.delivery_contact_name,
            co.delivery_contact_phone,
            co.destination_address,
            co.manifest_items,
            COALESCE(co.net_amount, co.total_amount)
        FROM cargo_offers co
        WHERE co.id = p_offer_id
        AND (co.assigned_trucker_id = auth.uid() OR co.business_id = auth.uid());
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- =============================================================================
    -- COMENTARIOS
    -- =============================================================================

    COMMENT ON FUNCTION verify_pickup_pin IS 'Verifica PIN de pickup e inicia el viaje';
    COMMENT ON FUNCTION verify_delivery_pin IS 'Verifica PIN de entrega y libera el pago al camionero';
    COMMENT ON FUNCTION get_trip_status IS 'Obtiene estado actual del viaje para la vista del conductor';

    -- =============================================================================
    -- GRANT EXECUTE PERMISSIONS
    -- Sin esto, los usuarios autenticados no pueden llamar a las funciones!
    -- =============================================================================

    GRANT EXECUTE ON FUNCTION verify_pickup_pin TO authenticated;
    GRANT EXECUTE ON FUNCTION verify_pickup_pin TO service_role;

    GRANT EXECUTE ON FUNCTION verify_delivery_pin TO authenticated;
    GRANT EXECUTE ON FUNCTION verify_delivery_pin TO service_role;

    GRANT EXECUTE ON FUNCTION get_trip_status TO authenticated;
    GRANT EXECUTE ON FUNCTION get_trip_status TO service_role;
