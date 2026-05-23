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
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

import type { Message, MessageStatus, MessageType } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface MessageBubbleProps {
    /** The message to display */
    message: Message;
    /** Whether this message was sent by the current user */
    isMine: boolean;
    /** Whether to show the sender name (for group chats, future feature) */
    showSenderName?: boolean;
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

/**
 * System message display (e.g., "Offer accepted").
 */
function SystemMessage({ content }: { content: string }) {
    return (
        <div className="flex justify-center my-4">
            <div className="px-4 py-1.5 bg-zinc-100 text-zinc-500 text-xs rounded-full">
                {content}
            </div>
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
}: MessageBubbleProps) {
    const { locale } = useTranslation();

    // System messages have special rendering
    if (message.messageType === 'system') {
        return <SystemMessage content={message.content} />;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
                'flex',
                isMine ? 'justify-end' : 'justify-start'
            )}
        >
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

                {/* Message Bubble */}
                <div
                    className={cn(
                        'rounded-lg px-3 py-2.5 shadow-sm sm:px-4',
                        isMine
                            ? 'bg-zinc-950 text-white rounded-br-sm'
                            : 'bg-white border border-zinc-200 text-zinc-950 rounded-bl-sm'
                    )}
                >
                    {/* Content */}
                    {message.messageType === 'file' && message.attachmentUrl && message.attachmentName ? (
                        <FileAttachment
                            fileName={message.attachmentName}
                            fileUrl={message.attachmentUrl}
                            isMine={isMine}
                        />
                    ) : message.messageType === 'image' && message.attachmentUrl ? (
                        <div className="rounded-lg overflow-hidden mb-2">
                            <img
                                src={message.attachmentUrl}
                                alt={message.attachmentName || 'Imagen'}
                                className="max-w-full h-auto"
                                loading="lazy"
                            />
                        </div>
                    ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                        </p>
                    )}

                    {/* Timestamp and Status */}
                    <div className={cn(
                        'flex items-center justify-end gap-1 mt-1',
                        isMine ? 'text-white/70' : 'text-zinc-400'
                    )}>
                        <span className="text-xs">
                            {formatTime(message.createdAt, locale)}
                        </span>
                        {getStatusIcon(message.status, isMine)}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default MessageBubble;
