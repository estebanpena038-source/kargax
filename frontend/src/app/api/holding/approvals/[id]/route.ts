import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    canApproveHoldingRequest,
    decideHoldingApproval,
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
            holdingId?: string;
            status?: 'approved' | 'rejected' | 'cancelled';
            decisionNote?: string;
            assignedTo?: string | null;
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

        if (!body.status || !['approved', 'rejected', 'cancelled'].includes(body.status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        if (!access.holdingAccountId) {
            return NextResponse.json({ error: 'Only holding managers can decide approvals' }, { status: 403 });
        }

        const { data: approvalRow, error: approvalError } = await supabaseAdmin
            .from('holding_approval_requests')
            .select('request_type, assigned_team')
            .eq('id', id)
            .eq('holding_account_id', access.holdingAccountId)
            .maybeSingle();

        if (approvalError) {
            return NextResponse.json({ error: approvalError.message || 'Could not load approval request' }, { status: 500 });
        }

        if (!approvalRow) {
            return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
        }

        if (!canApproveHoldingRequest(access.role, approvalRow.request_type, approvalRow.assigned_team)) {
            return NextResponse.json({ error: 'Your holding role cannot decide this approval queue' }, { status: 403 });
        }

        const approval = await decideHoldingApproval(supabaseAdmin, {
            approvalId: id,
            holdingAccountId: access.holdingAccountId,
            status: body.status,
            decisionNote: body.decisionNote || null,
            assignedTo: body.assignedTo || null,
            decidedBy: authUser.id,
        });

        return NextResponse.json({ data: approval });
    } catch (error) {
        console.error('[HoldingApprovals][PATCH]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
