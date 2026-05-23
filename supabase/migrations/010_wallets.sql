-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 010: WALLETS (BILLETERAS)
-- Sistema de billeteras digitales para camioneros
-- Enterprise-Grade con máxima seguridad
-- =============================================================================

-- =============================================================================
-- TABLA DE BILLETERAS
-- Cada usuario (principalmente camioneros) tiene una billetera
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.wallets (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Propietario (1:1 con usuario)
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Saldos Financieros
    pending_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00 
        CONSTRAINT positive_pending CHECK (pending_balance >= 0),
    available_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00 
        CONSTRAINT positive_available CHECK (available_balance >= 0),
    
    -- Estadísticas
    total_earned DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_withdrawn DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_trips_completed INTEGER NOT NULL DEFAULT 0,
    
    -- Datos bancarios para retiros
    bank_name VARCHAR(100),
    bank_account_type VARCHAR(20), -- 'savings', 'checking'
    bank_account_number VARCHAR(50),
    bank_account_holder VARCHAR(200),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDICES PARA PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_available_balance ON public.wallets(available_balance DESC);

-- =============================================================================
-- TRIGGER: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_wallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_wallets_updated_at ON public.wallets;
CREATE TRIGGER trigger_wallets_updated_at
    BEFORE UPDATE ON public.wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_wallets_updated_at();

-- =============================================================================
-- TRIGGER: Auto-crear billetera al crear perfil de camionero
-- =============================================================================

CREATE OR REPLACE FUNCTION create_wallet_for_trucker()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo crear billetera para camioneros
    IF EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = NEW.user_id AND user_type = 'trucker'
    ) THEN
        INSERT INTO public.wallets (user_id)
        VALUES (NEW.user_id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_wallet_for_trucker ON public.trucker_profiles;
CREATE TRIGGER trigger_create_wallet_for_trucker
    AFTER INSERT ON public.trucker_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_wallet_for_trucker();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - MÁXIMA SEGURIDAD
-- =============================================================================

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios solo pueden ver SU billetera
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet"
    ON public.wallets FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Usuarios pueden actualizar datos bancarios de su billetera
DROP POLICY IF EXISTS "Users can update own wallet bank info" ON public.wallets;
CREATE POLICY "Users can update own wallet bank info"
    ON public.wallets FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Sistema puede insertar billeteras (via trigger)
DROP POLICY IF EXISTS "System can insert wallets" ON public.wallets;
CREATE POLICY "System can insert wallets"
    ON public.wallets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, UPDATE ON public.wallets TO authenticated;

-- =============================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================================================

COMMENT ON TABLE public.wallets IS 'Billeteras digitales para gestión de pagos de camioneros';
COMMENT ON COLUMN public.wallets.pending_balance IS 'Dinero retenido de viajes en progreso (no retirable)';
COMMENT ON COLUMN public.wallets.available_balance IS 'Dinero disponible para retiro';
COMMENT ON COLUMN public.wallets.total_earned IS 'Histórico total ganado en la plataforma';
