'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangle,
    ArrowLeft,
    Camera,
    Calendar,
    Check,
    ChevronLeft,
    ChevronRight,
    Circle,
    Clock,
    Copy,
    FileText,
    ImageIcon,
    MapPin,
    Maximize2,
    Navigation,
    Package,
    ShieldCheck,
    Truck,
    X,
    XCircle,
} from 'lucide-react';

import { Card } from '@/components/ui';
import { formatCOP } from '@/constants/colombia';
import type {
    InspectionItemStatus,
    InspectionManifestItem,
    InspectionPhoto,
    InspectionReport,
    InspectionStatus,
    InspectionSummary,
    InspectionTimelineEvent,
} from '@/lib/inspections';
import { formatInspectionDate, formatRelativeTime, getInitials } from '@/lib/inspections';
import { cn } from '@/lib/utils';

const EVENT_ICONS: Record<string, React.ElementType> = {
    arrival_origin: MapPin,
    loading_started: Package,
    item_loaded: Check,
    item_load_issue: AlertTriangle,
    loading_completed: ShieldCheck,
    pickup_verified: ShieldCheck,
    arrival_destination: MapPin,
    unloading_started: Package,
    item_delivered: Check,
    item_rejected: XCircle,
    unloading_completed: ShieldCheck,
    delivery_verified: ShieldCheck,
    photo_added: Camera,
};

const ITEM_STATUS_LABELS: Record<InspectionItemStatus, string> = {
    pending: 'Pendiente',
    loaded: 'Cargado',
    issue: 'Con novedad',
    delivered: 'Entregado',
    partial: 'Parcial',
    rejected: 'Rechazado',
};

const REPORT_STATUS_LABELS: Record<InspectionStatus, string> = {
    pending: 'Pendiente',
    in_progress: 'En proceso',
    loading: 'En ruta',
    delivery: 'Entrega',
    completed: 'Completada',
    cancelled: 'Cancelada',
};

function statusLabel(status: InspectionItemStatus) {
    return ITEM_STATUS_LABELS[status] || status;
}

function StatusBadge({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold',
            strong ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-700'
        )}>
            {children}
        </span>
    );
}

function getPhotoStageLabel(photo: InspectionPhoto) {
    const stage = photo.stage || photo.type;
    if (stage === 'loading') return 'Carga';
    if (stage === 'unloading') return 'Entrega';
    if (stage === 'issue') return 'Novedad';
    return 'General';
}

function shortRef(value: string) {
    return value.slice(0, 8).toUpperCase();
}

