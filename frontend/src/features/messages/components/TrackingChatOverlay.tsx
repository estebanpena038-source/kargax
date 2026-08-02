'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, MessageSquare } from 'lucide-react';
import { useMessaging, useQuickReplies } from '../hooks/useMessages';
import { cn } from '@/lib/utils';
import { fetchChannelByEntity } from '../api/messagesApi';

export interface TrackingChatOverlayProps {
    tripId: string;
    isMinimized?: boolean;
    onToggle?: () => void;
}

export function TrackingChatOverlay({ tripId, isMinimized: controlledIsMinimized, onToggle }: TrackingChatOverlayProps) {
    const [localIsMinimized, setLocalIsMinimized] = React.useState(true);
    const isMinimized = controlledIsMinimized !== undefined ? controlledIsMinimized : localIsMinimized;
    const [channelId, setChannelId] = React.useState<string | null>(null);

    const handleToggle = () => {
        if (onToggle) onToggle();
        else setLocalIsMinimized(!localIsMinimized);
    };

    const { messages, sendMessage } = useMessaging(channelId);
    const quickReplies = useQuickReplies('trip');

    React.useEffect(() => {
        let isMounted = true;
        const loadChannel = async () => {
            try {
                const channel = await fetchChannelByEntity('trip', tripId);
                if (channel && isMounted) {
                    setChannelId(channel.id);
                }
            } catch (error) {
                console.error('Error loading channel for overlay:', error);
            }
        };
        void loadChannel();
        return () => { isMounted = false; };
    }, [tripId]);

    const recentMessages = messages.slice(-10);

    const handleQuickReply = (text: string) => {
        void sendMessage(text);
    };

    return (
        <div className="fixed bottom-6 left-6 z-40 w-[300px] overflow-hidden rounded-xl border border-white/20 bg-black/60 shadow-2xl backdrop-blur-md">
            {/* Header / Minimized Bar */}
            <button
                onClick={handleToggle}
                className="flex w-full items-center justify-between bg-white/10 px-4 py-3 text-white transition hover:bg-white/20"
            >
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm font-semibold">Chat del viaje</span>
                </div>
                {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {/* Expanded State */}
            <AnimatePresence>
                {!isMinimized && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 300 }}
                        exit={{ height: 0 }}
                        className="flex flex-col"
                    >
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                            {recentMessages.length === 0 ? (
                                <p className="mt-4 text-center text-xs text-white/50">No hay mensajes recientes</p>
                            ) : (
                                recentMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                                            msg.isMine
                                                ? "self-end bg-blue-600 text-white"
                                                : "self-start bg-white/10 text-white"
                                        )}
                                    >
                                        {msg.content}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Quick Replies */}
                        <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-2 scrollbar-hide">
                            {quickReplies.map((qr) => (
                                <button
                                    key={qr.id}
                                    onClick={() => handleQuickReply(qr.message)}
                                    className="shrink-0 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:bg-white/15"
                                >
                                    {qr.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
