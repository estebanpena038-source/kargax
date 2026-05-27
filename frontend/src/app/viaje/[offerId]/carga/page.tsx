/**
 * =============================================================================
 * KARGAX - TRIP LOADING PAGE (MÃ“DULO 2: ORIGEN)
 * /app/viaje/[offerId]/carga/page.tsx
 * 
 * PÃ¡gina premium para el proceso de carga en origen.
 * Implementa el flujo completo de picking:
 * 1. VerificaciÃ³n GPS de llegada
 * 2. Checklist de items a cargar
 * 3. Fotos de evidencia
 * 4. Ingreso de PIN de salida
 * 
 * ARQUITECTURA:
 * - Server Component para metadata
 * - Client Component para interactividad
 * - Zustand para estado local
 * - TanStack Query para cache
 * 
 * DISEÃ‘O:
 * - Mobile-first responsive
 * - Glass effects premium
 * - Animaciones suaves
 * - Feedback visual inmediato
 * 
 * =============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Truck,
    Package,
    MapPin,
    Phone,
    User,
    CheckCircle2,
    AlertTriangle,
    Navigation,
    Loader2,
    Shield,
    Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, toast } from '@/components/ui';
import { PickingChecklist, GPSVerification, PinInput } from '@/components/picking';
import { TripSignatureCapture } from '@/components/trips/TripSignatureCapture';
import { pickingApi } from '@/lib/picking';
import type { ManifestItem } from '@/lib/picking/types';
import { generateStableManifestItemId } from '@/lib/picking/types';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/authStore';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Etapa del proceso de carga
 */
type LoadingStage =
    | 'verifying_location'  // Verificando GPS
    | 'loading_items'       // Cargando items
    | 'entering_pin'        // Ingresando PIN
    | 'completed';          // Completado

/**
 * Tipo para el resultado de la consulta Supabase de cargo_offers
 * Incluye columnas de la migraciÃ³n 018 que pueden no estar en el esquema local
 */
interface CargoOfferQueryResult {
    id: string;
    status: string;
    is_private_fleet: boolean;
    cargo_description: string | null;
    origin_address: string;
    origin_city: string;
    origin_latitude: number | null;
    origin_longitude: number | null;
    pickup_contact_name: string | null;
    pickup_contact_phone: string | null;
    pickup_pin: string | null;
    arrived_at_origin_at: string | null;
    loading_started_at: string | null;
    pickup_verified_at: string | null;
    manifest_items: unknown;
    total_amount: number;
    freight_payment_amount: number | null;
    expense_allowance_amount: number | null;
    compensation_mode: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses' | null;
    expenses_release_policy: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual' | null;
    gps_tolerance_meters: number | null;
    assigned_trucker_id: string | null;
    private_fleet_trucker_id: string | null;
    destination_warehouse_id: string | null;
}

function getFreightPaymentAmount(offer: CargoOfferQueryResult) {
    const shouldUseLegacyFreight = offer.is_private_fleet && (
        !offer.compensation_mode
        || offer.compensation_mode === 'trip_pay'
        || offer.compensation_mode === 'trip_pay_plus_expenses'
    );

    return offer.is_private_fleet
        ? Number(offer.freight_payment_amount || (shouldUseLegacyFreight ? offer.total_amount : 0) || 0)
        : Number(offer.freight_payment_amount || 0);
}

/**
 * Datos de la oferta para esta pÃ¡gina
 */
interface OfferData {
    id: string;
    isPrivateFleet: boolean;
    title: string;
    description?: string;
    originAddress: string;
    originCity: string;
    originLat?: number | null;
    originLng?: number | null;
    pickupContactName?: string;
    pickupContactPhone?: string;
    pickupPin?: string;
    arrivedAtOriginAt?: string | null;
    loadingStartedAt?: string | null;
    pickupVerifiedAt?: string | null;
    destinationWarehouseId?: string | null;
    manifestItems: ManifestItem[];
    totalAmount: number;
    freightPaymentAmount: number;
    expenseAllowanceAmount: number;
    compensationMode: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses' | null;
    expensesReleasePolicy: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual' | null;
    gpsTolerance: number;
}

