'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowRight,
    Building2,
    Calendar,
    Eye,
    Package,
    RefreshCw,
    Search,
    Send,
    SlidersHorizontal,
    Truck,
    X,
    Loader2,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { CARGO_TYPES as COLOMBIA_CARGO_TYPES, getVehicleTypeName, VEHICLE_TYPES as COLOMBIA_VEHICLE_TYPES } from '@/constants/colombia';
import { useUserCountry } from '@/lib/platform/useUserCountry';
import { supabaseApi } from '@/lib/supabase/api-bridge';
import warehouseClient from '@/lib/warehouses/client';
import type { PrivateFleetDriverContext } from '@/lib/warehouses/types';
import { cn } from '@/lib/utils';

interface Offer {
    id: string;
    title: string;
    cargoType: string;
    cargoDescription?: string;
    originCity: string;
    originDepartment: string;
    destinationCity?: string;
    destinationDepartment?: string;
    destCity?: string;
    destDepartment?: string;
    pickupDate: string;
    deliveryDate?: string;
    totalAmount: number;
    currency: string;
    requiredVehicle: string;
    weightKg?: number;
    status: string;
    companyName: string | null;
    createdAt: string;
    publishedAt: string | null;
    applicationsCount?: number;
    hasApplied?: boolean;
    specialRequirements?: string;
    insuranceRequired?: boolean;
}

interface FilterState {
    search: string;
    originDepartment: string;
    destDepartment: string;
    cargoType: string;
    vehicleType: string;
}

interface OfferSearchPayload {
    data?: Offer[];
}

const CARGO_TYPES = [
    { value: '', label: 'Todos los tipos' },
    ...COLOMBIA_CARGO_TYPES.map((cargo) => ({
        value: cargo.code,
        label: cargo.name,
    })),
];

const VEHICLE_TYPES = [
    { value: '', label: 'Todos los vehiculos' },
    ...COLOMBIA_VEHICLE_TYPES.map((vehicle) => ({
        value: vehicle.code,
        label: vehicle.name,
    })),
];

const SORT_OPTIONS = [
    { value: 'newest', label: 'Mas recientes' },
    { value: 'price_high', label: 'Mayor monto' },
    { value: 'price_low', label: 'Menor monto' },
    { value: 'pickup_date', label: 'Fecha de recogida' },
];

const inputClassName = 'h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10';

