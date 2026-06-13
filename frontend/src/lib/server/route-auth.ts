import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { apiError, getRequestId } from '@/lib/server/api-response';
import { isStrictProductionEnvironment } from '@/lib/server/runtime-env';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;
type AuthAssuranceLevel = 'aal1' | 'aal2' | null;
const SUPABASE_ADMIN_FETCH_TIMEOUT_MS = 12000;

interface AuthProfile {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    user_type: 'trucker' | 'business' | 'admin' | 'staff';
    country_code?: string | null;
}

interface AuthContext {
    supabaseAdmin: AdminClient;
    authUser: {
        id: string;
        email: string | null;
    };
    token: string;
    assuranceLevel: AuthAssuranceLevel;
    profile: AuthProfile | null;
}

type AuthResult =
    | { context: AuthContext }
    | { response: NextResponse };

interface RequireAuthOptions {
    requireAal2?: boolean;
}

interface RequireInternalApiKeyOptions {
    allowInNonProduction?: boolean;
    code?: string;
}

interface ResolveScopedBusinessIdOptions {
    requestedBusinessId?: string | null;
    resolvedBusinessId?: string | null;
    profile?: Pick<AuthProfile, 'user_type'> | null;
    adminFallbackBusinessId?: string | null;
}

function getEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY') {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is required for server-side routes`);
    }

    return value;
}

