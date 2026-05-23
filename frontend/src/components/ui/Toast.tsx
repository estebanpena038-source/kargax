// =============================================================================
// KargaX - Toast Notification System
// Premium notifications with auto-dismiss and stacking
// =============================================================================

'use client';

import * as React from 'react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import {
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Info,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastState {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    clearAll: () => void;
}

// =============================================================================
// Toast Store
// =============================================================================
export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    addToast: (toast) => {
        const id = crypto.randomUUID();
        set((state) => ({
            toasts: [...state.toasts.slice(-4), { ...toast, id }], // Max 5 toasts
        }));

        // Auto remove after duration
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id),
                }));
            }, duration);
        }
    },

    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },

    clearAll: () => set({ toasts: [] }),
}));

// =============================================================================
// Toast Helper Functions
// =============================================================================
export const toast = {
    success: (title: string, message?: string) => {
        useToastStore.getState().addToast({ type: 'success', title, message });
    },
    error: (title: string, message?: string) => {
        useToastStore.getState().addToast({ type: 'error', title, message, duration: 7000 });
    },
    warning: (title: string, message?: string) => {
        useToastStore.getState().addToast({ type: 'warning', title, message });
    },
    info: (title: string, message?: string) => {
        useToastStore.getState().addToast({ type: 'info', title, message });
    },
    custom: (toast: Omit<Toast, 'id'>) => {
        useToastStore.getState().addToast(toast);
    },
};

// =============================================================================
// Toast Icon Map
// =============================================================================
const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    info: <Info className="h-5 w-5 text-slate-500" />,
};

const bgColors: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-white border-zinc-200',
};

// =============================================================================
// Toast Item Component
// =============================================================================
function ToastItem({ toast: t }: { toast: Toast }) {
    const { removeToast } = useToastStore();

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
                'pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-[0_24px_60px_-42px_rgba(0,0,0,.75)]',
                bgColors[t.type]
            )}
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="shrink-0 mt-0.5">{icons[t.type]}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-950">{t.title}</p>
                        {t.message && (
                            <p className="mt-1 text-sm text-zinc-600">{t.message}</p>
                        )}
                        {t.action && (
                            <button
                                onClick={t.action.onClick}
                                className="mt-2 text-sm font-medium text-zinc-950 hover:underline"
                            >
                                {t.action.label}
                            </button>
                        )}
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => removeToast(t.id)}
                        className="shrink-0 text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// =============================================================================
// Toast Container Component
// =============================================================================
export function ToastContainer() {
    const { toasts } = useToastStore();

    return (
        <div
            aria-live="polite"
            aria-label="Notificaciones"
            className="pointer-events-none fixed bottom-0 right-0 z-50 flex flex-col items-end gap-3 p-4 sm:p-6"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((t) => (
                    <ToastItem key={t.id} toast={t} />
                ))}
            </AnimatePresence>
        </div>
    );
}
