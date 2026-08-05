import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kutgkfrjpujvtnimjnvo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGdrZnJqcHVqdnRuaW1qbnZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxNzg4MiwiZXhwIjoyMDgzOTkzODgyfQ.vngh1SBD-QBJkyF5JPpCY8ZJwwfl_Fw-zQjoZB1J5PM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data: profile } = await supabase.from('user_profiles').select('*').limit(1);
  console.log('User Profile Schema Keys:', Object.keys(profile?.[0] || {}));
}

main();
