import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    enforceBusinessTeamSeatLimit,
    getPlanLimitErrorDetails,
    getBusinessTeamInfrastructureStatus,
    isPlanLimitError,
    resolveBusinessAccessContext,
    setActiveWarehousePreference,
} from '@/lib/server/warehouses';
import { getTeamLocalization } from '@/lib/team/localization';
import {
    isEditableBusinessTeamRole,
    toWarehouseMembershipRole,
    type EditableBusinessTeamRole,
} from '@/lib/business-roles';

interface RouteContext {
    params: Promise<{ id: string }>;
}

function getBusinessRoleWriteError(error: { message?: string | null } | null | undefined) {
    const message = error?.message || 'Could not update team member';
    const normalized = message.toLowerCase();

    if (normalized.includes('role_check') || normalized.includes('business_team_members_role_check')) {
        return 'Aplica la migracion 046_business_role_presets.sql para usar roles empresariales avanzados.';
    }

    return message;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const inviteErrors = getTeamLocalization(profile?.country_code).inviteErrors;

    if (profile?.user_type !== 'admin' && (!businessAccess.businessId || !businessAccess.isOwner)) {
        return NextResponse.json({ error: 'Only owners or admins can update team members' }, { status: 403 });
    }

    const teamInfrastructure = await getBusinessTeamInfrastructureStatus(supabaseAdmin);

    if (!teamInfrastructure.ready) {
        return NextResponse.json({
            error: teamInfrastructure.message || 'Business team infrastructure is not ready',
        }, { status: 503 });
    }

    const body = (await request.json()) as {
        role?: EditableBusinessTeamRole;
        status?: 'active' | 'suspended';
    };

    if (body.role && !isEditableBusinessTeamRole(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    let memberQuery = supabaseAdmin
        .from('business_team_members')
        .select('*')
        .eq('id', id);

    if (profile?.user_type !== 'admin') {
        memberQuery = memberQuery.eq('business_id', businessAccess.businessId || '');
    }

    const { data: member, error: memberError } = await memberQuery.single();

    if (memberError || !member) {
        return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    if (member.role === 'owner') {
        return NextResponse.json({ error: 'Owner role cannot be modified here' }, { status: 400 });
    }

    const nextStatus = body.status || member.status;
    if (body.status === 'active' && !member.user_id) {
        return NextResponse.json({ error: inviteErrors.acceptInvitationFirst }, { status: 409 });
    }

    if (nextStatus === 'active' && member.status !== 'active') {
        try {
            await enforceBusinessTeamSeatLimit(supabaseAdmin, member.business_id, 1);
        } catch (error) {
            if (isPlanLimitError(error)) {
                return NextResponse.json({
                    error: {
                        message: error.message,
                        details: getPlanLimitErrorDetails(error),
                    },
                    code: 'PLAN_LIMIT_REACHED',
                }, { status: 402 });
            }

            throw error;
        }
    }

    const { data: updatedMember, error } = await supabaseAdmin
        .from('business_team_members')
        .update({
            role: body.role || member.role,
            status: nextStatus,
            accepted_at: nextStatus === 'active' ? member.accepted_at || new Date().toISOString() : member.accepted_at,
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error || !updatedMember) {
        return NextResponse.json({ error: getBusinessRoleWriteError(error) }, { status: 500 });
    }

    if (member.user_id) {
        if (nextStatus === 'suspended') {
            await supabaseAdmin
                .from('warehouse_members')
                .update({ active: false })
                .eq('user_id', member.user_id);

            await setActiveWarehousePreference(supabaseAdmin, member.user_id, null);
        } else {
            const { error: warehouseRoleError } = await supabaseAdmin
                .from('warehouse_members')
                .update({
                    active: true,
                    role: toWarehouseMembershipRole(body.role || member.role),
                })
                .eq('user_id', member.user_id);

            if (warehouseRoleError) {
                return NextResponse.json({ error: getBusinessRoleWriteError(warehouseRoleError) }, { status: 500 });
            }
        }
    }

    return NextResponse.json({ data: updatedMember });
}
