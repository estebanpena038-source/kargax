import { COUNTRY_REGISTRY } from '@/lib/platform/market-registry';

export type AndeanCountryCode = 'CO' | 'PE' | 'EC' | 'BR';

export interface AndeanPhoneCountry {
    countryCode: AndeanCountryCode;
    displayName: string;
    prefix: string;
    nationalLength: number;
    mobilePattern: RegExp;
    example: string;
}

const ANDEAN_PHONE_METADATA: Record<AndeanCountryCode, Omit<AndeanPhoneCountry, 'displayName'>> = {
    CO: {
        countryCode: 'CO',
        prefix: '+57',
        nationalLength: 10,
        mobilePattern: /^3\d{9}$/,
        example: '300 123 4567',
    },
    PE: {
        countryCode: 'PE',
        prefix: '+51',
        nationalLength: 9,
        mobilePattern: /^9\d{8}$/,
        example: '912 345 678',
    },
    EC: {
        countryCode: 'EC',
        prefix: '+593',
        nationalLength: 9,
        mobilePattern: /^9\d{8}$/,
        example: '912 345 678',
    },
    BR: {
        countryCode: 'BR',
        prefix: '+55',
        nationalLength: 11,
        mobilePattern: /^[1-9]{2}9\d{8}$/,
        example: '11 91234 5678',
    },
};

const ANDEAN_COUNTRY_ORDER: AndeanCountryCode[] = ['CO', 'PE', 'EC', 'BR'];

export const ANDEAN_PHONE_COUNTRIES: AndeanPhoneCountry[] = ANDEAN_COUNTRY_ORDER.map((countryCode) => {
    const registryCountry = COUNTRY_REGISTRY.find((entry) => entry.country_code === countryCode);
    const metadata = ANDEAN_PHONE_METADATA[countryCode];

    return {
        ...metadata,
        displayName: registryCountry?.display_name || countryCode,
    };
});

export function getAndeanPhoneCountries() {
    return ANDEAN_PHONE_COUNTRIES;
}

export function getAndeanPhoneCountry(countryCode?: string | null) {
    const normalizedCountryCode = (countryCode || 'CO').toUpperCase() as AndeanCountryCode;

    return ANDEAN_PHONE_COUNTRIES.find((country) => country.countryCode === normalizedCountryCode)
        || ANDEAN_PHONE_COUNTRIES[0];
}

export function detectAndeanCountryFromPhone(value?: string | null) {
    const digits = (value || '').replace(/\D/g, '');
    const sortedCountries = [...ANDEAN_PHONE_COUNTRIES].sort(
        (left, right) => right.prefix.length - left.prefix.length
    );

    return sortedCountries.find((country) => digits.startsWith(country.prefix.replace(/\D/g, '')))
        || null;
}

function stripCountryPrefix(digits: string, country: AndeanPhoneCountry) {
    const prefixDigits = country.prefix.replace(/\D/g, '');

    if (digits.startsWith(prefixDigits)) {
        return digits.slice(prefixDigits.length);
    }

    return digits;
}

export function normalizeAndeanNationalNumber(
    value?: string | null,
    countryCode?: string | null
) {
    const country = getAndeanPhoneCountry(countryCode);
    let digits = (value || '').replace(/\D/g, '');

    if (!digits) {
        return '';
    }

    digits = stripCountryPrefix(digits, country);

    if (digits.length === country.nationalLength + 1 && digits.startsWith('0')) {
        digits = digits.slice(1);
    }

    return digits.slice(0, country.nationalLength);
}

export function composeAndeanPhoneValue(
    nationalNumber: string,
    countryCode?: string | null
) {
    const country = getAndeanPhoneCountry(countryCode);
    const normalizedNationalNumber = normalizeAndeanNationalNumber(nationalNumber, country.countryCode);

    return normalizedNationalNumber
        ? `${country.prefix}${normalizedNationalNumber}`
        : '';
}

export function splitAndeanPhoneValue(
    value?: string | null,
    fallbackCountryCode?: string | null
) {
    const detectedCountry = detectAndeanCountryFromPhone(value);
    const country = detectedCountry || getAndeanPhoneCountry(fallbackCountryCode);
    const nationalNumber = normalizeAndeanNationalNumber(value, country.countryCode);

    return {
        countryCode: country.countryCode,
        prefix: country.prefix,
        nationalNumber,
        e164: nationalNumber ? `${country.prefix}${nationalNumber}` : '',
        placeholder: country.example,
    };
}

export function validateAndeanPhoneValue(
    value?: string | null,
    fallbackCountryCode?: string | null
) {
    if (!value?.trim()) {
        return false;
    }

    const detectedCountry = detectAndeanCountryFromPhone(value);
    const country = detectedCountry || getAndeanPhoneCountry(fallbackCountryCode);
    const nationalNumber = normalizeAndeanNationalNumber(value, country.countryCode);

    return country.mobilePattern.test(nationalNumber);
}

export function normalizePhoneForNotification(
    value?: string | null,
    fallbackCountryCode?: string | null
) {
    if (!value?.trim()) {
        return null;
    }

    const detectedCountry = detectAndeanCountryFromPhone(value);
    const country = detectedCountry || getAndeanPhoneCountry(fallbackCountryCode);
    const nationalNumber = normalizeAndeanNationalNumber(value, country.countryCode);

    if (country.mobilePattern.test(nationalNumber)) {
        return `${country.prefix}${nationalNumber}`;
    }

    const genericDigits = value.replace(/\D/g, '');

    if (value.trim().startsWith('+') && genericDigits.length >= 8 && genericDigits.length <= 15) {
        return `+${genericDigits}`;
    }

    return null;
}

export function formatAndeanPhoneForDisplay(
    value?: string | null,
    fallbackCountryCode?: string | null
) {
    const trimmedValue = value?.trim();

    if (!trimmedValue) {
        return '';
    }

    const { countryCode, prefix, nationalNumber } = splitAndeanPhoneValue(trimmedValue, fallbackCountryCode);

    if (!nationalNumber) {
        return trimmedValue;
    }

    if (countryCode === 'CO' && nationalNumber.length === 10) {
        return `${prefix} ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
    }

    if ((countryCode === 'PE' || countryCode === 'EC') && nationalNumber.length === 9) {
        return `${prefix} ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
    }

    if (countryCode === 'BR' && nationalNumber.length === 11) {
        return `${prefix} ${nationalNumber.slice(0, 2)} ${nationalNumber.slice(2, 7)} ${nationalNumber.slice(7)}`;
    }

    return `${prefix} ${nationalNumber}`;
}
