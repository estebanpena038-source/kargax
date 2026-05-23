// =============================================================================
// KARGAX - NOTIFICATION STORE (Global State)
// Enterprise-grade notification management with Zustand
// Real-time updates via Supabase Realtime
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';
import type { Notification } from '@/lib/supabase/notifications';

// =============================================================================
// Types
// =============================================================================

interface NotificationCounts {
    total: number;
    applications: number;      // For businesses: pending applications
    applicationUpdates: number; // For truckers: status changes
    acceptedJobs: number;       // For truckers: new accepted jobs
    messages: number;           // Unread messages
    inspections: number;        // For businesses: inspection updates
}

interface NotificationState {
    // Data
    notifications: Notification[];
    counts: NotificationCounts;
    isLoading: boolean;
    isInitialized: boolean;
    currentUserId: string | null;

    // Subscription
    channel: ReturnType<typeof supabase.channel> | null;

    // Actions
    initialize: (userId: string) => Promise<void>;
    fetchNotifications: () => Promise<void>;
    fetchCounts: () => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    addNotification: (notification: Notification) => void;
    cleanup: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialCounts: NotificationCounts = {
    total: 0,
    applications: 0,
    applicationUpdates: 0,
    acceptedJobs: 0,
    messages: 0,
    inspections: 0,
};

const isDebugLoggingEnabled = process.env.NODE_ENV !== 'production';

function debugLog(...args: unknown[]) {
    if (isDebugLoggingEnabled) {
        console.log(...args);
    }
}

// Reconnection backoff state (module-level to persist across store calls)
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 2000;

// =============================================================================
// Store Implementation
// =============================================================================

export const useNotificationStore = create<NotificationState>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        notifications: [],
        counts: initialCounts,
        isLoading: false,
        isInitialized: false,
        currentUserId: null,
        channel: null,

        // =====================================================================
        // INITIALIZE: Setup realtime subscription
        // =====================================================================
        initialize: async (userId: string) => {
            const current = get();
            if (current.isInitialized && current.currentUserId === userId) return;

            if (current.channel) {
                supabase.removeChannel(current.channel);
                set({ channel: null, isInitialized: false, currentUserId: null });
            }

            debugLog('[NotificationStore] Initializing for user:', userId);

            // Fetch initial data
            await get().fetchNotifications();
            await get().fetchCounts();

            // Setup realtime subscription
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
                        debugLog('[NotificationStore] New notification:', payload);
                        get().addNotification(payload.new as Notification);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${userId}`,
                    },
                    () => {
                        // Refetch counts when notification is updated (marked as read)
                        get().fetchCounts();
                    }
                )
                .subscribe((status) => {
                    debugLog('[NotificationStore] Subscription status:', status);

                    if (status === 'SUBSCRIBED') {
                        // Reset backoff on successful subscription
                        reconnectAttempts = 0;
                        if (reconnectTimeout) {
                            clearTimeout(reconnectTimeout);
                            reconnectTimeout = null;
                        }
                    }

                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                            console.warn(
                                `[NotificationStore] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`
                            );
                            return;
                        }

                        reconnectAttempts++;
                        const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1);
                        console.warn(
                            `[NotificationStore] Channel ${status}. Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
                        );

                        if (reconnectTimeout) {
                            clearTimeout(reconnectTimeout);
                        }

