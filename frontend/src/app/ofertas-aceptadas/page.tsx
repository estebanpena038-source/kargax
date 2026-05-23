'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Building2,
    Calendar,
    CheckCircle2,
    Clock3,
    MapPin,
    Package,
    RefreshCw,
    Route,
    Truck,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { formatCOP, getCityName, getDepartmentName } from '@/constants/colombia';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { TruckerJobStatus } from '@/lib/payments/trip-state';
import { supabaseApi } from '@/lib/supabase/api-bridge';
import { cn } from '@/lib/utils';

type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
type JourneyStage = 'awaiting' | 'loading' | 'in_transit' | 'delivered';

interface TripReadiness {
    offerStatus: string | null;
    paymentStatus: string | null;
    jobStatus: TruckerJobStatus;
    canOpenTrip: boolean;
    blockingReason: string | null;
}

interface AcceptedApplication {
    id: string;
    offerId: string;
    status: ApplicationStatus;
    createdAt: string;
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

const STAGE_COPY: Record<JourneyStage, {
    label: string;
    description: string;
    icon: React.ElementType;
    className: string;
}> = {
    awaiting: {
        label: 'Por confirmar',
        description: 'La ruta esta asignada, pero puede depender de pago o confirmacion operativa.',
        icon: Clock3,
        className: 'border-zinc-200 bg-white text-zinc-700',
    },
    loading: {
        label: 'Carga',
        description: 'Prepara recogida, evidencia inicial y validaciones de salida.',
        icon: Package,
        className: 'border-zinc-950 bg-white text-zinc-950',
    },
    in_transit: {
        label: 'Seguimiento',
        description: 'Mantene el viaje visible y registra avances hasta entrega.',
        icon: Truck,
        className: 'border-zinc-950 bg-white text-zinc-950',
    },
    delivered: {
        label: 'Entregada',
        description: 'Entrega cerrada. Puedes revisar evidencia final.',
        icon: CheckCircle2,
        className: 'border-zinc-950 bg-zinc-950 text-white',
    },
};

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

function deriveJourneyStage(application: AcceptedApplication): JourneyStage {
    const jobStatus = application.tripReadiness?.jobStatus;

    if (jobStatus === 'delivered' || application.offer.status === 'completed') {
        return 'delivered';
    }

    if (jobStatus === 'in_transit' || application.offer.status === 'in_progress') {
        return 'in_transit';
    }

    if (jobStatus === 'awaiting' || application.tripReadiness?.canOpenTrip || application.offer.status === 'reserved') {
        return 'loading';
    }

    return 'awaiting';
}

function getJourneyAction(application: AcceptedApplication) {
    const stage = deriveJourneyStage(application);

    if (stage === 'delivered') {
        return {
            label: 'Ver entrega',
            href: `/viaje/${application.offerId}/entrega`,
            disabled: false,
        };
    }

    if (stage === 'in_transit') {
        return {
            label: 'Ver seguimiento',
            href: `/viaje/${application.offerId}`,
            disabled: false,
        };
    }

    if (stage === 'loading') {
        return {
            label: 'Abrir carga',
            href: `/viaje/${application.offerId}/carga`,
            disabled: false,
        };
    }

    return {
        label: 'Ver condicion',
        href: `/ofertas/${application.offerId}`,
        disabled: false,
    };
}

function normalizeApplication(app: any): AcceptedApplication {
    return {
        id: app.id,
        offerId: app.offer_id || app.offerId,
        status: app.status,
        createdAt: app.created_at || app.createdAt,
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

function isAcceptedOrAssigned(application: AcceptedApplication) {
    const offerStatus = application.offer.status;
    return (
        application.status === 'accepted'
        || offerStatus === 'reserved'
        || offerStatus === 'in_progress'
        || offerStatus === 'completed'
        || application.tripReadiness?.jobStatus === 'awaiting'
        || application.tripReadiness?.jobStatus === 'in_transit'
        || application.tripReadiness?.jobStatus === 'delivered'
    );
}

function JourneyCard({
    application,
    featured = false,
    onOpen,
}: {
    application: AcceptedApplication;
    featured?: boolean;
    onOpen: (href: string) => void;
}) {
    const stage = deriveJourneyStage(application);
    const config = STAGE_COPY[stage];
    const Icon = config.icon;
    const action = getJourneyAction(application);

    return (
        <article
            className={cn(
                'kx-tight-card rounded-lg border bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]',
                featured ? 'border-zinc-950' : 'border-zinc-200'
            )}
        >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', config.className)}>
                            <Icon className="h-3.5 w-3.5" />
                            {config.label}
                        </span>
                        {featured && (
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-950">
                                <Route className="h-4 w-4" />
                                Proximo viaje
                            </span>
                        )}
                    </div>

                    <h2 className={cn('kx-route-title mt-4 font-semibold tracking-tight text-zinc-950', featured ? 'text-3xl' : 'text-2xl')}>
                        {getCityName(application.offer.originCity)}
                        <ArrowRight className="mx-2 inline h-5 w-5 align-[-2px] text-zinc-400" />
                        {getCityName(application.offer.destinationCity)}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{config.description}</p>

                    <div className="mt-5 grid kx-safe-grid-sm gap-3 text-sm text-zinc-600">
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                                <Package className="h-4 w-4" />
                                Carga
                            </span>
                            <p className="mt-2 font-medium text-zinc-950">{application.offer.cargoType}</p>
                        </div>
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                                <MapPin className="h-4 w-4" />
                                Region
                            </span>
                            <p className="mt-2 font-medium text-zinc-950">
                                {getDepartmentName(application.offer.originDepartment)} a {getDepartmentName(application.offer.destinationDepartment)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                                <Calendar className="h-4 w-4" />
                                Recogida
                            </span>
                            <p className="mt-2 font-medium text-zinc-950">{formatDate(application.offer.pickupDate)}</p>
                        </div>
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                                <Building2 className="h-4 w-4" />
                                Empresa
                            </span>
                            <p className="mt-2 font-medium text-zinc-950">{application.offer.companyName || 'Empresa'}</p>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-56">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Flete</p>
                        <p className="font-money mt-1 text-2xl font-semibold text-zinc-950">
                            {formatCOP(application.offer.totalAmount)}
                        </p>
                    </div>
                    {stage === 'awaiting' && application.tripReadiness?.blockingReason && (
                        <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
                            {application.tripReadiness.blockingReason}
                        </p>
                    )}
                    <Button className="mt-3 w-full" onClick={() => onOpen(action.href)} disabled={action.disabled}>
                        {action.label}
                    </Button>
                </div>
            </div>
        </article>
    );
}

function EmptyState() {
    const router = useRouter();

    return (
        <div className="rounded-lg border border-zinc-200 bg-white px-8 py-16 text-center shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                <Truck className="h-8 w-8 text-zinc-700" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">No tienes viajes asignados</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">
                Cuando una empresa te seleccione y el flujo quede listo, el proximo viaje aparecera aqui.
            </p>
            <Button className="mt-8" onClick={() => router.push('/ofertas')}>
                Buscar cargas
            </Button>
        </div>
    );
}

export default function AcceptedOffersPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    const [applications, setApplications] = React.useState<AcceptedApplication[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (user && user.userType !== 'trucker') {
            router.push('/dashboard');
        }
    }, [user, router]);

    const fetchAcceptedOffers = React.useCallback(async () => {
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
                        headers: { 'Content-Type': 'application/json' },
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

                const accepted = apps
                    .filter(isAcceptedOrAssigned)
                    .sort((a, b) => new Date(a.offer.pickupDate || 0).getTime() - new Date(b.offer.pickupDate || 0).getTime());

                setApplications(accepted);
            }
        } catch (error) {
            console.error('Error fetching accepted offers:', error);
            toast.error('Error', 'No se pudieron cargar tus viajes asignados');
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchAcceptedOffers();
    }, [fetchAcceptedOffers]);

    const nextTrip = React.useMemo(() => {
        return applications.find((application) => {
            const stage = deriveJourneyStage(application);
            return stage !== 'delivered';
        }) || null;
    }, [applications]);

    const history = React.useMemo(() => {
        return applications.filter((application) => application.id !== nextTrip?.id);
    }, [applications, nextTrip?.id]);

    return (
        <DashboardLayout pageTitle="Ofertas aceptadas">
            <div className="kx-dashboard-bleed bg-[#f7f7f5]">
                <div className="kx-page-container">
                    <section className="kx-section rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] md:p-7">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-3xl">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Trabajo asignado</p>
                                <h1 className="kx-fluid-title mt-2 font-semibold tracking-tight text-zinc-950">
                                    Ofertas aceptadas
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 md:text-base">
                                    Foco absoluto en lo asignado: proximo viaje arriba, historial abajo y acciones claras segun el estado operativo.
                                </p>
                            </div>

                            <Button variant="outline" className="h-12" onClick={fetchAcceptedOffers} disabled={isLoading}>
                                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                                Actualizar
                            </Button>
                        </div>
                    </section>

                    {isLoading ? (
                        <div className="mt-6 space-y-4">
                            <div className="h-72 animate-pulse rounded-lg border border-zinc-200 bg-white" />
                            <div className="h-48 animate-pulse rounded-lg border border-zinc-200 bg-white" />
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="mt-6">
                            <EmptyState />
                        </div>
                    ) : (
                        <div className="mt-6 space-y-8">
                            {nextTrip && (
                                <section>
                                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                        <Route className="h-4 w-4" />
                                        Proximo viaje
                                    </div>
                                    <JourneyCard application={nextTrip} featured onOpen={(href) => router.push(href)} />
                                </section>
                            )}

                            <section>
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Historial
                                </div>
                                {history.length === 0 ? (
                                    <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
                                        No hay viajes anteriores en esta vista.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {history.map((application) => (
                                            <JourneyCard
                                                key={application.id}
                                                application={application}
                                                onOpen={(href) => router.push(href)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
