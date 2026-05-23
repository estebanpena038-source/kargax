// =============================================================================
// KARGAX - Conversations List Component
// Enterprise-Grade Sidebar Panel for Displaying User Conversations
// =============================================================================
//
// FEATURES:
// - Search functionality with debounce
// - Unread message badges
// - Online status indicators
// - Priority indicators (urgent, high, normal)
// - Cargo context preview
// - Responsive design (fullwidth on mobile)
// - Accessibility compliant (ARIA labels, keyboard navigation)
//
// PERFORMANCE:
// - Memoized components to prevent unnecessary re-renders
// - Optimized filtering with useMemo
// - Virtualization-ready structure
//
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    MessageSquare,
    Plus,
    ArrowLeft,
    AlertCircle,
    Clock,
    Package,
    Check,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Button, Input } from '@/components/ui';

import type { Conversation, ConversationPriority } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ConversationsListProps {
    /** Array of conversations to display */
    conversations: Conversation[];
    /** Currently selected conversation ID */
    activeConversationId: string | null;
    /** Handler for when a conversation is selected */
    onConversationSelect: (conversationId: string) => void;
    /** Handler for back button (mobile only) */
    onBackToList?: () => void;
    /** Whether the viewport is mobile-sized */
    isMobile?: boolean;
    /** Whether conversations are loading */
    isLoading?: boolean;
    /** Handler for creating new conversation */
    onNewConversation?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Debounce delay for search input (ms) */
const SEARCH_DEBOUNCE_MS = 300;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Formats a timestamp to a relative or absolute time string.
 * - Less than 24h: Shows time (HH:MM)
 * - Less than 7 days: Shows day name
 * - Otherwise: Shows date (DD/MM)
 * 
 * @param timestamp - ISO timestamp string or Date object
 * @param locale - Locale code for formatting
 * @returns Formatted time string
 */
function formatMessageTime(timestamp: string | Date | null, locale: string = 'es-CO'): string {
    if (!timestamp) return '';

    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
        return messageTime.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
        });
    } else if (diffInHours < 168) { // 7 days
        return messageTime.toLocaleDateString(locale, { weekday: 'short' });
    } else {
        return messageTime.toLocaleDateString(locale, {
            day: '2-digit',
            month: '2-digit',
        });
    }
}

/**
 * Gets the appropriate icon for a conversation priority.
 * 
 * @param priority - Conversation priority level
 * @returns React node with icon or null
 */
