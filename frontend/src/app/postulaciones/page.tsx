'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRight,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronRight,
    Clock3,
    MapPin,
    Package,
    RefreshCw,
    Send,
    Truck,
    XCircle,
    Loader2,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { formatCOP, getCityName, getDepartmentName } from '@/constants/colombia';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { TruckerJobStatus } from '@/lib/payments/trip-state';
import { supabaseApi } from '@/lib/supabase/api-bridge';
import { cn } from '@/lib/utils';
import warehouseClient from '@/lib/warehouses/client';

type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
type WorkStage = 'review' | 'ready' | 'in_transit' | 'delivered' | 'closed';
type FilterKey = 'all' | WorkStage;

interface TripReadiness {
    offerStatus: string | null;
    paymentStatus: string | null;
    jobStatus: TruckerJobStatus;
    canOpenTrip: boolean;
    blockingReason: string | null;
}

interface Application {
    id: string;
    offerId: string;
    status: ApplicationStatus;
    proposedAmount: number | null;
    message: string | null;
    createdAt: string;
    respondedAt: string | null;
    offer: {
        cargoType: string;
        originCity: string;
        originDepartment: string;
        destinationCity: string;
        destinationDepartment: string;
        pickupDate: string;
        totalAmount: number;
        companyName: string | null;
        status: string;
    };
    tripReadiness?: TripReadiness;
}

const STAGE_CONFIG: Record<WorkStage, {
    label: string;
    subtitle: string;
    icon: React.ElementType;
    pill: string;
    card: string;
    nextStep: string;
}> = {
    review: {
        label: 'En revision',
        subtitle: 'La empresa esta evaluando tu solicitud.',
        icon: Send,
        pill: 'border-zinc-200 bg-white text-zinc-700',
        card: 'border-zinc-200 bg-white',
        nextStep: 'Esperar decision',
    },
    ready: {
        label: 'Por iniciar',
        subtitle: 'Ya fuiste seleccionado. Revisa si el viaje esta listo para abrir.',
        icon: Clock3,
        pill: 'border-zinc-950 bg-white text-zinc-950',
        card: 'border-zinc-950 bg-white',
        nextStep: 'Iniciar ruta',
    },
    in_transit: {
        label: 'En ruta',
        subtitle: 'La carga esta en movimiento. Mantene evidencia y avances al dia.',
        icon: Truck,
        pill: 'border-zinc-950 bg-white text-zinc-950',
        card: 'border-zinc-950 bg-white',
        nextStep: 'Continuar ruta',
    },
    delivered: {
        label: 'Entregada',
        subtitle: 'El servicio quedo cerrado operativamente.',
        icon: CheckCircle2,
        pill: 'border-zinc-950 bg-zinc-950 text-white',
        card: 'border-zinc-950 bg-white',
        nextStep: 'Ver entrega',
    },
    closed: {
        label: 'Cerrada',
        subtitle: 'Esta oportunidad queda como historial.',
        icon: XCircle,
        pill: 'border-zinc-200 bg-zinc-50 text-zinc-500',
        card: 'border-zinc-200 bg-white',
        nextStep: 'Ver oferta',
    },
};

const FILTERS: Array<{ id: FilterKey; label: string }> = [
    { id: 'all', label: 'Todo' },
    { id: 'review', label: 'En revision' },
    { id: 'ready', label: 'Por iniciar' },
    { id: 'in_transit', label: 'En ruta' },
    { id: 'delivered', label: 'Entregadas' },
    { id: 'closed', label: 'Cerradas' },
];

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
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `Hace ${diffDays} dias`;
        if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
        return `Hace ${Math.floor(diffDays / 30)} meses`;
    } catch {
        return '';
    }
}

function deriveWorkStage(application: Application): WorkStage {
    if (application.status === 'rejected' || application.status === 'withdrawn') {
        return 'closed';
    }

    if (application.status === 'pending') {
        return 'review';
    }

    if (application.tripReadiness?.jobStatus === 'delivered' || application.offer.status === 'completed') {
        return 'delivered';
    }

    if (application.tripReadiness?.jobStatus === 'in_transit' || application.offer.status === 'in_progress') {
        return 'in_transit';
    }

    return 'ready';
}

