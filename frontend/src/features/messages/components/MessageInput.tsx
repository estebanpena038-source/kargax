// =============================================================================
// KARGAX - Message Input Component
// Text-only release version for production-first rollout
// =============================================================================

'use client';

import * as React from 'react';
import { Loader2, Send, Paperclip, Mic, Image as ImageIcon, MapPin, FileText, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ReplyContext, ChannelType, QuickReply } from '../types';
import { ReplyPreview } from './ReplyPreview';
import { QuickReplies } from './QuickReplies';
import { useVoiceRecorder } from '../hooks/useMessages';

interface MessageInputProps {
    onSendMessage: (text: string) => void;
    isSending?: boolean;
    disabled?: boolean;
    placeholder?: string;
    maxLength?: number;
    replyingTo?: ReplyContext | null;
    onCancelReply?: () => void;
    onSendLocation?: () => void;
    onSendVoice?: (blob: Blob) => void;
    channelType?: ChannelType;
    quickReplies?: QuickReply[];
}

const DEFAULT_MAX_LENGTH = 5000;

export function MessageInput({
    onSendMessage,
    isSending = false,
    disabled = false,
    placeholder,
    maxLength = DEFAULT_MAX_LENGTH,
    replyingTo = null,
    onCancelReply,
    onSendLocation,
    onSendVoice,
    channelType,
    quickReplies = [],
}: MessageInputProps) {
    const { t } = useTranslation();
    const [message, setMessage] = React.useState('');
    const [showAttachments, setShowAttachments] = React.useState(false);
    const [showQuickReplies, setShowQuickReplies] = React.useState(false);
    const inputRef = React.useRef<HTMLTextAreaElement>(null);
    const { isRecording, startRecording, stopRecording, audioBlob } = useVoiceRecorder();

    const canSend = message.trim().length > 0 && !isSending && !disabled;
    const charCount = message.length;
    const isNearLimit = charCount > maxLength * 0.9;
    const isOverLimit = charCount > maxLength;

    const handleSend = React.useCallback(() => {
        if (!canSend || isOverLimit) {
            return;
        }

        onSendMessage(message.trim());
        setMessage('');
        inputRef.current?.focus();
    }, [canSend, isOverLimit, message, onSendMessage]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    React.useEffect(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, [message]);

    React.useEffect(() => {
        if (audioBlob && onSendVoice) {
            onSendVoice(audioBlob);
        }
    }, [audioBlob, onSendVoice]);

    return (
        <div className="border-t border-zinc-200 bg-white p-3 sm:p-4 flex flex-col">
            <AnimatePresence>
                {replyingTo && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-2"
                    >
                        <ReplyPreview replyContext={replyingTo} variant="input" onDismiss={onCancelReply} />
                    </motion.div>
                )}
                {showQuickReplies && quickReplies.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: 10, height: 0 }}
                        className="mb-2 overflow-hidden"
                    >
                        <QuickReplies 
                            replies={quickReplies} 
                            onSelect={(reply: any) => {
                                onSendMessage(typeof reply === 'string' ? reply : reply.message);
                                setShowQuickReplies(false);
                            }} 
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex min-w-0 items-end gap-2 relative">
                {/* Attachments Menu */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-zinc-500 hover:text-zinc-950"
                        onClick={() => setShowAttachments(!showAttachments)}
                        aria-label="Adjuntar"
                    >
                        <Paperclip className="h-5 w-5" />
                    </Button>

                    <AnimatePresence>
                        {showAttachments && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg z-50"
                            >
                                <button className="flex w-full items-center gap-3 rounded-md p-2 text-sm text-zinc-700 hover:bg-zinc-100 transition-colors">
                                    <ImageIcon className="h-4 w-4" /> Foto
                                </button>
                                <button className="flex w-full items-center gap-3 rounded-md p-2 text-sm text-zinc-700 hover:bg-zinc-100 transition-colors" onClick={onSendLocation}>
                                    <MapPin className="h-4 w-4" /> Ubicación
                                </button>
                                <button className="flex w-full items-center gap-3 rounded-md p-2 text-sm text-zinc-700 hover:bg-zinc-100 transition-colors">
                                    <FileText className="h-4 w-4" /> Documento
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="relative flex-1">
                    <textarea
                        ref={inputRef}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || t('messages.inputPlaceholder') || 'Escribe un mensaje...'}
                        disabled={disabled || isSending || isRecording}
                        rows={1}
                        className={cn(
                            'max-h-32 w-full resize-none rounded-lg border px-3 py-3 text-sm transition-all duration-200 sm:px-4 sm:text-base',
                            'text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10',
                            isOverLimit && 'border-zinc-950 focus:ring-zinc-950/10',
                            disabled || isRecording
                                ? 'cursor-not-allowed border-zinc-200 bg-zinc-50'
                                : 'border-zinc-200 bg-white hover:border-zinc-300'
                        )}
                        aria-label={t('messages.inputAriaLabel') || 'Campo de mensaje'}
                        aria-describedby={isNearLimit ? 'char-count' : undefined}
                    />

                    {isNearLimit && (
                        <span
                            id="char-count"
                            className={cn(
                                'absolute bottom-1 right-3 text-xs',
                                isOverLimit ? 'text-zinc-950' : 'text-zinc-400'
                            )}
                        >
                            {charCount}/{maxLength}
                        </span>
                    )}
                </div>

                {quickReplies.length > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("flex-shrink-0 transition-colors", showQuickReplies ? "text-amber-500 bg-amber-50" : "text-zinc-500 hover:text-zinc-950")}
                        onClick={() => setShowQuickReplies(!showQuickReplies)}
                        aria-label="Respuestas Rápidas"
                    >
                        <Zap className="h-5 w-5" />
                    </Button>
                )}

                {message.trim().length === 0 ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "flex-shrink-0 transition-all",
                            isRecording ? "text-red-500 animate-pulse bg-red-50" : "text-zinc-500 hover:text-zinc-950"
                        )}
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        aria-label="Grabar audio"
                    >
                        <Mic className="h-5 w-5" />
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        size="icon"
                        onClick={handleSend}
                        disabled={!canSend || isOverLimit}
                        aria-label={t('messages.send') || 'Enviar mensaje'}
                        className="flex-shrink-0"
                    >
                        {isSending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-5 w-5" />
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}

export default MessageInput;
