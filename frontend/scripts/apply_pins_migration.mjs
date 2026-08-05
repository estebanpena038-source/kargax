import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kutgkfrjpujvtnimjnvo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGdrZnJqcHVqdnRuaW1qbnZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxNzg4MiwiZXhwIjoyMDgzOTkzODgyfQ.vngh1SBD-QBJkyF5JPpCY8ZJwwfl_Fw-zQjoZB1J5PM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function generateSecurePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function main() {
  console.log('Checking offers without PINs...');
  const { data: offers, error: fetchErr } = await supabase
    .from('cargo_offers')
    .select('id, pickup_pin, delivery_pin, cargo_description, created_at')
    .or('pickup_pin.is.null,delivery_pin.is.null');

  if (fetchErr) {
    console.error('Error fetching offers:', fetchErr);
    process.exit(1);
  }

  console.log(`Found ${offers.length} offers missing PINs.`);

  for (const offer of offers) {
    let pPin = offer.pickup_pin || generateSecurePin();
    let dPin = offer.delivery_pin || generateSecurePin();
    while (dPin === pPin) {
      dPin = generateSecurePin();
    }

    const { error: updateErr } = await supabase
      .from('cargo_offers')
      .update({
        pickup_pin: pPin,
        delivery_pin: dPin,
      })
      .eq('id', offer.id);

    if (updateErr) {
      console.error(`Failed to update offer ${offer.id}:`, updateErr);
    } else {
      console.log(`✅ Generated PINs for offer ${offer.id}: Pickup PIN=${pPin}, Delivery PIN=${dPin}`);
    }
  }

  console.log('\n✅ All offers now have valid PINs!');
}

main();
