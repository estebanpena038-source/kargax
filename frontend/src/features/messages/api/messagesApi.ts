// =============================================================================
// KARGAX - Messages API Service (Supabase Version)
// Enterprise-Grade API Layer for Messaging System
// =============================================================================
//
// ARCHITECTURE NOTES:
// - Uses Supabase as the backend (not REST API)
// - All API calls go through centralized functions for consistency
// - Response transformations happen here for clean component code
//
// =============================================================================

import { supabaseMessages } from '@/lib/supabase/messages';
import { supabase } from '@/lib/supabase/client';

import type {
    Conversation,
    Message,
    SendMessagePayload,
    SendMessageResponse,
    GetMessagesOptions,
} from '../types';

// =============================================================================
// API FUNCTIONS - Using Supabase
// =============================================================================

/**
 * Fetches all conversations for the current user.
 * Conversations are sorted by last message date (most recent first).
 */
export async function fetchConversations(): Promise<Conversation[]> {
    const result = await supabaseMessages.getConversations();

    if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al cargar conversaciones');
    }

    // Get current user ID
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id || '';

    // Transform to UI format
    return result.data.data.map((conv) => ({
        id: conv.id,
        participant1Id: '', // Will be populated if needed
        participant2Id: '',
        offerId: null,
        otherParticipantName: conv.otherParticipantName,
        otherParticipantEmail: conv.otherParticipantEmail,
        lastMessagePreview: conv.lastMessagePreview || null,
        lastMessageAt: conv.lastMessageAt || null,
        unreadCount: conv.unreadCount,
        createdAt: conv.lastMessageAt || new Date().toISOString(),
        offerTitle: conv.offerTitle || undefined,
        avatar: conv.otherParticipantName
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.otherParticipantName)}&background=f59e0b&color=fff`
            : undefined,
        priority: conv.unreadCount > 5 ? 'high' : 'normal',
        cargoContext: conv.offerTitle ? {
            offerId: '',
            title: conv.offerTitle,
            route: conv.offerTitle,
            status: 'Activa' as const,
        } : undefined,
    }));
}

/**
 * Fetches messages for a specific conversation.
 */
export async function fetchMessages(
    conversationId: string,
    options: GetMessagesOptions = {}
): Promise<{ data: Message[]; meta: { page: number; limit: number; total: number } }> {
    const { page = 1, limit = 50 } = options;

    const result = await supabaseMessages.getMessages(conversationId, { page, limit });

    if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al cargar mensajes');
    }

    // Get current user ID
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id || '';

    // Mark as read automatically
    await supabaseMessages.markAsRead(conversationId);

    // Transform to UI format
    const messages: Message[] = result.data.data.map((msg: any) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        senderId: msg.sender_id,
        senderName: msg.senderName || 'Usuario',
        content: msg.content,
        isRead: msg.is_read,
        readAt: msg.read_at || null,
        messageType: msg.message_type || 'text',
        attachmentUrl: msg.attachment_url || null,
        attachmentName: msg.attachment_name || null,
        createdAt: msg.created_at,
        status: msg.is_read ? 'read' : 'delivered',
        isMine: msg.sender_id === currentUserId,
    }));

    return {
        data: messages,
        meta: result.data.meta,
    };
}

/**
 * Sends a message to another user.
 */
export async function sendMessage(
    payload: SendMessagePayload
): Promise<SendMessageResponse> {
    const result = await supabaseMessages.send({
        recipientId: payload.recipientId,
        content: payload.content,
        offerId: payload.offerId,
    });

    if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al enviar mensaje');
    }

    return {
        id: result.data.id,
        conversationId: result.data.conversationId,
    };
}

/**
 * Marks all messages in a conversation as read.
 */
export async function markConversationAsRead(
    conversationId: string
): Promise<{ count: number }> {
    const result = await supabaseMessages.markAsRead(conversationId);

    if (!result.success) {
        throw new Error(result.error || 'Error al marcar como leído');
    }

    return { count: result.data?.count || 0 };
}

/**
 * Fetches the total count of unread messages.
 */
export async function fetchUnreadCount(): Promise<number> {
    const result = await supabaseMessages.getUnreadCount();

    if (!result.success) {
        throw new Error(result.error || 'Error al obtener no leídos');
    }

    return result.data?.count || 0;
}

/**
 * Validates a message payload before sending.
 */
export function validateMessagePayload(payload: Partial<SendMessagePayload>): void {
    if (!payload.recipientId) {
        throw new Error('El destinatario es requerido');
    }

    if (!payload.content?.trim()) {
        throw new Error('El mensaje no puede estar vacío');
    }

    if (payload.content.length > 5000) {
        throw new Error('El mensaje es demasiado largo (máximo 5000 caracteres)');
    }
}

// =============================================================================
// REAL-TIME SUBSCRIPTIONS
// =============================================================================

/**
 * Subscribes to real-time messages for a conversation.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(
    conversationId: string,
    onNewMessage: (message: any) => void
): () => void {
    const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
                console.log('[Messages] Real-time message received:', payload);
                onNewMessage(payload.new);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Subscribes to conversation updates for current user.
 */
export function subscribeToConversations(
    userId: string,
    onUpdate: (conversation: any) => void
): () => void {
    const channel = supabase
        .channel(`conversations:${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'conversations',
            },
            (payload) => {
                console.log('[Messages] Conversation update:', payload);
                onUpdate(payload.new);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    fetchConversations,
    fetchMessages,
    sendMessage,
    markConversationAsRead,
    fetchUnreadCount,
    validateMessagePayload,
    subscribeToMessages,
    subscribeToConversations,
};
