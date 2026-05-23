-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 035: PRIVATE FLEET B2B
--
-- Objetivos:
-- 1. Habilitar la flota privada B2B con invitaciones, vinculacion formal y
--    asignacion directa de viajes.
-- 2. Extender planes SaaS con limites de conductores privados.
-- 3. Separar viaticos vs flete en la capa financiera y liberar fondos con
--    reglas operativas distintas.
-- 4. Persistir firmas digitales en Storage y reflejarlas en la trazabilidad.
-- =============================================================================

-- =============================================================================
-- PLAN LIMITS & NOTIFICATION TYPES
-- =============================================================================

ALTER TABLE public.billing_plans
    ADD COLUMN IF NOT EXISTS max_private_fleet_drivers INTEGER;

UPDATE public.billing_plans
SET max_private_fleet_drivers = CASE code
    WHEN 'free' THEN 3
    WHEN 'growth' THEN 15
    WHEN 'scale' THEN NULL
    WHEN 'enterprise' THEN NULL
    ELSE max_private_fleet_drivers
END
WHERE code IN ('free', 'growth', 'scale', 'enterprise');

UPDATE public.billing_plans
SET feature_matrix = jsonb_strip_nulls(
    COALESCE(feature_matrix, '{}'::jsonb) ||
    jsonb_build_object(
        'private_fleet', true,
        'private_fleet_driver_limit', max_private_fleet_drivers,
        'private_fleet_payroll_api', CASE WHEN code IN ('scale', 'enterprise') THEN true ELSE false END
    )
)
WHERE code IN ('free', 'growth', 'scale', 'enterprise');

COMMENT ON COLUMN public.billing_plans.max_private_fleet_drivers IS
'Maximo de conductores que la empresa puede operar en flota privada. NULL = ilimitado.';

DO $$ BEGIN
    ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'assigned';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'expense_advance';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'expense_refund';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

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
    'private_fleet_expense_released',
    'private_fleet_freight_released',
    'private_fleet_incident',
    'private_fleet_signature_captured'
));

CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(user_id, type);

-- =============================================================================
-- PRIVATE FLEET CORE TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_fleet_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    invite_code VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    used_by_trucker_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_business_fleet_invitations_business
    ON public.business_fleet_invitations(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_fleet_invitations_status
    ON public.business_fleet_invitations(status, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.business_fleet_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    trucker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'removed')),
    internal_driver_id VARCHAR(50),
    vehicle_plate VARCHAR(20),
    notes TEXT,
    invited_via_invitation_id UUID REFERENCES public.business_fleet_invitations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, trucker_id)
);

