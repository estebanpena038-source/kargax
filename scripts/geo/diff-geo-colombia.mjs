#!/usr/bin/env node
import { createAdminClient } from './_supabase-loader.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sourceUrl = process.env.GEO_DIVIPOLA_URL || 'https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=50000';

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return row[key];
  }
  return '';
}

function digits(value) { return String(value || '').replace(/\D/g, ''); }
function depCode(value) { const v = digits(value); return v ? v.padStart(2, '0').slice(-2) : ''; }
function munCode(value, d) {
  const v = digits(value);
  if (!v) return '';
  if (v.length >= 5) return v.padStart(5, '0').slice(-5);
  return `${d}${v.padStart(3, '0')}`;
}

async function fetchSourceCodes() {
  const response = await fetch(sourceUrl, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`No se pudo descargar fuente: ${response.status}`);
  const rows = await response.json();
  const departmentCodes = new Set();
  const municipalityCodes = new Set();

  for (const row of rows) {
    const d = depCode(pick(row, ['c_digo_dane_del_departamento', 'codigo_dane_del_departamento', 'codigo_departamento', 'cod_dpto', 'dpto_ccdgo']));
    const m = munCode(pick(row, ['c_digo_dane_del_municipio', 'codigo_dane_del_municipio', 'codigo_municipio', 'cod_mpio', 'mpio_ccdgo', 'divipola', 'codigo']), d);
    if (d) departmentCodes.add(d);
    if (m) municipalityCodes.add(m);
  }

  return { departmentCodes, municipalityCodes };
}

async function fetchDbCodes(supabase, table) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select('divipola_code')
      .eq('country_code', 'CO')
      .eq('is_active', true)
      .range(from, to);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return new Set(rows.map((row) => row.divipola_code));
}

async function main() {
  const supabase = createAdminClient();
  const [{ departmentCodes, municipalityCodes }, dbDepartmentCodes, dbMunicipalityCodes] = await Promise.all([
    fetchSourceCodes(),
    fetchDbCodes(supabase, 'geo_departments'),
    fetchDbCodes(supabase, 'geo_municipalities'),
  ]);

  const missingDepartments = [...departmentCodes].filter((code) => !dbDepartmentCodes.has(code)).sort();
  const extraDepartments = [...dbDepartmentCodes].filter((code) => !departmentCodes.has(code)).sort();
  const missingMunicipalities = [...municipalityCodes].filter((code) => !dbMunicipalityCodes.has(code)).sort();
  const extraMunicipalities = [...dbMunicipalityCodes].filter((code) => !municipalityCodes.has(code)).sort();

  const diff = {
    checkedAt: new Date().toISOString(),
    sourceUrl,
    counts: {
      sourceDepartments: departmentCodes.size,
      dbDepartments: dbDepartmentCodes.size,
      sourceMunicipalities: municipalityCodes.size,
      dbMunicipalities: dbMunicipalityCodes.size,
    },
    missingDepartments,
    extraDepartments,
    missingMunicipalities,
    extraMunicipalities,
  };

  const out = process.env.GEO_DIFF_OUT || path.join(process.cwd(), 'geo-colombia-diff.json');
  fs.writeFileSync(out, JSON.stringify(diff, null, 2));
  console.log(`[geo:diff] Reporte escrito en ${out}`);

  if (missingDepartments.length || extraDepartments.length || missingMunicipalities.length || extraMunicipalities.length) {
    console.error('[geo:diff] Hay diferencias. Revisa el JSON.');
    process.exit(1);
  }

  console.log('[geo:diff] OK. DB coincide con fuente consultada.');
}

main().catch((error) => {
  console.error('[geo:diff] ERROR:', error.message);
  process.exit(1);
});
