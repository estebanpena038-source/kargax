// =============================================================================
// KARGAX FRONTEND - API CLIENT (Oracle-Level)
// =============================================================================
//
// Cliente HTTP para comunicación con el backend.
// Implementa patrones de resiliencia empresarial:
//
// 🔄 Retry con exponential backoff
// 🔐 Manejo automático de tokens JWT
// 📊 Logging de requests para debugging
// ⚡ Interceptores para refresh automático de tokens
// 🛡️ Manejo de errores consistente
//
// =============================================================================

// Import Supabase API Bridge for offers (migrated from NestJS)
import { supabaseApi } from '@/lib/supabase/api-bridge';

// =============================================================================
// CONFIGURACIÓN
// =============================================================================

/**
 * URL base del backend API.
 * En producción, usar variable de entorno o configuración dinámica.
 */
const API_BASE_URL = '';

/**
 * Prefijo de la API para versionamiento.
 */
const API_PREFIX = '/api';
const API_REQUEST_TIMEOUT_MS = 12000;

// =============================================================================
// TIPOS
// =============================================================================

/**
 * Respuesta genérica de la API.
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: {
        code: string;
        message: string;
        details?: Array<{ field: string; message: string }>;
    };
}

/**
 * Opciones para las requests.
 */
interface RequestOptions extends Omit<RequestInit, 'body'> {
    /** Body de la request (se convierte a JSON automáticamente) */
    body?: unknown;
    /** Si es true, no añade el token de autorización */
    skipAuth?: boolean;
    /** Número de reintentos en caso de error */
    retries?: number;
    /** Request timeout in milliseconds. */
    timeoutMs?: number;
}

async function fetchWithTimeout(url: string, config: RequestInit = {}, timeoutMs = API_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...config,
            signal: config.signal || controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

// =============================================================================
// STORAGE DE TOKENS
// =============================================================================

const TOKEN_KEY = 'kargax-access-token';
const REFRESH_KEY = 'kargax-refresh-token';

/**
 * Guarda los tokens en localStorage.
 */
export function saveTokens(accessToken: string, refreshToken: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_KEY, refreshToken);
    }
}

/**
 * Obtiene el access token.
 */
export function getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(TOKEN_KEY);
    }
    return null;
}

/**
 * Obtiene el refresh token.
 */
export function getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(REFRESH_KEY);
    }
    return null;
}

/**
 * Elimina los tokens y datos de sesión (logout).
 * Opcionalmente redirige al login.
 * 
 * @param redirectToLogin - Si es true, redirige a /login después de limpiar
 */
export function clearTokens(redirectToLogin: boolean = false): void {
    if (typeof window !== 'undefined') {
        // Limpiar todos los datos de autenticación
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem('kargax-user');

        // Redirigir al login si se solicita Y no estamos ya en la página de login
        // Esto previene loops infinitos de redirección
        if (redirectToLogin) {
            const currentPath = window.location.pathname;
            const isAuthPage = currentPath === '/login' ||
                currentPath === '/registro' ||
                currentPath === '/verificar-email' ||
                currentPath === '/forgot-password';

            if (!isAuthPage) {
                // Usar timeout para permitir que otros procesos terminen
                setTimeout(() => {
                    window.location.href = '/login';
                }, 100);
            }
        }
    }
}

// =============================================================================
// REQUEST HELPER
// =============================================================================

/**
 * Realiza una request HTTP al backend.
 * 
 * @param endpoint - Endpoint de la API (sin el prefijo)
 * @param options - Opciones de la request
 * @returns Respuesta tipada de la API
 * 
 * @example
 * // GET request
 * const response = await apiRequest<{ user: User }>('/auth/me');
 * 
 * // POST request con body
 * const response = await apiRequest<{ userId: string }>('/auth/register', {
 *   method: 'POST',
 *   body: { email, password, fullName, userType },
 * });
 */
