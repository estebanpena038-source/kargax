-- =============================================================================
-- KARGAX - GEO COLOMBIA CATALOGS
-- Non-destructive migration for official Colombia geographic coverage.
-- Source of truth: DANE / DIVIPOLA + audited official municipal sources for local zones.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.geo_normalize_text(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT trim(regexp_replace(lower(public.unaccent(coalesce(input, ''))), '[^a-z0-9]+', ' ', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Seed versioning / provenance
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_seed_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_checked_at TIMESTAMPTZ NOT NULL,
    source_version TEXT NOT NULL,
    checksum TEXT NOT NULL,
    row_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_name, source_version)
);

-- -----------------------------------------------------------------------------
-- Departments: Colombia has departments plus Bogotá D.C. as capital district.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT NOT NULL DEFAULT 'CO' CHECK (country_code = 'CO'),
    divipola_code TEXT NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    is_capital_district BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (country_code, divipola_code),
    UNIQUE (country_code, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_geo_departments_active_name
    ON public.geo_departments(country_code, is_active, normalized_name);

-- -----------------------------------------------------------------------------
-- Municipalities / districts / non-municipalized areas.
-- UI copy should say: Ciudad o municipio.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_municipalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.geo_departments(id) ON DELETE RESTRICT,
    country_code TEXT NOT NULL DEFAULT 'CO' CHECK (country_code = 'CO'),
    divipola_code TEXT NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'municipio'
        CHECK (type IN ('municipio', 'distrito', 'area_no_municipalizada')),
    is_capital BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (country_code, divipola_code),
    UNIQUE (department_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_geo_municipalities_department_active_name
    ON public.geo_municipalities(department_id, is_active, normalized_name);
CREATE INDEX IF NOT EXISTS idx_geo_municipalities_search
    ON public.geo_municipalities USING GIN (to_tsvector('spanish', name));

-- -----------------------------------------------------------------------------
-- Local zones: barrio/localidad/comuna/vereda/corregimiento/centro poblado/etc.
-- This is intentionally optional because Colombia does not have one reliable
-- national official catalog of barrios for all municipalities.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_local_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.geo_departments(id) ON DELETE RESTRICT,
    municipality_id UUID NOT NULL REFERENCES public.geo_municipalities(id) ON DELETE RESTRICT,
    divipola_code TEXT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    zone_type TEXT NOT NULL DEFAULT 'otro'
        CHECK (zone_type IN (
            'barrio', 'localidad', 'comuna', 'vereda', 'corregimiento',
            'centro_poblado', 'sector', 'otro'
        )),
    source TEXT NOT NULL,
    source_url TEXT,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
    is_user_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_local_zones_unique
    ON public.geo_local_zones(municipality_id, normalized_name, zone_type, (coalesce(divipola_code, '')));
CREATE INDEX IF NOT EXISTS idx_geo_local_zones_municipality_active_name
    ON public.geo_local_zones(municipality_id, is_active, normalized_name);
CREATE INDEX IF NOT EXISTS idx_geo_local_zones_review
    ON public.geo_local_zones(needs_review, is_user_submitted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geo_local_zones_search
    ON public.geo_local_zones USING GIN (to_tsvector('spanish', name));

-- -----------------------------------------------------------------------------
-- Optional aliases for legacy mapping and spelling variations.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL CHECK (target_type IN ('department', 'municipality', 'local_zone')),
    department_id UUID REFERENCES public.geo_departments(id) ON DELETE CASCADE,
    municipality_id UUID REFERENCES public.geo_municipalities(id) ON DELETE CASCADE,
    local_zone_id UUID REFERENCES public.geo_local_zones(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (target_type = 'department' AND department_id IS NOT NULL AND municipality_id IS NULL AND local_zone_id IS NULL)
        OR (target_type = 'municipality' AND municipality_id IS NOT NULL AND local_zone_id IS NULL)
        OR (target_type = 'local_zone' AND local_zone_id IS NOT NULL)
    ),
    UNIQUE (target_type, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_geo_aliases_lookup
    ON public.geo_aliases(target_type, normalized_alias, is_active);

-- -----------------------------------------------------------------------------
-- Triggers for updated_at.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.geo_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_geo_departments_updated_at ON public.geo_departments;
CREATE TRIGGER trigger_geo_departments_updated_at
    BEFORE UPDATE ON public.geo_departments
    FOR EACH ROW EXECUTE FUNCTION public.geo_touch_updated_at();

DROP TRIGGER IF EXISTS trigger_geo_municipalities_updated_at ON public.geo_municipalities;
CREATE TRIGGER trigger_geo_municipalities_updated_at
    BEFORE UPDATE ON public.geo_municipalities
    FOR EACH ROW EXECUTE FUNCTION public.geo_touch_updated_at();

DROP TRIGGER IF EXISTS trigger_geo_local_zones_updated_at ON public.geo_local_zones;
CREATE TRIGGER trigger_geo_local_zones_updated_at
    BEFORE UPDATE ON public.geo_local_zones
    FOR EACH ROW EXECUTE FUNCTION public.geo_touch_updated_at();

DROP TRIGGER IF EXISTS trigger_geo_aliases_updated_at ON public.geo_aliases;
CREATE TRIGGER trigger_geo_aliases_updated_at
    BEFORE UPDATE ON public.geo_aliases
    FOR EACH ROW EXECUTE FUNCTION public.geo_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Read-optimized views.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.geo_active_departments AS
SELECT id, country_code, divipola_code, name, normalized_name, is_capital_district
FROM public.geo_departments
WHERE is_active = TRUE;

CREATE OR REPLACE VIEW public.geo_active_municipalities AS
SELECT
    m.id,
    m.country_code,
    m.department_id,
    d.divipola_code AS department_divipola_code,
    d.name AS department_name,
    m.divipola_code,
    m.name,
    m.normalized_name,
    m.type,
    m.is_capital
FROM public.geo_municipalities m
JOIN public.geo_departments d ON d.id = m.department_id
WHERE m.is_active = TRUE AND d.is_active = TRUE;

-- -----------------------------------------------------------------------------
-- Non-destructive legacy compatibility columns.
-- These columns keep old text values while enabling gradual FK adoption.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.business_profiles') IS NOT NULL THEN
        ALTER TABLE public.business_profiles
            ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.geo_departments(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES public.geo_municipalities(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS local_zone_id UUID REFERENCES public.geo_local_zones(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS department_name_legacy TEXT,
            ADD COLUMN IF NOT EXISTS city_name_legacy TEXT,
            ADD COLUMN IF NOT EXISTS local_zone_name_legacy TEXT,
            ADD COLUMN IF NOT EXISTS address_reference TEXT;
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_business_profiles_geo_location ON public.business_profiles(department_id, municipality_id, local_zone_id)';
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.cargo_offers') IS NOT NULL THEN
        ALTER TABLE public.cargo_offers
            ADD COLUMN IF NOT EXISTS origin_department_id UUID REFERENCES public.geo_departments(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS origin_municipality_id UUID REFERENCES public.geo_municipalities(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS origin_local_zone_id UUID REFERENCES public.geo_local_zones(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS origin_zone_name_legacy TEXT,
            ADD COLUMN IF NOT EXISTS origin_address_reference TEXT,
            ADD COLUMN IF NOT EXISTS destination_department_id UUID REFERENCES public.geo_departments(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS destination_municipality_id UUID REFERENCES public.geo_municipalities(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS destination_local_zone_id UUID REFERENCES public.geo_local_zones(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS destination_zone_name_legacy TEXT,
            ADD COLUMN IF NOT EXISTS destination_address_reference TEXT;
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cargo_offers_origin_geo ON public.cargo_offers(origin_department_id, origin_municipality_id, origin_local_zone_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cargo_offers_destination_geo ON public.cargo_offers(destination_department_id, destination_municipality_id, destination_local_zone_id)';
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.warehouses') IS NOT NULL THEN
        ALTER TABLE public.warehouses
            ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.geo_departments(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES public.geo_municipalities(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS local_zone_id UUID REFERENCES public.geo_local_zones(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS local_zone_name_legacy TEXT,
            ADD COLUMN IF NOT EXISTS address_reference TEXT;
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_warehouses_geo_location ON public.warehouses(department_id, municipality_id, local_zone_id)';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Validation helper: used by API and QA scripts.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.geo_validate_location(
    p_department_id UUID,
    p_municipality_id UUID,
    p_local_zone_id UUID DEFAULT NULL
)
RETURNS TABLE(is_valid BOOLEAN, error_code TEXT, message TEXT)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_municipality_department UUID;
    v_zone_department UUID;
    v_zone_municipality UUID;
BEGIN
    IF p_department_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'DEPARTMENT_REQUIRED', 'Departamento requerido';
        RETURN;
    END IF;

    IF p_municipality_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'MUNICIPALITY_REQUIRED', 'Ciudad o municipio requerido';
        RETURN;
    END IF;

    SELECT department_id INTO v_municipality_department
    FROM public.geo_municipalities
    WHERE id = p_municipality_id AND is_active = TRUE;

    IF v_municipality_department IS NULL THEN
        RETURN QUERY SELECT FALSE, 'MUNICIPALITY_NOT_FOUND', 'Municipio no existe o no está activo';
        RETURN;
    END IF;

    IF v_municipality_department <> p_department_id THEN
        RETURN QUERY SELECT FALSE, 'MUNICIPALITY_DEPARTMENT_MISMATCH', 'El municipio no pertenece al departamento seleccionado';
        RETURN;
    END IF;

    IF p_local_zone_id IS NOT NULL THEN
        SELECT department_id, municipality_id INTO v_zone_department, v_zone_municipality
        FROM public.geo_local_zones
        WHERE id = p_local_zone_id AND is_active = TRUE;

        IF v_zone_municipality IS NULL THEN
            RETURN QUERY SELECT FALSE, 'ZONE_NOT_FOUND', 'Zona interna no existe o no está activa';
            RETURN;
        END IF;

        IF v_zone_department <> p_department_id OR v_zone_municipality <> p_municipality_id THEN
            RETURN QUERY SELECT FALSE, 'ZONE_MUNICIPALITY_MISMATCH', 'La zona interna no pertenece al municipio seleccionado';
            RETURN;
        END IF;
    END IF;

    RETURN QUERY SELECT TRUE, 'OK', 'Ubicación válida';
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS: catalogs are global and safe for public read. Writes are admin/service,
-- except user-submitted local zones queued for review.
-- -----------------------------------------------------------------------------
ALTER TABLE public.geo_seed_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_local_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read geo seed versions" ON public.geo_seed_versions;
CREATE POLICY "Public read geo seed versions"
    ON public.geo_seed_versions FOR SELECT TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Public read geo departments" ON public.geo_departments;
CREATE POLICY "Public read geo departments"
    ON public.geo_departments FOR SELECT TO anon, authenticated
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public read geo municipalities" ON public.geo_municipalities;
CREATE POLICY "Public read geo municipalities"
    ON public.geo_municipalities FOR SELECT TO anon, authenticated
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public read geo local zones" ON public.geo_local_zones;
CREATE POLICY "Public read geo local zones"
    ON public.geo_local_zones FOR SELECT TO anon, authenticated
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Authenticated users can submit geo local zones" ON public.geo_local_zones;
CREATE POLICY "Authenticated users can submit geo local zones"
    ON public.geo_local_zones FOR INSERT TO authenticated
    WITH CHECK (
        is_user_submitted = TRUE
        AND needs_review = TRUE
        AND source = 'user_input'
        AND created_by = auth.uid()
    );

DROP POLICY IF EXISTS "Public read geo aliases" ON public.geo_aliases;
CREATE POLICY "Public read geo aliases"
    ON public.geo_aliases FOR SELECT TO anon, authenticated
    USING (is_active = TRUE);

GRANT SELECT ON public.geo_seed_versions TO anon, authenticated;
GRANT SELECT ON public.geo_departments TO anon, authenticated;
GRANT SELECT ON public.geo_municipalities TO anon, authenticated;
GRANT SELECT ON public.geo_local_zones TO anon, authenticated;
GRANT SELECT ON public.geo_aliases TO anon, authenticated;
GRANT INSERT ON public.geo_local_zones TO authenticated;
GRANT EXECUTE ON FUNCTION public.geo_validate_location(UUID, UUID, UUID) TO anon, authenticated;
GRANT SELECT ON public.geo_active_departments TO anon, authenticated;
GRANT SELECT ON public.geo_active_municipalities TO anon, authenticated;

COMMENT ON TABLE public.geo_departments IS 'Global Colombia department catalog sourced from DANE/DIVIPOLA.';
COMMENT ON TABLE public.geo_municipalities IS 'Global Colombia municipality/district/non-municipalized area catalog sourced from DANE/DIVIPOLA.';
COMMENT ON TABLE public.geo_local_zones IS 'Optional internal local zones. Official municipal/DANE sources only, plus user-submitted values pending review.';
COMMENT ON COLUMN public.geo_local_zones.needs_review IS 'TRUE for user-entered or low-confidence zones that must not be treated as official until reviewed.';
