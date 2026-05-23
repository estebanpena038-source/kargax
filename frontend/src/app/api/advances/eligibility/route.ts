import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { getTruckerAdvanceSnapshot } from '@/lib/server/advances';

export async function GET(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker') {
        return NextResponse.json({ error: 'Solo transportadores pueden consultar adelantos' }, { status: 403 });
    }

    try {
        const snapshot = await getTruckerAdvanceSnapshot(supabaseAdmin, authUser.id);

        return NextResponse.json({
            eligibleOffers: snapshot.eligibleOffers,
            summary: snapshot.summary,
            settings: snapshot.settings,
        });
    } catch (error) {
        console.error('[Advances Eligibility] Unexpected error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
