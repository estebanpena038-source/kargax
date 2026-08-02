'use client';

import * as React from 'react';
import { Truck } from 'lucide-react';
import { ConversationsList } from './ConversationsList';
import { ChatArea } from './ChatArea';
import { useChannelConversations, useMessaging } from '../hooks/useMessages';

export interface FleetChatColumnProps {
    businessId?: string;
}

export function FleetChatColumn({ businessId }: FleetChatColumnProps) {
    const { data: conversations, isLoading: isLoadingConversations } = useChannelConversations('fleet');
    const [activeId, setActiveId] = React.useState<string | null>(null);

    const {
        activeConversation,
        messages,
        isLoadingMessages,
        sendMessage,
    } = useMessaging(activeId);

    // Auto-select first if none selected
    React.useEffect(() => {
        if (!activeId && conversations?.length) {
            setActiveId(conversations[0].id);
        }
    }, [conversations, activeId]);

    const handleSendMessage = React.useCallback((text: string) => {
        void sendMessage(text);
    }, [sendMessage]);

    return (
        <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                <Truck className="h-5 w-5 text-zinc-700" />
                <h2 className="font-semibold text-zinc-950">Chat de Flota</h2>
            </div>
            
            {/* Split View */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top 40%: Conversations List */}
                <div className="h-[40%] min-h-[200px] overflow-y-auto border-b border-zinc-100">
                    {!conversations?.length && !isLoadingConversations ? (
                        <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-zinc-500">
                            <Truck className="mb-2 h-8 w-8 text-zinc-300" />
                            <p>No hay conversaciones de flota activas</p>
                        </div>
                    ) : (
                        <div className="compact-mode">
                            <ConversationsList
                                conversations={conversations || []}
                                activeConversationId={activeId}
                                onConversationSelect={setActiveId}
                            />
                        </div>
                    )}
                </div>

                {/* Bottom 60%: Chat Area */}
                <div className="h-[60%] flex-1 overflow-hidden bg-zinc-50/50">
                    {activeId ? (
                        <ChatArea
                            conversation={activeConversation}
                            messages={messages}
                            isLoading={isLoadingMessages}
                            onSendMessage={handleSendMessage}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                            Selecciona una conversación para ver los mensajes.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
