/**
 * =============================================================================
 * KARGAX - PICKING SYSTEM API
 * /lib/picking/api.ts
 * 
 * Capa de API para comunicaciÃ³n con Supabase para el sistema de picking.
 * Todas las funciones manejan errores, logging, y retornan respuestas tipadas.
 * 
 * PRINCIPIOS:
 * - Type-safe: Todas las funciones tienen tipos de entrada y salida
 * - Error handling: Errores capturados y convertidos a mensajes amigables
 * - Logging: Console logs en desarrollo para debugging
 * - Retry logic: Para operaciones crÃ­ticas
 * 
 * =============================================================================
 */

import { supabase } from '@/lib/supabase/client';
import type {
    ManifestItem,
    PickingEvent,
    TripPhoto,
    RegisterArrivalRequest,
    RegisterArrivalResponse,
    RegisterItemLoadedRequest,
    RegisterItemLoadedResponse,
    RegisterItemDeliveredRequest,
    RegisterItemDeliveredResponse,
    AddTripPhotoRequest,
    AddTripPhotoResponse,
    RejectionReason,
    TripPhotoType,
} from './types';

// =============================================================================
// CONFIGURACIÃ“N
// =============================================================================

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Logger condicional que solo imprime en desarrollo
 */
const logger = {
    log: (...args: unknown[]) => IS_DEV && console.log('[Picking]', ...args),
    error: (...args: unknown[]) => console.error('[Picking Error]', ...args),
    warn: (...args: unknown[]) => IS_DEV && console.warn('[Picking]', ...args),
};

function toFriendlyPickingError(error: unknown, fallback: string) {
    if (error instanceof Error) {
        const normalizedMessage = error.message.toLowerCase();
        if (normalizedMessage.includes('abort') || normalizedMessage.includes('timeout')) {
            return 'La conexion tardo demasiado subiendo evidencia. Revisa tu red y vuelve a intentarlo.';
        }

        return error.message || fallback;
    }

    return fallback;
}

// =============================================================================
// FUNCIONES DE LLEGADA
// =============================================================================

/**
 * Registra la llegada del camionero a una ubicaciÃ³n (origen o destino)
 * Verifica las coordenadas GPS contra la ubicaciÃ³n esperada
 * 
 * @param request - Datos de la llegada incluyendo coordenadas GPS
 * @returns Resultado indicando si estÃ¡ dentro de la tolerancia
 */
export async function registerArrival(
    request: RegisterArrivalRequest
): Promise<RegisterArrivalResponse> {
    try {
        logger.log('Registrando llegada:', request);

        // Obtener usuario autenticado
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return {
                success: false,
                message: 'Debes iniciar sesion para continuar',
                distanceMeters: 0,
                withinTolerance: false,
            };
        }

        // Llamar RPC de Supabase
        const { data, error } = await (supabase as any).rpc('register_arrival', {
            p_offer_id: request.offerId,
            p_trucker_id: user.id,
            p_location_type: request.locationType,
            p_latitude: request.latitude,
            p_longitude: request.longitude,
            p_accuracy_meters: request.accuracyMeters || null,
        });

        if (error) {
            logger.error('Error en register_arrival:', error);
            return {
                success: false,
                message: error.message || 'Error al registrar llegada',
                distanceMeters: 0,
                withinTolerance: false,
            };
        }

        // El RPC retorna un array de rows
        const result = data?.[0];

        if (!result) {
            return {
                success: false,
                message: 'No se recibio respuesta del servidor',
                distanceMeters: 0,
                withinTolerance: false,
            };
        }

        logger.log('Llegada registrada:', result);

        return {
            success: result.success,
            message: result.message,
            distanceMeters: result.distance_meters || 0,
            withinTolerance: result.within_tolerance || false,
        };

    } catch (err) {
        logger.error('ExcepciÃ³n en registerArrival:', err);
        return {
            success: false,
            message: toFriendlyPickingError(err, 'Error de conexión. Verifica tu internet.'),
            distanceMeters: 0,
            withinTolerance: false,
        };
    }
}

// =============================================================================
// FUNCIONES DE CARGA (ORIGEN)
// =============================================================================

/**
 * Registra un item como cargado al camiÃ³n
 * 
 * @param request - Datos del item cargado
 * @returns Resultado con conteo de items cargados
 */
