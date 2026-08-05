// =============================================================================
// KARGAX - Chat Area Component
// Enterprise-Grade Main Chat Interface
// =============================================================================
//
// FEATURES:
// - Header with contact info and cargo context
// - Messages list with auto-scroll
// - Typing indicator animation
// - Quick actions (call, more options)
// - Responsive design with mobile back button
// - Empty state when no conversation selected
//
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Phone,
    MoreVertical,
    MessageSquare,
    Package,
    PanelRightClose,
    PanelRightOpen,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui';

import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChannelHeader } from './ChannelHeader';
import { usePresence, useQuickReplies } from '../hooks/useMessages';

import type { Conversation, Message, ReplyContext, ConversationParticipant, ChannelType } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ChatAreaProps {
    /** Current conversation data (null shows empty state) */
    conversation: Conversation | null;
    /** Messages in the conversation */
    messages: Message[];
    /** Handler for sending messages */
    onSendMessage: (text: string) => void;
    /** Handler for back navigation (mobile only) */
    onBackToList?: () => void;
    /** Whether the viewport is mobile-sized */
    isMobile?: boolean;
    /** Whether messages are loading */
    isLoading?: boolean;
    /** Whether a message is being sent */
    isSending?: boolean;
    /** Current user ID for determining message ownership */
    currentUserId?: string;
    /** Toggle info panel */
    onToggleInfoPanel?: () => void;
    /** Show info panel */
    showInfoPanel?: boolean;
    /** Participants list */
    participants?: ConversationParticipant[];
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Typing indicator with animated dots.
 */
function TypingIndicator() {
    return (
        <div className="flex justify-start px-4">
            <div className="bg-white border border-zinc-200 rounded-lg rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 bg-zinc-400 rounded-full"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.15,
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Empty state when no conversation is selected.
 */
function EmptyConversation() {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-zinc-950 p-4 sm:p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-md"
            >
                {/* Illustration */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:h-24 sm:w-24">
                    <MessageSquare className="w-10 h-10 text-zinc-950 dark:text-zinc-100" />
                </div>

                {/* Text */}
                <h3 className="text-xl font-bold text-zinc-950 dark:text-zinc-50 mb-2">
                    {t('messages.selectConversationTitle') || 'Selecciona una conversación'}
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    {t('messages.selectConversationDescription') || 'Elige un canal o contacto para comenzar a comunicarte en tiempo real.'}
                </p>
            </motion.div>
        </div>
    );
}

/**
 * Loading skeleton for messages.
 */
function MessagesSkeleton() {
    return (
        <div className="flex-1 p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
                <div
                    key={i}
                    className={cn(
                        'flex',
                        i % 2 === 0 ? 'justify-end' : 'justify-start'
                    )}
                >
                    <div
                        className={cn(
                            'animate-pulse rounded-2xl',
                            i % 2 === 0
                                ? 'bg-zinc-100 dark:bg-zinc-800 w-48 h-14 rounded-br-sm'
                                : 'bg-zinc-100 dark:bg-zinc-800 w-56 h-12 rounded-bl-sm'
                        )}
                    />
                </div>
            ))}
        </div>
    );
}

/**
 * Chat header with contact info.
 */
