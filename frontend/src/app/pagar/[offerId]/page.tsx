'use client';

/**
 * =============================================================================
 * KARGAX - PAYMENT CHECKOUT PAGE (GOOGLE PAY STYLE - WHITE THEME)
 * /pagar/[offerId]/page.tsx
 * 
 * Diseño limpio estilo Google Pay con fondo blanco y tarjetas elegantes
 * =============================================================================
 */

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase, getSessionWithRetry } from '@/lib/supabase/client';
import { refreshSession } from '@/lib/supabase/auth';
import { syncSessionBridge } from '@/lib/auth/session-bridge';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Truck,
    MapPin,
    DollarSign,
    Shield,
    CheckCircle2,
    AlertCircle,
    Package,
    Calendar,
    Phone,
    User,
    Loader2,
    CreditCard,
    Lock,
    ChevronRight,
    Sparkles,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card } from '@/components/ui';
import { formatCOP, getCityName, getDepartmentName } from '@/constants/colombia';
import { extractApiErrorMessage, unwrapApiEnvelope } from '@/lib/contracts/api';
import { cn } from '@/lib/utils';

// Types
interface Offer {
    id: string;
    cargo_type: string;
    cargo_description: string;
    origin_city: string;
    origin_department: string;
    origin_address?: string;
    destination_city: string;
    destination_department: string;
    destination_address?: string;
    total_amount: number;
    pickup_date: string;
    delivery_date?: string;
    pickup_contact_name?: string;
    pickup_contact_phone?: string;
    delivery_contact_name?: string;
    delivery_contact_phone?: string;
    weight_kg?: number;
    required_vehicle?: string;
    special_requirements?: string;
    manifest_items?: { name: string; quantity: number }[];
    status: string;
    trucker?: {
        full_name: string;
        phone: string;
        avatar_url?: string;
    };
}

interface PaymentAmounts {
    freight: number;
    platformFee: number;
    total: number;
}

interface PaymentApplication {
    id: string;
    trucker_id: string;
    status: string;
    created_at: string;
}

interface PreferenceResponse {
    preference: {
        id: string;
        init_point: string | null;
        sandbox_init_point: string | null;
    };
    amounts: PaymentAmounts;
    payment: {
        id: string;
        offerId: string;
        applicationId: string;
        status: string;
    };
    idempotencyKey: string;
}

async function resolveValidBrowserSession() {
    const { session } = await getSessionWithRetry(3);
    let activeSession = session;

    const isSessionExpiring =
        !!activeSession?.expires_at
        && activeSession.expires_at * 1000 <= Date.now() + 30_000;

    if (!activeSession?.access_token || isSessionExpiring) {
        activeSession = await refreshSession();
    }

    if (activeSession?.access_token) {
        await syncSessionBridge(activeSession);
    }

    return activeSession;
}

// Helper functions
function formatDate(dateString: string): string {
    try {
        return new Date(dateString).toLocaleDateString('es-CO', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return dateString;
    }
}




// =============================================================================
// SUBCOMPONENTS
// =============================================================================

/**
 * Step indicator component
 */
function StepIndicator({ step, title, active, completed }: {
    step: number;
    title: string;
    active: boolean;
    completed: boolean;
}) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all',
                completed
                    ? 'bg-zinc-950 text-white'
                    : active
                        ? 'bg-zinc-950 text-white ring-4 ring-zinc-950/10'
                        : 'bg-slate-100 text-slate-400'
            )}>
                {completed ? <CheckCircle2 className="w-5 h-5" /> : step}
            </div>
            <span className={cn(
                'hidden text-sm font-medium sm:block',
                active ? 'text-slate-900' : 'text-slate-400'
            )}>
                {title}
            </span>
        </div>
    );
}

/**
 * Route visualization (origin to destination)
 */
