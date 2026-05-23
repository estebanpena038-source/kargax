import Link from 'next/link';
import { Button } from '@/components/ui';
import { Eyebrow, PublicHeader } from '@/components/public/PublicLuxury';

const sections = [
  {
    id: 'datos',
    title: '1. Información que recopilamos',
    body: 'Recopilamos datos de registro, identidad, contacto, empresa, vehículo, operación, evidencia, ubicación cuando aplica, pagos operativos, soporte y actividad necesaria para mantener seguridad y trazabilidad.',
  },
  {
    id: 'uso',
    title: '2. Uso de la información',
    body: 'Usamos la información para crear cuentas, autenticar usuarios, coordinar viajes, operar bodegas, validar evidencia, procesar liquidaciones, responder soporte, prevenir fraude y cumplir obligaciones legales.',
  },
  {
    id: 'seguridad',
    title: '3. Seguridad',
    body: 'Aplicamos controles técnicos y organizativos como HTTPS, RLS, sesiones seguras, MFA, auditoría operativa y separación de permisos por rol. Ningún sistema es infalible, pero diseñamos la operación para reducir exposición y abuso.',
  },
  {
    id: 'compartir',
    title: '4. Cuándo compartimos datos',
    body: 'Compartimos datos solo cuando es necesario para ejecutar la operación, procesar pagos, prestar infraestructura, responder requerimientos legales o habilitar soporte autorizado.',
  },
  {
    id: 'derechos',
    title: '5. Derechos del usuario',
    body: 'Puedes solicitar acceso, corrección, actualización o eliminación de datos, sujeto a obligaciones legales, contables, antifraude y de trazabilidad operativa.',
  },
  {
    id: 'cookies',
    title: '6. Cookies y almacenamiento local',
    body: 'Usamos cookies y almacenamiento estrictamente necesarios para sesión, seguridad, preferencias y continuidad operativa. No vendemos datos personales.',
  },
  {
    id: 'contacto',
    title: '7. Contacto',
    body: 'Para consultas de privacidad escribe a contactokargax@gmail.com. Atenderemos la solicitud conforme a los tiempos legales aplicables.',
  },
];

export default function PrivacidadPage() {
  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950">
      <PublicHeader
        links={[
          { href: '/', label: 'Inicio' },
          { href: '/ayuda', label: 'Ayuda' },
          { href: '/soporte', label: 'Soporte' },
          { href: '/terminos', label: 'Términos' },
        ]}
      />

      <div className="kx-public-section mx-auto grid max-w-6xl gap-10 px-3 min-[380px]:px-4 sm:px-6 lg:grid-cols-[220px_minmax(0,760px)] lg:px-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-2 text-sm" aria-label="Índice de privacidad">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Índice</p>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="block rounded-md px-3 py-2 text-zinc-600 hover:bg-white hover:text-zinc-950">
                {section.title.replace(/^\d+\.\s/, '')}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <Eyebrow>Privacidad KargaX</Eyebrow>
          <h1 className="kx-public-title mt-4 font-display font-semibold">
            Política de privacidad
          </h1>
          <p className="mt-5 text-sm leading-7 text-zinc-600">
            Última actualización: 14 de mayo de 2026. Tratamos datos para operar con seguridad,
            trazabilidad y control, sin ruido legal innecesario.
          </p>

          <div className="mt-10 space-y-10 border-t border-zinc-200 pt-10">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="kx-public-heading font-semibold">{section.title}</h2>
                <p className="mt-4 text-base leading-8 text-zinc-600">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="kx-public-card mt-10 rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Responsable de datos</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Escríbenos a{' '}
              <a href="mailto:contactokargax@gmail.com" className="font-semibold text-zinc-950 underline underline-offset-4">
                contactokargax@gmail.com
              </a>
              {' '}para consultas o solicitudes sobre datos personales.
            </p>
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
