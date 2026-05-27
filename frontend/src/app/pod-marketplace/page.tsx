'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    ChevronRight,
    ClipboardCheck,
    FileSearch,
    Loader2,
    Package,
    Search,
    ShieldCheck,
    Truck,
    XCircle,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
    formatMarketplacePodDate,
    getMarketplacePodList,
    type MarketplacePodStatus,
} from '@/lib/pod-marketplace';
import { cn } from '@/lib/utils';

interface MarketplacePodListItem {
    offerId: string;
    status: MarketplacePodStatus;
    phase: 'loading' | 'delivery';
    trucker: { id: string; fullName: string };
    route: { originCity: string; destinationCity: string };
    summary: {
        totalItems: number;
        loadedItems: number;
        deliveredItems: number;
        rejectedItems: number;
        rejectedItemCount?: number;
        totalPhotos: number;
        loadingCompliancePercent: number;
        deliveryCompliancePercent: number;
    };
    createdAt: string;
}

const statusLabels: Record<MarketplacePodStatus | 'all' | 'issues', string> = {
    all: 'Todas',
    issues: 'Con novedad',
    pending: 'Pendientes',
    in_progress: 'En proceso',
    loading: 'En ruta',
    delivery: 'Entrega',
    completed: 'Completadas',
    cancelled: 'Canceladas',
};

function StatusPill({ status }: { status: MarketplacePodStatus }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {statusLabels[status]}
        </span>
    );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
    return (
        <Card className="border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                    <p className="mt-1 font-money text-2xl font-semibold text-zinc-950">{value}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                    <Icon className="h-4 w-4 text-zinc-700" />
                </div>
            </div>
        </Card>
    );
}

