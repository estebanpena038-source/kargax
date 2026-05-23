-- =============================================================================
-- KARGAX - PRIVATE FLEET PAYROLL
-- =============================================================================
-- Adds monthly private-fleet payroll as a separate financial rail from routes.
-- KargaX keeps the ledger and workflow; regulated partners move/custody funds.

DO $$ BEGIN
    ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'private_fleet_salary';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.business_fleet_members
    ADD COLUMN IF NOT EXISTS default_compensation_mode TEXT NOT NULL DEFAULT 'salary_no_trip_pay'
        CHECK (
            default_compensation_mode IN (
                'salary_no_trip_pay',
                'trip_pay',
                'expenses_only',
                'trip_pay_plus_expenses'
            )
        ),
    ADD COLUMN IF NOT EXISTS monthly_salary_amount DECIMAL(15,2) NOT NULL DEFAULT 0
        CHECK (monthly_salary_amount >= 0),
    ADD COLUMN IF NOT EXISTS monthly_salary_currency TEXT NOT NULL DEFAULT 'COP'
        CHECK (monthly_salary_currency IN ('COP', 'USD', 'PEN', 'BRL')),
    ADD COLUMN IF NOT EXISTS payroll_day INTEGER NOT NULL DEFAULT 30
        CHECK (payroll_day BETWEEN 1 AND 31),
    ADD COLUMN IF NOT EXISTS payroll_notes TEXT;

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
    'application_received',
    'application_accepted',
    'application_rejected',
    'offer_published',
    'offer_expired',
    'new_message',
    'inspection_loading_completed',
    'inspection_delivery_completed',
    'inspection_issue_reported',
    'trip_started',
    'trip_completed',
    'fleet_invitation_accepted',
    'private_fleet_assignment',
    'private_fleet_expense_released',
    'private_fleet_freight_released',
    'private_fleet_salary_released',
    'private_fleet_incident',
    'private_fleet_signature_captured'
));

CREATE TABLE IF NOT EXISTS public.private_fleet_payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    currency_code TEXT NOT NULL DEFAULT 'COP'
        CHECK (currency_code IN ('COP', 'USD', 'PEN', 'BRL')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'approved', 'checkout_pending', 'funded', 'released', 'cancelled', 'failed')),
    gross_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
    processing_fee_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (processing_fee_amount >= 0),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    mp_preference_id TEXT,
    mp_external_reference TEXT,
    funded_payment_id TEXT,
    funded_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    gateway_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.private_fleet_payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.private_fleet_payroll_runs(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    fleet_member_id UUID NOT NULL REFERENCES public.business_fleet_members(id) ON DELETE RESTRICT,
    trucker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'funded', 'released_to_wallet', 'cancelled', 'failed')),
    wallet_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    released_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, fleet_member_id)
);

CREATE INDEX IF NOT EXISTS idx_private_fleet_payroll_runs_business
    ON public.private_fleet_payroll_runs(business_id, period_start DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_fleet_payroll_runs_status
    ON public.private_fleet_payroll_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_fleet_payroll_items_run
    ON public.private_fleet_payroll_items(run_id, status);
CREATE INDEX IF NOT EXISTS idx_private_fleet_payroll_items_trucker
    ON public.private_fleet_payroll_items(trucker_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_private_fleet_payroll_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_private_fleet_payroll_runs_updated_at ON public.private_fleet_payroll_runs;
CREATE TRIGGER trg_private_fleet_payroll_runs_updated_at
    BEFORE UPDATE ON public.private_fleet_payroll_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_private_fleet_payroll_updated_at();

DROP TRIGGER IF EXISTS trg_private_fleet_payroll_items_updated_at ON public.private_fleet_payroll_items;
CREATE TRIGGER trg_private_fleet_payroll_items_updated_at
    BEFORE UPDATE ON public.private_fleet_payroll_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_private_fleet_payroll_updated_at();

ALTER TABLE public.private_fleet_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_fleet_payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Businesses can view own private fleet payroll runs" ON public.private_fleet_payroll_runs;
CREATE POLICY "Businesses can view own private fleet payroll runs"
    ON public.private_fleet_payroll_runs FOR SELECT TO authenticated
    USING (
        business_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = private_fleet_payroll_runs.business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
              AND btm.role IN ('owner', 'finance_accountant', 'auditor')
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

DROP POLICY IF EXISTS "Truckers can view own private fleet payroll items" ON public.private_fleet_payroll_items;
CREATE POLICY "Truckers can view own private fleet payroll items"
    ON public.private_fleet_payroll_items FOR SELECT TO authenticated
    USING (
        trucker_id = auth.uid()
        OR business_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = private_fleet_payroll_items.business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
              AND btm.role IN ('owner', 'finance_accountant', 'auditor')
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

GRANT SELECT ON public.private_fleet_payroll_runs TO authenticated;
GRANT SELECT ON public.private_fleet_payroll_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.private_fleet_payroll_runs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.private_fleet_payroll_items TO service_role;

COMMENT ON TABLE public.private_fleet_payroll_runs IS
    'Monthly payroll funding runs for private fleet drivers. Funds must be moved by regulated payment partners.';
COMMENT ON TABLE public.private_fleet_payroll_items IS
    'Per-driver payroll ledger items released to the trucker wallet after funding is confirmed.';
COMMENT ON COLUMN public.business_fleet_members.default_compensation_mode IS
    'Default private fleet compensation model used when assigning routes.';
COMMENT ON COLUMN public.business_fleet_members.monthly_salary_amount IS
    'Operational monthly salary amount configured by the company for payroll runs.';
