import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    enforceBusinessTeamSeatLimit,
    getBusinessTeamInfrastructureStatus,
    getPlanLimitErrorDetails,
    isPlanLimitError,
    setActiveWarehousePreference,
} from '@/lib/server/warehouses';
import { getTeamLocalization, normalizeTeamCountryCode } from '@/lib/team/localization';

export async function POST(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (!profile?.email) {
        return NextResponse.json({ error: 'Profile email required' }, { status: 400 });
    }

    const teamInfrastructure = await getBusinessTeamInfrastructureStatus(supabaseAdmin);

    if (!teamInfrastructure.ready) {
        return NextResponse.json({
            error: teamInfrastructure.message || 'Business team infrastructure is not ready',
        }, { status: 503 });
    }

    const { data: teamMember } = await supabaseAdmin
        .from('business_team_members')
        .select('*')
        .eq('invited_email', profile.email.toLowerCase())
        .eq('status', 'invited')
        .maybeSingle();

    if (!teamMember) {
        return NextResponse.json({ error: 'No encontramos una invitacion pendiente para este correo' }, { status: 404 });
    }

    const { data: businessProfile } = await supabaseAdmin
        .from('business_profiles')
        .select('country_code')
        .eq('user_id', teamMember.business_id)
        .maybeSingle();

    const countryCode = normalizeTeamCountryCode(
        (businessProfile as { country_code?: string | null } | null)?.country_code
        || profile.country_code
        || 'CO'
    );

    try {
        await enforceBusinessTeamSeatLimit(supabaseAdmin, teamMember.business_id, 1);
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

    await supabaseAdmin
        .from('user_profiles')
        .update({
            user_type: 'business',
            country_code: countryCode,
        })
        .eq('id', authUser.id);

    const { data: updatedMember, error } = await supabaseAdmin
        .from('business_team_members')
        .update({
            user_id: authUser.id,
            status: 'active',
            accepted_at: new Date().toISOString(),
        })
        .eq('id', teamMember.id)
        .select('*')
        .single();

    if (error || !updatedMember) {
        return NextResponse.json({
            error: error?.message || getTeamLocalization(countryCode).inviteErrors.generic,
        }, { status: 500 });
    }

    await setActiveWarehousePreference(supabaseAdmin, authUser.id, null);

    return NextResponse.json({ data: updatedMember });
}
