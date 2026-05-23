BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = COALESCE(p_user_id, auth.uid())
          AND user_type = 'admin'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_manages_business(p_business_id UUID)
RETURNS BOOLEAN AS $$
    SELECT auth.uid() = p_business_id OR public.is_admin_user(auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.billing_plans (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT,
    price_monthly_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_warehouses INTEGER NOT NULL,
    max_internal_users INTEGER NOT NULL,
    max_monthly_trips INTEGER NOT NULL,
    includes_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    includes_locations BOOLEAN NOT NULL DEFAULT FALSE,
    includes_receipts BOOLEAN NOT NULL DEFAULT FALSE,
    includes_dispatches BOOLEAN NOT NULL DEFAULT FALSE,
    includes_analytics BOOLEAN NOT NULL DEFAULT FALSE,
    includes_api_webhooks BOOLEAN NOT NULL DEFAULT FALSE,
    includes_multi_client_3pl BOOLEAN NOT NULL DEFAULT FALSE,
    support_tier TEXT NOT NULL DEFAULT 'email'
        CHECK (support_tier IN ('email', 'priority', 'premium')),
    feature_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER trg_billing_plans_updated_at
    BEFORE UPDATE ON public.billing_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

INSERT INTO public.billing_plans (
    code,
    name,
    tagline,
    price_monthly_usd,
    max_warehouses,
    max_internal_users,
    max_monthly_trips,
    includes_inventory,
    includes_locations,
    includes_receipts,
    includes_dispatches,
    includes_analytics,
    includes_api_webhooks,
    includes_multi_client_3pl,
    support_tier,
    feature_matrix
)
VALUES
(
    'free',
    'Free',
    'Para validar el flujo operativo base',
    0,
    1,
    2,
    50,
    FALSE,
    FALSE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    'email',
    jsonb_build_object(
        'publicar_cargas', TRUE,
        'pago_custodia', TRUE,
        'pin_pickup_delivery', TRUE,
        'picking_evidencia', TRUE,
        'wallet_admin', 'basic',
        'inventario_por_sku', FALSE,
        'ubicaciones_bodega', FALSE,
        'api_webhooks', FALSE
    )
),
(
    'growth',
    'Growth',
    'Operación multi-bodega con inventario y analítica',
    20,
    3,
    10,
    500,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    'priority',
    jsonb_build_object(
        'publicar_cargas', TRUE,
        'pago_custodia', TRUE,
        'pin_pickup_delivery', TRUE,
        'picking_evidencia', TRUE,
        'wallet_admin', 'complete',
        'inventario_por_sku', TRUE,
        'ubicaciones_bodega', TRUE,
        'api_webhooks', 'limited'
    )
),
(
    'scale',
    'Scale',
    '3PL multi-cliente, API y backoffice extendido',
    100,
    15,
    50,
    5000,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    'premium',
    jsonb_build_object(
        'publicar_cargas', TRUE,
        'pago_custodia', TRUE,
        'pin_pickup_delivery', TRUE,
        'picking_evidencia', TRUE,
        'wallet_admin', 'complete',
        'inventario_por_sku', TRUE,
        'ubicaciones_bodega', TRUE,
        'api_webhooks', TRUE,
        'multi_cliente_3pl', TRUE
    )
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    price_monthly_usd = EXCLUDED.price_monthly_usd,
    max_warehouses = EXCLUDED.max_warehouses,
    max_internal_users = EXCLUDED.max_internal_users,
    max_monthly_trips = EXCLUDED.max_monthly_trips,
    includes_inventory = EXCLUDED.includes_inventory,
    includes_locations = EXCLUDED.includes_locations,
    includes_receipts = EXCLUDED.includes_receipts,
    includes_dispatches = EXCLUDED.includes_dispatches,
    includes_analytics = EXCLUDED.includes_analytics,
    includes_api_webhooks = EXCLUDED.includes_api_webhooks,
    includes_multi_client_3pl = EXCLUDED.includes_multi_client_3pl,
    support_tier = EXCLUDED.support_tier,
    feature_matrix = EXCLUDED.feature_matrix,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.business_plan_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL REFERENCES public.billing_plans(code) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'trialing', 'paused', 'cancelled')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id)
);

