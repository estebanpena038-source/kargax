import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

type SearchParamsLike = {
    get(name: string): string | null;
    toString(): string;
} | null | undefined;

const EMAIL_OTP_TYPES = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']);

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
    'token_hash',
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

function resolveEmailOtpType(value: string | null) {
    if (!value || !EMAIL_OTP_TYPES.has(value)) {
        return null;
    }

    return value as EmailOtpType;
}

function getEmailLinkErrorMessage(error: Error) {
    const message = error.message.toLowerCase();

    if (message.includes('expired') || message.includes('otp expired')) {
        return 'El enlace ya vencio. Reenvia la verificacion y abre el correo mas reciente.';
    }

    if (
        message.includes('invalid token')
        || message.includes('token has expired')
        || message.includes('otp')
    ) {
        return 'No pudimos validar este enlace. Puede estar vencido o ya haber sido usado. Reenvia la verificacion e intenta con el correo mas reciente.';
    }

    return error.message || 'No pudimos validar este enlace. Reenvia la verificacion e intenta de nuevo.';
}

function hasAuthCredentials(searchParams: SearchParamsLike, hashParams: URLSearchParams) {
    return Boolean(
        getAuthParam(searchParams, hashParams, 'code')
        || getAuthParam(searchParams, hashParams, 'access_token')
        || getAuthParam(searchParams, hashParams, 'refresh_token')
        || getAuthParam(searchParams, hashParams, 'token_hash')
    );
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

export async function establishSessionFromAuthUrl(searchParams: SearchParamsLike): Promise<Session> {
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
    const type = resolveEmailOtpType(getAuthParam(searchParams, hashParams, 'type'));

    if (tokenHash) {
        if (!type) {
            throw new Error('El enlace no trae el tipo de verificacion. Reenvia el correo e intenta de nuevo.');
        }

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
        });

        if (verifyError) {
            throw new Error(getEmailLinkErrorMessage(verifyError));
        }

        if (data.session) {
            scrubAuthParamsFromBrowserUrl();
            return data.session;
        }

        const existingSession = await waitForSession(2);
        if (existingSession) {
            scrubAuthParamsFromBrowserUrl();
            return existingSession;
        }
    }

    if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
            const existingSession = await waitForSession(2);
            if (existingSession) {
                scrubAuthParamsFromBrowserUrl();
                return existingSession;
            }

            const message = exchangeError.message.toLowerCase();
            if (message.includes('code verifier') || message.includes('pkce')) {
                throw new Error(
                    'Este enlace usa un flujo anterior que depende del navegador donde se solicito. Reenvia la verificacion y abre el correo mas reciente.'
                );
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
        throw new Error('El enlace de recuperacion no trae credenciales validas. Solicita un enlace nuevo e intenta otra vez.');
    }

    if (type && type !== 'recovery') {
        throw new Error('Este enlace no corresponde a recuperacion de contrasena.');
    }

    return establishSessionFromAuthUrl(searchParams);
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
