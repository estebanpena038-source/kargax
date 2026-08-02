// =============================================================================
// KARGAX - Channel Header Component
// Enterprise-Grade Contextual Header for Channels
// =============================================================================
//
// FEATURES:
// - Channel type icon and title
// - Entity status badge
// - Participant avatars stack
// - Actions: info, mute, archive
// - Mobile back button
//
// =============================================================================

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Truck,
    Package,
    Users,
    Factory,
    LifeBuoy,
    BellOff,
    Archive,
    Info,
    Hash
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { PresenceIndicator } from './PresenceIndicator';
import type { ChannelConversation, ChannelType, ConversationParticipant } from '../types';

export interface ChannelHeaderProps {
    conversation: ChannelConversation;
    onBack?: () => void;
    onToggleInfo?: () => void;
    onMute?: () => void;
    onArchive?: () => void;
    isMobile?: boolean;
}

const getChannelIcon = (type: ChannelType) => {
    switch (type) {
        case 'trip': return <Truck className="w-5 h-5" />;
        case 'offer': return <Package className="w-5 h-5" />;
        case 'fleet': return <Users className="w-5 h-5" />;
        case 'dispatch': return <Factory className="w-5 h-5" />;
        case 'support': return <LifeBuoy className="w-5 h-5" />;
        case 'system': return <BellOff className="w-5 h-5" />;
        default: return <Hash className="w-5 h-5" />;
    }
};

const getStatusColor = (status?: string) => {
    if (!status) return 'bg-zinc-100 text-zinc-600';
    const s = status.toLowerCase();
    if (s.includes('activ') || s.includes('curso')) return 'bg-green-100 text-green-700';
    if (s.includes('complet')) return 'bg-zinc-900 text-white';
    if (s.includes('cancel')) return 'bg-red-100 text-red-700';
    if (s.includes('pendient')) return 'bg-amber-100 text-amber-700';
    return 'bg-zinc-100 text-zinc-600';
};

export function ChannelHeader({
    conversation,
    onBack,
    onToggleInfo,
    onMute,
    onArchive,
    isMobile = false
}: ChannelHeaderProps) {
    const participants = conversation.participants || [];
    const visibleParticipants = participants.slice(0, 3);
    const extraParticipants = participants.length - 3;
    const isDirect = conversation.channelType === 'direct';

    return (
        <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 sm:px-6 sm:py-4 shadow-sm z-10"
        >
            <div className="flex items-center gap-3 min-w-0">
                {isMobile && onBack && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-2">
                        <ArrowLeft className="w-5 h-5 text-zinc-600" />
                    </Button>
                )}

                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 shrink-0 text-zinc-900">
                    {getChannelIcon(conversation.channelType)}
                </div>

                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-semibold text-zinc-900 truncate">
                            {conversation.title || 'Canal sin título'}
                        </h2>
                        {conversation.cargoContext?.status && (
                            <span className={cn(
                                'text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                                getStatusColor(conversation.cargoContext.status)
                            )}>
                                {conversation.cargoContext.status}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        {isDirect ? (
                            <PresenceIndicator status="online" showText />
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{participants.length} participantes</span>
                                <span className="text-zinc-300">•</span>
                                <div className="flex -space-x-1.5">
                                    {visibleParticipants.map((p, i) => (
                                        <div key={p.id} className="w-4 h-4 rounded-full bg-zinc-200 border border-white flex items-center justify-center overflow-hidden z-[3] relative" style={{ zIndex: 3 - i }}>
                                            {p.userAvatar ? (
                                                <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-[8px] font-bold text-zinc-600">{(p.userName || 'U')[0]}</span>
                                            )}
                                        </div>
                                    ))}
                                    {extraParticipants > 0 && (
                                        <div className="w-4 h-4 rounded-full bg-zinc-100 border border-white flex items-center justify-center z-0 relative">
                                            <span className="text-[8px] font-bold text-zinc-600">+{extraParticipants}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-4">
                <Button variant="ghost" size="icon" onClick={onMute} aria-label="Silenciar canal">
                    <BellOff className="w-5 h-5 text-zinc-500" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onArchive} aria-label="Archivar canal">
                    <Archive className="w-5 h-5 text-zinc-500" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onToggleInfo} aria-label="Información del canal">
                    <Info className="w-5 h-5 text-zinc-900" />
                </Button>
            </div>
        </motion.div>
    );
}

export default ChannelHeader;
