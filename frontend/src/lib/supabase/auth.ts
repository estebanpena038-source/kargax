// =============================================================================
// KARGAX - SUPABASE AUTH SERVICE
// Enterprise-Grade Authentication Layer
// Oracle/Amazon Level: Resilient, Scalable, Secure
// =============================================================================

import { supabase } from './client';
import type { AuthError, User, Session } from '@supabase/supabase-js';
import { clearSessionBridge } from '@/lib/auth/session-bridge';
import { buildPublicAppUrl, shouldAllowLocalPublicAppUrl } from '@/lib/platform/public-app-url';

// =============================================================================
// TYPES
// =============================================================================

export type UserType = 'trucker' | 'business' | 'admin' | 'staff';
export type PublicSignUpUserType = 'trucker' | 'business';

export interface SignUpData {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    userType: PublicSignUpUserType;
    corporateInviteCode?: string;
    documentType?: string;
    documentNumber?: string;
    country?: 'CO' | 'EC' | 'PE' | 'BR';
    // Business-specific
    companyName?: string;
    nit?: string;
    industry?: string;
    address?: string;
    city?: string;
    department?: string;
    captchaToken?: string;
}

export interface AuthResult {
    success: boolean;
    error?: string;
    user?: User;
    session?: Session;
    needsEmailConfirmation?: boolean;
}

export interface KargaXUser {
    id: string;
    email: string;
    fullName: string;
    userType: UserType;
    phone?: string | null;
    country?: 'CO' | 'EC' | 'PE' | 'BR';
    avatarUrl?: string | null;
    isVerified: boolean;
    onboardingCompleted?: boolean;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Translate Supabase auth errors to user-friendly Spanish messages
 */
function getErrorMessage(error: AuthError | Error | null): string {
    if (!error) return 'Error desconocido';

    const message = error.message.toLowerCase();

    // Common Supabase Auth errors
    if (message.includes('invalid login credentials')) {
        return 'Correo electrónico o contraseña incorrectos';
    }
    if (message.includes('email not confirmed')) {
        return 'Por favor confirma tu correo electrónico antes de iniciar sesión';
    }
    if (message.includes('user already registered')) {
        return 'Este correo electrónico ya está registrado';
    }
    if (message.includes('password should be at least')) {
        return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (message.includes('rate limit')) {
        return 'Demasiados intentos. Por favor espera unos minutos';
    }
    if (message.includes('network')) {
        return 'Error de conexión. Verifica tu internet';
    }
    if (message.includes('invalid email')) {
        return 'El correo electrónico no es válido';
    }
    if (message.includes('signup is disabled')) {
        return 'El registro está temporalmente deshabilitado';
    }

    // Default
    return error.message || 'Error inesperado. Intenta de nuevo';
}

function getAuthRedirectUrl(path: string): string {
    const allowLocalhost = shouldAllowLocalPublicAppUrl();
    const redirectUrl = buildPublicAppUrl(path, { allowLocalhost });

    if (!redirectUrl) {
        throw new Error('No public app URL is configured for auth redirects');
    }

    return redirectUrl;
}

// =============================================================================
// SIGN UP
// =============================================================================

/**
 * Register a new user with Supabase Auth
 * User metadata is passed to the trigger that creates the profile
 */
export async function signUp(data: SignUpData): Promise<AuthResult> {
    try {
        const { data: authData, error } = await supabase.auth.signUp({
            email: data.email.toLowerCase().trim(),
            password: data.password,
            options: {
                // Metadata passed to database trigger
                data: {
                    full_name: data.fullName.trim(),
                    phone: data.phone || null,
                    user_type: data.userType,
                    document_type: data.documentType || null,
                    document_number: data.documentNumber || null,
                    country_code: data.country || 'CO',
                    // Business-specific
                    company_name: data.companyName || null,
                    nit: data.nit || null,
                    industry: data.industry || null,
                    address: data.address || null,
                    city: data.city || null,
                    department: data.department || null,
                    corporate_invite_code: data.corporateInviteCode?.trim().toUpperCase() || null,
                },
                // Email confirmation redirect URL
                emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
            },
        });

        if (error) {
            console.error('[Auth] SignUp error:', error);
            return {
                success: false,
                error: getErrorMessage(error),
            };
        }

        // Check if email confirmation is required
        const needsEmailConfirmation = !authData.session && !!authData.user;

        return {
            success: true,
            user: authData.user || undefined,
            session: authData.session || undefined,
            needsEmailConfirmation,
        };

    } catch (error) {
        console.error('[Auth] SignUp unexpected error:', error);
        return {
            success: false,
            error: getErrorMessage(error as Error),
        };
    }
}

// =============================================================================
// SIGN IN
// =============================================================================

/**
 * Sign in with email and password
 */
export async function signIn(
    email: string,
    password: string,
    captchaToken?: string
): Promise<AuthResult> {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase().trim(),
            password,
            options: {
                captchaToken,
            },
        });

        if (error) {
            console.error('[Auth] SignIn error:', error);
            return {
                success: false,
                error: getErrorMessage(error),
            };
        }

        return {
            success: true,
            user: data.user,
            session: data.session,
        };

    } catch (error) {
        console.error('[Auth] SignIn unexpected error:', error);
        return {
            success: false,
            error: getErrorMessage(error as Error),
        };
    }
}

