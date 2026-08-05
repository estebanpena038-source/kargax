// =============================================================================
// KARGAX - Messages API Service (Supabase Version)
// Enterprise-Grade API Layer for Messaging System
// =============================================================================

import { supabaseMessages } from '@/lib/supabase/messages';
import { supabase } from '@/lib/supabase/client';

import type {
    Conversation,
    Message,
    SendMessagePayload,
    SendMessageResponse,
    GetMessagesOptions,
    CreateChannelPayload,
    ChannelConversation,
    ConversationParticipant,
    ParticipantRole,
    LocationData,
    EvidenceData,
    ChannelMessage,
    ChannelType,
    UserPresence,
    PresenceStatus,
} from '../types';

/**
 * Fetches organization info including company name and unique invite code.
 */
export async function fetchOrganizationInfo(): Promise<{
    businessId: string | null;
    companyName: string;
    inviteCode: string;
    isOwner: boolean;
    role: string;
}> {
    try {
        const res = await fetch('/api/business/organization');
        if (!res.ok) {
            throw new Error('Error al obtener organización');
        }
        const json = await res.json();
        return json.data || {
            businessId: null,
            companyName: 'KargaX Logística',
            inviteCode: 'KX-KARGAX-2026',
            isOwner: false,
            role: 'member',
        };
    } catch (e) {
        console.error('[fetchOrganizationInfo] error:', e);
        return {
            businessId: null,
            companyName: 'KargaX Logística',
            inviteCode: 'KX-KARGAX-2026',
            isOwner: false,
            role: 'member',
        };
    }
}

/**
 * Joins a business organization using an invite code (e.g. KX-TONOITO-2026).
 */
export async function joinOrganizationByInviteCode(inviteCode: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
}> {
    const res = await fetch('/api/business/team/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al unirse a la organización');
    }

    return json;
}

/**
 * Fetches all conversations (Channels, Active Trips, DMs, Archived) for the current user.
 */
