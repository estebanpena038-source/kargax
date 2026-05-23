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
} from '@/features/messages/components';
import { useMessaging } from '@/features/messages/hooks';
import type { MessageNotification } from '@/features/messages/types';
import { useTranslation } from '@/lib/i18n';

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
    } = useMessaging(activeConversationId);

    React.useEffect(() => {
        const conversationId = searchParams?.get('c');
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
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                ) : (
                    <>
                        <div className="h-full w-72 flex-shrink-0 border-r border-zinc-200 xl:w-96">
                            <ConversationsList
                                conversations={conversations}
                                activeConversationId={activeConversationId}
                                onConversationSelect={handleConversationSelect}
                                isLoading={isLoadingConversations}
                            />
                        </div>

                        <div className="h-full min-w-0 flex-1">
                            <ChatArea
                                conversation={activeConversation}
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                isLoading={isLoadingMessages}
                                isSending={isSending}
                            />
                        </div>
                    </>
                )}
            </div>

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
