// =============================================================================
// KargaX - Multi-Country Geo Intelligence System
// Supports: Colombia, Ecuador, Peru, Brazil
// Silicon Valley-grade auto-localization engine
// =============================================================================

export type SupportedCountry = 'CO' | 'EC' | 'PE' | 'BR';

export interface CountryConfig {
  code: SupportedCountry;
  name: string;
  nativeName: string;
  flag: string;
  locale: string;
  language: string;
  currencyCode: string;
  currencySymbol: string;
  currencyName: string;
  phoneCode: string;
  phoneFormat: string;
  documentTypes: { code: string; name: string }[];
  subdivisionLabel: string; // "Departamento", "Provincia", "Estado"
  cityLabel: string;
}

export interface Subdivision {
  code: string;
  name: string;
  capital: string;
  country: SupportedCountry;
}

export interface City {
  code: string;
  name: string;
  subdivisionCode: string;
  country: SupportedCountry;
  isCapital?: boolean;
}

// =============================================================================
// Country Configurations
// =============================================================================

export const COUNTRIES: Record<SupportedCountry, CountryConfig> = {
  CO: {
    code: 'CO',
    name: 'Colombia',
    nativeName: 'Colombia',
    flag: '🇨🇴',
    locale: 'es-CO',
    language: 'es',
    currencyCode: 'COP',
    currencySymbol: '$',
    currencyName: 'Peso Colombiano',
    phoneCode: '+57',
    phoneFormat: '(###) ###-####',
    documentTypes: [
      { code: 'CC', name: 'Cédula de Ciudadanía' },
      { code: 'CE', name: 'Cédula de Extranjería' },
      { code: 'NIT', name: 'NIT' },
      { code: 'PP', name: 'Pasaporte' },
      { code: 'TI', name: 'Tarjeta de Identidad' },
    ],
    subdivisionLabel: 'Departamento',
    cityLabel: 'Ciudad',
  },
  EC: {
    code: 'EC',
    name: 'Ecuador',
    nativeName: 'Ecuador',
    flag: '🇪🇨',
    locale: 'es-EC',
    language: 'es',
    currencyCode: 'USD',
    currencySymbol: '$',
    currencyName: 'Dólar Estadounidense',
    phoneCode: '+593',
    phoneFormat: '(##) ###-####',
    documentTypes: [
      { code: 'CI', name: 'Cédula de Identidad' },
      { code: 'RUC', name: 'RUC' },
      { code: 'PP', name: 'Pasaporte' },
    ],
    subdivisionLabel: 'Provincia',
    cityLabel: 'Ciudad',
  },
  PE: {
    code: 'PE',
    name: 'Peru',
    nativeName: 'Perú',
    flag: '🇵🇪',
    locale: 'es-PE',
    language: 'es',
    currencyCode: 'PEN',
    currencySymbol: 'S/',
    currencyName: 'Sol Peruano',
    phoneCode: '+51',
    phoneFormat: '(###) ###-###',
    documentTypes: [
      { code: 'DNI', name: 'DNI' },
      { code: 'RUC', name: 'RUC' },
      { code: 'CE', name: 'Carné de Extranjería' },
      { code: 'PP', name: 'Pasaporte' },
    ],
    subdivisionLabel: 'Departamento',
    cityLabel: 'Provincia / Ciudad',
  },
  BR: {
    code: 'BR',
    name: 'Brazil',
    nativeName: 'Brasil',
    flag: '🇧🇷',
    locale: 'pt-BR',
    language: 'pt',
    currencyCode: 'BRL',
    currencySymbol: 'R$',
    currencyName: 'Real Brasileiro',
    phoneCode: '+55',
    phoneFormat: '(##) #####-####',
    documentTypes: [
      { code: 'CPF', name: 'CPF' },
      { code: 'CNPJ', name: 'CNPJ' },
      { code: 'RG', name: 'RG' },
      { code: 'PP', name: 'Passaporte' },
    ],
    subdivisionLabel: 'Estado',
    cityLabel: 'Cidade',
  },
};

// =============================================================================
// Import country-specific data
// =============================================================================

import { CO_SUBDIVISIONS, CO_CITIES } from './data-co';
import { EC_SUBDIVISIONS, EC_CITIES } from './data-ec';
import { PE_SUBDIVISIONS, PE_CITIES } from './data-pe';
import { BR_SUBDIVISIONS, BR_CITIES } from './data-br';

// =============================================================================
// Unified Data Access
// =============================================================================

const ALL_SUBDIVISIONS: Record<SupportedCountry, readonly Subdivision[]> = {
  CO: CO_SUBDIVISIONS,
  EC: EC_SUBDIVISIONS,
  PE: PE_SUBDIVISIONS,
  BR: BR_SUBDIVISIONS,
};

const ALL_CITIES: Record<SupportedCountry, readonly City[]> = {
  CO: CO_CITIES,
  EC: EC_CITIES,
  PE: PE_CITIES,
  BR: BR_CITIES,
};

// =============================================================================
// Helper Functions
// =============================================================================

export function getSubdivisions(country: SupportedCountry): readonly Subdivision[] {
  return ALL_SUBDIVISIONS[country] || [];
}

export function getCities(country: SupportedCountry, subdivisionCode?: string): readonly City[] {
  const cities = ALL_CITIES[country] || [];
  if (subdivisionCode) {
    return cities.filter(c => c.subdivisionCode === subdivisionCode);
  }
  return cities;
}

export function getCountryConfig(country: SupportedCountry): CountryConfig {
  return COUNTRIES[country];
}

export function getSubdivisionName(country: SupportedCountry, code: string): string {
  const sub = (ALL_SUBDIVISIONS[country] || []).find(s => s.code === code);
  return sub?.name || code;
}

export function getCityNameByCode(country: SupportedCountry, code: string): string {
  const city = (ALL_CITIES[country] || []).find(c => c.code === code);
  return city?.name || code;
}

export function resolveLocationDisplay(
  country: SupportedCountry,
  cityCode: string,
  subdivisionCode: string
): string {
  const cityName = getCityNameByCode(country, cityCode);
  const subName = getSubdivisionName(country, subdivisionCode);
  return `${cityName}, ${subName}`;
}

export function formatCurrency(amount: number, country: SupportedCountry): string {
  const config = COUNTRIES[country];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function detectCountryFromLocale(): SupportedCountry {
  if (typeof navigator === 'undefined') return 'CO';
  const lang = navigator.language.toLowerCase();
  if (lang.includes('br') || lang === 'pt') return 'BR';
  if (lang.includes('ec')) return 'EC';
  if (lang.includes('pe')) return 'PE';
  return 'CO';
}

export const COUNTRY_LIST = Object.values(COUNTRIES);
