import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getRequestAuditMetadata, recordStaffAuditEvent, requireStaffCapability } from '@/lib/server/staff';
import {
    createSupportTicketEvent,
    createSupportTicketMessage,
    isSupportEnabled,
} from '@/lib/server/support-tickets';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const requestId = getRequestId(request);

    if (!isSupportEnabled()) {
        return apiError('Soporte no esta habilitado en este ambiente.', {
            requestId,
            status: 503,
            code: 'SUPPORT_DISABLED',
        });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const visibility = body?.visibility === 'internal' ? 'internal' : 'public';
    const capability = visibility === 'internal' ? 'support:internal_note' : 'support:reply';
    const auth = await requireStaffCapability(request, capability);

    if ('response' in auth) {
        return auth.response;
    }

    if (!message) {
        return apiError('El mensaje es obligatorio.', {
            requestId,
            status: 400,
            code: 'ADMIN_SUPPORT_MESSAGE_INVALID',
        });
    }

    const { data: ticket } = await auth.context.supabaseAdmin
        .from('support_requests')
        .select('id, status')
        .eq('id', id)
        .maybeSingle();

    if (!ticket) {
        return apiError('Ticket no encontrado', {
            requestId,
            status: 404,
            code: 'ADMIN_SUPPORT_TICKET_NOT_FOUND',
        });
    }

    const data = await createSupportTicketMessage(auth.context.supabaseAdmin, {
        ticketId: id,
        authorId: auth.context.authUser.id,
        authorEmail: auth.context.profile?.email || auth.context.authUser.email,
        authorName: auth.context.profile?.full_name || 'KargaX',
        authorRole: auth.context.staff.actorRole,
        visibility,
        body: message,
    });

    const nextStatus = visibility === 'public' && ticket.status === 'open' ? 'in_progress' : ticket.status;
    if (nextStatus !== ticket.status) {
        await auth.context.supabaseAdmin
            .from('support_requests')
            .update({
                status: nextStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);
    }

    await createSupportTicketEvent(auth.context.supabaseAdmin, {
        ticketId: id,
        actorId: auth.context.authUser.id,
        actorRole: auth.context.staff.actorRole,
        action: visibility === 'internal' ? 'internal_note_created' : 'public_reply_created',
        previousStatus: ticket.status,
        newStatus: nextStatus,
        metadata: { visibility },
    });

    await recordStaffAuditEvent(auth.context.supabaseAdmin, {
        actorId: auth.context.authUser.id,
        actorRole: auth.context.staff.actorRole,
        capability,
        targetType: 'support_ticket_message',
        targetId: data.id,
        newState: {
            ticket_id: id,
            visibility,
            next_status: nextStatus,
        },
        reason: visibility === 'internal' ? 'internal_note_created' : 'public_reply_created',
        ...getRequestAuditMetadata(request),
    });

    return apiSuccess(data, {
        requestId,
        status: 201,
        code: 'ADMIN_SUPPORT_MESSAGE_CREATED',
    });
}
