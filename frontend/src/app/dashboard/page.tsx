// =============================================================================
// KargaX - Trucker Dashboard Page
// Enterprise-grade offer browsing for truckers
// =============================================================================
//
// ARCHITECTURE:
// - Role-based routing (truckers only, businesses redirect)
// - Real-time offer grid with premium animations
// - Advanced filtering system
// - Optimistic UI updates
// - Full i18n (ES, EN, PT)
//
// =============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Calendar,
    Truck,
    Package,
    Filter,
    RefreshCw,
    ChevronDown,
    Eye,
    Clock,
    Building2,
    ArrowRight,
    TrendingUp,
    CheckCircle2,
    Loader2,
    AlertTriangle,
    X,
    Send,
    Users,
    Warehouse,
    PlusCircle,
    BarChart3,
    Wallet,
    Bell,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card, toast } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store/authStore';
import { cn } from '@/lib/utils';
import { useUserCountry } from '@/lib/platform/useUserCountry';
import { getPrivateFleetDriverTripAction, getPrivateFleetTripStatusLabel } from '@/lib/private-fleet/driver-trip-actions';
import { supabaseApi } from '@/lib/supabase/api-bridge';
import warehouseClient from '@/lib/warehouses/client';
import type { PrivateFleetDriverContext, WarehouseAccessResponse } from '@/lib/warehouses/types';
import { getVehicleTypeName, VEHICLE_TYPES as COLOMBIA_VEHICLE_TYPES } from '@/constants/colombia';
import { TruckerScoreBadge } from '@/components/trucker/TruckerScoreBadge';

// =============================================================================
// Types
// =============================================================================

interface Offer {
    id: string;
    title: string;
    cargoType: string;
    cargoDescription: string;
    originCity: string;
    originDepartment: string;
    destCity: string;
    destDepartment: string;
    pickupDate: string;
    deliveryDate: string;
    budgetMin: number | null;
    budgetMax: number | null;
    totalAmount: number;
    currency: string;
    requiredVehicle: string;
    weightKg: number;
    status: string;
    companyName: string | null;
    createdAt: string;
    publishedAt: string | null;
    applicationsCount?: number;
    hasApplied?: boolean;
}

interface FilterState {
    search: string;
    originDepartment: string;
    destDepartment: string;
    cargoType: string;
    vehicleType: string;
    dateFrom: string;
    dateTo: string;
    amountMin: string;
    amountMax: string;
}

// =============================================================================
// Constants
// =============================================================================

const CARGO_TYPES = [
    { value: '', label: 'Todos los tipos' },
    { value: 'general', label: 'Carga General' },
    { value: 'refrigerated', label: 'Refrigerada' },
    { value: 'dangerous', label: 'Peligrosa' },
    { value: 'fragile', label: 'Fragil' },
    { value: 'bulk', label: 'Granel' },
    { value: 'container', label: 'Contenedor' },
    { value: 'oversize', label: 'Sobredimensionada' },
];

const VEHICLE_TYPES = [
    { value: '', label: 'Todos los vehiculos' },
    ...COLOMBIA_VEHICLE_TYPES.map((vehicle) => ({
        value: vehicle.code,
        label: vehicle.name,
    })),
];

const DEPARTMENTS = [
    { value: '', label: 'Todos' },
    { value: 'Antioquia', label: 'Antioquia' },
    { value: 'Atlantico', label: 'Atlantico' },
    { value: 'Bogota D.C.', label: 'Bogota D.C.' },
    { value: 'Bolivar', label: 'Bolivar' },
    { value: 'Cundinamarca', label: 'Cundinamarca' },
    { value: 'Santander', label: 'Santander' },
    { value: 'Valle del Cauca', label: 'Valle del Cauca' },
];

// =============================================================================
// Utility Functions
// =============================================================================

