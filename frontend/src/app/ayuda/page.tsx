'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, LockKeyhole, Search, ShieldCheck, Truck, Wallet, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui';
import { Eyebrow, PublicHeader } from '@/components/public/PublicLuxury';
import { cn } from '@/lib/utils';

const FAQ_GROUPS = [
  {
    title: 'Empresa',
    icon: Building2,
    items: [
      ['¿Cómo publico una oferta?', 'Entra a Publicar oferta, completa origen, destino, carga y modalidad. Revisa el resumen antes de confirmar.'],
      ['¿Cómo asigno flota privada?', 'Desde el despacho elige conductor propio, valida su disponibilidad y confirma el manifiesto antes del cargue.'],
      ['¿Dónde reviso reportes?', 'En el dashboard empresarial puedes revisar viajes, gastos, liquidaciones y descargas mensuales.'],
    ],
  },
  {
    title: 'Camionero',
    icon: Truck,
    items: [
      ['¿Cómo tomo una carga?', 'Explora ofertas, revisa requisitos y postúlate solo cuando puedas cumplir la ruta y la ventana horaria.'],
      ['¿Qué evidencia debo subir?', 'Completa PIN, fotos y firma cuando el flujo lo solicite. Evita cerrar una entrega sin evidencia clara.'],
      ['¿Dónde veo mi saldo?', 'En Wallet ves saldo operativo, liquidaciones y solicitudes de retiro disponibles.'],
    ],
  },
  {
    title: 'Bodega',
    icon: Warehouse,
    items: [
      ['¿Cómo preparo un despacho?', 'Crea el despacho desde inventario, confirma picking y revisa el manifiesto antes de liberar el viaje.'],
      ['¿Qué pasa con un rechazo?', 'Registra el rechazo en origen o destino. KargaX lo conserva para que no aparezca como entrega normal.'],
      ['¿Cómo reporto un incidente?', 'Abre Soporte con dominio Bodega, agrega entidad afectada y describe el bloqueo operativo.'],
    ],
  },
  {
    title: 'Wallet',
    icon: Wallet,
    items: [
      ['¿Cuándo se libera una liquidación?', 'La liquidación depende del cierre operativo del viaje y de la evidencia requerida por la empresa.'],
      ['¿Cómo solicito un retiro?', 'En Wallet selecciona método, monto y confirma. El estado queda visible para seguimiento.'],
      ['¿KargaX promete crédito?', 'No. KargaX muestra operación, evidencia, liquidaciones y retiros según los flujos activos.'],
    ],
  },
  {
    title: 'Seguridad',
    icon: LockKeyhole,
    items: [
      ['¿Cómo activo MFA?', 'Después de entrar, KargaX te guía para escanear el QR, verificar el código y guardar recovery codes.'],
      ['¿Qué hago si pierdo el celular?', 'Usa un recovery code en verificación MFA. Después configura un nuevo segundo factor.'],
      ['¿Cómo recupero contraseña?', 'Ve a Recuperar contraseña, ingresa tu correo y abre el enlace desde la misma sesión del navegador.'],
    ],
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border-b border-zinc-200 py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-start justify-between gap-4 text-left"
      >
        <span className="min-w-0 font-medium leading-6 text-zinc-950">{question}</span>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <p className="mt-3 text-sm leading-6 text-zinc-600">{answer}</p> : null}
    </div>
  );
}

export default function AyudaPage() {
  const [query, setQuery] = React.useState('');

  const filteredGroups = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return FAQ_GROUPS;
    }

    return FAQ_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(([question, answer]) =>
        `${group.title} ${question} ${answer}`.toLowerCase().includes(normalizedQuery)
      ),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950">
      <PublicHeader
        links={[
          { href: '/', label: 'Inicio' },
          { href: '/para-camioneros', label: 'Camioneros' },
          { href: '/soporte', label: 'Soporte' },
          { href: '/terminos', label: 'Términos' },
        ]}
      />

      <section className="kx-public-section mx-auto max-w-6xl px-3 min-[380px]:px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Eyebrow>Centro de ayuda</Eyebrow>
          <h1 className="kx-public-title mt-4 font-display font-semibold">
            Autoservicio rápido para operar con calma.
          </h1>
          <p className="mt-5 text-sm leading-7 text-zinc-600">
            Busca por flujo o entra a una categoría. Cada respuesta debe llevarte a una acción concreta.
          </p>
        </div>

        <div className="mt-8 max-w-3xl">
          <label htmlFor="help-search" className="sr-only">Buscar en ayuda</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <input
              id="help-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por empresa, camionero, bodega, wallet o seguridad"
              className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-11 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 min-[380px]:h-14 min-[380px]:px-12"
            />
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {filteredGroups.map((group) => (
            <section key={group.title} className="kx-public-card rounded-lg border border-zinc-200 bg-white">
              <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-5 sm:px-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
                  <group.icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">{group.title}</h2>
                  <p className="text-sm text-zinc-500">{group.items.length} respuestas</p>
                </div>
              </div>
              <div className="px-4 sm:px-5">
                {group.items.map(([question, answer]) => (
                  <FaqItem key={question} question={question} answer={answer} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {filteredGroups.length === 0 ? (
          <div className="mt-10 rounded-lg border border-zinc-200 bg-white p-6">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="mt-4 text-lg font-semibold">No encontramos una respuesta exacta.</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Abre un caso y agrega el flujo, entidad afectada y contexto operativo.
            </p>
            <Button className="mt-5" asChild>
              <Link href="/soporte">Abrir soporte</Link>
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
