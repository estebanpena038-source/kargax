'use client';

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ClipboardCheck,
    Clock,
    Loader2,
    LockKeyhole,
    MapPin,
    Package,
    ReceiptText,
    RefreshCw,
    Route,
    ShieldCheck,
    Truck,
    Wallet,
} from 'lucide-react';

import { Button, Card } from '@/components/ui';
import { LiveTripTracker } from '@/components/tracking/LiveTripTracker';
import { getCityNameByCode, getSubdivisionName, type SupportedCountry } from '@/constants/countries';
import { fetchTripContext } from '@/lib/trips/client';
import type { TripContextPayload } from '@/lib/trips/types';
import { cn } from '@/lib/utils';

type StageState = 'done' | 'active' | 'locked' | 'pending';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

function formatMoney(amount: number | null | undefined) {
    return moneyFormatter.format(Math.max(0, Number(amount || 0)));
}

function shortRef(value: string | null | undefined) {
    if (!value) return 'SIN-REF';
    return value.slice(0, 8).toUpperCase();
}

function formatTimestamp(value: string | null | undefined) {
    if (!value) return null;
    return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function resolveCountry(country: TripContextPayload['offer']['countryCode']): SupportedCountry {
    return country && ['CO', 'EC', 'PE', 'BR'].includes(country) ? country : 'CO';
}

function resolveCity(country: SupportedCountry, city: string | null | undefined) {
    if (!city) return '';
    return getCityNameByCode(country, city.trim());
}

function resolveDepartment(country: SupportedCountry, department: string | null | undefined) {
    if (!department) return '';
    return getSubdivisionName(country, department.trim());
}

function formatPlace(country: SupportedCountry, city: string | null | undefined, department: string | null | undefined) {
    return [resolveCity(country, city), resolveDepartment(country, department)]
        .map((item) => item?.trim())
        .filter(Boolean)
        .join(', ');
}

function formatRouteStop(country: SupportedCountry, address: string | null | undefined, city: string | null | undefined, department: string | null | undefined) {
    const place = formatPlace(country, city, department);

    if (address && place) return `${address} - ${place}`;
    return address || place || null;
}

function translatePaymentStatus(status: string | null | undefined) {
    const labels: Record<string, string> = {
        pending: 'Pendiente',
        processing: 'En proceso',
        completed: 'Completado',
        failed: 'Fallido',
        refunded: 'Reembolsado',
        expired: 'Expirado',
        cancelled: 'Cancelado',
        approved: 'Aprobado',
    };

    return status ? labels[status] || status : null;
}

function translateTripStatus(status: TripContextPayload['tripStatus']) {
    const labels: Record<TripContextPayload['tripStatus'], string> = {
        awaiting_payment: 'Esperando pago',
        pending_confirmation: 'Confirmacion pendiente',
        confirmed: 'Confirmado',
        in_transit: 'En ruta',
        completed: 'Completado',
        failed: 'Con novedad',
    };

    return labels[status] || status;
}

function translateJobStatus(status: TripContextPayload['jobStatus']) {
    const labels: Record<TripContextPayload['jobStatus'], string> = {
        awaiting_confirmation: 'Esperando confirmacion',
        awaiting_payment: 'Esperando pago',
        awaiting: 'Listo para iniciar',
        in_transit: 'En ruta',
        delivered: 'Entregado',
    };

    return labels[status] || status;
}

function buildNextStep(trip: TripContextPayload | null, offerId: string | undefined) {
    if (!trip || !offerId) return null;

    if (trip.nextAction === 'completed') {
        return {
            href: '/billetera',
            label: 'Ver billetera',
            title: 'Viaje cerrado',
            description: 'La entrega quedo registrada. Los movimientos financieros se validan en billetera.',
            icon: Wallet,
            stage: 'completed' as const,
        };
    }

    if (trip.nextAction === 'delivery') {
        return {
            href: `/viaje/${offerId}/entrega`,
            label: 'Continuar entrega',
            title: 'Entrega en destino',
            description: 'Cierra el POD con GPS, evidencia, firma y PIN del receptor.',
            icon: ClipboardCheck,
            stage: 'delivery' as const,
        };
    }

    if (trip.nextAction === 'pickup') {
        const pickupStarted = Boolean(trip.offer.arrivedAtOriginAt || trip.offer.loadingStartedAt);

        return {
            href: `/viaje/${offerId}/carga`,
            label: trip.offer.isPrivateFleet && !pickupStarted ? 'Iniciar ruta' : 'Continuar carga',
            title: 'Carga en origen',
            description: 'Verifica llegada, manifiesto, evidencia y PIN de salida.',
            icon: Package,
            stage: 'pickup' as const,
        };
    }

    return null;
}

function getStageState({
    stage,
    trip,
    nextStage,
}: {
    stage: 'reserve' | 'pickup' | 'route' | 'delivery' | 'close';
    trip: TripContextPayload;
    nextStage: 'pickup' | 'delivery' | 'completed' | undefined;
}): StageState {
    const pickupDone = Boolean(trip.offer.pickupVerifiedAt);
    const deliveryDone = Boolean(trip.offer.deliveryVerifiedAt);

    if (stage === 'reserve') return trip.canOpenTrip ? 'done' : 'active';
    if (stage === 'pickup') {
        if (pickupDone) return 'done';
        if (nextStage === 'pickup') return 'active';
        return trip.canAccessPickup ? 'pending' : 'locked';
    }
    if (stage === 'route') {
        if (deliveryDone) return 'done';
        if (pickupDone) return nextStage === 'delivery' ? 'active' : 'done';
        return 'locked';
    }
    if (stage === 'delivery') {
        if (deliveryDone) return 'done';
        if (nextStage === 'delivery') return 'active';
        return trip.canAccessDelivery ? 'pending' : 'locked';
    }
    if (stage === 'close') {
        if (deliveryDone || nextStage === 'completed') return 'active';
        return 'locked';
    }

    return 'pending';
}

function StageRow({
    icon: Icon,
    title,
    description,
    timestamp,
    state,
}: {
    icon: ElementType;
    title: string;
    description: string;
    timestamp?: string | null;
    state: StageState;
}) {
    const stateLabel: Record<StageState, string> = {
        done: 'Registrado',
        active: 'Activo',
        locked: 'Bloqueado',
        pending: 'Pendiente',
    };

    return (
        <div className={cn(
            'grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border bg-white/[0.06] px-3 py-3 min-[380px]:px-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]',
            state === 'active' ? 'border-white/35 shadow-[0_18px_36px_-32px_rgba(255,255,255,.32)]' : 'border-white/12'
        )}>
            <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border',
                state === 'done' ? 'border-white bg-white text-zinc-950' : 'border-white/12 bg-white/[0.06] text-white/75'
            )}>
                {state === 'done' ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{title}</p>
                    <span className="rounded-md border border-white/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/62">
                        {stateLabel[state]}
                    </span>
                </div>
                <p className="mt-1 text-sm leading-5 text-white/62">{description}</p>
                {timestamp ? <p className="mt-1 font-money text-xs text-white/48">{timestamp}</p> : null}
            </div>
            {state === 'locked' ? <LockKeyhole className="mt-1 hidden h-4 w-4 text-white/42 sm:block" /> : null}
        </div>
    );
}

