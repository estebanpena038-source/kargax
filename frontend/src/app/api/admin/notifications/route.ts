import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/server/route-auth';

export async function GET(request: NextRequest) {
    const auth = await requireAdminRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin } = auth.context;
    const { data, error } = await supabaseAdmin
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
}
