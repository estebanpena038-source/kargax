/**
 * =============================================================================
 * KARGAX - MARKETPLACE POD REPORTS TYPES
 * /lib/pod-marketplace/types.ts
 * 
 * Definiciones de tipos TypeScript para el sistema de reportes de inspección.
 * Estos tipos representan los datos de evidencia digital que se envían a las
 * empresas cuando los camioneros completan POD de cargue/entrega marketplace.
 * 
 * ARQUITECTURA:
 * - MarketplacePodReport: Reporte consolidado con toda la evidencia
 * - MarketplacePodSummary: Resumen ejecutivo de la inspección
 * - MarketplacePodTimeline: Eventos en orden cronológico
 * - MarketplacePodPhoto: Foto de evidencia con metadata GPS
 * 
 * ESCALABILIDAD:
 * - Tipos genéricos para extensibilidad futura
 * - Soporte para múltiples idiomas (i18n ready)
 * - Estructura preparada para diferentes tipos de carga
 * 
 * =============================================================================
 */

// =============================================================================
// ENUMS & CONSTANTS
// Valores constantes que definen el estado y tipo de POD marketplace
// =============================================================================

/**
 * Estado general de la inspección
 * @description Define en qué fase se encuentra la inspección
 */
export type MarketplacePodStatus =
    | 'pending'      // Aún no iniciada
    | 'in_progress'  // En proceso (carga o descarga activa)
    | 'loading'      // Carga completada, en tránsito
    | 'delivery'     // En proceso de entrega
    | 'completed'    // Viaje completado exitosamente
    | 'cancelled';   // Viaje cancelado

/**
 * Tipo de fase de inspección
 * @description Indica si es inspección de carga o entrega
 */
export type MarketplacePodPhase = 'loading' | 'delivery';

/**
 * Tipo de evento de picking para timeline
 * @description Todos los eventos posibles que pueden ocurrir durante picking
 */
export type MarketplacePodEventType =
    | 'arrival_origin'      // Llegada a origen verificada por GPS
    | 'loading_started'     // Inicio de carga
    | 'item_loaded'         // Item cargado al camión
    | 'item_load_issue'     // Novedad en item durante carga
    | 'loading_completed'   // Carga finalizada
    | 'pickup_verified'     // PIN de pickup verificado
    | 'arrival_destination' // Llegada a destino verificada por GPS
    | 'unloading_started'   // Inicio de descarga
    | 'item_delivered'      // Item entregado al cliente
    | 'item_rejected'       // Item rechazado por cliente
    | 'unloading_completed' // Descarga finalizada
    | 'delivery_verified'   // PIN de entrega verificado
    | 'photo_added';        // Foto agregada como evidencia

/**
 * Estado de un item individual
 * @description Estado del item después del proceso de picking
 */
export type MarketplacePodItemStatus =
    | 'pending'   // Aún no procesado
    | 'loaded'    // Cargado exitosamente
    | 'issue'     // Cargado con novedad
    | 'delivered' // Entregado completamente
    | 'partial'   // Entregado parcialmente
    | 'rejected'; // Completamente rechazado

/**
 * Motivos de rechazo predefinidos
 * @description Categorías para clasificar rechazos y generar estadísticas
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
 * Traducciones de motivos de rechazo por idioma
 * @description Mapeo de códigos a texto legible en cada idioma soportado
 */
export const REJECTION_REASON_LABELS: Record<string, Record<RejectionReason, string>> = {
    'es-CO': {
        damaged: 'Dañado/Roto',
        missing: 'Faltante',
        wrong_item: 'Item equivocado',
        customer_refused: 'Cliente rechazó',
        expired: 'Expirado',
        quality_issue: 'Problema de calidad',
        other: 'Otro motivo',
    },
    'en': {
        damaged: 'Damaged',
        missing: 'Missing',
        wrong_item: 'Wrong item',
        customer_refused: 'Customer refused',
        expired: 'Expired',
        quality_issue: 'Quality issue',
        other: 'Other reason',
    },
    'pt-BR': {
        damaged: 'Danificado',
        missing: 'Faltando',
        wrong_item: 'Item errado',
        customer_refused: 'Cliente recusou',
        expired: 'Expirado',
        quality_issue: 'Problema de qualidade',
        other: 'Outro motivo',
    },
};

