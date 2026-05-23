'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { CenteredAuthState, MatteSpinner } from '@/components/public/PublicLuxury';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getMfaStatus, getPostAuthRoute } from '@/lib/auth/mfa';
import { establishSessionFromAuthUrl, getAuthUrlKey, withTimeout } from '@/lib/auth/url-session';

async function waitForProfile(userId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      return data as { onboarding_completed?: boolean };
    }

    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }

  return null;
}

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialize = useAuthStore((state) => state.initialize);
  const authUrlKey = getAuthUrlKey(searchParams);
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        const session = await withTimeout(
          establishSessionFromAuthUrl(searchParams),
          20000,
          'El enlace tardo demasiado validando la sesion. Reenvia el correo e intenta de nuevo.'
        );
        await withTimeout(
          initialize(true),
          20000,
          'La sesion inicio, pero no pudimos cargar tu perfil a tiempo.'
        );

        if (cancelled) {
          return;
        }

        setStatus('success');

        setTimeout(async () => {
          const [profile, mfaStatus] = await Promise.all([
            waitForProfile(session.user.id),
            getMfaStatus(),
          ]);
          const target = !profile?.onboarding_completed ? '/onboarding' : '/dashboard';
          router.push(getPostAuthRoute(mfaStatus, target));
        }, 1200);
      } catch (error) {
        console.error('[Auth Callback] Error:', error);
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Error inesperado durante la verificacion');
        }
      }
    };

    void handleCallback();

    return () => {
      cancelled = true;
    };
  }, [authUrlKey, initialize, router, searchParams]);

  if (status === 'loading') {
    return (
      <CenteredAuthState title="Validando acceso" message="Estamos confirmando tu sesion.">
        <MatteSpinner />
      </CenteredAuthState>
    );
  }

  if (status === 'success') {
    return (
      <CenteredAuthState title="Acceso validado" message="Tu cuenta quedo confirmada. Redirigiendo al espacio correcto.">
        <CheckCircle2 className="mx-auto h-12 w-12 text-zinc-950" />
      </CenteredAuthState>
    );
  }

  return (
    <CenteredAuthState title="No pudimos validar el acceso" message={errorMessage || 'El enlace no se pudo procesar.'}>
      <XCircle className="mx-auto h-12 w-12 text-zinc-950" />
      <div className="mt-7 grid gap-3">
        <Button fullWidth onClick={() => router.push('/login')}>
          Ir a login
        </Button>
        <Button variant="outline" fullWidth onClick={() => router.push('/registro')}>
          Crear cuenta
        </Button>
      </div>
    </CenteredAuthState>
  );
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <CenteredAuthState title="Validando acceso" message="Preparando la transicion.">
          <MatteSpinner />
        </CenteredAuthState>
      }
    >
      <AuthCallbackPageContent />
    </React.Suspense>
  );
}

