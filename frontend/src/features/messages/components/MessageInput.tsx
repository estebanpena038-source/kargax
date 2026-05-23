// =============================================================================
// KARGAX - Message Input Component
// Text-only release version for production-first rollout
// =============================================================================

'use client';

import * as React from 'react';
import { Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface MessageInputProps {
    onSendMessage: (text: string) => void;
    isSending?: boolean;
    disabled?: boolean;
    placeholder?: string;
    maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 5000;

export function MessageInput({
    onSendMessage,
    isSending = false,
    disabled = false,
    placeholder,
    maxLength = DEFAULT_MAX_LENGTH,
}: MessageInputProps) {
    const { t } = useTranslation();
    const [message, setMessage] = React.useState('');
    const inputRef = React.useRef<HTMLTextAreaElement>(null);

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

    return (
        <div className="border-t border-zinc-200 bg-white p-3 sm:p-4">
            <div className="flex min-w-0 items-end gap-2">
                <div className="relative flex-1">
                    <textarea
                        ref={inputRef}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || t('messages.inputPlaceholder') || 'Escribe un mensaje...'}
                        disabled={disabled || isSending}
                        rows={1}
                        className={cn(
                            'max-h-32 w-full resize-none rounded-lg border px-3 py-3 text-sm transition-all duration-200 sm:px-4 sm:text-base',
                            'text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10',
                            isOverLimit && 'border-zinc-950 focus:ring-zinc-950/10',
                            disabled
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
            </div>
        </div>
    );
}

export default MessageInput;
