// =============================================================================
// KargaX - NotificationBell Component
// Real-time notification bell with dropdown
// =============================================================================

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    Check,
    CheckCheck,
    Package,
    User,
    X,
    Clock,
} from 'lucide-react';

import { Button, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabaseApi } from '@/lib/supabase/api-bridge';
import { supabaseNotifications, type Notification } from '@/lib/supabase/notifications';

// =============================================================================
// Utility
// =============================================================================

function formatRelativeTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `hace ${diffMins}m`;
        if (diffHours < 24) return `hace ${diffHours}h`;
        if (diffDays < 7) return `hace ${diffDays}d`;
        return date.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

function getNotificationIcon(type: string) {
    switch (type) {
        case 'application_received':
            return <User className="w-4 h-4 text-blue-500" />;
        case 'application_accepted':
            return <Check className="w-4 h-4 text-emerald-500" />;
        case 'application_rejected':
            return <X className="w-4 h-4 text-red-500" />;
        default:
            return <Package className="w-4 h-4 text-green-600" />;
    }
}

// =============================================================================
// Component
// =============================================================================

export function NotificationBell() {
    const router = useRouter();
    const { user } = useAuthStore();

    const [isOpen, setIsOpen] = React.useState(false);
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(false);

    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Fetch notifications
    const fetchNotifications = React.useCallback(async () => {
        if (!user) return;

        setIsLoading(true);
        try {
            const [notifResult, countResult] = await Promise.all([
                supabaseApi.notifications.getAll({ limit: 10 }),
                supabaseApi.notifications.getUnreadCount(),
            ]);

            if (notifResult.success && notifResult.data) {
                setNotifications(notifResult.data);
            }
            if (countResult.success) {
                setUnreadCount(countResult.data || 0);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // Initial fetch
    React.useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Realtime subscription
    React.useEffect(() => {
        if (!user?.id) return;

        const channel = supabaseNotifications.subscribeToNotifications(
            user.id,
            (newNotification) => {
                // Add to top of list
                setNotifications((prev) => [newNotification, ...prev.slice(0, 9)]);
                setUnreadCount((prev) => prev + 1);

                // Show toast
                toast.success(newNotification.title, newNotification.message);
            }
        );

        return () => {
            if (channel) {
                supabaseNotifications.unsubscribe(channel);
            }
        };
    }, [user?.id]);

    // Close dropdown on outside click
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Mark single as read
    const handleMarkAsRead = async (notificationId: string) => {
        await supabaseApi.notifications.markAsRead(notificationId);
        setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    // Mark all as read
    const handleMarkAllAsRead = async () => {
        await supabaseApi.notifications.markAllAsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    // Handle notification click
    const handleNotificationClick = (notification: Notification) => {
        handleMarkAsRead(notification.id);
        setIsOpen(false);

        // Navigate based on type
        const { data } = notification;
        if (notification.type === 'application_received' && data?.offer_id) {
            router.push('/postulaciones-recibidas');
        } else if (
            notification.type === 'private_fleet_assignment'
            || notification.type === 'private_fleet_assignment_rejected'
        ) {
            router.push('/viajes-asignados');
        } else if (
            (notification.type === 'application_accepted' || notification.type === 'application_rejected')
        ) {
            router.push('/postulaciones');
        }
    };

    return (
        <div className="relative min-w-0" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) fetchNotifications();
                }}
                className={cn(
                    'relative rounded-lg p-2 transition-colors',
                    isOpen ? 'bg-slate-100' : 'hover:bg-slate-100'
                )}
                aria-label="Notificaciones"
            >
                <Bell className="w-5 h-5 text-slate-600" />

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zinc-950 px-1 text-xs font-bold text-white ring-2 ring-white"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_24px_60px_-40px_rgba(0,0,0,.7)] max-[380px]:-right-12"
                    >
                        {/* Header */}
                        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-100 p-3">
                            <h3 className="min-w-0 font-semibold text-zinc-950">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Marcar todas
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="max-h-[min(20rem,calc(100svh-7rem))] overflow-y-auto">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-400">
                                    Cargando...
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">Sin notificaciones</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <button
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={cn(
                                            'w-full min-w-0 border-b border-zinc-100 p-3 text-left transition-colors last:border-0 hover:bg-zinc-50',
                                            !notification.read && 'bg-zinc-50'
                                        )}
                                    >
                                        <div className="flex min-w-0 gap-3">
                                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    'text-sm break-words',
                                                    notification.read ? 'text-zinc-600' : 'font-medium text-zinc-950'
                                                )}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                                    {notification.message}
                                                </p>
                                                <div className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                                                    <Clock className="w-3 h-3" />
                                                    {formatRelativeTime(notification.created_at)}
                                                </div>
                                            </div>
                                            {!notification.read && (
                                                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-zinc-950" />
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default NotificationBell;