export async function fetchConversations(): Promise<Conversation[]> {
    try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        if (!userId) {
            return [];
        }

        // 1. Get conversation IDs where user is in conversation_participants
        const { data: participations } = await (supabase.from('conversation_participants' as any) as any)
            .select('conversation_id, unread_count')
            .eq('user_id', userId);

        const participantConvIds = (participations || []).map((p: any) => p.conversation_id);

        // 2. Query conversations: either by direct participant IDs or in participantConvIds
        let query = (supabase.from('conversations' as any) as any)
            .select('*')
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (participantConvIds.length > 0) {
            query = query.or(`participant1_id.eq.${userId},participant2_id.eq.${userId},id.in.(${participantConvIds.join(',')})`);
        } else {
            query = query.or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`);
        }

        const { data: rawConvs, error } = await query;

        if (error) {
            console.error('[fetchConversations] Supabase query error:', error);
            // Fallback to supabaseMessages
            const fallback = await supabaseMessages.getConversations();
            if (fallback.success && fallback.data) {
                return fallback.data.data.map((c) => ({
                    id: c.id,
                    participant1Id: '',
                    participant2Id: '',
                    offerId: null,
                    otherParticipantName: c.otherParticipantName,
                    otherParticipantEmail: c.otherParticipantEmail,
                    lastMessagePreview: c.lastMessagePreview,
                    lastMessageAt: c.lastMessageAt,
                    unreadCount: c.unreadCount,
                    createdAt: c.lastMessageAt || new Date().toISOString(),
                    channelType: 'direct',
                    title: c.otherParticipantName,
                    isArchived: false,
                }));
            }
            return [];
        }

        // 3. Extract other user IDs for direct messages to fetch real names
        const otherUserIds = new Set<string>();
        for (const c of rawConvs || []) {
            if (c.participant1_id && c.participant1_id !== userId) otherUserIds.add(c.participant1_id);
            if (c.participant2_id && c.participant2_id !== userId) otherUserIds.add(c.participant2_id);
        }

        let userNamesMap = new Map<string, { name: string; avatar?: string }>();
        if (otherUserIds.size > 0) {
            const { data: profiles } = await (supabase.from('user_profiles' as any) as any)
                .select('id, full_name, avatar_url, user_type')
                .in('id', Array.from(otherUserIds));

            for (const p of profiles || []) {
                userNamesMap.set(p.id, {
                    name: p.full_name || 'Usuario KargaX',
                    avatar: p.avatar_url,
                });
            }
        }

        // 4. Transform into structured Conversation models
        const mapped: Conversation[] = (rawConvs || []).map((c: any) => {
            const isP1 = c.participant1_id === userId;
            const otherUserId = isP1 ? c.participant2_id : c.participant1_id;
            const otherProfile = otherUserId ? userNamesMap.get(otherUserId) : undefined;

            let displayName = c.title;
            if (!displayName && otherProfile) {
                displayName = otherProfile.name;
            } else if (!displayName && c.channel_type === 'direct') {
                displayName = 'Mensaje Directo';
            } else if (!displayName) {
                displayName = '#general';
            }

            // Unread count
            const pInfo = participations?.find((p: any) => p.conversation_id === c.id);
            let unread = pInfo?.unread_count ?? (isP1 ? c.unread_count_1 : c.unread_count_2) ?? 0;

            const channelType: ChannelType = c.channel_type || (c.entity_type === 'trip' ? 'trip' : c.participant1_id ? 'direct' : 'fleet');

            return {
                id: c.id,
                participant1Id: c.participant1_id,
                participant2Id: c.participant2_id,
                offerId: c.entity_type === 'trip' ? c.entity_id : c.offer_id,
                otherParticipantName: displayName,
                otherParticipantEmail: '',
                lastMessagePreview: c.last_message_preview || null,
                lastMessageAt: c.last_message_at || c.created_at,
                unreadCount: unread || 0,
                createdAt: c.created_at || new Date().toISOString(),
                offerTitle: c.title || undefined,
                channelType,
                title: displayName,
                entityId: c.entity_id,
                entityType: c.entity_type,
                businessId: c.business_id,
                isArchived: !!c.is_archived,
                avatar: otherProfile?.avatar,
                priority: unread > 5 ? 'high' : 'normal',
            };
        });

        return mapped;
    } catch (err: any) {
        console.error('[fetchConversations] exception:', err);
        return [];
    }
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

    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id || '';

    const messages = result.data.data.map((msg: any) => ({
        id: msg.id,
        conversationId: msg.conversation_id || msg.conversationId,
        senderId: msg.sender_id || msg.senderId,
        senderName: msg.senderName || msg.sender_name,
        content: msg.content,
        isRead: msg.is_read ?? msg.isRead ?? false,
        readAt: msg.read_at || msg.readAt,
        messageType: msg.message_type || msg.messageType || 'text',
        attachmentUrl: msg.attachment_url || msg.attachmentUrl,
        attachmentName: msg.attachment_name || msg.attachmentName,
        createdAt: msg.created_at || msg.createdAt,
        status: 'delivered' as const,
        isMine: (msg.sender_id || msg.senderId) === currentUserId,
    }));

    return {
        data: messages,
        meta: result.data.meta,
    };
}

/**
 * Sends a message.
 */
export async function sendMessage(payload: SendMessagePayload): Promise<SendMessageResponse> {
    const errors = validateMessagePayload(payload);
    if (errors.length > 0) {
        throw new Error(errors[0]);
    }

    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id || '';

    let conversationId = payload.conversationId;

    if (!conversationId && payload.recipientId) {
        const convResult = await supabaseMessages.getOrCreateConversation(
            currentUserId,
            payload.recipientId,
            payload.offerId
        );
        if (!convResult.success || !convResult.data) {
            throw new Error(convResult.error || 'Error al crear conversacion');
        }
        conversationId = convResult.data;
    }

    if (!conversationId) {
        throw new Error('ID de conversacion o destinatario es requerido');
    }

    const { data: message, error } = await (supabase.from('messages' as any) as any)
        .insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: payload.content,
            message_type: payload.messageType || 'text',
            attachment_url: payload.attachmentUrl || null,
            attachment_name: payload.attachmentName || null,
            reply_to_id: payload.replyToId || null,
            metadata: payload.metadata || {}
        })
        .select('id, conversation_id')
        .single();

    if (error) {
        throw new Error(error.message || 'Error al enviar mensaje');
    }

    return {
        id: message.id,
        conversationId: message.conversation_id,
    };
}

/**
 * Marks a conversation as read.
 */
export async function markConversationAsRead(conversationId: string): Promise<void> {
    const result = await supabaseMessages.markAsRead(conversationId);
    if (!result.success) {
        throw new Error(result.error || 'Error al marcar como leido');
    }
}

/**
 * Fetches unread message count.
 */
export async function fetchUnreadCount(): Promise<number> {
    const result = await supabaseMessages.getUnreadCount();
    if (!result.success) {
        return 0;
    }
    return result.data?.count || 0;
}

/**
 * Validates a message payload.
 */
export function validateMessagePayload(payload: SendMessagePayload): string[] {
    const errors: string[] = [];
    if (!payload.recipientId && !payload.conversationId) {
        errors.push('Destinatario o conversacion es requerido');
    }
    if (!payload.content || payload.content.trim().length === 0) {
        errors.push('El contenido del mensaje no puede estar vacio');
    }
    if (payload.content && payload.content.length > 5000) {
        errors.push('El mensaje no puede exceder los 5000 caracteres');
    }
    return errors;
}

/**
 * Subscribes to real-time message updates.
 */
export function subscribeToMessages(
    conversationId: string,
    onMessage: (message: Message) => void
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
            async (payload) => {
                const { data: userData } = await supabase.auth.getUser();
                const currentUserId = userData?.user?.id || '';
                const newMsg = payload.new as any;
                onMessage({
                    id: newMsg.id,
                    conversationId: newMsg.conversation_id,
                    senderId: newMsg.sender_id,
                    content: newMsg.content,
                    isRead: newMsg.is_read || false,
                    readAt: newMsg.read_at,
                    messageType: newMsg.message_type || 'text',
                    attachmentUrl: newMsg.attachment_url,
                    attachmentName: newMsg.attachment_name,
                    createdAt: newMsg.created_at,
                    status: 'delivered',
                    isMine: newMsg.sender_id === currentUserId,
                });
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Subscribes to real-time conversation updates.
 */
export function subscribeToConversations(
    onUpdate: (conversation: any) => void
): () => void {
    const channel = supabase
        .channel('conversations_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'conversations',
            },
            (payload) => {
                onUpdate(payload.new);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

export async function createEntityChannel(payload: CreateChannelPayload): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('No autenticado');

    const { data, error } = await (supabase.rpc as any)('create_entity_channel', {
        p_channel_type: payload.channelType,
        p_entity_type: payload.entityType || null,
        p_entity_id: payload.entityId || null,
        p_title: payload.title || null,
        p_participant_ids: payload.participantIds,
        p_creator_id: userData.user.id
    });

    if (error) throw new Error(error.message || 'Error al crear canal');
    return data as string;
}

export async function fetchChannelByEntity(entityType: string, entityId: string): Promise<ChannelConversation | null> {
    const { data, error } = await (supabase.from('conversations' as any) as any)
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(error.message || 'Error al buscar canal');
    }
    
    return data as ChannelConversation;
}

export async function fetchChannelParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    const { data, error } = await (supabase.from('conversation_participants' as any) as any)
        .select('*')
        .eq('conversation_id', conversationId);
        
    if (error) throw new Error(error.message || 'Error al obtener participantes');
    return (data || []) as ConversationParticipant[];
}

export async function addParticipant(conversationId: string, userId: string, role: ParticipantRole = 'member'): Promise<void> {
    const { error } = await (supabase.from('conversation_participants' as any) as any)
        .insert({
            conversation_id: conversationId,
            user_id: userId,
            role
        });
        
    if (error) throw new Error(error.message || 'Error al agregar participante');
}

export async function sendLocationMessage(conversationId: string, location: LocationData): Promise<SendMessageResponse> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('No autenticado');

    const { data, error } = await (supabase.from('messages' as any) as any)
        .insert({
            conversation_id: conversationId,
            sender_id: userData.user.id,
            content: 'Ubicacion compartida',
            message_type: 'location',
            metadata: location
        })
        .select('id, conversation_id')
        .single();
        
    if (error) throw new Error(error.message || 'Error al enviar ubicacion');
    return { id: data.id, conversationId: data.conversation_id };
}

export async function sendVoiceMessage(conversationId: string, audioBlob: Blob): Promise<SendMessageResponse> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('No autenticado');

    const fileName = `${conversationId}/${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
        .from('voice_messages')
        .upload(fileName, audioBlob);
        
    if (uploadError) throw new Error(uploadError.message || 'Error al subir audio');
    
    const { data: publicUrlData } = supabase.storage
        .from('voice_messages')
        .getPublicUrl(fileName);

    const { data, error } = await (supabase.from('messages' as any) as any)
        .insert({
            conversation_id: conversationId,
            sender_id: userData.user.id,
            content: 'Mensaje de voz',
            message_type: 'audio',
            attachment_url: publicUrlData.publicUrl
        })
        .select('id, conversation_id')
        .single();
        
    if (error) throw new Error(error.message || 'Error al enviar nota de voz');
    return { id: data.id, conversationId: data.conversation_id };
}

export async function sendEvidenceMessage(conversationId: string, evidence: EvidenceData): Promise<SendMessageResponse> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('No autenticado');

    const { data, error } = await (supabase.from('messages' as any) as any)
        .insert({
            conversation_id: conversationId,
            sender_id: userData.user.id,
            content: evidence.caption || 'Evidencia enviada',
            message_type: 'evidence',
            attachment_url: evidence.photoUrl,
            metadata: evidence
        })
        .select('id, conversation_id')
        .single();
        
    if (error) throw new Error(error.message || 'Error al enviar evidencia');
    return { id: data.id, conversationId: data.conversation_id };
}

export async function reactToMessage(messageId: string, emoji: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('No autenticado');

    const { error } = await (supabase.from('message_reactions' as any) as any)
        .upsert({
            message_id: messageId,
            user_id: userData.user.id,
            emoji
        }, { onConflict: 'message_id,user_id,emoji' });
        
    if (error) throw new Error(error.message || 'Error al reaccionar');
}

export async function removeReaction(messageId: string, emoji: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('No autenticado');

    const { error } = await (supabase.from('message_reactions' as any) as any)
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userData.user.id)
        .eq('emoji', emoji);
        
    if (error) throw new Error(error.message || 'Error al remover reaccion');
}

