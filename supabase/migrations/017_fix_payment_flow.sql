-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 017: FIX PAYMENT FLOW
-- 
-- Este archivo corrige el flujo de pago para que funcione correctamente:
-- 
-- PROBLEMA ORIGINAL:
-- - `accept_application_with_message` (009) cambiaba estado a `in_progress` SIN pago
-- - `accept_application_for_payment` (015) era correcta pero NO se usaba
-- - `create_payment` (012) era redundante con la de 015
--
-- SOLUCIÓN:
-- - `accept_application_with_message` ahora cambia a `accepted` (no `in_progress`)
-- - El estado `in_progress` SOLO se alcanza después de `process_successful_payment`
-- - Nueva función `prepare_offer_for_payment` unifica el flujo
--
-- =============================================================================

-- =============================================================================
-- 1. FIX: accept_application_with_message 
--    Ahora solo acepta la aplicación, NO cambia estado a in_progress
-- =============================================================================

CREATE OR REPLACE FUNCTION accept_application_with_message(
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
    -- 1. Get application details and validate
    SELECT trucker_id INTO v_trucker_id
    FROM offer_applications
    WHERE id = p_application_id AND offer_id = p_offer_id;
    
    IF v_trucker_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Aplicación no encontrada'
        );
    END IF;
    
    -- 2. Get business ID from offer
    SELECT business_id, status INTO v_business_id, v_offer_status
    FROM cargo_offers
    WHERE id = p_offer_id;
    
    IF v_business_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Oferta no encontrada'
        );
    END IF;
    
    -- 3. Validate offer is still active (not already in_progress or completed)
    IF v_offer_status NOT IN ('active', 'draft') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La oferta ya fue procesada'
        );
    END IF;
    
    -- 4. Update application status to 'accepted' (NOT the offer status!)
    UPDATE offer_applications
    SET 
        status = 'accepted',
        business_response = COALESCE(p_business_response, 'Aceptado'),
        responded_at = NOW()
    WHERE id = p_application_id;
    
    -- 5. CRITICAL FIX: Assign trucker but keep status as 'active' 
    --    Status changes to 'in_progress' ONLY after payment is confirmed
    UPDATE cargo_offers
    SET 
        assigned_trucker_id = v_trucker_id,
        -- status = 'accepted_pending_payment', -- Optional: new status for clarity
        updated_at = NOW()
    WHERE id = p_offer_id;
    
    -- 6. Reject other pending applications
    UPDATE offer_applications
    SET 
        status = 'rejected',
        business_response = 'Otro transportador fue seleccionado',
        responded_at = NOW()
    WHERE offer_id = p_offer_id 
    AND id != p_application_id 
    AND status = 'pending';
    
    -- 7. Calculate participant order for conversation (alphabetical by UUID for consistency)
    SELECT 
        CASE WHEN v_business_id < v_trucker_id THEN v_business_id ELSE v_trucker_id END,
        CASE WHEN v_business_id < v_trucker_id THEN v_trucker_id ELSE v_business_id END
    INTO v_p1_id, v_p2_id;
    
    -- 8. Get or create conversation for this specific offer
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE participant1_id = v_p1_id 
      AND participant2_id = v_p2_id 
      AND offer_id = p_offer_id;
    
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (participant1_id, participant2_id, offer_id)
        VALUES (v_p1_id, v_p2_id, p_offer_id)
        RETURNING id INTO v_conversation_id;
    END IF;
    
    -- 9. Insert the message
    INSERT INTO messages (conversation_id, sender_id, content, message_type)
    VALUES (v_conversation_id, v_business_id, p_message_content, 'text')
    RETURNING id INTO v_message_id;
    
    -- 10. Create notification for trucker about acceptance
    PERFORM create_notification(
        v_trucker_id,
        'application_accepted',
        '¡Tu postulación fue aceptada!',
        'Has sido seleccionado para un viaje. Esperando confirmación de pago.',
        jsonb_build_object(
            'offer_id', p_offer_id,
            'application_id', p_application_id
        )
    );
    
    -- 11. Return success with all IDs
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'applicationId', p_application_id,
            'conversationId', v_conversation_id,
            'messageId', v_message_id,
            'truckerId', v_trucker_id,
            'requiresPayment', true  -- Flag to indicate payment is needed
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- =============================================================================
-- 2. NEW: prepare_offer_for_payment
--    Single function that prepares everything for payment
--    Called by create-preference API
-- =============================================================================

CREATE OR REPLACE FUNCTION prepare_offer_for_payment(
    p_offer_id UUID,
    p_application_id UUID,
    p_business_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    payment_id UUID,
    trucker_id UUID,
    total_amount DECIMAL,
    platform_fee DECIMAL,
    trucker_amount DECIMAL,
    pickup_contact_name TEXT,
    pickup_contact_phone TEXT,
    delivery_contact_name TEXT,
    delivery_contact_phone TEXT
) AS $$
DECLARE
    v_offer RECORD;
    v_application RECORD;
    v_payment_id UUID;
    v_platform_fee DECIMAL;
    v_total DECIMAL;
    v_platform_fee_percent DECIMAL := 10;
    v_existing_payment_id UUID;
