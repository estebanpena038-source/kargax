-- =============================================================================
-- KARGAX - PRICING LADDER WITH STARTER AND USD ANCHOR
-- =============================================================================
-- Commercial decision:
-- - COP is the Mercado Pago checkout currency.
-- - USD anchor is the commercial reference for staging/production pricing.
-- - BILLING_PLAN_USD_TO_COP_RATE defaults to 3650 in app runtime.
-- - Enterprise is contact-sales only; do not open self-serve checkout.

BEGIN;

ALTER TABLE public.billing_plans
    ADD COLUMN IF NOT EXISTS price_monthly_cop INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billing_currency_code TEXT NOT NULL DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS max_private_fleet_drivers INTEGER,
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.billing_plans
    ALTER COLUMN max_warehouses DROP NOT NULL,
    ALTER COLUMN max_internal_users DROP NOT NULL,
    ALTER COLUMN max_monthly_trips DROP NOT NULL;

ALTER TABLE public.billing_plans
    DROP CONSTRAINT IF EXISTS billing_plans_billing_currency_code_check;

ALTER TABLE public.billing_plans
    ADD CONSTRAINT billing_plans_billing_currency_code_check
    CHECK (billing_currency_code IN ('COP', 'USD', 'PEN', 'BRL'));

GRANT SELECT ON public.billing_plans TO anon;

DROP POLICY IF EXISTS "Public can read public billing plans" ON public.billing_plans;
CREATE POLICY "Public can read public billing plans"
    ON public.billing_plans FOR SELECT TO anon
    USING (is_public = TRUE);

INSERT INTO public.billing_plans (
    code,
    name,
    tagline,
    price_monthly_usd,
    price_monthly_cop,
    billing_currency_code,
    max_warehouses,
    max_internal_users,
    max_monthly_trips,
    max_private_fleet_drivers,
    includes_inventory,
    includes_locations,
    includes_receipts,
    includes_dispatches,
    includes_analytics,
    includes_api_webhooks,
    includes_multi_client_3pl,
    is_public,
    support_tier,
    feature_matrix,
    updated_at
)
VALUES
(
    'free',
    'Free',
    'Validar evidencia, PIN/POD, bodega base y hasta 50 viajes al mes.',
    0,
    0,
    'COP',
    1,
    2,
    50,
    3,
    FALSE,
    FALSE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    TRUE,
    'email',
    jsonb_build_object(
        'billing_price_mode', 'free',
        'usd_anchor', 0,
        'usd_to_cop_rate', 3650,
        'marketplace_commission_percent', 8,
        'evidence', TRUE,
        'pin_pod', TRUE,
        'history_days', 30,
        'exports', FALSE,
        'commercial_position', 'trial_base'
    ),
    NOW()
),
(
    'starter',
    'Starter',
    'Primer equipo operativo: mas capacidad que Free sin comprar un sistema grande.',
    20,
    73000,
    'COP',
    2,
    5,
    150,
    8,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    TRUE,
    'email',
    jsonb_build_object(
        'billing_price_mode', 'usd_anchor',
        'usd_anchor', 20,
        'usd_to_cop_rate', 3650,
        'marketplace_commission_percent', 8,
        'evidence', TRUE,
        'pin_pod', TRUE,
        'inventory_visual', TRUE,
        'receipts', TRUE,
        'dispatches', TRUE,
        'analytics_base', TRUE,
        'exports', 'basic',
        'commercial_position', 'entry_paid'
    ),
    NOW()
),
(
    'growth',
    'Growth',
    'Plan recomendado para operaciones con despachos diarios y equipo interno.',
    100,
    365000,
    'COP',
    5,
    20,
    750,
    25,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    TRUE,
    'priority',
    jsonb_build_object(
        'billing_price_mode', 'usd_anchor',
        'usd_anchor', 100,
        'usd_to_cop_rate', 3650,
        'marketplace_commission_percent', 8,
        'evidence', TRUE,
        'pin_pod', TRUE,
        'inventory_visual', TRUE,
        'receipts', TRUE,
        'dispatches', TRUE,
        'analytics_base', TRUE,
        'exports', 'business',
        'paywall_anchor', TRUE,
        'commercial_position', 'recommended'
    ),
    NOW()
),
(
    'scale',
    'Scale',
    'Alto volumen con mas bodega, flota, reportes y automatizacion por API.',
    299,
    1091000,
    'COP',
    15,
    60,
    3000,
    100,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    TRUE,
    'premium',
    jsonb_build_object(
        'billing_price_mode', 'usd_anchor',
        'usd_anchor', 299,
        'usd_to_cop_rate', 3650,
        'marketplace_commission_percent', 8,
        'evidence', TRUE,
        'pin_pod', TRUE,
        'reports', TRUE,
        'exports', TRUE,
        'incidents', TRUE,
        'client_reports', TRUE,
        'api_webhooks', TRUE,
        'control_tower', TRUE,
        'commercial_position', 'scale_operations'
    ),
    NOW()
),
(
    'enterprise',
    'Enterprise',
    'Contrato corporativo para multiempresa, control de margen, auditoria y SLA.',
    1499,
    5471000,
    'COP',
    NULL,
    NULL,
    NULL,
    NULL,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    'premium',
    jsonb_build_object(
        'billing_price_mode', 'usd_anchor',
        'usd_anchor', 1499,
        'usd_to_cop_rate', 3650,
        'starts_at', TRUE,
        'contact_sales_only', TRUE,
        'custom_volume', TRUE,
        'api_webhooks', TRUE,
        'multi_client_3pl', TRUE,
        'holding', TRUE,
        'control_tower', TRUE,
        'last_mile_margin_control', TRUE,
        'treasury', TRUE,
        'audit', TRUE,
        'sla', TRUE,
        'commercial_position', 'enterprise_custom'
    ),
    NOW()
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    price_monthly_usd = EXCLUDED.price_monthly_usd,
    price_monthly_cop = EXCLUDED.price_monthly_cop,
    billing_currency_code = EXCLUDED.billing_currency_code,
    max_warehouses = EXCLUDED.max_warehouses,
    max_internal_users = EXCLUDED.max_internal_users,
    max_monthly_trips = EXCLUDED.max_monthly_trips,
    max_private_fleet_drivers = EXCLUDED.max_private_fleet_drivers,
    includes_inventory = EXCLUDED.includes_inventory,
    includes_locations = EXCLUDED.includes_locations,
    includes_receipts = EXCLUDED.includes_receipts,
    includes_dispatches = EXCLUDED.includes_dispatches,
    includes_analytics = EXCLUDED.includes_analytics,
    includes_api_webhooks = EXCLUDED.includes_api_webhooks,
    includes_multi_client_3pl = EXCLUDED.includes_multi_client_3pl,
    is_public = EXCLUDED.is_public,
    support_tier = EXCLUDED.support_tier,
    feature_matrix = EXCLUDED.feature_matrix,
    updated_at = NOW();

INSERT INTO public.feature_flags (key, enabled, description, scope, country_code, payload)
VALUES
    (
        'pricing_ladder_starter_growth_usd_anchor',
        TRUE,
        'Pricing ladder: Free, Starter USD 20, Growth USD 100, Scale USD 299 and Enterprise contact-sales.',
        'global',
        NULL,
        jsonb_build_object(
            'billing_plan_usd_to_cop_rate', 3650,
            'checkout_currency', 'COP',
            'starter_usd', 20,
            'growth_usd', 100,
            'scale_usd', 299,
            'enterprise_from_usd', 1499
        )
    )
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    payload = EXCLUDED.payload,
    updated_at = NOW();

COMMIT;