function RouteCard({ offer }: { offer: Offer }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Ruta del Viaje
            </h3>

            <div className="flex items-start gap-4">
                {/* Timeline */}
                <div className="flex flex-col items-center pt-1">
                    <div className="h-3 w-3 rounded-full bg-zinc-950 ring-4 ring-zinc-950/10" />
                    <div className="h-16 w-px bg-zinc-300" />
                    <div className="h-3 w-3 rounded-full bg-zinc-950 ring-4 ring-zinc-950/10" />
                </div>

                {/* Locations */}
                <div className="min-w-0 flex-1 space-y-4">
                    {/* Origin */}
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Origen</p>
                        <p className="text-lg font-semibold text-slate-900 mt-0.5">
                            {getCityName(offer.origin_city)}
                        </p>
                        <p className="text-sm text-slate-500">
                            {getDepartmentName(offer.origin_department)}
                        </p>
                        {offer.origin_address && (
                            <p className="text-sm text-slate-400 mt-1">{offer.origin_address}</p>
                        )}
                    </div>

                    {/* Destination */}
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Destino</p>
                        <p className="text-lg font-semibold text-slate-900 mt-0.5">
                            {getCityName(offer.destination_city)}
                        </p>
                        <p className="text-sm text-slate-500">
                            {getDepartmentName(offer.destination_department)}
                        </p>
                        {offer.destination_address && (
                            <p className="text-sm text-slate-400 mt-1">{offer.destination_address}</p>
                        )}
                    </div>
                </div>

                {/* Dates */}
                <div className="text-right text-sm hidden md:block">
                    <div className="flex items-center gap-2 text-slate-500 mb-3">
                        <Calendar className="w-4 h-4" />
                        <span>{offer.pickup_date ? formatDate(offer.pickup_date) : 'Sin fecha'}</span>
                    </div>
                    {offer.delivery_date && (
                        <div className="flex items-center gap-2 text-slate-500">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(offer.delivery_date)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Trucker info card
 */
function TruckerCard({ trucker }: { trucker?: { full_name: string; phone: string } }) {
    if (!trucker) return null;

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Transportador Asignado
            </h3>

            <div className="flex flex-col gap-4 min-[460px]:flex-row min-[460px]:items-center">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xl font-bold text-white shadow-lg">
                    {trucker.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-slate-900">{trucker.full_name}</p>
                    <div className="flex items-center gap-2 text-slate-500 mt-1">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">{trucker.phone}</span>
                    </div>
                </div>
                <div className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Verificado
                </div>
            </div>
        </div>
    );
}

/**
 * Cargo summary card
 */
function CargoCard({ offer }: { offer: Offer }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Detalles de la Carga
            </h3>

            <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2">
                <div>
                    <p className="text-xs text-slate-400 uppercase">Tipo</p>
                    <p className="font-medium text-slate-900 capitalize">{offer.cargo_type?.replace('_', ' ')}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase">Peso</p>
                    <p className="font-medium text-slate-900">
                        {offer.weight_kg ? `${offer.weight_kg.toLocaleString()} kg` : 'No especificado'}
                    </p>
                </div>
            </div>

            {offer.cargo_description && (
                <p className="text-sm text-slate-600 mt-4 p-3 bg-slate-50 rounded-lg">
                    {offer.cargo_description}
                </p>
            )}
        </div>
    );
}

/**
 * Payment method badge
 */
function PaymentMethodBadge({ method, icon }: { method: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
            {icon || <CreditCard className="w-4 h-4 text-slate-400" />}
            <span className="text-sm font-medium text-slate-600">{method}</span>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function PaymentCheckoutPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const offerId = params?.offerId as string | undefined;
    const requestedApplicationId = searchParams?.get('applicationId') || null;

    const [offer, setOffer] = useState<Offer | null>(null);
    const [loading, setLoading] = useState(true);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [amounts, setAmounts] = useState<PaymentAmounts | null>(null);
    const [applicationId, setApplicationId] = useState<string | null>(null);

    // Load offer data
    const loadOffer = useCallback(async () => {
        if (!offerId) return;

        try {
            const { session, error: sessionError } = await getSessionWithRetry(3);
            const redirectPath = requestedApplicationId
                ? `/pagar/${offerId}?applicationId=${requestedApplicationId}`
                : `/pagar/${offerId}`;

            if (sessionError || !session) {
                router.push('/login?redirect=' + encodeURIComponent(redirectPath));
                return;
            }

            const { data, error: fetchError } = await supabase
                .from('cargo_offers')
                .select('*')
                .eq('id', offerId)
                .single();

            if (fetchError || !data) {
                setError('Oferta no encontrada');
                setLoading(false);
                return;
            }

            const offerData = data as any;

            // Get pending application
            const { data: applications, error: applicationsError } = await supabase
                .from('offer_applications')
                .select('id, trucker_id, status, created_at')
                .eq('offer_id', offerId)
                .in('status', ['pending', 'accepted'])
                .order('created_at', { ascending: false });

            if (applicationsError) {
                throw applicationsError;
            }

            const eligibleApplications = (applications || []) as PaymentApplication[];

            if (eligibleApplications.length === 0) {
                setError('No hay postulación pendiente para esta oferta');
                setLoading(false);
                return;
            }

            const selectedApplication = requestedApplicationId
                ? eligibleApplications.find(app => app.id === requestedApplicationId) || null
                : eligibleApplications.length === 1
                    ? eligibleApplications[0]
                    : null;

            if (!selectedApplication) {
                setError(
                    requestedApplicationId
                        ? 'La postulación seleccionada no está disponible para esta oferta'
                        : 'Selecciona una postulación específica desde la lista antes de pagar'
                );
                setLoading(false);
                return;
            }

            setApplicationId(selectedApplication.id);

            // Get trucker info
            const { data: truckerProfile } = await supabase
                .from('user_profiles')
                .select('full_name, phone, avatar_url')
                .eq('id', selectedApplication.trucker_id)
                .single();

            setOffer({
                ...offerData,
                trucker: truckerProfile || undefined,
            });

            // Calculate amounts
            const platformFeePercent = parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT || '10');
            const platformFee = Math.round(offerData.total_amount * platformFeePercent / 100);
            setAmounts({
                freight: offerData.total_amount,
                platformFee,
                total: offerData.total_amount + platformFee,
            });

        } catch (err) {
            console.error('Error loading offer:', err);
            setError('Error al cargar la información');
        } finally {
            setLoading(false);
        }
    }, [offerId, requestedApplicationId, router]);

    useEffect(() => {
        loadOffer();
    }, [loadOffer]);

    // Handle payment
    const handlePayment = async () => {
        if (!offer || !applicationId) return;

        setProcessingPayment(true);
        setError(null);

        try {
            let session = await resolveValidBrowserSession();

            if (!session?.access_token) {
                router.push('/login?redirect=/pagar/' + offerId);
                return;
            }

            let response = await fetch('/api/payments/create-preference', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    offerId: offer.id,
                    applicationId: applicationId,
                }),
            });

            if (response.status === 401) {
                session = await refreshSession();

                if (session?.access_token) {
                    await syncSessionBridge(session);
                    response = await fetch('/api/payments/create-preference', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                            offerId: offer.id,
                            applicationId: applicationId,
                        }),
                    });
                }
            }

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(extractApiErrorMessage(payload, 'Error al crear el pago'));
            }

            const result = unwrapApiEnvelope<PreferenceResponse>(payload);

            if (!result) {
                throw new Error('No se pudo interpretar la respuesta del pago');
            }

            // Always prefer production checkout URL
            const checkoutUrl = result.preference.init_point || result.preference.sandbox_init_point;

            if (!checkoutUrl) {
                throw new Error('No se pudo obtener la URL de checkout');
            }

            window.location.href = checkoutUrl;

        } catch (err: any) {
            console.error('Payment error:', err);
            setError(err.message || 'Error al procesar el pago');
            setProcessingPayment(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <DashboardLayout pageTitle="Confirmar Pago">
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto mb-4" />
                        <p className="text-slate-500">Cargando información del pago...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // Error state
    if (error && !offer) {
        return (
            <DashboardLayout pageTitle="Error">
                <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">{error}</h2>
                    <Button onClick={() => router.back()} variant="outline">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Confirmar Pago">
            {/* Clean white background */}
            <div className="-m-4 min-h-svh bg-slate-50 p-4 sm:-m-6 sm:p-6">
                {/* Header */}
                <div className="mx-auto mb-8 w-full max-w-5xl">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span>Volver</span>
                    </button>

                    {/* Steps */}
                    <div className="mb-8 flex items-center justify-between gap-2 overflow-x-auto pb-1">
                        <StepIndicator step={1} title="Revisar" active={true} completed={false} />
                        <div className="flex-1 h-px bg-slate-200 mx-4 hidden sm:block" />
                        <StepIndicator step={2} title="Pagar" active={false} completed={false} />
                        <div className="flex-1 h-px bg-slate-200 mx-4 hidden sm:block" />
                        <StepIndicator step={3} title="Confirmar" active={false} completed={false} />
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Confirmar Pago</h1>
                    <p className="text-slate-500 mt-1">Revisa los detalles y asegura tu transporte</p>
                </div>

                <div className="mx-auto w-full max-w-3xl space-y-6">
                    {/* Trip Details */}
                    <div className="space-y-6">
                        {/* Route Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <RouteCard offer={offer!} />
                        </motion.div>

                        {/* Trucker Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <TruckerCard trucker={offer?.trucker} />
                        </motion.div>

                        {/* Cargo Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <CargoCard offer={offer!} />
                        </motion.div>
                    </div>

                    {/* Payment Summary */}
                    <div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
                        >
                            {/* Header */}
                            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-6">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-950 shadow-lg">
                                    <DollarSign className="h-6 w-6 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-semibold text-slate-900">Resumen de Pago</h2>
                                    <p className="text-sm text-slate-500">Transacción segura</p>
                                </div>
                            </div>

                            {/* Amounts */}
                            <div className="space-y-4 mb-6">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-600">Flete al camionero</span>
                                    <span className="font-money text-right font-medium text-slate-900">{formatCOP(amounts?.freight || 0)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-600">Comisión plataforma (8%)</span>
                                    <span className="font-money text-right font-medium text-slate-900">{formatCOP(amounts?.platformFee || 0)}</span>
                                </div>
                                <div className="h-px bg-slate-100" />
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-lg font-semibold text-slate-900">Total</span>
                                    <span className="font-money text-right text-2xl font-bold text-zinc-950">
                                        {formatCOP(amounts?.total || 0)}
                                    </span>
                                </div>
                            </div>

                            {/* Security Badge */}
                            <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                                        <Shield className="h-5 w-5 text-zinc-700" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-zinc-950">Pago protegido</h4>
                                        <p className="mt-0.5 text-sm text-zinc-600">
                                            KargaX valida el proveedor, la reserva y los PINs antes de cerrar el viaje.
                                        </p>
                                    </div>
                                </div>
                            </div>



                            {/* Error Message */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                                >
                                    <div className="flex items-center gap-3 text-zinc-700">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Pay Button */}
                            <Button
                                onClick={handlePayment}
                                disabled={processingPayment}
                                className="h-14 w-full rounded-lg bg-zinc-950 text-base font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 sm:text-lg"
                            >
                                {processingPayment ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Procesando...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Lock className="w-5 h-5" />
                                        <span>Pagar con Mercado Pago</span>
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                )}
                            </Button>

                            {/* Payment Methods */}
                            <div className="mt-6">
                                <p className="text-xs text-slate-400 text-center mb-3">
                                    Métodos de pago aceptados
                                </p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <PaymentMethodBadge method="PSE" />
                                    <PaymentMethodBadge method="Tarjeta" />
                                    <PaymentMethodBadge method="Efecty" />
                                    <PaymentMethodBadge method="Nequi" />
                                </div>
                            </div>

                            {/* Trust badges */}
                            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-slate-100">
                                <Lock className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-400">
                                    256-bit SSL · Datos encriptados
                                </span>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function PaymentCheckoutPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-white flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <PaymentCheckoutPageContent />
        </Suspense>
    );
}
