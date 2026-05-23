import Link from 'next/link';
import { Button } from '@/components/ui';
import { Eyebrow, PublicHeader } from '@/components/public/PublicLuxury';

const sections = [
  {
    id: 'aceptacion',
    title: '1. Aceptación de los términos',
    body: 'Al acceder y utilizar KargaX aceptas estos términos. KargaX es una plataforma tecnológica para coordinar carga, bodegas, evidencia, pagos operativos y trazabilidad entre empresas, transportadores y equipos autorizados.',
  },
  {
    id: 'cuenta',
    title: '2. Cuenta y verificación',
    body: 'Para operar puedes necesitar verificación de identidad, correo confirmado, datos de empresa, documentos y segundo factor de autenticación. La plataforma puede limitar acciones cuando detecte inconsistencias, riesgo o información incompleta.',
  },
  {
    id: 'uso',
    title: '3. Uso permitido',
    body: 'Debes usar KargaX para operaciones reales, con información cierta y evidencia verificable. Está prohibido manipular viajes, evidencias, pagos, ubicaciones, invitaciones o datos de terceros.',
  },
  {
    id: 'operacion',
    title: '4. Operación, evidencia y pagos',
    body: 'Los PIN, fotos, firma, tracking, manifiestos, liquidaciones, retiros y reportes están sujetos a reglas operativas, validaciones de seguridad y disponibilidad de los proveedores vinculados al flujo.',
  },
  {
    id: 'responsabilidad',
    title: '5. Responsabilidad',
    body: 'KargaX actúa como plataforma tecnológica. La ejecución física del transporte, custodia de la carga, exactitud de datos operativos y cumplimiento de tiempos corresponde a las partes que participan en cada operación.',
  },
  {
    id: 'privacidad',
    title: '6. Privacidad y datos',
    body: 'El tratamiento de datos personales se rige por la Política de Privacidad. Usamos la información necesaria para autenticación, operación, trazabilidad, soporte, seguridad y cumplimiento legal.',
  },
  {
    id: 'cambios',
    title: '7. Cambios',
    body: 'Podemos actualizar estos términos para reflejar cambios de producto, regulación o seguridad. La versión publicada en esta página será la referencia vigente.',
  },
];

export default function TerminosPage() {
  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950">
      <PublicHeader
        links={[
          { href: '/', label: 'Inicio' },
          { href: '/ayuda', label: 'Ayuda' },
          { href: '/soporte', label: 'Soporte' },
          { href: '/privacidad', label: 'Privacidad' },
        ]}
      />

      <div className="kx-public-section mx-auto grid max-w-6xl gap-10 px-3 min-[380px]:px-4 sm:px-6 lg:grid-cols-[220px_minmax(0,760px)] lg:px-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-2 text-sm" aria-label="Índice de términos">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Índice</p>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="block rounded-md px-3 py-2 text-zinc-600 hover:bg-white hover:text-zinc-950">
                {section.title.replace(/^\d+\.\s/, '')}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <Eyebrow>KargaX legal</Eyebrow>
          <h1 className="kx-public-title mt-4 font-display font-semibold">
            Términos y condiciones de uso
          </h1>
          <p className="mt-5 text-sm leading-7 text-zinc-600">
            Última actualización: mayo de 2026. Documento de lectura clara para operar con responsabilidad,
            seguridad y trazabilidad.
          </p>

          <div className="mt-10 space-y-10 border-t border-zinc-200 pt-10">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="kx-public-heading font-semibold">{section.title}</h2>
                <p className="mt-4 text-base leading-8 text-zinc-600">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="kx-action-stack mt-12 border-t border-zinc-200 pt-6">
            <Button asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/ayuda">Centro de ayuda</Link>
            </Button>
          </div>
        </article>
      </div>
    </main>
  );
}
