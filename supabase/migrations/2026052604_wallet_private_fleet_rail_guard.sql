-- =============================================================================
-- KARGAX - WALLET PRIVATE FLEET RAIL GUARD
--
-- Corrective guard:
-- - marketplace remains the only withdrawable rail
-- - private fleet remains documentary/external by default
-- - route/viaticos proofs can target an allocation without a payroll run
-- =============================================================================

ALTER TABLE public.private_fleet_payment_proofs
    ADD COLUMN IF NOT EXISTS allocation_id UUID REFERENCES public.trip_financial_allocations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE CASCADE;

ALTER TABLE public.private_fleet_payment_proofs
    ALTER COLUMN run_id DROP NOT NULL;

ALTER TABLE public.private_fleet_payment_proofs
    DROP CONSTRAINT IF EXISTS private_fleet_payment_proofs_target_check,
    ADD CONSTRAINT private_fleet_payment_proofs_target_check
        CHECK (
            run_id IS NOT NULL
            OR allocation_id IS NOT NULL
            OR offer_id IS NOT NULL
        );

CREATE INDEX IF NOT EXISTS idx_private_fleet_payment_proofs_allocation_guard
    ON public.private_fleet_payment_proofs(allocation_id, created_at DESC)
    WHERE allocation_id IS NOT NULL;

UPDATE public.transactions
SET money_rail = CASE
        WHEN money_rail IS NULL OR money_rail = 'legacy' THEN 'private_fleet_external_or_legacy'
        ELSE money_rail
    END,
    payout_eligible = FALSE,
    locked_for_payout = FALSE,
    external_proof_only = TRUE,
    metadata = jsonb_strip_nulls(
        COALESCE(metadata, '{}'::jsonb) ||
        jsonb_build_object(
            'wallet_rail_guarded_at', NOW(),
            'wallet_rail_guard_reason', 'private_fleet_non_withdrawable'
        )
    )
WHERE type = 'private_fleet_salary'
   OR COALESCE(money_rail, '') LIKE 'private_fleet%'
   OR COALESCE(metadata->>'source_kind', '') LIKE 'private_fleet%';

COMMENT ON CONSTRAINT private_fleet_payment_proofs_target_check ON public.private_fleet_payment_proofs IS
'Private fleet proof must point to a payroll run, route allocation, or offer. Allocation-only proofs support route pay and viaticos without creating withdrawable wallet money.';
