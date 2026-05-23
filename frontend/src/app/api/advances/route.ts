import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { getAdvanceRepayments, getTruckerAdvanceSnapshot } from '@/lib/server/advances';
import { getFeatureFlags, isFeatureFlagEnabled } from '@/lib/server/feature-flags';

interface CreateAdvanceRequest {
    originOfferId: string;
    amount?: number;
    termDays?: number;
}

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
        const flags = await getFeatureFlags(supabaseAdmin);
        const lendingEnabled = isFeatureFlagEnabled(flags, 'lending_enabled', profile?.country_code);
        if (!lendingEnabled) {
            return NextResponse.json({
                advances: [],
                activeAdvances: [],
                overdueAdvances: [],
                summary: null,
                lendingPaused: true,
            });
        }

        const snapshot = await getTruckerAdvanceSnapshot(supabaseAdmin, authUser.id);
        const repaymentsByAdvance = await getAdvanceRepayments(
            supabaseAdmin,
            snapshot.advances.map((item) => item.id)
        );

        return NextResponse.json({
            advances: snapshot.advances.map((item) => ({
                ...item,
                repayments: repaymentsByAdvance[item.id] || [],
            })),
            activeAdvances: snapshot.activeAdvances,
            overdueAdvances: snapshot.overdueAdvances,
            summary: snapshot.summary,
        });
    } catch (error) {
        console.error('[Advances GET] Unexpected error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker') {
        return NextResponse.json({ error: 'Solo transportadores pueden solicitar adelantos' }, { status: 403 });
    }

    try {
        const flags = await getFeatureFlags(supabaseAdmin);
        const lendingEnabled = isFeatureFlagEnabled(flags, 'lending_enabled', profile?.country_code);
        if (!lendingEnabled) {
            return NextResponse.json(
                { error: 'Los adelantos KargaX estan pausados para el piloto.' },
                { status: 403 }
            );
        }

        const body = (await request.json()) as CreateAdvanceRequest;
        const originOfferId = body.originOfferId?.trim();

        if (!originOfferId) {
            return NextResponse.json({ error: 'originOfferId es requerido' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.rpc('request_fuel_advance', {
            p_trucker_id: authUser.id,
            p_origin_offer_id: originOfferId,
            p_requested_amount: body.amount ?? null,
            p_term_days: body.termDays ?? null,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const result = data?.[0];

        if (!result?.success) {
            return NextResponse.json({ error: result?.message || 'No se pudo crear la solicitud' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            advance: result,
        });
    } catch (error) {
        console.error('[Advances POST] Unexpected error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
