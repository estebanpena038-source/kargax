-- =============================================================================
-- KARGAX - WALLET WITHDRAWAL IDEMPOTENCY
--
-- High-risk financial migration:
-- - makes repeated wallet withdrawal submissions idempotent
-- - prevents duplicate active withdrawal ledger rows for the same client attempt
-- - keeps cancelled duplicate retries outside the active uniqueness constraint
-- =============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_withdrawal_request_idempotency
    ON public.transactions((metadata->>'idempotency_key'))
    WHERE type = 'withdrawal'
      AND status <> 'cancelled'
      AND metadata ? 'idempotency_key'
      AND COALESCE(metadata->>'source_kind', '') = 'withdrawal_request';

CREATE OR REPLACE FUNCTION public.create_marketplace_withdrawal_request(
    p_user_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_payment_details JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    request_id UUID,
    available_balance_after NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_balance RECORD;
    v_existing RECORD;
    v_request_id UUID;
    v_balance_before NUMERIC(15,2);
    v_balance_after NUMERIC(15,2);
    v_method_label TEXT;
    v_locked_for_payout BOOLEAN;
    v_idempotency_key TEXT;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN QUERY SELECT false, 'Monto invalido'::TEXT, NULL::UUID, 0::NUMERIC;
        RETURN;
    END IF;

    v_idempotency_key := NULLIF(TRIM(COALESCE(p_payment_details->>'idempotency_key', '')), '');

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Billetera no encontrada'::TEXT, NULL::UUID, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_idempotency_key IS NOT NULL THEN
        SELECT t.* INTO v_existing
        FROM public.transactions t
        WHERE t.wallet_id = v_wallet.id
          AND t.type = 'withdrawal'
          AND t.status <> 'cancelled'
          AND t.metadata->>'idempotency_key' = v_idempotency_key
        ORDER BY t.created_at ASC
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY SELECT
                true,
                'Solicitud de retiro marketplace ya registrada'::TEXT,
                v_existing.id,
                COALESCE(v_existing.balance_after, v_wallet.available_balance)::NUMERIC;
            RETURN;
        END IF;
    END IF;

    SELECT * INTO v_balance
    FROM public.get_marketplace_withdrawable_balance(v_wallet.id);

    IF p_amount > COALESCE(v_balance.available_cop, 0) THEN
        RETURN QUERY SELECT
            false,
            'Solo puedes retirar saldo marketplace confirmado. Las liquidaciones privadas quedan como comprobante externo.'::TEXT,
            NULL::UUID,
            COALESCE(v_balance.available_cop, 0)::NUMERIC;
        RETURN;
    END IF;

    v_balance_before := COALESCE(v_wallet.available_balance, 0);
    v_balance_after := v_balance_before - p_amount;
    v_locked_for_payout := LOWER(COALESCE(p_payment_details->>'automatic_payouts_enabled', 'false')) = 'true';
    v_method_label := CASE
        WHEN p_payment_method = 'nequi' THEN 'Nequi'
        WHEN p_payment_method = 'savings' THEN 'cuenta de ahorros'
        WHEN p_payment_method = 'checking' THEN 'cuenta corriente'
        ELSE 'metodo bancario'
    END;

    UPDATE public.wallets
    SET available_balance = v_balance_after,
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
        pending_balance_before,
        pending_balance_after,
        description,
        reference_id,
        metadata,
        money_rail,
        source_system,
        payout_eligible,
        locked_for_payout,
        external_proof_only
    ) VALUES (
        v_wallet.id,
        NULL,
        'withdrawal',
        'pending',
        p_amount * -1,
        v_balance_before,
        v_balance_after,
        COALESCE(v_wallet.pending_balance, 0),
        COALESCE(v_wallet.pending_balance, 0),
        format('Solicitud de retiro marketplace a %s', v_method_label),
        NULL,
        jsonb_strip_nulls(
            COALESCE(p_payment_details, '{}'::jsonb) ||
            jsonb_build_object(
                'payment_method', p_payment_method,
                'requested_by', p_user_id,
                'requested_at', NOW(),
                'source_kind', 'withdrawal_request',
                'rail_validation', 'marketplace_payout_eligible',
                'idempotency_key', v_idempotency_key
            )
        ),
        'marketplace_freelancer',
        COALESCE(p_payment_details->>'payout_provider', 'manual'),
        FALSE,
        v_locked_for_payout,
        FALSE
    )
    RETURNING id INTO v_request_id;

    UPDATE public.transactions
    SET reference_id = v_request_id::TEXT,
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
                'withdrawal_request_id', v_request_id::TEXT,
                'reference_id', v_request_id::TEXT
            )
        )
    WHERE id = v_request_id;

    RETURN QUERY SELECT true, 'Solicitud de retiro marketplace creada'::TEXT, v_request_id, v_balance_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_marketplace_withdrawal_request(UUID, NUMERIC, TEXT, JSONB) TO service_role;

COMMIT;