DROP TRIGGER IF EXISTS trg_business_plan_subscriptions_updated_at ON public.business_plan_subscriptions;
CREATE TRIGGER trg_business_plan_subscriptions_updated_at
    BEFORE UPDATE ON public.business_plan_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE OR REPLACE FUNCTION public.create_default_business_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.business_plan_subscriptions (business_id, plan_code, status)
    VALUES (NEW.user_id, 'free', 'active')
    ON CONFLICT (business_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_default_business_subscription ON public.business_profiles;
CREATE TRIGGER trg_create_default_business_subscription
    AFTER INSERT ON public.business_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_business_subscription();

CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    department TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Bogota',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'maintenance')),
    flow_mode TEXT NOT NULL DEFAULT 'warehouse_managed'
        CHECK (flow_mode IN ('manual', 'warehouse_managed', '3pl')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, code)
);

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER trg_warehouses_updated_at
    BEFORE UPDATE ON public.warehouses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'operator'
        CHECK (role IN ('manager', 'operator', 'auditor', 'viewer')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (warehouse_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.warehouse_docks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    dock_type TEXT NOT NULL DEFAULT 'loading'
        CHECK (dock_type IN ('loading', 'unloading', 'mixed')),
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'occupied', 'maintenance')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (warehouse_id, code)
);

DROP TRIGGER IF EXISTS trg_warehouse_docks_updated_at ON public.warehouse_docks;
CREATE TRIGGER trg_warehouse_docks_updated_at
    BEFORE UPDATE ON public.warehouse_docks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'ops',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouse_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, code)
);

DROP TRIGGER IF EXISTS trg_warehouse_clients_updated_at ON public.warehouse_clients;
CREATE TRIGGER trg_warehouse_clients_updated_at
    BEFORE UPDATE ON public.warehouse_clients
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    zone TEXT,
    aisle TEXT,
    rack TEXT,
    level TEXT,
    bin TEXT,
    location_type TEXT NOT NULL DEFAULT 'storage'
        CHECK (location_type IN ('receiving', 'storage', 'picking', 'dispatch', 'quarantine')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'blocked', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (warehouse_id, code)
);

DROP TRIGGER IF EXISTS trg_warehouse_locations_updated_at ON public.warehouse_locations;
CREATE TRIGGER trg_warehouse_locations_updated_at
    BEFORE UPDATE ON public.warehouse_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'unidad',
    requires_lot BOOLEAN NOT NULL DEFAULT FALSE,
    requires_expiry BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, sku_code)
);

DROP TRIGGER IF EXISTS trg_warehouse_skus_updated_at ON public.warehouse_skus;
CREATE TRIGGER trg_warehouse_skus_updated_at
    BEFORE UPDATE ON public.warehouse_skus
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES public.warehouse_skus(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    lot_code TEXT,
    expires_at DATE,
    quantity_on_hand NUMERIC(14, 2) NOT NULL DEFAULT 0,
    quantity_reserved NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_warehouse_stock_balances_updated_at ON public.warehouse_stock_balances;
CREATE TRIGGER trg_warehouse_stock_balances_updated_at
    BEFORE UPDATE ON public.warehouse_stock_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    dock_id UUID REFERENCES public.warehouse_docks(id) ON DELETE SET NULL,
    appointment_type TEXT NOT NULL
        CHECK (appointment_type IN ('pickup', 'delivery', 'receipt', 'dispatch')),
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled')),
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,
    vehicle_plate TEXT,
    trucker_name TEXT,
    trucker_phone TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'reserved', 'completed', 'n_a')),
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_warehouse_appointments_updated_at ON public.warehouse_appointments;
CREATE TRIGGER trg_warehouse_appointments_updated_at
    BEFORE UPDATE ON public.warehouse_appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.warehouse_clients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.warehouse_appointments(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('draft', 'received', 'closed', 'cancelled')),
    notes TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (warehouse_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.warehouse_receipt_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.warehouse_receipts(id) ON DELETE CASCADE,
    sku_id UUID REFERENCES public.warehouse_skus(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    sku_code_snapshot TEXT NOT NULL,
    sku_name_snapshot TEXT NOT NULL,
    expected_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
    received_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
    damaged_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouse_dispatch_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.warehouse_clients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.warehouse_appointments(id) ON DELETE SET NULL,
    dispatch_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'picking', 'ready', 'dispatched', 'cancelled')),
    notes TEXT,
    scheduled_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (warehouse_id, dispatch_number)
);

