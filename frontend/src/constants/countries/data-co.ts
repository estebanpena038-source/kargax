// Bridge to existing Colombia data - no duplication
import { COLOMBIAN_DEPARTMENTS, MAJOR_CITIES } from '../colombia';
import type { Subdivision, City } from './index';

export const CO_SUBDIVISIONS: readonly Subdivision[] = COLOMBIAN_DEPARTMENTS.map(d => ({
  code: d.code, name: d.name, capital: d.capital, country: 'CO' as const,
}));

export const CO_CITIES: readonly City[] = MAJOR_CITIES.map(c => ({
  code: c.code, name: c.name, subdivisionCode: c.departmentCode, country: 'CO' as const, isCapital: c.isCapital,
}));
