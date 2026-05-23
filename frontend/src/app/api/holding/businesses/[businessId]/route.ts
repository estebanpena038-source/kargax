import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    canManageHoldingBusinessLinks,
    resolveHoldingAccessContext,
    unlinkBusinessFromHolding,
} from '@/lib/server/holding';

interface RouteContext {
    params: Promise<{ businessId: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { businessId } = await context.params;
        let body: { holdingId?: string } = {};

        try {
            body = (await request.json()) as { holdingId?: string };
        } catch {
            body = {};
        }

        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveHoldingAccessContext(
            supabaseAdmin,
            authUser.id,
            profile,
            body.holdingId || request.nextUrl.searchParams.get('holdingId')
        );

        if (!access.ready) {
            return NextResponse.json(
                { error: access.message || 'Holding infrastructure is not ready' },
                { status: 503 }
            );
        }

        if (!access.holdingAccountId || !canManageHoldingBusinessLinks(access.role)) {
            return NextResponse.json({ error: 'Only holding managers can unlink companies' }, { status: 403 });
        }

        await unlinkBusinessFromHolding(supabaseAdmin, {
            holdingAccountId: access.holdingAccountId,
            businessId,
            unlinkedBy: authUser.id,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[HoldingBusinesses][DELETE]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
