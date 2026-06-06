-- =============================================================================
-- KARGAX - LAST MILE MARGIN CONTROL SCHEMA REPAIR
-- Makes partially-applied Last-Mile tables compatible with the server services.
-- Safe to run multiple times; does not write wallets, payments or transactions.
-- =============================================================================

BEGIN;

ALTER TABLE public.last_mile_carriers
    ADD COLUMN IF NOT EXISTS provider_key TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

UPDATE public.last_mile_carriers
SET provider_key = 'carrier-' || id::text
WHERE provider_key IS NULL;

ALTER TABLE public.last_mile_carriers
    ALTER COLUMN provider_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_last_mile_carriers_business_provider_key
    ON public.last_mile_carriers(business_id, provider_key);

CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_provider_key
    ON public.last_mile_carriers(business_id, provider_key);

ALTER TABLE public.last_mile_route_lanes
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.last_mile_contracts
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.last_mile_renegotiation_recommendations
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_last_mile_recommendations_created_by
    ON public.last_mile_renegotiation_recommendations(business_id, created_by, created_at DESC)
    WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_last_mile_recommendations_updated_by
    ON public.last_mile_renegotiation_recommendations(business_id, updated_by, updated_at DESC)
    WHERE updated_by IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
