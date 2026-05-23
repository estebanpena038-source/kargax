'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';

export type Locale = 'es-CO' | 'en' | 'pt-BR';

export interface LocaleConfig {
    code: Locale;
    name: string;
    nativeName: string;
    flag: string;
    dateFormat: string;
    currencyCode: string;
}

export type TranslationDictionary = {
    [key: string]: string | TranslationDictionary;
};

export const LOCALES: Record<Locale, LocaleConfig> = {
    'es-CO': {
        code: 'es-CO',
        name: 'Spanish (Colombia)',
        nativeName: 'Español (Colombia)',
        flag: '🇨🇴',
        dateFormat: 'dd/MM/yyyy',
        currencyCode: 'COP',
    },
    'en': {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸',
        dateFormat: 'MM/dd/yyyy',
        currencyCode: 'USD',
    },
    'pt-BR': {
        code: 'pt-BR',
        name: 'Portuguese (Brazil)',
        nativeName: 'Português (Brasil)',
        flag: '🇧🇷',
        dateFormat: 'dd/MM/yyyy',
        currencyCode: 'BRL',
    },
};

export const DEFAULT_LOCALE: Locale = 'es-CO';

const TRANSLATION_TIMEOUT_MS = 8000;
const translationCache = new Map<Locale, TranslationDictionary>();
const translationRequests = new Map<Locale, Promise<TranslationDictionary>>();

function hasTranslations(translations: TranslationDictionary): boolean {
    return Object.keys(translations).length > 0;
}

async function fetchTranslations(locale: Locale): Promise<TranslationDictionary> {
    const cached = translationCache.get(locale);
    if (cached) {
        return cached;
    }

    const existingRequest = translationRequests.get(locale);
    if (existingRequest) {
        return existingRequest;
    }

    const request = (async () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);

        try {
            const response = await fetch(`/locales/${locale}/common.json`, {
                cache: 'force-cache',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${locale}: ${response.status}`);
            }
            const translations = (await response.json()) as TranslationDictionary;
            translationCache.set(locale, translations);
            return translations;
        } finally {
            window.clearTimeout(timeout);
            translationRequests.delete(locale);
        }
    })();

    translationRequests.set(locale, request);
    return request;
}

interface LocaleState {
    locale: Locale;
    translations: TranslationDictionary;
    isLoading: boolean;
    setLocale: (locale: Locale) => Promise<void>;
    loadTranslations: (locale: Locale) => Promise<void>;
}

export const useLocaleStore = create<LocaleState>()(
    persist(
        (set, get) => ({
            locale: DEFAULT_LOCALE,
            translations: {},
            isLoading: false,
            setLocale: async (locale: Locale) => {
                if (!LOCALES[locale]) return;
                await get().loadTranslations(locale);
                set({ locale });
                if (typeof document !== 'undefined') {
                    document.documentElement.lang = locale;
                }
            },
            loadTranslations: async (locale: Locale) => {
                const cached = translationCache.get(locale);
                if (cached) {
                    set({ translations: cached, isLoading: false });
                    return;
                }

                set({ isLoading: true });
                try {
                    const translations = await fetchTranslations(locale);
                    set({ translations, isLoading: false });
                } catch (error) {
                    console.error(`Error loading translations for ${locale}:`, error);
                    if (locale !== DEFAULT_LOCALE) {
                        try {
                            const fallbackTranslations = await fetchTranslations(DEFAULT_LOCALE);
                            set({ locale: DEFAULT_LOCALE, translations: fallbackTranslations, isLoading: false });
                        } catch (fallbackError) {
                            console.error(`Error loading fallback translations for ${DEFAULT_LOCALE}:`, fallbackError);
                            set({ locale: DEFAULT_LOCALE, translations: {}, isLoading: false });
                        }
                    } else {
                        set({ translations: {}, isLoading: false });
                    }
                }
            },
        }),
        {
            name: 'kargax-locale',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ locale: state.locale }),
        }
    )
);

function getNestedValue(obj: TranslationDictionary, path: string): string | undefined {
    const keys = path.split('.');
    let current: TranslationDictionary | string = obj;
    for (const key of keys) {
        if (typeof current !== 'object' || current === null) return undefined;
        current = current[key];
    }
    return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return values[key]?.toString() ?? match;
    });
}

export function useTranslation() {
    const { locale, translations, isLoading, setLocale, loadTranslations } = useLocaleStore();

    useEffect(() => {
        if (!hasTranslations(translations) && !isLoading) {
            loadTranslations(locale);
        }
    }, [locale, translations, isLoading, loadTranslations]);

    const t = useCallback(
        (key: string, values?: Record<string, string | number>): string => {
            const translation = getNestedValue(translations, key);
            if (!translation) return key;
            if (values) return interpolate(translation, values);
            return translation;
        },
        [translations]
    );

    const localeConfig = useMemo(() => LOCALES[locale], [locale]);

    return {
        t,
        locale,
        localeConfig,
        setLocale,
        isLoading,
        availableLocales: Object.values(LOCALES),
    };
}

interface LocaleProviderProps {
    children: ReactNode;
    initialLocale?: Locale;
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
    const { setLocale, locale, loadTranslations } = useLocaleStore();
    const isInitialized = useRef(false);

    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;
        const targetLocale = initialLocale || detectBrowserLocale();
        if (targetLocale !== locale) {
            setLocale(targetLocale);
        } else {
            loadTranslations(locale);
        }
    }, [initialLocale, locale, setLocale, loadTranslations]);

    return children;
}

export function detectBrowserLocale(): Locale {
    if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
    const browserLocale = navigator.language;
    if (LOCALES[browserLocale as Locale]) return browserLocale as Locale;
    const languageCode = browserLocale.split('-')[0];
    const languageMap: Record<string, Locale> = { 'es': 'es-CO', 'en': 'en', 'pt': 'pt-BR' };
    return languageMap[languageCode] || DEFAULT_LOCALE;
}

interface LanguageSelectorProps {
    className?: string;
    variant?: 'dropdown' | 'inline';
}

export function LanguageSelector({ className = '', variant = 'dropdown' }: LanguageSelectorProps) {
    const { locale, setLocale, availableLocales, isLoading } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    if (variant === 'inline') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                {availableLocales.map((loc) => (
                    <button
                        key={loc.code}
                        onClick={() => setLocale(loc.code)}
                        disabled={isLoading}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${locale === loc.code ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {loc.flag} {loc.code.toUpperCase()}
                    </button>
                ))}
            </div>
        );
    }

    const currentLocale = LOCALES[locale];

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className="text-lg">{currentLocale.flag}</span>
                <span className="text-sm font-medium text-slate-700">{currentLocale.code.toUpperCase()}</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 py-1 z-20 bg-white rounded-lg shadow-lg border border-slate-200">
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    {availableLocales.map((loc) => (
                        <button
                            key={loc.code}
                            onClick={() => { setLocale(loc.code); setIsOpen(false); }}
                            className={`relative z-20 w-full flex items-center gap-3 px-4 py-2 text-left ${locale === loc.code ? 'bg-green-50 text-green-800' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            <span className="text-lg">{loc.flag}</span>
                            <div>
                                <p className="text-sm font-medium">{loc.nativeName}</p>
                                <p className="text-xs text-slate-500">{loc.name}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default { useTranslation, useLocaleStore, LocaleProvider, LanguageSelector, detectBrowserLocale, LOCALES, DEFAULT_LOCALE };
