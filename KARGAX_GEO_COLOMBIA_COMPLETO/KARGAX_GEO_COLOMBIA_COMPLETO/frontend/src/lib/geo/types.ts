export type GeoZoneType =
  | 'barrio'
  | 'localidad'
  | 'comuna'
  | 'vereda'
  | 'corregimiento'
  | 'centro_poblado'
  | 'sector'
  | 'otro';

export interface GeoDepartment {
  id: string;
  countryCode: 'CO';
  divipolaCode: string;
  name: string;
  normalizedName?: string;
  isCapitalDistrict?: boolean;
}

export interface GeoMunicipality {
  id: string;
  departmentId: string;
  countryCode: 'CO';
  divipolaCode: string;
  name: string;
  normalizedName?: string;
  type: 'municipio' | 'distrito' | 'area_no_municipalizada';
  isCapital?: boolean;
}

export interface GeoLocalZone {
  id: string;
  departmentId: string;
  municipalityId: string;
  divipolaCode?: string | null;
  name: string;
  normalizedName?: string;
  zoneType: GeoZoneType;
  source?: string;
  confidence?: number;
  isUserSubmitted?: boolean;
  needsReview?: boolean;
}

export interface LocationSelectorValue {
  countryCode?: 'CO';
  departmentId?: string | null;
  departmentCode?: string | null;
  departmentName?: string;
  municipalityId?: string | null;
  municipalityCode?: string | null;
  municipalityName?: string;
  localZoneId?: string | null;
  localZoneName?: string;
  localZoneType?: GeoZoneType | '';
  exactAddress?: string;
  reference?: string;
  isManualZone?: boolean;
}

export type LocationSelectorMode = 'origen' | 'destino' | 'bodega' | 'empresa' | 'filtro';

export interface GeoApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
