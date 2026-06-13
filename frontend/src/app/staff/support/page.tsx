'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, MessageSquare, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { extractApiErrorMessage, unwrapApiEnvelope } from '@/lib/contracts/api';

type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'escalated' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

interface SupportTicket {
    id: string;
    request_id: string;
    requester_name: string;
    requester_email: string;
    subject: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: string;
    assigned_to: string | null;
    resolution: string | null;
    created_at: string;
    updated_at: string;
    last_message_at: string | null;
}

interface SupportMessage {
    id: string;
    author_name: string | null;
    author_email: string | null;
    author_role: string;
    visibility: 'public' | 'internal';
    body: string;
    created_at: string;
}

interface SupportEvent {
    id: string;
    actor_role: string;
    action: string;
    previous_status: string | null;
    new_status: string | null;
    created_at: string;
}

const STATUS_LABELS: Record<TicketStatus | 'all', string> = {
    all: 'Todos',
    open: 'Abierto',
    in_progress: 'En progreso',
    waiting_user: 'Esperando usuario',
    escalated: 'Escalado',
    resolved: 'Resuelto',
    closed: 'Cerrado',
};

const PRIORITY_LABELS: Record<TicketPriority | 'all', string> = {
    all: 'Todas',
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Critica',
};

const STATUS_STYLES: Record<TicketStatus, string> = {
    open: 'border-amber-200 bg-amber-50 text-amber-800',
    in_progress: 'border-blue-200 bg-blue-50 text-blue-800',
    waiting_user: 'border-purple-200 bg-purple-50 text-purple-800',
    escalated: 'border-red-200 bg-red-50 text-red-800',
    resolved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    closed: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

function formatDate(value?: string | null) {
    if (!value) return 'n/a';
    return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

async function getSessionToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sesion no disponible');
    return session.access_token;
}

export default function AdminSupportPage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = React.useState(true);
    const [detailLoading, setDetailLoading] = React.useState(false);
    const [processing, setProcessing] = React.useState(false);
    const [status, setStatus] = React.useState<TicketStatus | 'all'>('all');
    const [priority, setPriority] = React.useState<TicketPriority | 'all'>('all');
    const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = React.useState<SupportTicket | null>(null);
    const [messages, setMessages] = React.useState<SupportMessage[]>([]);
    const [events, setEvents] = React.useState<SupportEvent[]>([]);
    const [reply, setReply] = React.useState('');
    const [internalNote, setInternalNote] = React.useState('');
    const [resolution, setResolution] = React.useState('');
    const [capabilities, setCapabilities] = React.useState<string[]>([]);

    const canReply = capabilities.includes('support:reply');
    const canCreateInternalNote = capabilities.includes('support:internal_note');
    const canManageTicket = capabilities.includes('support:assign');
    const canCloseTicket = capabilities.includes('support:close');
    const canEscalateTicket = capabilities.includes('support:escalate');

    React.useEffect(() => {
        let cancelled = false;

        const loadStaffAccess = async () => {
            if (!user || !['staff', 'admin'].includes(user.userType)) {
                setCapabilities([]);
                return;
            }

            try {
                const token = await getSessionToken();
                const response = await fetch('/api/staff/me', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const payload = await response.json().catch(() => null);
                if (!cancelled && response.ok) {
                    setCapabilities(Array.isArray(payload?.data?.capabilities) ? payload.data.capabilities : []);
                }
            } catch {
                if (!cancelled) setCapabilities([]);
            }
        };

        void loadStaffAccess();

        return () => {
            cancelled = true;
        };
    }, [user]);

    const loadTickets = React.useCallback(async () => {
        if (!user || !['staff', 'admin'].includes(user.userType)) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const token = await getSessionToken();
            const params = new URLSearchParams();
            if (status !== 'all') params.set('status', status);
            if (priority !== 'all') params.set('priority', priority);

            const response = await fetch(`/api/staff/support/tickets?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudo cargar soporte'));
            const data = unwrapApiEnvelope<SupportTicket[]>(payload) || [];
            setTickets(data);
            if (!selectedTicket && data[0]) {
                setSelectedTicket(data[0]);
            }
        } catch (error) {
            toast.error('Soporte', error instanceof Error ? error.message : 'No se pudo cargar soporte');
        } finally {
            setLoading(false);
        }
    }, [priority, selectedTicket, status, user]);

    const loadDetail = React.useCallback(async (ticketId: string) => {
        setDetailLoading(true);
        try {
            const token = await getSessionToken();
            const response = await fetch(`/api/staff/support/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudo cargar el ticket'));
            const data = unwrapApiEnvelope<{ ticket: SupportTicket; messages: SupportMessage[]; events: SupportEvent[] }>(payload);
            if (data) {
                setSelectedTicket(data.ticket);
                setMessages(data.messages || []);
                setEvents(data.events || []);
                setResolution(data.ticket.resolution || '');
            }
        } catch (error) {
            toast.error('Soporte', error instanceof Error ? error.message : 'No se pudo cargar el ticket');
        } finally {
            setDetailLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadTickets();
    }, [loadTickets]);

    React.useEffect(() => {
        if (selectedTicket?.id) {
            void loadDetail(selectedTicket.id);
        }
    }, [loadDetail, selectedTicket?.id]);

    const patchTicket = async (patch: Record<string, unknown>) => {
        if (!selectedTicket) return;
        setProcessing(true);
        try {
            const token = await getSessionToken();
            const response = await fetch(`/api/staff/support/tickets/${selectedTicket.id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(patch),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudo actualizar ticket'));
            const ticket = unwrapApiEnvelope<SupportTicket>(payload);
            if (ticket) setSelectedTicket(ticket);
            toast.success('Soporte', 'Ticket actualizado');
            await loadTickets();
            await loadDetail(selectedTicket.id);
        } catch (error) {
            toast.error('Soporte', error instanceof Error ? error.message : 'No se pudo actualizar ticket');
        } finally {
            setProcessing(false);
        }
    };

    const sendMessage = async (visibility: 'public' | 'internal') => {
        if (!selectedTicket) return;
        const message = visibility === 'public' ? reply.trim() : internalNote.trim();
        if (!message) return;

        setProcessing(true);
        try {
            const token = await getSessionToken();
            const response = await fetch(`/api/staff/support/tickets/${selectedTicket.id}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message, visibility }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudo enviar mensaje'));
            if (visibility === 'public') setReply('');
            if (visibility === 'internal') setInternalNote('');
            toast.success('Soporte', visibility === 'public' ? 'Respuesta enviada' : 'Nota interna guardada');
            await loadDetail(selectedTicket.id);
            await loadTickets();
        } catch (error) {
            toast.error('Soporte', error instanceof Error ? error.message : 'No se pudo enviar mensaje');
        } finally {
            setProcessing(false);
        }
    };

    if (!user || !['staff', 'admin'].includes(user.userType)) {
        return (
            <DashboardLayout pageTitle="Soporte interno">
                <div className="rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
                    Necesitas una cuenta staff autorizada de KargaX para abrir esta vista.
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Soporte interno">
            <div className="space-y-6">
                <section className="rounded-lg border border-zinc-200 bg-white p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Plataforma</p>
                            <h1 className="mt-1 text-2xl font-semibold text-zinc-950">Soporte interno KargaX</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                                Gestiona tickets, notas internas, respuestas al usuario y escalamiento sin exponer datos criticos.
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => void loadTickets()} disabled={loading}>
                            <RefreshCw className="h-4 w-4" />
                            Actualizar
                        </Button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <label className="text-sm font-medium text-zinc-700">
                            Estado
                            <select
                                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                value={status}
                                onChange={(event) => setStatus(event.target.value as TicketStatus | 'all')}
                            >
                                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm font-medium text-zinc-700">
                            Prioridad
                            <select
                                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                value={priority}
                                onChange={(event) => setPriority(event.target.value as TicketPriority | 'all')}
                            >
                                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                        {loading ? (
                            <div className="flex items-center justify-center gap-3 p-10 text-sm text-zinc-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando tickets
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="p-10 text-center text-sm text-zinc-500">No hay tickets con estos filtros.</div>
                        ) : (
                            <div className="divide-y divide-zinc-100">
                                {tickets.map((ticket) => (
                                    <button
                                        key={ticket.id}
                                        className={`block w-full px-4 py-4 text-left transition hover:bg-zinc-50 ${selectedTicket?.id === ticket.id ? 'bg-zinc-50' : 'bg-white'}`}
                                        onClick={() => setSelectedTicket(ticket)}
                                    >
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-zinc-950">{ticket.subject}</div>
                                                <div className="mt-1 truncate text-xs text-zinc-500">{ticket.requester_name} - {ticket.requester_email}</div>
                                            </div>
                                            <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_STYLES[ticket.status]}`}>
                                                {STATUS_LABELS[ticket.status]}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                                            <span>{PRIORITY_LABELS[ticket.priority]}</span>
                                            <span>{ticket.category}</span>
                                            <span>{formatDate(ticket.updated_at)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-lg border border-zinc-200 bg-white">
                        {!selectedTicket ? (
                            <div className="p-10 text-center text-sm text-zinc-500">Selecciona un ticket.</div>
                        ) : detailLoading ? (
                            <div className="flex items-center justify-center gap-3 p-10 text-sm text-zinc-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando detalle
                            </div>
                        ) : (
                            <div className="space-y-5 p-5">
                                <div className="border-b border-zinc-200 pb-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <h2 className="text-xl font-semibold text-zinc-950">{selectedTicket.subject}</h2>
                                            <p className="mt-1 text-sm text-zinc-500">{selectedTicket.requester_name} - {selectedTicket.requester_email}</p>
                                        </div>
                                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[selectedTicket.status]}`}>
                                            {STATUS_LABELS[selectedTicket.status]}
                                        </span>
                                    </div>
                                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{selectedTicket.description}</p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <label className="text-sm font-medium text-zinc-700">
                                        Estado
                                        <select
                                            className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                                            value={selectedTicket.status}
                                            onChange={(event) => void patchTicket({ status: event.target.value })}
                                            disabled={processing || (!canManageTicket && !canCloseTicket && !canEscalateTicket)}
                                        >
                                            {Object.entries(STATUS_LABELS).filter(([value]) => value !== 'all').map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="text-sm font-medium text-zinc-700">
                                        Prioridad
                                        <select
                                            className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                                            value={selectedTicket.priority}
                                            onChange={(event) => void patchTicket({ priority: event.target.value })}
                                            disabled={processing || !canManageTicket}
                                        >
                                            {Object.entries(PRIORITY_LABELS).filter(([value]) => value !== 'all').map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="rounded-md border border-zinc-200 p-3 text-xs text-zinc-600">
                                        <div className="font-semibold text-zinc-950">Actualizado</div>
                                        <div className="mt-1">{formatDate(selectedTicket.updated_at)}</div>
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="rounded-lg border border-zinc-200 p-4">
                                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                            <MessageSquare className="h-4 w-4" />
                                            Respuesta al usuario
                                        </div>
                                        <textarea
                                            value={reply}
                                            onChange={(event) => setReply(event.target.value)}
                                            className="min-h-[120px] w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                            placeholder="Mensaje visible para el usuario."
                                        />
                                        <Button className="mt-3 w-full" onClick={() => void sendMessage('public')} disabled={processing || !canReply || !reply.trim()}>
                                            <Send className="h-4 w-4" />
                                            Enviar respuesta
                                        </Button>
                                    </div>
                                    <div className="rounded-lg border border-zinc-200 p-4">
                                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                            <ShieldAlert className="h-4 w-4" />
                                            Nota interna
                                        </div>
                                        <textarea
                                            value={internalNote}
                                            onChange={(event) => setInternalNote(event.target.value)}
                                            className="min-h-[120px] w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                            placeholder="Nota no visible para usuarios externos."
                                        />
                                        <Button variant="outline" className="mt-3 w-full" onClick={() => void sendMessage('internal')} disabled={processing || !canCreateInternalNote || !internalNote.trim()}>
                                            <AlertTriangle className="h-4 w-4" />
                                            Guardar nota
                                        </Button>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-zinc-200 p-4">
                                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Resolucion
                                    </div>
                                    <textarea
                                        value={resolution}
                                        onChange={(event) => setResolution(event.target.value)}
                                        className="min-h-[90px] w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                        placeholder="Resumen de solucion."
                                    />
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Button onClick={() => void patchTicket({ status: 'resolved', resolution })} disabled={processing || !canCloseTicket || !resolution.trim()}>
                                            <CheckCircle2 className="h-4 w-4" />
                                            Resolver
                                        </Button>
                                        <Button variant="outline" onClick={() => void patchTicket({ status: 'escalated' })} disabled={processing || !canEscalateTicket}>
                                            <AlertTriangle className="h-4 w-4" />
                                            Escalar
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="rounded-lg border border-zinc-200 p-4">
                                        <h3 className="text-sm font-semibold text-zinc-950">Mensajes</h3>
                                        <div className="mt-3 max-h-[360px] space-y-3 overflow-auto pr-1">
                                            {messages.length === 0 ? (
                                                <div className="text-sm text-zinc-500">Sin mensajes.</div>
                                            ) : messages.map((message) => (
                                                <div key={message.id} className={`rounded-md border p-3 ${message.visibility === 'internal' ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
                                                    <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                                                        <span>{message.author_name || message.author_email || message.author_role}</span>
                                                        <span>{message.visibility === 'internal' ? 'Interno' : 'Publico'}</span>
                                                    </div>
                                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{message.body}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-zinc-200 p-4">
                                        <h3 className="text-sm font-semibold text-zinc-950">Auditoria</h3>
                                        <div className="mt-3 max-h-[360px] space-y-3 overflow-auto pr-1">
                                            {events.length === 0 ? (
                                                <div className="text-sm text-zinc-500">Sin eventos.</div>
                                            ) : events.map((event) => (
                                                <div key={event.id} className="flex gap-3 text-sm">
                                                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                                    <div>
                                                        <div className="font-medium text-zinc-950">{event.action}</div>
                                                        <div className="text-xs text-zinc-500">{event.actor_role} - {formatDate(event.created_at)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </DashboardLayout>
    );
}
