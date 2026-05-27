-- =============================================================================
-- KARGAX - COMMERCIAL PRICING AND RETENTION OS
-- =============================================================================
-- Updates the commercial plan catalog and renames the customer-facing Launch Pilot
-- motion to Acceso Operativo. Existing active business_pilot_flags are preserved.

BEGIN;

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
    'Para probar el cierre operativo base',
    0,
    0,
    'COP',
    1,
    2,
    50,
    3,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    TRUE,
    'email',
    jsonb_build_object(
        'evidence', TRUE,
        'pod', TRUE,
        'history_days', 30,
        'exports', FALSE,
        'commercial_position', 'trial_base'
    ),
    NOW()
),
(
    'growth',
    'Growth',
    'Para operaciones con despachos diarios',
    0,
    299000,
    'COP',
    3,
    10,
    500,
    15,
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
        'evidence', TRUE,
        'pod', TRUE,
        'inventory_visual', TRUE,
        'receipts', TRUE,
        'dispatches', TRUE,
        'analytics_base', TRUE,
        'exports', 'basic',
        'commercial_position', 'best_seller'
    ),
    NOW()
),
(
    'scale',
    'Scale',
    'Para empresas con bodega, flota y alto volumen',
    0,
    799000,
    'COP',
    10,
    30,
    2000,
    50,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    TRUE,
    'premium',
    jsonb_build_object(
        'evidence', TRUE,
        'pod', TRUE,
        'reports', TRUE,
        'exports', TRUE,
        'incidents', TRUE,
        'client_reports', TRUE,
        'commercial_position', 'scale_operations'
    ),
    NOW()
),
(
    'enterprise',
    'Enterprise',
    'Para 3PL, holding, multiempresa y operacion corporativa',
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
    TRUE,
    'premium',
    jsonb_build_object(
        'starts_at', TRUE,
        'custom_volume', TRUE,
        'api_webhooks', TRUE,
        'multi_client_3pl', TRUE,
        'holding', TRUE,
        'control_tower', TRUE,
        'treasury', TRUE,
        'audit', TRUE,
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
        p_created_at + INTERVAL '14 days',
        5,
        20,
        50,
        500,
        'Automatic 14-day Acceso Operativo. Falls back to Free limits after expiry unless a paid plan is active.'
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

INSERT INTO public.notification_sequences (key, audience, trigger_event, title_template, body_template, action_path, delay_hours)
VALUES
    (
        'pilot_expiring_7d',
        'business',
        'pilot_expiring',
        'Tu Acceso Operativo vence pronto',
        'Revisa uso, despachos, viajes y plan recomendado para mantener el flujo sin frenar entregas.',
        '/planes',
        0
    )
ON CONFLICT (key) DO UPDATE SET
    audience = EXCLUDED.audience,
    trigger_event = EXCLUDED.trigger_event,
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    action_path = EXCLUDED.action_path,
    delay_hours = EXCLUDED.delay_hours,
    enabled = TRUE,
    updated_at = NOW();

INSERT INTO public.feature_flags (key, enabled, description, scope, country_code, payload)
VALUES
    (
        'operational_access_14d_enabled',
        TRUE,
        'Enables automatic 14-day Acceso Operativo before Free limits apply.',
        'global',
        NULL,
        jsonb_build_object(
            'operational_access_days', 14,
            'warehouses', 5,
            'internal_users', 20,
            'private_fleet_drivers', 50,
            'monthly_trips', 500
        )
    ),
    (
        'launch_pilot_60d_enabled',
        TRUE,
        'Legacy flag retained for compatibility. Customer-facing motion is Acceso Operativo for 14 days.',
        'global',
        NULL,
        jsonb_build_object(
            'operational_access_days', 14,
            'legacy_key', TRUE,
            'warehouses', 5,
            'internal_users', 20,
            'private_fleet_drivers', 50,
            'monthly_trips', 500
        )
    ),
    (
        'pilot_generous_limits',
        TRUE,
        'Limites altos temporales para Acceso Operativo con expiracion controlada.',
        'global',
        NULL,
        jsonb_build_object('default_days', 14)
    )
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    payload = EXCLUDED.payload,
    updated_at = NOW();

COMMIT;