DROP TRIGGER IF EXISTS trg_warehouse_dispatch_orders_updated_at ON public.warehouse_dispatch_orders;
CREATE TRIGGER trg_warehouse_dispatch_orders_updated_at
    BEFORE UPDATE ON public.warehouse_dispatch_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_dispatch_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_order_id UUID NOT NULL REFERENCES public.warehouse_dispatch_orders(id) ON DELETE CASCADE,
    sku_id UUID REFERENCES public.warehouse_skus(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    sku_code_snapshot TEXT NOT NULL,
    sku_name_snapshot TEXT NOT NULL,
    requested_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
    picked_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
    dispatched_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
    rejected_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouse_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES public.warehouse_skus(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    receipt_id UUID REFERENCES public.warehouse_receipts(id) ON DELETE SET NULL,
    dispatch_order_id UUID REFERENCES public.warehouse_dispatch_orders(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL
        CHECK (movement_type IN ('receipt', 'dispatch', 'adjustment', 'return', 'reservation', 'release')),
    quantity_delta NUMERIC(14, 2) NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouse_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.warehouse_appointments(id) ON DELETE SET NULL,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    task_type TEXT NOT NULL
        CHECK (task_type IN ('check_in', 'loading', 'picking', 'dispatch', 'receiving', 'inspection', 'incident_followup')),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_warehouse_tasks_updated_at ON public.warehouse_tasks;
CREATE TRIGGER trg_warehouse_tasks_updated_at
    BEFORE UPDATE ON public.warehouse_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.warehouse_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.cargo_offers(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.warehouse_appointments(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.warehouse_tasks(id) ON DELETE SET NULL,
    incident_type TEXT NOT NULL
        CHECK (incident_type IN ('damage', 'shortage', 'delay', 'security', 'documentation', 'payment_hold', 'other')),
    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    reported_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_warehouse_incidents_updated_at ON public.warehouse_incidents;
CREATE TRIGGER trg_warehouse_incidents_updated_at
    BEFORE UPDATE ON public.warehouse_incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE OR REPLACE FUNCTION public.user_has_warehouse_access(p_warehouse_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.warehouses w
        WHERE w.id = p_warehouse_id
          AND public.user_manages_business(w.business_id)
    )
    OR EXISTS (
        SELECT 1
        FROM public.warehouse_members wm
        WHERE wm.warehouse_id = p_warehouse_id
          AND wm.user_id = auth.uid()
          AND wm.active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE public.cargo_offers
    ADD COLUMN IF NOT EXISTS origin_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS origin_dock_id UUID REFERENCES public.warehouse_docks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS destination_dock_id UUID REFERENCES public.warehouse_docks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS origin_appointment_id UUID REFERENCES public.warehouse_appointments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS destination_appointment_id UUID REFERENCES public.warehouse_appointments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS warehouse_flow_mode TEXT DEFAULT 'manual'
        CHECK (warehouse_flow_mode IN ('manual', 'warehouse_managed', '3pl'));

ALTER TABLE public.picking_events
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.warehouse_appointments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dock_id UUID REFERENCES public.warehouse_docks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actor_role TEXT DEFAULT 'trucker'
        CHECK (actor_role IN ('trucker', 'warehouse_operator', 'warehouse_manager', 'receiver', 'admin'));

CREATE INDEX IF NOT EXISTS idx_business_plan_subscriptions_business ON public.business_plan_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_business ON public.warehouses(business_id, status);
CREATE INDEX IF NOT EXISTS idx_warehouse_members_user ON public.warehouse_members(user_id, active);
CREATE INDEX IF NOT EXISTS idx_warehouse_appointments_warehouse ON public.warehouse_appointments(warehouse_id, scheduled_start DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_appointments_offer ON public.warehouse_appointments(offer_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_balances_warehouse ON public.warehouse_stock_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_movements_warehouse ON public.warehouse_stock_movements(warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_warehouse ON public.warehouse_receipts(warehouse_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_dispatch_orders_warehouse ON public.warehouse_dispatch_orders(warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_tasks_warehouse ON public.warehouse_tasks(warehouse_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_warehouse_incidents_warehouse ON public.warehouse_incidents(warehouse_id, status, created_at DESC);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_plan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_docks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_dispatch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_dispatch_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read billing plans" ON public.billing_plans;
CREATE POLICY "Authenticated users can read billing plans"
    ON public.billing_plans FOR SELECT TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Businesses can manage own subscriptions" ON public.business_plan_subscriptions;
CREATE POLICY "Businesses can manage own subscriptions"
    ON public.business_plan_subscriptions FOR ALL TO authenticated
    USING (public.user_manages_business(business_id))
    WITH CHECK (public.user_manages_business(business_id));

DROP POLICY IF EXISTS "Businesses can manage own warehouses" ON public.warehouses;
CREATE POLICY "Businesses can manage own warehouses"
    ON public.warehouses FOR ALL TO authenticated
    USING (public.user_manages_business(business_id))
    WITH CHECK (public.user_manages_business(business_id));

DROP POLICY IF EXISTS "Users can access warehouse members" ON public.warehouse_members;
CREATE POLICY "Users can access warehouse members"
    ON public.warehouse_members FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Users can access warehouse docks" ON public.warehouse_docks;
CREATE POLICY "Users can access warehouse docks"
    ON public.warehouse_docks FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Users can access warehouse contacts" ON public.warehouse_contacts;
CREATE POLICY "Users can access warehouse contacts"
    ON public.warehouse_contacts FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Businesses can access warehouse clients" ON public.warehouse_clients;
CREATE POLICY "Businesses can access warehouse clients"
    ON public.warehouse_clients FOR ALL TO authenticated
    USING (public.user_manages_business(business_id))
    WITH CHECK (public.user_manages_business(business_id));

DROP POLICY IF EXISTS "Users can access warehouse locations" ON public.warehouse_locations;
CREATE POLICY "Users can access warehouse locations"
    ON public.warehouse_locations FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Businesses can access warehouse skus" ON public.warehouse_skus;
CREATE POLICY "Businesses can access warehouse skus"
    ON public.warehouse_skus FOR ALL TO authenticated
    USING (public.user_manages_business(business_id))
    WITH CHECK (public.user_manages_business(business_id));

DROP POLICY IF EXISTS "Users can access stock balances" ON public.warehouse_stock_balances;
CREATE POLICY "Users can access stock balances"
    ON public.warehouse_stock_balances FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Users can access stock movements" ON public.warehouse_stock_movements;
CREATE POLICY "Users can access stock movements"
    ON public.warehouse_stock_movements FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Users can access appointments" ON public.warehouse_appointments;
CREATE POLICY "Users can access appointments"
    ON public.warehouse_appointments FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Users can access receipts" ON public.warehouse_receipts;
CREATE POLICY "Users can access receipts"
    ON public.warehouse_receipts FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Users can access receipt lines" ON public.warehouse_receipt_lines;
CREATE POLICY "Users can access receipt lines"
    ON public.warehouse_receipt_lines FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.warehouse_receipts wr
            WHERE wr.id = warehouse_receipt_lines.receipt_id
              AND public.user_has_warehouse_access(wr.warehouse_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.warehouse_receipts wr
            WHERE wr.id = warehouse_receipt_lines.receipt_id
              AND public.user_has_warehouse_access(wr.warehouse_id)
        )
    );

DROP POLICY IF EXISTS "Users can access dispatch orders" ON public.warehouse_dispatch_orders;
CREATE POLICY "Users can access dispatch orders"
    ON public.warehouse_dispatch_orders FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Users can access dispatch lines" ON public.warehouse_dispatch_lines;
CREATE POLICY "Users can access dispatch lines"
    ON public.warehouse_dispatch_lines FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.warehouse_dispatch_orders wdo
            WHERE wdo.id = warehouse_dispatch_lines.dispatch_order_id
              AND public.user_has_warehouse_access(wdo.warehouse_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.warehouse_dispatch_orders wdo
            WHERE wdo.id = warehouse_dispatch_lines.dispatch_order_id
              AND public.user_has_warehouse_access(wdo.warehouse_id)
        )
    );

DROP POLICY IF EXISTS "Users can access warehouse tasks" ON public.warehouse_tasks;
CREATE POLICY "Users can access warehouse tasks"
    ON public.warehouse_tasks FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

DROP POLICY IF EXISTS "Users can access warehouse incidents" ON public.warehouse_incidents;
CREATE POLICY "Users can access warehouse incidents"
    ON public.warehouse_incidents FOR ALL TO authenticated
    USING (public.user_has_warehouse_access(warehouse_id))
    WITH CHECK (public.user_has_warehouse_access(warehouse_id));

GRANT SELECT ON public.billing_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.business_plan_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_docks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_skus TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_stock_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_receipt_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_dispatch_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_dispatch_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warehouse_incidents TO authenticated;

COMMIT;
