import type { BusinessRole, BusinessTeamRole } from '@/lib/business-roles';

export type WarehouseFlowMode = 'manual' | 'warehouse_managed' | '3pl';
export type BillingPlanActionState = 'current' | 'switch_now' | 'checkout' | 'blocked_by_usage';
export type HoldingRole = 'holding_owner' | 'finance_admin' | 'ops_admin' | 'analyst' | 'admin';

export type WarehouseRole = BusinessRole;
export type HoldingAssignedTeam = 'holding_owner' | 'finance_admin' | 'ops_admin';
export type HoldingApprovalAgingBucket = 'within_sla' | 'due_soon' | 'breached' | 'double_breached' | 'resolved';

export interface WarehouseCapabilities {
    viewWarehouseSummary: boolean;
    viewOperationalDetail: boolean;
    viewEvidence: boolean;
    exportData: boolean;
    manageWarehouseSettings: boolean;
    manageDocks: boolean;
    manageTeam: boolean;
    manageBilling: boolean;
    manageInventoryAdjustments: boolean;
    manageAppointments: boolean;
    manageReceipts: boolean;
    manageDispatches: boolean;
    manageTasks: boolean;
    manageIncidents: boolean;
}

export interface HoldingCapabilities {
    viewCorporateOverview: boolean;
    viewCorporateLedger: boolean;
    exportCorporateData: boolean;
    manageMembers: boolean;
    manageBusinessLinks: boolean;
    manageFinancePolicy: boolean;
    manageTreasury: boolean;
    approveFinanceQueue: boolean;
    approveOpsQueue: boolean;
    overrideEscalations: boolean;
}

export interface BillingPlan {
    code: string;
    name: string;
    tagline: string | null;
    price_monthly_usd: number;
    price_monthly_cop: number;
    billing_currency_code: 'COP' | 'USD' | 'PEN' | 'BRL';
    max_warehouses: number | null;
    max_internal_users: number | null;
    max_monthly_trips: number | null;
    max_private_fleet_drivers: number | null;
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
    action_state?: BillingPlanActionState;
    action_label?: string | null;
    action_disabled_reason?: string | null;
}

export interface BusinessPlanSubscription {
    id: string;
    business_id: string;
    plan_code: string;
    status: 'active' | 'trialing' | 'paused' | 'cancelled';
    current_period_start: string;
    current_period_end: string | null;
    created_at: string;
    updated_at: string;
    plan?: BillingPlan | null;
}

export interface CommercialActivationChecklistItem {
    key: string;
    label: string;
    completed: boolean;
    href: string;
}

export interface CommercialActivationSnapshot {
    status: 'setup' | 'first_value' | 'activated';
    completedDeliveriesWithEvidence: number;
    activationTarget: number;
    checklist: CommercialActivationChecklistItem[];
    nextActionLabel: string;
    nextActionHref: string;
}

export interface WarehouseSummary {
    appointments: number;
    docks: number;
    skuCount: number;
    stockUnits: number;
    openTasks: number;
    openIncidents: number;
    receipts: number;
    dispatches: number;
}

export interface Warehouse {
    id: string;
    business_id: string;
    code: string;
    name: string;
    description: string | null;
    department: string;
    city: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    gps_tolerance_meters: number | null;
    timezone: string;
    status: 'active' | 'inactive' | 'maintenance';
    flow_mode: WarehouseFlowMode;
    notes: string | null;
    created_at: string;
    updated_at: string;
    summary?: WarehouseSummary;
}

