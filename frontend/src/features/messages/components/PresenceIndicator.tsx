// =============================================================================
// KARGAX - Presence Indicator Component
// Enterprise-Grade Online Status & Typing Indicator
// =============================================================================
//
// FEATURES:
// - Status dot (online, away, offline)
// - Size variants
// - Pulse animation for online state
// - Typing indicator with animated dots
// - Last seen formatting
//
// =============================================================================

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { PresenceStatus } from '../types';

export interface PresenceIndicatorProps {
    status: PresenceStatus;
    lastSeenAt?: string;
    isTyping?: boolean;
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
}

const statusColors = {
    online: 'bg-green-500',
    away: 'bg-amber-500',
    offline: 'bg-zinc-300'
};

const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
};

function formatLastSeen(dateString?: string): string {
    if (!dateString) return 'Desconocido';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function PresenceIndicator({ 
    status, 
    lastSeenAt, 
    isTyping = false, 
    size = 'sm', 
    showText = false 
}: PresenceIndicatorProps) {
    
    if (isTyping) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-zinc-100 rounded-full px-2 py-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.15,
                            }}
                        />
                    ))}
                </div>
                {showText && <span className="text-xs text-zinc-500 font-medium">Escribiendo...</span>}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
                <div className={cn(
                    'rounded-full', 
                    sizeClasses[size], 
                    statusColors[status]
                )} />
                
                {status === 'online' && (
                    <motion.div
                        className={cn(
                            'absolute inset-0 rounded-full', 
                            statusColors[status]
                        )}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                )}
            </div>
            
            {showText && (
                <span className="text-xs text-zinc-500 font-medium">
                    {status === 'online' ? 'En línea' : `Última vez: ${formatLastSeen(lastSeenAt)}`}
                </span>
            )}
        </div>
    );
}

export default PresenceIndicator;
