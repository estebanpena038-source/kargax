'use client';

import Link from 'next/link';
import { ArrowRight, Camera, MapPinned, Share2, Truck, Wallet } from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { Button } from '@/components/ui';
import { Eyebrow, PublicHeader } from '@/components/public/PublicLuxury';

const benefits = [
  {
    title: 'Saldo visible',
    text: 'Consulta liquidaciones, gastos y solicitudes de retiro desde una sola vista.',
    icon: Wallet,
  },
  {
    title: 'Evidencia lista',
    text: 'PIN, fotos y firma quedan ordenados para reducir discusiones de cierre.',
    icon: Camera,
  },
  {
    title: 'Ruta clara',
    text: 'Origen, destino, tracking y estado del viaje sin conversaciones perdidas.',
    icon: MapPinned,
  },
];

function referralText() {
  const url = typeof window === 'undefined'
    ? 'https://kargax.online/registro?ref=camionero'
    : `${window.location.origin}/registro?ref=camionero`;

  return `Estoy usando KargaX para viajes, evidencia y wallet. Regístrate aquí: ${url}`;
}

export default function ParaCamionerosPage() {
  const whatsappUrl = typeof window === 'undefined'
    ? '#'
    : `https://wa.me/?text=${encodeURIComponent(referralText())}`;

  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950">
      <PublicHeader
        dark
        primaryHref="/registro?tipo=trucker"
        primaryLabel="Crear cuenta"
        secondaryHref="/login"
        links={[
          { href: '/', label: 'Empresas' },
          { href: '/ayuda', label: 'Ayuda' },
          { href: '/soporte', label: 'Soporte' },
        ]}
      />

      <section className="bg-zinc-950 text-white">
        <div className="mx-auto grid min-h-[calc(100svh-4.25rem)] max-w-6xl items-center gap-8 px-3 py-10 min-[380px]:px-4 sm:px-6 sm:py-14 lg:grid-cols-[1fr_0.82fr] lg:px-8">
          <div>
            <KargaxLogo variant="mark" tone="light" size="sm" />
            <Eyebrow dark className="mt-8">Para camioneros</Eyebrow>
            <h1 className="kx-public-title mt-5 max-w-3xl font-display font-semibold">
              Tus viajes, evidencias y pagos en orden.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/64 sm:text-lg">
              KargaX te ayuda a ejecutar rutas con información clara. Sin promesas de crédito.
              Sin letra pequeña.
            </p>
            <div className="kx-action-stack mt-8">
              <Button className="border-white bg-white text-zinc-950 hover:bg-zinc-200" size="lg" asChild>
                <Link href="/registro?tipo=trucker">
                  Crear cuenta
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="border-white/20 bg-transparent text-white hover:bg-white/10" asChild>
                <Link href="/ofertas">Ver cargas</Link>
              </Button>
            </div>
          </div>

          <div className="kx-public-card rounded-lg border border-white/10 bg-white p-4 text-zinc-950 sm:p-5">
            <div className="flex items-center gap-3 border-b border-zinc-200 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
                <Truck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Viaje</p>
                <h2 className="font-semibold">Medellín a Bogotá</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['Estado', 'Cargue confirmado'],
                ['Evidencia', 'PIN, fotos y firma'],
                ['Saldo', 'Liquidación visible al cierre'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between min-[430px]:gap-4">
                  <span className="text-sm text-zinc-500">{label}</span>
                  <span className="text-right text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="kx-responsive-grid grid gap-4">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="kx-public-card rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
              <benefit.icon className="h-5 w-5 text-zinc-950" />
              <h3 className="mt-5 text-lg font-semibold">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-white">
        <div className="kx-public-section mx-auto grid max-w-6xl gap-6 px-3 min-[380px]:px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <Eyebrow>Referido WhatsApp</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold leading-tight">Comparte KargaX con otro conductor.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              El enlace abre WhatsApp con un mensaje sobrio. El programa comercial puede activarse
              después sin prometer pagos automáticos antes del cierre operativo.
            </p>
          </div>
          <Button asChild>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Share2 className="h-4 w-4" />
              Compartir
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}
