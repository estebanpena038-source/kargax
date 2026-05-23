import { createClient } from '@supabase/supabase-js';

import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/auth/session-constants';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';

function getBearerToken(request: Request) {
    const authorizationHeader = request.headers.get('authorization') || '';

    if (!authorizationHeader.startsWith('Bearer ')) {
        return null;
    }

    return authorizationHeader.slice('Bearer '.length).trim() || null;
}

function getServerSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase server credentials are not configured');
    }

    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const requestId = getRequestId(request);
    const accessToken = getBearerToken(request);

    if (!accessToken) {
        return apiError('Missing Bearer token', {
            status: 400,
            code: 'MISSING_ACCESS_TOKEN',
            requestId,
        });
    }

    try {
        const supabase = getServerSupabaseClient();
        const { data, error } = await supabase.auth.getUser(accessToken);

        if (error || !data.user) {
            return apiError('Invalid or expired session token', {
                status: 401,
                code: 'UNAUTHORIZED',
                requestId,
                details: error?.message,
            });
        }

        const response = apiSuccess(
            {
                userId: data.user.id,
                email: data.user.email || null,
                sessionMode: 'httpOnly-cookie-bridge',
            },
            {
                code: 'SESSION_SYNCED',
                requestId,
                meta: {
                    cookieName: SESSION_COOKIE_NAME,
                },
            }
        );

        response.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: accessToken,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
        });

        return response;
    } catch (error) {
        return apiError('Failed to establish secure session bridge', {
            status: 503,
            code: 'SESSION_BRIDGE_UNAVAILABLE',
            requestId,
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

export async function DELETE(request: Request) {
    const requestId = getRequestId(request);

    const response = apiSuccess(
        { cleared: true },
        {
            code: 'SESSION_CLEARED',
            requestId,
            meta: {
                cookieName: SESSION_COOKIE_NAME,
            },
        }
    );

    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: '',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
    });

    return response;
}
