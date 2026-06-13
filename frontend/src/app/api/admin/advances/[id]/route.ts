import { NextRequest, NextResponse } from 'next/server';
import { createAdminNotification } from '@/lib/server/route-auth';
import { requireInternalAdminCapability } from '@/lib/server/internal-admins';

type AdvanceAction = 'approve' | 'reject' | 'mark_restructured' | 'write_off';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireInternalAdminCapability(request, 'advance:write');

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser } = auth.context;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action as AdvanceAction;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!['approve', 'reject', 'mark_restructured', 'write_off'].includes(action)) {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    try {
        let success = false;
        let message = 'Operacion completada';

        if (action === 'approve') {
            const { data, error } = await supabaseAdmin.rpc('approve_fuel_advance', {
                p_advance_id: id,
                p_admin_id: authUser.id,
                p_note: note || null,
            });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            success = !!data?.[0]?.success;
            message = data?.[0]?.message || message;
        } else if (action === 'reject') {
            const { data, error } = await supabaseAdmin.rpc('reject_fuel_advance', {
                p_advance_id: id,
                p_admin_id: authUser.id,
                p_reason: note || null,
            });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            success = !!data;
            message = success ? 'Solicitud rechazada' : 'No se pudo rechazar la solicitud';
        } else if (action === 'mark_restructured') {
            const { data, error } = await supabaseAdmin.rpc('restructure_fuel_advance', {
                p_advance_id: id,
                p_admin_id: authUser.id,
                p_note: note || null,
            });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            success = !!data;
            message = success ? 'Adelanto reestructurado' : 'No se pudo reestructurar el adelanto';
        } else if (action === 'write_off') {
            const { data, error } = await supabaseAdmin.rpc('write_off_fuel_advance', {
                p_advance_id: id,
                p_admin_id: authUser.id,
                p_note: note || null,
            });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            success = !!data;
            message = success ? 'Adelanto castigado' : 'No se pudo castigar el adelanto';
        }

        if (!success) {
            return NextResponse.json({ error: message }, { status: 400 });
        }

        await createAdminNotification(supabaseAdmin, {
            type: 'advance_processed',
            title: 'Adelanto procesado',
            message: `El adelanto ${id.slice(0, 8)} fue procesado con accion ${action}.`,
            data: {
                advance_id: id,
                action,
                note: note || null,
                processed_by: authUser.id,
            },
        });

        await supabaseAdmin
            .from('admin_notifications')
            .update({
                processed: true,
                processed_at: new Date().toISOString(),
                processed_by: authUser.id,
                read: true,
            })
            .eq('type', 'advance_request')
            .contains('data', { advance_id: id });

        return NextResponse.json({
            success: true,
            action,
            advance_id: id,
            message,
        });
    } catch (error) {
        console.error('[Admin Advances PATCH] Unexpected error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