function FullPageState({
    title,
    description,
    icon: Icon,
    action,
}: {
    title: string;
    description: string;
    icon: ElementType;
    action?: ReactNode;
}) {
    return (
        <div className="flex min-h-svh items-center justify-center bg-zinc-50 p-4 text-zinc-950 min-[380px]:p-5">
            <Card className="w-full max-w-md border-zinc-200 bg-white p-5 text-center min-[380px]:p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                    <Icon className="h-5 w-5 text-zinc-800" />
                </div>
                <h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
                {action ? <div className="mt-6">{action}</div> : null}
            </Card>
        </div>
    );
}

export default function TripHubPage() {
    const params = useParams();
    const router = useRouter();
    const offerId = params?.offerId as string | undefined;

    const [trip, setTrip] = useState<TripContextPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadTrip = async () => {
        if (!offerId) {
            setError('Viaje no encontrado');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const result = await fetchTripContext(offerId);

        if (!result.ok) {
            if (result.requiresLogin) {
                router.replace(`/login?redirect=${encodeURIComponent(`/viaje/${offerId}`)}`);
                return;
            }

            setError(result.error);
            setLoading(false);
            return;
        }

        setTrip(result.data);
        setLoading(false);
    };

    useEffect(() => {
        void loadTrip();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offerId]);

    const nextStep = useMemo(() => buildNextStep(trip, offerId), [offerId, trip]);

    if (loading) {
        return (
            <FullPageState
                title="Abriendo viaje"
                description="Estamos resolviendo permiso, reserva y siguiente paso operativo."
                icon={Loader2}
            />
        );
    }

    if (error || !trip) {
        return (
            <FullPageState
                title="No pudimos abrir este viaje"
                description={error || 'El estado del viaje no esta disponible.'}
                icon={ShieldCheck}
                action={
                    <div className="grid gap-3">
                        <Button onClick={() => void loadTrip()} variant="primary" fullWidth>
                            <RefreshCw className="h-4 w-4" />
                            Reintentar
                        </Button>
                        <Button asChild variant="outline" fullWidth>
                            <Link href="/postulaciones">Volver a Mi Trabajo</Link>
                        </Button>
                    </div>
                }
            />
        );
    }

    const country = resolveCountry(trip.offer.countryCode);
    const originPlace = formatPlace(country, trip.offer.originCity, trip.offer.originDepartment);
    const destinationPlace = formatPlace(country, trip.offer.destinationCity, trip.offer.destinationDepartment);
    const routeLabel = `${originPlace || 'Origen'} -> ${destinationPlace || 'Destino'}`;
    const originStop = formatRouteStop(country, trip.offer.originAddress, trip.offer.originCity, trip.offer.originDepartment);
    const destinationStop = formatRouteStop(country, trip.offer.destinationAddress, trip.offer.destinationCity, trip.offer.destinationDepartment);
    const value = trip.offer.netAmount || trip.offer.totalAmount || 0;
    const freightAmount = Number(trip.offer.freightPaymentAmount || 0);
    const expenseAmount = Number(trip.offer.expenseAllowanceAmount || 0);
    const hasPrivateFreight = trip.offer.isPrivateFleet && freightAmount > 0;
    const hasPrivateExpenses = trip.offer.isPrivateFleet && expenseAmount > 0;
    const privatePrimaryAmount = hasPrivateExpenses && !hasPrivateFreight
        ? expenseAmount
        : hasPrivateFreight
            ? freightAmount
            : expenseAmount;
    const primaryOperationalAmount = trip.offer.isPrivateFleet ? privatePrimaryAmount : value;
    const primaryOperationalLabel = trip.offer.isPrivateFleet
        ? hasPrivateExpenses && !hasPrivateFreight
            ? 'Viaticos'
            : hasPrivateFreight
                ? 'Pago ruta'
                : 'Nomina mensual'
        : 'Valor operativo';
    const nextStage = nextStep?.stage;
    const NextStepIcon = nextStep?.icon;
    const isBlocked = !trip.canOpenTrip || !nextStep;
    const canStartLiveTracking = Boolean(offerId && trip.offer.pickupVerifiedAt && !trip.offer.deliveryVerifiedAt);
    const workBackHref = trip.offer.isPrivateFleet ? '/viajes-asignados' : '/postulaciones';
    const workBackLabel = trip.offer.isPrivateFleet ? 'Viajes asignados' : 'Mi Trabajo';

    const stages = [
        {
            id: 'reserve' as const,
            title: 'Reserva',
            description: trip.payment?.status
                ? `Estado asociado: ${translatePaymentStatus(trip.payment.status)}.`
                : 'Validacion operativa de la ruta.',
            icon: ReceiptText,
            timestamp: formatTimestamp(trip.payment?.completedAt || trip.payment?.updatedAt),
        },
        {
            id: 'pickup' as const,
            title: 'Carga',
            description: 'GPS, manifiesto, evidencia y PIN de salida.',
            icon: Package,
            timestamp: formatTimestamp(trip.offer.pickupVerifiedAt),
        },
        {
            id: 'route' as const,
            title: 'Ruta',
            description: 'Rastreo PWA en primer plano y cola local si no hay conexion.',
            icon: Route,
            timestamp: formatTimestamp(trip.offer.pickupVerifiedAt),
        },
        {
            id: 'delivery' as const,
            title: 'Entrega',
            description: 'GPS destino, POD, firma y PIN del receptor.',
            icon: ClipboardCheck,
            timestamp: formatTimestamp(trip.offer.deliveryVerifiedAt),
        },
        {
            id: 'close' as const,
            title: 'Cierre',
            description: 'Evidencia disponible para inspeccion y estados posteriores.',
            icon: ShieldCheck,
            timestamp: formatTimestamp(trip.offer.deliveryVerifiedAt),
        },
    ];

    return (
        <div className="kx-trip-page bg-zinc-50 px-3 py-4 text-zinc-950 min-[380px]:px-4 sm:px-6 lg:py-10">
            <div className="kx-trip-container grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
                <section className="space-y-5">
                    <div className="kx-trip-panel luxury-panel rounded-lg border border-white/10 p-4 text-white shadow-[0_28px_80px_-54px_rgba(0,0,0,.9)] min-[380px]:p-5 sm:p-7">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Button asChild variant="ghost" className="border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                                <Link href={workBackHref}>
                                    <ArrowLeft className="h-4 w-4" />
                                    {workBackLabel}
                                </Link>
                            </Button>
                            <span className="rounded-md border border-white/15 px-3 py-1 font-money text-xs uppercase tracking-[0.18em] text-white/70">
                                VIAJE {shortRef(trip.offer.id)}
                            </span>
                        </div>

                        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                                    <Truck className="h-3.5 w-3.5" />
                                    Cadena de custodia
                                </div>
                                <h1 className="kx-route-title mt-4 text-2xl font-semibold tracking-tight text-white min-[380px]:text-3xl sm:text-4xl">
                                    {routeLabel}
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                                    {isBlocked
                                        ? trip.blockingReason || 'Esta ruta todavia espera una confirmacion final antes de operar.'
                                        : nextStep.description}
                                </p>
                            </div>

                            <div className="rounded-lg border border-white/15 bg-white/8 p-4 text-left lg:min-w-64">
                                <p className="text-xs uppercase tracking-[0.18em] text-white/52">{primaryOperationalLabel}</p>
                                {trip.offer.isPrivateFleet && !hasPrivateFreight && !hasPrivateExpenses ? (
                                    <p className="mt-2 text-lg font-semibold text-white">Nomina mensual separada</p>
                                ) : (
                                    <p className="mt-2 font-money text-2xl font-semibold text-white">{formatMoney(primaryOperationalAmount)}</p>
                                )}
                                {trip.offer.isPrivateFleet && (hasPrivateFreight || hasPrivateExpenses) ? (
                                    <div className="mt-3 grid gap-1 text-xs leading-5 text-white/62">
                                        {hasPrivateFreight ? <span>Pago ruta: {formatMoney(freightAmount)}</span> : null}
                                        {hasPrivateExpenses ? <span>Viaticos: {formatMoney(expenseAmount)}</span> : null}
                                    </div>
                                ) : null}
                                <p className="mt-2 text-xs leading-5 text-white/55">
                                    Flota privada se soporta con comprobante externo; no aumenta el saldo disponible para retiro.
                                </p>
                            </div>
                        </div>

                        <div className="kx-trip-metrics mt-7 grid gap-3">
                            <div className="rounded-lg border border-white/12 bg-white/6 p-3">
                                <p className="text-xs uppercase tracking-wide text-white/50">Siguiente paso</p>
                                <p className="mt-1 text-sm font-semibold text-white">{nextStep?.title || 'Bloqueado'}</p>
                            </div>
                            <div className="rounded-lg border border-white/12 bg-white/6 p-3">
                                <p className="text-xs uppercase tracking-wide text-white/50">Estado viaje</p>
                                <p className="mt-1 text-sm font-semibold text-white">{translateTripStatus(trip.tripStatus)}</p>
                            </div>
                            <div className="rounded-lg border border-white/12 bg-white/6 p-3">
                                <p className="text-xs uppercase tracking-wide text-white/50">Trabajo</p>
                                <p className="mt-1 text-sm font-semibold text-white">{translateJobStatus(trip.jobStatus)}</p>
                            </div>
                        </div>
                    </div>

                    <Card className="kx-trip-panel luxury-panel border-white/10 p-4 text-white shadow-[0_28px_80px_-54px_rgba(0,0,0,.9)] sm:p-5">
                        <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight text-white">Etapas del viaje</h2>
                                <p className="text-sm text-white/62">Reserva, carga, ruta, entrega y cierre en una sola linea operativa.</p>
                            </div>
                            <Clock className="h-5 w-5 text-white/55" />
                        </div>
                        <div className="mt-5 grid gap-3">
                            {stages.map((stage) => (
                                <StageRow
                                    key={stage.id}
                                    icon={stage.icon}
                                    title={stage.title}
                                    description={stage.description}
                                    timestamp={stage.timestamp}
                                    state={getStageState({ stage: stage.id, trip, nextStage })}
                                />
                            ))}
                        </div>
                    </Card>

                    {canStartLiveTracking && offerId ? <LiveTripTracker offerId={offerId} /> : null}
                </section>

                <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
                    <Card className="kx-trip-panel luxury-panel border-white/10 p-5 text-white shadow-[0_28px_80px_-54px_rgba(0,0,0,.9)]">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-white/8">
                                {NextStepIcon ? <NextStepIcon className="h-5 w-5 text-white" /> : <LockKeyhole className="h-5 w-5 text-white" />}
                            </div>
                            <div>
                                <h2 className="font-semibold text-white">{nextStep?.title || 'Ruta bloqueada'}</h2>
                                <p className="mt-1 text-sm leading-6 text-white/62">
                                    {nextStep?.description || trip.blockingReason || 'Todavia falta una confirmacion final.'}
                                </p>
                            </div>
                        </div>

                        {nextStep && !isBlocked ? (
                            <Button asChild className="mt-6" fullWidth size="lg">
                                <Link href={nextStep.href}>
                                    {nextStep.label}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        ) : (
                            <Button disabled className="mt-6" fullWidth size="lg">
                                Esperando confirmacion
                            </Button>
                        )}

                        <Button asChild variant="outline" className="mt-3" fullWidth>
                            <Link href={workBackHref}>Volver a {workBackLabel}</Link>
                        </Button>
                    </Card>

                    <Card className="kx-trip-panel luxury-panel border-white/10 p-5 text-white shadow-[0_28px_80px_-54px_rgba(0,0,0,.9)]">
                        <h3 className="flex items-center gap-2 font-semibold text-white">
                            <MapPin className="h-4 w-4" />
                            Trayecto
                        </h3>
                        <div className="mt-4 space-y-3 text-sm">
                            <div className="rounded-lg border border-white/12 bg-white/8 p-3">
                                <p className="text-xs uppercase tracking-wide text-white/52">Origen</p>
                                <p className="mt-1 font-medium leading-6 text-white">{originStop || 'Origen pendiente'}</p>
                            </div>
                            <div className="rounded-lg border border-white/12 bg-white/8 p-3">
                                <p className="text-xs uppercase tracking-wide text-white/52">Destino</p>
                                <p className="mt-1 font-medium leading-6 text-white">{destinationStop || 'Destino pendiente'}</p>
                            </div>
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
