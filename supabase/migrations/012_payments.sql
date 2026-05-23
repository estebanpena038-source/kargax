-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 012: PAYMENTS (PAGOS)
-- Registro de pagos con pasarela externa
-- =============================================================================

-- =============================================================================
-- CUSTOM TYPES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',      -- Esperando pago
        'processing',   -- En proceso con pasarela
        'completed',    -- Pagado exitosamente
        'failed',       -- Pago falló
        'refunded',     -- Reembolsado
        'expired'       -- Expiró sin pagar
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_gateway AS ENUM (
        'wompi',        -- Wompi (Colombia)
        'mercadopago',  -- Mercado Pago
        'stripe',       -- Stripe
        'manual'        -- Pago manual/efectivo
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- TABLA DE PAGOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Pasarela
    gateway payment_gateway NOT NULL DEFAULT 'wompi',
    external_id VARCHAR(255),               -- ID de la pasarela
    external_reference VARCHAR(255),        -- Referencia adicional
    
    -- Montos (en COP)
    subtotal DECIMAL(15,2) NOT NULL,        -- Flete base (lo que gana el camionero)
    platform_fee DECIMAL(15,2) NOT NULL,    -- Comisión plataforma (10%)
    gateway_fee DECIMAL(15,2) DEFAULT 0,    -- Costo pasarela (~3.5%)
    total_amount DECIMAL(15,2) NOT NULL,    -- Total cobrado a empresa
    
    -- Estado
    status payment_status NOT NULL DEFAULT 'pending',
    
    -- Response de pasarela
    gateway_response JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- =============================================================================
-- INDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_offer ON public.payments(offer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON public.payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_external ON public.payments(external_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at DESC);

-- =============================================================================
-- TRIGGER: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payments_updated_at ON public.payments;
CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- =============================================================================
-- FUNCIÓN: Crear pago pendiente
-- =============================================================================

CREATE OR REPLACE FUNCTION create_payment(
    p_offer_id UUID,
    p_payer_id UUID,
    p_subtotal DECIMAL,
    p_platform_fee_percent DECIMAL DEFAULT 10
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_platform_fee DECIMAL;
    v_total DECIMAL;
BEGIN
    -- Calcular fees
    v_platform_fee := ROUND(p_subtotal * p_platform_fee_percent / 100, 2);
    v_total := p_subtotal + v_platform_fee;
    
    INSERT INTO payments (
        offer_id, payer_id, subtotal, platform_fee, total_amount
    ) VALUES (
        p_offer_id, p_payer_id, p_subtotal, v_platform_fee, v_total
    ) RETURNING id INTO v_payment_id;
    
    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCIÓN: Confirmar pago exitoso (llamada desde webhook)
-- =============================================================================

CREATE OR REPLACE FUNCTION confirm_payment(
    p_payment_id UUID,
    p_external_id VARCHAR,
    p_gateway_response JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment RECORD;
    v_trucker_wallet_id UUID;
BEGIN
    -- Obtener pago con lock
    SELECT p.*, co.assigned_trucker_id, co.total_amount as freight_amount
    INTO v_payment
    FROM payments p
    JOIN cargo_offers co ON co.id = p.offer_id
    WHERE p.id = p_payment_id
    FOR UPDATE;
    
    IF NOT FOUND OR v_payment.status != 'pending' THEN
        RETURN FALSE;
    END IF;
    
    -- Actualizar estado del pago
    UPDATE payments SET
        status = 'completed',
        external_id = p_external_id,
        gateway_response = p_gateway_response,
        completed_at = NOW()
    WHERE id = p_payment_id;
    
    -- Obtener wallet del camionero
    SELECT id INTO v_trucker_wallet_id
    FROM wallets 
    WHERE user_id = v_payment.assigned_trucker_id;
    
    -- Si hay camionero asignado, agregar a pending_balance
    IF v_trucker_wallet_id IS NOT NULL THEN
        UPDATE wallets SET
            pending_balance = pending_balance + v_payment.subtotal
        WHERE id = v_trucker_wallet_id;
        
        -- Registrar transacción
        PERFORM record_transaction(
            v_trucker_wallet_id,
            v_payment.offer_id,
            'trip_pending',
            v_payment.subtotal,
            'Pago asegurado para viaje'
        );
    END IF;
    
    -- Actualizar estado de la oferta a reservada
    UPDATE cargo_offers SET
        status = 'in_progress'
    WHERE id = v_payment.offer_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policy: Pagadores pueden ver sus pagos
DROP POLICY IF EXISTS "Payers can view own payments" ON public.payments;
CREATE POLICY "Payers can view own payments"
    ON public.payments FOR SELECT
    USING (payer_id = auth.uid());

-- Policy: Dueños de oferta pueden ver pagos relacionados
DROP POLICY IF EXISTS "Offer owners can view payments" ON public.payments;
CREATE POLICY "Offer owners can view payments"
    ON public.payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cargo_offers 
            WHERE id = offer_id 
            AND (business_id = auth.uid() OR assigned_trucker_id = auth.uid())
        )
    );

-- Policy: Solo sistema puede insertar/actualizar (via functions)

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT ON public.payments TO authenticated;

-- =============================================================================
-- COMENTARIOS
-- =============================================================================

COMMENT ON TABLE public.payments IS 'Registro de pagos procesados por pasarela externa';
COMMENT ON COLUMN public.payments.subtotal IS 'Monto neto para el camionero';
COMMENT ON COLUMN public.payments.platform_fee IS 'Comisión CargaXpert (10%)';
COMMENT ON COLUMN public.payments.total_amount IS 'Total cobrado a la empresa';
