-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 011: TRANSACTIONS (TRANSACCIONES)
-- Historial completo de movimientos financieros
-- Audit trail para compliance y transparencia
-- =============================================================================

-- =============================================================================
-- CUSTOM TYPES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'trip_deposit',     -- Depósito por viaje completado (pending -> available)
        'trip_pending',     -- Pago asegurado (entra a pending_balance)
        'platform_fee',     -- Comisión de la plataforma
        'withdrawal',       -- Retiro a cuenta bancaria
        'withdrawal_fee',   -- Comisión por retiro
        'refund',           -- Reembolso
        'adjustment',       -- Ajuste manual por admin
        'bonus'             -- Bonificación/promoción
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM (
        'pending',      -- En proceso
        'completed',    -- Completada
        'failed',       -- Falló
        'cancelled'     -- Cancelada
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- TABLA DE TRANSACCIONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    
    -- Transaction Details
    type transaction_type NOT NULL,
    status transaction_status NOT NULL DEFAULT 'completed',
    
    -- Montos
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    
    -- Metadata
    description TEXT NOT NULL,
    reference_id VARCHAR(100), -- ID externo (pasarela, etc)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDICES PARA PERFORMANCE Y REPORTES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_offer ON public.transactions(offer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_created ON public.transactions(wallet_id, created_at DESC);

-- =============================================================================
-- FUNCIÓN: Registrar transacción de forma segura
-- =============================================================================

CREATE OR REPLACE FUNCTION record_transaction(
    p_wallet_id UUID,
    p_offer_id UUID,
    p_type transaction_type,
    p_amount DECIMAL,
    p_description TEXT,
    p_reference_id VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_balance_before DECIMAL;
    v_balance_after DECIMAL;
    v_transaction_id UUID;
BEGIN
    -- Obtener balance actual
    SELECT available_balance INTO v_balance_before
    FROM wallets WHERE id = p_wallet_id FOR UPDATE;
    
    -- Calcular nuevo balance
    v_balance_after := v_balance_before + p_amount;
    
    -- Insertar transacción
    INSERT INTO transactions (
        wallet_id, offer_id, type, amount,
        balance_before, balance_after, description,
        reference_id, metadata
    ) VALUES (
        p_wallet_id, p_offer_id, p_type, p_amount,
        v_balance_before, v_balance_after, p_description,
        p_reference_id, p_metadata
    ) RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios solo pueden ver transacciones de SU billetera
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (
        wallet_id IN (
            SELECT id FROM public.wallets WHERE user_id = auth.uid()
        )
    );

-- Policy: Solo sistema puede insertar transacciones (via functions)
-- Las transacciones son inmutables - no se pueden update ni delete

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT ON public.transactions TO authenticated;

-- =============================================================================
-- COMENTARIOS
-- =============================================================================

COMMENT ON TABLE public.transactions IS 'Registro inmutable de todas las transacciones financieras';
COMMENT ON COLUMN public.transactions.balance_before IS 'Saldo antes de la transacción (audit trail)';
COMMENT ON COLUMN public.transactions.balance_after IS 'Saldo después de la transacción (audit trail)';