export async function apiRequest<T>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<ApiResponse<T>> {
    const {
        body,
        skipAuth = false,
        retries = 1,
        timeoutMs = API_REQUEST_TIMEOUT_MS,
        headers: customHeaders,
        ...fetchOptions
    } = options;

    // Construir URL completa
    const url = `${API_BASE_URL}${API_PREFIX}${endpoint}`;

    // Construir headers
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...customHeaders,
    };

    // Añadir token de autorización
    if (!skipAuth) {
        const token = getAccessToken();
        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }
    }

    // Construir config de fetch
    const config: RequestInit = {
        ...fetchOptions,
        headers,
        credentials: 'include', // Para cookies HttpOnly
    };

    // Añadir body si existe
    if (body) {
        config.body = JSON.stringify(body);
    }

    // Ejecutar request con retry
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, config, timeoutMs);

            // Parsear respuesta
            const data = await response.json().catch(() => ({
                success: response.ok,
                message: response.statusText,
            })) as ApiResponse<T>;

            // Token expirado - intentar refrescar
            if (response.status === 401 && !skipAuth && attempt === 0) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    // Reintentar con nuevo token
                    const token = getAccessToken();
                    if (token) {
                        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
                    }
                    continue;
                }
            }

            // Respuesta exitosa o error conocido
            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || {
                        code: 'API_ERROR',
                        message: data.message || 'Error en la solicitud',
                    },
                };
            }

            return data;

        } catch (error) {
            lastError = error as Error;

            // Si no es error de red, no reintentar
            if (!(error instanceof TypeError)) {
                break;
            }

            // Esperar antes de reintentar (exponential backoff)
            if (attempt < retries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    // Todos los intentos fallaron
    return {
        success: false,
        error: {
            code: 'NETWORK_ERROR',
            message: lastError?.message || 'No se pudo conectar al servidor',
        },
    };
}

// =============================================================================
// REFRESH TOKEN
// =============================================================================

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresca el access token usando el refresh token.
 * Si falla porque el token expiró, limpia los tokens y redirige al login.
 * Si simplemente no hay token, retorna false sin redirigir.
 */
async function refreshAccessToken(): Promise<boolean> {
    // Evitar múltiples refreshes simultáneos
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        // No hay refresh token - el usuario simplemente no está logueado
        // NO redirigir, solo retornar false
        return false;
    }

    isRefreshing = true;

    refreshPromise = (async () => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) {
                // Refresh token expirado o inválido - redirigir al login
                console.warn('🔐 Sesión expirada. Redirigiendo al login...');
                clearTokens(true);
                return false;
            }

            const data = await response.json() as ApiResponse<{
                accessToken: string;
                refreshToken: string;
            }>;

            if (data.success && data.data) {
                saveTokens(data.data.accessToken, data.data.refreshToken);
                return true;
            }

            // Refresh falló - redirigir al login
            console.warn('🔐 No se pudo renovar la sesión. Redirigiendo al login...');
            clearTokens(true);
            return false;

        } catch (error) {
            // Error de red u otro - redirigir al login
            console.error('🔐 Error al renovar sesión:', error);
            clearTokens(true);
            return false;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// =============================================================================
// API METHODS
// =============================================================================

/**
 * Métodos de API organizados por módulo.
 */
const _apiBase = {
    // ===========================================================================
    // AUTH
    // ===========================================================================
    auth: {
        /**
         * Registrar nuevo usuario.
         */
        register: (data: {
            email: string;
            password: string;
            fullName: string;
            userType: 'trucker' | 'business';
            phone?: string;
            documentType?: string;
            documentNumber?: string;
            companyName?: string;
            nit?: string;
            industry?: string;
            address?: string;
            city?: string;
            department?: string;
            acceptTerms: boolean;
            recaptchaToken: string;
        }) => apiRequest<{ userId: string }>('/auth/register', {
            method: 'POST',
            body: data,
            skipAuth: true,
        }),

        /**
         * Iniciar sesión.
         */
        login: (email: string, password: string) =>
            apiRequest<{
                user: {
                    id: string;
                    email: string;
                    fullName: string;
                    userType: 'trucker' | 'business' | 'admin';
                };
                accessToken: string;
                refreshToken: string;
            }>('/auth/login', {
                method: 'POST',
                body: { email, password },
                skipAuth: true,
            }),

        /**
         * Cerrar sesión.
         */
        logout: () => apiRequest('/auth/logout', {
            method: 'POST',
        }),

        /**
         * Refrescar tokens.
         */
        refresh: (refreshToken: string) =>
            apiRequest<{
                accessToken: string;
                refreshToken: string;
            }>('/auth/refresh', {
                method: 'POST',
                body: { refreshToken },
                skipAuth: true,
            }),

        /**
         * Obtener perfil del usuario.
         */
        getMe: () => apiRequest<{
            user: {
                id: string;
                email: string;
                fullName: string;
                phone: string | null;
                avatarUrl: string | null;
                userType: 'trucker' | 'business' | 'admin';
                isVerified: boolean;
                createdAt: string;
            };
        }>('/auth/me'),

        /**
         * Verificar si está autenticado.
         */
        check: () => apiRequest<{
            authenticated: boolean;
            userId: string;
            email: string;
            userType: string;
        }>('/auth/check'),

        /**
         * Verificar si email existe.
         */
        checkEmail: (email: string) =>
            apiRequest<{ exists: boolean }>('/auth/check-email', {
                method: 'POST',
                body: { email },
                skipAuth: true,
            }),

        /**
         * Solicitar recuperación de contraseña.
         */
        forgotPassword: (email: string) =>
            apiRequest('/auth/forgot-password', {
                method: 'POST',
                body: { email },
                skipAuth: true,
            }),
    },

    // ===========================================================================
    // HEALTH
    // ===========================================================================
    health: {
        /**
         * Verificar estado del servidor.
         */
        check: () => fetchWithTimeout(`${API_BASE_URL}${API_PREFIX}/health`).then((r) => r.json()),
    },

    // ===========================================================================
    // OFFERS (Cargo Offers Module)
    // ===========================================================================
    offers: {
        /**
         * Create a new cargo offer (business only).
         */
        create: (data: {
            cargoType: string;
            cargoDescription: string;
            weightKg: number;
            dimensionLength?: number;
            dimensionWidth?: number;
            dimensionHeight?: number;
            quantity: number;
            temperatureMin?: number;
            temperatureMax?: number;
            specialRequirements?: string;
            originDepartment: string;
            originCity: string;
            originAddress: string;
            originLatitude?: number | null;
            originLongitude?: number | null;
            destinationDepartment: string;
            destinationCity: string;
            destinationAddress: string;
            destinationLatitude?: number | null;
            destinationLongitude?: number | null;
            pickupDate: string;
            pickupTimeStart: string;
            pickupTimeEnd: string;
            deliveryDate: string;
            deliveryTimeStart: string;
            deliveryTimeEnd: string;
            totalAmount: number;
            ratePerKm?: number;
            paymentMethod: string;
            paymentSchedule: string;
            additionalTerms?: string;
            vehicleType: string;
            minExperienceYears: number;
            requiredLicenses?: string[];
            requiredCertifications?: string[];
            insuranceRequired: boolean;
            additionalRequirements?: string;
            publishImmediately?: boolean;
            manifestItems?: unknown[];
            pickupContactName?: string;
            pickupContactPhone?: string;
            deliveryContactName?: string;
            deliveryContactPhone?: string;
            warehouseFlowMode?: string;
            originWarehouseId?: string;
            destinationWarehouseId?: string;
            originDockId?: string;
            destinationDockId?: string;
            assignmentMode?: 'public' | 'private';
            privateFleetTruckerId?: string;
            compensationMode?: string;
            expensesReleasePolicy?: string;
            freightPaymentAmount?: number;
            expenseAllowanceAmount?: number;
            privateFleetNotes?: string;
            countryCode?: string;
            currencyCode?: string;
            photos?: string[];
        }) => apiRequest<{ id: string; status: string }>('/offers', {
            method: 'POST',
            body: data,
        }),

        /**
         * Search and list offers with filters.
         */
        search: (params?: {
            page?: number;
            limit?: number;
            sortBy?: 'publishedAt' | 'totalAmount' | 'pickupDate' | 'createdAt';
            sortOrder?: 'asc' | 'desc';
            status?: 'draft' | 'active' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
            originDepartment?: string;
            originCity?: string;
            destinationDepartment?: string;
            destinationCity?: string;
            cargoType?: string;
            vehicleType?: string;
            pickupDateFrom?: string;
            pickupDateTo?: string;
            amountMin?: number;
            amountMax?: number;
            search?: string;
            businessId?: string;
        }) => {
            const queryParams = new URLSearchParams();
            if (params) {
                Object.entries(params).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        queryParams.append(key, String(value));
                    }
                });
            }
            const queryString = queryParams.toString();
            return apiRequest<{
                data: Array<{
                    id: string;
                    cargoType: string;
                    originCity: string;
                    destinationCity: string;
                    pickupDate: string;
                    totalAmount: number;
                    vehicleType: string;
                    status: string;
                    applicationsCount: number;
                    companyName: string | null;
                    publishedAt: string | null;
                }>;
                meta: {
                    page: number;
                    limit: number;
                    total: number;
                    totalPages: number;
                    hasNext: boolean;
                    hasPrev: boolean;
                };
            }>(`/offers${queryString ? `?${queryString}` : ''}`);
        },

        /**
         * Get my offers (business only).
         */
        getMyOffers: (params?: { page?: number; limit?: number; status?: string }) => {
            const queryParams = new URLSearchParams();
            if (params) {
                Object.entries(params).forEach(([key, value]) => {
                    if (value !== undefined) queryParams.append(key, String(value));
                });
            }
            const queryString = queryParams.toString();
            return apiRequest<any>(`/offers/my-offers${queryString ? `?${queryString}` : ''}`);
        },

        /**
         * Get single offer details.
         */
        getById: (id: string) => apiRequest<any>(`/offers/${id}`),

        /**
         * Update an offer (business only, owner).
         */
        update: (id: string, data: Partial<{
            cargoType: string;
            cargoDescription: string;
            weightKg: number;
            totalAmount: number;
            // ... other fields same as create
        }>) => apiRequest<{ id: string; updated: boolean }>(`/offers/${id}`, {
            method: 'PUT',
            body: data,
        }),

        /**
         * Delete/cancel an offer (business only, owner).
         */
        delete: (id: string) => apiRequest<{ deleted: boolean }>(`/offers/${id}`, {
            method: 'DELETE',
        }),

        /**
         * Publish a draft offer (business only).
         */
        publish: (id: string) => apiRequest<{ published: boolean }>(`/offers/${id}/publish`, {
            method: 'POST',
        }),

        /**
         * Apply to an offer (trucker only).
         */
        apply: (offerId: string, data?: {
            proposedAmount?: number;
            message?: string;
            estimatedPickup?: string;
        }) => apiRequest<{ applicationId: string }>(`/offers/${offerId}/apply`, {
            method: 'POST',
            body: data || {},
        }),

        /**
         * Get applications for an offer (business only, owner).
         */
        getApplications: (offerId: string) => apiRequest<Array<{
            id: string;
            offerId: string;
            truckerId: string;
            status: 'pending' | 'accepted' | 'rejected';
            proposedAmount: number | null;
            message: string | null;
            truckerName: string;
            truckerEmail: string;
            truckerPhone: string | null;
            yearsExperience: number | null;
            createdAt: string;
        }>>(`/offers/${offerId}/applications`),

        /**
         * Respond to an application (business only).
         */
        respondToApplication: (offerId: string, applicationId: string, data: {
            action: 'accepted' | 'rejected';
            message?: string;
        }) => apiRequest<{ responded: boolean }>(`/offers/${offerId}/applications/${applicationId}`, {
            method: 'PUT',
            body: data,
        }),

        /**
         * Get my applications as a trucker.
         */
        getMyApplications: () => apiRequest<{
            data: Array<{
                id: string;
                offerId: string;
                status: string;
                proposedAmount: number | null;
                businessResponse: string | null;
                offer: {
                    cargoType: string;
                    originCity: string;
                    destinationCity: string;
                    pickupDate: string;
                    totalAmount: number;
                    status: string;
                    companyName: string | null;
                };
            }>;
        }>('/offers/my-applications'),

        /**
         * Record a view of an offer (for analytics).
         */
        recordView: (offerId: string) => apiRequest<{ recorded: boolean }>(`/offers/${offerId}/view`, {
            method: 'POST',
        }),

        /**
         * Get who viewed an offer (business only, owner).
         */
        getOfferViews: (offerId: string) => apiRequest<{
            views: Array<{
                viewerId: string;
                viewerName: string;
                viewerEmail: string;
                viewerType: string;
                viewCount: number;
                firstViewedAt: string;
                lastViewedAt: string;
            }>;
            totalViews: number;
            uniqueViewers: number;
        }>(`/offers/${offerId}/views`),

        /**
         * Get view statistics for an offer.
         */
        getViewStats: (offerId: string) => apiRequest<{
            totalViews: number;
            uniqueViewers: number;
            viewsByType: Record<string, number>;
            recentViewers: number;
        }>(`/offers/${offerId}/view-stats`),

        /**
         * Mark an offer as completed (business only).
         */
        markAsCompleted: (offerId: string) => apiRequest<{ completed: boolean }>(`/offers/${offerId}/complete`, {
            method: 'POST',
        }),
    },

    // =========================================================================
    // REVIEWS API
    // =========================================================================

    reviews: {
        /**
         * Create a new review for a completed offer.
         */
        create: (data: {
            offerId: string;
            revieweeId: string;
            rating: number;
            communicationRating?: number;
            punctualityRating?: number;
            professionalismRating?: number;
            cargoCareRating?: number;
            comment?: string;
        }) => apiRequest<{ id: string; created: boolean }>('/reviews', {
            method: 'POST',
            body: data,
        }),

        /**
         * Get reviews I have written.
         */
        getMyReviews: () => apiRequest<{
            data: Array<{
                id: string;
                offerId: string;
                revieweeId: string;
                rating: number;
                comment: string | null;
                createdAt: string;
            }>;
        }>('/reviews/my-reviews'),

        /**
         * Get my rating statistics.
         */
        getMyRatings: () => apiRequest<{
            stats: {
                averageRating: number;
                totalReviews: number;
                distribution: Record<number, number>;
                categoryAverages: {
                    communication: number | null;
                    punctuality: number | null;
                    professionalism: number | null;
                    cargoCare: number | null;
                };
            };
            reviews: Array<{
                id: string;
                rating: number;
                comment: string | null;
                reviewerName: string;
                createdAt: string;
            }>;
        }>('/reviews/my-ratings'),

        /**
         * Get reviews for a user.
         */
        getUserReviews: (userId: string, params?: { page?: number; limit?: number; rating?: number }) =>
            apiRequest<{
                data: Array<{
                    id: string;
                    rating: number;
                    comment: string | null;
                    response: string | null;
                    reviewerName: string;
                    offerTitle: string;
                    createdAt: string;
                }>;
                meta: {
                    page: number;
                    limit: number;
                    total: number;
                    totalPages: number;
                };
            }>(`/reviews/user/${userId}${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),

        /**
         * Get rating stats for a user.
         */
        getUserStats: (userId: string) => apiRequest<{
            averageRating: number;
            totalReviews: number;
            distribution: Record<number, number>;
            categoryAverages: {
                communication: number | null;
                punctuality: number | null;
                professionalism: number | null;
                cargoCare: number | null;
            };
        }>(`/reviews/user/${userId}/stats`),

        /**
         * Respond to a review.
         */
        respond: (reviewId: string, response: string) =>
            apiRequest<{ responded: boolean }>(`/reviews/${reviewId}/respond`, {
                method: 'PUT',
                body: { response },
            }),

        /**
         * Check if can review an offer.
         */
        canReview: (offerId: string) => apiRequest<{
            canReview: boolean;
            reason?: string;
        }>(`/reviews/can-review/${offerId}`),
    },

    // =========================================================================
    // NOTIFICATIONS API
    // =========================================================================

    notifications: {
        /**
         * Get my notifications.
         */
        getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
            apiRequest<{
                data: Array<{
                    id: string;
                    type: string;
                    title: string;
                    message: string;
                    referenceType: string | null;
                    referenceId: string | null;
                    isRead: boolean;
                    createdAt: string;
                }>;
                meta: {
                    page: number;
                    limit: number;
                    total: number;
                    totalPages: number;
                };
                unreadCount: number;
            }>(`/notifications${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),

        /**
         * Get unread count.
         */
        getUnreadCount: () => apiRequest<{ count: number }>('/notifications/unread-count'),

        /**
         * Mark notification as read.
         */
        markAsRead: (id: string) => apiRequest<{ success: boolean }>(`/notifications/${id}/read`, {
            method: 'POST',
        }),

        /**
         * Mark all as read.
         */
        markAllAsRead: () => apiRequest<{ count: number }>('/notifications/read-all', {
            method: 'POST',
        }),

        /**
         * Delete notification.
         */
        delete: (id: string) => apiRequest<{ deleted: boolean }>(`/notifications/${id}`, {
            method: 'DELETE',
        }),
    },

    // =========================================================================
    // MESSAGES API
    // =========================================================================

    messages: {
        /**
         * Get my conversations.
         */
        getConversations: () => apiRequest<{
            data: Array<{
                id: string;
                otherParticipantName: string;
                otherParticipantEmail: string;
                lastMessagePreview: string | null;
                lastMessageAt: string | null;
                unreadCount: number;
                offerTitle: string | null;
            }>;
        }>('/messages/conversations'),

        /**
         * Get messages in a conversation.
         */
        getMessages: (conversationId: string, params?: { page?: number; limit?: number }) =>
            apiRequest<{
                data: Array<{
                    id: string;
                    senderId: string;
                    senderName: string;
                    content: string;
                    isRead: boolean;
                    messageType: string;
                    createdAt: string;
                }>;
                meta: {
                    page: number;
                    limit: number;
                    total: number;
                };
            }>(`/messages/conversations/${conversationId}${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),

        /**
         * Send a message.
         */
        send: (data: {
            recipientId: string;
            content: string;
            offerId?: string;
        }) => apiRequest<{ id: string; conversationId: string }>('/messages', {
            method: 'POST',
            body: data,
        }),

        /**
         * Mark conversation as read.
         */
        markAsRead: (conversationId: string) =>
            apiRequest<{ count: number }>(`/messages/conversations/${conversationId}/read`, {
                method: 'POST',
            }),

        /**
         * Get total unread count.
         */
        getUnreadCount: () => apiRequest<{ count: number }>('/messages/unread-count'),
    },
};

// =============================================================================
// OVERRIDE: Use Supabase for offers and messages (migrated from NestJS backend)
// =============================================================================
// This replaces api.offers and api.messages with supabaseApi versions
// All offer and message operations now go directly to Supabase
const api = {
    ..._apiBase,
    offers: supabaseApi.offers,
    messages: supabaseApi.messages,
};

export { api };
export default api;


