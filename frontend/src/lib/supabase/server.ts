import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

function getSupabaseServerEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase URL and anon key are required for server auth');
    }

    return { supabaseUrl, supabaseAnonKey };
}

export async function createClient() {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseServerEnv();
    const cookieStore = await cookies();

    return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Server Components cannot write cookies. The proxy refresh path
                    // is responsible for normal request/response cookie updates.
                }
            },
        },
    });
}
