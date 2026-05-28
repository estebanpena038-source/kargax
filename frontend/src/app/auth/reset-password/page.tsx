'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { AuthCard, CenteredAuthState, MatteSpinner } from '@/components/public/PublicLuxury';
import { Button, toast } from '@/components/ui';
import { updatePassword } from '@/lib/supabase/auth';
import { establishRecoverySessionFromAuthUrl, getAuthUrlKey, withTimeout } from '@/lib/auth/url-session';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authUrlKey = getAuthUrlKey(searchParams);
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPreparingSession, setIsPreparingSession] = React.useState(true);
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    const prepareRecoverySession = async () => {
      try {
        await withTimeout(
          establishRecoverySessionFromAuthUrl(searchParams),
          20000,
          'El enlace tardo demasiado validando la sesion. Solicita uno nuevo e intenta de nuevo.'
        );

        if (active) {
          setSessionError(null);
        }
      } catch (error) {
        if (active) {
          setSessionError(error instanceof Error ? error.message : 'No se pudo preparar la recuperacion');
        }
      } finally {
        if (active) {
          setIsPreparingSession(false);
        }
      }
    };

    void prepareRecoverySession();

    return () => {
      active = false;
    };
  }, [authUrlKey, searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPreparingSession || sessionError) {
      toast.error('Enlace no listo', sessionError || 'Espera mientras validamos el enlace');
      return;
    }

    if (password.length < 8) {
      toast.error('Contrasena invalida', 'Usa al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('No coincide', 'Las contrasenas deben coincidir');
      return;
    }

    setIsSubmitting(true);
    const result = await updatePassword(password, { signOutAfterUpdate: true });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error('Error', result.error || 'No se pudo actualizar la contrasena');
      return;
    }

    toast.success('Contrasena actualizada', 'Ya puedes iniciar sesion con tu nueva contrasena');
    router.push('/login');
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
            <h1 className="kx-public-heading font-semibold">Nueva contrasena</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Validamos el enlace y guardamos tu nueva contrasena de forma segura.
            </p>
          </div>

          {sessionError ? (
            <div className="mt-6 rounded-lg border border-zinc-300 bg-[#f7f7f5] p-4 text-sm leading-6 text-zinc-700">
              {sessionError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="space-y-2 text-sm font-medium text-zinc-700">
              <span>Nueva contrasena</span>
              <span className="relative block">
                <KeyRound className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimo 8 caracteres"
                  className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-11 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  required
                />
              </span>
            </label>

            <label className="space-y-2 text-sm font-medium text-zinc-700">
              <span>Confirmar contrasena</span>
              <span className="relative block">
                <ShieldCheck className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repite la contrasena"
                  className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-11 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  required
                />
              </span>
            </label>

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isSubmitting || isPreparingSession}
              disabled={Boolean(sessionError)}
            >
              Actualizar contrasena
            </Button>
          </form>

          <Link href="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-zinc-950 underline-offset-4 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Volver al login
          </Link>
        </AuthCard>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <CenteredAuthState title="Validando enlace" message="Estamos preparando la recuperacion.">
          <MatteSpinner />
        </CenteredAuthState>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
