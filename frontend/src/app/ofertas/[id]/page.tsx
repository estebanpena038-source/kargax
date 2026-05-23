'use client';

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Building2,
    Calendar,
    Check,
    Clock,
    Eye,
    FileText,
    Loader2,
    MapPin,
    Navigation,
    Package,
    Phone,
    Send,
    Shield,
    Truck,
    User,
    Weight,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, toast } from '@/components/ui';
import { TrackingReadOnlyCard } from '@/components/tracking/TrackingReadOnlyCard';
import {
    formatCurrency,
    getCityNameByCode,
    getCountryConfig,
    getSubdivisionName,
    type SupportedCountry,
} from '@/constants/countries';
import {
    getVehicleTypeName,
    normalizeVehicleTypeCode,
    vehicleTypesMatch,
    VEHICLE_TYPES,
} from '@/constants/colombia';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabaseApi } from '@/lib/supabase/api-bridge';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface OfferManifestItem {
    id?: string;
    name: string;
    quantity: number;
    weightKg?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
}

interface Offer {
    id: string;
    title: string;
    cargo_type: string;
    cargo_description: string;
    origin_city: string;
    origin_department: string;
    origin_address?: string;
    destination_city: string;
    destination_department: string;
    destination_address?: string;
    total_amount: number;
    budget_min?: number;
    budget_max?: number;
    pickup_date: string;
    delivery_date?: string;
    pickup_contact_name?: string;
    pickup_contact_phone?: string;
    delivery_contact_name?: string;
    delivery_contact_phone?: string;
    weight_kg?: number;
    volume_m3?: number;
    required_vehicle?: string;
    special_requirements?: string;
    manifest_items?: OfferManifestItem[];
    status: string;
    country_code?: SupportedCountry | null;
    currency_code?: string | null;
    vehicle_type?: string | null;
    min_experience_years?: number | null;
    required_licenses?: string[] | null;
    required_certifications?: string[] | null;
    insurance_required?: boolean | null;
    additional_requirements?: string | null;
    created_at: string;
    published_at?: string;
    applications_count?: number;
    business?: {
        company_name: string;
        user?: {
            full_name: string;
            phone: string;
        };
    };
}

const inputClassName = 'w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10';

function formatVolumeM3(volumeCm3: number): string {
    return `${(volumeCm3 / 1000000).toFixed(2)} m3`;
}

function getManifestSummary(items: OfferManifestItem[] = []) {
    return items.reduce((summary, item) => {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const weightKg = Number(item.weightKg || 0);
        const lengthCm = Number(item.lengthCm || 0);
        const widthCm = Number(item.widthCm || 0);
        const heightCm = Number(item.heightCm || 0);
        const hasDimensions = lengthCm > 0 && widthCm > 0 && heightCm > 0;

        summary.totalUnits += quantity;
        if (weightKg > 0) {
            summary.totalWeightKg += weightKg * quantity;
        }
        if (hasDimensions) {
            summary.totalVolumeCm3 += lengthCm * widthCm * heightCm * quantity;
        }

        return summary;
    }, {
        totalUnits: 0,
        totalWeightKg: 0,
        totalVolumeCm3: 0,
    });
}

