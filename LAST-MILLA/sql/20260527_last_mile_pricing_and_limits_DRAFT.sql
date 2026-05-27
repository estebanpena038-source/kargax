-- =============================================================================
-- KARGAX - MIGRATION DRAFT: LAST-MILE PRICING AND PLAN LIMITS
-- File suggested: supabase/migrations/20260527_last_mile_pricing_and_limits.sql
--
-- Objetivo:
-- 1. Alinear pricing comercial recomendado:
--    Free 0 / 50 viajes
--    Growth 299.000 COP / 500 viajes
--    Scale 799.000 COP / 2.000 viajes
--    Enterprise desde 2.500.000 COP / volumen personalizado
-- 2. Agregar feature flags de Control de Margen Last-Mile en billing_plans.feature_matrix.
-- 3. No tocar pagos, wallet, Mercado Pago ni suscripciones activas salvo lectura de plan_code.
-- =============================================================================

BEGIN;

-- Asegurar columnas modernas sin romper instalaciones anteriores.
ALTER TABLE public.billing_plans
    ADD COLUMN IF NOT EXISTS price_monthly_cop NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS billing_currency_code TEXT DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS max_private_fleet_drivers INTEGER;

-- Normalizar moneda.
UPDATE public.billing_plans
SET billing_currency_code = 'COP'
WHERE billing_currency_code IS NULL;

-- Upsert idempotente de los planes comerciales actuales.
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
    support_tier,
    is_public,
    feature_matrix
)
VALUES
(
    'free',
    'Free',
    'Acceso operativo gratis para validar evidencia esencial y hasta 50 viajes/mes.',
    0,
    0,
    'COP',
    1,
    3,
    50,
    3,
    FALSE,
    FALSE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    'email',
    TRUE,
    jsonb_build_object(
        'publicar_cargas', TRUE,
        'pago_custodia', TRUE,
        'pin_pickup_delivery', TRUE,
        'picking_evidencia', TRUE,
        'wallet_admin', 'basic',
        'private_fleet', TRUE,
        'private_fleet_driver_limit', 3,
        'last_mile_margin_control', FALSE,
        'last_mile_margin_dashboard', FALSE,
        'last_mile_margin_read_only', FALSE,
        'last_mile_teaser', FALSE,
        'last_mile_contracts', FALSE,
        'last_mile_scorecards', FALSE,
        'last_mile_alerts', FALSE,
        'last_mile_renegotiations', FALSE,
        'last_mile_exports', FALSE,
        'last_mile_monthly_alert_limit', 0,
        'last_mile_active_contract_limit', 0
    )
),
(
    'growth',
    'Growth',
    'Operación B2B inicial con evidencia, bodegas base, flota privada y 500 viajes/mes.',
    0,
    299000,
    'COP',
    5,
    20,
    500,
    15,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    'priority',
    TRUE,
    jsonb_build_object(
        'publicar_cargas', TRUE,
        'pago_custodia', TRUE,
        'pin_pickup_delivery', TRUE,
        'picking_evidencia', TRUE,
        'wallet_admin', 'complete',
        'private_fleet', TRUE,
        'private_fleet_driver_limit', 15,
        'last_mile_margin_control', FALSE,
        'last_mile_margin_dashboard', FALSE,
        'last_mile_margin_read_only', FALSE,
        'last_mile_teaser', TRUE,
        'last_mile_contracts', FALSE,
        'last_mile_scorecards', FALSE,
        'last_mile_alerts', FALSE,
        'last_mile_renegotiations', FALSE,
        'last_mile_exports', FALSE,
        'last_mile_monthly_alert_limit', 0,
        'last_mile_active_contract_limit', 0
    )
),
(
    'scale',
    'Scale',
    '3PL, API/webhooks, control tower, scorecards básicos y 2.000 viajes/mes.',
    0,
    799000,
    'COP',
    25,
    100,
    2000,
    60,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    'premium',
    TRUE,
    jsonb_build_object(
        'publicar_cargas', TRUE,
        'pago_custodia', TRUE,
        'pin_pickup_delivery', TRUE,
        'picking_evidencia', TRUE,
        'wallet_admin', 'complete',
        'api_webhooks', TRUE,
        'multi_cliente_3pl', TRUE,
        'private_fleet', TRUE,
        'private_fleet_driver_limit', 60,
        'last_mile_margin_control', FALSE,
        'last_mile_margin_dashboard', TRUE,
        'last_mile_margin_read_only', TRUE,
        'last_mile_teaser', TRUE,
        'last_mile_contracts', FALSE,
        'last_mile_scorecards', TRUE,
        'last_mile_alerts', FALSE,
        'last_mile_renegotiations', FALSE,
        'last_mile_exports', FALSE,
        'last_mile_monthly_alert_limit', 0,
        'last_mile_active_contract_limit', 0
    )
),
(
    'enterprise',
    'Enterprise',
    'Volumen personalizado, control de margen, contratos por proveedor, auditoría y soporte premium.',
    0,
    2500000,
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
    'premium',
    TRUE,
    jsonb_build_object(
        'publicar_cargas', TRUE,
        'pago_custodia', TRUE,
        'pin_pickup_delivery', TRUE,
        'picking_evidencia', TRUE,
        'wallet_admin', 'complete',
        'api_webhooks', TRUE,
        'multi_cliente_3pl', TRUE,
        'private_fleet', TRUE,
        'private_fleet_driver_limit', NULL,
        'last_mile_margin_control', TRUE,
        'last_mile_margin_dashboard', TRUE,
        'last_mile_margin_read_only', FALSE,
        'last_mile_teaser', TRUE,
        'last_mile_contracts', TRUE,
        'last_mile_scorecards', TRUE,
        'last_mile_alerts', TRUE,
        'last_mile_renegotiations', FALSE,
        'last_mile_exports', FALSE,
        'last_mile_monthly_alert_limit', 10,
        'last_mile_active_contract_limit', 25,
        'enterprise_margin_os_from_cop', 4500000,
        'enterprise_corporate_min_cop', 8000000,
        'enterprise_corporate_max_cop', 15000000
    )
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
    support_tier = EXCLUDED.support_tier,
    is_public = EXCLUDED.is_public,
    feature_matrix = jsonb_strip_nulls(
        COALESCE(public.billing_plans.feature_matrix, '{}'::jsonb) || EXCLUDED.feature_matrix
    ),
    updated_at = NOW();

COMMIT;

-- Rollback conceptual:
-- 1. Crear migración nueva que restaure price_monthly_cop/limits anteriores.
-- 2. No borrar keys de feature_matrix si ya hay código desplegado leyéndolas; primero desplegar fallback.
-- 3. No modificar business_plan_subscriptions salvo decisión comercial manual.
