/**
 * =============================================================================
 * KARGAX - PICKING SYSTEM TYPES
 * /lib/picking/types.ts
 * 
 * Definiciones de tipos TypeScript para el sistema de picking digital.
 * Estos tipos reflejan la estructura de datos en la base de datos y se
 * usan en todo el frontend para garantizar type-safety.
 * 
 * ARQUITECTURA:
 * - ManifestItem: Item individual del manifiesto de carga
 * - PickingEvent: Evento de auditoría
 * - TripPhoto: Foto de evidencia
 * - PickingState: Estado del picking en tiempo real
 * 
 * =============================================================================
 */

// =============================================================================
// MANIFEST ITEM TYPES
// Representación completa de un item en el manifiesto
// =============================================================================

/**
 * Estado de un item durante el proceso de picking
 * - pending: Aún no procesado
 * - loaded: Cargado al camión en origen
 * - issue: Cargado pero con novedad
 * - delivered: Entregado completamente en destino
 * - partial: Entregado parcialmente (algunos rechazados)
 * - rejected: Completamente rechazado
 */
export type ManifestItemStatus =
    | 'pending'
    | 'loaded'
    | 'issue'
    | 'delivered'
    | 'partial'
    | 'rejected';

/**
 * Motivos de rechazo predefinidos
 * Estos se usan para categorizar rechazos y generar estadísticas
 */
export type RejectionReason =
    | 'damaged'           // Dañado
    | 'missing'           // Faltante
    | 'wrong_item'        // Item equivocado
    | 'customer_refused'  // Cliente rechazó
    | 'expired'           // Expirado (para perecederos)
    | 'quality_issue'     // Problema de calidad
    | 'other';            // Otro motivo

/**
 * Traducciones de motivos de rechazo para UI
 */
export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
    damaged: 'Dañado/Roto',
    missing: 'Faltante',
    wrong_item: 'Item equivocado',
    customer_refused: 'Cliente rechazó',
    expired: 'Expirado',
    quality_issue: 'Problema de calidad',
    other: 'Otro motivo',
};

/**
 * Item del manifiesto de carga
 * Estructura completa que incluye estado de carga y entrega
 */
export interface ManifestItem {
    // === Información básica (definido por empresa) ===

    /** Identificador único del item (UUID generado al crear) */
    id: string;

    /** Nombre del producto */
    name: string;

    /** Cantidad esperada */
    quantity: number;

    /** Referencia/SKU del producto (opcional) */
    reference?: string;

    /** URL de imagen del producto (opcional) */
    imageUrl?: string;

    /** Descripción adicional (opcional) */
    description?: string;

    // === Estado de CARGA (Origen) ===

    /** Timestamp de cuando se cargó */
    loadedAt?: string;

    /** Cantidad efectivamente cargada */
    loadedQty?: number;

    /** Notas durante la carga */
    loadNotes?: string;

    /** URLs de fotos tomadas durante la carga */
    loadPhotos?: string[];

    /** Si hubo alguna novedad al cargar */
    hasIssue?: boolean;

    /** Estado final de carga */
    loadStatus?: 'loaded' | 'issue' | 'rejected';

    /** Motivo libre si la carga fue rechazada */
    loadRejectionReason?: string;

    // === Estado de ENTREGA (Destino) ===

    /** Timestamp de cuando se entregó */
    deliveredAt?: string;

    /** Cantidad entregada exitosamente */
    deliveredQty?: number;

    /** Cantidad rechazada por el cliente */
    rejectedQty?: number;

    /** Motivo del rechazo (si aplica) */
    rejectionReason?: RejectionReason;

    /** Notas de la entrega */
    deliveryNotes?: string;

    /** URLs de fotos tomadas durante la entrega */
    deliveryPhotos?: string[];

    /** Estado final de la entrega */
    deliveryStatus?: 'complete' | 'partial' | 'rejected';

    // === Estado calculado (para UI) ===

    /** Indica si el item ha sido procesado en carga */
    isLoaded?: boolean;

    /** Indica si el item ha sido procesado en entrega */
    isDelivered?: boolean;
}

// =============================================================================
// PICKING EVENT TYPES
// Eventos de auditoría para trazabilidad completa
// =============================================================================

/**
 * Tipos de eventos de picking
 */
export type PickingEventType =
    | 'arrival_origin'      // Llegada a origen verificada por GPS
    | 'loading_started'     // Inicio de carga
    | 'item_loaded'         // Item cargado al camión
    | 'item_load_issue'     // Novedad en item durante carga
    | 'loading_completed'   // Carga finalizada
    | 'arrival_destination' // Llegada a destino verificada por GPS
    | 'unloading_started'   // Inicio de descarga
    | 'item_delivered'      // Item entregado al cliente
    | 'item_rejected'       // Item rechazado por cliente
    | 'unloading_completed' // Descarga finalizada
    | 'photo_added';        // Foto agregada como evidencia

/**
 * Evento de picking para auditoría
 */
