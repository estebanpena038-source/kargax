// =============================================================================
// KARGAX - EDIT OFFER PAGE
// Enterprise-grade offer editing with pre-loaded data
// =============================================================================

'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Package,
    MapPin,
    Calendar,
    DollarSign,
    Truck,
    Save,
    ArrowLeft,
    Loader2,
    AlertTriangle,
    Eye,
    Users,
    Clock,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, Card, toast } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store/authStore';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
    COLOMBIAN_DEPARTMENTS,
    getCitiesByDepartment,
    CARGO_TYPES,
    VEHICLE_TYPES,
} from '@/constants/colombia';

// =============================================================================
// Types
// =============================================================================

interface OfferData {
    id: string;
    title: string;
    description: string;
    cargoType: string;
    weight: number | null;
    originCity: string;
    originDepartment: string;
    originAddress: string | null;
    destCity: string;
    destDepartment: string;
    destAddress: string | null;
    pickupDate: string;
    deliveryDate: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    requiredVehicle: string | null;
    specialRequirements: string | null;
    status: string;
    viewCount: number;
}

interface Viewer {
    viewerId: string;
    viewerName: string;
    viewerEmail?: string;
    viewerType?: string;
    viewCount: number;
    lastViewedAt: string;
}

// =============================================================================
// Main Component
// =============================================================================

