import type { Session } from '@supabase/supabase-js';

const SESSION_BRIDGE_ENDPOINT = '/api/auth/session';
const SESSION_BRIDGE_TIMEOUT_MS = 12000;

async function sendSessionBridgeRequest(
    method: 'POST' | 'DELETE',
    accessToken?: string
) {
    if (typeof window === 'undefined') {
        return;
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SESSION_BRIDGE_TIMEOUT_MS);

    const response = await fetch(SESSION_BRIDGE_ENDPOINT, {
        method,
        headers,
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
    }).finally(() => {
        clearTimeout(timeout);
    });

    if (!response.ok) {
        throw new Error(`Session bridge request failed with status ${response.status}`);
    }
}

export async function syncSessionBridge(session: Session | null) {
    if (!session?.access_token) {
        await clearSessionBridge();
        return;
    }

    try {
        await sendSessionBridgeRequest('POST', session.access_token);
    } catch (error) {
        console.error('[Auth] Failed to sync session bridge:', error);
    }
}

export async function clearSessionBridge() {
    try {
        await sendSessionBridgeRequest('DELETE');
    } catch (error) {
        console.error('[Auth] Failed to clear session bridge:', error);
    }
}
