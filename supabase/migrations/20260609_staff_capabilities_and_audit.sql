CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.staff_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (
        role IN (
            'platform_owner',
            'ops_manager',
            'support_lead',
            'support_agent',
            'payout_reviewer',
            'payout_approver'
        )
    ),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_staff_memberships_user_status
    ON public.staff_memberships(user_id, status, role);

DROP TRIGGER IF EXISTS trg_staff_memberships_updated_at ON public.staff_memberships;
CREATE TRIGGER trg_staff_memberships_updated_at
    BEFORE UPDATE ON public.staff_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_memberships FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.staff_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    actor_role TEXT,
    capability TEXT,
    target_type TEXT NOT NULL,
    target_id TEXT,
    previous_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_events_target_created
    ON public.staff_audit_events(target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_audit_events_actor_created
    ON public.staff_audit_events(actor_id, created_at DESC);

ALTER TABLE public.staff_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_events FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.staff_role_has_capability(p_role TEXT, p_capability TEXT)
RETURNS BOOLEAN AS $$
    SELECT CASE
        WHEN p_role = 'platform_owner' THEN TRUE
        WHEN p_role = 'ops_manager' THEN p_capability = ANY(ARRAY[
            'admin:overview',
            'advance:read',
            'advance:write',
            'incident:read',
            'incident:write',
            'notification:read',
            'notification:write',
            'payment:reconcile',
            'pin:resend',
            'payout:read',
            'payout:review',
            'payout:approve',
            'payout:mark_paid',
            'support:read',
            'support:reply',
            'support:internal_note',
            'support:assign',
            'support:escalate',
            'support:close'
        ])
        WHEN p_role = 'support_lead' THEN p_capability = ANY(ARRAY[
            'incident:read',
            'incident:write',
            'notification:read',
            'pin:resend',
            'support:read',
            'support:reply',
            'support:internal_note',
            'support:assign',
            'support:escalate',
            'support:close'
        ])
        WHEN p_role = 'support_agent' THEN p_capability = ANY(ARRAY[
            'support:read',
            'support:reply',
            'support:internal_note'
        ])
        WHEN p_role = 'payout_reviewer' THEN p_capability = ANY(ARRAY[
            'notification:read',
            'payout:read',
            'payout:review'
        ])
        WHEN p_role = 'payout_approver' THEN p_capability = ANY(ARRAY[
            'notification:read',
            'payment:reconcile',
            'payout:read',
            'payout:review',
            'payout:approve',
            'payout:mark_paid'
        ])
        ELSE FALSE
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.has_staff_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.staff_memberships sm
        JOIN public.user_profiles up ON up.id = sm.user_id
        WHERE sm.user_id = COALESCE(p_user_id, auth.uid())
          AND sm.role = p_role
          AND sm.status = 'active'
          AND up.user_type::text IN ('staff', 'admin')
          AND COALESCE(up.is_active, TRUE) = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_any_staff_role(p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.staff_memberships sm
        JOIN public.user_profiles up ON up.id = sm.user_id
        WHERE sm.user_id = COALESCE(p_user_id, auth.uid())
          AND sm.role = ANY(p_roles)
          AND sm.status = 'active'
          AND up.user_type::text IN ('staff', 'admin')
          AND COALESCE(up.is_active, TRUE) = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_staff_capability(p_user_id UUID, p_capability TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.staff_memberships sm
        JOIN public.user_profiles up ON up.id = sm.user_id
        WHERE sm.user_id = COALESCE(p_user_id, auth.uid())
          AND sm.status = 'active'
          AND up.user_type::text IN ('staff', 'admin')
          AND COALESCE(up.is_active, TRUE) = TRUE
          AND public.staff_role_has_capability(sm.role, p_capability)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

INSERT INTO public.staff_memberships (user_id, role, status, created_by, updated_by, created_at, updated_at)
SELECT iam.user_id,
       CASE iam.role
           WHEN 'ceo' THEN 'platform_owner'
           WHEN 'internal_admin' THEN 'ops_manager'
           WHEN 'support_admin' THEN 'support_lead'
           WHEN 'payout_admin' THEN 'payout_approver'
       END,
       iam.status,
       iam.created_by,
       iam.updated_by,
       iam.created_at,
       iam.updated_at
FROM public.internal_admin_memberships iam
WHERE iam.role IN ('ceo', 'internal_admin', 'support_admin', 'payout_admin')
ON CONFLICT (user_id, role) DO UPDATE
SET status = EXCLUDED.status,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();

INSERT INTO public.staff_memberships (user_id, role, status, created_by, updated_by, created_at, updated_at)
SELECT iam.user_id,
       'payout_reviewer',
       iam.status,
       iam.created_by,
       iam.updated_by,
       iam.created_at,
       iam.updated_at
FROM public.internal_admin_memberships iam
WHERE iam.role = 'payout_admin'
ON CONFLICT (user_id, role) DO UPDATE
SET status = EXCLUDED.status,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();

UPDATE public.user_profiles up
SET user_type = 'staff'::public.user_type,
    updated_at = NOW()
WHERE up.user_type::text = 'admin'
  AND EXISTS (
      SELECT 1
      FROM public.staff_memberships sm
      WHERE sm.user_id = up.id
        AND sm.status = 'active'
        AND sm.role <> 'platform_owner'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.staff_memberships sm
      WHERE sm.user_id = up.id
        AND sm.status = 'active'
        AND sm.role = 'platform_owner'
  );

DROP POLICY IF EXISTS "Users can read own staff membership" ON public.staff_memberships;
CREATE POLICY "Users can read own staff membership"
    ON public.staff_memberships FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.has_staff_role(auth.uid(), 'platform_owner')
    );

DROP POLICY IF EXISTS "Platform owner can manage staff memberships" ON public.staff_memberships;
CREATE POLICY "Platform owner can manage staff memberships"
    ON public.staff_memberships FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), 'platform_owner'))
    WITH CHECK (public.has_staff_role(auth.uid(), 'platform_owner'));

