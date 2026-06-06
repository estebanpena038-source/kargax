-- =============================================================================
-- KARGAX - PRIVATE FLEET EXTERNAL-ONLY GUARD
--
-- High-risk wallet correction:
-- - future private-fleet freight, payroll and expenses stay documentary
-- - marketplace remains the only withdrawable wallet rail
-- - no historical wallet balance reversal is performed here
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Allocation proofs: support route freight and trip expenses, not only payroll.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trip_financial_allocations'
          AND column_name = 'status'
    ) THEN
        EXECUTE 'ALTER TABLE public.trip_financial_allocations ALTER COLUMN status TYPE TEXT';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cargo_offers'
          AND column_name = 'private_payment_status'
    ) THEN
        EXECUTE 'ALTER TABLE public.cargo_offers ALTER COLUMN private_payment_status TYPE TEXT';
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.notifications') IS NOT NULL THEN
        ALTER TABLE public.notifications
        DROP CONSTRAINT IF EXISTS notifications_type_check;

        ALTER TABLE public.notifications
        DROP CONSTRAINT IF EXISTS notification_type_check;

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
            'private_fleet_assignment_rejected',
            'private_fleet_expense_released',
            'private_fleet_freight_released',
            'private_fleet_salary_released',
            'private_fleet_incident',
            'private_fleet_signature_captured',
            'private_fleet_trip_confirmed_external'
        ));
    END IF;
END $$;

ALTER TABLE public.private_fleet_payment_proofs
    ALTER COLUMN run_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS allocation_id UUID REFERENCES public.trip_financial_allocations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE CASCADE;

ALTER TABLE public.private_fleet_payment_proofs
    DROP CONSTRAINT IF EXISTS private_fleet_payment_proofs_source_check,
    ADD CONSTRAINT private_fleet_payment_proofs_source_check
        CHECK (run_id IS NOT NULL OR allocation_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_private_fleet_payment_proofs_allocation
    ON public.private_fleet_payment_proofs(allocation_id, created_at DESC)
    WHERE allocation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_private_fleet_payment_proofs_offer
    ON public.private_fleet_payment_proofs(offer_id, created_at DESC)
    WHERE offer_id IS NOT NULL;

ALTER TABLE public.trip_financial_allocations
    ADD COLUMN IF NOT EXISTS external_payment_status TEXT,
    ADD COLUMN IF NOT EXISTS external_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS external_paid_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_payment_method TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_reference TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_proof_url TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_proof_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_note TEXT;

ALTER TABLE public.trip_financial_allocations
    DROP CONSTRAINT IF EXISTS trip_financial_allocations_status_check,
    ADD CONSTRAINT trip_financial_allocations_status_check
        CHECK (status IN (
            'held_in_custody',
            'released_to_wallet',
            'refunded',
            'external_proof_pending',
            'proof_uploaded',
            'paid_external',
            'rejected',
            'cancelled'
        ));

ALTER TABLE public.trip_financial_allocations
    DROP CONSTRAINT IF EXISTS trip_financial_allocations_external_payment_status_check,
    ADD CONSTRAINT trip_financial_allocations_external_payment_status_check
        CHECK (
            external_payment_status IS NULL OR external_payment_status IN (
                'pending_external_pay',
                'proof_uploaded',
                'paid_external',
                'rejected',
                'cancelled'
            )
        );

ALTER TABLE public.cargo_offers
    DROP CONSTRAINT IF EXISTS cargo_offers_private_payment_status_check,
    ADD CONSTRAINT cargo_offers_private_payment_status_check
        CHECK (
            private_payment_status IS NULL OR private_payment_status IN (
                'not_applicable',
                'held',
                'partially_released',
                'released',
                'refunded',
                'cancelled',
                'external_proof_pending',
                'proof_uploaded',
                'paid_external'
            )
        );

CREATE INDEX IF NOT EXISTS idx_trip_financial_allocations_external_status
    ON public.trip_financial_allocations(business_id, external_payment_status, created_at DESC);

DROP POLICY IF EXISTS "Businesses and truckers can view private fleet payment proofs" ON public.private_fleet_payment_proofs;
CREATE POLICY "Businesses and truckers can view private fleet payment proofs"
    ON public.private_fleet_payment_proofs FOR SELECT TO authenticated
    USING (
        business_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = private_fleet_payment_proofs.business_id
              AND btm.user_id = auth.uid()
              AND btm.status = 'active'
              AND btm.role IN ('owner', 'finance_accountant', 'auditor')
        )
        OR EXISTS (
            SELECT 1
            FROM public.private_fleet_payroll_items pfi
            WHERE pfi.run_id = private_fleet_payment_proofs.run_id
              AND pfi.trucker_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.trip_financial_allocations tfa
            WHERE tfa.id = private_fleet_payment_proofs.allocation_id
              AND tfa.trucker_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.user_type = 'admin'
        )
    );