export async function registerItemLoaded(
    request: RegisterItemLoadedRequest
): Promise<RegisterItemLoadedResponse> {
    try {
        logger.log('Registrando item cargado:', request);

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return {
                success: false,
                message: 'Debes iniciar sesion para continuar',
                loadedCount: 0,
            };
        }

        const { data, error } = await (supabase as any).rpc('register_item_loaded', {
            p_offer_id: request.offerId,
            p_trucker_id: user.id,
            p_item_id: request.itemId,
            p_item_name: request.itemName,
            p_quantity: request.quantity,
            p_notes: request.notes || null,
            p_has_issue: request.hasIssue || false,
            p_load_status: request.loadStatus || (request.hasIssue ? 'issue' : 'loaded'),
            p_rejection_reason: request.rejectionReason || null,
            p_photo_urls: request.photoUrls || null,
            p_latitude: request.latitude || null,
            p_longitude: request.longitude || null,
        });

        if (error) {
            logger.error('Error en register_item_loaded:', error);
            return {
                success: false,
                message: error.message || 'Error al registrar item',
                loadedCount: 0,
            };
        }

        const result = data?.[0];

        logger.log('Item cargado registrado:', result);

        return {
            success: result?.success ?? false,
            message: result?.message || 'Item registrado',
            loadedCount: result?.loaded_count || 0,
        };

    } catch (err) {
        logger.error('ExcepciÃ³n en registerItemLoaded:', err);
        return {
            success: false,
            message: toFriendlyPickingError(err, 'Error de conexión. Verifica tu internet.'),
            loadedCount: 0,
        };
    }
}

// =============================================================================
// FUNCIONES DE ENTREGA (DESTINO)
// =============================================================================

/**
 * Registra un item como entregado (y/o rechazado)
 * 
 * @param request - Datos de la entrega incluyendo cantidades
 * @returns Resultado con conteos de entregados y rechazados
 */
export async function registerItemDelivered(
    request: RegisterItemDeliveredRequest
): Promise<RegisterItemDeliveredResponse> {
    try {
        logger.log('Registrando item entregado:', request);

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return {
                success: false,
                message: 'Debes iniciar sesion para continuar',
                deliveredCount: 0,
                rejectedCount: 0,
            };
        }

        const { data, error } = await (supabase as any).rpc('register_item_delivered', {
            p_offer_id: request.offerId,
            p_trucker_id: user.id,
            p_item_id: request.itemId,
            p_item_name: request.itemName,
            p_delivered_qty: request.deliveredQty,
            p_rejected_qty: request.rejectedQty || 0,
            p_rejection_reason: request.rejectionReason || null,
            p_notes: request.notes || null,
            p_photo_urls: request.photoUrls || null,
            p_latitude: request.latitude || null,
            p_longitude: request.longitude || null,
        });

        if (error) {
            logger.error('Error en register_item_delivered:', error);
            return {
                success: false,
                message: error.message || 'Error al registrar entrega',
                deliveredCount: 0,
                rejectedCount: 0,
            };
        }

        const result = data?.[0];

        logger.log('Item entregado registrado:', result);

        return {
            success: result?.success ?? false,
            message: result?.message || 'Item registrado',
            deliveredCount: result?.delivered_count || 0,
            rejectedCount: result?.rejected_count || 0,
        };

    } catch (err) {
        logger.error('ExcepciÃ³n en registerItemDelivered:', err);
        return {
            success: false,
            message: toFriendlyPickingError(err, 'Error de conexión. Verifica tu internet.'),
            deliveredCount: 0,
            rejectedCount: 0,
        };
    }
}

// =============================================================================
// FUNCIONES DE FOTOS
// =============================================================================

/**
 * Agrega una foto de evidencia al viaje
 * 
 * @param request - Datos de la foto incluyendo URL y tipo
 * @returns Resultado con total de fotos
 */
