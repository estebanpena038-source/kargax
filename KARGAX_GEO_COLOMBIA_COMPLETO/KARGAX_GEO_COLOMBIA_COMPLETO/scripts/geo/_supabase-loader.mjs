import path from 'node:path';
import { createRequire } from 'node:module';

export function loadSupabaseClient() {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), 'frontend'),
    path.resolve(process.cwd(), '..', 'frontend'),
  ];

  for (const base of candidates) {
    try {
      const requireFromBase = createRequire(path.join(base, 'package.json'));
      return requireFromBase('@supabase/supabase-js');
    } catch {
      // Try next location.
    }
  }

  throw new Error('No se encontró @supabase/supabase-js. Ejecuta npm install en frontend y corre el script desde frontend o con npm --prefix frontend run <script>.');
}

export function createAdminClient() {
  const { createClient } = loadSupabaseClient();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
