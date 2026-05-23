'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import KargaxLogo from '@/components/brand/KargaxLogo';
import { AuthCard } from '@/components/public/PublicLuxury';
import { Button, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';

export default function RecuperarContrasenaPage() {
  const { resetPassword, isLoading } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await resetPassword(email);
    if (!result.success) {
      toast.error('Error', result.error || 'No se pudo enviar el correo');
      return;
    }

    setSubmitted(true);
    toast.success('Correo enviado', 'Revisa tu bandeja y sigue el enlace de recuperación');
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
            <h1 className="kx-public-heading font-semibold">Recuperar contraseña</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Ingresa tu correo. Te enviaremos un enlace seguro para crear una contraseña nueva.
            </p>
          </div>

          {submitted ? (
            <div className="mt-7 rounded-lg border border-zinc-200 bg-[#f7f7f5] p-5 text-sm leading-6 text-zinc-700">
              <p className="font-semibold text-zinc-950">Correo enviado</p>
              <p className="mt-1">
                Enviamos el enlace a <span className="font-semibold">{email}</span>.
                Revisa spam o correo corporativo si no aparece.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <label className="space-y-2 text-sm font-medium text-zinc-700">
                <span>Correo electrónico</span>
                <span className="relative block">
                  <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@empresa.com"
                    className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-11 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                    required
                  />
                </span>
              </label>

              <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
                <Send className="h-4 w-4" />
                Enviar enlace
              </Button>
            </form>
          )}

          <Link href="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-zinc-950 underline-offset-4 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Volver al login
          </Link>
        </AuthCard>
      </div>
    </main>
  );
}
