// =============================================================================
// KARGAX - Messages Module Types
// Enterprise-Grade TypeScript Definitions for Messaging System
// =============================================================================
//
// ARCHITECTURE NOTES:
// - All types are exported individually for tree-shaking
// - Interfaces follow backend API response structure
// - Union types for strict type safety on message types
// - Optional fields marked explicitly for API compatibility
//
// SCALABILITY:
// - Designed for multi-tenant architecture
// - Ready for real-time WebSocket integration
// - Supports file attachments and system messages
//
// =============================================================================

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

/**
 * Types of messages supported by the system.
 * 'text' - Regular text message
 * 'image' - Image attachment
 * 'file' - Document/file attachment
 * 'system' - System-generated message (e.g., offer accepted)
 */
export type MessageType = 'text' | 'image' | 'file' | 'system';

/**
 * Message delivery status for sent messages.
 * Follows WhatsApp-like pattern for familiarity.
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Priority levels for conversations.
 * Used for visual indicators and sorting.
 */
export type ConversationPriority = 'urgent' | 'high' | 'normal';

// =============================================================================
// CORE INTERFACES
// =============================================================================

/**
 * Represents the context of a cargo offer linked to a conversation.
 * Optional - not all conversations are linked to offers.
 */
export interface CargoContext {
    /** Unique identifier of the offer */
    offerId: string;
    /** Display title of the offer */
    title?: string;
    /** Route description (e.g., "Bogotá → Medellín") */
    route: string;
    /** Current status of the offer */
    status: string;
}

/**
 * Represents a participant in a conversation.
 * Used for displaying contact information in the UI.
 */
export interface Participant {
    /** User ID (UUID) */
    id: string;
    /** Full name of the participant */
    fullName: string;
    /** Email address */
    email: string;
    /** Profile avatar URL (optional) */
    avatarUrl?: string;
    /** Company name (for business users) */
    company?: string;
    /** Whether the user is currently online */
    isOnline?: boolean;
}

/**
 * Represents a conversation between two users.
 * Conversations can optionally be linked to a cargo offer.
 */
export interface Conversation {
    /** Unique identifier (UUID) */
    id: string;
    /** ID of participant 1 (ordered alphabetically for consistency) */
    participant1Id: string;
    /** ID of participant 2 */
    participant2Id: string;
    /** ID of linked cargo offer (optional) */
    offerId: string | null;
    /** Preview of the last message (truncated) */
    lastMessagePreview: string | null;
    /** Timestamp of last message */
    lastMessageAt: string | null;
    /** Number of unread messages for current user */
    unreadCount: number;
    /** Conversation creation timestamp */
    createdAt: string;

    // =========================================================================
    // Joined/Computed fields from API
    // =========================================================================

    /** Name of the other participant */
    otherParticipantName?: string;
    /** Email of the other participant */
    otherParticipantEmail?: string;
    /** Title of linked offer (if any) */
    offerTitle?: string;

    // =========================================================================
    // UI-specific fields (populated client-side)
    // =========================================================================

    /** Avatar URL for display */
    avatar?: string;
    /** Company name of other participant */
    company?: string;
    /** Whether other participant is online */
    isOnline?: boolean;
    /** Whether other participant is typing */
    isTyping?: boolean;
    /** Conversation priority level */
    priority?: ConversationPriority;
    /** Cargo context for display */
    cargoContext?: CargoContext;
}

/**
 * Represents a single message in a conversation.
 * Supports text, files, images, and system messages.
 */
export interface Message {
    /** Unique identifier (UUID) */
    id: string;
    /** ID of the conversation this message belongs to */
    conversationId: string;
    /** ID of the message sender */
    senderId: string;
    /** Name of the sender (joined from user profile) */
    senderName?: string;
    /** Message content (text or description) */
    content: string;
    /** Whether the message has been read */
    isRead: boolean;
    /** Timestamp when message was read */
    readAt: string | null;
    /** Type of message content */
    messageType: MessageType;
    /** URL of attached file (if any) */
    attachmentUrl: string | null;
    /** Original filename of attachment (if any) */
    attachmentName: string | null;
    /** Message creation timestamp */
    createdAt: string;

    // =========================================================================
    // UI-specific fields (populated client-side)
    // =========================================================================

