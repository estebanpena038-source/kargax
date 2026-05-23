-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 015: COMPLETE PAYMENT FLOW
-- Flujo completo: Aceptar Conductor → Pagar → Generar PINs → Viaje
-- =============================================================================

-- =============================================================================
-- FUNCIÓN MAESTRA: Aceptar aplicación y preparar para pago
-- Llamada cuando la empresa acepta un camionero
-- =============================================================================

CREATE OR REPLACE FUNCTION accept_application_for_payment(
    p_application_id UUID,
    p_business_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    offer_id UUID,
    payment_id UUID,
    total_to_pay DECIMAL,
    platform_fee DECIMAL,
    trucker_amount DECIMAL
) AS $$
DECLARE
    v_application RECORD;
    v_offer RECORD;
    v_payment_id UUID;
    v_platform_fee DECIMAL;
    v_total DECIMAL;
    v_platform_fee_percent DECIMAL := 10;
BEGIN
    -- Obtener aplicación
    SELECT * INTO v_application FROM offer_applications WHERE id = p_application_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Aplicación no encontrada'::TEXT, NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- Obtener oferta con lock
    SELECT * INTO v_offer FROM cargo_offers WHERE id = v_application.offer_id FOR UPDATE;
    
    -- Validar que es el dueño
    IF v_offer.business_id != p_business_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta oferta'::TEXT, NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- Validar estado
    IF v_offer.status != 'active' THEN
        RETURN QUERY SELECT false, 'La oferta no está activa'::TEXT, NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;
    
    IF v_application.status != 'pending' THEN
        RETURN QUERY SELECT false, 'La aplicación ya fue procesada'::TEXT, NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- Calcular montos
    v_platform_fee := ROUND(v_offer.total_amount * v_platform_fee_percent / 100, 2);
    v_total := v_offer.total_amount + v_platform_fee;
    
    -- Actualizar oferta con camionero asignado y montos
    UPDATE cargo_offers SET
        assigned_trucker_id = v_application.trucker_id,
        platform_fee = v_platform_fee,
        net_amount = v_offer.total_amount,
        status = 'active', -- Sigue activa hasta que pague
        updated_at = NOW()
    WHERE id = v_offer.id;
    
    -- Actualizar aplicación como aceptada
    UPDATE offer_applications SET
        status = 'accepted',
        responded_at = NOW(),
        business_response = 'Aceptado - Pendiente de pago',
        updated_at = NOW()
    WHERE id = p_application_id;
    
    -- Rechazar otras aplicaciones
    UPDATE offer_applications SET
        status = 'rejected',
        responded_at = NOW(),
        business_response = 'Otro conductor fue seleccionado',
        updated_at = NOW()
    WHERE offer_id = v_offer.id 
    AND id != p_application_id 
    AND status = 'pending';
    
    -- Crear registro de pago pendiente
    INSERT INTO payments (
        offer_id, payer_id, subtotal, platform_fee, total_amount, status
    ) VALUES (
        v_offer.id, p_business_id, v_offer.total_amount, v_platform_fee, v_total, 'pending'
    ) RETURNING id INTO v_payment_id;
    
    RETURN QUERY SELECT 
        true, 
        'Conductor aceptado. Procede al pago para confirmar.'::TEXT,
        v_offer.id,
        v_payment_id,
        v_total,
        v_platform_fee,
        v_offer.total_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCIÓN: Procesar pago exitoso (llamada desde webhook o frontend)
-- Genera PINs y activa el viaje
-- =============================================================================

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
    delivery_contact_phone VARCHAR
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
        RETURN QUERY SELECT false, 'Pago no encontrado'::TEXT, NULL::VARCHAR, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR;
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
            v_offer.delivery_contact_phone;
        RETURN;
    END IF;
    
    IF v_payment.status != 'pending' THEN
        RETURN QUERY SELECT false, 'Estado de pago inválido'::TEXT, NULL::VARCHAR, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR;
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
    
    -- Actualizar oferta con PINs y estado
    UPDATE cargo_offers SET
        pickup_pin = v_pickup_pin,
        delivery_pin = v_delivery_pin,
        status = 'in_progress',
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
    
    RETURN QUERY SELECT 
        true, 
        '¡Pago exitoso! PINs generados y enviados.'::TEXT,
        v_pickup_pin,
        v_delivery_pin,
        v_offer.id,
        v_offer.assigned_trucker_id,
        v_offer.pickup_contact_phone,
        v_offer.delivery_contact_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCIÓN: Obtener resumen de billetera
