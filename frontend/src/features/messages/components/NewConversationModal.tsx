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
    UserCheck,
    BellRing,
    CheckCircle2,
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
    }) => void;
}

export function NewConversationModal({
    isOpen,
    onClose,
    onSelectContact
}: NewConversationModalProps) {
    const [activeTab, setActiveTab] = React.useState<'fleet' | 'trips' | 'team' | 'invite'>('fleet');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [loading, setLoading] = React.useState(false);

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
                    .select('id, cargo_description, origin_city, destination_city, assigned_trucker_id, status, created_at')
                    .or(`business_id.eq.${currentUserId},assigned_trucker_id.eq.${currentUserId}`)
                    .order('created_at', { ascending: false })
                    .limit(20);

                setTrips(tripsData || []);

                // 2. Fetch fleet drivers from business_fleet_members or cargo_offers assigned drivers
                const { data: fleetData } = await (supabase.from('cargo_offers' as any) as any)
                    .select('assigned_trucker_id, vehicle_type')
                    .eq('business_id', currentUserId)
                    .not('assigned_trucker_id', 'is', null)
                    .limit(20);

                const driverList = (fleetData || []).map((f: any, idx: number) => ({
                    id: f.assigned_trucker_id,
                    name: `Conductor ${idx + 1}`,
                    vehicleType: f.vehicle_type || 'Camión',
                    status: 'online'
                }));

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
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        d.vehicleType.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[85vh]"
                >
                    {/* Modal Header */}
                    <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-900 text-white">
                        <div className="flex items-center gap-2">
                            <Send className="w-5 h-5 text-amber-400" />
                            <h3 className="font-bold text-base">Nueva conversación KargaX</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-zinc-200 bg-zinc-50 p-1.5 gap-1">
                        <button
                            onClick={() => setActiveTab('fleet')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors",
                                activeTab === 'fleet' ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                            )}
                        >
                            <Truck className="w-3.5 h-3.5" />
                            Conductores ({drivers.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('trips')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors",
                                activeTab === 'trips' ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                            )}
                        >
                            <Package className="w-3.5 h-3.5" />
                            Viajes ({trips.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('team')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors",
                                activeTab === 'team' ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                            )}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Equipo ({team.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('invite')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors",
                                activeTab === 'invite' ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                            )}
                        >
                            <BellRing className="w-3.5 h-3.5" />
                            Invitar
                        </button>
                    </div>

                    {/* Search Bar (except for invite tab) */}
                    {activeTab !== 'invite' && (
                        <div className="p-3 border-b border-zinc-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder={
                                        activeTab === 'fleet' ? 'Buscar conductor por nombre o vehículo...' :
                                        activeTab === 'trips' ? 'Buscar viaje por origen o destino...' :
                                        'Buscar miembro del equipo...'
                                    }
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:border-zinc-950 focus:bg-white"
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-zinc-400">
                                <Loader2 className="w-6 h-6 animate-spin mr-2 text-zinc-950" />
                                <span>Cargando contactos...</span>
                            </div>
                        ) : activeTab === 'fleet' ? (
                            filteredDrivers.length === 0 ? (
                                <div className="text-center py-10 text-zinc-500 text-sm">
                                    <Truck className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                                    <p>No se encontraron conductores en tu flota.</p>
                                    <p className="text-xs text-zinc-400 mt-1">Asigna viajes a conductores para conversar directamente.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredDrivers.map((driver) => (
                                        <button
                                            key={driver.id}
                                            onClick={() => {
                                                onSelectContact({ type: 'user', id: driver.id, name: driver.name });
                                                onClose();
                                            }}
                                            className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:border-zinc-950 hover:bg-zinc-50 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-zinc-950 text-white flex items-center justify-center font-bold text-sm">
                                                    {driver.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm text-zinc-900 group-hover:text-zinc-950">{driver.name}</p>
                                                    <p className="text-xs text-zinc-500">{driver.vehicleType}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-full group-hover:bg-zinc-950 group-hover:text-white transition-colors">
                                                Iniciar Chat
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )
                        ) : activeTab === 'trips' ? (
                            filteredTrips.length === 0 ? (
                                <div className="text-center py-10 text-zinc-500 text-sm">
                                    <Package className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                                    <p>No hay viajes activos registrados.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredTrips.map((trip) => (
                                        <button
                                            key={trip.id}
                                            onClick={() => {
                                                onSelectContact({ type: 'trip', id: trip.id, name: `#viaje-${trip.origin_city.toLowerCase()}-${trip.destination_city.toLowerCase()}`, offerId: trip.id });
                                                onClose();
                                            }}
                                            className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:border-zinc-950 hover:bg-zinc-50 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                                                    <Truck className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm text-zinc-900">
                                                        {trip.origin_city} → {trip.destination_city}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 truncate max-w-[200px]">
                                                        {trip.cargo_description || 'Sin descripción'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-full group-hover:bg-zinc-950 group-hover:text-white transition-colors">
                                                Abrir Canal
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )
                        ) : activeTab === 'team' ? (
                            filteredTeam.length === 0 ? (
                                <div className="text-center py-10 text-zinc-500 text-sm">
                                    <Users className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                                    <p>No se encontraron miembros en el equipo de la empresa.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredTeam.map((member) => (
                                        <button
                                            key={member.user_id}
                                            onClick={() => {
                                                onSelectContact({ type: 'user', id: member.user_id, name: member.full_name || member.email });
                                                onClose();
                                            }}
                                            className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:border-zinc-950 hover:bg-zinc-50 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                                                    {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm text-zinc-900">{member.full_name || 'Usuario'}</p>
                                                    <p className="text-xs text-zinc-500">{member.email || member.role}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-full group-hover:bg-zinc-950 group-hover:text-white transition-colors">
                                                Chatear
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )
                        ) : (
                            /* Invite Tab */
                            <div className="p-4 space-y-4">
                                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-600 leading-relaxed">
                                    <p className="font-bold text-zinc-900 mb-1">📢 Notificación Interna KargaX</p>
                                    <p>Envía una invitación que llegará directamente al centro de notificaciones de KargaX de tu trabajador o camionero sin requerir servicios externos.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                                        Correo electrónico o Teléfono del trabajador
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="ejemplo@kargax.com o +57 300 000 0000"
                                        value={inviteRecipient}
                                        onChange={(e) => setInviteRecipient(e.target.value)}
                                        className="w-full p-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-950"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                                        Mensaje de invitación
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={inviteMessage}
                                        onChange={(e) => setInviteMessage(e.target.value)}
                                        className="w-full p-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-950 resize-none"
                                    />
                                </div>

                                <Button
                                    onClick={handleSendInvite}
                                    disabled={sendingInvite}
                                    className="w-full bg-zinc-950 text-white hover:bg-zinc-800 py-2.5 font-semibold"
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
