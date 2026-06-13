import type { GeoApiResponse, GeoDepartment, GeoLocalZone, GeoMunicipality } from './types';

async function readGeoResponse<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as GeoApiResponse<T> | null;

  if (!response.ok || !json?.success) {
    throw new Error(json?.error || 'No se pudo consultar el catálogo geográfico');
  }

  return json.data;
}

export async function fetchGeoDepartments(): Promise<GeoDepartment[]> {
  const response = await fetch('/api/geo/departments', { cache: 'no-store' });
  return readGeoResponse<GeoDepartment[]>(response);
}

export async function fetchGeoMunicipalities(params: {
  departmentId?: string | null;
  departmentCode?: string | null;
  q?: string;
}): Promise<GeoMunicipality[]> {
  const url = new URL('/api/geo/municipalities', window.location.origin);
  if (params.departmentId) url.searchParams.set('departmentId', params.departmentId);
  if (params.departmentCode) url.searchParams.set('departmentCode', params.departmentCode);
  if (params.q) url.searchParams.set('q', params.q);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  return readGeoResponse<GeoMunicipality[]>(response);
}

export async function fetchGeoLocalZones(params: {
  municipalityId?: string | null;
  q?: string;
}): Promise<GeoLocalZone[]> {
  const url = new URL('/api/geo/local-zones', window.location.origin);
  if (params.municipalityId) url.searchParams.set('municipalityId', params.municipalityId);
  if (params.q) url.searchParams.set('q', params.q);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  return readGeoResponse<GeoLocalZone[]>(response);
}
