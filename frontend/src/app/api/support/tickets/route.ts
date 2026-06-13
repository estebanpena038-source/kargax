import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { createSupportRequest } from '@/lib/server/operations';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    createSupportTicketEvent,
    createSupportTicketMessage,
    isSupportEnabled,
    normalizeSupportCategory,
    normalizeSupportPriority,
    normalizeSupportStatus,
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

    const auth = await requireAuthenticatedRoute(request, { requireAal2: false });

    if ('response' in auth) {
        return auth.response;
    }

    const { data, error } = await auth.context.supabaseAdmin
        .from('support_requests')
        .select('*')
        .eq('requested_by', auth.context.authUser.id)
        .order('updated_at', { ascending: false })
        .limit(Number(request.nextUrl.searchParams.get('limit') || 50));

    if (error) {
        return apiError(error.message || 'No se pudieron cargar los tickets', {
            requestId,
            status: 500,
            code: 'SUPPORT_TICKETS_FAILED',
        });
    }

    return apiSuccess((data || []).map(normalizeSupportTicket), {
        requestId,
        code: 'SUPPORT_TICKETS_READY',
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

    const auth = await requireAuthenticatedRoute(request, { requireAal2: false });

    if ('response' in auth) {
        return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const domain = typeof body?.domain === 'string' ? body.domain : 'support';
    const priority = normalizeSupportPriority(body?.priority);
    const category = normalizeSupportCategory(body?.category);

    if (!subject || !description) {
        return apiError('Asunto y descripcion son obligatorios.', {
            requestId,
            status: 400,
            code: 'SUPPORT_TICKET_INVALID',
        });
    }

    try {
        const ticket = await createSupportRequest(auth.context.supabaseAdmin, {
            requestId,
            requesterName: auth.context.profile?.full_name || auth.context.authUser.email || 'Usuario KargaX',
            requesterEmail: auth.context.profile?.email || auth.context.authUser.email || '',
            requestedBy: auth.context.authUser.id,
            countryCode: auth.context.profile?.country_code || 'CO',
            domain: domain as SupportRequest['domain'],
            category,
            priority,
            subject,
            description,
            relatedUserId: typeof body?.relatedUserId === 'string' ? body.relatedUserId : null,
            relatedBusinessId: typeof body?.relatedBusinessId === 'string' ? body.relatedBusinessId : null,
            relatedTruckerId: typeof body?.relatedTruckerId === 'string' ? body.relatedTruckerId : null,
            relatedOfferId: typeof body?.relatedOfferId === 'string' ? body.relatedOfferId : null,
            relatedPaymentId: typeof body?.relatedPaymentId === 'string' ? body.relatedPaymentId : null,
            relatedWalletTransactionId: typeof body?.relatedWalletTransactionId === 'string' ? body.relatedWalletTransactionId : null,
            metadata: {
                source: 'external_support_portal',
            },
        });

        await createSupportTicketMessage(auth.context.supabaseAdmin, {
            ticketId: ticket.id,
            authorId: auth.context.authUser.id,
            authorEmail: auth.context.profile?.email || auth.context.authUser.email,
            authorName: auth.context.profile?.full_name || 'Usuario KargaX',
            authorRole: 'user',
            visibility: 'public',
            body: description,
        });

        await createSupportTicketEvent(auth.context.supabaseAdmin, {
            ticketId: ticket.id,
            actorId: auth.context.authUser.id,
            actorRole: 'user',
            action: 'ticket_created',
            newStatus: normalizeSupportStatus(ticket.status),
            newPriority: priority,
            metadata: { category },
        });

        return apiSuccess(normalizeSupportTicket(ticket), {
            requestId,
            status: 201,
            code: 'SUPPORT_TICKET_CREATED',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'No se pudo crear el ticket', {
            requestId,
            status: 500,
            code: 'SUPPORT_TICKET_CREATE_FAILED',
        });
    }
}
