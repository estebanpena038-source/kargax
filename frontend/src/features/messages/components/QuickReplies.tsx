// =============================================================================
// KARGAX - Quick Replies Component
// Enterprise-Grade Predefined Message Templates
// =============================================================================

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { QuickReply } from '../types';

export interface QuickRepliesProps {
    replies: QuickReply[];
    onSelect: (message: string) => void;
}

export function QuickReplies({ replies, onSelect }: QuickRepliesProps) {
    if (!replies || replies.length === 0) return null;

    return (
        <div className="w-full overflow-x-auto no-scrollbar py-2 px-4 border-t border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center gap-2 w-max">
                {replies.map((reply) => (
                    <button
                        key={reply.id}
                        onClick={() => onSelect(reply.message)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                            "bg-white border border-zinc-200 shadow-sm",
                            "text-sm font-medium text-zinc-700",
                            "hover:border-zinc-400 hover:bg-zinc-50 transition-colors",
                            "active:scale-95 transform duration-100"
                        )}
                    >
                        {reply.icon && <span>{reply.icon}</span>}
                        <span>{reply.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default QuickReplies;
