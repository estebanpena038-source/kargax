-- =============================================================================
-- KARGAX - RETENTION, RELEASE GATE AND PRICING/PAYWALLS
-- =============================================================================
-- Sprints 25-27: reputation without lending, accounting exports, notification
-- sequences, release gates, pilot limits and paywall analytics.

CREATE TABLE IF NOT EXISTS public.trucker_scores (
    trucker_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    completed_trips INTEGER NOT NULL DEFAULT 0 CHECK (completed_trips >= 0),
    on_time_deliveries INTEGER NOT NULL DEFAULT 0 CHECK (on_time_deliveries >= 0),
    incident_free_deliveries INTEGER NOT NULL DEFAULT 0 CHECK (incident_free_deliveries >= 0),
    cancellations INTEGER NOT NULL DEFAULT 0 CHECK (cancellations >= 0),
    driver_rejections INTEGER NOT NULL DEFAULT 0 CHECK (driver_rejections >= 0),
    evidence_quality_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (evidence_quality_score >= 0 AND evidence_quality_score <= 100),
    company_rating NUMERIC(3,2) CHECK (company_rating IS NULL OR (company_rating >= 0 AND company_rating <= 5)),
    score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond')),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.trucker_score_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trucker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('trip_completed', 'on_time_delivery', 'incident_free_delivery', 'cancellation', 'driver_rejection', 'evidence_quality', 'company_rating', 'manual_adjustment')),
    score_delta NUMERIC(6,2) NOT NULL DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    audience TEXT NOT NULL CHECK (audience IN ('business', 'trucker', 'admin')),
    trigger_event TEXT NOT NULL,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    action_path TEXT,
    delay_hours INTEGER NOT NULL DEFAULT 0 CHECK (delay_hours >= 0),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_key TEXT NOT NULL REFERENCES public.notification_sequences(key) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    dedupe_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'skipped', 'failed')),
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp', 'push')),
    action_path TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.report_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('business_monthly_accounting', 'pilot_usage', 'payout_reconciliation')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('queued', 'generated', 'failed')),
    format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'pdf', 'csv')),
    storage_path TEXT,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.release_gate_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment TEXT NOT NULL,
    gate_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
    detail TEXT,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.business_pilot_flags (
    business_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    pilot_expires_at TIMESTAMPTZ,
    max_warehouses INTEGER,
    max_internal_users INTEGER,
    max_private_fleet_drivers INTEGER,
    max_monthly_trips INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.paywall_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    feature_key TEXT NOT NULL,
    plan_code TEXT,
    current_usage INTEGER,
    limit_value INTEGER,
    recommended_plan TEXT,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.notification_sequences (key, audience, trigger_event, title_template, body_template, action_path, delay_hours)
VALUES
    ('business_day_1_publish_first_load', 'business', 'business_created', 'Publica tu primera carga', 'Crea una ruta real y conecta pago, manifiesto y POD desde KargaX.', '/ofertas/publicar', 24),
    ('business_dispatch_ready_create_trip', 'business', 'dispatch_ready', 'Despacho listo para viaje', 'Convierte el despacho en viaje de flota privada o marketplace.', '/bodegas', 0),
    ('trucker_payment_settled', 'trucker', 'payment_settled', 'Pago liquidado', 'Tu saldo operativo fue actualizado. Revisa tu wallet y solicita retiro si aplica.', '/billetera', 0),
    ('trucker_reputation_tier_changed', 'trucker', 'tier_changed', 'Nuevo nivel de reputacion', 'Tu historial operativo mejoro. Revisa tu nivel y postulaciones.', '/billetera', 0),
    ('pilot_expiring_7d', 'business', 'pilot_expiring', 'Tu piloto vence pronto', 'Revisa uso, despachos, viajes y plan recomendado para mantener limites altos.', '/planes', 0)
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
    ('wms_dispatch_trip_enabled', true, 'Permite convertir despachos WMS en viajes/ofertas.', 'global', NULL, '{}'::jsonb),
    ('ceo_control_tower_enabled', true, 'Activa metricas CEO/admin global.', 'global', NULL, '{}'::jsonb),
    ('release_gate_required', true, 'Bloquea releases si falla el gate minimo.', 'global', NULL, '{}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    payload = EXCLUDED.payload,
    updated_at = NOW();

ALTER TABLE public.trucker_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucker_score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_gate_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_pilot_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paywall_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.trucker_scores TO authenticated;
GRANT SELECT ON public.trucker_score_events TO authenticated;
GRANT SELECT ON public.notification_sequences TO authenticated;
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT SELECT ON public.report_exports TO authenticated;
GRANT SELECT ON public.release_gate_checks TO authenticated;
GRANT SELECT ON public.business_pilot_flags TO authenticated;
GRANT SELECT ON public.paywall_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trucker_scores TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.trucker_score_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.notification_deliveries TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.report_exports TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.release_gate_checks TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.business_pilot_flags TO service_role;
GRANT SELECT, INSERT ON public.paywall_events TO service_role;
