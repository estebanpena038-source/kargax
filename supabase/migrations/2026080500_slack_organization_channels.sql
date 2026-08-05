-- =============================================================================
-- KARGAX - MIGRATION 2026080500: SLACK-STYLE ORGANIZATION CHANNELS & INVITE CODES
-- Estructura de mensajería organizacional estilo Apple / Slack
-- =============================================================================

-- 1. AGREGAR CÓDIGO DE INVITACIÓN ÚNICO A BUSINESS PROFILES
DO $$ BEGIN
    ALTER TABLE public.business_profiles 
        ADD COLUMN IF NOT EXISTS org_invite_code VARCHAR(32) UNIQUE;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 2. FUNCIÓN PARA GENERAR CÓDIGO DE INVITACIÓN LEGIBLE (ej. KX-ORGANIZACION-9821)
CREATE OR REPLACE FUNCTION public.generate_org_invite_code(p_business_id UUID)
RETURNS VARCHAR(32) AS $$
DECLARE
    v_company_name TEXT;
    v_clean_prefix TEXT;
    v_random_code VARCHAR(6);
    v_final_code VARCHAR(32);
BEGIN
    SELECT COALESCE(company_name, 'ORGANIZACION') INTO v_company_name
    FROM public.business_profiles
    WHERE id = p_business_id;

    IF v_company_name IS NULL THEN
        v_company_name := 'ORGANIZACION';
    END IF;

    -- Limpiar texto y tomar primeros 8 caracteres alfanuméricos
    v_clean_prefix := UPPER(REGEXP_REPLACE(v_company_name, '[^a-zA-Z0-9]', '', 'g'));
    IF LENGTH(v_clean_prefix) < 3 THEN
        v_clean_prefix := 'KARGAX';
    ELSE
        v_clean_prefix := SUBSTRING(v_clean_prefix FROM 1 FOR 8);
    END IF;

    v_random_code := LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    v_final_code := 'KX-' || v_clean_prefix || '-' || v_random_code;

    -- Asignar a la empresa
    UPDATE public.business_profiles
    SET org_invite_code = v_final_code
    WHERE id = p_business_id AND (org_invite_code IS NULL OR org_invite_code = '');

    RETURN v_final_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNCIÓN PARA AUTO-CREAR CANALES POR DEFECTO (#general, #novedades-flota, #alertas)
CREATE OR REPLACE FUNCTION public.ensure_default_org_channels(p_business_id UUID)
RETURNS VOID AS $$
DECLARE
    v_general_id UUID;
    v_fleet_id UUID;
    v_alerts_id UUID;
    v_owner_id UUID;
BEGIN
    SELECT user_id INTO v_owner_id
    FROM public.business_profiles
    WHERE id = p_business_id;

    -- Canal 1: #general
    SELECT id INTO v_general_id FROM public.conversations
    WHERE business_id = p_business_id AND title = '#general' AND channel_type = 'fleet'
    LIMIT 1;

    IF v_general_id IS NULL THEN
        INSERT INTO public.conversations (channel_type, title, entity_type, business_id, is_archived)
        VALUES ('fleet', '#general', 'fleet', p_business_id, FALSE)
        RETURNING id INTO v_general_id;

        IF v_owner_id IS NOT NULL THEN
            INSERT INTO public.conversation_participants (conversation_id, user_id, role)
            VALUES (v_general_id, v_owner_id, 'owner')
            ON CONFLICT (conversation_id, user_id) DO NOTHING;
        END IF;
    END IF;

    -- Canal 2: #novedades-flota
    SELECT id INTO v_fleet_id FROM public.conversations
    WHERE business_id = p_business_id AND title = '#novedades-flota' AND channel_type = 'fleet'
    LIMIT 1;

    IF v_fleet_id IS NULL THEN
        INSERT INTO public.conversations (channel_type, title, entity_type, business_id, is_archived)
        VALUES ('fleet', '#novedades-flota', 'fleet', p_business_id, FALSE)
        RETURNING id INTO v_fleet_id;

        IF v_owner_id IS NOT NULL THEN
            INSERT INTO public.conversation_participants (conversation_id, user_id, role)
            VALUES (v_fleet_id, v_owner_id, 'owner')
            ON CONFLICT (conversation_id, user_id) DO NOTHING;
        END IF;
    END IF;

    -- Canal 3: #alertas
    SELECT id INTO v_alerts_id FROM public.conversations
    WHERE business_id = p_business_id AND title = '#alertas' AND channel_type = 'system'
    LIMIT 1;

    IF v_alerts_id IS NULL THEN
        INSERT INTO public.conversations (channel_type, title, entity_type, business_id, is_archived)
        VALUES ('system', '#alertas', 'support', p_business_id, FALSE)
        RETURNING id INTO v_alerts_id;

        IF v_owner_id IS NOT NULL THEN
            INSERT INTO public.conversation_participants (conversation_id, user_id, role)
            VALUES (v_alerts_id, v_owner_id, 'owner')
            ON CONFLICT (conversation_id, user_id) DO NOTHING;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNCIÓN PARA UNIR UN USUARIO A UNA ORGANIZACIÓN MEDIANTE CÓDIGO (join_business_by_code)
CREATE OR REPLACE FUNCTION public.join_business_by_code(
    p_user_id UUID,
    p_invite_code TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    business_id UUID,
    company_name TEXT
) AS $$
DECLARE
    v_business RECORD;
    v_conv RECORD;
BEGIN
    -- Buscar la empresa por código
    SELECT * INTO v_business
    FROM public.business_profiles
    WHERE UPPER(TRIM(org_invite_code)) = UPPER(TRIM(p_invite_code));

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Código de organización no válido'::TEXT, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- Asegurar canales por defecto
    PERFORM public.ensure_default_org_channels(v_business.id);

    -- Auto-suscribir al usuario a todos los canales por defecto de la empresa
    FOR v_conv IN SELECT id FROM public.conversations WHERE business_id = v_business.id LOOP
        INSERT INTO public.conversation_participants (conversation_id, user_id, role)
        VALUES (v_conv.id, p_user_id, 'member')
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;

    RETURN QUERY SELECT TRUE, 'Te has unido exitosamente a ' || v_business.company_name, v_business.id, v_business.company_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGER EN CARGO_OFFERS: AUTO-CREACIÓN DE CANAL POR VIAJE Y AUTO-ARCHIVO
CREATE OR REPLACE FUNCTION public.sync_trip_messaging_channel()
RETURNS TRIGGER AS $$
DECLARE
    v_channel_id UUID;
    v_title TEXT;
BEGIN
    v_title := '#viaje-' || LOWER(COALESCE(NEW.origin_city, 'origen')) || '-' || LOWER(COALESCE(NEW.destination_city, 'destino'));

    -- Si el viaje está activo o reservado, asegurar el canal del viaje
    IF NEW.status IN ('reserved', 'in_progress', 'active') THEN
        SELECT id INTO v_channel_id
        FROM public.conversations
        WHERE entity_type = 'trip' AND entity_id = NEW.id;

        IF v_channel_id IS NULL THEN
            INSERT INTO public.conversations (
                channel_type, title, entity_id, entity_type, business_id, is_archived
            )
            VALUES (
                'trip', v_title, NEW.id, 'trip', NEW.business_id, FALSE
            )
            RETURNING id INTO v_channel_id;
        ELSE
            UPDATE public.conversations
            SET is_archived = FALSE, title = v_title
            WHERE id = v_channel_id;
        END IF;

        -- Añadir creador / empresa
        IF NEW.business_id IS NOT NULL THEN
            INSERT INTO public.conversation_participants (conversation_id, user_id, role)
            VALUES (v_channel_id, NEW.business_id, 'owner')
            ON CONFLICT (conversation_id, user_id) DO NOTHING;
        END IF;

        -- Añadir conductor asignado
        IF NEW.assigned_trucker_id IS NOT NULL THEN
            INSERT INTO public.conversation_participants (conversation_id, user_id, role)
            VALUES (v_channel_id, NEW.assigned_trucker_id, 'member')
            ON CONFLICT (conversation_id, user_id) DO NOTHING;
        END IF;

    -- Si el viaje se completa o cierra, auto-archivar el canal
    ELSIF NEW.status IN ('completed', 'cancelled', 'closed') THEN
        UPDATE public.conversations
        SET is_archived = TRUE
        WHERE entity_type = 'trip' AND entity_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_trip_messaging_channel_trigger ON public.cargo_offers;

CREATE TRIGGER sync_trip_messaging_channel_trigger
    AFTER INSERT OR UPDATE OF status, assigned_trucker_id ON public.cargo_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_trip_messaging_channel();

-- 6. BACKFILL CÓDIGOS E HISTÓRICOS
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.business_profiles WHERE org_invite_code IS NULL OR org_invite_code = '' LOOP
        PERFORM public.generate_org_invite_code(r.id);
        PERFORM public.ensure_default_org_channels(r.id);
    END LOOP;
END $$;