function isLoadingItemResolved(item: ManifestItem) {
    return Boolean(
        item.loadedAt
        || item.loadStatus === 'loaded'
        || item.loadStatus === 'issue'
        || item.loadStatus === 'rejected'
    );
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

/**
 * Header con informaciÃ³n de la carga
 */
function LoadingHeader({
    offer,
    stage,
    onBack,
}: {
    offer: OfferData;
    stage: LoadingStage;
    onBack: () => void;
}) {
    // Determinar badge segÃºn etapa
    const stageBadge = {
        verifying_location: { label: 'Verificando ubicacion', color: 'border-white/15 bg-white/8 text-white/80' },
        loading_items: { label: 'Manifiesto activo', color: 'border-white/15 bg-white/8 text-white/80' },
        entering_pin: { label: 'PIN de salida', color: 'border-white/15 bg-white/8 text-white/80' },
        completed: { label: 'Carga registrada', color: 'border-white/15 bg-white/8 text-white/80' },
    };

    return (
        <div className="kx-trip-panel luxury-panel rounded-b-lg border-b border-white/10 p-4 text-white shadow-[0_28px_80px_-58px_rgba(0,0,0,.9)] min-[380px]:p-5 sm:p-6">
            {/* Back button & Stage badge */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm">Volver</span>
                </button>

                <span className={cn(
                    'rounded-md border px-3 py-1 text-xs font-medium',
                    stageBadge[stage].color
                )}>
                    {stageBadge[stage].label}
                </span>
            </div>

            {/* Title */}
            <div className="flex items-start gap-3 min-[380px]:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/8 min-[380px]:h-14 min-[380px]:w-14">
                    <Package className="h-5 w-5 text-white min-[380px]:h-7 min-[380px]:w-7" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold">
                        Carga en Origen
                    </h1>
                    <p className="mt-0.5 text-sm leading-5 text-white/68">
                        {offer.title}
                    </p>
                </div>
            </div>

            {/* Location info */}
            <div className="mt-6 rounded-lg border border-white/10 bg-white/8 p-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10">
                        <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium">Bodega de Origen</p>
                        <p className="mt-0.5 text-sm leading-5 text-white/68">
                            {offer.originAddress}
                        </p>
                        <p className="text-xs text-white/50">
                            {offer.originCity}
                        </p>
                    </div>
                </div>
            </div>

            {/* Contact info */}
            {offer.pickupContactName && (
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm min-[380px]:gap-4">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{offer.pickupContactName}</span>
                    </div>
                    {offer.pickupContactPhone && (
                        <a
                            href={`tel:${offer.pickupContactPhone}`}
                            className="flex items-center gap-2 text-white hover:text-white/75"
                        >
                            <Phone className="w-4 h-4" />
                            <span>{offer.pickupContactPhone}</span>
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Progress stepper visual
 */
function ProgressStepper({ stage }: { stage: LoadingStage }) {
    const steps = [
        { id: 'verifying_location', label: 'GPS', icon: Navigation },
        { id: 'loading_items', label: 'Carga', icon: Package },
        { id: 'entering_pin', label: 'PIN', icon: Shield },
        { id: 'completed', label: 'Listo', icon: CheckCircle2 },
    ];

    const currentIndex = steps.findIndex(s => s.id === stage);

    return (
        <div className="kx-trip-stepper px-3 py-5 sm:px-4 sm:py-6">
            {steps.map((step, index) => {
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                const Icon = step.icon;

                return (
                    <React.Fragment key={step.id}>
                        <div className="kx-trip-step flex flex-col items-center gap-2">
                            <motion.div
                                className={cn(
                                    'w-10 h-10 rounded-full flex items-center justify-center',
                                    'border-2 transition-all duration-300',
                                    isCompleted
                                        ? 'bg-zinc-950 border-zinc-950 text-white'
                                        : isActive
                                            ? 'bg-white border-zinc-950 text-zinc-950 shadow-sm'
                                            : 'bg-zinc-100 border-zinc-200 text-zinc-400'
                                )}
                                animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                                transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                            >
                                <Icon className="w-5 h-5" />
                            </motion.div>
                            <span className={cn(
                                'text-xs font-medium',
                                isActive ? 'text-zinc-950' :
                                    isCompleted ? 'text-zinc-800' : 'text-zinc-400'
                            )}>
                                {step.label}
                            </span>
                        </div>

                        {/* Connector line */}
                        {index < steps.length - 1 && (
                            <div data-kx-connector="true" className="mx-1 h-0.5 min-w-6 flex-1 overflow-hidden rounded-full bg-slate-200 sm:mx-2">
                                <motion.div
                                    className="h-full bg-zinc-950"
                                    initial={{ width: 0 }}
                                    animate={{ width: isCompleted ? '100%' : '0%' }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

/**
 * Mensaje de Ã©xito final
 */
function CompletedMessage({ onContinue, continueLabel }: { onContinue: () => void; continueLabel: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-lg border border-zinc-950 bg-zinc-950 shadow-[0_24px_60px_-48px_rgba(10,10,10,.8)]"
            >
                <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Carga registrada
            </h2>
            <p className="text-slate-500 max-w-xs mx-auto">
                La salida quedo verificada con evidencia y PIN. Puedes continuar la ruta.
            </p>

            <div className="mx-auto mt-8 flex max-w-xs items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white p-4">
                <Shield className="h-5 w-5 text-zinc-800" />
                <span className="text-sm font-medium text-zinc-800">
                    Salida registrada
                </span>
            </div>

            <Button
                onClick={onContinue}
                className="mt-8"
                variant="primary"
                size="lg"
            >
                <Truck className="w-5 h-5" />
                {continueLabel}
            </Button>
        </motion.div>
    );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function TripLoadingPage() {
    // Hooks
    const params = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const offerId = params?.offerId as string;

    // State
    const [stage, setStage] = useState<LoadingStage>('verifying_location');
    const [offer, setOffer] = useState<OfferData | null>(null);
    const [manifestItems, setManifestItems] = useState<ManifestItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);
    const [isPinVerifying, setIsPinVerifying] = useState(false);
    const [pinAttempts, setPinAttempts] = useState(0);
    const [originSignatureSavedAt, setOriginSignatureSavedAt] = useState<string | null>(null);
    const originSignatureRef = React.useRef<HTMLDivElement | null>(null);

    // ==========================================================================
    // DATA FETCHING
    // ==========================================================================

    useEffect(() => {
        async function fetchOffer() {
            if (!offerId || !user) return;

            setIsLoading(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('cargo_offers')
                    .select(`
                        id,
                        status,
                        is_private_fleet,
                        cargo_description,
                        origin_address,
                        origin_city,
                        origin_latitude,
                        origin_longitude,
                        pickup_contact_name,
                        pickup_contact_phone,
                        pickup_pin,
                        arrived_at_origin_at,
                        loading_started_at,
                        pickup_verified_at,
                        manifest_items,
                        total_amount,
                        freight_payment_amount,
                        expense_allowance_amount,
                        compensation_mode,
                        expenses_release_policy,
                        gps_tolerance_meters,
                        assigned_trucker_id,
                        private_fleet_trucker_id,
                        destination_warehouse_id
                    `)
                    .eq('id', offerId)
                    .single();

                if (fetchError) throw fetchError;

                // Cast explÃ­cito para columnas de migraciÃ³n 018
                const offer = data as unknown as CargoOfferQueryResult | null;

                if (!offer) {
                    setError('Oferta no encontrada');
                    return;
                }

                let hasAccess =
                    offer.assigned_trucker_id === user.id
                    || offer.private_fleet_trucker_id === user.id;

                if (!hasAccess) {
                    const { data: acceptedApplicationRaw } = await supabase
                        .from('offer_applications')
                        .select('id')
                        .eq('offer_id', offer.id)
                        .eq('trucker_id', user.id)
                        .eq('status', 'accepted')
                        .maybeSingle();

                    const acceptedApplication = acceptedApplicationRaw as { id: string } | null;
                    hasAccess = Boolean(acceptedApplication?.id);
                }

                if (!hasAccess) {
                    setError('No tienes permiso para acceder a esta carga');
                    return;
                }

                if (!offer.pickup_pin && !offer.pickup_verified_at) {
                    setError(offer.is_private_fleet
                        ? 'Este viaje privado fue aceptado, pero aun no tiene PIN operativo. Espera la confirmacion de la empresa antes de iniciar.'
                        : 'Este viaje fue aceptado, pero aun no tiene pago confirmado. Espera la confirmacion de la empresa antes de iniciar.');
                    return;
                }

                // Parsear manifest_items
                let items: ManifestItem[] = [];
                if (offer.manifest_items) {
                    items = typeof offer.manifest_items === 'string'
                        ? JSON.parse(offer.manifest_items)
                        : offer.manifest_items as ManifestItem[];

                    // Asegurar que cada item tenga ID
                    items = items.map((item, index) => ({
                        ...item,
                        id: item.id || generateStableManifestItemId(item.name, index),
                    }));
                }

                setOffer({
                    id: offer.id,
                    isPrivateFleet: offer.is_private_fleet,
                    title: offer.cargo_description?.substring(0, 50) || 'Oferta de carga',
                    description: offer.cargo_description || undefined,
                    originAddress: offer.origin_address,
                    originCity: offer.origin_city,
                    originLat: offer.origin_latitude,
                    originLng: offer.origin_longitude,
                    pickupContactName: offer.pickup_contact_name || undefined,
                    pickupContactPhone: offer.pickup_contact_phone || undefined,
                    pickupPin: offer.pickup_pin || undefined,
                    arrivedAtOriginAt: offer.arrived_at_origin_at,
                    loadingStartedAt: offer.loading_started_at,
                    pickupVerifiedAt: offer.pickup_verified_at,
                    destinationWarehouseId: offer.destination_warehouse_id,
                    manifestItems: items,
                    totalAmount: offer.total_amount,
                    freightPaymentAmount: getFreightPaymentAmount(offer),
                    expenseAllowanceAmount: Number(offer.expense_allowance_amount || 0),
                    compensationMode: offer.compensation_mode,
                    expensesReleasePolicy: offer.expenses_release_policy,
                    gpsTolerance: offer.gps_tolerance_meters || 500,
                });

                setManifestItems(items);

                const { data: signatureRowsRaw } = await supabase
                    .from('trip_signature_evidences')
                    .select('created_at')
                    .eq('offer_id', offer.id)
                    .eq('signature_stage', offer.destination_warehouse_id ? 'origin_driver_acceptance' : 'origin_dispatch')
                    .order('created_at', { ascending: false })
                    .limit(1);

                const signatureRows = (signatureRowsRaw || []) as Array<{ created_at: string }>;
                setOriginSignatureSavedAt(signatureRows?.[0]?.created_at || null);

                // Determinar etapa inicial basado en estado
                if (offer.pickup_verified_at) {
                    setStage('completed');
                } else if (offer.loading_started_at || offer.arrived_at_origin_at) {
                    const allLoaded = items.every(isLoadingItemResolved);
                    const hasPrivateSignature = Boolean(signatureRows?.[0]?.created_at);
                    setStage(allLoaded && (!offer.is_private_fleet || hasPrivateSignature) ? 'entering_pin' : 'loading_items');
                } else {
                    setStage('verifying_location');
                }

            } catch (err) {
                console.error('Error fetching offer:', err);
                setError('Error al cargar la informacion');
            } finally {
                setIsLoading(false);
            }
        }

        fetchOffer();
    }, [offerId, user]);

    const refreshOfferState = useCallback(async () => {
        if (!offerId || !user) return null;

        const { data, error: fetchError } = await supabase
            .from('cargo_offers')
            .select(`
                id,
                status,
                is_private_fleet,
                cargo_description,
                origin_address,
                origin_city,
                origin_latitude,
                origin_longitude,
                pickup_contact_name,
                pickup_contact_phone,
                pickup_pin,
                arrived_at_origin_at,
                loading_started_at,
                pickup_verified_at,
                manifest_items,
                total_amount,
                freight_payment_amount,
                expense_allowance_amount,
                compensation_mode,
                expenses_release_policy,
                gps_tolerance_meters,
                assigned_trucker_id,
                private_fleet_trucker_id,
                destination_warehouse_id
            `)
            .eq('id', offerId)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        const offerRow = data as unknown as CargoOfferQueryResult | null;
        if (!offerRow) {
            throw new Error('Oferta no encontrada');
        }

        const items = (typeof offerRow.manifest_items === 'string'
            ? JSON.parse(offerRow.manifest_items)
            : (offerRow.manifest_items || [])) as ManifestItem[];

        const normalizedItems = items.map((item, index) => ({
            ...item,
            id: item.id || generateStableManifestItemId(item.name, index),
        }));

        setOffer({
            id: offerRow.id,
            isPrivateFleet: offerRow.is_private_fleet,
            title: offerRow.cargo_description?.substring(0, 50) || 'Oferta de carga',
            description: offerRow.cargo_description || undefined,
            originAddress: offerRow.origin_address,
            originCity: offerRow.origin_city,
            originLat: offerRow.origin_latitude,
            originLng: offerRow.origin_longitude,
            pickupContactName: offerRow.pickup_contact_name || undefined,
            pickupContactPhone: offerRow.pickup_contact_phone || undefined,
            pickupPin: offerRow.pickup_pin || undefined,
            arrivedAtOriginAt: offerRow.arrived_at_origin_at,
            loadingStartedAt: offerRow.loading_started_at,
            pickupVerifiedAt: offerRow.pickup_verified_at,
            destinationWarehouseId: offerRow.destination_warehouse_id,
            manifestItems: normalizedItems,
            totalAmount: offerRow.total_amount,
            freightPaymentAmount: getFreightPaymentAmount(offerRow),
            expenseAllowanceAmount: Number(offerRow.expense_allowance_amount || 0),
            compensationMode: offerRow.compensation_mode,
            expensesReleasePolicy: offerRow.expenses_release_policy,
            gpsTolerance: offerRow.gps_tolerance_meters || 500,
        });
        setManifestItems(normalizedItems);

        const { data: signatureRowsRaw } = await supabase
            .from('trip_signature_evidences')
            .select('created_at')
            .eq('offer_id', offerRow.id)
            .eq('signature_stage', offerRow.destination_warehouse_id ? 'origin_driver_acceptance' : 'origin_dispatch')
            .order('created_at', { ascending: false })
            .limit(1);

        const signatureRows = (signatureRowsRaw || []) as Array<{ created_at: string }>;
        setOriginSignatureSavedAt(signatureRows?.[0]?.created_at || null);

        return {
            offer: offerRow,
            items: normalizedItems,
        };
    }, [offerId, user]);

    // ==========================================================================
    // HANDLERS
    // ==========================================================================

    const handleBack = useCallback(() => {
        router.push(offer?.isPrivateFleet ? '/viajes-asignados' : '/ofertas-aceptadas');
    }, [offer?.isPrivateFleet, router]);

    const scrollToOriginSignature = useCallback(() => {
        window.setTimeout(() => {
            originSignatureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
    }, []);

    /**
     * Manejar verificaciÃ³n de GPS completada
     */
    const handleGPSVerified = useCallback(async (result: {
        latitude: number;
        longitude: number;
        accuracy: number;
        distanceMeters: number;
    }) => {
        if (!offer) return;

        setIsProcessing(true);
        try {
            // Registrar llegada en el servidor
            const response = await pickingApi.registerArrival({
                offerId: offer.id,
                locationType: 'origin',
                latitude: result.latitude,
                longitude: result.longitude,
                accuracyMeters: result.accuracy,
            });

            if (response.success) {
                // Avanzar a la siguiente etapa
                setStage('loading_items');

                // Actualizar estado de la oferta localmente
                setOffer(prev => prev ? {
                    ...prev,
                    arrivedAtOriginAt: new Date().toISOString(),
                } : null);
            } else {
                console.error('Error registrando llegada:', response.message);
                alert(`Error al registrar llegada: ${response.message}`);
            }
        } catch (err) {
            console.error('Error en GPS verification:', err);
            alert('Error de conexion al verificar GPS');
        } finally {
            setIsProcessing(false);
        }
    }, [offer]);

    const handleItemLoadedStable = useCallback(async (
        item: ManifestItem,
        payload: {
            hasIssue: boolean;
            loadingDecision: 'loaded' | 'issue' | 'rejected';
            notes: string;
            photos: File[];
        }
    ) => {
        if (!offer) {
            console.error('[Carga] No hay oferta disponible');
            return;
        }

        setIsProcessing(true);
        try {
            let photoUrls: string[] = [];
            if (payload.photos.length > 0) {
                const uploadResult = await pickingApi.uploadMultiplePhotos(
                    payload.photos,
                    offer.id,
                    payload.loadingDecision === 'rejected' ? 'issue' : 'loading'
                );
                photoUrls = uploadResult.urls;

                if (uploadResult.errors.length > 0) {
                    throw new Error(uploadResult.errors.join('. '));
                }
            }

            const response = await pickingApi.registerItemLoaded({
                offerId: offer.id,
                itemId: item.id,
                itemName: item.name,
                quantity: item.quantity,
                notes: payload.notes,
                hasIssue: payload.hasIssue,
                loadStatus: payload.loadingDecision,
                rejectionReason: payload.loadingDecision === 'rejected' ? payload.notes : undefined,
                photoUrls,
            });

            if (!response.success) {
                throw new Error(response.message || 'No se pudo registrar el item');
            }

            const refreshed = await refreshOfferState();
            if (refreshed?.items.length && refreshed.items.every(isLoadingItemResolved)) {
                if (offer.isPrivateFleet && !originSignatureSavedAt) {
                    return;
                }

                setStage('entering_pin');
            }
        } catch (error) {
            console.error('[Carga estable] Error registrando item:', error);
            alert(error instanceof Error ? error.message : 'Error de conexion. Verifica tu internet e intenta de nuevo.');
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [offer, originSignatureSavedAt, refreshOfferState]);

    /**
     * Manejar verificaciÃ³n de PIN
     */
    const handlePinSubmit = useCallback(async (pin: string) => {
        if (!offer) return;

        if (offer.isPrivateFleet && !originSignatureSavedAt) {
            setPinError('Antes del PIN debes capturar la firma del responsable de origen.');
            setStage('loading_items');
            scrollToOriginSignature();
            return;
        }

        setIsPinVerifying(true);
        setPinError(null);

        try {
            // Llamar RPC para verificar PIN
            // @ts-expect-error - La funciÃ³n verify_pickup_pin estÃ¡ en migraciÃ³n 019
            const rpcResponse = await supabase.rpc('verify_pickup_pin', {
                p_offer_id: offer.id,
                p_input_pin: pin,  // FIXED: was p_pin, function expects p_input_pin
                p_trucker_id: user?.id,
            });

            const { data, error: rpcError } = rpcResponse as {
                data: Array<{ success: boolean; message: string }> | null;
                error: Error | null
            };

            if (rpcError) throw rpcError;

            const result = data?.[0];

            if (result?.success) {
                setStage('completed');
            } else {
                setPinAttempts(prev => prev + 1);
                setPinError(result?.message || 'PIN incorrecto');
            }
        } catch (err) {
            console.error('Error verificando PIN:', err);
            setPinError('Error al verificar el PIN');
        } finally {
            setIsPinVerifying(false);
        }
    }, [offer, originSignatureSavedAt, scrollToOriginSignature, user?.id]);

    const handleContinue = useCallback(() => {
        router.push(offer?.isPrivateFleet && offer?.id ? `/viaje/${offer.id}` : '/ofertas-aceptadas');
    }, [offer?.id, offer?.isPrivateFleet, router]);

    const handleSaveOriginSignature = useCallback(async (payload: {
        signerName: string;
        signerDocumentId?: string;
        signerRole: 'warehouse_manager' | 'customer' | 'receiver' | 'other';
        file: File;
    }) => {
        if (!offer) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error('No hay sesion activa');
        }

        const formData = new FormData();
        formData.append('offerId', offer.id);
        formData.append('signatureStage', offer.destinationWarehouseId ? 'origin_driver_acceptance' : 'origin_dispatch');
        formData.append('signerName', payload.signerName);
        formData.append('signerDocumentId', payload.signerDocumentId || '');
        formData.append('signerRole', payload.signerRole);
        formData.append('signature', payload.file);

        const response = await fetch('/api/business/fleet/signatures', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(result?.error || 'No se pudo guardar la firma');
        }

        setOriginSignatureSavedAt(result?.data?.createdAt || new Date().toISOString());
        toast.success('Firma guardada', 'La evidencia digital de salida quedo registrada.');

        if (manifestItems.length > 0 && manifestItems.every(isLoadingItemResolved)) {
            setStage('entering_pin');
        }
    }, [manifestItems, offer]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    // Loading state
    if (isLoading) {
        return (
            <div className="flex min-h-svh items-center justify-center bg-zinc-50 px-4">
                <div className="text-center">
                    <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-zinc-800" />
                    <p className="text-slate-500">Cargando informacion...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !offer) {
        return (
            <div className="flex min-h-svh items-center justify-center bg-zinc-50 p-4">
                <Card className="max-w-md w-full text-center p-8">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-zinc-800" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                        {error || 'Error'}
                    </h2>
                    <Button onClick={handleBack} className="mt-4" variant="outline">
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="kx-trip-page bg-zinc-50 pb-safe">
            {/* Header */}
            <LoadingHeader
                offer={offer}
                stage={stage}
                onBack={handleBack}
            />

            {/* Progress stepper */}
            <ProgressStepper stage={stage} />

            {/* Main content */}
            <main className="px-3 pb-8 min-[380px]:px-4">
                {offer.isPrivateFleet ? (
                    <div className="kx-trip-container mb-6">
                        <Card className="border-zinc-950 bg-zinc-950 p-4 text-white min-[380px]:p-5">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg border border-white/15 bg-white/10 p-2.5">
                                    <Camera className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Checklist estricto de salida</h3>
                                    <p className="mt-1 text-sm text-white/70">
                                        Captura evidencia en vivo de placas, llantas, carga acomodada y firma del responsable de bodega antes del PIN.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                ) : null}

                <AnimatePresence mode="wait">
                    {/* Stage 1: GPS Verification */}
                    {stage === 'verifying_location' && (
                        <motion.div
                            key="gps"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <GPSVerification
                                locationType="origin"
                                locationName={offer.originAddress}
                                locationAddress={offer.originCity}
                                targetLatitude={offer.originLat}
                                targetLongitude={offer.originLng}
                                toleranceMeters={offer.gpsTolerance}
                                isVerified={Boolean(offer.arrivedAtOriginAt)}
                                verifiedAt={offer.arrivedAtOriginAt}
                                onVerified={handleGPSVerified}
                            />
                        </motion.div>
                    )}

                    {/* Stage 2: Loading items */}
                    {stage === 'loading_items' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <PickingChecklist
                                items={manifestItems}
                                mode="loading"
                                isProcessing={isProcessing}
                                onItemLoaded={handleItemLoadedStable}
                                draftNamespace={offer ? `${offer.id}:loading` : undefined}
                            />
                            {offer.isPrivateFleet ? (
                                <div ref={originSignatureRef} className="mt-6">
                                    <TripSignatureCapture
                                        title={offer.destinationWarehouseId ? 'Firma del conductor en origen' : 'Firma del responsable de origen'}
                                        subtitle={offer.destinationWarehouseId
                                            ? 'El conductor firma que recibe la carga bajo custodia antes del PIN de salida.'
                                            : 'El responsable de bodega u origen firma en el celular para validar el despacho privado.'}
                                        signerRole={offer.destinationWarehouseId ? 'other' : 'warehouse_manager'}
                                        requireDocumentId
                                        savedAt={originSignatureSavedAt}
                                        onSave={handleSaveOriginSignature}
                                    />
                                </div>
                            ) : null}

                            {/* BotÃ³n para forzar avance a PIN si todos cargados */}
                            {manifestItems.length > 0 && manifestItems.every(isLoadingItemResolved) && (
                                <Button
                                    onClick={() => {
                                        if (offer.isPrivateFleet && !originSignatureSavedAt) {
                                            toast.warning('Firma requerida', 'Captura la firma del responsable antes de pedir el PIN.');
                                            scrollToOriginSignature();
                                            return;
                                        }

                                        setStage('entering_pin');
                                    }}
                                    className="w-full mt-6"
                                    variant="primary"
                                    size="lg"
                                    disabled={isProcessing}
                                >
                                    <Shield className="w-5 h-5" />
                                    Continuar al PIN de Salida
                                </Button>
                            )}
                        </motion.div>
                    )}

                    {/* Stage 3: PIN Entry */}
                    {stage === 'entering_pin' && (
                        <motion.div
                            key="pin"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex justify-center"
                        >
                            <PinInput
                                pinLength={4}
                                title="PIN de Salida"
                                description="Solicita el PIN al responsable de origen para confirmar la carga"
                                isVerifying={isPinVerifying}
                                errorMessage={pinError || undefined}
                                attemptsRemaining={5 - pinAttempts}
                                maxAttempts={5}
                                isLocked={pinAttempts >= 5}
                                onSubmit={handlePinSubmit}
                            />
                        </motion.div>
                    )}

                    {/* Stage 4: Completed */}
                    {stage === 'completed' && (
                        <motion.div
                            key="completed"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <CompletedMessage
                                onContinue={handleContinue}
                                continueLabel={offer.isPrivateFleet ? 'Continuar ruta' : 'Continuar al Dashboard'}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
