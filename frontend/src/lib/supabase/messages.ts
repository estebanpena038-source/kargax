// =============================================================================
// KARGAX - SUPABASE MESSAGES SERVICE
// Enterprise-grade messaging with Supabase
// =============================================================================

import { supabase } from './client';

// =============================================================================
// Types
// =============================================================================

export interface Conversation {
    id: string;
    participant1_id: string;
    participant2_id: string;
    offer_id: string | null;
    last_message_preview: string | null;
    last_message_at: string | null;
    unread_count_1: number;
    unread_count_2: number;
    created_at: string;
    // Joined fields
    other_participant_name?: string;
    other_participant_email?: string;
    offer_title?: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_name?: string;
    content: string;
    message_type: 'text' | 'image' | 'file' | 'system';
    is_read: boolean;
    read_at: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
    created_at: string;
}

interface MessageResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// =============================================================================
// Messages Service
// =============================================================================

export const supabaseMessages = {
    // =========================================================================
    // GET OR CREATE CONVERSATION
    // =========================================================================
    async getOrCreateConversation(
        userId1: string,
        userId2: string,
        offerId?: string
    ): Promise<MessageResult<string>> {
        try {
            // Ordenar IDs para consistencia
            const [p1, p2] = [userId1, userId2].sort();

            // Buscar conversación existente
            const { data: existing } = await (supabase.from('conversations' as any) as any)
                .select('id')
                .eq('participant1_id', p1)
                .eq('participant2_id', p2)
                .single();

            const existingConversation = existing as { id: string } | null;

            if (existingConversation) {
                return { success: true, data: existingConversation.id };
            }

            // Crear nueva conversación
            const { data: newConv, error } = await (supabase.from('conversations' as any) as any)
                .insert({
                    participant1_id: p1,
                    participant2_id: p2,
                    offer_id: offerId || null,
                })
                .select('id')
                .single();

            if (error) {
                // Puede ser race condition, intentar buscar otra vez
                if (error.code === '23505') {
                    const { data: retry } = await (supabase.from('conversations' as any) as any)
                        .select('id')
                        .eq('participant1_id', p1)
                        .eq('participant2_id', p2)
                        .single();
                    const retryConversation = retry as { id: string } | null;
                    if (retryConversation) {
                        return { success: true, data: retryConversation.id };
                    }
                }
                console.error('[Messages] Create conversation error:', error);
                return { success: false, error: error.message };
            }

            const createdConversation = newConv as { id: string } | null;

            if (!createdConversation) {
                return { success: false, error: 'No se pudo crear la conversacion' };
            }

            return { success: true, data: createdConversation.id };
        } catch (err) {
            console.error('[Messages] GetOrCreate exception:', err);
            return { success: false, error: 'Error al crear conversación' };
        }
    },

    // =========================================================================
    // GET USER CONVERSATIONS
    // =========================================================================
    async getConversations(): Promise<MessageResult<{
        data: Array<{
            id: string;
            otherParticipantName: string;
            otherParticipantEmail: string;
            lastMessagePreview: string | null;
            lastMessageAt: string | null;
            unreadCount: number;
            offerTitle: string | null;
        }>;
    }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }
            const userId = userData.user.id;

            // Obtener conversaciones donde el usuario es participante
            const { data, error } = await (supabase.from('conversations' as any) as any)
                .select(`
                    *,
                    participant1:participant1_id (id, raw_user_meta_data),
                    participant2:participant2_id (id, raw_user_meta_data),
                    offer:offer_id (cargo_description)
                `)
                .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
                .order('last_message_at', { ascending: false, nullsFirst: false });

            if (error) {
                console.error('[Messages] GetConversations error:', error);
                return { success: false, error: error.message };
            }

            // Mapear resultados
            const conversations = (data || []).map((c: any) => {
                const isP1 = c.participant1_id === userId;
                const otherUser = isP1 ? c.participant2 : c.participant1;

                return {
                    id: c.id,
                    otherParticipantName: otherUser?.raw_user_meta_data?.full_name || 'Usuario',
                    otherParticipantEmail: otherUser?.raw_user_meta_data?.email || '',
                    lastMessagePreview: c.last_message_preview,
                    lastMessageAt: c.last_message_at,
                    unreadCount: isP1 ? c.unread_count_1 : c.unread_count_2,
                    offerTitle: c.offer?.cargo_description?.substring(0, 50) || null,
                };
            });

            return { success: true, data: { data: conversations } };
        } catch (err) {
            console.error('[Messages] GetConversations exception:', err);
            return { success: false, error: 'Error al obtener conversaciones' };
        }
    },

    // =========================================================================
    // GET MESSAGES IN CONVERSATION
    // =========================================================================
    async getMessages(
        conversationId: string,
        params?: { page?: number; limit?: number }
    ): Promise<MessageResult<{
        data: Message[];
        meta: { page: number; limit: number; total: number };
    }>> {
        try {
            const page = params?.page || 1;
            const limit = params?.limit || 50;
            const offset = (page - 1) * limit;

            // Obtener mensajes
            const { data, error, count } = await (supabase.from('messages' as any) as any)
                .select(`
                    *,
                    sender:sender_id (raw_user_meta_data)
                `, { count: 'exact' })
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .range(offset, offset + limit - 1);

            if (error) {
                console.error('[Messages] GetMessages error:', error);
                return { success: false, error: error.message };
            }

            const messages = (data || []).map((m: any) => ({
                ...m,
                senderName: m.sender?.raw_user_meta_data?.full_name || 'Usuario',
            }));

            return {
                success: true,
                data: {
                    data: messages,
                    meta: {
                        page,
                        limit,
                        total: count || 0,
                    },
                },
            };
        } catch (err) {
            console.error('[Messages] GetMessages exception:', err);
            return { success: false, error: 'Error al obtener mensajes' };
        }
    },

    // =========================================================================
    // SEND MESSAGE
    // =========================================================================
    async send(data: {
        recipientId: string;
        content: string;
        offerId?: string;
    }): Promise<MessageResult<{ id: string; conversationId: string }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }
            const senderId = userData.user.id;

            // Obtener o crear conversación
            const convResult = await supabaseMessages.getOrCreateConversation(
                senderId,
                data.recipientId,
                data.offerId
            );

            if (!convResult.success || !convResult.data) {
                return { success: false, error: convResult.error };
            }

            const conversationId = convResult.data;

            // Insertar mensaje
            const { data: message, error } = await (supabase.from('messages' as any) as any)
                .insert({
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content: data.content,
                    message_type: 'text',
                })
                .select('id')
                .single();

            if (error) {
                console.error('[Messages] Send error:', error);
                return { success: false, error: error.message };
            }

            const createdMessage = message as { id: string } | null;

            if (!createdMessage) {
                return { success: false, error: 'No se pudo crear el mensaje' };
            }

            return {
                success: true,
                data: {
                    id: createdMessage.id,
                    conversationId,
                },
            };
        } catch (err) {
            console.error('[Messages] Send exception:', err);
            return { success: false, error: 'Error al enviar mensaje' };
        }
    },

    // =========================================================================
    // MARK CONVERSATION AS READ
    // =========================================================================
    async markAsRead(conversationId: string): Promise<MessageResult<{ count: number }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            const { data, error } = await (supabase as any).rpc('mark_messages_read', {
                p_conversation_id: conversationId,
                p_user_id: userData.user.id,
            });

            if (error) {
                console.error('[Messages] MarkAsRead error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { count: data || 0 } };
        } catch (err) {
            console.error('[Messages] MarkAsRead exception:', err);
            return { success: false, error: 'Error al marcar como leído' };
        }
    },

    // =========================================================================
    // GET UNREAD COUNT
    // =========================================================================
    async getUnreadCount(): Promise<MessageResult<{ count: number }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            const { data, error } = await (supabase as any).rpc('get_unread_count', {
                p_user_id: userData.user.id,
            });

            if (error) {
                console.error('[Messages] GetUnreadCount error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { count: data || 0 } };
        } catch (err) {
            console.error('[Messages] GetUnreadCount exception:', err);
            return { success: false, error: 'Error al obtener no leídos' };
        }
    },
};

export default supabaseMessages;
