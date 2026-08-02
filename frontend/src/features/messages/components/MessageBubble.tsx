// =============================================================================
// KARGAX - Message Bubble Component
// Enterprise-Grade Individual Message Display
// =============================================================================
//
// FEATURES:
// - Different styles for sent/received/system messages
// - Message status indicators (sent, delivered, read)
// - File/image attachment support
// - Timestamp formatting
// - Accessibility compliant
//
// =============================================================================

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
    Check,
    CheckCheck,
    Paperclip,
    Download,
    Clock,
    AlertCircle,
    Reply,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

import type { Message, MessageStatus, MessageType } from '../types';
import { SystemMessageBubble } from './SystemMessageBubble';
import { LocationMessage } from './LocationMessage';
import { EvidenceMessage } from './EvidenceMessage';
import { VoiceMessage } from './VoiceMessage';
import { ReplyPreview } from './ReplyPreview';
import { MessageReactions } from './MessageReactions';

// =============================================================================
// TYPES
// =============================================================================

interface MessageBubbleProps {
    /** The message to display */
    message: any;
    /** Whether this message was sent by the current user */
    isMine: boolean;
    /** Whether to show the sender name (for group chats, future feature) */
    showSenderName?: boolean;
    onReply?: (message: any) => void;
    onReact?: (messageId: string, emoji: string) => void;
    currentUserId?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Formats a timestamp to a 12-hour time string.
 * 
 * @param timestamp - ISO timestamp string
 * @param locale - Locale for formatting
 * @returns Formatted time string (e.g., "2:30 PM")
 */
function formatTime(timestamp: string, locale: string = 'es-CO'): string {
    return new Date(timestamp).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Gets the appropriate icon for a message status.
 * 
 * @param status - Message delivery status
 * @param isMine - Whether message was sent by current user
 * @returns React node with status icon
 */
function getStatusIcon(status: MessageStatus | undefined, isMine: boolean): React.ReactNode {
    if (!isMine) return null;

    switch (status) {
        case 'sending':
            return <Clock className="w-3.5 h-3.5 text-white/60" />;
        case 'sent':
            return <Check className="w-3.5 h-3.5 text-white/60" />;
        case 'delivered':
            return <CheckCheck className="w-3.5 h-3.5 text-white/60" />;
        case 'read':
            return <CheckCheck className="w-3.5 h-3.5 text-white/60" />;
        case 'failed':
            return <AlertCircle className="w-3.5 h-3.5 text-white/70" />;
        default:
            return <Check className="w-3.5 h-3.5 text-white/60" />;
    }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * File attachment display component.
 */
function FileAttachment({
    fileName,
    fileUrl,
    isMine,
}: {
    fileName: string;
    fileUrl: string;
    isMine: boolean;
}) {
    const { t } = useTranslation();

    return (
        <div className={cn(
            'flex items-center gap-2 p-2 rounded-lg',
            isMine ? 'bg-white/10' : 'bg-zinc-100'
        )}>
            <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                isMine ? 'bg-white/20' : 'bg-zinc-200'
            )}>
                <Paperclip className={cn(
                    'w-4 h-4',
                    isMine ? 'text-white' : 'text-zinc-500'
                )} />
            </div>
            <span className={cn(
                'flex-1 text-sm truncate',
                isMine ? 'text-white' : 'text-zinc-700'
            )}>
                {fileName}
            </span>
            <a
                href={fileUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    isMine
                        ? 'hover:bg-white/20 text-white'
                        : 'hover:bg-zinc-200 text-zinc-500'
                )}
                aria-label={t('messages.downloadFile') || 'Descargar archivo'}
            >
                <Download className="w-4 h-4" />
            </a>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * MessageBubble - Displays a single message in the chat.
 * 
 * Handles different message types:
 * - text: Regular text message
 * - file: File attachment with download
 * - image: Image with preview
 * - system: Centered system notification
 * 
 * @example
 * ```tsx
 * <MessageBubble
 *   message={message}
 *   isMine={message.senderId === currentUserId}
 * />
 * ```
 */
export function MessageBubble({
    message,
    isMine,
    showSenderName = false,
    onReply,
    onReact,
    currentUserId,
}: MessageBubbleProps) {
    const { locale } = useTranslation();

    const mType = message.expandedType || message.messageType;

    // System messages have special rendering
    if (mType === 'system' || mType === 'status_update') {
        return <SystemMessageBubble content={message.content} timestamp={message.createdAt || message.timestamp || new Date().toISOString()} />;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
                'flex group relative w-full',
                isMine ? 'justify-end' : 'justify-start'
            )}
        >
            {/* Reply action button on hover */}
            {onReply && (
                <div className={cn(
                    "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10",
                    isMine ? "-left-10" : "-right-10"
                )}>
                    <button
                        onClick={() => onReply(message)}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded-full transition-colors"
                        aria-label="Responder"
                    >
                        <Reply className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className={cn(
                'max-w-[92%] sm:max-w-[82%] lg:max-w-[70%]',
                isMine ? 'order-2' : 'order-1'
            )}>
                {/* Sender Name (for group chats) */}
                {showSenderName && !isMine && message.senderName && (
                    <p className="text-xs text-zinc-500 mb-1 ml-3">
                        {message.senderName}
                    </p>
                )}
                
                {/* Reply Preview inline */}
                {message.replyTo && (
                    <div className="mb-1">
                        <ReplyPreview replyContext={message.replyTo} variant="inline" />
                    </div>
                )}

                {/* Message Bubble */}
                <div
                    className={cn(
                        'rounded-lg px-3 py-2.5 shadow-sm sm:px-4',
                        isMine
                            ? 'bg-zinc-950 text-white rounded-br-sm'
                            : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-sm'
                    )}
                >
                    {/* Content by Type */}
                    {mType === 'location' && message.metadata?.location ? (
                        <LocationMessage location={message.metadata.location} isMine={isMine} />
                    ) : mType === 'evidence' && message.metadata?.evidence ? (
                        <EvidenceMessage evidence={message.metadata.evidence} isMine={isMine} />
                    ) : mType === 'audio' && message.metadata?.audio ? (
                        <VoiceMessage audio={message.metadata.audio} isMine={isMine} />
                    ) : mType === 'image' && message.imageUrl ? (
                        <div className="mb-2 -mx-1 -mt-1">
                            <img
                                src={message.imageUrl}
                                alt={message.content || 'Imagen'}
                                className="rounded-lg max-w-full h-auto"
                            />
                        </div>
                    ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                        </p>
                    )}

                    {/* Timestamp */}
                    <div className={cn(
                        'flex items-center gap-1 mt-1',
                        isMine ? 'justify-end' : 'justify-start'
                    )}>
                        <time className={cn(
                            'text-[11px]',
                            isMine ? 'text-zinc-400' : 'text-zinc-400'
                        )}>
                            {new Date(message.createdAt || message.timestamp || '').toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </time>
                        {message.editedAt && (
                            <span className={cn('text-[10px]', isMine ? 'text-zinc-400' : 'text-zinc-400')}>
                                (editado)
                            </span>
                        )}
                    </div>
                </div>

                {/* Reactions */}
                {onReact && message.reactions && message.reactions.length > 0 && (
                    <MessageReactions
                        reactions={message.reactions}
                        onReact={(emoji) => onReact(message.id, emoji)}
                        onRemoveReaction={(emoji) => onReact(message.id, emoji)}
                        currentUserId={currentUserId || ''}
                    />
                )}
            </div>
        </motion.div>
    );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default MessageBubble;
