/**
 * =============================================================================
 * KARGAX - INSPECTION REPORTS MODULE INDEX
 * /lib/inspections/index.ts
 * 
 * Punto de entrada para el módulo de inspecciones.
 * Re-exporta todos los tipos, funciones y constantes.
 * 
 * =============================================================================
 */

// Types
export type {
    InspectionStatus,
    InspectionPhase,
    InspectionEventType,
    InspectionItemStatus,
    RejectionReason,
    VerifiedLocation,
    InspectionPhoto,
    InspectionManifestItem,
    InspectionTimelineEvent,
    InspectionSummary,
    TruckerInfo,
    RouteInfo,
    InspectionReport,
    GetInspectionReportRequest,
    GetInspectionReportResponse,
    InspectionNotification,
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
    formatInspectionDate,
    formatRelativeTime,
    getInitials,
    isValidReport,
} from './types';

// API functions
export {
    getInspectionReport,
    getInspectionList,
    inspectionsApi,
} from './api';

