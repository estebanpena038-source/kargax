import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    enforceMonthlyTripLimit,
    getPlanLimitErrorDetails,
    isPlanLimitError,
    resolveBusinessAccessContext,
} from '@/lib/server/warehouses';
import { isMissingGeoColumnError, resolveGeoLocationForWrite } from '@/lib/server/geo';
import { normalizePhoneForNotification } from '@/lib/phone/andean';
import { COLOMBIAN_DEPARTMENTS, getCitiesByDepartment, normalizeVehicleTypeCode } from '@/constants/colombia';
import {
    getBusinessPolicyCapabilities,
    resolveEffectiveBusinessRole,
} from '@/lib/server/role-policy';

const COUNTRY_TO_CURRENCY: Record<string, string> = {
    CO: 'COP',
    EC: 'USD',
    PE: 'PEN',
    BR: 'BRL',
};

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

interface ManifestItemInput {
    id?: string;
    name: string;
    quantity: number;
    reference?: string;
    imageUrl?: string;
    imageUrls?: string[];
    invoicePhotoUrls?: string[];
    description?: string;
    weightKg?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
}

interface CreateOfferRequest {
    cargoType: string;
    cargoDescription: string;
    weightKg?: number;
    dimensionLength?: number;
    dimensionWidth?: number;
    dimensionHeight?: number;
    quantity?: number;
    temperatureMin?: number;
    temperatureMax?: number;
    specialRequirements?: string;
    originDepartment: string;
    originCity: string;
    originAddress: string;
    originDepartmentId?: string | null;
    originMunicipalityId?: string | null;
    originLocalZoneId?: string | null;
    originLocalZoneName?: string | null;
    originLocalZoneType?: string | null;
    originAddressReference?: string | null;
    originLatitude?: number | null;
    originLongitude?: number | null;
    destinationDepartment: string;
    destinationCity: string;
    destinationAddress: string;
    destinationDepartmentId?: string | null;
    destinationMunicipalityId?: string | null;
    destinationLocalZoneId?: string | null;
    destinationLocalZoneName?: string | null;
    destinationLocalZoneType?: string | null;
    destinationAddressReference?: string | null;
    destDepartment?: string;
    destCity?: string;
    destAddress?: string;
    destinationLatitude?: number | null;
    destinationLongitude?: number | null;
    pickupDate: string;
    pickupTimeStart: string;
    pickupTimeEnd: string;
    deliveryDate: string;
    deliveryTimeStart: string;
    deliveryTimeEnd: string;
    totalAmount: number;
    ratePerKm?: number;
    paymentMethod: string;
    paymentSchedule: string;
    additionalTerms?: string;
    vehicleType: string;
    minExperienceYears: number;
    requiredLicenses?: string[];
    requiredCertifications?: string[];
    insuranceRequired: boolean;
    additionalRequirements?: string;
    publishImmediately?: boolean;
    manifestItems?: ManifestItemInput[];
    pickupContactName?: string;
    pickupContactPhone?: string;
    deliveryContactName?: string;
    deliveryContactPhone?: string;
    warehouseFlowMode?: 'manual' | 'warehouse_managed' | '3pl';
    originWarehouseId?: string;
    destinationWarehouseId?: string;
    originDockId?: string;
    destinationDockId?: string;
    assignmentMode?: 'public' | 'private';
    privateFleetTruckerId?: string;
    compensationMode?: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses';
    expensesReleasePolicy?: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual';
    expenseAllowanceAmount?: number;
    freightPaymentAmount?: number;
    privateFleetNotes?: string;
    sourceDispatchId?: string;
    dispatchTripMode?: 'dispatch_only' | 'private_fleet_trip' | 'marketplace_offer';
    countryCode?: 'CO' | 'EC' | 'PE' | 'BR';
    currencyCode?: 'COP' | 'USD' | 'PEN' | 'BRL';
    photos?: string[];
}

function slugifyManifestName(name: string): string {
    return (name || 'item')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || 'item';
}