function getPrimaryAction(application: Application) {
    const stage = deriveWorkStage(application);
    const tripIsReady = application.tripReadiness?.canOpenTrip ?? stage !== 'ready';

    switch (stage) {
        case 'ready':
            return {
                label: tripIsReady ? 'Iniciar ruta' : 'Esperando confirmacion',
                href: tripIsReady ? `/viaje/${application.offerId}` : `/ofertas/${application.offerId}`,
                disabled: !tripIsReady,
            };
        case 'in_transit':
            return {
                label: 'Continuar ruta',
                href: `/viaje/${application.offerId}`,
                disabled: false,
            };
        case 'delivered':
            return {
                label: 'Ver entrega',
                href: `/viaje/${application.offerId}/entrega`,
                disabled: false,
            };
        default:
            return {
                label: 'Ver oferta',
                href: `/ofertas/${application.offerId}`,
                disabled: false,
            };
    }
}

function getSupportCopy(application: Application, stage: WorkStage) {
    if (stage === 'ready') {
        return application.tripReadiness?.canOpenTrip
            ? 'Ruta lista para abrir.'
            : application.tripReadiness?.blockingReason || 'La empresa aun debe terminar la confirmacion operativa.';
    }

    if (stage === 'in_transit') return 'Registra avances, evidencia y cierre desde el viaje.';
    if (stage === 'delivered') return 'Puedes revisar el cierre y la entrega.';
    if (stage === 'closed') return 'Historial visible sin accion pendiente.';
    return 'La empresa decide y te notificamos el resultado.';
}

function EmptyState({ filter }: { filter: FilterKey }) {
    const router = useRouter();

    const copy: Record<FilterKey, { title: string; description: string }> = {
        all: {
            title: 'Aun no tienes movimiento',
            description: 'Cuando te postules o te asignen una ruta, aparecera en este tablero.',
        },
        review: {
            title: 'No hay solicitudes en revision',
            description: 'Tus nuevas postulaciones apareceran aqui mientras la empresa decide.',
        },
        ready: {
            title: 'No tienes rutas listas',
            description: 'Cuando una empresa te seleccione, veras aqui el siguiente paso.',
        },
        in_transit: {
            title: 'No tienes rutas en curso',
            description: 'Tus viajes activos apareceran aqui para que entres rapido.',
        },
        delivered: {
            title: 'Todavia no hay entregas cerradas',
            description: 'Las rutas terminadas quedaran como historial limpio.',
        },
        closed: {
            title: 'No hay oportunidades cerradas',
            description: 'Las postulaciones rechazadas o retiradas quedaran aqui.',
        },
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-zinc-200 bg-white px-8 py-16 text-center shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]"
        >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                <Package className="h-8 w-8 text-zinc-700" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">{copy[filter].title}</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">
                {copy[filter].description}
            </p>
            <Button className="mt-8" onClick={() => router.push('/ofertas')}>
                Buscar cargas
            </Button>
        </motion.div>
    );
}

function SummaryCards({ applications }: { applications: Application[] }) {
    const summary = React.useMemo(() => {
        const initial = { review: 0, ready: 0, in_transit: 0, delivered: 0 };

        for (const application of applications) {
            const stage = deriveWorkStage(application);
            if (stage === 'review' || stage === 'ready' || stage === 'in_transit' || stage === 'delivered') {
                initial[stage] += 1;
            }
        }

        return initial;
    }, [applications]);

    const cards = [
        { key: 'review', label: 'En revision', value: summary.review },
        { key: 'ready', label: 'Por iniciar', value: summary.ready },
        { key: 'in_transit', label: 'En ruta', value: summary.in_transit },
        { key: 'delivered', label: 'Entregadas', value: summary.delivered },
    ] as const;

    return (
        <div className="grid kx-safe-grid-sm gap-3">
            {cards.map((card) => (
                <div
                    key={card.key}
                    className="rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]"
                >
                    <div className="text-3xl font-semibold tracking-tight text-zinc-950">{card.value}</div>
                    <div className="mt-1 text-sm font-medium text-zinc-500">{card.label}</div>
                </div>
            ))}
        </div>
    );
}

