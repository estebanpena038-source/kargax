// =============================================================================
// KARGAX - New Conversation Modal Component
// Enterprise Silicon-Valley Grade Contact & Fleet Selector
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Search,
    Truck,
    Users,
    Package,
    Send,
    BellRing,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface NewConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectContact: (contact: {
        type: 'user' | 'trip' | 'fleet';
        id: string;
        name: string;
        offerId?: string;
    }) => Promise<void> | void;
}

export function NewConversationModal({
    isOpen,
    onClose,
    onSelectContact
}: NewConversationModalProps) {
    const [activeTab, setActiveTab] = React.useState<'fleet' | 'trips' | 'team' | 'invite'>('fleet');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [openingId, setOpeningId] = React.useState<string | null>(null);

    // Data states
    const [drivers, setDrivers] = React.useState<any[]>([]);
    const [trips, setTrips] = React.useState<any[]>([]);
    const [team, setTeam] = React.useState<any[]>([]);

    // Invite form state
    const [inviteRecipient, setInviteRecipient] = React.useState('');
    const [inviteMessage, setInviteMessage] = React.useState('Te invito a unirte a mi conversación en KargaX.');
    const [sendingInvite, setSendingInvite] = React.useState(false);

    // Fetch data when modal opens
    React.useEffect(() => {
        if (!isOpen) return;

        async function loadData() {
            setLoading(true);
            try {
                const { data: userData } = await supabase.auth.getUser();
                const currentUserId = userData?.user?.id;

                if (!currentUserId) return;

                // 1. Fetch active trips with assigned truckers or created by business
                const { data: tripsData } = await (supabase.from('cargo_offers' as any) as any)
                    .select('id, cargo_description, origin_city, destination_city, assigned_trucker_id, private_fleet_trucker_id, status, created_at')
                    .or(`business_id.eq.${currentUserId},assigned_trucker_id.eq.${currentUserId},private_fleet_trucker_id.eq.${currentUserId}`)
                    .order('created_at', { ascending: false })
                    .limit(30);

                setTrips(tripsData || []);

                // 2. Fetch fleet members and assigned truckers
                const truckerIds = new Set<string>();
                const truckerVehicleMap = new Map<string, string>();

                // From business_fleet_members
                const { data: fleetMembers } = await (supabase.from('business_fleet_members' as any) as any)
                    .select('trucker_id, vehicle_plate, status')
                    .eq('business_id', currentUserId);

                for (const fm of fleetMembers || []) {
                    if (fm.trucker_id && fm.trucker_id !== currentUserId) {
                        truckerIds.add(fm.trucker_id);
                        if (fm.vehicle_plate) {
                            truckerVehicleMap.set(fm.trucker_id, `Placa: ${fm.vehicle_plate}`);
                        }
                    }
                }

                // From cargo_offers
                for (const t of tripsData || []) {
                    const tid = t.assigned_trucker_id || t.private_fleet_trucker_id;
                    if (tid && tid !== currentUserId) {
                        truckerIds.add(tid);
                        if (!truckerVehicleMap.has(tid)) {
                            truckerVehicleMap.set(tid, 'Conductor Asignado');
                        }
                    }
                }

                // Also check if current user is a trucker, find business IDs
                const { data: profileCheck } = await (supabase.from('user_profiles' as any) as any)
                    .select('user_type')
                    .eq('id', currentUserId)
                    .maybeSingle();

                if (profileCheck?.user_type === 'trucker') {
                    const { data: truckerOffers } = await (supabase.from('cargo_offers' as any) as any)
                        .select('business_id')
                        .or(`assigned_trucker_id.eq.${currentUserId},private_fleet_trucker_id.eq.${currentUserId}`)
                        .limit(20);

                    for (const o of truckerOffers || []) {
                        if (o.business_id && o.business_id !== currentUserId) {
                            truckerIds.add(o.business_id);
                            truckerVehicleMap.set(o.business_id, 'Empresa Generadora');
                        }
                    }
                }

                let driverList: any[] = [];
                if (truckerIds.size > 0) {
                    const { data: profiles } = await (supabase.from('user_profiles' as any) as any)
                        .select('id, full_name, email, phone, user_type, avatar_url')
                        .in('id', Array.from(truckerIds));

                    driverList = (profiles || []).map((p: any) => ({
                        id: p.id,
                        name: p.full_name || p.email || 'Conductor KargaX',
                        email: p.email,
                        phone: p.phone,
                        vehicleType: truckerVehicleMap.get(p.id) || (p.user_type === 'trucker' ? 'Camionero' : 'Empresa'),
                        userType: p.user_type,
                    }));
                }

                setDrivers(driverList);

                // 3. Fetch team members
                const { data: teamData } = await (supabase.from('business_team_members' as any) as any)
                    .select('user_id, role, full_name, email')
                    .eq('business_id', currentUserId);

                setTeam(teamData || []);

            } catch (err) {
                console.error('[NewConversationModal] Error loading contacts:', err);
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [isOpen]);

    const handleSelect = async (contact: {
        type: 'user' | 'trip' | 'fleet';
        id: string;
        name: string;
        offerId?: string;
    }) => {
        setOpeningId(contact.id);
        try {
            await onSelectContact(contact);
            onClose();
        } catch (err: any) {
            console.error('[NewConversationModal] Error selecting contact:', err);
            toast.error('Error al abrir conversación', {
                description: err.message || 'No se pudo iniciar el chat'
            });
        } finally {
            setOpeningId(null);
        }
    };

    const handleSendInvite = async () => {
        if (!inviteRecipient.trim()) {
            toast.error('Ingresa un correo o teléfono');
            return;
        }

        setSendingInvite(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const currentUserId = userData?.user?.id;

            // Insert system notification invite
            const { error } = await (supabase.from('notifications' as any) as any)
                .insert({
                    user_id: currentUserId,
                    title: 'Invitación a conversación KargaX',
                    message: `${inviteRecipient}: ${inviteMessage}`,
                    type: 'message_invite',
                    read: false
                });

            if (error) throw error;

            toast.success('Invitación enviada por notificación KargaX');
            setInviteRecipient('');
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Error al enviar invitación');
        } finally {
            setSendingInvite(false);
        }
    };

    if (!isOpen) return null;

    const filteredDrivers = drivers.filter(d => 
        (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (d.vehicleType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredTrips = trips.filter(t => 
        (t.cargo_description || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (t.origin_city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.destination_city || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredTeam = team.filter(m => 
        (m.full_name || m.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]"
                >
                    {/* Modal Header */}
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-950 text-white">
                        <div className="flex items-center gap-2.5">
                            <Send className="w-5 h-5 text-white" />
                            <h3 className="font-bold text-base tracking-tight">Nueva conversación KargaX</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-1.5 gap-1">
                        <button
                            onClick={() => setActiveTab('fleet')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors",
                                activeTab === 'fleet' 
                                    ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-sm" 
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                            )}
                        >
                            <Truck className="w-3.5 h-3.5" />
                            Conductores ({drivers.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('trips')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors",
                                activeTab === 'trips' 
                                    ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-sm" 
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                            )}
                        >
                            <Package className="w-3.5 h-3.5" />
                            Viajes ({trips.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('team')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors",
                                activeTab === 'team' 
                                    ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-sm" 
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                            )}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Equipo ({team.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('invite')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors",
                                activeTab === 'invite' 
                                    ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-sm" 
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                            )}
                        >
                            <BellRing className="w-3.5 h-3.5" />
                            Invitar
                        </button>
                    </div>

                    {/* Search Bar (except for invite tab) */}
                    {activeTab !== 'invite' && (
                        <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder={
                                        activeTab === 'fleet' ? 'Buscar conductor por nombre, placa o teléfono...' :
                                        activeTab === 'trips' ? 'Buscar viaje por origen o destino...' :
                                        'Buscar miembro del equipo...'
                                    }
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-zinc-400">
                                <Loader2 className="w-6 h-6 animate-spin mr-2 text-zinc-950 dark:text-zinc-100" />
                                <span>Cargando contactos...</span>
                            </div>
                        ) : activeTab === 'fleet' ? (
                            filteredDrivers.length === 0 ? (
                                <div className="text-center py-10 text-zinc-500 text-sm">
                                    <Truck className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                                    <p className="font-medium text-zinc-700 dark:text-zinc-300">No se encontraron conductores en tu flota.</p>
                                    <p className="text-xs text-zinc-400 mt-1">Asigna viajes o agrega camioneros a tu flota para conversar directamente.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredDrivers.map((driver) => {
                                        const isOpening = openingId === driver.id;
                                        return (
                                            <button
                                                key={driver.id}
                                                disabled={isOpening}
                                                onClick={() => handleSelect({ type: 'user', id: driver.id, name: driver.name })}
                                                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-950 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-all text-left group disabled:opacity-50"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-zinc-950 dark:bg-zinc-800 text-white flex items-center justify-center font-bold text-sm">
                                                        {(driver.name || 'C').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white">{driver.name}</p>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{driver.vehicleType}</p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-full group-hover:bg-zinc-950 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-950 transition-colors">
                                                    {isOpening ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span>Iniciando...</span>
                                                        </>
                                                    ) : (
                                                        'Iniciar Chat'
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )
                        ) : activeTab === 'trips' ? (
                            filteredTrips.length === 0 ? (
                                <div className="text-center py-10 text-zinc-500 text-sm">
                                    <Package className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                                    <p>No hay viajes registrados.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredTrips.map((trip) => {
                                        const isOpening = openingId === trip.id;
                                        return (
                                            <button
                                                key={trip.id}
                                                disabled={isOpening}
                                                onClick={() => handleSelect({ 
                                                    type: 'trip', 
                                                    id: trip.id, 
                                                    name: `#viaje-${(trip.origin_city || 'origen').toLowerCase()}-${(trip.destination_city || 'destino').toLowerCase()}`, 
                                                    offerId: trip.id 
                                                })}
                                                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-950 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-all text-left group disabled:opacity-50"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                                                        <Truck className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                                            {trip.origin_city} → {trip.destination_city}
                                                        </p>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                                                            {trip.cargo_description || 'Sin descripción'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-full group-hover:bg-zinc-950 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-950 transition-colors">
                                                    {isOpening ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span>Abriendo...</span>
                                                        </>
                                                    ) : (
                                                        'Abrir Canal'
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )
                        ) : activeTab === 'team' ? (
                            filteredTeam.length === 0 ? (
                                <div className="text-center py-10 text-zinc-500 text-sm">
                                    <Users className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                                    <p>No se encontraron miembros en el equipo de la empresa.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredTeam.map((member) => {
                                        const isOpening = openingId === member.user_id;
                                        return (
                                            <button
                                                key={member.user_id}
                                                disabled={isOpening}
                                                onClick={() => handleSelect({ type: 'user', id: member.user_id, name: member.full_name || member.email })}
                                                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-950 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-all text-left group disabled:opacity-50"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                                                        {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{member.full_name || 'Usuario'}</p>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{member.email || member.role}</p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-full group-hover:bg-zinc-950 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-950 transition-colors">
                                                    {isOpening ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span>Iniciando...</span>
                                                        </>
                                                    ) : (
                                                        'Chatear'
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )
                        ) : (
                            /* Invite Tab */
                            <div className="p-4 space-y-4">
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                                    <p className="font-bold text-zinc-900 dark:text-white mb-1">📢 Notificación Interna KargaX</p>
                                    <p>Envía una invitación que llegará directamente al centro de notificaciones de KargaX de tu trabajador o camionero sin requerir servicios externos.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Correo electrónico o Teléfono del trabajador
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="ejemplo@kargax.com o +57 300 000 0000"
                                        value={inviteRecipient}
                                        onChange={(e) => setInviteRecipient(e.target.value)}
                                        className="w-full p-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                        Mensaje de invitación
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={inviteMessage}
                                        onChange={(e) => setInviteMessage(e.target.value)}
                                        className="w-full p-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 resize-none"
                                    />
                                </div>

                                <Button
                                    onClick={handleSendInvite}
                                    disabled={sendingInvite}
                                    className="w-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 py-2.5 font-semibold rounded-xl transition-colors"
                                >
                                    {sendingInvite ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Enviando invitación...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Enviar Invitación Notificada
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