export function MetricCard({ icon: Icon, label, value, sub }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color?: string;
    bg?: string;
}) {
    return (
        <Card className="border-zinc-200 bg-white p-4">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                    <Icon className="h-5 w-5 text-zinc-700" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                    <p className="mt-0.5 font-money text-2xl font-semibold text-zinc-950">{value}</p>
                    {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
                </div>
            </div>
        </Card>
    );
}

export function SummarySection({ summary, t }: { summary: InspectionSummary; t: (k: string) => string }) {
    return (
        <div className="kx-trip-metrics grid gap-3">
            <MetricCard icon={Package} label={t('inspection.summary.totalItems')} value={summary.totalItems} />
            <MetricCard icon={Check} label={t('inspection.summary.loadedItems')} value={summary.loadedItems} sub={`${summary.loadingCompliancePercent}% cargue`} />
            <MetricCard icon={AlertTriangle} label={t('inspection.summary.loadIssueItems')} value={summary.loadIssueItems} />
            <MetricCard
                icon={XCircle}
                label={t('inspection.summary.rejectedItems')}
                value={summary.rejectedItems}
                sub={summary.rejectedItemCount > 0 ? `${summary.rejectedItemCount} item${summary.rejectedItemCount > 1 ? 's' : ''} afectado${summary.rejectedItemCount > 1 ? 's' : ''}` : undefined}
            />
            <MetricCard icon={Camera} label={t('inspection.summary.totalPhotos')} value={summary.totalPhotos} />
        </div>
    );
}

function TimelineEventCard({ event, isLast, t, locale }: {
    event: InspectionTimelineEvent;
    isLast: boolean;
    t: (k: string) => string;
    locale: string;
}) {
    const Icon = EVENT_ICONS[event.eventType] || Circle;
    const label = t(`inspection.timeline.events.${event.eventType}`) || event.eventType;

    return (
        <div className="relative flex gap-3 min-[380px]:gap-4">
            {!isLast ? <div className="absolute bottom-0 left-[19px] top-10 w-px bg-zinc-200" /> : null}
            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-sm">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 pb-5">
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-950">{label}</p>
                            {event.manifestItemName ? (
                                <p className="mt-0.5 text-sm text-zinc-600">
                                    {event.manifestItemName}{event.quantity ? ` (x${event.quantity})` : ''}
                                </p>
                            ) : null}
                            {event.itemStatus ? (
                                <div className="mt-2">
                                    <StatusBadge strong={event.itemStatus === 'rejected'}>
                                        {statusLabel(event.itemStatus)}
                                    </StatusBadge>
                                </div>
                            ) : null}
                            {event.notes ? <p className="mt-2 text-sm text-zinc-600">{event.notes}</p> : null}
                            {event.rejectionReason ? (
                                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                                    Motivo: {t(`inspection.rejectionReasons.${event.rejectionReason}`)}
                                </p>
                            ) : null}
                        </div>
                        <div className="shrink-0 text-left min-[640px]:text-right">
                            <p className="text-xs text-zinc-500">{formatRelativeTime(event.timestamp, locale)}</p>
                            <p className="mt-0.5 font-money text-xs text-zinc-500">{formatInspectionDate(event.timestamp, locale)}</p>
                        </div>
                    </div>
                    {event.photoUrls.length > 0 ? (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {event.photoUrls.map((url, idx) => (
                                <div key={`${event.id}-photo-${idx}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                                    <img src={url} alt={`Evidencia ${idx + 1}`} className="h-full w-full object-cover" loading="lazy" />
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {event.location ? (
                        <div className="mt-2 flex min-w-0 items-center gap-1 font-money text-xs text-zinc-500">
                            <Navigation className="h-3 w-3" />
                            <span>{event.location.latitude.toFixed(6)}, {event.location.longitude.toFixed(6)}</span>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export function TimelineSection({ timeline, t, locale }: {
    timeline: InspectionTimelineEvent[];
    t: (k: string) => string;
    locale: string;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const visible = expanded ? timeline : timeline.slice(0, 8);

    return (
        <Card className="kx-trip-panel border-zinc-200 bg-white p-4 min-[380px]:p-5 sm:p-6">
            <h2 className="mb-6 flex flex-wrap items-center gap-2 text-lg font-semibold text-zinc-950">
                <Clock className="h-5 w-5 text-zinc-800" />
                Cadena de custodia
                <span className="ml-auto font-money text-sm font-normal text-zinc-500">{timeline.length} eventos</span>
            </h2>
            {timeline.length ? (
                <div>
                    {visible.map((event, index) => (
                        <TimelineEventCard
                            key={event.id}
                            event={event}
                            isLast={index === visible.length - 1 && visible.length === timeline.length}
                            t={t}
                            locale={locale}
                        />
                    ))}
                </div>
            ) : (
                <div className="py-8 text-center">
                    <Clock className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
                    <p className="text-zinc-500">{t('inspection.timeline.emptyTitle')}</p>
                </div>
            )}
            {timeline.length > 8 ? (
                <button
                    onClick={() => setExpanded((current) => !current)}
                    className="mt-3 w-full rounded-lg border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-800 transition hover:border-zinc-950"
                >
                    {expanded ? 'Mostrar menos' : `Ver ${timeline.length - 8} mas`}
                </button>
            ) : null}
        </Card>
    );
}

function ItemBadge({ status, isRejectedInLoad = false }: { status: InspectionItemStatus; isRejectedInLoad?: boolean }) {
    if (isRejectedInLoad) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
                Rechazado en carga
            </span>
        );
    }

    return (
        <StatusBadge strong={status === 'rejected'}>
            {statusLabel(status)}
        </StatusBadge>
    );
}

export function ManifestSection({ items, t, onViewPhotos }: {
    items: InspectionManifestItem[];
    t: (k: string) => string;
    locale: string;
    onViewPhotos: (p: string[]) => void;
}) {
    return (
        <Card className="kx-trip-panel border-zinc-200 bg-white p-4 min-[380px]:p-5 sm:p-6">
            <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold text-zinc-950">
                <FileText className="h-5 w-5 text-zinc-800" />
                {t('inspection.manifest.title')}
                <span className="ml-auto font-money text-sm font-normal text-zinc-500">{items.length} items</span>
            </h2>
            {items.length ? (
                <div className="space-y-3">
                    {items.map((item) => {
                        const allPhotos = [...item.loadPhotos, ...item.deliveryPhotos];
                        const loadedValue = item.isRejectedInLoad ? 0 : item.loadedQuantity ?? '-';
                        const deliveredValue = item.isRejectedInLoad ? '-' : item.deliveredQuantity ?? '-';
                        const rejectedValue = item.rejectedUnits > 0 ? item.rejectedUnits : '-';
                        return (
                            <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 min-[380px]:p-4">
                                <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-center">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-zinc-500" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="break-words font-semibold text-zinc-950">{item.name}</p>
                                        {item.reference ? <p className="font-money text-xs text-zinc-500">REF: {item.reference}</p> : null}
                                    </div>
                                    <ItemBadge status={item.status} isRejectedInLoad={item.isRejectedInLoad} />
                                </div>
                                <div className="kx-trip-metrics mt-3 grid gap-3">
                                    {[
                                        ['Esperado', item.expectedQuantity || '-'],
                                        ['Cargado', loadedValue],
                                        ['Entregado', deliveredValue],
                                        ['Rechazado', rejectedValue],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-lg border border-zinc-200 bg-white p-2 text-center">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                                            <p className="font-money text-lg font-semibold text-zinc-950">{value}</p>
                                        </div>
                                    ))}
                                </div>
                                {item.rejectionReason || item.loadNotes || item.deliveryNotes || item.isRejectedInLoad ? (
                                    <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
                                        {item.isRejectedInLoad ? <p className="font-semibold text-red-800">Rechazo en carga: {item.loadRejectionReason || item.loadNotes || 'Item rechazado en origen'}</p> : null}
                                        {item.rejectionReason ? <p className="font-semibold text-zinc-950">Motivo: {t(`inspection.rejectionReasons.${item.rejectionReason}`)}</p> : null}
                                        {item.loadNotes && !item.isRejectedInLoad ? <p className="mt-1">Carga: {item.loadNotes}</p> : null}
                                        {item.deliveryNotes ? <p className="mt-1">Entrega: {item.deliveryNotes}</p> : null}
                                    </div>
                                ) : null}
                                {allPhotos.length > 0 ? (
                                    <button
                                        onClick={() => onViewPhotos(allPhotos)}
                                        className="mt-3 inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:border-zinc-950"
                                    >
                                        <Camera className="h-3.5 w-3.5" />
                                        {allPhotos.length} foto{allPhotos.length > 1 ? 's' : ''}
                                    </button>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-8 text-center">
                    <Package className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
                    <p className="text-zinc-500">{t('inspection.manifest.emptyTitle')}</p>
                </div>
            )}
        </Card>
    );
}

function PhotoMetadata({ photo, locale }: { photo: InspectionPhoto; locale: string }) {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <StatusBadge>{getPhotoStageLabel(photo)}</StatusBadge>
                {photo.itemStatus ? <StatusBadge strong={photo.itemStatus === 'rejected'}>{statusLabel(photo.itemStatus)}</StatusBadge> : null}
                {photo.hasIssue ? <StatusBadge>Novedad</StatusBadge> : null}
                {photo.isRejected ? <StatusBadge strong>Rechazo</StatusBadge> : null}
            </div>
            <div className="grid gap-3 text-sm text-white/90 sm:grid-cols-2">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Item</p>
                    <p>{photo.manifestItemName || 'Evidencia general'}</p>
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Cantidad</p>
                    <p>{photo.quantity ?? '-'}</p>
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Fecha</p>
                    <p>{formatInspectionDate(photo.timestamp, locale)}</p>
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Motivo</p>
                    <p>{photo.rejectionReason || (photo.hasIssue ? 'Novedad operativa' : '-')}</p>
                </div>
            </div>
            {photo.notes ? <p className="text-sm text-white/90">{photo.notes}</p> : null}
        </div>
    );
}

export function PhotoModal({ photos, initialIndex, onClose, locale }: {
    photos: InspectionPhoto[];
    initialIndex: number;
    onClose: () => void;
    locale: string;
}) {
    const [index, setIndex] = React.useState(initialIndex);
    const photo = photos[index];

    React.useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowLeft') setIndex((current) => (current > 0 ? current - 1 : photos.length - 1));
            if (event.key === 'ArrowRight') setIndex((current) => (current < photos.length - 1 ? current + 1 : 0));
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, photos.length]);

    if (!photo) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 min-[380px]:p-4" onClick={onClose}>
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg border border-white/15 bg-white/10 p-2 text-white hover:bg-white/20">
                <X className="h-6 w-6" />
            </button>
            <div className="absolute left-4 top-4 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 font-money text-sm text-white">
                {index + 1} / {photos.length}
            </div>
            {photos.length > 1 ? (
                <>
                    <button onClick={(event) => { event.stopPropagation(); setIndex((current) => (current > 0 ? current - 1 : photos.length - 1)); }} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-white/10 p-3 text-white hover:bg-white/20">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button onClick={(event) => { event.stopPropagation(); setIndex((current) => (current < photos.length - 1 ? current + 1 : 0)); }} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-white/10 p-3 text-white hover:bg-white/20">
                        <ChevronRight className="h-6 w-6" />
                    </button>
                </>
            ) : null}
            <div className="flex max-h-[62svh] w-full max-w-4xl items-center justify-center sm:max-h-[76vh]" onClick={(event) => event.stopPropagation()}>
                <img src={photo.url} alt={photo.notes || photo.manifestItemName || 'Evidencia'} className="max-h-[58svh] max-w-full rounded-lg object-contain sm:max-h-[72vh]" />
            </div>
            <div className="absolute bottom-3 left-3 right-3 mx-auto max-h-[30svh] max-w-2xl overflow-y-auto rounded-lg border border-white/15 bg-white/10 p-3 text-white backdrop-blur-md min-[380px]:bottom-4 min-[380px]:left-4 min-[380px]:right-4 min-[380px]:p-4 sm:max-h-[24vh]">
                <PhotoMetadata photo={photo} locale={locale} />
            </div>
        </motion.div>
    );
}

export function PhotoGallery({ photos, locale }: { photos: InspectionPhoto[]; locale: string }) {
    const [selected, setSelected] = React.useState<number | null>(null);
    const sections = React.useMemo(() => ([
        { key: 'loading', label: 'Carga', items: photos.filter((photo) => (photo.stage || photo.type) === 'loading') },
        { key: 'unloading', label: 'Entrega', items: photos.filter((photo) => (photo.stage || photo.type) === 'unloading') },
        { key: 'issue', label: 'Novedades', items: photos.filter((photo) => photo.hasIssue || photo.isRejected || photo.type === 'issue') },
        { key: 'general', label: 'Generales', items: photos.filter((photo) => !['loading', 'unloading', 'issue'].includes(photo.stage || photo.type)) },
    ].filter((section) => section.items.length > 0)), [photos]);

    return (
        <>
            <Card className="kx-trip-panel border-zinc-200 bg-white p-4 min-[380px]:p-5 sm:p-6">
                <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold text-zinc-950">
                    <Camera className="h-5 w-5 text-zinc-800" />
                    Evidencia fotografica
                    <span className="ml-auto font-money text-sm font-normal text-zinc-500">{photos.length} fotos</span>
                </h2>
                {photos.length ? (
                    <div className="space-y-6">
                        {sections.map((section) => (
                            <div key={section.key} className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{section.label}</h3>
                                    <span className="font-money text-xs text-zinc-500">{section.items.length} evidencia{section.items.length === 1 ? '' : 's'}</span>
                                </div>
                                <div className="kx-trip-photo-grid grid gap-4">
                                    {section.items.map((photo) => {
                                        const photoIndex = photos.findIndex((candidate) => candidate.id === photo.id);
                                        return (
                                            <motion.button
                                                key={photo.id}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                onClick={() => setSelected(photoIndex)}
                                                className="overflow-hidden rounded-lg border border-zinc-200 bg-white text-left transition-all hover:border-zinc-950 hover:shadow-[0_24px_60px_-48px_rgba(10,10,10,.65)]"
                                            >
                                                <div className="relative aspect-[4/3] bg-zinc-100">
                                                    <img src={photo.url} alt={photo.notes || photo.manifestItemName || 'Evidencia'} className="h-full w-full object-cover" loading="lazy" />
                                                    <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                                                        {getPhotoStageLabel(photo)}
                                                    </span>
                                                    <div className="absolute bottom-3 right-3 rounded-md bg-black/70 p-2 text-white">
                                                        <Maximize2 className="h-4 w-4" />
                                                    </div>
                                                </div>
                                                <div className="space-y-3 p-4">
                                                    <div>
                                                        <p className="text-sm font-semibold text-zinc-950">{photo.manifestItemName || 'Evidencia general'}</p>
                                                        <p className="mt-1 font-money text-xs text-zinc-500">{formatInspectionDate(photo.timestamp, locale)}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {photo.itemStatus ? <StatusBadge strong={photo.itemStatus === 'rejected'}>{statusLabel(photo.itemStatus)}</StatusBadge> : null}
                                                        {photo.hasIssue ? <StatusBadge>Novedad</StatusBadge> : null}
                                                        {photo.isRejected ? <StatusBadge strong>Rechazado</StatusBadge> : null}
                                                    </div>
                                                    {photo.notes ? <p className="line-clamp-2 text-sm text-zinc-600">{photo.notes}</p> : null}
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center">
                        <ImageIcon className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
                        <p className="text-zinc-500">Sin fotos de evidencia</p>
                    </div>
                )}
            </Card>
            <AnimatePresence>
                {selected !== null ? <PhotoModal photos={photos} initialIndex={selected} onClose={() => setSelected(null)} locale={locale} /> : null}
            </AnimatePresence>
        </>
    );
}

export function ReportHeader({ report, t, locale, onBack }: {
    report: InspectionReport;
    t: (k: string) => string;
    locale: string;
    onBack: () => void;
}) {
    const route = `${report.route.originCity} -> ${report.route.destinationCity}`;

    const copyRef = async () => {
        await navigator.clipboard?.writeText(report.offerId).catch(() => null);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="kx-trip-panel luxury-panel rounded-lg border border-white/10 p-4 text-white shadow-[0_28px_80px_-58px_rgba(0,0,0,.9)] min-[380px]:p-5 sm:p-6">
            <div className="mb-7 flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
                <div>
                    <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-white/65 transition-colors hover:text-white">
                        <ArrowLeft className="h-4 w-4" />
                        {t('inspection.backToList')}
                    </button>
                    <div className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Expediente de viaje
                    </div>
                    <h1 className="kx-route-title mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">{route}</h1>
                    <p className="mt-2 text-sm text-white/60">Evidencia de cargue, ruta y entrega.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <StatusBadge>{REPORT_STATUS_LABELS[report.status]}</StatusBadge>
                    <button onClick={() => void copyRef()} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/12">
                        <Copy className="h-3.5 w-3.5" />
                        {shortRef(report.offerId)}
                    </button>
                </div>
            </div>

            <div className="kx-responsive-grid-sm grid gap-3">
                {[
                    { icon: MapPin, label: t('inspection.header.route'), value: route },
                    { icon: Truck, label: t('inspection.header.trucker'), value: report.trucker.fullName, avatar: true },
                    { icon: Calendar, label: t('inspection.header.createdAt'), value: formatInspectionDate(report.createdAt, locale) },
                    { icon: FileText, label: t('inspection.header.totalAmount'), value: formatCOP(report.totalAmount) },
                ].map((item, index) => {
                    const Icon = item.icon;

                    return (
                        <div key={index} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/8 p-3">
                            {item.avatar ? (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-sm font-semibold text-white">
                                    {getInitials(report.trucker.fullName)}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-white/15 bg-white/10 p-2">
                                    <Icon className="h-5 w-5 text-white/70" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-xs text-white/50">{item.label}</p>
                                <p className="break-words text-sm font-semibold text-white">{item.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
