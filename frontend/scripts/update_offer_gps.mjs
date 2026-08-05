import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kutgkfrjpujvtnimjnvo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGdrZnJqcHVqdnRuaW1qbnZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxNzg4MiwiZXhwIjoyMDgzOTkzODgyfQ.vngh1SBD-QBJkyF5JPpCY8ZJwwfl_Fw-zQjoZB1J5PM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TARGET_OFFER_ID = '75330b13-ab7a-4f9e-a57b-95d39b51c07e';

// Coordenadas exactas de Santander de Quilichao, Cauca (Carrera 11 #8-83)
const QUILICHAO_LAT = 3.009444;
const QUILICHAO_LNG = -76.484722;

async function main() {
  console.log(`Inspecting offer ID ${TARGET_OFFER_ID}...`);
  const { data: offer, error: fetchErr } = await supabase
    .from('cargo_offers')
    .select('*')
    .eq('id', TARGET_OFFER_ID)
    .single();

  if (fetchErr) {
    console.error('Error fetching offer:', fetchErr);
    process.exit(1);
  }

  console.log('Current Offer Data:');
  console.log(`  Origin: ${offer.origin_department}, ${offer.origin_city} - ${offer.origin_address}`);
  console.log(`  Origin Lat/Lng: ${offer.origin_latitude}, ${offer.origin_longitude}`);
  console.log(`  Dest: ${offer.destination_department}, ${offer.destination_city} - ${offer.destination_address}`);
  console.log(`  Dest Lat/Lng: ${offer.destination_latitude}, ${offer.destination_longitude}`);
  console.log(`  Trucker Origin Lat/Lng: ${offer.trucker_origin_lat}, ${offer.trucker_origin_lng}`);

  console.log('\nUpdating coordinates to Santander de Quilichao, Cauca (3.009444, -76.484722)...');

  const { data: updated, error: updateErr } = await supabase
    .from('cargo_offers')
    .update({
      origin_department: 'Cauca',
      origin_city: 'Santander de Quilichao',
      origin_address: 'Carrera 11 #8-83',
      origin_latitude: QUILICHAO_LAT,
      origin_longitude: QUILICHAO_LNG,

      destination_department: 'Cauca',
      destination_city: 'Santander de Quilichao',
      destination_address: 'Carrera 11 #8-83',
      destination_latitude: QUILICHAO_LAT,
      destination_longitude: QUILICHAO_LNG,

      // Reset any previous failed trucker GPS arrival lock if present
      trucker_origin_lat: null,
      trucker_origin_lng: null,
    })
    .eq('id', TARGET_OFFER_ID)
    .select('*')
    .single();

  if (updateErr) {
    console.error('Error updating offer coordinates:', updateErr);
    process.exit(1);
  }

  console.log('\n✅ Successfully updated GPS coordinates!');
  console.log(`ID: ${updated.id}`);
  console.log(`Origin: ${updated.origin_city} (${updated.origin_address}) -> Lat: ${updated.origin_latitude}, Lng: ${updated.origin_longitude}`);
  console.log(`Destination: ${updated.destination_city} (${updated.destination_address}) -> Lat: ${updated.destination_latitude}, Lng: ${updated.destination_longitude}`);
}

main();
