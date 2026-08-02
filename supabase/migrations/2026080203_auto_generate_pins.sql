-- =============================================================================
-- KARGAX - MIGRATION 2026080203: AUTOMATIC PIN GENERATION ON ALL OFFERS
-- Garantiza que TODA oferta (Flota Privada o Marketplace) tenga PINs generados
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_ensure_cargo_offer_pins()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pickup_pin IS NULL OR TRIM(NEW.pickup_pin) = '' THEN
        NEW.pickup_pin := public.generate_secure_pin();
    END IF;

    IF NEW.delivery_pin IS NULL OR TRIM(NEW.delivery_pin) = '' THEN
        NEW.delivery_pin := public.generate_secure_pin();
    END IF;

    WHILE NEW.delivery_pin = NEW.pickup_pin LOOP
        NEW.delivery_pin := public.generate_secure_pin();
    END WHILE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_cargo_offer_pins_trigger ON public.cargo_offers;

CREATE TRIGGER ensure_cargo_offer_pins_trigger
    BEFORE INSERT OR UPDATE ON public.cargo_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_ensure_cargo_offer_pins();

-- Backfill PINs for any existing offers missing PINs
DO $$
DECLARE
    r RECORD;
    v_p_pin VARCHAR(6);
    v_d_pin VARCHAR(6);
BEGIN
    FOR r IN SELECT id FROM public.cargo_offers WHERE pickup_pin IS NULL OR delivery_pin IS NULL LOOP
        v_p_pin := public.generate_secure_pin();
        v_d_pin := public.generate_secure_pin();
        WHILE v_d_pin = v_p_pin LOOP
            v_d_pin := public.generate_secure_pin();
        END WHILE;

        UPDATE public.cargo_offers
        SET pickup_pin = COALESCE(pickup_pin, v_p_pin),
            delivery_pin = COALESCE(delivery_pin, v_d_pin)
        WHERE id = r.id;
    END LOOP;
END $$;