CREATE INDEX IF NOT EXISTS idx_business_fleet_members_business
    ON public.business_fleet_members(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_fleet_members_trucker
    ON public.business_fleet_members(trucker_id, status);

CREATE TABLE IF NOT EXISTS public.trip_financial_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    trucker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    wallet_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    allocation_type VARCHAR(20) NOT NULL
        CHECK (allocation_type IN ('expense_advance', 'freight_payment')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'held_in_custody'
        CHECK (status IN ('held_in_custody', 'released_to_wallet', 'refunded')),
    released_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (offer_id, allocation_type)
);

CREATE INDEX IF NOT EXISTS idx_trip_financial_allocations_offer
    ON public.trip_financial_allocations(offer_id, allocation_type);
CREATE INDEX IF NOT EXISTS idx_trip_financial_allocations_trucker
    ON public.trip_financial_allocations(trucker_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.trip_signature_evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES public.cargo_offers(id) ON DELETE CASCADE,
    created_by_trucker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    signature_stage VARCHAR(30) NOT NULL
        CHECK (signature_stage IN ('origin_dispatch', 'delivery_pod')),
    signer_name TEXT,
    signer_document_id TEXT,
    signer_role VARCHAR(30) NOT NULL DEFAULT 'other'
        CHECK (signer_role IN ('warehouse_manager', 'customer', 'receiver', 'other')),
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_signature_evidences_offer
    ON public.trip_signature_evidences(offer_id, signature_stage, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_business_fleet_members_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_fleet_members_updated_at ON public.business_fleet_members;
CREATE TRIGGER trg_business_fleet_members_updated_at
    BEFORE UPDATE ON public.business_fleet_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_business_fleet_members_updated_at();

-- =============================================================================
-- CARGO OFFERS EXTENSIONS
-- =============================================================================

ALTER TABLE public.cargo_offers
    ADD COLUMN IF NOT EXISTS is_private_fleet BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS private_fleet_trucker_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expense_allowance_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS freight_payment_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS private_fleet_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS private_fleet_confirmed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.cargo_offers
DROP CONSTRAINT IF EXISTS cargo_offers_private_fleet_requirements_check;

ALTER TABLE public.cargo_offers
ADD CONSTRAINT cargo_offers_private_fleet_requirements_check
CHECK (
    is_private_fleet = FALSE
    OR private_fleet_trucker_id IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cargo_offers_private_fleet
    ON public.cargo_offers(is_private_fleet, private_fleet_trucker_id, status);

CREATE INDEX IF NOT EXISTS idx_cargo_offers_business_private_fleet
    ON public.cargo_offers(business_id, is_private_fleet, created_at DESC);

-- =============================================================================
-- STORAGE BUCKET FOR SIGNATURES
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'trip-signatures',
    'trip-signatures',
    true,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload trip signatures" ON storage.objects;
CREATE POLICY "Authenticated users can upload trip signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trip-signatures');

DROP POLICY IF EXISTS "Public can view trip signatures" ON storage.objects;
CREATE POLICY "Public can view trip signatures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'trip-signatures');

DROP POLICY IF EXISTS "Authenticated users can delete trip signatures" ON storage.objects;
CREATE POLICY "Authenticated users can delete trip signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'trip-signatures');

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.business_fleet_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_fleet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_financial_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_signature_evidences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Businesses can manage own fleet invitations" ON public.business_fleet_invitations;
CREATE POLICY "Businesses can manage own fleet invitations"
    ON public.business_fleet_invitations
    FOR ALL
    TO authenticated
    USING (business_id = auth.uid())
    WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "Truckers can view related fleet invitations" ON public.business_fleet_invitations;
CREATE POLICY "Truckers can view related fleet invitations"
    ON public.business_fleet_invitations
    FOR SELECT
    TO authenticated
    USING (used_by_trucker_id = auth.uid());

DROP POLICY IF EXISTS "Businesses can manage own fleet members" ON public.business_fleet_members;
CREATE POLICY "Businesses can manage own fleet members"
    ON public.business_fleet_members
    FOR ALL
    TO authenticated
    USING (business_id = auth.uid())
    WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "Truckers can view own fleet memberships" ON public.business_fleet_members;
CREATE POLICY "Truckers can view own fleet memberships"
    ON public.business_fleet_members
    FOR SELECT
    TO authenticated
    USING (trucker_id = auth.uid());

DROP POLICY IF EXISTS "Businesses and truckers can view own financial allocations" ON public.trip_financial_allocations;
CREATE POLICY "Businesses and truckers can view own financial allocations"
    ON public.trip_financial_allocations
    FOR SELECT
    TO authenticated
    USING (business_id = auth.uid() OR trucker_id = auth.uid());

DROP POLICY IF EXISTS "Businesses and truckers can view own trip signatures" ON public.trip_signature_evidences;
CREATE POLICY "Businesses and truckers can view own trip signatures"
    ON public.trip_signature_evidences
    FOR SELECT
    TO authenticated
    USING (
        created_by_trucker_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.cargo_offers co
            WHERE co.id = offer_id
              AND (co.business_id = auth.uid() OR co.assigned_trucker_id = auth.uid())
        )
    );

-- =============================================================================
-- HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_private_fleet_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_code TEXT;
BEGIN
    v_code := 'KGX-FLT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));
    RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_business_fleet_invitation(
    p_business_id UUID,
    p_created_by UUID DEFAULT auth.uid(),
    p_expires_hours INTEGER DEFAULT 48
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    invitation_id UUID,
    invite_code TEXT,
    invite_link TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation_id UUID;
    v_invite_code TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_invite_code := public.generate_private_fleet_invite_code();
    v_expires_at := NOW() + make_interval(hours => GREATEST(COALESCE(p_expires_hours, 48), 1));

    INSERT INTO public.business_fleet_invitations (
        business_id,
        invite_code,
        created_by,
        expires_at
    ) VALUES (
        p_business_id,
        v_invite_code,
        p_created_by,
        v_expires_at
    )
    RETURNING id INTO v_invitation_id;

    RETURN QUERY SELECT
        true,
        'Invitacion creada'::TEXT,
        v_invitation_id,
        v_invite_code,
        format('/registro?invite=%s', v_invite_code),
        v_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_business_fleet_invitation(
    p_invite_code TEXT,
    p_trucker_id UUID DEFAULT auth.uid(),
    p_internal_driver_id TEXT DEFAULT NULL,
    p_vehicle_plate TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    business_id UUID,
    membership_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation RECORD;
    v_membership_id UUID;
BEGIN
    SELECT *
    INTO v_invitation
    FROM public.business_fleet_invitations
    WHERE invite_code = UPPER(BTRIM(p_invite_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Codigo de invitacion no encontrado'::TEXT, NULL::UUID, NULL::UUID;
        RETURN;
    END IF;

    IF v_invitation.status = 'revoked' THEN
        RETURN QUERY SELECT false, 'La invitacion fue revocada por la empresa'::TEXT, v_invitation.business_id, NULL::UUID;
        RETURN;
    END IF;

    IF v_invitation.status = 'accepted' AND v_invitation.used_by_trucker_id = p_trucker_id THEN
        SELECT id
        INTO v_membership_id
        FROM public.business_fleet_members
        WHERE business_id = v_invitation.business_id
          AND trucker_id = p_trucker_id
        LIMIT 1;

        RETURN QUERY SELECT true, 'La invitacion ya estaba vinculada a tu perfil'::TEXT, v_invitation.business_id, v_membership_id;
        RETURN;
    END IF;

    IF v_invitation.expires_at < NOW() THEN
        UPDATE public.business_fleet_invitations
        SET status = 'expired'
        WHERE id = v_invitation.id;

        RETURN QUERY SELECT false, 'La invitacion ya expiro'::TEXT, v_invitation.business_id, NULL::UUID;
        RETURN;
    END IF;

    INSERT INTO public.business_fleet_members (
        business_id,
        trucker_id,
        status,
        internal_driver_id,
        vehicle_plate,
        invited_via_invitation_id,
        created_by
    ) VALUES (
        v_invitation.business_id,
        p_trucker_id,
        'active',
        NULLIF(BTRIM(p_internal_driver_id), ''),
        NULLIF(UPPER(BTRIM(p_vehicle_plate)), ''),
        v_invitation.id,
        v_invitation.created_by
    )
    ON CONFLICT (business_id, trucker_id)
    DO UPDATE SET
        status = 'active',
        internal_driver_id = COALESCE(NULLIF(EXCLUDED.internal_driver_id, ''), public.business_fleet_members.internal_driver_id),
        vehicle_plate = COALESCE(NULLIF(EXCLUDED.vehicle_plate, ''), public.business_fleet_members.vehicle_plate),
        invited_via_invitation_id = COALESCE(public.business_fleet_members.invited_via_invitation_id, EXCLUDED.invited_via_invitation_id),
        updated_at = NOW()
    RETURNING id INTO v_membership_id;

    UPDATE public.business_fleet_invitations
    SET
        status = 'accepted',
        used_by_trucker_id = p_trucker_id,
        accepted_at = NOW()
    WHERE id = v_invitation.id;

    PERFORM public.create_notification(
        v_invitation.business_id,
        'fleet_invitation_accepted',
        'Conductor vinculado a tu flota',
        public.get_profile_display_name(p_trucker_id, 'Un conductor') || ' se unio a tu flota privada en KargaX.',
        jsonb_build_object(
            'business_id', v_invitation.business_id,
            'trucker_id', p_trucker_id,
            'invitation_id', v_invitation.id,
            'membership_id', v_membership_id
        )
    );

    RETURN QUERY SELECT true, 'Invitacion aceptada correctamente'::TEXT, v_invitation.business_id, v_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_private_fleet_event(
    p_offer_id UUID,
    p_trucker_id UUID,
    p_event_type TEXT,
    p_notes TEXT DEFAULT NULL,
    p_photo_urls TEXT[] DEFAULT NULL,
    p_latitude DECIMAL DEFAULT NULL,
    p_longitude DECIMAL DEFAULT NULL,
    p_accuracy_meters DECIMAL DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    event_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_event_id UUID;
BEGIN
    SELECT *
    INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF v_offer.assigned_trucker_id <> p_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para reportar este viaje'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    INSERT INTO public.picking_events (
        offer_id,
        trucker_id,
        event_type,
        notes,
        photo_urls,
        latitude,
        longitude,
        accuracy_meters,
        actor_role,
        metadata
    ) VALUES (
        p_offer_id,
        p_trucker_id,
        p_event_type,
        p_notes,
        p_photo_urls,
        p_latitude,
        p_longitude,
        p_accuracy_meters,
        'trucker',
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_event_id;

    IF p_event_type IN ('fleet_incident', 'panic_alert') THEN
        PERFORM public.create_notification(
            v_offer.business_id,
            'private_fleet_incident',
            CASE WHEN p_event_type = 'panic_alert' THEN 'Boton de panico activado' ELSE 'Novedad reportada en ruta' END,
            COALESCE(p_notes, 'El conductor reporto un evento operativo en ruta.'),
            jsonb_build_object(
                'offer_id', p_offer_id,
                'event_id', v_event_id,
                'trucker_id', p_trucker_id,
                'latitude', p_latitude,
                'longitude', p_longitude,
                'photo_urls', COALESCE(p_photo_urls, ARRAY[]::TEXT[])
            )
        );
    END IF;

    RETURN QUERY SELECT true, 'Evento registrado'::TEXT, v_event_id;
END;
$$;

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
    v_payment_id UUID;
    v_wallet RECORD;
    v_balance_before DECIMAL(15,2);
    v_balance_after DECIMAL(15,2);
    v_transaction_id UUID;
    v_existing_expense_allocation RECORD;
    v_process_result RECORD;
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

    IF v_offer.private_fleet_confirmed_at IS NOT NULL AND v_offer.pickup_pin IS NOT NULL AND v_offer.delivery_pin IS NOT NULL THEN
        SELECT p.id
        INTO v_payment_id
        FROM public.payments p
        WHERE p.offer_id = p_offer_id
        ORDER BY p.created_at DESC
        LIMIT 1;

        RETURN QUERY SELECT
            true,
            'El viaje privado ya habia sido confirmado'::TEXT,
            v_payment_id,
            COALESCE(v_offer.expense_allowance_amount, 0),
            COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount)),
            v_offer.pickup_pin,
            v_offer.delivery_pin;
        RETURN;
    END IF;

    IF v_offer.status NOT IN ('assigned', 'reserved') THEN
        RETURN QUERY SELECT false, 'La oferta no esta lista para confirmacion'::TEXT, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    SELECT *
    INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_trucker_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.wallets (
            user_id,
            pending_balance,
            available_balance,
            total_earned,
            total_withdrawn,
            total_trips_completed
        ) VALUES (
            p_trucker_id,
            0,
            0,
            0,
            0,
            0
        )
        RETURNING * INTO v_wallet;
    END IF;

    INSERT INTO public.payments (
        offer_id,
        payer_id,
        gateway,
        external_reference,
        subtotal,
        platform_fee,
        gateway_fee,
        total_amount,
        status,
        gateway_response
    ) VALUES (
        p_offer_id,
        v_offer.business_id,
        'manual',
        'private-fleet-' || p_offer_id::TEXT,
        COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        0,
        0,
        COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        'pending',
        jsonb_build_object(
            'source_kind', 'private_fleet_manual_funding',
            'offer_id', p_offer_id::TEXT,
            'business_id', v_offer.business_id::TEXT,
            'trucker_id', p_trucker_id::TEXT
        )
    )
    RETURNING id INTO v_payment_id;

    UPDATE public.cargo_offers
    SET
        assigned_trucker_id = p_trucker_id,
        private_fleet_trucker_id = p_trucker_id,
        net_amount = COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        total_amount = COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.total_amount, 0)),
        platform_fee = 0,
        private_fleet_confirmed_at = NOW(),
        private_fleet_confirmed_by = p_trucker_id,
        updated_at = NOW()
    WHERE id = p_offer_id;

    INSERT INTO public.trip_financial_allocations (
        offer_id,
        business_id,
        trucker_id,
        payment_id,
        allocation_type,
        amount,
        status,
        metadata
    ) VALUES
    (
        p_offer_id,
        v_offer.business_id,
        p_trucker_id,
        v_payment_id,
        'freight_payment',
        COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        'held_in_custody',
        jsonb_build_object('source_kind', 'private_fleet_freight_hold')
    )
    ON CONFLICT (offer_id, allocation_type)
    DO UPDATE SET
        payment_id = COALESCE(EXCLUDED.payment_id, public.trip_financial_allocations.payment_id),
        amount = EXCLUDED.amount,
        status = CASE
            WHEN public.trip_financial_allocations.status = 'released_to_wallet' THEN public.trip_financial_allocations.status
            ELSE 'held_in_custody'
        END,
        metadata = jsonb_strip_nulls(COALESCE(public.trip_financial_allocations.metadata, '{}'::jsonb) || EXCLUDED.metadata);

    INSERT INTO public.trip_financial_allocations (
        offer_id,
        business_id,
        trucker_id,
        allocation_type,
        amount,
        status,
        metadata
    ) VALUES (
        p_offer_id,
        v_offer.business_id,
        p_trucker_id,
        'expense_advance',
        COALESCE(v_offer.expense_allowance_amount, 0),
        CASE WHEN COALESCE(v_offer.expense_allowance_amount, 0) > 0 THEN 'held_in_custody' ELSE 'released_to_wallet' END,
        jsonb_build_object('source_kind', 'private_fleet_expense_hold')
    )
    ON CONFLICT (offer_id, allocation_type)
    DO UPDATE SET
        amount = EXCLUDED.amount,
        metadata = jsonb_strip_nulls(COALESCE(public.trip_financial_allocations.metadata, '{}'::jsonb) || EXCLUDED.metadata);

    SELECT *
    INTO v_process_result
    FROM public.process_successful_payment(
        v_payment_id,
        'private_fleet_manual',
        jsonb_build_object(
            'source_kind', 'private_fleet_confirmation',
            'offer_id', p_offer_id::TEXT,
            'trucker_id', p_trucker_id::TEXT
        )
    )
    LIMIT 1;

    IF COALESCE(v_process_result.success, FALSE) = FALSE THEN
        RETURN QUERY SELECT false, COALESCE(v_process_result.message, 'No se pudo reservar el viaje privado')::TEXT, v_payment_id, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    SELECT *
    INTO v_existing_expense_allocation
    FROM public.trip_financial_allocations
    WHERE offer_id = p_offer_id
      AND allocation_type = 'expense_advance'
    FOR UPDATE;

    IF COALESCE(v_offer.expense_allowance_amount, 0) > 0
       AND COALESCE(v_existing_expense_allocation.status, 'held_in_custody') <> 'released_to_wallet' THEN
        v_balance_before := COALESCE(v_wallet.available_balance, 0);
        v_balance_after := v_balance_before + COALESCE(v_offer.expense_allowance_amount, 0);

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
            metadata
        ) VALUES (
            v_wallet.id,
            p_offer_id,
            'expense_advance',
            'completed',
            COALESCE(v_offer.expense_allowance_amount, 0),
            v_balance_before,
            v_balance_after,
            COALESCE(v_wallet.pending_balance, 0),
            COALESCE(v_wallet.pending_balance, 0),
            format('Viaticos liberados para viaje privado #%s', LEFT(p_offer_id::TEXT, 8)),
            p_offer_id::TEXT,
            jsonb_build_object(
                'source_kind', 'private_fleet_expense_release',
                'offer_id', p_offer_id::TEXT,
                'payment_id', v_payment_id::TEXT,
                'business_id', v_offer.business_id::TEXT
            )
        )
        RETURNING id INTO v_transaction_id;

        UPDATE public.trip_financial_allocations
        SET
            status = 'released_to_wallet',
            wallet_transaction_id = v_transaction_id,
            released_at = NOW(),
            metadata = jsonb_strip_nulls(
                COALESCE(metadata, '{}'::jsonb) ||
                jsonb_build_object(
                    'wallet_transaction_id', v_transaction_id::TEXT,
                    'released_reason', 'private_fleet_confirmation'
                )
            )
        WHERE id = v_existing_expense_allocation.id;

        PERFORM public.create_notification(
            p_trucker_id,
            'private_fleet_expense_released',
            'Viaticos disponibles',
            format('Has recibido %s en viaticos para tu viaje privado.', COALESCE(v_offer.expense_allowance_amount, 0)),
            jsonb_build_object(
                'offer_id', p_offer_id,
                'payment_id', v_payment_id,
                'amount', COALESCE(v_offer.expense_allowance_amount, 0),
                'wallet_transaction_id', v_transaction_id
            )
        );
    END IF;

    RETURN QUERY SELECT
        true,
        'Viaje confirmado. Viaticos liberados y flete en custodia operativa.'::TEXT,
        v_payment_id,
        COALESCE(v_offer.expense_allowance_amount, 0),
        COALESCE(v_offer.freight_payment_amount, COALESCE(v_offer.net_amount, v_offer.total_amount), 0),
        v_process_result.pickup_pin,
        v_process_result.delivery_pin;
END;
$$;

COMMENT ON FUNCTION public.confirm_private_fleet_offer IS
'Confirma un viaje de flota privada, libera viaticos al available_balance y deja el flete en pending_balance.';

-- =============================================================================
-- DELIVERY RELEASE HOOK FOR PRIVATE FLEET
-- =============================================================================

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
    v_payment_id UUID;
    v_max_attempts INTEGER := 5;
    v_release_amount DECIMAL(15,2);
    v_available_before DECIMAL(15,2);
    v_available_after_deposit DECIMAL(15,2);
    v_repayment RECORD;
    v_effective_trucker_id UUID := COALESCE(p_trucker_id, auth.uid());
    v_freight_allocation_id UUID;
BEGIN
    SELECT *
    INTO v_offer
    FROM public.cargo_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Oferta no encontrada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_effective_trucker_id IS NULL OR v_offer.assigned_trucker_id <> v_effective_trucker_id THEN
        RETURN QUERY SELECT false, 'No tienes permiso para esta operacion'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.pickup_verified_at IS NULL THEN
        RETURN QUERY SELECT false, 'Primero debes verificar el pickup'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    IF v_offer.status <> 'in_progress' THEN
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

    IF UPPER(TRIM(v_offer.delivery_pin)) <> UPPER(TRIM(p_input_pin)) THEN
        UPDATE public.cargo_offers
        SET pin_attempts = pin_attempts + 1,
            updated_at = NOW()
        WHERE id = p_offer_id;

        RETURN QUERY
        SELECT
            false,
            format('PIN incorrecto. Intentos restantes: %s', v_max_attempts - v_offer.pin_attempts - 1)::TEXT,
            0::DECIMAL;
        RETURN;
    END IF;

    SELECT id, available_balance
    INTO v_wallet_id, v_available_before
    FROM public.wallets
    WHERE user_id = v_offer.assigned_trucker_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN QUERY SELECT false, 'Billetera del camionero no encontrada'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;

    SELECT p.id
    INTO v_payment_id
    FROM public.payments p
    WHERE p.offer_id = p_offer_id
      AND p.status = 'completed'
    ORDER BY p.completed_at DESC NULLS LAST, p.created_at DESC
    LIMIT 1;

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
        v_wallet_id,
        p_offer_id,
        'trip_deposit',
        'completed',
        v_release_amount,
        v_available_before,
        v_available_after_deposit,
        format('Pago liberado por viaje #%s', LEFT(p_offer_id::TEXT, 8)),
        COALESCE(v_payment_id::TEXT, p_offer_id::TEXT),
        jsonb_strip_nulls(
            jsonb_build_object(
                'source_kind', 'trip_settlement',
                'payment_id', v_payment_id::TEXT,
                'gross_release_amount', v_release_amount,
                'offer_id', p_offer_id::TEXT
            )
        )
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

    IF v_offer.destination_appointment_id IS NOT NULL THEN
        UPDATE public.warehouse_appointments
        SET status = 'completed',
            actual_start_at = COALESCE(actual_start_at, NOW()),
            actual_end_at = COALESCE(actual_end_at, NOW()),
            checked_in_at = COALESCE(checked_in_at, NOW()),
            checked_out_at = COALESCE(checked_out_at, NOW()),
            payment_status = CASE
                WHEN payment_status = 'n_a' THEN payment_status
                ELSE 'completed'
            END,
            updated_at = NOW()
        WHERE id = v_offer.destination_appointment_id
          AND status <> 'cancelled';
    END IF;

    UPDATE public.warehouse_tasks
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
                'completed_from_offer_event', 'delivery_pin_verified',
                'offer_id', p_offer_id::TEXT,
                'appointment_id', v_offer.destination_appointment_id::TEXT
            )
        ),
        updated_at = NOW()
    WHERE offer_id = p_offer_id
      AND status IN ('open', 'in_progress', 'blocked')
      AND task_type IN ('receiving', 'dispatch');

    UPDATE public.trucker_profiles
    SET total_trips = total_trips + 1,
        updated_at = NOW()
    WHERE user_id = v_offer.assigned_trucker_id;

    UPDATE public.business_profiles
    SET total_shipments = total_shipments + 1,
        updated_at = NOW()
    WHERE user_id = v_offer.business_id;

    UPDATE public.trip_financial_allocations
    SET
        status = 'released_to_wallet',
        released_at = NOW(),
        payment_id = COALESCE(payment_id, v_payment_id),
        metadata = jsonb_strip_nulls(
            COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
                'released_reason', 'delivery_pin_verified',
                'released_amount', v_release_amount
            )
        )
    WHERE offer_id = p_offer_id
      AND allocation_type = 'freight_payment'
    RETURNING id INTO v_freight_allocation_id;

    IF COALESCE(v_offer.is_private_fleet, FALSE) = TRUE THEN
        PERFORM public.create_notification(
            v_offer.assigned_trucker_id,
            'private_fleet_freight_released',
            'Flete liberado a tu billetera',
            format('Tu viaje privado fue cerrado y se liberaron %s a tu saldo disponible.', v_release_amount),
            jsonb_build_object(
                'offer_id', p_offer_id,
                'payment_id', v_payment_id,
                'allocation_id', v_freight_allocation_id,
                'amount', v_release_amount
            )
        );
    END IF;

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

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT ON public.business_fleet_invitations TO authenticated;
GRANT SELECT ON public.business_fleet_members TO authenticated;
GRANT SELECT ON public.trip_financial_allocations TO authenticated;
GRANT SELECT ON public.trip_signature_evidences TO authenticated;

GRANT EXECUTE ON FUNCTION public.generate_business_fleet_invitation(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_business_fleet_invitation(TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_private_fleet_event(UUID, UUID, TEXT, TEXT, TEXT[], DECIMAL, DECIMAL, DECIMAL, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_private_fleet_event(UUID, UUID, TEXT, TEXT, TEXT[], DECIMAL, DECIMAL, DECIMAL, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_private_fleet_offer(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin(UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin(UUID, VARCHAR, UUID) TO service_role;

