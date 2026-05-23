import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/server/route-auth';

interface TreasuryAdjustmentRequest {
    amount: number;
    adjustmentType: 'funding' | 'withdrawal' | 'adjustment';
    note?: string;
}

export async function POST(request: NextRequest) {
    const auth = await requireAdminRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser } = auth.context;

    try {
        const body = (await request.json()) as TreasuryAdjustmentRequest;

        if (!body?.amount || body.amount <= 0) {
            return NextResponse.json({ error: 'Monto invalido' }, { status: 400 });
        }

        if (!['funding', 'withdrawal', 'adjustment'].includes(body.adjustmentType)) {
            return NextResponse.json({ error: 'adjustmentType invalido' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.rpc('adjust_lending_treasury', {
            p_admin_id: authUser.id,
            p_amount: body.amount,
            p_adjustment_type: body.adjustmentType,
            p_note: body.note?.trim() || null,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const result = data?.[0];

        if (!result?.success) {
            return NextResponse.json({ error: result?.message || 'No se pudo ajustar la tesoreria' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            treasury: {
                available_capital: Number(result.available_capital || 0),
                deployed_capital: Number(result.deployed_capital || 0),
            },
        });
    } catch (error) {
        console.error('[Admin Treasury] Unexpected error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
