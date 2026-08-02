// =============================================================================
// KARGAX - Messages Page
// Enterprise-Grade Messaging Interface
// =============================================================================

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { toast } from '@/components/ui';
import {
    ChatArea,
    ConversationsList,
    MessageNotifications,
    ChannelSidebar,
    NewConversationModal
} from '@/features/messages/components';
import { useMessaging } from '@/features/messages/hooks';
import type { MessageNotification, ChannelFilter } from '@/features/messages/types';
import { useTranslation } from '@/lib/i18n';
import { createEntityChannel } from '@/features/messages/api/messagesApi';

const MOBILE_BREAKPOINT = 1024;

function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        checkMobile();

        let timeoutId: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(checkMobile, 100);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    return isMobile;
}

function MensajesPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
    const [showConversationList, setShowConversationList] = React.useState(true);
    const [notifications, setNotifications] = React.useState<MessageNotification[]>([]);
    
    // New states for channels & modals
    const [channelFilter, setChannelFilter] = React.useState<ChannelFilter>('all');
    const [showInfoPanel, setShowInfoPanel] = React.useState(false);
    const [isNewModalOpen, setIsNewModalOpen] = React.useState(false);

    const {
        conversations,
        isLoadingConversations,
        conversationsError,
        messages,
        isLoadingMessages,
        activeConversation,
        sendMessage,
        isSending,
        sendError,
        refetchConversations
    } = useMessaging(activeConversationId);

    React.useEffect(() => {
        const conversationId = searchParams?.get('c');
        const channel = searchParams?.get('channel');
        
        if (channel) {
            setChannelFilter(channel as ChannelFilter);
        }
        
        if (conversationId && conversationId !== activeConversationId) {
            setActiveConversationId(conversationId);
            if (isMobile) {
                setShowConversationList(false);
            }
        }
    }, [searchParams, activeConversationId, isMobile]);

    const handleConversationSelect = React.useCallback((conversationId: string) => {
        setActiveConversationId(conversationId);

        const url = new URL(window.location.href);
        url.searchParams.set('c', conversationId);
        router.replace(url.pathname + url.search, { scroll: false });

        if (isMobile) {
            setShowConversationList(false);
        }
    }, [isMobile, router]);

    const handleBackToList = React.useCallback(() => {
        setShowConversationList(true);
        setActiveConversationId(null);

        const url = new URL(window.location.href);
        url.searchParams.delete('c');
        router.replace(url.pathname + url.search, { scroll: false });
    }, [router]);

    const handleSendMessage = React.useCallback(async (text: string) => {
        if (!text.trim()) {
            return;
        }

        try {
            await sendMessage(text);
        } catch (error) {
            console.error('[MensajesPage] Send error:', error);
            toast.error(
                t('messages.sendError') || 'Error al enviar',
                error instanceof Error ? error.message : 'No se pudo enviar el mensaje'
            );
        }
    }, [sendMessage, t]);

    const handleSelectContact = React.useCallback(async (contact: {
        type: 'user' | 'trip' | 'fleet';
        id: string;
        name: string;
        offerId?: string;
    }) => {
        try {
            if (contact.type === 'trip' && contact.offerId) {
                const channelId = await createEntityChannel({
                    channelType: 'trip',
                    entityType: 'trip',
                    entityId: contact.offerId,
                    title: contact.name,
                });
                if (channelId) {
                    await refetchConversations();
                    handleConversationSelect(channelId);
                    return;
                }
            }

            // Fallback: check if existing conversation exists or set ID directly
            const existing = conversations.find(c => c.id === contact.id || c.offerId === contact.offerId);
            if (existing) {
                handleConversationSelect(existing.id);
            } else {
                handleConversationSelect(contact.id);
            }
        } catch (err: any) {
            console.error('[MensajesPage] Error selecting contact:', err);
            handleConversationSelect(contact.id);
        }
    }, [conversations, refetchConversations, handleConversationSelect]);

    const handleNotificationDismiss = React.useCallback((id: string) => {
        setNotifications((previousNotifications) =>
            previousNotifications.filter((notification) => notification.id !== id)
        );
    }, []);

    const handleNotificationAction = React.useCallback((notification: MessageNotification) => {
        if (notification.action?.conversationId) {
            handleConversationSelect(notification.action.conversationId);
        }
    }, [handleConversationSelect]);

    React.useEffect(() => {
        if (conversationsError) {
            toast.error(
                t('messages.loadError') || 'Error al cargar',
                conversationsError.message
            );
        }
    }, [conversationsError, t]);

    React.useEffect(() => {
        if (sendError) {
            toast.error(
                t('messages.sendError') || 'Error al enviar',
                sendError.message
            );
        }
    }, [sendError, t]);

    return (
        <DashboardLayout
            pageTitle={t('messages.pageTitle') || 'Mensajes'}
            showHeader={false}
        >
            <div className="flex h-[calc(100dvh-6rem)] min-h-[34rem] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] sm:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3rem)]">
                {isMobile ? (
                    <AnimatePresence mode="wait" initial={false}>
                        {showConversationList ? (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full min-w-0 w-full"
                            >
                                <ConversationsList
                                    conversations={conversations}
                                    activeConversationId={activeConversationId}
                                    onConversationSelect={handleConversationSelect}
                                    isMobile
                                    isLoading={isLoadingConversations}
                                    onNewConversation={() => setIsNewModalOpen(true)}
                                    channelFilter={channelFilter}
                                    onChannelFilterChange={setChannelFilter}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="chat"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full min-w-0 w-full"
                            >
                                <ChatArea
                                    conversation={activeConversation}
                                    messages={messages}
                                    onSendMessage={handleSendMessage}
                                    onBackToList={handleBackToList}
                                    isMobile
                                    isLoading={isLoadingMessages}
                                    isSending={isSending}
                                    onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
                                    showInfoPanel={showInfoPanel}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                ) : (
                    <>
                        <div className="h-full w-80 flex-shrink-0 border-r border-zinc-200">
                            <ConversationsList
                                conversations={conversations}
                                activeConversationId={activeConversationId}
                                onConversationSelect={handleConversationSelect}
                                isLoading={isLoadingConversations}
                                onNewConversation={() => setIsNewModalOpen(true)}
                                channelFilter={channelFilter}
                                onChannelFilterChange={setChannelFilter}
                            />
                        </div>

                        <div className="h-full min-w-0 flex-1 relative flex">
                            <div className="h-full min-w-0 flex-1">
                                <ChatArea
                                    conversation={activeConversation}
                                    messages={messages}
                                    onSendMessage={handleSendMessage}
                                    isLoading={isLoadingMessages}
                                    isSending={isSending}
                                    onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
                                    showInfoPanel={showInfoPanel}
                                />
                            </div>
                            
                            <AnimatePresence>
                                {showInfoPanel && activeConversation && (
                                    <motion.div 
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{ width: 320, opacity: 1 }}
                                        exit={{ width: 0, opacity: 0 }}
                                        className="h-full border-l border-zinc-200 bg-white overflow-hidden flex-shrink-0"
                                    >
                                        <ChannelSidebar 
                                            conversation={activeConversation as any}
                                            participants={(activeConversation as any).participants || []}
                                            presenceMap={new Map()}
                                            isOpen={showInfoPanel}
                                            onClose={() => setShowInfoPanel(false)}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </div>

            <NewConversationModal
                isOpen={isNewModalOpen}
                onClose={() => setIsNewModalOpen(false)}
                onSelectContact={handleSelectContact}
            />

            <MessageNotifications
                notifications={notifications}
                onDismiss={handleNotificationDismiss}
                onAction={handleNotificationAction}
            />
        </DashboardLayout>
    );
}

export default function MensajesPage() {
    return (
        <React.Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-950 border-t-transparent" />
                </div>
            }
        >
            <MensajesPageContent />
        </React.Suspense>
    );
}
