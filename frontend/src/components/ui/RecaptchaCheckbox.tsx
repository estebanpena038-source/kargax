// =============================================================================
// KARGAX - RECAPTCHA COMPONENT (Manual Implementation)
// =============================================================================

'use client';

import * as React from 'react';
import Script from 'next/script';

interface RecaptchaCheckboxProps {
    onVerify: (token: string | null) => void;
    error?: string;
}

// Declaración del tipo global para grecaptcha
declare global {
    interface Window {
        grecaptcha: {
            ready: (callback: () => void) => void;
            render: (container: string | HTMLElement, options: {
                sitekey: string;
                callback: (token: string) => void;
                'expired-callback': () => void;
                'error-callback': () => void;
                theme?: 'light' | 'dark';
                hl?: string;
            }) => number;
            reset: (widgetId?: number) => void;
        };
        onRecaptchaLoad?: () => void;
    }
}

/**
 * Componente wrapper para Google reCAPTCHA v2 (checkbox)
 * Usa next/script para cargar el script de forma segura
 */
export function RecaptchaCheckbox({ onVerify, error }: RecaptchaCheckboxProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const siteKey = React.useMemo(
        () => process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || '',
        []
    );
    const captchaEnabled = Boolean(siteKey);
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [widgetId, setWidgetId] = React.useState<number | null>(null);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    // Renderizar widget cuando el script se carga
    React.useEffect(() => {
        if (captchaEnabled && isLoaded && containerRef.current && widgetId === null) {
            try {
                const id = window.grecaptcha.render(containerRef.current, {
                    sitekey: siteKey,
                    callback: (token: string) => {
                        onVerify(token);
                        setLoadError(null);
                    },
                    'expired-callback': () => {
                        onVerify(null);
                    },
                    'error-callback': () => {
                        onVerify(null);
                        setLoadError('No fue posible validar reCAPTCHA en este dominio.');
                    },
                    theme: 'light',
                    hl: 'es',
                });
                setWidgetId(id);
            } catch (err) {
                console.error('Error rendering reCAPTCHA:', err);
                setLoadError('No fue posible cargar reCAPTCHA en este dominio.');
                onVerify(null);
            }
        }
    }, [captchaEnabled, isLoaded, onVerify, siteKey, widgetId]);

    const handleScriptLoad = () => {
        if (window.grecaptcha) {
            window.grecaptcha.ready(() => {
                setIsLoaded(true);
            });
        }
    };

    if (!captchaEnabled) {
        return null;
    }

    return (
        <div className="space-y-2">
            {/* Script de reCAPTCHA */}
            <Script
                src="https://www.google.com/recaptcha/api.js?render=explicit&hl=es"
                strategy="afterInteractive"
                onLoad={handleScriptLoad}
                onError={() => {
                    setLoadError('No fue posible cargar el script de reCAPTCHA.');
                    onVerify(null);
                }}
            />

            {/* Contenedor del widget */}
            <div className="flex w-full min-w-0 justify-center overflow-x-auto pb-1">
                {!isLoaded ? (
                    <div className="flex min-h-[78px] w-full max-w-[304px] min-w-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex min-w-0 animate-pulse items-center gap-2">
                            <svg className="w-5 h-5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-slate-500 text-sm">Cargando verificación...</span>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-full origin-top scale-[0.92] min-[360px]:scale-100" ref={containerRef}></div>
                )}
            </div>

            {error && (
                <p className="text-red-600 text-sm text-center">{error}</p>
            )}
            {!error && loadError && (
                <p className="text-green-800 text-sm text-center">{loadError}</p>
            )}
        </div>
    );
}

export default RecaptchaCheckbox;