-- =============================================================================

CREATE OR REPLACE FUNCTION get_wallet_summary(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
    wallet_id UUID,
    pending_balance DECIMAL,
    available_balance DECIMAL,
    total_earned DECIMAL,
    total_withdrawn DECIMAL,
    total_trips_completed INTEGER,
    recent_transactions JSONB
) AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    RETURN QUERY
    SELECT 
        w.id,
        w.pending_balance,
        w.available_balance,
        w.total_earned,
        w.total_withdrawn,
        w.total_trips_completed,
        (
            SELECT COALESCE(jsonb_agg(row_to_json(t.*) ORDER BY t.created_at DESC), '[]'::jsonb)
            FROM (
                SELECT 
                    id, type, amount, description, created_at
                FROM transactions 
                WHERE wallet_id = w.id 
                ORDER BY created_at DESC 
                LIMIT 10
            ) t
        )
    FROM wallets w
    WHERE w.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCIÓN: Solicitar retiro (MVP: crea solicitud pendiente)
-- =============================================================================

CREATE OR REPLACE FUNCTION request_withdrawal(
    p_amount DECIMAL,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    withdrawal_id UUID 
) AS $$
DECLARE
    v_user_id UUID;
    v_wallet RECORD;
    v_transaction_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Obtener wallet con lock
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Billetera no encontrada'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    -- Validar monto mínimo
    IF p_amount < 50000 THEN
        RETURN QUERY SELECT false, 'Monto mínimo de retiro: $50,000'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    -- Validar saldo disponible
    IF v_wallet.available_balance < p_amount THEN
        RETURN QUERY SELECT false, format('Saldo insuficiente. Disponible: $%s', v_wallet.available_balance)::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    -- Validar datos bancarios
    IF v_wallet.bank_account_number IS NULL THEN
        RETURN QUERY SELECT false, 'Debes configurar tus datos bancarios primero'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    -- Restar del saldo
    UPDATE wallets SET
        available_balance = available_balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;
    
    -- Registrar transacción
    INSERT INTO transactions (
        wallet_id, type, amount, 
        balance_before, balance_after, description, status
    ) VALUES (
        v_wallet.id,
        'withdrawal',
        -p_amount,
        v_wallet.available_balance,
        v_wallet.available_balance - p_amount,
        format('Solicitud de retiro a cuenta %s', RIGHT(v_wallet.bank_account_number, 4)),
        'pending'
    ) RETURNING id INTO v_transaction_id;
    
    RETURN QUERY SELECT 
        true, 
        'Solicitud de retiro enviada. Se procesará en 24-48 horas.'::TEXT,
        v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGER: Notificar en tiempo real cuando cambia wallet
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_wallet_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Usa Supabase Realtime para notificar cambios
    PERFORM pg_notify(
        'wallet_updates',
        json_build_object(
            'user_id', NEW.user_id,
            'available_balance', NEW.available_balance,
            'pending_balance', NEW.pending_balance
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_wallet_realtime ON public.wallets;
CREATE TRIGGER trigger_wallet_realtime
    AFTER UPDATE ON public.wallets
    FOR EACH ROW
    EXECUTE FUNCTION notify_wallet_change();

-- =============================================================================
-- COMENTARIOS
-- =============================================================================

COMMENT ON FUNCTION accept_application_for_payment IS 'Acepta aplicación de camionero y prepara para pago';
COMMENT ON FUNCTION process_successful_payment IS 'Procesa pago exitoso, genera PINs y activa viaje';
COMMENT ON FUNCTION get_wallet_summary IS 'Obtiene resumen de billetera con transacciones recientes';
COMMENT ON FUNCTION request_withdrawal IS 'Solicita retiro de fondos disponibles';
