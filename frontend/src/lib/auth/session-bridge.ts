import type { Session } from '@supabase/supabase-js';

/**
 * Deprecated no-op.
 *
 * Before the Supabase SSR migration this synchronized the current access token
 * into the custom `kargax-session` cookie. That made server auth depend on a
 * static JWT that could expire before the cookie did.
 */
export async function syncSessionBridge(_session: Session | null) {
    void _session;
    return;
}

/**
 * Deprecated no-op.
 * Supabase SSR cookies are cleared by supabase.auth.signOut().
 */
export async function clearSessionBridge() {
    return;
}
