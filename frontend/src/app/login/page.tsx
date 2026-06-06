'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Lock, LogOut, Mail, ShieldCheck } from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { AuthCanvas, AuthCard, CenteredAuthState, MatteSpinner } from '@/components/public/PublicLuxury';
import { Button, Input, toast } from '@/components/ui';
import { RecaptchaCheckbox } from '@/components/ui/RecaptchaCheckbox';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getMfaStatus, getPostAuthRoute } from '@/lib/auth/mfa';
import { loginSchema, type LoginFormData } from '@/lib/validations/schemas';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || '/ofertas';
  const captchaEnabled = React.useMemo(
    () => Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim()),
    []
  );

  const { signIn, signOut, isLoading, user } = useAuthStore();
  const [recaptchaToken, setRecaptchaToken] = React.useState('');
  const [recaptchaError, setRecaptchaError] = React.useState<string | undefined>();
  const [pendingMfaRoute, setPendingMfaRoute] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const getRedirectUrl = React.useCallback(() => {
    if (redirect && redirect !== '/ofertas' && redirect !== '/dashboard') {
      return redirect;
    }
    return '/dashboard';
  }, [redirect]);

  React.useEffect(() => {
    let cancelled = false;

    const syncExistingSession = async () => {
      if (!user) {
        setPendingMfaRoute(null);
        return;
      }

      const status = await getMfaStatus();

      if (cancelled) {
        return;
      }

      if (status.needsSetup || status.needsVerification) {
        setPendingMfaRoute(getPostAuthRoute(status, getRedirectUrl()));
        return;
      }

      router.replace(getRedirectUrl());
    };

    void syncExistingSession();

    return () => {
      cancelled = true;
    };
  }, [user, router, getRedirectUrl]);

  const handleChangeAccount = async () => {
    await signOut();
    setPendingMfaRoute(null);
    toast.success('Sesión limpiada', 'Puedes iniciar con otra cuenta');
  };

  const handleContinueMfa = () => {
    if (pendingMfaRoute) {
      router.replace(pendingMfaRoute);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    if (captchaEnabled && !recaptchaToken) {
      setRecaptchaError('Completa la verificación');
      toast.error('Verificación requerida', 'Completa la verificación anti-bot para continuar');
      return;
    }

    const result = await signIn(data.email, data.password, recaptchaToken || undefined);

    if (result.success) {
      toast.success('Bienvenido', 'Has iniciado sesión correctamente');
      await new Promise((resolve) => setTimeout(resolve, 100));
      const status = await getMfaStatus();
      router.replace(getPostAuthRoute(status, getRedirectUrl()));
    } else {
      toast.error('Error al iniciar sesión', result.error || 'Error desconocido');
    }
  };

  return (
    <AuthCanvas
      sideEyebrow="Ritual de entrada"
      sideTitle="Acceso silencioso a tu operación."
      sideLines={[
        'Logo KX presente, estado claro y cero ruido visual.',
        'MFA entra como protección, no como castigo.',
        'Tu sesión vuelve exactamente al flujo que estabas abriendo.',
      ]}
    >
      <div className="w-full min-w-0 max-w-md">
        <div className="mb-8 flex justify-center lg:hidden">
          <KargaxLogo size="lg" />
        </div>

        <AuthCard>
          <div className="mb-8 text-center">
            <div className="mb-5 flex justify-center">
              <KargaxLogo variant="mark" size="lg" />
            </div>
            <h1 className="kx-public-heading font-semibold">Entrar</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Accede a KargaX con tu correo y contraseña.
            </p>
          </div>

          {pendingMfaRoute ? (
            <div className="mb-5 rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-zinc-950" />
                <div>
                  <p className="text-sm font-semibold text-zinc-950">Verificación pendiente</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Continúa con MFA o limpia la sesión para usar otra cuenta.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 min-[430px]:grid-cols-2">
                <Button type="button" size="sm" onClick={handleContinueMfa}>
                  Continuar MFA
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  leftIcon={<LogOut className="h-4 w-4" />}
                  onClick={handleChangeAccount}
                >
                  Cambiar cuenta
                </Button>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="tu@empresa.com"
              leftIcon={<Mail className="h-5 w-5" />}
              errorMessage={errors.email?.message}
              disabled={isLoading}
              {...register('email')}
            />

            <Input
              label="Contraseña"
              type="password"
              placeholder="********"
              leftIcon={<Lock className="h-5 w-5" />}
              showPasswordToggle
              errorMessage={errors.password?.message}
              disabled={isLoading}
              {...register('password')}
            />

            <div className="flex flex-col gap-3 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between min-[430px]:gap-4">
              <label className="relative flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  aria-label="Recordarme"
                  className="peer absolute left-0 h-11 w-11 cursor-pointer opacity-0"
                  {...register('rememberMe')}
                />
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white transition-colors after:h-2 after:w-2 after:rounded-sm after:bg-white after:opacity-0 after:transition-opacity peer-checked:border-zinc-950 peer-checked:bg-zinc-950 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-950/20"
                />
                <span className="text-sm text-zinc-600">Recordarme</span>
              </label>

              <Link href="/recuperar-contrasena" className="text-sm font-medium text-zinc-950 underline-offset-4 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {captchaEnabled ? (
              <div className="rounded-lg border border-zinc-200 bg-[#f7f7f5] p-4">
                <p className="mb-4 text-center text-sm text-zinc-600">
                  Verifica que no eres un robot.
                </p>
                <RecaptchaCheckbox
                  onVerify={(token) => {
                    setRecaptchaToken(token || '');
                    setRecaptchaError(token ? undefined : 'Completa la verificación');
                  }}
                  error={recaptchaError}
                />
              </div>
            ) : null}

            <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
              Entrar
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <div className="mt-7 grid gap-3">
            <Button variant="outline" fullWidth asChild>
              <Link href="/registro">Crear cuenta</Link>
            </Button>
            <p className="text-center text-xs leading-5 text-zinc-500">
              KargaX protege tu acceso con sesión segura y MFA cuando corresponde.
            </p>
          </div>
        </AuthCard>
      </div>
    </AuthCanvas>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <CenteredAuthState title="Validando acceso" message="Preparando el inicio de sesión.">
          <MatteSpinner />
        </CenteredAuthState>
      }
    >
      <LoginPageContent />
    </React.Suspense>
  );
}
