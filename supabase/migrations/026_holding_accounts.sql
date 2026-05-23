BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.holding_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    country_code TEXT NOT NULL DEFAULT 'CO',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_holding_accounts_updated_at ON public.holding_accounts;
CREATE TRIGGER trg_holding_accounts_updated_at
    BEFORE UPDATE ON public.holding_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.holding_account_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holding_account_id UUID NOT NULL REFERENCES public.holding_accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    invited_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'analyst'
        CHECK (role IN ('holding_owner', 'finance_admin', 'ops_admin', 'analyst')),
    status TEXT NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'active', 'suspended')),
    invited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (holding_account_id, invited_email),
    UNIQUE (holding_account_id, user_id)
);

DROP TRIGGER IF EXISTS trg_holding_account_members_updated_at ON public.holding_account_members;
CREATE TRIGGER trg_holding_account_members_updated_at
    BEFORE UPDATE ON public.holding_account_members
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.holding_business_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holding_account_id UUID NOT NULL REFERENCES public.holding_accounts(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT 'subsidiary'
        CHECK (relationship_type IN ('parent', 'subsidiary', 'brand', 'operator')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (holding_account_id, business_id),
    UNIQUE (business_id)
);

DROP TRIGGER IF EXISTS trg_holding_business_links_updated_at ON public.holding_business_links;
CREATE TRIGGER trg_holding_business_links_updated_at
    BEFORE UPDATE ON public.holding_business_links
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE INDEX IF NOT EXISTS idx_holding_account_members_holding_status
    ON public.holding_account_members(holding_account_id, status);

CREATE INDEX IF NOT EXISTS idx_holding_account_members_user
    ON public.holding_account_members(user_id);

CREATE INDEX IF NOT EXISTS idx_holding_business_links_holding
    ON public.holding_business_links(holding_account_id);

CREATE OR REPLACE FUNCTION public.user_manages_holding_account(p_holding_account_id UUID)
RETURNS BOOLEAN AS $$
    SELECT
        public.is_admin_user(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.holding_account_members ham
            WHERE ham.holding_account_id = p_holding_account_id
              AND ham.user_id = auth.uid()
              AND ham.status = 'active'
              AND ham.role IN ('holding_owner', 'finance_admin', 'ops_admin')
        );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

WITH seeded_holdings AS (
    INSERT INTO public.holding_accounts (
        legal_name,
        display_name,
        slug,
        created_by
    )
    SELECT
        COALESCE(NULLIF(TRIM(bp.company_name), ''), 'Holding ' || SUBSTRING(bp.user_id::TEXT, 1, 8)),
        COALESCE(NULLIF(TRIM(bp.company_name), ''), 'Holding ' || SUBSTRING(bp.user_id::TEXT, 1, 8)),
        TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(NULLIF(TRIM(bp.company_name), ''), 'holding')), '[^a-z0-9]+', '-', 'g'))
            || '-' ||
            SUBSTRING(REPLACE(bp.user_id::TEXT, '-', ''), 1, 8),
        bp.user_id
    FROM public.business_profiles bp
    ON CONFLICT (slug) DO UPDATE SET
        legal_name = EXCLUDED.legal_name,
        display_name = EXCLUDED.display_name,
        updated_at = NOW()
    RETURNING id, created_by
)
INSERT INTO public.holding_account_members (
    holding_account_id,
    user_id,
    invited_email,
    role,
    status,
    invited_by,
    accepted_at
)
SELECT
    sh.id,
    bp.user_id,
    LOWER(up.email),
    'holding_owner',
    'active',
    bp.user_id,
    NOW()
FROM seeded_holdings sh
JOIN public.business_profiles bp ON bp.user_id = sh.created_by
JOIN public.user_profiles up ON up.id = bp.user_id
ON CONFLICT (holding_account_id, invited_email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    accepted_at = COALESCE(public.holding_account_members.accepted_at, EXCLUDED.accepted_at),
    updated_at = NOW();

INSERT INTO public.holding_business_links (
    holding_account_id,
    business_id,
    relationship_type,
    created_by
)
SELECT
    ha.id,
    bp.user_id,
    'parent',
    bp.user_id
FROM public.business_profiles bp
JOIN public.holding_accounts ha ON ha.created_by = bp.user_id
ON CONFLICT (holding_account_id, business_id) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    updated_at = NOW();

ALTER TABLE public.holding_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holding_account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holding_business_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Holding members can read holding accounts" ON public.holding_accounts;
CREATE POLICY "Holding members can read holding accounts"
    ON public.holding_accounts FOR SELECT TO authenticated
    USING (
        public.user_manages_holding_account(id)
        OR EXISTS (
            SELECT 1
            FROM public.holding_account_members ham
            WHERE ham.holding_account_id = holding_accounts.id
              AND ham.user_id = auth.uid()
              AND ham.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Holding owners can manage holding accounts" ON public.holding_accounts;
CREATE POLICY "Holding owners can manage holding accounts"
    ON public.holding_accounts FOR ALL TO authenticated
    USING (
        public.user_manages_holding_account(id)
        OR created_by = auth.uid()
    )
    WITH CHECK (
        public.is_admin_user(auth.uid())
        OR created_by = auth.uid()
        OR public.user_manages_holding_account(id)
    );

DROP POLICY IF EXISTS "Holding members can read members" ON public.holding_account_members;
CREATE POLICY "Holding members can read members"
    ON public.holding_account_members FOR SELECT TO authenticated
    USING (
        public.user_manages_holding_account(holding_account_id)
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Holding owners can manage members" ON public.holding_account_members;
CREATE POLICY "Holding owners can manage members"
    ON public.holding_account_members FOR ALL TO authenticated
    USING (
        public.user_manages_holding_account(holding_account_id)
        OR user_id = auth.uid()
    )
    WITH CHECK (
        public.user_manages_holding_account(holding_account_id)
    );

DROP POLICY IF EXISTS "Holding members can read business links" ON public.holding_business_links;
CREATE POLICY "Holding members can read business links"
    ON public.holding_business_links FOR SELECT TO authenticated
    USING (
        public.user_manages_holding_account(holding_account_id)
        OR EXISTS (
            SELECT 1
            FROM public.holding_account_members ham
            WHERE ham.holding_account_id = holding_business_links.holding_account_id
              AND ham.user_id = auth.uid()
              AND ham.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Holding owners can manage business links" ON public.holding_business_links;
CREATE POLICY "Holding owners can manage business links"
    ON public.holding_business_links FOR ALL TO authenticated
    USING (
        public.user_manages_holding_account(holding_account_id)
    )
    WITH CHECK (
        public.user_manages_holding_account(holding_account_id)
    );

GRANT SELECT, INSERT, UPDATE ON public.holding_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.holding_account_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holding_business_links TO authenticated;

COMMIT;
