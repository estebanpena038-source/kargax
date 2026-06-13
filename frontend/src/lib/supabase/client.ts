// =============================================================================
// KargaX - Supabase Browser Client
// =============================================================================

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isProduction = process.env.NODE_ENV === 'production';
const SUPABASE_DEFAULT_FETCH_TIMEOUT_MS = 15000;
const SUPABASE_STORAGE_FETCH_TIMEOUT_MS = 60000;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Supabase credentials not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
}

if (isProduction && (!supabaseUrl || !supabaseAnonKey)) {
    throw new Error('Missing required Supabase public environment variables for production runtime');
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
    const controller = new AbortController();
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
    const timeoutMs = requestUrl.includes('/storage/v1/')
        ? SUPABASE_STORAGE_FETCH_TIMEOUT_MS
        : SUPABASE_DEFAULT_FETCH_TIMEOUT_MS;
    const timeout = setTimeout(
        () => controller.abort(new Error(`Supabase request timeout after ${timeoutMs}ms`)),
        timeoutMs
    );

    try {
        return await fetch(input, {
            ...init,
            signal: init.signal || controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

export const supabase = createBrowserClient<Database>(
    supabaseUrl || 'http://127.0.0.1:54321',
    supabaseAnonKey || 'dev-only-missing-supabase-anon-key',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            // Keep implicit links during this migration. Existing callbacks support
            // code, access_token/refresh_token, and token_hash based email flows.
            flowType: 'implicit',
        },
        global: {
            fetch: fetchWithTimeout,
            headers: {
                'x-app-name': 'KargaX',
                'x-app-version': process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
            },
        },
        db: {
            schema: 'public',
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    }
);

export async function checkSupabaseHealth(): Promise<{
    connected: boolean;
    latency: number;
    error?: string;
}> {
    const startTime = Date.now();

    try {
        const { error } = await supabase.from('_health_check').select('*').limit(1);
        const latency = Date.now() - startTime;

        if (error && !error.message.includes('does not exist')) {
            return { connected: false, latency, error: error.message };
        }

        return { connected: true, latency };
    } catch (err) {
        return {
            connected: false,
            latency: Date.now() - startTime,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}

export async function getSessionWithRetry(maxRetries = 3): Promise<{
    session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
    error: Error | null;
}> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
                    continue;
                }
            }

            return { session: data.session, error: null };
        } catch (err) {
            lastError = err instanceof Error ? err : new Error('Unknown error');
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
        }
    }

    return { session: null, error: lastError };
}

export function subscribeToTable<T extends keyof Database['public']['Tables']>(
    table: T,
    callback: (payload: {
        eventType: 'INSERT' | 'UPDATE' | 'DELETE';
        new: Database['public']['Tables'][T]['Row'] | null;
        old: Database['public']['Tables'][T]['Row'] | null;
    }) => void
) {
    const channel = supabase
        .channel(`public:${table}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: table as string },
            (payload) => {
                callback({
                    eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                    new: payload.new as Database['public']['Tables'][T]['Row'] | null,
                    old: payload.old as Database['public']['Tables'][T]['Row'] | null,
                });
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

export default supabase;
