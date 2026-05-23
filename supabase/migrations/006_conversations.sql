-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 006: CONVERSATIONS
-- Conversaciones entre usuarios
-- =============================================================================

-- =============================================================================
-- CONVERSATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants (ordenados alfabéticamente para unicidad)
    participant1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Oferta relacionada (opcional)
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    
    -- Último mensaje info
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ,
    
    -- Contadores de no leídos por participante
    unread_count_1 INTEGER NOT NULL DEFAULT 0,
    unread_count_2 INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique: solo una conversación por par de usuarios
    UNIQUE(participant1_id, participant2_id),
    
    -- Constraint: no conversación consigo mismo
    CONSTRAINT different_participants CHECK (participant1_id != participant2_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON public.conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON public.conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_offer ON public.conversations(offer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations(last_message_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Solo participantes pueden ver/gestionar la conversación
CREATE POLICY "Participants can view conversations"
    ON public.conversations
    FOR SELECT
    USING (participant1_id = auth.uid() OR participant2_id = auth.uid());

CREATE POLICY "Participants can insert conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (participant1_id = auth.uid() OR participant2_id = auth.uid());

CREATE POLICY "Participants can update conversations"
    ON public.conversations
    FOR UPDATE
    USING (participant1_id = auth.uid() OR participant2_id = auth.uid());

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
