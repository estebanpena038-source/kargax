-- =============================================================================
-- KARGAX - PILOT FEATURE FLAGS
-- =============================================================================
-- Sprint 17/18/21: pause lending for pilot and expose explicit pilot flags.

INSERT INTO public.feature_flags (key, enabled, description, scope, country_code, payload)
VALUES
    (
        'lending_enabled',
        false,
        'Habilita adelantos/credito KargaX. Pausado para piloto.',
        'global',
        NULL,
        jsonb_build_object('paused_reason', 'pilot_focus', 'decision_date', '2026-05-19')
    ),
    (
        'pilot_generous_limits',
        true,
        'Limites generosos para cuentas piloto con expiracion controlada.',
        'global',
        NULL,
        jsonb_build_object('default_days', 90)
    ),
    (
        'automatic_payouts_enabled',
        false,
        'Habilita retiros automaticos cuando los adaptadores Wompi/Nequi esten listos.',
        'global',
        NULL,
        jsonb_build_object('providers', jsonb_build_array('wompi', 'nequi'), 'fallback', 'manual_review')
    )
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    country_code = EXCLUDED.country_code,
    payload = EXCLUDED.payload,
    updated_at = NOW();
