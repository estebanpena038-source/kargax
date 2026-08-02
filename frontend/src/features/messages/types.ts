// =============================================================================
// KARGAX - Messages Module Types
// Enterprise-Grade TypeScript Definitions for Messaging System
// =============================================================================

export type MessageType = 'text' | 'image' | 'file' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type ConversationPriority = 'urgent' | 'high' | 'normal';

// Channel types
export type ChannelType = 'direct' | 'trip' | 'offer' | 'fleet' | 'dispatch' | 'support' | 'system';
export type ParticipantRole = 'owner' | 'admin' | 'member' | 'observer' | 'guest';
export type PresenceStatus = 'online' | 'away' | 'offline';
export type ExpandedMessageType = 'text' | 'image' | 'file' | 'system' | 'location' | 'audio' | 'status_update' | 'evidence' | 'pin_verification';

export interface CargoContext {
    offerId: string;
    title?: string;
    route: string;
    status: string;
}

export interface Participant {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
    company?: string;
    isOnline?: boolean;
}

export interface ConversationParticipant {
    id: string;
    conversationId: string;
    userId: string;
    role: ParticipantRole;
    joinedAt: string;
    lastReadAt: string | null;
    lastReadMessageId?: string | null;
    isMuted: boolean;
    unreadCount: number;
    guestToken?: string;
    guestName?: string;
    guestPhone?: string;
    userName?: string;
    userEmail?: string;
    userAvatar?: string;
    userType?: string;
}

export interface UserPresence {
    userId: string;
    status: PresenceStatus;
    lastSeenAt: string;
    typingInConversationId: string | null;
    currentDevice: string | null;
}

export interface MessageReaction {
    id: string;
    messageId: string;
    userId: string;
    emoji: string;
    createdAt: string;
    userName?: string;
}

export interface ReplyContext {
    messageId: string;
    content: string;
    senderName: string;
    messageType: ExpandedMessageType;
}

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy?: number;
    label?: string;
}

export interface VoiceMessageData {
    audioUrl: string;
    durationSeconds: number;
    waveform?: number[];
}

export interface EvidenceData {
    evidenceId: string;
    photoUrl: string;
    type: 'cargo' | 'delivery' | 'signature' | 'document' | 'inspection';
    caption?: string;
    quality?: 'high' | 'medium' | 'low';
}

export interface SystemEventData {
    eventType: string;
    icon: string;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    actionLabel?: string;
}

export interface QuickReply {
    id: string;
    label: string;
    message: string;
    icon?: string;
    channelTypes: ChannelType[];
}

export interface Conversation {
    id: string;
    participant1Id?: string | null;
    participant2Id?: string | null;
    offerId: string | null;
    lastMessagePreview: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    createdAt: string;
    otherParticipantName?: string;
    otherParticipantEmail?: string;
    offerTitle?: string;
    avatar?: string;
    company?: string;
    isOnline?: boolean;
    isTyping?: boolean;
    priority?: ConversationPriority;
    cargoContext?: CargoContext;

    // Extended channel fields
    channelType?: ChannelType;
    title?: string | null;
    entityId?: string | null;
    entityType?: string | null;
    businessId?: string | null;
    isArchived?: boolean;
    pinnedMessageId?: string | null;
    participants?: ConversationParticipant[];
}

export interface ChannelConversation extends Conversation {
    channelType: ChannelType;
    title: string | null;
    entityId: string | null;
    entityType: string | null;
    businessId: string | null;
    isArchived: boolean;
    pinnedMessageId: string | null;
    participants: ConversationParticipant[];
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    senderName?: string;
    content: string;
    isRead: boolean;
    readAt: string | null;
    messageType: MessageType | ExpandedMessageType;
    attachmentUrl: string | null;
    attachmentName: string | null;
    createdAt: string;
    status?: MessageStatus;
    isMine?: boolean;

    // Extended fields
    replyToId?: string | null;
    replyTo?: ReplyContext | null;
    metadata?: Record<string, any>;
    editedAt?: string | null;
    deletedAt?: string | null;
    reactions?: MessageReaction[];
    expandedType?: ExpandedMessageType;
    timestamp?: string;
    imageUrl?: string;
}

export interface ChannelMessage extends Message {
    replyToId: string | null;
    replyTo?: ReplyContext | null;
    metadata: Record<string, any>;
    editedAt: string | null;
    deletedAt: string | null;
    reactions: MessageReaction[];
    expandedType: ExpandedMessageType;
}

export interface SendMessagePayload {
    recipientId?: string;
    conversationId?: string;
    content: string;
    offerId?: string;
    messageType?: MessageType | ExpandedMessageType;
    attachmentUrl?: string;
    attachmentName?: string;
    replyToId?: string;
    metadata?: Record<string, any>;
}

export interface SendChannelMessagePayload extends SendMessagePayload {
    conversationId?: string;
    replyToId?: string;
    metadata?: Record<string, any>;
    messageType?: ExpandedMessageType;
}

export interface CreateChannelPayload {
    channelType: ChannelType;
    entityType?: string;
    entityId?: string;
    title?: string;
    participantIds?: string[];
}

export type ChannelFilter = 'all' | ChannelType;

export interface SendMessageResponse {
    id: string;
    conversationId: string;
}

export interface GetMessagesOptions {
    page?: number;
    limit?: number;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface PaginatedApiResponse<T> {
    success: boolean;
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export type ConversationsResponse = ApiResponse<Conversation[]>;
export type MessagesResponse = PaginatedApiResponse<Message>;
export type UnreadCountResponse = ApiResponse<{ count: number }>;

export interface MessagesPageState {
    activeConversationId: string | null;
    showConversationList: boolean;
    isMobile: boolean;
    searchTerm: string;
}

export interface MessagesPageStateExtended extends MessagesPageState {
    channelFilter: ChannelFilter;
    showInfoPanel: boolean;
    replyingTo: ReplyContext | null;
}

export interface MessagesPageActions {
    selectConversation: (id: string) => void;
    goBackToList: () => void;
    setSearchTerm: (term: string) => void;
}

export interface MessageNotification {
    id: string;
    title: string;
    message: string;
    preview?: string;
    timestamp: Date;
    action?: {
        label: string;
        conversationId?: string;
    };
}

export interface ConversationSelectionProps {
    conversations: Conversation[];
    activeConversationId: string | null;
    onConversationSelect: (conversationId: string) => void;
    onBackToList?: () => void;
    isMobile?: boolean;
}

export interface ChatAreaProps {
    conversation: Conversation | null;
    messages: Message[];
    isLoading?: boolean;
    onSendMessage: (text: string) => void;
    onBackToList?: () => void;
    isMobile?: boolean;
}