export default function EditOfferPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useParams();
    const offerId = params?.id as string;
    const { user } = useAuthStore();

    // State
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [offer, setOffer] = React.useState<OfferData | null>(null);
    const [viewers, setViewers] = React.useState<Viewer[]>([]);
    const [viewStats, setViewStats] = React.useState<{
        totalViews: number;
        uniqueViewers: number;
        recentViewers: number;
    } | null>(null);

    // Form state
    const [formData, setFormData] = React.useState({
        title: '',
        description: '',
        cargoType: '',
        weight: '',
        originDepartment: '',
        originCity: '',
        originAddress: '',
        destDepartment: '',
        destCity: '',
        destAddress: '',
        pickupDate: '',
        deliveryDate: '',
        budgetMin: '',
        budgetMax: '',
        requiredVehicle: '',
        specialRequirements: '',
    });

    // Load offer data
    React.useEffect(() => {
        const loadOffer = async () => {
            if (!offerId) return;

            setIsLoading(true);
            try {
                // Load offer details
                const result = await api.offers.getById(offerId);
                if (result.success && result.data) {
                    const o = result.data;
                    setOffer(o);
                    setFormData({
                        title: o.title || '',
                        description: o.description || '',
                        cargoType: o.cargoType || '',
                        weight: o.weight?.toString() || '',
                        originDepartment: o.originDepartment || '',
                        originCity: o.originCity || '',
                        originAddress: o.originAddress || '',
                        destDepartment: o.destDepartment || '',
                        destCity: o.destCity || '',
                        destAddress: o.destAddress || '',
                        pickupDate: o.pickupDate?.split('T')[0] || '',
                        deliveryDate: o.deliveryDate?.split('T')[0] || '',
                        budgetMin: o.budgetMin?.toString() || '',
                        budgetMax: o.budgetMax?.toString() || '',
                        requiredVehicle: o.requiredVehicle || '',
                        specialRequirements: o.specialRequirements || '',
                    });
                } else {
                    setError('Oferta no encontrada');
                }

                // Load viewers (only for owner)
                try {
                    const viewsResult = await api.offers.getOfferViews(offerId);
                    if (viewsResult.success && viewsResult.data) {
                        const normalizedViewers: Viewer[] = (viewsResult.data.views || []).map((viewer) => {
                            const typedViewer = viewer as Viewer & {
                                viewerEmail?: string;
                                viewerType?: string;
                            };

                            return {
                                viewerId: typedViewer.viewerId,
                                viewerName: typedViewer.viewerName || 'Usuario',
                                viewerEmail: typedViewer.viewerEmail,
                                viewerType: typedViewer.viewerType,
                                viewCount: typedViewer.viewCount,
                                lastViewedAt: typedViewer.lastViewedAt,
                            };
                        });

                        setViewers(normalizedViewers);
                        setViewStats({
                            totalViews: viewsResult.data.totalViews,
                            uniqueViewers: viewsResult.data.uniqueViewers,
                            recentViewers: 0,
                        });
                    }
                } catch (e) {
                    // User may not be owner, ignore
                }
            } catch (err) {
                console.error('Error loading offer:', err);
                setError('Error cargando la oferta');
            } finally {
                setIsLoading(false);
            }
        };

        loadOffer();
    }, [offerId]);

    // Handle form change
    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // Handle save
    const handleSave = async () => {
        if (!offerId) return;

        setIsSaving(true);
        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                cargoType: formData.cargoType,
                weight: formData.weight ? parseFloat(formData.weight) : undefined,
                originDepartment: formData.originDepartment,
                originCity: formData.originCity,
                originAddress: formData.originAddress || undefined,
                destDepartment: formData.destDepartment,
                destCity: formData.destCity,
                destAddress: formData.destAddress || undefined,
                pickupDate: formData.pickupDate,
                deliveryDate: formData.deliveryDate || undefined,
                budgetMin: formData.budgetMin ? parseFloat(formData.budgetMin) : undefined,
                budgetMax: formData.budgetMax ? parseFloat(formData.budgetMax) : undefined,
                requiredVehicle: formData.requiredVehicle || undefined,
                specialRequirements: formData.specialRequirements || undefined,
            };

            const result = await api.offers.update(offerId, payload);
            if (result.success) {
                toast.success('¡Oferta actualizada!', 'Los cambios se guardaron correctamente');
                router.push('/ofertas/mis-ofertas');
            } else {
                toast.error('Error', result.message || 'No se pudo actualizar');
            }
        } catch (err) {
            console.error('Error saving:', err);
            toast.error('Error', 'No se pudo guardar la oferta');
        } finally {
            setIsSaving(false);
        }
    };

    // Get cities based on selected department
    const originCities = formData.originDepartment
        ? getCitiesByDepartment(formData.originDepartment)
        : [];
    const destCities = formData.destDepartment
        ? getCitiesByDepartment(formData.destDepartment)
        : [];

    // Format relative time
    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        return `Hace ${diffDays}d`;
    };

    // Loading state
    if (isLoading) {
        return (
            <DashboardLayout pageTitle="Editar Oferta">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                </div>
            </DashboardLayout>
        );
    }

    // Error state
    if (error || !offer) {
        return (
            <DashboardLayout pageTitle="Editar Oferta">
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <p className="text-lg text-slate-600">{error || 'Oferta no encontrada'}</p>
                    <Button onClick={() => router.back()} className="mt-4">
                        Volver
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Editar Oferta">
            <div className="mx-auto w-full max-w-5xl px-0 py-4 sm:px-2 sm:py-6 lg:px-4">
                {/* Header */}
                <div className="mb-8 flex items-start gap-3 sm:items-center sm:gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="p-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-slate-900">
                            Editar Oferta
                        </h1>
                        <p className="text-sm text-slate-600 sm:text-base">
                            ID: {offerId.slice(0, 8)}... | Estado: {offer.status}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Info */}
                        <Card className="p-4 sm:p-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Package className="w-5 h-5 text-green-600" />
                                Información Básica
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Título
                                    </label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                        placeholder="Título de la oferta"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Descripción
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        placeholder="Describe la carga..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                                        rows={3}
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Tipo de Carga
                                        </label>
                                        <Select
                                            value={formData.cargoType}
                                            onChange={(v) => handleChange('cargoType', v)}
                                            options={CARGO_TYPES.map((t) => ({ value: t.code, label: t.name }))}
                                            placeholder="Seleccionar"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Peso (kg)
                                        </label>
                                        <Input
                                            type="number"
                                            value={formData.weight}
                                            onChange={(e) => handleChange('weight', e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Route */}
                        <Card className="p-4 sm:p-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-green-600" />
                                Ruta
                            </h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Departamento Origen
                                        </label>
                                        <Select
                                            value={formData.originDepartment}
                                            onChange={(v) => {
                                                handleChange('originDepartment', v);
                                                handleChange('originCity', '');
                                            }}
                                            options={COLOMBIAN_DEPARTMENTS.map((d) => ({ value: d.code, label: d.name }))}
                                            placeholder="Seleccionar"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Ciudad Origen
                                        </label>
                                        <Select
                                            value={formData.originCity}
                                            onChange={(v) => handleChange('originCity', v)}
                                            options={originCities.map((c) => ({ value: c.code, label: c.name }))}
                                            placeholder="Seleccionar"
                                            disabled={!formData.originDepartment}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Departamento Destino
                                        </label>
                                        <Select
                                            value={formData.destDepartment}
                                            onChange={(v) => {
                                                handleChange('destDepartment', v);
                                                handleChange('destCity', '');
                                            }}
                                            options={COLOMBIAN_DEPARTMENTS.map((d) => ({ value: d.code, label: d.name }))}
                                            placeholder="Seleccionar"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Ciudad Destino
                                        </label>
                                        <Select
                                            value={formData.destCity}
                                            onChange={(v) => handleChange('destCity', v)}
                                            options={destCities.map((c) => ({ value: c.code, label: c.name }))}
                                            placeholder="Seleccionar"
                                            disabled={!formData.destDepartment}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Fecha Recogida
                                        </label>
                                        <Input
                                            type="date"
                                            value={formData.pickupDate}
                                            onChange={(e) => handleChange('pickupDate', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Fecha Entrega
                                        </label>
                                        <Input
                                            type="date"
                                            value={formData.deliveryDate}
                                            onChange={(e) => handleChange('deliveryDate', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Budget */}
                        <Card className="p-4 sm:p-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-emerald-500" />
                                Presupuesto
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Mínimo (COP)
                                    </label>
                                    <Input
                                        type="number"
                                        value={formData.budgetMin}
                                        onChange={(e) => handleChange('budgetMin', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Máximo (COP)
                                    </label>
                                    <Input
                                        type="number"
                                        value={formData.budgetMax}
                                        onChange={(e) => handleChange('budgetMax', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Requirements */}
                        <Card className="p-4 sm:p-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Truck className="w-5 h-5 text-blue-500" />
                                Requisitos
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Tipo de Vehículo
                                    </label>
                                    <Select
                                        value={formData.requiredVehicle}
                                        onChange={(v) => handleChange('requiredVehicle', v)}
                                        options={VEHICLE_TYPES.map((v) => ({ value: v.code, label: v.name }))}
                                        placeholder="Cualquiera"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Requisitos Especiales
                                    </label>
                                    <textarea
                                        value={formData.specialRequirements}
                                        onChange={(e) => handleChange('specialRequirements', e.target.value)}
                                        placeholder="Requisitos adicionales..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                                        rows={2}
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Save Button */}
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <Button
                                variant="outline"
                                onClick={() => router.back()}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-gradient-to-r from-green-600 to-green-700"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Guardar Cambios
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Sidebar - Views & Stats */}
                    <div className="space-y-6">
                        {/* View Stats */}
                        <Card className="p-4 sm:p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-purple-500" />
                                Estadísticas de Vistas
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Total vistas</span>
                                    <span className="font-bold text-lg text-slate-900">
                                        {viewStats?.totalViews || offer.viewCount || 0}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Visitantes únicos</span>
                                    <span className="font-bold text-lg text-slate-900">
                                        {viewStats?.uniqueViewers || 0}
                                    </span>
                                </div>
                            </div>
                        </Card>

                        {/* Who Viewed */}
                        <Card className="p-4 sm:p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-green-600" />
                                Quién Vio Esta Oferta
                            </h3>
                            {viewers.length === 0 ? (
                                <div className="text-center py-6">
                                    <Eye className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 text-sm">
                                        Nadie ha visto esta oferta aún
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                    {viewers.map((viewer) => (
                                        <motion.div
                                            key={viewer.viewerId}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center text-white font-bold">
                                                {viewer.viewerName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 truncate">
                                                    {viewer.viewerName}
                                                </p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatRelativeTime(viewer.lastViewedAt)}
                                                    {viewer.viewCount > 1 && (
                                                        <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                                            {viewer.viewCount}x
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <span className={cn(
                                                'px-2 py-1 rounded-full text-xs font-medium',
                                                viewer.viewerType === 'trucker'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-purple-100 text-purple-700'
                                            )}>
                                                {viewer.viewerType === 'trucker' ? 'Camionero' : 'Empresa'}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
