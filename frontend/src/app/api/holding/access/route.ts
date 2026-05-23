import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { resolveHoldingAccessContext } from '@/lib/server/holding';

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

        return NextResponse.json(access);
    } catch (error) {
        console.error('[HoldingAccess][GET]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
