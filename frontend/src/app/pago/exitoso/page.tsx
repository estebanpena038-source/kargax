'use client';

/**
 * =============================================================================
 * KARGAX - PAYMENT SUCCESS PAGE
 * /pago/exitoso
 * 
 * Shows success message and next steps after successful payment
 * Uses amber/slate color scheme consistent with the rest of the app
 * =============================================================================
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { motion } from 'framer-motion';
import {
    CheckCircle2, Truck, MessageSquare, Phone, Shield, Copy, Check,
    MapPin, Clock, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getCityName } from '@/constants/colombia';
import type { FreightTripStatus } from '@/lib/payments/trip-state';

interface OfferData {
    id: string;
    origin_city: string;
    destination_city: string;
    pickup_pin?: string;
    delivery_pin?: string;
    pickup_contact_name?: string;
    pickup_contact_phone?: string;
    delivery_contact_name?: string;
    delivery_contact_phone?: string;
    total_amount?: number;
    assigned_trucker?: {
        full_name: string;
        phone: string;
    };
}

function PaymentSuccessPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const offerId = searchParams?.get('offer_id') || null;
    const applicationId = searchParams?.get('application_id') || null;
    const paymentId = searchParams?.get('payment_id') || searchParams?.get('collection_id') || null;
    const localPaymentId = searchParams?.get('local_payment_id') || null;
    const merchantOrderId = searchParams?.get('merchant_order_id') || null;
    const providerStatus = (searchParams?.get('status') || '').toLowerCase();

    const [offer, setOffer] = useState<OfferData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copiedPin, setCopiedPin] = useState<string | null>(null);
    const [isAwaitingSettlement, setIsAwaitingSettlement] = useState(false);
    const [tripStatus, setTripStatus] = useState<FreightTripStatus | null>(null);
    const [paymentSyncing, setPaymentSyncing] = useState(true);
    const [syncError, setSyncError] = useState<string | null>(null);

    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);

    const failureHref = useMemo(() => {
        if (!offerId) {
            return null;
        }

        const params = new URLSearchParams({ offer_id: offerId });

        if (applicationId) {
            params.set('application_id', applicationId);
        }

        if (paymentId) {
            params.set('payment_id', paymentId);
        }

        if (localPaymentId) {
            params.set('local_payment_id', localPaymentId);
        }

        if (merchantOrderId) {
            params.set('merchant_order_id', merchantOrderId);
        }

        return `/pago/fallido?${params.toString()}`;
    }, [applicationId, localPaymentId, merchantOrderId, offerId, paymentId]);

    useEffect(() => {
        let cancelled = false;
        let pollingTimer: ReturnType<typeof setTimeout> | null = null;

        async function syncTripStatus() {
            if (!offerId) {
                if (!cancelled) {
                    setPaymentSyncing(false);
                }
                return;
            }

            try {
                const params = new URLSearchParams({ offerId });

                if (paymentId) {
                    params.set('payment_id', paymentId);
                }

                if (localPaymentId) {
                    params.set('local_payment_id', localPaymentId);
                }

                if (merchantOrderId) {
                    params.set('merchant_order_id', merchantOrderId);
                }

                if (paymentId || localPaymentId || merchantOrderId || providerStatus === 'approved') {
                    params.set('sync', '1');
                }

                const response = await fetch(`/api/payments/trip-status?${params.toString()}`, {
                    cache: 'no-store',
                });
                const payload = await response.json().catch(() => null) as {
                    success?: boolean;
                    data?: {
                        tripStatus?: FreightTripStatus;
                        offer?: {
                            pickupPin?: string | null;
                            deliveryPin?: string | null;
                            pickupVerifiedAt?: string | null;
                            deliveryVerifiedAt?: string | null;
                        } | null;
                        sync?: {
                            error?: string | null;
                        } | null;
                    } | null;
                } | null;

                if (!response.ok || !payload?.success || !payload.data) {
                    throw new Error('No se pudo validar el estado del pago');
                }

                if (cancelled) {
                    return;
                }

                const nextTripStatus = payload.data.tripStatus || null;
                setTripStatus(nextTripStatus);
                setSyncError(payload.data.sync?.error || null);
                setPaymentSyncing(false);

                // Merge PINs from trip-status (uses service_role, guaranteed access)
                const serverOffer = payload.data.offer;
                if (serverOffer?.pickupPin && serverOffer?.deliveryPin) {
                    setOffer(prev => {
                        const base = prev || {
                            id: offerId!,
                            origin_city: '',
                            destination_city: '',
                        };
                        return {
                            ...base,
                            pickup_pin: base.pickup_pin || serverOffer.pickupPin || undefined,
                            delivery_pin: base.delivery_pin || serverOffer.deliveryPin || undefined,
                        };
                    });
                    setIsAwaitingSettlement(false);
                }

                if (nextTripStatus === 'failed' && failureHref) {
                    router.replace(failureHref);
                    return;
                }

                // Keep polling if PINs haven't been confirmed yet
                const hasPinsFromServer = Boolean(serverOffer?.pickupPin && serverOffer?.deliveryPin);
                if (
                    !hasPinsFromServer &&
                    (!nextTripStatus || ['awaiting_payment', 'pending_confirmation'].includes(nextTripStatus))
                ) {
                    pollingTimer = setTimeout(() => {
                        void syncTripStatus();
                    }, 3000);
                } else if (!nextTripStatus || ['awaiting_payment', 'pending_confirmation'].includes(nextTripStatus)) {
                    pollingTimer = setTimeout(() => {
                        void syncTripStatus();
                    }, 3000);
                }
            } catch (error) {
                if (!cancelled) {
                    setPaymentSyncing(false);
                    setSyncError(error instanceof Error ? error.message : 'No se pudo sincronizar el pago');
                    pollingTimer = setTimeout(() => {
                        void syncTripStatus();
                    }, 5000);
                }
            }
        }

        void syncTripStatus();

        return () => {
            cancelled = true;
            if (pollingTimer) {
                clearTimeout(pollingTimer);
            }
        };
    }, [failureHref, localPaymentId, merchantOrderId, offerId, paymentId, providerStatus, router]);

    useEffect(() => {
        let cancelled = false;
        let pollingTimer: ReturnType<typeof setTimeout> | null = null;
        let attempt = 0;
        const maxAttempts = 10;

        async function loadOffer() {
            if (!offerId) {
                if (!cancelled) {
                    setLoading(false);
                }
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('cargo_offers')
                    .select(`
                        id,
                        origin_city,
                        destination_city,
                        pickup_pin,
                        delivery_pin,
                        pickup_contact_name,
                        pickup_contact_phone,
                        delivery_contact_name,
                        delivery_contact_phone,
                        total_amount,
                        assigned_trucker_id
                    `)
                    .eq('id', offerId)
                    .single();

                if (error) throw error;

                // Get trucker info
                let truckerInfo: OfferData['assigned_trucker'] | null = null;
                if (data.assigned_trucker_id) {
                    const { data: trucker } = await supabase
                        .from('user_profiles')
                        .select('full_name, phone')
                        .eq('id', data.assigned_trucker_id)
                        .single();
                    truckerInfo = trucker
                        ? {
                            full_name: trucker.full_name,
                            phone: trucker.phone,
                        }
                        : null;
                }

                const hydratedOffer = {
                    ...data,
                    assigned_trucker: truckerInfo || undefined,
                };

                if (cancelled) {
                    return;
                }

                setOffer(hydratedOffer);

                const hasOperationalArtifacts =
                    Boolean(hydratedOffer.pickup_pin) &&
                    Boolean(hydratedOffer.delivery_pin);

                if (!hasOperationalArtifacts && attempt < maxAttempts) {
                    setIsAwaitingSettlement(true);
                    attempt += 1;
                    pollingTimer = setTimeout(() => {
                        void loadOffer();
                    }, 3000);
                } else {
                    setIsAwaitingSettlement(false);
                }
            } catch (err) {
                console.error('Error loading offer:', err);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadOffer();

        return () => {
            cancelled = true;
            if (pollingTimer) {
                clearTimeout(pollingTimer);
            }
        };
    }, [offerId, supabase]);

    const copyToClipboard = async (text: string, type: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedPin(type);
            setTimeout(() => setCopiedPin(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const showSettlementBanner =
        (
            isAwaitingSettlement
            || paymentSyncing
            || tripStatus === 'pending_confirmation'
            || (
                providerStatus === 'approved'
                && (!tripStatus || ['awaiting_payment', 'pending_confirmation'].includes(tripStatus))
            )
        )
        && !(offer?.pickup_pin && offer?.delivery_pin);

    if (loading) {
        return (
            <DashboardLayout pageTitle="Pago Exitoso">
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-zinc-950"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Pago Exitoso">
            <div className="mx-auto w-full max-w-3xl">
                {/* Success Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-lg bg-zinc-950 shadow-lg">
                        <CheckCircle2 className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">¡Pago Exitoso!</h1>
                    <p className="text-slate-600">
                        El camión ha sido asegurado para tu carga
                    </p>
                    {showSettlementBanner && (
                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Confirmando PINs y datos finales del viaje...
                        </div>
                    )}
                    {syncError && (
                        <div className="mt-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                            {syncError}
                        </div>
                    )}
                </motion.div>

                {/* Route Card */}
                {offer && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-6 rounded-lg bg-zinc-950 p-4 text-white shadow-lg sm:p-6"
                    >
                        <div className="flex flex-col items-center justify-center gap-4 min-[460px]:flex-row">
                            <div className="min-w-0 text-center">
                                <MapPin className="w-5 h-5 mx-auto mb-1 opacity-80" />
                                <p className="font-semibold">{getCityName(offer.origin_city)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-px w-8 bg-white/40 sm:w-12"></div>
                                <Truck className="w-6 h-6" />
                                <div className="h-px w-8 bg-white/40 sm:w-12"></div>
                            </div>
                            <div className="min-w-0 text-center">
                                <MapPin className="w-5 h-5 mx-auto mb-1 opacity-80" />
                                <p className="font-semibold">{getCityName(offer.destination_city)}</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Main Content Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                    {/* Trucker Info */}
                    {offer?.assigned_trucker && (
                        <div className="border-b border-slate-100 p-4 sm:p-6">
                            <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                Tu Camionero Asignado
                            </h3>
                            <div className="flex flex-col gap-4 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-lg font-bold text-white">
                                        {offer.assigned_trucker.full_name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-900">{offer.assigned_trucker.full_name}</p>
                                        <p className="text-sm text-slate-500">{offer.assigned_trucker.phone}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <a
                                        href={`tel:${offer.assigned_trucker.phone}`}
                                        className="rounded-lg border border-zinc-200 bg-white p-3 text-zinc-700 transition-colors hover:bg-zinc-100"
                                    >
                                        <Phone className="w-5 h-5" />
                                    </a>
                                    <Link
                                        href={`/mensajes?offer=${offerId}`}
                                        className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
                                    >
                                        <MessageSquare className="w-5 h-5" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PINs Section */}
                    <div className="border-b border-slate-100 p-4 sm:p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                                <Shield className="h-5 w-5 text-zinc-700" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">Códigos PIN de Verificación</h3>
                                <p className="text-sm text-slate-500">
                                    {showSettlementBanner
                                        ? 'Estamos terminando de confirmar el pago con Mercado Pago y generando los PINs.'
                                        : 'Los PINs han sido enviados por WhatsApp a los contactos. El camionero los necesitará.'}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Pickup PIN */}
                            <div className="rounded-lg bg-slate-50 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">PIN Recogida</span>
                                    <button
                                        onClick={() => offer?.pickup_pin && copyToClipboard(offer.pickup_pin, 'pickup')}
                                        className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        {copiedPin === 'pickup' ? (
                                            <Check className="h-4 w-4 text-zinc-950" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-slate-400" />
                                        )}
                                    </button>
                                </div>
                                <p className="font-money text-2xl font-bold tracking-widest text-zinc-950 min-[380px]:text-3xl">
                                    {offer?.pickup_pin || '----'}
                                </p>
                                {offer?.pickup_contact_name && (
                                    <p className="text-xs text-slate-500 mt-2">
                                        Enviado a: {offer.pickup_contact_name}
                                    </p>
                                )}
                            </div>

                            {/* Delivery PIN */}
                            <div className="rounded-lg bg-slate-50 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">PIN Entrega</span>
                                    <button
                                        onClick={() => offer?.delivery_pin && copyToClipboard(offer.delivery_pin, 'delivery')}
                                        className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        {copiedPin === 'delivery' ? (
                                            <Check className="h-4 w-4 text-zinc-950" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-slate-400" />
                                        )}
                                    </button>
                                </div>
                                <p className="font-money text-2xl font-bold tracking-widest text-zinc-950 min-[380px]:text-3xl">
                                    {offer?.delivery_pin || '----'}
                                </p>
                                {offer?.delivery_contact_name && (
                                    <p className="text-xs text-slate-500 mt-2">
                                        Enviado a: {offer.delivery_contact_name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Next Steps */}
                    <div className="p-4 sm:p-6">
                        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-zinc-600" />
                            Próximos Pasos
                        </h3>
                        <div className="space-y-3">
                            {[
                                'El camionero irá a recoger la carga en la fecha acordada',
                                'El contacto en origen le dará el PIN de recogida',
                                'Al llegar a destino, entrega el PIN de entrega para liberar el pago',
                                'Recibirás una notificación cuando el viaje esté completado',
                            ].map((step, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
                                        {index + 1}
                                    </span>
                                    <span className="text-slate-600 text-sm">{step}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:p-6">
                        <Link
                            href="/ofertas/mis-ofertas"
                            className="flex-1 rounded-lg bg-zinc-950 px-4 py-3 text-center font-semibold text-white transition-all hover:bg-zinc-800"
                        >
                            Ver Mis Ofertas
                        </Link>
                        <Link
                            href="/dashboard"
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center font-semibold text-slate-700 transition-all hover:bg-slate-100"
                        >
                            Ir al Dashboard
                        </Link>
                    </div>
                </motion.div>
            </div>
        </DashboardLayout>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-950 border-t-transparent" />
                </div>
            }
        >
            <PaymentSuccessPageContent />
        </Suspense>
    );
}
