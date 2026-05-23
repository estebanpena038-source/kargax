-- =============================================================================
-- KARGAX - PRIVATE FLEET, DISPATCH MODES AND CEO CONTROL TOWER SUPPORT
-- =============================================================================
-- Sprints 22-24: canonical compensation modes, dispatch-to-trip modes and
-- source links for CEO/global admin metrics.

ALTER TABLE public.cargo_offers
    ADD COLUMN IF NOT EXISTS compensation_mode TEXT
        CHECK (
            compensation_mode IS NULL OR compensation_mode IN (
                'salary_no_trip_pay',
                'trip_pay',
                'expenses_only',
                'trip_pay_plus_expenses'
            )
        ),
    ADD COLUMN IF NOT EXISTS expenses_release_policy TEXT
        CHECK (
            expenses_release_policy IS NULL OR expenses_release_policy IN (
                'acceptance',
                'pickup_pin',
                'delivery_pod',
                'manual'
            )
        ),
    ADD COLUMN IF NOT EXISTS private_payment_status TEXT
        CHECK (
            private_payment_status IS NULL OR private_payment_status IN (
                'not_applicable',
                'held',
                'partially_released',
                'released',
                'refunded',
                'cancelled'
            )
        ),
    ADD COLUMN IF NOT EXISTS private_fleet_notes TEXT,
    ADD COLUMN IF NOT EXISTS source_dispatch_id UUID REFERENCES public.warehouse_dispatch_orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dispatch_trip_mode TEXT
        CHECK (
            dispatch_trip_mode IS NULL OR dispatch_trip_mode IN (
                'dispatch_only',
                'private_fleet_trip',
                'marketplace_offer'
            )
        );

ALTER TABLE public.warehouse_dispatch_orders
    ADD COLUMN IF NOT EXISTS dispatch_trip_mode TEXT NOT NULL DEFAULT 'dispatch_only'
        CHECK (dispatch_trip_mode IN ('dispatch_only', 'private_fleet_trip', 'marketplace_offer')),
    ADD COLUMN IF NOT EXISTS trip_creation_status TEXT NOT NULL DEFAULT 'not_requested'
        CHECK (trip_creation_status IN ('not_requested', 'created', 'failed', 'manual_review')),
    ADD COLUMN IF NOT EXISTS trip_creation_error TEXT,
    ADD COLUMN IF NOT EXISTS trip_created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.trip_financial_allocations
    DROP CONSTRAINT IF EXISTS trip_financial_allocations_allocation_type_check,
    ADD CONSTRAINT trip_financial_allocations_allocation_type_check
        CHECK (allocation_type IN ('expense_advance', 'freight_payment', 'trip_pay', 'company_expense'));

ALTER TABLE public.trip_financial_allocations
    ADD COLUMN IF NOT EXISTS release_trigger TEXT
        CHECK (
            release_trigger IS NULL OR release_trigger IN (
                'acceptance',
                'pickup_pin',
                'delivery_pod',
                'manual'
            )
        );

CREATE INDEX IF NOT EXISTS idx_cargo_offers_source_dispatch
    ON public.cargo_offers(source_dispatch_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_orders_trip_mode
    ON public.warehouse_dispatch_orders(dispatch_trip_mode, trip_creation_status, created_at DESC);
