'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    composeAndeanPhoneValue,
    getAndeanPhoneCountries,
    getAndeanPhoneCountry,
    normalizeAndeanNationalNumber,
    splitAndeanPhoneValue,
    type AndeanCountryCode,
} from '@/lib/phone/andean';

export interface AndeanPhoneInputProps {
    id?: string;
    name?: string;
    label?: string;
    helperText?: string;
    errorMessage?: string;
    required?: boolean;
    disabled?: boolean;
    value?: string;
    onChange?: (value: string) => void;
    onCountryChange?: (countryCode: AndeanCountryCode) => void;
    defaultCountryCode?: AndeanCountryCode;
    className?: string;
    placeholder?: string;
}

const countries = getAndeanPhoneCountries();
const controlClassName = `
    h-11 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900
    transition-all duration-200 ease-out
    placeholder:text-slate-400
    focus:outline-none focus:ring-2 focus:ring-offset-1
    disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50
    hover:border-slate-300 focus:border-green-600 focus:ring-green-600/20
`;

export function AndeanPhoneInput({
    id,
    name,
    label,
    helperText,
    errorMessage,
    required = false,
    disabled = false,
    value,
    onChange,
    onCountryChange,
    defaultCountryCode = 'CO',
    className,
    placeholder,
}: AndeanPhoneInputProps) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const parsedValue = React.useMemo(
        () => splitAndeanPhoneValue(value, defaultCountryCode),
        [defaultCountryCode, value]
    );

    const [countryCode, setCountryCode] = React.useState<AndeanCountryCode>(parsedValue.countryCode);
    const [nationalNumber, setNationalNumber] = React.useState(parsedValue.nationalNumber);

    React.useEffect(() => {
        setCountryCode(parsedValue.countryCode);
        setNationalNumber(parsedValue.nationalNumber);
    }, [parsedValue.countryCode, parsedValue.nationalNumber]);

    const currentCountry = getAndeanPhoneCountry(countryCode);

    const emitChange = React.useCallback((nextNationalNumber: string, nextCountryCode: AndeanCountryCode) => {
        onChange?.(composeAndeanPhoneValue(nextNationalNumber, nextCountryCode));
    }, [onChange]);

    const handleCountryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextCountryCode = event.target.value as AndeanCountryCode;
        setCountryCode(nextCountryCode);
        onCountryChange?.(nextCountryCode);
        emitChange(nationalNumber, nextCountryCode);
    };

    const handleNationalNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const normalizedNumber = normalizeAndeanNationalNumber(event.target.value, countryCode);
        setNationalNumber(normalizedNumber);
        emitChange(normalizedNumber, countryCode);
    };

    return (
        <div className={cn('w-full space-y-2', className)}>
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}

            <div className="flex flex-col gap-3 min-[460px]:flex-row">
                <div className="relative w-full min-[460px]:w-36 min-[460px]:shrink-0 sm:w-44">
                    <select
                        aria-label="Prefijo del pais"
                        className={cn(
                            controlClassName,
                            'w-full appearance-none pr-10',
                            errorMessage && 'border-red-500 hover:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                        )}
                        disabled={disabled}
                        value={countryCode}
                        onChange={handleCountryChange}
                    >
                        {countries.map((country) => (
                            <option key={country.countryCode} value={country.countryCode}>
                                {`${country.prefix} ${country.displayName}`}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                <input
                    id={inputId}
                    name={name}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    disabled={disabled}
                    value={nationalNumber}
                    onChange={handleNationalNumberChange}
                    placeholder={placeholder || currentCountry.example || parsedValue.placeholder}
                    maxLength={currentCountry.nationalLength}
                    className={cn(
                        controlClassName,
                        'w-full',
                        errorMessage && 'border-red-500 hover:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                    )}
                    aria-invalid={Boolean(errorMessage)}
                    aria-describedby={
                        errorMessage
                            ? `${inputId}-error`
                            : helperText
                                ? `${inputId}-helper`
                                : undefined
                    }
                />
            </div>

            {(errorMessage || helperText) && (
                <p
                    id={errorMessage ? `${inputId}-error` : `${inputId}-helper`}
                    className={cn(
                        'text-sm',
                        errorMessage ? 'text-red-600' : 'text-slate-500'
                    )}
                >
                    {errorMessage || helperText}
                </p>
            )}
        </div>
    );
}
