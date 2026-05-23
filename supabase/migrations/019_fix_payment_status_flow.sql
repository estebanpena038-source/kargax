-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 019: FIX PAYMENT STATUS FLOW
-- Fixes: After payment, status should be 'reserved' not 'in_progress'
-- 
-- Correct flow:
-- 1. Payment confirmed → status = 'reserved' (Reservada/Pagada)
-- 2. Pickup PIN verified → status = 'in_progress' (En Tránsito)
-- 3. Delivery PIN verified → status = 'completed' (Entregada)
-- =============================================================================

-- IMPORTANT: Drop the existing function first because we're changing the return type
DROP FUNCTION IF EXISTS process_successful_payment(UUID, VARCHAR, JSONB);

-- Update the process_successful_payment function to use 'reserved' status
CREATE OR REPLACE FUNCTION process_successful_payment(
    p_payment_id UUID,
    p_external_id VARCHAR DEFAULT NULL,
    p_gateway_response JSONB DEFAULT '{}'
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
) AS $$
DECLARE
    v_payment RECORD;
    v_offer RECORD;
    v_pickup_pin VARCHAR(4);
    v_delivery_pin VARCHAR(4);
    v_wallet_id UUID;
BEGIN
    -- Obtener pago con lock
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            false, 
            'Pago no encontrado'::TEXT, 
            NULL::VARCHAR, NULL::VARCHAR, NULL::UUID, NULL::UUID, 
            NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;
    
    IF v_payment.status = 'completed' THEN
        -- Ya procesado, retornar los PINs existentes
        SELECT * INTO v_offer FROM cargo_offers WHERE id = v_payment.offer_id;
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
    
    IF v_payment.status != 'pending' THEN
        RETURN QUERY SELECT 
            false, 
            'Estado de pago inválido'::TEXT, 
            NULL::VARCHAR, NULL::VARCHAR, NULL::UUID, NULL::UUID, 
            NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Obtener oferta
    SELECT * INTO v_offer FROM cargo_offers WHERE id = v_payment.offer_id FOR UPDATE;
    
    -- Generar PINs únicos
    v_pickup_pin := generate_secure_pin();
    v_delivery_pin := generate_secure_pin();
    WHILE v_delivery_pin = v_pickup_pin LOOP
        v_delivery_pin := generate_secure_pin();
    END LOOP;
    
    -- Actualizar pago como completado
    UPDATE payments SET
        status = 'completed',
        external_id = p_external_id,
        gateway_response = p_gateway_response,
        completed_at = NOW()
    WHERE id = p_payment_id;
    
    -- ==========================================================================
    -- FIX: Use 'reserved' status instead of 'in_progress'
    -- The offer transitions to 'in_progress' ONLY after pickup PIN is verified
    -- ==========================================================================
    UPDATE cargo_offers SET
        pickup_pin = v_pickup_pin,
        delivery_pin = v_delivery_pin,
        status = 'reserved',  -- FIXED: was 'in_progress'
        updated_at = NOW()
    WHERE id = v_offer.id;
    
    -- Agregar dinero a pending_balance del camionero
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_offer.assigned_trucker_id;
    
    IF v_wallet_id IS NOT NULL THEN
        UPDATE wallets SET
            pending_balance = pending_balance + v_payment.subtotal,
            updated_at = NOW()
        WHERE id = v_wallet_id;
        
        -- Registrar transacción
        INSERT INTO transactions (
            wallet_id, offer_id, type, amount,
            balance_before, balance_after, description
        ) VALUES (
            v_wallet_id,
            v_offer.id,
            'trip_pending',
            v_payment.subtotal,
            (SELECT pending_balance - v_payment.subtotal FROM wallets WHERE id = v_wallet_id),
            (SELECT pending_balance FROM wallets WHERE id = v_wallet_id),
            format('Pago asegurado para viaje #%s', LEFT(v_offer.id::TEXT, 8))
        );
    END IF;
    
    -- Return all contact info for SMS notifications
    RETURN QUERY SELECT 
        true, 
        '¡Pago exitoso! PINs generados. Carga reservada.'::TEXT,
        v_pickup_pin,
        v_delivery_pin,
        v_offer.id,
        v_offer.assigned_trucker_id,
        v_offer.pickup_contact_phone,
        v_offer.pickup_contact_name,
        v_offer.delivery_contact_phone,
        v_offer.delivery_contact_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Add 'reserved' to valid offer statuses if not already there
-- =============================================================================

-- Update any existing offers that were incorrectly set to 'in_progress' after payment
-- but haven't had their pickup PIN verified yet
UPDATE cargo_offers 
SET status = 'reserved', updated_at = NOW()
WHERE status = 'in_progress' 
  AND pickup_pin IS NOT NULL 
  AND pickup_verified_at IS NULL;

COMMENT ON FUNCTION process_successful_payment IS 
'Procesa pago exitoso, genera PINs. Status cambia a "reserved" hasta verificar PIN de recogida.';

-- =============================================================================
-- UPDATE verify_pickup_pin TO ACCEPT 'reserved' STATUS
-- After payment, the offer is 'reserved' not 'in_progress'
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
    
    -- Verificar estado correcto: 'reserved' (after payment) or 'in_progress' are valid
    IF v_offer.status NOT IN ('reserved', 'in_progress', 'active') AND v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT false, 'La oferta no está en estado válido para pickup'::TEXT, v_offer.status::TEXT;
        RETURN;
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
    
    -- ¡PIN correcto! Actualizar estado a in_progress (now starting transit)
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

COMMENT ON FUNCTION verify_pickup_pin IS 'Verifica PIN de pickup e inicia el viaje (reserved -> in_progress)';

-- =============================================================================
-- GRANT EXECUTE PERMISSIONS
-- Sin esto, los usuarios autenticados no pueden llamar a las funciones!
-- =============================================================================

GRANT EXECUTE ON FUNCTION process_successful_payment TO authenticated;
GRANT EXECUTE ON FUNCTION process_successful_payment TO service_role;

GRANT EXECUTE ON FUNCTION verify_pickup_pin TO authenticated;
GRANT EXECUTE ON FUNCTION verify_pickup_pin TO service_role;