                        reconnectTimeout = setTimeout(() => {
                            reconnectTimeout = null;
                            const current = get();
                            if (current.channel) {
                                supabase.removeChannel(current.channel);
                            }
                            set({ channel: null, isInitialized: false });
                            // Re-initialize with same userId
                            if (current.currentUserId) {
                                void get().initialize(current.currentUserId);
                            }
                        }, delay);
                    }
                });

            set({ channel, isInitialized: true, currentUserId: userId });
        },

        // =====================================================================
        // FETCH NOTIFICATIONS
        // =====================================================================
        fetchNotifications: async () => {
            set({ isLoading: true });

            try {
                const { data: userData } = await supabase.auth.getUser();
                if (!userData?.user) {
                    set({ isLoading: false });
                    return;
                }

                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', userData.user.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (error) {
                    console.error('[NotificationStore] Fetch error:', error);
                    set({ isLoading: false });
                    return;
                }

                set({ notifications: data as Notification[], isLoading: false });
            } catch (err) {
                console.error('[NotificationStore] Fetch exception:', err);
                set({ isLoading: false });
            }
        },

        // =====================================================================
        // FETCH COUNTS (For sidebar badges)
        // =====================================================================
        fetchCounts: async () => {
            try {
                const { data: userData } = await supabase.auth.getUser();
                if (!userData?.user) return;

                const userId = userData.user.id;

                // Total unread
                const { count: totalUnread } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('read', false);

                // Applications received (for businesses)
                const { count: applications } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('type', 'application_received')
                    .eq('read', false);

                // Application status updates (for truckers)
                const { count: applicationUpdates } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .in('type', ['application_accepted', 'application_rejected'])
                    .eq('read', false);

                // Accepted jobs (for truckers)
                const { count: acceptedJobs } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('type', 'application_accepted')
                    .eq('read', false);

                // Messages (placeholder for future)
                const messages = 0;

                // Inspection notifications (for businesses)
                const { count: inspections } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .in('type', [
                        'inspection_loading_completed',
                        'inspection_delivery_completed',
                        'inspection_issue_reported',
                        'trip_started',
                        'trip_completed'
                    ])
                    .eq('read', false);

                set({
                    counts: {
                        total: totalUnread || 0,
                        applications: applications || 0,
                        applicationUpdates: applicationUpdates || 0,
                        acceptedJobs: acceptedJobs || 0,
                        messages,
                        inspections: inspections || 0,
                    },
                });

                debugLog('[NotificationStore] Counts updated:', get().counts);
            } catch (err) {
                console.error('[NotificationStore] Count fetch error:', err);
            }
        },

        // =====================================================================
        // MARK AS READ
        // =====================================================================
        markAsRead: async (notificationId: string) => {
            try {
                const { error } = await (supabase
                    .from('notifications' as any) as any)
                    .update({ read: true, updated_at: new Date().toISOString() })
                    .eq('id', notificationId);

                if (error) {
                    console.error('[NotificationStore] MarkAsRead error:', error);
                    return;
                }

                // Update local state
                set((state) => ({
                    notifications: state.notifications.map((n) =>
                        n.id === notificationId ? { ...n, read: true } : n
                    ),
                }));

                // Refetch counts
                await get().fetchCounts();
            } catch (err) {
                console.error('[NotificationStore] MarkAsRead exception:', err);
            }
        },

        // =====================================================================
        // MARK ALL AS READ
        // =====================================================================
        markAllAsRead: async () => {
            try {
                const { data: userData } = await supabase.auth.getUser();
                if (!userData?.user) return;

                const { error } = await (supabase
                    .from('notifications' as any) as any)
                    .update({ read: true, updated_at: new Date().toISOString() })
                    .eq('user_id', userData.user.id)
                    .eq('read', false);

                if (error) {
                    console.error('[NotificationStore] MarkAllAsRead error:', error);
                    return;
                }

                // Update local state
                set((state) => ({
                    notifications: state.notifications.map((n) => ({ ...n, read: true })),
                    counts: initialCounts,
                }));
            } catch (err) {
                console.error('[NotificationStore] MarkAllAsRead exception:', err);
            }
        },

        // =====================================================================
        // ADD NOTIFICATION (From realtime)
        // =====================================================================
        addNotification: (notification: Notification) => {
            set((state) => ({
                notifications: [notification, ...state.notifications.slice(0, 19)],
            }));

            // Refetch counts
            get().fetchCounts();
        },

        // =====================================================================
        // CLEANUP
        // =====================================================================
        cleanup: () => {
            const { channel } = get();
            if (channel) {
                supabase.removeChannel(channel);
            }
            set({
                notifications: [],
                counts: initialCounts,
                isInitialized: false,
                currentUserId: null,
                channel: null,
            });
        },
    }))
);

// =============================================================================
// SELECTORS (For optimized re-renders)
// =============================================================================

export const selectUnreadCount = (state: NotificationState) => state.counts.total;
export const selectApplicationsCount = (state: NotificationState) => state.counts.applications;
export const selectApplicationUpdatesCount = (state: NotificationState) => state.counts.applicationUpdates;
export const selectAcceptedJobsCount = (state: NotificationState) => state.counts.acceptedJobs;
export const selectMessagesCount = (state: NotificationState) => state.counts.messages;
export const selectInspectionsCount = (state: NotificationState) => state.counts.inspections;

export default useNotificationStore;
