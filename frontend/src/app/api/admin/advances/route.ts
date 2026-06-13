import { NextRequest, NextResponse } from 'next/server';
import { requireInternalAdminCapability } from '@/lib/server/internal-admins';
import { getAdminAdvancePortfolioSnapshot, getAdvanceRepayments } from '@/lib/server/advances';

export async function GET(request: NextRequest) {
    const auth = await requireInternalAdminCapability(request, 'advance:read');

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin } = auth.context;

    try {
        const snapshot = await getAdminAdvancePortfolioSnapshot(supabaseAdmin);
        const repaymentsByAdvance = await getAdvanceRepayments(
            supabaseAdmin,
            snapshot.data.map((item) => item.id)
        );
        const data = snapshot.data.map((item) => ({
            ...item,
            repayments: repaymentsByAdvance[item.id] || [],
        }));

        return NextResponse.json({
            treasury: snapshot.treasury,
            settings: snapshot.settings,
            metrics: snapshot.metrics,
            cohorts: snapshot.cohorts,
            data,
        });
    } catch (error) {
        console.error('[Admin Advances GET] Unexpected error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