-- Conservative label backfill only. Do not reverse legacy wallet releases here.
UPDATE public.trip_financial_allocations
SET status = 'external_proof_pending',
    external_payment_status = COALESCE(external_payment_status, 'pending_external_pay'),
    metadata = jsonb_strip_nulls(
        COALESCE(metadata, '{}'::jsonb) ||
        jsonb_build_object('external_only_guard_applied', TRUE)
    )
WHERE allocation_type IN ('freight_payment', 'trip_pay', 'expense_advance', 'company_expense')
  AND status = 'held_in_custody';

-- -----------------------------------------------------------------------------
-- Private trip confirmation: document-only. No private money touches wallet.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_private_fleet_offer(
    p_offer_id UUID,
    p_trucker_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    payment_id UUID,
    expense_amount DECIMAL,
    freight_amount DECIMAL,
    pickup_pin VARCHAR,
    delivery_pin VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_pickup_pin VARCHAR(4);
    v_delivery_pin VARCHAR(4);
    v_freight_amount DECIMAL(15,2);
    v_expense_amount DECIMAL(15,2);
BEGIN
    SELECT *
    INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    IF COALESCE(v_offer.is_private_fleet, FALSE) = FALSE THEN
        RETURN QUERY SELECT false, 'La oferta no pertenece a flota privada'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    IF COALESCE(v_offer.private_fleet_trucker_id, v_offer.assigned_trucker_id) <> p_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para confirmar este viaje'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    IF v_offer.status = 'completed' THEN
        RETURN QUERY SELECT false, 'El viaje ya fue completado'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, v_offer.pickup_pin, v_offer.delivery_pin;
        RETURN;
    END IF;

    v_freight_amount := COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0);
    v_expense_amount := COALESCE(v_offer.expense_allowance_amount, 0);

    IF v_offer.private_fleet_confirmed_at IS NOT NULL AND v_offer.pickup_pin IS NOT NULL AND v_offer.delivery_pin IS NOT NULL THEN
        RETURN QUERY SELECT
            true,
            'El viaje privado ya estaba confirmado. La liquidacion privada queda por comprobante externo.'::TEXT,
            NULL::UUID,
            v_expense_amount,
            v_freight_amount,
            v_offer.pickup_pin,
            v_offer.delivery_pin;
        RETURN;
    END IF;

    IF v_offer.status NOT IN ('assigned', 'reserved') THEN
        RETURN QUERY SELECT false, 'La oferta no esta lista para confirmacion'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    v_pickup_pin := public.generate_secure_pin();
    v_delivery_pin := public.generate_secure_pin();

    WHILE v_delivery_pin = v_pickup_pin LOOP
        v_delivery_pin := public.generate_secure_pin();
    END LOOP;

    UPDATE public.cargo_offers
    SET
        assigned_trucker_id = p_trucker_id,
        private_fleet_trucker_id = p_trucker_id,
        net_amount = v_freight_amount,
        total_amount = v_freight_amount,
        platform_fee = 0,
        pickup_pin = v_pickup_pin,
        delivery_pin = v_delivery_pin,
        status = 'reserved',
        private_payment_status = CASE
            WHEN v_freight_amount > 0 OR v_expense_amount > 0 THEN 'external_proof_pending'
            ELSE 'not_applicable'
        END,
        private_fleet_confirmed_at = NOW(),
        private_fleet_confirmed_by = p_trucker_id,
        updated_at = NOW()
    WHERE id = p_offer_id;

    IF v_freight_amount > 0 THEN
        INSERT INTO public.trip_financial_allocations (
            offer_id,
            business_id,
            trucker_id,
            payment_id,
            allocation_type,
            amount,
            status,
            external_payment_status,
            metadata
        ) VALUES (
            p_offer_id,
            v_offer.business_id,
            p_trucker_id,
            NULL,
            'freight_payment',
            v_freight_amount,
            'external_proof_pending',
            'pending_external_pay',
            jsonb_build_object(
                'source_kind', 'private_fleet_external_freight',
                'wallet_touched', FALSE
            )
        )
        ON CONFLICT (offer_id, allocation_type)
        DO UPDATE SET
            payment_id = NULL,
            amount = EXCLUDED.amount,
            status = CASE
                WHEN public.trip_financial_allocations.status IN ('paid_external', 'proof_uploaded', 'released_to_wallet') THEN public.trip_financial_allocations.status
                ELSE 'external_proof_pending'
            END,
            external_payment_status = CASE
                WHEN public.trip_financial_allocations.external_payment_status IN ('paid_external', 'proof_uploaded') THEN public.trip_financial_allocations.external_payment_status
                ELSE 'pending_external_pay'
            END,
            metadata = jsonb_strip_nulls(COALESCE(public.trip_financial_allocations.metadata, '{}'::jsonb) || EXCLUDED.metadata);
    END IF;

    IF v_expense_amount > 0 THEN
        INSERT INTO public.trip_financial_allocations (
            offer_id,
            business_id,
            trucker_id,
            payment_id,
            allocation_type,
            amount,
            status,
            external_payment_status,
            metadata
        ) VALUES (
            p_offer_id,
            v_offer.business_id,
            p_trucker_id,
            NULL,
            'expense_advance',
            v_expense_amount,
            'external_proof_pending',
            'pending_external_pay',
            jsonb_build_object(
                'source_kind', 'private_fleet_external_expense',
                'wallet_touched', FALSE
            )
        )
        ON CONFLICT (offer_id, allocation_type)
        DO UPDATE SET
            payment_id = NULL,
            amount = EXCLUDED.amount,
            status = CASE
                WHEN public.trip_financial_allocations.status IN ('paid_external', 'proof_uploaded', 'released_to_wallet') THEN public.trip_financial_allocations.status
                ELSE 'external_proof_pending'
            END,
            external_payment_status = CASE
                WHEN public.trip_financial_allocations.external_payment_status IN ('paid_external', 'proof_uploaded') THEN public.trip_financial_allocations.external_payment_status
                ELSE 'pending_external_pay'
            END,
            metadata = jsonb_strip_nulls(COALESCE(public.trip_financial_allocations.metadata, '{}'::jsonb) || EXCLUDED.metadata);
    END IF;

    IF v_offer.origin_appointment_id IS NOT NULL OR v_offer.destination_appointment_id IS NOT NULL THEN
        UPDATE public.warehouse_appointments
        SET payment_status = CASE
                WHEN payment_status = 'n_a' THEN payment_status
                ELSE 'reserved'
            END,
            updated_at = NOW()
        WHERE id IN (v_offer.origin_appointment_id, v_offer.destination_appointment_id);
    END IF;

    PERFORM public.create_notification(
        p_trucker_id,
        'private_fleet_trip_confirmed_external',
        'Viaje privado confirmado',
        'Tu viaje privado fue confirmado. Los pagos privados se registran por comprobante externo de tu empresa.',
        jsonb_build_object(
            'offer_id', p_offer_id,
            'freight_amount', v_freight_amount,
            'expense_amount', v_expense_amount,
            'wallet_touched', FALSE
        )
    );

    RETURN QUERY SELECT
        true,
        'Viaje confirmado. Flete, nomina y viaticos privados quedan por comprobante externo; no se crea saldo wallet.'::TEXT,
        NULL::UUID,
        v_expense_amount,
        v_freight_amount,
        v_pickup_pin,
        v_delivery_pin;
END;
$$;

COMMENT ON FUNCTION public.confirm_private_fleet_offer IS
'Confirma un viaje de flota privada sin crear wallet, transaction ni saldo retirable; todo dinero privado queda como comprobante externo.';

GRANT EXECUTE ON FUNCTION public.confirm_private_fleet_offer(UUID, UUID) TO service_role;
