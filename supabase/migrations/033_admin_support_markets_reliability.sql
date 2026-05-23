BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- Feature flags
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    scope TEXT NOT NULL DEFAULT 'global'
        CHECK (scope IN ('global', 'country')),
    country_code TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((scope = 'global' AND country_code IS NULL) OR (scope = 'country' AND country_code IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_scope_country
    ON public.feature_flags(scope, country_code, enabled);

INSERT INTO public.feature_flags (key, enabled, description, scope, country_code, payload)
VALUES
    ('market_open', true, 'Habilita la experiencia comercial activa del mercado principal.', 'global', NULL, '{}'::jsonb),
    ('enterprise_experience_mode', true, 'Activa la experiencia publica enterprise.', 'global', NULL, jsonb_build_object('owner_persona', 'Owner/CEO')),
    ('async_notifications', true, 'Permite fanout asincrono para notificaciones secundarias y follow-ups.', 'global', NULL, '{}'::jsonb),
    ('replay_actions', true, 'Habilita replays seguros desde el panel admin.', 'global', NULL, '{}'::jsonb),
    ('degraded_mode_wallet', false, 'Permite degradacion explicita del dominio wallet.', 'global', NULL, '{}'::jsonb),
    ('degraded_mode_warehouse', false, 'Permite degradacion explicita del dominio warehouse.', 'global', NULL, '{}'::jsonb),
    ('andean_country_visibility', true, 'Expone paises andinos backend-ready en contexto comercial.', 'global', NULL, jsonb_build_object('visible_countries', jsonb_build_array('CO', 'PE', 'EC'))),
    ('market_open', true, 'Colombia activo como mercado principal.', 'country', 'CO', jsonb_build_object('status', 'active')),
    ('market_open', false, 'Peru listo para activacion controlada.', 'country', 'PE', jsonb_build_object('status', 'controlled_rollout')),
    ('market_open', false, 'Ecuador listo para activacion controlada.', 'country', 'EC', jsonb_build_object('status', 'controlled_rollout'))
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Country and provider registry
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.country_registry (
    country_code TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    locale_default TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    timezone_default TEXT NOT NULL,
    phone_country_code TEXT NOT NULL,
    phone_pattern TEXT NOT NULL,
    document_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    fiscal_label TEXT NOT NULL,
    supported_rails JSONB NOT NULL DEFAULT '{}'::jsonb,
    legal_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    environment_urls JSONB NOT NULL DEFAULT '{}'::jsonb,
    seed_regions JSONB NOT NULL DEFAULT '[]'::jsonb,
    feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_backend_ready BOOLEAN NOT NULL DEFAULT FALSE,
    is_visible BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_adapter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT NOT NULL REFERENCES public.country_registry(country_code) ON DELETE CASCADE,
    provider_kind TEXT NOT NULL
        CHECK (provider_kind IN ('payments', 'payouts', 'notifications', 'billing')),
    adapter_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'placeholder'
        CHECK (status IN ('active', 'controlled', 'placeholder', 'disabled')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(country_code, provider_kind, adapter_key)
);

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
)
VALUES
    (
        'CO',
        'Colombia',
        'es-CO',
        'COP',
        'America/Bogota',
        '+57',
        '^(\\+57\\s?)?3\\d{9}$',
        jsonb_build_array(
            jsonb_build_object('code', 'CC', 'label', 'Cedula de Ciudadania'),
            jsonb_build_object('code', 'CE', 'label', 'Cedula de Extranjeria'),
            jsonb_build_object('code', 'NIT', 'label', 'NIT'),
            jsonb_build_object('code', 'PP', 'label', 'Pasaporte')
        ),
        'NIT',
        jsonb_build_object(
            'payments', jsonb_build_array('mercadopago'),
            'payouts', jsonb_build_array('bank_transfer', 'wallet'),
            'notifications', jsonb_build_array('twilio', 'console'),
            'billing', jsonb_build_array('mercadopago')
        ),
        jsonb_build_object(
            'terms', '/terminos?country=CO',
            'privacy', '/privacidad?country=CO',
            'support', '/soporte?country=CO'
        ),
        jsonb_build_object(
            'app', 'https://app.kargax.com',
            'checkout', 'https://app.kargax.com/checkout',
            'support', 'https://app.kargax.com/soporte'
        ),
        jsonb_build_array('Bogota', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena'),
        jsonb_build_object('market_open', true),
        true,
        true
    ),
    (
        'PE',
        'Peru',
        'es-CO',
        'PEN',
        'America/Lima',
        '+51',
        '^(\\+51\\s?)?9\\d{8}$',
        jsonb_build_array(
            jsonb_build_object('code', 'DNI', 'label', 'DNI'),
            jsonb_build_object('code', 'RUC', 'label', 'RUC'),
            jsonb_build_object('code', 'CE', 'label', 'Carnet de Extranjeria'),
            jsonb_build_object('code', 'PP', 'label', 'Pasaporte')
        ),
        'RUC',
        jsonb_build_object(
            'payments', jsonb_build_array('partner_placeholder_pe'),
            'payouts', jsonb_build_array('bank_transfer', 'partner_placeholder_pe'),
            'notifications', jsonb_build_array('twilio', 'console'),
            'billing', jsonb_build_array('partner_placeholder_pe')
        ),
        jsonb_build_object(
            'terms', '/terminos?country=PE',
            'privacy', '/privacidad?country=PE',
            'support', '/soporte?country=PE'
        ),
        jsonb_build_object(
            'app', 'https://app.kargax.com/pe',
            'checkout', 'https://app.kargax.com/pe/checkout',
            'support', 'https://app.kargax.com/soporte?country=PE'
        ),
        jsonb_build_array('Lima', 'Callao', 'Arequipa', 'Trujillo'),
        jsonb_build_object('market_open', false),
        true,
        false
    ),
    (
        'EC',
        'Ecuador',
        'es-CO',
        'USD',
        'America/Guayaquil',
        '+593',
        '^(\\+593\\s?)?9\\d{8}$',
        jsonb_build_array(
            jsonb_build_object('code', 'CI', 'label', 'Cedula'),
            jsonb_build_object('code', 'RUC', 'label', 'RUC'),
            jsonb_build_object('code', 'PP', 'label', 'Pasaporte')
        ),
        'RUC',
        jsonb_build_object(
            'payments', jsonb_build_array('partner_placeholder_ec'),
            'payouts', jsonb_build_array('bank_transfer', 'partner_placeholder_ec'),
            'notifications', jsonb_build_array('twilio', 'console'),
            'billing', jsonb_build_array('partner_placeholder_ec')
        ),
        jsonb_build_object(
            'terms', '/terminos?country=EC',
            'privacy', '/privacidad?country=EC',
            'support', '/soporte?country=EC'
        ),
        jsonb_build_object(
            'app', 'https://app.kargax.com/ec',
            'checkout', 'https://app.kargax.com/ec/checkout',
            'support', 'https://app.kargax.com/soporte?country=EC'
        ),
        jsonb_build_array('Quito', 'Guayaquil', 'Cuenca', 'Manta'),
        jsonb_build_object('market_open', false),
        true,
        false
    )
ON CONFLICT (country_code) DO UPDATE
SET display_name = EXCLUDED.display_name,
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
    is_backend_ready = EXCLUDED.is_backend_ready,
    is_visible = EXCLUDED.is_visible,
    updated_at = NOW();

INSERT INTO public.provider_adapter_configs (country_code, provider_kind, adapter_key, status, config)
VALUES
    ('CO', 'payments', 'mercadopago', 'active', jsonb_build_object('provider', 'mercadopago', 'mode', 'current')),
    ('CO', 'payouts', 'bank_transfer', 'active', jsonb_build_object('provider', 'wallet_bank_transfer')),
    ('CO', 'notifications', 'twilio', 'active', jsonb_build_object('provider', 'twilio')),
    ('CO', 'billing', 'mercadopago', 'active', jsonb_build_object('provider', 'mercadopago')),
    ('PE', 'payments', 'partner_placeholder_pe', 'placeholder', jsonb_build_object('provider', 'partner_placeholder', 'market', 'PE')),
    ('PE', 'payouts', 'partner_placeholder_pe', 'placeholder', jsonb_build_object('provider', 'partner_placeholder', 'market', 'PE')),
    ('PE', 'notifications', 'twilio', 'active', jsonb_build_object('provider', 'twilio')),
    ('PE', 'billing', 'partner_placeholder_pe', 'placeholder', jsonb_build_object('provider', 'partner_placeholder', 'market', 'PE')),
    ('EC', 'payments', 'partner_placeholder_ec', 'placeholder', jsonb_build_object('provider', 'partner_placeholder', 'market', 'EC')),
    ('EC', 'payouts', 'partner_placeholder_ec', 'placeholder', jsonb_build_object('provider', 'partner_placeholder', 'market', 'EC')),
    ('EC', 'notifications', 'twilio', 'active', jsonb_build_object('provider', 'twilio')),
    ('EC', 'billing', 'partner_placeholder_ec', 'placeholder', jsonb_build_object('provider', 'partner_placeholder', 'market', 'EC'))
ON CONFLICT (country_code, provider_kind, adapter_key) DO NOTHING;

-- =============================================================================
-- Observability and support layer
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.operation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL,
    actor_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    actor_type TEXT NOT NULL DEFAULT 'system'
        CHECK (actor_type IN ('system', 'user', 'admin', 'internal', 'anonymous')),
    domain TEXT NOT NULL
        CHECK (domain IN ('auth', 'payments', 'wallet', 'lending', 'warehouse', 'holding', 'support', 'platform', 'onboarding', 'market')),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    entity_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    business_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
    holding_account_id UUID REFERENCES public.holding_accounts(id) ON DELETE SET NULL,
    country_code TEXT NOT NULL DEFAULT 'CO',
    status TEXT NOT NULL DEFAULT 'success'
        CHECK (status IN ('queued', 'success', 'warning', 'error')),
    error_class TEXT,
    replayable BOOLEAN NOT NULL DEFAULT FALSE,
    replay_action TEXT,
    source_reference TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_events_request_id
    ON public.operation_events(request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operation_events_domain_status
    ON public.operation_events(domain, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operation_events_business_holding
    ON public.operation_events(business_id, holding_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_event_id UUID REFERENCES public.operation_events(id) ON DELETE SET NULL,
    request_id TEXT NOT NULL,
    domain TEXT NOT NULL
        CHECK (domain IN ('auth', 'payments', 'wallet', 'lending', 'warehouse', 'holding', 'support', 'platform', 'onboarding', 'market')),
    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    title TEXT NOT NULL,
    detail TEXT,
    runbook_key TEXT NOT NULL,
    replayable BOOLEAN NOT NULL DEFAULT FALSE,
    replay_action TEXT,
    replay_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    business_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
    holding_account_id UUID REFERENCES public.holding_accounts(id) ON DELETE SET NULL,
    country_code TEXT NOT NULL DEFAULT 'CO',
    error_class TEXT,
    source_reference TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_incidents_domain_status
    ON public.platform_incidents(domain, status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_incidents_request_id
    ON public.platform_incidents(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    business_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
    holding_account_id UUID REFERENCES public.holding_accounts(id) ON DELETE SET NULL,
    country_code TEXT NOT NULL DEFAULT 'CO',
    domain TEXT NOT NULL
        CHECK (domain IN ('payments', 'wallet', 'lending', 'warehouse', 'holding', 'support', 'platform', 'onboarding', 'market')),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'waiting_customer', 'resolved', 'closed')),
    preferred_contact_channel TEXT NOT NULL DEFAULT 'email'
        CHECK (preferred_contact_channel IN ('email', 'phone', 'whatsapp', 'slack')),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    sla_due_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_requests_status_domain
    ON public.support_requests(status, domain, priority, created_at DESC);

-- =============================================================================
-- Onboarding and demo ops
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    checklist_key TEXT NOT NULL,
    title TEXT NOT NULL,
    owner_team TEXT NOT NULL DEFAULT 'white_glove'
        CHECK (owner_team IN ('white_glove', 'ops', 'finance', 'success', 'admin')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    notes TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, checklist_key)
);

COMMENT ON TABLE public.operation_events IS 'Evento canonico de observabilidad para operaciones criticas del producto.';
COMMENT ON TABLE public.platform_incidents IS 'Incidentes accionables y reejecutables desde control tower.';
COMMENT ON TABLE public.support_requests IS 'Solicitudes de soporte y onboarding con SLA operativo.';
COMMENT ON TABLE public.country_registry IS 'Registry canonico para markets andinos.';
COMMENT ON TABLE public.provider_adapter_configs IS 'Adapters de providers por pais y dominio funcional.';
COMMENT ON TABLE public.feature_flags IS 'Flags dinamicos para mercados, replay y modos degradados.';

COMMIT;
