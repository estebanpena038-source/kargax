-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 003: OFFER APPLICATIONS
-- Aplicaciones de camioneros a ofertas
-- =============================================================================

-- =============================================================================
-- CUSTOM TYPES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE application_status AS ENUM (
        'pending',    -- Esperando respuesta
        'accepted',   -- Aceptada por empresa
        'rejected',   -- Rechazada por empresa
        'withdrawn'   -- Retirada por camionero
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- OFFER APPLICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.offer_applications (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    trucker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Status
    status application_status NOT NULL DEFAULT 'pending',
    
    -- Application Details
    proposed_amount DECIMAL(15,2),
    message TEXT,
    estimated_pickup TIMESTAMPTZ,
    
    -- Business Response
    business_response TEXT,
    responded_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique: Un camionero solo puede aplicar una vez por oferta
    UNIQUE(offer_id, trucker_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_applications_offer ON public.offer_applications(offer_id);
CREATE INDEX IF NOT EXISTS idx_applications_trucker ON public.offer_applications(trucker_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.offer_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created ON public.offer_applications(created_at DESC);

-- =============================================================================
-- TRIGGER: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_applications_updated_at ON public.offer_applications;
CREATE TRIGGER trigger_applications_updated_at
    BEFORE UPDATE ON public.offer_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_applications_updated_at();

-- =============================================================================
-- TRIGGER: Incrementar contador de aplicaciones en oferta
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_applications_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.cargo_offers 
    SET applications_count = applications_count + 1 
    WHERE id = NEW.offer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_applications ON public.offer_applications;
CREATE TRIGGER trigger_increment_applications
    AFTER INSERT ON public.offer_applications
    FOR EACH ROW
    EXECUTE FUNCTION increment_applications_count();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.offer_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Camioneros pueden ver y gestionar sus propias aplicaciones
CREATE POLICY "Truckers can manage own applications"
    ON public.offer_applications
    FOR ALL
    USING (trucker_id = auth.uid())
    WITH CHECK (trucker_id = auth.uid());

-- Policy: Dueños de oferta pueden ver todas las aplicaciones
CREATE POLICY "Offer owners can view applications"
    ON public.offer_applications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cargo_offers 
            WHERE id = offer_id AND business_id = auth.uid()
        )
    );

-- Policy: Dueños de oferta pueden responder (update) aplicaciones
CREATE POLICY "Offer owners can respond to applications"
    ON public.offer_applications
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.cargo_offers 
            WHERE id = offer_id AND business_id = auth.uid()
        )
    );

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_applications TO authenticated;
