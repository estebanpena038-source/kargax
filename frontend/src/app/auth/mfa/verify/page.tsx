'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, KeyRound, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { Button, Input, toast } from '@/components/ui';
import { CenteredAuthState, MatteSpinner } from '@/components/public/PublicLuxury';
import { syncSessionBridge } from '@/lib/auth/session-bridge';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  consumeRecoveryCode,
  getMfaErrorMessage,
  getMfaStatus,
  getPostAuthRoute,
  verifyTotpFactor,
} from '@/lib/auth/mfa';

function MfaVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, initialize, signOut } = useAuthStore();
  const nextPath = searchParams?.get('next') || '/dashboard';

  const [loading, setLoading] = React.useState(true);
  const [verifyingCode, setVerifyingCode] = React.useState(false);
  const [verifyingRecovery, setVerifyingRecovery] = React.useState(false);
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [otpCode, setOtpCode] = React.useState('');
  const [recoveryCode, setRecoveryCode] = React.useState('');

  const handleChangeAccount = async () => {
    await signOut();
    toast.success('Sesión cerrada', 'Puedes iniciar con otra cuenta');
    router.replace('/login');
  };

  React.useEffect(() => {
    let cancelled = false;

    const loadFactor = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.replace(`/login?redirect=${encodeURIComponent(nextPath)}`);
          return;
        }

        await initialize();
        const status = await getMfaStatus();

        if (!status.hasSession) {
          router.replace(`/login?redirect=${encodeURIComponent(nextPath)}`);
          return;
        }

        if (status.needsSetup) {
          router.replace('/auth/mfa/setup');
          return;
        }

        if (!status.needsVerification) {
          router.replace(getPostAuthRoute(status, nextPath));
          return;
        }

        if (!cancelled) {
          setFactorId(status.verifiedFactorId);
        }
      } catch (error) {
        toast.error('MFA', error instanceof Error ? error.message : 'No se pudo preparar la verificación');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFactor();

    return () => {
      cancelled = true;
    };
  }, [initialize, nextPath, router]);

  const handleVerifyCode = async () => {
    if (!factorId || otpCode.trim().length < 6) {
      toast.error('Código requerido', 'Ingresa el código actual de Google Authenticator');
      return;
    }

    setVerifyingCode(true);
    try {
      await verifyTotpFactor(factorId, otpCode);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('No active session after MFA verification');
      }

      await syncSessionBridge(session);
      await initialize(true);
      router.replace(nextPath);
    } catch (error) {
      toast.error('MFA', getMfaErrorMessage(error, 'No se pudo verificar el código'));
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleRecovery = async () => {
    if (!user?.id || !recoveryCode.trim()) {
      toast.error('Código requerido', 'Ingresa uno de tus recovery codes');
      return;
    }

    setVerifyingRecovery(true);
    try {
      const validCode = await consumeRecoveryCode(user.id, recoveryCode);

      if (!validCode) {
        toast.error('Recovery code inválido', 'Ese código no existe o ya fue usado');
        return;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const factor of factors?.totp || []) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(`kargax-mfa-enrollment:${user.id}`);
      }

      toast.success('Acceso recuperado', 'Configura un nuevo segundo factor para continuar');
      router.replace('/auth/mfa/setup?next=/dashboard&recovered=1');
    } catch (error) {
      toast.error('Recovery code', error instanceof Error ? error.message : 'No se pudo validar el recovery code');
    } finally {
      setVerifyingRecovery(false);
    }
  };

  return (
    <main className="kx-public-shell bg-zinc-950 px-3 py-5 text-white min-[380px]:px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-5xl items-center">
        <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[0.82fr_minmax(0,1fr)]">
          <aside className="min-w-0 rounded-lg border border-white/10 p-5 sm:p-8">
            <KargaxLogo tone="light" size="lg" />
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
              KargaX AAL2
            </p>
            <h1 className="kx-public-title mt-4 font-display font-semibold">
              Confirma tu identidad.
            </h1>
            <div className="mt-8 space-y-4 text-sm leading-6 text-white/62">
              <p><ShieldCheck className="mr-2 inline h-4 w-4 text-white" /> Usa el código actual de Google Authenticator.</p>
              <p><KeyRound className="mr-2 inline h-4 w-4 text-white" /> El recovery code solo se usa si perdiste el celular.</p>
            </div>
          </aside>

          <section className="kx-public-card rounded-lg border border-white/10 bg-white p-4 text-zinc-950 shadow-[0_34px_90px_-58px_rgba(0,0,0,.9)] min-[380px]:p-5 sm:p-7">
            <div className="mb-6 flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Segundo factor obligatorio</p>
                <h2 className="kx-public-heading mt-2 font-semibold">Verifica tu acceso</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Seguridad premium, sin fricción innecesaria.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleChangeAccount}>
                <LogOut className="h-4 w-4" />
                Cambiar cuenta
              </Button>
            </div>

            {loading ? (
              <div className="flex min-h-[min(420px,55svh)] items-center justify-center">
                <MatteSpinner />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
                      <Smartphone className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold">Código desde Google Authenticator</h3>
                      <p className="text-sm leading-6 text-zinc-600">Introduce 6 dígitos para elevar la sesión a aal2.</p>
                    </div>
                  </div>
                  <Input
                    label="Código TOTP"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                  />
                  <Button fullWidth className="mt-4" isLoading={verifyingCode} onClick={handleVerifyCode}>
                    Verificar código
                  </Button>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <AlertTriangle className="mt-1 h-5 w-5 text-zinc-950" />
                    <div>
                      <h3 className="text-lg font-semibold">Acceso de emergencia</h3>
                      <p className="text-sm leading-6 text-zinc-600">
                        Usa un recovery code solo si no tienes acceso al celular. Esto reinicia MFA.
                      </p>
                    </div>
                  </div>
                  <Input
                    label="Recovery code"
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                    placeholder="ABCD-EFGH-JKLM"
                  />
                  <Button fullWidth variant="outline" className="mt-4" isLoading={verifyingRecovery} onClick={handleRecovery}>
                    Validar recovery code
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function MfaVerifyPage() {
  return (
    <React.Suspense
      fallback={
        <CenteredAuthState title="Validando acceso" message="Preparando segundo factor." dark>
          <MatteSpinner />
        </CenteredAuthState>
      }
    >
      <MfaVerifyContent />
    </React.Suspense>
  );
}
