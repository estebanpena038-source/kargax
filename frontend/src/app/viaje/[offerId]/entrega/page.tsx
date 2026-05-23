/**
 * =============================================================================
 * KARGAX - TRIP DELIVERY PAGE (MÃ“DULO 3: DESTINO)
 * /app/viaje/[offerId]/entrega/page.tsx
 * 
 * PÃ¡gina premium para el proceso de entrega en destino.
 * Implementa el flujo completo de verificaciÃ³n de entrega:
 * 1. VerificaciÃ³n GPS de llegada a destino
 * 2. Checklist de items a entregar (con opciÃ³n de rechazo)
 * 3. Fotos de evidencia obligatorias para rechazos
 * 4. Ingreso de PIN de entrega
 * 5. Cierre operativo del POD
 * 
 * ARQUITECTURA:
 * - Client Component para interactividad
 * - IntegraciÃ³n con picking API
 * - GPS verification
 * - Real-time updates
 * 
 * DISEÃ‘O:
 * - Mobile-first responsive
 * - Cierre sobrio al completar
 * - Resumen operativo claro
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
    Package,
    MapPin,
    Phone,
    User,
    AlertTriangle,
    Navigation,
    Loader2,
    Shield,
    Wallet,
    ClipboardCheck,
    Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, toast } from '@/components/ui';
import { PickingChecklist, GPSVerification, PinInput } from '@/components/picking';
import { TripSignatureCapture } from '@/components/trips/TripSignatureCapture';
import { pickingApi } from '@/lib/picking';
import type { ManifestItem, RejectionReason } from '@/lib/picking/types';
import { generateStableManifestItemId } from '@/lib/picking/types';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/authStore';

const DEBUG_TRIP_FLOW = process.env.NODE_ENV !== 'production';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Etapa del proceso de entrega
 */
type DeliveryStage =
    | 'verifying_location'  // Verificando GPS destino
    | 'delivering_items'    // Entregando/verificando items
    | 'entering_pin'        // Ingresando PIN de entrega
    | 'completed';          // Viaje completado, POD registrado

/**
 * Tipo para el resultado de la consulta Supabase de cargo_offers
 * Incluye columnas de la migraciÃ³n 018 que pueden no estar en el esquema local
 */
interface CargoOfferQueryResult {
    id: string;
    status: string;
    is_private_fleet: boolean;
    cargo_description: string | null;
    destination_address: string;
    destination_city: string;
    destination_latitude: number | null;
    destination_longitude: number | null;
    delivery_contact_name: string | null;
    delivery_contact_phone: string | null;
    delivery_pin: string | null;
    arrived_at_destination_at: string | null;
    unloading_started_at: string | null;
    delivery_verified_at: string | null;
    manifest_items: unknown;
    total_amount: number;
    net_amount: number | null;
    platform_fee: number | null;
    gps_tolerance_meters: number | null;
    assigned_trucker_id: string | null;
    private_fleet_trucker_id: string | null;
    manifest_delivered_count: number | null;
    manifest_rejected_count: number | null;
}

/**
 * Datos de la oferta para esta pÃ¡gina
 */
interface OfferData {
    id: string;
    isPrivateFleet: boolean;
    title: string;
    description?: string;
    destinationAddress: string;
    destinationCity: string;
    destinationLat?: number | null;
    destinationLng?: number | null;
    deliveryContactName?: string;
    deliveryContactPhone?: string;
    deliveryPin?: string;
    arrivedAtDestinationAt?: string | null;
    unloadingStartedAt?: string | null;
    deliveryVerifiedAt?: string | null;
    manifestItems: ManifestItem[];
    totalAmount: number;
    netAmount: number;
    platformFee: number;
    gpsTolerance: number;
}

function hasLoadRejectionSignal(item: ManifestItem) {
    return item.loadStatus === 'rejected'
        || /rechaz/i.test(item.loadRejectionReason || '')
        || /rechaz/i.test(item.loadNotes || '')
        || (item.loadedQty === 0 && Boolean(item.loadedAt || item.loadRejectionReason));
}

function isDeliveryItemResolved(item: ManifestItem) {
    if (hasLoadRejectionSignal(item)) {
        return true;
    }

    return Boolean(
        item.deliveredAt
        || item.deliveryStatus === 'complete'
        || item.deliveryStatus === 'partial'
        || item.deliveryStatus === 'rejected'
    );
}

