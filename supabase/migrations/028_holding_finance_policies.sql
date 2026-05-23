BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.holding_finance_policies (
    holding_account_id UUID PRIMARY KEY REFERENCES public.holding_accounts(id) ON DELETE CASCADE,
    max_single_advance_cop NUMERIC(15,2) NOT NULL DEFAULT 800000.00 CHECK (max_single_advance_cop >= 0),
    max_portfolio_exposure_cop NUMERIC(15,2) NOT NULL DEFAULT 50000000.00 CHECK (max_portfolio_exposure_cop >= 0),
    wallet_release_limit_cop NUMERIC(15,2) NOT NULL DEFAULT 5000000.00 CHECK (wallet_release_limit_cop >= 0),
    auto_approve_plan_upgrades_until_usd NUMERIC(12,2) NOT NULL DEFAULT 300.00 CHECK (auto_approve_plan_upgrades_until_usd >= 0),
    allow_high_risk_operations BOOLEAN NOT NULL DEFAULT FALSE,
    allow_critical_risk_operations BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_holding_finance_policies_updated_at ON public.holding_finance_policies;
CREATE TRIGGER trg_holding_finance_policies_updated_at
    BEFORE UPDATE ON public.holding_finance_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

INSERT INTO public.holding_finance_policies (holding_account_id)
SELECT id
FROM public.holding_accounts
ON CONFLICT (holding_account_id) DO NOTHING;

ALTER TABLE public.holding_finance_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Holding members can read finance policies" ON public.holding_finance_policies;
CREATE POLICY "Holding members can read finance policies"
    ON public.holding_finance_policies FOR SELECT TO authenticated
    USING (
        public.user_manages_holding_account(holding_account_id)
        OR EXISTS (
            SELECT 1
            FROM public.holding_account_members ham
            WHERE ham.holding_account_id = holding_finance_policies.holding_account_id
              AND ham.user_id = auth.uid()
              AND ham.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Holding managers can manage finance policies" ON public.holding_finance_policies;
CREATE POLICY "Holding managers can manage finance policies"
    ON public.holding_finance_policies FOR ALL TO authenticated
    USING (
        public.user_manages_holding_account(holding_account_id)
    )
    WITH CHECK (
        public.user_manages_holding_account(holding_account_id)
    );

GRANT SELECT, INSERT, UPDATE ON public.holding_finance_policies TO authenticated;

COMMIT;
