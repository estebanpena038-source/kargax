'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, LifeBuoy, Loader2, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { Button, Input, toast } from '@/components/ui';
import { Eyebrow, PublicHeader } from '@/components/public/PublicLuxury';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { extractApiErrorMessage, unwrapApiEnvelope } from '@/lib/contracts/api';

type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'escalated' | 'resolved' | 'closed';

interface SupportTicket {
  id: string;
  requester_name: string;
  requester_email: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  author_name: string | null;
  author_role: string;
  visibility: 'public' | 'internal';
  body: string;
  created_at: string;
}

const domains = [
  ['support', 'Soporte general'],
  ['payments', 'Pagos'],
  ['wallet', 'Wallet'],
  ['warehouse', 'Bodega'],
  ['holding', 'Holding'],
  ['onboarding', 'Implementacion'],
  ['market', 'Marketplace'],
];

const categories = [
  ['payment_issue', 'Problema de pago'],
  ['driver_issue', 'Driver/conductor'],
  ['shipment_issue', 'Envio o ruta'],
  ['account_issue', 'Cuenta'],
  ['subscription_issue', 'Plan o suscripcion'],
  ['platform_bug', 'Error de plataforma'],
  ['wallet_issue', 'Wallet'],
  ['marketplace_issue', 'Marketplace'],
  ['security_issue', 'Seguridad'],
  ['other', 'Otro'],
];

const priorities = [
  ['low', 'Baja'],
  ['medium', 'Media'],
  ['high', 'Alta'],
  ['critical', 'Critica'],
];

const statusLabels: Record<TicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  waiting_user: 'Esperando respuesta',
  escalated: 'Escalado',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

