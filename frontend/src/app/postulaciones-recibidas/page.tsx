'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRight,
    Calendar,
    Clock,
    CreditCard,
    Eye,
    Loader2,
    Mail,
    MapPin,
    MessageSquare,
    Package,
    Phone,
    RefreshCw,
    Shield,
    User,
    X,
    XCircle,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { TruckerScoreBadge } from '@/components/trucker/TruckerScoreBadge';
import { formatCOP, getCityName } from '@/constants/colombia';
import { useAuthStore } from '@/features/auth/store/authStore';
import { extractApiErrorMessage } from '@/lib/contracts/api';
import { supabaseApi } from '@/lib/supabase/api-bridge';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type ApplicationStatus = 'pending' | 'accepted' | 'rejected';
type ApplicationDisplayState = 'pending' | 'awaiting_payment' | 'secured' | 'rejected';
type TabKey = 'all' | ApplicationDisplayState;

interface Application {
    id: string;
    offerId: string;
    truckerId: string;
    status: ApplicationStatus;
    proposedAmount: number | null;
    message: string | null;
    truckerName: string;
    truckerEmail: string;
    truckerPhone: string | null;
    yearsExperience: number | null;
    vehicleTypeConfirmed?: string | null;
    vehiclePlate?: string | null;
    licenseType?: string | null;
    hasInsurance?: boolean | null;
    createdAt: string;
    offer: Offer;
}

interface Offer {
    id: string;
    cargoType: string;
    originCity: string;
    destCity: string;
    pickupDate: string;
    budgetMax: number;
    applicationsCount: number;
    status: string;
}

function formatDate(dateString: string): string {
    if (!dateString) return 'Fecha por confirmar';

    try {
        return new Date(dateString).toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return dateString;
    }
}

function formatRelativeTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `hace ${Math.max(diffMins, 1)} min`;
        if (diffHours < 24) return `hace ${diffHours}h`;
        if (diffDays < 7) return `hace ${diffDays}d`;
        return formatDate(dateString);
    } catch {
        return '';
    }
}

function getApplicationDisplayState(application: Application): ApplicationDisplayState {
    if (application.status === 'rejected') return 'rejected';

    if (application.status === 'accepted') {
        const offerStatus = application.offer.status;
        if (offerStatus === 'reserved' || offerStatus === 'in_progress' || offerStatus === 'completed') {
            return 'secured';
        }
        return 'awaiting_payment';
    }

    return 'pending';
}

const STATE_COPY: Record<ApplicationDisplayState, { label: string; className: string; description: string }> = {
    pending: {
        label: 'Pendiente',
        className: 'border-zinc-200 bg-white text-zinc-700',
        description: 'Disponible para revisar y enviar a pago seguro.',
    },
    awaiting_payment: {
        label: 'Pago pendiente',
        className: 'border-zinc-950 bg-white text-zinc-950',
        description: 'Transportador seleccionado. Falta completar checkout.',
    },
    secured: {
        label: 'Asegurado',
        className: 'border-zinc-950 bg-zinc-950 text-white',
        description: 'La seleccion ya quedo asegurada por el flujo de pago.',
    },
    rejected: {
        label: 'Rechazado',
        className: 'border-zinc-200 bg-zinc-50 text-zinc-500',
        description: 'Candidato fuera de esta oportunidad.',
    },
};

const TABS: Array<{ id: TabKey; label: string }> = [
    { id: 'all', label: 'Todas' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'awaiting_payment', label: 'Pago pendiente' },
    { id: 'secured', label: 'Aseguradas' },
    { id: 'rejected', label: 'Rechazadas' },
];

function ApplicationSkeleton() {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="animate-pulse space-y-4">
                <div className="h-5 w-40 rounded bg-zinc-200" />
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="h-16 rounded-lg bg-zinc-100" />
                    <div className="h-16 rounded-lg bg-zinc-100" />
                    <div className="h-16 rounded-lg bg-zinc-100" />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ state }: { state: ApplicationDisplayState }) {
    const config = STATE_COPY[state];
    return (
        <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', config.className)}>
            {config.label}
        </span>
    );
}

function EmptyState({ activeTab }: { activeTab: TabKey }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-zinc-200 bg-white px-8 py-16 text-center shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]"
        >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                <User className="h-8 w-8 text-zinc-700" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">
                Sin candidatos visibles
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">
                {activeTab === 'all'
                    ? 'Cuando los transportadores se postulen a tus ofertas, apareceran agrupados por carga.'
                    : 'No hay postulaciones en este estado.'}
            </p>
        </motion.div>
    );
}