function formatDate(dateString: string): string {
    try {
        return new Date(dateString).toLocaleDateString('es-CO', {
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return dateString;
    }
}

// formatBudget is now provided by useUserCountry().format
// Kept as a passthrough for the component tree.
function formatBudget(amount: number, formatter: (n: number) => string): string {
    return formatter(amount);
}

// =============================================================================
// Sub-components
// =============================================================================

/** Loading skeleton */
function OfferSkeleton() {
    return (
        <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="h-6 bg-zinc-200 rounded w-3/4" />
                <div className="h-6 w-20 bg-zinc-200 rounded-md" />
            </div>
            <div className="space-y-3">
                <div className="h-4 bg-zinc-200 rounded w-1/2" />
                <div className="h-4 bg-zinc-200 rounded w-2/3" />
                <div className="h-4 bg-zinc-200 rounded w-1/3" />
            </div>
            <div className="mt-4 flex justify-between gap-3 border-t border-zinc-100 pt-4">
                <div className="h-10 bg-zinc-200 rounded w-24" />
                <div className="h-10 bg-zinc-200 rounded w-32" />
            </div>
        </div>
    );
}

/** Stats card */
function StatCard({
    icon: Icon,
    label,
    value,
    trend,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: number | string;
    trend?: string;
    color: string;
}) {
    return (
        <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            className="rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-[0_28px_70px_-46px_rgba(10,10,10,.62)] sm:p-6"
        >
            <div className="flex items-start justify-between mb-4">
                <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', color)}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {trend && (
                    <span className="flex items-center gap-1 text-sm font-medium text-zinc-700">
                        <TrendingUp className="w-4 h-4" />
                        {trend}
                    </span>
                )}
            </div>
            <p className="mb-1 font-money text-2xl font-semibold text-zinc-950 sm:text-3xl">{value}</p>
            <p className="text-sm text-zinc-500">{label}</p>
        </motion.div>
    );
}

