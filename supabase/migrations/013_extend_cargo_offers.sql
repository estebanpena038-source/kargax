-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 013: EXTEND CARGO OFFERS
-- Agregar campos para sistema PIN y manifiesto de carga
-- =============================================================================

-- =============================================================================
-- NUEVAS COLUMNAS PARA CARGO_OFFERS
-- =============================================================================

-- Campos de contacto para pickup (origen)
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS pickup_contact_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS pickup_contact_phone VARCHAR(20);

-- Campos de contacto para delivery (destino)
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS delivery_contact_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS delivery_contact_phone VARCHAR(20);

-- PINs de verificación (generados al confirmar pago)
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS pickup_pin VARCHAR(6),
ADD COLUMN IF NOT EXISTS delivery_pin VARCHAR(6);

-- Manifiesto de carga (lista de items para picking)
-- Formato: [{"name": "Bultos Cemento", "quantity": 100, "checked": false}, ...]
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS manifest_items JSONB DEFAULT '[]';

-- Montos calculados
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(15,2);

-- Timestamps de verificación
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_verified_at TIMESTAMPTZ;

-- Intentos fallidos de PIN (para rate limiting)
ALTER TABLE public.cargo_offers
ADD COLUMN IF NOT EXISTS pin_attempts INTEGER DEFAULT 0;

-- =============================================================================
-- FUNCIÓN: Generar PIN seguro de 4 dígitos
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_secure_pin()
RETURNS VARCHAR(4) AS $$
DECLARE
    v_pin VARCHAR(4);
BEGIN
    -- Generar número aleatorio de 4 dígitos (1000-9999)
    v_pin := LPAD(FLOOR(1000 + RANDOM() * 9000)::TEXT, 4, '0');
    RETURN v_pin;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCIÓN: Generar PINs al confirmar pago
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_pins_for_offer(p_offer_id UUID)
RETURNS TABLE(pickup_pin VARCHAR, delivery_pin VARCHAR) AS $$
DECLARE
    v_pickup_pin VARCHAR(4);
    v_delivery_pin VARCHAR(4);
BEGIN
    -- Generar PINs únicos
    v_pickup_pin := generate_secure_pin();
    v_delivery_pin := generate_secure_pin();
    
    -- Asegurar que sean diferentes
    WHILE v_delivery_pin = v_pickup_pin LOOP
        v_delivery_pin := generate_secure_pin();
    END LOOP;
    
    -- Actualizar oferta con los PINs
    UPDATE cargo_offers SET
        pickup_pin = v_pickup_pin,
        delivery_pin = v_delivery_pin,
        updated_at = NOW()
    WHERE id = p_offer_id;
    
    RETURN QUERY SELECT v_pickup_pin, v_delivery_pin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ÍNDICES ADICIONALES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_offers_pickup_pin ON public.cargo_offers(pickup_pin) WHERE pickup_pin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_delivery_pin ON public.cargo_offers(delivery_pin) WHERE delivery_pin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_pickup_contact_phone ON public.cargo_offers(pickup_contact_phone);
CREATE INDEX IF NOT EXISTS idx_offers_delivery_contact_phone ON public.cargo_offers(delivery_contact_phone);

-- =============================================================================
-- COMENTARIOS
-- =============================================================================

COMMENT ON COLUMN public.cargo_offers.pickup_pin IS 'PIN que debe dar el bodeguero al conductor para iniciar viaje';
COMMENT ON COLUMN public.cargo_offers.delivery_pin IS 'PIN que debe dar el receptor al conductor para liberar pago';
COMMENT ON COLUMN public.cargo_offers.manifest_items IS 'Lista de items para verificar en pickup (picking list)';
COMMENT ON COLUMN public.cargo_offers.pin_attempts IS 'Contador de intentos fallidos de PIN (seguridad)';