function DecisionModal({
    application,
    onClose,
    onConfirm,
    isProcessing,
}: {
    application: Application | null;
    onClose: () => void;
    onConfirm: (application: Application) => void;
    isProcessing: boolean;
}) {
    if (!application) return null;

    const displayState = getApplicationDisplayState(application);
    const amount = application.proposedAmount || application.offer.budgetMax || 0;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <button className="absolute inset-0 bg-black/40" aria-label="Cerrar modal" onClick={onClose} />
                <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 18, scale: 0.98 }}
                        className="max-h-[90svh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-[0_32px_90px_-52px_rgba(10,10,10,.85)]"
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-5">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Decision empresarial</p>
                                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                                    {displayState === 'awaiting_payment' ? 'Retomar pago' : 'Revisar seleccion'}
                                </h2>
                                <p className="mt-2 text-sm text-zinc-500">
                                    Confirma el resumen antes de continuar al checkout. La asignacion queda condicionada al flujo de pago.
                                </p>
                            </div>
                            <Button variant="outline" size="icon-sm" onClick={onClose} aria-label="Cerrar">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="space-y-4 p-5">
                            <div className="grid kx-safe-grid-sm gap-3">
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Transportador</p>
                                    <h3 className="mt-2 text-lg font-semibold text-zinc-950">{application.truckerName}</h3>
                                    <p className="mt-1 text-sm text-zinc-500">{application.truckerEmail || 'Correo no disponible'}</p>
                                    {application.truckerPhone && <p className="text-sm text-zinc-500">{application.truckerPhone}</p>}
                                </div>

                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Resumen financiero</p>
                                    <p className="font-money mt-2 text-2xl font-semibold text-zinc-950">{formatCOP(amount)}</p>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        {application.proposedAmount ? 'Monto propuesto por el transportador.' : 'Monto publicado por la empresa.'}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Operacion</p>
                                <div className="mt-3 grid kx-safe-grid-sm gap-3 text-sm text-zinc-600">
                                    <span className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-zinc-400" />
                                        {application.offer.cargoType}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-zinc-400" />
                                        {getCityName(application.offer.originCity)} a {getCityName(application.offer.destCity)}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-zinc-400" />
                                        {formatDate(application.offer.pickupDate)}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                                <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-950">
                                    <Shield className="h-4 w-4" />
                                    Condiciones visibles
                                </div>
                                No se promete liberacion automatica al transportador. La asignacion y el pago dependen del checkout, webhook, estado del viaje y evidencias operativas.
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50 p-5 sm:flex-row sm:justify-end">
                            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                                Cancelar
                            </Button>
                            <Button onClick={() => onConfirm(application)} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                Continuar a pago
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

function CandidateCard({
    application,
    onDecision,
    onReject,
    onCancelSelection,
    onViewOffer,
    isProcessing,
}: {
    application: Application;
    onDecision: (application: Application) => void;
    onReject: (application: Application) => void;
    onCancelSelection: (application: Application) => void;
    onViewOffer: (offerId: string) => void;
    isProcessing: boolean;
}) {
    const displayState = getApplicationDisplayState(application);
    const stateCopy = STATE_COPY[displayState];
    const awaitingPayment = displayState === 'awaiting_payment';
    const canAct = displayState === 'pending' || awaitingPayment;

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
                'kx-tight-card rounded-lg border bg-white p-4 transition hover:border-zinc-950',
                displayState === 'secured' || displayState === 'awaiting_payment' ? 'border-zinc-950' : 'border-zinc-200'
            )}
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-lg font-semibold text-white">
                            {application.truckerName?.charAt(0).toUpperCase() || 'T'}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-zinc-950">{application.truckerName}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                                {application.truckerEmail && (
                                    <span className="inline-flex items-center gap-1">
                                        <Mail className="h-3.5 w-3.5" />
                                        {application.truckerEmail}
                                    </span>
                                )}
                                {application.truckerPhone && (
                                    <span className="inline-flex items-center gap-1">
                                        <Phone className="h-3.5 w-3.5" />
                                        {application.truckerPhone}
                                    </span>
                                )}
                            </div>
                        </div>
                        <StatusBadge state={displayState} />
                    </div>

                    <div className="mt-4 grid kx-safe-grid-sm gap-3 text-sm text-zinc-600">
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Score</p>
                            <div className="mt-2 grayscale">
                                <TruckerScoreBadge truckerId={application.truckerId} compact />
                            </div>
                        </div>
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Experiencia</p>
                            <p className="mt-2 font-medium text-zinc-950">
                                {application.yearsExperience ? `${application.yearsExperience} anos` : 'Sin dato'}
                            </p>
                        </div>
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Monto</p>
                            <p className="font-money mt-2 font-semibold text-zinc-950">
                                {formatCOP(application.proposedAmount || application.offer.budgetMax || 0)}
                            </p>
                        </div>
                    </div>

                    {application.message && (
                        <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-600">
                            <div className="mb-1 flex items-center gap-2 font-medium text-zinc-950">
                                <MessageSquare className="h-4 w-4" />
                                Mensaje del transportador
                            </div>
                            {application.message}
                        </div>
                    )}

                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                        <Clock className="h-3.5 w-3.5" />
                        Postulado {formatRelativeTime(application.createdAt)}
                    </div>

                    <p className="mt-3 text-sm text-zinc-500">{stateCopy.description}</p>
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-56">
                    <Button variant="outline" onClick={() => onViewOffer(application.offerId)}>
                        <Eye className="h-4 w-4" />
                        Ver oferta
                    </Button>

                    {canAct && (
                        <>
                            <Button
                                onClick={() => onDecision(application)}
                                disabled={isProcessing}
                            >
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                {awaitingPayment ? 'Retomar pago' : 'Asegurar y pagar'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => (awaitingPayment ? onCancelSelection(application) : onReject(application))}
                                disabled={isProcessing}
                            >
                                <XCircle className="h-4 w-4" />
                                {awaitingPayment ? 'Liberar seleccion' : 'Rechazar'}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </motion.article>
    );
}

