/**
 * =============================================================================
 * KARGAX - PICKING CHECKLIST COMPONENT
 * /components/picking/PickingChecklist.tsx
 * 
 * Componente de checklist premium para el sistema de picking digital.
 * Soporta tanto carga (origen) como entrega (destino).
 * 
 * FEATURES:
 * - Vista de lista con items expandibles
 * - Estado visual por item (pending, loaded, delivered, rejected)
 * - Soporte para fotos de evidencia
 * - Animaciones suaves con Framer Motion
 * - Indicadores de progreso
 * - Totalmente responsivo
 * 
 * DISEÑO:
 * - Usa colores Colombian Gold del tema
 * - Glass effects para cards premium
 * - Micro-animaciones para feedback
 * 
 * =============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package,
    Check,
    X,
    AlertTriangle,
    Camera,
    ChevronDown,
    ChevronUp,
    ImagePlus,
    Minus,
    Plus,
    Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, toast } from '@/components/ui';
import type {
    ManifestItem,
    RejectionReason,
    ManifestItemStatus,
} from '@/lib/picking/types';
import { REJECTION_REASON_LABELS } from '@/lib/picking/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Modo del checklist
 * - loading: Para carga en origen
 * - delivery: Para entrega en destino
 */
export type ChecklistMode = 'loading' | 'delivery';

/**
 * Props del componente PickingChecklist
 */
export interface PickingChecklistProps {
    /** Items del manifiesto a mostrar */
    items: ManifestItem[];

    /** Modo: carga o entrega */
    mode: ChecklistMode;

    /** Si el checklist está bloqueado (ya verificado con PIN) */
    isLocked?: boolean;

    /** Si está procesando una acción */
    isProcessing?: boolean;

    /** Callback cuando se marca un item como cargado */
    onItemLoaded?: (
        item: ManifestItem,
        payload: {
            hasIssue: boolean;
            loadingDecision: 'loaded' | 'issue' | 'rejected';
            notes: string;
            photos: File[];
        }
    ) => Promise<void>;

    /** Callback cuando se marca un item como entregado/rechazado */
    onItemDelivered?: (
        item: ManifestItem,
        deliveredQty: number,
        rejectedQty: number,
        rejectionReason?: RejectionReason,
        notes?: string,
        photos?: File[]
    ) => Promise<void>;

    /** Callback para agregar foto de evidencia */
    onAddPhoto?: (itemId: string, files: File[]) => Promise<void>;

    /** Clase CSS adicional */
    className?: string;

    /** Namespace para persistir borradores locales por viaje/etapa */
    draftNamespace?: string;
}

/**
 * Estado interno de un item expandido
 */
interface ItemExpandedState {
    notes: string;
    hasIssue: boolean;
    loadingDecision: 'loaded' | 'issue' | 'rejected';
    photos: File[];
    deliveredQty: number;
    rejectedQty: number;
    rejectionReason: RejectionReason | '';
}

interface PersistedDraftPhoto {
    name: string;
    type: string;
    lastModified: number;
    dataUrl: string;
}

interface PersistedItemDraftState {
    notes: string;
    hasIssue: boolean;
    loadingDecision: 'loaded' | 'issue' | 'rejected';
    deliveredQty: number;
    rejectedQty: number;
    rejectionReason: RejectionReason | '';
    isExpanded: boolean;
    photos: PersistedDraftPhoto[];
}

function buildDraftStorageKey(namespace: string | undefined, itemId: string) {
    if (!namespace) return null;
    return `kargax:picking-draft:${namespace}:${itemId}`;
}

function removePersistedDraft(storageKey: string | null) {
    if (!storageKey || typeof window === 'undefined') return;
    window.localStorage.removeItem(storageKey);
}

function readPersistedDraft(storageKey: string | null): PersistedItemDraftState | null {
    if (!storageKey || typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        return JSON.parse(raw) as PersistedItemDraftState;
    } catch {
        return null;
    }
}

async function fileToDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function serializeDraftPhotos(files: File[]) {
    return await Promise.all(
        files.map(async (file) => ({
            name: file.name,
            type: file.type,
            lastModified: file.lastModified,
            dataUrl: await fileToDataUrl(file),
        }))
    );
}

