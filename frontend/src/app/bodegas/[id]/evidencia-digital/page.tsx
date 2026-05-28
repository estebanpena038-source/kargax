'use client';

/* eslint-disable @next/next/no-img-element */

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    ClipboardCheck,
    Copy,
    FileText,
    Fingerprint,
    Loader2,
    MapPin,
    Navigation,
    PackageCheck,
    Printer,
    RefreshCw,
    Route,
    Search,
    ShieldCheck,
    Signature,
    Truck,
    Wifi,
    XCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, toast } from '@/components/ui';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsEmptyState,
    WmsMetric,
    WmsMetricGrid,
    WmsStatusBadge,
    type WmsTone,
} from '@/components/warehouses/WarehouseExecutionLuxury';
import warehouseClient from '@/lib/warehouses/client';
import { cn } from '@/lib/utils';
import { formatWarehouseDateTime, mapWarehouseErrorMessage } from '@/lib/warehouses/localization';
import { supabase } from '@/lib/supabase/client';
import { TripSignatureCapture } from '@/components/trips/TripSignatureCapture';
import type {
    WarehouseCapabilities,
    WarehouseDigitalEvidenceRecord,
    WarehouseDigitalEvidenceStage,
    WarehouseDigitalEvidenceStatus,
} from '@/lib/warehouses/types';

type EvidenceFilter = 'all' | 'in_route' | 'completed' | 'rejected' | 'missing' | 'no_signature';

const FILTERS: Array<{ id: EvidenceFilter; label: string }> = [
    { id: 'all', label: 'Todos' },
    { id: 'in_route', label: 'En ruta' },
    { id: 'completed', label: 'Completados' },
    { id: 'rejected', label: 'Rechazados' },
    { id: 'missing', label: 'Con faltantes' },
    { id: 'no_signature', label: 'Sin firma' },
];

const STATUS_META: Record<WarehouseDigitalEvidenceStatus, { label: string; tone: WmsTone; icon: React.ElementType }> = {
    dispatch_only: { label: 'Solo despacho', tone: 'neutral', icon: PackageCheck },
    assigned: { label: 'Asignado', tone: 'neutral', icon: Truck },
    accepted: { label: 'Aceptado', tone: 'strong', icon: CheckCircle2 },
    rejected: { label: 'Rechazado', tone: 'critical', icon: XCircle },
    in_transit: { label: 'En ruta', tone: 'strong', icon: Navigation },
    completed: { label: 'Completo', tone: 'strong', icon: ShieldCheck },
    cancelled: { label: 'Cancelado', tone: 'muted', icon: XCircle },
    blocked: { label: 'Bloqueado', tone: 'critical', icon: AlertTriangle },
};

const STAGE_LABELS: Record<WarehouseDigitalEvidenceStage, string> = {
    dispatch: 'Despacho',
    assignment: 'Asignacion',
    origin: 'Origen',
    loading: 'Carga',
    pickup_pin: 'PIN salida',
    tracking: 'Seguimiento',
    destination: 'Destino',
    delivery: 'Entrega',
    delivery_pin: 'PIN entrega',
    signature: 'Firma',
    financial: 'Finanzas',
    incident: 'Novedad',
};

function formatDate(value?: string | null) {
    return formatWarehouseDateTime(value);
}

