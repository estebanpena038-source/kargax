-- =============================================================================
-- KARGAX - LAUNCH PILOT, COP PRICING, PAYWALL LIMITS AND CEO ACCESS
-- =============================================================================
-- Final commercial model for Colombia:
-- - 60-day Launch Pilot for new businesses.
-- - Free remains useful but limited after pilot expiry.
-- - Paid plans are priced in COP for checkout and UI.
-- - Marketplace freight keeps 8% commission; private fleet keeps 0% fee.
-- - Every business owner gets a holding/CEO workspace.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.billing_plans
    ADD COLUMN IF NOT EXISTS price_monthly_cop INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billing_currency_code TEXT NOT NULL DEFAULT 'COP';

ALTER TABLE public.billing_plans
    DROP CONSTRAINT IF EXISTS billing_plans_billing_currency_code_check;

ALTER TABLE public.billing_plans
    ADD CONSTRAINT billing_plans_billing_currency_code_check
    CHECK (billing_currency_code IN ('COP', 'USD', 'PEN', 'BRL'));

UPDATE public.billing_plans
SET
    name = CASE code
        WHEN 'free' THEN 'Free'
        WHEN 'growth' THEN 'Pro'
        WHEN 'scale' THEN 'Scale'
        WHEN 'enterprise' THEN 'Enterprise'
        ELSE name
    END,
    tagline = CASE code
        WHEN 'free' THEN 'Operacion base para mantener evidencia, PIN/POD, despacho simple y wallet esencial.'
        WHEN 'growth' THEN 'Operacion diaria multi-equipo con inventario visual, ubicaciones, despachos y analitica base.'
        WHEN 'scale' THEN 'Red logistica/3PL con multi-cliente, control tower, API, reportes financieros y automatizacion.'
        WHEN 'enterprise' THEN 'Holding multiempresa con aprobaciones, auditoria, risk scoring, treasury y vista CEO.'
        ELSE tagline
    END,
    price_monthly_cop = CASE code
        WHEN 'free' THEN 0
        WHEN 'growth' THEN 149000
        WHEN 'scale' THEN 399000
        WHEN 'enterprise' THEN 1200000
        ELSE price_monthly_cop
    END,
    billing_currency_code = 'COP',
    price_monthly_usd = CASE code
        WHEN 'free' THEN 0
        WHEN 'growth' THEN 37.25
        WHEN 'scale' THEN 99.75
        WHEN 'enterprise' THEN 300
        ELSE price_monthly_usd
    END,
    max_warehouses = CASE code
        WHEN 'free' THEN 1
        WHEN 'growth' THEN 5
        WHEN 'scale' THEN 25
        WHEN 'enterprise' THEN NULL
        ELSE max_warehouses
    END,
    max_internal_users = CASE code
        WHEN 'free' THEN 3
        WHEN 'growth' THEN 20
        WHEN 'scale' THEN 100
        WHEN 'enterprise' THEN NULL
        ELSE max_internal_users
    END,
    max_monthly_trips = CASE code
        WHEN 'free' THEN 25
        WHEN 'growth' THEN 500
        WHEN 'scale' THEN 5000
        WHEN 'enterprise' THEN NULL
        ELSE max_monthly_trips
    END,
    max_private_fleet_drivers = CASE code
        WHEN 'free' THEN 3
        WHEN 'growth' THEN 20
        WHEN 'scale' THEN NULL
        WHEN 'enterprise' THEN NULL
        ELSE max_private_fleet_drivers
    END,
    includes_inventory = CASE WHEN code IN ('growth', 'scale', 'enterprise') THEN TRUE ELSE FALSE END,
    includes_locations = CASE WHEN code IN ('growth', 'scale', 'enterprise') THEN TRUE ELSE FALSE END,
    includes_receipts = TRUE,
    includes_dispatches = TRUE,
    includes_analytics = CASE WHEN code IN ('growth', 'scale', 'enterprise') THEN TRUE ELSE FALSE END,
    includes_api_webhooks = CASE WHEN code IN ('scale', 'enterprise') THEN TRUE ELSE FALSE END,
    includes_multi_client_3pl = CASE WHEN code IN ('scale', 'enterprise') THEN TRUE ELSE FALSE END,
    support_tier = CASE
        WHEN code = 'free' THEN 'email'
        WHEN code = 'growth' THEN 'priority'
        WHEN code IN ('scale', 'enterprise') THEN 'premium'
        ELSE support_tier
    END,
    is_public = TRUE,
    feature_matrix = jsonb_strip_nulls(
        COALESCE(feature_matrix, '{}'::jsonb)
        || CASE code
            WHEN 'free' THEN jsonb_build_object(
                'price_monthly_cop', 0,
                'billing_currency_code', 'COP',
                'iva_notice', '+ IVA si aplica',
                'publicar_cargas', TRUE,
                'marketplace_commission_percent', 8,
                'pago_custodia', TRUE,
                'pin_pickup_delivery', TRUE,
                'dispatch_simple', TRUE,
                'wallet_admin', 'basic',
                'evidence_basic', TRUE,
                'warehouse_team', TRUE,
                'inventory_images', FALSE,
                'warehouse_locations', FALSE,
                'analytics', FALSE,
                'api_webhooks', FALSE,
                'private_fleet', TRUE,
                'private_fleet_driver_limit', 3,
                'holding_multiempresa', FALSE
            )
            WHEN 'growth' THEN jsonb_build_object(
                'price_monthly_cop', 149000,
                'billing_currency_code', 'COP',
                'iva_notice', '+ IVA si aplica',
                'publicar_cargas', TRUE,
                'marketplace_commission_percent', 8,
                'pago_custodia', TRUE,
                'pin_pickup_delivery', TRUE,
                'dispatch_simple', TRUE,
                'warehouse_team', TRUE,
                'inventory_images', TRUE,
                'warehouse_locations', TRUE,
                'analytics', TRUE,
                'control_tower', FALSE,
                'api_webhooks', FALSE,
                'private_fleet', TRUE,
                'private_fleet_driver_limit', 20,
                'holding_multiempresa', FALSE
            )
            WHEN 'scale' THEN jsonb_build_object(
                'price_monthly_cop', 399000,
                'billing_currency_code', 'COP',
                'iva_notice', '+ IVA si aplica',
                'publicar_cargas', TRUE,
                'marketplace_commission_percent', 8,
                'pago_custodia', TRUE,
                'pin_pickup_delivery', TRUE,
                'warehouse_team', TRUE,
                'inventory_images', TRUE,
                'warehouse_locations', TRUE,
                'analytics', TRUE,
                'control_tower', TRUE,
                'api_webhooks', TRUE,
                'multi_cliente_3pl', TRUE,
                'private_fleet', TRUE,
                'private_fleet_driver_limit', NULL,
                'private_fleet_payroll_api', TRUE,
                'holding_multiempresa', FALSE
            )
            WHEN 'enterprise' THEN jsonb_build_object(
                'price_monthly_cop', 1200000,
                'billing_currency_code', 'COP',
                'iva_notice', '+ IVA si aplica',
                'publicar_cargas', TRUE,
                'marketplace_commission_percent', 8,
                'pago_custodia', TRUE,
                'pin_pickup_delivery', TRUE,
                'warehouse_team', TRUE,
                'inventory_images', TRUE,
                'warehouse_locations', TRUE,
                'analytics', TRUE,
                'control_tower', TRUE,
                'api_webhooks', TRUE,
                'multi_cliente_3pl', TRUE,
                'private_fleet', TRUE,
                'private_fleet_driver_limit', NULL,
                'private_fleet_payroll_api', TRUE,
                'holding_multiempresa', TRUE,
                'enterprise_approvals', TRUE,
                'risk_scoring', TRUE,
                'ceo_control_tower', TRUE,
                'treasury', TRUE
            )
            ELSE '{}'::jsonb
        END
    ),
    updated_at = NOW()
