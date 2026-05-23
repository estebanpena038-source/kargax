import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route, requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { buildPublicAppUrl, shouldAllowLocalPublicAppUrl } from '@/lib/platform/public-app-url';
import {
    canManageHoldingMembers,
    getHoldingMembers,
    resolveHoldingAccessContext,
} from '@/lib/server/holding';

export async function GET(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveHoldingAccessContext(
            supabaseAdmin,
            authUser.id,
            profile,
            request.nextUrl.searchParams.get('holdingId')
        );

        if (!access.ready) {
            return NextResponse.json({
                ready: false,
                message: access.message,
                holdingAccountId: null,
                role: access.role,
                capabilities: access.capabilities,
                canManageHolding: false,
                data: [],
            });
        }

        if (!access.holdingAccountId) {
            return NextResponse.json({
                ready: true,
                message: null,
                holdingAccountId: null,
                role: null,
                capabilities: null,
                canManageHolding: false,
                data: [],
            });
        }

        const response = await getHoldingMembers(
            supabaseAdmin,
            access.holdingAccountId,
            access.role
        );

        return NextResponse.json(response);
    } catch (error) {
        console.error('[HoldingMembers][GET]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const body = (await request.json()) as {
            email?: string;
            role?: 'holding_owner' | 'finance_admin' | 'ops_admin' | 'analyst';
            holdingId?: string;
        };
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveHoldingAccessContext(
            supabaseAdmin,
            authUser.id,
            profile,
            body.holdingId || null
        );

        if (!access.ready) {
            return NextResponse.json(
                { error: access.message || 'Holding infrastructure is not ready' },
                { status: 503 }
            );
        }

        if (!access.holdingAccountId || !canManageHoldingMembers(access.role)) {
            return NextResponse.json({ error: 'Only holding managers can invite members' }, { status: 403 });
        }

        const email = body.email?.trim().toLowerCase();
        const role = body.role || 'analyst';

        if (!email) {
            return NextResponse.json({ error: 'email is required' }, { status: 400 });
        }

        if (!['holding_owner', 'finance_admin', 'ops_admin', 'analyst'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const [{ data: existingProfile }, { data: existingMemberByEmail }] = await Promise.all([
            supabaseAdmin
                .from('user_profiles')
                .select('id, email, user_type')
                .ilike('email', email)
                .maybeSingle(),
            supabaseAdmin
                .from('holding_account_members')
                .select('*')
                .eq('holding_account_id', access.holdingAccountId)
                .eq('invited_email', email)
                .maybeSingle(),
        ]);

        const { data: existingMemberByUserId } = existingProfile?.id
            ? await supabaseAdmin
                .from('holding_account_members')
                .select('*')
                .eq('holding_account_id', access.holdingAccountId)
                .eq('user_id', existingProfile.id)
                .maybeSingle()
            : { data: null };

        const existingMember = existingMemberByUserId || existingMemberByEmail;

        if (existingProfile && !['business', 'admin'].includes(existingProfile.user_type)) {
            return NextResponse.json(
                { error: 'Only business or admin users can join a holding account' },
                { status: 409 }
            );
        }

        if (existingMember?.status === 'active') {
            return NextResponse.json(
                { error: 'This member already belongs to the holding account' },
                { status: 409 }
            );
        }

        const memberPayload = {
            holding_account_id: access.holdingAccountId,
            user_id: existingProfile?.id || existingMember?.user_id || null,
            invited_email: email,
            role,
            status: existingProfile ? 'active' : 'invited',
            invited_by: authUser.id,
            accepted_at: existingProfile ? new Date().toISOString() : null,
        };

        const memberResponse = existingMember?.id
            ? await supabaseAdmin
                .from('holding_account_members')
                .update(memberPayload)
                .eq('id', existingMember.id)
                .select('*')
                .single()
            : await supabaseAdmin
                .from('holding_account_members')
                .insert(memberPayload)
                .select('*')
                .single();

        if (memberResponse.error || !memberResponse.data) {
            return NextResponse.json(
                { error: memberResponse.error?.message || 'Could not create holding member' },
                { status: 500 }
            );
        }

        if (existingProfile) {
            return NextResponse.json({
                data: memberResponse.data,
                mode: 'linked_existing_user',
            });
        }

        const redirectTo = buildPublicAppUrl('/auth/invite/accept', {
            allowLocalhost: shouldAllowLocalPublicAppUrl(),
        });

        if (!redirectTo) {
            return NextResponse.json({ error: 'A public invite URL is required before sending invitations' }, { status: 503 });
        }

        const inviteResult = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo,
            data: {
                user_type: 'business',
                holding_account_id: access.holdingAccountId,
                holding_role: role,
            },
        });

        if (inviteResult.error) {
            return NextResponse.json({ error: inviteResult.error.message }, { status: 500 });
        }

        return NextResponse.json({
            data: memberResponse.data,
            mode: 'invited',
        }, { status: 201 });
    } catch (error) {
        console.error('[HoldingMembers][POST]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