DROP POLICY IF EXISTS "Staff can read staff audit events" ON public.staff_audit_events;
CREATE POLICY "Staff can read staff audit events"
    ON public.staff_audit_events FOR SELECT TO authenticated
    USING (public.has_staff_capability(auth.uid(), 'platform:critical_settings'));

DROP POLICY IF EXISTS "Staff can insert staff audit events" ON public.staff_audit_events;
CREATE POLICY "Staff can insert staff audit events"
    ON public.staff_audit_events FOR INSERT TO authenticated
    WITH CHECK (actor_id = auth.uid() OR public.has_staff_role(auth.uid(), 'platform_owner'));

DROP POLICY IF EXISTS "Internal support staff can manage support requests" ON public.support_requests;
CREATE POLICY "Staff support can manage support requests"
    ON public.support_requests FOR ALL TO authenticated
    USING (public.has_staff_capability(auth.uid(), 'support:read'))
    WITH CHECK (public.has_staff_capability(auth.uid(), 'support:reply'));

DROP POLICY IF EXISTS "Internal support staff can manage ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Staff support can manage ticket messages"
    ON public.support_ticket_messages FOR ALL TO authenticated
    USING (public.has_staff_capability(auth.uid(), 'support:read'))
    WITH CHECK (
        (visibility = 'public' AND public.has_staff_capability(auth.uid(), 'support:reply'))
        OR (visibility = 'internal' AND public.has_staff_capability(auth.uid(), 'support:internal_note'))
    );

DROP POLICY IF EXISTS "Internal support staff can manage ticket events" ON public.support_ticket_events;
CREATE POLICY "Staff support can manage ticket events"
    ON public.support_ticket_events FOR ALL TO authenticated
    USING (public.has_staff_capability(auth.uid(), 'support:read'))
    WITH CHECK (public.has_staff_capability(auth.uid(), 'support:reply'));

DROP POLICY IF EXISTS "Users and payout staff can view payout methods" ON public.payout_methods;
CREATE POLICY "Users and staff payout can view payout methods"
    ON public.payout_methods FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.has_staff_capability(auth.uid(), 'payout:read')
    );

DROP POLICY IF EXISTS "Users and payout staff can view payout attempts" ON public.payout_attempts;
CREATE POLICY "Users and staff payout can view payout attempts"
    ON public.payout_attempts FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.has_staff_capability(auth.uid(), 'payout:read')
    );

ALTER TABLE public.operation_events
    DROP CONSTRAINT IF EXISTS operation_events_actor_type_check,
    ADD CONSTRAINT operation_events_actor_type_check
        CHECK (actor_type IN ('system', 'user', 'admin', 'staff', 'internal', 'anonymous'));

