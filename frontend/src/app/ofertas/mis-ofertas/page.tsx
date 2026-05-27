// =============================================================================
// KargaX - My Offers Page
// Enterprise-grade offer management dashboard for business users
// Oracle/Amazon-level stability, security, and scalability
// =============================================================================
//
// ARCHITECTURE:
// - Server-side rendering with client-side interactivity
// - Optimistic UI updates for instant feedback
// - Error boundaries and graceful degradation
// - Full i18n support (ES, EN, PT)
// - Responsive design (mobile-first)
// - Role-based access (business users only)
//
// FEATURES:
// - Status filter tabs (all, draft, active, in_progress, completed, cancelled)
// - Search and sort functionality
// - Application management (accept/reject truckers)
// - Real-time status updates
// - Loading skeletons and empty states
//
// =============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package,
    MapPin,
    Calendar,
    DollarSign,
    Users,
    Eye,
    Edit3,
    Trash2,
    Send,
    CheckCircle2,
    XCircle,
    Clock,
    Truck,
    Trophy,
    FileEdit,
    Search,
    Filter,
    RefreshCw,
    Plus,
    ChevronDown,
    ArrowUpRight,
    Loader2,
    AlertTriangle,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card, toast } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store/authStore';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { formatCOP } from '@/constants/colombia';

// =============================================================================
// Types & Interfaces
// =============================================================================

/** Offer status enum matching backend */
type OfferStatus = 'draft' | 'active' | 'assigned' | 'reserved' | 'in_progress' | 'completed' | 'cancelled' | 'expired';

/** Offer data structure from API */
interface Offer {
    id: string;
    title: string;
    cargoType: string;
    originCity: string;
    destCity: string;
    pickupDate: string;
    budgetMin: number | null;
    budgetMax: number | null;
    currency: string;
    requiredVehicle: string | null;
    status: OfferStatus;
    assignmentMode?: 'public' | 'private';
    companyName: string | null;
    createdAt: string;
    applicationsCount?: number;
}

/** Application from a trucker */
interface Application {
    id: string;
    offerId: string;
    truckerId: string;
    status: 'pending' | 'accepted' | 'rejected';
    proposedAmount: number | null;
    message: string | null;
    truckerName: string;
    truckerEmail: string;
    truckerPhone: string | null;
    yearsExperience: number | null;
    createdAt: string;
}

