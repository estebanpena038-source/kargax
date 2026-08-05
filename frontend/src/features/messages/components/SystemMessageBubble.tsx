// =============================================================================
// KARGAX - System Message Bubble Component
// Enterprise-Grade System Event Notifications
// =============================================================================

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { SystemEventData } from '../types';

export interface SystemMessageBubbleProps {
    content: string;
    timestamp: string;
    eventData?: SystemEventData;
    variant?: 'system' | 'status_update' | 'evidence' | 'pin_verification';
}

const variantStyles = {
    system: 'bg-white text-zinc-950 border-zinc-200/90 dark:bg-zinc-900 dark:text-zinc-50 dark:border-zinc-800',
    status_update: 'bg-white text-zinc-950 border-zinc-200/90 dark:bg-zinc-900 dark:text-zinc-50 dark:border-zinc-800',
    evidence: 'bg-white text-zinc-950 border-zinc-200/90 dark:bg-zinc-900 dark:text-zinc-50 dark:border-zinc-800',
    pin_verification: 'bg-white text-zinc-950 border-zinc-200/90 dark:bg-zinc-900 dark:text-zinc-50 dark:border-zinc-800'
};

export function SystemMessageBubble({
    content,
    timestamp,
    eventData,
    variant = 'system'
}: SystemMessageBubbleProps) {
    const formattedTime = new Date(timestamp).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center my-6"
        >
            <div className={cn(
                'flex flex-col items-center max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl border backdrop-blur-sm shadow-sm',
                variantStyles[variant]
            )}>
                <div className="flex items-center gap-2 text-sm font-medium text-center">
                    {eventData?.icon && <span>{eventData.icon}</span>}
                    <span>{content}</span>
                </div>
                
                {eventData?.actionUrl && eventData?.actionLabel && (
                    <a
                        href={eventData.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
                    >
                        {eventData.actionLabel}
                    </a>
                )}
            </div>
            
            <span className="mt-1.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                {formattedTime}
            </span>
        </motion.div>
    );
}

export default SystemMessageBubble;
