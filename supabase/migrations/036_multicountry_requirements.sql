-- =============================================================================
-- KARGAX - MULTI-COUNTRY MARKET + STRUCTURED APPLICATION REQUIREMENTS
-- =============================================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'CO'
        CHECK (country_code IN ('CO', 'EC', 'PE', 'BR'));

ALTER TABLE public.business_profiles
    ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'CO'
        CHECK (country_code IN ('CO', 'EC', 'PE', 'BR'));

ALTER TABLE public.trucker_profiles
    ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'CO'
        CHECK (country_code IN ('CO', 'EC', 'PE', 'BR'));

ALTER TABLE public.cargo_offers
    ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'CO'
        CHECK (country_code IN ('CO', 'EC', 'PE', 'BR')),
    ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'COP'
        CHECK (currency_code IN ('COP', 'USD', 'PEN', 'BRL'));

ALTER TABLE public.offer_applications
    ADD COLUMN IF NOT EXISTS years_experience INTEGER,
    ADD COLUMN IF NOT EXISTS vehicle_type_confirmed TEXT,
    ADD COLUMN IF NOT EXISTS vehicle_plate TEXT,
    ADD COLUMN IF NOT EXISTS license_type TEXT,
    ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS application_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_profiles_country
    ON public.user_profiles(country_code);

CREATE INDEX IF NOT EXISTS idx_cargo_offers_country_status
    ON public.cargo_offers(country_code, status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_offer_applications_requirements_payload
    ON public.offer_applications USING GIN(application_payload);

UPDATE public.business_profiles bp
SET country_code = up.country_code
FROM public.user_profiles up
WHERE bp.user_id = up.id
  AND bp.country_code = 'CO'
  AND up.country_code IS NOT NULL;

UPDATE public.trucker_profiles tp
SET country_code = up.country_code
FROM public.user_profiles up
WHERE tp.user_id = up.id
  AND tp.country_code = 'CO'
  AND up.country_code IS NOT NULL;

UPDATE public.cargo_offers co
SET
    country_code = COALESCE(up.country_code, co.country_code, 'CO'),
    currency_code = CASE COALESCE(up.country_code, co.country_code, 'CO')
        WHEN 'EC' THEN 'USD'
        WHEN 'PE' THEN 'PEN'
        WHEN 'BR' THEN 'BRL'
        ELSE 'COP'
    END
FROM public.user_profiles up
WHERE co.business_id = up.id
  AND co.currency_code = 'COP';

CREATE OR REPLACE FUNCTION public.kargax_currency_for_country(p_country_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE UPPER(COALESCE(p_country_code, 'CO'))
        WHEN 'EC' THEN 'USD'
        WHEN 'PE' THEN 'PEN'
        WHEN 'BR' THEN 'BRL'
        ELSE 'COP'
    END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_user_type TEXT;
    v_country_code TEXT;
BEGIN
    v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'trucker');
    v_country_code := COALESCE(NULLIF(NEW.raw_user_meta_data->>'country_code', ''), 'CO');

    IF v_country_code NOT IN ('CO', 'EC', 'PE', 'BR') THEN
        v_country_code := 'CO';
    END IF;

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
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
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

    IF v_user_type = 'business' THEN
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
            COALESCE(NEW.raw_user_meta_data->>'company_name', NEW.raw_user_meta_data->>'full_name', ''),
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
    ELSIF v_user_type = 'trucker' THEN
        INSERT INTO public.trucker_profiles (user_id, country_code)
        VALUES (NEW.id, v_country_code)
        ON CONFLICT (user_id) DO UPDATE SET
            country_code = EXCLUDED.country_code,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO public.country_registry (
    country_code,
    display_name,
    locale_default,
    currency_code,
    timezone_default,
    phone_country_code,
    phone_pattern,
    document_types,
    fiscal_label,
    supported_rails,
    legal_links,
    environment_urls,
    seed_regions,
    feature_flags,
    is_backend_ready,
    is_visible
) VALUES
(
    'BR',
    'Brasil',
    'pt-BR',
    'BRL',
    'America/Sao_Paulo',
    '+55',
    '^(\\+55\\s?)?[1-9]{2}9\\d{8}$',
    '[{"code":"CPF","label":"CPF"},{"code":"CNPJ","label":"CNPJ"},{"code":"RG","label":"RG"},{"code":"PP","label":"Passaporte"}]'::jsonb,
    'CNPJ',
    '{"payments":["mercadopago"],"payouts":["bank_transfer","pix"],"notifications":["twilio","console"],"billing":["mercadopago"]}'::jsonb,
    '{"terms":"/terminos?country=BR","privacy":"/privacidad?country=BR","support":"/soporte?country=BR"}'::jsonb,
    '{"app":"https://app.kargax.com/br","checkout":"https://app.kargax.com/br/checkout","support":"https://app.kargax.com/soporte?country=BR"}'::jsonb,
    '["Sao Paulo","Rio de Janeiro","Minas Gerais","Parana"]'::jsonb,
    '{"market_open":true}'::jsonb,
    TRUE,
    TRUE
)
ON CONFLICT (country_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    locale_default = EXCLUDED.locale_default,
    currency_code = EXCLUDED.currency_code,
    timezone_default = EXCLUDED.timezone_default,
    phone_country_code = EXCLUDED.phone_country_code,
    phone_pattern = EXCLUDED.phone_pattern,
    document_types = EXCLUDED.document_types,
    fiscal_label = EXCLUDED.fiscal_label,
    supported_rails = EXCLUDED.supported_rails,
    legal_links = EXCLUDED.legal_links,
    environment_urls = EXCLUDED.environment_urls,
    seed_regions = EXCLUDED.seed_regions,
    feature_flags = EXCLUDED.feature_flags,
    is_backend_ready = TRUE,
    is_visible = TRUE,
    updated_at = NOW();

UPDATE public.country_registry
SET
    is_visible = TRUE,
    is_backend_ready = TRUE,
    feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"market_open":true}'::jsonb,
    locale_default = CASE country_code
        WHEN 'PE' THEN 'es-PE'
        WHEN 'EC' THEN 'es-EC'
        ELSE locale_default
    END
WHERE country_code IN ('CO', 'PE', 'EC', 'BR');

INSERT INTO public.provider_adapter_configs (country_code, provider_kind, adapter_key, status, config)
VALUES
    ('BR', 'payments', 'mercadopago', 'active', '{"provider":"mercadopago","market":"BR"}'::jsonb),
    ('BR', 'billing', 'mercadopago', 'active', '{"provider":"mercadopago","market":"BR"}'::jsonb),
    ('BR', 'payouts', 'pix', 'active', '{"provider":"pix","market":"BR"}'::jsonb),
    ('PE', 'payments', 'mercadopago', 'active', '{"provider":"mercadopago","market":"PE"}'::jsonb),
    ('PE', 'billing', 'mercadopago', 'active', '{"provider":"mercadopago","market":"PE"}'::jsonb)
ON CONFLICT (country_code, provider_kind, adapter_key) DO UPDATE SET
    status = EXCLUDED.status,
    config = EXCLUDED.config,
    updated_at = NOW();