    /** Delivery status for UI display */
    status?: MessageStatus;
    /** Whether this message was sent by the current user */
    isMine?: boolean;
}

// =============================================================================
// API PAYLOADS
// =============================================================================

/**
 * Payload for sending a new message.
 * recipientId is required - conversation will be created automatically if needed.
 */
export interface SendMessagePayload {
    /** ID of the message recipient */
    recipientId: string;
    /** Message content */
    content: string;
    /** Optional: Link message to a cargo offer */
    offerId?: string;
    /** Type of message (defaults to 'text') */
    messageType?: MessageType;
    /** URL of uploaded attachment (if any) */
    attachmentUrl?: string;
    /** Original filename of attachment (if any) */
    attachmentName?: string;
}

/**
 * Response from sending a message.
 */
export interface SendMessageResponse {
    /** ID of the created message */
    id: string;
    /** ID of the conversation (created or existing) */
    conversationId: string;
}

/**
 * Options for fetching conversation messages.
 */
export interface GetMessagesOptions {
    /** Page number for pagination (1-indexed) */
    page?: number;
    /** Number of messages per page */
    limit?: number;
}

// =============================================================================
// API RESPONSES
// =============================================================================

/**
 * Standard API response wrapper.
 * All KargaX API responses follow this structure.
 */
export interface ApiResponse<T> {
    /** Whether the request was successful */
    success: boolean;
    /** Response data */
    data: T;
    /** Optional message */
    message?: string;
}

/**
 * Paginated API response wrapper.
 */
export interface PaginatedApiResponse<T> {
    /** Whether the request was successful */
    success: boolean;
    /** Array of items */
    data: T[];
    /** Pagination metadata */
    meta: {
        /** Current page number */
        page: number;
        /** Items per page */
        limit: number;
        /** Total number of items */
        total: number;
        /** Total number of pages */
        totalPages: number;
    };
}

/**
 * Response for conversations list endpoint.
 */
export type ConversationsResponse = ApiResponse<Conversation[]>;

/**
 * Response for messages list endpoint.
 */
export type MessagesResponse = PaginatedApiResponse<Message>;

/**
 * Response for unread count endpoint.
 */
export type UnreadCountResponse = ApiResponse<{ count: number }>;

// =============================================================================
// UI STATE TYPES
// =============================================================================

/**
 * State for the messages page.
 * Used for managing UI state across components.
 */
export interface MessagesPageState {
    /** Currently selected conversation ID */
    activeConversationId: string | null;
    /** Whether to show conversation list (mobile only) */
    showConversationList: boolean;
    /** Whether the viewport is mobile-sized */
    isMobile: boolean;
    /** Search term for filtering conversations */
    searchTerm: string;
}

/**
 * Actions for the messages page state.
 */
export interface MessagesPageActions {
    /** Select a conversation */
    selectConversation: (id: string) => void;
    /** Go back to conversation list (mobile) */
    goBackToList: () => void;
    /** Update search term */
    setSearchTerm: (term: string) => void;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

/**
 * Represents a message notification for toast display.
 */
export interface MessageNotification {
    /** Unique identifier for the notification */
    id: string;
    /** Notification title */
    title: string;
    /** Main message content */
    message: string;
    /** Preview of the message content */
    preview?: string;
    /** Timestamp of the notification */
    timestamp: Date;
    /** Action button configuration */
    action?: {
        /** Button label */
        label: string;
        /** Conversation ID to navigate to */
        conversationId?: string;
    };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Props for components that handle conversation selection.
 */
export interface ConversationSelectionProps {
    /** List of conversations to display */
    conversations: Conversation[];
    /** Currently active conversation ID */
    activeConversationId: string | null;
    /** Handler for conversation selection */
    onConversationSelect: (conversationId: string) => void;
    /** Handler for back navigation (mobile) */
    onBackToList?: () => void;
    /** Whether in mobile view */
    isMobile?: boolean;
}

/**
 * Props for the chat area component.
 */
export interface ChatAreaProps {
    /** Current conversation data */
    conversation: Conversation | null;
    /** Messages in the conversation */
    messages: Message[];
    /** Loading state */
    isLoading?: boolean;
    /** Handler for sending messages */
    onSendMessage: (text: string) => void;
    /** Handler for back navigation (mobile) */
    onBackToList?: () => void;
    /** Whether in mobile view */
    isMobile?: boolean;
}
