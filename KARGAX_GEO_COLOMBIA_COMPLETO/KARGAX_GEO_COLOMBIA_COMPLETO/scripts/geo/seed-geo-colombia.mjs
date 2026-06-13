#!/usr/bin/env node
import crypto from 'node:crypto';
import { createAdminClient } from './_supabase-loader.mjs';

const DIVIPOLA_DATA_URL = process.env.GEO_DIVIPOLA_URL || 'https://www.datos.gov.co/resource/xdk5-pm3f.json?$limit=50000';
const DANE_DIVIPOLA_PAGE = 'https://www.dane.gov.co/index.php/sistema-estadistico-nacional-sen/normas-y-estandares/nomenclaturas-y-clasificaciones/divipola';
const SOURCE_VERSION = process.env.GEO_SOURCE_VERSION || new Date().toISOString().slice(0, 10);
const DRY_RUN = process.argv.includes('--dry-run');
const ALLOW_PARTIAL = process.argv.includes('--allow-partial');
const ALLOW_OFFLINE_DEPARTMENTS = process.argv.includes('--allow-offline-departments');

const OFFICIAL_DEPARTMENTS = [
  ['05', 'Antioquia', 'Medellín'], ['08', 'Atlántico', 'Barranquilla'], ['11', 'Bogotá D.C.', 'Bogotá'],
  ['13', 'Bolívar', 'Cartagena'], ['15', 'Boyacá', 'Tunja'], ['17', 'Caldas', 'Manizales'],
  ['18', 'Caquetá', 'Florencia'], ['19', 'Cauca', 'Popayán'], ['20', 'Cesar', 'Valledupar'],
  ['23', 'Córdoba', 'Montería'], ['25', 'Cundinamarca', 'Bogotá'], ['27', 'Chocó', 'Quibdó'],
  ['41', 'Huila', 'Neiva'], ['44', 'La Guajira', 'Riohacha'], ['47', 'Magdalena', 'Santa Marta'],
  ['50', 'Meta', 'Villavicencio'], ['52', 'Nariño', 'Pasto'], ['54', 'Norte de Santander', 'Cúcuta'],
  ['63', 'Quindío', 'Armenia'], ['66', 'Risaralda', 'Pereira'], ['68', 'Santander', 'Bucaramanga'],
  ['70', 'Sucre', 'Sincelejo'], ['73', 'Tolima', 'Ibagué'], ['76', 'Valle del Cauca', 'Cali'],
  ['81', 'Arauca', 'Arauca'], ['85', 'Casanare', 'Yopal'], ['86', 'Putumayo', 'Mocoa'],
  ['88', 'Archipiélago de San Andrés, Providencia y Santa Catalina', 'San Andrés'], ['91', 'Amazonas', 'Leticia'],
  ['94', 'Guainía', 'Inírida'], ['95', 'Guaviare', 'San José del Guaviare'], ['97', 'Vaupés', 'Mitú'],
  ['99', 'Vichada', 'Puerto Carreño'],
].map(([divipolaCode, name, capital]) => ({ divipolaCode, name, capital }));

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bD\.C\.$/i, 'D.C.');
}

function pick(row, keys) {
  for (const key of keys) {
    const direct = row[key];
    if (direct !== undefined && direct !== null && String(direct).trim()) return direct;
  }

  const normalizedKeyMap = Object.fromEntries(
    Object.keys(row).map((key) => [normalizeName(key).replace(/\s/g, ''), key])
  );

  for (const key of keys) {
    const normalized = normalizeName(key).replace(/\s/g, '');
    const realKey = normalizedKeyMap[normalized];
    if (realKey && String(row[realKey] || '').trim()) return row[realKey];
  }

  return '';
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeDepartmentCode(value) {
  const digits = onlyDigits(value);
  return digits ? digits.padStart(2, '0').slice(-2) : '';
}

function normalizeMunicipalityCode(value, departmentCode) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  if (digits.length >= 5) return digits.padStart(5, '0').slice(-5);
  if (departmentCode) return `${departmentCode}${digits.padStart(3, '0')}`;
  return digits.padStart(5, '0');
}

function classifyMunicipalityType(row, municipalityName) {
  const raw = normalizeName([
    pick(row, ['tipo', 'tipo_municipio', 'categoria', 'clase', 'tipo_entidad']),
    municipalityName,
  ].join(' '));

  if (raw.includes('area no municipalizada') || raw.includes('area no municipalizado')) return 'area_no_municipalizada';
  if (raw.includes('distrito')) return 'distrito';
  return 'municipio';
}