/** Filter tab configuration */
interface FilterTab {
    id: string;
    status: OfferStatus | 'all';
    icon: React.ElementType;
    color: string;
    bgColor: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Status configuration with colors and icons */
const STATUS_CONFIG: Record<OfferStatus, { icon: React.ElementType; color: string; bgColor: string }> = {
    draft: { icon: FileEdit, color: 'text-zinc-600', bgColor: 'bg-zinc-100' },
    active: { icon: CheckCircle2, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    assigned: { icon: Truck, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    reserved: { icon: DollarSign, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    in_progress: { icon: Truck, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    completed: { icon: Trophy, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    cancelled: { icon: XCircle, color: 'text-zinc-600', bgColor: 'bg-zinc-100' },
    expired: { icon: Clock, color: 'text-slate-500', bgColor: 'bg-slate-100' },
};

/** Filter tabs configuration */
const FILTER_TABS: FilterTab[] = [
    { id: 'all', status: 'all', icon: Package, color: 'text-slate-600', bgColor: 'bg-slate-100' },
    { id: 'draft', status: 'draft', icon: FileEdit, color: 'text-slate-600', bgColor: 'bg-slate-100' },
    { id: 'active', status: 'active', icon: CheckCircle2, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    { id: 'reserved', status: 'reserved', icon: DollarSign, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    { id: 'inProgress', status: 'in_progress', icon: Truck, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    { id: 'completed', status: 'completed', icon: Trophy, color: 'text-zinc-950', bgColor: 'bg-zinc-100' },
    { id: 'cancelled', status: 'cancelled', icon: XCircle, color: 'text-zinc-600', bgColor: 'bg-zinc-100' },
];

// =============================================================================
// Utility Functions
// =============================================================================

/** Format date for display */
function formatDate(dateString: string, locale: string = 'es-CO'): string {
    try {
        return new Date(dateString).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return dateString;
    }
}

/** Format budget range */
function formatBudget(min: number | null, max: number | null, currency: string): string {
    if (!min && !max) return '-';
    if (min && max && min !== max) {
        return `${formatCOP(min)} - ${formatCOP(max)}`;
    }
    return formatCOP(max || min || 0);
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Loading skeleton for offer cards */
function OfferCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
            <div className="flex justify-between items-start mb-4">
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-6 w-20 bg-slate-200 rounded-full" />
            </div>
            <div className="space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-2/3" />
                <div className="h-4 bg-slate-200 rounded w-1/3" />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                <div className="h-8 bg-slate-200 rounded w-24" />
                <div className="h-8 bg-slate-200 rounded w-24" />
            </div>
        </div>
    );
}

/** Status badge component */
function StatusBadge({ status, t }: { status: OfferStatus; t: (key: string) => string }) {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
            config.bgColor,
            config.color
        )}>
            <Icon className="w-3.5 h-3.5" />
            {t(`myOffers.status.${status}`)}
        </span>
    );
}

/** Empty state component */
function EmptyState({
    filter,
    t,
    onNewOffer
}: {
    filter: string;
    t: (key: string) => string;
    onNewOffer: () => void;
}) {
    const emptyKey = filter === 'all' ? 'all' : filter.replace('_', '');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 px-8 text-center"
        >
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <Package className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {t(`myOffers.empty.${emptyKey}.title`) || 'No offers'}
            </h3>
            <p className="text-slate-600 max-w-sm mb-6">
                {t(`myOffers.empty.${emptyKey}.description`) || 'Publish your first offer'}
            </p>
            {(filter === 'all' || filter === 'active') && (
                <Button onClick={onNewOffer} leftIcon={<Plus className="w-4 h-4" />}>
                    {t('myOffers.actions.newOffer')}
                </Button>
            )}
        </motion.div>
    );
}

/** Individual offer card */
function OfferCard({
    offer,
    t,
    onViewApplications,
    onEdit,
    onDelete,
    onPublish,
}: {
    offer: Offer;
    t: (key: string) => string;
    onViewApplications: (offer: Offer) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onPublish: (id: string) => void;
}) {
    const applicationsCount = offer.applicationsCount || 0;
    const canShowMarketplaceEvidence =
        offer.assignmentMode !== 'private'
        && (['reserved', 'in_progress', 'completed'] as OfferStatus[]).includes(offer.status);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="group overflow-hidden rounded-lg border border-zinc-200 bg-white transition-all duration-300 hover:border-zinc-950 hover:shadow-[0_28px_70px_-46px_rgba(10,10,10,.62)]"
        >
            {/* Card Header */}
            <div className="p-4 pb-4 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                    <h3 className="min-w-0 text-lg font-semibold text-slate-900 line-clamp-2 transition-colors group-hover:text-zinc-950">
                        {offer.title}
                    </h3>
                    <StatusBadge status={offer.status} t={t} />
                </div>

                {/* Route */}
                <div className="flex items-center gap-2 text-slate-600 mb-3">
                    <MapPin className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                    <span className="text-sm">
                        {offer.originCity} → {offer.destCity}
                    </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>{formatDate(offer.pickupDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <DollarSign className="w-4 h-4 text-zinc-500" />
                        <span className="font-medium text-slate-900">
                            {formatBudget(offer.budgetMin, offer.budgetMax, offer.currency)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Card Footer */}
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                {/* Applications count */}
                <button
                    onClick={() => onViewApplications(offer)}
                    className={cn(
                        'flex items-center gap-2 text-sm font-medium transition-colors',
                        applicationsCount > 0
                            ? 'text-zinc-950 hover:text-zinc-700'
                            : 'text-slate-500'
                    )}
                    disabled={applicationsCount === 0}
                >
                    <Users className="w-4 h-4" />
                    {applicationsCount} {t('myOffers.card.applications')}
                    {applicationsCount > 0 && <ArrowUpRight className="w-3 h-3" />}
                </button>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    {canShowMarketplaceEvidence ? (
                        <Button asChild size="sm" variant="outline">
                            <Link href={`/pod-marketplace/${offer.id}`}>
                                <Eye className="w-4 h-4" />
                                Evidencia
                            </Link>
                        </Button>
                    ) : null}
                    {offer.status === 'draft' && (
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={() => onPublish(offer.id)}
                            leftIcon={<Send className="w-3.5 h-3.5" />}
                        >
                            {t('myOffers.card.publishOffer')}
                        </Button>
                    )}
                    {(offer.status === 'draft' || offer.status === 'active') && (
                        <>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onEdit(offer.id)}
                                className="text-slate-600"
                            >
                                <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onDelete(offer.id)}
                                className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/** Applications Modal */
function ApplicationsModal({
    isOpen,
    onClose,
    offer,
    applications,
    isLoading,
    t,
    onAccept,
    onReject,
}: {
    isOpen: boolean;
    onClose: () => void;
    offer: Offer | null;
    applications: Application[];
    isLoading: boolean;
    t: (key: string) => string;
    onAccept: (appId: string) => void;
    onReject: (appId: string) => void;
}) {
    if (!isOpen || !offer) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl sm:max-h-[86svh]"
            >
                {/* Header */}
                <div className="border-b border-slate-200 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-slate-900">
                                {t('myOffers.applications.title')}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                                {offer.title}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <XCircle className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-600">{t('myOffers.applications.empty')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {applications.map((app) => (
                                <div
                                    key={app.id}
                                    className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-zinc-300"
                                >
                                    <div className="mb-3 flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-slate-900">
                                                {app.truckerName}
                                            </h4>
                                            <p className="text-sm text-slate-600">
                                                {app.truckerEmail}
                                            </p>
                                            {app.yearsExperience && (
                                                <p className="mt-1 text-sm text-zinc-600">
                                                    {app.yearsExperience} {t('myOffers.applications.experience')}
                                                </p>
                                            )}
                                        </div>
                                        {app.proposedAmount && (
                                            <div className="text-left min-[520px]:text-right">
                                                <p className="text-xs text-slate-500">
                                                    {t('myOffers.applications.proposedAmount')}
                                                </p>
                                                <p className="font-money font-bold text-zinc-950">
                                                    {formatCOP(app.proposedAmount)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {app.message && (
                                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg mb-3">
                                            &ldquo;{app.message}&rdquo;
                                        </p>
                                    )}

                                    {app.status === 'pending' && (
                                        <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onReject(app.id)}
                                                className="border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                                            >
                                                {t('myOffers.applications.reject')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => onAccept(app.id)}
                                                className="bg-zinc-950 text-white hover:bg-zinc-800"
                                            >
                                                {t('myOffers.applications.accept')}
                                            </Button>
                                        </div>
                                    )}

                                    {app.status !== 'pending' && (
                                        <div className={cn(
                                            'text-sm font-medium text-right',
                                            app.status === 'accepted' ? 'text-zinc-950' : 'text-zinc-600'
                                        )}>
                                            {t(`myOffers.applications.${app.status}`)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function MyOffersPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useAuthStore();

    // State
    const [offers, setOffers] = React.useState<Offer[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [activeFilter, setActiveFilter] = React.useState<string>('all');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState('newest');

    // Modal state
    const [selectedOffer, setSelectedOffer] = React.useState<Offer | null>(null);
    const [applications, setApplications] = React.useState<Application[]>([]);
    const [isLoadingApplications, setIsLoadingApplications] = React.useState(false);
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    // Restrict to business users
    React.useEffect(() => {
        if (user && user.userType === 'trucker') {
            toast.warning('Acceso restringido', 'Esta página es solo para empresas');
            router.push('/ofertas');
        }
    }, [user, router]);

    // Fetch offers
    const fetchOffers = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await api.offers.getMyOffers({
                status: activeFilter === 'all' ? undefined : activeFilter.replace('inProgress', 'in_progress'),
            });

            // API returns { success: true, data: [...], meta: {...} }
            // The data array is directly in result.data (not nested)
            if (result.success) {
                const offersData = (Array.isArray(result.data) ? result.data : []) as Offer[];
                setOffers(offersData);
            } else {
                setError('Error loading offers');
            }
        } catch (err) {
            console.error('Error fetching offers:', err);
            setError('Error loading offers');
        } finally {
            setIsLoading(false);
        }
    }, [activeFilter, sortBy]);

    React.useEffect(() => {
        fetchOffers();
    }, [fetchOffers]);

    // Filtered offers
    const filteredOffers = React.useMemo(() => {
        let result = offers;

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(o =>
                o.title.toLowerCase().includes(query) ||
                o.originCity.toLowerCase().includes(query) ||
                o.destCity.toLowerCase().includes(query)
            );
        }

        return result;
    }, [offers, searchQuery]);

    // Handlers
    const handleViewApplications = async (offer: Offer) => {
        setSelectedOffer(offer);
        setIsModalOpen(true);
        setIsLoadingApplications(true);

        try {
            const result = await api.offers.getApplications(offer.id);
            if (result.success && result.data) {
                setApplications(result.data);
            }
        } catch (err) {
            toast.error('Error', 'Could not load applications');
        } finally {
            setIsLoadingApplications(false);
        }
    };

    const handleAcceptApplication = async (appId: string) => {
        if (!selectedOffer) return;

        try {
            router.push(`/pagar/${selectedOffer.id}?applicationId=${appId}`);
        } catch (err) {
            toast.error('Error', 'No se pudo iniciar el pago seguro');
        }
    };

    const handleRejectApplication = async (appId: string) => {
        if (!selectedOffer) return;

        try {
            const result = await api.offers.respondToApplication(
                selectedOffer.id,
                appId,
                { action: 'rejected' }
            );

            if (result.success) {
                toast.success(t('myOffers.applications.rejectSuccess'));
                setApplications(prev => prev.map(a =>
                    a.id === appId ? { ...a, status: 'rejected' as const } : a
                ));
            }
        } catch (err) {
            toast.error('Error', 'Could not reject application');
        }
    };

    const handleEdit = (id: string) => {
        router.push(`/ofertas/editar/${id}`);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta oferta?')) return;

        try {
            const result = await api.offers.delete(id);
            if (result.success) {
                toast.success('Oferta eliminada');
                setOffers(prev => prev.filter(o => o.id !== id));
            }
        } catch (err) {
            toast.error('Error', 'Could not delete offer');
        }
    };

    const handlePublish = async (id: string) => {
        try {
            const result = await api.offers.publish(id);
            if (result.success) {
                toast.success('¡Oferta publicada!');
                fetchOffers();
            }
        } catch (err) {
            toast.error('Error', 'Could not publish offer');
        }
    };

    const handleNewOffer = () => {
        router.push('/ofertas/publicar');
    };

    return (
        <DashboardLayout pageTitle={t('myOffers.title')}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                                {t('myOffers.title')}
                            </h1>
                            <p className="text-slate-600 mt-1">
                                {t('myOffers.subtitle')}
                            </p>
                        </div>
                        <Button
                            onClick={handleNewOffer}
                            leftIcon={<Plus className="w-4 h-4" />}
                            className="w-full bg-zinc-950 text-white hover:bg-zinc-800 sm:w-auto"
                        >
                            {t('myOffers.actions.newOffer')}
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-6 space-y-4">
                    {/* Status Tabs */}
                    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                        {FILTER_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeFilter === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveFilter(tab.id)}
                                    className={cn(
                                        'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all inline-flex items-center gap-2',
                                        isActive
                                            ? 'bg-zinc-950 text-white shadow-md'
                                            : 'border border-slate-200 bg-white text-slate-600 hover:border-zinc-950'
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {t(`myOffers.tabs.${tab.id}`)}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search & Sort */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('myOffers.search')}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 transition-all"
                            />
                        </div>
                        <div className="flex min-w-0 gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 sm:flex-none"
                            >
                                <option value="newest">{t('myOffers.sortOptions.newest')}</option>
                                <option value="oldest">{t('myOffers.sortOptions.oldest')}</option>
                                <option value="highestBudget">{t('myOffers.sortOptions.highestBudget')}</option>
                                <option value="lowestBudget">{t('myOffers.sortOptions.lowestBudget')}</option>
                            </select>
                            <Button
                                variant="outline"
                                onClick={fetchOffers}
                                className="px-3"
                            >
                                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                            <OfferCardSkeleton key={i} />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <p className="text-red-600">{error}</p>
                        <Button onClick={fetchOffers} className="mt-4">
                            {t('myOffers.actions.refresh')}
                        </Button>
                    </div>
                ) : filteredOffers.length === 0 ? (
                    <EmptyState filter={activeFilter} t={t} onNewOffer={handleNewOffer} />
                ) : (
                    <motion.div
                        layout
                        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                    >
                        <AnimatePresence mode="popLayout">
                            {filteredOffers.map((offer) => (
                                <OfferCard
                                    key={offer.id}
                                    offer={offer}
                                    t={t}
                                    onViewApplications={handleViewApplications}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onPublish={handlePublish}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>

            {/* Applications Modal */}
            <AnimatePresence>
                <ApplicationsModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    offer={selectedOffer}
                    applications={applications}
                    isLoading={isLoadingApplications}
                    t={t}
                    onAccept={handleAcceptApplication}
                    onReject={handleRejectApplication}
                />
            </AnimatePresence>
        </DashboardLayout>
    );
}
