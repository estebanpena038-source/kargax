-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 004: OFFER VIEWS & ANALYTICS
-- Tracking de vistas de ofertas
-- =============================================================================

-- =============================================================================
-- OFFER VIEWS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.offer_views (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- View Info
    view_count INTEGER NOT NULL DEFAULT 1,
    first_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique por viewer/oferta
    UNIQUE(offer_id, viewer_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_views_offer ON public.offer_views(offer_id);
CREATE INDEX IF NOT EXISTS idx_views_viewer ON public.offer_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_views_last ON public.offer_views(last_viewed_at DESC);

-- =============================================================================
-- FUNCTION: Record or increment view
-- =============================================================================

CREATE OR REPLACE FUNCTION record_offer_view(p_offer_id UUID, p_viewer_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Insert or update view record
    INSERT INTO public.offer_views (offer_id, viewer_id)
    VALUES (p_offer_id, p_viewer_id)
    ON CONFLICT (offer_id, viewer_id) 
    DO UPDATE SET 
        view_count = offer_views.view_count + 1,
        last_viewed_at = NOW();
    
    -- Increment offer views_count
    UPDATE public.cargo_offers 
    SET views_count = views_count + 1 
    WHERE id = p_offer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.offer_views ENABLE ROW LEVEL SECURITY;

-- Policy: Solo dueños de oferta pueden ver quién vio
CREATE POLICY "Offer owners can view analytics"
    ON public.offer_views
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cargo_offers 
            WHERE id = offer_id AND business_id = auth.uid()
        )
    );

-- Policy: Cualquier autenticado puede insertar (registrar vista)
CREATE POLICY "Authenticated can record views"
    ON public.offer_views
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Actualizar propias vistas
CREATE POLICY "Update own views"
    ON public.offer_views
    FOR UPDATE
    USING (viewer_id = auth.uid());

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON public.offer_views TO authenticated;
GRANT EXECUTE ON FUNCTION record_offer_view TO authenticated;
