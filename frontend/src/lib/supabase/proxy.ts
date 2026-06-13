import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';

function getSupabaseProxyEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase URL and anon key are required for proxy auth');
    }

    return { supabaseUrl, supabaseAnonKey };
}

export async function updateSession(request: NextRequest) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseProxyEnv();

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => {
                    request.cookies.set(name, value);
                });

                supabaseResponse = NextResponse.next({
                    request,
                });

                cookiesToSet.forEach(({ name, value, options }) => {
                    supabaseResponse.cookies.set(name, value, options);
                });
            },
        },
    });

    const { data, error } = await supabase.auth.getClaims();

    return {
        response: supabaseResponse,
        claims: data?.claims ?? null,
        error,
    };
}
