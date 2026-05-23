-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 002: CARGO OFFERS
-- Tabla principal de ofertas de carga
-- =============================================================================

-- =============================================================================
-- CUSTOM TYPES
-- =============================================================================

-- Tipo para status de ofertas
DO $$ BEGIN
    CREATE TYPE offer_status AS ENUM (
        'draft',        -- Borrador, no visible
        'active',       -- Publicada, aceptando aplicaciones
        'in_progress',  -- Camionero asignado, en transporte
        'completed',    -- Entrega completada
        'cancelled',    -- Cancelada por empresa
        'expired'       -- Expirada sin asignar
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Tipo para método de pago
DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('bank_transfer', 'cash', 'check');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Tipo para schedule de pago
DO $$ BEGIN
    CREATE TYPE payment_schedule AS ENUM ('on_delivery', 'advance', 'partial');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- CARGO OFFERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cargo_offers (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_trucker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Status
    status offer_status NOT NULL DEFAULT 'draft',
    
    -- Cargo Information
    cargo_type VARCHAR(50) NOT NULL,
    cargo_description TEXT NOT NULL,
    weight_kg DECIMAL(10,2) NOT NULL,
    dimension_length DECIMAL(5,2),
    dimension_width DECIMAL(5,2),
    dimension_height DECIMAL(5,2),
    quantity INTEGER NOT NULL DEFAULT 1,
    temperature_min DECIMAL(4,1),
    temperature_max DECIMAL(4,1),
    special_requirements TEXT,
    
    -- Origin
    origin_department VARCHAR(100) NOT NULL,
    origin_city VARCHAR(100) NOT NULL,
    origin_address VARCHAR(255) NOT NULL,
    
    -- Destination
    destination_department VARCHAR(100) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    destination_address VARCHAR(255) NOT NULL,
    
    -- Schedule
    pickup_date DATE NOT NULL,
    pickup_time_start TIME NOT NULL,
    pickup_time_end TIME NOT NULL,
    delivery_date DATE NOT NULL,
    delivery_time_start TIME NOT NULL,
    delivery_time_end TIME NOT NULL,
    
    -- Payment
    total_amount DECIMAL(15,2) NOT NULL,
    rate_per_km DECIMAL(10,2),
    payment_method payment_method NOT NULL,
    payment_schedule payment_schedule NOT NULL,
    additional_terms TEXT,
    
    -- Requirements
    vehicle_type VARCHAR(50) NOT NULL,
    min_experience_years INTEGER NOT NULL DEFAULT 0,
    required_licenses JSONB,
    required_certifications JSONB,
    insurance_required BOOLEAN NOT NULL DEFAULT FALSE,
    additional_requirements TEXT,
    
    -- Analytics
    views_count INTEGER NOT NULL DEFAULT 0,
    applications_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_offers_status ON public.cargo_offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_business ON public.cargo_offers(business_id);
CREATE INDEX IF NOT EXISTS idx_offers_trucker ON public.cargo_offers(assigned_trucker_id);
CREATE INDEX IF NOT EXISTS idx_offers_origin ON public.cargo_offers(origin_department, origin_city);
CREATE INDEX IF NOT EXISTS idx_offers_destination ON public.cargo_offers(destination_department, destination_city);
CREATE INDEX IF NOT EXISTS idx_offers_pickup_date ON public.cargo_offers(pickup_date);
CREATE INDEX IF NOT EXISTS idx_offers_cargo_type ON public.cargo_offers(cargo_type);
CREATE INDEX IF NOT EXISTS idx_offers_vehicle_type ON public.cargo_offers(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_offers_published_at ON public.cargo_offers(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_total_amount ON public.cargo_offers(total_amount);

-- =============================================================================
-- TRIGGER: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_offers_updated_at ON public.cargo_offers;
CREATE TRIGGER trigger_offers_updated_at
    BEFORE UPDATE ON public.cargo_offers
    FOR EACH ROW
    EXECUTE FUNCTION update_offers_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.cargo_offers ENABLE ROW LEVEL SECURITY;

-- Policy: Empresas pueden ver y gestionar sus propias ofertas
CREATE POLICY "Business can manage own offers"
    ON public.cargo_offers
    FOR ALL
    USING (business_id = auth.uid())
    WITH CHECK (business_id = auth.uid());

-- Policy: Todos los usuarios autenticados pueden ver ofertas activas
CREATE POLICY "Authenticated users can view active offers"
    ON public.cargo_offers
    FOR SELECT
    USING (
        status = 'active' 
        OR status = 'in_progress'
        OR business_id = auth.uid()
        OR assigned_trucker_id = auth.uid()
    );

-- Policy: Camioneros asignados pueden ver su oferta
CREATE POLICY "Assigned trucker can view offer"
    ON public.cargo_offers
    FOR SELECT
    USING (assigned_trucker_id = auth.uid());

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargo_offers TO authenticated;
GRANT SELECT ON public.cargo_offers TO anon;
