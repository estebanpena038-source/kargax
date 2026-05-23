-- =============================================================================
-- KARGAX - PAYOUT METHODS AND ATTEMPTS
-- =============================================================================
-- Sprint 20: canonical payout model for Nequi, Bancolombia, other banks and
-- manual fallback while automatic providers are certified.

CREATE TABLE IF NOT EXISTS public.payout_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    method TEXT NOT NULL
        CHECK (method IN ('nequi', 'bancolombia_savings', 'bancolombia_checking', 'other_bank')),
    provider_preference TEXT NOT NULL DEFAULT 'manual'
        CHECK (provider_preference IN ('nequi', 'wompi', 'manual')),
    account_holder_name TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'CC',
    document_number TEXT NOT NULL,
    phone_number TEXT,
    bank_code TEXT,
    account_number_encrypted TEXT,
    account_type TEXT
        CHECK (account_type IS NULL OR account_type IN ('savings', 'checking')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'manual_review', 'blocked')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_methods_user_status
    ON public.payout_methods(user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.payout_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL
        CHECK (provider IN ('nequi', 'wompi', 'manual')),
    method TEXT NOT NULL
        CHECK (method IN ('nequi', 'bancolombia_savings', 'bancolombia_checking', 'other_bank')),
    amount_cop NUMERIC(15,2) NOT NULL CHECK (amount_cop > 0),
    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'queued', 'processing', 'paid', 'failed', 'reversed', 'manual_review')),
    idempotency_key TEXT NOT NULL UNIQUE,
    provider_reference TEXT,
    provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_code TEXT,
    failure_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_attempts_user_status
    ON public.payout_attempts(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_attempts_transaction
    ON public.payout_attempts(wallet_transaction_id);

ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payout methods" ON public.payout_methods;
CREATE POLICY "Users can view own payout methods"
    ON public.payout_methods FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.user_type = 'admin'
    ));

DROP POLICY IF EXISTS "Users can view own payout attempts" ON public.payout_attempts;
CREATE POLICY "Users can view own payout attempts"
    ON public.payout_attempts FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.user_type = 'admin'
    ));

GRANT SELECT ON public.payout_methods TO authenticated;
GRANT SELECT ON public.payout_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payout_methods TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.payout_attempts TO service_role;