function ChatHeader({
    conversation,
    onBackToList,
    isMobile,
}: {
    conversation: Conversation;
    onBackToList?: () => void;
    isMobile: boolean;
}) {
    const { t } = useTranslation();

    // Generate initials
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
        <div className="border-b border-zinc-200/80 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {/* Back Button (Mobile) */}
                {isMobile && onBackToList && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBackToList}
                        aria-label={t('common.back') || 'Volver'}
                        className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                )}

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-950 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-950">
                        {conversation.avatar ? (
                            <img
                                src={conversation.avatar}
                                alt={conversation.otherParticipantName || 'Usuario'}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="font-semibold text-sm">
                                {initials}
                            </span>
                        )}
                    </div>

                    {/* Online Indicator */}
                    {conversation.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-zinc-950 rounded-full" />
                    )}
                </div>

                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-zinc-950 dark:text-zinc-50 truncate">
                        {conversation.otherParticipantName || t('messages.unknownUser') || 'Usuario'}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {conversation.company || conversation.otherParticipantEmail}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('messages.call') || 'Llamar'}
                    >
                        <Phone className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('messages.moreOptions') || 'Mas opciones'}
                    >
                        <MoreVertical className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    </Button>
                </div>
            </div>

            {/* Cargo Context */}
            {conversation.cargoContext && (
                <div className="mt-2.5 rounded-xl border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Package className="w-4 h-4 text-zinc-950 dark:text-zinc-100" />
                        <span className="font-semibold text-zinc-950 dark:text-zinc-100">
                            {conversation.cargoContext.route}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                            {conversation.cargoContext.status}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * ChatArea - Main chat interface component.
 * 
 * Features:
 * - Header with contact info
 * - Scrollable messages list
 * - Typing indicator
 * - Message input area
 * - Empty state
 * 
 * @example
 * ```tsx
 * <ChatArea
 *   conversation={activeConversation}
 *   messages={messages}
 *   onSendMessage={handleSend}
 *   isMobile={isMobile}
 *   onBackToList={() => setActiveId(null)}
 * />
 * ```
 */
export function ChatArea({
    conversation,
    messages,
    onSendMessage,
    onBackToList,
    isMobile = false,
    isLoading = false,
    isSending = false,
    currentUserId,
    onToggleInfoPanel,
    showInfoPanel,
    participants = [],
}: ChatAreaProps) {
    const { t } = useTranslation();
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const messagesContainerRef = React.useRef<HTMLDivElement>(null);
    const [replyingTo, setReplyingTo] = React.useState<ReplyContext | null>(null);

    const { typingUsers } = usePresence(conversation?.id || null);
    
    // Type assertion to support channelType
    const conv = conversation as any;
    const channelType: ChannelType = conv?.channelType || 'direct';
    const quickReplies = useQuickReplies(channelType);

    // =========================================================================
    // Auto-scroll to bottom on new messages
    // =========================================================================
    React.useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // =========================================================================
    // Empty state when no conversation selected
    // =========================================================================
    if (!conversation) {
        return <EmptyConversation />;
    }

    const handleSendMessage = (text: string) => {
        onSendMessage(text);
        setReplyingTo(null);
    };

    const handleReply = (message: any) => {
        setReplyingTo({
            messageId: message.id,
            content: message.content,
            senderName: message.senderName || 'Usuario',
            messageType: message.expandedType || message.messageType || 'text'
        });
    };

    const handleReact = (messageId: string, emoji: string) => {
        // Handle reaction logic
        console.log('Reacting to', messageId, 'with', emoji);
    };

    // =========================================================================
    // Render
    // =========================================================================
    return (
        <div className="flex h-full min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
            {/* Header */}
            {channelType !== 'direct' ? (
                <ChannelHeader 
                    conversation={conversation as any}
                    onBack={isMobile ? onBackToList : undefined}
                    onToggleInfo={onToggleInfoPanel}
                    isMobile={isMobile}
                />
            ) : (
                <ChatHeader
                    conversation={conversation}
                    onBackToList={onBackToList}
                    isMobile={isMobile}
                />
            )}

            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4 bg-white dark:bg-zinc-950"
            >
                {isLoading ? (
                    <MessagesSkeleton />
                ) : messages.length === 0 ? (
                    // No messages yet
                    <div className="flex-1 flex flex-col items-center justify-center py-16">
                        <div className="w-14 h-14 rounded-2xl border border-zinc-200 bg-white flex items-center justify-center mb-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                            <MessageSquare className="w-7 h-7 text-zinc-950 dark:text-zinc-100" />
                        </div>
                        <p className="text-zinc-950 font-semibold text-sm dark:text-zinc-50 text-center">
                            {t('messages.noMessagesYet') || 'No hay mensajes aún'}
                        </p>
                        <p className="text-xs text-zinc-400 text-center mt-1">
                            {t('messages.startConversation') || 'Envía el primer mensaje para iniciar la conversación'}
                        </p>
                    </div>
                ) : (
                    // Messages list
                    <AnimatePresence mode="popLayout">
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isMine={message.isMine || message.senderId === currentUserId}
                                onReply={handleReply}
                                onReact={handleReact}
                                currentUserId={currentUserId}
                                showSenderName={channelType !== 'direct'}
                            />
                        ))}
                    </AnimatePresence>
                )}

                {/* Typing Indicator */}
                {(conversation.isTyping || typingUsers.length > 0) && <TypingIndicator />}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput
                onSendMessage={handleSendMessage}
                isSending={isSending}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                channelType={channelType}
                quickReplies={quickReplies}
            />
        </div>
    );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ChatArea;
