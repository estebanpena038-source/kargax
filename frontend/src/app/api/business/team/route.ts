import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import type { BusinessTeamMember } from '@/lib/warehouses/types';
import {
    getBusinessPlanSnapshot,
    getBusinessTeamInfrastructureStatus,
    isBusinessTeamMembersTableMissing,
    resolveBusinessAccessContext,
} from '@/lib/server/warehouses';
import { getTeamLocalization, normalizeTeamCountryCode } from '@/lib/team/localization';
import { isEditableBusinessTeamRole, type EditableBusinessTeamRole } from '@/lib/business-roles';
import {
    isValidTeamInviteEmail,
    sendBusinessTeamInvite,
    toTeamInviteError,
} from '@/lib/server/team-invitations';
import { resolvePublicAppUrl, shouldAllowLocalPublicAppUrl } from '@/lib/platform/public-app-url';

function resolveAppUrl(request: NextRequest) {
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || (forwardedHost?.includes('localhost') ? 'http' : 'https');
    const requestOrigin = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '')
        : request.nextUrl.origin.replace(/\/$/, '');
    return resolvePublicAppUrl({
        requestOrigin,
        allowLocalhost: shouldAllowLocalPublicAppUrl(),
    });
}

function getBusinessRoleWriteError(error: { message?: string | null } | null | undefined) {
    const message = error?.message || 'Could not create team member';
    const normalized = message.toLowerCase();

    if (normalized.includes('role_check') || normalized.includes('business_team_members_role_check')) {
        return 'Aplica la migracion 046_business_role_presets.sql para invitar usuarios con roles empresariales avanzados.';
    }

    return message;
}

type WarehouseMembershipRecord = NonNullable<BusinessTeamMember['warehouse_memberships']>[number];
type TeamMemberWithRelations = BusinessTeamMember & {
    invited_by_user?: {
        id: string;
        full_name: string;
    } | null;
};

export async function GET(request: NextRequest) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
        resolvedBusinessId: businessAccess.businessId,
        profile,
    });

    if ('error' in scopedBusiness) {
        return NextResponse.json({ error: scopedBusiness.error }, { status: scopedBusiness.status });
    }

    const businessId = scopedBusiness.businessId;

    if (!businessId || (!businessAccess.isOwner && profile?.user_type !== 'admin')) {
        return NextResponse.json({ error: 'Only owners or admins can view team members' }, { status: 403 });
    }

    const [teamMembersResponse, warehousesResponse, snapshot] = await Promise.all([
        supabaseAdmin
            .from('business_team_members')
            .select(`
                *,
                user:user_profiles!business_team_members_user_id_fkey(id, email, full_name, phone, avatar_url),
                invited_by_user:user_profiles!business_team_members_invited_by_fkey(id, full_name)
            `)
            .eq('business_id', businessId)
            .order('created_at', { ascending: true }),
        supabaseAdmin
            .from('warehouses')
            .select('id, code, name, city, department, status')
            .eq('business_id', businessId)
            .order('created_at', { ascending: true }),
        getBusinessPlanSnapshot(supabaseAdmin, businessId),
    ]);

    if (teamMembersResponse.error && !isBusinessTeamMembersTableMissing(teamMembersResponse.error)) {
        return NextResponse.json({ error: teamMembersResponse.error.message }, { status: 500 });
    }

    if (warehousesResponse.error) {
        return NextResponse.json({ error: warehousesResponse.error.message }, { status: 500 });
    }

    const teamMembers = await Promise.all(
        ((teamMembersResponse.data || []) as TeamMemberWithRelations[]).map(async (member) => {
            const memberships = member.user_id
                ? (((await supabaseAdmin
                    .from('warehouse_members')
                    .select('warehouse_id, role, active')
                    .eq('user_id', member.user_id)
                    .eq('active', true)).data || []) as WarehouseMembershipRecord[])
                : [];

            return {
                ...member,
                warehouse_memberships: memberships,
            };
        })
    );

    return NextResponse.json({
        data: teamMembers,
        warehouses: warehousesResponse.data || [],
        subscription: snapshot.subscription,
        plans: snapshot.plans,
        limits: snapshot.limits,
        canManageBilling: businessAccess.isAdmin || businessAccess.isOwner,
        canManageTeam: businessAccess.isAdmin || businessAccess.isOwner,
        teamSchemaReady: snapshot.teamSchemaReady,
        teamSchemaMessage: snapshot.teamSchemaMessage,
    });
}