function filterRecord(record: WarehouseDigitalEvidenceRecord, filter: EvidenceFilter, query: string) {
    const byFilter = filter === 'all'
        || (filter === 'in_route' && (record.status === 'in_transit' || record.tracking.active))
        || (filter === 'completed' && record.status === 'completed')
        || (filter === 'rejected' && (record.status === 'rejected' || record.rejection.rejected))
        || (filter === 'missing' && record.manifestSummary.hasMissingEvidence)
        || (filter === 'no_signature' && Boolean(record.offer) && record.signatures.length === 0);

    if (!byFilter) return false;
    if (!query.trim()) return true;

    const needle = query.trim().toLowerCase();
    const haystack = [
        record.dispatch.number,
        record.dispatch.id,
        record.offer?.id,
        record.driver.name,
        record.driver.vehiclePlate,
        record.route.originCity,
        record.route.destinationCity,
        record.route.destinationAddress,
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(needle);
}

function InfoTile({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    detail?: React.ReactNode;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3.5">
            <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-950">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
                    <div className="mt-1 break-words text-sm font-semibold text-zinc-950">{value}</div>
                    {detail ? <div className="mt-1 break-words text-xs leading-5 text-zinc-500">{detail}</div> : null}
                </div>
            </div>
        </div>
    );
}

function EvidenceActions({ record }: { record: WarehouseDigitalEvidenceRecord }) {
    const copyId = async () => {
        await navigator.clipboard.writeText(record.offer?.id || record.dispatch.id);
        toast.success('ID copiado');
    };

    return (
        <div className="no-print flex flex-wrap gap-2">
            {record.offer?.id ? (
                <Button asChild size="sm" variant="outline" leftIcon={<Route className="h-4 w-4" />}>
                    <Link href={`/viaje/${record.offer.id}`}>Ver viaje</Link>
                </Button>
            ) : null}
            <Button size="sm" variant="outline" leftIcon={<Copy className="h-4 w-4" />} onClick={copyId}>
                Copiar ID
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                Imprimir / guardar PDF
            </Button>
        </div>
    );
}

function TimelinePanel({ record }: { record: WarehouseDigitalEvidenceRecord }) {
    return (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {record.timeline.map((event) => (
                <div key={event.id} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3.5">
                    <div className="min-w-0">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">{STAGE_LABELS[event.stage]}</p>
                        <p className="mt-1 text-xs text-zinc-500">{event.timestamp ? formatDate(event.timestamp) : 'Pendiente'}</p>
                    </div>
                    <div className="mt-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words text-sm font-semibold text-zinc-950">{event.label}</p>
                            <WmsStatusBadge
                                label={event.status === 'complete' ? 'OK' : event.status === 'rejected' ? 'Rechazado' : event.status === 'warning' ? 'Novedad' : 'Pendiente'}
                                tone={event.status === 'complete' ? 'strong' : event.status === 'pending' ? 'muted' : 'critical'}
                            />
                        </div>
                        {event.detail ? <p className="mt-1 break-words text-sm leading-6 text-zinc-500">{event.detail}</p> : null}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ManifestPanel({ record }: { record: WarehouseDigitalEvidenceRecord }) {
    return (
        <div className="space-y-3">
            <WmsMetricGrid dense>
                <WmsMetric label="Esperado" value={record.manifestSummary.expected} />
                <WmsMetric label="Cargado" value={record.manifestSummary.loaded} />
                <WmsMetric label="Entregado" value={record.manifestSummary.delivered} />
                <WmsMetric label="Rechazado" value={record.manifestSummary.rejected} />
            </WmsMetricGrid>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {record.manifestSummary.items.map((item) => (
                    <div key={item.id} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3.5">
                        <div className="min-w-0">
                            <p className="break-words font-semibold text-zinc-950">{item.name}</p>
                            <p className="mt-1 text-xs text-zinc-500">{item.reference || 'Sin referencia'} / Esperado {item.expectedQty}</p>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-zinc-500">Cargado</p>
                                <p className="mt-1 font-money text-base font-semibold text-zinc-950">{item.loadedQty}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-zinc-500">Entrega</p>
                                <p className="mt-1 font-money text-base font-semibold text-zinc-950">{item.deliveredQty}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-zinc-500">Rechazo</p>
                                <p className="mt-1 font-money text-base font-semibold text-zinc-950">{item.rejectedQty}</p>
                            </div>
                        </div>
                        {item.rejectionReason ? <p className="mt-3 break-words text-sm leading-6 text-zinc-500">Motivo: {item.rejectionReason}</p> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PhotoGallery({ record }: { record: WarehouseDigitalEvidenceRecord }) {
    const groups = record.photos.reduce((map, photo) => {
        map.set(photo.stage, [...(map.get(photo.stage) || []), photo]);
        return map;
    }, new Map<WarehouseDigitalEvidenceStage, typeof record.photos>());

    if (!record.photos.length) {
        return <WmsEmptyState title="Sin fotos" description="Este expediente aun no tiene fotos operativas asociadas al viaje o al despacho." />;
    }

    return (
        <div className="space-y-4">
            {Array.from(groups.entries()).map(([stage, photos]) => (
                <div key={stage} className="space-y-2">
                    <p className="text-sm font-semibold text-zinc-950">{STAGE_LABELS[stage]}</p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {photos.map((photo) => (
                            <figure key={photo.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                <div className="aspect-[4/3] bg-zinc-100">
                                    <img src={photo.url} alt={photo.label} className="h-full w-full object-cover" />
                                </div>
                                <figcaption className="space-y-1 p-3 text-xs leading-5 text-zinc-500">
                                    <p className="font-semibold text-zinc-950">{photo.itemName || photo.label}</p>
                                    {photo.rejectionReason ? <p>Rechazo: {photo.rejectionReason}</p> : null}
                                    {photo.notes ? <p>{photo.notes}</p> : null}
                                    <p>{formatDate(photo.createdAt)}</p>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function SignaturesPanel({
    record,
    currentWarehouseId,
    capabilities,
    onSaveWarehouseSignature,
}: {
    record: WarehouseDigitalEvidenceRecord;
    currentWarehouseId: string;
    capabilities: WarehouseCapabilities | null;
    onSaveWarehouseSignature: (stage: string, payload: {
        signerName: string;
        signerDocumentId?: string;
        signerRole: 'warehouse_manager' | 'customer' | 'receiver' | 'other';
        file: File;
    }) => Promise<void>;
}) {
    const canCaptureStage = (stage: string) => (
        (stage === 'origin_warehouse_release' && record.originWarehouse?.id === currentWarehouseId && Boolean(capabilities?.manageDispatches))
        || (stage === 'destination_warehouse_receipt' && record.destinationWarehouse?.id === currentWarehouseId && Boolean(capabilities?.manageReceipts))
    );

    return (
        <div className="grid gap-3 md:grid-cols-2">
            {record.signatureRequirements.map((requirement, index) => (
                <div key={requirement.stage} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3.5">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-950">{index + 1}. {requirement.label}</p>
                                <WmsStatusBadge label={requirement.completed ? 'Firmado' : 'Pendiente'} tone={requirement.completed ? 'strong' : 'muted'} />
                            </div>
                            <p className="mt-1 break-words text-sm leading-6 text-zinc-500">
                                {requirement.captureSurface === 'warehouse_panel'
                                    ? 'Firma del rol de bodega en panel operativo.'
                                    : requirement.captureSurface === 'driver_app'
                                        ? 'Firma del conductor desde la app de viaje.'
                                        : 'Firma legacy del flujo actual.'}
                            </p>
                            {requirement.signature ? (
                                <p className="mt-2 break-words text-sm text-zinc-500">
                                    {requirement.signature.signerName || 'Sin nombre'} / {requirement.signature.signerDocumentId || 'Documento no registrado'} / {formatDate(requirement.signature.createdAt)}
                                </p>
                            ) : null}
                        </div>
                        <Signature className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                    </div>
                    {requirement.signature?.publicUrl ? (
                        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                            <img src={requirement.signature.publicUrl} alt="Firma registrada" className="h-32 w-full object-contain" />
                        </div>
                    ) : null}
                    {!requirement.completed && requirement.captureSurface === 'warehouse_panel' && canCaptureStage(requirement.stage) ? (
                        <div className="mt-3">
                            <TripSignatureCapture
                                title={`Capturar ${requirement.label}`}
                                subtitle="Firma digital de custodia tomada desde el panel de bodega."
                                signerRole={requirement.signerRole}
                                requireDocumentId
                                onSave={(payload) => onSaveWarehouseSignature(requirement.stage, payload)}
                            />
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

function TrackingPanel({ record }: { record: WarehouseDigitalEvidenceRecord }) {
    const latest = record.tracking.latestPing;

    return (
        <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
                <InfoTile icon={MapPin} label="Llegada origen" value={formatDate(record.timestamps.arrivedOriginAt)} detail={record.timestamps.pickupVerifiedAt ? 'PIN salida verificado' : 'PIN salida pendiente'} />
                <InfoTile icon={Navigation} label="Llegada destino" value={formatDate(record.timestamps.arrivedDestinationAt)} detail={record.timestamps.deliveryVerifiedAt ? 'PIN entrega verificado' : 'PIN entrega pendiente'} />
                <InfoTile icon={Wifi} label="Tracking" value={`${record.tracking.sessionCount} sesiones`} detail={record.tracking.active ? 'Sesion activa' : 'Sin sesion activa'} />
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-950">
                        <Navigation className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-950">Ultima ubicacion</p>
                        {latest ? (
                            <p className="mt-1 break-words text-sm leading-6 text-zinc-500">
                                {latest.latitude}, {latest.longitude} / precision {latest.accuracyMeters || '-'} m / {formatDate(latest.capturedAt)}
                            </p>
                        ) : (
                            <p className="mt-1 text-sm text-zinc-500">Sin pings GPS registrados.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function EvidenceDetail({
    record,
    currentWarehouseId,
    capabilities,
    onSaveWarehouseSignature,
}: {
    record: WarehouseDigitalEvidenceRecord;
    currentWarehouseId: string;
    capabilities: WarehouseCapabilities | null;
    onSaveWarehouseSignature: (stage: string, payload: {
        signerName: string;
        signerDocumentId?: string;
        signerRole: 'warehouse_manager' | 'customer' | 'receiver' | 'other';
        file: File;
    }) => Promise<void>;
}) {
    const meta = STATUS_META[record.status];
    const StatusIcon = meta.icon;

    return (
        <section className="print-area min-w-0 space-y-5 border-t border-zinc-200 pt-5 first:border-t-0 first:pt-0">
            <div className="rounded-lg border border-zinc-950 bg-zinc-950 p-4 text-white sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/70">
                                Expediente digital
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/70">
                                <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                {meta.label}
                            </span>
                            <span className="rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/70">
                                {record.destinationType === 'warehouse' ? 'Bodega a bodega' : 'Cliente final'}
                            </span>
                        </div>
                        <h2 className="mt-3 break-words text-xl font-semibold leading-tight sm:text-2xl">{record.dispatch.number}</h2>
                        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-white/68">
                            {record.route.originAddress || record.route.originCity || 'Origen'} a {record.route.destinationAddress || record.route.destinationCity || 'Destino pendiente'}
                        </p>
                    </div>
                    <EvidenceActions record={record} />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoTile icon={Truck} label="Conductor" value={record.driver.name || 'Pendiente'} detail={[record.driver.vehiclePlate ? `Placa ${record.driver.vehiclePlate}` : null, record.driver.internalDriverId ? `ID ${record.driver.internalDriverId}` : null].filter(Boolean).join(' / ') || 'Sin placa registrada'} />
                <InfoTile icon={FileText} label="Creacion" value={formatDate(record.timestamps.createdAt)} detail={record.offer?.id ? `Viaje ${record.offer.id.slice(0, 8)}` : 'Despacho sin viaje enlazado'} />
                <InfoTile icon={Fingerprint} label="PIN / firmas" value={`${record.signatures.length} firmas`} detail={`${record.offer?.pickupVerified ? 'Salida OK' : 'Salida pendiente'} / ${record.offer?.deliveryVerified ? 'Entrega OK' : 'Entrega pendiente'}`} />
                <InfoTile icon={Camera} label="Fotos" value={record.manifestSummary.photoCount} detail={record.manifestSummary.hasMissingEvidence ? 'Con faltantes de evidencia' : 'Evidencia completa o en progreso'} />
            </div>

            {record.destinationType === 'warehouse' ? (
                <div className="grid gap-3 md:grid-cols-3">
                    <InfoTile icon={PackageCheck} label="Bodega origen" value={record.originWarehouse?.name || 'Origen'} detail={record.originWarehouse ? `${record.originWarehouse.city}, ${record.originWarehouse.department}` : undefined} />
                    <InfoTile icon={PackageCheck} label="Bodega destino" value={record.destinationWarehouse?.name || 'Destino'} detail={record.destinationWarehouse ? `${record.destinationWarehouse.city}, ${record.destinationWarehouse.department}` : undefined} />
                    <InfoTile icon={ClipboardCheck} label="Recepcion destino" value={record.transferReceipt?.number || 'Pendiente'} detail={record.transferReceipt ? `Estado ${record.transferReceipt.status}` : 'No creada'} />
                </div>
            ) : null}

            {record.rejection.rejected ? (
                <div className="rounded-lg border border-zinc-950 bg-white p-3.5">
                    <div className="flex items-start gap-3">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-950" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-950">Rechazo registrado</p>
                            <p className="mt-1 break-words text-sm leading-6 text-zinc-500">
                                {record.rejection.reason || 'Sin motivo escrito'} / {formatDate(record.rejection.rejectedAt)} / {record.rejection.rejectedBy || record.driver.name || 'Conductor'}
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}

            <SectionCard title="Linea de custodia" description="Eventos de orden, asignacion, origen, carga, PIN, seguimiento, destino, entrega y cierre.">
                <TimelinePanel record={record} />
            </SectionCard>

            <SectionCard title="Manifiesto" description="Comparativo esperado, cargado, entregado y rechazado por item.">
                <ManifestPanel record={record} />
            </SectionCard>

            <SectionCard
                title="Firmas"
                description={record.destinationType === 'warehouse'
                    ? 'Cuatro puntos de custodia: bodeguero origen, conductor origen, conductor destino y bodeguero destino.'
                    : 'Firmas del flujo a cliente final: origen y receptor/POD.'}
            >
                <SignaturesPanel record={record} currentWarehouseId={currentWarehouseId} capabilities={capabilities} onSaveWarehouseSignature={onSaveWarehouseSignature} />
            </SectionCard>

            <SectionCard title="GPS y tracking" description="Llegadas, precision, ultima ubicacion y sesiones asociadas al viaje.">
                <TrackingPanel record={record} />
            </SectionCard>

            <SectionCard title="Fotos" description="Evidencia visual agrupada por carga, rechazo, entrega y novedades.">
                <PhotoGallery record={record} />
            </SectionCard>
        </section>
    );
}

export default function WarehouseDigitalEvidencePage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;
    const [records, setRecords] = React.useState<WarehouseDigitalEvidenceRecord[]>([]);
    const [filter, setFilter] = React.useState<EvidenceFilter>('all');
    const [query, setQuery] = React.useState('');
    const [loadingEvidence, setLoadingEvidence] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadEvidence = React.useCallback(async () => {
        setLoadingEvidence(true);
        setError(null);
        try {
            const response = await warehouseClient.listDigitalEvidence(warehouseId);
            const nextRecords = response.data || [];
            setRecords(nextRecords);
        } catch (loadError) {
            const message = loadError instanceof Error ? mapWarehouseErrorMessage(loadError.message) : 'No se pudo cargar la evidencia digital';
            setError(message);
            toast.error('Error', message);
        } finally {
            setLoadingEvidence(false);
        }
    }, [warehouseId]);

    React.useEffect(() => {
        if (warehouseId) {
            void loadEvidence();
        }
    }, [loadEvidence, warehouseId]);

    const saveWarehouseSignature = React.useCallback(async (record: WarehouseDigitalEvidenceRecord, stage: string, payload: {
        signerName: string;
        signerDocumentId?: string;
        signerRole: 'warehouse_manager' | 'customer' | 'receiver' | 'other';
        file: File;
    }) => {
        if (!record.offer?.id) {
            throw new Error('Este expediente no tiene viaje enlazado para guardar firma.');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error('No hay sesion activa.');
        }

        const formData = new FormData();
        formData.append('offerId', record.offer.id);
        formData.append('signatureStage', stage);
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
            throw new Error(result?.error?.message || result?.error || 'No se pudo guardar la firma.');
        }

        toast.success('Firma guardada', 'La firma de custodia quedo asociada al expediente digital.');
        await loadEvidence();
    }, [loadEvidence]);

    const filteredRecords = React.useMemo(
        () => records.filter((record) => filterRecord(record, filter, query)),
        [filter, query, records]
    );
    const completed = records.filter((record) => record.status === 'completed').length;
    const rejected = records.filter((record) => record.rejection.rejected || record.status === 'rejected').length;
    const missing = records.filter((record) => record.manifestSummary.hasMissingEvidence).length;
    const noSignature = records.filter((record) => Boolean(record.offer) && record.signatures.length === 0).length;

    return (
        <DashboardLayout pageTitle="Evidencia Digital">
            <style jsx global>{`
                @media print {
                    .no-print,
                    .wms-workspace > div:nth-child(2) {
                        display: none !important;
                    }
                    body {
                        background: #fff !important;
                    }
                    .print-area {
                        color: #111827;
                    }
                }
            `}</style>
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="digitalEvidence"
                renderSection={({ capabilities }) => {
                    if (!capabilities?.viewEvidence) {
                        return (
                            <SectionCard title="Evidencia Digital" description="Este rol no tiene permiso viewEvidence para consultar expedientes digitales.">
                                <WmsEmptyState
                                    title="Acceso restringido"
                                    description="La API responde 403 para este permiso y la seccion no expone evidencia util sin autorizacion."
                                />
                            </SectionCard>
                        );
                    }

                    return (
                        <div className="space-y-5">
                            <SectionCard
                                title="Evidencia Digital"
                                description="Expediente completo de cada despacho y viaje: ruta, conductor, firmas, PIN verificado, GPS, fotos, rechazos y manifiesto."
                            >
                                <div className="space-y-4">
                                    <WmsMetricGrid dense>
                                        <WmsMetric label="Expedientes" value={records.length} detail="Despachos consolidados" />
                                        <WmsMetric label="Completos" value={completed} detail="Viaje cerrado" />
                                        <WmsMetric label="Rechazos" value={rejected} detail="Viaje o carga" />
                                        <WmsMetric label="Sin firma" value={noSignature} detail={`${missing} con faltantes`} />
                                    </WmsMetricGrid>

                                    <div className="no-print grid gap-3 rounded-lg border border-zinc-200 bg-white p-3.5 lg:grid-cols-[1fr_auto]">
                                        <Input
                                            label="Buscar expediente"
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            leftIcon={<Search className="h-4 w-4" />}
                                            placeholder="Despacho, conductor, placa, ciudad o viaje"
                                        />
                                        <div className="flex flex-wrap items-end gap-2">
                                            {FILTERS.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setFilter(item.id)}
                                                    className={cn(
                                                        'min-h-11 rounded-lg border px-3 text-sm font-semibold transition',
                                                        filter === item.id
                                                            ? 'border-zinc-950 bg-zinc-950 text-white'
                                                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-950 hover:text-zinc-950'
                                                    )}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                            <Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadEvidence} isLoading={loadingEvidence}>
                                                Actualizar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </SectionCard>

                            {loadingEvidence ? (
                                <div className="flex min-h-[18rem] items-center justify-center rounded-lg border border-zinc-200 bg-white">
                                    <Loader2 className="h-7 w-7 animate-spin text-zinc-950" aria-hidden="true" />
                                </div>
                            ) : error ? (
                                <WmsEmptyState title="No se pudo cargar evidencia" description={error} />
                            ) : !filteredRecords.length ? (
                                <WmsEmptyState title="Sin expedientes" description="No hay despachos que coincidan con los filtros actuales." />
                            ) : (
                                <div className="space-y-7">
                                    {filteredRecords.map((record) => (
                                        <EvidenceDetail
                                            key={record.id}
                                            record={record}
                                            currentWarehouseId={warehouseId}
                                            capabilities={capabilities}
                                            onSaveWarehouseSignature={(stage, payload) => saveWarehouseSignature(record, stage, payload)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
