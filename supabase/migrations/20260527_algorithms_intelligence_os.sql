-- KargaX P0 Algorithms Intelligence OS.
-- Stores read-only score snapshots, executive alerts and feedback events.
-- No wallet, Mercado Pago, payout or billing mutation is introduced here.

BEGIN;

CREATE TABLE IF NOT EXISTS public.algorithm_score_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    module TEXT NOT NULL CHECK (module IN (
        'lastmile',
        'evidence',
        'reports',
        'warehouse',
        'billing',
        'marketplace',
        'private_fleet'
    )),
    algorithm_key TEXT NOT NULL,
    score NUMERIC(6, 2),
    risk_level TEXT CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high', 'critical')),
    output JSONB NOT NULL DEFAULT '{}'::JSONB,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.algorithm_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.algorithm_feedback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    algorithm_key TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('offer', 'alert', 'action', 'report', 'warehouse', 'business')),
    entity_id TEXT NOT NULL,
    feedback TEXT NOT NULL CHECK (feedback IN ('useful', 'not_useful', 'wrong', 'resolved', 'dismissed')),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_algorithm_score_snapshots_business_module_time
    ON public.algorithm_score_snapshots(business_id, module, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_algorithm_score_snapshots_offer
    ON public.algorithm_score_snapshots(offer_id, algorithm_key, computed_at DESC)
    WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_algorithm_alerts_business_status_severity
    ON public.algorithm_alerts(business_id, status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_algorithm_alerts_offer
    ON public.algorithm_alerts(offer_id, status, created_at DESC)
    WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_algorithm_feedback_events_business_algorithm
    ON public.algorithm_feedback_events(business_id, algorithm_key, created_at DESC);

DROP TRIGGER IF EXISTS trg_algorithm_alerts_updated_at ON public.algorithm_alerts;
CREATE TRIGGER trg_algorithm_alerts_updated_at
    BEFORE UPDATE ON public.algorithm_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.algorithm_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algorithm_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algorithm_feedback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS algorithm_score_snapshots_select_business ON public.algorithm_score_snapshots;
CREATE POLICY algorithm_score_snapshots_select_business
    ON public.algorithm_score_snapshots FOR SELECT TO authenticated
    USING (
        business_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = algorithm_score_snapshots.business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
        )
        OR EXISTS (
            SELECT 1
            FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

DROP POLICY IF EXISTS algorithm_alerts_select_business ON public.algorithm_alerts;
CREATE POLICY algorithm_alerts_select_business
    ON public.algorithm_alerts FOR SELECT TO authenticated
    USING (
        business_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = algorithm_alerts.business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
        )
        OR EXISTS (
            SELECT 1
            FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

DROP POLICY IF EXISTS algorithm_feedback_events_select_business ON public.algorithm_feedback_events;
CREATE POLICY algorithm_feedback_events_select_business
    ON public.algorithm_feedback_events FOR SELECT TO authenticated
    USING (
        business_id = auth.uid()
        OR user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = algorithm_feedback_events.business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
        )
        OR EXISTS (
            SELECT 1
            FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

DROP POLICY IF EXISTS algorithm_feedback_events_insert_business ON public.algorithm_feedback_events;
CREATE POLICY algorithm_feedback_events_insert_business
    ON public.algorithm_feedback_events FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND (
            business_id = auth.uid()
            OR EXISTS (
                SELECT 1
                FROM public.business_team_members btm
                WHERE btm.business_id = algorithm_feedback_events.business_id
                  AND btm.user_id = auth.uid()
                  AND btm.status = 'active'
            )
            OR EXISTS (
                SELECT 1
                FROM public.user_profiles up
                WHERE up.id = auth.uid()
                  AND up.user_type = 'admin'
            )
        )
    );

GRANT SELECT ON public.algorithm_score_snapshots TO authenticated;
GRANT SELECT ON public.algorithm_alerts TO authenticated;
GRANT SELECT, INSERT ON public.algorithm_feedback_events TO authenticated;

GRANT ALL ON public.algorithm_score_snapshots TO service_role;
GRANT ALL ON public.algorithm_alerts TO service_role;
GRANT ALL ON public.algorithm_feedback_events TO service_role;

COMMENT ON TABLE public.algorithm_score_snapshots IS
    'Read-only algorithm score history for KargaX operational intelligence.';

COMMENT ON TABLE public.algorithm_alerts IS
    'Executive operational alerts generated by read-only algorithms. No financial mutation is performed.';

COMMENT ON TABLE public.algorithm_feedback_events IS
    'User feedback events for algorithm recommendations and alerts.';

COMMIT;
