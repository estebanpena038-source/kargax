// =============================================================================
// KARGAX - SUPABASE NOTIFICATIONS SERVICE
// Enterprise-grade notification management
// =============================================================================

import { supabase } from './client';

// =============================================================================
// Types
// =============================================================================

export type NotificationType =
    | 'application_received'
    | 'application_accepted'
    | 'application_rejected'
    | 'offer_published'
    | 'offer_expired'
    | 'new_message'
    | 'private_fleet_assignment'
    | 'private_fleet_assignment_rejected';

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    data: {
        offer_id?: string;
        application_id?: string;
        trucker_id?: string;
        status?: string;
    };
    read: boolean;
    created_at: string;
    updated_at: string;
}

interface NotificationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// =============================================================================
// Notifications Service
// =============================================================================

export const supabaseNotifications = {
    // =========================================================================
    // GET ALL NOTIFICATIONS
    // =========================================================================
    async getAll(params?: {
        limit?: number;
        unreadOnly?: boolean
    }): Promise<NotificationResult<Notification[]>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            let query = (supabase.from('notifications' as any) as any)
                .select('*')
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (params?.unreadOnly) {
                query = query.eq('read', false);
            }

            if (params?.limit) {
                query = query.limit(params.limit);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[Notifications] GetAll error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: data as Notification[] };
        } catch (err) {
            console.error('[Notifications] GetAll exception:', err);
            return { success: false, error: 'Error al obtener notificaciones' };
        }
    },

    // =========================================================================
    // GET UNREAD COUNT
    // =========================================================================
    async getUnreadCount(): Promise<NotificationResult<number>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            const { count, error } = await (supabase.from('notifications' as any) as any)
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userData.user.id)
                .eq('read', false);

            if (error) {
                console.error('[Notifications] GetUnreadCount error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: count || 0 };
        } catch (err) {
            console.error('[Notifications] GetUnreadCount exception:', err);
            return { success: false, error: 'Error al contar notificaciones' };
        }
    },

    // =========================================================================
    // MARK AS READ
    // =========================================================================
    async markAsRead(notificationId: string): Promise<NotificationResult<{ updated: boolean }>> {
        try {
            const { error } = await (supabase.from('notifications' as any) as any)
                .update({ read: true, updated_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (error) {
                console.error('[Notifications] MarkAsRead error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { updated: true } };
        } catch (err) {
            console.error('[Notifications] MarkAsRead exception:', err);
            return { success: false, error: 'Error al marcar como leída' };
        }
    },

    // =========================================================================
    // MARK ALL AS READ
    // =========================================================================
    async markAllAsRead(): Promise<NotificationResult<{ updated: boolean }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            const { error } = await (supabase.from('notifications' as any) as any)
                .update({ read: true, updated_at: new Date().toISOString() })
                .eq('user_id', userData.user.id)
                .eq('read', false);

            if (error) {
                console.error('[Notifications] MarkAllAsRead error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { updated: true } };
        } catch (err) {
            console.error('[Notifications] MarkAllAsRead exception:', err);
            return { success: false, error: 'Error al marcar todas como leídas' };
        }
    },

    // =========================================================================
    // SUBSCRIBE TO REALTIME NOTIFICATIONS
    // =========================================================================
    subscribeToNotifications(
        userId: string,
        onNotification: (notification: Notification) => void
    ) {
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    console.log('[Notifications] New notification:', payload);
                    onNotification(payload.new as Notification);
                }
            )
            .subscribe();

        return channel;
    },

    // =========================================================================
    // UNSUBSCRIBE
    // =========================================================================
    unsubscribe(channel: ReturnType<typeof supabase.channel>) {
        supabase.removeChannel(channel);
    },
};

export default supabaseNotifications;
