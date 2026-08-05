import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kutgkfrjpujvtnimjnvo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGdrZnJqcHVqdnRuaW1qbnZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxNzg4MiwiZXhwIjoyMDgzOTkzODgyfQ.vngh1SBD-QBJkyF5JPpCY8ZJwwfl_Fw-zQjoZB1J5PM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('Ensuring org invite codes and default channels in production...');

  // 1. Fetch business profiles
  const { data: businesses, error: fetchErr } = await supabase
    .from('business_profiles')
    .select('id, company_name, user_id, org_invite_code');

  if (fetchErr) {
    console.log('Checking profiles or business_profiles table...', fetchErr.message);
  }

  console.log(`Found ${businesses?.length || 0} business profiles.`);

  for (const b of (businesses || [])) {
    let inviteCode = b.org_invite_code;
    if (!inviteCode) {
      const companyClean = (b.company_name || 'KARGAX').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
      const randNum = Math.floor(1000 + Math.random() * 9000).toString();
      inviteCode = `KX-${companyClean || 'KARGAX'}-${randNum}`;

      await supabase
        .from('business_profiles')
        .update({ org_invite_code: inviteCode })
        .eq('id', b.id);
    }
    console.log(`✅ Business "${b.company_name}": Invite Code = ${inviteCode}`);

    // Ensure default channels (#general, #novedades-flota, #alertas)
    const defaultChannels = [
      { title: '#general', type: 'fleet', entity_type: 'fleet' },
      { title: '#novedades-flota', type: 'fleet', entity_type: 'fleet' },
      { title: '#alertas', type: 'system', entity_type: 'support' },
    ];

    for (const ch of defaultChannels) {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('business_id', b.id)
        .eq('title', ch.title)
        .maybeSingle();

      if (!existing) {
        const { data: created } = await supabase
          .from('conversations')
          .insert({
            channel_type: ch.type,
            title: ch.title,
            entity_type: ch.entity_type,
            business_id: b.id,
            is_archived: false,
          })
          .select('id')
          .single();

        if (created && b.user_id) {
          await supabase.from('conversation_participants').insert({
            conversation_id: created.id,
            user_id: b.user_id,
            role: 'owner',
          });
        }
        console.log(`  -> Created channel ${ch.title}`);
      }
    }
  }

  console.log('✅ Slack channels & organization codes initialized successfully!');
}

main();
