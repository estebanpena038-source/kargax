import * as React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export type PublicNavLink = {
  href: string;
  label: string;
};

const defaultLinks: PublicNavLink[] = [
  { href: '/para-camioneros', label: 'Camioneros' },
  { href: '/soporte', label: 'Soporte' },
  { href: '/ayuda', label: 'Ayuda' },
  { href: '/planes', label: 'Planes' },
];

export function PublicHeader({
  links = defaultLinks,
  dark = false,
  primaryHref = '/registro?tipo=business',
  primaryLabel = 'Crear cuenta',
  secondaryHref = '/login',
  secondaryLabel = 'Entrar',
}: {
  links?: PublicNavLink[];
  dark?: boolean;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const visibleLinks = links.slice(0, 4);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b backdrop-blur-xl',
        dark
          ? 'border-white/10 bg-zinc-950/90 text-white'
          : 'border-black/10 bg-[#f7f7f5]/92 text-zinc-950'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 min-[380px]:gap-3 min-[380px]:px-4 sm:px-6 sm:py-4 lg:px-8">
        <Link href="/" aria-label="KargaX inicio" className="shrink-0">
          <KargaxLogo tone={dark ? 'light' : 'dark'} size="md" />
        </Link>

        <nav
          aria-label="Navegacion publica"
          className={cn(
            'hidden items-center gap-7 text-sm font-medium lg:flex',
            dark ? 'text-white/62' : 'text-zinc-600'
          )}
        >
          {visibleLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'transition-colors',
                dark ? 'hover:text-white' : 'hover:text-zinc-950'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-1.5 min-[380px]:gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'max-[420px]:hidden',
              dark
                ? 'border-white/18 bg-transparent text-white hover:bg-white hover:text-zinc-950'
                : 'border-zinc-950 bg-white text-zinc-950 hover:bg-zinc-100'
            )}
            asChild
          >
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
          <Button
            size="sm"
            className={cn(
              'max-[420px]:h-9 max-[420px]:px-3 max-[359px]:text-[0.7rem]',
              dark
                ? 'border-white bg-white text-zinc-950 hover:bg-zinc-200'
                : 'border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800'
            )}
            asChild
          >
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function Eyebrow({
  children,
  dark = false,
  className,
}: React.PropsWithChildren<{ dark?: boolean; className?: string }>) {
  return (
    <p
      className={cn(
        'break-words text-xs font-semibold uppercase tracking-[0.16em] sm:tracking-[0.22em]',
        dark ? 'text-white/58' : 'text-zinc-500',
        className
      )}
    >
      {children}
    </p>
  );
}

export function MatteSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-950 shadow-[0_22px_50px_-40px_rgba(10,10,10,.7)]',
        className
      )}
      aria-hidden="true"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
    </span>
  );
}

export function AuthSidePanel({
  eyebrow = 'KargaX',
  title,
  lines,
}: {
  eyebrow?: string;
  title: string;
  lines: string[];
}) {
  return (
    <aside className="hidden min-h-svh min-w-0 bg-zinc-950 text-white lg:flex">
      <div className="flex w-full flex-col justify-between px-12 py-12 xl:px-16">
        <KargaxLogo tone="light" size="lg" />
        <div className="max-w-md">
          <Eyebrow dark>{eyebrow}</Eyebrow>
          <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-[0.98] xl:text-5xl">
            {title}
          </h1>
          <div className="mt-10 space-y-3">
            {lines.slice(0, 3).map((line) => (
              <div key={line} className="border-l border-white/18 pl-4 text-sm leading-6 text-white/68">
                {line}
              </div>
            ))}
          </div>
        </div>
        <p className="max-w-sm text-xs leading-6 text-white/42">
          Acceso privado, trazabilidad operativa y evidencia lista para auditoria.
        </p>
      </div>
    </aside>
  );
}

export function AuthCanvas({
  children,
  sideTitle,
  sideEyebrow,
  sideLines,
}: React.PropsWithChildren<{
  sideTitle: string;
  sideEyebrow?: string;
  sideLines: string[];
}>) {
  return (
    <main className="kx-public-shell bg-[#f7f7f5] text-zinc-950 lg:grid lg:grid-cols-[0.88fr_1.12fr]">
      <AuthSidePanel eyebrow={sideEyebrow} title={sideTitle} lines={sideLines} />
      <section className="flex min-h-svh min-w-0 items-center justify-center px-3 py-5 min-[380px]:px-4 sm:px-6 sm:py-8 lg:px-10">
        {children}
      </section>
    </main>
  );
}

export function AuthCard({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        'kx-public-card w-full min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_30px_80px_-56px_rgba(10,10,10,.68)] min-[380px]:p-6 sm:p-8',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CenteredAuthState({
  title,
  message,
  children,
  dark = false,
}: React.PropsWithChildren<{
  title: string;
  message: string;
  dark?: boolean;
}>) {
  return (
    <main
      className={cn(
        'flex min-h-svh items-center justify-center px-3 py-8 min-[380px]:px-4 sm:py-12',
        dark ? 'bg-zinc-950 text-white' : 'bg-[#f7f7f5] text-zinc-950'
      )}
    >
      <div
        className={cn(
          'kx-public-card w-full max-w-md overflow-hidden rounded-lg border p-5 text-center shadow-[0_30px_80px_-56px_rgba(10,10,10,.72)] min-[380px]:p-7',
          dark ? 'border-white/10 bg-white text-zinc-950' : 'border-zinc-200 bg-white'
        )}
      >
        <div className="mb-7 flex justify-center">
          <KargaxLogo variant="mark" tone="dark" size="lg" />
        </div>
        {children}
        <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{message}</p>
      </div>
    </main>
  );
}
