-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 024: FUEL ADVANCES / KARGAX ADELANTO
-- Producto de adelanto productivo ligado a viajes reservados
-- =============================================================================

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'advance_disbursement';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'advance_repayment';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'advance_interest';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'advance_reversal';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'advance_writeoff';

CREATE TABLE IF NOT EXISTS public.lending_settings (
    id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
    monthly_interest_rate_percent DECIMAL(8,4) NOT NULL DEFAULT 1.5000 CHECK (monthly_interest_rate_percent >= 0),
    max_term_days INTEGER NOT NULL DEFAULT 30 CHECK (max_term_days BETWEEN 1 AND 30),
    portfolio_deployment_limit_percent DECIMAL(5,2) NOT NULL DEFAULT 80.00 CHECK (portfolio_deployment_limit_percent > 0 AND portfolio_deployment_limit_percent <= 100),
    first_advance_cap_cop DECIMAL(15,2) NOT NULL DEFAULT 400000.00 CHECK (first_advance_cap_cop >= 0),
    repeat_advance_cap_cop DECIMAL(15,2) NOT NULL DEFAULT 800000.00 CHECK (repeat_advance_cap_cop >= 0),
    initial_ltv_percent DECIMAL(5,2) NOT NULL DEFAULT 35.00 CHECK (initial_ltv_percent > 0 AND initial_ltv_percent <= 100),
    repeat_ltv_percent DECIMAL(5,2) NOT NULL DEFAULT 45.00 CHECK (repeat_ltv_percent > 0 AND repeat_ltv_percent <= 100),
    minimum_completed_trips_for_repeat INTEGER NOT NULL DEFAULT 3 CHECK (minimum_completed_trips_for_repeat >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lending_treasury (
    id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
    available_capital DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (available_capital >= 0),
    reserved_capital DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (reserved_capital >= 0),
    deployed_capital DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (deployed_capital >= 0),
    total_repaid_principal DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_repaid_principal >= 0),
    total_repaid_interest DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_repaid_interest >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fuel_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trucker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    origin_offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'disbursed', 'rejected', 'cancelled', 'completed', 'overdue', 'at_risk', 'restructured', 'written_off')),
    principal_amount DECIMAL(15,2) NOT NULL CHECK (principal_amount > 0),
    monthly_interest_rate_percent DECIMAL(8,4) NOT NULL CHECK (monthly_interest_rate_percent >= 0),
    term_days INTEGER NOT NULL CHECK (term_days BETWEEN 1 AND 30),
    approved_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ NOT NULL,
    principal_outstanding DECIMAL(15,2) NOT NULL CHECK (principal_outstanding >= 0),
    interest_outstanding DECIMAL(15,2) NOT NULL CHECK (interest_outstanding >= 0),
    total_due_at_maturity DECIMAL(15,2) NOT NULL CHECK (total_due_at_maturity >= 0),
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    rejected_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fuel_advance_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advance_id UUID NOT NULL REFERENCES public.fuel_advances(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('trip_settlement', 'wallet_sweep', 'admin_adjustment')),
    principal_paid DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (principal_paid >= 0),
    interest_paid DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (interest_paid >= 0),
    balance_after_principal DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (balance_after_principal >= 0),
    balance_after_interest DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (balance_after_interest >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.lending_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lending_treasury (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_lending_settings_updated_at ON public.lending_settings;
CREATE TRIGGER trg_lending_settings_updated_at
    BEFORE UPDATE ON public.lending_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_lending_treasury_updated_at ON public.lending_treasury;
CREATE TRIGGER trg_lending_treasury_updated_at
    BEFORE UPDATE ON public.lending_treasury
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_fuel_advances_updated_at ON public.fuel_advances;
CREATE TRIGGER trg_fuel_advances_updated_at
    BEFORE UPDATE ON public.fuel_advances
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE INDEX IF NOT EXISTS idx_fuel_advances_trucker_status ON public.fuel_advances(trucker_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_fuel_advances_wallet_status ON public.fuel_advances(wallet_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_fuel_advances_offer ON public.fuel_advances(origin_offer_id);
CREATE INDEX IF NOT EXISTS idx_fuel_advance_repayments_advance ON public.fuel_advance_repayments(advance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_advance_repayments_wallet ON public.fuel_advance_repayments(wallet_id, created_at DESC);

DROP INDEX IF EXISTS idx_fuel_advances_one_open_per_trucker;
CREATE UNIQUE INDEX idx_fuel_advances_one_open_per_trucker
    ON public.fuel_advances(trucker_id)
    WHERE status IN ('requested', 'disbursed', 'overdue', 'at_risk', 'restructured');

DROP INDEX IF EXISTS idx_fuel_advances_one_open_per_offer;
CREATE UNIQUE INDEX idx_fuel_advances_one_open_per_offer
    ON public.fuel_advances(origin_offer_id)
    WHERE status IN ('requested', 'disbursed', 'overdue', 'at_risk', 'restructured');

ALTER TABLE public.lending_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lending_treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_advance_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Truckers can view own fuel advances" ON public.fuel_advances;
CREATE POLICY "Truckers can view own fuel advances"
    ON public.fuel_advances FOR SELECT TO authenticated
    USING (trucker_id = auth.uid());

DROP POLICY IF EXISTS "Truckers can view own fuel advance repayments" ON public.fuel_advance_repayments;
CREATE POLICY "Truckers can view own fuel advance repayments"
    ON public.fuel_advance_repayments FOR SELECT TO authenticated
    USING (
        wallet_id IN (
            SELECT id FROM public.wallets WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "No direct user access to lending settings" ON public.lending_settings;
CREATE POLICY "No direct user access to lending settings"
    ON public.lending_settings FOR SELECT TO authenticated
    USING (false);

DROP POLICY IF EXISTS "No direct user access to lending treasury" ON public.lending_treasury;
CREATE POLICY "No direct user access to lending treasury"
    ON public.lending_treasury FOR SELECT TO authenticated
    USING (false);

GRANT SELECT ON public.fuel_advances TO authenticated;
GRANT SELECT ON public.fuel_advance_repayments TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_overdue_fuel_advances()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_record IN
        UPDATE public.fuel_advances
        SET status = 'overdue',
            updated_at = NOW()
        WHERE status IN ('disbursed', 'restructured')
          AND due_at < NOW()
          AND (principal_outstanding > 0 OR interest_outstanding > 0)
        RETURNING id, trucker_id, due_at, principal_outstanding, interest_outstanding
    LOOP
        v_count := v_count + 1;

        INSERT INTO public.admin_notifications (type, title, message, data, read, processed)
        VALUES (
            'advance_overdue',
            'Adelanto vencido',
            format('El adelanto %s entro en mora y requiere seguimiento.', LEFT(v_record.id::TEXT, 8)),
            jsonb_build_object(
                'advance_id', v_record.id,
                'trucker_id', v_record.trucker_id,
                'due_at', v_record.due_at,
                'principal_outstanding', v_record.principal_outstanding,
                'interest_outstanding', v_record.interest_outstanding
            ),
            false,
            false
        );
    END LOOP;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fuel_advance_eligibility(p_trucker_id UUID)
RETURNS TABLE(
    offer_id UUID,
    subtotal DECIMAL,
    max_advance_amount DECIMAL,
    monthly_interest_rate_percent DECIMAL,
    max_term_days INTEGER,
    eligible BOOLEAN,
    reason TEXT,
    due_at TIMESTAMPTZ,
    origin_city TEXT,
    destination_city TEXT,
    cargo_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings public.lending_settings%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_has_payment_method BOOLEAN := FALSE;
    v_has_open_advance BOOLEAN := FALSE;
    v_has_overdue_advance BOOLEAN := FALSE;
    v_total_trips INTEGER := 0;
    v_is_repeat BOOLEAN := FALSE;
BEGIN
    PERFORM public.mark_overdue_fuel_advances();

    SELECT * INTO v_settings
    FROM public.lending_settings
    WHERE id = 'default';

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_trucker_id;

    IF v_wallet.id IS NOT NULL THEN
        v_total_trips := COALESCE(v_wallet.total_trips_completed, 0);
    END IF;

    v_is_repeat := v_total_trips >= COALESCE(v_settings.minimum_completed_trips_for_repeat, 3);

    SELECT EXISTS (
        SELECT 1
        FROM public.payment_methods
        WHERE user_id = p_trucker_id
    ) INTO v_has_payment_method;

    SELECT EXISTS (
        SELECT 1
        FROM public.fuel_advances
        WHERE trucker_id = p_trucker_id
          AND status IN ('requested', 'disbursed', 'overdue', 'at_risk', 'restructured')
    ) INTO v_has_open_advance;

    SELECT EXISTS (
        SELECT 1
        FROM public.fuel_advances
        WHERE trucker_id = p_trucker_id
          AND status IN ('overdue', 'at_risk')
    ) INTO v_has_overdue_advance;

    RETURN QUERY
    SELECT
        co.id AS offer_id,
        p.subtotal,
        CASE
            WHEN v_has_overdue_advance THEN 0::DECIMAL
            WHEN v_has_open_advance THEN 0::DECIMAL
            WHEN NOT v_has_payment_method THEN 0::DECIMAL
            ELSE LEAST(
                ROUND(
                    p.subtotal
                    * (CASE WHEN v_is_repeat THEN v_settings.repeat_ltv_percent ELSE v_settings.initial_ltv_percent END)
                    / 100.0,
                    2
                ),
                CASE
                    WHEN v_is_repeat THEN v_settings.repeat_advance_cap_cop
                    ELSE v_settings.first_advance_cap_cop
                END
            )
        END AS max_advance_amount,
        v_settings.monthly_interest_rate_percent,
        v_settings.max_term_days,
        CASE
            WHEN v_has_overdue_advance THEN FALSE
            WHEN v_has_open_advance THEN FALSE
            WHEN NOT v_has_payment_method THEN FALSE
            ELSE TRUE
        END AS eligible,
        CASE
            WHEN v_has_overdue_advance THEN 'Tienes un adelanto vencido o en riesgo'
            WHEN v_has_open_advance THEN 'Ya tienes un adelanto abierto'
            WHEN NOT v_has_payment_method THEN 'Configura un metodo de retiro en tu billetera'
            ELSE NULL
        END AS reason,
        NOW() + make_interval(days => v_settings.max_term_days),
        co.origin_city::TEXT,
        co.destination_city::TEXT,
        co.cargo_type::TEXT
    FROM public.cargo_offers co
    JOIN public.payments p
      ON p.offer_id = co.id
     AND p.status = 'completed'
    WHERE co.assigned_trucker_id = p_trucker_id
      AND co.status = 'reserved'
      AND NOT EXISTS (
          SELECT 1
          FROM public.fuel_advances fa
          WHERE fa.origin_offer_id = co.id
            AND fa.status IN ('requested', 'disbursed', 'overdue', 'at_risk', 'restructured', 'completed')
      )
    ORDER BY co.pickup_date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_fuel_advance(
    p_trucker_id UUID,
    p_origin_offer_id UUID,
    p_requested_amount DECIMAL DEFAULT NULL,
    p_term_days INTEGER DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    advance_id UUID,
    principal_amount DECIMAL,
    monthly_interest_rate_percent DECIMAL,
    total_due DECIMAL,
    due_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet public.wallets%ROWTYPE;
    v_settings public.lending_settings%ROWTYPE;
    v_eligibility RECORD;
    v_term_days INTEGER;
    v_principal DECIMAL(15,2);
    v_interest DECIMAL(15,2);
    v_due_at TIMESTAMPTZ;
    v_advance_id UUID;
BEGIN
    PERFORM public.mark_overdue_fuel_advances();

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_trucker_id
    FOR UPDATE;

    IF v_wallet.id IS NULL THEN
        RETURN QUERY SELECT false, 'Billetera no encontrada'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    SELECT * INTO v_settings
    FROM public.lending_settings
    WHERE id = 'default';

    SELECT * INTO v_eligibility
    FROM public.get_fuel_advance_eligibility(p_trucker_id)
    WHERE offer_id = p_origin_offer_id
    LIMIT 1;

    IF v_eligibility.offer_id IS NULL THEN
        RETURN QUERY SELECT false, 'La oferta no es elegible para adelanto'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF NOT v_eligibility.eligible THEN
        RETURN QUERY SELECT false, COALESCE(v_eligibility.reason, 'La oferta no es elegible para adelanto')::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    v_term_days := LEAST(COALESCE(NULLIF(p_term_days, 0), v_settings.max_term_days), v_settings.max_term_days);
    v_principal := COALESCE(NULLIF(p_requested_amount, 0), v_eligibility.max_advance_amount);

    IF v_principal <= 0 THEN
        RETURN QUERY SELECT false, 'El monto solicitado no es valido'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_principal > v_eligibility.max_advance_amount THEN
        RETURN QUERY SELECT false, 'El monto solicitado supera tu cupo disponible'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    v_due_at := NOW() + make_interval(days => v_term_days);
    v_interest := ROUND(v_principal * v_settings.monthly_interest_rate_percent / 100.0 * v_term_days / 30.0, 2);

    INSERT INTO public.fuel_advances (
        trucker_id,
        wallet_id,
        origin_offer_id,
        status,
        principal_amount,
        monthly_interest_rate_percent,
        term_days,
        due_at,
        principal_outstanding,
        interest_outstanding,
        total_due_at_maturity,
        requested_by
    )
    VALUES (
        p_trucker_id,
        v_wallet.id,
        p_origin_offer_id,
        'requested',
        v_principal,
        v_settings.monthly_interest_rate_percent,
        v_term_days,
        v_due_at,
        v_principal,
        v_interest,
        v_principal + v_interest,
        p_trucker_id
    )
    RETURNING id INTO v_advance_id;

    INSERT INTO public.admin_notifications (type, title, message, data, read, processed)
    VALUES (
        'advance_request',
        'Nueva solicitud de adelanto',
        format('El transportador %s solicito un adelanto por %s.', LEFT(p_trucker_id::TEXT, 8), to_char(v_principal, 'FM999G999G999D00')),
        jsonb_build_object(
            'advance_id', v_advance_id,
            'trucker_id', p_trucker_id,
            'offer_id', p_origin_offer_id,
            'principal_amount', v_principal,
            'term_days', v_term_days,
            'monthly_interest_rate_percent', v_settings.monthly_interest_rate_percent,
            'total_due', v_principal + v_interest,
            'due_at', v_due_at
        ),
        false,
        false
    );

    RETURN QUERY
    SELECT true, 'Solicitud enviada para revision administrativa'::TEXT, v_advance_id, v_principal, v_settings.monthly_interest_rate_percent, v_principal + v_interest, v_due_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_fuel_advance(
    p_advance_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    wallet_id UUID,
    amount_disbursed DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_advance public.fuel_advances%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_treasury public.lending_treasury%ROWTYPE;
    v_settings public.lending_settings%ROWTYPE;
    v_total_capital DECIMAL(15,2);
    v_next_deployment_percent DECIMAL(8,4);
    v_balance_before DECIMAL(15,2);
BEGIN
    PERFORM public.mark_overdue_fuel_advances();

    SELECT * INTO v_advance
    FROM public.fuel_advances
    WHERE id = p_advance_id
    FOR UPDATE;

    IF v_advance.id IS NULL THEN
        RETURN QUERY SELECT false, 'Adelanto no encontrado'::TEXT, NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_advance.status <> 'requested' THEN
        RETURN QUERY SELECT false, 'La solicitud ya fue procesada'::TEXT, v_advance.wallet_id, 0::DECIMAL;
        RETURN;
    END IF;

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE id = v_advance.wallet_id
    FOR UPDATE;

    SELECT * INTO v_treasury
    FROM public.lending_treasury
    WHERE id = 'default'
    FOR UPDATE;

    SELECT * INTO v_settings
    FROM public.lending_settings
    WHERE id = 'default';

    IF v_treasury.available_capital < v_advance.principal_amount THEN
        RETURN QUERY SELECT false, 'Tesoreria insuficiente para aprobar este adelanto'::TEXT, v_wallet.id, 0::DECIMAL;
        RETURN;
    END IF;

    v_total_capital := v_treasury.available_capital + v_treasury.deployed_capital + v_treasury.reserved_capital;
    IF v_total_capital > 0 THEN
        v_next_deployment_percent := ((v_treasury.deployed_capital + v_advance.principal_amount) / v_total_capital) * 100.0;
        IF v_next_deployment_percent > v_settings.portfolio_deployment_limit_percent THEN
            RETURN QUERY SELECT false, 'La aprobacion supera el limite de despliegue del portafolio'::TEXT, v_wallet.id, 0::DECIMAL;
            RETURN;
        END IF;
    END IF;

    UPDATE public.lending_treasury
    SET available_capital = available_capital - v_advance.principal_amount,
        deployed_capital = deployed_capital + v_advance.principal_amount,
        updated_at = NOW()
    WHERE id = 'default';

    v_balance_before := COALESCE(v_wallet.available_balance, 0);

    UPDATE public.wallets
    SET available_balance = available_balance + v_advance.principal_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO public.transactions (
        wallet_id,
        offer_id,
        type,
        status,
        amount,
        balance_before,
        balance_after,
        description,
        reference_id,
        metadata
    ) VALUES (
        v_wallet.id,
        v_advance.origin_offer_id,
        'advance_disbursement',
        'completed',
        v_advance.principal_amount,
        v_balance_before,
        v_balance_before + v_advance.principal_amount,
        format('Adelanto KargaX aprobado para viaje #%s', LEFT(v_advance.origin_offer_id::TEXT, 8)),
        v_advance.id::TEXT,
        jsonb_build_object('advance_id', v_advance.id, 'approved_by', p_admin_id, 'note', p_note)
    );

    UPDATE public.fuel_advances
    SET status = 'disbursed',
        approved_at = NOW(),
        disbursed_at = NOW(),
        approved_by = p_admin_id,
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('approval_note', p_note)
    WHERE id = v_advance.id;

    RETURN QUERY SELECT true, 'Adelanto aprobado y abonado a la billetera'::TEXT, v_wallet.id, v_advance.principal_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_fuel_advance(
    p_advance_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER := 0;
BEGIN
    UPDATE public.fuel_advances
    SET status = 'rejected',
        approved_by = p_admin_id,
        rejected_reason = p_reason,
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('rejected_at', NOW(), 'rejected_by', p_admin_id)
    WHERE id = p_advance_id
      AND status = 'requested';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.restructure_fuel_advance(
    p_advance_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings public.lending_settings%ROWTYPE;
    v_updated INTEGER := 0;
BEGIN
    SELECT * INTO v_settings FROM public.lending_settings WHERE id = 'default';

    UPDATE public.fuel_advances
    SET status = 'restructured',
        due_at = NOW() + make_interval(days => v_settings.max_term_days),
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
            'restructured_at', NOW(),
            'restructured_by', p_admin_id,
            'restructure_note', p_note
        )
    WHERE id = p_advance_id
      AND status IN ('disbursed', 'overdue', 'at_risk', 'restructured');

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_off_fuel_advance(
    p_advance_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_advance public.fuel_advances%ROWTYPE;
    v_updated INTEGER := 0;
BEGIN
    SELECT * INTO v_advance
    FROM public.fuel_advances
    WHERE id = p_advance_id
    FOR UPDATE;

    IF v_advance.id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_advance.status IN ('completed', 'rejected', 'cancelled', 'written_off') THEN
        RETURN FALSE;
    END IF;

    UPDATE public.lending_treasury
    SET deployed_capital = GREATEST(deployed_capital - COALESCE(v_advance.principal_outstanding, 0), 0),
        updated_at = NOW()
    WHERE id = 'default';

    UPDATE public.fuel_advances
    SET status = 'written_off',
        principal_outstanding = 0,
        interest_outstanding = 0,
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
            'written_off_at', NOW(),
            'written_off_by', p_admin_id,
            'write_off_note', p_note
        )
    WHERE id = p_advance_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_lending_treasury(
    p_admin_id UUID,
    p_amount DECIMAL,
    p_adjustment_type TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    available_capital DECIMAL,
    deployed_capital DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_treasury public.lending_treasury%ROWTYPE;
BEGIN
    SELECT * INTO v_treasury
    FROM public.lending_treasury
    WHERE id = 'default'
    FOR UPDATE;

    IF p_amount <= 0 THEN
        RETURN QUERY SELECT false, 'El monto debe ser mayor a cero'::TEXT, v_treasury.available_capital, v_treasury.deployed_capital;
        RETURN;
    END IF;

    IF p_adjustment_type = 'funding' THEN
        UPDATE public.lending_treasury
        SET available_capital = available_capital + p_amount,
            updated_at = NOW()
        WHERE id = 'default';
    ELSIF p_adjustment_type = 'withdrawal' THEN
        IF v_treasury.available_capital < p_amount THEN
            RETURN QUERY SELECT false, 'Capital disponible insuficiente'::TEXT, v_treasury.available_capital, v_treasury.deployed_capital;
            RETURN;
        END IF;

        UPDATE public.lending_treasury
        SET available_capital = available_capital - p_amount,
            updated_at = NOW()
        WHERE id = 'default';
    ELSIF p_adjustment_type = 'adjustment' THEN
        UPDATE public.lending_treasury
        SET available_capital = GREATEST(available_capital + p_amount, 0),
            updated_at = NOW()
        WHERE id = 'default';
    ELSE
        RETURN QUERY SELECT false, 'Tipo de ajuste invalido'::TEXT, v_treasury.available_capital, v_treasury.deployed_capital;
        RETURN;
    END IF;

    INSERT INTO public.admin_notifications (type, title, message, data, read, processed)
    VALUES (
        'treasury_adjustment',
        'Ajuste de tesoreria',
        format('Se registro un ajuste de tesoreria por %s.', to_char(p_amount, 'FM999G999G999D00')),
        jsonb_build_object(
            'amount', p_amount,
            'adjustment_type', p_adjustment_type,
            'note', p_note,
            'admin_id', p_admin_id
        ),
        false,
        true
    );

    SELECT * INTO v_treasury
    FROM public.lending_treasury
    WHERE id = 'default';

    RETURN QUERY SELECT true, 'Tesoreria actualizada'::TEXT, v_treasury.available_capital, v_treasury.deployed_capital;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_advance_repayments(
    p_wallet_id UUID,
    p_offer_id UUID DEFAULT NULL,
    p_max_amount DECIMAL DEFAULT NULL,
    p_source TEXT DEFAULT 'trip_settlement'
)
RETURNS TABLE(
    total_applied DECIMAL,
    principal_applied DECIMAL,
    interest_applied DECIMAL,
    remaining_available_balance DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet public.wallets%ROWTYPE;
    v_advance RECORD;
    v_remaining DECIMAL(15,2);
    v_total_applied DECIMAL(15,2) := 0;
    v_principal_total DECIMAL(15,2) := 0;
    v_interest_total DECIMAL(15,2) := 0;
    v_interest_payment DECIMAL(15,2);
    v_principal_payment DECIMAL(15,2);
    v_balance_before DECIMAL(15,2);
    v_balance_after DECIMAL(15,2);
BEGIN
    IF p_source NOT IN ('trip_settlement', 'wallet_sweep', 'admin_adjustment') THEN
        RAISE EXCEPTION 'Invalid repayment source';
    END IF;

    PERFORM public.mark_overdue_fuel_advances();

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE id = p_wallet_id
    FOR UPDATE;

    IF v_wallet.id IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;

    v_remaining := LEAST(COALESCE(NULLIF(p_max_amount, 0), v_wallet.available_balance), v_wallet.available_balance);

    IF v_remaining <= 0 THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, v_wallet.available_balance;
        RETURN;
    END IF;

    FOR v_advance IN
        SELECT *
        FROM public.fuel_advances
        WHERE wallet_id = p_wallet_id
          AND status IN ('disbursed', 'overdue', 'at_risk', 'restructured')
          AND (principal_outstanding > 0 OR interest_outstanding > 0)
        ORDER BY
            CASE WHEN status = 'overdue' THEN 0 WHEN status = 'at_risk' THEN 1 ELSE 2 END,
            due_at ASC,
            created_at ASC
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_interest_payment := LEAST(v_remaining, COALESCE(v_advance.interest_outstanding, 0));

        IF v_interest_payment > 0 THEN
            v_balance_before := v_wallet.available_balance;
            v_balance_after := v_balance_before - v_interest_payment;

            UPDATE public.wallets
            SET available_balance = v_balance_after,
                updated_at = NOW()
            WHERE id = v_wallet.id;

            UPDATE public.lending_treasury
            SET available_capital = available_capital + v_interest_payment,
                total_repaid_interest = total_repaid_interest + v_interest_payment,
                updated_at = NOW()
            WHERE id = 'default';

            UPDATE public.fuel_advances
            SET interest_outstanding = GREATEST(interest_outstanding - v_interest_payment, 0),
                updated_at = NOW()
            WHERE id = v_advance.id;

            INSERT INTO public.transactions (
                wallet_id, offer_id, type, status, amount, balance_before, balance_after, description, reference_id, metadata
            ) VALUES (
                v_wallet.id,
                p_offer_id,
                'advance_interest',
                'completed',
                -v_interest_payment,
                v_balance_before,
                v_balance_after,
                format('Cobro de intereses adelanto #%s', LEFT(v_advance.id::TEXT, 8)),
                v_advance.id::TEXT,
                jsonb_build_object('advance_id', v_advance.id, 'source', p_source)
            );

            INSERT INTO public.fuel_advance_repayments (
                advance_id, wallet_id, offer_id, source, principal_paid, interest_paid, balance_after_principal, balance_after_interest
            ) VALUES (
                v_advance.id,
                v_wallet.id,
                p_offer_id,
                p_source,
                0,
                v_interest_payment,
                COALESCE(v_advance.principal_outstanding, 0),
                GREATEST(COALESCE(v_advance.interest_outstanding, 0) - v_interest_payment, 0)
            );

            v_wallet.available_balance := v_balance_after;
            v_remaining := v_remaining - v_interest_payment;
            v_total_applied := v_total_applied + v_interest_payment;
            v_interest_total := v_interest_total + v_interest_payment;
        END IF;

        EXIT WHEN v_remaining <= 0;

        SELECT * INTO v_advance FROM public.fuel_advances WHERE id = v_advance.id;
        v_principal_payment := LEAST(v_remaining, COALESCE(v_advance.principal_outstanding, 0));

        IF v_principal_payment > 0 THEN
            v_balance_before := v_wallet.available_balance;
            v_balance_after := v_balance_before - v_principal_payment;

            UPDATE public.wallets
            SET available_balance = v_balance_after,
                updated_at = NOW()
            WHERE id = v_wallet.id;

            UPDATE public.lending_treasury
            SET available_capital = available_capital + v_principal_payment,
                deployed_capital = GREATEST(deployed_capital - v_principal_payment, 0),
                total_repaid_principal = total_repaid_principal + v_principal_payment,
                updated_at = NOW()
            WHERE id = 'default';

            UPDATE public.fuel_advances
            SET principal_outstanding = GREATEST(principal_outstanding - v_principal_payment, 0),
                updated_at = NOW()
            WHERE id = v_advance.id;

            INSERT INTO public.transactions (
                wallet_id, offer_id, type, status, amount, balance_before, balance_after, description, reference_id, metadata
            ) VALUES (
                v_wallet.id,
                p_offer_id,
                'advance_repayment',
                'completed',
                -v_principal_payment,
                v_balance_before,
                v_balance_after,
                format('Pago de capital adelanto #%s', LEFT(v_advance.id::TEXT, 8)),
                v_advance.id::TEXT,
                jsonb_build_object('advance_id', v_advance.id, 'source', p_source)
            );

            INSERT INTO public.fuel_advance_repayments (
                advance_id, wallet_id, offer_id, source, principal_paid, interest_paid, balance_after_principal, balance_after_interest
            ) VALUES (
                v_advance.id,
                v_wallet.id,
                p_offer_id,
                p_source,
                v_principal_payment,
                0,
                GREATEST(COALESCE(v_advance.principal_outstanding, 0) - v_principal_payment, 0),
                COALESCE(v_advance.interest_outstanding, 0)
            );

            v_wallet.available_balance := v_balance_after;
            v_remaining := v_remaining - v_principal_payment;
            v_total_applied := v_total_applied + v_principal_payment;
            v_principal_total := v_principal_total + v_principal_payment;
        END IF;

        UPDATE public.fuel_advances
        SET status = CASE
                WHEN principal_outstanding <= 0 AND interest_outstanding <= 0 THEN 'completed'
                WHEN due_at < NOW() THEN 'overdue'
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = v_advance.id;
    END LOOP;

    RETURN QUERY SELECT v_total_applied, v_principal_total, v_interest_total, v_wallet.available_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_fuel_advance_offer_at_risk(
    p_offer_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_record IN
        UPDATE public.fuel_advances
        SET status = 'at_risk',
            metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
                'risk_reason', p_reason,
                'marked_at_risk_at', NOW()
            ),
            updated_at = NOW()
        WHERE origin_offer_id = p_offer_id
          AND status IN ('requested', 'disbursed', 'overdue', 'restructured')
        RETURNING id, trucker_id
    LOOP
        v_count := v_count + 1;
        INSERT INTO public.admin_notifications (type, title, message, data, read, processed)
        VALUES (
            'advance_offer_cancelled',
            'Adelanto en riesgo',
            format('El viaje base del adelanto %s cambio a una situacion de riesgo.', LEFT(v_record.id::TEXT, 8)),
            jsonb_build_object(
                'advance_id', v_record.id,
                'trucker_id', v_record.trucker_id,
                'offer_id', p_offer_id,
                'reason', p_reason
            ),
            false,
            false
        );
    END LOOP;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_delivery_pin(
    p_offer_id UUID,
    p_input_pin VARCHAR(6),
    p_trucker_id UUID DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    amount_released DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_wallet_id UUID;
    v_max_attempts INTEGER := 5;
    v_release_amount DECIMAL(15,2);
    v_available_before DECIMAL(15,2);
    v_available_after_deposit DECIMAL(15,2);
    v_repayment RECORD;
BEGIN
    SELECT * INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF p_trucker_id IS NOT NULL AND v_offer.assigned_trucker_id != p_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta operacion'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT false, 'Primero debes verificar el pickup'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.status != 'in_progress' THEN
        RETURN QUERY SELECT false, 'La oferta no esta en transito'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.delivery_verified_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 'La entrega ya fue verificada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.pin_attempts >= v_max_attempts THEN
        RETURN QUERY SELECT false, 'Demasiados intentos fallidos. Contacta soporte.'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.delivery_pin IS NULL THEN
        RETURN QUERY SELECT false, 'PIN de entrega no ha sido generado'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF UPPER(TRIM(v_offer.delivery_pin)) != UPPER(TRIM(p_input_pin)) THEN
        UPDATE public.cargo_offers
        SET pin_attempts = pin_attempts + 1,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY
        SELECT false, format('PIN incorrecto. Intentos restantes: %s', v_max_attempts - v_offer.pin_attempts - 1)::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    SELECT id, available_balance INTO v_wallet_id, v_available_before
    FROM public.wallets
    WHERE user_id = v_offer.assigned_trucker_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN QUERY SELECT false, 'Billetera del camionero no encontrada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    v_release_amount := COALESCE(v_offer.net_amount, v_offer.total_amount);
    v_available_after_deposit := v_available_before + v_release_amount;

    UPDATE public.wallets
    SET pending_balance = pending_balance - v_release_amount,
        available_balance = v_available_after_deposit,
        total_earned = total_earned + v_release_amount,
        total_trips_completed = total_trips_completed + 1,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO public.transactions (
        wallet_id, offer_id, type, status, amount, balance_before, balance_after, description, metadata
    ) VALUES (
        v_wallet_id,
        p_offer_id,
        'trip_deposit',
        'completed',
        v_release_amount,
        v_available_before,
        v_available_after_deposit,
        format('Pago liberado por viaje #%s', LEFT(p_offer_id::TEXT, 8)),
        jsonb_build_object('gross_release_amount', v_release_amount)
    );

    SELECT *
    INTO v_repayment
    FROM public.apply_advance_repayments(v_wallet_id, p_offer_id, v_release_amount, 'trip_settlement');

    UPDATE public.cargo_offers
    SET status = 'completed',
        delivery_verified_at = NOW(),
        pin_attempts = 0,
        updated_at = NOW()
    WHERE id = p_offer_id;

    UPDATE public.trucker_profiles
    SET total_trips = total_trips + 1,
        updated_at = NOW()
    WHERE user_id = v_offer.assigned_trucker_id;

    UPDATE public.business_profiles
    SET total_shipments = total_shipments + 1,
        updated_at = NOW()
    WHERE user_id = v_offer.business_id;

    RETURN QUERY
    SELECT
        true,
        CASE
            WHEN COALESCE(v_repayment.total_applied, 0) > 0
                THEN format('Viaje completado. Se liberaron %s y se descontaron %s por adelantos.', v_release_amount, v_repayment.total_applied)
            ELSE 'Viaje completado. El pago fue liberado a tu billetera.'
        END::TEXT,
        GREATEST(v_release_amount - COALESCE(v_repayment.total_applied, 0), 0);
END;
$$;

COMMENT ON TABLE public.lending_settings IS 'Configuracion del producto KargaX Adelanto';
COMMENT ON TABLE public.lending_treasury IS 'Tesoreria interna para adelantos con capital propio';
COMMENT ON TABLE public.fuel_advances IS 'Solicitudes y desembolsos del producto de adelanto';
COMMENT ON TABLE public.fuel_advance_repayments IS 'Trazabilidad de pagos de capital e intereses de adelantos';

GRANT EXECUTE ON FUNCTION public.mark_overdue_fuel_advances TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_fuel_advances TO service_role;
GRANT EXECUTE ON FUNCTION public.get_fuel_advance_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fuel_advance_eligibility TO service_role;
GRANT EXECUTE ON FUNCTION public.request_fuel_advance TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_fuel_advance TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_fuel_advance TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_fuel_advance TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_fuel_advance TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_fuel_advance TO service_role;
GRANT EXECUTE ON FUNCTION public.restructure_fuel_advance TO authenticated;
GRANT EXECUTE ON FUNCTION public.restructure_fuel_advance TO service_role;
GRANT EXECUTE ON FUNCTION public.write_off_fuel_advance TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_off_fuel_advance TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_lending_treasury TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_lending_treasury TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_advance_repayments TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_advance_repayments TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_fuel_advance_offer_at_risk TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_fuel_advance_offer_at_risk TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin TO service_role;
