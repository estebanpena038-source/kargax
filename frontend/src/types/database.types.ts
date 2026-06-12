// =============================================================================
// KargaX - Database Type Definitions
// Auto-generated from Supabase schema - Update as needed
// =============================================================================

export interface Database {
    public: {
        Tables: {
            // =========================================================================
            // User Profiles
            // =========================================================================
            user_profiles: {
                Row: {
                    id: string;
                    email: string;
                    full_name: string;
                    user_type: 'trucker' | 'business' | 'admin';
                    phone: string | null;
                    avatar_url: string | null;
                    document_type: string | null;
                    document_number: string | null;
                    verified: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
            };

            // =========================================================================
            // Trucker Profiles
            // =========================================================================
            trucker_profiles: {
                Row: {
                    id: string;
                    user_id: string;
                    license_number: string;
                    license_category: string;
                    license_expiry: string;
                    experience_years: number;
                    rating: number;
                    total_trips: number;
                    available: boolean;
                    current_location: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['trucker_profiles']['Row'], 'id' | 'created_at' | 'updated_at' | 'rating' | 'total_trips'>;
                Update: Partial<Database['public']['Tables']['trucker_profiles']['Insert']>;
            };

            // =========================================================================
            // Business Profiles
            // =========================================================================
            business_profiles: {
                Row: {
                    id: string;
                    user_id: string;
                    company_name: string;
                    nit: string;
                    industry: string;
                    address: string;
                    city: string;
                    department: string;
                    rating: number;
                    total_shipments: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['business_profiles']['Row'], 'id' | 'created_at' | 'updated_at' | 'rating' | 'total_shipments'>;
                Update: Partial<Database['public']['Tables']['business_profiles']['Insert']>;
            };

            // =========================================================================
            // Vehicles
            // =========================================================================
            vehicles: {
                Row: {
                    id: string;
                    trucker_id: string;
                    plate_number: string;
                    vehicle_type: string;
                    brand: string;
                    model: string;
                    year: number;
                    capacity_tons: number;
                    volume_m3: number;
                    soat_expiry: string;
                    technomechanical_expiry: string;
                    insurance_expiry: string;
                    status: 'active' | 'maintenance' | 'inactive';
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['vehicles']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['vehicles']['Insert']>;
            };

            // =========================================================================
            // Cargo Offers
            // =========================================================================
            cargo_offers: {
                Row: {
                    id: string;
                    business_id: string;
                    title: string;
                    description: string;
                    cargo_type: string;
                    weight_tons: number;
                    volume_m3: number | null;
                    origin_city: string;
                    origin_department: string;
                    origin_address: string;
                    origin_warehouse_id: string | null;
                    origin_dock_id: string | null;
                    origin_appointment_id: string | null;
                    destination_city: string;
                    destination_department: string;
                    destination_address: string;
                    destination_warehouse_id: string | null;
                    destination_dock_id: string | null;
                    destination_appointment_id: string | null;
                    pickup_date: string;
                    delivery_date: string;
                    price: number;
                    price_negotiable: boolean;
                    vehicle_type_required: string;
                    special_requirements: string | null;
                    warehouse_flow_mode: 'manual' | 'warehouse_managed' | '3pl' | null;
                    status: 'active' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['cargo_offers']['Row'], 'id' | 'created_at' | 'updated_at' | 'status'>;
                Update: Partial<Database['public']['Tables']['cargo_offers']['Insert']>;
            };

            offer_applications: {
                Row: {
                    id: string;
                    offer_id: string;
                    trucker_id: string;
                    status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
                    proposed_amount: number | null;
                    message: string | null;
                    estimated_pickup: string | null;
                    business_response: string | null;
                    responded_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['offer_applications']['Row'], 'id' | 'created_at' | 'updated_at' | 'responded_at' | 'business_response'>;
                Update: Partial<Database['public']['Tables']['offer_applications']['Insert']>;
            };

            payments: {
                Row: {
                    id: string;
                    offer_id: string;
                    payer_id: string;
                    gateway: 'wompi' | 'mercadopago' | 'stripe' | 'manual';
                    external_id: string | null;
                    external_reference: string | null;
                    subtotal: number;
                    platform_fee: number;
                    gateway_fee: number | null;
                    total_amount: number;
                    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'expired';
                    gateway_response: Record<string, unknown> | null;
                    error_message: string | null;
                    created_at: string;
                    updated_at: string;
                    completed_at: string | null;
                    expires_at: string | null;
                };
                Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at' | 'updated_at' | 'completed_at'>;
                Update: Partial<Database['public']['Tables']['payments']['Insert']>;
            };

            wallets: {
                Row: {
                    id: string;
                    user_id: string;
                    pending_balance: number;
                    available_balance: number;
                    total_earned: number;
                    total_withdrawn: number;
                    total_trips_completed: number;
                    bank_name: string | null;
                    bank_account_type: string | null;
                    bank_account_number: string | null;
                    bank_account_holder: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['wallets']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['wallets']['Insert']>;
            };

            transactions: {
                Row: {
                    id: string;
                    wallet_id: string;
                    offer_id: string | null;
                    type:
                        | 'trip_deposit'
                        | 'trip_pending'
                        | 'platform_fee'
                        | 'withdrawal'
                        | 'withdrawal_reversal'
                        | 'withdrawal_fee'
                        | 'refund'
                        | 'adjustment'
                        | 'bonus'
                        | 'advance_disbursement'
                        | 'advance_repayment'
                        | 'advance_interest'
                        | 'advance_reversal'
                        | 'advance_writeoff';
                    status: 'pending' | 'completed' | 'failed' | 'cancelled';
                    amount: number;
                    balance_before: number;
                    balance_after: number;
                    pending_balance_before: number;
                    pending_balance_after: number;
                    description: string;
                    reference_id: string | null;
                    metadata: Record<string, unknown> | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
            };

            payment_methods: {
                Row: {
                    id: string;
                    user_id: string;
                    method_type: 'nequi' | 'savings' | 'checking';
                    bank_name: string | null;
                    account_number: string;
                    account_holder_name: string;
                    document_type: string | null;
                    document_number: string | null;
                    is_default: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['payment_methods']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['payment_methods']['Insert']>;
            };

            admin_notifications: {
                Row: {
                    id: string;
                    type: string;
                    title: string;
                    message: string | null;
                    data: Record<string, unknown> | null;
                    read: boolean;
                    processed: boolean;
                    processed_by: string | null;
                    processed_at: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['admin_notifications']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['admin_notifications']['Insert']>;
            };

            lending_settings: {
                Row: {
                    id: string;
                    monthly_interest_rate_percent: number;
                    max_term_days: number;
                    portfolio_deployment_limit_percent: number;
                    first_advance_cap_cop: number;
                    repeat_advance_cap_cop: number;
                    initial_ltv_percent: number;
                    repeat_ltv_percent: number;
                    minimum_completed_trips_for_repeat: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['lending_settings']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['lending_settings']['Insert']>;
            };

            lending_treasury: {
                Row: {
                    id: string;
                    available_capital: number;
                    reserved_capital: number;
                    deployed_capital: number;
                    total_repaid_principal: number;
                    total_repaid_interest: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['lending_treasury']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['lending_treasury']['Insert']>;
            };

            fuel_advances: {
                Row: {
                    id: string;
                    trucker_id: string;
                    wallet_id: string;
                    origin_offer_id: string;
                    status: 'requested' | 'disbursed' | 'rejected' | 'cancelled' | 'completed' | 'overdue' | 'at_risk' | 'restructured' | 'written_off';
                    principal_amount: number;
                    monthly_interest_rate_percent: number;
                    term_days: number;
                    approved_at: string | null;
                    disbursed_at: string | null;
                    due_at: string;
                    principal_outstanding: number;
                    interest_outstanding: number;
                    total_due_at_maturity: number;
                    requested_by: string;
                    approved_by: string | null;
                    rejected_reason: string | null;
                    metadata: Record<string, unknown> | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['fuel_advances']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['fuel_advances']['Insert']>;
            };

            fuel_advance_repayments: {
                Row: {
                    id: string;
                    advance_id: string;
                    wallet_id: string;
                    offer_id: string | null;
                    source: 'trip_settlement' | 'wallet_sweep' | 'admin_adjustment';
                    principal_paid: number;
                    interest_paid: number;
                    balance_after_principal: number;
                    balance_after_interest: number;
                    metadata: Record<string, unknown> | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['fuel_advance_repayments']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['fuel_advance_repayments']['Insert']>;
            };

            billing_plans: {
                Row: {
                    code: string;
                    name: string;
                    tagline: string | null;
                    price_monthly_usd: number;
                    price_monthly_cop: number;
                    billing_currency_code: 'COP' | 'USD' | 'PEN' | 'BRL';
                    max_warehouses: number | null;
                    max_internal_users: number | null;
                    max_monthly_trips: number | null;
                    includes_inventory: boolean;
                    includes_locations: boolean;
                    includes_receipts: boolean;
                    includes_dispatches: boolean;
                    includes_analytics: boolean;
                    includes_api_webhooks: boolean;
                    includes_multi_client_3pl: boolean;
                    is_public: boolean;
                    support_tier: 'email' | 'priority' | 'premium';
                    feature_matrix: Record<string, unknown>;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['billing_plans']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['billing_plans']['Insert']>;
            };

            business_plan_subscriptions: {
                Row: {
                    id: string;
                    business_id: string;
                    plan_code: string;
                    status: 'active' | 'trialing' | 'paused' | 'cancelled';
                    current_period_start: string;
                    current_period_end: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['business_plan_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['business_plan_subscriptions']['Insert']>;
            };

            business_team_members: {
                Row: {
                    id: string;
                    business_id: string;
                    user_id: string | null;
                    invited_email: string;
                    role: 'owner' | 'manager' | 'ops_manager' | 'dispatcher' | 'warehouse_manager' | 'warehouse_operator' | 'finance_accountant' | 'operator' | 'auditor' | 'viewer';
                    status: 'invited' | 'active' | 'suspended';
                    invited_by: string | null;
                    accepted_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['business_team_members']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['business_team_members']['Insert']>;
            };

            user_app_preferences: {
                Row: {
                    user_id: string;
                    active_warehouse_id: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_app_preferences']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['user_app_preferences']['Insert']>;
            };

            billing_plan_payment_attempts: {
                Row: {
                    id: string;
                    business_id: string;
                    plan_code: string;
                    status: 'pending' | 'approved' | 'processing' | 'failed' | 'cancelled' | 'refunded';
                    mp_payment_id: string | null;
                    mp_preference_id: string | null;
                    mp_external_reference: string | null;
                    amount: number;
                    country_code: 'CO' | 'PE' | 'BR' | null;
                    currency_code: 'COP' | 'PEN' | 'BRL' | null;
                    amount_local: number | null;
                    amount_usd_anchor: number | null;
                    fx_rate_usd_to_local: number | null;
                    pricing_source: 'legacy_cop' | 'usd_anchor_env_rate' | 'legacy_plan_price';
                    gateway_response: Record<string, unknown> | null;
                    paid_at: string | null;
                    expires_at: string | null;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['billing_plan_payment_attempts']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['billing_plan_payment_attempts']['Insert']>;
            };

            user_mfa_recovery_codes: {
                Row: {
                    id: string;
                    user_id: string;
                    code_hash: string;
                    used_at: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_mfa_recovery_codes']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['user_mfa_recovery_codes']['Insert']>;
            };

            warehouses: {
                Row: {
                    id: string;
                    business_id: string;
                    code: string;
                    name: string;
                    description: string | null;
                    department: string;
                    city: string;
                    address: string;
                    timezone: string;
                    status: 'active' | 'inactive' | 'maintenance';
                    flow_mode: 'manual' | 'warehouse_managed' | '3pl';
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouses']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouses']['Insert']>;
            };

            warehouse_members: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    user_id: string;
                    role: 'manager' | 'ops_manager' | 'dispatcher' | 'warehouse_manager' | 'warehouse_operator' | 'finance_accountant' | 'operator' | 'auditor' | 'viewer';
                    active: boolean;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_members']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_members']['Insert']>;
            };

            warehouse_docks: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    code: string;
                    name: string;
                    dock_type: 'loading' | 'unloading' | 'mixed';
                    status: 'available' | 'occupied' | 'maintenance';
                    is_default: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_docks']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_docks']['Insert']>;
            };

            warehouse_locations: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    code: string;
                    zone: string | null;
                    aisle: string | null;
                    rack: string | null;
                    level: string | null;
                    bin: string | null;
                    location_type: 'receiving' | 'storage' | 'picking' | 'dispatch' | 'quarantine';
                    status: 'active' | 'blocked' | 'inactive';
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_locations']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_locations']['Insert']>;
            };

            warehouse_skus: {
                Row: {
                    id: string;
                    business_id: string;
                    sku_code: string;
                    name: string;
                    description: string | null;
                    unit: string;
                    requires_lot: boolean;
                    requires_expiry: boolean;
                    active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_skus']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_skus']['Insert']>;
            };

            warehouse_sku_images: {
                Row: {
                    id: string;
                    sku_id: string;
                    storage_path: string;
                    public_url: string;
                    is_cover: boolean;
                    sort_order: number;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_sku_images']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_sku_images']['Insert']>;
            };

            warehouse_appointments: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    offer_id: string | null;
                    dock_id: string | null;
                    appointment_type: 'pickup' | 'delivery' | 'receipt' | 'dispatch';
                    status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';
                    scheduled_start: string;
                    scheduled_end: string;
                    actual_start_at: string | null;
                    actual_end_at: string | null;
                    vehicle_plate: string | null;
                    trucker_name: string | null;
                    trucker_phone: string | null;
                    contact_name: string | null;
                    contact_phone: string | null;
                    payment_status: 'pending' | 'reserved' | 'completed' | 'n_a';
                    notes: string | null;
                    created_by: string | null;
                    checked_in_at: string | null;
                    checked_out_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_appointments']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_appointments']['Insert']>;
            };

            warehouse_stock_balances: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    sku_id: string;
                    location_id: string | null;
                    lot_code: string | null;
                    expires_at: string | null;
                    quantity_on_hand: number;
                    quantity_reserved: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_stock_balances']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_stock_balances']['Insert']>;
            };

            warehouse_receipts: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    offer_id: string | null;
                    client_id: string | null;
                    appointment_id: string | null;
                    receipt_number: string;
                    status: 'draft' | 'received' | 'closed' | 'cancelled';
                    notes: string | null;
                    received_at: string;
                    received_by: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_receipts']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_receipts']['Insert']>;
            };

            warehouse_receipt_lines: {
                Row: {
                    id: string;
                    receipt_id: string;
                    sku_id: string | null;
                    location_id: string | null;
                    sku_code_snapshot: string;
                    sku_name_snapshot: string;
                    expected_qty: number;
                    received_qty: number;
                    damaged_qty: number;
                    metadata: Record<string, unknown>;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_receipt_lines']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_receipt_lines']['Insert']>;
            };

            warehouse_dispatch_orders: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    offer_id: string | null;
                    client_id: string | null;
                    appointment_id: string | null;
                    dispatch_number: string;
                    status: 'draft' | 'picking' | 'ready' | 'dispatched' | 'cancelled';
                    notes: string | null;
                    scheduled_at: string | null;
                    dispatched_at: string | null;
                    confirmed_at: string | null;
                    confirmed_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_dispatch_orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_dispatch_orders']['Insert']>;
            };

            warehouse_dispatch_lines: {
                Row: {
                    id: string;
                    dispatch_order_id: string;
                    sku_id: string | null;
                    location_id: string | null;
                    sku_code_snapshot: string;
                    sku_name_snapshot: string;
                    requested_qty: number;
                    picked_qty: number;
                    dispatched_qty: number;
                    rejected_qty: number;
                    metadata: Record<string, unknown>;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_dispatch_lines']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_dispatch_lines']['Insert']>;
            };

            warehouse_tasks: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    appointment_id: string | null;
                    offer_id: string | null;
                    task_type: 'check_in' | 'loading' | 'picking' | 'dispatch' | 'receiving' | 'inspection' | 'incident_followup';
                    status: 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
                    title: string;
                    description: string | null;
                    assigned_to: string | null;
                    due_at: string | null;
                    completed_at: string | null;
                    created_by: string | null;
                    metadata: Record<string, unknown>;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_tasks']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_tasks']['Insert']>;
            };

            warehouse_incidents: {
                Row: {
                    id: string;
                    warehouse_id: string;
                    offer_id: string | null;
                    appointment_id: string | null;
                    task_id: string | null;
                    incident_type: 'damage' | 'shortage' | 'delay' | 'security' | 'documentation' | 'payment_hold' | 'other';
                    severity: 'low' | 'medium' | 'high' | 'critical';
                    status: 'open' | 'investigating' | 'resolved' | 'closed';
                    title: string;
                    description: string;
                    evidence_urls: string[];
                    metadata: Record<string, unknown>;
                    reported_by: string | null;
                    resolved_by: string | null;
                    resolved_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['warehouse_incidents']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['warehouse_incidents']['Insert']>;
            };

            picking_events: {
                Row: {
                    id: string;
                    offer_id: string;
                    trucker_id: string;
                    event_type: string;
                    manifest_item_id: string | null;
                    manifest_item_name: string | null;
                    quantity: number | null;
                    item_status: string | null;
                    notes: string | null;
                    rejection_reason: string | null;
                    photo_urls: string[] | null;
                    latitude: number | null;
                    longitude: number | null;
                    accuracy_meters: number | null;
                    warehouse_id: string | null;
                    appointment_id: string | null;
                    dock_id: string | null;
                    actor_role: 'trucker' | 'warehouse_operator' | 'warehouse_manager' | 'receiver' | 'admin' | null;
                    metadata: Record<string, unknown> | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['picking_events']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['picking_events']['Insert']>;
            };

            // =========================================================================
            // Bids
            // =========================================================================
            bids: {
                Row: {
                    id: string;
                    cargo_offer_id: string;
                    trucker_id: string;
                    vehicle_id: string;
                    proposed_price: number;
                    message: string | null;
                    estimated_delivery: string;
                    status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['bids']['Row'], 'id' | 'created_at' | 'updated_at' | 'status'>;
                Update: Partial<Database['public']['Tables']['bids']['Insert']>;
            };

            // =========================================================================
            // Shipments (Active deliveries)
            // =========================================================================
            shipments: {
                Row: {
                    id: string;
                    cargo_offer_id: string;
                    bid_id: string;
                    trucker_id: string;
                    vehicle_id: string;
                    business_id: string;
                    status: 'pending_pickup' | 'picked_up' | 'in_transit' | 'delivered' | 'issue';
                    current_location_lat: number | null;
                    current_location_lng: number | null;
                    eta: string | null;
                    picked_up_at: string | null;
                    delivered_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['shipments']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['shipments']['Insert']>;
            };

            // =========================================================================
            // Messages
            // =========================================================================
            messages: {
                Row: {
                    id: string;
                    conversation_id: string;
                    sender_id: string;
                    content: string;
                    message_type: 'text' | 'image' | 'document' | 'location';
                    read: boolean;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at' | 'read'>;
                Update: Partial<Database['public']['Tables']['messages']['Insert']>;
            };

            // =========================================================================
            // Conversations
            // =========================================================================
            conversations: {
                Row: {
                    id: string;
                    participant_ids: string[];
                    cargo_offer_id: string | null;
                    last_message_at: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
            };

            // =========================================================================
            // Reviews
            // =========================================================================
            reviews: {
                Row: {
                    id: string;
                    shipment_id: string;
                    reviewer_id: string;
                    reviewed_id: string;
                    rating: number;
                    comment: string | null;
                    review_type: 'trucker_to_business' | 'business_to_trucker';
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            user_type: 'trucker' | 'business' | 'admin';
            cargo_status: 'active' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
            bid_status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
            shipment_status: 'pending_pickup' | 'picked_up' | 'in_transit' | 'delivered' | 'issue';
            vehicle_status: 'active' | 'maintenance' | 'inactive';
        };
    };
}

// =============================================================================
// Convenience Type Aliases
// =============================================================================
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type TruckerProfile = Database['public']['Tables']['trucker_profiles']['Row'];
export type BusinessProfile = Database['public']['Tables']['business_profiles']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type CargoOffer = Database['public']['Tables']['cargo_offers']['Row'];
export type OfferApplication = Database['public']['Tables']['offer_applications']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Wallet = Database['public']['Tables']['wallets']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type PaymentMethod = Database['public']['Tables']['payment_methods']['Row'];
export type AdminNotification = Database['public']['Tables']['admin_notifications']['Row'];
export type LendingSettingsRecord = Database['public']['Tables']['lending_settings']['Row'];
export type LendingTreasuryRecord = Database['public']['Tables']['lending_treasury']['Row'];
export type FuelAdvanceRecord = Database['public']['Tables']['fuel_advances']['Row'];
export type FuelAdvanceRepaymentRecord = Database['public']['Tables']['fuel_advance_repayments']['Row'];
export type BillingPlan = Database['public']['Tables']['billing_plans']['Row'];
export type BusinessPlanSubscription = Database['public']['Tables']['business_plan_subscriptions']['Row'];
export type BusinessTeamMemberRecord = Database['public']['Tables']['business_team_members']['Row'];
export type UserAppPreferenceRecord = Database['public']['Tables']['user_app_preferences']['Row'];
export type BillingPlanPaymentAttemptRecord = Database['public']['Tables']['billing_plan_payment_attempts']['Row'];
export type UserMfaRecoveryCodeRecord = Database['public']['Tables']['user_mfa_recovery_codes']['Row'];
export type WarehouseRecord = Database['public']['Tables']['warehouses']['Row'];
export type WarehouseMemberRecord = Database['public']['Tables']['warehouse_members']['Row'];
export type WarehouseDockRecord = Database['public']['Tables']['warehouse_docks']['Row'];
export type WarehouseLocationRecord = Database['public']['Tables']['warehouse_locations']['Row'];
export type WarehouseSkuRecord = Database['public']['Tables']['warehouse_skus']['Row'];
export type WarehouseSkuImageRecord = Database['public']['Tables']['warehouse_sku_images']['Row'];
export type WarehouseAppointmentRecord = Database['public']['Tables']['warehouse_appointments']['Row'];
export type WarehouseStockBalanceRecord = Database['public']['Tables']['warehouse_stock_balances']['Row'];
export type WarehouseReceiptRecord = Database['public']['Tables']['warehouse_receipts']['Row'];
export type WarehouseReceiptLineRecord = Database['public']['Tables']['warehouse_receipt_lines']['Row'];
export type WarehouseDispatchOrderRecord = Database['public']['Tables']['warehouse_dispatch_orders']['Row'];
export type WarehouseDispatchLineRecord = Database['public']['Tables']['warehouse_dispatch_lines']['Row'];
export type WarehouseTaskRecord = Database['public']['Tables']['warehouse_tasks']['Row'];
export type WarehouseIncidentRecord = Database['public']['Tables']['warehouse_incidents']['Row'];
export type PickingEvent = Database['public']['Tables']['picking_events']['Row'];
export type Bid = Database['public']['Tables']['bids']['Row'];
export type Shipment = Database['public']['Tables']['shipments']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];

// =============================================================================
// Insert Types
// =============================================================================
export type NewUserProfile = Database['public']['Tables']['user_profiles']['Insert'];
export type NewCargoOffer = Database['public']['Tables']['cargo_offers']['Insert'];
export type NewOfferApplication = Database['public']['Tables']['offer_applications']['Insert'];
export type NewPayment = Database['public']['Tables']['payments']['Insert'];
export type NewWallet = Database['public']['Tables']['wallets']['Insert'];
export type NewTransaction = Database['public']['Tables']['transactions']['Insert'];
export type NewPaymentMethod = Database['public']['Tables']['payment_methods']['Insert'];
export type NewFuelAdvance = Database['public']['Tables']['fuel_advances']['Insert'];
export type NewFuelAdvanceRepayment = Database['public']['Tables']['fuel_advance_repayments']['Insert'];
export type NewBid = Database['public']['Tables']['bids']['Insert'];
export type NewVehicle = Database['public']['Tables']['vehicles']['Insert'];

// =============================================================================
// Update Types
// =============================================================================
export type UpdateUserProfile = Database['public']['Tables']['user_profiles']['Update'];
export type UpdateCargoOffer = Database['public']['Tables']['cargo_offers']['Update'];
export type UpdateOfferApplication = Database['public']['Tables']['offer_applications']['Update'];
export type UpdatePayment = Database['public']['Tables']['payments']['Update'];
export type UpdateWallet = Database['public']['Tables']['wallets']['Update'];
export type UpdateTransaction = Database['public']['Tables']['transactions']['Update'];
export type UpdatePaymentMethod = Database['public']['Tables']['payment_methods']['Update'];
export type UpdateFuelAdvance = Database['public']['Tables']['fuel_advances']['Update'];
export type UpdateShipment = Database['public']['Tables']['shipments']['Update'];
