import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import {
    enforcePrivateFleetDriverLimit,
    getPlanLimitErrorDetails,
    isPlanLimitError,
    resolveBusinessAccessContext,
} from '@/lib/server/warehouses';
import { normalizePhoneForNotification } from '@/lib/phone/andean';
import { normalizeTeamCountryCode } from '@/lib/team/localization';
import { isValidTeamInviteEmail } from '@/lib/server/team-invitations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

type CreateFleetDriverPayload = {
    businessId?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    countryCode?: string;
    documentType?: string;
    documentNumber?: string;
    password?: string;
    licenseNumber?: string;
    licenseType?: string;
    yearsExperience?: number | string;
    vehiclePlate?: string;
    internalDriverId?: string;
    vehicleType?: string;
    serviceAreas?: string[];
    notes?: string;
};

function cleanText(value: unknown, maxLength = 240) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function cleanupCreatedAuthUser(
    supabaseAdmin: AdminClient,
    userId: string | null
) {
    if (!userId) {
        return;
    }

    try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (error) {
        console.error('[Fleet create-driver] Failed to cleanup auth user', userId, error);
    }
}

function normalizeYearsExperience(value: unknown) {
    const parsed = Math.round(Number(value || 0));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

    if (profile?.user_type !== 'admin' && (!businessAccess.businessId || !businessAccess.isOwner)) {
        return apiError('Solo owner/admin puede crear conductores privados', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_CREATE_DRIVER_FORBIDDEN',
        });
    }

    const body = await request.json().catch(() => ({})) as CreateFleetDriverPayload;
    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: body.businessId,
        resolvedBusinessId: businessAccess.businessId,
        profile,
    });

    if ('error' in scopedBusiness) {
        return apiError(scopedBusiness.error ?? 'Business scope invalid', {
            requestId,
            status: scopedBusiness.status,
            code: 'BUSINESS_FLEET_SCOPE_INVALID',
        });
    }

    const businessId = scopedBusiness.businessId;
    const email = cleanText(body.email, 320).toLowerCase();
    const fullName = cleanText(body.fullName);
    const phone = cleanText(body.phone, 80);
    const countryCode = normalizeTeamCountryCode(body.countryCode || profile?.country_code || 'CO');
    const documentType = cleanText(body.documentType, 40);
    const documentNumber = cleanText(body.documentNumber, 80);
    const password = typeof body.password === 'string' ? body.password : '';
    const licenseNumber = cleanText(body.licenseNumber, 80);
    const licenseType = cleanText(body.licenseType, 40);
    const yearsExperience = normalizeYearsExperience(body.yearsExperience);
    const vehiclePlate = cleanText(body.vehiclePlate, 20).toUpperCase();
    const internalDriverId = cleanText(body.internalDriverId, 50) || null;
    const vehicleType = cleanText(body.vehicleType, 80);
    const notes = cleanText(body.notes, 1000) || null;
    const serviceAreas = Array.isArray(body.serviceAreas)
        ? body.serviceAreas.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
        : [];

    if (!businessId) {
        return apiError('Business access required', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_BUSINESS_REQUIRED',
        });
    }

    if (!fullName) {
        return apiError('Nombre completo requerido', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_DRIVER_NAME_REQUIRED',
        });
    }

    if (!email || !isValidTeamInviteEmail(email)) {
        return apiError('Ingresa un correo valido para el conductor', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_DRIVER_EMAIL_INVALID',
        });
    }

    if (!phone) {
        return apiError('Telefono requerido', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_DRIVER_PHONE_REQUIRED',
        });
    }

    const normalizedPhone = normalizePhoneForNotification(phone, countryCode);
    if (!normalizedPhone) {
        return apiError('Selecciona un prefijo valido y usa un celular de CO, PE, EC o BR', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_DRIVER_PHONE_INVALID',
        });
    }

    if (!documentType || !documentNumber) {
        return apiError('Documento del conductor requerido', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_DRIVER_DOCUMENT_REQUIRED',
        });
    }

    if (!licenseNumber || !licenseType) {
        return apiError('Licencia del conductor requerida', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_DRIVER_LICENSE_REQUIRED',
        });
    }

    if (!vehiclePlate) {
        return apiError('Placa requerida para flota privada', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_DRIVER_PLATE_REQUIRED',
        });
    }

    if (password.length < 10) {
        return apiError('La contrasena inicial debe tener minimo 10 caracteres', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_DRIVER_PASSWORD_WEAK',
        });
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, user_type')
        .ilike('email', email)
        .maybeSingle();

    if (existingProfileError) {
        return apiError(existingProfileError.message || 'No se pudo validar el conductor existente', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_EXISTING_PROFILE_FAILED',
        });
    }

    if (existingProfile && existingProfile.user_type !== 'trucker') {
        return apiError('Este correo ya existe con un tipo de cuenta incompatible', {
            requestId,
            status: 409,
            code: 'BUSINESS_FLEET_EMAIL_INCOMPATIBLE',
        });
    }

    if (existingProfile) {
        const { data: existingFleetMember, error: existingFleetMemberError } = await supabaseAdmin
            .from('business_fleet_members')
            .select('id, status')
            .eq('business_id', businessId)
            .eq('trucker_id', existingProfile.id)
            .maybeSingle();

        if (existingFleetMemberError) {
            return apiError(existingFleetMemberError.message || 'No se pudo validar flota existente', {
                requestId,
                status: 500,
                code: 'BUSINESS_FLEET_EXISTING_MEMBER_FAILED',
            });
        }

        if (existingFleetMember) {
            return apiError('Este conductor ya pertenece a la flota privada de la empresa', {
                requestId,
                status: 409,
                code: 'BUSINESS_FLEET_DRIVER_ALREADY_EXISTS',
            });
        }
    }

    try {
        await enforcePrivateFleetDriverLimit(supabaseAdmin, businessId);
    } catch (error) {
        if (isPlanLimitError(error)) {
            return apiError(error.message, {
                requestId,
                status: 402,
                code: 'PLAN_LIMIT_REACHED',
                details: getPlanLimitErrorDetails(error),
            });
        }

        return apiError(error instanceof Error ? error.message : 'Limite de conductores alcanzado', {
            requestId,
            status: 409,
            code: 'BUSINESS_FLEET_LIMIT_REACHED',
        });
    }

    let userId = existingProfile?.id || null;
    let createdAuthUserId: string | null = null;
    const mode = existingProfile ? 'linked_existing_user' : 'created_user';

    if (!userId) {
        const { data: createdUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                phone: normalizedPhone,
                user_type: 'trucker',
                country_code: countryCode,
                document_type: documentType,
                document_number: documentNumber,
                corporate_fleet_created_by: authUser.id,
                corporate_fleet_business_id: businessId,
            },
        });

        if (createAuthError || !createdUser?.user?.id) {
            return apiError(createAuthError?.message || 'No se pudo crear el conductor en Auth', {
                requestId,
                status: createAuthError?.message?.toLowerCase().includes('already') ? 409 : 500,
                code: 'BUSINESS_FLEET_AUTH_CREATE_FAILED',
            });
        }

        userId = createdUser.user.id;
        createdAuthUserId = userId;
    }

    const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
            id: userId,
            email,
            full_name: fullName,
            phone: normalizedPhone,
            user_type: 'trucker',
            document_type: documentType,
            document_number: documentNumber,
            country_code: countryCode,
            is_verified: true,
            is_active: true,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

    if (profileError) {
        await cleanupCreatedAuthUser(supabaseAdmin, createdAuthUserId);
        return apiError(profileError.message || 'No se pudo guardar el perfil del conductor', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_PROFILE_SAVE_FAILED',
        });
    }

    const truckerProfilePayload: Record<string, unknown> = {
        user_id: userId,
        license_number: licenseNumber,
        license_type: licenseType,
        years_experience: yearsExperience,
        service_areas: serviceAreas,
        country_code: countryCode,
        updated_at: new Date().toISOString(),
    };

    if (vehicleType) {
        truckerProfilePayload.vehicle_types = [vehicleType];
    }

    const { error: truckerProfileError } = await supabaseAdmin
        .from('trucker_profiles')
        .upsert(truckerProfilePayload, { onConflict: 'user_id' });

    if (truckerProfileError) {
        await cleanupCreatedAuthUser(supabaseAdmin, createdAuthUserId);
        return apiError(truckerProfileError.message || 'No se pudo guardar el perfil operativo del conductor', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_TRUCKER_PROFILE_SAVE_FAILED',
        });
    }

    const { data: member, error: memberError } = await supabaseAdmin
        .from('business_fleet_members')
        .insert({
            business_id: businessId,
            trucker_id: userId,
            status: 'active',
            internal_driver_id: internalDriverId,
            vehicle_plate: vehiclePlate,
            notes,
            created_by: authUser.id,
        })
        .select('*')
        .single();

    if (memberError || !member) {
        await cleanupCreatedAuthUser(supabaseAdmin, createdAuthUserId);
        return apiError(memberError?.message || 'No se pudo activar el conductor en la flota', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_MEMBER_SAVE_FAILED',
        });
    }

    return apiSuccess({
        data: member,
        mode,
    }, {
        requestId,
        code: 'BUSINESS_FLEET_DRIVER_CREATED',
        status: 201,
    });
}