export async function replyToMessage(conversationId: string, replyToId: string, content: string): Promise<SendMessageResponse> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('No autenticado');

    const { data, error } = await (supabase.from('messages' as any) as any)
        .insert({
            conversation_id: conversationId,
            sender_id: userData.user.id,
            content,
            message_type: 'text',
            reply_to_id: replyToId
        })
        .select('id, conversation_id')
        .single();
        
    if (error) throw new Error(error.message || 'Error al responder mensaje');
    return { id: data.id, conversationId: data.conversation_id };
}

export async function searchMessages(query: string, filters?: { channelType?: ChannelType; startDate?: string; endDate?: string }): Promise<ChannelMessage[]> {
    let supabaseQuery = (supabase.from('messages' as any) as any)
        .select('*, conversations!inner(channel_type)')
        .ilike('content', `%${query}%`);
        
    if (filters?.channelType) {
        supabaseQuery = supabaseQuery.eq('conversations.channel_type', filters.channelType);
    }
    if (filters?.startDate) {
        supabaseQuery = supabaseQuery.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
        supabaseQuery = supabaseQuery.lte('created_at', filters.endDate);
    }
    
    const { data, error } = await supabaseQuery.limit(50);
    if (error) throw new Error(error.message || 'Error en la busqueda');
    return (data || []) as ChannelMessage[];
}