/**
 * Traducciones de tipos de evento para timeline
 */
export const EVENT_TYPE_LABELS: Record<string, Record<MarketplacePodEventType, string>> = {
    'es-CO': {
        arrival_origin: 'Llegada a origen',
        loading_started: 'Inicio de carga',
        item_loaded: 'Item cargado',
        item_load_issue: 'Novedad en carga',
        loading_completed: 'Carga completada',
        pickup_verified: 'PIN de pickup verificado',
        arrival_destination: 'Llegada a destino',
        unloading_started: 'Inicio de descarga',
        item_delivered: 'Item entregado',
        item_rejected: 'Item rechazado',
        unloading_completed: 'Descarga completada',
        delivery_verified: 'PIN de entrega verificado',
        photo_added: 'Foto agregada',
    },
    'en': {
        arrival_origin: 'Arrived at origin',
        loading_started: 'Loading started',
        item_loaded: 'Item loaded',
        item_load_issue: 'Loading issue',
        loading_completed: 'Loading completed',
        pickup_verified: 'Pickup PIN verified',
        arrival_destination: 'Arrived at destination',
        unloading_started: 'Unloading started',
        item_delivered: 'Item delivered',
        item_rejected: 'Item rejected',
        unloading_completed: 'Unloading completed',
        delivery_verified: 'Delivery PIN verified',
        photo_added: 'Photo added',
    },
    'pt-BR': {
        arrival_origin: 'Chegada na origem',
        loading_started: 'Carregamento iniciado',
        item_loaded: 'Item carregado',
        item_load_issue: 'Problema no carregamento',
        loading_completed: 'Carregamento concluído',
        pickup_verified: 'PIN de coleta verificado',
        arrival_destination: 'Chegada no destino',
        unloading_started: 'Descarregamento iniciado',
        item_delivered: 'Item entregue',
        item_rejected: 'Item rejeitado',
        unloading_completed: 'Descarregamento concluído',
        delivery_verified: 'PIN de entrega verificado',
        photo_added: 'Foto adicionada',
    },
};

// =============================================================================
// CORE INTERFACES
// Estructuras de datos principales para los reportes de inspección
// =============================================================================

/**
 * Ubicación GPS verificada
 * @description Coordenadas con metadata de verificación
 */
export interface MarketplacePodVerifiedLocation {
    /** Latitud en grados decimales */
    latitude: number;
    /** Longitud en grados decimales */
    longitude: number;
    /** Precisión del GPS en metros */
    accuracyMeters?: number;
    /** Timestamp de verificación (ISO 8601) */
    verifiedAt: string;
    /** Si está dentro del radio de tolerancia */
    withinTolerance: boolean;
    /** Distancia al punto esperado en metros */
    distanceFromExpected?: number;
}

/**
 * Foto de evidencia con metadata completa
 * @description Incluye GPS, timestamp, y notas del camionero
 */
export interface MarketplacePodPhoto {
    /** ID único de la foto */
    id: string;
    /** URL pública de la foto en Storage */
    url: string;
    /** Tipo de foto (carga, descarga, general, problema) */
    type: 'loading' | 'unloading' | 'general' | 'issue';
    /** Notas del camionero sobre la foto */
    notes?: string;
    /** Timestamp cuando se tomó (ISO 8601) */
    timestamp: string;
    /** Latitud donde se tomó la foto */
    latitude?: number;
    /** Longitud donde se tomó la foto */
    longitude?: number;
    /** ID del item asociado (si aplica) */
    manifestItemId?: string;
    /** Nombre del item asociado (si aplica) */
    manifestItemName?: string;
    /** Fase operativa visible para UI */
    stage?: 'loading' | 'unloading';
    /** Cantidad representada por la evidencia */
    quantity?: number;
    /** Estado visible del item al momento de la evidencia */
    itemStatus?: MarketplacePodItemStatus;
    /** Si la evidencia corresponde a una novedad */
    hasIssue?: boolean;
    /** Si la evidencia corresponde a un rechazo */
    isRejected?: boolean;
    /** Motivo del rechazo */
    rejectionReason?: RejectionReason;
}

