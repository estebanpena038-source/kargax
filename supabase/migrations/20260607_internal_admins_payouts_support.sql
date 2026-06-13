BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Internal KargaX staff roles. user_profiles.user_type remains the coarse auth
-- discriminator; this table is the production capability layer.
CREATE TABLE IF NOT EXISTS public.internal_admin_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('ceo', 'internal_admin', 'payout_admin', 'support_admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_internal_admin_memberships_user_status
    ON public.internal_admin_memberships(user_id, status, role);

DROP TRIGGER IF EXISTS trg_internal_admin_memberships_updated_at ON public.internal_admin_memberships;
CREATE TRIGGER trg_internal_admin_memberships_updated_at
    BEFORE UPDATE ON public.internal_admin_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.internal_admin_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_admin_memberships FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_internal_admin_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.internal_admin_memberships iam
        JOIN public.user_profiles up ON up.id = iam.user_id
        WHERE iam.user_id = COALESCE(p_user_id, auth.uid())
          AND iam.role = p_role
          AND iam.status = 'active'
          AND up.user_type = 'admin'
          AND COALESCE(up.is_active, TRUE) = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_any_internal_admin_role(p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.internal_admin_memberships iam
        JOIN public.user_profiles up ON up.id = iam.user_id
        WHERE iam.user_id = COALESCE(p_user_id, auth.uid())
          AND iam.role = ANY(p_roles)
          AND iam.status = 'active'
          AND up.user_type = 'admin'
          AND COALESCE(up.is_active, TRUE) = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Users can read own internal admin membership" ON public.internal_admin_memberships;
CREATE POLICY "Users can read own internal admin membership"
    ON public.internal_admin_memberships FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.has_internal_admin_role(auth.uid(), 'ceo')
    );

DROP POLICY IF EXISTS "CEO can manage internal admin memberships" ON public.internal_admin_memberships;
CREATE POLICY "CEO can manage internal admin memberships"
    ON public.internal_admin_memberships FOR ALL TO authenticated
    USING (public.has_internal_admin_role(auth.uid(), 'ceo'))
    WITH CHECK (public.has_internal_admin_role(auth.uid(), 'ceo'));

-- Support portal upgrade. Keep existing support_requests rows and map legacy
-- states to the new customer-facing vocabulary.
ALTER TABLE public.support_requests
    DROP CONSTRAINT IF EXISTS support_requests_status_check;

UPDATE public.support_requests
SET status = CASE status
    WHEN 'investigating' THEN 'in_progress'
    WHEN 'waiting_customer' THEN 'waiting_user'
    ELSE status
END
WHERE status IN ('investigating', 'waiting_customer');

ALTER TABLE public.support_requests
    ADD CONSTRAINT support_requests_status_check
        CHECK (status IN ('open', 'in_progress', 'waiting_user', 'escalated', 'resolved', 'closed'));

ALTER TABLE public.support_requests
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS escalated_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_business_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_trucker_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_wallet_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolution TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

ALTER TABLE public.support_requests
    DROP CONSTRAINT IF EXISTS support_requests_category_check,
    ADD CONSTRAINT support_requests_category_check
        CHECK (category IN (
            'payment_issue',
            'driver_issue',
            'shipment_issue',
            'account_issue',
            'subscription_issue',
            'platform_bug',
            'wallet_issue',
            'marketplace_issue',
            'security_issue',
            'other'
        ));

CREATE INDEX IF NOT EXISTS idx_support_requests_category_status
    ON public.support_requests(category, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_assigned_to
    ON public.support_requests(assigned_to, status, priority, created_at DESC)
    WHERE assigned_to IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    author_email TEXT,
    author_name TEXT,
    author_role TEXT NOT NULL DEFAULT 'user'
        CHECK (author_role IN ('user', 'support_admin', 'payout_admin', 'internal_admin', 'ceo', 'system')),
    visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'internal')),
    body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created
    ON public.support_ticket_messages(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.support_ticket_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL DEFAULT 'system'
        CHECK (actor_role IN ('user', 'support_admin', 'payout_admin', 'internal_admin', 'ceo', 'system')),
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    previous_priority TEXT,
    new_priority TEXT,
    previous_assignee UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    new_assignee UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket_created
    ON public.support_ticket_events(ticket_id, created_at DESC);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage support requests" ON public.support_requests;
CREATE POLICY "Internal support staff can manage support requests"
    ON public.support_requests FOR ALL TO authenticated
    USING (public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin', 'support_admin']))
    WITH CHECK (public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin', 'support_admin']));

DROP POLICY IF EXISTS "Users can read public support ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users can read public support ticket messages"
    ON public.support_ticket_messages FOR SELECT TO authenticated
    USING (
        visibility = 'public'
        AND EXISTS (
            SELECT 1
            FROM public.support_requests sr
            WHERE sr.id = ticket_id
              AND (
                sr.requested_by = auth.uid()
                OR public.user_can_access_business_profile(sr.business_id)
              )
        )
    );

DROP POLICY IF EXISTS "Users can create public support ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users can create public support ticket messages"
    ON public.support_ticket_messages FOR INSERT TO authenticated
    WITH CHECK (
        visibility = 'public'
        AND author_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.support_requests sr
            WHERE sr.id = ticket_id
              AND (
                sr.requested_by = auth.uid()
                OR public.user_can_access_business_profile(sr.business_id)
              )
        )
    );

DROP POLICY IF EXISTS "Internal support staff can manage ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Internal support staff can manage ticket messages"
    ON public.support_ticket_messages FOR ALL TO authenticated
    USING (public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin', 'support_admin']))
    WITH CHECK (public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin', 'support_admin']));

DROP POLICY IF EXISTS "Internal support staff can manage ticket events" ON public.support_ticket_events;
CREATE POLICY "Internal support staff can manage ticket events"
    ON public.support_ticket_events FOR ALL TO authenticated
    USING (public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin', 'support_admin']))
    WITH CHECK (public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin', 'support_admin']));

-- Keep the existing service-role driven payout pipeline, but make staff access
-- explicit for direct Supabase reads.
DROP POLICY IF EXISTS "Users can view own payout methods" ON public.payout_methods;
CREATE POLICY "Users and payout staff can view payout methods"
    ON public.payout_methods FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin', 'payout_admin'])
    );

DROP POLICY IF EXISTS "Users can view own payout attempts" ON public.payout_attempts;
CREATE POLICY "Users and payout staff can view payout attempts"
    ON public.payout_attempts FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin', 'payout_admin'])
    );

-- Operation observability: internal staff only sees the domains it operates.
ALTER TABLE public.operation_events
    DROP CONSTRAINT IF EXISTS operation_events_domain_check,
    ADD CONSTRAINT operation_events_domain_check
        CHECK (domain IN ('auth', 'payments', 'wallet', 'payouts', 'lending', 'warehouse', 'holding', 'support', 'platform', 'onboarding', 'market'));

ALTER TABLE public.platform_incidents
    DROP CONSTRAINT IF EXISTS platform_incidents_domain_check,
    ADD CONSTRAINT platform_incidents_domain_check
        CHECK (domain IN ('auth', 'payments', 'wallet', 'payouts', 'lending', 'warehouse', 'holding', 'support', 'platform', 'onboarding', 'market'));

DROP POLICY IF EXISTS "Admins can manage operation events" ON public.operation_events;
CREATE POLICY "Internal staff can manage scoped operation events"
    ON public.operation_events FOR ALL TO authenticated
    USING (
        public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin'])
        OR (domain = 'support' AND public.has_internal_admin_role(auth.uid(), 'support_admin'))
        OR (domain IN ('wallet', 'payouts', 'payments') AND public.has_internal_admin_role(auth.uid(), 'payout_admin'))
    )
    WITH CHECK (
        public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin'])
        OR (domain = 'support' AND public.has_internal_admin_role(auth.uid(), 'support_admin'))
        OR (domain IN ('wallet', 'payouts', 'payments') AND public.has_internal_admin_role(auth.uid(), 'payout_admin'))
    );

DROP POLICY IF EXISTS "Admins can manage platform incidents" ON public.platform_incidents;
CREATE POLICY "Internal staff can manage scoped platform incidents"
    ON public.platform_incidents FOR ALL TO authenticated
    USING (
        public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin'])
        OR (domain = 'support' AND public.has_internal_admin_role(auth.uid(), 'support_admin'))
        OR (domain IN ('wallet', 'payouts', 'payments') AND public.has_internal_admin_role(auth.uid(), 'payout_admin'))
    )
    WITH CHECK (
        public.has_any_internal_admin_role(auth.uid(), ARRAY['ceo', 'internal_admin'])
        OR (domain = 'support' AND public.has_internal_admin_role(auth.uid(), 'support_admin'))
        OR (domain IN ('wallet', 'payouts', 'payments') AND public.has_internal_admin_role(auth.uid(), 'payout_admin'))
    );

DROP POLICY IF EXISTS "Admins can manage provider adapter configs" ON public.provider_adapter_configs;
CREATE POLICY "CEO can manage provider adapter configs"
    ON public.provider_adapter_configs FOR ALL TO authenticated
    USING (public.has_internal_admin_role(auth.uid(), 'ceo'))
    WITH CHECK (public.has_internal_admin_role(auth.uid(), 'ceo'));

GRANT SELECT ON public.internal_admin_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_admin_memberships TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.support_ticket_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_messages TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.support_ticket_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_events TO service_role;
GRANT EXECUTE ON FUNCTION public.has_internal_admin_role(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_internal_admin_role(UUID, TEXT[]) TO authenticated, service_role;

COMMENT ON TABLE public.internal_admin_memberships IS
'Capability roles for internal KargaX staff. Do not use user_type=admin alone for production authorization.';

COMMENT ON TABLE public.support_ticket_messages IS
'Public replies and internal notes for support tickets. Internal visibility is never exposed to external users.';

COMMENT ON TABLE public.support_ticket_events IS
'Auditable support ticket state changes, assignments, escalations and resolutions.';

COMMIT;
