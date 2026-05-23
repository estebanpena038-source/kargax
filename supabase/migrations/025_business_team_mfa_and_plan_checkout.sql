BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.billing_plans
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.billing_plans
    ALTER COLUMN max_warehouses DROP NOT NULL,
    ALTER COLUMN max_internal_users DROP NOT NULL,
    ALTER COLUMN max_monthly_trips DROP NOT NULL;

UPDATE public.billing_plans
SET
    name = CASE
        WHEN code = 'free' THEN 'Free'
        WHEN code = 'growth' THEN 'Pro'
        WHEN code = 'scale' THEN 'Scale'
        ELSE name
    END,
    tagline = CASE
        WHEN code = 'free' THEN 'Valida la operación base con una sola bodega'
        WHEN code = 'growth' THEN 'Multi-bodega con equipo, inventario visual y operaciones premium'
        WHEN code = 'scale' THEN '3PL multi-cliente, automatizacion, API y control avanzado para redes en crecimiento'
        ELSE tagline
    END,
    price_monthly_usd = CASE
        WHEN code = 'growth' THEN 30
        WHEN code = 'scale' THEN 100
        ELSE price_monthly_usd
    END,
    max_warehouses = CASE
        WHEN code = 'free' THEN 1
        WHEN code = 'growth' THEN 5
        WHEN code = 'scale' THEN 25
        ELSE max_warehouses
    END,
    max_internal_users = CASE
        WHEN code = 'free' THEN 2
        WHEN code = 'growth' THEN 20
        WHEN code = 'scale' THEN 100
        ELSE max_internal_users
    END,
    max_monthly_trips = CASE
        WHEN code = 'free' THEN 50
        WHEN code = 'growth' THEN 500
        WHEN code = 'scale' THEN 5000
        ELSE max_monthly_trips
    END,
    includes_inventory = CASE
        WHEN code = 'free' THEN FALSE
        WHEN code = 'growth' THEN TRUE
        WHEN code = 'scale' THEN TRUE
        ELSE includes_inventory
    END,
    includes_locations = CASE
        WHEN code = 'free' THEN FALSE
        WHEN code = 'growth' THEN TRUE
        WHEN code = 'scale' THEN TRUE
        ELSE includes_locations
    END,
    includes_receipts = CASE
        WHEN code = 'free' THEN TRUE
        WHEN code = 'growth' THEN TRUE
        WHEN code = 'scale' THEN TRUE
        ELSE includes_receipts
    END,
    includes_dispatches = CASE
        WHEN code = 'free' THEN TRUE
        WHEN code = 'growth' THEN TRUE
        WHEN code = 'scale' THEN TRUE
        ELSE includes_dispatches
    END,
    includes_analytics = CASE
        WHEN code = 'free' THEN FALSE
        WHEN code = 'growth' THEN TRUE
        WHEN code = 'scale' THEN TRUE
        ELSE includes_analytics
    END,
    includes_api_webhooks = CASE
        WHEN code = 'free' THEN FALSE
        WHEN code = 'growth' THEN FALSE
        WHEN code = 'scale' THEN TRUE
        ELSE includes_api_webhooks
    END,
    includes_multi_client_3pl = CASE
        WHEN code = 'free' THEN FALSE
        WHEN code = 'growth' THEN FALSE
        WHEN code = 'scale' THEN TRUE
        ELSE includes_multi_client_3pl
    END,
    support_tier = CASE
        WHEN code = 'free' THEN 'email'
        WHEN code = 'growth' THEN 'priority'
        WHEN code = 'scale' THEN 'premium'
        ELSE support_tier
    END,
    is_public = CASE
        WHEN code IN ('free', 'growth', 'scale') THEN TRUE
        ELSE FALSE
    END,
    feature_matrix = CASE
        WHEN code = 'free' THEN jsonb_build_object(
            'publicar_cargas', TRUE,
            'pago_custodia', TRUE,
            'pin_pickup_delivery', TRUE,
            'warehouse_team', FALSE,
            'inventory_images', FALSE,
            'warehouse_locations', FALSE,
            'analytics', FALSE
        )
        WHEN code = 'growth' THEN jsonb_build_object(
            'publicar_cargas', TRUE,
            'pago_custodia', TRUE,
            'pin_pickup_delivery', TRUE,
            'warehouse_team', TRUE,
            'inventory_images', TRUE,
            'warehouse_locations', TRUE,
            'analytics', TRUE,
            'control_tower', FALSE,
            'holding_multiempresa', FALSE
        )
        WHEN code = 'scale' THEN jsonb_build_object(
            'publicar_cargas', TRUE,
            'pago_custodia', TRUE,
            'pin_pickup_delivery', TRUE,
            'warehouse_team', TRUE,
            'inventory_images', TRUE,
            'warehouse_locations', TRUE,
            'analytics', TRUE,
            'api_webhooks', TRUE,
            'multi_cliente_3pl', TRUE,
            'control_tower', TRUE,
            'holding_multiempresa', FALSE
        )
        ELSE feature_matrix
    END,
    updated_at = NOW();