function formatDate(dateString: string): string {
    try {
        return new Date(dateString).toLocaleDateString('es-CO', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
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
        return date.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

function getDestinationCity(offer: Offer) {
    return offer.destinationCity || offer.destCity || '';
}

function getDestinationDepartment(offer: Offer) {
    return offer.destinationDepartment || offer.destDepartment || '';
}

function resolveCargoType(code: string) {
    return COLOMBIA_CARGO_TYPES.find((cargo) => cargo.code === code)?.name || code?.replace('_', ' ') || 'Carga';
}

function getPickupSignal(pickupDate: string) {
    const pickup = new Date(pickupDate);
    const now = new Date();
    const diffDays = Math.ceil((pickup.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return 'Sale hoy';
    if (diffDays <= 3) return 'Salida proxima';
    return 'Programada';
}

function OfferSkeleton() {
    return (
        <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-3 w-24 rounded bg-zinc-200" />
                    <div className="h-7 w-48 rounded bg-zinc-200" />
                    <div className="h-4 w-32 rounded bg-zinc-100" />
                </div>
                <div className="h-8 w-28 rounded bg-zinc-200" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="h-16 rounded-lg bg-zinc-100" />
                <div className="h-16 rounded-lg bg-zinc-100" />
                <div className="h-16 rounded-lg bg-zinc-100" />
                <div className="h-16 rounded-lg bg-zinc-100" />
            </div>
            <div className="mt-5 flex gap-3">
                <div className="h-11 flex-1 rounded-lg bg-zinc-200" />
                <div className="h-11 flex-1 rounded-lg bg-zinc-100" />
            </div>
        </div>
    );
}

function FilterFields({
    filters,
    onFilterChange,
    departments,
}: {
    filters: FilterState;
    onFilterChange: (key: keyof FilterState, value: string) => void;
    departments: Array<{ value: string; label: string }>;
}) {
    return (
        <div className="grid kx-safe-grid-sm gap-3">
            <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Origen</span>
                <select
                    value={filters.originDepartment}
                    onChange={(event) => onFilterChange('originDepartment', event.target.value)}
                    className={inputClassName}
                >
                    {departments.map((department) => (
                        <option key={department.value} value={department.value}>{department.label}</option>
                    ))}
                </select>
            </label>

            <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Destino</span>
                <select
                    value={filters.destDepartment}
                    onChange={(event) => onFilterChange('destDepartment', event.target.value)}
                    className={inputClassName}
                >
                    {departments.map((department) => (
                        <option key={department.value} value={department.value}>{department.label}</option>
                    ))}
                </select>
            </label>

            <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Tipo</span>
                <select
                    value={filters.cargoType}
                    onChange={(event) => onFilterChange('cargoType', event.target.value)}
                    className={inputClassName}
                >
                    {CARGO_TYPES.map((cargo) => (
                        <option key={cargo.value} value={cargo.value}>{cargo.label}</option>
                    ))}
                </select>
            </label>

            <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Vehiculo</span>
                <select
                    value={filters.vehicleType}
                    onChange={(event) => onFilterChange('vehicleType', event.target.value)}
                    className={inputClassName}
                >
                    {VEHICLE_TYPES.map((vehicle) => (
                        <option key={vehicle.value} value={vehicle.value}>{vehicle.label}</option>
                    ))}
                </select>
            </label>
        </div>
    );
}

function MobileFilterSheet({
    isOpen,
    filters,
    onFilterChange,
    onClose,
    onClear,
    departments,
}: {
    isOpen: boolean;
    filters: FilterState;
    onFilterChange: (key: keyof FilterState, value: string) => void;
    onClose: () => void;
    onClear: () => void;
    departments: Array<{ value: string; label: string }>;
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 lg:hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <button className="absolute inset-0 bg-black/35" aria-label="Cerrar filtros" onClick={onClose} />
                    <motion.aside
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 260 }}
                        className="absolute inset-x-0 bottom-0 max-h-[86svh] overflow-y-auto rounded-t-lg border border-zinc-200 bg-white p-5 shadow-[0_-24px_70px_-42px_rgba(10,10,10,.72)]"
                    >
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Filtros</p>
                                <h2 className="text-xl font-semibold text-zinc-950">Ajustar busqueda</h2>
                            </div>
                            <Button variant="outline" size="icon-sm" onClick={onClose} aria-label="Cerrar filtros">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <FilterFields filters={filters} onFilterChange={onFilterChange} departments={departments} />

                        <div className="mt-5 flex gap-3">
                            <Button variant="outline" fullWidth onClick={onClear}>
                                Limpiar
                            </Button>
                            <Button fullWidth onClick={onClose}>
                                Aplicar
                            </Button>
                        </div>
                    </motion.aside>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function CargoOfferCard({
    offer,
    onViewDetails,
    onApplyIntent,
    showApplyButton,
    formatAmount,
    resolveCityName,
    resolveSubdivisionName,
}: {
    offer: Offer;
    onViewDetails: (offer: Offer) => void;
    onApplyIntent: (offer: Offer) => void;
    showApplyButton: boolean;
    formatAmount: (amount: number) => string;
    resolveCityName: (code: string) => string;
    resolveSubdivisionName: (code: string) => string;
}) {
    const destinationCity = getDestinationCity(offer);
    const destinationDepartment = getDestinationDepartment(offer);

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
                'kx-tight-card rounded-lg border bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] transition hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-[0_28px_70px_-46px_rgba(10,10,10,.62)]',
                offer.hasApplied ? 'border-zinc-950' : 'border-zinc-200'
            )}
        >
            <div className="flex flex-col gap-4 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                            {getPickupSignal(offer.pickupDate)}
                        </span>
                        {offer.hasApplied && (
                            <span className="rounded-full border border-zinc-950 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-white">
                                Postulado
                            </span>
                        )}
                    </div>

                    <button
                        onClick={() => onViewDetails(offer)}
                        className="kx-route-title mt-4 block text-left text-xl font-semibold leading-tight tracking-tight text-zinc-950 hover:underline"
                    >
                        <span>{resolveCityName(offer.originCity)}</span>
                        <ArrowRight className="mx-2 inline h-4 w-4 align-[-2px] text-zinc-400" />
                        <span>{resolveCityName(destinationCity)}</span>
                    </button>

                    <p className="mt-2 line-clamp-1 text-sm text-zinc-500">
                        {resolveSubdivisionName(offer.originDepartment)} a {resolveSubdivisionName(destinationDepartment)}
                    </p>
                </div>

                <div className="shrink-0 text-left min-[430px]:text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Flete</p>
                    <p className="font-money mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                        {formatAmount(offer.totalAmount)}
                    </p>
                </div>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-zinc-600 sm:grid-cols-2">
                <div className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3">
                    <Building2 className="mt-0.5 h-4 w-4 text-zinc-500" />
                    <span className="min-w-0 truncate">{offer.companyName || 'Empresa verificada'}</span>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3">
                    <Calendar className="mt-0.5 h-4 w-4 text-zinc-500" />
                    <span>{formatDate(offer.pickupDate)}</span>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3">
                    <Truck className="mt-0.5 h-4 w-4 text-zinc-500" />
                    <span>{offer.requiredVehicle ? getVehicleTypeName(offer.requiredVehicle) : 'Vehiculo por confirmar'}</span>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3">
                    <Package className="mt-0.5 h-4 w-4 text-zinc-500" />
                    <span>{resolveCargoType(offer.cargoType)}{offer.weightKg ? `, ${offer.weightKg.toLocaleString('es-CO')} kg` : ''}</span>
                </div>
            </div>

            {offer.specialRequirements && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-600">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    <p className="line-clamp-2">{offer.specialRequirements}</p>
                </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => onViewDetails(offer)}>
                    <Eye className="h-4 w-4" />
                    Ver detalle
                </Button>
                {showApplyButton && !offer.hasApplied && (
                    <Button className="flex-1" onClick={() => onApplyIntent(offer)}>
                        <Send className="h-4 w-4" />
                        Postularme
                    </Button>
                )}
            </div>

            <div className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
                Publicado {formatRelativeTime(offer.createdAt)}
            </div>
        </motion.article>
    );
}

function EmptyState({ onClear, hasFilters }: { onClear: () => void; hasFilters: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-zinc-200 bg-white px-6 py-16 text-center shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]"
        >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                <Package className="h-8 w-8 text-zinc-600" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">
                No hay cargas para estos filtros
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">
                {hasFilters
                    ? 'Ajusta origen, destino o vehiculo para volver a abrir el mercado.'
                    : 'Cuando una empresa publique una carga activa, aparecera aqui con ruta, monto y requisitos claros.'}
            </p>
            {hasFilters && (
                <Button variant="outline" className="mt-7" onClick={onClear}>
                    Limpiar filtros
                </Button>
            )}
        </motion.div>
    );
}

export default function BrowseOffersPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const {
        format: formatAmount,
        getCityName: resolveCityName,
        getSubName: resolveSubdivisionName,
        subdivisions,
    } = useUserCountry();

    const [offers, setOffers] = React.useState<Offer[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [sortBy, setSortBy] = React.useState('newest');
    const [showMobileFilters, setShowMobileFilters] = React.useState(false);
    const [privateFleetContext, setPrivateFleetContext] = React.useState<PrivateFleetDriverContext | null>(null);
    const [privateFleetCheckLoading, setPrivateFleetCheckLoading] = React.useState(true);
    const [privateFleetCheckError, setPrivateFleetCheckError] = React.useState<string | null>(null);
    const [filters, setFilters] = React.useState<FilterState>({
        search: '',
        originDepartment: '',
        destDepartment: '',
        cargoType: '',
        vehicleType: '',
    });

    const isTrucker = user?.userType === 'trucker';
    const isPrivateFleetDriver = Boolean(privateFleetContext?.isPrivateFleetDriver);
    const canLoadMarketplace = Boolean(user) && !privateFleetCheckLoading && !isPrivateFleetDriver;

    const departmentOptions = React.useMemo(
        () => [
            { value: '', label: 'Todos' },
            ...subdivisions.map((item) => ({ value: item.code, label: item.name })),
        ],
        [subdivisions]
    );

    React.useEffect(() => {
        let cancelled = false;

        const loadPrivateFleetContext = async () => {
            if (!user) {
                return;
            }

            if (user.userType !== 'trucker') {
                setPrivateFleetContext(null);
                setPrivateFleetCheckError(null);
                setPrivateFleetCheckLoading(false);
                return;
            }

            setPrivateFleetCheckLoading(true);
            setPrivateFleetCheckError(null);
            try {
                const context = await warehouseClient.getPrivateFleetDriverContext();
                if (!cancelled) {
                    setPrivateFleetContext(context);
                }
            } catch (error) {
                if (!cancelled) {
                    setPrivateFleetContext(null);
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
    }, [user]);

    React.useEffect(() => {
        if (isPrivateFleetDriver) {
            router.replace('/viajes-asignados');
        }
    }, [isPrivateFleetDriver, router]);

    const fetchOffers = React.useCallback(async () => {
        if (!canLoadMarketplace) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await supabaseApi.offers.search({
                status: 'active',
                originDepartment: filters.originDepartment || undefined,
                destinationDepartment: filters.destDepartment || undefined,
                cargoType: filters.cargoType || undefined,
                vehicleType: filters.vehicleType || undefined,
                search: filters.search || undefined,
            });

            if (!result.success || !result.data) {
                setOffers([]);
                setError(result.message || 'No se pudieron cargar las cargas disponibles');
                return;
            }

            const responseData = result.data as OfferSearchPayload | Offer[];
            const offersArray = Array.isArray(responseData)
                ? responseData
                : Array.isArray(responseData?.data)
                    ? responseData.data
                    : [];

            const sorted = [...offersArray];
            switch (sortBy) {
                case 'price_high':
                    sorted.sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
                    break;
                case 'price_low':
                    sorted.sort((a, b) => (a.totalAmount || 0) - (b.totalAmount || 0));
                    break;
                case 'pickup_date':
                    sorted.sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());
                    break;
                default:
                    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }

            setOffers(sorted);
        } catch (err) {
            console.error('Error fetching offers:', err);
            setOffers([]);
            setError('No se pudieron cargar las cargas disponibles');
        } finally {
            setIsLoading(false);
        }
    }, [canLoadMarketplace, filters, sortBy]);

    React.useEffect(() => {
        if (canLoadMarketplace) {
            fetchOffers();
        }
    }, [canLoadMarketplace, fetchOffers]);

    const handleFilterChange = (key: keyof FilterState, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilters({
            search: '',
            originDepartment: '',
            destDepartment: '',
            cargoType: '',
            vehicleType: '',
        });
    };

    const handleViewDetails = (offer: Offer) => {
        router.push(`/ofertas/${offer.id}`);
    };

    const handleApplyIntent = (offer: Offer) => {
        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(`/ofertas/${offer.id}`)}`);
            return;
        }

        router.push(`/ofertas/${offer.id}`);
    };

    const filteredOffers = React.useMemo(() => {
        if (!filters.search) return offers;
        const query = filters.search.toLowerCase();
        return offers.filter((offer) =>
            offer.cargoType?.toLowerCase().includes(query) ||
            offer.originCity?.toLowerCase().includes(query) ||
            getDestinationCity(offer).toLowerCase().includes(query) ||
            offer.companyName?.toLowerCase().includes(query)
        );
    }, [offers, filters.search]);

    const activeFiltersCount = Object.values(filters).filter(Boolean).length;

    if (privateFleetCheckLoading || isPrivateFleetDriver || privateFleetCheckError) {
        return (
            <DashboardLayout pageTitle="Operacion privada">
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
                    {privateFleetCheckError ? (
                        <AlertCircle className="h-8 w-8 text-zinc-950" />
                    ) : (
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    )}
                    <div>
                        <p className="font-semibold text-zinc-950">
                            {privateFleetCheckError
                                ? 'No se pudo verificar tu tipo de conductor'
                                : isPrivateFleetDriver
                                    ? 'Redirigiendo a Viajes asignados'
                                    : 'Verificando tu tipo de cuenta'}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                            {privateFleetCheckError
                                ? 'Para evitar mostrar marketplace a una cuenta privada, intenta de nuevo desde Inicio.'
                                : 'Los transportistas privados no acceden al marketplace publico.'}
                        </p>
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
        <DashboardLayout pageTitle="Cargas disponibles">
            <div className="kx-dashboard-bleed bg-[#f7f7f5]">
                <div className="kx-page-container">
                    <section className="kx-section rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] md:p-7">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-2xl">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Marketplace KargaX</p>
                                <h1 className="kx-fluid-title mt-2 font-semibold tracking-tight text-zinc-950">
                                    Cargas disponibles
                                </h1>
                                <p className="mt-3 text-sm leading-6 text-zinc-500 md:text-base">
                                    Escanea ruta, monto y requisitos sin ruido. Cada tarjeta deja visible lo que importa para decidir rapido.
                                </p>
                            </div>

                            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:flex sm:items-center">
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Resultados</p>
                                    <p className="mt-1 text-2xl font-semibold text-zinc-950">
                                        {isLoading ? '--' : filteredOffers.length}
                                    </p>
                                </div>
                                <Button variant="outline" onClick={fetchOffers} disabled={isLoading} className="h-full min-h-14">
                                    <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                                    Actualizar
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                            <label className="space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Busqueda</span>
                                <span className="relative block">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        type="text"
                                        value={filters.search}
                                        onChange={(event) => handleFilterChange('search', event.target.value)}
                                        placeholder="Ciudad, tipo de carga o empresa"
                                        className={cn(inputClassName, 'pl-10')}
                                    />
                                </span>
                            </label>

                            <label className="hidden min-w-52 space-y-1.5 lg:block">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Orden</span>
                                <select
                                    value={sortBy}
                                    onChange={(event) => setSortBy(event.target.value)}
                                    className={inputClassName}
                                >
                                    {SORT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>

                            <Button className="lg:hidden" variant="outline" onClick={() => setShowMobileFilters(true)}>
                                <SlidersHorizontal className="h-4 w-4" />
                                Filtros
                                {activeFiltersCount > 0 && (
                                    <span className="ml-1 rounded-full bg-zinc-950 px-2 py-0.5 text-xs text-white">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                className="hidden lg:inline-flex"
                                onClick={handleClearFilters}
                                disabled={activeFiltersCount === 0}
                            >
                                Limpiar filtros
                            </Button>
                        </div>

                        <div className="mt-5 hidden lg:block">
                            <FilterFields filters={filters} onFilterChange={handleFilterChange} departments={departmentOptions} />
                        </div>
                    </section>

                    <div className="mt-5 flex items-center justify-between gap-3 text-sm text-zinc-500">
                        <span>
                            {isLoading ? 'Cargando cargas...' : `${filteredOffers.length} cargas encontradas`}
                        </span>
                        <div className="lg:hidden">
                            <select
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value)}
                                className={inputClassName}
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mt-5">
                        {isLoading ? (
                            <div className="grid kx-safe-grid gap-5">
                                {[...Array(6)].map((_, index) => <OfferSkeleton key={index} />)}
                            </div>
                        ) : error ? (
                            <div className="rounded-lg border border-zinc-200 bg-white px-6 py-16 text-center">
                                <AlertCircle className="mx-auto h-10 w-10 text-zinc-700" />
                                <h2 className="mt-4 text-xl font-semibold text-zinc-950">{error}</h2>
                                <Button className="mt-6" onClick={fetchOffers}>Reintentar</Button>
                            </div>
                        ) : filteredOffers.length === 0 ? (
                            <EmptyState onClear={handleClearFilters} hasFilters={activeFiltersCount > 0} />
                        ) : (
                            <motion.div layout className="grid kx-safe-grid gap-5">
                                <AnimatePresence mode="popLayout">
                                    {filteredOffers.map((offer) => (
                                        <CargoOfferCard
                                            key={offer.id}
                                            offer={offer}
                                            onViewDetails={handleViewDetails}
                                            onApplyIntent={handleApplyIntent}
                                            showApplyButton={isTrucker}
                                            formatAmount={formatAmount}
                                            resolveCityName={resolveCityName}
                                            resolveSubdivisionName={resolveSubdivisionName}
                                        />
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </div>
                </div>

                <MobileFilterSheet
                    isOpen={showMobileFilters}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onClose={() => setShowMobileFilters(false)}
                    onClear={handleClearFilters}
                    departments={departmentOptions}
                />
            </div>
        </DashboardLayout>
    );
}
