import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeoZoneType } from '@/lib/geo/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

export type GeoLocationWriteInput = {
    departmentId?: string | null;
    municipalityId?: string | null;
    localZoneId?: string | null;
    localZoneName?: string | null;
    localZoneType?: GeoZoneType | string | null;
    addressReference?: string | null;
};

export type ResolvedGeoLocation = {
    departmentId: string | null;
    municipalityId: string | null;
    localZoneId: string | null;
    localZoneName: string | null;
    addressReference: string | null;
};

const VALID_ZONE_TYPES = new Set<GeoZoneType>([
    'barrio',
    'localidad',
    'comuna',
    'vereda',
    'corregimiento',
    'centro_poblado',
    'sector',
    'otro',
]);

export function cleanGeoText(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function normalizeGeoText(value: unknown) {
    return cleanGeoText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function isValidZoneType(value: string): value is GeoZoneType {
    return VALID_ZONE_TYPES.has(value as GeoZoneType);
}

export function isMissingGeoColumnError(error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
    return code === '42703';
}

async function validateGeoLocation(
    supabaseAdmin: AdminClient,
    input: Pick<ResolvedGeoLocation, 'departmentId' | 'municipalityId' | 'localZoneId'>
) {
    if (!input.departmentId && !input.municipalityId && !input.localZoneId) {
        return;
    }

    if (!input.departmentId || !input.municipalityId) {
        throw new Error('Departamento y municipio oficiales deben enviarse juntos.');
    }

    const { data, error } = await supabaseAdmin.rpc('geo_validate_location', {
        p_department_id: input.departmentId,
        p_municipality_id: input.municipalityId,
        p_local_zone_id: input.localZoneId || null,
    });

    if (error) {
        throw new Error(error.message || 'No se pudo validar la ubicacion oficial.');
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.is_valid) {
        throw new Error(result?.message || 'La ubicacion oficial no es valida.');
    }
}

async function createManualLocalZone(
    supabaseAdmin: AdminClient,
    authUserId: string,
    input: {
        departmentId: string;
        municipalityId: string;
        localZoneName: string;
        localZoneType?: string | null;
    }
) {
    const name = cleanGeoText(input.localZoneName);
    if (!name) return null;
    if (name.length > 120) {
        throw new Error('La zona interna es demasiado larga.');
    }

    const zoneType = isValidZoneType(cleanGeoText(input.localZoneType))
        ? cleanGeoText(input.localZoneType) as GeoZoneType
        : 'otro';
    const normalizedName = normalizeGeoText(name);

    const { data: municipality, error: municipalityError } = await supabaseAdmin
        .from('geo_municipalities')
        .select('id, department_id')
        .eq('id', input.municipalityId)
        .eq('is_active', true)
        .maybeSingle();

    if (municipalityError || !municipality) {
        throw new Error(municipalityError?.message || 'Municipio no encontrado.');
    }

    if (municipality.department_id !== input.departmentId) {
        throw new Error('El municipio no pertenece al departamento seleccionado.');
    }

    const insertPayload = {
        department_id: input.departmentId,
        municipality_id: input.municipalityId,
        name,
        normalized_name: normalizedName,
        zone_type: zoneType,
        source: 'user_input',
        source_url: null,
        confidence: 0.25,
        is_user_submitted: true,
        needs_review: true,
        created_by: authUserId,
        is_active: true,
    };

    const { data, error } = await supabaseAdmin
        .from('geo_local_zones')
        .insert(insertPayload)
        .select('id')
        .single();

    if (!error) {
        return data?.id || null;
    }

    if (error.code !== '23505') {
        throw new Error(error.message || 'No se pudo guardar la zona interna.');
    }

    const { data: existing, error: existingError } = await supabaseAdmin
        .from('geo_local_zones')
        .select('id')
        .eq('municipality_id', input.municipalityId)
        .eq('normalized_name', normalizedName)
        .eq('zone_type', zoneType)
        .maybeSingle();

    if (existingError) {
        throw new Error(existingError.message || 'No se pudo consultar la zona interna existente.');
    }

    return existing?.id || null;
}

export async function resolveGeoLocationForWrite(
    supabaseAdmin: AdminClient,
    authUserId: string,
    input: GeoLocationWriteInput
): Promise<ResolvedGeoLocation> {
    const departmentId = cleanGeoText(input.departmentId) || null;
    const municipalityId = cleanGeoText(input.municipalityId) || null;
    let localZoneId = cleanGeoText(input.localZoneId) || null;
    const localZoneName = cleanGeoText(input.localZoneName) || null;
    const addressReference = cleanGeoText(input.addressReference) || null;

    await validateGeoLocation(supabaseAdmin, { departmentId, municipalityId, localZoneId });

    if (!localZoneId && departmentId && municipalityId && localZoneName) {
        localZoneId = await createManualLocalZone(supabaseAdmin, authUserId, {
            departmentId,
            municipalityId,
            localZoneName,
            localZoneType: input.localZoneType,
        });
        await validateGeoLocation(supabaseAdmin, { departmentId, municipalityId, localZoneId });
    }

    return {
        departmentId,
        municipalityId,
        localZoneId,
        localZoneName,
        addressReference,
    };
}
