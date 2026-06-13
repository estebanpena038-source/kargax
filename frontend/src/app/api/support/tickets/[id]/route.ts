import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    createSupportTicketEvent,
    isSupportEnabled,
    loadSupportTicketMessages,
    normalizeSupportTicket,
} from '@/lib/server/support-tickets';

export async function GET(
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
    const { data: ticket, error } = await auth.context.supabaseAdmin
        .from('support_requests')
        .select('*')
        .eq('id', id)
        .eq('requested_by', auth.context.authUser.id)
        .maybeSingle();

    if (error) {
        return apiError(error.message || 'No se pudo cargar el ticket', {
            requestId,
            status: 500,
            code: 'SUPPORT_TICKET_FAILED',
        });
    }

    if (!ticket) {
        return apiError('Ticket no encontrado', {
            requestId,
            status: 404,
            code: 'SUPPORT_TICKET_NOT_FOUND',
        });
    }

    const messages = await loadSupportTicketMessages(auth.context.supabaseAdmin, id, 'public');

    return apiSuccess({
        ticket: normalizeSupportTicket(ticket),
        messages,
    }, {
        requestId,
        code: 'SUPPORT_TICKET_READY',
    });
}

export async function PATCH(
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
    const action = typeof body?.action === 'string' ? body.action : '';

    if (!['close', 'reopen'].includes(action)) {
        return apiError('Accion invalida', {
            requestId,
            status: 400,
            code: 'SUPPORT_TICKET_ACTION_INVALID',
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

    const newStatus = action === 'close' ? 'closed' : 'open';
    const { data, error } = await auth.context.supabaseAdmin
        .from('support_requests')
        .update({
            status: newStatus,
            closed_at: newStatus === 'closed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        return apiError(error.message || 'No se pudo actualizar el ticket', {
            requestId,
            status: 500,
            code: 'SUPPORT_TICKET_UPDATE_FAILED',
        });
    }

    await createSupportTicketEvent(auth.context.supabaseAdmin, {
        ticketId: id,
        actorId: auth.context.authUser.id,
        actorRole: 'user',
        action: action === 'close' ? 'ticket_closed_by_user' : 'ticket_reopened_by_user',
        previousStatus: ticket.status,
        newStatus,
    });

    return apiSuccess(normalizeSupportTicket(data), {
        requestId,
        code: 'SUPPORT_TICKET_UPDATED',
    });
}
