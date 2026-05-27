'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Camera,
  Check,
  PackageCheck,
  Truck,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { Eyebrow, PublicHeader } from '@/components/public/PublicLuxury';
import { captureMarketingEvent } from '@/lib/client/marketing';

const control = [
  {
    title: 'Flota privada',
    text: 'Conductores propios, gastos del viaje, compensación y asignación por empresa.',
    icon: Truck,
  },
  {
    title: 'Bodegas',
    text: 'Inventario, picking, manifiesto y despacho conectados al viaje.',
    icon: Warehouse,
  },
  {
    title: 'Marketplace',
    text: 'Ofertas públicas cuando necesitas capacidad externa sin perder trazabilidad.',
    icon: PackageCheck,
  },
];

const evidence = [
  'PIN de cargue y entrega',
  'Fotos y firma digital',
  'Tracking PWA por ruta',
  'Rechazos preservados',
];

const money = [
  'Liquidaciones por viaje',
  'Wallet operativa',
  'Retiros registrados',
  'Reporte mensual',
];

const operationalAccess = [
  'Dia 1: empresa, equipo, bodega y conductores.',
  'Dia 2-3: inventario, despacho y manifiesto.',
  'Dia 4-5: ruta con GPS, PIN, fotos y firma.',
  'Dia 6-7: wallet, gastos y reporte ejecutivo.',
];

function OperationalMock() {
  return (
    <div className="kx-public-card rounded-lg border border-white/12 bg-white p-4 text-zinc-950 shadow-[0_34px_90px_-58px_rgba(0,0,0,.9)] sm:p-5">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Viaje activo</p>
          <h2 className="mt-2 text-lg font-semibold leading-tight sm:text-xl">Bodega Medellín a cliente Bogotá</h2>
        </div>
        <span className="w-fit rounded-md border border-zinc-950 px-3 py-1 text-xs font-semibold">En ruta</span>
      </div>

      <div className="kx-responsive-grid-sm mt-5 grid gap-3">
        {[
          ['Manifiesto', '18/18 cargados'],
          ['GPS PWA', 'Sync 09:42'],
          ['Wallet', '$1.840.000'],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg border border-zinc-200 bg-[#f7f7f5] p-3 sm:p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-2 font-mono text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {[
          'Bodega e inventario',
          'Despacho elegido',
          'Viaje asignado',
          'PIN y evidencia',
          'Wallet y reporte',
        ].map((item, index) => (
          <div key={item} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950 font-mono text-xs font-semibold text-white">
              {index + 1}
            </span>
            <span className="text-sm font-medium">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash || '';

    if (!hash.includes('access_token=')) {
      return;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const type = params.get('type');
    let targetPath = '/auth/callback';

    if (type === 'recovery') {
      targetPath = '/auth/reset-password';
    } else if (type === 'invite' || type === 'magiclink') {
      targetPath = '/auth/invite/accept';
    }

    router.replace(`${targetPath}${hash}`);
  }, [router]);

  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950">
      <PublicHeader />

      <section className="border-b border-zinc-200 bg-[#f7f7f5]">
        <div className="mx-auto grid min-h-[calc(100svh-4.25rem)] max-w-7xl items-center gap-8 px-3 py-10 min-[380px]:px-4 sm:px-6 md:py-12 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <Eyebrow>Primer segundo de control</Eyebrow>
            <h1 className="kx-public-title mt-5 max-w-4xl font-display font-semibold tracking-normal">
              El sistema operativo premium para carga, bodegas y pagos.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
              Control de flota, despacho, evidencia, wallet y reportes en una interfaz limpia,
              seria y lista para operar sin ansiedad.
            </p>
            <div className="kx-action-stack mt-8">
              <Button size="lg" asChild>
                <Link
                  href="/registro?tipo=business"
                  onClick={() => void captureMarketingEvent('home_business_register_cta', { source: 'hero' })}
                >
                  Activar Acceso Operativo gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link href="/ofertas/publicar">Publicar oferta</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="min-w-0 rounded-lg bg-zinc-950 p-2 shadow-[0_44px_100px_-60px_rgba(0,0,0,.92)] min-[380px]:p-3 sm:p-5"
          >
            <OperationalMock />
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 py-12 min-[380px]:px-4 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Eyebrow>Control</Eyebrow>
            <h2 className="kx-public-heading mt-3 font-semibold">La operación completa, sin ruido.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-600">
            Cada módulo existe para una decisión real: asignar, cargar, entregar, liquidar y auditar.
          </p>
        </div>

        <div className="kx-responsive-grid grid gap-4">
          {control.map((item) => (
            <article key={item.title} className="kx-public-card rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
              <item.icon className="h-5 w-5 text-zinc-950" />
              <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-3 py-12 min-[380px]:px-4 sm:px-6 sm:py-14 lg:grid-cols-2 lg:px-8">
          <div>
            <Eyebrow>Evidencia</Eyebrow>
            <h2 className="kx-public-heading mt-3 font-semibold">Cada cierre queda probado.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">
              KargaX ordena lo que normalmente vive en mensajes sueltos: PIN, fotos, firma,
              tracking y eventos que soporte puede reconstruir.
            </p>
          </div>
          <div className="kx-responsive-grid-sm grid gap-3">
            {evidence.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4">
                <Camera className="h-4 w-4 text-zinc-950" />
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-3 py-12 min-[380px]:px-4 sm:px-6 sm:py-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 lg:px-8">
        <div className="kx-public-card rounded-lg bg-zinc-950 p-5 text-white sm:p-7">
          <Eyebrow dark>Dinero</Eyebrow>
          <h2 className="kx-public-heading mt-4 font-semibold">Liquidación clara antes de crecer.</h2>
          <p className="mt-4 text-sm leading-7 text-white/64">
            Wallet, retiros y reportes se muestran como control operativo, sin promesas financieras
            que no pertenezcan al flujo real.
          </p>
          <div className="kx-responsive-grid-sm mt-7 grid gap-3">
            {money.map((item) => (
              <div key={item} className="flex items-center gap-3 border border-white/10 p-4">
                <Wallet className="h-4 w-4 text-white" />
                <span className="text-sm font-medium text-white/78">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="kx-public-card rounded-lg border border-zinc-200 bg-white p-5 sm:p-7">
          <Eyebrow>Acceso Operativo</Eyebrow>
          <h2 className="kx-public-heading mt-4 font-semibold">Entregas reales, pasos visibles.</h2>
          <div className="mt-7 space-y-3">
            {operationalAccess.map((step) => (
              <div key={step} className="flex gap-3 rounded-lg border border-zinc-200 p-4">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-950" />
                <p className="text-sm leading-6 text-zinc-700">{step}</p>
              </div>
            ))}
          </div>
          <div className="kx-action-stack mt-7">
            <Button asChild>
              <Link href="/registro?tipo=business">Ver flujo operativo</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/ofertas/publicar">Crear primer despacho</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-[#f7f7f5] px-3 py-12 min-[380px]:px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-lg border border-zinc-950 bg-zinc-950 p-5 text-white sm:p-7 md:flex-row md:items-center md:justify-between">
          <div>
            <Eyebrow dark>Acceso privado</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold leading-tight">Tu operación merece una herramienta a su altura.</h2>
          </div>
          <div className="kx-action-stack shrink-0">
            <Button className="border-white bg-white text-zinc-950 hover:bg-zinc-200" asChild>
              <Link href="/registro?tipo=business">
                Crear cuenta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