INSERT INTO public.billing_plans (
    code,
    name,
    tagline,
    price_monthly_usd,
    max_warehouses,
    max_internal_users,
    max_monthly_trips,
    includes_inventory,
    includes_locations,
    includes_receipts,
    includes_dispatches,
    includes_analytics,
    includes_api_webhooks,
    includes_multi_client_3pl,
    support_tier,
    feature_matrix,
    is_public
)
VALUES (
    'enterprise',
    'Enterprise',
    'Holding multiempresa, control corporativo y capacidad ilimitada para una red logistica completa',
    300,
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
    jsonb_build_object(
        'publicar_cargas', TRUE,
        'pago_custodia', TRUE,
        'pin_pickup_delivery', TRUE,
        'warehouse_team', TRUE,
        'inventory_images', TRUE,
        'warehouse_locations', TRUE,
        'analytics', TRUE,
        'api_webhooks', TRUE,
        'multi_cliente_3pl', TRUE,
        'control_tower', TRUE,
        'holding_multiempresa', TRUE,
        'enterprise_approvals', TRUE,
        'risk_scoring', TRUE
    ),
    TRUE
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    price_monthly_usd = EXCLUDED.price_monthly_usd,
    max_warehouses = EXCLUDED.max_warehouses,
    max_internal_users = EXCLUDED.max_internal_users,
    max_monthly_trips = EXCLUDED.max_monthly_trips,
    includes_inventory = EXCLUDED.includes_inventory,
    includes_locations = EXCLUDED.includes_locations,
    includes_receipts = EXCLUDED.includes_receipts,
    includes_dispatches = EXCLUDED.includes_dispatches,
    includes_analytics = EXCLUDED.includes_analytics,
    includes_api_webhooks = EXCLUDED.includes_api_webhooks,
    includes_multi_client_3pl = EXCLUDED.includes_multi_client_3pl,
    support_tier = EXCLUDED.support_tier,
    feature_matrix = EXCLUDED.feature_matrix,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.business_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator'
        CHECK (role IN ('owner', 'manager', 'operator', 'auditor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'active', 'suspended')),
    invited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, invited_email),
    UNIQUE (business_id, user_id)
);

DROP TRIGGER IF EXISTS trg_business_team_members_updated_at ON public.business_team_members;
CREATE TRIGGER trg_business_team_members_updated_at
    BEFORE UPDATE ON public.business_team_members
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.user_app_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    active_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_app_preferences_updated_at ON public.user_app_preferences;
CREATE TRIGGER trg_user_app_preferences_updated_at
    BEFORE UPDATE ON public.user_app_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.billing_plan_payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL REFERENCES public.billing_plans(code) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'processing', 'failed', 'cancelled', 'refunded')),
    mp_payment_id TEXT,
    mp_preference_id TEXT,
    mp_external_reference TEXT,
    amount NUMERIC(14, 2) NOT NULL,
    gateway_response JSONB,
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_billing_plan_payment_attempts_updated_at ON public.billing_plan_payment_attempts;
CREATE TRIGGER trg_billing_plan_payment_attempts_updated_at
    BEFORE UPDATE ON public.billing_plan_payment_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.user_mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouse_sku_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id UUID NOT NULL REFERENCES public.warehouse_skus(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_team_members_business_status
    ON public.business_team_members(business_id, status);

CREATE INDEX IF NOT EXISTS idx_business_team_members_user
    ON public.business_team_members(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_plan_payment_attempts_business_status
    ON public.billing_plan_payment_attempts(business_id, status);

CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_codes_user
    ON public.user_mfa_recovery_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_sku_images_sku
    ON public.warehouse_sku_images(sku_id, sort_order);

INSERT INTO public.business_team_members (
    business_id,
    user_id,
    invited_email,
    role,
    status,
    invited_by,
    accepted_at
)
SELECT
    bp.user_id,
    bp.user_id,
    LOWER(up.email),
    'owner',
    'active',
    bp.user_id,
    NOW()
FROM public.business_profiles bp
JOIN public.user_profiles up ON up.id = bp.user_id
ON CONFLICT (business_id, invited_email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    role = 'owner',
    status = 'active',
    accepted_at = COALESCE(public.business_team_members.accepted_at, EXCLUDED.accepted_at),
    updated_at = NOW();

INSERT INTO public.user_app_preferences (user_id, active_warehouse_id)
SELECT DISTINCT ON (wm.user_id)
    wm.user_id,
    wm.warehouse_id
FROM public.warehouse_members wm
WHERE wm.user_id IS NOT NULL
ORDER BY wm.user_id, wm.created_at ASC, wm.warehouse_id ASC
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
    'warehouse-sku-images',
    'warehouse-sku-images',
    TRUE,
    8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]
WHERE NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'warehouse-sku-images'
);

ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plan_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_sku_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Businesses can manage team members" ON public.business_team_members;
CREATE POLICY "Businesses can manage team members"
    ON public.business_team_members FOR ALL TO authenticated
    USING (
        public.user_manages_business(business_id)
        OR user_id = auth.uid()
    )
    WITH CHECK (
        public.user_manages_business(business_id)
    );

DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_app_preferences;
CREATE POLICY "Users manage own preferences"
    ON public.user_app_preferences FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own recovery codes" ON public.user_mfa_recovery_codes;
CREATE POLICY "Users manage own recovery codes"
    ON public.user_mfa_recovery_codes FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Businesses can read plan payment attempts" ON public.billing_plan_payment_attempts;
CREATE POLICY "Businesses can read plan payment attempts"
    ON public.billing_plan_payment_attempts FOR SELECT TO authenticated
    USING (
        public.user_manages_business(business_id)
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = billing_plan_payment_attempts.business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Businesses can manage sku images" ON public.warehouse_sku_images;
CREATE POLICY "Businesses can manage sku images"
    ON public.warehouse_sku_images FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.warehouse_skus sku
            WHERE sku.id = warehouse_sku_images.sku_id
              AND public.user_manages_business(sku.business_id)
        )
        OR EXISTS (
            SELECT 1
            FROM public.warehouse_skus sku
            JOIN public.business_team_members btm
              ON btm.business_id = sku.business_id
            WHERE sku.id = warehouse_sku_images.sku_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.warehouse_skus sku
            WHERE sku.id = warehouse_sku_images.sku_id
              AND public.user_manages_business(sku.business_id)
        )
        OR EXISTS (
            SELECT 1
            FROM public.warehouse_skus sku
            JOIN public.business_team_members btm
              ON btm.business_id = sku.business_id
            WHERE sku.id = warehouse_sku_images.sku_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.business_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_app_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_mfa_recovery_codes TO authenticated;
GRANT SELECT ON public.billing_plan_payment_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_sku_images TO authenticated;

COMMIT;