/** Offer card for truckers */
function OfferCardTrucker({
    offer,
    t,
    onViewDetails,
    formatAmount,
    resolveCityName,
    resolveSubdivisionName,
}: {
    offer: Offer;
    t: (key: string) => string;
    onViewDetails: (offer: Offer) => void;
    formatAmount: (n: number) => string;
    resolveCityName: (code: string) => string;
    resolveSubdivisionName: (code: string) => string;
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ y: -4 }}
            className={cn(
                'group overflow-hidden rounded-lg border bg-white transition-all duration-300 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]',
                offer.hasApplied
                    ? 'border-zinc-950 bg-zinc-50'
                    : 'border-zinc-200 hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-[0_28px_70px_-46px_rgba(10,10,10,.62)]'
            )}
        >
            <div className="h-1 bg-zinc-950" />

            <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-lg text-zinc-950 transition-colors line-clamp-2">
                            {offer.cargoType} - {offer.weightKg}kg
                        </h3>
                        {offer.companyName && (
                            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-zinc-500">
                                <Building2 className="w-3.5 h-3.5" />
                                <span className="truncate">{offer.companyName}</span>
                            </div>
                        )}
                    </div>
                    {offer.hasApplied && (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-zinc-950 bg-white px-3 py-1 text-xs font-medium text-zinc-950">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('truckerDashboard.applied') || 'Postulado'}
                        </span>
                    )}
                </div>

                {/* Route - now showing full city + department names */}
                <div className="mb-4 grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <div className="min-w-0">
                        <p className="text-xs text-zinc-500 mb-0.5">{t('truckerDashboard.origin') || 'Origen'}</p>
                        <p className="truncate font-medium text-zinc-950">{resolveCityName(offer.originCity)}</p>
                        <p className="truncate text-xs text-zinc-400">{resolveSubdivisionName(offer.originDepartment)}</p>
                    </div>
                    <div className="hidden items-center justify-center sm:flex">
                        <ArrowRight className="w-5 h-5 text-zinc-950" />
                    </div>
                    <div className="min-w-0 sm:text-right">
                        <p className="text-xs text-zinc-500 mb-0.5">{t('truckerDashboard.destination') || 'Destino'}</p>
                        <p className="truncate font-medium text-zinc-950">{resolveCityName(offer.destCity)}</p>
                        <p className="truncate text-xs text-zinc-400">{resolveSubdivisionName(offer.destDepartment)}</p>
                    </div>
                </div>

                {/* Details grid */}
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Calendar className="w-4 h-4 text-zinc-400" />
                        <span>{formatDate(offer.pickupDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Truck className="w-4 h-4 text-zinc-400" />
                        <span className="min-w-0 truncate">{offer.requiredVehicle ? getVehicleTypeName(offer.requiredVehicle) : 'Cualquier'}</span>
                    </div>
                </div>

                {/* Price - Multi-currency */}
                <div className="mb-4 flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-zinc-500 font-medium">
                        {t('truckerDashboard.payment') || 'Pago'}
                    </span>
                    <span className="break-words font-money text-lg font-semibold text-zinc-950 sm:text-xl">
                        {formatAmount(offer.totalAmount)}
                    </span>
                </div>

                {/* Actions */}
                <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => onViewDetails(offer)}
                    >
                        <Eye className="w-4 h-4 mr-2" />
                        {t('truckerDashboard.viewDetails') || 'Ver detalles'}
                    </Button>
                    {!offer.hasApplied && (
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => onViewDetails(offer)}
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Ver requisitos
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/** Filter panel */
function FilterPanel({
    filters,
    onFilterChange,
    onReset,
    isOpen,
    onToggle,
    t,
    departments,
}: {
    filters: FilterState;
    onFilterChange: (key: keyof FilterState, value: string) => void;
    onReset: () => void;
    isOpen: boolean;
    onToggle: () => void;
    t: (key: string) => string;
    departments: Array<{ value: string; label: string }>;
}) {
    return (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
            {/* Toggle header */}
            <button
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-zinc-50"
            >
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-zinc-950" />
                    <span className="font-medium text-zinc-950">
                        {t('truckerDashboard.filters.title') || 'Filtros avanzados'}
                    </span>
                </div>
                <ChevronDown className={cn('w-5 h-5 text-zinc-400 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {/* Filter content */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-zinc-200"
                    >
                        <div className="p-4 space-y-4">
                            {/* Location filters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                                        {t('truckerDashboard.filters.origin') || 'Origen'}
                                    </label>
                                    <select
                                        value={filters.originDepartment}
                                        onChange={(e) => onFilterChange('originDepartment', e.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                    >
                                        {departments.map((d) => (
                                            <option key={d.value} value={d.value}>{d.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                                        {t('truckerDashboard.filters.destination') || 'Destino'}
                                    </label>
                                    <select
                                        value={filters.destDepartment}
                                        onChange={(e) => onFilterChange('destDepartment', e.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                    >
                                        {departments.map((d) => (
                                            <option key={d.value} value={d.value}>{d.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Type filters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                                        {t('truckerDashboard.filters.cargoType') || 'Tipo de carga'}
                                    </label>
                                    <select
                                        value={filters.cargoType}
                                        onChange={(e) => onFilterChange('cargoType', e.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                    >
                                        {CARGO_TYPES.map((c) => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                                        {t('truckerDashboard.filters.vehicleType') || 'Tipo de vehiculo'}
                                    </label>
                                    <select
                                        value={filters.vehicleType}
                                        onChange={(e) => onFilterChange('vehicleType', e.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                    >
                                        {VEHICLE_TYPES.map((v) => (
                                            <option key={v.value} value={v.value}>{v.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Reset button */}
                            <div className="flex justify-end pt-2">
                                <Button variant="ghost" size="sm" onClick={onReset}>
                                    <X className="w-4 h-4 mr-1" />
                                    {t('truckerDashboard.filters.reset') || 'Limpiar filtros'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Empty state */
function EmptyState({ t }: { t: (key: string) => string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center px-4 py-14 text-center sm:px-8 sm:py-16"
        >
            <div className="w-20 h-20 rounded-lg border border-zinc-200 bg-white flex items-center justify-center mb-6 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
                <Package className="w-10 h-10 text-zinc-950" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-950 mb-2">
                {t('truckerDashboard.empty.title') || 'No hay ofertas disponibles'}
            </h3>
            <p className="text-zinc-600 max-w-sm">
                {t('truckerDashboard.empty.description') || 'Vuelve mas tarde o ajusta los filtros para ver mas ofertas.'}
            </p>
        </motion.div>
    );
}

function TruckerMetricStrip({
    available,
    applied,
}: {
    available: number;
    applied: number;
}) {
    const metrics = [
        { label: 'Disponibles', value: available, icon: Package },
        { label: 'Postulaciones', value: applied, icon: Send },
        { label: 'Viajes', value: 0, icon: Truck },
        { label: 'Score', value: 'KX', icon: CheckCircle2 },
    ];

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
                <Card key={metric.label} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{metric.label}</p>
                            <p className="mt-2 font-money text-xl font-semibold text-zinc-950 sm:text-2xl">{metric.value}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
                            <metric.icon className="h-5 w-5" />
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function CommercialActivationCard({
    activation,
}: {
    activation: WarehouseAccessResponse['commercialActivation'] | null | undefined;
}) {
    if (!activation) {
        return null;
    }

    const completedSteps = activation.checklist.filter((item) => item.completed).length;
    const statusCopy = {
        setup: {
            label: 'Configuracion',
            title: 'Activa KargaX con operacion real',
            description: 'La cuenta no se considera activada solo por registrarse. La meta es cerrar 3 entregas con evidencia.',
        },
        first_value: {
            label: 'Primer valor',
            title: 'Ya tienes evidencia real en KargaX',
            description: 'El siguiente paso es usar una ruta completa y revisar el reporte de novedades.',
        },
        activated: {
            label: 'Activada',
            title: 'Empresa activada operativamente',
            description: 'Ya cerraste 3 entregas con evidencia. Growth o Scale mantienen el flujo sin frenar despachos.',
        },
    }[activation.status];

    return (
        <Card className="border-zinc-200 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                        <CheckCircle2 className="h-4 w-4" />
                        {statusCopy.label}
                    </div>
                    <h2 className="text-xl font-semibold text-zinc-950">{statusCopy.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{statusCopy.description}</p>
                </div>
                <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 lg:w-64">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Entregas con evidencia</p>
                    <p className="mt-2 font-money text-2xl font-semibold text-zinc-950">
                        {activation.completedDeliveriesWithEvidence} / {activation.activationTarget}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {completedSteps} de {activation.checklist.length} pasos completados.
                    </p>
                </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {activation.checklist.map((item) => (
                    <Link key={item.key} href={item.href} className="min-w-0">
                        <div className={cn(
                            'flex h-full min-w-0 items-center gap-3 rounded-lg border p-3 transition hover:border-zinc-950',
                            item.completed
                                ? 'border-zinc-950 bg-zinc-950 text-white'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-950'
                        )}>
                            <CheckCircle2 className={cn('h-4 w-4 shrink-0', item.completed ? 'text-white' : 'text-zinc-400')} />
                            <span className="min-w-0 flex-1 break-words text-sm font-semibold">{item.label}</span>
                            <ArrowRight className={cn('h-4 w-4 shrink-0', item.completed ? 'text-white/70' : 'text-zinc-400')} />
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-zinc-500">
                    Activacion real: 3 entregas cerradas con evidencia, no solo una cuenta creada.
                </p>
                <Button asChild>
                    <Link href={activation.nextActionHref}>
                        {activation.nextActionLabel}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </Card>
    );
}

function BusinessDashboardHome() {
    const { user } = useAuthStore();
    const [isLoading, setIsLoading] = React.useState(true);
    const [commercialActivation, setCommercialActivation] = React.useState<WarehouseAccessResponse['commercialActivation'] | null>(null);
    const [stats, setStats] = React.useState({
        totalOffers: 0,
        activeOffers: 0,
        applications: 0,
        warehouses: 0,
        teamMembers: 0,
        planName: 'Free',
    });

    const loadBusinessDashboard = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [offersResult, accessResult] = await Promise.all([
                supabaseApi.offers.getMyOffers({ status: 'all' }),
                warehouseClient.getWarehouseAccess().catch(() => null),
            ]);

            const offers = Array.isArray(offersResult.data) ? offersResult.data : [];
            const activeOffers = offers.filter((offer) => offer.status === 'active').length;
            const applications = offers.reduce(
                (total, offer) => total + Number(offer.applicationsCount || 0),
                0
            );

            setStats({
                totalOffers: offers.length,
                activeOffers,
                applications,
                warehouses: accessResult?.limits?.activeWarehouses ?? accessResult?.warehouses?.length ?? 0,
                teamMembers: accessResult?.limits?.activeInternalUsers ?? 0,
                planName: accessResult?.subscription?.plan?.name || accessResult?.subscription?.plan_code || 'Free',
            });
            setCommercialActivation(accessResult?.commercialActivation ?? null);
        } catch (error) {
            setCommercialActivation(null);
            toast.error('Dashboard', error instanceof Error ? error.message : 'No se pudieron cargar las metricas');
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadBusinessDashboard();
    }, [loadBusinessDashboard]);

    const quickActions = [
        {
            href: '/ofertas/publicar',
            label: 'Publicar oferta',
            description: 'Crear una carga nueva para transportadores o flota privada.',
            icon: PlusCircle,
        },
        {
            href: '/ofertas/mis-ofertas',
            label: 'Mis ofertas',
            description: 'Revisar publicaciones, postulaciones y estados.',
            icon: Package,
        },
        {
            href: '/bodegas',
            label: 'Bodegas',
            description: 'Operar inventario, citas, despachos e incidentes.',
            icon: Warehouse,
        },
        {
            href: '/equipo',
            label: 'Equipo',
            description: 'Invitar usuarios internos y asignar bodegas.',
            icon: Users,
        },
    ];

    return (
        <DashboardLayout pageTitle="Dashboard empresarial">
            <div className="space-y-8">
                <div className="rounded-lg bg-zinc-950 p-5 text-white shadow-[0_32px_80px_-46px_rgba(0,0,0,.85)] sm:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-zinc-200">
                                <BarChart3 className="h-4 w-4" />
                                Home empresa
                            </div>
                            <h1 className="text-2xl font-bold sm:text-3xl">
                                Hola, {user?.fullName || 'equipo'}.
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                                Este es tu centro de operacion para ofertas, bodega, equipo y facturacion.
                            </p>
                        </div>
                        <div className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 sm:w-auto sm:px-5">
                            <p className="text-xs text-zinc-300">Plan actual</p>
                            <p className="break-words font-money text-xl font-semibold sm:text-2xl">{stats.planName}</p>
                        </div>
                    </div>
                </div>

                <CommercialActivationCard activation={commercialActivation} />

                {isLoading ? (
                    <div className="flex min-h-[240px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <StatCard
                                icon={Package}
                                label="Ofertas publicadas"
                                value={stats.totalOffers}
                                color="bg-zinc-950"
                            />
                            <StatCard
                                icon={CheckCircle2}
                                label="Ofertas activas"
                                value={stats.activeOffers}
                                color="bg-zinc-950"
                            />
                            <StatCard
                                icon={Users}
                                label="Postulaciones recibidas"
                                value={stats.applications}
                                color="bg-zinc-950"
                            />
                            <StatCard
                                icon={Warehouse}
                                label="Bodegas activas"
                                value={stats.warehouses}
                                color="bg-zinc-950"
                            />
                        </div>

                        <div>
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-zinc-950">Accesos rapidos</h2>
                                    <p className="text-sm text-zinc-500">Continua con las tareas operativas principales.</p>
                                </div>
                                <Button variant="outline" onClick={() => void loadBusinessDashboard()}>
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {quickActions.map((action) => (
                                    <Link key={action.href} href={action.href}>
                                        <Card variant="interactive" className="h-full p-5">
                                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
                                                <action.icon className="h-5 w-5" />
                                            </div>
                                            <h3 className="font-semibold text-zinc-950">{action.label}</h3>
                                            <p className="mt-2 text-sm leading-6 text-zinc-500">{action.description}</p>
                                            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-zinc-950">
                                                Abrir <ArrowRight className="h-4 w-4" />
                                            </div>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

function PrivateFleetDashboardHome({ context }: { context: PrivateFleetDriverContext }) {
    const { user } = useAuthStore();
    const {
        format: formatAmount,
        getCityName: resolveCityName,
        getSubName: resolveSubdivisionName,
    } = useUserCountry();
    const activeTrips = context.assignedTrips.filter((trip) => ['assigned', 'reserved', 'in_progress'].includes(trip.status));
    const upcomingTrips = activeTrips.length ? activeTrips : context.assignedTrips.slice(0, 3);
    const metrics = [
        { label: 'Empresa', value: context.businessName || 'Flota privada', detail: 'Cuenta corporativa', icon: Building2 },
        { label: 'Viajes activos', value: context.stats.activeTrips, detail: 'Asignados por tu empresa', icon: Truck },
        { label: 'Completados', value: context.stats.privateTripsCompleted, detail: 'Historial privado', icon: CheckCircle2 },
        { label: 'Nomina liberada', value: formatAmount(context.stats.payrollReleasedThisMonthCop), detail: 'Este mes', icon: Wallet },
    ];
    const actions = [
        {
            href: '/viajes-asignados',
            label: 'Viajes asignados',
            description: 'Acepta, rechaza o abre rutas privadas enviadas por tu empresa.',
            icon: Truck,
        },
        {
            href: '/billetera',
            label: 'Mi Billetera',
            description: 'Consulta pagos privados, gastos liberados y retiros.',
            icon: Wallet,
        },
        {
            href: '/notificaciones',
            label: 'Notificaciones',
            description: 'Alertas de viajes, pagos, PIN y evidencia operativa.',
            icon: Bell,
        },
    ];

    return (
        <DashboardLayout pageTitle="Operacion privada">
            <div className="space-y-8">
                <div className="rounded-lg bg-zinc-950 p-5 text-white shadow-[0_32px_80px_-46px_rgba(0,0,0,.85)] sm:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-zinc-200">
                                <Building2 className="h-4 w-4" />
                                Transportista privado
                            </div>
                            <h1 className="text-2xl font-bold sm:text-3xl">
                                Hola, {user?.fullName || 'conductor'}.
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                                Tu operacion pertenece a {context.businessName || 'tu empresa'}. Aqui solo veras rutas privadas,
                                pagos y acciones asignadas por la flota corporativa.
                            </p>
                        </div>
                        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto">
                            <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                                <p className="text-xs text-zinc-300">Placa</p>
                                <p className="break-words font-money text-xl font-semibold">{context.vehiclePlate || 'Pendiente'}</p>
                            </div>
                            <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                                <p className="text-xs text-zinc-300">ID interno</p>
                                <p className="break-words font-money text-xl font-semibold">{context.internalDriverId || 'Sin ID'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((metric) => (
                        <Card key={metric.label} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{metric.label}</p>
                                    <p className="mt-2 break-words font-money text-xl font-semibold text-zinc-950 sm:text-2xl">{metric.value}</p>
                                    <p className="mt-1 text-sm text-zinc-500">{metric.detail}</p>
                                </div>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
                                    <metric.icon className="h-5 w-5" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)]">
                    <Card className="p-5 sm:p-6">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-950">Viajes privados asignados</h2>
                                <p className="text-sm text-zinc-500">Solo rutas enviadas por {context.businessName || 'tu empresa'}.</p>
                            </div>
                            <Link href="/viajes-asignados">
                                <Button variant="outline">
                                    Confirmar / iniciar rutas
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>

                        {upcomingTrips.length ? (
                            <div className="grid gap-3">
                                {upcomingTrips.map((trip) => {
                                    const tripAction = getPrivateFleetDriverTripAction(trip);

                                    return (
                                        <article key={trip.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-950 hover:bg-white">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                        {getPrivateFleetTripStatusLabel(trip.status)}
                                                    </p>
                                                    <p className="mt-2 font-semibold text-zinc-950">
                                                        {resolveCityName(trip.originCity || '')}
                                                        <ArrowRight className="mx-2 inline h-4 w-4 align-[-2px] text-zinc-400" />
                                                        {resolveCityName(trip.destinationCity || '')}
                                                    </p>
                                                    <p className="mt-1 text-sm text-zinc-500">
                                                        {resolveSubdivisionName(trip.originDepartment || '')} a {resolveSubdivisionName(trip.destinationDepartment || '')}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-left sm:text-right">
                                                    <p className="font-money text-lg font-semibold text-zinc-950">{formatAmount(trip.totalAmount)}</p>
                                                    <p className="text-xs text-zinc-500">{trip.pickupDate ? formatDate(trip.pickupDate) : 'Fecha pendiente'}</p>
                                                </div>
                                            </div>
                                            {tripAction ? (
                                                <div className="mt-4 flex justify-start sm:justify-end">
                                                    <Button asChild size="sm" variant={tripAction.label === 'Confirmar viaje' ? 'primary' : 'dark'}>
                                                        <Link href={tripAction.href}>
                                                            {tripAction.label}
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center">
                                <Truck className="mx-auto h-10 w-10 text-zinc-700" />
                                <p className="mt-4 font-semibold text-zinc-950">No tienes viajes privados activos</p>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                                    Cuando tu empresa te asigne una ruta, aparecera aqui con la trazabilidad operativa.
                                </p>
                            </div>
                        )}
                    </Card>

                    <div>
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-zinc-950">Accesos privados</h2>
                            <p className="text-sm text-zinc-500">Herramientas permitidas para tu operacion corporativa.</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                            {actions.map((action) => (
                                <Link key={action.href} href={action.href}>
                                    <Card variant="interactive" className="h-full p-5">
                                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
                                            <action.icon className="h-5 w-5" />
                                        </div>
                                        <h3 className="font-semibold text-zinc-950">{action.label}</h3>
                                        <p className="mt-2 text-sm leading-6 text-zinc-500">{action.description}</p>
                                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-zinc-950">
                                            Abrir <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function TruckerDashboardGate() {
    const router = useRouter();
    const [context, setContext] = React.useState<PrivateFleetDriverContext | null>(null);
    const [isContextLoading, setIsContextLoading] = React.useState(true);
    const [contextError, setContextError] = React.useState<string | null>(null);

    const loadContext = React.useCallback(async () => {
        setIsContextLoading(true);
        setContextError(null);

        try {
            const response = await warehouseClient.getPrivateFleetDriverContext();
            setContext(response);

            if (response.isPrivateFleetDriver) {
                router.replace('/viajes-asignados');
            }
        } catch (error) {
            setContext(null);
            setContextError(error instanceof Error ? error.message : 'No se pudo verificar si eres conductor privado o freelancer');
        } finally {
            setIsContextLoading(false);
        }
    }, [router]);

    React.useEffect(() => {
        let cancelled = false;

        const loadSafely = async () => {
            if (!cancelled) {
                await loadContext();
            }
        };

        void loadSafely();

        return () => {
            cancelled = true;
        };
    }, [loadContext]);

    if (isContextLoading) {
        return (
            <DashboardLayout pageTitle="Dashboard">
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    <div>
                        <p className="font-semibold text-zinc-950">Verificando tipo de conductor</p>
                        <p className="mt-1 text-sm text-zinc-500">
                            Separando operacion privada de cuenta freelancer.
                        </p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (context?.isPrivateFleetDriver) {
        return (
            <DashboardLayout pageTitle="Viajes asignados">
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    <div>
                        <p className="font-semibold text-zinc-950">Redirigiendo a Viajes asignados</p>
                        <p className="mt-1 text-sm text-zinc-500">
                            Tu cuenta pertenece a {context.businessName || 'una flota privada'}.
                        </p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (contextError) {
        return (
            <DashboardLayout pageTitle="Dashboard">
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 px-4 text-center">
                    <AlertTriangle className="h-9 w-9 text-zinc-950" />
                    <div>
                        <p className="font-semibold text-zinc-950">No se pudo verificar tu tipo de conductor</p>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                            Para evitar mostrarte el dashboard equivocado, vuelve a intentar la verificacion.
                        </p>
                    </div>
                    <Button onClick={loadContext} leftIcon={<RefreshCw className="h-4 w-4" />}>
                        Reintentar
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    return <TruckerDashboardContent />;
}

// =============================================================================
// Main Component
// =============================================================================

function TruckerDashboardContent() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const {
        format: formatAmount,
        getCityName: resolveCityName,
        getSubName: resolveSubdivisionName,
        subdivisions,
    } = useUserCountry();
    const [offers, setOffers] = React.useState<Offer[]>([]);
    const [applyingOfferId, setApplyingOfferId] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);

    const [filters, setFilters] = React.useState<FilterState>({
        search: '',
        originDepartment: '',
        destDepartment: '',
        cargoType: '',
        vehicleType: '',
        dateFrom: '',
        dateTo: '',
        amountMin: '',
        amountMax: '',
    });

    const departmentOptions = React.useMemo(
        () => [
            { value: '', label: 'Todos' },
            ...subdivisions.map((item) => ({ value: item.code, label: item.name })),
        ],
        [subdivisions]
    );

    // Redirect businesses to their dashboard
    React.useEffect(() => {
        if (user?.userType === 'business') {
            router.push('/ofertas/mis-ofertas');
        }
    }, [user, router]);

    // Fetch offers
    const fetchOffers = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('[Dashboard] Fetching active offers...');
            const result = await supabaseApi.offers.search({
                status: 'active',
                originDepartment: filters.originDepartment || undefined,
                destinationDepartment: filters.destDepartment || undefined,
                cargoType: filters.cargoType || undefined,
                vehicleType: filters.vehicleType || undefined,
                search: filters.search || undefined,
            });

            console.log('[Dashboard] Search result:', result);

            if (result.success && result.data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const responseData = result.data as any;
                const offersArray = responseData?.data || responseData || [];
                console.log('[Dashboard] Offers found:', offersArray.length);
                setOffers(Array.isArray(offersArray) ? offersArray : []);
            } else {
                console.warn('[Dashboard] No data or error:', result.message);
            }
        } catch (err) {
            console.error('Error fetching offers:', err);
            setError('Error al cargar ofertas');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    React.useEffect(() => {
        fetchOffers();
    }, [fetchOffers]);

    const fetchStats = React.useCallback(async () => {
        // Quick apply is intentionally disabled; stats are no longer rendered here.
    }, []);

    // Handlers
    const handleFilterChange = (key: keyof FilterState, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleResetFilters = () => {
        setFilters({
            search: '', originDepartment: '', destDepartment: '',
            cargoType: '', vehicleType: '', dateFrom: '', dateTo: '',
            amountMin: '', amountMax: '',
        });
    };

    const handleViewDetails = (offer: Offer) => {
        router.push(`/ofertas/${offer.id}`);
    };

    const handleQuickApply = async (offer: Offer) => {
        setApplyingOfferId(offer.id);
        try {
            const result = await supabaseApi.offers.apply(offer.id);
            if (result.success) {
                toast.success(t('truckerDashboard.applySuccess') || 'Postulacion enviada');
                setOffers((prev) => prev.map((o) => o.id === offer.id ? { ...o, hasApplied: true } : o));
                fetchStats();
            } else {
                toast.error('Error', result.message || 'No se pudo postular');
            }
        } catch (err) {
            toast.error('Error', 'No se pudo enviar la postulacion');
        } finally {
            setApplyingOfferId(null);
        }
    };

    // Filter offers by search
    const filteredOffers = React.useMemo(() => {
        if (!filters.search) return offers;
        const query = filters.search.toLowerCase();
        return offers.filter((o) =>
            o.cargoType?.toLowerCase().includes(query) ||
            o.originCity?.toLowerCase().includes(query) ||
            o.destCity?.toLowerCase().includes(query)
        );
    }, [offers, filters.search]);

    const appliedOffersCount = React.useMemo(
        () => offers.filter((offer) => offer.hasApplied).length,
        [offers]
    );

    return (
        <DashboardLayout pageTitle="Ofertas para transportar">
            <div className="space-y-8">
                <TruckerMetricStrip available={filteredOffers.length} applied={appliedOffersCount} />
                <TruckerScoreBadge />

                {/* Search bar */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        placeholder={t('truckerDashboard.searchPlaceholder') || 'Buscar por tipo de carga, origen o destino...'}
                        className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-12 pr-4 text-base transition-all focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10 sm:py-4 sm:text-lg"
                    />
                </div>

                {/* Filters */}
                <FilterPanel
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onReset={handleResetFilters}
                    isOpen={isFiltersOpen}
                    onToggle={() => setIsFiltersOpen(!isFiltersOpen)}
                    t={t}
                    departments={departmentOptions}
                />

                {/* Results header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-semibold text-zinc-950">
                        {t('truckerDashboard.availableOffers') || 'Ofertas disponibles'}
                        <span className="ml-2 font-money text-zinc-500">({filteredOffers.length})</span>
                    </h2>
                    <Button
                        variant="outline"
                        onClick={fetchOffers}
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                        {t('common.refresh') || 'Actualizar'}
                    </Button>
                </div>

                {/* Offers grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[...Array(6)].map((_, i) => <OfferSkeleton key={i} />)}
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <AlertTriangle className="w-12 h-12 text-zinc-950 mx-auto mb-4" />
                        <p className="text-zinc-600">{error}</p>
                        <Button onClick={fetchOffers} className="mt-4">Reintentar</Button>
                    </div>
                ) : filteredOffers.length === 0 ? (
                    <EmptyState t={t} />
                ) : (
                    <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <AnimatePresence mode="popLayout">
                            {filteredOffers.map((offer) => (
                                <OfferCardTrucker
                                    key={offer.id}
                                    offer={offer}
                                    t={t}
                                    onViewDetails={handleViewDetails}
                                    formatAmount={formatAmount}
                                    resolveCityName={resolveCityName}
                                    resolveSubdivisionName={resolveSubdivisionName}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        </DashboardLayout>
    );
}

export default function DashboardPage() {
    const { user } = useAuthStore();

    if (user?.userType === 'business' || user?.userType === 'admin') {
        return <BusinessDashboardHome />;
    }

    return <TruckerDashboardGate />;
}
