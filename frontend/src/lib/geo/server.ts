import { createClient } from '@supabase/supabase-js';
import type { GeoDepartment, GeoLocalZone, GeoMunicipality } from './types';

export function getGeoCatalogClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public env vars are required for geo catalog routes');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function normalizeForGeoSearch(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function mapDepartment(row: any): GeoDepartment {
  return {
    id: row.id,
    countryCode: row.country_code || 'CO',
    divipolaCode: row.divipola_code,
    name: row.name,
    normalizedName: row.normalized_name,
    isCapitalDistrict: Boolean(row.is_capital_district),
  };
}

export function mapMunicipality(row: any): GeoMunicipality {
  return {
    id: row.id,
    departmentId: row.department_id,
    countryCode: row.country_code || 'CO',
    divipolaCode: row.divipola_code,
    name: row.name,
    normalizedName: row.normalized_name,
    type: row.type || 'municipio',
    isCapital: Boolean(row.is_capital),
  };
}

export function mapLocalZone(row: any): GeoLocalZone {
  return {
    id: row.id,
    departmentId: row.department_id,
    municipalityId: row.municipality_id,
    divipolaCode: row.divipola_code,
    name: row.name,
    normalizedName: row.normalized_name,
    zoneType: row.zone_type || 'otro',
    source: row.source,
    confidence: Number(row.confidence ?? 0),
    isUserSubmitted: Boolean(row.is_user_submitted),
    needsReview: Boolean(row.needs_review),
  };
}
