-- =============================================================================
-- KARGAX - GEO COLOMBIA ROLLBACK
-- Use only after confirming no code depends on geo_* FK columns.
-- This rollback is intentionally split so production can choose safe partial rollback.
-- =============================================================================

-- Safe application rollback: keep catalog data, only stop app from depending on it.
-- 1) Revert frontend/API deployment.
-- 2) Do NOT drop geo_* tables unless a database restore window is approved.

-- Full database rollback, destructive for new catalog data:
-- BEGIN;
-- DROP VIEW IF EXISTS public.geo_active_municipalities;
-- DROP VIEW IF EXISTS public.geo_active_departments;
-- DROP FUNCTION IF EXISTS public.geo_validate_location(UUID, UUID, UUID);
-- DROP TABLE IF EXISTS public.geo_aliases;
-- DROP TABLE IF EXISTS public.geo_local_zones;
-- DROP TABLE IF EXISTS public.geo_municipalities;
-- DROP TABLE IF EXISTS public.geo_departments;
-- DROP TABLE IF EXISTS public.geo_seed_versions;
-- DROP FUNCTION IF EXISTS public.geo_touch_updated_at();
-- DROP FUNCTION IF EXISTS public.geo_normalize_text(TEXT);
-- COMMIT;

-- Optional cleanup of compatibility columns. Do not run without production backup.
-- ALTER TABLE public.business_profiles DROP COLUMN IF EXISTS department_id, DROP COLUMN IF EXISTS municipality_id, DROP COLUMN IF EXISTS local_zone_id, DROP COLUMN IF EXISTS department_name_legacy, DROP COLUMN IF EXISTS city_name_legacy, DROP COLUMN IF EXISTS local_zone_name_legacy, DROP COLUMN IF EXISTS address_reference;
-- ALTER TABLE public.cargo_offers DROP COLUMN IF EXISTS origin_department_id, DROP COLUMN IF EXISTS origin_municipality_id, DROP COLUMN IF EXISTS origin_local_zone_id, DROP COLUMN IF EXISTS origin_zone_name_legacy, DROP COLUMN IF EXISTS origin_address_reference, DROP COLUMN IF EXISTS destination_department_id, DROP COLUMN IF EXISTS destination_municipality_id, DROP COLUMN IF EXISTS destination_local_zone_id, DROP COLUMN IF EXISTS destination_zone_name_legacy, DROP COLUMN IF EXISTS destination_address_reference;
-- ALTER TABLE public.warehouses DROP COLUMN IF EXISTS department_id, DROP COLUMN IF EXISTS municipality_id, DROP COLUMN IF EXISTS local_zone_id, DROP COLUMN IF EXISTS local_zone_name_legacy, DROP COLUMN IF EXISTS address_reference;