export interface WarehouseDock {
    id: string;
    warehouse_id: string;
    code: string;
    name: string;
    dock_type: 'loading' | 'unloading' | 'mixed';
    status: 'available' | 'occupied' | 'maintenance';
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface WarehouseLocation {
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
}

export interface WarehouseSku {
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
    images?: WarehouseSkuImage[];
}

export interface WarehouseSkuImage {
    id: string;
    sku_id: string;
    storage_path: string;
    public_url: string;
    is_cover: boolean;
    sort_order: number;
    created_by: string | null;
    created_at: string;
}

export interface WarehouseStockBalance {
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
    sku?: WarehouseSku | null;
    location?: WarehouseLocation | null;
}

export interface WarehouseAppointment {
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
    dock?: WarehouseDock | null;
}

export interface WarehouseReceiptLine {
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
    sku?: WarehouseSku | null;
    location?: WarehouseLocation | null;
}

export interface WarehouseReceipt {
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
    lines?: WarehouseReceiptLine[];
}

export interface WarehouseDispatchLine {
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
    sku?: WarehouseSku | null;
    location?: WarehouseLocation | null;
}

export interface WarehouseDispatchOrder {
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
    lines?: WarehouseDispatchLine[];
}

export type WarehouseDigitalEvidenceStatus =
    | 'dispatch_only'
    | 'assigned'
    | 'accepted'
    | 'rejected'
    | 'in_transit'
    | 'completed'
    | 'cancelled'
    | 'blocked';

export type WarehouseDigitalEvidenceStage =
    | 'dispatch'
    | 'assignment'
    | 'origin'
    | 'loading'
    | 'pickup_pin'
    | 'tracking'
    | 'destination'
    | 'delivery'
    | 'delivery_pin'
    | 'signature'
    | 'financial'
    | 'incident';

export interface WarehouseDigitalEvidenceSignature {
    id: string;
    stage: 'origin_dispatch' | 'delivery_pod' | string;
    signerName: string | null;
    signerDocumentId: string | null;
    signerRole: string | null;
    publicUrl: string | null;
    createdAt: string | null;
}

export interface WarehouseDigitalEvidenceSignatureRequirement {
    stage: string;
    label: string;
    signerRole: 'warehouse_manager' | 'customer' | 'receiver' | 'other';
    required: boolean;
    completed: boolean;
    captureSurface: 'warehouse_panel' | 'driver_app' | 'legacy';
    signature: WarehouseDigitalEvidenceSignature | null;
}

export interface WarehouseDigitalEvidencePhoto {
    id: string;
    url: string;
    stage: WarehouseDigitalEvidenceStage;
    label: string;
    itemName: string | null;
    notes: string | null;
    rejectionReason: string | null;
    createdAt: string | null;
}

export interface WarehouseDigitalEvidenceTimelineEvent {
    id: string;
    stage: WarehouseDigitalEvidenceStage;
    label: string;
    status: 'complete' | 'pending' | 'rejected' | 'warning';
    timestamp: string | null;
    detail: string | null;
    source: 'dispatch' | 'offer' | 'picking' | 'signature' | 'tracking' | 'payment';
}

export interface WarehouseDigitalEvidenceManifestItem {
    id: string;
    reference: string | null;
    name: string;
    expectedQty: number;
    loadedQty: number;
    deliveredQty: number;
    rejectedQty: number;
    rejectionReason: string | null;
    status: string | null;
}

export interface WarehouseDigitalEvidenceTrackingPing {
    id: string;
    sessionId: string | null;
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
    capturedAt: string | null;
}

export interface WarehouseDigitalEvidenceTrackingSession {
    id: string;
    status: string;
    source: string | null;
    startedAt: string | null;
    stoppedAt: string | null;
    lastPingAt: string | null;
    lastLatitude: number | null;
    lastLongitude: number | null;
    lastAccuracyMeters: number | null;
}

export interface WarehouseDigitalEvidenceRecord {
    id: string;
    destinationType: 'final_customer' | 'warehouse';
    dispatch: {
        id: string;
        number: string;
        status: WarehouseDispatchOrder['status'];
        scheduledAt: string | null;
        dispatchedAt: string | null;
        confirmedAt: string | null;
        createdAt: string;
        notes: string | null;
        tripCreationStatus: string | null;
        tripCreationError: string | null;
        dispatchTripMode: string | null;
        lines: WarehouseDispatchLine[];
    };
    offer: {
        id: string;
        status: string | null;
        isPrivateFleet: boolean;
        sourceDispatchId: string | null;
        cargoDescription: string | null;
        createdAt: string | null;
        pickupVerified: boolean;
        deliveryVerified: boolean;
    } | null;
    driver: {
        id: string | null;
        name: string | null;
        email: string | null;
        phone: string | null;
        vehiclePlate: string | null;
        internalDriverId: string | null;
        assignmentStatus: 'pending' | 'accepted' | 'rejected' | null;
        acceptedAt: string | null;
        rejectedAt: string | null;
        rejectionReason: string | null;
    };
    route: {
        originAddress: string | null;
        originCity: string | null;
        originDepartment: string | null;
        destinationAddress: string | null;
        destinationCity: string | null;
        destinationDepartment: string | null;
    };
    originWarehouse: Pick<Warehouse, 'id' | 'code' | 'name' | 'city' | 'department' | 'address'> | null;
    destinationWarehouse: Pick<Warehouse, 'id' | 'code' | 'name' | 'city' | 'department' | 'address'> | null;
    transferReceipt: {
        id: string;
        number: string;
        status: WarehouseReceipt['status'];
        warehouseId: string;
        createdAt: string | null;
        receivedAt: string | null;
    } | null;
    status: WarehouseDigitalEvidenceStatus;
    timestamps: {
        createdAt: string | null;
        scheduledAt: string | null;
        dispatchedAt: string | null;
        acceptedAt: string | null;
        rejectedAt: string | null;
        arrivedOriginAt: string | null;
        loadingStartedAt: string | null;
        pickupVerifiedAt: string | null;
        arrivedDestinationAt: string | null;
        unloadingStartedAt: string | null;
        deliveryVerifiedAt: string | null;
        closedAt: string | null;
    };
    manifestSummary: {
        expected: number;
        loaded: number;
        delivered: number;
        rejected: number;
        lineCount: number;
        photoCount: number;
        signatureCount: number;
        hasMissingEvidence: boolean;
        items: WarehouseDigitalEvidenceManifestItem[];
    };
    signatures: WarehouseDigitalEvidenceSignature[];
    signatureRequirements: WarehouseDigitalEvidenceSignatureRequirement[];
    photos: WarehouseDigitalEvidencePhoto[];
    timeline: WarehouseDigitalEvidenceTimelineEvent[];
    tracking: {
        sessionCount: number;
        active: boolean;
        sessions: WarehouseDigitalEvidenceTrackingSession[];
        latestPing: WarehouseDigitalEvidenceTrackingPing | null;
        pings: WarehouseDigitalEvidenceTrackingPing[];
    };
    financial: {
        paymentStatus: string | null;
        freightAmount: number;
        expenseAmount: number;
        releasedAt: string | null;
        allocationStatus: string | null;
    };
    rejection: {
        rejected: boolean;
        rejectedAt: string | null;
        reason: string | null;
        rejectedBy: string | null;
    };
}

export interface WarehouseDigitalEvidenceResponse {
    data: WarehouseDigitalEvidenceRecord[];
}

export interface WarehouseTask {
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
}

export interface WarehouseIncident {
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
}

export interface WarehouseListResponse {
    data: Warehouse[];
    plans: BillingPlan[];
    subscription: BusinessPlanSubscription | null;
    limits: {
        activeWarehouses: number;
        maxWarehouses: number | null;
        activeInternalUsers: number;
        maxInternalUsers: number | null;
        monthlyTrips: number;
        maxMonthlyTrips: number | null;
        activePrivateFleetDrivers: number;
        maxPrivateFleetDrivers: number | null;
        entitlementState?: 'pilot_active' | 'pilot_expired' | 'free' | 'paid';
        pilotActive?: boolean;
        pilotExpiresAt?: string | null;
        pilotDaysRemaining?: number | null;
        recommendedPlan?: string | null;
    };
    activeWarehouseId?: string | null;
    isOwner?: boolean;
    role?: WarehouseRole | null;
    capabilities?: WarehouseCapabilities | null;
    teamSchemaReady?: boolean;
    teamSchemaMessage?: string | null;
    billingCheckoutReady?: boolean;
    billingCheckoutMessage?: string | null;
}

export interface WarehouseDetailResponse {
    warehouse: Warehouse;
    role: WarehouseRole | null;
    capabilities: WarehouseCapabilities | null;
    subscription: BusinessPlanSubscription | null;
    plans: BillingPlan[];
}

export interface WarehouseAccessResponse {
    businessId: string | null;
    businessName?: string | null;
    activeWarehouseId: string | null;
    warehouses: Warehouse[];
    role: WarehouseRole | null;
    capabilities: WarehouseCapabilities | null;
    subscription: BusinessPlanSubscription | null;
    limits: WarehouseListResponse['limits'] | null;
    isOwner: boolean;
    canManageBilling: boolean;
    canManageTeam: boolean;
    canViewFinance?: boolean;
    canExportFinance?: boolean;
    canViewOperations?: boolean;
    canCreateMarketplaceOffers?: boolean;
    canManagePrivateFleet?: boolean;
    canViewPrivateFleet?: boolean;
    canOperatePrivateFleet?: boolean;
    canManagePrivateFleetDrivers?: boolean;
    canManagePrivateFleetMoney?: boolean;
    canViewPrivateFleetMoney?: boolean;
    canUploadPrivateFleetProofs?: boolean;
    canClosePrivateFleetProofs?: boolean;
    canViewTracking?: boolean;
    canViewIntelligence?: boolean;
    rolePolicyCapabilities?: Record<string, unknown>;
    commercialActivation?: CommercialActivationSnapshot | null;
    teamSchemaReady?: boolean;
    teamSchemaMessage?: string | null;
    holdingReady?: boolean;
    holdingMessage?: string | null;
    holdingAccountId?: string | null;
    holdingRole?: HoldingRole | null;
}

export interface HoldingAccessResponse {
    ready: boolean;
    message: string | null;
    hasHoldingAccess: boolean;
    holdingAccountId: string | null;
    role: HoldingRole | null;
    capabilities: HoldingCapabilities | null;
    accounts: Array<{
        id: string;
        display_name: string;
        slug: string;
        role: HoldingRole;
    }>;
}

export interface HoldingBusinessSummary {
    business_id: string;
    company_name: string;
    city: string | null;
    department: string | null;
    relationship_type: 'parent' | 'subsidiary' | 'brand' | 'operator';
    plan_code: string;
    plan_name: string;
    feature_enabled: boolean;
    warehouses: number;
    active_internal_users: number;
    monthly_trips: number;
    open_incidents: number;
    critical_incidents: number;
    subscription_status: 'active' | 'trialing' | 'paused' | 'cancelled';
    current_period_end: string | null;
    risk_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    finance_readiness: 'strong' | 'watch' | 'blocked';
    appointments_today: number;
    active_appointments: number;
    delayed_appointments: number;
    otif_rate: number;
    dock_occupancy_rate: number;
    payment_ready_rate: number;
    payment_pending_appointments: number;
    custody_collected_cop: number;
    custody_pending_cop: number;
    platform_revenue_cop: number;
    wallet_available_cop: number;
    wallet_pending_cop: number;
    pending_withdrawals_cop: number;
    advance_outstanding_cop: number;
    advance_overdue_cop: number;
    active_advance_count: number;
    par7_amount_cop?: number;
    par30_amount_cop?: number;
    npl30_amount_cop?: number;
    par7_rate?: number;
    par30_rate?: number;
    npl30_rate?: number;
    marketplace_published_offers: number;
    marketplace_assigned_offers: number;
    marketplace_delivered_offers: number;
    marketplace_fill_rate: number;
    three_pl_offers: number;
    three_pl_clients: number;
    active_client_accounts: number;
    receipts_processed: number;
    dispatches_processed: number;
    dispatch_ready_rate: number;
}

export interface HoldingControlTowerSnapshot {
    appointmentsToday: number;
    activeAppointments: number;
    delayedAppointments: number;
    otifRate: number;
    dockOccupancyRate: number;
    paymentReadyRate: number;
    paymentPendingAppointments: number;
    atRiskBusinesses: number;
    blockedBusinesses: number;
}

export interface HoldingControlTowerAlert {
    id: string;
    type: 'incident' | 'delay' | 'payment' | 'marketplace' | '3pl';
    severity: 'low' | 'medium' | 'high' | 'critical';
    business_id: string;
    business_name: string;
    warehouse_id: string | null;
    warehouse_name: string | null;
    title: string;
    detail: string;
    created_at: string | null;
}

export interface HoldingFintechSnapshot {
    completedPayments: number;
    pendingPayments: number;
    failedPayments: number;
    reconciledPaymentsRate: number;
    custodyCollectedCop: number;
    custodyPendingCop: number;
    platformRevenueCop: number;
    walletAvailableCop: number;
    walletPendingCop: number;
    pendingWithdrawalsCop: number;
    advanceOutstandingCop: number;
    advanceOverdueCop: number;
    activeAdvanceCount: number;
    par7Amount: number;
    par30Amount: number;
    npl30Amount: number;
    par7Rate: number;
    par30Rate: number;
    npl30Rate: number;
    writeOffAmount: number;
    recoveredPrincipalCop: number;
}

export interface HoldingMarketplaceSnapshot {
    publishedOffers: number;
    assignedOffers: number;
    inTransitOffers: number;
    deliveredOffers: number;
    threePlOffers: number;
    fillRate: number;
    clientAccounts: number;
    activeClientAccounts: number;
    receiptsProcessed: number;
    dispatchesProcessed: number;
    dispatchReadyRate: number;
    multiClientBusinesses: number;
}

export interface HoldingPaymentsReadinessSnapshot {
    ready: boolean;
    checkoutReady: boolean;
    freightWebhookReady: boolean;
    billingWebhookReady: boolean;
    notificationsReady: boolean;
    productionLikeUrl: boolean;
    missingKeys: string[];
    warnings: string[];
}

export interface HoldingSummaryResponse {
    ready: boolean;
    message: string | null;
    hasHoldingAccess: boolean;
    role: HoldingRole | null;
    capabilities: HoldingCapabilities | null;
    featureEnabled: boolean;
    account: {
        id: string;
        legal_name: string;
        display_name: string;
        slug: string;
        country_code: string;
        status: 'active' | 'suspended';
        created_at: string;
        updated_at: string;
    } | null;
    stats: {
        totalBusinesses: number;
        totalWarehouses: number;
        totalActiveInternalUsers: number;
        totalMonthlyTrips: number;
        openIncidents: number;
        criticalIncidents: number;
        activeHoldingMembers: number;
    };
    accounts: HoldingAccessResponse['accounts'];
    businesses: HoldingBusinessSummary[];
    controlTower: HoldingControlTowerSnapshot;
    fintech: HoldingFintechSnapshot;
    marketplace: HoldingMarketplaceSnapshot;
    paymentsReadiness: HoldingPaymentsReadinessSnapshot;
    alerts: HoldingControlTowerAlert[];
    recommendedPlanCode: string | null;
    approvals: {
        pending: number;
        critical: number;
        breached: number;
        doubleBreached: number;
    };
}

export interface HoldingMember {
    id: string;
    holding_account_id: string;
    user_id: string | null;
    invited_email: string;
    role: Exclude<HoldingRole, 'admin'>;
    status: 'invited' | 'active' | 'suspended';
    invited_by: string | null;
    accepted_at: string | null;
    created_at: string;
    updated_at: string;
    user?: {
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        avatar_url: string | null;
    } | null;
}

export interface HoldingMembersResponse {
    ready: boolean;
    message: string | null;
    holdingAccountId: string | null;
    role: HoldingRole | null;
    canManageHolding: boolean;
    capabilities?: HoldingCapabilities | null;
    data: HoldingMember[];
}

export interface HoldingBusinessCatalogItem {
    business_id: string;
    company_name: string;
    city: string | null;
    department: string | null;
    current_holding_id: string | null;
    current_holding_name: string | null;
    relationship_type: 'parent' | 'subsidiary' | 'brand' | 'operator' | null;
    plan_code: string;
    plan_name: string;
    holding_feature_enabled: boolean;
}

export interface HoldingBusinessesResponse {
    ready: boolean;
    message: string | null;
    holdingAccountId: string | null;
    role: HoldingRole | null;
    canManageHolding: boolean;
    canLinkDirectly: boolean;
    capabilities?: HoldingCapabilities | null;
    linked: HoldingBusinessSummary[];
    catalog: HoldingBusinessCatalogItem[];
}

export interface HoldingApprovalRequest {
    id: string;
    holding_account_id: string;
    business_id: string | null;
    request_type: 'business_link' | 'credit_policy' | 'wallet_release' | 'plan_upgrade' | 'ops_exception' | 'custom';
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    title: string;
    description: string | null;
    payload: Record<string, unknown>;
    requested_by: string | null;
    assigned_to: string | null;
    assigned_team: HoldingAssignedTeam;
    sla_due_at: string | null;
    aging_bucket: HoldingApprovalAgingBucket;
    breached_at: string | null;
    escalation_level: number;
    resolved_within_sla: boolean | null;
    source_reference: string | null;
    decided_by: string | null;
    decided_at: string | null;
    decision_note: string | null;
    created_at: string;
    updated_at: string;
}

export type HoldingApprovalCreationMode = 'pending' | 'auto_approved';

export interface HoldingApprovalCreationResponse {
    data: HoldingApprovalRequest;
    mode: HoldingApprovalCreationMode;
}

export interface HoldingFinancePolicy {
    holding_account_id: string;
    max_single_advance_cop: number;
    max_business_exposure_cop: number;
    max_portfolio_exposure_cop: number;
    wallet_release_limit_cop: number;
    auto_approve_plan_upgrades_until_usd: number;
    allow_high_risk_operations: boolean;
    allow_critical_risk_operations: boolean;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface HoldingFinancePolicyResponse {
    ready: boolean;
    message: string | null;
    holdingAccountId: string | null;
    role: HoldingRole | null;
    canManageHolding: boolean;
    capabilities?: HoldingCapabilities | null;
    data: HoldingFinancePolicy | null;
}

export interface HoldingApprovalsResponse {
    ready: boolean;
    message: string | null;
    holdingAccountId: string | null;
    role: HoldingRole | null;
    canManageHolding: boolean;
    capabilities?: HoldingCapabilities | null;
    data: HoldingApprovalRequest[];
}

export interface BusinessTeamMember {
    id: string;
    business_id: string;
    user_id: string | null;
    invited_email: string;
    role: BusinessTeamRole;
    status: 'invited' | 'active' | 'suspended';
    invited_by: string | null;
    accepted_at: string | null;
    created_at: string;
    updated_at: string;
    user?: {
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        avatar_url: string | null;
    } | null;
    warehouse_memberships?: Array<{
        warehouse_id: string;
        role: BusinessTeamRole;
        active: boolean;
    }>;
}

export interface BusinessTeamResponse {
    data: BusinessTeamMember[];
    warehouses: Pick<Warehouse, 'id' | 'code' | 'name' | 'city' | 'department' | 'status'>[];
    subscription: BusinessPlanSubscription | null;
    plans: BillingPlan[];
    limits: WarehouseListResponse['limits'];
    canManageBilling: boolean;
    canManageTeam: boolean;
    teamSchemaReady?: boolean;
    teamSchemaMessage?: string | null;
}

export interface BusinessFleetInvitation {
    id: string;
    business_id: string;
    invite_code: string;
    status: 'pending' | 'accepted' | 'revoked' | 'expired';
    used_by_trucker_id: string | null;
    created_by: string | null;
    created_at: string;
    expires_at: string;
    accepted_at?: string | null;
    revoked_at?: string | null;
}

export type PrivateFleetCompensationMode =
    | 'salary_no_trip_pay'
    | 'trip_pay'
    | 'expenses_only'
    | 'trip_pay_plus_expenses';

export interface PrivateFleetTripCompensation {
    mode: PrivateFleetCompensationMode;
    freightAmount: number;
    expenseAmount: number;
    visiblePrimaryAmount: number;
    primaryLabel: string;
    summaryLabel: string;
}

export interface BusinessFleetMember {
    id: string;
    business_id: string;
    trucker_id: string;
    status: 'active' | 'suspended' | 'removed';
    internal_driver_id: string | null;
    vehicle_plate: string | null;
    notes: string | null;
    default_compensation_mode?: PrivateFleetCompensationMode;
    monthly_salary_amount?: number | null;
    monthly_salary_currency?: 'COP' | 'USD' | 'PEN' | 'BRL' | null;
    payroll_day?: number | null;
    payroll_notes?: string | null;
    created_at: string;
    updated_at: string;
    user?: {
        id: string;
        email: string | null;
        full_name: string | null;
        phone: string | null;
        avatar_url: string | null;
    } | null;
    activeTrips?: number;
    privateTripsCompleted?: number;
    totalExpenseAdvancedCop?: number;
    totalExpenseAssignedCop?: number;
    totalExpenseReleasedCop?: number;
    totalFreightHeldCop?: number;
    totalFreightReleasedCop?: number;
    totalPayrollReleasedCop?: number;
}

export interface PrivateFleetPayrollItem {
    id: string;
    run_id: string;
    business_id: string;
    fleet_member_id: string;
    trucker_id: string;
    amount: number;
    status: 'pending' | 'funded' | 'released_to_wallet' | 'cancelled' | 'failed' | 'proof_uploaded' | 'paid_external' | 'rejected';
    wallet_transaction_id: string | null;
    released_at: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface PrivateFleetPayrollRun {
    id: string;
    business_id: string;
    period_start: string;
    period_end: string;
    currency_code: 'COP' | 'USD' | 'PEN' | 'BRL';
    status: 'draft' | 'approved' | 'checkout_pending' | 'funded' | 'released' | 'cancelled' | 'failed' | 'pending_external_pay' | 'proof_uploaded' | 'paid_external' | 'rejected';
    payment_mode?: 'external_proof' | 'mercadopago_funded';
    external_payment_status?: 'pending_external_pay' | 'proof_uploaded' | 'paid_external' | 'rejected' | 'cancelled';
    external_paid_at?: string | null;
    external_paid_by?: string | null;
    external_payment_method?: string | null;
    external_payment_reference?: string | null;
    external_payment_proof_url?: string | null;
    external_payment_proof_storage_path?: string | null;
    external_payment_note?: string | null;
    gross_amount: number;
    processing_fee_amount: number;
    total_amount: number;
    created_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
    mp_preference_id: string | null;
    mp_external_reference: string | null;
    funded_payment_id: string | null;
    funded_at: string | null;
    released_at: string | null;
    gateway_response: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    items?: PrivateFleetPayrollItem[];
}

export interface PrivateFleetPayrollResponse {
    runs: PrivateFleetPayrollRun[];
    members: BusinessFleetMember[];
    canManagePayroll: boolean;
    role: string;
    summary: {
        configuredDrivers: number;
        releasedThisMonthCop: number;
        externalPaidThisMonthCop?: number;
        externalProofUploadedCop?: number;
        pendingRuns: number;
    };
}

export interface PrivateFleetAllocation {
    id: string;
    offer_id: string;
    business_id: string;
    trucker_id: string;
    allocation_type: 'expense_advance' | 'freight_payment' | 'trip_pay' | 'company_expense';
    amount: number;
    status: 'held_in_custody' | 'released_to_wallet' | 'refunded' | 'external_proof_pending' | 'proof_uploaded' | 'paid_external' | 'rejected' | 'cancelled';
    external_payment_status?: 'pending_external_pay' | 'proof_uploaded' | 'paid_external' | 'rejected' | 'cancelled' | null;
    external_paid_at?: string | null;
    external_payment_method?: string | null;
    external_payment_reference?: string | null;
    external_payment_proof_url?: string | null;
    external_payment_proof_storage_path?: string | null;
    external_payment_proof_signed_url?: string | null;
    external_payment_note?: string | null;
    latest_proof_id?: string | null;
    created_at: string;
    released_at?: string | null;
    truckerName?: string | null;
}

export interface PrivateFleetTripSettlementGroup {
    id: string;
    offer_id: string;
    trucker_id: string | null;
    truckerName?: string | null;
    compensation_mode: PrivateFleetCompensationMode;
    status: string;
    external_payment_status: 'pending_external_pay' | 'proof_uploaded' | 'paid_external' | 'rejected' | 'cancelled' | 'legacy_wallet_funded' | 'not_applicable';
    created_at: string;
    cargo_description?: string | null;
    has_warehouse: boolean;
    freightCop: number;
    expenseCop: number;
    totalCop: number;
    allocations: PrivateFleetAllocation[];
}

export interface BusinessFleetResponse {
    data: BusinessFleetMember[];
    privateAllocations?: PrivateFleetAllocation[];
    privateTripGroups?: PrivateFleetTripSettlementGroup[];
    invitations: BusinessFleetInvitation[];
    subscription: BusinessPlanSubscription | null;
    plans: BillingPlan[];
    limits: WarehouseListResponse['limits'];
    canManageFleet: boolean;
    canManagePayroll?: boolean;
    role?: BusinessRole | null;
    roleCapabilities?: Record<string, unknown>;
    payrollSchemaReady?: boolean;
    invitationHours: number;
    stats: {
        activeDrivers: number;
        activeTrips: number;
        privateTripsCompleted: number;
        expenseAdvancedThisMonthCop: number;
        expenseAssignedThisMonthCop?: number;
        expenseReleasedThisMonthCop?: number;
        expenseProofUploadedThisMonthCop?: number;
        expensePaidExternalThisMonthCop?: number;
        freightHeldThisMonthCop?: number;
        freightReleasedThisMonthCop?: number;
        freightProofUploadedThisMonthCop?: number;
        freightPaidExternalThisMonthCop?: number;
        freightSettledThisMonthCop: number;
        payrollReleasedThisMonthCop?: number;
    };
}

export interface PrivateFleetDriverTrip {
    id: string;
    status: string;
    assignmentStatus: 'pending' | 'accepted' | 'rejected';
    canAccept: boolean;
    canReject: boolean;
    nextAction: 'accept_or_reject' | 'pickup' | 'delivery' | 'completed' | 'returned_to_company' | 'open_trip';
    cargoType: string | null;
    cargoDescription?: string | null;
    originCity: string | null;
    originDepartment: string | null;
    originAddress?: string | null;
    destinationCity: string | null;
    destinationDepartment: string | null;
    destinationAddress?: string | null;
    pickupDate: string | null;
    pickupTimeStart?: string | null;
    pickupTimeEnd?: string | null;
    deliveryDate: string | null;
    deliveryTimeStart?: string | null;
    deliveryTimeEnd?: string | null;
    totalAmount: number;
    freightPaymentAmount?: number;
    expenseAllowanceAmount?: number;
    compensationMode?: PrivateFleetCompensationMode;
    expensesReleasePolicy?: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual' | null;
    compensation?: PrivateFleetTripCompensation;
    privateFleetNotes?: string | null;
    rejectedAt?: string | null;
    rejectionReason?: string | null;
}

export interface PrivateFleetDriverContext {
    isPrivateFleetDriver: boolean;
    membershipId: string | null;
    businessId: string | null;
    businessName: string | null;
    status: BusinessFleetMember['status'] | null;
    vehiclePlate: string | null;
    internalDriverId: string | null;
    schemaReady?: boolean;
    assignmentSchemaReady?: boolean;
    stats: {
        activeTrips: number;
        privateTripsCompleted: number;
        payrollReleasedThisMonthCop: number;
        payrollPendingCop: number;
    };
    assignedTrips: PrivateFleetDriverTrip[];
}