function StageRail({ stage }: { stage: WorkStage }) {
    const order: WorkStage[] = ['review', 'ready', 'in_transit', 'delivered'];
    const currentIndex = order.indexOf(stage);

    if (stage === 'closed') {
        return (
            <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                Esta oportunidad quedo cerrada para ti.
            </div>
        );
    }

    return (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {order.map((item, index) => {
                const config = STAGE_CONFIG[item];
                const Icon = config.icon;
                const isActive = currentIndex >= index;
                const isCurrent = currentIndex === index;

                return (
                    <div
                        key={item}
                        className={cn(
                            'rounded-lg border px-2 py-3 text-center transition',
                            isActive ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-400',
                            isCurrent && 'ring-2 ring-zinc-950/10'
                        )}
                    >
                        <Icon className="mx-auto mb-2 h-4 w-4" />
                        <div className="text-[11px] font-medium">{config.label}</div>
                    </div>
                );
            })}
        </div>
    );
}

function WorkCard({
    application,
    onWithdraw,
    onOpen,
}: {
    application: Application;
    onWithdraw: (application: Application) => void;
    onOpen: (href: string) => void;
}) {
    const stage = deriveWorkStage(application);
    const config = STAGE_CONFIG[stage];
    const Icon = config.icon;
    const action = getPrimaryAction(application);
    const supportCopy = getSupportCopy(application, stage);
    const showWithdraw = stage === 'review';
    const isAssigned = stage === 'ready' || stage === 'in_transit' || stage === 'delivered';

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
                'kx-tight-card rounded-lg border p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-46px_rgba(10,10,10,.62)]',
                config.card
            )}
        >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', config.pill)}>
                            <Icon className="h-3.5 w-3.5" />
                            {config.label}
                        </span>
                        {isAssigned && (
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-950">
                                <CheckCircle2 className="h-4 w-4" />
                                Viaje aceptado
                            </span>
                        )}
                        <span className="text-xs text-zinc-400">{formatRelativeTime(application.createdAt)}</span>
                    </div>

                    <div className="mt-4 flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                            <Package className="h-6 w-6 text-zinc-800" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <h3 className="kx-route-title text-xl font-semibold tracking-tight text-zinc-950">
                                {getCityName(application.offer.originCity)}
                                <ArrowRight className="mx-2 inline h-4 w-4 align-[-2px] text-zinc-400" />
                                {getCityName(application.offer.destinationCity)}
                            </h3>
                            <p className="mt-1 text-sm text-zinc-500">{config.subtitle}</p>

                            <div className="mt-4 grid kx-safe-grid-sm gap-3 text-sm text-zinc-600">
                                <div className="flex items-start gap-2">
                                    <MapPin className="mt-0.5 h-4 w-4 text-zinc-400" />
                                    <span>
                                        {getDepartmentName(application.offer.originDepartment)}
                                        <span className="mx-1 text-zinc-300">a</span>
                                        {getDepartmentName(application.offer.destinationDepartment)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-zinc-400" />
                                    <span>{formatDate(application.offer.pickupDate)}</span>
                                </div>
                                <div className="font-money flex items-center gap-2 font-semibold text-zinc-950">
                                    <span>{formatCOP(application.offer.totalAmount)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-zinc-400" />
                                    <span>{application.offer.companyName || 'Empresa'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <StageRail stage={stage} />
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-56">
                    <Button
                        className="h-12"
                        onClick={() => onOpen(action.href)}
                        disabled={action.disabled}
                    >
                        {action.label}
                        <ChevronRight className="h-4 w-4" />
                    </Button>

                    {showWithdraw ? (
                        <Button
                            variant="outline"
                            className="h-11"
                            onClick={() => onWithdraw(application)}
                        >
                            Retirar solicitud
                        </Button>
                    ) : (
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                            <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Siguiente paso</span>
                            {supportCopy}
                        </div>
                    )}
                </div>
            </div>
        </motion.article>
    );
}

function normalizeApplication(app: any): Application {
    return {
        id: app.id,
        offerId: app.offer_id || app.offerId,
        status: app.status,
        proposedAmount: app.proposed_amount || app.proposedAmount || null,
        message: app.message || null,
        createdAt: app.created_at || app.createdAt,
        respondedAt: app.responded_at || app.respondedAt || null,
        offer: {
            cargoType: app.offer?.cargoType || app.offer?.cargo_type || 'Carga',
            originCity: app.offer?.originCity || app.offer?.origin_city || '',
            originDepartment: app.offer?.originDepartment || app.offer?.origin_department || '',
            destinationCity: app.offer?.destinationCity || app.offer?.destCity || app.offer?.destination_city || '',
            destinationDepartment: app.offer?.destinationDepartment || app.offer?.destDepartment || app.offer?.destination_department || '',
            pickupDate: app.offer?.pickupDate || app.offer?.pickup_date || '',
            totalAmount: app.offer?.totalAmount || app.offer?.budget_max || 0,
            companyName: app.offer?.companyName || app.offer?.company_name || null,
            status: app.offer?.status || 'active',
        },
    };
}

export default function MyApplicationsPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    const [applications, setApplications] = React.useState<Application[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [filter, setFilter] = React.useState<FilterKey>('all');
    const [isPrivateFleetDriver, setIsPrivateFleetDriver] = React.useState(false);
    const [privateFleetCheckLoading, setPrivateFleetCheckLoading] = React.useState(true);
    const [privateFleetCheckError, setPrivateFleetCheckError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const requestedTab = new URLSearchParams(window.location.search).get('tab');

        const tabMap: Record<string, FilterKey> = {
            all: 'all',
            pending: 'review',
            accepted: 'ready',
            rejected: 'closed',
            review: 'review',
            ready: 'ready',
            in_transit: 'in_transit',
            delivered: 'delivered',
            closed: 'closed',
        };

        if (requestedTab && tabMap[requestedTab]) {
            setFilter(tabMap[requestedTab]);
        }
    }, []);

    React.useEffect(() => {
        if (user && user.userType !== 'trucker') {
            router.push('/dashboard');
        }
    }, [user, router]);

    React.useEffect(() => {
        let cancelled = false;

        const loadPrivateFleetContext = async () => {
            if (!user) {
                return;
            }

            if (user.userType !== 'trucker') {
                setPrivateFleetCheckLoading(false);
                setPrivateFleetCheckError(null);
                return;
            }

            setPrivateFleetCheckLoading(true);
            setPrivateFleetCheckError(null);
            try {
                const context = await warehouseClient.getPrivateFleetDriverContext();

                if (cancelled) {
                    return;
                }

                setIsPrivateFleetDriver(Boolean(context.isPrivateFleetDriver));

                if (context.isPrivateFleetDriver) {
                    router.replace('/viajes-asignados');
                }
            } catch (error) {
                if (!cancelled) {
                    setIsPrivateFleetDriver(false);
                    setPrivateFleetCheckError(error instanceof Error ? error.message : 'No se pudo verificar si eres conductor privado o freelancer');
                }
            } finally {
                if (!cancelled) {
                    setPrivateFleetCheckLoading(false);
                }
            }
        };

        void loadPrivateFleetContext();

        return () => {
            cancelled = true;
        };
    }, [router, user]);

    const fetchApplications = React.useCallback(async () => {
        if (privateFleetCheckLoading || isPrivateFleetDriver || privateFleetCheckError) {
            return;
        }

        setIsLoading(true);
        try {
            const result = await supabaseApi.offers.getMyApplications();

            if (result.success && result.data) {
                const rawApps = Array.isArray(result.data)
                    ? result.data
                    : (result.data as { data?: any[] }).data || [];

                const apps = rawApps.map(normalizeApplication);
                const offerIds = apps.map((app) => app.offerId).filter(Boolean);

                if (offerIds.length > 0) {
                    const statusResponse = await fetch('/api/payments/offers-status', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ offerIds }),
                    });

                    if (statusResponse.ok) {
                        const statusPayload = await statusResponse.json().catch(() => null) as {
                            success?: boolean;
                            data?: { statuses?: Record<string, TripReadiness> };
                        } | null;

                        const statuses = statusPayload?.data?.statuses || {};

                        for (const app of apps) {
                            if (statuses[app.offerId]) {
                                app.tripReadiness = statuses[app.offerId];
                            }
                        }
                    }
                }

                setApplications(apps);
            }
        } catch (error) {
            console.error('Error fetching applications:', error);
            toast.error('Error', 'No se pudo cargar tu tablero de trabajo');
        } finally {
            setIsLoading(false);
        }
    }, [isPrivateFleetDriver, privateFleetCheckError, privateFleetCheckLoading]);

    React.useEffect(() => {
        if (!privateFleetCheckLoading && !isPrivateFleetDriver && !privateFleetCheckError) {
            fetchApplications();
        }
    }, [fetchApplications, isPrivateFleetDriver, privateFleetCheckError, privateFleetCheckLoading]);

    const handleWithdraw = async (application: Application) => {
        const confirmed = window.confirm('Esto retirara tu solicitud de esta oferta. Deseas continuar?');
        if (!confirmed) return;

        try {
            const result = await supabaseApi.offers.withdrawApplication(application.id);
            if (!result.success) {
                toast.error('Error', result.message || 'No se pudo retirar la solicitud');
                return;
            }

            toast.success('Solicitud retirada', 'La oferta ya no seguira en revision');
            setApplications((prev) =>
                prev.map((item) => (item.id === application.id ? { ...item, status: 'withdrawn' } : item))
            );
        } catch (error) {
            console.error('Withdraw error:', error);
            toast.error('Error', 'No se pudo retirar la solicitud');
        }
    };

    const filteredApplications = React.useMemo(() => {
        if (filter === 'all') return applications;
        return applications.filter((application) => deriveWorkStage(application) === filter);
    }, [applications, filter]);

    const nextActionCount = React.useMemo(
        () => applications.filter((application) => {
            const stage = deriveWorkStage(application);
            if (stage === 'in_transit') return true;
            if (stage === 'ready') return application.tripReadiness?.canOpenTrip ?? true;
            return false;
        }).length,
        [applications]
    );

    if (privateFleetCheckLoading || isPrivateFleetDriver || privateFleetCheckError) {
        return (
            <DashboardLayout pageTitle="Viajes asignados">
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
                    {privateFleetCheckError ? (
                        <XCircle className="h-8 w-8 text-zinc-950" />
                    ) : (
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    )}
                    <div>
                        <p className="font-semibold text-zinc-950">
                            {privateFleetCheckError ? 'No se pudo verificar tu tipo de conductor' : 'Redirigiendo a Viajes asignados'}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">Los conductores privados no usan postulaciones del marketplace.</p>
                    </div>
                    {privateFleetCheckError ? (
                        <Button onClick={() => router.replace('/dashboard')} leftIcon={<RefreshCw className="h-4 w-4" />}>
                            Volver a verificar
                        </Button>
                    ) : null}
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Mi Trabajo">
            <div className="kx-dashboard-bleed bg-[#f7f7f5]">
                <div className="kx-page-container">
                    <section className="kx-section rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] md:p-7">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-2xl">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Tablero operativo</p>
                                <h1 className="kx-fluid-title mt-2 font-semibold tracking-tight text-zinc-950">
                                    Mi Trabajo
                                </h1>
                                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500 md:text-base">
                                    Todo bajo control: postulaciones, viajes asignados, rutas en curso y entregas cerradas.
                                </p>
                            </div>

                            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4">
                                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Siguiente accion</div>
                                    <div className="mt-1 text-2xl font-semibold text-zinc-950">{nextActionCount}</div>
                                    <div className="text-sm text-zinc-500">rutas listas o activas</div>
                                </div>
                                <Button variant="outline" className="h-12" onClick={fetchApplications} disabled={isLoading}>
                                    <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                                    Actualizar
                                </Button>
                            </div>
                        </div>

                        <div className="mt-8">
                            <SummaryCards applications={applications} />
                        </div>
                    </section>

                    <section className="mt-8">
                        <div className="kx-scroll-row mb-5 pb-1">
                            {FILTERS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id)}
                                    className={cn(
                                        'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition',
                                        filter === tab.id
                                            ? 'border-zinc-950 bg-zinc-950 text-white'
                                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-950 hover:text-zinc-950'
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {isLoading ? (
                            <div className="grid gap-4">
                                {[...Array(3)].map((_, index) => (
                                    <div
                                        key={index}
                                        className="h-56 animate-pulse rounded-lg border border-zinc-200 bg-white"
                                    />
                                ))}
                            </div>
                        ) : filteredApplications.length === 0 ? (
                            <EmptyState filter={filter} />
                        ) : (
                            <motion.div layout className="space-y-4">
                                <AnimatePresence mode="popLayout">
                                    {filteredApplications.map((application) => (
                                        <WorkCard
                                            key={application.id}
                                            application={application}
                                            onWithdraw={handleWithdraw}
                                            onOpen={(href) => router.push(href)}
                                        />
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </section>
                </div>
            </div>
        </DashboardLayout>
    );
}
