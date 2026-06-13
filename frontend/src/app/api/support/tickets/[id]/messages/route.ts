import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
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

    const auth = await requireAuthenticatedRoute(request, { requireAal2: false });
    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message) {
        return apiError('El mensaje es obligatorio.', {
            requestId,
            status: 400,
            code: 'SUPPORT_MESSAGE_INVALID',
        });
    }

    const { data: ticket } = await auth.context.supabaseAdmin
        .from('support_requests')
        .select('id, status')
        .eq('id', id)
        .eq('requested_by', auth.context.authUser.id)
        .maybeSingle();

    if (!ticket) {
        return apiError('Ticket no encontrado', {
            requestId,
            status: 404,
            code: 'SUPPORT_TICKET_NOT_FOUND',
        });
    }

    const data = await createSupportTicketMessage(auth.context.supabaseAdmin, {
        ticketId: id,
        authorId: auth.context.authUser.id,
        authorEmail: auth.context.profile?.email || auth.context.authUser.email,
        authorName: auth.context.profile?.full_name || 'Usuario KargaX',
        authorRole: 'user',
        visibility: 'public',
        body: message,
    });

    if (['waiting_user', 'resolved', 'closed'].includes(ticket.status)) {
        await auth.context.supabaseAdmin
            .from('support_requests')
            .update({
                status: 'in_progress',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);
    }

    await createSupportTicketEvent(auth.context.supabaseAdmin, {
        ticketId: id,
        actorId: auth.context.authUser.id,
        actorRole: 'user',
        action: 'user_message_created',
        previousStatus: ticket.status,
        newStatus: ['waiting_user', 'resolved', 'closed'].includes(ticket.status) ? 'in_progress' : ticket.status,
    });

    return apiSuccess(data, {
        requestId,
        status: 201,
        code: 'SUPPORT_MESSAGE_CREATED',
    });
}
