// =============================================================================
// KARGAX - Message Reactions Component
// Enterprise-Grade Reaction System
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { MessageReaction } from '../types';

export interface MessageReactionsProps {
    reactions: MessageReaction[];
    onReact: (emoji: string) => void;
    onRemoveReaction: (emoji: string) => void;
    currentUserId: string;
    isMine?: boolean;
}

const COMMON_EMOJIS = ['👍', '✅', '🚛', '📦', '⚠️', '🔥', '❤️', '😂'];

export function MessageReactions({
    reactions,
    onReact,
    onRemoveReaction,
    currentUserId,
    isMine = false
}: MessageReactionsProps) {
    if (!reactions || reactions.length === 0) return null;

    // Group reactions by emoji
    const grouped = reactions.reduce((acc, rx) => {
        if (!acc[rx.emoji]) acc[rx.emoji] = [];
        acc[rx.emoji].push(rx);
        return acc;
    }, {} as Record<string, MessageReaction[]>);

    return (
        <div className={cn(
            "flex flex-wrap gap-1.5 mt-1 relative z-10",
            isMine ? "justify-end" : "justify-start"
        )}>
            <AnimatePresence>
                {Object.entries(grouped).map(([emoji, rxList]) => {
                    const hasMyReaction = rxList.some(rx => rx.userId === currentUserId);
                    const count = rxList.length;

                    return (
                        <motion.button
                            key={emoji}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => hasMyReaction ? onRemoveReaction(emoji) : onReact(emoji)}
                            className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
                                hasMyReaction 
                                    ? (isMine ? "bg-white/20 border-white/30 text-white" : "bg-blue-50 border-blue-200 text-blue-700")
                                    : (isMine ? "bg-zinc-800 border-zinc-700 text-zinc-300" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50")
                            )}
                            title={rxList.map(r => r.userName || 'Usuario').join(', ')}
                        >
                            <span>{emoji}</span>
                            <span className="text-[10px]">{count > 1 ? count : ''}</span>
                        </motion.button>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

export function ReactionPicker({ 
    onSelect, 
    onClose 
}: { 
    onSelect: (emoji: string) => void;
    onClose: () => void;
}) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1 bg-white border border-zinc-200 shadow-lg rounded-full px-2 py-1.5"
            onMouseLeave={onClose}
        >
            {COMMON_EMOJIS.map(emoji => (
                <button
                    key={emoji}
                    onClick={() => {
                        onSelect(emoji);
                        onClose();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors text-lg"
                >
                    {emoji}
                </button>
            ))}
        </motion.div>
    );
}

export default MessageReactions;
