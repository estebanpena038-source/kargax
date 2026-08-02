'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { ChatArea } from './ChatArea';
import { useMessaging, useUnreadBadge } from '../hooks/useMessages';
import { fetchChannelByEntity, createEntityChannel } from '../api/messagesApi';
import { cn } from '@/lib/utils';

export interface TripChatButtonProps {
    entityId: string;
    entityType?: string;
}

export function TripChatButton({ entityId, entityType = 'trip' }: TripChatButtonProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [channelId, setChannelId] = React.useState<string | null>(null);
    const [isLoadingChannel, setIsLoadingChannel] = React.useState(false);
    const { data: unreadCount } = useUnreadBadge();

    const { 
        activeConversation, 
        messages, 
        isLoadingMessages, 
        sendMessage 
    } = useMessaging(channelId);

    React.useEffect(() => {
        if (!isOpen) return;
        if (channelId) return;

        let isMounted = true;
        const initChannel = async () => {
            setIsLoadingChannel(true);
            try {
                let channel = await fetchChannelByEntity(entityType, entityId);
                if (!channel && isMounted) {
                    // Create if not exists
                    const newId = await createEntityChannel({
                        channelType: 'trip',
                        entityType,
                        entityId,
                        title: 'Chat del Viaje',
                        participantIds: [], // Would typically be driver + company
                    });
                    if (isMounted) setChannelId(newId);
                } else if (channel && isMounted) {
                    setChannelId(channel.id);
                }
            } catch (error) {
                console.error('Failed to init channel:', error);
            } finally {
                if (isMounted) setIsLoadingChannel(false);
            }
        };

        void initChannel();

        return () => {
            isMounted = false;
        };
    }, [isOpen, entityId, entityType, channelId]);

    const handleSendMessage = React.useCallback(
        (text: string) => {
            void sendMessage(text);
        },
        [sendMessage]
    );

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => setIsOpen(true)}
                    className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-2xl transition hover:scale-105 active:scale-95",
                        isOpen && "hidden"
                    )}
                >
                    <MessageSquare className="h-6 w-6" />
                    {unreadCount ? unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    ) : null}
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[400px]"
                        >
                            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                                <div>
                                    <h3 className="font-semibold text-zinc-950">Chat del Viaje</h3>
                                    <p className="text-xs text-zinc-500">Soporte y coordinación</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-hidden bg-white">
                                {isLoadingChannel ? (
                                    <div className="flex h-full items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                                    </div>
                                ) : channelId ? (
                                    <ChatArea
                                        conversation={activeConversation}
                                        messages={messages}
                                        isLoading={isLoadingMessages}
                                        onSendMessage={handleSendMessage}
                                        isMobile={true} // Force mobile style to hide back button logic or keep simple
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
                                        No se pudo cargar el chat.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
