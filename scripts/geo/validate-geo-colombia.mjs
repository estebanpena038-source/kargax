#!/usr/bin/env node
import { createAdminClient } from './_supabase-loader.mjs';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] || '';
  return process.env[`GEO_${name.toUpperCase()}`] || '';
}

async function validateOne(supabase, departmentId, municipalityId, localZoneId = null) {
  const { data, error } = await supabase.rpc('geo_validate_location', {
    p_department_id: departmentId,
    p_municipality_id: municipalityId,
    p_local_zone_id: localZoneId,
  });

  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] : data;
}

async function fetchActiveMunicipalities(supabase) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('geo_municipalities')
      .select('id, department_id')
      .eq('country_code', 'CO')
      .eq('is_active', true)
      .range(from, to);

    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function validateAll(supabase) {
  const municipalities = await fetchActiveMunicipalities(supabase);

  for (const municipality of municipalities) {
    const result = await validateOne(supabase, municipality.department_id, municipality.id, null);
    if (!result?.is_valid) {
      throw new Error(`Municipio inválido ${municipality.id}: ${result?.error_code || 'UNKNOWN'}`);
    }
  }

  console.log(`[geo:validate] OK: ${municipalities.length} municipios validados contra su departamento.`);
}

async function main() {
  const supabase = createAdminClient();
  const departmentId = arg('department-id');
  const municipalityId = arg('municipality-id');
  const localZoneId = arg('local-zone-id') || null;

  if (!departmentId && !municipalityId) {
    await validateAll(supabase);
    return;
  }

  const result = await validateOne(supabase, departmentId, municipalityId, localZoneId);
  console.log(JSON.stringify(result, null, 2));
  if (!result?.is_valid) process.exit(1);
}

main().catch((error) => {
  console.error('[geo:validate] ERROR:', error.message);
  process.exit(1);
});
