import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { createSupportRequest } from '@/lib/server/operations';
import { getRequestAuditMetadata, recordStaffAuditEvent, requireStaffCapability } from '@/lib/server/staff';
import {
    createSupportTicketEvent,
    createSupportTicketMessage,
    isSupportEnabled,
    normalizeSupportCategory,
    normalizeSupportPriority,
    normalizeSupportTicket,
} from '@/lib/server/support-tickets';
import type { SupportRequest } from '@/lib/platform/types';

export async function GET(request: NextRequest) {
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

    let query = auth.context.supabaseAdmin
        .from('support_requests')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(Number(request.nextUrl.searchParams.get('limit') || 100));

    const status = request.nextUrl.searchParams.get('status');
    const priority = request.nextUrl.searchParams.get('priority');
    const category = request.nextUrl.searchParams.get('category');
    const assignedTo = request.nextUrl.searchParams.get('assignedTo');

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (category) query = query.eq('category', category);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);

    const { data, error } = await query;

    if (error) {
        return apiError(error.message || 'No se pudo cargar soporte', {
            requestId,
            status: 500,
            code: 'ADMIN_SUPPORT_TICKETS_FAILED',
        });
    }

    return apiSuccess((data || []).map(normalizeSupportTicket), {
        requestId,
        code: 'ADMIN_SUPPORT_TICKETS_READY',
    });
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);

    if (!isSupportEnabled()) {
        return apiError('Soporte no esta habilitado en este ambiente.', {
            requestId,
            status: 503,
            code: 'SUPPORT_DISABLED',
        });
    }

    const auth = await requireStaffCapability(request, 'support:reply');
    if ('response' in auth) {
        return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const requesterName = typeof body?.requesterName === 'string' ? body.requesterName.trim() : '';
    const requesterEmail = typeof body?.requesterEmail === 'string' ? body.requesterEmail.trim() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';

    if (!requesterName || !requesterEmail || !subject || !description) {
        return apiError('Nombre, correo, asunto y descripcion son obligatorios.', {
            requestId,
            status: 400,
            code: 'ADMIN_SUPPORT_TICKET_INVALID',
        });
    }

    try {
        const ticket = await createSupportRequest(auth.context.supabaseAdmin, {
            requestId,
            requesterName,
            requesterEmail,
            requestedBy: typeof body?.requestedBy === 'string' ? body.requestedBy : null,
            countryCode: typeof body?.countryCode === 'string' ? body.countryCode : 'CO',
            domain: (typeof body?.domain === 'string' ? body.domain : 'support') as SupportRequest['domain'],
            category: normalizeSupportCategory(body?.category),
            priority: normalizeSupportPriority(body?.priority),
            preferredContactChannel: typeof body?.preferredContactChannel === 'string' ? body.preferredContactChannel as SupportRequest['preferred_contact_channel'] : 'email',
            subject,
            description,
            assignedTo: typeof body?.assignedTo === 'string' ? body.assignedTo : auth.context.authUser.id,
            relatedUserId: typeof body?.relatedUserId === 'string' ? body.relatedUserId : null,
            relatedBusinessId: typeof body?.relatedBusinessId === 'string' ? body.relatedBusinessId : null,
            relatedTruckerId: typeof body?.relatedTruckerId === 'string' ? body.relatedTruckerId : null,
            relatedOfferId: typeof body?.relatedOfferId === 'string' ? body.relatedOfferId : null,
            relatedPaymentId: typeof body?.relatedPaymentId === 'string' ? body.relatedPaymentId : null,
            relatedWalletTransactionId: typeof body?.relatedWalletTransactionId === 'string' ? body.relatedWalletTransactionId : null,
            metadata: {
                source: 'internal_support_portal',
                created_by_staff: auth.context.authUser.id,
            },
        });

        await createSupportTicketMessage(auth.context.supabaseAdmin, {
            ticketId: ticket.id,
            authorId: auth.context.authUser.id,
            authorEmail: auth.context.profile?.email || auth.context.authUser.email,
            authorName: auth.context.profile?.full_name || 'KargaX',
            authorRole: auth.context.staff.actorRole,
            visibility: 'internal',
            body: description,
        });

        await createSupportTicketEvent(auth.context.supabaseAdmin, {
            ticketId: ticket.id,
            actorId: auth.context.authUser.id,
            actorRole: auth.context.staff.actorRole,
            action: 'ticket_created_by_staff',
            newStatus: ticket.status,
            newPriority: ticket.priority,
            metadata: { category: ticket.category || 'other' },
        });

        await recordStaffAuditEvent(auth.context.supabaseAdmin, {
            actorId: auth.context.authUser.id,
            actorRole: auth.context.staff.actorRole,
            capability: 'support:reply',
            targetType: 'support_ticket',
            targetId: ticket.id,
            newState: {
                status: ticket.status,
                priority: ticket.priority,
                category: ticket.category || 'other',
            },
            reason: 'ticket_created_by_staff',
            ...getRequestAuditMetadata(request),
        });

        return apiSuccess(normalizeSupportTicket(ticket), {
            requestId,
            status: 201,
            code: 'ADMIN_SUPPORT_TICKET_CREATED',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'No se pudo crear el ticket', {
            requestId,
            status: 500,
            code: 'ADMIN_SUPPORT_TICKET_CREATE_FAILED',
        });
    }
}
