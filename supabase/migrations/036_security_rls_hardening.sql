BEGIN;

CREATE OR REPLACE FUNCTION public.user_can_access_business_profile(p_business_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.business_profiles bp
        WHERE bp.id = p_business_profile_id
          AND (
              bp.user_id = auth.uid()
              OR public.is_admin_user(auth.uid())
              OR EXISTS (
                  SELECT 1
                  FROM public.business_team_members btm
                  WHERE btm.business_id = bp.user_id
                    AND btm.user_id = auth.uid()
                    AND btm.status = 'active'
              )
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_business_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_business_profile(UUID) TO service_role;

ALTER TABLE public.country_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_adapter_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.country_registry FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_incidents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_adapter_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read visible countries" ON public.country_registry;
CREATE POLICY "Public can read visible countries"
    ON public.country_registry FOR SELECT TO anon, authenticated
    USING (is_visible = TRUE);

DROP POLICY IF EXISTS "Admins can manage country registry" ON public.country_registry;
CREATE POLICY "Admins can manage country registry"
    ON public.country_registry FOR ALL TO authenticated
    USING (public.is_admin_user(auth.uid()))
    WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage feature flags" ON public.feature_flags;
CREATE POLICY "Admins can manage feature flags"
    ON public.feature_flags FOR ALL TO authenticated
    USING (public.is_admin_user(auth.uid()))
    WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Business users can read onboarding items" ON public.onboarding_checklist_items;
CREATE POLICY "Business users can read onboarding items"
    ON public.onboarding_checklist_items FOR SELECT TO authenticated
    USING (public.user_can_access_business_profile(business_id));

DROP POLICY IF EXISTS "Admins can manage onboarding items" ON public.onboarding_checklist_items;
CREATE POLICY "Admins can manage onboarding items"
    ON public.onboarding_checklist_items FOR ALL TO authenticated
    USING (public.is_admin_user(auth.uid()))
    WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage operation events" ON public.operation_events;
CREATE POLICY "Admins can manage operation events"
    ON public.operation_events FOR ALL TO authenticated
    USING (public.is_admin_user(auth.uid()))
    WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage platform incidents" ON public.platform_incidents;
CREATE POLICY "Admins can manage platform incidents"
    ON public.platform_incidents FOR ALL TO authenticated
    USING (public.is_admin_user(auth.uid()))
    WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage provider adapter configs" ON public.provider_adapter_configs;
CREATE POLICY "Admins can manage provider adapter configs"
    ON public.provider_adapter_configs FOR ALL TO authenticated
    USING (public.is_admin_user(auth.uid()))
    WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Users can read own support requests" ON public.support_requests;
CREATE POLICY "Users can read own support requests"
    ON public.support_requests FOR SELECT TO authenticated
    USING (
        requested_by = auth.uid()
        OR public.user_can_access_business_profile(business_id)
    );

DROP POLICY IF EXISTS "Users can create own support requests" ON public.support_requests;
CREATE POLICY "Users can create own support requests"
    ON public.support_requests FOR INSERT TO authenticated
    WITH CHECK (
        requested_by = auth.uid()
        OR public.user_can_access_business_profile(business_id)
    );

DROP POLICY IF EXISTS "Admins can manage support requests" ON public.support_requests;
CREATE POLICY "Admins can manage support requests"
    ON public.support_requests FOR ALL TO authenticated
    USING (public.is_admin_user(auth.uid()))
    WITH CHECK (public.is_admin_user(auth.uid()));

GRANT SELECT ON public.country_registry TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_adapter_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_requests TO authenticated;

COMMENT ON FUNCTION public.user_can_access_business_profile(UUID) IS
'Checks whether auth.uid() owns, administers, or is an active team member for a business_profiles row.';

COMMIT;