BEGIN
    -- 1. Get offer with FOR UPDATE lock to prevent race conditions
    SELECT * INTO v_offer 
    FROM cargo_offers 
    WHERE id = p_offer_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            false, 'Oferta no encontrada'::TEXT, 
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    -- 2. Validate business owns the offer
    IF v_offer.business_id != p_business_id THEN
        RETURN QUERY SELECT 
            false, 'No tienes permiso para esta oferta'::TEXT, 
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    -- 3. Validate offer status (active or already has assigned trucker waiting for payment)
    IF v_offer.status NOT IN ('active') THEN
        -- Check if there's already a pending payment
        SELECT id INTO v_existing_payment_id
        FROM payments
        WHERE offer_id = p_offer_id AND status = 'pending';
        
        IF v_existing_payment_id IS NOT NULL THEN
            -- Return the existing payment
            SELECT * INTO v_offer FROM cargo_offers WHERE id = p_offer_id;
            v_platform_fee := COALESCE(v_offer.platform_fee, ROUND(v_offer.total_amount * v_platform_fee_percent / 100, 2));
            v_total := v_offer.total_amount + v_platform_fee;
            
            RETURN QUERY SELECT 
                true, 
                'Pago pendiente encontrado'::TEXT,
                v_existing_payment_id,
                v_offer.assigned_trucker_id,
                v_total,
                v_platform_fee,
                v_offer.total_amount,
                v_offer.pickup_contact_name::TEXT,
                v_offer.pickup_contact_phone::TEXT,
                v_offer.delivery_contact_name::TEXT,
                v_offer.delivery_contact_phone::TEXT;
            RETURN;
        END IF;
        
        RETURN QUERY SELECT 
            false, 'La oferta no está disponible para pago'::TEXT, 
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    -- 4. Get and validate application
    SELECT * INTO v_application 
    FROM offer_applications 
    WHERE id = p_application_id AND offer_id = p_offer_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            false, 'Postulación no encontrada'::TEXT, 
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    -- Application must be pending or already accepted (before payment)
    IF v_application.status NOT IN ('pending', 'accepted') THEN
        RETURN QUERY SELECT 
            false, 'Esta postulación ya fue procesada'::TEXT, 
            NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    -- 5. Calculate amounts
    v_platform_fee := ROUND(v_offer.total_amount * v_platform_fee_percent / 100, 2);
    v_total := v_offer.total_amount + v_platform_fee;
    
    -- 6. Accept the application if not already accepted
    IF v_application.status = 'pending' THEN
        UPDATE offer_applications 
        SET 
            status = 'accepted',
            business_response = 'Seleccionado para pago',
            responded_at = NOW(),
            updated_at = NOW()
        WHERE id = p_application_id;
        
        -- Reject other pending applications
        UPDATE offer_applications 
        SET 
            status = 'rejected',
            business_response = 'Otro transportador fue seleccionado',
            responded_at = NOW()
        WHERE offer_id = p_offer_id 
        AND id != p_application_id 
        AND status = 'pending';
    END IF;
    
    -- 7. Update offer with trucker assignment and fees
    UPDATE cargo_offers 
    SET 
        assigned_trucker_id = v_application.trucker_id,
        platform_fee = v_platform_fee,
        net_amount = v_offer.total_amount,
        updated_at = NOW()
    WHERE id = p_offer_id;
    
    -- 8. Create or get pending payment record
    SELECT id INTO v_existing_payment_id
    FROM payments
    WHERE offer_id = p_offer_id AND status IN ('pending', 'completed');
    
    IF v_existing_payment_id IS NULL THEN
        INSERT INTO payments (
            offer_id, 
            payer_id, 
            subtotal, 
            platform_fee, 
            total_amount, 
            status
        ) VALUES (
            p_offer_id, 
            p_business_id, 
            v_offer.total_amount, 
            v_platform_fee, 
            v_total, 
            'pending'
        ) RETURNING id INTO v_payment_id;
    ELSE
        v_payment_id := v_existing_payment_id;
    END IF;
    
    -- 9. Refresh offer data for return values
    SELECT * INTO v_offer FROM cargo_offers WHERE id = p_offer_id;
    
    -- 10. Return success with all data needed for payment preference
    RETURN QUERY SELECT 
        true, 
        'Oferta preparada para pago'::TEXT,
        v_payment_id,
        v_application.trucker_id,
        v_total,
        v_platform_fee,
        v_offer.total_amount,
        v_offer.pickup_contact_name::TEXT,
        v_offer.pickup_contact_phone::TEXT,
        v_offer.delivery_contact_name::TEXT,
        v_offer.delivery_contact_phone::TEXT;
        
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        false, SQLERRM::TEXT, 
        NULL::UUID, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
        NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION accept_application_with_message TO authenticated;
GRANT EXECUTE ON FUNCTION prepare_offer_for_payment TO authenticated;

-- =============================================================================
-- 4. COMMENTS
-- =============================================================================

COMMENT ON FUNCTION accept_application_with_message IS 
'Acepta una postulación y crea conversación. NO cambia estado a in_progress - eso requiere pago.';

COMMENT ON FUNCTION prepare_offer_for_payment IS 
'Prepara una oferta para pago: acepta aplicación, crea registro de pago pendiente, retorna datos para preferencia MP.';

-- =============================================================================
-- END MIGRATION 017
-- =============================================================================