// =============================================================================
// SIGN OUT
// =============================================================================

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('[Auth] SignOut error:', error);
            return {
                success: false,
                error: getErrorMessage(error),
            };
        }

        // Clear any local storage data
        if (typeof window !== 'undefined') {
            localStorage.removeItem('kargax-auth');
            localStorage.removeItem('kargax-user');
        }

        return { success: true };

    } catch (error) {
        console.error('[Auth] SignOut unexpected error:', error);
        return {
            success: false,
            error: getErrorMessage(error as Error),
        };
    }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Get the current session
 */
export async function getSession(): Promise<Session | null> {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('[Auth] GetSession error:', error);
            return null;
        }

        return session;
    } catch (error) {
        console.error('[Auth] GetSession unexpected error:', error);
        return null;
    }
}

/**
 * Get the current user
 */
export async function getUser(): Promise<User | null> {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
            console.error('[Auth] GetUser error:', error);
            return null;
        }

        return user;
    } catch (error) {
        console.error('[Auth] GetUser unexpected error:', error);
        return null;
    }
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<Session | null> {
    try {
        const { data: { session }, error } = await supabase.auth.refreshSession();

        if (error) {
            console.error('[Auth] RefreshSession error:', error);
            return null;
        }

        return session;
    } catch (error) {
        console.error('[Auth] RefreshSession unexpected error:', error);
        return null;
    }
}

// =============================================================================
// USER PROFILE
// =============================================================================

// Type for database row (matches our Supabase schema)
interface UserProfileRow {
    id: string;
    email: string;
    full_name: string;
    user_type: string;
    phone: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    is_active: boolean;
    document_type: string | null;
    document_number: string | null;
    country_code: 'CO' | 'EC' | 'PE' | 'BR' | null;
    onboarding_completed: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Get user profile from public.user_profiles table
 */
export async function getUserProfile(userId: string): Promise<KargaXUser | null> {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('[Auth] GetUserProfile error:', error);
            return null;
        }

        // Cast to our expected type
        const profile = data as unknown as UserProfileRow;

        return {
            id: profile.id,
            email: profile.email,
            fullName: profile.full_name,
            userType: profile.user_type as UserType,
            phone: profile.phone,
            country: profile.country_code || 'CO',
            avatarUrl: profile.avatar_url,
            isVerified: profile.is_verified ?? false,
            onboardingCompleted: profile.onboarding_completed ?? false,
        };

    } catch (error) {
        console.error('[Auth] GetUserProfile unexpected error:', error);
        return null;
    }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
    userId: string,
    updates: Partial<{
        fullName: string;
        phone: string;
        avatarUrl: string;
    }>
): Promise<{ success: boolean; error?: string }> {
    try {
        // Build update object with only defined values
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };
        if (updates.fullName !== undefined) updateData.full_name = updates.fullName;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;

        const { error } = await supabase
            .from('user_profiles')
            .update(updateData as never)
            .eq('id', userId);

        if (error) {
            console.error('[Auth] UpdateUserProfile error:', error);
            return {
                success: false,
                error: error.message,
            };
        }

        return { success: true };

    } catch (error) {
        console.error('[Auth] UpdateUserProfile unexpected error:', error);
        return {
            success: false,
            error: 'Error al actualizar perfil',
        };
    }
}

// =============================================================================
// PASSWORD RESET
// =============================================================================

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(
            email.toLowerCase().trim(),
            {
                redirectTo: getAuthRedirectUrl('/auth/reset-password'),
            }
        );

        if (error) {
            console.error('[Auth] ResetPassword error:', error);
            return {
                success: false,
                error: getErrorMessage(error),
            };
        }

        return { success: true };

    } catch (error) {
        console.error('[Auth] ResetPassword unexpected error:', error);
        return {
            success: false,
            error: getErrorMessage(error as Error),
        };
    }
}

/**
 * Update password (after reset)
 */
export async function updatePassword(
    newPassword: string,
    options: { signOutAfterUpdate?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });

        if (error) {
            console.error('[Auth] UpdatePassword error:', error);
            return {
                success: false,
                error: getErrorMessage(error),
            };
        }

        if (options.signOutAfterUpdate) {
            await supabase.auth.signOut({ scope: 'global' });
            await clearSessionBridge();
        }

        return { success: true };

    } catch (error) {
        console.error('[Auth] UpdatePassword unexpected error:', error);
        return {
            success: false,
            error: getErrorMessage(error as Error),
        };
    }
}

// =============================================================================
// AUTH STATE LISTENER
// =============================================================================

/**
 * Subscribe to auth state changes
 * Returns unsubscribe function
 */
export function onAuthStateChange(
    callback: (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY', session: Session | null) => void
) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event as 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY', session);
    });

    return () => {
        subscription.unsubscribe();
    };
}

// =============================================================================
// RESEND CONFIRMATION EMAIL
// =============================================================================

/**
 * Resend email confirmation
 */
export async function resendConfirmationEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.toLowerCase().trim(),
            options: {
                emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
            },
        });

        if (error) {
            console.error('[Auth] ResendConfirmation error:', error);
            return {
                success: false,
                error: getErrorMessage(error),
            };
        }

        return { success: true };

    } catch (error) {
        console.error('[Auth] ResendConfirmation unexpected error:', error);
        return {
            success: false,
            error: getErrorMessage(error as Error),
        };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const supabaseAuth = {
    signUp,
    signIn,
    signOut,
    getSession,
    getUser,
    refreshSession,
    getUserProfile,
    updateUserProfile,
    resetPassword,
    updatePassword,
    onAuthStateChange,
    resendConfirmationEmail,
};

export default supabaseAuth;
