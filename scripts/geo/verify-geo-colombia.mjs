#!/usr/bin/env node
import { createAdminClient } from './_supabase-loader.mjs';

const EXPECTED_DEPARTMENTS = Number(process.env.GEO_EXPECTED_DEPARTMENTS || 33);
const MIN_MUNICIPALITIES = Number(process.env.GEO_MIN_MUNICIPALITIES || 1100);
const STRICT_MUNICIPALITIES = process.env.GEO_EXPECTED_MUNICIPALITIES ? Number(process.env.GEO_EXPECTED_MUNICIPALITIES) : null;

function fail(message) {
  console.error(`[geo:verify] FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[geo:verify] OK: ${message}`);
}

function duplicatesBy(rows, key) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    const value = row[key];
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

async function fetchAllByCountry(supabase, table, columns) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('country_code', 'CO')
      .range(from, to);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function main() {
  const supabase = createAdminClient();

  const departments = await fetchAllByCountry(supabase, 'geo_departments', 'id, divipola_code, name, normalized_name, is_active');
  const municipalities = await fetchAllByCountry(supabase, 'geo_municipalities', 'id, department_id, divipola_code, name, normalized_name, is_active');

  const activeDepartments = (departments || []).filter((row) => row.is_active);
  const activeMunicipalities = (municipalities || []).filter((row) => row.is_active);

  if (activeDepartments.length === EXPECTED_DEPARTMENTS) pass(`departamentos activos = ${activeDepartments.length}`);
  else fail(`departamentos activos = ${activeDepartments.length}; esperado ${EXPECTED_DEPARTMENTS}`);

  if (STRICT_MUNICIPALITIES !== null) {
    if (activeMunicipalities.length === STRICT_MUNICIPALITIES) pass(`municipios/áreas activos = ${activeMunicipalities.length}`);
    else fail(`municipios/áreas activos = ${activeMunicipalities.length}; esperado ${STRICT_MUNICIPALITIES}`);
  } else if (activeMunicipalities.length >= MIN_MUNICIPALITIES) {
    pass(`municipios/áreas activos >= ${MIN_MUNICIPALITIES} (${activeMunicipalities.length})`);
  } else {
    fail(`municipios/áreas activos = ${activeMunicipalities.length}; mínimo ${MIN_MUNICIPALITIES}`);
  }

  const departmentIds = new Set(activeDepartments.map((row) => row.id));
  const orphanMunicipalities = activeMunicipalities.filter((row) => !departmentIds.has(row.department_id));
  if (orphanMunicipalities.length === 0) pass('cada municipio pertenece a un departamento activo');
  else fail(`${orphanMunicipalities.length} municipios no tienen departamento activo`);

  const duplicateDepartmentCodes = duplicatesBy(activeDepartments, 'divipola_code');
  const duplicateMunicipalityCodes = duplicatesBy(activeMunicipalities, 'divipola_code');
  if (duplicateDepartmentCodes.length === 0) pass('sin departamentos duplicados por DIVIPOLA');
  else fail(`departamentos DIVIPOLA duplicados: ${duplicateDepartmentCodes.join(', ')}`);
  if (duplicateMunicipalityCodes.length === 0) pass('sin municipios duplicados por DIVIPOLA');
  else fail(`municipios DIVIPOLA duplicados: ${duplicateMunicipalityCodes.slice(0, 20).join(', ')}`);

  const { data: versionRows, error: versionError } = await supabase
    .from('geo_seed_versions')
    .select('source_name, source_checked_at, source_version, checksum, row_counts')
    .eq('source_name', 'DANE_DIVIPOLA_COLOMBIA')
    .order('created_at', { ascending: false })
    .limit(1);
  if (versionError) throw new Error(versionError.message);

  if (versionRows?.length) pass(`seed versionado: ${versionRows[0].source_version} (${versionRows[0].checksum})`);
  else fail('no existe registro en geo_seed_versions');

  if (process.exitCode) process.exit(process.exitCode);
}

main().catch((error) => {
  console.error('[geo:verify] ERROR:', error.message);
  process.exit(1);
});