function MarketplacePodCard({ pod, locale }: { pod: MarketplacePodListItem; locale: string }) {
    const hasIssues = pod.summary.rejectedItems > 0;
    const route = `${pod.route.originCity || 'Origen'} -> ${pod.route.destinationCity || 'Destino'}`;

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Link href={`/pod-marketplace/${pod.offerId}`} className="block min-w-0">
                <Card className="group kx-trip-panel border-zinc-200 bg-white p-4 transition-all hover:border-zinc-950 hover:shadow-[0_24px_60px_-48px_rgba(10,10,10,.65)]">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="kx-route-title text-lg font-semibold tracking-tight text-zinc-950">{route}</h3>
                                <StatusPill status={pod.status} />
                                {hasIssues ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-800">
                                        <XCircle className="h-3.5 w-3.5" />
                                        Revisar evidencia
                                    </span>
                                ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                                <span className="inline-flex items-center gap-1.5">
                                    <Truck className="h-4 w-4" />
                                    {pod.trucker.fullName || 'Conductor'}
                                </span>
                                <span className="font-money text-xs">{formatMarketplacePodDate(pod.createdAt, locale)}</span>
                            </div>
                        </div>

                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950">
                            Ver expediente POD
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                    </div>

                    <div className="kx-trip-metrics mt-4 grid gap-2">
                        {[
                            ['Items', pod.summary.totalItems],
                            ['Cargados', pod.summary.loadedItems],
                            ['Entregados', pod.summary.deliveredItems],
                            ['Rechazados', pod.summary.rejectedItems],
                            ['Fotos', pod.summary.totalPhotos],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                                <p className="mt-1 font-money text-lg font-semibold text-zinc-950">{value}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </Link>
        </motion.div>
    );
}

function EmptyState() {
    return (
        <Card className="border-zinc-200 bg-white p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                <ClipboardCheck className="h-6 w-6 text-zinc-700" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-zinc-950">Aún no hay evidencias marketplace registradas.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
                Cuando una ruta pública tenga cargue, entrega o novedades, aparecerá aquí como expediente POD.
            </p>
            <Button asChild className="mt-6" variant="outline">
                <Link href="/ofertas/mis-ofertas">Ver mis ofertas</Link>
            </Button>
        </Card>
    );
}

export default function MarketplacePodListPage() {
    const { user } = useAuthStore();
    const [pods, setPods] = React.useState<MarketplacePodListItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<MarketplacePodStatus | 'all' | 'issues'>('all');
    const locale = 'es-CO';

    React.useEffect(() => {
        async function fetchMarketplacePods() {
            if (!user?.id) return;

            setIsLoading(true);
            setError(null);
            try {
                const response = await getMarketplacePodList(user.id, { limit: 50 });
                if (response.success && response.data) {
                    setPods(response.data as MarketplacePodListItem[]);
                } else {
                    setError(response.error || 'No pudimos cargar la evidencia digital.');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'No pudimos cargar la evidencia digital.');
            } finally {
                setIsLoading(false);
            }
        }

        void fetchMarketplacePods();
    }, [user?.id]);

    const metrics = React.useMemo(() => ({
        total: pods.length,
        issues: pods.filter((item) => item.summary.rejectedItems > 0).length,
        rejected: pods.reduce((total, item) => total + item.summary.rejectedItems, 0),
        completed: pods.filter((item) => item.status === 'completed').length,
        pending: pods.filter((item) => item.status !== 'completed').length,
    }), [pods]);

    const filteredPods = React.useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return pods.filter((pod) => {
            const matchesQuery = !query
                || pod.route.originCity?.toLowerCase().includes(query)
                || pod.route.destinationCity?.toLowerCase().includes(query)
                || pod.trucker.fullName?.toLowerCase().includes(query);
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'issues' ? pod.summary.rejectedItems > 0 : pod.status === statusFilter);
            return matchesQuery && matchesStatus;
        });
    }, [pods, searchQuery, statusFilter]);

    if (isLoading) {
        return (
            <DashboardLayout pageTitle="Evidencia Digital MK">
                <div className="mx-auto flex min-h-[420px] max-w-6xl items-center justify-center p-6">
                    <div className="text-center">
                        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-zinc-800" />
                        <p className="text-sm text-zinc-600">Cargando expedientes operativos</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Evidencia Digital MK">
            <div className="kx-trip-container space-y-6 p-3 min-[380px]:p-4 md:p-6 lg:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Evidencia digital Marketplace</h1>
                        <p className="mt-1 text-sm text-zinc-600">POD de cargue, ruta y entrega para rutas públicas.</p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/ofertas/mis-ofertas">
                            <FileSearch className="h-4 w-4" />
                            Ver ofertas
                        </Link>
                    </Button>
                </div>

                <div className="kx-trip-metrics grid gap-3">
                    <Metric label="Total" value={metrics.total} icon={ClipboardCheck} />
                    <Metric label="Con novedad" value={metrics.issues} icon={AlertCircle} />
                    <Metric label="Rechazos" value={metrics.rejected} icon={XCircle} />
                    <Metric label="Completadas" value={metrics.completed} icon={ShieldCheck} />
                    <Metric label="Pendientes" value={metrics.pending} icon={Package} />
                </div>

                <Card className="kx-trip-panel border-zinc-200 bg-white p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Buscar por ruta o conductor"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                            />
                        </div>
                        <div className="kx-scroll-row flex gap-2 pb-1 lg:flex-wrap lg:overflow-visible">
                            {(['all', 'pending', 'in_progress', 'loading', 'delivery', 'completed', 'issues'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    onClick={() => setStatusFilter(filter)}
                                    className={cn(
                                        'kx-touch-target shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition',
                                        statusFilter === filter
                                            ? 'border-zinc-950 bg-zinc-950 text-white'
                                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
                                    )}
                                >
                                    {statusLabels[filter]}
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>

                {error ? (
                    <Card className="border-zinc-300 bg-white p-4">
                        <div className="flex items-start gap-3 text-zinc-800">
                            <AlertCircle className="mt-0.5 h-5 w-5" />
                            <div>
                                <p className="font-semibold">No pudimos cargar la evidencia digital.</p>
                                <p className="mt-1 text-sm text-zinc-600">{error}</p>
                            </div>
                        </div>
                    </Card>
                ) : null}

                {filteredPods.length === 0 && !error ? (
                    <EmptyState />
                ) : (
                    <div className="space-y-3">
                        {filteredPods.map((pod) => (
                            <MarketplacePodCard key={pod.offerId} pod={pod} locale={locale} />
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

