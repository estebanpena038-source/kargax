import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { getCityName, getDepartmentName } from '@/constants/colombia';

const COUNTRY_NAMES: Record<string, string> = {
    CO: 'Colombia',
    EC: 'Ecuador',
    PE: 'Peru',
    BR: 'Brasil',
};

type GeocodeResult = {
    latitude: number;
    longitude: number;
    formattedAddress: string;
    provider: 'google' | 'nominatim';
};

function clean(value: string | null) {
    return (value || '')
        .trim()
        .replace(/#/g, ' ')
        .replace(/\s+/g, ' ');
}

function buildQuery(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const address = clean(params.get('address'));
    const city = getCityName(clean(params.get('city')));
    const department = getDepartmentName(clean(params.get('department')));
    const country = COUNTRY_NAMES[clean(params.get('country'))] || COUNTRY_NAMES.CO;

    return [address, city, department, country]
        .filter(Boolean)
        .join(', ');
}

function isValidCoordinate(latitude: number, longitude: number) {
    return Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && latitude >= -90
        && latitude <= 90
        && longitude >= -180
        && longitude <= 180;
}

async function geocodeWithGoogle(query: string): Promise<GeocodeResult | null> {
    const key = process.env.GOOGLE_MAPS_GEOCODING_API_KEY
        || process.env.GOOGLE_MAPS_API_KEY
        || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!key) return null;

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('key', key);

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;

    const json = await response.json() as {
        status?: string;
        results?: Array<{
            formatted_address?: string;
            geometry?: { location?: { lat?: number; lng?: number } };
        }>;
    };
    const first = json.results?.[0];
    const latitude = Number(first?.geometry?.location?.lat);
    const longitude = Number(first?.geometry?.location?.lng);

    if (json.status !== 'OK' || !isValidCoordinate(latitude, longitude)) {
        return null;
    }

    return {
        latitude,
        longitude,
        formattedAddress: first?.formatted_address || query,
        provider: 'google',
    };
}

async function geocodeWithNominatim(query: string): Promise<GeocodeResult | null> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');

    const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            'User-Agent': 'KargaX/1.0 GPS route verification',
        },
    });

    if (!response.ok) return null;

    const json = await response.json() as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
    }>;
    const first = json[0];
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);

    if (!isValidCoordinate(latitude, longitude)) {
        return null;
    }

    return {
        latitude,
        longitude,
        formattedAddress: first?.display_name || query,
        provider: 'nominatim',
    };
}

export async function GET(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const query = buildQuery(request);

    if (query.length < 8) {
        return NextResponse.json({
            success: false,
            error: 'Completa direccion, ciudad y departamento para buscar coordenadas.',
        }, { status: 400 });
    }

    try {
        const result = await geocodeWithGoogle(query) || await geocodeWithNominatim(query);

        if (!result) {
            return NextResponse.json({
                success: false,
                error: 'No se encontraron coordenadas para esa direccion. Ajusta la direccion o ingresa latitud/longitud manualmente.',
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[Geocode][GET]', error);
        return NextResponse.json({
            success: false,
            error: 'No se pudo consultar el proveedor de mapas.',
        }, { status: 500 });
    }
}
