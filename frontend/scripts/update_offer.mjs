import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kutgkfrjpujvtnimjnvo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGdrZnJqcHVqdnRuaW1qbnZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxNzg4MiwiZXhwIjoyMDgzOTkzODgyfQ.vngh1SBD-QBJkyF5JPpCY8ZJwwfl_Fw-zQjoZB1J5PM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('Fetching latest cargo offer...');
  const { data: offers, error: fetchErr } = await supabase
    .from('cargo_offers')
    .select('id, origin_city, origin_address, destination_city, destination_address, created_at, status, cargo_description')
    .order('created_at', { ascending: false })
    .limit(5);

  if (fetchErr) {
    console.error('Error fetching offers:', fetchErr);
    process.exit(1);
  }

  if (!offers || offers.length === 0) {
    console.log('No offers found in cargo_offers table.');
    process.exit(0);
  }

  console.log('Latest 5 offers found:');
  offers.forEach((o, index) => {
    console.log(`[${index}] ID: ${o.id} | Status: ${o.status} | Created: ${o.created_at}`);
    console.log(`    Origin: ${o.origin_city} (${o.origin_address})`);
    console.log(`    Dest:   ${o.destination_city} (${o.destination_address})`);
  });

  const latest = offers[0];
  console.log(`\nUpdating latest offer ID: ${latest.id}...`);

  const { data: updated, error: updateErr } = await supabase
    .from('cargo_offers')
    .update({
      origin_department: 'Cauca',
      origin_city: 'Santander de Quilichao',
      origin_address: 'Carrera 11 #8-83',
      destination_department: 'Cauca',
      destination_city: 'Santander de Quilichao',
      destination_address: 'Carrera 11 #8-83',
    })
    .eq('id', latest.id)
    .select('*')
    .single();

  if (updateErr) {
    console.error('Error updating offer:', updateErr);
    process.exit(1);
  }

  console.log('\n✅ Successfully updated latest offer!');
  console.log(`ID: ${updated.id}`);
  console.log(`Origin: ${updated.origin_department}, ${updated.origin_city} - ${updated.origin_address}`);
  console.log(`Destination: ${updated.destination_department}, ${updated.destination_city} - ${updated.destination_address}`);
}

main();
