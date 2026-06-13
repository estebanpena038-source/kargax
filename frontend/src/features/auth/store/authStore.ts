// =============================================================================
// KARGAX FRONTEND - AUTH STORE (Supabase Edition)
// =============================================================================
//
// State management para autenticación usando Zustand + Supabase Auth.
// Enterprise-grade con manejo de errores robusto y persistencia.
//
// CARACTERÍSTICAS:
// 🔐 Login/Registro con Supabase Auth
// 🔄 Auto-refresh de sesión
// 💾 Persistencia automática via Supabase
// 📊 Estado global sincronizado con auth state
// 🔒 Máxima seguridad con RLS
//
// =============================================================================

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import {
    signUp as supabaseSignUp,
    signIn as supabaseSignIn,
    signOut as supabaseSignOut,
    resetPassword as supabaseResetPassword,
    getUserProfile,
    onAuthStateChange,
    type SignUpData,
} from '@/lib/supabase/auth';
import { clearSessionBridge, syncSessionBridge } from '@/lib/auth/session-bridge';
import { useCountryStore } from '@/lib/platform/useUserCountry';

// =============================================================================
// TIPOS
// =============================================================================

/**
 * Usuario autenticado.
 */
interface User {
    id: string;
    email: string;
    fullName: string;
    userType: 'trucker' | 'business' | 'admin' | 'staff';
    avatarUrl?: string | null;
    isVerified?: boolean;
    phone?: string | null;
    country?: 'CO' | 'EC' | 'PE' | 'BR';
    onboardingCompleted?: boolean;
}

/**
 * Datos de registro.
 */
export interface RegisterData {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    userType: 'trucker' | 'business';
    corporateInviteCode?: string;
    documentType?: string;
    documentNumber?: string;
    country?: 'CO' | 'EC' | 'PE' | 'BR';
    companyName?: string;
    nit?: string;
    industry?: string;
    address?: string;
    city?: string;
    department?: string;
    acceptTerms: boolean;
    // recaptchaToken ya no es necesario con Supabase (usa su propio bot protection)
    recaptchaToken?: string;
}

/**
 * Estado del store de autenticación.
 */
interface AuthState {
    // State
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;
    isInitialized: boolean;
    pendingEmailConfirmation: boolean;

    // Actions
    initialize: (force?: boolean) => Promise<void>;
    signIn: (email: string, password: string, captchaToken?: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (data: RegisterData) => Promise<{ success: boolean; error?: string; userId?: string; needsEmailConfirmation?: boolean }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    fetchProfile: () => Promise<void>;
    clearError: () => void;
    setUser: (user: User | null) => void;
}

const CORPORATE_FLEET_AUTO_ACCEPT_PREFIX = 'kargax-corporate-fleet-auto-accept';
const isAuthDebugLoggingEnabled = process.env.NODE_ENV !== 'production';

function authDebugLog(...args: unknown[]) {
    if (isAuthDebugLoggingEnabled) {
        console.log(...args);
    }
}

async function ensureCorporateFleetMembership(user: User | null) {
    if (!user || user.userType !== 'trucker') {
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const inviteCode = session?.user?.user_metadata?.corporate_invite_code;

        if (!session?.access_token || typeof inviteCode !== 'string' || !inviteCode.trim()) {
            return;
        }

        const normalizedInviteCode = inviteCode.trim().toUpperCase();
        const storageKey = `${CORPORATE_FLEET_AUTO_ACCEPT_PREFIX}:${user.id}:${normalizedInviteCode}`;

        if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey) === 'done') {
            return;
        }

        const response = await fetch('/api/business/fleet/accept', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inviteCode: normalizedInviteCode }),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            console.warn('[Auth] Corporate fleet auto-accept rejected:', payload?.error || response.statusText);
            return;
        }

        if (typeof window !== 'undefined') {
            sessionStorage.setItem(storageKey, 'done');
        }
    } catch (error) {
        console.warn('[Auth] Corporate fleet auto-accept failed:', error);
    }
}

function syncCountryPreference(user: User | null) {
    if (user?.country) {
        useCountryStore.getState().setCountry(user.country);
    }
}

// =============================================================================
// STORE
// =============================================================================