/**
 * Item del manifiesto con estado de inspección
 * @description Representa un producto/item con su estado de carga y entrega
 */
export interface MarketplacePodManifestItem {
    /** ID único del item */
    id: string;
    /** Nombre del producto */
    name: string;
    /** Descripción adicional */
    description?: string;
    /** Referencia/SKU del producto */
    reference?: string;
    /** URL de imagen del producto */
    imageUrl?: string;
    /** Cantidad esperada */
    expectedQuantity: number;

    // === Estado de CARGA (Origen) ===
    /** Cantidad efectivamente cargada */
    loadedQuantity?: number;
    /** Cantidad rechazada en origen antes de cargar */
    loadRejectedQuantity?: number;
    /** Timestamp de carga (ISO 8601) */
    loadedAt?: string;
    /** Notas durante la carga */
    loadNotes?: string;
    /** Motivo libre del rechazo en carga */
    loadRejectionReason?: string;
    /** URLs de fotos de carga */
    loadPhotos: string[];
    /** Si hubo novedad al cargar */
    hasLoadIssue: boolean;
    /** Si el item fue rechazado en carga y no es entregable */
    isRejectedInLoad: boolean;

    // === Estado de ENTREGA (Destino) ===
    /** Cantidad entregada exitosamente */
    deliveredQuantity?: number;
    /** Cantidad rechazada */
    rejectedQuantity?: number;
    /** Cantidad rechazada durante la descarga */
    deliveryRejectedQuantity?: number;
    /** Total de unidades rechazadas entre carga y descarga */
    rejectedUnits: number;
    /** Motivo del rechazo */
    rejectionReason?: RejectionReason;
    /** Timestamp de entrega (ISO 8601) */
    deliveredAt?: string;
    /** Notas de entrega */
    deliveryNotes?: string;
    /** URLs de fotos de entrega */
    deliveryPhotos: string[];

    // === Estado calculado ===
    /** Estado actual del item */
    status: MarketplacePodItemStatus;
}

/**
 * Evento del timeline de inspección
 * @description Registro de auditoría de una acción específica
 */
export interface MarketplacePodTimelineEvent {
    /** ID único del evento */
    id: string;
    /** Tipo de evento */
    eventType: MarketplacePodEventType;
    /** Timestamp del evento (ISO 8601) */
    timestamp: string;
    /** ID del item afectado (si aplica) */
    manifestItemId?: string;
    /** Nombre del item afectado (si aplica) */
    manifestItemName?: string;
    /** Cantidad involucrada */
    quantity?: number;
    /** Estado resultante del item */
    itemStatus?: MarketplacePodItemStatus;
    /** Notas del camionero */
    notes?: string;
    /** Motivo de rechazo (si aplica) */
    rejectionReason?: RejectionReason;
    /** URLs de fotos asociadas */
    photoUrls: string[];
    /** Ubicación GPS */
    location?: {
        latitude: number;
        longitude: number;
        accuracyMeters?: number;
    };
    /** Metadata adicional */
    metadata?: Record<string, unknown>;
}

/**
 * Resumen ejecutivo de la inspección
 * @description Métricas consolidadas para vista rápida
 */
export interface MarketplacePodSummary {
    /** Total de items en el manifiesto */
    totalItems: number;
    /** Items cargados exitosamente */
    loadedItems: number;
    /** Items con novedades en carga */
    loadIssueItems: number;
    /** Items entregados completamente */
    deliveredItems: number;
    /** Items entregados parcialmente */
    partialItems: number;
    /** Items completamente rechazados */
    rejectedItems: number;
    /** Items con alguna unidad rechazada */
    rejectedItemCount: number;
    /** Total de fotos de evidencia */
    totalPhotos: number;
    /** Porcentaje de cumplimiento de carga */
    loadingCompliancePercent: number;
    /** Porcentaje de cumplimiento de entrega */
    deliveryCompliancePercent: number;
}

/**
 * Información del camionero
 */