function calculateDeliveryCounts(items: ManifestItem[]) {
    return items.reduce(
        (totals, item) => {
            if (hasLoadRejectionSignal(item)) {
                return {
                    delivered: totals.delivered,
                    rejected: totals.rejected + Math.max(0, Number(item.quantity || 0)),
                };
            }

            return {
                delivered: totals.delivered + Math.max(0, Number(item.deliveredQty || 0)),
                rejected: totals.rejected + Math.max(0, Number(item.rejectedQty || 0)),
            };
        },
        { delivered: 0, rejected: 0 }
    );
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

/**
 * Header con informaciÃ³n de la entrega
 */
function DeliveryHeader({
    offer,
    stage,
    onBack,
}: {
    offer: OfferData;
    stage: DeliveryStage;
    onBack: () => void;
}) {
    const stageBadge = {
        verifying_location: { label: 'Verificando destino', color: 'border-white/15 bg-white/8 text-white/80' },
        delivering_items: { label: 'POD activo', color: 'border-white/15 bg-white/8 text-white/80' },
        entering_pin: { label: 'PIN de entrega', color: 'border-white/15 bg-white/8 text-white/80' },
        completed: { label: 'Entrega registrada', color: 'border-white/15 bg-white/8 text-white/80' },
    };

    return (
        <div className="kx-trip-panel luxury-panel rounded-b-lg border-b border-white/10 p-4 text-white shadow-[0_28px_80px_-58px_rgba(0,0,0,.9)] min-[380px]:p-5 sm:p-6">
            {/* Back button & Stage badge */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-white/70 transition-colors hover:text-white"
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
                    <ClipboardCheck className="h-5 w-5 text-white min-[380px]:h-7 min-[380px]:w-7" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold">
                        Entrega en Destino
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
                        <p className="font-medium">Punto de Entrega</p>
                        <p className="mt-0.5 text-sm text-white/68">
                            {offer.destinationAddress}
                        </p>
                        <p className="text-xs text-white/50">
                            {offer.destinationCity}
                        </p>
                    </div>
                </div>
            </div>

            {/* Contact info */}
            {offer.deliveryContactName && (
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm min-[380px]:gap-4">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-white/50" />
                        <span>{offer.deliveryContactName}</span>
                    </div>
                    {offer.deliveryContactPhone && (
                        <a
                            href={`tel:${offer.deliveryContactPhone}`}
                            className="flex items-center gap-2 text-white hover:text-white/75"
                        >
                            <Phone className="w-4 h-4" />
                            <span>{offer.deliveryContactPhone}</span>
                        </a>
                    )}
                </div>
            )}

            {/* Payment info */}
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/8 p-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
                <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-white/70" />
                    <span className="text-sm">Valor operativo</span>
                </div>
                <span className="font-money text-lg font-bold text-white">
                    ${offer.netAmount?.toLocaleString('es-CO') || '0'}
                </span>
            </div>
        </div>
    );
}

/**
 * Progress stepper para entrega
 */
function ProgressStepper({ stage }: { stage: DeliveryStage }) {
    const steps = [
        { id: 'verifying_location', label: 'GPS', icon: Navigation },
        { id: 'delivering_items', label: 'Entrega', icon: Package },
        { id: 'entering_pin', label: 'PIN', icon: Shield },
        { id: 'completed', label: 'Cierre', icon: Wallet },
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
 * Cierre operativo sobrio al completar
 */
function CompletedCelebration({
    offer,
    deliveredCount,
    rejectedCount,
    onGoToWallet,
    onBack,
}: {
    offer: OfferData;
    deliveredCount: number;
    rejectedCount: number;
    onGoToWallet: () => void;
    onBack: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 text-center"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-lg border border-zinc-950 bg-zinc-950 text-white shadow-[0_24px_60px_-48px_rgba(10,10,10,.8)]"
            >
                <ClipboardCheck className="h-11 w-11" />
            </motion.div>

            <h2 className="mb-2 text-2xl font-bold text-slate-900">
                Entrega registrada
            </h2>
            <p className="mx-auto max-w-sm text-slate-500">
                El POD quedo guardado con evidencia, firma y PIN. KargaX actualizara los estados operativos asociados.
            </p>

            <div className="mx-auto mt-8 grid max-w-sm grid-cols-1 gap-3 min-[380px]:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-2xl font-bold text-zinc-950">{deliveredCount}</p>
                    <p className="text-xs text-zinc-600">Entregados</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-2xl font-bold text-zinc-950">{rejectedCount}</p>
                    <p className="text-xs text-zinc-600">Rechazados</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-2xl font-bold text-zinc-950">{rejectedCount > 0 ? 'Parcial' : 'POD'}</p>
                    <p className="text-xs text-zinc-600">Estado</p>
                </div>
            </div>

            <Card className="mx-auto mt-8 max-w-sm border-zinc-200 bg-white" variant="premium">
                <div className="mb-4 flex items-center justify-between">
                    <span className="text-slate-600">Valor operativo</span>
                    <span className="flex items-center gap-1 text-sm font-medium text-zinc-700">
                        Validacion posterior
                    </span>
                </div>

                <div className="font-money flex items-center justify-center gap-2 text-4xl font-bold text-slate-900">
                    <span className="text-2xl text-slate-400">$</span>
                    {offer.netAmount?.toLocaleString('es-CO') || '0'}
                    <span className="text-lg text-slate-400">COP</span>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
                    <div className="flex justify-between">
                        <span>Valor del viaje</span>
                        <span>${offer.totalAmount?.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                        <span>Comision asociada</span>
                        <span className="text-slate-600">${offer.platformFee?.toLocaleString('es-CO')}</span>
                    </div>
                </div>
            </Card>

            <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
                <Button
                    onClick={onGoToWallet}
                    variant="primary"
                    size="lg"
                    className="w-full"
                >
                    <Wallet className="w-5 h-5" />
                    Ver billetera
                </Button>

                <Button
                    onClick={onBack}
                    variant="outline"
                    size="lg"
                    className="w-full"
                >
                    {offer.isPrivateFleet ? 'Volver a viajes asignados' : 'Ver mas ofertas'}
                </Button>
            </div>
        </motion.div>
    );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function TripDeliveryPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const offerId = params?.offerId as string;

    // State
    const [stage, setStage] = useState<DeliveryStage>('verifying_location');
    const [offer, setOffer] = useState<OfferData | null>(null);
    const [manifestItems, setManifestItems] = useState<ManifestItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);
    const [isPinVerifying, setIsPinVerifying] = useState(false);
    const [pinAttempts, setPinAttempts] = useState(0);
    const [deliverySignatureSavedAt, setDeliverySignatureSavedAt] = useState<string | null>(null);
    const [reportingEvent, setReportingEvent] = useState<'fleet_incident' | 'panic_alert' | null>(null);

    // Tracking de items
    const [deliveredCount, setDeliveredCount] = useState(0);
    const [rejectedCount, setRejectedCount] = useState(0);

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
                        destination_address,
                        destination_city,
                        destination_latitude,
                        destination_longitude,
                        delivery_contact_name,
                        delivery_contact_phone,
                        delivery_pin,
                        arrived_at_destination_at,
                        unloading_started_at,
                        delivery_verified_at,
                        manifest_items,
                        total_amount,
                        net_amount,
                        platform_fee,
                        gps_tolerance_meters,
                        assigned_trucker_id,
                        private_fleet_trucker_id,
                        manifest_delivered_count,
                        manifest_rejected_count
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
                    setError('No tienes permiso para acceder a esta entrega');
                    return;
                }

                if (!offer.delivery_pin && !offer.delivery_verified_at) {
                    setError(offer.is_private_fleet
                        ? 'La entrega aun no tiene PIN operativo disponible para esta ruta privada.'
                        : 'La entrega aun no tiene PIN disponible. Primero debe confirmarse el pago del viaje.');
                    return;
                }

                if (!offer.delivery_verified_at && offer.status !== 'in_progress' && offer.status !== 'completed') {
                    setError('La entrega aun no esta habilitada. Primero debe confirmarse el pago y completarse la recogida.');
                    return;
                }

                // Parsear manifest_items
                let items: ManifestItem[] = [];
                if (offer.manifest_items) {
                    items = typeof offer.manifest_items === 'string'
                        ? JSON.parse(offer.manifest_items)
                        : offer.manifest_items as ManifestItem[];

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
                    destinationAddress: offer.destination_address,
                    destinationCity: offer.destination_city,
                    destinationLat: offer.destination_latitude,
                    destinationLng: offer.destination_longitude,
                    deliveryContactName: offer.delivery_contact_name || undefined,
                    deliveryContactPhone: offer.delivery_contact_phone || undefined,
                    deliveryPin: offer.delivery_pin || undefined,
                    arrivedAtDestinationAt: offer.arrived_at_destination_at,
                    unloadingStartedAt: offer.unloading_started_at,
                    deliveryVerifiedAt: offer.delivery_verified_at,
                    manifestItems: items,
                    totalAmount: offer.total_amount,
                    netAmount: offer.net_amount || offer.total_amount,
                    platformFee: offer.platform_fee || 0,
                    gpsTolerance: offer.gps_tolerance_meters || 500,
                });

                setManifestItems(items);
                const deliveryCounts = calculateDeliveryCounts(items);
                setDeliveredCount(deliveryCounts.delivered);
                setRejectedCount(deliveryCounts.rejected);

                const { data: signatureRowsRaw } = await supabase
                    .from('trip_signature_evidences')
                    .select('created_at')
                    .eq('offer_id', offer.id)
                    .eq('signature_stage', 'delivery_pod')
                    .order('created_at', { ascending: false })
                    .limit(1);

                const signatureRows = (signatureRowsRaw || []) as Array<{ created_at: string }>;
                setDeliverySignatureSavedAt(signatureRows?.[0]?.created_at || null);

                // Determinar etapa inicial
                if (offer.delivery_verified_at) {
                    setStage('completed');
                } else if (offer.unloading_started_at || offer.arrived_at_destination_at) {
                    const allDelivered = items.every(isDeliveryItemResolved);
                    const hasPrivateSignature = Boolean(signatureRows?.[0]?.created_at);
                    setStage(allDelivered && (!offer.is_private_fleet || hasPrivateSignature) ? 'entering_pin' : 'delivering_items');
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
                destination_address,
                destination_city,
                destination_latitude,
                destination_longitude,
                delivery_contact_name,
                delivery_contact_phone,
                delivery_pin,
                arrived_at_destination_at,
                unloading_started_at,
                delivery_verified_at,
                manifest_items,
                total_amount,
                net_amount,
                platform_fee,
                gps_tolerance_meters,
                assigned_trucker_id,
                private_fleet_trucker_id,
                manifest_delivered_count,
                manifest_rejected_count
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
            destinationAddress: offerRow.destination_address,
            destinationCity: offerRow.destination_city,
            destinationLat: offerRow.destination_latitude,
            destinationLng: offerRow.destination_longitude,
            deliveryContactName: offerRow.delivery_contact_name || undefined,
            deliveryContactPhone: offerRow.delivery_contact_phone || undefined,
            deliveryPin: offerRow.delivery_pin || undefined,
            arrivedAtDestinationAt: offerRow.arrived_at_destination_at,
            unloadingStartedAt: offerRow.unloading_started_at,
            deliveryVerifiedAt: offerRow.delivery_verified_at,
            manifestItems: normalizedItems,
            totalAmount: offerRow.total_amount,
            netAmount: offerRow.net_amount || offerRow.total_amount,
            platformFee: offerRow.platform_fee || 0,
            gpsTolerance: offerRow.gps_tolerance_meters || 500,
        });
        setManifestItems(normalizedItems);
        const deliveryCounts = calculateDeliveryCounts(normalizedItems);
        setDeliveredCount(deliveryCounts.delivered);
        setRejectedCount(deliveryCounts.rejected);

        const { data: signatureRowsRaw } = await supabase
            .from('trip_signature_evidences')
            .select('created_at')
            .eq('offer_id', offerRow.id)
            .eq('signature_stage', 'delivery_pod')
            .order('created_at', { ascending: false })
            .limit(1);

        const signatureRows = (signatureRowsRaw || []) as Array<{ created_at: string }>;
        setDeliverySignatureSavedAt(signatureRows?.[0]?.created_at || null);

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

    const handleGoToWallet = useCallback(() => {
        router.push('/billetera');
    }, [router]);

    const handleReportRouteEvent = useCallback(async (eventType: 'fleet_incident' | 'panic_alert') => {
        if (!offer) return;

        const notes = eventType === 'panic_alert'
            ? 'Boton de panico activado durante entrega de flota privada.'
            : window.prompt('Describe la novedad operativa en la entrega.')?.trim();

        if (eventType === 'fleet_incident' && !notes) {
            return;
        }

        try {
            setReportingEvent(eventType);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('No hay sesion activa');
            }

            const response = await fetch('/api/business/fleet/events', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    offerId: offer.id,
                    eventType,
                    notes,
                    metadata: {
                        phase: 'delivery_pod',
                        source: 'manual_driver_report',
                    },
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error || 'No se pudo registrar el evento');
            }

            toast.success(
                eventType === 'panic_alert' ? 'Panico reportado' : 'Novedad reportada',
                'La empresa ya recibio el evento operativo.'
            );
        } catch (error) {
            toast.error('Evento no registrado', error instanceof Error ? error.message : 'Intenta de nuevo.');
        } finally {
            setReportingEvent(null);
        }
    }, [offer]);

    const handleSaveDeliverySignature = useCallback(async (payload: {
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
        formData.append('signatureStage', 'delivery_pod');
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

        setDeliverySignatureSavedAt(result?.data?.createdAt || new Date().toISOString());
        toast.success('Firma guardada', 'La evidencia digital de entrega quedo registrada.');
    }, [offer]);

    const handleGPSVerified = useCallback(async (result: {
        latitude: number;
        longitude: number;
        accuracy: number;
        distanceMeters: number;
    }) => {
        if (!offer) return;

        setIsProcessing(true);
        try {
            const response = await pickingApi.registerArrival({
                offerId: offer.id,
                locationType: 'destination',
                latitude: result.latitude,
                longitude: result.longitude,
                accuracyMeters: result.accuracy,
            });

            if (response.success) {
                setStage('delivering_items');
                setOffer(prev => prev ? {
                    ...prev,
                    arrivedAtDestinationAt: new Date().toISOString(),
                } : null);
            } else {
                console.error('Error registrando llegada:', response.message);
                alert(`Error: ${response.message}`);
            }
        } catch (err) {
            console.error('Error en GPS verification:', err);
            alert('Error de conexion al verificar GPS');
        } finally {
            setIsProcessing(false);
        }
    }, [offer]);

    /**
     * Bypass de GPS para desarrollo - usa el RPC register_arrival
     */
    const handleGPSBypass = useCallback(async () => {
        if (!offer) return;

        if (DEBUG_TRIP_FLOW) console.log('[GPS Bypass Destino] Iniciando bypass usando RPC...');
        setIsProcessing(true);

        try {
            const response = await pickingApi.registerArrival({
                offerId: offer.id,
                locationType: 'destination',
                latitude: 0,
                longitude: 0,
                accuracyMeters: 10,
            });

            if (DEBUG_TRIP_FLOW) console.log('[GPS Bypass Destino] Respuesta RPC:', response);

            if (!response.success) {
                console.error('[GPS Bypass Destino] RPC fallo:', response.message);
                alert(`Error: ${response.message}`);
                return;
            }

            if (DEBUG_TRIP_FLOW) console.log('[GPS Bypass Destino] Llegada registrada');

            setOffer(prev => prev ? {
                ...prev,
                arrivedAtDestinationAt: new Date().toISOString(),
            } : null);

            setStage('delivering_items');
        } catch (err) {
            console.error('[GPS Bypass Destino] Excepcion:', err);
            alert('Error al ejecutar bypass de GPS');
        } finally {
            setIsProcessing(false);
        }
    }, [offer]);

    const handleItemDeliveredStable = useCallback(async (
        item: ManifestItem,
        deliveredQty: number,
        rejectedQty: number,
        rejectionReason?: RejectionReason,
        notes?: string,
        photos?: File[]
    ) => {
        if (!offer) return;

        setIsProcessing(true);
        try {
            let photoUrls: string[] = [];
            if (photos && photos.length > 0) {
                const uploadResult = await pickingApi.uploadMultiplePhotos(
                    photos,
                    offer.id,
                    'unloading'
                );
                photoUrls = uploadResult.urls;

                if (uploadResult.errors.length > 0) {
                    throw new Error(uploadResult.errors.join('. '));
                }
            }

            const response = await pickingApi.registerItemDelivered({
                offerId: offer.id,
                itemId: item.id,
                itemName: item.name,
                deliveredQty,
                rejectedQty,
                rejectionReason,
                notes,
                photoUrls,
            });

            if (!response.success) {
                throw new Error(response.message || 'No se pudo registrar la entrega');
            }

            const refreshed = await refreshOfferState();
            if (refreshed?.items.length && refreshed.items.every(isDeliveryItemResolved)) {
                if (offer.isPrivateFleet && !deliverySignatureSavedAt) {
                    toast.warning('Firma requerida', 'Captura la firma del receptor antes de pedir el PIN.');
                    return;
                }

                setStage('entering_pin');
            }
        } catch (error) {
            console.error('Error registrando entrega estable:', error);
            alert(error instanceof Error ? error.message : 'Error de conexion. Verifica tu internet e intenta de nuevo.');
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [deliverySignatureSavedAt, offer, refreshOfferState]);

    const handlePinSubmit = useCallback(async (pin: string) => {
        if (!offer) return;

        if (offer.isPrivateFleet && !deliverySignatureSavedAt) {
            setPinError('Antes del PIN debes capturar la firma del receptor.');
            return;
        }

        setIsPinVerifying(true);
        setPinError(null);

        try {
            // @ts-expect-error - La funciÃ³n verify_delivery_pin estÃ¡ en migraciÃ³n 014
            const rpcResponse = await supabase.rpc('verify_delivery_pin', {
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
                void fetch('/api/trucker/score').catch(() => null);
                void fetch(`/api/trips/${offer.id}/tracking/stop`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ reason: 'delivery_pod_completed' }),
                }).catch(() => null);
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
    }, [deliverySignatureSavedAt, offer, user?.id]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

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
            <DeliveryHeader
                offer={offer}
                stage={stage}
                onBack={handleBack}
            />

            {/* Progress stepper */}
            <ProgressStepper stage={stage} />

            {/* Main content */}
            <main className="px-3 pb-8 min-[380px]:px-4">
                {offer.isPrivateFleet ? (
                    <div className="kx-trip-container mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
                        <Card className="border-zinc-200 bg-white p-4 min-[380px]:p-5">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                                    <Camera className="h-5 w-5 text-zinc-800" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Checklist estricto de llegada</h3>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Toma evidencia en vivo de puertas selladas, descarga, remito firmado y firma digital del receptor antes del POD.
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4 min-[380px]:p-5">
                            <h3 className="font-semibold text-slate-900">Ruta segura</h3>
                            <div className="mt-4 grid gap-3">
                                <Button
                                    variant="outline"
                                    isLoading={reportingEvent === 'fleet_incident'}
                                    onClick={() => void handleReportRouteEvent('fleet_incident')}
                                >
                                    Reportar novedad
                                </Button>
                                <Button
                                    variant="outline"
                                    isLoading={reportingEvent === 'panic_alert'}
                                    onClick={() => void handleReportRouteEvent('panic_alert')}
                                >
                                    Boton de panico
                                </Button>
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
                                locationType="destination"
                                locationName={offer.destinationAddress}
                                locationAddress={offer.destinationCity}
                                targetLatitude={offer.destinationLat}
                                targetLongitude={offer.destinationLng}
                                toleranceMeters={offer.gpsTolerance}
                                isVerified={Boolean(offer.arrivedAtDestinationAt)}
                                verifiedAt={offer.arrivedAtDestinationAt}
                                onVerified={handleGPSVerified}
                                allowBypass={process.env.NODE_ENV === 'development'}
                                onBypass={handleGPSBypass}
                            />
                        </motion.div>
                    )}

                    {/* Stage 2: Delivering items */}
                    {stage === 'delivering_items' && (
                        <motion.div
                            key="delivering"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <PickingChecklist
                                items={manifestItems}
                                mode="delivery"
                                isProcessing={isProcessing}
                                onItemDelivered={handleItemDeliveredStable}
                                draftNamespace={offer ? `${offer.id}:delivery` : undefined}
                            />

                            {offer.isPrivateFleet ? (
                                <div className="mt-6">
                                    <TripSignatureCapture
                                        title="Firma del receptor"
                                        subtitle="El receptor o cliente firma e ingresa su documento para cerrar el POD privado."
                                        signerRole="receiver"
                                        requireDocumentId
                                        savedAt={deliverySignatureSavedAt}
                                        onSave={handleSaveDeliverySignature}
                                    />
                                </div>
                            ) : null}

                            {manifestItems.length > 0 && manifestItems.every(isDeliveryItemResolved) && (
                                <Button
                                    onClick={() => setStage('entering_pin')}
                                    className="w-full mt-6"
                                    variant="primary"
                                    size="lg"
                                    disabled={offer.isPrivateFleet && !deliverySignatureSavedAt}
                                >
                                    <Shield className="w-5 h-5" />
                                    Continuar al PIN de Entrega
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
                                title="PIN de Entrega"
                                description="Solicita el PIN al receptor para cerrar la entrega"
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
                            <CompletedCelebration
                                offer={offer}
                                deliveredCount={deliveredCount}
                                rejectedCount={rejectedCount}
                                onGoToWallet={handleGoToWallet}
                                onBack={handleBack}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