export const useAuthStore = create<AuthState>()(
    (set, get) => ({
            // =========================================================================
            // Initial State
            // =========================================================================
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: null,
            isInitialized: false,
            pendingEmailConfirmation: false,

            // =========================================================================
            // Set User - Helper para actualizar usuario
            // =========================================================================
            setUser: (user: User | null) => {
                set({
                    user,
                    isAuthenticated: !!user,
                });
            },

            // =========================================================================
            // Initialize - Verificar si hay sesión existente en Supabase
            // =========================================================================
            initialize: async (force = false) => {
                // Solo inicializar una vez
                if (get().isInitialized && !force) return;

                try {
                    set({ isLoading: true, error: null });

                    // Obtener sesión actual de Supabase
                    const { data: { session }, error } = await supabase.auth.getSession();

                    if (error || !session) {
                        await clearSessionBridge();
                        set({
                            user: null,
                            isAuthenticated: false,
                            isLoading: false,
                            isInitialized: true,
                        });
                        return;
                    }

                    await syncSessionBridge(session);

                    // Obtener perfil del usuario desde la base de datos
                    const profile = await getUserProfile(session.user.id);

                    if (profile) {
                        set({
                            user: {
                                id: profile.id,
                                email: profile.email,
                                fullName: profile.fullName,
                                userType: profile.userType,
                                avatarUrl: profile.avatarUrl,
                                isVerified: profile.isVerified,
                                phone: profile.phone,
                                country: profile.country,
                                onboardingCompleted: profile.onboardingCompleted,
                            },
                            isAuthenticated: true,
                            isInitialized: true,
                        });
                        syncCountryPreference({
                            id: profile.id,
                            email: profile.email,
                            fullName: profile.fullName,
                            userType: profile.userType,
                            country: profile.country,
                        });
                        await ensureCorporateFleetMembership({
                            id: profile.id,
                            email: profile.email,
                            fullName: profile.fullName,
                            userType: profile.userType,
                            avatarUrl: profile.avatarUrl,
                            isVerified: profile.isVerified,
                            phone: profile.phone,
                            country: profile.country,
                            onboardingCompleted: profile.onboardingCompleted,
                        });
                    } else {
                        // Usuario existe en auth pero no tiene perfil aún
                        // (puede pasar si el trigger falló)
                        set({
                            user: {
                                id: session.user.id,
                                email: session.user.email || '',
                                fullName: session.user.user_metadata?.full_name || 'Usuario',
                                userType: session.user.user_metadata?.user_type || 'trucker',
                                country: session.user.user_metadata?.country_code || 'CO',
                                isVerified: !!session.user.email_confirmed_at,
                                onboardingCompleted: false,
                            },
                            isAuthenticated: true,
                            isInitialized: true,
                        });
                        await ensureCorporateFleetMembership({
                            id: session.user.id,
                            email: session.user.email || '',
                            fullName: session.user.user_metadata?.full_name || 'Usuario',
                            userType: session.user.user_metadata?.user_type || 'trucker',
                            country: session.user.user_metadata?.country_code || 'CO',
                            isVerified: !!session.user.email_confirmed_at,
                            onboardingCompleted: false,
                        });
                    }

                } catch (error) {
                    console.error('Auth initialization error:', error);
                    await clearSessionBridge();
                    set({
                        user: null,
                        isAuthenticated: false,
                        isInitialized: true,
                    });
                } finally {
                    set({ isLoading: false });
                }
            },

            // =========================================================================
            // Sign In - Iniciar sesión con Supabase
            // =========================================================================
            signIn: async (email, password, captchaToken) => {
                try {
                    set({ isLoading: true, error: null });

                    const result = await supabaseSignIn(email, password, captchaToken);

                    if (!result.success || !result.user) {
                        set({ error: result.error, isLoading: false });
                        return { success: false, error: result.error };
                    }

                    await syncSessionBridge(result.session || null);

                    // Obtener perfil completo
                    const profile = await getUserProfile(result.user.id);

                    const userData: User = profile || {
                        id: result.user.id,
                        email: result.user.email || '',
                        fullName: result.user.user_metadata?.full_name || 'Usuario',
                        userType: result.user.user_metadata?.user_type || 'trucker',
                        country: result.user.user_metadata?.country_code || 'CO',
                        isVerified: !!result.user.email_confirmed_at,
                    };

                    set({
                        user: userData,
                        isAuthenticated: true,
                        error: null,
                    });
                    syncCountryPreference(userData);
                    await ensureCorporateFleetMembership(userData);

                    return { success: true };

                } catch {
                    const message = 'Error inesperado. Intenta de nuevo.';
                    set({ error: message, isLoading: false });
                    return { success: false, error: message };
                } finally {
                    set({ isLoading: false });
                }
            },

            // =========================================================================
            // Sign Up - Registrar nuevo usuario con Supabase
            // =========================================================================
            signUp: async (data) => {
                try {
                    set({ isLoading: true, error: null, pendingEmailConfirmation: false });

                    const signUpData: SignUpData = {
                        email: data.email,
                        password: data.password,
                        fullName: data.fullName,
                        phone: data.phone,
                        userType: data.userType,
                        corporateInviteCode: data.corporateInviteCode,
                        documentType: data.documentType,
                        documentNumber: data.documentNumber,
                        country: data.country || 'CO',
                        companyName: data.companyName,
                        nit: data.nit,
                        industry: data.industry,
                        address: data.address,
                        city: data.city,
                        department: data.department,
                        captchaToken: data.recaptchaToken,
                    };

                    const result = await supabaseSignUp(signUpData);

                    if (!result.success) {
                        set({ error: result.error, isLoading: false });
                        return { success: false, error: result.error };
                    }

                    // Si requiere confirmación de email
                    if (result.needsEmailConfirmation) {
                        set({
                            pendingEmailConfirmation: true,
                            isLoading: false,
                        });
                        return {
                            success: true,
                            userId: result.user?.id,
                            needsEmailConfirmation: true,
                        };
                    }

                    // Si auto-confirmado (en desarrollo o configuración especial)
                    if (result.user && result.session) {
                        await syncSessionBridge(result.session);
                        const profile = await getUserProfile(result.user.id);
                        const resolvedUser = profile || {
                            id: result.user.id,
                            email: result.user.email || '',
                            fullName: data.fullName,
                            userType: data.userType,
                            country: data.country || 'CO',
                            isVerified: true,
                        };

                        set({
                            user: resolvedUser,
                            isAuthenticated: true,
                        });
                        syncCountryPreference(resolvedUser);
                        await ensureCorporateFleetMembership(resolvedUser);
                    }

                    return {
                        success: true,
                        userId: result.user?.id,
                    };

                } catch {
                    const message = 'Error inesperado. Intenta de nuevo.';
                    set({ error: message, isLoading: false });
                    return { success: false, error: message };
                } finally {
                    set({ isLoading: false });
                }
            },

            // =========================================================================
            // Sign Out - Cerrar sesión con Supabase
            // =========================================================================
            signOut: async () => {
                try {
                    set({ isLoading: true });

                    await supabaseSignOut();
                    await clearSessionBridge();

                } catch (error) {
                    console.error('Sign out error:', error);
                } finally {
                    // Siempre limpiar estado local
                    set({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                        error: null,
                        pendingEmailConfirmation: false,
                    });
                }
            },

            // =========================================================================
            // Reset Password - Solicitar recuperación de contraseña
            // =========================================================================
            resetPassword: async (email) => {
                try {
                    set({ isLoading: true, error: null });

                    const result = await supabaseResetPassword(email);

                    if (!result.success) {
                        set({ error: result.error, isLoading: false });
                        return { success: false, error: result.error };
                    }

                    return { success: true };

                } catch {
                    const message = 'Error inesperado. Intenta de nuevo.';
                    set({ error: message, isLoading: false });
                    return { success: false, error: message };
                } finally {
                    set({ isLoading: false });
                }
            },

            // =========================================================================
            // Fetch Profile - Actualizar datos del usuario desde Supabase
            // =========================================================================
            fetchProfile: async () => {
                const { isAuthenticated, user } = get();
                if (!isAuthenticated || !user) return;

                try {
                    const profile = await getUserProfile(user.id);

                    if (profile) {
                        set({
                            user: {
                                id: profile.id,
                                email: profile.email,
                                fullName: profile.fullName,
                                userType: profile.userType,
                                avatarUrl: profile.avatarUrl,
                                isVerified: profile.isVerified,
                                phone: profile.phone,
                                country: profile.country,
                                onboardingCompleted: profile.onboardingCompleted,
                            },
                        });
                        syncCountryPreference(profile);
                        await ensureCorporateFleetMembership({
                            id: profile.id,
                            email: profile.email,
                            fullName: profile.fullName,
                            userType: profile.userType,
                            avatarUrl: profile.avatarUrl,
                            isVerified: profile.isVerified,
                            phone: profile.phone,
                            country: profile.country,
                            onboardingCompleted: profile.onboardingCompleted,
                        });
                    }
                } catch (error) {
                    console.error('Profile fetch error:', error);
                }
            },

            // =========================================================================
            // Clear Error - Limpiar mensaje de error
            // =========================================================================
            clearError: () => set({ error: null }),
        })
);

