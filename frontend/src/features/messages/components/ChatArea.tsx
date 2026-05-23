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
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui';

import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

import type { Conversation, Message } from '../types';

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
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50/50 p-4 sm:p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-md"
            >
                {/* Illustration */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] sm:h-24 sm:w-24">
                    <MessageSquare className="w-12 h-12 text-zinc-950" />
                </div>

                {/* Text */}
                <h3 className="text-xl font-bold text-zinc-950 mb-2">
                    {t('messages.selectConversationTitle') || 'Selecciona una conversacion'}
                </h3>
                <p className="text-zinc-500">
                    {t('messages.selectConversationDescription') || 'Elige una conversacion de la lista para comenzar a chatear con transportadores o empresas.'}
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
                            'animate-pulse rounded-lg',
                            i % 2 === 0
                                ? 'bg-zinc-200 w-48 h-16 rounded-br-sm'
                                : 'bg-zinc-200 w-56 h-12 rounded-bl-sm'
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
        <div className="border-b border-zinc-200 bg-white p-3 sm:p-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {/* Back Button (Mobile) */}
                {isMobile && onBackToList && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBackToList}
                        aria-label={t('common.back') || 'Volver'}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                )}

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-950 flex items-center justify-center">
                        {conversation.avatar ? (
                            <img
                                src={conversation.avatar}
                                alt={conversation.otherParticipantName || 'Usuario'}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-white font-semibold text-sm">
                                {initials}
                            </span>
                        )}
                    </div>

                    {/* Online Indicator */}
                    {conversation.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-zinc-950 border-2 border-white rounded-full" />
                    )}
                </div>

                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-950 truncate">
                        {conversation.otherParticipantName || t('messages.unknownUser') || 'Usuario'}
                    </h3>
                    <p className="text-sm text-zinc-500 truncate">
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
                        <Phone className="w-5 h-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('messages.moreOptions') || 'Mas opciones'}
                    >
                        <MoreVertical className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Cargo Context */}
            {conversation.cargoContext && (
                <div className="mt-3 rounded-lg bg-zinc-50 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Package className="w-4 h-4 text-zinc-950" />
                        <span className="font-medium text-zinc-950">
                            {conversation.cargoContext.route}
                        </span>
                        <span className="text-zinc-400">-</span>
                        <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            conversation.cargoContext.status === 'Activa'
                                ? 'bg-zinc-950 text-white'
                                : conversation.cargoContext.status === 'Completado'
                                    ? 'bg-zinc-100 text-zinc-950'
                                    : 'bg-zinc-100 text-zinc-950'
                        )}>
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
}: ChatAreaProps) {
    const { t } = useTranslation();
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const messagesContainerRef = React.useRef<HTMLDivElement>(null);

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

    // =========================================================================
    // Render
    // =========================================================================
    return (
        <div className="flex h-full min-w-0 flex-1 flex-col bg-zinc-50/30">
            {/* Header */}
            <ChatHeader
                conversation={conversation}
                onBackToList={onBackToList}
                isMobile={isMobile}
            />

            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
            >
                {isLoading ? (
                    <MessagesSkeleton />
                ) : messages.length === 0 ? (
                    // No messages yet
                    <div className="flex-1 flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 rounded-lg bg-zinc-100 flex items-center justify-center mb-4">
                            <MessageSquare className="w-8 h-8 text-zinc-400" />
                        </div>
                        <p className="text-zinc-500 text-center">
                            {t('messages.noMessagesYet') || 'No hay mensajes aun'}
                        </p>
                        <p className="text-sm text-zinc-400 text-center mt-1">
                            {t('messages.startConversation') || 'Envia el primer mensaje!'}
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
                            />
                        ))}
                    </AnimatePresence>
                )}

                {/* Typing Indicator */}
                {conversation.isTyping && <TypingIndicator />}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput
                onSendMessage={onSendMessage}
                isSending={isSending}
            />
        </div>
    );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ChatArea;
