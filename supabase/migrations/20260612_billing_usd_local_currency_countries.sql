-- =============================================================================
-- Billing USD anchors + local currency checkout audit
-- =============================================================================

ALTER TABLE public.billing_plan_payment_attempts
    ADD COLUMN IF NOT EXISTS country_code TEXT,
    ADD COLUMN IF NOT EXISTS currency_code TEXT,
    ADD COLUMN IF NOT EXISTS amount_local NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS amount_usd_anchor NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS fx_rate_usd_to_local NUMERIC(14, 6),
    ADD COLUMN IF NOT EXISTS pricing_source TEXT NOT NULL DEFAULT 'legacy_cop';

DO $$
BEGIN
    ALTER TABLE public.billing_plan_payment_attempts
        DROP CONSTRAINT IF EXISTS billing_plan_payment_attempts_country_code_check;

    ALTER TABLE public.billing_plan_payment_attempts
        ADD CONSTRAINT billing_plan_payment_attempts_country_code_check
        CHECK (country_code IS NULL OR country_code IN ('CO', 'PE', 'BR'));

    ALTER TABLE public.billing_plan_payment_attempts
        DROP CONSTRAINT IF EXISTS billing_plan_payment_attempts_currency_code_check;

    ALTER TABLE public.billing_plan_payment_attempts
        ADD CONSTRAINT billing_plan_payment_attempts_currency_code_check
        CHECK (currency_code IS NULL OR currency_code IN ('COP', 'PEN', 'BRL'));

    ALTER TABLE public.billing_plan_payment_attempts
        DROP CONSTRAINT IF EXISTS billing_plan_payment_attempts_pricing_source_check;

    ALTER TABLE public.billing_plan_payment_attempts
        ADD CONSTRAINT billing_plan_payment_attempts_pricing_source_check
        CHECK (pricing_source IN ('legacy_cop', 'usd_anchor_env_rate', 'legacy_plan_price'));
END $$;

UPDATE public.billing_plan_payment_attempts
SET
    country_code = COALESCE(country_code, 'CO'),
    currency_code = COALESCE(currency_code, 'COP'),
    amount_local = COALESCE(amount_local, amount),
    fx_rate_usd_to_local = COALESCE(fx_rate_usd_to_local, 3650),
    pricing_source = COALESCE(pricing_source, 'legacy_cop')
WHERE
    country_code IS NULL
    OR currency_code IS NULL
    OR amount_local IS NULL
    OR fx_rate_usd_to_local IS NULL
    OR pricing_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_plan_payment_attempts_country_currency_status
    ON public.billing_plan_payment_attempts(country_code, currency_code, status);

INSERT INTO public.feature_flags (key, enabled, description, scope, country_code, payload)
VALUES (
    'billing_plan_local_currency_rollout',
    true,
    'Checkout self-serve de planes con precio USD y cobro local. Ecuador queda fuera hasta proveedor confirmado.',
    'global',
    NULL,
    jsonb_build_object(
        'self_serve_countries', jsonb_build_array('CO', 'PE', 'BR'),
        'excluded_countries', jsonb_build_array('EC'),
        'display_price', 'usd_primary',
        'local_checkout_currencies', jsonb_build_object(
            'CO', 'COP',
            'PE', 'PEN',
            'BR', 'BRL'
        )
    )
)
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    country_code = EXCLUDED.country_code,
    payload = EXCLUDED.payload,
    updated_at = NOW();

COMMENT ON COLUMN public.billing_plan_payment_attempts.country_code IS
    'Pais usado para seleccionar cuenta Mercado Pago y moneda local del checkout de planes.';
COMMENT ON COLUMN public.billing_plan_payment_attempts.currency_code IS
    'Moneda local cobrada en Mercado Pago para el intento de pago del plan.';
COMMENT ON COLUMN public.billing_plan_payment_attempts.amount_local IS
    'Monto local enviado a Mercado Pago; amount se mantiene como compatibilidad historica.';
COMMENT ON COLUMN public.billing_plan_payment_attempts.amount_usd_anchor IS
    'Precio comercial mensual en USD usado como ancla para convertir a moneda local.';
COMMENT ON COLUMN public.billing_plan_payment_attempts.fx_rate_usd_to_local IS
    'Tasa comercial USD a moneda local usada al crear la preferencia.';
COMMENT ON COLUMN public.billing_plan_payment_attempts.pricing_source IS
    'Fuente de calculo del precio local: legacy_cop, usd_anchor_env_rate o legacy_plan_price.';
