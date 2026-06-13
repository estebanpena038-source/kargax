import type { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-constants';
import { apiSuccess, getRequestId } from '@/lib/server/api-response';

export const dynamic = 'force-dynamic';

function clearLegacySessionCookie(response: NextResponse) {
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

export async function POST(request: Request) {
    const requestId = getRequestId(request);
    const response = apiSuccess(
        {
            synced: false,
            deprecated: true,
            sessionMode: 'supabase-ssr-cookies',
        },
        {
            code: 'SESSION_BRIDGE_DEPRECATED',
            requestId,
            meta: {
                cookieName: SESSION_COOKIE_NAME,
            },
        }
    );

    return clearLegacySessionCookie(response);
}

export async function DELETE(request: Request) {
    const requestId = getRequestId(request);
    const response = apiSuccess(
        { cleared: true, deprecated: true },
        {
            code: 'SESSION_CLEARED',
            requestId,
            meta: {
                cookieName: SESSION_COOKIE_NAME,
            },
        }
    );

    return clearLegacySessionCookie(response);
}