async function fetchWithTimeout(
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1] = {}
) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPABASE_ADMIN_FETCH_TIMEOUT_MS);

    try {
        return await fetch(input, {
            ...init,
            signal: init?.signal || controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

export function getSupabaseAdmin(): AdminClient {
    return createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        global: {
            fetch: fetchWithTimeout,
        },
    });
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
    const tokenParts = token.split('.');

    if (tokenParts.length < 2) {
        return null;
    }

    try {
        const base64Payload = tokenParts[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .padEnd(Math.ceil(tokenParts[1].length / 4) * 4, '=');

        const decodedPayload = Buffer.from(base64Payload, 'base64').toString('utf8');
        const parsedPayload = JSON.parse(decodedPayload);

        return parsedPayload && typeof parsedPayload === 'object'
            ? parsedPayload as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
}

function getTokenAssuranceLevel(token: string): AuthAssuranceLevel {
    const jwtPayload = parseJwtPayload(token);
    const assuranceLevel = jwtPayload?.aal;

    return assuranceLevel === 'aal1' || assuranceLevel === 'aal2'
        ? assuranceLevel
        : null;
}

function getAal2RequiredResponse() {
    return apiError('Forbidden - MFA verification required', {
        status: 403,
        code: 'MFA_REQUIRED',
    });
}

function getBearerToken(request: NextRequest) {
    const authHeader = request.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
        const headerToken = authHeader.split(' ')[1]?.trim();
        if (headerToken) {
            return headerToken;
        }
    }

    return null;
}

export function safelyCompareSecrets(providedSecret: string | null | undefined, expectedSecret: string | null | undefined) {
    const provided = providedSecret?.trim();
    const expected = expectedSecret?.trim();

    if (!provided || !expected) {
        return false;
    }

    const providedHash = createHash('sha256').update(provided, 'utf8').digest();
    const expectedHash = createHash('sha256').update(expected, 'utf8').digest();

    return timingSafeEqual(providedHash, expectedHash);
}

export function getInternalApiKeyFromRequest(request: NextRequest) {
    return request.headers.get('x-internal-api-key')?.trim() || null;
}

export function requireInternalApiKeyRoute(
    request: NextRequest,
    options: RequireInternalApiKeyOptions = {}
) {
    const requestId = getRequestId(request);
    const expectedKey = process.env.INTERNAL_API_KEY?.trim();

    if (!expectedKey) {
        if (options.allowInNonProduction && !isStrictProductionEnvironment()) {
            return { verified: true as const };
        }

        return {
            response: apiError('Internal API key is not configured', {
                requestId,
                status: 500,
                code: options.code || 'INTERNAL_API_KEY_MISSING',
            }),
        };
    }

    if (!safelyCompareSecrets(getInternalApiKeyFromRequest(request), expectedKey)) {
        return {
            response: apiError('No autorizado', {
                requestId,
                status: 401,
                code: options.code || 'INTERNAL_API_KEY_INVALID',
            }),
        };
    }

    return { verified: true as const };
}

export function resolveScopedBusinessId({
    requestedBusinessId,
    resolvedBusinessId,
    profile,
    adminFallbackBusinessId,
}: ResolveScopedBusinessIdOptions) {
    const normalizedRequestedBusinessId = requestedBusinessId?.trim() || null;

    if (profile?.user_type === 'admin') {
        const businessId = normalizedRequestedBusinessId || resolvedBusinessId || adminFallbackBusinessId || null;

        return businessId
            ? { businessId }
            : { error: 'businessId is required', status: 400 as const };
    }

    if (!resolvedBusinessId) {
        return { error: 'Business access required', status: 403 as const };
    }

    if (normalizedRequestedBusinessId && normalizedRequestedBusinessId !== resolvedBusinessId) {
        return { error: 'Business access denied', status: 403 as const };
    }

    return { businessId: resolvedBusinessId };
}

export async function requireAuthenticatedRoute(
    request: NextRequest,
    options: RequireAuthOptions = {}
): Promise<AuthResult> {
    const supabaseAdmin = getSupabaseAdmin();
    const bearerToken = getBearerToken(request);
    let token = bearerToken || '';
    let assuranceLevel: AuthAssuranceLevel = bearerToken ? getTokenAssuranceLevel(bearerToken) : null;
    let authUser: AuthContext['authUser'] | null = null;

    if (bearerToken) {
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(bearerToken);

        if (authError || !user) {
            return {
                response: apiError('Unauthorized - Invalid token', {
                    status: 401,
                    code: 'UNAUTHORIZED',
                }),
            };
        }

        authUser = {
            id: user.id,
            email: user.email ?? null,
        };
    } else {
        const supabase = await createServerSupabaseClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return {
                response: apiError('Unauthorized - No active session', {
                    status: 401,
                    code: 'UNAUTHORIZED',
                }),
            };
        }

        const {
            data: { session },
        } = await supabase.auth.getSession();

        token = session?.access_token || '';
        assuranceLevel = token ? getTokenAssuranceLevel(token) : null;
        authUser = {
            id: user.id,
            email: user.email ?? null,
        };
    }

    if (!authUser) {
        return {
            response: apiError('Unauthorized - No active session', {
                status: 401,
                code: 'UNAUTHORIZED',
            }),
        };
    }

    if (options.requireAal2 && assuranceLevel !== 'aal2') {
        return {
            response: getAal2RequiredResponse(),
        };
    }

    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, full_name, phone, user_type, country_code')
        .eq('id', authUser.id)
        .maybeSingle();

    return {
        context: {
            supabaseAdmin,
            authUser,
            token,
            assuranceLevel,
            profile: (profile as AuthProfile | null) ?? null,
        },
    };
}

export async function requireAal2Route(request: NextRequest): Promise<AuthResult> {
    return requireAuthenticatedRoute(request, { requireAal2: true });
}

export async function requireAdminRoute(
    request: NextRequest,
    options: RequireAuthOptions = {}
): Promise<AuthResult> {
    const auth = await requireAuthenticatedRoute(request, {
        requireAal2: options.requireAal2 ?? true,
    });

    if ('response' in auth) {
        return auth;
    }

    if (auth.context.profile?.user_type !== 'admin' || !isFounderCeoAllowed(auth.context)) {
        return {
            response: apiError('Forbidden - CEO access required', {
                status: 403,
                code: 'CEO_ACCESS_REQUIRED',
            }),
        };
    }

    return auth;
}

function parseFounderAllowlist(value?: string | null) {
    return new Set(
        (value || '')
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
    );
}

export function isFounderCeoAllowed(context: Pick<AuthContext, 'authUser' | 'profile'>) {
    const allowedEmails = parseFounderAllowlist(process.env.KARGAX_CEO_EMAILS);
    const allowedUserIds = parseFounderAllowlist(process.env.KARGAX_CEO_USER_IDS);
    const authEmail = context.authUser.email?.trim().toLowerCase() || '';
    const profileEmail = context.profile?.email?.trim().toLowerCase() || '';
    const userId = context.authUser.id.trim().toLowerCase();

    return (
        (authEmail && allowedEmails.has(authEmail))
        || (profileEmail && allowedEmails.has(profileEmail))
        || allowedUserIds.has(userId)
    );
}

export async function requireFounderCeoRoute(
    request: NextRequest,
    options: RequireAuthOptions = {}
): Promise<AuthResult> {
    const auth = await requireAdminRoute(request, options);

    if ('response' in auth) {
        return auth;
    }

    if (!isFounderCeoAllowed(auth.context)) {
        return {
            response: apiError('Forbidden - CEO access required', {
                status: 403,
                code: 'CEO_ACCESS_REQUIRED',
            }),
        };
    }

    return auth;
}

export async function createAdminNotification(
    supabaseAdmin: AdminClient,
    payload: {
        type: string;
        title: string;
        message: string;
        data?: Record<string, unknown>;
    }
) {
    return supabaseAdmin.from('admin_notifications').insert({
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data ?? {},
        read: false,
        processed: false,
    });
}
