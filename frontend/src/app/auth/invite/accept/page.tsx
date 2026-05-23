'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { CenteredAuthState, MatteSpinner } from '@/components/public/PublicLuxury';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getMfaStatus, getPostAuthRoute } from '@/lib/auth/mfa';
import { establishSessionFromAuthUrl, getAuthUrlKey, withTimeout } from '@/lib/auth/url-session';

async function postAcceptInvitation(accessToken: string) {
  const response = await fetch('/api/business/team/accept', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof json?.error === 'string'
      ? json.error
      : typeof json?.error?.message === 'string'
        ? json.error.message
        : 'No pudimos aceptar la invitacion';
    throw new Error(message);
  }

  return json;
}

function InviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialize = useAuthStore((state) => state.initialize);
  const authUrlKey = getAuthUrlKey(searchParams);
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = React.useState('Estamos vinculando tu cuenta al equipo empresarial de KargaX.');

  React.useEffect(() => {
    let cancelled = false;

    const acceptInvitation = async () => {
      try {
        const session = await withTimeout(
          establishSessionFromAuthUrl(searchParams),
          20000,
          'El enlace tardo demasiado validando la sesion. Reenvia la invitacion e intenta de nuevo.'
        );
        await withTimeout(
          initialize(true),
          20000,
          'La sesion inicio, pero no pudimos cargar tu perfil a tiempo.'
        );
        await withTimeout(
          postAcceptInvitation(session.access_token),
          20000,
          'La sesion inicio, pero no pudimos vincular la invitacion a tiempo.'
        );

        const mfaStatus = await getMfaStatus();
        const nextRoute = getPostAuthRoute(mfaStatus, '/dashboard');

        if (!cancelled) {
          setStatus('success');
          setMessage('Tu invitacion fue aceptada. Redirigiendo con seguridad.');
          setTimeout(() => {
            router.replace(nextRoute);
          }, 1400);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(error instanceof Error ? error.message : 'No se pudo aceptar la invitacion');
        }
      }
    };

    void acceptInvitation();

    return () => {
      cancelled = true;
    };
  }, [authUrlKey, initialize, router, searchParams]);

  if (status === 'loading') {
    return (
      <CenteredAuthState title="Validando acceso" message={message}>
        <MatteSpinner />
      </CenteredAuthState>
    );
  }

  if (status === 'success') {
    return (
      <CenteredAuthState title="Equipo actualizado" message={message}>
        <CheckCircle2 className="mx-auto h-12 w-12 text-zinc-950" />
      </CenteredAuthState>
    );
  }

  return (
    <CenteredAuthState title="Invitacion con error" message={message}>
      <XCircle className="mx-auto h-12 w-12 text-zinc-950" />
      <div className="mt-7 grid gap-3">
        <Button fullWidth onClick={() => router.push('/login')}>
          Ir a login
        </Button>
        <Button variant="outline" fullWidth onClick={() => router.push('/registro?tipo=business')}>
          Crear cuenta empresa
        </Button>
      </div>
    </CenteredAuthState>
  );
}

export default function InviteAcceptPage() {
  return (
    <React.Suspense
      fallback={
        <CenteredAuthState title="Validando acceso" message="Preparando la invitacion.">
          <MatteSpinner />
        </CenteredAuthState>
      }
    >
      <InviteAcceptContent />
    </React.Suspense>
  );
}

