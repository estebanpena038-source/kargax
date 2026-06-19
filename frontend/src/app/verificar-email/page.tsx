'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, RefreshCw } from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { AuthCard, CenteredAuthState, MatteSpinner } from '@/components/public/PublicLuxury';
import { Button, toast } from '@/components/ui';
import { resendConfirmationEmail } from '@/lib/supabase/auth';

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams?.get('email') || '';
  const [email, setEmail] = React.useState(emailParam);
  const [isSending, setIsSending] = React.useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('Correo requerido', 'Ingresa el correo que usaste en el registro');
      return;
    }

    setIsSending(true);
    const result = await resendConfirmationEmail(email);
    setIsSending(false);

    if (!result.success) {
      toast.error('No se pudo reenviar', result.error || 'Intenta de nuevo');
      return;
    }

    toast.success('Correo reenviado', 'Revisa tu bandeja de entrada y spam');
  };

  return (
    <main className="kx-public-shell flex items-center justify-center bg-[#f7f7f5] px-3 py-8 text-zinc-950 min-[380px]:px-4 sm:py-12">
      <div className="w-full min-w-0 max-w-md">
        <div className="mb-7 flex justify-center">
          <Link href="/" aria-label="KargaX inicio">
            <KargaxLogo size="lg" />
          </Link>
        </div>

        <AuthCard>
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-zinc-200 bg-[#f7f7f5]">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="kx-public-heading font-semibold">Confirma tu correo</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Reenvia la verificacion si el enlace vencio, fue usado o no abrio correctamente.
            </p>
          </div>

          <div className="mt-7 space-y-5">
            <label className="space-y-2 text-sm font-medium text-zinc-700">
              <span>Correo de registro</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@empresa.com"
                className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              />
            </label>

            <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4 text-sm leading-6 text-zinc-600">
              Abre siempre el correo mas reciente. El nuevo enlace esta preparado para funcionar aunque lo abras desde otro navegador o dispositivo.
            </div>

            <Button onClick={handleResend} size="lg" fullWidth isLoading={isSending}>
              <RefreshCw className="h-4 w-4" />
              Reenviar verificacion
            </Button>
          </div>

          <p className="mt-7 text-center text-sm text-zinc-600">
            Ya confirmaste?{' '}
            <Link href="/login" className="font-semibold text-zinc-950 underline underline-offset-4">
              Entrar
            </Link>
          </p>
        </AuthCard>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense
      fallback={
        <CenteredAuthState title="Validando acceso" message="Preparando la verificacion de correo.">
          <MatteSpinner />
        </CenteredAuthState>
      }
    >
      <VerifyEmailPageContent />
    </React.Suspense>
  );
}
