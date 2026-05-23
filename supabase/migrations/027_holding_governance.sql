BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.holding_approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holding_account_id UUID NOT NULL REFERENCES public.holding_accounts(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL
        CHECK (request_type IN ('business_link', 'credit_policy', 'wallet_release', 'plan_upgrade', 'ops_exception', 'custom')),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    title TEXT NOT NULL,
    description TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    decided_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    decision_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_holding_approval_requests_updated_at ON public.holding_approval_requests;
CREATE TRIGGER trg_holding_approval_requests_updated_at
    BEFORE UPDATE ON public.holding_approval_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE INDEX IF NOT EXISTS idx_holding_approval_requests_holding_status
    ON public.holding_approval_requests(holding_account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_holding_approval_requests_business
    ON public.holding_approval_requests(business_id, status);

ALTER TABLE public.holding_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Holding members can read approval requests" ON public.holding_approval_requests;
CREATE POLICY "Holding members can read approval requests"
    ON public.holding_approval_requests FOR SELECT TO authenticated
    USING (
        public.user_manages_holding_account(holding_account_id)
        OR EXISTS (
            SELECT 1
            FROM public.holding_account_members ham
            WHERE ham.holding_account_id = holding_approval_requests.holding_account_id
              AND ham.user_id = auth.uid()
              AND ham.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Holding members can create approval requests" ON public.holding_approval_requests;
CREATE POLICY "Holding members can create approval requests"
    ON public.holding_approval_requests FOR INSERT TO authenticated
    WITH CHECK (
        public.user_manages_holding_account(holding_account_id)
        OR EXISTS (
            SELECT 1
            FROM public.holding_account_members ham
            WHERE ham.holding_account_id = holding_approval_requests.holding_account_id
              AND ham.user_id = auth.uid()
              AND ham.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Holding managers can update approval requests" ON public.holding_approval_requests;
CREATE POLICY "Holding managers can update approval requests"
    ON public.holding_approval_requests FOR UPDATE TO authenticated
    USING (
        public.user_manages_holding_account(holding_account_id)
    )
    WITH CHECK (
        public.user_manages_holding_account(holding_account_id)
    );

GRANT SELECT, INSERT, UPDATE ON public.holding_approval_requests TO authenticated;

COMMIT;