function formatDate(value?: string | null) {
  if (!value) return 'n/a';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export default function SupportPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = React.useState<SupportTicket | null>(null);
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [reply, setReply] = React.useState('');
  const [form, setForm] = React.useState({
    requesterName: '',
    requesterEmail: '',
    company: '',
    phone: '',
    subject: '',
    description: '',
    domain: 'support',
    category: 'other',
    priority: 'medium',
    preferredContactChannel: 'email',
    countryCode: 'CO',
    persona: 'Owner/CEO',
  });

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadTickets = React.useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/support/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudieron cargar tus casos'));
      const data = unwrapApiEnvelope<SupportTicket[]>(payload) || [];
      setTickets(data);
      if (!selectedTicket && data[0]) setSelectedTicket(data[0]);
    } catch (error) {
      toast.error('Soporte', error instanceof Error ? error.message : 'No se pudieron cargar tus casos');
    } finally {
      setLoading(false);
    }
  }, [selectedTicket]);

  const loadTicketDetail = React.useCallback(async (ticketId: string) => {
    const token = await getToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudo cargar el caso'));
      const data = unwrapApiEnvelope<{ ticket: SupportTicket; messages: SupportMessage[] }>(payload);
      if (data) {
        setSelectedTicket(data.ticket);
        setMessages(data.messages || []);
      }
    } catch (error) {
      toast.error('Soporte', error instanceof Error ? error.message : 'No se pudo cargar el caso');
    }
  }, []);

  React.useEffect(() => {
    void loadTickets();
  }, [loadTickets, user]);

  React.useEffect(() => {
    if (selectedTicket?.id) {
      void loadTicketDetail(selectedTicket.id);
    }
  }, [loadTicketDetail, selectedTicket?.id]);

  const submitPublic = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/support/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(extractApiErrorMessage(payload, 'No se pudo crear el caso'));
      }

      toast.success('Soporte', 'Caso creado. Quedo en cola de soporte.');
      setForm({
        requesterName: '',
        requesterEmail: '',
        company: '',
        phone: '',
        subject: '',
        description: '',
        domain: 'support',
        category: 'other',
        priority: 'medium',
        preferredContactChannel: 'email',
        countryCode: 'CO',
        persona: 'Owner/CEO',
      });
    } catch (error) {
      toast.error('Soporte', error instanceof Error ? error.message : 'No se pudo crear el caso');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAuthenticated = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Inicia sesion para crear un caso interno');
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: form.subject,
          description: form.description,
          domain: form.domain,
          category: form.category,
          priority: form.priority,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudo crear el caso'));
      toast.success('Soporte', 'Caso creado');
      setForm((current) => ({ ...current, subject: '', description: '', category: 'other', priority: 'medium' }));
      await loadTickets();
    } catch (error) {
      toast.error('Soporte', error instanceof Error ? error.message : 'No se pudo crear el caso');
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sesion no disponible');
      const response = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: reply }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(extractApiErrorMessage(payload, 'No se pudo enviar respuesta'));
      setReply('');
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      toast.error('Soporte', error instanceof Error ? error.message : 'No se pudo enviar respuesta');
    } finally {
      setSubmitting(false);
    }
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;
    const token = await getToken();
    if (!token) return;
    const response = await fetch(`/api/support/tickets/${selectedTicket.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: selectedTicket.status === 'closed' ? 'reopen' : 'close' }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error('Soporte', extractApiErrorMessage(payload, 'No se pudo actualizar el caso'));
      return;
    }
    await loadTickets();
    await loadTicketDetail(selectedTicket.id);
  };

  const isAuthenticated = Boolean(user);

  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950">
      <PublicHeader
        links={[
          { href: '/', label: 'Inicio' },
          { href: '/ayuda', label: 'Ayuda' },
          { href: '/terminos', label: 'Terminos' },
          { href: '/privacidad', label: 'Privacidad' },
        ]}
      />

      <section className="kx-public-section mx-auto grid max-w-7xl gap-8 px-3 min-[380px]:px-4 sm:px-6 lg:grid-cols-[0.84fr_1.16fr] lg:px-8">
        <aside className="min-w-0">
          <Eyebrow>Soporte KargaX</Eyebrow>
          <h1 className="kx-public-title mt-4 font-display font-semibold">
            Casos con trazabilidad, respuestas y cierre operativo.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-zinc-600">
            Reporta problemas de pagos, wallet, rutas, conductores, cuenta o plataforma. Si inicias sesion, puedes ver el historial del caso.
          </p>

          {isAuthenticated ? (
            <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">Tus casos</div>
                  <div className="text-xs text-zinc-500">{tickets.length} abiertos o historicos</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadTickets()}>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar
                </Button>
              </div>
              <div className="mt-4 max-h-[520px] space-y-2 overflow-auto">
                {loading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando casos
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="py-8 text-sm text-zinc-500">Aun no tienes casos.</div>
                ) : tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className={`block w-full rounded-md border p-3 text-left text-sm transition hover:bg-zinc-50 ${selectedTicket?.id === ticket.id ? 'border-zinc-950 bg-zinc-50' : 'border-zinc-200 bg-white'}`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="font-semibold text-zinc-950">{ticket.subject}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>{statusLabels[ticket.status]}</span>
                      <span>{ticket.category}</span>
                      <span>{formatDate(ticket.updated_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600">
              <div className="font-semibold text-zinc-950">Historial disponible con login</div>
              <p className="mt-1">Puedes crear un caso sin iniciar sesion, pero para responder y ver el seguimiento necesitas entrar.</p>
              <Button className="mt-4" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
            </div>
          )}
        </aside>

        <section className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_30px_80px_-56px_rgba(10,10,10,.68)] min-[380px]:p-5 sm:p-7">
            <div className="flex items-start gap-3 border-b border-zinc-200 pb-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold leading-tight">Crear caso</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Describe que paso, a quien afecta y que necesitas revisar.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={isAuthenticated ? submitAuthenticated : submitPublic}>
              {!isAuthenticated ? (
                <>
                  <div className="grid gap-4 min-[720px]:grid-cols-2">
                    <Input label="Nombre" value={form.requesterName} onChange={(event) => updateField('requesterName', event.target.value)} required />
                    <Input label="Correo" type="email" value={form.requesterEmail} onChange={(event) => updateField('requesterEmail', event.target.value)} required />
                  </div>
                  <div className="grid gap-4 min-[720px]:grid-cols-2">
                    <Input label="Empresa" value={form.company} onChange={(event) => updateField('company', event.target.value)} />
                    <Input label="Telefono" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
                  </div>
                </>
              ) : null}
              <div className="grid gap-4 min-[720px]:grid-cols-3">
                <label className="space-y-2 text-sm font-medium text-zinc-700">
                  <span>Dominio</span>
                  <select className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10" value={form.domain} onChange={(event) => updateField('domain', event.target.value)}>
                    {domains.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium text-zinc-700">
                  <span>Categoria</span>
                  <select className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10" value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                    {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium text-zinc-700">
                  <span>Prioridad</span>
                  <select className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10" value={form.priority} onChange={(event) => updateField('priority', event.target.value)}>
                    {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <Input label="Asunto" value={form.subject} onChange={(event) => updateField('subject', event.target.value)} required />
              <label className="space-y-2 text-sm font-medium text-zinc-700">
                <span>Descripcion</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  className="min-h-[150px] w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  placeholder="Que ocurrio, a quien afecta y que necesitas que revisemos."
                  required
                />
              </label>
              <Button type="submit" className="w-full" isLoading={submitting}>
                <Send className="h-4 w-4" />
                Crear caso de soporte
              </Button>
            </form>
          </section>

          {isAuthenticated && selectedTicket ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
              <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Detalle del caso</div>
                  <h2 className="mt-1 text-xl font-semibold text-zinc-950">{selectedTicket.subject}</h2>
                  <div className="mt-1 text-sm text-zinc-500">{statusLabels[selectedTicket.status]} - {formatDate(selectedTicket.updated_at)}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void closeTicket()}>
                  <CheckCircle2 className="h-4 w-4" />
                  {selectedTicket.status === 'closed' ? 'Reabrir' : 'Cerrar'}
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-zinc-500">Aun no hay respuestas.</div>
                ) : messages.map((message) => (
                  <div key={message.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                      <span>{message.author_name || message.author_role}</span>
                      <span>{formatDate(message.created_at)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{message.body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-zinc-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                  <MessageSquare className="h-4 w-4" />
                  Responder
                </div>
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  className="min-h-[110px] w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  placeholder="Agrega contexto o responde al equipo KargaX."
                />
                <Button className="mt-3 w-full" onClick={() => void sendReply()} disabled={!reply.trim() || submitting}>
                  <Send className="h-4 w-4" />
                  Enviar respuesta
                </Button>
              </div>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
