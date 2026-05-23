'use client';

import * as React from 'react';
import Link from 'next/link';
import { LifeBuoy, Send } from 'lucide-react';
import { Button, Input, toast } from '@/components/ui';
import { Eyebrow, PublicHeader } from '@/components/public/PublicLuxury';

const domains = [
  ['support', 'Soporte general'],
  ['payments', 'Pagos'],
  ['wallet', 'Wallet'],
  ['warehouse', 'Bodega'],
  ['holding', 'Holding'],
  ['onboarding', 'Implementación'],
  ['market', 'Marketplace'],
];

const priorities = [
  ['low', 'Baja'],
  ['medium', 'Media'],
  ['high', 'Alta'],
  ['critical', 'Crítica'],
];

const slaRows = [
  ['Crítica', '5 minutos', 'Operación detenida o dinero bloqueado'],
  ['Alta', '30 minutos', 'Flujo principal degradado'],
  ['Media', '4 horas', 'Revisión operativa con trazabilidad'],
  ['Baja', '1 día', 'Pregunta o ajuste no bloqueante'],
];

export default function SupportPage() {
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    requesterName: '',
    requesterEmail: '',
    company: '',
    phone: '',
    subject: '',
    description: '',
    domain: 'support',
    priority: 'medium',
    preferredContactChannel: 'email',
    countryCode: 'CO',
    persona: 'Owner/CEO',
  });

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/support/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || payload?.error || 'No se pudo crear el caso');
      }

      toast.success('Soporte', 'Caso creado. Quedó en cola con SLA visible.');
      setForm({
        requesterName: '',
        requesterEmail: '',
        company: '',
        phone: '',
        subject: '',
        description: '',
        domain: 'support',
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

  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950">
      <PublicHeader
        links={[
          { href: '/', label: 'Inicio' },
          { href: '/ayuda', label: 'Ayuda' },
          { href: '/terminos', label: 'Términos' },
          { href: '/privacidad', label: 'Privacidad' },
        ]}
      />

      <section className="kx-public-section mx-auto grid max-w-7xl gap-8 px-3 min-[380px]:px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <aside className="min-w-0">
          <Eyebrow>Soporte KargaX</Eyebrow>
          <h1 className="kx-public-title mt-4 font-display font-semibold">
            Cuéntanos qué pasó. Lo revisamos con trazabilidad.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-zinc-600">
            Usa este canal para incidentes, implementación, pagos, wallet, bodega o dudas de cuenta.
            Cada caso entra con dominio, prioridad y contexto operativo.
          </p>

          <div className="kx-scroll-table mt-8 rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-[#f7f7f5] text-xs uppercase tracking-[0.16em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Prioridad</th>
                  <th className="px-4 py-3 font-semibold">SLA</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Uso</th>
                </tr>
              </thead>
              <tbody>
                {slaRows.map(([priority, sla, use]) => (
                  <tr key={priority} className="border-b border-zinc-100 last:border-b-0">
                    <td className="px-4 py-4 font-medium">{priority}</td>
                    <td className="px-4 py-4 font-mono text-xs">{sla}</td>
                    <td className="hidden px-4 py-4 text-zinc-600 sm:table-cell">{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="kx-action-stack mt-6">
            <Button variant="outline" asChild>
              <Link href="/ayuda">Centro de ayuda</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        </aside>

        <section className="kx-public-card rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_30px_80px_-56px_rgba(10,10,10,.68)] min-[380px]:p-5 sm:p-7">
          <div className="flex items-start gap-3 border-b border-zinc-200 pb-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold leading-tight">Crear caso</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Describe el impacto y agrega un requestId si ya lo tienes.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="grid gap-4 min-[720px]:grid-cols-2">
              <Input label="Nombre" value={form.requesterName} onChange={(event) => updateField('requesterName', event.target.value)} required />
              <Input label="Correo" type="email" value={form.requesterEmail} onChange={(event) => updateField('requesterEmail', event.target.value)} required />
            </div>
            <div className="grid gap-4 min-[720px]:grid-cols-2">
              <Input label="Empresa" value={form.company} onChange={(event) => updateField('company', event.target.value)} />
              <Input label="Teléfono" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            </div>
            <div className="grid gap-4 min-[720px]:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-zinc-700">
                <span>Dominio</span>
                <select
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  value={form.domain}
                  onChange={(event) => updateField('domain', event.target.value)}
                >
                  {domains.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-zinc-700">
                <span>Prioridad</span>
                <select
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  value={form.priority}
                  onChange={(event) => updateField('priority', event.target.value)}
                >
                  {priorities.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 min-[720px]:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-zinc-700">
                <span>Canal preferido</span>
                <select
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  value={form.preferredContactChannel}
                  onChange={(event) => updateField('preferredContactChannel', event.target.value)}
                >
                  <option value="email">Email</option>
                  <option value="phone">Teléfono</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="slack">Slack</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-zinc-700">
                <span>Rol</span>
                <select
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  value={form.persona}
                  onChange={(event) => updateField('persona', event.target.value)}
                >
                  <option value="Owner/CEO">Owner/CEO</option>
                  <option value="Ops lead">Líder de operaciones</option>
                  <option value="Finance lead">Líder financiero</option>
                </select>
              </label>
            </div>
            <Input label="Asunto" value={form.subject} onChange={(event) => updateField('subject', event.target.value)} required />
            <label className="space-y-2 text-sm font-medium text-zinc-700">
              <span>Descripción</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                className="min-h-[150px] w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                placeholder="Qué ocurrió, a quién afecta y qué necesitas que revisemos."
                required
              />
            </label>
            <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4 text-sm leading-6 text-zinc-600">
              Para casos críticos incluye impacto, entidad afectada y requestId cuando exista.
            </div>
            <Button type="submit" className="w-full" isLoading={submitting}>
              <Send className="h-4 w-4" />
              Crear caso de soporte
            </Button>
          </form>
        </section>
      </section>
    </main>
  );
}