async function deserializeDraftPhotos(photos: PersistedDraftPhoto[]) {
    return await Promise.all(
        photos.map(async (photo, index) => {
            const response = await fetch(photo.dataUrl);
            const blob = await response.blob();
            return new File([blob], photo.name || `draft-photo-${index + 1}.jpg`, {
                type: photo.type || blob.type || 'image/jpeg',
                lastModified: photo.lastModified || Date.now(),
            });
        })
    );
}

function hasLoadRejectionSignal(item: ManifestItem) {
    return item.loadStatus === 'rejected'
        || /rechaz/i.test(item.loadRejectionReason || '')
        || /rechaz/i.test(item.loadNotes || '')
        || (item.loadedQty === 0 && Boolean(item.loadedAt || item.loadRejectionReason));
}

function getLoadingItemStatus(item: ManifestItem): ManifestItemStatus {
    if (hasLoadRejectionSignal(item)) {
        return 'rejected';
    }

    if (item.loadStatus === 'issue' || item.hasIssue) {
        return 'issue';
    }

    if (item.loadedAt || item.loadStatus === 'loaded') {
        return 'loaded';
    }

    return 'pending';
}

function isLoadingItemProcessed(item: ManifestItem) {
    return getLoadingItemStatus(item) !== 'pending';
}

function getLoadedQuantity(item: ManifestItem) {
    if (item.loadedQty !== null && item.loadedQty !== undefined) {
        return Math.max(0, Number(item.loadedQty) || 0);
    }

    return Math.max(0, Number(item.quantity) || 0);
}

function getDeliverableQuantity(item: ManifestItem) {
    if (hasLoadRejectionSignal(item)) {
        return 0;
    }

    return getLoadedQuantity(item);
}

function isLoadRejectedForDelivery(item: ManifestItem) {
    return hasLoadRejectionSignal(item) || getDeliverableQuantity(item) === 0;
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

/**
 * Indicador de estado del item
 */
function StatusBadge({ status, mode }: { status?: ManifestItemStatus; mode: ChecklistMode }) {
    // Determinar estado efectivo
    const effectiveStatus = mode === 'loading'
        ? (status === 'loaded' || status === 'issue' || status === 'rejected' ? status : 'pending')
        : status || 'pending';

    const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
        pending: {
            icon: <Package className="w-3.5 h-3.5" />,
            label: 'Pendiente',
            className: 'bg-zinc-50 text-zinc-600 border-zinc-200',
        },
        loaded: {
            icon: <Check className="w-3.5 h-3.5" />,
            label: 'Cargado',
            className: 'bg-white text-zinc-950 border-zinc-950',
        },
        issue: {
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            label: 'Con novedad',
            className: 'bg-white text-zinc-950 border-zinc-300',
        },
        delivered: {
            icon: <Check className="w-3.5 h-3.5" />,
            label: 'Entregado',
            className: 'bg-white text-zinc-950 border-zinc-950',
        },
        partial: {
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            label: 'Parcial',
            className: 'bg-white text-zinc-950 border-zinc-300',
        },
        rejected: {
            icon: <X className="w-3.5 h-3.5" />,
            label: 'Rechazado',
            className: 'bg-zinc-950 text-white border-zinc-950',
        },
    };

    const { icon, label, className } = config[effectiveStatus] || config.pending;

    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
            className
        )}>
            {icon}
            {label}
        </span>
    );
}

/**
 * Contador con botones +/-
 */
function QuantityCounter({
    value,
    max,
    onChange,
    label,
    disabled,
    variant = 'default',
}: {
    value: number;
    max: number;
    onChange: (value: number) => void;
    label: string;
    disabled?: boolean;
    variant?: 'default' | 'danger';
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 min-[380px]:gap-3">
            <span className={cn(
                'text-sm font-medium',
                variant === 'danger' ? 'text-zinc-950' : 'text-zinc-700'
            )}>
                {label}:
            </span>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(0, value - 1))}
                    disabled={disabled || value <= 0}
                    className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                        'border border-zinc-200 hover:border-zinc-950',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'hover:bg-zinc-50'
                    )}
                >
                    <Minus className="w-4 h-4" />
                </button>
                <span className={cn(
                    'w-12 text-center font-semibold text-lg',
                    variant === 'danger' ? 'text-zinc-950' : 'text-zinc-900'
                )}>
                    {value}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, value + 1))}
                    disabled={disabled || value >= max}
                    className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                        'border border-zinc-200 hover:border-zinc-950',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'hover:bg-zinc-50'
                    )}
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <span className="text-xs text-slate-400">/ {max}</span>
        </div>
    );
}