export async function addTripPhoto(
    request: AddTripPhotoRequest
): Promise<AddTripPhotoResponse> {
    try {
        logger.log('Agregando foto:', request);

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return {
                success: false,
                message: 'Debes iniciar sesion para continuar',
                totalPhotos: 0,
            };
        }

        const { data, error } = await (supabase as any).rpc('add_trip_photo', {
            p_offer_id: request.offerId,
            p_trucker_id: user.id,
            p_photo_url: request.photoUrl,
            p_photo_type: request.photoType,
            p_notes: request.notes || null,
            p_latitude: request.latitude || null,
            p_longitude: request.longitude || null,
        });

        if (error) {
            logger.error('Error en add_trip_photo:', error);
            return {
                success: false,
                message: error.message || 'Error al agregar foto',
                totalPhotos: 0,
            };
        }

        const result = data?.[0];

        logger.log('Foto agregada:', result);

        return {
            success: result?.success ?? false,
            message: result?.message || 'Foto agregada',
            totalPhotos: result?.total_photos || 0,
        };

    } catch (err) {
        logger.error('ExcepciÃ³n en addTripPhoto:', err);
        return {
            success: false,
            message: toFriendlyPickingError(err, 'Error de conexión. Verifica tu internet.'),
            totalPhotos: 0,
        };
    }
}

// =============================================================================
// FUNCIONES DE UPLOAD A STORAGE
// =============================================================================

function createUniqueStorageSuffix() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Sube una foto a Supabase Storage y retorna la URL pÃºblica
 * 
 * @param file - Archivo de imagen (File o Blob)
 * @param offerId - ID de la oferta para organizar en buckets
 * @param type - Tipo de foto para nombrar el archivo
 * @returns URL pÃºblica de la foto o null si falla
 */
export async function uploadPhoto(
    file: File | Blob,
    offerId: string,
    type: TripPhotoType
): Promise<{ url: string | null; error: string | null }> {
    try {
        logger.log('Subiendo foto:', { offerId, type, size: file.size });

        // Validar tamaÃ±o (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return {
                url: null,
                error: 'La foto excede el tamano maximo de 10MB',
            };
        }

        // Generar nombre Ãºnico
        const extension = file instanceof File
            ? file.name.split('.').pop() || 'jpg'
            : 'jpg';
        const fileName = `${offerId}/${type}_${Date.now()}_${createUniqueStorageSuffix()}.${extension}`;

        // Subir a Storage
        const { data, error } = await supabase.storage
            .from('trip-photos')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) {
            logger.error('Error subiendo foto:', error);
            return {
                url: null,
                error: toFriendlyPickingError(error, 'Error al subir foto'),
            };
        }

        // Obtener URL pÃºblica
        const { data: { publicUrl } } = supabase.storage
            .from('trip-photos')
            .getPublicUrl(data.path);

        logger.log('Foto subida:', publicUrl);

        return { url: publicUrl, error: null };

    } catch (err) {
        logger.error('ExcepciÃ³n en uploadPhoto:', err);
        return {
            url: null,
            error: toFriendlyPickingError(err, 'Error de conexión al subir foto'),
        };
    }
}

/**
 * Sube mÃºltiples fotos y retorna las URLs exitosas
 * 
 * @param files - Array de archivos
 * @param offerId - ID de la oferta
 * @param type - Tipo de fotos
 * @returns Array de URLs exitosas y array de errores
 */
export async function uploadMultiplePhotos(
    files: (File | Blob)[],
    offerId: string,
    type: TripPhotoType
): Promise<{ urls: string[]; errors: string[] }> {
    const urls: string[] = [];
    const errors: string[] = [];

    // Procesar en paralelo pero con lÃ­mite de 3 concurrentes
    const chunks: Array<(File | Blob)[]> = [];
    for (let i = 0; i < files.length; i += 3) {
        chunks.push(files.slice(i, i + 3));
    }

    for (const chunk of chunks) {
        const results = await Promise.all(
            chunk.map(file => uploadPhoto(file, offerId, type))
        );

        for (const result of results) {
            if (result.url) {
                urls.push(result.url);
            }
            if (result.error) {
                errors.push(result.error);
            }
        }
    }

    return { urls, errors };
}

// =============================================================================
// FUNCIONES DE CONSULTA
// =============================================================================

/**
 * Obtiene el historial de eventos de picking para una oferta
 * 
 * @param offerId - ID de la oferta
 * @returns Array de eventos ordenados por fecha
 */
export async function getPickingEvents(
    offerId: string
): Promise<PickingEvent[]> {
    try {
        const { data, error } = await supabase
            .from('picking_events')
            .select('*')
            .eq('offer_id', offerId)
            .order('created_at', { ascending: true });

        if (error) {
            logger.error('Error obteniendo eventos:', error);
            return [];
        }

        // Mapear a nuestros tipos
        return ((data || []) as any[]).map(row => ({
            id: row.id,
            offerId: row.offer_id,
            truckerId: row.trucker_id,
            eventType: row.event_type,
            manifestItemId: row.manifest_item_id,
            manifestItemName: row.manifest_item_name,
            quantity: row.quantity,
            itemStatus: row.item_status,
            notes: row.notes,
            rejectionReason: row.rejection_reason as RejectionReason,
            photoUrls: row.photo_urls,
            latitude: row.latitude,
            longitude: row.longitude,
            accuracyMeters: row.accuracy_meters,
            metadata: row.metadata,
            createdAt: row.created_at,
        }));

    } catch (err) {
        logger.error('ExcepciÃ³n en getPickingEvents:', err);
        return [];
    }
}

