import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

type SearchParamsLike = {
    get(name: string): string | null;
    toString(): string;
} | null | undefined;

type EstablishSessionOptions = {
    allowExistingSessionFallback?: boolean;
};

const RECOVERY_SESSION_MARKER_KEY = 'kargax:auth:recovery-session';
const RECOVERY_SESSION_MARKER_MAX_AGE_MS = 15 * 60 * 1000;

const AUTH_PARAM_KEYS = [
    'access_token',
    'code',
    'error',
    'error_code',
    'error_description',
    'expires_at',
    'expires_in',
    'provider_refresh_token',
    'provider_token',
    'refresh_token',
    'sb',
    'token',
    'token_hash',
    'token_type',
    'type',
];

function getHashParams() {
    if (typeof window === 'undefined' || !window.location.hash) {
        return new URLSearchParams();
    }

    return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

function getAuthParam(searchParams: SearchParamsLike, hashParams: URLSearchParams, name: string) {
    return searchParams?.get(name) || hashParams.get(name);
}

function hasAuthCredentials(searchParams: SearchParamsLike, hashParams: URLSearchParams) {
    return Boolean(
        getAuthParam(searchParams, hashParams, 'code')
        || getAuthParam(searchParams, hashParams, 'access_token')
        || getAuthParam(searchParams, hashParams, 'refresh_token')
        || getAuthParam(searchParams, hashParams, 'token_hash')
    );
}

function getRecoveryStorage() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

function rememberRecoverySession(session: Session) {
    const storage = getRecoveryStorage();
    if (!storage) {
        return;
    }

    storage.setItem(
        RECOVERY_SESSION_MARKER_KEY,
        JSON.stringify({
            userId: session.user.id,
            createdAt: Date.now(),
        })
    );
}

export function clearRecoverySessionMarker() {
    getRecoveryStorage()?.removeItem(RECOVERY_SESSION_MARKER_KEY);
}

async function getRecentRecoverySession() {
    const storage = getRecoveryStorage();
    const rawMarker = storage?.getItem(RECOVERY_SESSION_MARKER_KEY);

    if (!rawMarker) {
        return null;
    }

    try {
        const marker = JSON.parse(rawMarker) as { userId?: string; createdAt?: number };
        const isFresh = typeof marker.createdAt === 'number'
            && Date.now() - marker.createdAt <= RECOVERY_SESSION_MARKER_MAX_AGE_MS;

        if (!marker.userId || !isFresh) {
            clearRecoverySessionMarker();
            return null;
        }

        const session = await getCurrentSession();
        if (session?.user.id === marker.userId) {
            return session;
        }
    } catch {
        clearRecoverySessionMarker();
    }

    return null;
}

async function getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        throw error;
    }

    return data.session;
}

async function waitForSession(attempts = 6) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const session = await getCurrentSession();
        if (session) {
            return session;
        }

        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }

    return null;
}

export function getAuthUrlKey(searchParams: SearchParamsLike) {
    const query = searchParams?.toString() || '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    return `${query}#${hash}`;
}

export function scrubAuthParamsFromBrowserUrl() {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    AUTH_PARAM_KEYS.forEach((key) => url.searchParams.delete(key));

    const hashParams = getHashParams();
    AUTH_PARAM_KEYS.forEach((key) => hashParams.delete(key));
    const nextHash = hashParams.toString();
    const nextUrl = `${url.pathname}${url.search}${nextHash ? `#${nextHash}` : ''}`;

    window.history.replaceState(null, '', nextUrl);
}

export async function establishSessionFromAuthUrl(
    searchParams: SearchParamsLike,
    options: EstablishSessionOptions = {}
): Promise<Session> {
    const hashParams = getHashParams();
    const error = getAuthParam(searchParams, hashParams, 'error');
    const errorDescription = getAuthParam(searchParams, hashParams, 'error_description');

    if (error) {
        throw new Error(errorDescription || 'El enlace de acceso no es valido');
    }

    const code = getAuthParam(searchParams, hashParams, 'code');
    const accessToken = getAuthParam(searchParams, hashParams, 'access_token');
    const refreshToken = getAuthParam(searchParams, hashParams, 'refresh_token');
    const tokenHash = getAuthParam(searchParams, hashParams, 'token_hash');
    const type = getAuthParam(searchParams, hashParams, 'type') as EmailOtpType | null;

    if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
            if (options.allowExistingSessionFallback !== false) {
                const existingSession = await waitForSession(2);
                if (existingSession) {
                    scrubAuthParamsFromBrowserUrl();
                    return existingSession;
                }
            }

            throw exchangeError;
        }

        if (data.session) {
            scrubAuthParamsFromBrowserUrl();
            return data.session;
        }
    }

    if (accessToken && refreshToken) {
        const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        if (setSessionError) {
            throw setSessionError;
        }

        if (data.session) {
            scrubAuthParamsFromBrowserUrl();
            return data.session;
        }
    }

    if (tokenHash && type) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
        });

        if (verifyError) {
            throw verifyError;
        }

        if (data.session) {
            scrubAuthParamsFromBrowserUrl();
            return data.session;
        }
    }

    if (options.allowExistingSessionFallback === false) {
        throw new Error('No se pudo crear la sesion desde este enlace. Reenvia el correo e intenta de nuevo.');
    }

    const session = await waitForSession();
    if (!session) {
        throw new Error('No se pudo crear la sesion desde este enlace. Reenvia el correo e intenta de nuevo.');
    }

    scrubAuthParamsFromBrowserUrl();
    return session;
}

export async function establishRecoverySessionFromAuthUrl(searchParams: SearchParamsLike): Promise<Session> {
    const hashParams = getHashParams();
    const type = getAuthParam(searchParams, hashParams, 'type');

    if (!hasAuthCredentials(searchParams, hashParams)) {
        const recentRecoverySession = await getRecentRecoverySession();
        if (recentRecoverySession) {
            return recentRecoverySession;
        }

        throw new Error('No pudimos leer las credenciales del enlace de recuperacion. Abre el enlace completo desde el correo o solicita uno nuevo.');
    }

    if (type && type !== 'recovery') {
        throw new Error('Este enlace no corresponde a recuperacion de contrasena.');
    }

    const session = await establishSessionFromAuthUrl(searchParams, {
        allowExistingSessionFallback: false,
    });
    rememberRecoverySession(session);

    return session;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
