-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 007: MESSAGES
-- Mensajes individuales entre usuarios
-- =============================================================================

-- =============================================================================
-- MESSAGE TYPES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Conversation
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    
    -- Sender
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    message_type message_type NOT NULL DEFAULT 'text',
    
    -- Read status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Attachments (optional)
    attachment_url TEXT,
    attachment_name VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(conversation_id, is_read) WHERE is_read = FALSE;

-- =============================================================================
-- TRIGGER: Actualizar conversación al enviar mensaje
-- =============================================================================

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
DECLARE
    v_p1_id UUID;
    v_p2_id UUID;
BEGIN
    -- Obtener participantes
    SELECT participant1_id, participant2_id INTO v_p1_id, v_p2_id
    FROM public.conversations WHERE id = NEW.conversation_id;
    
    -- Actualizar preview y timestamp
    UPDATE public.conversations SET
        last_message_preview = LEFT(NEW.content, 200),
        last_message_at = NOW(),
        -- Incrementar contador del otro participante
        unread_count_1 = CASE WHEN NEW.sender_id = v_p2_id THEN unread_count_1 + 1 ELSE unread_count_1 END,
        unread_count_2 = CASE WHEN NEW.sender_id = v_p1_id THEN unread_count_2 + 1 ELSE unread_count_2 END
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_message_sent ON public.messages;
CREATE TRIGGER trigger_message_sent
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- =============================================================================
-- FUNCTION: Marcar mensajes como leídos
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_messages_read(p_conversation_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
    v_p1_id UUID;
BEGIN
    -- Marcar mensajes no leídos como leídos
    UPDATE public.messages SET
        is_read = TRUE,
        read_at = NOW()
    WHERE conversation_id = p_conversation_id
      AND sender_id != p_user_id
      AND is_read = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Resetear contador de no leídos en conversación
    SELECT participant1_id INTO v_p1_id
    FROM public.conversations WHERE id = p_conversation_id;
    
    UPDATE public.conversations SET
        unread_count_1 = CASE WHEN p_user_id = participant1_id THEN 0 ELSE unread_count_1 END,
        unread_count_2 = CASE WHEN p_user_id = participant2_id THEN 0 ELSE unread_count_2 END
    WHERE id = p_conversation_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Obtener contador total de no leídos
-- =============================================================================

CREATE OR REPLACE FUNCTION get_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(
        CASE 
            WHEN participant1_id = p_user_id THEN unread_count_1
            WHEN participant2_id = p_user_id THEN unread_count_2
            ELSE 0
        END
    ), 0)::INTEGER INTO v_count
    FROM public.conversations
    WHERE participant1_id = p_user_id OR participant2_id = p_user_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Solo participantes de la conversación pueden ver mensajes
CREATE POLICY "Participants can view messages"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
            AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
        )
    );

-- Policy: Participantes pueden enviar mensajes
CREATE POLICY "Participants can send messages"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
            AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
        )
    );

-- Policy: Actualizar propios mensajes (para is_read)
CREATE POLICY "Users can update message read status"
    ON public.messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
            AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
        )
    );

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_count TO authenticated;
