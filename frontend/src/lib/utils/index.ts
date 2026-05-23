// =============================================================================
// KargaX - Utility Functions
// =============================================================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// =============================================================================
// ClassName Merging (Tailwind)
// =============================================================================
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// =============================================================================
// Date Formatting (Colombia)
// =============================================================================
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
    });
}

export function formatDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatRelativeTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;

    return formatDate(d, { month: 'short', day: 'numeric' });
}

// =============================================================================
// Currency Formatting (COP)
// =============================================================================
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatNumber(num: number): string {
    return new Intl.NumberFormat('es-CO').format(num);
}

// =============================================================================
// Phone Formatting
// =============================================================================
export function formatPhone(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
        return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    if (clean.length === 12 && clean.startsWith('57')) {
        return `+57 (${clean.slice(2, 5)}) ${clean.slice(5, 8)}-${clean.slice(8)}`;
    }
    return phone;
}

// =============================================================================
// String Utilities
// =============================================================================
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// =============================================================================
// Object Utilities
// =============================================================================
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    keys.forEach((key) => delete result[key]);
    return result;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach((key) => {
        if (key in obj) result[key] = obj[key];
    });
    return result;
}

// =============================================================================
// Async Utilities
// =============================================================================
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) {
                await sleep(delay * attempt);
            }
        }
    }

    throw lastError;
}

// =============================================================================
// Validation Utilities
// =============================================================================
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidColombianPhone(phone: string): boolean {
    const clean = phone.replace(/\D/g, '');
    return clean.length === 10 || (clean.length === 12 && clean.startsWith('57'));
}

export function isValidNIT(nit: string): boolean {
    const clean = nit.replace(/\D/g, '');
    return clean.length >= 9 && clean.length <= 10;
}

export function isValidPlate(plate: string): boolean {
    return /^[A-Z]{3}\d{3}$/.test(plate.toUpperCase());
}

// =============================================================================
// Storage Utilities
// =============================================================================
export const storage = {
    get: <T>(key: string, defaultValue: T): T => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },

    set: <T>(key: string, value: T): void => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            console.warn('Failed to save to localStorage');
        }
    },

    remove: (key: string): void => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
    },
};

// =============================================================================
// Error Handling
// =============================================================================
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Ha ocurrido un error inesperado';
}

// =============================================================================
// ID Generation
// =============================================================================
export function generateId(): string {
    return crypto.randomUUID();
}
