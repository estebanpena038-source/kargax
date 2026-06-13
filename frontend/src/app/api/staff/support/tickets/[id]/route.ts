import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getRequestAuditMetadata, recordStaffAuditEvent, requireStaffCapability } from '@/lib/server/staff';
import {
    SUPPORT_TICKET_STATUSES,
    createSupportTicketEvent,
    isSupportEnabled,
    loadSupportTicketEvents,
    loadSupportTicketMessages,
    normalizeSupportCategory,
    normalizeSupportPriority,
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

    const auth = await requireStaffCapability(request, 'support:read');
    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const { data: ticket, error } = await auth.context.supabaseAdmin
        .from('support_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        return apiError(error.message || 'No se pudo cargar el ticket', {
            requestId,
            status: 500,
            code: 'ADMIN_SUPPORT_TICKET_FAILED',
        });
    }

    if (!ticket) {
        return apiError('Ticket no encontrado', {
            requestId,
            status: 404,
            code: 'ADMIN_SUPPORT_TICKET_NOT_FOUND',
        });
    }

    const [messages, events] = await Promise.all([
        loadSupportTicketMessages(auth.context.supabaseAdmin, id, 'all'),
        loadSupportTicketEvents(auth.context.supabaseAdmin, id),
    ]);

    return apiSuccess({
        ticket: normalizeSupportTicket(ticket),
        messages,
        events,
    }, {
        requestId,
        code: 'ADMIN_SUPPORT_TICKET_READY',
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

    const body = await request.json().catch(() => ({}));
    const requiredCapability = body?.status === 'escalated'
        ? 'support:escalate'
        : body?.status === 'resolved' || body?.status === 'closed'
            ? 'support:close'
            : typeof body?.assignedTo === 'string'
                ? 'support:assign'
                : 'support:assign';
    const auth = await requireStaffCapability(request, requiredCapability, {
        requireAal2: requiredCapability === 'support:escalate',
    });
    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const { data: current } = await auth.context.supabaseAdmin
        .from('support_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (!current) {
        return apiError('Ticket no encontrado', {
            requestId,
            status: 404,
            code: 'ADMIN_SUPPORT_TICKET_NOT_FOUND',
        });
    }

    const nextStatus = typeof body?.status === 'string' && SUPPORT_TICKET_STATUSES.includes(body.status)
        ? body.status
        : undefined;
    const nextPriority = typeof body?.priority === 'string'
        ? normalizeSupportPriority(body.priority)
        : undefined;
    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (nextStatus) {
        updateData.status = nextStatus;
        if (nextStatus === 'resolved') {
            updateData.resolved_at = new Date().toISOString();
            updateData.resolution = typeof body?.resolution === 'string' ? body.resolution.trim() : current.resolution || null;
        }
        if (nextStatus === 'closed') {
            updateData.closed_at = new Date().toISOString();
        }
        if (nextStatus === 'escalated') {
            updateData.escalated_to = typeof body?.escalatedTo === 'string' ? body.escalatedTo : null;
        }
    }

    if (nextPriority) updateData.priority = nextPriority;
    if (typeof body?.category === 'string') updateData.category = normalizeSupportCategory(body.category);
    if (typeof body?.assignedTo === 'string') updateData.assigned_to = body.assignedTo || null;
    if (typeof body?.resolution === 'string') updateData.resolution = body.resolution.trim() || null;
    if (typeof body?.relatedUserId === 'string') updateData.related_user_id = body.relatedUserId || null;
    if (typeof body?.relatedBusinessId === 'string') updateData.related_business_id = body.relatedBusinessId || null;
    if (typeof body?.relatedTruckerId === 'string') updateData.related_trucker_id = body.relatedTruckerId || null;
    if (typeof body?.relatedOfferId === 'string') updateData.related_offer_id = body.relatedOfferId || null;
    if (typeof body?.relatedPaymentId === 'string') updateData.related_payment_id = body.relatedPaymentId || null;
    if (typeof body?.relatedWalletTransactionId === 'string') updateData.related_wallet_transaction_id = body.relatedWalletTransactionId || null;

    const { data, error } = await auth.context.supabaseAdmin
        .from('support_requests')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        return apiError(error.message || 'No se pudo actualizar el ticket', {
            requestId,
            status: 500,
            code: 'ADMIN_SUPPORT_TICKET_UPDATE_FAILED',
        });
    }

    await createSupportTicketEvent(auth.context.supabaseAdmin, {
        ticketId: id,
        actorId: auth.context.authUser.id,
        actorRole: auth.context.staff.actorRole,
        action: nextStatus === 'escalated' ? 'ticket_escalated' : 'ticket_updated',
        previousStatus: current.status,
        newStatus: data.status,
        previousPriority: current.priority,
        newPriority: data.priority,
        previousAssignee: current.assigned_to || null,
        newAssignee: data.assigned_to || null,
        metadata: {
            category: data.category,
            resolution_updated: typeof body?.resolution === 'string',
        },
    });

    await recordStaffAuditEvent(auth.context.supabaseAdmin, {
        actorId: auth.context.authUser.id,
        actorRole: auth.context.staff.actorRole,
        capability: requiredCapability,
        targetType: 'support_ticket',
        targetId: id,
        previousState: {
            status: current.status,
            priority: current.priority,
            assigned_to: current.assigned_to || null,
        },
        newState: {
            status: data.status,
            priority: data.priority,
            assigned_to: data.assigned_to || null,
        },
        reason: typeof body?.resolution === 'string' ? body.resolution.trim() : null,
        ...getRequestAuditMetadata(request),
    });

    return apiSuccess(normalizeSupportTicket(data), {
        requestId,
        code: 'ADMIN_SUPPORT_TICKET_UPDATED',
    });
}