async function fetchDivipolaRows() {
  const response = await fetch(DIVIPOLA_DATA_URL, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar DIVIPOLA desde Datos Abiertos Colombia: ${response.status} ${response.statusText}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('La fuente DIVIPOLA no retornó un arreglo JSON');
  return rows;
}

function buildRows(rawRows) {
  const departments = new Map();
  const municipalities = new Map();
  const officialCapitalByDepartment = new Map(OFFICIAL_DEPARTMENTS.map((item) => [item.divipolaCode, normalizeName(item.capital)]));

  for (const row of rawRows) {
    const departmentCode = normalizeDepartmentCode(pick(row, [
      'c_digo_dane_del_departamento', 'codigo_dane_del_departamento', 'codigo_departamento',
      'cod_departamento', 'cod_dpto', 'dpto_ccdgo', 'departamento_codigo', 'departamento_code',
    ]));
    const departmentName = cleanName(pick(row, [
      'departamento', 'nombre_departamento', 'dpto_cnmbr', 'departamento_nombre', 'nom_departamento',
    ]));
    const municipalityCode = normalizeMunicipalityCode(pick(row, [
      'c_digo_dane_del_municipio', 'codigo_dane_del_municipio', 'codigo_municipio', 'cod_municipio',
      'cod_mpio', 'mpio_ccdgo', 'municipio_codigo', 'divipola', 'codigo',
    ]), departmentCode);
    const municipalityName = cleanName(pick(row, [
      'municipio', 'nombre_municipio', 'mpio_cnmbr', 'municipio_nombre', 'nom_municipio',
    ]));

    if (!departmentCode || !departmentName || !municipalityCode || !municipalityName) continue;

    departments.set(departmentCode, {
      country_code: 'CO',
      divipola_code: departmentCode,
      name: departmentName,
      normalized_name: normalizeName(departmentName),
      is_capital_district: departmentCode === '11',
      is_active: true,
    });

    municipalities.set(municipalityCode, {
      country_code: 'CO',
      department_code: departmentCode,
      divipola_code: municipalityCode,
      name: municipalityName,
      normalized_name: normalizeName(municipalityName),
      type: classifyMunicipalityType(row, municipalityName),
      is_capital: officialCapitalByDepartment.get(departmentCode) === normalizeName(municipalityName),
      is_active: true,
    });
  }

  return {
    departments: [...departments.values()].sort((a, b) => a.divipola_code.localeCompare(b.divipola_code)),
    municipalities: [...municipalities.values()].sort((a, b) => a.divipola_code.localeCompare(b.divipola_code)),
  };
}

async function upsertInChunks(supabase, table, rows, onConflict, chunkSize = 500) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function main() {
  let rawRows = [];

  try {
    rawRows = await fetchDivipolaRows();
  } catch (error) {
    if (!ALLOW_OFFLINE_DEPARTMENTS) throw error;
    console.warn(`[geo:seed] ${error.message}`);
    console.warn('[geo:seed] Continuando solo con departamentos oficiales por --allow-offline-departments. No usar para producción.');
  }

  let { departments, municipalities } = rawRows.length ? buildRows(rawRows) : { departments: [], municipalities: [] };

  if (!departments.length && ALLOW_OFFLINE_DEPARTMENTS) {
    departments = OFFICIAL_DEPARTMENTS.map((department) => ({
      country_code: 'CO',
      divipola_code: department.divipolaCode,
      name: department.name,
      normalized_name: normalizeName(department.name),
      is_capital_district: department.divipolaCode === '11',
      is_active: true,
    }));
  }

  if (departments.length !== 33 && !ALLOW_PARTIAL) {
    throw new Error(`Conteo de departamentos inválido: ${departments.length}. Esperado: 33. Usa --allow-partial solo para staging temporal.`);
  }

  if (municipalities.length < 1100 && !ALLOW_PARTIAL) {
    throw new Error(`Conteo de municipios/áreas insuficiente: ${municipalities.length}. Esperado >= 1100 desde fuente oficial.`);
  }

  const checksum = crypto.createHash('sha256').update(JSON.stringify({ departments, municipalities })).digest('hex');

  console.log(`[geo:seed] Fuente: ${DIVIPOLA_DATA_URL}`);
  console.log(`[geo:seed] Departamentos: ${departments.length}`);
  console.log(`[geo:seed] Municipios/áreas: ${municipalities.length}`);
  console.log(`[geo:seed] Checksum: ${checksum}`);

  if (DRY_RUN) {
    console.log('[geo:seed] Dry-run: no se escribieron datos.');
    return;
  }

  const supabase = createAdminClient();

  await upsertInChunks(supabase, 'geo_departments', departments, 'country_code,divipola_code');

  const { data: departmentRows, error: departmentError } = await supabase
    .from('geo_departments')
    .select('id, divipola_code')
    .eq('country_code', 'CO');

  if (departmentError) throw new Error(departmentError.message);

  const departmentIdByCode = new Map((departmentRows || []).map((row) => [row.divipola_code, row.id]));
  const municipalityRows = municipalities.map(({ department_code, ...row }) => ({
    ...row,
    department_id: departmentIdByCode.get(department_code),
  })).filter((row) => Boolean(row.department_id));

  if (municipalityRows.length !== municipalities.length && !ALLOW_PARTIAL) {
    throw new Error('Hay municipios sin department_id resuelto. No se escribió catálogo parcial.');
  }

  if (municipalityRows.length) {
    await upsertInChunks(supabase, 'geo_municipalities', municipalityRows, 'country_code,divipola_code');
  }

  const { error: versionError } = await supabase.from('geo_seed_versions').upsert({
    source_name: 'DANE_DIVIPOLA_COLOMBIA',
    source_url: DANE_DIVIPOLA_PAGE,
    source_checked_at: new Date().toISOString(),
    source_version: SOURCE_VERSION,
    checksum,
    row_counts: {
      departments: departments.length,
      municipalities: municipalityRows.length,
      rawRows: rawRows.length,
    },
    notes: 'Seed idempotente. Departamentos y municipios/áreas desde fuente oficial DANE/DIVIPOLA publicada en Datos Abiertos Colombia.',
  }, { onConflict: 'source_name,source_version' });

  if (versionError) throw new Error(versionError.message);

  console.log('[geo:seed] OK. Catálogo geográfico actualizado sin duplicados.');
}

main().catch((error) => {
  console.error('[geo:seed] ERROR:', error.message);
  process.exit(1);
});