function createManifestItemId(itemName: string, index: number): string {
    const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 10)}`;
    return `mi-${index + 1}-${slugifyManifestName(itemName)}-${randomId.slice(0, 8)}`;
}

function normalizeManifestItems(items: ManifestItemInput[] | undefined): ManifestItemInput[] {
    if (!Array.isArray(items)) return [];

    return items
        .filter((item) => item && item.name?.trim())
        .map((item, index) => ({
            id: item.id || createManifestItemId(item.name, index),
            name: item.name.trim(),
            quantity: Math.max(1, Number(item.quantity || 1)),
            reference: item.reference,
            imageUrl: item.imageUrl,
            imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.filter(Boolean).slice(0, 4) : [],
            invoicePhotoUrls: Array.isArray(item.invoicePhotoUrls) ? item.invoicePhotoUrls.filter(Boolean).slice(0, 2) : [],
            description: item.description,
            weightKg: Number(item.weightKg || 0) > 0 ? Number(item.weightKg) : undefined,
            lengthCm: Number(item.lengthCm || 0) > 0 ? Number(item.lengthCm) : undefined,
            widthCm: Number(item.widthCm || 0) > 0 ? Number(item.widthCm) : undefined,
            heightCm: Number(item.heightCm || 0) > 0 ? Number(item.heightCm) : undefined,
        }));
}

function getManifestTotals(items: ManifestItemInput[]) {
    return items.reduce(
        (totals, item) => {
            const quantity = Math.max(1, Number(item.quantity || 1));
            const weightKg = Math.max(0, Number(item.weightKg || 0));
            const lengthCm = Math.max(0, Number(item.lengthCm || 0));
            const widthCm = Math.max(0, Number(item.widthCm || 0));
            const heightCm = Math.max(0, Number(item.heightCm || 0));

            totals.quantity += quantity;
            totals.weightKg += weightKg * quantity;
            totals.volumeM3 += lengthCm && widthCm && heightCm
                ? (lengthCm * widthCm * heightCm * quantity) / 1000000
                : 0;
            return totals;
        },
        { quantity: 0, weightKg: 0, volumeM3: 0 }
    );
}

function inferMimeTypeFromPath(storagePath: string): string {
    const extension = storagePath.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'jpg':
        case 'jpeg':
        default:
            return 'image/jpeg';
    }
}

function extractStoragePath(photoUrl: string): string | null {
    const trimmed = photoUrl.trim();
    if (!trimmed) return null;

    if (!/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/^\/+/, '');
    }

    try {
        const url = new URL(trimmed);
        const marker = '/storage/v1/object/public/offer-photos/';
        const markerIndex = url.pathname.indexOf(marker);

        if (markerIndex >= 0) {
            return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
        }

        return decodeURIComponent(url.pathname.split('/').slice(-2).join('/'));
    } catch {
        return null;
    }
}

function hasValidCoordinates(latitude: unknown, longitude: unknown) {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
        return false;
    }

    if (String(latitude).trim() === '' || String(longitude).trim() === '') {
        return false;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    return Number.isFinite(lat)
        && Number.isFinite(lng)
        && !(lat === 0 && lng === 0)
        && lat >= -90
        && lat <= 90
        && lng >= -180
        && lng <= 180;
}

function normalizeLocationToken(value: string | null | undefined) {
    return String(value || '').trim();
}

function matchesLocationLabel(left: string, right: string) {
    return left.localeCompare(right, 'es', { sensitivity: 'base' }) === 0;
}

function resolveDepartmentCode(value: string | null | undefined) {
    const token = normalizeLocationToken(value);
    if (!token) return '';

    return COLOMBIAN_DEPARTMENTS.find((department) => (
        department.code.toUpperCase() === token.toUpperCase()
        || matchesLocationLabel(department.name, token)
    ))?.code || '';
}

function normalizeDepartmentName(value: string | null | undefined) {
    const token = normalizeLocationToken(value);
    if (!token) return '';

    return COLOMBIAN_DEPARTMENTS.find((department) => (
        department.code.toUpperCase() === token.toUpperCase()
        || matchesLocationLabel(department.name, token)
    ))?.name || token;
}

function normalizeCityName(cityValue: string | null | undefined, departmentValue: string | null | undefined) {
    const token = normalizeLocationToken(cityValue);
    if (!token) return '';

    const departmentCode = resolveDepartmentCode(departmentValue);
    const scopedCities = departmentCode ? getCitiesByDepartment(departmentCode) : [];
    const city = scopedCities.find((candidate) => (
        candidate.code.toUpperCase() === token.toUpperCase()
        || matchesLocationLabel(candidate.name, token)
    ));

    return city?.name || token;
}

function removeDiacritics(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeForSearch(value: string | null | undefined) {
    return removeDiacritics(String(value || ''))
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanGeocodePart(value: string | null | undefined) {
    return String(value || '')
        .trim()
        .replace(/#/g, ' ')
        .replace(/\s*-\s*/g, ' ')
        .replace(/[.,;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeStreetAddressForGeocoding(value: string | null | undefined) {
    return cleanGeocodePart(value)
        .replace(/\b(carrera|carrea|cra|cra\.|kr|kr\.|cr|cr\.)\s*(\d)/gi, 'Carrera $2')
        .replace(/\b(carrera|carrea|cra|cra\.|kr|kr\.|cr|cr\.)\b/gi, 'Carrera')
        .replace(/\b(calle|cll|cl|cl\.)\s*(\d)/gi, 'Calle $2')
        .replace(/\b(calle|cll|cl|cl\.)\b/gi, 'Calle')
        .replace(/\b(avenida|av|av\.)\s*(\d)/gi, 'Avenida $2')
        .replace(/\b(avenida|av|av\.)\b/gi, 'Avenida')
        .replace(/\b(transversal|tv|tv\.)\s*(\d)/gi, 'Transversal $2')
        .replace(/\b(transversal|tv|tv\.)\b/gi, 'Transversal')
        .replace(/\b(diagonal|dg|dg\.)\s*(\d)/gi, 'Diagonal $2')
        .replace(/\b(diagonal|dg|dg\.)\b/gi, 'Diagonal')
        .replace(/\b(barrio|barrcio|br|br\.)\s+/gi, 'Barrio ')
        .replace(/\b(no|nro|numero|num)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function withoutNeighborhoodWord(value: string) {
    return value.replace(/\b(barrio|barrcio|br|br\.)\s+/gi, '').replace(/\s+/g, ' ').trim();
}

function extractNeighborhood(value: string) {
    return value.match(/\b(barrio|barrcio|br|br\.)\s+([^,]+)/i)?.[2]?.trim() || '';
}

function buildGeocodeQueries(input: {
    address: string;
    city: string;
    department: string;
    countryCode: CreateOfferRequest['countryCode'];
}) {
    const country = COUNTRY_NAMES[input.countryCode || 'CO'] || COUNTRY_NAMES.CO;
    const address = normalizeStreetAddressForGeocoding(input.address);
    const addressWithoutNeighborhood = withoutNeighborhoodWord(address);
    const neighborhood = extractNeighborhood(address);
    const city = cleanGeocodePart(input.city);
    const department = cleanGeocodePart(input.department);
    const queries = [
        [addressWithoutNeighborhood, city, department, country],
        [address, city, department, country],
        [addressWithoutNeighborhood, neighborhood, city, department, country],
        [addressWithoutNeighborhood.replace(/\b(apto|apartamento|interior|int|local)\b.*$/i, '').trim(), city, department, country],
        [city, department, country],
    ]
        .map((parts) => parts.filter(Boolean).join(', '))
        .filter((query, index, all) => query.length >= 8 && all.indexOf(query) === index);

    return queries;
}

async function geocodeQuery(
    query: string,
    context?: {
        city?: string;
        department?: string;
        countryCode?: CreateOfferRequest['countryCode'];
    }
): Promise<GeocodeResult | null> {
    const googleKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY
        || process.env.GOOGLE_MAPS_API_KEY
        || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (googleKey) {
        const googleUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        googleUrl.searchParams.set('address', query);
        googleUrl.searchParams.set('key', googleKey);

        const googleResponse = await fetch(googleUrl, { cache: 'no-store' }).catch(() => null);
        if (googleResponse?.ok) {
            const json = await googleResponse.json().catch(() => null) as {
                status?: string;
                results?: Array<{
                    formatted_address?: string;
                    geometry?: { location?: { lat?: number; lng?: number } };
                }>;
            } | null;
            const first = json?.results?.[0];
            const latitude = Number(first?.geometry?.location?.lat);
            const longitude = Number(first?.geometry?.location?.lng);

            if (json?.status === 'OK' && hasValidCoordinates(latitude, longitude)) {
                return {
                    latitude,
                    longitude,
                    formattedAddress: first?.formatted_address || query,
                    provider: 'google',
                };
            }
        }
    }

    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('q', query);
    nominatimUrl.searchParams.set('format', 'jsonv2');
    nominatimUrl.searchParams.set('limit', '5');

    if (context?.countryCode) {
        nominatimUrl.searchParams.set('countrycodes', context.countryCode.toLowerCase());
    }

    const nominatimResponse = await fetch(nominatimUrl, {
        cache: 'no-store',
        headers: { 'User-Agent': 'KargaX/1.0 route geocoding' },
    }).catch(() => null);

    if (!nominatimResponse?.ok) return null;

    const rows = await nominatimResponse.json().catch(() => null) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
    }> | null;
    const normalizedCity = normalizeForSearch(context?.city);
    const normalizedDepartment = normalizeForSearch(context?.department);
    const candidates = (rows || [])
        .map((row) => {
            const display = normalizeForSearch(row.display_name);
            const cityScore = normalizedCity && display.includes(normalizedCity) ? 4 : 0;
            const departmentScore = normalizedDepartment && display.includes(normalizedDepartment) ? 2 : 0;
            return {
                row,
                score: cityScore + departmentScore,
            };
        })
        .sort((left, right) => right.score - left.score);
    const first = candidates.find((candidate) => candidate.score > 0)?.row || candidates[0]?.row;
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);

    if (!hasValidCoordinates(latitude, longitude)) return null;

    return {
        latitude,
        longitude,
        formattedAddress: first?.display_name || query,
        provider: 'nominatim',
    };
}

async function geocodeLocation(input: {
    address: string;
    city: string;
    department: string;
    countryCode: CreateOfferRequest['countryCode'];
}) {
    for (const query of buildGeocodeQueries(input)) {
        const result = await geocodeQuery(query, {
            city: input.city,
            department: input.department,
            countryCode: input.countryCode,
        });
        if (result) return result;
    }

    return null;
}

async function resolveRouteCoordinates(
    data: CreateOfferRequest,
    fallbackCountryCode?: string | null
): Promise<CreateOfferRequest> {
    const countryCode = data.countryCode || (fallbackCountryCode as CreateOfferRequest['countryCode']) || 'CO';
    const destinationDepartmentInput = data.destinationDepartment || data.destDepartment || '';
    const destinationCityInput = data.destinationCity || data.destCity || '';
    const destinationAddress = data.destinationAddress || data.destAddress || '';
    const originDepartment = normalizeDepartmentName(data.originDepartment);
    const originCity = normalizeCityName(data.originCity, data.originDepartment);
    const destinationDepartment = normalizeDepartmentName(destinationDepartmentInput);
    const destinationCity = normalizeCityName(destinationCityInput, destinationDepartmentInput);
    const originCoordinates = hasValidCoordinates(data.originLatitude, data.originLongitude)
        ? { latitude: Number(data.originLatitude), longitude: Number(data.originLongitude) }
        : await geocodeLocation({
            address: data.originAddress,
            city: originCity,
            department: originDepartment,
            countryCode,
        });
    const destinationCoordinates = hasValidCoordinates(data.destinationLatitude, data.destinationLongitude)
        ? { latitude: Number(data.destinationLatitude), longitude: Number(data.destinationLongitude) }
        : await geocodeLocation({
            address: destinationAddress,
            city: destinationCity,
            department: destinationDepartment,
            countryCode,
        });

    if (data.publishImmediately !== false && !originCoordinates) {
        throw new Error('No pudimos ubicar automaticamente la direccion de origen. Revisa direccion, ciudad y departamento.');
    }

    if (data.publishImmediately !== false && !destinationCoordinates) {
        throw new Error('No pudimos ubicar automaticamente la direccion de destino. Revisa direccion, ciudad y departamento.');
    }

    return {
        ...data,
        destinationAddress,
        destinationDepartment: destinationDepartmentInput,
        destinationCity: destinationCityInput,
        originLatitude: originCoordinates?.latitude ?? data.originLatitude ?? null,
        originLongitude: originCoordinates?.longitude ?? data.originLongitude ?? null,
        destinationLatitude: destinationCoordinates?.latitude ?? data.destinationLatitude ?? null,
        destinationLongitude: destinationCoordinates?.longitude ?? data.destinationLongitude ?? null,
    };
}

function toInsertPayload(data: CreateOfferRequest, businessId: string, fallbackCountryCode?: string | null) {
    const countryCode = data.countryCode || (fallbackCountryCode as CreateOfferRequest['countryCode']) || 'CO';
    const currencyCode = data.currencyCode || COUNTRY_TO_CURRENCY[countryCode] || 'COP';
    const pickupContactPhone = normalizePhoneForNotification(data.pickupContactPhone, countryCode);
    const deliveryContactPhone = normalizePhoneForNotification(data.deliveryContactPhone, countryCode);
    const isPrivateFleet = data.assignmentMode === 'private' && Boolean(data.privateFleetTruckerId);
    const compensationMode = isPrivateFleet ? (data.compensationMode || 'salary_no_trip_pay') : null;
    const allowsTripPay = compensationMode === 'trip_pay' || compensationMode === 'trip_pay_plus_expenses';
    const allowsExpenses = compensationMode === 'expenses_only' || compensationMode === 'trip_pay_plus_expenses';
    const freightPaymentAmount = allowsTripPay ? Number(data.freightPaymentAmount || data.totalAmount || 0) : 0;
    const expenseAllowanceAmount = allowsExpenses ? Number(data.expenseAllowanceAmount || 0) : 0;
    const publishImmediately = data.publishImmediately !== false;
    const vehicleType = normalizeVehicleTypeCode(data.vehicleType) || data.vehicleType;
    const paymentMethod = data.paymentMethod || 'bank_transfer';
    const paymentSchedule = data.paymentSchedule || 'on_delivery';
    const totalAmount = Number(data.totalAmount || 0);
    const manifestItems = normalizeManifestItems(data.manifestItems);
    const manifestTotals = getManifestTotals(manifestItems);
    const weightKg = manifestTotals.weightKg > 0 ? manifestTotals.weightKg : Math.max(1, Number(data.weightKg || 1));
    const quantity = manifestTotals.quantity > 0 ? manifestTotals.quantity : Math.max(1, Number(data.quantity || 1));
    const destinationDepartmentInput = data.destinationDepartment || data.destDepartment || '';
    const destinationCityInput = data.destinationCity || data.destCity || '';
    const destinationAddress = data.destinationAddress || data.destAddress || '';
    const originDepartment = normalizeDepartmentName(data.originDepartment);
    const originCity = normalizeCityName(data.originCity, data.originDepartment);
    const destinationDepartment = normalizeDepartmentName(destinationDepartmentInput);
    const destinationCity = normalizeCityName(destinationCityInput, destinationDepartmentInput);

    return {
        business_id: businessId,
        country_code: countryCode,
        currency_code: currencyCode,
        cargo_type: data.cargoType,
        cargo_description: data.cargoDescription,
        weight_kg: weightKg,
        dimension_length: data.dimensionLength,
        dimension_width: data.dimensionWidth,
        dimension_height: data.dimensionHeight,
        quantity,
        temperature_min: data.temperatureMin,
        temperature_max: data.temperatureMax,
        special_requirements: data.specialRequirements,
        origin_department: originDepartment,
        origin_city: originCity,
        origin_address: data.originAddress,
        origin_department_id: data.originDepartmentId || null,
        origin_municipality_id: data.originMunicipalityId || null,
        origin_local_zone_id: data.originLocalZoneId || null,
        origin_zone_name_legacy: data.originLocalZoneName || null,
        origin_address_reference: data.originAddressReference || null,
        origin_latitude: data.originLatitude ?? null,
        origin_longitude: data.originLongitude ?? null,
        destination_department: destinationDepartment,
        destination_city: destinationCity,
        destination_address: destinationAddress,
        destination_department_id: data.destinationDepartmentId || null,
        destination_municipality_id: data.destinationMunicipalityId || null,
        destination_local_zone_id: data.destinationLocalZoneId || null,
        destination_zone_name_legacy: data.destinationLocalZoneName || null,
        destination_address_reference: data.destinationAddressReference || null,
        destination_latitude: data.destinationLatitude ?? null,
        destination_longitude: data.destinationLongitude ?? null,
        pickup_date: data.pickupDate,
        pickup_time_start: data.pickupTimeStart,
        pickup_time_end: data.pickupTimeEnd,
        delivery_date: data.deliveryDate,
        delivery_time_start: data.deliveryTimeStart,
        delivery_time_end: data.deliveryTimeEnd,
        total_amount: isPrivateFleet ? freightPaymentAmount : totalAmount,
        rate_per_km: data.ratePerKm,
        payment_method: paymentMethod,
        payment_schedule: paymentSchedule,
        additional_terms: data.additionalTerms,
        vehicle_type: vehicleType,
        min_experience_years: data.minExperienceYears,
        required_licenses: data.requiredLicenses,
        required_certifications: data.requiredCertifications,
        insurance_required: data.insuranceRequired,
        additional_requirements: data.additionalRequirements,
        status: publishImmediately
            ? (isPrivateFleet ? 'assigned' : 'active')
            : 'draft',
        published_at: publishImmediately ? new Date().toISOString() : null,
        manifest_items: manifestItems,
        pickup_contact_name: data.pickupContactName || null,
        pickup_contact_phone: pickupContactPhone,
        delivery_contact_name: data.deliveryContactName || null,
        delivery_contact_phone: deliveryContactPhone,
        warehouse_flow_mode: data.warehouseFlowMode || null,
        source_dispatch_id: data.sourceDispatchId || null,
        dispatch_trip_mode: data.dispatchTripMode || null,
        origin_warehouse_id: data.originWarehouseId || null,
        destination_warehouse_id: data.destinationWarehouseId || null,
        origin_dock_id: data.originDockId || null,
        destination_dock_id: data.destinationDockId || null,
        is_private_fleet: isPrivateFleet,
        private_fleet_trucker_id: isPrivateFleet ? data.privateFleetTruckerId || null : null,
        assigned_trucker_id: isPrivateFleet ? data.privateFleetTruckerId || null : null,
        expense_allowance_amount: isPrivateFleet ? expenseAllowanceAmount : 0,
        freight_payment_amount: isPrivateFleet ? freightPaymentAmount : 0,
        compensation_mode: compensationMode,
        expenses_release_policy: isPrivateFleet ? (data.expensesReleasePolicy || 'acceptance') : null,
        private_payment_status: isPrivateFleet
            ? (freightPaymentAmount > 0 || expenseAllowanceAmount > 0 ? 'external_proof_pending' : 'not_applicable')
            : null,
        private_fleet_notes: data.privateFleetNotes || null,
        net_amount: isPrivateFleet ? freightPaymentAmount : undefined,
        platform_fee: isPrivateFleet ? 0 : undefined,
    };
}

export async function POST(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const effectiveRole = resolveEffectiveBusinessRole(profile, businessAccess);
    const roleCapabilities = getBusinessPolicyCapabilities(effectiveRole);
    const canCreateOffers = roleCapabilities.canCreateAnyOffer;
    const canManagePrivateMoney = roleCapabilities.canCreatePrivateOfferWithMoney;

    if (
        profile?.user_type !== 'business' &&
        profile?.user_type !== 'admin'
    ) {
        return NextResponse.json({ error: 'Only business and admin users can publish offers' }, { status: 403 });
    }

    if (profile?.user_type !== 'admin' && !canCreateOffers) {
        return NextResponse.json({ error: 'Tu rol no puede publicar o asignar rutas' }, { status: 403 });
    }

    const businessId = profile?.user_type === 'admin' ? businessAccess.businessId || authUser.id : businessAccess.businessId;

    if (!businessId) {
        return NextResponse.json({ error: 'Business access required' }, { status: 403 });
    }

    const body = (await request.json()) as CreateOfferRequest;
    if (body.assignmentMode === 'private' && !body.privateFleetTruckerId) {
        return NextResponse.json({ error: 'Selecciona un conductor de flota privada' }, { status: 400 });
    }

    const isPrivateFleet = body.assignmentMode === 'private' && Boolean(body.privateFleetTruckerId);
    const compensationMode = isPrivateFleet ? (body.compensationMode || 'salary_no_trip_pay') : null;
    const allowsTripPay = compensationMode === 'trip_pay' || compensationMode === 'trip_pay_plus_expenses';
    const allowsExpenses = compensationMode === 'expenses_only' || compensationMode === 'trip_pay_plus_expenses';
    const countryCode = body.countryCode || (profile as { country_code?: CreateOfferRequest['countryCode'] } | null)?.country_code || 'CO';
    const pickupContactPhone = normalizePhoneForNotification(body.pickupContactPhone, countryCode);
    const deliveryContactPhone = normalizePhoneForNotification(body.deliveryContactPhone, countryCode);
    let offerBody: CreateOfferRequest;
    const requestedFreightAmount = allowsTripPay
        ? Number(body.freightPaymentAmount || body.totalAmount || 0)
        : Number(body.freightPaymentAmount || 0);
    const requestedExpenseAmount = Number(body.expenseAllowanceAmount || 0);

    if (isPrivateFleet && compensationMode && !['salary_no_trip_pay', 'trip_pay', 'expenses_only', 'trip_pay_plus_expenses'].includes(compensationMode)) {
        return NextResponse.json({ error: 'Modo de compensacion privada invalido' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'salary_no_trip_pay' && Number(body.freightPaymentAmount || 0) > 0) {
        return NextResponse.json({ error: 'salary_no_trip_pay no permite pago por viaje dentro de KargaX' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'expenses_only' && Number(body.freightPaymentAmount || 0) > 0) {
        return NextResponse.json({ error: 'expenses_only no permite pago por viaje' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'salary_no_trip_pay' && requestedExpenseAmount > 0) {
        return NextResponse.json({ error: 'salary_no_trip_pay no permite viaticos dentro del viaje' }, { status: 400 });
    }

    if (isPrivateFleet && !allowsExpenses && requestedExpenseAmount > 0) {
        return NextResponse.json({ error: 'Este modo no permite gastos del viaje' }, { status: 400 });
    }

    if (isPrivateFleet && allowsTripPay && requestedFreightAmount <= 0) {
        return NextResponse.json({ error: 'Este modo requiere un pago por ruta mayor a cero' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'expenses_only' && requestedExpenseAmount <= 0) {
        return NextResponse.json({ error: 'Solo gastos requiere un valor de gastos mayor a cero' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'trip_pay_plus_expenses' && requestedExpenseAmount <= 0) {
        return NextResponse.json({ error: 'Ruta + viaticos requiere un valor de gastos mayor a cero' }, { status: 400 });
    }

    if (isPrivateFleet && (requestedFreightAmount > 0 || requestedExpenseAmount > 0) && !canManagePrivateMoney) {
        return NextResponse.json({ error: 'Solo owner/admin/contabilidad puede definir montos de flota privada' }, { status: 403 });
    }

    if (
        isPrivateFleet
        && body.publishImmediately !== false
        && (
            !body.pickupContactName?.trim()
            || !pickupContactPhone
            || !body.deliveryContactName?.trim()
            || !deliveryContactPhone
        )
    ) {
        return NextResponse.json({ error: 'Completa responsable y telefono validos de origen y entrega para enviar los PIN' }, { status: 400 });
    }

    try {
        offerBody = await resolveRouteCoordinates(body, (profile as { country_code?: string } | null)?.country_code);
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'No pudimos ubicar automaticamente la ruta.',
        }, { status: 400 });
    }

    if (
        offerBody.publishImmediately !== false
        && (
            !hasValidCoordinates(offerBody.originLatitude, offerBody.originLongitude)
            || !hasValidCoordinates(offerBody.destinationLatitude, offerBody.destinationLongitude)
        )
    ) {
        return NextResponse.json({ error: 'No pudimos calcular coordenadas validas para origen y destino. Revisa las direcciones.' }, { status: 400 });
    }

    try {
        const originGeo = await resolveGeoLocationForWrite(supabaseAdmin, authUser.id, {
            departmentId: offerBody.originDepartmentId,
            municipalityId: offerBody.originMunicipalityId,
            localZoneId: offerBody.originLocalZoneId,
            localZoneName: offerBody.originLocalZoneName,
            localZoneType: offerBody.originLocalZoneType,
            addressReference: offerBody.originAddressReference,
        });
        const destinationGeo = await resolveGeoLocationForWrite(supabaseAdmin, authUser.id, {
            departmentId: offerBody.destinationDepartmentId,
            municipalityId: offerBody.destinationMunicipalityId,
            localZoneId: offerBody.destinationLocalZoneId,
            localZoneName: offerBody.destinationLocalZoneName,
            localZoneType: offerBody.destinationLocalZoneType,
            addressReference: offerBody.destinationAddressReference,
        });

        offerBody = {
            ...offerBody,
            originDepartmentId: originGeo.departmentId,
            originMunicipalityId: originGeo.municipalityId,
            originLocalZoneId: originGeo.localZoneId,
            originLocalZoneName: originGeo.localZoneName || undefined,
            originAddressReference: originGeo.addressReference || undefined,
            destinationDepartmentId: destinationGeo.departmentId,
            destinationMunicipalityId: destinationGeo.municipalityId,
            destinationLocalZoneId: destinationGeo.localZoneId,
            destinationLocalZoneName: destinationGeo.localZoneName || undefined,
            destinationAddressReference: destinationGeo.addressReference || undefined,
        };
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Ubicacion oficial invalida',
        }, { status: 400 });
    }

    try {
        await enforceMonthlyTripLimit(supabaseAdmin, businessId);
    } catch (error) {
        if (isPlanLimitError(error)) {
            return NextResponse.json({
                success: false,
                data: null,
                error: {
                    message: error.message,
                    details: getPlanLimitErrorDetails(error),
                },
                code: 'PLAN_LIMIT_REACHED',
            }, { status: 402 });
        }

        console.warn('[Offers][POST] Monthly trip limit check unavailable; allowing offer creation.', {
            businessId,
            error: error instanceof Error ? error.message : error,
        });
    }

    if (isPrivateFleet) {
        const { data: fleetMember, error: fleetMemberError } = await supabaseAdmin
            .from('business_fleet_members')
            .select('id, status, trucker_id')
            .eq('business_id', businessId)
            .eq('trucker_id', body.privateFleetTruckerId || '')
            .maybeSingle();

        if (fleetMemberError) {
            return NextResponse.json({ error: fleetMemberError.message || 'No se pudo validar la flota privada' }, { status: 500 });
        }

        if (!fleetMember || fleetMember.status !== 'active') {
            return NextResponse.json({ error: 'El conductor seleccionado no pertenece a tu flota privada activa' }, { status: 409 });
        }

    }

    const insertPayload = toInsertPayload(offerBody, businessId, (profile as { country_code?: string } | null)?.country_code);
    let offerResult = await supabaseAdmin
        .from('cargo_offers')
        .insert(insertPayload)
        .select('id, status, assigned_trucker_id, private_fleet_trucker_id, is_private_fleet')
        .single();

    if (isMissingGeoColumnError(offerResult.error)) {
        const legacyPayload: Record<string, unknown> = { ...insertPayload };
        delete legacyPayload.country_code;
        delete legacyPayload.currency_code;
        delete legacyPayload.origin_department_id;
        delete legacyPayload.origin_municipality_id;
        delete legacyPayload.origin_local_zone_id;
        delete legacyPayload.origin_zone_name_legacy;
        delete legacyPayload.origin_address_reference;
        delete legacyPayload.destination_department_id;
        delete legacyPayload.destination_municipality_id;
        delete legacyPayload.destination_local_zone_id;
        delete legacyPayload.destination_zone_name_legacy;
        delete legacyPayload.destination_address_reference;
        offerResult = await supabaseAdmin
            .from('cargo_offers')
            .insert(legacyPayload)
            .select('id, status, assigned_trucker_id, private_fleet_trucker_id, is_private_fleet')
            .single();
    }

    const { data: offer, error } = offerResult;

    if (error || !offer) {
        return NextResponse.json({ error: error?.message || 'Could not create offer' }, { status: 500 });
    }

    const normalizedPhotos = Array.isArray(body.photos)
        ? body.photos
            .map((photoUrl) => extractStoragePath(photoUrl))
            .filter((photoPath): photoPath is string => Boolean(photoPath))
        : [];

    if (normalizedPhotos.length > 0) {
        const { error: photosError } = await supabaseAdmin
            .from('offer_photos')
            .insert(
                normalizedPhotos.map((storagePath, index) => ({
                    offer_id: offer.id,
                    storage_path: storagePath,
                    file_name: storagePath.split('/').pop() || `photo-${index + 1}.jpg`,
                    file_size: 0,
                    mime_type: inferMimeTypeFromPath(storagePath),
                    sort_order: index,
                }))
            );

        if (photosError) {
            return NextResponse.json({ error: photosError.message || 'No se pudieron guardar las fotos de la oferta' }, { status: 500 });
        }
    }

    if (isPrivateFleet && body.publishImmediately !== false) {
        const freightPaymentAmount = allowsTripPay ? Number(body.freightPaymentAmount || body.totalAmount || 0) : 0;
        const expenseAllowanceAmount = allowsExpenses ? Number(body.expenseAllowanceAmount || 0) : 0;
        const allocationRows = [
            freightPaymentAmount > 0 ? {
                offer_id: offer.id,
                business_id: businessId,
                trucker_id: body.privateFleetTruckerId,
                allocation_type: 'freight_payment',
                amount: freightPaymentAmount,
                status: 'external_proof_pending',
                release_trigger: 'manual',
                external_payment_status: 'pending_external_pay',
                metadata: {
                    source_kind: 'private_fleet_external_assignment',
                    compensation_mode: compensationMode,
                    wallet_touched: false,
                },
            } : null,
            expenseAllowanceAmount > 0 ? {
                offer_id: offer.id,
                business_id: businessId,
                trucker_id: body.privateFleetTruckerId,
                allocation_type: 'expense_advance',
                amount: expenseAllowanceAmount,
                status: 'external_proof_pending',
                release_trigger: 'manual',
                external_payment_status: 'pending_external_pay',
                metadata: {
                    source_kind: 'private_fleet_external_expense_assignment',
                    product_label: 'company_trip_expense',
                    compensation_mode: compensationMode,
                    wallet_touched: false,
                },
            } : null,
        ].filter((row): row is NonNullable<typeof row> => Boolean(row));

        if (allocationRows.length > 0) {
            const { error: allocationError } = await supabaseAdmin
                .from('trip_financial_allocations')
                .upsert(allocationRows, { onConflict: 'offer_id,allocation_type' });

            if (allocationError) {
                return NextResponse.json({ error: allocationError.message || 'No se pudo preparar la custodia privada' }, { status: 500 });
            }
        }

        await supabaseAdmin.rpc('create_notification', {
            p_user_id: body.privateFleetTruckerId,
            p_type: 'private_fleet_assignment',
            p_title: 'Nueva ruta directa asignada',
            p_message: expenseAllowanceAmount > 0
                ? `Tu empresa te asigno una ruta privada. Los gastos del viaje quedan como liquidacion externa con comprobante.`
                : 'Tu empresa te asigno una ruta privada. Confirma el viaje para iniciar el flujo operativo.',
            p_data: {
                offer_id: offer.id,
                business_id: businessId,
                freight_payment_amount: freightPaymentAmount,
                expense_allowance_amount: expenseAllowanceAmount,
            },
        });
    }

    return NextResponse.json({
        success: true,
        data: offer,
    }, { status: 201 });
}
