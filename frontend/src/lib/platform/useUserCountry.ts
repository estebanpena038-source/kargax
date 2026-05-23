// =============================================================================
// KargaX - useUserCountry Hook
// Central source of truth for user's country, currency, locale, and banks.
// Silicon Valley-grade auto-localization engine (Google/Amazon pattern)
// =============================================================================

'use client';

import { useMemo, useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type SupportedCountry,
  type CountryConfig,
  COUNTRIES,
  getSubdivisions,
  getCities,
  getCountryConfig,
  getSubdivisionName,
  getCityNameByCode,
  resolveLocationDisplay,
  formatCurrency,
  detectCountryFromLocale,
  COUNTRY_LIST,
} from '@/constants/countries';

// =============================================================================
// Country Store (persisted to localStorage)
// =============================================================================

interface CountryStore {
  country: SupportedCountry;
  setCountry: (country: SupportedCountry) => void;
}

export const useCountryStore = create<CountryStore>()(
  persist(
    (set) => ({
      country: typeof window !== 'undefined' ? detectCountryFromLocale() : 'CO',
      setCountry: (country) => set({ country }),
    }),
    {
      name: 'kargax-country',
    }
  )
);

// =============================================================================
// Banks per country
// =============================================================================

export const BANKS_BY_COUNTRY: Record<SupportedCountry, string[]> = {
  CO: [
    'Bancolombia',
    'Banco de Bogotá',
    'Davivienda',
    'BBVA Colombia',
    'Banco de Occidente',
    'Banco Popular',
    'Banco Caja Social',
    'Banco Agrario',
    'Banco AV Villas',
    'Banco Falabella',
    'Banco Pichincha',
    'Scotiabank Colpatria',
    'Banco Itaú',
    'Banco GNB Sudameris',
    'Citibank',
    'Nequi',
    'Daviplata',
  ],
  EC: [
    'Banco Pichincha',
    'Banco del Pacífico',
    'Banco de Guayaquil',
    'Produbanco',
    'Banco Internacional',
    'Banco Bolivariano',
    'Banco del Austro',
    'Cooperativa JEP',
    'Banco Solidario',
    'BanEcuador',
    'Cooperativa Mushuc Runa',
  ],
  PE: [
    'BCP - Banco de Crédito del Perú',
    'BBVA Perú',
    'Interbank',
    'Scotiabank Perú',
    'Banco de la Nación',
    'Banco Falabella Perú',
    'BanBif',
    'MiBanco',
    'Banco Ripley',
    'Banco GNB Perú',
    'Yape (BCP)',
    'Plin (Interbank)',
  ],
  BR: [
    'Banco do Brasil',
    'Itaú Unibanco',
    'Bradesco',
    'Santander Brasil',
    'Caixa Econômica Federal',
    'Banco Inter',
    'Nubank',
    'BTG Pactual',
    'Banco Safra',
    'Sicoob',
    'Sicredi',
    'PagBank / PagSeguro',
    'C6 Bank',
    'Mercado Pago',
    'PicPay',
  ],
};

// =============================================================================
// Digital wallets per country
// =============================================================================

export const DIGITAL_WALLETS_BY_COUNTRY: Record<SupportedCountry, { id: string; name: string; color: string }[]> = {
  CO: [
    { id: 'nequi', name: 'Nequi', color: '#E6007E' },
    { id: 'daviplata', name: 'Daviplata', color: '#E30613' },
  ],
  EC: [
    { id: 'deuna', name: 'DeUna', color: '#6C3AFF' },
    { id: 'bimo', name: 'BIMO', color: '#003DA5' },
  ],
  PE: [
    { id: 'yape', name: 'Yape', color: '#6D28D9' },
    { id: 'plin', name: 'Plin', color: '#00B4D8' },
  ],
  BR: [
    { id: 'pix', name: 'PIX', color: '#32BCAD' },
    { id: 'picpay', name: 'PicPay', color: '#21C25E' },
  ],
};

// =============================================================================
// Minimum withdrawal amounts per country (in local currency)
// =============================================================================

export const MIN_WITHDRAWAL: Record<SupportedCountry, number> = {
  CO: 50000,   // 50,000 COP
  EC: 10,      // $10 USD
  PE: 20,      // S/20 PEN
  BR: 20,      // R$20 BRL
};

// =============================================================================
// Minimum offer amounts per country (in local currency)
// =============================================================================

export const MIN_OFFER_AMOUNT: Record<SupportedCountry, number> = {
  CO: 50000,   // 50,000 COP
  EC: 20,      // $20 USD
  PE: 50,      // S/50 PEN
  BR: 50,      // R$50 BRL
};

// =============================================================================
// Flag stripe colors per country (for registration/branding)
// =============================================================================

export const FLAG_STRIPES: Record<SupportedCountry, { colors: string[]; labels: string[] }> = {
  CO: { colors: ['bg-yellow-400', 'bg-blue-800', 'bg-red-600'], labels: ['Amarillo', 'Azul', 'Rojo'] },
  EC: { colors: ['bg-yellow-400', 'bg-blue-700', 'bg-red-600'], labels: ['Amarillo', 'Azul', 'Rojo'] },
  PE: { colors: ['bg-red-600', 'bg-white', 'bg-red-600'], labels: ['Rojo', 'Blanco', 'Rojo'] },
  BR: { colors: ['bg-green-600', 'bg-yellow-400', 'bg-blue-700'], labels: ['Verde', 'Amarelo', 'Azul'] },
};

// =============================================================================
// The Hook
// =============================================================================

export function useUserCountry() {
  const { country, setCountry } = useCountryStore();

  const config = useMemo(() => getCountryConfig(country), [country]);
  const subdivisions = useMemo(() => getSubdivisions(country), [country]);
  const banks = useMemo(() => BANKS_BY_COUNTRY[country], [country]);
  const wallets = useMemo(() => DIGITAL_WALLETS_BY_COUNTRY[country], [country]);
  const minWithdrawal = useMemo(() => MIN_WITHDRAWAL[country], [country]);
  const minOfferAmount = useMemo(() => MIN_OFFER_AMOUNT[country], [country]);
  const flagStripes = useMemo(() => FLAG_STRIPES[country], [country]);

  const getCitiesForSubdivision = useCallback(
    (subdivisionCode: string) => getCities(country, subdivisionCode),
    [country]
  );

  const format = useCallback(
    (amount: number) => formatCurrency(amount, country),
    [country]
  );

  const resolveLocation = useCallback(
    (cityCode: string, subdivisionCode: string) =>
      resolveLocationDisplay(country, cityCode, subdivisionCode),
    [country]
  );

  const getSubName = useCallback(
    (code: string) => getSubdivisionName(country, code),
    [country]
  );

  const getCityName = useCallback(
    (code: string) => getCityNameByCode(country, code),
    [country]
  );

  return {
    // State
    country,
    config,
    setCountry,

    // Data
    subdivisions,
    banks,
    wallets,
    minWithdrawal,
    minOfferAmount,
    flagStripes,
    allCountries: COUNTRY_LIST,

    // Functions
    getCitiesForSubdivision,
    format,
    resolveLocation,
    getSubName,
    getCityName,
  };
}

export default useUserCountry;
