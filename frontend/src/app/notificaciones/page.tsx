// =============================================================================
// KargaX - Notifications Page
// Central hub for all user notifications
// =============================================================================

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    CheckCheck,
    Package,
    User,
    Truck,
    Clock,
    RefreshCw,
    ChevronRight,
    AlertCircle,
    XCircle,
    CheckCircle2,
    Send,
    ClipboardCheck,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Badge, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/features/notifications/store/notificationStore';

// =============================================================================
// Types
// =============================================================================

type NotificationType =
    | 'application_received'
    | 'application_accepted'
    | 'application_rejected'
    | 'offer_published'
    | 'offer_expired'
    | 'new_message'
    // Inspection types
    | 'inspection_loading_completed'
    | 'inspection_delivery_completed'
    | 'inspection_issue_reported'
    | 'trip_started'
    | 'trip_completed'
    | 'private_fleet_assignment'
    | 'private_fleet_assignment_rejected';

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    data: Record<string, any>;
    read: boolean;
    created_at: string;
}

type NotificationFilter = 'all' | 'trips' | 'payments' | 'team' | 'system';

// =============================================================================
// Utility Functions
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
        if (diffMins < 60) return `hace ${diffMins} min`;
        if (diffHours < 24) return `hace ${diffHours}h`;
        if (diffDays < 7) return `hace ${diffDays} dias`;
        if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semanas`;
        return date.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

function getNotificationIcon(type: NotificationType) {
    const iconConfig: Record<NotificationType, { icon: any; color: string; bg: string }> = {
        application_received: { icon: User, color: 'text-zinc-950', bg: 'bg-white' },
        application_accepted: { icon: CheckCircle2, color: 'text-zinc-950', bg: 'bg-white' },
        application_rejected: { icon: XCircle, color: 'text-zinc-950', bg: 'bg-white' },
        offer_published: { icon: Package, color: 'text-zinc-950', bg: 'bg-white' },
        offer_expired: { icon: AlertCircle, color: 'text-zinc-950', bg: 'bg-white' },
        new_message: { icon: Send, color: 'text-zinc-950', bg: 'bg-white' },
        // Inspection types
        inspection_loading_completed: { icon: Package, color: 'text-zinc-950', bg: 'bg-white' },
        inspection_delivery_completed: { icon: CheckCircle2, color: 'text-zinc-950', bg: 'bg-white' },
        inspection_issue_reported: { icon: AlertCircle, color: 'text-zinc-950', bg: 'bg-white' },
        trip_started: { icon: Truck, color: 'text-zinc-950', bg: 'bg-white' },
        trip_completed: { icon: ClipboardCheck, color: 'text-zinc-950', bg: 'bg-white' },
        private_fleet_assignment: { icon: Truck, color: 'text-zinc-950', bg: 'bg-white' },
        private_fleet_assignment_rejected: { icon: XCircle, color: 'text-zinc-950', bg: 'bg-white' },
    };

    return iconConfig[type] || { icon: Bell, color: 'text-zinc-950', bg: 'bg-white' };
}

function getNotificationCategory(type: NotificationType): NotificationFilter {
    const value = String(type);

    if (value.includes('payment') || value.includes('wallet') || value.includes('payout')) {
        return 'payments';
    }

    if (
        value.includes('trip')
        || value.includes('inspection')
        || value.includes('private_fleet')
        || value.includes('application_accepted')
        || value.includes('application_rejected')
    ) {
        return 'trips';
    }

    if (value.includes('application_received') || value.includes('message')) {
        return 'team';
    }

    return 'system';
}

// =============================================================================
// Sub-components
// =============================================================================

function NotificationSkeleton() {
    return (
        <div className="p-4 border-b border-zinc-100 animate-pulse">
            <div className="flex gap-3 sm:gap-4">
                <div className="w-12 h-12 bg-zinc-200 rounded-full" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-zinc-200 rounded" />
                    <div className="h-3 w-2/3 bg-zinc-200 rounded" />
                    <div className="h-3 w-1/4 bg-zinc-200 rounded" />
                </div>
            </div>
        </div>
    );
}

function NotificationItem({
    notification,
    onMarkAsRead,
    onClick,
}: {
    notification: Notification;
    onMarkAsRead: (id: string) => void;
    onClick: (notification: Notification) => void;
}) {
    const iconConfig = getNotificationIcon(notification.type);
    const IconComponent = iconConfig.icon;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn(
                'p-4 border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-all group',
                !notification.read && 'bg-zinc-50'
            )}
            onClick={() => onClick(notification)}
        >
            <div className="flex gap-4">
                {/* Icon */}
                <div className={cn(
                    'h-10 w-10 flex-shrink-0 rounded-lg border border-zinc-200 flex items-center justify-center sm:h-12 sm:w-12',
                    iconConfig.bg
                )}>
                    <IconComponent className={cn('h-5 w-5 sm:h-6 sm:w-6', iconConfig.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className={cn(
                            'text-sm line-clamp-1',
                            notification.read ? 'text-zinc-700' : 'text-zinc-950 font-semibold'
                        )}>
                            {notification.title}
                        </h4>
                        {!notification.read && (
                            <span className="w-2.5 h-2.5 bg-zinc-950 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                    </div>
                    <p className="text-sm text-zinc-600 line-clamp-2 mt-0.5">
                        {notification.message}
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(notification.created_at)}
                        </span>
                        {!notification.read && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkAsRead(notification.id);
                                }}
                                className="w-fit text-xs font-medium text-zinc-950 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                            >
                                Marcar como leida
                            </button>
                        )}
                    </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-950 transition-colors flex-shrink-0 mt-3" />
            </div>
        </motion.div>
    );
}

function EmptyState() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center px-4 py-16 text-center sm:px-8 sm:py-20"
        >
            <div className="w-24 h-24 border border-zinc-200 bg-white rounded-lg shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] flex items-center justify-center mb-6">
                <Bell className="w-12 h-12 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-950 mb-2">
                Sin notificaciones
            </h3>
            <p className="text-zinc-600 max-w-sm">
                Cuando recibas notificaciones sobre postulaciones, ofertas o mensajes, apareceran aqui.
            </p>
        </motion.div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export default function NotificationsPage() {
    const router = useRouter();

    const notifications = useNotificationStore((state) => state.notifications);
    const isLoading = useNotificationStore((state) => state.isLoading);
    const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
    const markAsRead = useNotificationStore((state) => state.markAsRead);
    const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

    const [filter, setFilter] = React.useState<NotificationFilter>('all');

    // Fetch on mount
    React.useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const filterOptions = React.useMemo(() => {
        const options: Array<{ value: NotificationFilter; label: string; count: number }> = [
            { value: 'all', label: 'Todas', count: notifications.length },
            { value: 'trips', label: 'Viajes', count: notifications.filter((n) => getNotificationCategory(n.type) === 'trips').length },
            { value: 'payments', label: 'Pagos', count: notifications.filter((n) => getNotificationCategory(n.type) === 'payments').length },
            { value: 'team', label: 'Equipo', count: notifications.filter((n) => getNotificationCategory(n.type) === 'team').length },
            { value: 'system', label: 'Sistema', count: notifications.filter((n) => getNotificationCategory(n.type) === 'system').length },
        ];

        return options;
    }, [notifications]);

    // Filter notifications
    const filteredNotifications = React.useMemo(() => {
        if (filter === 'all') {
            return notifications;
        }
        return notifications.filter((notification) => getNotificationCategory(notification.type) === filter);
    }, [notifications, filter]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Handle notification click
    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            await markAsRead(notification.id);
        }

        // Navigate based on type
        const { data } = notification;
        switch (notification.type) {
            case 'application_received':
                router.push('/postulaciones-recibidas');
                break;
            case 'private_fleet_assignment':
            case 'private_fleet_assignment_rejected':
                router.push('/viajes-asignados');
                break;
            case 'application_accepted':
            case 'application_rejected':
                router.push('/postulaciones');
                break;
            // Inspection notifications - navigate to inspection report
            case 'inspection_loading_completed':
            case 'inspection_delivery_completed':
            case 'inspection_issue_reported':
            case 'trip_completed':
                if (data?.offer_id) {
                    router.push(`/inspecciones/${data.offer_id}`);
                } else {
                    router.push('/inspecciones');
                }
                break;
            case 'trip_started':
                if (data?.offer_id) {
                    router.push(`/ofertas/mis-ofertas`);
                }
                break;
            default:
                // Stay on page
                break;
        }
    };

    return (
        <DashboardLayout pageTitle="Notificaciones">
            <div className="mx-auto w-full max-w-3xl">
                {/* Header */}
                <div className="bg-white rounded-t-lg border border-zinc-200 border-b-0 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="w-10 h-10 border border-zinc-200 bg-white rounded-lg flex items-center justify-center">
                                <Bell className="w-5 h-5 text-zinc-950" />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-zinc-950">Notificaciones</h1>
                                <p className="text-sm text-zinc-500">
                                    {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leidas'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={markAllAsRead}
                                >
                                    <CheckCheck className="w-4 h-4 mr-1" />
                                    Marcar todas
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchNotifications}
                                disabled={isLoading}
                            >
                                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                            </Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-4">
                        <Tabs value={filter} onValueChange={(value) => setFilter(value as NotificationFilter)}>
                            <TabsList className="w-full justify-start overflow-x-auto">
                                {filterOptions.map((option) => (
                                    <TabsTrigger key={option.value} value={option.value}>
                                        {option.label}
                                        <Badge variant="default" size="xs" className="ml-1.5">{option.count}</Badge>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="bg-white rounded-b-lg border border-zinc-200 overflow-hidden">
                    {isLoading ? (
                        <div>
                            {[...Array(5)].map((_, i) => <NotificationSkeleton key={i} />)}
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredNotifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkAsRead={markAsRead}
                                    onClick={handleNotificationClick}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
