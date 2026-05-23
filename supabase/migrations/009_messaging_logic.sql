-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 009: MESSAGING LOGIC ENHANCEMENTS
-- Enables offer-specific conversations and atomic accept+message flow
-- =============================================================================

-- =============================================================================
-- 1. UPDATE CONVERSATIONS UNIQUE CONSTRAINT
-- Drop the old unique constraint that prevents multiple chats per user pair
-- Add new constraint that allows ONE chat per (user_pair + offer)
-- =============================================================================

-- Make offer_id NOT NULL for new conversations (existing ones remain as-is)
-- We WON'T make it NOT NULL to preserve backwards compatibility

-- Drop old unique constraint
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_participant1_id_participant2_id_key;

-- Add new unique constraint including offer_id
-- This allows the same two users to have separate chats for different offers
-- NULL offer_id is treated uniquely (generic chat)
ALTER TABLE public.conversations 
ADD CONSTRAINT conversations_participants_offer_key 
UNIQUE (participant1_id, participant2_id, offer_id);

-- =============================================================================
-- 2. RPC FUNCTION: Accept Application with Message (Atomic Transaction)
-- This function performs the entire acceptance flow in one atomic operation
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
    SELECT business_id INTO v_business_id
    FROM cargo_offers
    WHERE id = p_offer_id;
    
    IF v_business_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Oferta no encontrada'
        );
    END IF;
    
    -- 3. Update application status to 'accepted'
    UPDATE offer_applications
    SET 
        status = 'accepted',
        business_response = COALESCE(p_business_response, 'Aceptado'),
        responded_at = NOW()
    WHERE id = p_application_id;
    
    -- 4. Update offer status and assign trucker
    UPDATE cargo_offers
    SET 
        status = 'in_progress',
        assigned_trucker_id = v_trucker_id,
        updated_at = NOW()
    WHERE id = p_offer_id;
    
    -- 5. Calculate participant order for conversation (alphabetical by UUID for consistency)
    SELECT 
        CASE WHEN v_business_id < v_trucker_id THEN v_business_id ELSE v_trucker_id END,
        CASE WHEN v_business_id < v_trucker_id THEN v_trucker_id ELSE v_business_id END
    INTO v_p1_id, v_p2_id;
    
    -- 6. Get or create conversation for this specific offer
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
    
    -- 7. Insert the message
    INSERT INTO messages (conversation_id, sender_id, content, message_type)
    VALUES (v_conversation_id, v_business_id, p_message_content, 'text')
    RETURNING id INTO v_message_id;
    
    -- 8. Return success with all IDs
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'applicationId', p_application_id,
            'conversationId', v_conversation_id,
            'messageId', v_message_id,
            'truckerId', v_trucker_id
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION accept_application_with_message TO authenticated;

-- =============================================================================
-- 3. UPDATE getOrCreateConversation to support offer_id in query
-- The TypeScript code will be updated separately
-- =============================================================================

-- Index for faster lookup with offer_id
CREATE INDEX IF NOT EXISTS idx_conversations_participants_offer 
ON public.conversations(participant1_id, participant2_id, offer_id);

-- =============================================================================
-- 4. ENABLE REALTIME FOR MESSAGES (if not already)
-- =============================================================================

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 5. ADD NOTIFICATION TRIGGER FOR NEW MESSAGES
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conversation RECORD;
    v_sender_name TEXT;
    v_recipient_id UUID;
BEGIN
    -- Get conversation details
    SELECT * INTO v_conversation
    FROM conversations
    WHERE id = NEW.conversation_id;
    
    IF v_conversation IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get sender name
    SELECT raw_user_meta_data->>'full_name' INTO v_sender_name
    FROM auth.users
    WHERE id = NEW.sender_id;
    
    v_sender_name := COALESCE(v_sender_name, 'Alguien');
    
    -- Determine recipient (the other participant)
    IF NEW.sender_id = v_conversation.participant1_id THEN
        v_recipient_id := v_conversation.participant2_id;
    ELSE
        v_recipient_id := v_conversation.participant1_id;
    END IF;
    
    -- Create notification for recipient
    PERFORM create_notification(
        v_recipient_id,
        'new_message',
        'Nuevo mensaje de ' || v_sender_name,
        LEFT(NEW.content, 100),
        jsonb_build_object(
            'conversation_id', NEW.conversation_id,
            'message_id', NEW.id,
            'sender_id', NEW.sender_id,
            'offer_id', v_conversation.offer_id
        )
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_message();