function getPriorityIcon(priority: ConversationPriority | undefined): React.ReactNode {
    switch (priority) {
        case 'urgent':
            return <AlertCircle className="w-4 h-4 text-zinc-950" />;
        case 'high':
            return <Clock className="w-4 h-4 text-zinc-950" />;
        default:
            return null;
    }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Individual conversation item in the list.
 * Memoized to prevent re-renders when other conversations change.
 */
const ConversationItem = React.memo(function ConversationItem({
    conversation,
    isActive,
    onClick,
    locale,
}: {
    conversation: Conversation;
    isActive: boolean;
    onClick: () => void;
    locale: string;
}) {
    const { t } = useTranslation();

    // Generate initials from name
    const initials = React.useMemo(() => {
        const name = conversation.otherParticipantName || 'U';
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    }, [conversation.otherParticipantName]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={onClick}
            className={cn(
                'cursor-pointer p-3 transition-all duration-200 sm:p-4',
                'hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20',
                isActive && 'bg-zinc-950 text-white'
            )}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            aria-label={t('messages.selectConversation') || `Conversacion con ${conversation.otherParticipantName}`}
        >
            <div className="flex min-w-0 items-start gap-3">
                {/* Avatar Section */}
                <div className="relative flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-950 sm:h-12 sm:w-12">
                        {conversation.avatar ? (
                            <img
                                src={conversation.avatar}
                                alt={conversation.otherParticipantName || 'Usuario'}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <span className="text-white font-semibold text-sm">
                                {initials}
                            </span>
                        )}
                    </div>

                    {/* Online Indicator */}
                    {conversation.isOnline && (
                        <div
                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-zinc-950 border-2 border-white rounded-full"
                            aria-label={t('messages.online') || 'En linea'}
                        />
                    )}
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <h3 className={cn('font-semibold truncate', isActive ? 'text-white' : 'text-zinc-950')}>
                                {conversation.otherParticipantName || t('messages.unknownUser') || 'Usuario'}
                            </h3>
                            {getPriorityIcon(conversation.priority)}
                        </div>

                        <div className="flex flex-shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                            {/* Unread Badge */}
                            {conversation.unreadCount > 0 && (
                                <span className={cn(
                                    'px-2 py-0.5 text-xs font-semibold rounded-md',
                                    isActive ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white'
                                )}>
                                    {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                                </span>
                            )}

                            {/* Timestamp */}
                            <span className={cn('text-xs', isActive ? 'text-white/60' : 'text-zinc-400')}>
                                {formatMessageTime(conversation.lastMessageAt, locale)}
                            </span>
                        </div>
                    </div>

                    {/* Company/Email */}
                    <p className={cn('text-sm truncate mb-1', isActive ? 'text-white/70' : 'text-zinc-500')}>
                        {conversation.company || conversation.otherParticipantEmail}
                    </p>

                    {/* Last Message Preview */}
                    <div className="flex items-center gap-2">
                        {/* Sent indicator for own messages */}
                        {conversation.lastMessagePreview?.startsWith('[Tu]') && (
                            <Check className={cn('w-3.5 h-3.5 flex-shrink-0', isActive ? 'text-white/60' : 'text-zinc-400')} />
                        )}

                        <p className={cn('text-sm truncate flex-1', isActive ? 'text-white/70' : 'text-zinc-500')}>
                            {conversation.isTyping ? (
                                <span className={cn('italic', isActive ? 'text-white' : 'text-zinc-950')}>
                                    {t('messages.typing') || 'Escribiendo...'}
                                </span>
                            ) : (
                                conversation.lastMessagePreview || t('messages.noMessages') || 'Sin mensajes'
                            )}
                        </p>
                    </div>

                    {/* Cargo Context */}
                    {conversation.cargoContext && (
                        <div className={cn('mt-2 flex items-center gap-2 text-xs', isActive ? 'text-white/60' : 'text-zinc-400')}>
                            <Package className="w-3 h-3" />
                            <span className="truncate">
                                {conversation.cargoContext.route}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
});

/**
 * Empty state when no conversations exist.
 */
function EmptyState({ onNewConversation }: { onNewConversation?: () => void }) {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center sm:p-8">
            <div className="w-16 h-16 rounded-lg bg-zinc-100 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-950 mb-2">
                {t('messages.noConversations') || 'No hay mensajes'}
            </h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs">
                {t('messages.noConversationsDescription') || 'Cuando inicies una conversacion con un transportador o empresa, aparecera aqui.'}
            </p>
            {onNewConversation && (
                <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={onNewConversation}
                >
                    {t('messages.newConversation') || 'Nueva conversacion'}
                </Button>
            )}
        </div>
    );
}

/**
 * Loading skeleton for conversations list.
 */
function ConversationsSkeleton() {
    return (
        <div className="divide-y divide-zinc-100">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 animate-pulse">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-200" />
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between">
                                <div className="h-4 w-32 bg-zinc-200 rounded" />
                                <div className="h-4 w-12 bg-zinc-200 rounded" />
                            </div>
                            <div className="h-3 w-24 bg-zinc-200 rounded" />
                            <div className="h-3 w-48 bg-zinc-200 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * ConversationsList - Displays all conversations for the current user.
 * 
 * Features:
 * - Search/filter conversations
 * - Unread badges
 * - Online status indicators
 * - Priority indicators
 * - Cargo context preview
 * 
 * @example
 * ```tsx
 * <ConversationsList
 *   conversations={conversations}
 *   activeConversationId={selectedId}
 *   onConversationSelect={setSelectedId}
 *   isMobile={isMobile}
 * />
 * ```
 */
export function ConversationsList({
    conversations,
    activeConversationId,
    onConversationSelect,
    onBackToList,
    isMobile = false,
    isLoading = false,
    onNewConversation,
}: ConversationsListProps) {
    const { t, locale } = useTranslation();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');

    // =========================================================================
    // Search Debounce
    // =========================================================================
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // =========================================================================
    // Filtered Conversations
    // =========================================================================
    const filteredConversations = React.useMemo(() => {
        if (!debouncedSearchTerm.trim()) {
            return conversations;
        }

        const term = debouncedSearchTerm.toLowerCase();
        return conversations.filter(
            (conv) =>
                conv.otherParticipantName?.toLowerCase().includes(term) ||
                conv.company?.toLowerCase().includes(term) ||
                conv.lastMessagePreview?.toLowerCase().includes(term) ||
                conv.otherParticipantEmail?.toLowerCase().includes(term)
        );
    }, [conversations, debouncedSearchTerm]);

    // =========================================================================
    // Total Unread Count
    // =========================================================================
    const totalUnread = React.useMemo(
        () => conversations.reduce((sum, conv) => sum + conv.unreadCount, 0),
        [conversations]
    );

    // =========================================================================
    // Render
    // =========================================================================
    return (
        <div className={cn(
            'bg-white border-r border-zinc-200 h-full min-w-0 flex flex-col',
            isMobile ? 'w-full' : 'w-full'
        )}>
            {/* Header */}
            <div className="border-b border-zinc-200 p-3 sm:p-4">
                <div className="mb-4 flex items-center justify-between gap-2">
                    {/* Back Button (Mobile) */}
                    {isMobile && onBackToList && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onBackToList}
                            className="mr-2"
                            aria-label={t('common.back') || 'Volver'}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    )}

                    {/* Title with Unread Badge */}
                    <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-lg font-bold text-zinc-950">
                            {t('messages.title') || 'Mensajes'}
                        </h2>
                        {totalUnread > 0 && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-zinc-950 text-white rounded-full">
                                {totalUnread > 99 ? '99+' : totalUnread}
                            </span>
                        )}
                    </div>

                    {/* New Conversation Button */}
                    {onNewConversation && (
                        <Button
                        variant="ghost"
                        size="icon"
                        onClick={onNewConversation}
                        aria-label={t('messages.newConversation') || 'Nueva conversacion'}
                    >
                        <Plus className="w-5 h-5" />
                        </Button>
                    )}
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                        type="search"
                        placeholder={t('messages.searchPlaceholder') || 'Buscar conversaciones...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        size="sm"
                    />
                </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <ConversationsSkeleton />
                ) : filteredConversations.length === 0 ? (
                    searchTerm ? (
                        // No search results
                        <div className="p-4 text-center sm:p-8">
                            <Search className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                            <p className="text-zinc-500">
                                {t('messages.noSearchResults') || 'No se encontraron conversaciones'}
                            </p>
                        </div>
                    ) : (
                        // No conversations at all
                        <EmptyState onNewConversation={onNewConversation} />
                    )
                ) : (
                    <div className="divide-y divide-zinc-100">
                        <AnimatePresence mode="popLayout">
                            {filteredConversations.map((conversation) => (
                                <ConversationItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    isActive={activeConversationId === conversation.id}
                                    onClick={() => onConversationSelect(conversation.id)}
                                    locale={locale}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ConversationsList;