/**
 * Selector de motivo de rechazo
 */
function RejectionReasonSelect({
    value,
    onChange,
    disabled,
}: {
    value: RejectionReason | '';
    onChange: (value: RejectionReason) => void;
    disabled?: boolean;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as RejectionReason)}
            disabled={disabled}
            className={cn(
                'w-full rounded-lg border border-zinc-300 px-4 py-2.5',
                'bg-white text-sm text-zinc-950',
                'focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10',
                'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
        >
            <option value="">Selecciona motivo del rechazo</option>
            {Object.entries(REJECTION_REASON_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
            ))}
        </select>
    );
}

/**
 * Input de fotos con preview
 */
function PhotoInput({
    photos,
    onAdd,
    onRemove,
    disabled,
    required,
}: {
    photos: File[];
    onAdd: (files: FileList) => void;
    onRemove: (index: number) => void;
    disabled?: boolean;
    required?: boolean;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onAdd(e.target.files);
            // Reset input para permitir seleccionar el mismo archivo
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <Camera className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                    Foto de evidencia en vivo
                    {required && <span className="ml-1 text-zinc-950">*</span>}
                </span>
            </div>

            {/* Preview de fotos */}
            {photos.length > 0 && (
                <div className="grid kx-trip-photo-grid gap-2">
                    {photos.map((file, index) => (
                        <div
                            key={index}
                            className="relative aspect-square w-full max-w-20 overflow-hidden rounded-lg border border-slate-200"
                        >
                            <img
                                src={URL.createObjectURL(file)}
                                alt={`Foto ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(index)}
                                    className={cn(
                                        'absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full',
                                        'bg-zinc-950 text-white transition-colors',
                                        'hover:bg-zinc-800'
                                    )}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Botón agregar */}
            {!disabled && (
                <>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={handleClick}
                        className={cn(
                            'kx-touch-target flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 min-[420px]:w-auto',
                            'border border-dashed border-zinc-300',
                            'text-sm font-medium text-zinc-600',
                            'hover:border-zinc-950 hover:bg-zinc-50 hover:text-zinc-950',
                            'transition-all duration-200'
                        )}
                    >
                        <ImagePlus className="w-4 h-4" />
                        Tomar foto
                    </button>
                    <p className="text-xs leading-5 text-slate-500">
                        Puedes tomar una foto nueva o elegir una imagen guardada en tu dispositivo.
                    </p>
                </>
            )}
        </div>
    );
}

// =============================================================================
// ITEM CARD COMPONENT
// =============================================================================

interface ItemCardProps {
    item: ManifestItem;
    mode: ChecklistMode;
    isLocked: boolean;
    isProcessing: boolean;
    onSubmit: (state: ItemExpandedState) => Promise<void>;
    draftNamespace?: string;
}

function ItemCard({ item, mode, isLocked, isProcessing, onSubmit, draftNamespace }: ItemCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
    const deliverableQty = getDeliverableQuantity(item);
    const loadRejectedForDelivery = mode === 'delivery' && isLoadRejectedForDelivery(item);

    const buildDefaultState = useCallback((): ItemExpandedState => ({
        notes: '',
        hasIssue: false,
        loadingDecision: item.loadStatus === 'rejected' ? 'rejected' : item.hasIssue ? 'issue' : 'loaded',
        photos: [],
        deliveredQty: deliverableQty,
        rejectedQty: 0,
        rejectionReason: '',
    }), [deliverableQty, item.hasIssue, item.loadStatus]);

    // Estado del formulario interno
    const [state, setState] = useState<ItemExpandedState>(buildDefaultState);

    // Determinar si ya fue procesado
    const isProcessed = mode === 'loading'
        ? isLoadingItemProcessed(item)
        : Boolean(
            loadRejectedForDelivery
            || item.deliveredAt
            || item.deliveryStatus === 'complete'
            || item.deliveryStatus === 'partial'
            || item.deliveryStatus === 'rejected'
        );

    // Determinar estado visual
    const status: ManifestItemStatus = mode === 'loading'
        ? getLoadingItemStatus(item)
        : (loadRejectedForDelivery ? 'rejected' : item.deliveryStatus === 'complete' ? 'delivered' : item.deliveryStatus || 'pending');
    const draftStorageKey = buildDraftStorageKey(draftNamespace, item.id);

    useEffect(() => {
        let isCancelled = false;

        const restoreDraft = async () => {
            if (isProcessed || isLocked || !draftStorageKey) {
                removePersistedDraft(draftStorageKey);
                setState(buildDefaultState());
                setIsExpanded(false);
                setHasHydratedDraft(true);
                return;
            }

            const persistedDraft = readPersistedDraft(draftStorageKey);
            if (!persistedDraft) {
                setState(buildDefaultState());
                setIsExpanded(false);
                setHasHydratedDraft(true);
                return;
            }

            const maxQuantity = deliverableQty;
            const restoredPhotos = await deserializeDraftPhotos(persistedDraft.photos || []);

            if (isCancelled) return;

            const deliveredQty = Math.min(
                maxQuantity,
                Math.max(0, Number(persistedDraft.deliveredQty ?? maxQuantity))
            );
            const rejectedQty = Math.min(
                maxQuantity - deliveredQty,
                Math.max(0, Number(persistedDraft.rejectedQty ?? 0))
            );

            setState({
                notes: persistedDraft.notes || '',
                hasIssue: Boolean(persistedDraft.hasIssue),
                loadingDecision: persistedDraft.loadingDecision || (persistedDraft.hasIssue ? 'issue' : 'loaded'),
                photos: restoredPhotos,
                deliveredQty,
                rejectedQty,
                rejectionReason: persistedDraft.rejectionReason || '',
            });
            setIsExpanded(Boolean(persistedDraft.isExpanded));
            setHasHydratedDraft(true);
        };

        setHasHydratedDraft(false);
        void restoreDraft();

        return () => {
            isCancelled = true;
        };
    }, [buildDefaultState, deliverableQty, draftStorageKey, isLocked, isProcessed, item.id]);

    useEffect(() => {
        let isCancelled = false;

        const persistDraft = async () => {
            if (!draftStorageKey || !hasHydratedDraft) return;

            if (isProcessed || isLocked) {
                removePersistedDraft(draftStorageKey);
                return;
            }

            const serializedPhotos = await serializeDraftPhotos(state.photos);
            if (isCancelled || typeof window === 'undefined') return;

            const payload: PersistedItemDraftState = {
                notes: state.notes,
                hasIssue: state.hasIssue,
                loadingDecision: state.loadingDecision,
                deliveredQty: state.deliveredQty,
                rejectedQty: state.rejectedQty,
                rejectionReason: state.rejectionReason,
                isExpanded,
                photos: serializedPhotos,
            };

            try {
                window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
            } catch {
                // Keep the in-memory draft if the browser cannot persist large photo payloads.
            }
        };

        void persistDraft();

        return () => {
            isCancelled = true;
        };
    }, [draftStorageKey, hasHydratedDraft, isExpanded, isLocked, isProcessed, state]);

    // Manejar submit
    const handleSubmit = async (candidateState = state) => {
        if (isLocked || isProcessed || isSubmitting) return;

        // Validaciones
        if (mode === 'loading') {
            if (candidateState.loadingDecision === 'rejected' && !candidateState.notes.trim()) {
                alert('Describe por que rechazaste la carga antes de confirmarla');
                return;
            }
            if (candidateState.loadingDecision === 'rejected' && candidateState.photos.length === 0) {
                alert('Debes agregar al menos una foto de evidencia para rechazar la carga');
                return;
            }
        } else if (mode === 'delivery') {
            const total = candidateState.deliveredQty + candidateState.rejectedQty;
            const expected = deliverableQty;

            if (total !== expected) {
                alert(`La suma de entregados y rechazados debe ser ${expected}`);
                return;
            }

            if (candidateState.rejectedQty > 0 && !candidateState.rejectionReason) {
                alert('Selecciona un motivo de rechazo');
                return;
            }

            if (candidateState.rejectedQty > 0 && candidateState.photos.length === 0) {
                alert('Debes agregar al menos una foto de evidencia para los rechazos');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await onSubmit(candidateState);
            removePersistedDraft(draftStorageKey);
            setIsExpanded(false);
        } catch {
            // Error manejado por el parent
        } finally {
            setIsSubmitting(false);
        }
    };

    // Agregar fotos
    const handleAddPhotos = (files: FileList) => {
        const capturedPhoto = files.item(0);
        if (!capturedPhoto) return;

        setState(prev => ({
            ...prev,
            photos: [...prev.photos, capturedPhoto],
        }));
    };

    // Remover foto
    const handleRemovePhoto = (index: number) => {
        setState(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index),
        }));
    };

    // Actualizar cantidades en delivery
    const handleDeliveredChange = (value: number) => {
        const max = deliverableQty;
        setState(prev => ({
            ...prev,
            deliveredQty: value,
            rejectedQty: max - value,
        }));
    };

    const loadingRejectPending = mode === 'loading' && state.loadingDecision === 'rejected';
    const deliveryRejectPending = mode === 'delivery' && state.rejectedQty > 0;
    const confirmDisabled = isSubmitting
        || isProcessing
        || (loadingRejectPending && (!state.notes.trim() || state.photos.length === 0))
        || (deliveryRejectPending && (!state.rejectionReason || state.photos.length === 0));

    const evidenceUrls = mode === 'loading' || loadRejectedForDelivery
        ? item.loadPhotos || []
        : item.deliveryPhotos || [];

    const handleSwipeAccept = async () => {
        const max = deliverableQty;
        const nextState: ItemExpandedState = mode === 'loading'
            ? { ...state, hasIssue: false, loadingDecision: 'loaded' }
            : { ...state, deliveredQty: max, rejectedQty: 0, rejectionReason: '' };

        setState(nextState);
        await handleSubmit(nextState);
    };

    const handlePrimaryAction = async () => {
        if (mode === 'loading' && state.loadingDecision === 'rejected') {
            await handleSubmit(state);
            return;
        }

        if (mode === 'delivery' && state.rejectedQty > 0) {
            await handleSubmit(state);
            return;
        }

        await handleSwipeAccept();
    };

    const handleCancelLoadingRejection = () => {
        setState(prev => ({
            ...prev,
            hasIssue: false,
            loadingDecision: 'loaded',
            notes: '',
            photos: [],
        }));
    };

    const handleSwipeReject = async () => {
        const max = deliverableQty;

        if (mode === 'loading') {
            const nextState: ItemExpandedState = {
                ...state,
                hasIssue: true,
                loadingDecision: 'rejected',
                notes: state.notes || 'Carga rechazada en bodega.',
            };
            setState(nextState);
            setIsExpanded(true);
            toast.warning('Rechazo pendiente', 'Confirma el rechazo de carga con una nota clara antes de continuar.');
        } else {
            // Delivery mode: expand panel and pre-fill rejection values
            // Don't auto-submit because photos are required for rejections
            const nextState: ItemExpandedState = {
                ...state,
                deliveredQty: 0,
                rejectedQty: max,
                rejectionReason: state.rejectionReason || 'other',
                notes: state.notes || 'Novedad reportada durante la descarga.',
            };
            setState(nextState);
            setIsExpanded(true);
            toast.warning('Rechazo pendiente', 'Agrega al menos una foto de evidencia y luego confirma la entrega.');
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
                'rounded-lg border bg-white transition-all duration-300',
                'shadow-sm hover:shadow-md',
                isProcessed
                    ? 'border-zinc-950'
                    : 'border-zinc-200 hover:border-zinc-950',
                isExpanded && 'border-zinc-950 shadow-[0_24px_60px_-48px_rgba(10,10,10,.65)] ring-2 ring-zinc-950/5'
            )}
        >
            {/* Header - Siempre visible */}
            <button
                type="button"
                onClick={() => !isLocked && !isProcessed && setIsExpanded(!isExpanded)}
                disabled={isLocked || isProcessed}
                className={cn(
                    'flex w-full items-start gap-3 rounded-t-lg p-4 text-left min-[380px]:gap-4 min-[380px]:p-5',
                    'transition-all duration-200',
                    !isLocked && !isProcessed && 'cursor-pointer hover:bg-zinc-50',
                    isProcessed && 'cursor-default'
                )}
            >
                {/* Checkbox visual */}
                <div className={cn(
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border',
                    'transition-all duration-200',
                    isProcessed
                        ? status === 'rejected'
                            ? 'bg-zinc-950 border-zinc-950 text-white'
                            : 'bg-zinc-950 border-zinc-950 text-white'
                        : 'border-zinc-300'
                )}>
                    {isProcessed && (
                        status === 'rejected'
                            ? <X className="w-4 h-4" />
                            : <Check className="w-4 h-4" />
                    )}
                </div>

                {/* Info del item */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                        <div className="min-w-0">
                            <h4 className={cn(
                                'break-words font-semibold text-slate-900',
                                isProcessed && 'line-through opacity-60'
                            )}>
                                {item.name}
                            </h4>
                            {item.reference && (
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Hash className="w-3 h-3" />
                                    {item.reference}
                                </p>
                            )}
                        </div>
                        <StatusBadge status={status} mode={mode} />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 min-[380px]:gap-4">
                        <span className="font-medium">
                            {mode === 'loading'
                                ? `${item.quantity} unidades`
                                : loadRejectedForDelivery
                                    ? 'Rechazado en carga'
                                    : `${deliverableQty} cargados`
                            }
                        </span>

                        {/* Mostrar fotos si hay */}
                        {((mode === 'loading' && item.loadPhotos?.length) ||
                            (mode === 'delivery' && item.deliveryPhotos?.length)) && (
                                <span className="flex items-center gap-1 text-zinc-700">
                                    <Camera className="w-3.5 h-3.5" />
                                    {mode === 'loading'
                                        ? item.loadPhotos?.length
                                        : item.deliveryPhotos?.length
                                    } fotos
                                </span>
                            )}
                    </div>

                    {/* Notas si existen */}
                    {mode === 'loading' && item.loadNotes && (
                        <p className="mt-2 flex items-start gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>{item.loadNotes}</span>
                        </p>
                    )}
                    {mode === 'delivery' && item.deliveryNotes && (
                        <p className="mt-2 flex items-start gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>{item.deliveryNotes}</span>
                        </p>
                    )}
                    {loadRejectedForDelivery && (
                        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                            <div className="flex items-start gap-1.5 font-semibold">
                                <X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                <span>Rechazado en carga</span>
                            </div>
                            <p className="mt-1 leading-5 text-red-700">
                                {item.loadRejectionReason || item.loadNotes || 'Este item no se cargo en origen y no puede marcarse como entregado.'}
                            </p>
                        </div>
                    )}
                    {loadRejectedForDelivery && item.loadPhotos?.length ? (
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                            {item.loadPhotos.map((url, index) => (
                                <a
                                    key={`${url}-${index}`}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block h-14 w-14 flex-none overflow-hidden rounded-lg border border-red-200 bg-red-50"
                                >
                                    <img
                                        src={url}
                                        alt={`Evidencia de rechazo en carga ${index + 1}`}
                                        className="h-full w-full object-cover"
                                    />
                                </a>
                            ))}
                        </div>
                    ) : null}
                </div>

                {/* Chevron de expandir */}
                {!isLocked && !isProcessed && (
                    <div className="flex-shrink-0">
                        {isExpanded
                            ? <ChevronUp className="w-5 h-5 text-slate-400" />
                            : <ChevronDown className="w-5 h-5 text-slate-400" />
                        }
                    </div>
                )}
            </button>

            {/* Panel expandido */}
            <AnimatePresence>
                {isExpanded && !isLocked && !isProcessed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-5 border-t border-dashed border-zinc-200 bg-white px-4 pb-5 pt-4 min-[380px]:px-5">
                            {(item.imageUrl || evidenceUrls.length > 0) && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <Camera className="h-4 w-4 text-slate-500" />
                                        Evidencia del item
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {item.imageUrl && (
                                            <img
                                                src={item.imageUrl}
                                                alt={`Imagen de ${item.name}`}
                                                className="h-20 w-20 flex-none rounded-lg border border-zinc-200 object-cover"
                                            />
                                        )}
                                        {evidenceUrls.map((url, index) => (
                                            <a
                                                key={`${url}-${index}`}
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block h-20 w-20 flex-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Evidencia ${index + 1} de ${item.name}`}
                                                    className="h-full w-full object-cover"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {mode === 'loading' ? (
                                <>
                                    {state.loadingDecision === 'rejected' ? (
                                        <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
                                            Este item quedara rechazado en carga. Debe mostrarse como rechazado, no como novedad.
                                        </div>
                                    ) : null}

                                    {/* Checkbox de novedad */}
                                    {state.loadingDecision !== 'rejected' ? (
                                        <label className="group flex cursor-pointer items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={state.hasIssue}
                                                onChange={(e) => setState(prev => ({
                                                    ...prev,
                                                    hasIssue: e.target.checked,
                                                    loadingDecision: e.target.checked ? 'issue' : 'loaded',
                                                }))}
                                                className={cn(
                                                    'h-5 w-5 rounded border-2 border-zinc-400',
                                                    'checked:border-zinc-950 checked:bg-zinc-950',
                                                    'focus:ring-2 focus:ring-zinc-950/20 focus:ring-offset-2'
                                                )}
                                            />
                                            <span className="text-sm text-slate-700 group-hover:text-zinc-950">
                                                Hay una novedad con este item
                                            </span>
                                        </label>
                                    ) : null}

                                    {/* Notas */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Notas (opcional)
                                        </label>
                                        <textarea
                                            value={state.notes}
                                            onChange={(e) => setState(prev => ({
                                                ...prev,
                                                notes: e.target.value
                                            }))}
                                            placeholder="Describe cualquier observacion..."
                                            rows={2}
                                            className={cn(
                                                'w-full rounded-lg border border-zinc-200 px-4 py-2.5',
                                                'text-sm resize-none',
                                                'focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10'
                                            )}
                                        />
                                    </div>

                                    {/* Fotos */}
                                    <PhotoInput
                                        photos={state.photos}
                                        onAdd={handleAddPhotos}
                                        onRemove={handleRemovePhoto}
                                        required={state.loadingDecision === 'rejected'}
                                    />
                                </>
                            ) : (
                                <>
                                    {/* Contadores de entrega */}
                                    <div className="space-y-3">
                                        <QuantityCounter
                                            value={state.deliveredQty}
                                            max={deliverableQty}
                                            onChange={handleDeliveredChange}
                                            label="Entregados"
                                        />
                                        <QuantityCounter
                                            value={state.rejectedQty}
                                            max={deliverableQty}
                                            onChange={(v) => setState(prev => ({
                                                ...prev,
                                                rejectedQty: v,
                                                deliveredQty: deliverableQty - v,
                                            }))}
                                            label="Rechazados"
                                            variant="danger"
                                        />
                                    </div>

                                    {/* Motivo de rechazo */}
                                    {state.rejectedQty > 0 && (
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-zinc-950">
                                                Motivo del rechazo *
                                            </label>
                                            <RejectionReasonSelect
                                                value={state.rejectionReason}
                                                onChange={(v) => setState(prev => ({
                                                    ...prev,
                                                    rejectionReason: v
                                                }))}
                                            />
                                        </div>
                                    )}

                                    {/* Notas */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Notas (opcional)
                                        </label>
                                        <textarea
                                            value={state.notes}
                                            onChange={(e) => setState(prev => ({
                                                ...prev,
                                                notes: e.target.value
                                            }))}
                                            placeholder="Describe cualquier observacion..."
                                            rows={2}
                                            className={cn(
                                                'w-full rounded-lg border border-zinc-200 px-4 py-2.5',
                                                'text-sm resize-none',
                                                'focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10'
                                            )}
                                        />
                                    </div>

                                    {/* Fotos (requeridas si hay rechazos) */}
                                    <PhotoInput
                                        photos={state.photos}
                                        onAdd={handleAddPhotos}
                                        onRemove={handleRemovePhoto}
                                        required={state.rejectedQty > 0}
                                    />
                                </>
                            )}

                            <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
                                <Button
                                    type="button"
                                    onClick={() => {
                                        if (loadingRejectPending) {
                                            handleCancelLoadingRejection();
                                            return;
                                        }
                                        void handleSwipeReject();
                                    }}
                                    disabled={isSubmitting || isProcessing}
                                    variant="outline"
                                    className="min-h-12 shadow-sm"
                                >
                                    {mode === 'loading' ? (
                                        <AlertTriangle className="h-4 w-4" />
                                    ) : (
                                        <X className="h-4 w-4" />
                                    )}
                                    {loadingRejectPending ? 'Cancelar rechazo' : mode === 'loading' ? 'Rechazar carga' : 'Rechazar entrega'}
                                </Button>

                                <Button
                                    type="button"
                                    onClick={() => void handlePrimaryAction()}
                                    disabled={confirmDisabled}
                                    variant="primary"
                                    className="min-h-12 shadow-sm"
                                >
                                    <Check className="h-4 w-4" />
                                    {mode === 'loading'
                                        ? state.loadingDecision === 'rejected'
                                            ? 'Confirmar rechazo'
                                            : 'Confirmar carga'
                                        : state.rejectedQty > 0
                                            ? 'Confirmar rechazo'
                                            : 'Confirmar entrega'}
                                </Button>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PickingChecklist({
    items,
    mode,
    isLocked = false,
    isProcessing = false,
    onItemLoaded,
    onItemDelivered,
    className,
    draftNamespace,
}: PickingChecklistProps) {
    // Calcular progreso
    const totalItems = items.length;
    const processedItems = items.filter(item =>
        mode === 'loading'
            ? isLoadingItemProcessed(item)
            : Boolean(isLoadRejectedForDelivery(item) || item.deliveredAt || item.deliveryStatus === 'complete' || item.deliveryStatus === 'partial' || item.deliveryStatus === 'rejected')
    ).length;
    const progressPercent = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;

    // Manejar submit de un item
    const handleItemSubmit = useCallback(async (item: ManifestItem, state: ItemExpandedState) => {
        if (mode === 'loading' && onItemLoaded) {
            await onItemLoaded(item, {
                hasIssue: state.loadingDecision === 'issue' || state.loadingDecision === 'rejected' || state.hasIssue,
                loadingDecision: state.loadingDecision,
                notes: state.notes,
                photos: state.photos,
            });
        } else if (mode === 'delivery' && onItemDelivered) {
            await onItemDelivered(
                item,
                state.deliveredQty,
                state.rejectedQty,
                state.rejectionReason || undefined,
                state.notes || undefined,
                state.photos
            );
        }
    }, [mode, onItemLoaded, onItemDelivered]);

    return (
        <div className={cn('space-y-5', className)}>
            {/* Header con progreso - Diseño premium */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                    <h3 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 shadow-sm">
                            <Package className="w-4 h-4 text-white" />
                        </div>
                        {mode === 'loading' ? 'Checklist de Carga' : 'Checklist de Entrega'}
                    </h3>
                    <span className={cn(
                        'rounded-md px-3.5 py-1.5 text-sm font-semibold shadow-sm',
                        progressPercent === 100
                            ? 'bg-zinc-950 text-white'
                            : 'border border-zinc-200 bg-white text-zinc-700'
                    )}>
                        {processedItems}/{totalItems} ({progressPercent}%)
                    </span>
                </div>

                {/* Barra de progreso mejorada */}
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100 shadow-inner">
                    <motion.div
                        className="h-full rounded-full bg-zinc-950 shadow-sm"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                </div>
            </div>

            {/* Indicador de bloqueo */}
            {isLocked && (
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                    <Check className="w-4 h-4" />
                    <span className="font-medium">
                        {mode === 'loading'
                            ? 'Carga verificada con PIN'
                            : 'Entrega verificada con PIN'
                        }
                    </span>
                </div>
            )}

            {/* Lista de items */}
            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {items.map((item) => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            mode={mode}
                            isLocked={isLocked}
                            isProcessing={isProcessing}
                            onSubmit={(state) => handleItemSubmit(item, state)}
                            draftNamespace={draftNamespace}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Mensaje si no hay items */}
            {items.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay items en el manifiesto</p>
                </div>
            )}
        </div>
    );
}

export default PickingChecklist;