export interface MarketplacePodTruckerInfo {
    /** ID del usuario */
    id: string;
    /** Nombre completo */
    fullName: string;
    /** Email */
    email?: string;
    /** Teléfono */
    phone?: string;
    /** URL de foto de perfil */
    avatarUrl?: string;
    /** Calificación promedio */
    rating?: number;
    /** Total de viajes completados */
    totalTrips?: number;
}

/**
 * Información de la ruta
 */
export interface MarketplacePodRouteInfo {
    /** Ciudad de origen */
    originCity: string;
    /** Dirección completa de origen */
    originAddress: string;
    /** Ciudad de destino */
    destinationCity: string;
    /** Dirección completa de destino */
    destinationAddress: string;
    /** Nombre del contacto de pickup */
    pickupContactName?: string;
    /** Teléfono del contacto de pickup */
    pickupContactPhone?: string;
    /** Nombre del contacto de entrega */
    deliveryContactName?: string;
    /** Teléfono del contacto de entrega */
    deliveryContactPhone?: string;
}

/**
 * Reporte de inspección completo
 * @description Estructura principal que contiene toda la evidencia digital
 */
export interface MarketplacePodReport {
    /** ID de la oferta */
    offerId: string;
    /** Estado actual de la inspección */
    status: MarketplacePodStatus;
    /** Fase actual */
    phase: MarketplacePodPhase;

    // === Información contextual ===
    /** Información del camionero */
    trucker: MarketplacePodTruckerInfo;
    /** Información de la ruta */
    route: MarketplacePodRouteInfo;
    /** Tipo de carga */
    cargoType?: string;
    /** Descripción de la carga */
    cargoDescription?: string;
    /** Monto total del viaje */
    totalAmount: number;
    /** Moneda */
    currency: string;

    // === Timestamps clave ===
    /** Cuando se creó la oferta */
    createdAt: string;
    /** Llegada a origen */
    arrivedAtOriginAt?: string;
    /** Inicio de carga */
    loadingStartedAt?: string;
    /** Carga completada */
    loadingCompletedAt?: string;
    /** PIN de pickup verificado */
    pickupVerifiedAt?: string;
    /** Llegada a destino */
    arrivedAtDestinationAt?: string;
    /** Inicio de descarga */
    unloadingStartedAt?: string;
    /** Descarga completada */
    unloadingCompletedAt?: string;
    /** PIN de entrega verificado */
    deliveryVerifiedAt?: string;

    // === Ubicaciones verificadas ===
    /** Ubicación de origen verificada */
    originLocation?: MarketplacePodVerifiedLocation;
    /** Ubicación de destino verificada */
    destinationLocation?: MarketplacePodVerifiedLocation;

