import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    canManageHoldingMembers,
    resolveHoldingAccessContext,
} from '@/lib/server/holding';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { id } = await context.params;
        const body = (await request.json()) as {
            role?: 'holding_owner' | 'finance_admin' | 'ops_admin' | 'analyst';
            status?: 'active' | 'suspended';
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
            return NextResponse.json({ error: 'Only holding managers can update members' }, { status: 403 });
        }

        const { data: member, error: memberError } = await supabaseAdmin
            .from('holding_account_members')
            .select('*')
            .eq('id', id)
            .eq('holding_account_id', access.holdingAccountId)
            .maybeSingle();

        if (memberError) {
            return NextResponse.json({ error: memberError.message }, { status: 500 });
        }

        if (!member) {
            return NextResponse.json({ error: 'Holding member not found' }, { status: 404 });
        }

        const nextRole = body.role || member.role;
        const nextStatus = body.status || member.status;

        if (!['holding_owner', 'finance_admin', 'ops_admin', 'analyst'].includes(nextRole)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        if (!['active', 'suspended'].includes(nextStatus)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        if (
            member.role === 'holding_owner' &&
            member.status === 'active' &&
            (nextRole !== 'holding_owner' || nextStatus !== 'active')
        ) {
            const { count, error: ownersError } = await supabaseAdmin
                .from('holding_account_members')
                .select('id', { count: 'exact', head: true })
                .eq('holding_account_id', access.holdingAccountId)
                .eq('role', 'holding_owner')
                .eq('status', 'active');

            if (ownersError) {
                return NextResponse.json({ error: ownersError.message }, { status: 500 });
            }

            if ((count || 0) <= 1) {
                return NextResponse.json(
                    { error: 'The holding must keep at least one active holding owner' },
                    { status: 400 }
                );
            }
        }

        const { data: updatedMember, error: updateError } = await supabaseAdmin
            .from('holding_account_members')
            .update({
                role: nextRole,
                status: nextStatus,
                accepted_at: nextStatus === 'active'
                    ? member.accepted_at || new Date().toISOString()
                    : member.accepted_at,
            })
            .eq('id', member.id)
            .select('*')
            .single();

        if (updateError || !updatedMember) {
            return NextResponse.json(
                { error: updateError?.message || 'Could not update holding member' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: updatedMember });
    } catch (error) {
        console.error('[HoldingMembers][PATCH]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
