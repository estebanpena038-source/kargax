'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiMessageCircle, FiRefreshCw, FiXCircle } from 'react-icons/fi';

function PaymentFailurePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const offerId = searchParams?.get('offer_id') || null;
    const applicationId = searchParams?.get('application_id') || null;
    const retryHref = offerId
        ? `/pagar/${offerId}${applicationId ? `?applicationId=${applicationId}` : ''}`
        : null;

    return (
        <main className="flex min-h-svh items-center justify-center bg-zinc-950 p-4 text-white sm:p-6">
            <div className="w-full max-w-md text-center">
                <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-lg border border-white/12 bg-white/8 sm:h-24 sm:w-24">
                    <FiXCircle className="h-10 w-10 text-white sm:h-12 sm:w-12" />
                </div>

                <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Pago no completado</h1>
                <p className="mb-8 text-sm leading-6 text-white/62 sm:text-base">
                    No logramos confirmar este pago. Si tu banco lo muestra pendiente, espera la validacion o contacta soporte con la referencia.
                </p>

                <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-4 text-left backdrop-blur-xl sm:p-6">
                    <h3 className="mb-3 text-sm font-medium text-white/62">Posibles razones:</h3>
                    <ul className="space-y-2 text-sm text-white/72">
                        <li className="flex items-start gap-2">
                            <span className="mt-1 text-white/42">-</span>
                            Fondos insuficientes en la cuenta.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1 text-white/42">-</span>
                            Tarjeta rechazada por el banco.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1 text-white/42">-</span>
                            Tiempo de sesion expirado.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1 text-white/42">-</span>
                            El pago fue cancelado antes de confirmarse.
                        </li>
                    </ul>
                </div>

                <div className="space-y-3">
                    {retryHref && (
                        <Link
                            href={retryHref}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-4 font-semibold text-zinc-950 transition-all hover:bg-zinc-200"
                        >
                            <FiRefreshCw className="h-5 w-5" />
                            Intentar de nuevo
                        </Link>
                    )}

                    <button
                        onClick={() => router.back()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-4 font-semibold text-white transition-all hover:bg-white/20"
                    >
                        <FiArrowLeft className="h-5 w-5" />
                        Volver
                    </button>

                    <Link
                        href="/soporte"
                        className="flex w-full items-center justify-center gap-2 py-3 text-white/62 transition-colors hover:text-white"
                    >
                        <FiMessageCircle className="h-5 w-5" />
                        Contactar soporte
                    </Link>
                </div>
            </div>
        </main>
    );
}

export default function PaymentFailurePage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-svh items-center justify-center bg-zinc-950">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
                </div>
            }
        >
            <PaymentFailurePageContent />
        </Suspense>
    );
}