    // === Contenido del reporte ===
    /** Resumen ejecutivo */
    summary: MarketplacePodSummary;
    /** Items del manifiesto con estado */
    manifestItems: MarketplacePodManifestItem[];
    /** Timeline de eventos */
    timeline: MarketplacePodTimelineEvent[];
    /** Fotos de evidencia */
    photos: MarketplacePodPhoto[];
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// Tipos para comunicación con el backend
// =============================================================================

/**
 * Request para obtener reporte de inspección
 */
export interface GetMarketplacePodReportRequest {
    offerId: string;
    /** Incluir fotos en la respuesta */
    includePhotos?: boolean;
    /** Incluir timeline completo */
    includeTimeline?: boolean;
}

/**
 * Response del endpoint de reporte de inspección
 */
export interface GetMarketplacePodReportResponse {
    success: boolean;
    data?: MarketplacePodReport;
    error?: string;
    errorCode?: string;
}

/**
 * Notificación de inspección (para empresas)
 */
export interface MarketplacePodNotification {
    /** ID de la notificación */
    id: string;
    /** Tipo de notificación */
    type: 'inspection_loading_completed' | 'inspection_delivery_completed';
    /** Título */
    title: string;
    /** Mensaje */
    message: string;
    /** ID de la oferta */
    offerId: string;
    /** Resumen rápido */
    summary: MarketplacePodSummary;
    /** Timestamp */
    createdAt: string;
    /** Si ha sido leída */
    read: boolean;
}

// =============================================================================
// UTILITY FUNCTIONS
// Funciones helper para trabajar con los tipos
// =============================================================================

/**
 * Calcula el porcentaje de cumplimiento
 * @param completed - Cantidad completada
 * @param total - Cantidad total esperada
 * @returns Porcentaje entre 0 y 100
 */
export function calculateCompliancePercent(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
}

/**
 * Determina el color de estado para UI
 * @param status - Estado del item o inspección
 * @returns Clase de color Tailwind
 */
export function getStatusColor(status: MarketplacePodItemStatus | MarketplacePodStatus): string {
    const colors: Record<string, string> = {
        pending: 'text-zinc-500',
        in_progress: 'text-zinc-700',
        loading: 'text-zinc-700',
        loaded: 'text-zinc-950',
        issue: 'text-zinc-800',
        delivered: 'text-zinc-950',
        partial: 'text-zinc-800',
        rejected: 'text-zinc-950',
        completed: 'text-zinc-950',
        cancelled: 'text-zinc-400',
        delivery: 'text-zinc-700',
    };
    return colors[status] || 'text-slate-500';
}

/**
 * Determina el color de fondo para badges
 * @param status - Estado del item o inspección
 * @returns Clases de Tailwind para badge
 */
export function getStatusBadgeClasses(status: MarketplacePodItemStatus | MarketplacePodStatus): string {
    const classes: Record<string, string> = {
        pending: 'border border-zinc-200 bg-zinc-50 text-zinc-700',
        in_progress: 'border border-zinc-200 bg-white text-zinc-700',
        loading: 'border border-zinc-200 bg-white text-zinc-700',
        loaded: 'border border-zinc-950 bg-white text-zinc-950',
        issue: 'border border-zinc-300 bg-white text-zinc-950',
        delivered: 'border border-zinc-950 bg-white text-zinc-950',
        partial: 'border border-zinc-300 bg-white text-zinc-950',
        rejected: 'border border-zinc-950 bg-zinc-950 text-white',
        completed: 'border border-zinc-950 bg-white text-zinc-950',
        cancelled: 'border border-zinc-200 bg-zinc-50 text-zinc-500',
        delivery: 'border border-zinc-200 bg-white text-zinc-700',
    };
    return classes[status] || 'bg-slate-100 text-slate-700';
}

/**
 * Formatea timestamp para mostrar en UI
 * @param isoString - Fecha en formato ISO 8601
 * @param locale - Código de idioma
 * @returns Fecha formateada
 */
export function formatMarketplacePodDate(isoString: string, locale: string = 'es-CO'): string {
    try {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    } catch {
        return isoString;
    }
}

/**
 * Formatea timestamp relativo (hace X minutos)
 * @param isoString - Fecha en formato ISO 8601
 * @param locale - Código de idioma
 * @returns Tiempo relativo
 */
export function formatRelativeTime(isoString: string, locale: string = 'es-CO'): string {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

        if (diffMins < 60) {
            return rtf.format(-diffMins, 'minute');
        } else if (diffHours < 24) {
            return rtf.format(-diffHours, 'hour');
        } else {
            return rtf.format(-diffDays, 'day');
        }
    } catch {
        return isoString;
    }
}

/**
 * Genera las iniciales de un nombre
 * @param fullName - Nombre completo
 * @returns Iniciales (máximo 2 caracteres)
 */
export function getInitials(fullName: string): string {
    return fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

/**
 * Valida si un reporte tiene datos suficientes para mostrar
 * @param report - Reporte POD marketplace
 * @returns True si tiene datos válidos
 */
export function isValidMarketplacePodReport(report: MarketplacePodReport | null | undefined): report is MarketplacePodReport {
    return !!(report && report.offerId && report.manifestItems);
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default {
    REJECTION_REASON_LABELS,
    EVENT_TYPE_LABELS,
    calculateCompliancePercent,
    getStatusColor,
    getStatusBadgeClasses,
    formatMarketplacePodDate,
    formatRelativeTime,
    getInitials,
    isValidMarketplacePodReport,
};