DROP POLICY IF EXISTS "Internal staff can manage scoped operation events" ON public.operation_events;
CREATE POLICY "Staff can manage scoped operation events"
    ON public.operation_events FOR ALL TO authenticated
    USING (
        public.has_staff_role(auth.uid(), 'platform_owner')
        OR public.has_staff_role(auth.uid(), 'ops_manager')
        OR (domain = 'support' AND public.has_staff_capability(auth.uid(), 'support:reply'))
        OR (domain IN ('wallet', 'payouts', 'payments') AND public.has_staff_capability(auth.uid(), 'payout:review'))
    )
    WITH CHECK (
        public.has_staff_role(auth.uid(), 'platform_owner')
        OR public.has_staff_role(auth.uid(), 'ops_manager')
        OR (domain = 'support' AND public.has_staff_capability(auth.uid(), 'support:reply'))
        OR (domain IN ('wallet', 'payouts', 'payments') AND public.has_staff_capability(auth.uid(), 'payout:review'))
    );

DROP POLICY IF EXISTS "Internal staff can manage scoped platform incidents" ON public.platform_incidents;
CREATE POLICY "Staff can manage scoped platform incidents"
    ON public.platform_incidents FOR ALL TO authenticated
    USING (
        public.has_staff_role(auth.uid(), 'platform_owner')
        OR public.has_staff_role(auth.uid(), 'ops_manager')
        OR (domain = 'support' AND public.has_staff_capability(auth.uid(), 'support:reply'))
        OR (domain IN ('wallet', 'payouts', 'payments') AND public.has_staff_capability(auth.uid(), 'payout:review'))
    )
    WITH CHECK (
        public.has_staff_role(auth.uid(), 'platform_owner')
        OR public.has_staff_role(auth.uid(), 'ops_manager')
        OR (domain = 'support' AND public.has_staff_capability(auth.uid(), 'support:reply'))
        OR (domain IN ('wallet', 'payouts', 'payments') AND public.has_staff_capability(auth.uid(), 'payout:review'))
    );

DROP POLICY IF EXISTS "CEO can manage provider adapter configs" ON public.provider_adapter_configs;
CREATE POLICY "Platform owner can manage provider adapter configs"
    ON public.provider_adapter_configs FOR ALL TO authenticated
    USING (public.has_staff_capability(auth.uid(), 'platform:critical_settings'))
    WITH CHECK (public.has_staff_capability(auth.uid(), 'platform:critical_settings'));

ALTER TABLE public.support_ticket_messages
    DROP CONSTRAINT IF EXISTS support_ticket_messages_author_role_check,
    ADD CONSTRAINT support_ticket_messages_author_role_check
        CHECK (author_role IN (
            'user',
            'platform_owner',
            'ops_manager',
            'support_lead',
            'support_agent',
            'payout_reviewer',
            'payout_approver',
            'ceo',
            'internal_admin',
            'support_admin',
            'payout_admin',
            'system'
        ));

ALTER TABLE public.support_ticket_events
    DROP CONSTRAINT IF EXISTS support_ticket_events_actor_role_check,
    ADD CONSTRAINT support_ticket_events_actor_role_check
        CHECK (actor_role IN (
            'user',
            'platform_owner',
            'ops_manager',
            'support_lead',
            'support_agent',
            'payout_reviewer',
            'payout_approver',
            'ceo',
            'internal_admin',
            'support_admin',
            'payout_admin',
            'system'
        ));

GRANT SELECT ON public.staff_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_memberships TO service_role;
GRANT SELECT, INSERT ON public.staff_audit_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_audit_events TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_role_has_capability(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_staff_role(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_staff_role(UUID, TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_staff_capability(UUID, TEXT) TO authenticated, service_role;

COMMENT ON TABLE public.staff_memberships IS
'Production staff capability memberships. user_type=admin is reserved for CEO/founder; support and payout operators use user_type=staff.';

COMMENT ON TABLE public.internal_admin_memberships IS
'Deprecated compatibility table. Use staff_memberships for production authorization.';

COMMENT ON TABLE public.staff_audit_events IS
'Audit log for internal KargaX staff actions across support, payouts and platform operations.';
