// =============================================================================
// KARGAX - Reply Preview Component
// Enterprise-Grade Reply Context Display
// =============================================================================

'use client';

import * as React from 'react';
import { X, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReplyContext } from '../types';

export interface ReplyPreviewProps {
    replyContext: ReplyContext;
    variant: 'inline' | 'input';
    onDismiss?: () => void;
    onClickReply?: (messageId: string) => void;
    isMine?: boolean; // Only for inline variant
}

export function ReplyPreview({ 
    replyContext, 
    variant, 
    onDismiss, 
    onClickReply,
    isMine = false 
}: ReplyPreviewProps) {

    const typeLabels: Record<string, string> = {
        image: 'Foto',
        file: 'Archivo',
        location: 'Ubicación',
        audio: 'Nota de voz',
        evidence: 'Evidencia',
    };

    const isNonText = replyContext.messageType !== 'text' && replyContext.messageType !== 'system';
    const previewText = isNonText 
        ? `[${typeLabels[replyContext.messageType] || 'Adjunto'}]` 
        : replyContext.content;

    if (variant === 'inline') {
        return (
            <button 
                type="button"
                onClick={() => onClickReply?.(replyContext.messageId)}
                className={cn(
                    "flex flex-col text-left mb-2 rounded-md px-3 py-1.5 border-l-2 text-sm max-w-full transition-opacity hover:opacity-80",
                    isMine 
                        ? "bg-white/10 border-white/50 text-white/90" 
                        : "bg-zinc-50 border-zinc-900 text-zinc-600"
                )}
            >
                <span className={cn(
                    "font-semibold text-xs",
                    isMine ? "text-white" : "text-zinc-900"
                )}>
                    {replyContext.senderName}
                </span>
                <span className="line-clamp-1 break-all opacity-90 text-[13px]">
                    {previewText}
                </span>
            </button>
        );
    }

    // Input variant
    return (
        <div className="flex items-center justify-between w-full bg-zinc-50 border-t border-zinc-200 px-4 py-2.5">
            <div className="flex items-center gap-3 min-w-0">
                <Reply className="w-5 h-5 text-zinc-400 shrink-0" />
                <div className="flex flex-col min-w-0 border-l-2 border-zinc-900 pl-3">
                    <span className="text-xs font-semibold text-zinc-900">
                        Respondiendo a {replyContext.senderName}
                    </span>
                    <span className="text-sm text-zinc-500 truncate">
                        {previewText}
                    </span>
                </div>
            </div>
            
            {onDismiss && (
                <button 
                    onClick={onDismiss}
                    className="p-1.5 rounded-full hover:bg-zinc-200 text-zinc-500 transition-colors shrink-0"
                    aria-label="Cancelar respuesta"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

export default ReplyPreview;