function OfferGroup({
    offer,
    applications,
    onDecision,
    onReject,
    onCancelSelection,
    onViewOffer,
    processingAppId,
}: {
    offer: Offer;
    applications: Application[];
    onDecision: (application: Application) => void;
    onReject: (application: Application) => void;
    onCancelSelection: (application: Application) => void;
    onViewOffer: (offerId: string) => void;
    processingAppId: string | null;
}) {
    return (
        <section className="kx-section rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
            <div className="flex flex-col gap-4 border-b border-zinc-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Oferta</p>
                    <h2 className="kx-route-title mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                        {getCityName(offer.originCity)}
                        <ArrowRight className="mx-2 inline h-4 w-4 align-[-2px] text-zinc-400" />
                        {getCityName(offer.destCity)}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-500">
                        <span className="inline-flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {offer.cargoType}
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {formatDate(offer.pickupDate)}
                        </span>
                        <span className="font-money font-semibold text-zinc-950">
                            {formatCOP(offer.budgetMax || 0)}
                        </span>
                    </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Candidatos</span>
                    <span className="text-2xl font-semibold text-zinc-950">{applications.length}</span>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                <AnimatePresence mode="popLayout">
                    {applications.map((application) => (
                        <CandidateCard
                            key={application.id}
                            application={application}
                            onDecision={onDecision}
                            onReject={onReject}
                            onCancelSelection={onCancelSelection}
                            onViewOffer={onViewOffer}
                            isProcessing={processingAppId === application.id}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </section>
    );
}

export default function ReceivedApplicationsPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    const [applications, setApplications] = React.useState<Application[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [processingAppId, setProcessingAppId] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState<TabKey>('all');
    const [decisionApplication, setDecisionApplication] = React.useState<Application | null>(null);

    React.useEffect(() => {
        if (user && user.userType !== 'business' && user.userType !== 'admin') {
            router.push('/dashboard');
        }
    }, [user, router]);

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const offersResult = await supabaseApi.offers.getMyOffers({});

            if (offersResult.success && offersResult.data) {
                const myOffers = offersResult.data as Offer[];
                const allApps: Application[] = [];

                for (const offer of myOffers) {
                    const appsResult = await supabaseApi.offers.getApplications(offer.id);
                    if (appsResult.success && appsResult.data) {
                        const apps = (appsResult.data as any[]).map((app: any) => ({
                            ...app,
                            offer: {
                                id: offer.id,
                                cargoType: offer.cargoType,
                                originCity: offer.originCity,
                                destCity: offer.destCity,
                                pickupDate: offer.pickupDate,
                                budgetMax: offer.budgetMax,
                                applicationsCount: offer.applicationsCount,
                                status: offer.status,
                            },
                        })) as Application[];
                        allApps.push(...apps);
                    }
                }

                allApps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setApplications(allApps);
            }
        } catch (err) {
            console.error('Error fetching applications:', err);
            toast.error('Error', 'No se pudieron cargar las postulaciones');
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleConfirmDecision = (application: Application) => {
        setDecisionApplication(null);
        router.push(`/pagar/${application.offerId}?applicationId=${application.id}`);
    };

    const handleCancelSelection = async (app: Application) => {
        setProcessingAppId(app.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                router.push('/login?redirect=' + encodeURIComponent('/postulaciones-recibidas'));
                return;
            }

            const response = await fetch('/api/payments/selection/cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    offerId: app.offerId,
                    applicationId: app.id,
                }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(extractApiErrorMessage(payload, 'No se pudo cancelar la seleccion'));
            }

            toast.success('Seleccion liberada', 'La oferta volvio a quedar abierta para decidir.');
            await fetchData();
        } catch (err) {
            console.error('Cancel selection error:', err);
            toast.error('Error', err instanceof Error ? err.message : 'No se pudo liberar la seleccion');
        } finally {
            setProcessingAppId(null);
        }
    };

    const handleReject = async (app: Application) => {
        setProcessingAppId(app.id);
        try {
            const result = await supabaseApi.offers.respondToApplication(app.offerId, app.id, {
                action: 'rejected',
                message: 'Tu postulacion no fue seleccionada para esta oferta.',
            });

            if (result.success) {
                toast.success('Postulacion rechazada');
                setApplications((prev) =>
                    prev.map((item) => (item.id === app.id ? { ...item, status: 'rejected' } : item))
                );
            } else {
                toast.error('Error', result.message || 'No se pudo rechazar');
            }
        } catch (err) {
            console.error('Reject error:', err);
            toast.error('Error', 'No se pudo procesar la solicitud');
        } finally {
            setProcessingAppId(null);
        }
    };

    const filteredApps = React.useMemo(() => {
        if (activeTab === 'all') return applications;
        return applications.filter((app) => getApplicationDisplayState(app) === activeTab);
    }, [applications, activeTab]);

    const stats = React.useMemo(() => {
        const initial: Record<TabKey, number> = {
            all: applications.length,
            pending: 0,
            awaiting_payment: 0,
            secured: 0,
            rejected: 0,
        };

        for (const app of applications) {
            initial[getApplicationDisplayState(app)] += 1;
        }

        return initial;
    }, [applications]);

    const groupedApps = React.useMemo(() => {
        const map = new Map<string, { offer: Offer; applications: Application[] }>();

        for (const app of filteredApps) {
            if (!map.has(app.offerId)) {
                map.set(app.offerId, { offer: app.offer, applications: [] });
            }
            map.get(app.offerId)?.applications.push(app);
        }

        return Array.from(map.values());
    }, [filteredApps]);

    return (
        <DashboardLayout pageTitle="Postulaciones Recibidas">
            <div className="kx-dashboard-bleed bg-[#f7f7f5]">
                <div className="kx-page-container">
                    <section className="kx-section rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] md:p-7">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-3xl">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Decision empresarial</p>
                                <h1 className="kx-fluid-title mt-2 font-semibold tracking-tight text-zinc-950">
                                    Postulaciones recibidas
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 md:text-base">
                                    Candidatos agrupados por oferta. Revisa score, monto, evidencia operativa y continua al pago solo cuando el flujo lo permite.
                                </p>
                            </div>

                            <Button variant="outline" className="h-12" onClick={fetchData} disabled={isLoading}>
                                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                                Actualizar
                            </Button>
                        </div>

                        <div className="mt-6 grid kx-safe-grid-sm gap-3">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        'rounded-lg border px-4 py-3 text-left transition',
                                        activeTab === tab.id
                                            ? 'border-zinc-950 bg-zinc-950 text-white'
                                            : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-950'
                                    )}
                                >
                                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{tab.label}</span>
                                    <span className="mt-1 block text-2xl font-semibold">{stats[tab.id]}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="mt-6 space-y-5">
                        {isLoading ? (
                            <div className="space-y-4">
                                {[...Array(3)].map((_, index) => <ApplicationSkeleton key={index} />)}
                            </div>
                        ) : groupedApps.length === 0 ? (
                            <EmptyState activeTab={activeTab} />
                        ) : (
                            groupedApps.map((group) => (
                                <OfferGroup
                                    key={group.offer.id}
                                    offer={group.offer}
                                    applications={group.applications}
                                    onDecision={setDecisionApplication}
                                    onReject={handleReject}
                                    onCancelSelection={handleCancelSelection}
                                    onViewOffer={(offerId) => router.push(`/ofertas/${offerId}`)}
                                    processingAppId={processingAppId}
                                />
                            ))
                        )}
                    </section>
                </div>

                <DecisionModal
                    application={decisionApplication}
                    onClose={() => setDecisionApplication(null)}
                    onConfirm={handleConfirmDecision}
                    isProcessing={Boolean(processingAppId)}
                />
            </div>
        </DashboardLayout>
    );
}
