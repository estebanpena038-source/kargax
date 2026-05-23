'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    CheckCircle2,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Truck,
    XCircle,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useUserCountry } from '@/lib/platform/useUserCountry';
import { getPrivateFleetDriverTripAction, getPrivateFleetTripStatusLabel } from '@/lib/private-fleet/driver-trip-actions';
import { cn } from '@/lib/utils';
import warehouseClient from '@/lib/warehouses/client';
import type { PrivateFleetDriverContext, PrivateFleetDriverTrip } from '@/lib/warehouses/types';

const assignmentCopy: Record<PrivateFleetDriverTrip['assignmentStatus'], {
    label: string;
    className: string;
}> = {
    pending: {
        label: 'Asignado',
        className: 'border-zinc-300 bg-white text-zinc-800',
    },
    accepted: {
        label: 'Confirmado',
        className: 'border-zinc-950 bg-zinc-950 text-white',
    },
    rejected: {
        label: 'Devuelto',
        className: 'border-zinc-200 bg-zinc-100 text-zinc-500',
    },
};

function formatDate(value?: string | null) {
    if (!value) return 'Fecha pendiente';

    return new Date(value).toLocaleDateString('es-CO', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatTimeRange(start?: string | null, end?: string | null) {
    if (!start && !end) return 'Horario pendiente';
    if (start && end) return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
    return (start || end || '').slice(0, 5);
}

function TripStatusPill({ trip }: { trip: PrivateFleetDriverTrip }) {
    const copy = assignmentCopy[trip.assignmentStatus] || assignmentCopy.pending;

    return (
        <span className={cn(
            'inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
            copy.className
        )}>
            {copy.label}
        </span>
    );
}

function EmptyTrips() {
    return (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center">
            <Truck className="mx-auto h-10 w-10 text-zinc-700" />
            <p className="mt-4 font-semibold text-zinc-950">No tienes viajes asignados</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500">
                Cuando tu empresa te asigne una ruta privada, aparecera aqui para aceptarla, rechazarla o abrir el flujo operativo.
            </p>
        </div>
    );
}

function AssignedTripRow({
    trip,
    actionId,
    onAccept,
    onReject,
    formatAmount,
    resolveCityName,
    resolveSubdivisionName,
}: {
    trip: PrivateFleetDriverTrip;
    actionId: string | null;
    onAccept: (trip: PrivateFleetDriverTrip) => void;
    onReject: (trip: PrivateFleetDriverTrip) => void;
    formatAmount: (amount: number) => string;
    resolveCityName: (code: string) => string;
    resolveSubdivisionName: (code: string) => string;
}) {
    const isAccepting = actionId === `accept-${trip.id}`;
    const isRejecting = actionId === `reject-${trip.id}`;
    const tripAction = getPrivateFleetDriverTripAction(trip);

    return (
        <article className="rounded-lg border border-zinc-200 bg-white px-4 py-4 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] transition hover:border-zinc-950">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <TripStatusPill trip={trip} />
                        <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                            {getPrivateFleetTripStatusLabel(trip.status)}
                        </span>
                    </div>
                    <div className="mt-3 min-w-0">
                        <p className="break-words text-lg font-semibold leading-tight text-zinc-950">
                            {resolveCityName(trip.originCity || '')}
                            <ArrowRight className="mx-2 inline h-4 w-4 align-[-2px] text-zinc-400" />
                            {resolveCityName(trip.destinationCity || '')}
                        </p>
                        <p className="mt-1 break-words text-sm leading-6 text-zinc-500">
                            {resolveSubdivisionName(trip.originDepartment || '')} a {resolveSubdivisionName(trip.destinationDepartment || '')}
                        </p>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-3 lg:min-w-[18rem] lg:items-end">
                    <div className="min-w-0 text-left lg:text-right">
                        <p className="font-money text-xl font-semibold text-zinc-950">{formatAmount(trip.totalAmount)}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                            Recogida {formatDate(trip.pickupDate)} · {formatTimeRange(trip.pickupTimeStart, trip.pickupTimeEnd)}
                        </p>
                    </div>

                    <div className="flex w-full flex-wrap gap-2 lg:justify-end">
                        {trip.canAccept ? (
                            <Button
                                size="sm"
                                isLoading={isAccepting}
                                onClick={() => onAccept(trip)}
                                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                            >
                                Confirmar viaje
                            </Button>
                        ) : null}
                        {trip.canReject ? (
                            <Button
                                size="sm"
                                variant="outline"
                                isLoading={isRejecting}
                                onClick={() => onReject(trip)}
                                leftIcon={<XCircle className="h-4 w-4" />}
                            >
                                Devolver
                            </Button>
                        ) : null}
                        {tripAction ? (
                            <Button asChild size="sm" variant="dark">
                                <Link href={tripAction.href}>
                                    {tripAction.label}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            {trip.assignmentStatus === 'rejected' && trip.rejectionReason ? (
                <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                    Motivo: {trip.rejectionReason}
                </p>
            ) : null}
        </article>
    );
}

export default function AssignedTripsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const {
        format: formatAmount,
        getCityName: resolveCityName,
        getSubName: resolveSubdivisionName,
    } = useUserCountry();
    const [context, setContext] = React.useState<PrivateFleetDriverContext | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [actionId, setActionId] = React.useState<string | null>(null);

    const loadContext = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await warehouseClient.getPrivateFleetDriverContext();
            setContext(response);

            if (!response.isPrivateFleetDriver) {
                router.replace('/dashboard');
            }
        } catch (error) {
            toast.error('Viajes asignados', error instanceof Error ? error.message : 'No se pudo cargar tu operacion privada');
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    React.useEffect(() => {
        if (user && user.userType !== 'trucker') {
            router.replace('/dashboard');
            return;
        }

        if (user?.userType === 'trucker') {
            void loadContext();
        }
    }, [loadContext, router, user]);

    const handleAccept = React.useCallback(async (trip: PrivateFleetDriverTrip) => {
        setActionId(`accept-${trip.id}`);
        try {
            const result = await warehouseClient.acceptPrivateFleetTrip(trip.id);
            toast.success(
                'Viaje aceptado',
                result.expenseAmount > 0
                    ? `Viaticos disponibles: ${formatAmount(result.expenseAmount)}.`
                    : 'Ya puedes iniciar la ruta.'
            );

            if (result.pickupPin) {
                router.push(`/viaje/${trip.id}/carga`);
                return;
            }

            await loadContext();
        } catch (error) {
            toast.error('Viajes asignados', error instanceof Error ? error.message : 'No se pudo aceptar el viaje');
        } finally {
            setActionId(null);
        }
    }, [formatAmount, loadContext, router]);

    const handleReject = React.useCallback(async (trip: PrivateFleetDriverTrip) => {
        const reasonInput = window.prompt('Motivo opcional para la empresa');
        if (reasonInput === null) {
            return;
        }

        const reason = reasonInput.trim() || null;
        setActionId(`reject-${trip.id}`);
        try {
            await warehouseClient.rejectPrivateFleetTrip(trip.id, { reason });
            toast.success('Viaje devuelto', 'La empresa fue notificada para reasignar o cancelar la ruta.');
            await loadContext();
        } catch (error) {
            toast.error('Viajes asignados', error instanceof Error ? error.message : 'No se pudo rechazar el viaje');
        } finally {
            setActionId(null);
        }
    }, [loadContext]);

    const assignedTrips = context?.assignedTrips || [];
    const pendingTrips = assignedTrips.filter((trip) => trip.assignmentStatus === 'pending').length;
    const acceptedTrips = assignedTrips.filter((trip) => trip.assignmentStatus === 'accepted').length;

    if (isLoading || !context?.isPrivateFleetDriver) {
        return (
            <DashboardLayout pageTitle="Viajes asignados">
                <div className="flex min-h-[48vh] flex-col items-center justify-center gap-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    <div>
                        <p className="font-semibold text-zinc-950">Cargando viajes asignados</p>
                        <p className="mt-1 text-sm text-zinc-500">Validando tu empresa, placa e itinerario privado.</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Viajes asignados">
            <div className="kx-dashboard-bleed bg-[#f7f7f5]">
                <div className="kx-page-container space-y-5 py-5 md:py-7">
                    <section className="rounded-lg border border-zinc-200 bg-zinc-950 px-5 py-6 text-white shadow-[0_32px_80px_-46px_rgba(0,0,0,.85)] md:px-7 md:py-8">
                        <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                            <div className="min-w-0">
                                <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
                                    <ShieldCheck className="h-4 w-4" />
                                    Transportista privado
                                </div>
                                <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
                                    Viajes asignados por {context.businessName || 'tu empresa'}
                                </h1>
                                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
                                    Esta cuenta pertenece a una operacion privada. Aqui solo aparecen rutas enviadas por tu empresa, sin marketplace ni postulaciones publicas.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                                    <p className="text-xs text-zinc-300">Placa</p>
                                    <p className="font-money mt-1 break-words text-xl font-semibold">{context.vehiclePlate || 'Pendiente'}</p>
                                </div>
                                <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                                    <p className="text-xs text-zinc-300">ID interno</p>
                                    <p className="font-money mt-1 break-words text-xl font-semibold">{context.internalDriverId || 'Sin ID'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                            <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                                <p className="text-xs text-zinc-300">Activos</p>
                                <p className="mt-1 text-2xl font-semibold">{context.stats.activeTrips}</p>
                            </div>
                            <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                                <p className="text-xs text-zinc-300">Por confirmar</p>
                                <p className="mt-1 text-2xl font-semibold">{pendingTrips}</p>
                            </div>
                            <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                                <p className="text-xs text-zinc-300">Aceptados</p>
                                <p className="mt-1 text-2xl font-semibold">{acceptedTrips}</p>
                            </div>
                            <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                                <p className="text-xs text-zinc-300">Nomina liberada</p>
                                <p className="font-money mt-1 text-2xl font-semibold">{formatAmount(context.stats.payrollReleasedThisMonthCop)}</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-lg border border-zinc-200 bg-white px-5 py-6 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] md:px-7">
                        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Operacion privada</p>
                                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Viajes asignados</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                                    Acepta o devuelve rutas antes de que entren a PIN, viaticos y evidencia operativa.
                                </p>
                            </div>
                            <Button variant="outline" onClick={loadContext} disabled={isLoading}>
                                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                                Actualizar
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {assignedTrips.length ? assignedTrips.map((trip) => (
                                <AssignedTripRow
                                    key={trip.id}
                                    trip={trip}
                                    actionId={actionId}
                                    onAccept={handleAccept}
                                    onReject={handleReject}
                                    formatAmount={formatAmount}
                                    resolveCityName={resolveCityName}
                                    resolveSubdivisionName={resolveSubdivisionName}
                                />
                            )) : <EmptyTrips />}
                        </div>
                    </section>
                </div>
            </div>
        </DashboardLayout>
    );
}
