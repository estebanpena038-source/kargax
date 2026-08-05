// =============================================================================
// KARGAX - Slack-Style Logistics Messaging Sidebar (Apple / Steve Jobs Aesthetic)
// Pure Lucide Icons - Zero Emojis - Extreme Minimalist Luxury Architecture
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hash,
    Truck,
    MessageSquare,
    Archive,
    Bell,
    ChevronDown,
    ChevronRight,
    Copy,
    Check,
    Plus,
    Search,
    Building2,
    Shield,
    Users,
    Sparkles,
    Circle,
    ArrowUpRight,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from '@/components/ui';
import type { Conversation, ChannelType } from '../types';
import { fetchOrganizationInfo } from '../api/messagesApi';

interface SlackSidebarProps {
    conversations: Conversation[];
    activeConversationId: string | null;
    onConversationSelect: (conversationId: string) => void;
    isLoading?: boolean;
    onNewConversation: () => void;
    onOpenJoinOrgModal: () => void;
    isMobile?: boolean;
}

export function SlackSidebar({
    conversations,
    activeConversationId,
    onConversationSelect,
    isLoading = false,
    onNewConversation,
    onOpenJoinOrgModal,
    isMobile = false,
}: SlackSidebarProps) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [copiedCode, setCopiedCode] = React.useState(false);
    const [orgInfo, setOrgInfo] = React.useState<{
        businessId: string | null;
        companyName: string;
        inviteCode: string;
        isOwner: boolean;
    }>({
        businessId: null,
        companyName: 'KargaX Flota & Logística',
        inviteCode: 'KX-KARGAX-2026',
        isOwner: false,
    });

    // Collapsible section state
    const [sectionsOpen, setSectionsOpen] = React.useState({
        channels: true,
        trips: true,
        directs: true,
        archived: false,
    });

    const toggleSection = (section: keyof typeof sectionsOpen) => {
        setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Fetch org details on mount
    React.useEffect(() => {
        let isMounted = true;
        fetchOrganizationInfo().then((info) => {
            if (isMounted && info) {
                setOrgInfo({
                    businessId: info.businessId,
                    companyName: info.companyName || 'KargaX Logística',
                    inviteCode: info.inviteCode || 'KX-KARGAX-2026',
                    isOwner: info.isOwner,
                });
            }
        }).catch(console.error);
        return () => {
            isMounted = false;
        };
    }, []);

    const handleCopyCode = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(orgInfo.inviteCode);
            setCopiedCode(true);
            toast.success('Código copiado', `Código ${orgInfo.inviteCode} copiado al portapapeles`);
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    // Filter conversations by search term
    const filteredConvs = React.useMemo(() => {
        if (!searchTerm.trim()) return conversations;
        const q = searchTerm.toLowerCase();
        return conversations.filter(
            (c) =>
                (c.title && c.title.toLowerCase().includes(q)) ||
                (c.otherParticipantName && c.otherParticipantName.toLowerCase().includes(q)) ||
                (c.lastMessagePreview && c.lastMessagePreview.toLowerCase().includes(q))
        );
    }, [conversations, searchTerm]);

    // Categorize into Slack-style groups
    const { defaultChannels, tripChannels, directMessages, archivedChannels } = React.useMemo(() => {
        const defaults: Conversation[] = [];
        const trips: Conversation[] = [];
        const directs: Conversation[] = [];
        const archived: Conversation[] = [];

        filteredConvs.forEach((conv) => {
            if (conv.isArchived) {
                archived.push(conv);
                return;
            }

            const title = (conv.title || '').toLowerCase();
            const type = conv.channelType;

            if (type === 'trip' || conv.entityType === 'trip' || title.startsWith('#viaje-') || conv.offerId) {
                trips.push(conv);
            } else if (
                type === 'fleet' ||
                type === 'system' ||
                type === 'support' ||
                title.startsWith('#')
            ) {
                defaults.push(conv);
            } else {
                directs.push(conv);
            }
        });

        // Ensure minimum standard channels appear if list is empty
        if (defaults.length === 0 && !searchTerm) {
            defaults.push(
                {
                    id: 'default-general',
                    title: '#general',
                    otherParticipantName: '#general',
                    channelType: 'fleet',
                    unreadCount: 0,
                    createdAt: new Date().toISOString(),
                    lastMessagePreview: 'Canal general de la organización',
                    lastMessageAt: null,
                    offerId: null,
                },
                {
                    id: 'default-novedades',
                    title: '#novedades-flota',
                    otherParticipantName: '#novedades-flota',
                    channelType: 'fleet',
                    unreadCount: 0,
                    createdAt: new Date().toISOString(),
                    lastMessagePreview: 'Reportes y estado de vehículos',
                    lastMessageAt: null,
                    offerId: null,
                },
                {
                    id: 'default-alertas',
                    title: '#alertas',
                    otherParticipantName: '#alertas',
                    channelType: 'system',
                    unreadCount: 0,
                    createdAt: new Date().toISOString(),
                    lastMessagePreview: 'Alertas y notificaciones operativas',
                    lastMessageAt: null,
                    offerId: null,
                }
            );
        }

        return { defaultChannels: defaults, tripChannels: trips, directMessages: directs, archivedChannels: archived };
    }, [filteredConvs, searchTerm]);

    const getChannelIcon = (conv: Conversation) => {
        const title = (conv.title || '').toLowerCase();
        if (conv.channelType === 'system' || title === '#alertas') {
            return <Bell className="h-4 w-4 text-red-500 flex-shrink-0" />;
        }
        if (conv.channelType === 'trip' || conv.entityType === 'trip' || title.startsWith('#viaje-')) {
            return <Truck className="h-4 w-4 text-amber-500 flex-shrink-0" />;
        }
        if (conv.channelType === 'direct') {
            return <MessageSquare className="h-4 w-4 text-zinc-400 flex-shrink-0" />;
        }
        return <Hash className="h-4 w-4 text-zinc-400 flex-shrink-0" />;
    };

    return (
        <div className="flex h-full flex-col bg-zinc-50/50 dark:bg-zinc-950/80 select-none">
            {/* 1. ORGANIZATION HEADER (Steve Jobs / Apple Luxury Aesthetic) */}
            <div className="border-b border-zinc-200/80 p-3.5 dark:border-zinc-800/80">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm flex-shrink-0 font-bold text-xs tracking-tight">
                            {orgInfo.companyName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 truncate tracking-tight">
                                {orgInfo.companyName}
                            </h2>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                    Flota Conectada
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onOpenJoinOrgModal}
                        title="Unirse a otra empresa o cambiar código"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                {/* Organization Invite Code Card */}
                <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-200/90 bg-white p-2.5 shadow-sm dark:border-zinc-800/90 dark:bg-zinc-900/90">
                    <div className="min-w-0">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                            Código de Invitación
                        </div>
                        <div className="text-xs font-mono font-bold tracking-wider text-zinc-900 dark:text-zinc-50">
                            {orgInfo.inviteCode}
                        </div>
                    </div>

                    <button
                        onClick={handleCopyCode}
                        className={cn(
                            'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-all',
                            copiedCode
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                        )}
                    >
                        {copiedCode ? (
                            <>
                                <Check className="h-3 w-3" />
                                <span>Copiado</span>
                            </>
                        ) : (
                            <>
                                <Copy className="h-3 w-3" />
                                <span>Copiar</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 2. SEARCH BAR */}
            <div className="p-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar canales, viajes o DMs..."
                        className="w-full rounded-xl border border-zinc-200/80 bg-white pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 transition-all dark:border-zinc-800/80 dark:bg-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                </div>
            </div>

            {/* 3. SECTIONS ACCORDION (Canales, Viajes Activos, Mensajes Directos, Archivados) */}
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 custom-scrollbar">
                {isLoading ? (
                    <div className="space-y-2 p-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-8 rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* SECTION 1: CANALES (#) */}
                        <div>
                            <div
                                onClick={() => toggleSection('channels')}
                                className="group flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-1.5">
                                    {sectionsOpen.channels ? (
                                        <ChevronDown className="h-3 w-3 text-zinc-400 transition-transform" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3 text-zinc-400 transition-transform" />
                                    )}
                                    <span>Canales ({defaultChannels.length})</span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNewConversation();
                                    }}
                                    title="Nuevo canal"
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-opacity"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>

                            {sectionsOpen.channels && (
                                <div className="mt-1 space-y-0.5">
                                    {defaultChannels.map((conv) => {
                                        const isActive = activeConversationId === conv.id;
                                        return (
                                            <button
                                                key={conv.id}
                                                onClick={() => onConversationSelect(conv.id)}
                                                className={cn(
                                                    'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left group',
                                                    isActive
                                                        ? 'bg-zinc-900 text-white font-medium shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                                                        : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50'
                                                )}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {getChannelIcon(conv)}
                                                    <span className="truncate font-medium">
                                                        {conv.title || conv.otherParticipantName}
                                                    </span>
                                                </div>

                                                {conv.unreadCount > 0 && (
                                                    <span
                                                        className={cn(
                                                            'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold',
                                                            isActive
                                                                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white'
                                                                : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                                        )}
                                                    >
                                                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* SECTION 2: VIAJES ACTIVOS (🚛) */}
                        <div>
                            <div
                                onClick={() => toggleSection('trips')}
                                className="group flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-1.5">
                                    {sectionsOpen.trips ? (
                                        <ChevronDown className="h-3 w-3 text-zinc-400 transition-transform" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3 text-zinc-400 transition-transform" />
                                    )}
                                    <div className="flex items-center gap-1">
                                        <Truck className="h-3 w-3 text-amber-500" />
                                        <span>Viajes Activos ({tripChannels.length})</span>
                                    </div>
                                </div>
                            </div>

                            {sectionsOpen.trips && (
                                <div className="mt-1 space-y-0.5">
                                    {tripChannels.length === 0 ? (
                                        <div className="px-3 py-2 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                                            No hay viajes activos en este momento
                                        </div>
                                    ) : (
                                        tripChannels.map((conv) => {
                                            const isActive = activeConversationId === conv.id;
                                            return (
                                                <button
                                                    key={conv.id}
                                                    onClick={() => onConversationSelect(conv.id)}
                                                    className={cn(
                                                        'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left',
                                                        isActive
                                                            ? 'bg-zinc-900 text-white font-medium shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                                                            : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Truck className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                                                        <span className="truncate font-medium">
                                                            {conv.title || conv.otherParticipantName}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        {conv.unreadCount > 0 && (
                                                            <span
                                                                className={cn(
                                                                    'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold',
                                                                    isActive
                                                                        ? 'bg-white text-zinc-900'
                                                                        : 'bg-zinc-900 text-white'
                                                                )}
                                                            >
                                                                {conv.unreadCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        {/* SECTION 3: MENSAJES DIRECTOS (💬) */}
                        <div>
                            <div
                                onClick={() => toggleSection('directs')}
                                className="group flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-1.5">
                                    {sectionsOpen.directs ? (
                                        <ChevronDown className="h-3 w-3 text-zinc-400 transition-transform" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3 text-zinc-400 transition-transform" />
                                    )}
                                    <div className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3 text-zinc-400" />
                                        <span>Mensajes Directos ({directMessages.length})</span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNewConversation();
                                    }}
                                    title="Nuevo mensaje directo"
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-opacity"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>

                            {sectionsOpen.directs && (
                                <div className="mt-1 space-y-0.5">
                                    {directMessages.length === 0 ? (
                                        <div className="px-3 py-2 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                                            Inicia una conversación directa con un conductor o empresa
                                        </div>
                                    ) : (
                                        directMessages.map((conv) => {
                                            const isActive = activeConversationId === conv.id;
                                            return (
                                                <button
                                                    key={conv.id}
                                                    onClick={() => onConversationSelect(conv.id)}
                                                    className={cn(
                                                        'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left',
                                                        isActive
                                                            ? 'bg-zinc-900 text-white font-medium shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                                                            : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="relative flex-shrink-0">
                                                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-[9px] font-bold uppercase">
                                                                {conv.otherParticipantName?.slice(0, 1) || 'U'}
                                                            </div>
                                                            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-zinc-900" />
                                                        </div>
                                                        <span className="truncate font-medium">
                                                            {conv.otherParticipantName}
                                                        </span>
                                                    </div>

                                                    {conv.unreadCount > 0 && (
                                                        <span
                                                            className={cn(
                                                                'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold',
                                                                isActive
                                                                    ? 'bg-white text-zinc-900'
                                                                    : 'bg-zinc-900 text-white'
                                                            )}
                                                        >
                                                            {conv.unreadCount}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        {/* SECTION 4: ARCHIVADOS (📁) */}
                        {archivedChannels.length > 0 && (
                            <div>
                                <div
                                    onClick={() => toggleSection('archived')}
                                    className="group flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                >
                                    <div className="flex items-center gap-1.5">
                                        {sectionsOpen.archived ? (
                                            <ChevronDown className="h-3 w-3 text-zinc-400 transition-transform" />
                                        ) : (
                                            <ChevronRight className="h-3 w-3 text-zinc-400 transition-transform" />
                                        )}
                                        <div className="flex items-center gap-1">
                                            <Archive className="h-3 w-3 text-zinc-400" />
                                            <span>Archivados ({archivedChannels.length})</span>
                                        </div>
                                    </div>
                                </div>

                                {sectionsOpen.archived && (
                                    <div className="mt-1 space-y-0.5 opacity-75">
                                        {archivedChannels.map((conv) => {
                                            const isActive = activeConversationId === conv.id;
                                            return (
                                                <button
                                                    key={conv.id}
                                                    onClick={() => onConversationSelect(conv.id)}
                                                    className={cn(
                                                        'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left',
                                                        isActive
                                                            ? 'bg-zinc-900 text-white font-medium'
                                                            : 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Archive className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                                                        <span className="truncate">
                                                            {conv.title || conv.otherParticipantName}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 4. FOOTER: NEW CONVERSATION BUTTON */}
            <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                <button
                    onClick={onNewConversation}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    <span>Iniciar Nueva Conversación</span>
                </button>
            </div>
        </div>
    );
}
