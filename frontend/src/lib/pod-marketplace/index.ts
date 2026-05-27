/**
 * =============================================================================
 * KARGAX - MARKETPLACE POD REPORTS MODULE INDEX
 * /lib/pod-marketplace/index.ts
 * 
 * Punto de entrada para el módulo POD marketplace.
 * Re-exporta todos los tipos, funciones y constantes.
 * 
 * =============================================================================
 */

// Types
export type {
    MarketplacePodStatus,
    MarketplacePodPhase,
    MarketplacePodEventType,
    MarketplacePodItemStatus,
    RejectionReason,
    MarketplacePodVerifiedLocation,
    MarketplacePodPhoto,
    MarketplacePodManifestItem,
    MarketplacePodTimelineEvent,
    MarketplacePodSummary,
    MarketplacePodTruckerInfo,
    MarketplacePodRouteInfo,
    MarketplacePodReport,
    GetMarketplacePodReportRequest,
    GetMarketplacePodReportResponse,
    MarketplacePodNotification,
} from './types';

// Constants
export {
    REJECTION_REASON_LABELS,
    EVENT_TYPE_LABELS,
} from './types';

// Utility functions
export {
    calculateCompliancePercent,
    getStatusColor,
    getStatusBadgeClasses,
    formatMarketplacePodDate,
    formatRelativeTime,
    getInitials,
    isValidMarketplacePodReport,
} from './types';

// API functions
export {
    getMarketplacePodReport,
    getMarketplacePodList,
    marketplacePodApi,
} from './api';