export interface PickingEvent {
    id: string;
    offerId: string;
    truckerId: string;
    eventType: PickingEventType;
    manifestItemId?: string;
    manifestItemName?: string;
    quantity?: number;
    itemStatus?: ManifestItemStatus;
    notes?: string;
    rejectionReason?: RejectionReason;
    photoUrls?: string[];
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

// =============================================================================
// TRIP PHOTO TYPES
// Fotos de evidencia del viaje
// =============================================================================

/**
 * Tipos de fotos
 */
export type TripPhotoType =
    | 'loading'     // Durante la carga
    | 'unloading'   // Durante la descarga
    | 'general'     // General del viaje
    | 'issue';      // Reportando un problema

/**
 * Foto del viaje
 */
export interface TripPhoto {
    url: string;
    type: TripPhotoType;
    notes?: string;
    timestamp: string;
    latitude?: number;
    longitude?: number;
}

// =============================================================================
// PICKING STATE TYPES
// Estado del proceso de picking en tiempo real
// =============================================================================

/**
 * Etapa actual del picking
 */
export type PickingStage =
    | 'not_started'         // No ha iniciado
    | 'en_route_to_origin'  // En camino al origen
    | 'at_origin'           // En origen, puede iniciar carga
    | 'loading'             // Cargando items
    | 'awaiting_pickup_pin' // Esperando PIN de salida
    | 'in_transit'          // En tránsito hacia destino
    | 'at_destination'      // En destino, puede iniciar descarga
    | 'unloading'           // Descargando/entregando items
    | 'awaiting_delivery_pin' // Esperando PIN de entrega
    | 'completed';          // Viaje completado

/**
 * Estado completo del picking para la UI
 */
export interface PickingState {
    stage: PickingStage;

    // Progreso de carga
    loadingProgress: {
        total: number;
        loaded: number;
        withIssues: number;
        percentage: number;
    };

    // Progreso de entrega
    deliveryProgress: {
        total: number;
        delivered: number;
        rejected: number;
        percentage: number;
    };

    // GPS
    gps: {
        currentLat?: number;
        currentLng?: number;
        accuracy?: number;
        isTracking: boolean;
        lastUpdate?: string;
    };

    // Permisos
    canStartLoading: boolean;
    canSubmitPickupPin: boolean;
    canStartUnloading: boolean;
    canSubmitDeliveryPin: boolean;

    // Errores
    errors: string[];
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// Tipos para las llamadas a las funciones RPC de Supabase
// =============================================================================

/**
 * Request para registrar llegada
 */
export interface RegisterArrivalRequest {
    offerId: string;
    locationType: 'origin' | 'destination';
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
}

/**
 * Response de registrar llegada
 */
export interface RegisterArrivalResponse {
    success: boolean;
    message: string;
    distanceMeters: number;
    withinTolerance: boolean;
}

/**
 * Request para registrar item cargado
 */
export interface RegisterItemLoadedRequest {
    offerId: string;
    itemId: string;
    itemName: string;
    quantity: number;
    notes?: string;
    hasIssue?: boolean;
    loadStatus?: 'loaded' | 'issue' | 'rejected';
    rejectionReason?: string;
    photoUrls?: string[];
    latitude?: number;
    longitude?: number;
}

/**
 * Response de registrar item cargado
 */
export interface RegisterItemLoadedResponse {
    success: boolean;
    message: string;
    loadedCount: number;
}

/**
 * Request para registrar item entregado
 */
export interface RegisterItemDeliveredRequest {
    offerId: string;
    itemId: string;
    itemName: string;
    deliveredQty: number;
    rejectedQty?: number;
    rejectionReason?: RejectionReason;
    notes?: string;
    photoUrls?: string[];
    latitude?: number;
    longitude?: number;
}

/**
 * Response de registrar item entregado
 */
export interface RegisterItemDeliveredResponse {
    success: boolean;
    message: string;
    deliveredCount: number;
    rejectedCount: number;
}

/**
 * Request para agregar foto
 */
export interface AddTripPhotoRequest {
    offerId: string;
    photoUrl: string;
    photoType: TripPhotoType;
    notes?: string;
    latitude?: number;
    longitude?: number;
}

/**
 * Response de agregar foto
 */
export interface AddTripPhotoResponse {
    success: boolean;
    message: string;
    totalPhotos: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calcula el porcentaje de progreso
 */
export function calculatePercentage(current: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
}

/**
 * Determina la etapa actual del picking basado en el estado de la oferta
 */
export function determinePickingStage(offer: {
    status: string;
    arrivedAtOriginAt?: string | null;
    loadingCompletedAt?: string | null;
    pickupVerifiedAt?: string | null;
    arrivedAtDestinationAt?: string | null;
    deliveryVerifiedAt?: string | null;
}): PickingStage {
    // Completado
    if (offer.deliveryVerifiedAt) {
        return 'completed';
    }

    // En destino, esperando descarga o PIN
    if (offer.arrivedAtDestinationAt) {
        if (offer.status === 'in_progress') {
            return 'unloading';
        }
        return 'awaiting_delivery_pin';
    }

    // En tránsito
    if (offer.pickupVerifiedAt) {
        return 'in_transit';
    }

    // En origen, cargando o esperando PIN
    if (offer.arrivedAtOriginAt) {
        if (offer.loadingCompletedAt) {
            return 'awaiting_pickup_pin';
        }
        return 'loading';
    }

    // Asignado pero no ha llegado
    if (offer.status === 'in_progress' || offer.status === 'active') {
        return 'en_route_to_origin';
    }

    return 'not_started';
}

/**
 * Genera un ID único para items del manifiesto
 */
export function generateManifestItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateStableManifestItemId(itemName: string, index: number): string {
    const normalizedName = (itemName || 'item')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'item';

    return `manifest-${index + 1}-${normalizedName}`;
}

/**
 * Valida que un item tenga la información mínima requerida
 */
export function validateManifestItem(item: Partial<ManifestItem>): string[] {
    const errors: string[] = [];

    if (!item.name?.trim()) {
        errors.push('El nombre del producto es requerido');
    }

    if (!item.quantity || item.quantity < 1) {
        errors.push('La cantidad debe ser al menos 1');
    }

    return errors;
}

/**
 * Formatea la distancia en metros para mostrar
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} metros`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}
