'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiClock, FiMail } from 'react-icons/fi';
import type { FreightTripStatus } from '@/lib/payments/trip-state';

interface TripStatusResponse {
    success?: boolean;
    data?: {
        tripStatus?: FreightTripStatus;
        canResumePayment?: boolean;
        sync?: {
            attempted?: boolean;
            error?: string | null;
        } | null;
    } | null;
}

function PaymentPendingPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const offerId = searchParams?.get('offer_id') || null;
    const applicationId = searchParams?.get('application_id') || null;
    const paymentId = searchParams?.get('payment_id') || searchParams?.get('collection_id') || null;
    const localPaymentId = searchParams?.get('local_payment_id') || null;
    const merchantOrderId = searchParams?.get('merchant_order_id') || null;
    const providerStatus = (searchParams?.get('status') || '').toLowerCase();

    const [tripStatus, setTripStatus] = useState<FreightTripStatus>('pending_confirmation');
    const [canResumePayment, setCanResumePayment] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [syncError, setSyncError] = useState<string | null>(null);

    const successHref = useMemo(() => {
        if (!offerId) return null;

        const params = new URLSearchParams({ offer_id: offerId });
        if (applicationId) params.set('application_id', applicationId);
        if (paymentId) params.set('payment_id', paymentId);
        if (localPaymentId) params.set('local_payment_id', localPaymentId);
        if (merchantOrderId) params.set('merchant_order_id', merchantOrderId);

        return `/pago/exitoso?${params.toString()}`;
    }, [applicationId, localPaymentId, merchantOrderId, offerId, paymentId]);

    const retryHref = useMemo(() => {
        if (!offerId) return null;

        const params = new URLSearchParams();
        if (applicationId) params.set('applicationId', applicationId);

        const query = params.toString();
        return query ? `/pagar/${offerId}?${query}` : `/pagar/${offerId}`;
    }, [applicationId, offerId]);

    useEffect(() => {
        let cancelled = false;
        let pollingTimer: ReturnType<typeof setTimeout> | null = null;

        async function loadTripStatus() {
            if (!offerId) {
                if (!cancelled) setIsChecking(false);
                return;
            }

            try {
                const params = new URLSearchParams({ offerId });
                if (paymentId) params.set('payment_id', paymentId);
                if (localPaymentId) params.set('local_payment_id', localPaymentId);
                if (merchantOrderId) params.set('merchant_order_id', merchantOrderId);
                if (paymentId || localPaymentId || merchantOrderId || providerStatus === 'approved') {
                    params.set('sync', '1');
                }

                const response = await fetch(`/api/payments/trip-status?${params.toString()}`, {
                    cache: 'no-store',
                });
                const payload = await response.json().catch(() => null) as TripStatusResponse | null;

                if (!response.ok || !payload?.success || !payload.data) {
                    throw new Error('No se pudo consultar el estado del pago');
                }

                if (cancelled) return;

                const nextTripStatus = payload.data.tripStatus || 'pending_confirmation';
                setTripStatus(nextTripStatus);
                setCanResumePayment(Boolean(payload.data.canResumePayment));
                setSyncError(payload.data.sync?.error || null);
                setIsChecking(false);

                if (successHref && ['confirmed', 'in_transit', 'completed'].includes(nextTripStatus)) {
                    router.replace(successHref);
                    return;
                }

                if (!['failed', 'awaiting_payment'].includes(nextTripStatus)) {
                    pollingTimer = setTimeout(() => {
                        void loadTripStatus();
                    }, 3000);
                }
            } catch (error) {
                if (!cancelled) {
                    setIsChecking(false);
                    setSyncError(error instanceof Error ? error.message : 'No se pudo validar el pago');
                    pollingTimer = setTimeout(() => {
                        void loadTripStatus();
                    }, 5000);
                }
            }
        }

        void loadTripStatus();

        return () => {
            cancelled = true;
            if (pollingTimer) clearTimeout(pollingTimer);
        };
    }, [localPaymentId, merchantOrderId, offerId, paymentId, providerStatus, router, successHref]);

    const headline = tripStatus === 'failed'
        ? 'Pago no confirmado'
        : isChecking
            ? 'Validando pago'
            : providerStatus === 'approved'
                ? 'Pago aprobado, cerrando reserva'
                : 'Pago pendiente';

    const description = tripStatus === 'failed'
        ? 'No logramos confirmar este cobro. Puedes reintentar el checkout si Mercado Pago no lo aprobo.'
        : providerStatus === 'approved'
            ? 'Mercado Pago reporto aprobacion. Estamos terminando de reservar el viaje y generar los PINs.'
            : 'Tu pago esta siendo procesado. Esto puede tomar unos minutos mientras confirmamos la reserva.';

    const showRetryButton = Boolean(retryHref) && (tripStatus === 'failed' || tripStatus === 'awaiting_payment');

    return (
        <main className="flex min-h-svh items-center justify-center bg-zinc-950 p-4 text-white sm:p-6">
            <div className="w-full max-w-md text-center">
                <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-lg border border-white/12 bg-white/8 sm:h-24 sm:w-24">
                    <FiClock className="h-10 w-10 animate-pulse text-white sm:h-12 sm:w-12" />
                </div>

                <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl">{headline}</h1>
                <p className="mb-8 text-sm leading-6 text-white/62 sm:text-base">{description}</p>

                <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
                    <div className="flex items-start gap-3 text-left">
                        <FiMail className="mt-1 h-6 w-6 flex-shrink-0 text-white" />
                        <div>
                            <h3 className="mb-1 font-medium text-white">Seguimiento en tiempo real</h3>
                            <p className="text-sm text-white/62">
                                Esta pantalla valida el pago contra tu reserva y te redirige sola cuando los PINs queden listos.
                            </p>
                        </div>
                    </div>
                </div>

                {(tripStatus === 'pending_confirmation' || isChecking || providerStatus === 'approved') && (
                    <div className="mb-6 flex items-center justify-center gap-2 text-white/62">
                        <div className="flex gap-1">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:0ms]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:150ms]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:300ms]" />
                        </div>
                        <span className="text-sm">Esperando confirmacion final</span>
                    </div>
                )}

                {syncError && (
                    <div className="mb-6 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-left text-sm text-white/72">
                        {syncError}
                    </div>
                )}

                {!showRetryButton && canResumePayment && (
                    <div className="mb-6 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-left text-sm text-white/72">
                        El pago ya no parece abandonado. Estamos esperando la confirmacion final antes de mostrar los PINs.
                    </div>
                )}

                <div className="space-y-3">
                    {showRetryButton && retryHref && (
                        <Link
                            href={retryHref}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-4 font-semibold text-zinc-950 transition-all hover:bg-zinc-200"
                        >
                            Retomar pago
                        </Link>
                    )}

                    <Link
                        href="/ofertas/mis-ofertas"
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-4 font-semibold text-white transition-all hover:bg-white/20"
                    >
                        Ver mis ofertas
                    </Link>

                    <Link
                        href="/dashboard"
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-4 font-semibold text-white transition-all hover:bg-white/20"
                    >
                        <FiArrowLeft className="h-5 w-5" />
                        Ir al dashboard
                    </Link>
                </div>
            </div>
        </main>
    );
}

export default function PaymentPendingPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-svh items-center justify-center bg-zinc-950">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
                </div>
            }
        >
            <PaymentPendingPageContent />
        </Suspense>
    );
}
