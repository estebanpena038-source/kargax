import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import {
    enforceBusinessTeamSeatLimit,
    getBusinessTeamInfrastructureStatus,
    getPlanLimitErrorDetails,
    isPlanLimitError,
    resolveBusinessAccessContext,
    setActiveWarehousePreference,
} from '@/lib/server/warehouses';
import {
    isEditableBusinessTeamRole,
    toWarehouseMembershipRole,
    type EditableBusinessTeamRole,
} from '@/lib/business-roles';
import { normalizePhoneForNotification } from '@/lib/phone/andean';
import { normalizeTeamCountryCode } from '@/lib/team/localization';
import { isValidTeamInviteEmail } from '@/lib/server/team-invitations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

type CreateTeamUserPayload = {
    businessId?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    countryCode?: string;
    documentType?: string;
    documentNumber?: string;
    role?: EditableBusinessTeamRole;
    password?: string;
    warehouseIds?: string[];
};

function cleanText(value: unknown, maxLength = 240) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getWriteError(error: { message?: string | null } | null | undefined) {
    const message = error?.message || 'No se pudo crear el usuario interno';
    const normalized = message.toLowerCase();

    if (normalized.includes('role_check') || normalized.includes('business_team_members_role_check')) {
        return 'Aplica la migracion 046_business_role_presets.sql para crear usuarios con roles empresariales avanzados.';
    }

    return message;
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
        console.error('[Team create-user] Failed to cleanup auth user', userId, error);
    }
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
        return apiError('Solo owner/admin puede crear usuarios internos', {
            requestId,
            status: 403,
            code: 'BUSINESS_TEAM_CREATE_FORBIDDEN',
        });
    }

    const body = await request.json().catch(() => ({})) as CreateTeamUserPayload;
    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: body.businessId,
        resolvedBusinessId: businessAccess.businessId,
        profile,
    });

    if ('error' in scopedBusiness) {
        return apiError(scopedBusiness.error ?? 'Business scope invalid', {
            requestId,
            status: scopedBusiness.status,
            code: 'BUSINESS_TEAM_SCOPE_INVALID',
        });
    }

    const businessId = scopedBusiness.businessId;
    const email = cleanText(body.email, 320).toLowerCase();
    const fullName = cleanText(body.fullName);
    const phone = cleanText(body.phone, 80);
    const role = body.role || 'warehouse_operator';
    const password = typeof body.password === 'string' ? body.password : '';
    const countryCode = normalizeTeamCountryCode(body.countryCode || profile?.country_code || 'CO');
    const documentType = cleanText(body.documentType, 40) || null;
    const documentNumber = cleanText(body.documentNumber, 80) || null;
    const warehouseIds = Array.isArray(body.warehouseIds)
        ? Array.from(new Set(body.warehouseIds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))))
        : [];

    if (!businessId) {
        return apiError('Business access required', {
            requestId,
            status: 403,
            code: 'BUSINESS_TEAM_BUSINESS_REQUIRED',
        });
    }

    if (!fullName) {
        return apiError('Nombre completo requerido', {
            requestId,
            status: 400,
            code: 'BUSINESS_TEAM_NAME_REQUIRED',
        });
    }

    if (!email || !isValidTeamInviteEmail(email)) {
        return apiError('Ingresa un correo valido para el usuario interno', {
            requestId,
            status: 400,
            code: 'BUSINESS_TEAM_EMAIL_INVALID',
        });
    }

    if (!phone) {
        return apiError('Telefono requerido', {
            requestId,
            status: 400,
            code: 'BUSINESS_TEAM_PHONE_REQUIRED',
        });
    }

    const normalizedPhone = normalizePhoneForNotification(phone, countryCode);
    if (!normalizedPhone) {
        return apiError('Selecciona un prefijo valido y usa un celular de CO, PE, EC o BR', {
            requestId,
            status: 400,
            code: 'BUSINESS_TEAM_PHONE_INVALID',
        });
    }

    if (!isEditableBusinessTeamRole(role)) {
        return apiError('Rol empresarial invalido', {
            requestId,
            status: 400,
            code: 'BUSINESS_TEAM_ROLE_INVALID',
        });
    }

    if (password.length < 10) {
        return apiError('La contrasena inicial debe tener minimo 10 caracteres', {
            requestId,
            status: 400,
            code: 'BUSINESS_TEAM_PASSWORD_WEAK',
        });
    }

    const teamInfrastructure = await getBusinessTeamInfrastructureStatus(supabaseAdmin);
    if (!teamInfrastructure.ready) {
        return apiError(teamInfrastructure.message || 'Business team infrastructure is not ready', {
            requestId,
            status: 503,
            code: 'BUSINESS_TEAM_SCHEMA_MISSING',
        });
    }

    const { data: companyWarehouses, error: warehousesError } = await supabaseAdmin
        .from('warehouses')
        .select('id')
        .eq('business_id', businessId);

    if (warehousesError) {
        return apiError(warehousesError.message || 'No se pudieron validar bodegas', {
            requestId,
            status: 500,
            code: 'BUSINESS_TEAM_WAREHOUSE_VALIDATE_FAILED',
        });
    }

    const companyWarehouseIds = new Set((companyWarehouses || []).map((warehouse) => warehouse.id));
    if (warehouseIds.some((warehouseId) => !companyWarehouseIds.has(warehouseId))) {
        return apiError('Una o mas bodegas no pertenecen a esta empresa', {
            requestId,
            status: 400,
            code: 'BUSINESS_TEAM_WAREHOUSE_SCOPE_INVALID',
        });
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, user_type')
        .ilike('email', email)
        .maybeSingle();

    if (existingProfileError) {
        return apiError(existingProfileError.message || 'No se pudo validar el usuario existente', {
            requestId,
            status: 500,
            code: 'BUSINESS_TEAM_EXISTING_PROFILE_FAILED',
        });
    }

    if (existingProfile && existingProfile.user_type !== 'business') {
        return apiError('Este correo ya existe con un tipo de cuenta incompatible', {
            requestId,
            status: 409,
            code: 'BUSINESS_TEAM_EMAIL_INCOMPATIBLE',
        });
    }

    const [existingMemberByEmailResponse, existingMemberByUserResponse] = await Promise.all([
        supabaseAdmin
            .from('business_team_members')
            .select('*')
            .eq('business_id', businessId)
            .eq('invited_email', email)
            .maybeSingle(),
        existingProfile
            ? supabaseAdmin
                .from('business_team_members')
                .select('*')
                .eq('business_id', businessId)
                .eq('user_id', existingProfile.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ]);

    if (existingMemberByEmailResponse.error || existingMemberByUserResponse.error) {
        return apiError(
            existingMemberByEmailResponse.error?.message
            || existingMemberByUserResponse.error?.message
            || 'No se pudo validar el equipo existente',
            {
                requestId,
                status: 500,
                code: 'BUSINESS_TEAM_EXISTING_MEMBER_FAILED',
            }
        );
    }

    const existingMemberByEmail = existingMemberByEmailResponse.data;
    const existingMemberByUser = existingMemberByUserResponse.data;

    if (existingMemberByEmail && existingMemberByUser && existingMemberByEmail.id !== existingMemberByUser.id) {
        return apiError('Este correo ya tiene registros de equipo cruzados. Revisa el equipo antes de crear otro acceso.', {
            requestId,
            status: 409,
            code: 'BUSINESS_TEAM_MEMBER_CONFLICT',
        });
    }

    const existingMember = existingMemberByUser || existingMemberByEmail;

    if (existingMember?.status === 'active') {
        return apiError('Este correo ya pertenece al equipo de la empresa', {
            requestId,
            status: 409,
            code: 'BUSINESS_TEAM_ALREADY_ACTIVE',
        });
    }

    if (existingMember?.status === 'suspended') {
        return apiError('Este miembro esta suspendido. Reactivalo desde la lista del equipo.', {
            requestId,
            status: 409,
            code: 'BUSINESS_TEAM_MEMBER_SUSPENDED',
        });
    }

    try {
        await enforceBusinessTeamSeatLimit(supabaseAdmin, businessId);
    } catch (error) {
        if (isPlanLimitError(error)) {
            return apiError(error.message, {
                requestId,
                status: 402,
                code: 'PLAN_LIMIT_REACHED',
                details: getPlanLimitErrorDetails(error),
            });
        }

        return apiError(error instanceof Error ? error.message : 'Limite de usuarios internos alcanzado', {
            requestId,
            status: 409,
            code: 'BUSINESS_TEAM_LIMIT_REACHED',
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
                user_type: 'business',
                country_code: countryCode,
                document_type: documentType,
                document_number: documentNumber,
                team_invitation: true,
                invited_business_id: businessId,
                team_role: role,
                created_by_admin: authUser.id,
            },
        });

        if (createAuthError || !createdUser?.user?.id) {
            return apiError(createAuthError?.message || 'No se pudo crear el usuario en Auth', {
                requestId,
                status: createAuthError?.message?.toLowerCase().includes('already') ? 409 : 500,
                code: 'BUSINESS_TEAM_AUTH_CREATE_FAILED',
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
            user_type: 'business',
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
        return apiError(profileError.message || 'No se pudo guardar el perfil del usuario', {
            requestId,
            status: 500,
            code: 'BUSINESS_TEAM_PROFILE_SAVE_FAILED',
        });
    }

    const memberPayload = {
        business_id: businessId,
        user_id: userId,
        invited_email: email,
        role,
        status: 'active',
        invited_by: authUser.id,
        accepted_at: new Date().toISOString(),
    };

    const { data: member, error: memberError } = existingMember
        ? await supabaseAdmin
            .from('business_team_members')
            .update(memberPayload)
            .eq('id', existingMember.id)
            .select('*')
            .single()
        : await supabaseAdmin
            .from('business_team_members')
            .insert(memberPayload)
            .select('*')
            .single();

    if (memberError || !member) {
        await cleanupCreatedAuthUser(supabaseAdmin, createdAuthUserId);
        return apiError(getWriteError(memberError), {
            requestId,
            status: 500,
            code: 'BUSINESS_TEAM_MEMBER_SAVE_FAILED',
        });
    }

    if (companyWarehouseIds.size > 0) {
        const { data: currentMemberships, error: currentMembershipsError } = await supabaseAdmin
            .from('warehouse_members')
            .select('id, warehouse_id')
            .eq('user_id', userId)
            .in('warehouse_id', Array.from(companyWarehouseIds));

        if (currentMembershipsError) {
            await cleanupCreatedAuthUser(supabaseAdmin, createdAuthUserId);
            return apiError(currentMembershipsError.message || 'No se pudo validar acceso a bodegas', {
                requestId,
                status: 500,
                code: 'BUSINESS_TEAM_WAREHOUSE_LOAD_FAILED',
            });
        }

        const currentByWarehouse = new Map((currentMemberships || []).map((item) => [item.warehouse_id, item]));
        const upserts = warehouseIds
            .filter((warehouseId) => !currentByWarehouse.has(warehouseId))
            .map((warehouseId) => ({
                warehouse_id: warehouseId,
                user_id: userId,
                role: toWarehouseMembershipRole(role),
                active: true,
            }));
        const deactivations = (currentMemberships || [])
            .filter((item) => !warehouseIds.includes(item.warehouse_id))
            .map((item) => item.id);

        if (upserts.length) {
            const { error: upsertError } = await supabaseAdmin.from('warehouse_members').insert(upserts);
            if (upsertError) {
                await cleanupCreatedAuthUser(supabaseAdmin, createdAuthUserId);
                return apiError(getWriteError(upsertError), {
                    requestId,
                    status: 500,
                    code: 'BUSINESS_TEAM_WAREHOUSE_ASSIGN_FAILED',
                });
            }
        }

        if (warehouseIds.length) {
            const { error: reactivateError } = await supabaseAdmin
                .from('warehouse_members')
                .update({ active: true, role: toWarehouseMembershipRole(role) })
                .eq('user_id', userId)
                .in('warehouse_id', warehouseIds);

            if (reactivateError) {
                await cleanupCreatedAuthUser(supabaseAdmin, createdAuthUserId);
                return apiError(getWriteError(reactivateError), {
                    requestId,
                    status: 500,
                    code: 'BUSINESS_TEAM_WAREHOUSE_REACTIVATE_FAILED',
                });
            }
        }

        if (deactivations.length) {
            const { error: deactivateError } = await supabaseAdmin
                .from('warehouse_members')
                .update({ active: false })
                .in('id', deactivations);

            if (deactivateError) {
                await cleanupCreatedAuthUser(supabaseAdmin, createdAuthUserId);
                return apiError(deactivateError.message || 'No se pudo desactivar acceso previo a bodegas', {
                    requestId,
                    status: 500,
                    code: 'BUSINESS_TEAM_WAREHOUSE_DEACTIVATE_FAILED',
                });
            }
        }

        await setActiveWarehousePreference(supabaseAdmin, userId, warehouseIds[0] || null);
    }

    return apiSuccess({
        data: member,
        mode,
    }, {
        requestId,
        code: 'BUSINESS_TEAM_USER_CREATED',
        status: 201,
    });
}