// =============================================================================
// AUTH STATE LISTENER
// Setup listener for Supabase auth changes (call in app root)
// =============================================================================

let authListenerInitialized = false;

export function initAuthListener() {
    if (authListenerInitialized) return;
    authListenerInitialized = true;

    onAuthStateChange(async (event, session) => {
        const store = useAuthStore.getState();

        authDebugLog('[Auth] State change:', event);

        switch (event) {
            case 'SIGNED_IN':
            case 'TOKEN_REFRESHED':
                if (session?.user) {
                    await syncSessionBridge(session);
                    const profile = await getUserProfile(session.user.id);
                    const resolvedUser = profile || {
                        id: session.user.id,
                        email: session.user.email || '',
                        fullName: session.user.user_metadata?.full_name || 'Usuario',
                        userType: session.user.user_metadata?.user_type || 'trucker',
                        country: session.user.user_metadata?.country_code || 'CO',
                        isVerified: !!session.user.email_confirmed_at,
                    };
                    store.setUser(resolvedUser);
                    syncCountryPreference(resolvedUser);
                    await ensureCorporateFleetMembership(resolvedUser);
                }
                break;

            case 'SIGNED_OUT':
                await clearSessionBridge();
                store.setUser(null);
                break;

            case 'USER_UPDATED':
                // Re-fetch profile on user update
                if (session?.user) {
                    await syncSessionBridge(session);
                    const profile = await getUserProfile(session.user.id);
                    if (profile) {
                        store.setUser(profile);
                        await ensureCorporateFleetMembership(profile);
                    }
                }
                break;
        }
    });
}

// =============================================================================
// EXPORTS
// =============================================================================

export default useAuthStore;
