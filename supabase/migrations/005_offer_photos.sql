-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 005: OFFER PHOTOS
-- Fotos asociadas a ofertas (usa Supabase Storage)
-- =============================================================================

-- =============================================================================
-- OFFER PHOTOS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.offer_photos (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationship
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    
    -- File Info (stored in Supabase Storage)
    storage_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    
    -- Display
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_photos_offer ON public.offer_photos(offer_id);
CREATE INDEX IF NOT EXISTS idx_photos_sort ON public.offer_photos(offer_id, sort_order);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.offer_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Dueños de oferta pueden gestionar fotos
CREATE POLICY "Offer owners can manage photos"
    ON public.offer_photos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.cargo_offers 
            WHERE id = offer_id AND business_id = auth.uid()
        )
    );

-- Policy: Todos pueden ver fotos de ofertas activas
CREATE POLICY "Anyone can view offer photos"
    ON public.offer_photos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cargo_offers 
            WHERE id = offer_id AND (status = 'active' OR status = 'in_progress')
        )
    );

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_photos TO authenticated;
GRANT SELECT ON public.offer_photos TO anon;

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'offer-photos',
    'offer-photos',
    TRUE,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can upload offer photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload offer photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'offer-photos');

DROP POLICY IF EXISTS "Authenticated users can update own offer photos" ON storage.objects;
CREATE POLICY "Authenticated users can update own offer photos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'offer-photos' AND auth.uid()::text = (storage.foldername(name))[1])
    WITH CHECK (bucket_id = 'offer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated users can delete own offer photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete own offer photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'offer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Public can view offer photos" ON storage.objects;
CREATE POLICY "Public can view offer photos"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'offer-photos');
