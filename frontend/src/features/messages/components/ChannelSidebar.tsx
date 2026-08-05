// =============================================================================
// KARGAX - Channel Sidebar Component
// Enterprise-Grade Info Panel
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, FileText, Settings, Archive, LogOut, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { PresenceIndicator } from './PresenceIndicator';
import type { ChannelConversation, ConversationParticipant, UserPresence } from '../types';

export interface ChannelSidebarProps {
    conversation: ChannelConversation;
    participants: ConversationParticipant[];
    presenceMap: Map<string, UserPresence>;
    isOpen: boolean;
    onClose: () => void;
}

export function ChannelSidebar({
    conversation,
    participants,
    presenceMap,
    isOpen,
    onClose
}: ChannelSidebarProps) {
    
    // Translating roles
    const roleLabels: Record<string, string> = {
        owner: 'Propietario',
        admin: 'Admin',
        member: 'Miembro',
        observer: 'Observador',
        guest: 'Invitado'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Mobile overlay */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
                    />
                    
                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: '100%', opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0.5 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={cn(
                            "fixed inset-y-0 right-0 z-50 w-full max-w-[320px] bg-white border-l border-zinc-200 shadow-xl lg:relative lg:z-auto lg:shadow-none flex flex-col h-full overflow-hidden"
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                            <h3 className="font-bold text-sm text-zinc-950 dark:text-zinc-50">Info. del canal</h3>
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                            </Button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white dark:bg-zinc-950">
                            
                            {/* Entity Link */}
                            {conversation.entityId && (
                                <div>
                                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Entidad Vinculada</h4>
                                    <div className="p-3 bg-white rounded-xl border border-zinc-200 flex items-center justify-between shadow-xs dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50">{conversation.entityType === 'offer' ? 'Oferta' : 'Viaje'} #{conversation.entityId.slice(0,6)}</span>
                                            <span className="text-[11px] text-zinc-500">Ver detalles operacionales</span>
                                        </div>
                                        <Button size="sm" variant="outline">Ver</Button>
                                    </div>
                                </div>
                            )}

                            {/* Participants */}
                            <div>
                                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                    Participantes ({participants.length})
                                </h4>
                                <div className="space-y-3">
                                    {participants.map(p => {
                                        const presence = presenceMap.get(p.userId);
                                        return (
                                            <div key={p.id} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shrink-0 overflow-hidden flex items-center justify-center relative font-bold text-xs">
                                                        {p.userAvatar ? (
                                                            <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span>{(p.userName || 'U')[0]}</span>
                                                        )}
                                                        {presence && (
                                                            <div className="absolute -bottom-0.5 -right-0.5 border border-white rounded-full bg-white dark:border-zinc-950">
                                                                <PresenceIndicator status={presence.status} size="sm" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 truncate">
                                                            {p.userName || 'Usuario desconocido'}
                                                        </span>
                                                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{roleLabels[p.role] || p.role}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Media & Files Tabs Placeholder */}
                            <div>
                                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Archivos Compartidos</h4>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-zinc-200 hover:border-zinc-950 transition-colors shadow-xs dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-400">
                                        <ImageIcon className="w-5 h-5 text-zinc-950 dark:text-zinc-100 mb-1" />
                                        <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50">Fotos (12)</span>
                                    </button>
                                    <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-zinc-200 hover:border-zinc-950 transition-colors shadow-xs dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-400">
                                        <FileText className="w-5 h-5 text-zinc-950 dark:text-zinc-100 mb-1" />
                                        <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50">Docs (4)</span>
                                    </button>
                                </div>
                            </div>

                        </div>

                        {/* Actions Bottom */}
                        <div className="p-4 border-t border-zinc-200 bg-zinc-50 space-y-2">
                            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200/50 rounded-lg transition-colors">
                                <BellOff className="w-4 h-4" />
                                Silenciar notificaciones
                            </button>
                            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200/50 rounded-lg transition-colors">
                                <Archive className="w-4 h-4" />
                                Archivar canal
                            </button>
                            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <LogOut className="w-4 h-4" />
                                Salir del canal
                            </button>
                        </div>

                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default ChannelSidebar;