WHERE code IN ('free', 'growth', 'scale', 'enterprise');

COMMENT ON COLUMN public.billing_plans.price_monthly_cop IS
    'Canonical monthly SaaS price for Colombia checkout and UI. price_monthly_usd is legacy compatibility only.';

COMMENT ON COLUMN public.billing_plans.billing_currency_code IS
    'Canonical billing currency for the SaaS plan price.';

CREATE OR REPLACE FUNCTION public.marketplace_commission_percent()
RETURNS NUMERIC AS $$
    SELECT 8::NUMERIC;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION public.marketplace_commission_percent IS
    'Canonical KargaX marketplace freight commission percentage. Private fleet trips stay at 0%.';

CREATE OR REPLACE FUNCTION public.create_payment(
    p_offer_id UUID,
    p_payer_id UUID,
    p_subtotal DECIMAL,
    p_platform_fee_percent DECIMAL DEFAULT public.marketplace_commission_percent()
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_platform_fee DECIMAL;
    v_total DECIMAL;
BEGIN
    v_platform_fee := ROUND(p_subtotal * COALESCE(p_platform_fee_percent, public.marketplace_commission_percent()) / 100, 2);
    v_total := p_subtotal + v_platform_fee;

    INSERT INTO public.payments (
        offer_id, payer_id, subtotal, platform_fee, total_amount
    ) VALUES (
        p_offer_id, p_payer_id, p_subtotal, v_platform_fee, v_total
    ) RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.ensure_business_launch_pilot(
    p_business_id UUID,
    p_created_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.business_pilot_flags (
        business_id,
        enabled,
        pilot_expires_at,
        max_warehouses,
        max_internal_users,
        max_private_fleet_drivers,
        max_monthly_trips,
        notes
    )
    VALUES (
        p_business_id,
        TRUE,
        p_created_at + INTERVAL '60 days',
        5,
        20,
        50,
        500,
        'Automatic 60-day Launch Pilot. Falls back to Free limits after expiry unless a paid plan is active.'
    )
    ON CONFLICT (business_id) DO UPDATE SET
        enabled = CASE
            WHEN public.business_pilot_flags.pilot_expires_at IS NULL
              OR public.business_pilot_flags.pilot_expires_at < NOW()
            THEN EXCLUDED.enabled
            ELSE public.business_pilot_flags.enabled
        END,
        pilot_expires_at = CASE
            WHEN public.business_pilot_flags.pilot_expires_at IS NULL
              OR public.business_pilot_flags.pilot_expires_at < NOW()
            THEN EXCLUDED.pilot_expires_at
            ELSE public.business_pilot_flags.pilot_expires_at
        END,
        max_warehouses = COALESCE(public.business_pilot_flags.max_warehouses, EXCLUDED.max_warehouses),
        max_internal_users = COALESCE(public.business_pilot_flags.max_internal_users, EXCLUDED.max_internal_users),
        max_private_fleet_drivers = COALESCE(public.business_pilot_flags.max_private_fleet_drivers, EXCLUDED.max_private_fleet_drivers),
        max_monthly_trips = COALESCE(public.business_pilot_flags.max_monthly_trips, EXCLUDED.max_monthly_trips),
        notes = COALESCE(public.business_pilot_flags.notes, EXCLUDED.notes),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_launch_pilot_for_business()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.ensure_business_launch_pilot(NEW.user_id, COALESCE(NEW.created_at, NOW()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_launch_pilot_for_business ON public.business_profiles;
CREATE TRIGGER trg_create_launch_pilot_for_business
    AFTER INSERT ON public.business_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_launch_pilot_for_business();

INSERT INTO public.business_pilot_flags (
    business_id,
    enabled,
    pilot_expires_at,
    max_warehouses,
    max_internal_users,
    max_private_fleet_drivers,
    max_monthly_trips,
    notes
)
SELECT
    bp.user_id,
    TRUE,
    COALESCE(bp.created_at, NOW()) + INTERVAL '60 days',
    5,
    20,
    50,
    500,
    'Backfilled Launch Pilot for an existing business created within the last 60 days.'
FROM public.business_profiles bp
LEFT JOIN public.business_plan_subscriptions bps
  ON bps.business_id = bp.user_id
 AND bps.status IN ('active', 'trialing')
 AND bps.plan_code <> 'free'
WHERE COALESCE(bp.created_at, NOW()) >= NOW() - INTERVAL '60 days'
  AND bps.id IS NULL
ON CONFLICT (business_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    pilot_expires_at = GREATEST(
        COALESCE(public.business_pilot_flags.pilot_expires_at, EXCLUDED.pilot_expires_at),
        EXCLUDED.pilot_expires_at
    ),
    max_warehouses = EXCLUDED.max_warehouses,
    max_internal_users = EXCLUDED.max_internal_users,
    max_private_fleet_drivers = EXCLUDED.max_private_fleet_drivers,
    max_monthly_trips = EXCLUDED.max_monthly_trips,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Ensure every business owner has a CEO/holding workspace.
WITH seeded_holdings AS (
    INSERT INTO public.holding_accounts (
        legal_name,
        display_name,
        slug,
        country_code,
        created_by
    )
    SELECT
        COALESCE(NULLIF(TRIM(bp.company_name), ''), 'Holding ' || SUBSTRING(bp.user_id::TEXT, 1, 8)),
        COALESCE(NULLIF(TRIM(bp.company_name), ''), 'Holding ' || SUBSTRING(bp.user_id::TEXT, 1, 8)),
        TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(NULLIF(TRIM(bp.company_name), ''), 'holding')), '[^a-z0-9]+', '-', 'g'))
            || '-' ||
            SUBSTRING(REPLACE(bp.user_id::TEXT, '-', ''), 1, 8),
        COALESCE(bp.country_code, up.country_code, 'CO'),
        bp.user_id
    FROM public.business_profiles bp
    JOIN public.user_profiles up ON up.id = bp.user_id
    ON CONFLICT (slug) DO UPDATE SET
        legal_name = EXCLUDED.legal_name,
        display_name = EXCLUDED.display_name,
        country_code = EXCLUDED.country_code,
        updated_at = NOW()
    RETURNING id, created_by
)
INSERT INTO public.holding_account_members (
    holding_account_id,
    user_id,
    invited_email,
    role,
    status,
    invited_by,
    accepted_at
)
SELECT
    sh.id,
    up.id,
    LOWER(up.email),
    'holding_owner',
    'active',
    up.id,
    NOW()
FROM seeded_holdings sh
JOIN public.user_profiles up ON up.id = sh.created_by
ON CONFLICT (holding_account_id, invited_email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    role = 'holding_owner',
    status = 'active',
    accepted_at = COALESCE(public.holding_account_members.accepted_at, EXCLUDED.accepted_at),
    updated_at = NOW();

INSERT INTO public.holding_business_links (
    holding_account_id,
    business_id,
    relationship_type,
    created_by
)
SELECT
    ha.id,
    bp.user_id,
    'parent',
    bp.user_id
FROM public.business_profiles bp
JOIN public.holding_accounts ha ON ha.created_by = bp.user_id
ON CONFLICT (holding_account_id, business_id) DO UPDATE SET
    relationship_type = 'parent',
    updated_at = NOW();

INSERT INTO public.feature_flags (key, enabled, description, scope, country_code, payload)
VALUES
    (
        'launch_pilot_60d_enabled',
        TRUE,
        'Enables automatic 60-day Launch Pilot before Free limits apply.',
        'global',
        NULL,
        jsonb_build_object(
            'pilot_days', 60,
            'warehouses', 5,
            'internal_users', 20,
            'private_fleet_drivers', 50,
            'monthly_trips', 500
        )
    ),
    (
        'marketplace_commission_8_percent_enabled',
        TRUE,
        'Marketplace freight commission is 8%; private fleet trips have 0% marketplace commission.',
        'global',
        NULL,
        jsonb_build_object('marketplace_commission_percent', 8, 'private_fleet_commission_percent', 0)
    )
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    payload = EXCLUDED.payload,
    updated_at = NOW();

COMMIT;