export function subscribeToPresence(conversationId: string, onPresenceChange: (presence: UserPresence[]) => void): () => void {
    const roomOne = supabase.channel(`presence:${conversationId}`, {
        config: { presence: { key: conversationId } },
    });

    roomOne
        .on('presence', { event: 'sync' }, () => {
            const newState = roomOne.presenceState();
            const presenceList: UserPresence[] = [];
            for (const key in newState) {
                const presence = newState[key][0] as any;
                if (presence) {
                    presenceList.push({
                        userId: presence.userId,
                        status: presence.status || 'online',
                        lastSeenAt: presence.lastSeenAt || new Date().toISOString(),
                        typingInConversationId: presence.typingInConversationId || null,
                        currentDevice: presence.currentDevice || null
                    });
                }
            }
            onPresenceChange(presenceList);
        })
        .subscribe();

    return () => {
        supabase.removeChannel(roomOne);
    };
}

export async function broadcastTyping(conversationId: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const channel = supabase.channel(`presence:${conversationId}`);
    await channel.track({
        userId: userData.user.id,
        typingInConversationId: conversationId,
        status: 'online',
        lastSeenAt: new Date().toISOString()
    });
    
    setTimeout(() => {
        channel.track({
            userId: userData.user.id,
            typingInConversationId: null,
            status: 'online',
            lastSeenAt: new Date().toISOString()
        }).catch(console.error);
    }, 3000);
}

export async function updatePresenceStatus(status: PresenceStatus): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const channel = supabase.channel(`global_presence`);
    await channel.track({
        userId: userData.user.id,
        status,
        lastSeenAt: new Date().toISOString()
    });
}

export async function archiveConversation(conversationId: string): Promise<void> {
    const { error } = await (supabase.from('conversations' as any) as any)
        .update({ is_archived: true })
        .eq('id', conversationId);
        
    if (error) throw new Error(error.message || 'Error al archivar conversacion');
}

export async function pinMessage(conversationId: string, messageId: string): Promise<void> {
    const { error } = await (supabase.from('conversations' as any) as any)
        .update({ pinned_message_id: messageId })
        .eq('id', conversationId);
        
    if (error) throw new Error(error.message || 'Error al fijar mensaje');
}

export default {
    fetchOrganizationInfo,
    joinOrganizationByInviteCode,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markConversationAsRead,
    fetchUnreadCount,
    validateMessagePayload,
    subscribeToMessages,
    subscribeToConversations,
    createEntityChannel,
    fetchChannelByEntity,
    fetchChannelParticipants,
    addParticipant,
    sendLocationMessage,
    sendVoiceMessage,
    sendEvidenceMessage,
    reactToMessage,
    removeReaction,
    replyToMessage,
    searchMessages,
    subscribeToPresence,
    broadcastTyping,
    updatePresenceStatus,
    archiveConversation,
    pinMessage,
};

