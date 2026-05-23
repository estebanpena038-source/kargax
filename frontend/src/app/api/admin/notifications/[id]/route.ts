import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/server/route-auth';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser } = auth.context;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const read = typeof body?.read === 'boolean' ? body.read : undefined;
    const processed = typeof body?.processed === 'boolean' ? body.processed : undefined;

    const updateData: Record<string, unknown> = {};

    if (read !== undefined) {
        updateData.read = read;
    }

    if (processed !== undefined) {
        updateData.processed = processed;
        updateData.processed_by = processed ? authUser.id : null;
        updateData.processed_at = processed ? new Date().toISOString() : null;
    }

    const { error } = await supabaseAdmin
        .from('admin_notifications')
        .update(updateData)
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
}
