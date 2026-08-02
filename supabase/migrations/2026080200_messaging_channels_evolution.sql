-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 049: MESSAGING CHANNELS EVOLUTION
-- Evolución del sistema de mensajería a canales de múltiples participantes
-- =============================================================================

-- =============================================================================
-- PLAN DE ROLLBACK CONCEPTUAL
-- 1. Eliminar funciones: remove_channel_participant, add_channel_participant, create_entity_channel, create_guest_access, update_participant_unread.
-- 2. Eliminar trigger trigger_update_participant_unread de la tabla messages.
-- 3. Remover tablas del publication supabase_realtime.
-- 4. DROP tablas: user_presence, message_reactions, conversation_participants.
-- 5. Revertir columnas de messages.
-- 6. Revertir columnas de conversations.
-- =============================================================================

-- =============================================================================
-- 1. ALTER CONVERSATIONS TABLE
-- =============================================================================
DO $$ BEGIN
    ALTER TABLE public.conversations 
        ADD COLUMN IF NOT EXISTS channel_type TEXT CHECK (channel_type IN ('direct','trip','offer','fleet','dispatch','support','system')) DEFAULT 'direct',
        ADD COLUMN IF NOT EXISTS title TEXT,
        ADD COLUMN IF NOT EXISTS entity_id UUID,
        ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('trip','offer','dispatch','fleet','support')),
        ADD COLUMN IF NOT EXISTS business_id UUID,
        ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS pinned_message_id UUID;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Permitir null en participants para canales que usan conversation_participants
ALTER TABLE public.conversations ALTER COLUMN participant1_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN participant2_id DROP NOT NULL;

-- =============================================================================
-- 2. CREATE CONVERSATION_PARTICIPANTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner','admin','member','observer','guest')) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    last_read_message_id UUID,
    is_muted BOOLEAN DEFAULT FALSE,
    unread_count INTEGER DEFAULT 0,
    guest_token TEXT,
    guest_name TEXT,
    guest_phone TEXT,
    UNIQUE(conversation_id, user_id)
);

-- =============================================================================
-- 3. ALTER MESSAGES TABLE
-- =============================================================================
DO $$ BEGIN
    -- Modificar tipo de message_type a TEXT
    ALTER TABLE public.messages ALTER COLUMN message_type TYPE TEXT USING message_type::TEXT;
    
    -- Agregar nuevas columnas
    ALTER TABLE public.messages
        ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Permitir sender_id NULL para mensajes del sistema
ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;

-- =============================================================================
-- 4. CREATE MESSAGE_REACTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- =============================================================================
-- 5. CREATE USER_PRESENCE TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('online','away','offline')) DEFAULT 'offline',
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    typing_in_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    current_device TEXT
);

-- =============================================================================
-- 6. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_conv_entity ON public.conversations(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_conv_business ON public.conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_conv_channel_type ON public.conversations(channel_type);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON public.messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_presence_status ON public.user_presence(status);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);

-- =============================================================================
-- 7. RLS (ROW LEVEL SECURITY)
-- =============================================================================
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- conversation_participants
CREATE POLICY "Users can view their participation"
    ON public.conversation_participants FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their participation"
    ON public.conversation_participants FOR UPDATE
    USING (user_id = auth.uid());

-- message_reactions
CREATE POLICY "Participants can view reactions"
    ON public.message_reactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = (SELECT conversation_id FROM public.messages m WHERE m.id = message_id)
            AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Participants can manage their reactions"
    ON public.message_reactions FOR ALL
    USING (user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = (SELECT conversation_id FROM public.messages m WHERE m.id = message_id)
        AND cp.user_id = auth.uid()
    ));

-- user_presence
CREATE POLICY "Authenticated users can view presence"
    ON public.user_presence FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their presence"
    ON public.user_presence FOR ALL
    USING (user_id = auth.uid());

-- Actualización RLS para conversations
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
    ON public.conversations FOR SELECT
    USING (
        participant1_id = auth.uid() OR 
        participant2_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Participants can insert conversations" ON public.conversations;
CREATE POLICY "Participants can insert conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (
        participant1_id = auth.uid() OR 
        participant2_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid()) OR
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
    ON public.conversations FOR UPDATE
    USING (
        participant1_id = auth.uid() OR 
        participant2_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
    );

-- =============================================================================
-- 8. HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_entity_channel(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_title TEXT,
    p_business_id UUID,
    p_participant_ids UUID[]
) RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_uid UUID;
BEGIN
    INSERT INTO public.conversations (channel_type, title, entity_id, entity_type, business_id)
    VALUES (
        CASE WHEN p_entity_type = 'trip' THEN 'trip'
             WHEN p_entity_type = 'offer' THEN 'offer'
             WHEN p_entity_type = 'dispatch' THEN 'dispatch'
             WHEN p_entity_type = 'fleet' THEN 'fleet'
             ELSE 'system' END,
        p_title, p_entity_id, p_entity_type, p_business_id
    )
    RETURNING id INTO v_conversation_id;

    FOREACH v_uid IN ARRAY p_participant_ids LOOP
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (v_conversation_id, v_uid)
        ON CONFLICT DO NOTHING;
    END LOOP;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.add_channel_participant(
    p_conversation_id UUID,
    p_user_id UUID,
    p_role TEXT DEFAULT 'member'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (p_conversation_id, p_user_id, p_role)
    ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.remove_channel_participant(
    p_conversation_id UUID,
    p_user_id UUID
) RETURNS VOID AS $$
BEGIN
    DELETE FROM public.conversation_participants 
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_guest_access(
    p_conversation_id UUID,
    p_guest_name TEXT,
    p_guest_phone TEXT
) RETURNS JSONB AS $$
DECLARE
    v_token TEXT;
BEGIN
    v_token := encode(gen_random_bytes(16), 'hex');
    INSERT INTO public.conversation_participants (conversation_id, guest_token, guest_name, guest_phone)
    VALUES (p_conversation_id, v_token, p_guest_name, p_guest_phone);
    
    RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_participant_unread()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id 
      AND (user_id IS NULL OR user_id != NEW.sender_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_participant_unread ON public.messages;
CREATE TRIGGER trigger_update_participant_unread
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_participant_unread();

-- =============================================================================
-- 9. GRANT PERMISSIONS & REALTIME
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_entity_channel TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_channel_participant TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_channel_participant TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_access TO authenticated;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