/**
 * Obtiene el manifiesto actual de una oferta
 * 
 * @param offerId - ID de la oferta
 * @returns Array de items del manifiesto
 */
export async function getManifestItems(
    offerId: string
): Promise<ManifestItem[]> {
    try {
        const { data, error } = await supabase
            .from('cargo_offers')
            .select('manifest_items')
            .eq('id', offerId)
            .single();

        if (error) {
            logger.error('Error obteniendo manifiesto:', error);
            return [];
        }

        // manifest_items es JSONB, parsearlo si es string
        const manifestData = data as { manifest_items?: unknown } | null;
        const items = manifestData?.manifest_items;

        if (!items) return [];
        if (typeof items === 'string') {
            return JSON.parse(items);
        }

        return items as ManifestItem[];

    } catch (err) {
        logger.error('ExcepciÃ³n en getManifestItems:', err);
        return [];
    }
}

/**
 * Obtiene las fotos del viaje
 * 
 * @param offerId - ID de la oferta  
 * @returns Array de fotos
 */
export async function getTripPhotos(
    offerId: string
): Promise<TripPhoto[]> {
    try {
        const { data, error } = await supabase
            .from('cargo_offers')
            .select('trip_photos')
            .eq('id', offerId)
            .single();

        if (error) {
            logger.error('Error obteniendo fotos:', error);
            return [];
        }

        const tripPhotosData = data as { trip_photos?: unknown } | null;
        const photos = tripPhotosData?.trip_photos;

        if (!photos) return [];
        if (typeof photos === 'string') {
            return JSON.parse(photos);
        }

        return photos as TripPhoto[];

    } catch (err) {
        logger.error('ExcepciÃ³n en getTripPhotos:', err);
        return [];
    }
}

// =============================================================================
// FUNCIONES DE NOTIFICACIÃ“N DE INSPECCIÃ“N
// =============================================================================

/**
 * EnvÃ­a notificaciÃ³n de inspecciÃ³n al business vÃ­a API
 * Esta funciÃ³n es llamada despuÃ©s de completar carga o entrega
 * 
 * @param data - Datos de la notificaciÃ³n
 * @returns Resultado de la notificaciÃ³n
 */
export async function sendInspectionNotification(data: {
    offerId: string;
    type: 'loading_completed' | 'delivery_completed' | 'issue_reported';
    businessPhone: string;
    businessName: string;
    truckerName: string;
    originCity: string;
    destinationCity: string;
    summary: {
        total: number;
        loaded: number;
        delivered: number;
        rejected: number;
        withIssues: number;
        loadingCompliancePercent: number;
        deliveryCompliancePercent: number;
    };
    issueDetails?: {
        itemName: string;
        reason: string;
        notes?: string;
    };
}): Promise<{ success: boolean; error?: string }> {
    try {
        logger.log('Sending inspection notification:', data.type);

        const { data: authData } = await supabase.auth.getSession();
        const accessToken = authData.session?.access_token;

        const response = await fetch('/api/notifications/inspection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            logger.error('Inspection notification failed:', result);
            return { success: false, error: result.error || 'Notification failed' };
        }

        logger.log('Inspection notification sent:', result);
        return { success: true };

    } catch (err: any) {
        logger.error('Exception sending inspection notification:', err);
        return { success: false, error: err.message };
    }
}

// =============================================================================
// EXPORT DEFAULT COMO OBJETO API
// =============================================================================

export const pickingApi = {
    // Llegada
    registerArrival,

    // Carga
    registerItemLoaded,

    // Entrega
    registerItemDelivered,

    // Fotos
    addTripPhoto,
    uploadPhoto,
    uploadMultiplePhotos,

    // Consultas
    getPickingEvents,
    getManifestItems,
    getTripPhotos,

    // Notificaciones
    sendInspectionNotification,
};

export default pickingApi;


