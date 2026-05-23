-- =============================================================================
-- KARGAX - Business team invitation auth hardening
-- =============================================================================
-- Fixes Supabase Auth "Database error saving new user" for invited team members
-- and keeps invited internal users from being created as standalone company
-- owners.

BEGIN;

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'CO'
        CHECK (country_code IN ('CO', 'EC', 'PE', 'BR'));

ALTER TABLE public.business_profiles
    ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'CO'
        CHECK (country_code IN ('CO', 'EC', 'PE', 'BR'));

ALTER TABLE public.trucker_profiles
    ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'CO'
        CHECK (country_code IN ('CO', 'EC', 'PE', 'BR'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_type_text TEXT;
    v_user_type public.user_type;
    v_country_code TEXT;
    v_is_business_team_invite BOOLEAN;
BEGIN
    v_user_type_text := COALESCE(NULLIF(NEW.raw_user_meta_data->>'user_type', ''), 'trucker');

    IF v_user_type_text NOT IN ('trucker', 'business', 'admin') THEN
        v_user_type_text := 'trucker';
    END IF;

    v_user_type := v_user_type_text::public.user_type;
    v_country_code := UPPER(COALESCE(NULLIF(NEW.raw_user_meta_data->>'country_code', ''), 'CO'));

    IF v_country_code NOT IN ('CO', 'EC', 'PE', 'BR') THEN
        v_country_code := 'CO';
    END IF;

    v_is_business_team_invite :=
        LOWER(COALESCE(NEW.raw_user_meta_data->>'team_invitation', 'false')) IN ('true', '1', 'yes')
        OR NULLIF(NEW.raw_user_meta_data->>'invited_business_id', '') IS NOT NULL
        OR NULLIF(NEW.raw_user_meta_data->>'team_role', '') IS NOT NULL;

    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        phone,
        user_type,
        document_type,
        document_number,
        country_code
    ) VALUES (
        NEW.id,
        LOWER(COALESCE(NEW.email, '')),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), ''),
        NEW.raw_user_meta_data->>'phone',
        v_user_type,
        NEW.raw_user_meta_data->>'document_type',
        NEW.raw_user_meta_data->>'document_number',
        v_country_code
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        user_type = EXCLUDED.user_type,
        document_type = EXCLUDED.document_type,
        document_number = EXCLUDED.document_number,
        country_code = EXCLUDED.country_code,
        updated_at = NOW();

    IF v_user_type = 'business'::public.user_type AND NOT v_is_business_team_invite THEN
        INSERT INTO public.business_profiles (
            user_id,
            company_name,
            nit,
            industry,
            address,
            city,
            department,
            country_code
        ) VALUES (
            NEW.id,
            COALESCE(
                NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
                NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
                'Mi Empresa'
            ),
            COALESCE(NEW.raw_user_meta_data->>'nit', ''),
            COALESCE(NEW.raw_user_meta_data->>'industry', ''),
            COALESCE(NEW.raw_user_meta_data->>'address', ''),
            COALESCE(NEW.raw_user_meta_data->>'city', ''),
            COALESCE(NEW.raw_user_meta_data->>'department', ''),
            v_country_code
        )
        ON CONFLICT (user_id) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            nit = EXCLUDED.nit,
            industry = EXCLUDED.industry,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            department = EXCLUDED.department,
            country_code = EXCLUDED.country_code,
            updated_at = NOW();
    ELSIF v_user_type = 'trucker'::public.user_type THEN
        INSERT INTO public.trucker_profiles (user_id, country_code)
        VALUES (NEW.id, v_country_code)
        ON CONFLICT (user_id) DO UPDATE SET
            country_code = EXCLUDED.country_code,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user()
    IS 'Creates localized user profiles and treats business team invites as internal members, not company owners.';

COMMIT;