function formatDate(dateString: string, locale = 'es-CO'): string {
    try {
        return new Date(dateString).toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch {
        return dateString;
    }
}

function formatTime(dateString: string, locale = 'es-CO'): string {
    try {
        return new Date(dateString).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
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

function DetailSection({
    title,
    eyebrow,
    icon: Icon,
    children,
}: {
    title: string;
    eyebrow?: string;
    icon: ElementType;
    children: ReactNode;
}) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="kx-section kx-tight-card rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] md:p-6"
        >
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                    <Icon className="h-5 w-5 text-zinc-700" />
                </div>
                <div>
                    {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{eyebrow}</p>}
                    <h2 className="text-xl font-semibold tracking-tight text-zinc-950">{title}</h2>
                </div>
            </div>
            {children}
        </motion.section>
    );
}

function InfoTile({
    icon: Icon,
    label,
    value,
}: {
    icon: ElementType;
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <Icon className="h-4 w-4" />
                {label}
            </div>
            <div className="mt-2 text-base font-semibold text-zinc-950">{value}</div>
        </div>
    );
}

function RequirementLine({ children }: { children: ReactNode }) {
    return (
        <li className="flex items-start gap-2 text-sm text-zinc-600">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-950" />
            <span>{children}</span>
        </li>
    );
}

export default function OfferDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const offerId = params?.id as string | undefined;
    const { user } = useAuthStore();

    const [offer, setOffer] = useState<Offer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasApplied, setHasApplied] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [showApplyForm, setShowApplyForm] = useState(false);
    const [proposedAmount, setProposedAmount] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const [photoUrls, setPhotoUrls] = useState<string[]>([]);

    const [appVehicleType, setAppVehicleType] = useState('');
    const [appExperienceYears, setAppExperienceYears] = useState<number>(0);
    const [appHasInsurance, setAppHasInsurance] = useState(false);
    const [appLicensePlate, setAppLicensePlate] = useState('');
    const [appLicenseType, setAppLicenseType] = useState('');
    const [appCertificationsReady, setAppCertificationsReady] = useState(false);
    const [appFormErrors, setAppFormErrors] = useState<string[]>([]);

    const isTrucker = user?.userType === 'trucker';
    const canReadTracking = user?.userType === 'business' || user?.userType === 'admin' || hasApplied;
    const offerCountry = (offer?.country_code || user?.country || 'CO') as SupportedCountry;
    const countryConfig = getCountryConfig(offerCountry);
    const formatAmount = (amount: number) => formatCurrency(amount, offerCountry);
    const resolveCity = (code: string) => getCityNameByCode(offerCountry, code);
    const resolveSubdivision = (code: string) => getSubdivisionName(offerCountry, code);
    const requiredVehicle = offer?.required_vehicle || offer?.vehicle_type || '';
    const requiredVehicleCode = normalizeVehicleTypeCode(requiredVehicle);
    const requiredVehicleLabel = getVehicleTypeName(requiredVehicleCode || requiredVehicle);
    const selectedVehicleCode = normalizeVehicleTypeCode(appVehicleType);
    const selectedVehicleLabel = getVehicleTypeName(selectedVehicleCode || appVehicleType);
    const hasVehicleMismatch = Boolean(requiredVehicle && appVehicleType && !vehicleTypesMatch(appVehicleType, requiredVehicle));
    const minExperienceYears = Number(offer?.min_experience_years || 0);
    const requiredLicenses = Array.isArray(offer?.required_licenses) ? offer.required_licenses : [];
    const requiredCertifications = Array.isArray(offer?.required_certifications) ? offer.required_certifications : [];
    const insuranceRequired = Boolean(offer?.insurance_required);
    const manifestSummary = getManifestSummary(offer?.manifest_items || []);

    const cargoLabel = useMemo(() => offer?.cargo_type?.replace('_', ' ') || 'Carga', [offer?.cargo_type]);

    const loadOffer = useCallback(async () => {
        if (!offerId) return;

        try {
            const { data, error: fetchError } = await supabase
                .from('cargo_offers')
                .select('*')
                .eq('id', offerId)
                .single();

            if (fetchError || !data) {
                console.error('Fetch error:', fetchError);
                setError('Oferta no encontrada');
                setLoading(false);
                return;
            }

            const offerData = data as any;
            let businessInfo: { company_name: string } | undefined = undefined;
            if (offerData.business_id) {
                const { data: businessData } = await supabase
                    .from('business_profiles')
                    .select('company_name, user_id')
                    .eq('user_id', offerData.business_id)
                    .single();
                const businessProfile = businessData as { company_name: string } | null;

                if (businessProfile) {
                    businessInfo = {
                        company_name: businessProfile.company_name,
                    };
                }
            }

            const transformedOffer: Offer = {
                ...(data as any),
                business: businessInfo,
            };

            const { data: offerPhotos } = await supabase
                .from('offer_photos')
                .select('storage_path, sort_order')
                .eq('offer_id', offerId)
                .order('sort_order', { ascending: true });

            setOffer(transformedOffer);
            setPhotoUrls(
                ((offerPhotos || []) as Array<{ storage_path: string }>)
                    .map((photo) => supabase.storage.from('offer-photos').getPublicUrl(photo.storage_path).data.publicUrl)
                    .filter(Boolean)
            );

            if (user) {
                const { data: existingApp } = await supabase
                    .from('offer_applications')
                    .select('id')
                    .eq('offer_id', offerId)
                    .eq('trucker_id', user.id)
                    .single();

                setHasApplied(!!existingApp);
            }

            setProposedAmount((data as any).total_amount);
        } catch (err) {
            console.error('Error loading offer:', err);
            setError('Error al cargar la oferta');
        } finally {
            setLoading(false);
        }
    }, [offerId, user]);

    useEffect(() => {
        loadOffer();
    }, [loadOffer]);

    const validateApplication = (): boolean => {
        const errors: string[] = [];

        if (!appVehicleType) {
            errors.push(requiredVehicle
                ? `Confirma el vehiculo con el que aplicaras. Esta oferta requiere ${requiredVehicleLabel}.`
                : 'Confirma el vehiculo con el que aplicaras.');
        }
        if (appVehicleType && !selectedVehicleCode) {
            errors.push('Selecciona un tipo de vehiculo valido del catalogo.');
        }
        if (hasVehicleMismatch) {
            errors.push(`La oferta requiere ${requiredVehicleLabel} y seleccionaste ${selectedVehicleLabel}. Revisa el vehiculo antes de enviar.`);
        }
        if (!appLicensePlate || appLicensePlate.length < 5) {
            errors.push('Ingresa la placa de tu vehiculo.');
        }
        if (appExperienceYears < 1) {
            errors.push('Debes tener al menos 1 ano de experiencia.');
        }
        if (offer?.special_requirements && offer.special_requirements.toLowerCase().includes('seguro') && !appHasInsurance) {
            errors.push('Esta carga requiere seguro de carga activo.');
        }
        if (appExperienceYears < Math.max(minExperienceYears, 1)) {
            errors.push(`Debes tener al menos ${Math.max(minExperienceYears, 1)} ano(s) de experiencia.`);
        }
        if (requiredLicenses.length > 0 && !appLicenseType) {
            errors.push(`Debes indicar tu licencia: ${requiredLicenses.join(', ')}.`);
        }
        if (requiredCertifications.length > 0 && !appCertificationsReady) {
            errors.push(`Debes confirmar certificaciones: ${requiredCertifications.join(', ')}.`);
        }
        if (insuranceRequired && !appHasInsurance) {
            errors.push('Esta oferta exige seguro de carga activo.');
        }

        setAppFormErrors(errors);
        return errors.length === 0;
    };

    const handleApply = async () => {
        if (!user || !offer) {
            router.push('/login?redirect=/ofertas/' + offerId);
            return;
        }

        if (!validateApplication()) {
            toast.error('Requisitos incompletos', 'Completa los campos obligatorios antes de postularte');
            return;
        }

        setIsApplying(true);
        try {
            const vehicleTypeCode = selectedVehicleCode || appVehicleType;
            const applicationMessage = [
                message.trim(),
                `Vehiculo: ${getVehicleTypeName(vehicleTypeCode)} | Placa: ${appLicensePlate}`,
                `Experiencia: ${appExperienceYears} anos`,
                appHasInsurance ? 'Cuenta con seguro de carga' : '',
            ].filter(Boolean).join('\n');

            const result = await supabaseApi.offers.apply(offer.id, {
                proposedAmount: proposedAmount || undefined,
                message: applicationMessage || undefined,
                yearsExperience: appExperienceYears,
                vehicleType: vehicleTypeCode,
                vehiclePlate: appLicensePlate,
                licenseType: appLicenseType || undefined,
                hasInsurance: appHasInsurance,
                applicationPayload: {
                    countryCode: offerCountry,
                    currencyCode: countryConfig.currencyCode,
                    requiredVehicle: requiredVehicleCode || requiredVehicle,
                    minExperienceYears,
                    requiredLicenses,
                    requiredCertifications,
                    insuranceRequired,
                    applicantConfirmedCertifications: appCertificationsReady,
                },
            });

            if (result.success) {
                toast.success('Postulacion enviada', 'La empresa revisara tu solicitud');
                setHasApplied(true);
                setShowApplyForm(false);
            } else {
                toast.error('Error', result.message || 'No se pudo enviar la postulacion');
            }
        } catch (err) {
            console.error('Apply error:', err);
            toast.error('Error', 'No se pudo enviar la postulacion');
        } finally {
            setIsApplying(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout pageTitle="Detalle de oferta">
                <div className="kx-dashboard-bleed flex items-center justify-center bg-[#f7f7f5]">
                    <div className="rounded-lg border border-zinc-200 bg-white px-6 py-5 text-center shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-zinc-950" />
                        <p className="mt-3 text-sm text-zinc-500">Cargando detalle operativo</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !offer) {
        return (
            <DashboardLayout pageTitle="Oferta no encontrada">
                <div className="kx-dashboard-bleed flex flex-col items-center justify-center gap-4 bg-[#f7f7f5] px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                        <AlertCircle className="h-8 w-8 text-zinc-800" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-zinc-950">{error || 'Oferta no encontrada'}</h2>
                        <p className="mt-2 max-w-md text-sm text-zinc-500">
                            Puedes volver al marketplace y revisar las cargas activas disponibles.
                        </p>
                    </div>
                    <Button onClick={() => router.push('/ofertas')}>
                        <ArrowLeft className="h-4 w-4" />
                        Ver cargas
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Detalle de oferta">
            <div className="kx-dashboard-bleed bg-[#f7f7f5]">
                <div className="kx-page-container">
                    <button
                        onClick={() => router.back()}
                        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver a cargas
                    </button>

                    <section className="kx-section kx-tight-card rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)] md:p-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-3xl">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                                        {offer.status === 'active' ? 'Activa' : offer.status}
                                    </span>
                                    <span className="text-sm text-zinc-500">Publicado {formatRelativeTime(offer.created_at)}</span>
                                </div>

                                <h1 className="kx-route-title kx-fluid-title mt-4 font-semibold tracking-tight text-zinc-950">
                                    {resolveCity(offer.origin_city)}
                                    <ArrowRight className="mx-3 inline h-6 w-6 align-[-3px] text-zinc-400" />
                                    {resolveCity(offer.destination_city)}
                                </h1>
                                <p className="mt-3 text-base leading-7 text-zinc-500">
                                    {cargoLabel} con requisitos, fechas y evidencia visibles antes de postularte.
                                </p>
                            </div>

                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Flete</p>
                                <p className="font-money mt-1 text-3xl font-semibold tracking-tight text-zinc-950 max-[420px]:text-2xl">
                                    {formatAmount(offer.total_amount)}
                                </p>
                            </div>
                        </div>
                    </section>

                    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,23.75rem)]">
                        <div className="space-y-6">
                            <DetailSection title="Ruta" eyebrow="Origen y destino" icon={Navigation}>
                                <div className="grid kx-safe-grid-sm gap-4">
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Origen</p>
                                        <h3 className="mt-2 text-2xl font-semibold text-zinc-950">{resolveCity(offer.origin_city)}</h3>
                                        <p className="text-sm text-zinc-500">{resolveSubdivision(offer.origin_department)}</p>
                                        {offer.origin_address && <p className="mt-3 text-sm text-zinc-600">{offer.origin_address}</p>}
                                        {(offer.pickup_contact_name || offer.pickup_contact_phone) && (
                                            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
                                                <p className="mb-2 font-semibold text-zinc-950">Contacto de recogida</p>
                                                {offer.pickup_contact_name && (
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        {offer.pickup_contact_name}
                                                    </div>
                                                )}
                                                {offer.pickup_contact_phone && (
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <Phone className="h-4 w-4" />
                                                        {offer.pickup_contact_phone}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Destino</p>
                                        <h3 className="mt-2 text-2xl font-semibold text-zinc-950">{resolveCity(offer.destination_city)}</h3>
                                        <p className="text-sm text-zinc-500">{resolveSubdivision(offer.destination_department)}</p>
                                        {offer.destination_address && <p className="mt-3 text-sm text-zinc-600">{offer.destination_address}</p>}
                                        {(offer.delivery_contact_name || offer.delivery_contact_phone) && (
                                            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
                                                <p className="mb-2 font-semibold text-zinc-950">Contacto de entrega</p>
                                                {offer.delivery_contact_name && (
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        {offer.delivery_contact_name}
                                                    </div>
                                                )}
                                                {offer.delivery_contact_phone && (
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <Phone className="h-4 w-4" />
                                                        {offer.delivery_contact_phone}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </DetailSection>

                            <DetailSection title="Carga" eyebrow="Contenido operativo" icon={Package}>
                                <div className="grid kx-safe-grid-sm gap-3">
                                    <InfoTile icon={Package} label="Tipo" value={<span className="capitalize">{cargoLabel}</span>} />
                                    <InfoTile icon={Weight} label="Peso" value={offer.weight_kg ? `${offer.weight_kg.toLocaleString('es-CO')} kg` : 'No especificado'} />
                                    <InfoTile icon={Truck} label="Vehiculo" value={requiredVehicle ? requiredVehicleLabel : 'No especificado'} />
                                </div>

                                {photoUrls.length > 0 && (
                                    <div className="mt-5">
                                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                            <Eye className="h-4 w-4" />
                                            Fotos de la carga
                                        </h3>
                                        <div className="grid kx-safe-grid-sm gap-3">
                                            {photoUrls.map((photoUrl, index) => (
                                                <div key={photoUrl} className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                                                    <img src={photoUrl} alt={`Foto de carga ${index + 1}`} className="h-40 w-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-5 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                        <FileText className="h-4 w-4" />
                                        Descripcion
                                    </h3>
                                    <p className="text-sm leading-6 text-zinc-600">
                                        {offer.cargo_description || 'Sin descripcion adicional.'}
                                    </p>
                                </div>

                                {offer.manifest_items && offer.manifest_items.length > 0 && (
                                    <div className="mt-5 border-t border-zinc-100 pt-5">
                                        <h3 className="text-sm font-semibold text-zinc-950">Manifiesto</h3>
                                        <div className="mt-3 grid kx-safe-grid-sm gap-3">
                                            <InfoTile icon={Package} label="Unidades" value={manifestSummary.totalUnits} />
                                            <InfoTile icon={Weight} label="Peso total" value={manifestSummary.totalWeightKg > 0 ? `${manifestSummary.totalWeightKg.toLocaleString('es-CO')} kg` : 'Sin detalle'} />
                                            <InfoTile icon={Package} label="Volumen" value={manifestSummary.totalVolumeCm3 > 0 ? formatVolumeM3(manifestSummary.totalVolumeCm3) : 'Sin detalle'} />
                                        </div>
                                        <div className="mt-3 grid kx-safe-grid-sm gap-3">
                                            {offer.manifest_items.map((item, index) => (
                                                <div key={item.id || index} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                                                    <div className="flex items-center justify-between gap-4 text-sm">
                                                        <span className="font-medium text-zinc-950">{item.name}</span>
                                                        <span className="text-zinc-500">{item.quantity} unidades</span>
                                                    </div>
                                                    <div className="mt-2 grid kx-safe-grid-sm gap-2 text-xs text-zinc-500">
                                                        <span>Peso: {item.weightKg ? `${item.weightKg} kg` : 'Sin dato'}</span>
                                                        <span>Largo: {item.lengthCm ? `${item.lengthCm} cm` : 'Sin dato'}</span>
                                                        <span>Ancho: {item.widthCm ? `${item.widthCm} cm` : 'Sin dato'}</span>
                                                        <span>Alto: {item.heightCm ? `${item.heightCm} cm` : 'Sin dato'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </DetailSection>

                            <DetailSection title="Requisitos" eyebrow="Antes de aplicar" icon={Shield}>
                                <ul className="space-y-3">
                                    {requiredVehicle && <RequirementLine>Vehiculo requerido: <b>{requiredVehicleLabel}</b>.</RequirementLine>}
                                    {minExperienceYears > 0 && <RequirementLine>Experiencia minima: <b>{minExperienceYears} ano(s)</b>.</RequirementLine>}
                                    {requiredLicenses.length > 0 && <RequirementLine>Licencias: <b>{requiredLicenses.join(', ')}</b>.</RequirementLine>}
                                    {requiredCertifications.length > 0 && <RequirementLine>Certificaciones: <b>{requiredCertifications.join(', ')}</b>.</RequirementLine>}
                                    {insuranceRequired && <RequirementLine>Seguro de carga activo obligatorio.</RequirementLine>}
                                    {offer.special_requirements && <RequirementLine>{offer.special_requirements}</RequirementLine>}
                                    {offer.additional_requirements && <RequirementLine>{offer.additional_requirements}</RequirementLine>}
                                    {!requiredVehicle && minExperienceYears === 0 && requiredLicenses.length === 0 && requiredCertifications.length === 0 && !insuranceRequired && !offer.special_requirements && !offer.additional_requirements && (
                                        <RequirementLine>No hay requisitos especiales publicados.</RequirementLine>
                                    )}
                                </ul>
                            </DetailSection>

                            <DetailSection title="Fechas" eyebrow="Ventana operativa" icon={Calendar}>
                                <div className="grid kx-safe-grid-sm gap-3">
                                    <InfoTile
                                        icon={Clock}
                                        label="Recogida"
                                        value={
                                            <span>
                                                {formatDate(offer.pickup_date, countryConfig.locale)}
                                                <span className="block text-sm font-normal text-zinc-500">{formatTime(offer.pickup_date, countryConfig.locale)}</span>
                                            </span>
                                        }
                                    />
                                    <InfoTile
                                        icon={Clock}
                                        label="Entrega"
                                        value={
                                            offer.delivery_date ? (
                                                <span>
                                                    {formatDate(offer.delivery_date, countryConfig.locale)}
                                                    <span className="block text-sm font-normal text-zinc-500">{formatTime(offer.delivery_date, countryConfig.locale)}</span>
                                                </span>
                                            ) : 'Por confirmar'
                                        }
                                    />
                                </div>
                            </DetailSection>

                            {offer.business && (
                                <DetailSection title="Empresa" eyebrow="Publicador" icon={Building2}>
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-950 text-xl font-semibold text-white">
                                            {offer.business.company_name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-zinc-950">{offer.business.company_name}</h3>
                                            <p className="text-sm text-zinc-500">Operacion registrada en KargaX.</p>
                                        </div>
                                    </div>
                                </DetailSection>
                            )}

                            {canReadTracking && offer.id && (
                                <DetailSection title="Seguimiento" eyebrow="Lectura operativa" icon={MapPin}>
                                    <TrackingReadOnlyCard offerId={offer.id} />
                                </DetailSection>
                            )}
                        </div>

                        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Monto publicado</p>
                                <p className="font-money mt-2 text-4xl font-semibold tracking-tight text-zinc-950 max-[420px]:text-3xl">
                                    {formatAmount(offer.total_amount)}
                                </p>
                                <p className="mt-3 text-sm leading-6 text-zinc-500">
                                    Revisa requisitos y fechas. La decision correcta debe sentirse tranquila.
                                </p>

                                {!isTrucker && (
                                    <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                                        La postulacion esta disponible solo para transportadores. Puedes revisar la oferta sin tomar acciones de conductor.
                                    </div>
                                )}

                                {hasApplied && (
                                    <div className="mt-5 rounded-lg border border-zinc-950 bg-zinc-950 p-4 text-sm text-white">
                                        <div className="flex items-center gap-2 font-semibold">
                                            <Check className="h-4 w-4" />
                                            Ya te postulaste
                                        </div>
                                        <p className="mt-2 text-white/70">La empresa revisara tu solicitud y te notificara el siguiente paso.</p>
                                    </div>
                                )}

                                {isTrucker && !hasApplied && (
                                    <>
                                        {showApplyForm ? (
                                            <div className="mt-5 space-y-4">
                                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Requisitos de la oferta
                                                    </div>
                                                    <ul className="space-y-1 text-xs leading-5 text-zinc-600">
                                                        {requiredVehicle && <li>Vehiculo: <b>{requiredVehicleLabel}</b></li>}
                                                        {minExperienceYears > 0 && <li>Experiencia minima: <b>{minExperienceYears} ano(s)</b></li>}
                                                        {requiredLicenses.length > 0 && <li>Licencias: <b>{requiredLicenses.join(', ')}</b></li>}
                                                        {requiredCertifications.length > 0 && <li>Certificaciones: <b>{requiredCertifications.join(', ')}</b></li>}
                                                        {insuranceRequired && <li>Seguro de carga: <b>obligatorio</b></li>}
                                                        {offer.special_requirements && <li>{offer.special_requirements}</li>}
                                                    </ul>
                                                </div>

                                                <label className="block space-y-1.5">
                                                    <span className="text-sm font-medium text-zinc-700">Tu tipo de vehiculo *</span>
                                                    <select
                                                        value={appVehicleType}
                                                        onChange={(event) => setAppVehicleType(normalizeVehicleTypeCode(event.target.value) || event.target.value)}
                                                        className={inputClassName}
                                                    >
                                                        <option value="">Selecciona...</option>
                                                        {VEHICLE_TYPES.map((vehicle) => (
                                                            <option key={vehicle.code} value={vehicle.code}>
                                                                {vehicle.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                {hasVehicleMismatch && (
                                                    <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                                                        La oferta pide <b>{requiredVehicleLabel}</b> y elegiste <b>{selectedVehicleLabel}</b>. Revisa antes de enviar.
                                                    </div>
                                                )}

                                                <label className="block space-y-1.5">
                                                    <span className="text-sm font-medium text-zinc-700">Placa del vehiculo *</span>
                                                    <input
                                                        type="text"
                                                        value={appLicensePlate}
                                                        onChange={(event) => setAppLicensePlate(event.target.value.toUpperCase())}
                                                        placeholder="ABC123"
                                                        maxLength={7}
                                                        className={cn(inputClassName, 'uppercase')}
                                                    />
                                                </label>

                                                <label className="block space-y-1.5">
                                                    <span className="text-sm font-medium text-zinc-700">Anos de experiencia *</span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={50}
                                                        value={appExperienceYears || ''}
                                                        onChange={(event) => setAppExperienceYears(Number(event.target.value))}
                                                        className={inputClassName}
                                                    />
                                                </label>

                                                {requiredLicenses.length > 0 && (
                                                    <label className="block space-y-1.5">
                                                        <span className="text-sm font-medium text-zinc-700">Licencia requerida *</span>
                                                        <select
                                                            value={appLicenseType}
                                                            onChange={(event) => setAppLicenseType(event.target.value)}
                                                            className={inputClassName}
                                                        >
                                                            <option value="">Selecciona...</option>
                                                            {requiredLicenses.map((license) => (
                                                                <option key={license} value={license}>{license}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                )}

                                                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={appHasInsurance}
                                                        onChange={(event) => setAppHasInsurance(event.target.checked)}
                                                        className="mt-1 h-4 w-4 accent-zinc-950"
                                                    />
                                                    <span>
                                                        <span className="block text-sm font-medium text-zinc-700">Tengo seguro de carga activo</span>
                                                        <span className="text-xs text-zinc-500">Poliza vigente si la oferta lo exige.</span>
                                                    </span>
                                                </label>

                                                {requiredCertifications.length > 0 && (
                                                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={appCertificationsReady}
                                                            onChange={(event) => setAppCertificationsReady(event.target.checked)}
                                                            className="mt-1 h-4 w-4 accent-zinc-950"
                                                        />
                                                        <span>
                                                            <span className="block text-sm font-medium text-zinc-700">Tengo las certificaciones requeridas</span>
                                                            <span className="text-xs text-zinc-500">{requiredCertifications.join(', ')}</span>
                                                        </span>
                                                    </label>
                                                )}

                                                <label className="block space-y-1.5">
                                                    <span className="text-sm font-medium text-zinc-700">Tu propuesta de precio</span>
                                                    <input
                                                        type="number"
                                                        value={proposedAmount || ''}
                                                        onChange={(event) => setProposedAmount(Number(event.target.value))}
                                                        placeholder={String(offer.total_amount)}
                                                        className={cn(inputClassName, 'font-money')}
                                                    />
                                                </label>

                                                <label className="block space-y-1.5">
                                                    <span className="text-sm font-medium text-zinc-700">Mensaje</span>
                                                    <textarea
                                                        value={message}
                                                        onChange={(event) => setMessage(event.target.value)}
                                                        placeholder="Disponibilidad, condiciones o nota breve."
                                                        rows={3}
                                                        className={cn(inputClassName, 'resize-none')}
                                                    />
                                                </label>

                                                {appFormErrors.length > 0 && (
                                                    <div className="space-y-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3">
                                                        {appFormErrors.map((formError, index) => (
                                                            <p key={index} className="flex items-start gap-2 text-xs text-zinc-700">
                                                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                                {formError}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="grid gap-3 min-[380px]:grid-cols-2">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => { setShowApplyForm(false); setAppFormErrors([]); }}
                                                    >
                                                        Cancelar
                                                    </Button>
                                                    <Button onClick={handleApply} disabled={isApplying}>
                                                        {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                        Enviar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button className="mt-5 w-full" size="lg" onClick={() => setShowApplyForm(true)}>
                                                <Send className="h-4 w-4" />
                                                Postularme a esta carga
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-600 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
                                <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-950">
                                    <Shield className="h-4 w-4" />
                                    Pago protegido por evidencia
                                </div>
                                La seleccion y liberacion del pago dependen del flujo operativo, PIN, evidencias y cierre de entrega.
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
