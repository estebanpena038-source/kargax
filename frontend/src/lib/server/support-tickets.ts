import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;
type JsonRecord = Record<string, unknown>;

export const SUPPORT_TICKET_STATUSES = ['open', 'in_progress', 'waiting_user', 'escalated', 'resolved', 'closed'] as const;
export const SUPPORT_TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const SUPPORT_TICKET_CATEGORIES = [
    'payment_issue',
    'driver_issue',
    'shipment_issue',
    'account_issue',
    'subscription_issue',
    'platform_bug',
    'wallet_issue',
    'marketplace_issue',
    'security_issue',
    'other',
] as const;

export type SupportTicketStatus = typeof SUPPORT_TICKET_STATUSES[number];
export type SupportTicketPriority = typeof SUPPORT_TICKET_PRIORITIES[number];
export type SupportTicketCategory = typeof SUPPORT_TICKET_CATEGORIES[number];
export type SupportTicketVisibility = 'public' | 'internal';
export type SupportActorRole =
    | 'user'
    | 'platform_owner'
    | 'ops_manager'
    | 'support_lead'
    | 'support_agent'
    | 'payout_reviewer'
    | 'payout_approver'
    | 'support_admin'
    | 'payout_admin'
    | 'internal_admin'
    | 'ceo'
    | 'system';

export function isSupportEnabled() {
    return process.env.SUPPORT_ENABLED !== 'false';
}

export function normalizeSupportStatus(value: unknown): SupportTicketStatus {
    if (value === 'investigating') return 'in_progress';
    if (value === 'waiting_customer') return 'waiting_user';
    return SUPPORT_TICKET_STATUSES.includes(value as SupportTicketStatus)
        ? value as SupportTicketStatus
        : 'open';
}

export function normalizeSupportPriority(value: unknown): SupportTicketPriority {
    return SUPPORT_TICKET_PRIORITIES.includes(value as SupportTicketPriority)
        ? value as SupportTicketPriority
        : 'medium';
}

export function normalizeSupportCategory(value: unknown): SupportTicketCategory {
    return SUPPORT_TICKET_CATEGORIES.includes(value as SupportTicketCategory)
        ? value as SupportTicketCategory
        : 'other';
}

function normalizeRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : {};
}

export function normalizeSupportTicket(row: unknown) {
    const ticket = normalizeRecord(row);

    return {
        ...ticket,
        status: normalizeSupportStatus(ticket.status),
        priority: normalizeSupportPriority(ticket.priority),
        category: normalizeSupportCategory(ticket.category),
        metadata: normalizeRecord(ticket.metadata),
    };
}

export async function createSupportTicketEvent(
    supabaseAdmin: AdminClient,
    payload: {
        ticketId: string;
        actorId?: string | null;
        actorRole: SupportActorRole;
        action: string;
        previousStatus?: string | null;
        newStatus?: string | null;
        previousPriority?: string | null;
        newPriority?: string | null;
        previousAssignee?: string | null;
        newAssignee?: string | null;
        metadata?: JsonRecord;
    }
) {
    const { error } = await supabaseAdmin
        .from('support_ticket_events')
        .insert({
            ticket_id: payload.ticketId,
            actor_id: payload.actorId || null,
            actor_role: payload.actorRole,
            action: payload.action,
            previous_status: payload.previousStatus || null,
            new_status: payload.newStatus || null,
            previous_priority: payload.previousPriority || null,
            new_priority: payload.newPriority || null,
            previous_assignee: payload.previousAssignee || null,
            new_assignee: payload.newAssignee || null,
            metadata: payload.metadata || {},
        });

    if (error) {
        console.warn('[support-ticket-events][insert]', error.message || error);
    }
}

export async function createSupportTicketMessage(
    supabaseAdmin: AdminClient,
    payload: {
        ticketId: string;
        authorId?: string | null;
        authorEmail?: string | null;
        authorName?: string | null;
        authorRole: SupportActorRole;
        visibility: SupportTicketVisibility;
        body: string;
        attachments?: unknown[];
    }
) {
    const body = payload.body.trim();
    if (!body) {
        throw new Error('El mensaje no puede estar vacio.');
    }

    const { data, error } = await supabaseAdmin
        .from('support_ticket_messages')
        .insert({
            ticket_id: payload.ticketId,
            author_id: payload.authorId || null,
            author_email: payload.authorEmail || null,
            author_name: payload.authorName || null,
            author_role: payload.authorRole,
            visibility: payload.visibility,
            body,
            attachments: payload.attachments || [],
        })
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message || 'No se pudo crear el mensaje de soporte.');
    }

    await supabaseAdmin
        .from('support_requests')
        .update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', payload.ticketId);

    return data;
}

export async function loadSupportTicketMessages(
    supabaseAdmin: AdminClient,
    ticketId: string,
    visibility: 'all' | 'public' = 'public'
) {
    let query = supabaseAdmin
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    if (visibility === 'public') {
        query = query.eq('visibility', 'public');
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message || 'No se pudieron cargar los mensajes de soporte.');
    }

    return data || [];
}

export async function loadSupportTicketEvents(
    supabaseAdmin: AdminClient,
    ticketId: string
) {
    const { data, error } = await supabaseAdmin
        .from('support_ticket_events')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message || 'No se pudo cargar la auditoria del ticket.');
    }

    return data || [];
}
