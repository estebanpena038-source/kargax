export type AlgorithmModule =
    | 'lastmile'
    | 'evidence'
    | 'reports'
    | 'warehouse'
    | 'billing'
    | 'marketplace'
    | 'private_fleet';

export type AlgorithmRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AlgorithmPriority = 'P0' | 'P1' | 'P2';
export type OperationRail = 'marketplace' | 'private_fleet';

export interface AlgorithmReason {
    code: string;
    label: string;
    detail?: string;
    weight?: number;
}

export interface AlgorithmRecommendation {
    module: AlgorithmModule;
    businessId: string;
    sourceType: 'offer' | 'dispatch' | 'warehouse' | 'driver' | 'billing' | 'wallet' | 'report';
    sourceId: string;
    score: number;
    riskLevel: AlgorithmRiskLevel;
    title: string;
    summary: string;
    reasons: AlgorithmReason[];
    actionLabel: string;
    actionHref: string;
    metadata?: Record<string, unknown>;
}

export interface AlgorithmRoleCapabilities {
    canViewFinance?: boolean;
    canViewOperations?: boolean;
    canViewTracking?: boolean;
    canViewEvidence?: boolean;
    canViewIntelligence?: boolean;
    canManageWarehouse?: boolean;
    canExecuteWarehouse?: boolean;
    canManagePrivateFleet?: boolean;
    canExportData?: boolean;
}

export interface RouteCoordinates {
    latitude: number | null;
    longitude: number | null;
}

export interface DeliveryRiskInput {
    offerId: string;
    businessId: string;
    rail: OperationRail;
    status: string | null;
    createdAt?: string | null;
    pickupDate?: string | null;
    deliveryDate?: string | null;
    origin?: RouteCoordinates | null;
    destination?: RouteCoordinates | null;
    assignedTruckerId?: string | null;
    privateFleetAssignmentStatus?: string | null;
    pickupVerifiedAt?: string | null;
    deliveryVerifiedAt?: string | null;
    lastPingAt?: string | null;
    lastPingAccuracyMeters?: number | null;
    latestDistanceToDestinationKm?: number | null;
    hasDeliverySignature?: boolean;
    hasDeliveryPhoto?: boolean;
    hasDeliveryPinVerified?: boolean;
    evidenceMissingCount?: number;
    openCriticalIncidents?: number;
    manifestExpectedCount?: number | null;
    manifestDeliveredCount?: number | null;
    manifestRejectedCount?: number | null;
    rejectedWithoutReasonCount?: number;
    externalProofPending?: boolean;
    now?: string | Date;
}

export interface DelaySignal {
    code: string;
    label: string;
    severity: AlgorithmRiskLevel;
}

export interface DeliveryRiskResult {
    offerId: string;
    businessId: string;
    rail: OperationRail;
    score: number;
    riskLevel: AlgorithmRiskLevel;
    reasons: AlgorithmReason[];
    recommendedActions: string[];
    delaySignals: DelaySignal[];
    blockingForClosure: boolean;
}

export type EvidenceQualityStatus = 'complete' | 'incomplete' | 'suspicious' | 'blocked';

export interface EvidenceQualityInput {
    offerId: string;
    businessId: string;
    rail: OperationRail;
    status: string | null;
    deliveryVerifiedAt?: string | null;
    hasDeliverySignature: boolean;
    hasDeliveryPhoto: boolean;
    hasDeliveryPinVerified: boolean;
    hasRecipientName?: boolean;
    hasRecipientDocument?: boolean;
    destinationCoordinatesValid?: boolean;
    lastDistanceToDestinationKm?: number | null;
    manifestExpectedCount?: number | null;
    manifestDeliveredCount?: number | null;
    manifestRejectedCount?: number | null;
    rejectedWithoutReasonCount?: number;
    openCriticalIncidents?: number;
    externalProofPending?: boolean;
}

export interface EvidenceQualityResult {
    offerId: string;
    businessId: string;
    rail: OperationRail;
    score: number;
    riskLevel: AlgorithmRiskLevel;
    status: EvidenceQualityStatus;
    missingRequirements: AlgorithmReason[];
    warnings: AlgorithmReason[];
    canCloseOperationally: boolean;
    canReleaseMarketplaceSettlementSuggestion: boolean;
}

export type NextBestActionType =
    | 'validate_pickup_pin'
    | 'request_live_tracking'
    | 'contact_driver'
    | 'collect_missing_pod'
    | 'resolve_incident'
    | 'review_delayed_route'
    | 'verify_manifest_difference'
    | 'download_support'
    | 'review_billing_limit'
    | 'monitor_route';

export interface NextBestAction {
    id: string;
    type: NextBestActionType;
    priority: AlgorithmPriority;
    title: string;
    description: string;
    actionLabel: string;
    href: string;
    roleVisibility: string[];
    reason: string;
    sourceId: string;
    rail: OperationRail;
    createdFromSignals: string[];
}

export interface ExecutiveAlert {
    id: string;
    module: AlgorithmModule;
    sourceId: string;
    severity: AlgorithmRiskLevel;
    title: string;
    description: string;
    actionLabel: string;
    href: string;
    rail?: OperationRail;
    includesFinance: boolean;
}
