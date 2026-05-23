// =============================================================================
// KARGAX - Message Notifications Component
// Enterprise-Grade Toast Notifications for New Messages
// =============================================================================
//
// FEATURES:
// - Animated toast notifications
// - Auto-dismiss after timeout
// - Action button to view message
// - Dismissible with X button
// - Stacks multiple notifications
//
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    X,
} from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui';

import type { MessageNotification } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface MessageNotificationsProps {
    /** Array of notifications to display */
    notifications: MessageNotification[];
    /** Handler for dismissing a notification */
    onDismiss: (id: string) => void;
    /** Handler for notification action (e.g., view message) */
    onAction?: (notification: MessageNotification) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Auto-dismiss timeout in milliseconds */
const AUTO_DISMISS_MS = 5000;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * MessageNotifications - Displays toast notifications for new messages.
 * 
 * Features:
 * - Animated entrance/exit
 * - Auto-dismiss with timeout
 * - Action buttons
 * - Message preview
 * 
 * @example
 * ```tsx
 * <MessageNotifications
 *   notifications={notifications}
 *   onDismiss={handleDismiss}
 *   onAction={handleAction}
 * />
 * ```
 */
export function MessageNotifications({
    notifications,
    onDismiss,
    onAction,
}: MessageNotificationsProps) {
    const { t } = useTranslation();
    const [visibleNotifications, setVisibleNotifications] = React.useState<MessageNotification[]>([]);

    // =========================================================================
    // Sync with props
    // =========================================================================
    React.useEffect(() => {
        setVisibleNotifications(notifications);
    }, [notifications]);

    // =========================================================================
    // Handlers
    // =========================================================================
    const handleDismiss = React.useCallback((id: string) => {
        setVisibleNotifications((prev) => prev.filter((n) => n.id !== id));
        onDismiss(id);
    }, [onDismiss]);

    // =========================================================================
    // Auto-dismiss timer
    // =========================================================================
    React.useEffect(() => {
        if (visibleNotifications.length === 0) return;

        const timers = visibleNotifications.map((notification) => {
            return setTimeout(() => {
                handleDismiss(notification.id);
            }, AUTO_DISMISS_MS);
        });

        return () => {
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, [handleDismiss, visibleNotifications]);

    const handleAction = React.useCallback((notification: MessageNotification) => {
        onAction?.(notification);
        handleDismiss(notification.id);
    }, [onAction, handleDismiss]);

    // =========================================================================
    // Don't render if no notifications
    // =========================================================================
    if (visibleNotifications.length === 0) {
        return null;
    }

    // =========================================================================
    // Render
    // =========================================================================
    return (
        <div className="pointer-events-none fixed left-3 right-3 top-20 z-50 space-y-3 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm">
            <AnimatePresence mode="popLayout">
                {visibleNotifications.map((notification) => (
                    <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0, x: 100, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="pointer-events-auto rounded-lg border border-zinc-200 bg-white p-3 shadow-[0_24px_70px_-50px_rgba(10,10,10,.72)] sm:p-4"
                    >
                        <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 text-white" />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-zinc-950">
                                            {notification.title}
                                        </h4>
                                        <p className="text-sm text-zinc-500 mt-0.5">
                                            {notification.message}
                                        </p>

                                        {/* Preview */}
                                        {notification.preview && (
                                            <div className="mt-2 p-2 bg-zinc-50 rounded-lg">
                                                <p className="text-xs text-zinc-500 truncate">
                                                    &ldquo;{notification.preview}&rdquo;
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Dismiss Button */}
                                    <button
                                        onClick={() => handleDismiss(notification.id)}
                                        className="flex-shrink-0 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                                        aria-label={t('common.dismiss') || 'Descartar'}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Action Button */}
                                {notification.action && (
                                    <div className="mt-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAction(notification)}
                                            className="text-xs"
                                        >
                                            {notification.action.label}
                                        </Button>
                                    </div>
                                )}

                                {/* Timestamp */}
                                <p className="mt-2 text-xs text-zinc-400">
                                    {notification.timestamp.toLocaleTimeString('es-CO', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default MessageNotifications;