export async function POST(request: NextRequest) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

    if (profile?.user_type !== 'admin' && (!businessAccess.businessId || !businessAccess.isOwner)) {
        return NextResponse.json({ error: 'Only owners or admins can invite team members' }, { status: 403 });
    }

    const body = (await request.json()) as {
        email?: string;
        role?: EditableBusinessTeamRole;
        businessId?: string;
    };

    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: body.businessId,
        resolvedBusinessId: businessAccess.businessId,
        profile,
    });
    const businessId = 'error' in scopedBusiness ? null : scopedBusiness.businessId;
    const email = body.email?.trim().toLowerCase();
    const role = body.role || 'warehouse_operator';

    if ('error' in scopedBusiness) {
        return NextResponse.json({ error: scopedBusiness.error }, { status: scopedBusiness.status });
    }

    if (!businessId) {
        return NextResponse.json({ error: 'businessId and email are required' }, { status: 400 });
    }

    if (!email || !isValidTeamInviteEmail(email)) {
        return NextResponse.json({ error: getTeamLocalization(profile?.country_code).inviteErrors.invalidEmail }, { status: 400 });
    }

    if (!isEditableBusinessTeamRole(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const teamInfrastructure = await getBusinessTeamInfrastructureStatus(supabaseAdmin);

    if (!teamInfrastructure.ready) {
        return NextResponse.json({
            error: teamInfrastructure.message || 'Business team infrastructure is not ready',
        }, { status: 503 });
    }

    const [
        { data: existingProfile },
        { data: existingMember },
        { data: businessProfile },
        { data: inviterProfile },
    ] = await Promise.all([
        supabaseAdmin
            .from('user_profiles')
            .select('id, email, full_name, user_type, country_code')
            .ilike('email', email)
            .maybeSingle(),
        supabaseAdmin
            .from('business_team_members')
            .select('*')
            .eq('business_id', businessId)
            .eq('invited_email', email)
            .maybeSingle(),
        supabaseAdmin
            .from('business_profiles')
            .select('company_name, country_code')
            .eq('user_id', businessId)
            .maybeSingle(),
        supabaseAdmin
            .from('user_profiles')
            .select('full_name, email, country_code')
            .eq('id', authUser.id)
            .maybeSingle(),
    ]);

    const countryCode = normalizeTeamCountryCode(
        (businessProfile as { country_code?: string | null } | null)?.country_code
        || (profile as { country_code?: string | null } | null)?.country_code
        || 'CO'
    );
    const inviteCopy = getTeamLocalization(countryCode).inviteErrors;
    const companyName = (businessProfile as { company_name?: string | null } | null)?.company_name
        || 'KargaX Business';
    const invitedByName = (inviterProfile as { full_name?: string | null; email?: string | null } | null)?.full_name
        || profile?.full_name
        || authUser.email
        || 'KargaX Admin';

    if (existingMember?.status === 'active') {
        return NextResponse.json({ error: inviteCopy.alreadyActive }, { status: 409 });
    }

    if (existingMember?.status === 'suspended' && existingMember.user_id) {
        return NextResponse.json({ error: inviteCopy.suspendedMember }, { status: 409 });
    }

    // Allow inviting users regardless of user_type — team membership is separate.
    // A trucker can be invited to manage business operations as a team member.
    // Only warn in logs if the profile is a trucker (in case admin wants to review).
    if (existingProfile && existingProfile.user_type !== 'business') {
        console.warn(`[Team] Inviting user ${email} with user_type=${existingProfile.user_type} to business team`);
    }

    const memberPayload = {
        business_id: businessId,
        user_id: existingMember?.user_id || null,
        invited_email: email,
        role,
        status: 'invited',
        invited_by: authUser.id,
        accepted_at: existingMember?.user_id ? existingMember.accepted_at || null : null,
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
        return NextResponse.json({ error: getBusinessRoleWriteError(memberError) }, { status: 500 });
    }

    const appUrl = resolveAppUrl(request);
    if (!appUrl) {
        return NextResponse.json({
            error: inviteCopy.publicInviteUrl,
        }, { status: 503 });
    }

    let emailDelivery;
    try {
        emailDelivery = await sendBusinessTeamInvite(supabaseAdmin, {
            email,
            role,
            businessId,
            companyName,
            invitedByName,
            countryCode,
            appUrl,
            linkType: existingProfile ? 'magiclink' : 'invite',
        });
    } catch (inviteError) {
        if (!existingMember) {
            await supabaseAdmin
                .from('business_team_members')
                .delete()
                .eq('id', member.id);
        }

        return NextResponse.json({
            error: toTeamInviteError(inviteError as Error, countryCode),
        }, { status: 500 });
    }

    return NextResponse.json({
        data: member,
        mode: 'invited',
        emailDelivery,
    }, { status: 201 });
}
