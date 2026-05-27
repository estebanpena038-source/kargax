'use client';

import * as React from 'react';
import { CheckCircle2, ExternalLink, Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';

export type CoordinateValue = {
    latitude?: number | null;
    longitude?: number | null;
    formattedAddress?: string | null;
    provider?: string | null;
};

type CoordinatePickerProps = {
    label: string;
    address?: string;
    city?: string;
    department?: string;
    countryCode?: 'CO' | 'EC' | 'PE' | 'BR';
    value: CoordinateValue;
    onChange: (value: CoordinateValue) => void;
    helperText?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
};

function toNumber(value: string) {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasCoordinates(value: CoordinateValue) {
    if (value.latitude === null || value.latitude === undefined || value.longitude === null || value.longitude === undefined) {
        return false;
    }

    if (String(value.latitude).trim() === '' || String(value.longitude).trim() === '') {
        return false;
    }

    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);

    return Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && !(latitude === 0 && longitude === 0);
}

function mapsUrl(latitude: number, longitude: number) {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function embedUrl(latitude: number, longitude: number) {
    return `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
}

export function CoordinatePicker({
    label,
    address,
    city,
    department,
    countryCode = 'CO',
    value,
    onChange,
    helperText,
    disabled = false,
    required = false,
    className,
}: CoordinatePickerProps) {
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    const ready = hasCoordinates(value);

    const handleGeocode = React.useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const params = new URLSearchParams({
                address: address || '',
                city: city || '',
                department: department || '',
                country: countryCode,
            });
            const response = await fetch(`/api/geocode?${params.toString()}`, {
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
            });
            const json = await response.json().catch(() => null) as {
                success?: boolean;
                data?: CoordinateValue;
                error?: string;
            } | null;

            if (!response.ok || !json?.success || !json.data) {
                throw new Error(json?.error || 'No se pudieron encontrar coordenadas.');
            }

            onChange({
                latitude: json.data.latitude,
                longitude: json.data.longitude,
                formattedAddress: json.data.formattedAddress || null,
                provider: json.data.provider || null,
            });
        } catch (geocodeError) {
            setError(geocodeError instanceof Error ? geocodeError.message : 'No se pudieron encontrar coordenadas.');
        } finally {
            setLoading(false);
        }
    }, [address, city, countryCode, department, onChange]);

    const handleUseCurrentLocation = React.useCallback(() => {
        setError('');

        if (!('geolocation' in navigator)) {
            setError('Este dispositivo no soporta GPS.');
            return;
        }

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                onChange({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    formattedAddress: 'Coordenadas capturadas con GPS del dispositivo',
                    provider: 'device_gps',
                });
                setLoading(false);
            },
            (gpsError) => {
                setError(gpsError.code === gpsError.PERMISSION_DENIED
                    ? 'Permiso de ubicacion denegado. Activalo en el celular para capturar este punto.'
                    : 'No se pudo leer el GPS del dispositivo.');
                setLoading(false);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );
    }, [onChange]);

    return (
        <div className={cn('rounded-lg border border-zinc-200 bg-white p-4', className)}>
            <div className="flex flex-col gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-zinc-800" />
                        <p className="text-sm font-semibold text-zinc-950">
                            {label}{required ? ' *' : ''}
                        </p>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {helperText || 'Confirma el punto GPS exacto que usara el conductor.'}
                    </p>
                </div>
                {ready ? (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-zinc-950 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Coordenadas listas
                    </span>
                ) : null}
            </div>

            <div className="mt-4 grid gap-3">
                <Input
                    label="Latitud"
                    inputMode="decimal"
                    value={value.latitude ?? ''}
                    onChange={(event) => onChange({ ...value, latitude: toNumber(event.target.value) })}
                    placeholder="4.711000"
                    disabled={disabled}
                />
                <Input
                    label="Longitud"
                    inputMode="decimal"
                    value={value.longitude ?? ''}
                    onChange={(event) => onChange({ ...value, longitude: toNumber(event.target.value) })}
                    placeholder="-74.072100"
                    disabled={disabled}
                />
            </div>

            <div className="mt-3 flex flex-col gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={loading}
                    disabled={disabled || loading || !address || !city || !department}
                    onClick={handleGeocode}
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar coordenadas
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || loading}
                    onClick={handleUseCurrentLocation}
                >
                    <LocateFixed className="h-4 w-4" />
                    Usar mi GPS actual
                </Button>
                {ready ? (
                    <Button type="button" variant="ghost" size="sm" asChild>
                        <a href={mapsUrl(latitude, longitude)} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            Ver en Google Maps
                        </a>
                    </Button>
                ) : null}
            </div>

            {error ? (
                <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium text-zinc-950">
                    {error}
                </p>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                {ready ? (
                    <iframe
                        title={`Mapa ${label}`}
                        src={embedUrl(latitude, longitude)}
                        className="h-56 w-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                ) : (
                    <div className="flex h-40 flex-col items-center justify-center px-4 text-center text-sm text-zinc-500">
                        <MapPin className="mb-2 h-6 w-6 text-zinc-400" />
                        Busca la direccion o captura el punto con GPS.
                    </div>
                )}
            </div>

            {value.formattedAddress ? (
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Punto confirmado: {value.formattedAddress}
                </p>
            ) : null}
        </div>
    );
}

export default CoordinatePicker;
