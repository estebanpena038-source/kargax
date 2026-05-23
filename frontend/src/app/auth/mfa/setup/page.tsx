'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Copy, LogOut, ShieldCheck, Smartphone, Ticket } from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { Button, Input, toast } from '@/components/ui';
import { CenteredAuthState, MatteSpinner } from '@/components/public/PublicLuxury';
import { syncSessionBridge } from '@/lib/auth/session-bridge';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  generateRecoveryCodes,
  getMfaErrorMessage,
  getMfaFriendlyName,
  getMfaStatus,
  getPostAuthRoute,
  MFA_ISSUER,
  replaceRecoveryCodes,
  verifyTotpFactor,
} from '@/lib/auth/mfa';

interface EnrolledFactorState {
  id: string;
  qrCode: string;
  secret: string;
  friendlyName: string;
}

interface CachedEnrollmentState extends EnrolledFactorState {
  userId: string;
  createdAt: number;
}

const ENROLLMENT_CACHE_TTL_MS = 10 * 60 * 1000;
let activeEnrollmentRequest: Promise<EnrolledFactorState | null> | null = null;
let activeEnrollmentUserId: string | null = null;

async function resolveEnrollment(userId: string, email?: string | null) {
  const cacheKey = `kargax-mfa-enrollment:${userId}`;
  const { data: listData } = await supabase.auth.mfa.listFactors();
  const pendingFactors = (listData?.all || []).filter(
    (item) => item.factor_type === 'totp' && item.status === 'unverified'
  );

  const cachedEnrollmentRaw = typeof window !== 'undefined'
    ? window.sessionStorage.getItem(cacheKey)
    : null;

  if (cachedEnrollmentRaw) {
    try {
      const cachedEnrollment = JSON.parse(cachedEnrollmentRaw) as CachedEnrollmentState;
      const isFresh = Date.now() - cachedEnrollment.createdAt < ENROLLMENT_CACHE_TTL_MS;
      const stillPending = pendingFactors.some((factorItem) => factorItem.id === cachedEnrollment.id);

      if (cachedEnrollment.userId === userId && isFresh && stillPending) {
        return {
          id: cachedEnrollment.id,
          qrCode: cachedEnrollment.qrCode,
          secret: cachedEnrollment.secret,
          friendlyName: cachedEnrollment.friendlyName,
        };
      }
    } catch {
      // Ignore malformed cache and proceed with a fresh enrollment.
    }

    window.sessionStorage.removeItem(cacheKey);
  }

  for (const pendingFactor of pendingFactors) {
    await supabase.auth.mfa.unenroll({ factorId: pendingFactor.id });
  }

  const friendlyName = getMfaFriendlyName(email || 'usuario');
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
    issuer: MFA_ISSUER,
  });

  if (error || !data) {
    throw error || new Error('Could not enroll TOTP factor');
  }

  const nextFactor = {
    id: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    friendlyName,
  };

  if (typeof window !== 'undefined') {
    const cachePayload: CachedEnrollmentState = {
      ...nextFactor,
      userId,
      createdAt: Date.now(),
    };
    window.sessionStorage.setItem(cacheKey, JSON.stringify(cachePayload));
  }

  return nextFactor;
}

async function getOrCreateEnrollment(userId: string, email?: string | null) {
  if (activeEnrollmentRequest && activeEnrollmentUserId === userId) {
    return activeEnrollmentRequest;
  }

  activeEnrollmentUserId = userId;
  activeEnrollmentRequest = resolveEnrollment(userId, email).finally(() => {
    activeEnrollmentRequest = null;
    activeEnrollmentUserId = null;
  });

  return activeEnrollmentRequest;
}

function MfaSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, initialize, signOut } = useAuthStore();
  const nextPath = searchParams?.get('next') || '/dashboard';

  const [loading, setLoading] = React.useState(true);
  const [verifying, setVerifying] = React.useState(false);
  const [confirmingBackup, setConfirmingBackup] = React.useState(false);
  const [factor, setFactor] = React.useState<EnrolledFactorState | null>(null);
  const [otpCode, setOtpCode] = React.useState('');
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [backupsSaved, setBackupsSaved] = React.useState(false);

  const handleChangeAccount = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id || user?.id;

    if (typeof window !== 'undefined' && sessionUserId) {
      window.sessionStorage.removeItem(`kargax-mfa-enrollment:${sessionUserId}`);
    }

    activeEnrollmentRequest = null;
    activeEnrollmentUserId = null;
    await signOut();
    toast.success('Sesión cerrada', 'Puedes iniciar con otra cuenta');
    router.replace('/login');
  };

  const loadEnrollment = React.useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace(`/login?redirect=${encodeURIComponent('/auth/mfa/setup')}`);
        return;
      }

      await initialize();
      const status = await getMfaStatus();

      if (!status.hasSession) {
        router.replace(`/login?redirect=${encodeURIComponent('/auth/mfa/setup')}`);
        return;
      }

      if (!status.needsSetup) {
        router.replace(getPostAuthRoute(status, nextPath));
        return;
      }

      const nextFactor = await getOrCreateEnrollment(
        session.user.id,
        session.user.email || user?.email || 'usuario'
      );

      setFactor(nextFactor);
    } catch (error) {
      toast.error('MFA', error instanceof Error ? error.message : 'No se pudo preparar MFA');
    } finally {
      setLoading(false);
    }
  }, [initialize, nextPath, router, user?.email]);

  React.useEffect(() => {
    void loadEnrollment();
  }, [loadEnrollment]);

  const handleVerify = async () => {
    if (!factor || otpCode.trim().length < 6) {
      toast.error('Código requerido', 'Ingresa el código de 6 dígitos de Google Authenticator');
      return;
    }

    setVerifying(true);
    try {
      await verifyTotpFactor(factor.id, otpCode);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('No active session after MFA verification');
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(`kargax-mfa-enrollment:${session.user.id}`);
      }

      const codes = generateRecoveryCodes();
      await replaceRecoveryCodes(session.user.id, codes);
      setRecoveryCodes(codes);
      toast.success('MFA activado', 'Guarda tus códigos de recuperación antes de continuar');
    } catch (error) {
      toast.error('Error MFA', getMfaErrorMessage(error, 'No se pudo verificar el código'));
    } finally {
      setVerifying(false);
    }
  };

  const handleContinue = async () => {
    setConfirmingBackup(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await syncSessionBridge(session);
      }

      await initialize(true);
      router.replace(nextPath);
    } finally {
      setConfirmingBackup(false);
    }
  };

  return (
    <main className="kx-public-shell bg-zinc-950 px-3 py-5 text-white min-[380px]:px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-6xl items-center">
        <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[0.78fr_minmax(0,1.22fr)]">
          <aside className="min-w-0 rounded-lg border border-white/10 p-5 sm:p-8">
            <KargaxLogo tone="light" size="lg" />
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
              Seguridad premium
            </p>
            <h1 className="kx-public-title mt-4 font-display font-semibold">
              MFA no es castigo. Es control.
            </h1>
            <div className="mt-8 space-y-4 text-sm leading-6 text-white/62">
              <p><ShieldCheck className="mr-2 inline h-4 w-4 text-white" /> Escanea el QR en Google Authenticator.</p>
              <p><Smartphone className="mr-2 inline h-4 w-4 text-white" /> Usa la clave manual si el QR no abre.</p>
              <p><Ticket className="mr-2 inline h-4 w-4 text-white" /> Guarda los recovery codes una sola vez.</p>
            </div>
          </aside>

          <section className="kx-public-card rounded-lg border border-white/10 bg-white p-4 text-zinc-950 shadow-[0_34px_90px_-58px_rgba(0,0,0,.9)] min-[380px]:p-5 sm:p-7">
            <div className="mb-6 flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Multi-factor setup</p>
                <h2 className="kx-public-heading mt-2 font-semibold">Activa tu segundo factor</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  QR, código TOTP y recuperación en una pantalla sobria.
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
            ) : recoveryCodes.length > 0 ? (
              <div className="space-y-6">
                <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-6 w-6 text-zinc-950" />
                    <div>
                      <h3 className="text-lg font-semibold">MFA activado</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">
                        Guarda estos códigos. Cada uno funciona una sola vez.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4 min-[520px]:grid-cols-2 sm:p-5">
                  {recoveryCodes.map((code) => (
                    <div key={code} className="min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-3 font-mono text-xs font-semibold tracking-[0.12em] min-[380px]:px-4 min-[380px]:text-sm sm:tracking-[0.16em]">
                      {code}
                    </div>
                  ))}
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 text-sm leading-6 text-zinc-600">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                    checked={backupsSaved}
                    onChange={(event) => setBackupsSaved(event.target.checked)}
                  />
                  <span>Confirmo que guardé los recovery codes y entiendo que KargaX los muestra solo esta vez.</span>
                </label>

                <Button fullWidth size="lg" disabled={!backupsSaved} isLoading={confirmingBackup} onClick={handleContinue}>
                  Entrar al dashboard
                </Button>
              </div>
            ) : factor ? (
              <div className="space-y-6">
                <div className="grid gap-5 min-[760px]:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
                  <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4">
                    <img
                      src={factor.qrCode}
                      alt="QR para Google Authenticator"
                      className="mx-auto aspect-square h-auto w-full max-w-52 rounded-lg bg-white object-contain"
                    />
                  </div>
                  <div className="min-w-0 space-y-4">
                    <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Factor</p>
                      <p className="mt-2 truncate text-base font-semibold">{factor.friendlyName}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Clave manual</p>
                          <p className="mt-2 break-all font-mono text-sm font-semibold">{factor.secret}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(factor.secret);
                            toast.success('Clave copiada');
                          }}
                          className="rounded-md border border-zinc-200 p-2 text-zinc-700 hover:border-zinc-950"
                          aria-label="Copiar clave manual"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <Input
                      label="Código de 6 dígitos"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      helperText="Ingresa el código que ves en Google Authenticator."
                    />
                    <Button fullWidth size="lg" isLoading={verifying} onClick={handleVerify}>
                      Verificar MFA
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-[#f7f7f5] p-10 text-center">
                <p className="text-sm text-zinc-600">No se pudo preparar el QR en este intento.</p>
                <Button className="mt-5" variant="outline" onClick={() => void loadEnrollment()}>
                  Reintentar setup MFA
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function MfaSetupPage() {
  return (
    <React.Suspense
      fallback={
        <CenteredAuthState title="Validando acceso" message="Preparando seguridad MFA." dark>
          <MatteSpinner />
        </CenteredAuthState>
      }
    >
      <MfaSetupContent />
    </React.Suspense>
  );
}
