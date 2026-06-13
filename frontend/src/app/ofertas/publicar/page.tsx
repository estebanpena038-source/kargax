// =============================================================================
// KargaX - Publish Offer Page
// Enterprise-grade multi-step cargo offer publication wizard
// Oracle/Amazon-level stability and security
// =============================================================================

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package,
    MapPin,
    CreditCard,
    FileCheck,
    ImagePlus,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Save,
    Send,
    Loader2,
    AlertTriangle,
    Info,
    Truck,
    Users,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PlanLimitPaywallDialog } from '@/components/billing/PlanLimitPaywallDialog';
import { Button, Input, Card, toast, AndeanPhoneInput } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store/authStore';
import { validateAndeanPhoneValue } from '@/lib/phone/andean';
import { cn } from '@/lib/utils';
import { WarehouseOfferFields } from '@/components/warehouses/WarehouseOfferFields';
import LocationSelector from '@/components/location/LocationSelector';
import {
    COLOMBIAN_DEPARTMENTS,
    getCitiesByDepartment,
    getCityName,
    getDepartmentName,
    CARGO_TYPES,
    VEHICLE_TYPES,
    formatCOP,
} from '@/constants/colombia';
import warehouseClient from '@/lib/warehouses/client';
import { coercePlanLimitDetails, type PlanLimitErrorDetails } from '@/lib/billing/plan-limits';
import type { BusinessFleetMember } from '@/lib/warehouses/types';
import type { GeoZoneType, LocationSelectorValue } from '@/lib/geo/types';
import { useUserCountry } from '@/lib/platform/useUserCountry';

// =============================================================================
// Types
// =============================================================================

interface CargoOfferFormData {
    // Step 1: Cargo Info
    cargoType: string;
    cargoDescription: string;
    weightKg: number;
    dimensionLength?: number;
    dimensionWidth?: number;
    dimensionHeight?: number;
    quantity: number;
    temperatureMin?: number;
    temperatureMax?: number;
    specialRequirements?: string;
    // Manifest items (picking list)
    manifestItems?: {
        id?: string;
        name: string;
        quantity: number;
        quantityInput?: string;
        weightKg?: number;
        lengthCm?: number;
        widthCm?: number;
        heightCm?: number;
        imageUrls?: string[];
        invoicePhotoUrls?: string[];
    }[];

    // Step 2: Route Info
    originDepartment: string;
    originCity: string;
    originAddress: string;
    originDepartmentId?: string | null;
    originMunicipalityId?: string | null;
    originLocalZoneId?: string | null;
    originLocalZoneName?: string;
    originLocalZoneType?: GeoZoneType | '';
    originAddressReference?: string;
    originLatitude?: number | null;
    originLongitude?: number | null;
    // Pickup Contact (NEW - for PIN delivery)
    pickupContactName: string;
    pickupContactPhone: string;

    destinationDepartment: string;
    destinationCity: string;
    destinationAddress: string;
    destinationDepartmentId?: string | null;
    destinationMunicipalityId?: string | null;
    destinationLocalZoneId?: string | null;
    destinationLocalZoneName?: string;
    destinationLocalZoneType?: GeoZoneType | '';
    destinationAddressReference?: string;
    destinationLatitude?: number | null;
    destinationLongitude?: number | null;
    // Delivery Contact (NEW - for PIN delivery)
    deliveryContactName: string;
    deliveryContactPhone: string;

    pickupDate: string;
    pickupTimeStart: string;
    pickupTimeEnd: string;
    deliveryDate: string;
    deliveryTimeStart: string;
    deliveryTimeEnd: string;
    warehouseFlowMode?: string;
    originWarehouseId?: string;
    destinationWarehouseId?: string;
    originDockId?: string;
    destinationDockId?: string;

    // Step 3: Payment
    assignmentMode: 'public' | 'private';
    privateFleetTruckerId?: string;
    compensationMode?: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses';
    expensesReleasePolicy?: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual';
    totalAmount: number;
    freightPaymentAmount?: number;
    expenseAllowanceAmount?: number;
    ratePerKm?: number;
    paymentMethod: string;
    paymentSchedule: string;
    additionalTerms?: string;

    // Step 4: Requirements
    vehicleType: string;
    minExperienceYears: number;
    requiredLicenses?: string[];
    requiredCertifications?: string[];
    insuranceRequired: boolean;
    additionalRequirements?: string;

    // Step 5: Photos (file names/URLs)
    photos?: string[];
}

interface StepConfig {
    id: string;
    title: string;
    icon: React.ElementType;
    description: string;
}

interface ManifestItemDraftInput {
    id?: string;
    name: string;
    quantity: number;
    quantityInput?: string;
    weightKg?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    imageUrls?: string[];
    invoicePhotoUrls?: string[];
}

// =============================================================================
// Validation Schema
// =============================================================================

const offerSchema = z.object({
    // Cargo Info
    cargoType: z.string().min(1, 'Selecciona un tipo de carga'),
    cargoDescription: z.string().min(10, 'Descripción muy corta').max(2000),
    weightKg: z.number().min(0).max(100000).default(0),
    dimensionLength: z.number().min(0).max(30).optional(),
    dimensionWidth: z.number().min(0).max(5).optional(),
    dimensionHeight: z.number().min(0).max(5).optional(),
    quantity: z.number().min(1).max(10000).default(1),
    temperatureMin: z.number().optional(),
    temperatureMax: z.number().optional(),
    specialRequirements: z.string().max(1000).optional(),
    manifestItems: z.array(z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        quantity: z.number().min(1),
        weightKg: z.number().min(0).optional(),
        lengthCm: z.number().min(0).optional(),
        widthCm: z.number().min(0).optional(),
        heightCm: z.number().min(0).optional(),
        imageUrls: z.array(z.string()).max(4).optional(),
        invoicePhotoUrls: z.array(z.string()).min(2, 'Sube 2 facturas por item').max(2).optional(),
    })).min(1, 'Agrega al menos un item al manifiesto'),

    // Route Info
    originDepartment: z.string().min(1, 'Selecciona un departamento'),
    originCity: z.string().min(1, 'Selecciona una ciudad'),
    originAddress: z.string().min(5, 'Dirección muy corta'),
    originDepartmentId: z.string().nullable().optional(),
    originMunicipalityId: z.string().nullable().optional(),
    originLocalZoneId: z.string().nullable().optional(),
    originLocalZoneName: z.string().max(120).optional(),
    originLocalZoneType: z.string().optional(),
    originAddressReference: z.string().max(240).optional(),
    originLatitude: z.number().nullable().optional(),
    originLongitude: z.number().nullable().optional(),
    pickupContactName: z.string().min(2, 'Ingresa el nombre del contacto'),
    pickupContactPhone: z.string().refine(
        (value) => validateAndeanPhoneValue(value, 'CO'),
        'Selecciona el prefijo y usa un celular andino válido.'
    ),
    destinationDepartment: z.string().min(1, 'Selecciona un departamento'),
    destinationCity: z.string().min(1, 'Selecciona una ciudad'),
    destinationAddress: z.string().min(5, 'Dirección muy corta'),
    destinationDepartmentId: z.string().nullable().optional(),
    destinationMunicipalityId: z.string().nullable().optional(),
    destinationLocalZoneId: z.string().nullable().optional(),
    destinationLocalZoneName: z.string().max(120).optional(),
    destinationLocalZoneType: z.string().optional(),
    destinationAddressReference: z.string().max(240).optional(),
    destinationLatitude: z.number().nullable().optional(),
    destinationLongitude: z.number().nullable().optional(),
    deliveryContactName: z.string().min(2, 'Ingresa el nombre del contacto'),
    deliveryContactPhone: z.string().refine(
        (value) => validateAndeanPhoneValue(value, 'CO'),
        'Selecciona el prefijo y usa un celular andino válido.'
    ),
    pickupDate: z.string().min(1, 'Selecciona fecha de recogida'),
    pickupTimeStart: z.string().min(1, 'Selecciona hora'),
    pickupTimeEnd: z.string().min(1, 'Selecciona hora'),
    deliveryDate: z.string().min(1, 'Selecciona fecha de entrega'),
    deliveryTimeStart: z.string().min(1, 'Selecciona hora'),
    deliveryTimeEnd: z.string().min(1, 'Selecciona hora'),
    warehouseFlowMode: z.string().optional(),
    originWarehouseId: z.string().optional(),
    destinationWarehouseId: z.string().optional(),
    originDockId: z.string().optional(),
    destinationDockId: z.string().optional(),

    // Payment
    assignmentMode: z.enum(['public', 'private']).default('public'),
    privateFleetTruckerId: z.string().optional(),
    compensationMode: z.enum(['salary_no_trip_pay', 'trip_pay', 'expenses_only', 'trip_pay_plus_expenses']).default('salary_no_trip_pay'),
    expensesReleasePolicy: z.enum(['acceptance', 'pickup_pin', 'delivery_pod', 'manual']).default('acceptance'),
    totalAmount: z.number().min(0, 'Ingresa un valor valido'),
    freightPaymentAmount: z.number().min(0).optional(),
    expenseAllowanceAmount: z.number().min(0).optional(),
    ratePerKm: z.number().optional(),
    paymentMethod: z.string().default('bank_transfer'),
    paymentSchedule: z.string().default('on_delivery'),
    additionalTerms: z.string().max(1000).optional(),

    // Requirements
    vehicleType: z.string().min(1, 'Selecciona tipo de vehículo'),
    minExperienceYears: z.number().min(0).max(50),
    requiredLicenses: z.array(z.string()).optional(),
    requiredCertifications: z.array(z.string()).optional(),
    insuranceRequired: z.boolean(),
    additionalRequirements: z.string().max(1000).optional(),

    // Photos
    photos: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
    const validManifestItems = (data.manifestItems || []).filter((item) => item.name?.trim());
    if (validManifestItems.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['manifestItems'],
            message: 'Agrega al menos un item al manifiesto',
        });
    }

    if (data.assignmentMode === 'private') {
        const compensationMode = data.compensationMode || 'salary_no_trip_pay';
        const freightPaymentAmount = Number(data.freightPaymentAmount || 0);
        const expenseAllowanceAmount = Number(data.expenseAllowanceAmount || 0);

        if (!data.privateFleetTruckerId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['privateFleetTruckerId'],
                message: 'Selecciona un conductor privado',
            });
        }

        if (['trip_pay', 'trip_pay_plus_expenses'].includes(compensationMode) && freightPaymentAmount <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['freightPaymentAmount'],
                message: 'Ingresa el pago por ruta',
            });
        }

        if (['salary_no_trip_pay', 'expenses_only'].includes(compensationMode) && freightPaymentAmount > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['freightPaymentAmount'],
                message: 'Este modo no permite pago por ruta',
            });
        }

        if (compensationMode === 'salary_no_trip_pay' && expenseAllowanceAmount > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['expenseAllowanceAmount'],
                message: 'Nomina mensual no permite viaticos dentro del viaje',
            });
        }

        if (['expenses_only', 'trip_pay_plus_expenses'].includes(compensationMode) && expenseAllowanceAmount <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['expenseAllowanceAmount'],
                message: 'Ingresa los gastos del viaje',
            });
        }

        if (expenseAllowanceAmount < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['expenseAllowanceAmount'],
                message: 'Los viaticos no pueden ser negativos',
            });
        }
    }

    if (data.assignmentMode === 'public' && Number(data.totalAmount || 0) <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['totalAmount'],
            message: 'Define el monto a pagar del viaje',
        });
    }

    validManifestItems.forEach((item, index) => {
        if ((item.invoicePhotoUrls || []).length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['manifestItems', index, 'invoicePhotoUrls'],
                message: 'Sube 2 facturas por item del manifiesto',
            });
        }
    });

});

// =============================================================================
// Step Configuration
// =============================================================================

const STEPS: StepConfig[] = [
    {
        id: 'cargo',
        title: 'Información de Carga',
        icon: Package,
        description: 'Describe qué necesitas transportar',
    },
    {
        id: 'route',
        title: 'Ruta',
        icon: MapPin,
        description: 'Origen, destino y fechas',
    },
    {
        id: 'payment',
        title: 'Asignacion',
        icon: CreditCard,
        description: 'Modo operativo y custodia',
    },
    {
        id: 'requirements',
        title: 'Requisitos',
        icon: FileCheck,
        description: 'Vehículo y conductor',
    },
    {
        id: 'photos',
        title: 'Fotos',
        icon: ImagePlus,
        description: 'Opcional: imágenes de la carga',
    },
    {
        id: 'review',
        title: 'Revisar',
        icon: CheckCircle2,
        description: 'Confirmar y publicar',
    },
];

function createManifestDraftItemId(): string {
    const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `draft-${randomId}`;
}

function formatVolumeM3(volumeCm3: number): string {
    return `${(volumeCm3 / 1000000).toFixed(2)} m3`;
}

function getManifestMetrics(items: ManifestItemDraftInput[] = []) {
    return items.reduce((summary, item) => {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const weightKg = Number(item.weightKg || 0);
        const lengthCm = Number(item.lengthCm || 0);
        const widthCm = Number(item.widthCm || 0);
        const heightCm = Number(item.heightCm || 0);
        const hasDimensions = lengthCm > 0 && widthCm > 0 && heightCm > 0;

        summary.totalItems += 1;
        summary.totalUnits += quantity;

        if (weightKg > 0) {
            summary.totalWeightKg += weightKg * quantity;
        }

        if (hasDimensions) {
            summary.totalVolumeCm3 += lengthCm * widthCm * heightCm * quantity;
            summary.itemsWithDimensions += 1;
        } else {
            summary.itemsWithoutDimensions += 1;
        }

        return summary;
    }, {
        totalItems: 0,
        totalUnits: 0,
        totalWeightKg: 0,
        totalVolumeCm3: 0,
        itemsWithDimensions: 0,
        itemsWithoutDimensions: 0,
    });
}

const OFFER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const OFFER_PHOTO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function sanitizeFileSegment(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'archivo';
}

async function uploadOfferPhotoFile(file: File, folder: string) {
    if (!OFFER_PHOTO_MIME_TYPES.includes(file.type) || file.size > OFFER_PHOTO_MAX_BYTES) {
        throw new Error('Solo imagenes PNG, JPG o WebP de hasta 5MB');
    }

    const { supabase } = await import('@/lib/supabase/client');
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('No hay una sesion activa para subir imagenes');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', sanitizeFileSegment(folder));

    const response = await fetch('/api/offer-photos/upload', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
    });
    const rawText = await response.text();
    let json: any = null;
    try {
        json = rawText ? JSON.parse(rawText) : null;
    } catch {
        json = null;
    }

    if (!response.ok) {
        const message = typeof json?.error === 'string'
            ? json.error
            : typeof json?.error?.message === 'string'
                ? json.error.message
                : rawText || 'No se pudo subir la imagen';
        throw new Error(message);
    }

    const publicUrl = json?.data?.publicUrl;

    if (typeof publicUrl !== 'string' || !publicUrl) {
        throw new Error('La API no retorno la URL publica de la imagen');
    }

    return publicUrl;
}

// =============================================================================
// Dynamic Manifest Items Component
// =============================================================================

/**
 * ManifestItemsSection - Dynamic picking list for cargo manifest
 * Allows adding/removing items that the trucker will verify during pickup
 */
function ManifestItemsSection({ form }: { form: ReturnType<typeof useForm<CargoOfferFormData>> }) {
    const { watch, setValue, getValues, formState: { errors } } = form;
    const manifestItems = watch('manifestItems') || [];
    const manifestMetrics = getManifestMetrics(manifestItems as ManifestItemDraftInput[]);
    const [uploadingManifestKey, setUploadingManifestKey] = React.useState<string | null>(null);
    const [manifestUploadError, setManifestUploadError] = React.useState<string | null>(null);

    const addItem = () => {
        const newItems = [
            ...manifestItems,
            {
                id: createManifestDraftItemId(),
                name: '',
                quantity: 1,
                quantityInput: '1',
                imageUrls: [],
                invoicePhotoUrls: [],
            } as ManifestItemDraftInput,
        ];
        setValue('manifestItems', newItems);
    };

    const removeItem = (index: number) => {
        const newItems = manifestItems.filter((_, i) => i !== index);
        setValue('manifestItems', newItems);
    };

    const updateItem = (index: number, field: 'name' | 'quantity', value: string | number) => {
        const newItems = [...manifestItems];
        if (field === 'name') {
            newItems[index] = { ...newItems[index], name: value as string };
        } else {
            const nextQuantity = Number.isFinite(value as number) ? Math.max(1, Math.trunc(value as number)) : 1;
            newItems[index] = {
                ...newItems[index],
                quantity: nextQuantity,
                quantityInput: String(nextQuantity),
            };
        }
        setValue('manifestItems', newItems);
    };

    const handleQuantityInputChange = (index: number, rawValue: string) => {
        const newItems = [...manifestItems] as ManifestItemDraftInput[];
        const sanitizedValue = rawValue.replace(/[^\d]/g, '');
        const currentItem = newItems[index];

        if (!currentItem) return;

        if (sanitizedValue === '') {
            newItems[index] = {
                ...currentItem,
                quantityInput: '',
            };
            setValue('manifestItems', newItems);
            return;
        }

        const nextQuantity = Math.max(1, parseInt(sanitizedValue, 10));
        newItems[index] = {
            ...currentItem,
            quantity: nextQuantity,
            quantityInput: sanitizedValue,
        };
        setValue('manifestItems', newItems);
    };

    const handleQuantityBlur = (index: number) => {
        const newItems = [...manifestItems] as ManifestItemDraftInput[];
        const currentItem = newItems[index];

        if (!currentItem) return;

        const normalizedQuantity = Math.max(1, parseInt(currentItem.quantityInput || String(currentItem.quantity || 1), 10) || 1);
        newItems[index] = {
            ...currentItem,
            quantity: normalizedQuantity,
            quantityInput: String(normalizedQuantity),
        };
        setValue('manifestItems', newItems);
    };

    const updateItemUrls = (
        index: number,
        field: 'imageUrls' | 'invoicePhotoUrls',
        urls: string[]
    ) => {
        const newItems = [...(getValues('manifestItems') || [])] as ManifestItemDraftInput[];
        const currentItem = newItems[index];

        if (!currentItem) return;

        newItems[index] = {
            ...currentItem,
            [field]: urls,
        };
        setValue('manifestItems', newItems, { shouldValidate: true, shouldDirty: true });
    };

    const handleManifestFileSelect = async (
        index: number,
        field: 'imageUrls' | 'invoicePhotoUrls',
        files: FileList | null
    ) => {
        if (!files?.length) return;

        const items = [...(getValues('manifestItems') || [])] as ManifestItemDraftInput[];
        const item = items[index];
        if (!item) return;

        const currentUrls = item[field] || [];
        const maxFiles = field === 'imageUrls' ? 4 : 2;
        const remaining = maxFiles - currentUrls.length;

        if (remaining <= 0) {
            setManifestUploadError(field === 'imageUrls'
                ? 'Maximo 4 imagenes por item'
                : 'Cada item requiere exactamente 2 facturas');
            return;
        }

        const selectedFiles = Array.from(files).slice(0, remaining);
        const invalidFile = selectedFiles.find((file) =>
            !OFFER_PHOTO_MIME_TYPES.includes(file.type) || file.size > OFFER_PHOTO_MAX_BYTES
        );

        if (invalidFile) {
            setManifestUploadError('Solo imagenes PNG, JPG o WebP de hasta 5MB');
            return;
        }

        const uploadKey = `${index}-${field}`;
        setUploadingManifestKey(uploadKey);
        setManifestUploadError(null);

        try {
            const uploadedUrls: string[] = [];
            const folder = `manifest/${item.id || `item-${index + 1}`}/${field === 'imageUrls' ? 'carga' : 'facturas'}`;

            for (const file of selectedFiles) {
                uploadedUrls.push(await uploadOfferPhotoFile(file, folder));
            }

            updateItemUrls(index, field, [...currentUrls, ...uploadedUrls]);
        } catch (error) {
            setManifestUploadError(error instanceof Error ? error.message : 'No se pudo subir la evidencia');
        } finally {
            setUploadingManifestKey(null);
        }
    };

    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-zinc-950" />
                    <h4 className="font-semibold text-zinc-950">Lista de Carga (Manifiesto)</h4>
                </div>
                <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                    {manifestItems.length} items
                </span>
            </div>

            <p className="mb-4 text-sm text-zinc-600">
                El camionero marcará cada item al recoger la carga. Esto garantiza verificación completa.
            </p>

            {/* Items List */}
            <div className="space-y-3 mb-4">
                <AnimatePresence>
                    {manifestItems.map((item, index) => {
                        const quantityInput = typeof (item as ManifestItemDraftInput).quantityInput === 'string'
                            ? (item as ManifestItemDraftInput).quantityInput
                            : String(item.quantity || 1);
                        const itemImages = (item as ManifestItemDraftInput).imageUrls || [];
                        const invoiceImages = (item as ManifestItemDraftInput).invoicePhotoUrls || [];
                        const isUploadingItemImages = uploadingManifestKey === `${index}-imageUrls`;
                        const isUploadingInvoices = uploadingManifestKey === `${index}-invoicePhotoUrls`;
                        const itemNameError = (errors.manifestItems as any)?.[index]?.name?.message as string | undefined;
                        const invoiceError = (errors.manifestItems as any)?.[index]?.invoicePhotoUrls?.message as string | undefined;

                        return (
                        <motion.div
                            key={item.id || index}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                                        placeholder="Ej: Bultos de cemento Argos"
                                        className={cn(
                                            'w-full rounded-lg border px-3 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none',
                                            itemNameError ? 'border-red-500' : 'border-zinc-200'
                                        )}
                                    />
                                    {itemNameError ? <p className="mt-1 text-xs font-medium text-red-600">{itemNameError}</p> : null}
                                </div>
                                <div className="w-full sm:w-24">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={quantityInput}
                                        onChange={(e) => handleQuantityInputChange(index, e.target.value)}
                                        onBlur={() => handleQuantityBlur(index)}
                                        placeholder="Cant"
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            {/* Per-item dimensions */}
            <div className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-4">
                                <input type="number" min={0} step={0.1}
                                    value={(item as ManifestItemDraftInput).weightKg || ''}
                                    onChange={(e) => { const v = [...manifestItems]; (v[index] as any).weightKg = e.target.value ? Number(e.target.value) : undefined; setValue('manifestItems', v); }}
                                    placeholder="Peso (kg)"
                                    className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-center text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none" />
                                <input type="number" min={0} step={1}
                                    value={(item as ManifestItemDraftInput).lengthCm || ''}
                                    onChange={(e) => { const v = [...manifestItems]; (v[index] as any).lengthCm = e.target.value ? Number(e.target.value) : undefined; setValue('manifestItems', v); }}
                                    placeholder="Largo (cm)"
                                    className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-center text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none" />
                                <input type="number" min={0} step={1}
                                    value={(item as ManifestItemDraftInput).widthCm || ''}
                                    onChange={(e) => { const v = [...manifestItems]; (v[index] as any).widthCm = e.target.value ? Number(e.target.value) : undefined; setValue('manifestItems', v); }}
                                    placeholder="Ancho (cm)"
                                    className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-center text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none" />
                                <input type="number" min={0} step={1}
                                    value={(item as ManifestItemDraftInput).heightCm || ''}
                                    onChange={(e) => { const v = [...manifestItems]; (v[index] as any).heightCm = e.target.value ? Number(e.target.value) : undefined; setValue('manifestItems', v); }}
                                    placeholder="Alto (cm)"
                                    className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-center text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none" />
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-950">Imagenes del item</p>
                                            <p className="text-xs text-zinc-500">{itemImages.length}/4 maximo</p>
                                        </div>
                                        <label className={cn(
                                            'inline-flex cursor-pointer items-center justify-center rounded-md border border-zinc-950 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white',
                                            (isUploadingItemImages || itemImages.length >= 4) && 'pointer-events-none opacity-50'
                                        )}>
                                            {isUploadingItemImages ? 'Subiendo...' : 'Subir'}
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                multiple
                                                className="hidden"
                                                disabled={isUploadingItemImages || itemImages.length >= 4}
                                                onChange={(event) => {
                                                    void handleManifestFileSelect(index, 'imageUrls', event.target.files);
                                                    event.currentTarget.value = '';
                                                }}
                                            />
                                        </label>
                                    </div>
                                    {itemImages.length ? (
                                        <div className="mt-3 grid grid-cols-4 gap-2">
                                            {itemImages.map((url, photoIndex) => (
                                                <button
                                                    key={url}
                                                    type="button"
                                                    onClick={() => updateItemUrls(index, 'imageUrls', itemImages.filter((_, i) => i !== photoIndex))}
                                                    className="group relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-white"
                                                    aria-label="Quitar imagen del item"
                                                >
                                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                                    <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-xs font-semibold text-white group-hover:flex">Quitar</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-950">Facturas obligatorias</p>
                                            <p className={cn(
                                                'text-xs',
                                                invoiceImages.length < 2 ? 'text-red-600' : 'text-zinc-500'
                                            )}>
                                                {invoiceImages.length}/2 requeridas
                                            </p>
                                        </div>
                                        <label className={cn(
                                            'inline-flex cursor-pointer items-center justify-center rounded-md border border-zinc-950 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white',
                                            (isUploadingInvoices || invoiceImages.length >= 2) && 'pointer-events-none opacity-50'
                                        )}>
                                            {isUploadingInvoices ? 'Subiendo...' : 'Subir'}
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                multiple
                                                className="hidden"
                                                disabled={isUploadingInvoices || invoiceImages.length >= 2}
                                                onChange={(event) => {
                                                    void handleManifestFileSelect(index, 'invoicePhotoUrls', event.target.files);
                                                    event.currentTarget.value = '';
                                                }}
                                            />
                                        </label>
                                    </div>
                                    {invoiceImages.length ? (
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            {invoiceImages.map((url, photoIndex) => (
                                                <button
                                                    key={url}
                                                    type="button"
                                                    onClick={() => updateItemUrls(index, 'invoicePhotoUrls', invoiceImages.filter((_, i) => i !== photoIndex))}
                                                    className="group relative aspect-video overflow-hidden rounded-md border border-zinc-200 bg-white"
                                                    aria-label="Quitar factura"
                                                >
                                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                                    <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-xs font-semibold text-white group-hover:flex">Quitar</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                    {invoiceError ? (
                                        <p className="mt-2 text-xs font-medium text-red-600">{invoiceError}</p>
                                    ) : null}
                                </div>
                            </div>
                        </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {manifestUploadError ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-950">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {manifestUploadError}
                </div>
            ) : null}

            {errors.manifestItems?.message ? (
                <div className="mb-4 rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm font-medium text-zinc-950">
                    {errors.manifestItems.message}
                </div>
            ) : null}

            {/* Add Item Button */}
            <button
                type="button"
                onClick={addItem}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-950 bg-zinc-950 py-3 font-semibold text-white transition-all hover:bg-zinc-800"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Item al Manifiesto
            </button>

            {manifestItems.length === 0 && (
                <p className="mt-2 text-center text-xs text-zinc-500">
                    Agrega items especificos con sus imagenes y 2 facturas obligatorias por item.
                </p>
            )}

            {manifestItems.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-green-200 bg-white/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unidades</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{manifestMetrics.totalUnits}</p>
                    </div>
                    <div className="rounded-xl border border-green-200 bg-white/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peso total</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {manifestMetrics.totalWeightKg > 0 ? `${manifestMetrics.totalWeightKg.toLocaleString('es-CO')} kg` : 'Sin peso por item'}
                        </p>
                    </div>
                    <div className="rounded-xl border border-green-200 bg-white/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Volumen total</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {manifestMetrics.totalVolumeCm3 > 0 ? formatVolumeM3(manifestMetrics.totalVolumeCm3) : 'Sin medidas completas'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Step Components
// =============================================================================

/**
 * Step 1: Cargo Information
 */
function StepCargoInfo({ form }: { form: ReturnType<typeof useForm<CargoOfferFormData>> }) {
    const { t } = useTranslation();
    const { register, watch, setValue, formState: { errors } } = form;

    const cargoTypeOptions = CARGO_TYPES.map((c) => ({
        value: c.code,
        label: c.name,
        description: c.requiresSpecial ? 'Requiere manejo especial' : undefined,
    }));

    const selectedCargoType = watch('cargoType');
    const isRefrigerated = selectedCargoType === 'REFRIGERADA';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
                    <Package className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {t('offers.publish.cargo.title') || 'Información de Carga'}
                </h2>
                <p className="text-slate-600">
                    {t('offers.publish.cargo.subtitle') || 'Describe qué necesitas transportar'}
                </p>
            </div>

            {/* Cargo Type */}
            <Select
                label={t('offers.publish.cargo.type') || 'Tipo de Carga'}
                options={cargoTypeOptions}
                value={watch('cargoType')}
                onChange={(value) => setValue('cargoType', value)}
                errorMessage={errors.cargoType?.message}
                required
                searchable
            />

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    {t('offers.publish.cargo.description') || 'DescripciÃ³n de la Carga'} *
                </label>
                <textarea
                    {...register('cargoDescription', {
                        onChange: () => {
                            if (errors.cargoDescription) {
                                void form.trigger('cargoDescription');
                            }
                        },
                    })}
                    placeholder="Describe detalladamente la mercancia, la presentacion y cualquier cuidado importante para el conductor."
                    rows={4}
                    className={cn(
                        'w-full px-4 py-3 rounded-xl border bg-white transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600',
                        errors.cargoDescription
                            ? 'border-red-500'
                            : 'border-slate-200 hover:border-slate-300'
                    )}
                />
                {errors.cargoDescription && (
                    <p className="mt-2 text-sm text-red-600">{errors.cargoDescription.message}</p>
                )}
            </div>

            {/* Temperature (for refrigerated) */}
            {isRefrigerated && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Info className="w-5 h-5 text-blue-600" />
                        <h4 className="font-medium text-blue-900">Control de Temperatura</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Temperatura Mínima (°C)"
                            type="number"
                            placeholder="-5"
                            {...register('temperatureMin', { valueAsNumber: true })}
                        />
                        <Input
                            label="Temperatura Máxima (°C)"
                            type="number"
                            placeholder="5"
                            {...register('temperatureMax', { valueAsNumber: true })}
                        />
                    </div>
                </div>
            )}

            {/* Manifest Items (Picking List) */}
            <ManifestItemsSection form={form} />
            {errors.manifestItems?.message ? (
                <p className="text-sm text-red-600">{errors.manifestItems.message}</p>
            ) : null}

            {/* Special Requirements */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    {t('offers.publish.cargo.specialReqs') || 'Requisitos Especiales'} (Opcional)
                </label>
                <textarea
                    {...register('specialRequirements')}
                    placeholder="Ej: Requiere manejo con montacargas, carga frágil, etc."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all duration-200"
                />
            </div>
        </div>
    );
}

/**
 * Step 2: Route Information
 */
function StepRouteInfo({
    form,
    country,
}: {
    form: ReturnType<typeof useForm<CargoOfferFormData>>;
    country: 'CO' | 'EC' | 'PE' | 'BR';
}) {
    const { t } = useTranslation();
    const { register, watch, setValue, formState: { errors } } = form;

    const originDepartment = watch('originDepartment');
    const originCity = watch('originCity');
    const destinationDepartment = watch('destinationDepartment');
    const destinationCity = watch('destinationCity');
    const originAddressField = register('originAddress');
    const destinationAddressField = register('destinationAddress');
    const originDepartmentId = watch('originDepartmentId');
    const originMunicipalityId = watch('originMunicipalityId');
    const originLocalZoneId = watch('originLocalZoneId');
    const originLocalZoneName = watch('originLocalZoneName');
    const originLocalZoneType = watch('originLocalZoneType');
    const originAddress = watch('originAddress');
    const originAddressReference = watch('originAddressReference');
    const destinationDepartmentId = watch('destinationDepartmentId');
    const destinationMunicipalityId = watch('destinationMunicipalityId');
    const destinationLocalZoneId = watch('destinationLocalZoneId');
    const destinationLocalZoneName = watch('destinationLocalZoneName');
    const destinationLocalZoneType = watch('destinationLocalZoneType');
    const destinationAddress = watch('destinationAddress');
    const destinationAddressReference = watch('destinationAddressReference');

    const departmentOptions = COLOMBIAN_DEPARTMENTS.map((d) => ({
        value: d.code,
        label: d.name,
        description: d.capital,
    }));

    const originCityOptions = React.useMemo(() => {
        if (!originDepartment) return [];
        return getCitiesByDepartment(originDepartment).map((c) => ({
            value: c.code,
            label: c.name,
        }));
    }, [originDepartment]);

    const destinationCityOptions = React.useMemo(() => {
        if (!destinationDepartment) return [];
        return getCitiesByDepartment(destinationDepartment).map((c) => ({
            value: c.code,
            label: c.name,
        }));
    }, [destinationDepartment]);

    const originLocationValue = React.useMemo<LocationSelectorValue>(() => ({
        countryCode: 'CO',
        departmentId: originDepartmentId || null,
        departmentName: getDepartmentName(originDepartment || ''),
        municipalityId: originMunicipalityId || null,
        municipalityName: getCityName(originCity || ''),
        localZoneId: originLocalZoneId || null,
        localZoneName: originLocalZoneName || '',
        localZoneType: originLocalZoneType || '',
        exactAddress: originAddress || '',
        reference: originAddressReference || '',
        isManualZone: Boolean(originLocalZoneName && !originLocalZoneId),
    }), [
        originAddress,
        originAddressReference,
        originCity,
        originDepartment,
        originDepartmentId,
        originLocalZoneId,
        originLocalZoneName,
        originLocalZoneType,
        originMunicipalityId,
    ]);

    const destinationLocationValue = React.useMemo<LocationSelectorValue>(() => ({
        countryCode: 'CO',
        departmentId: destinationDepartmentId || null,
        departmentName: getDepartmentName(destinationDepartment || ''),
        municipalityId: destinationMunicipalityId || null,
        municipalityName: getCityName(destinationCity || ''),
        localZoneId: destinationLocalZoneId || null,
        localZoneName: destinationLocalZoneName || '',
        localZoneType: destinationLocalZoneType || '',
        exactAddress: destinationAddress || '',
        reference: destinationAddressReference || '',
        isManualZone: Boolean(destinationLocalZoneName && !destinationLocalZoneId),
    }), [
        destinationAddress,
        destinationAddressReference,
        destinationCity,
        destinationDepartment,
        destinationDepartmentId,
        destinationLocalZoneId,
        destinationLocalZoneName,
        destinationLocalZoneType,
        destinationMunicipalityId,
    ]);

    const handleOriginLocationChange = React.useCallback((location: LocationSelectorValue) => {
        setValue('originDepartment', location.departmentName || '', { shouldValidate: true, shouldDirty: true });
        setValue('originCity', location.municipalityName || '', { shouldValidate: true, shouldDirty: true });
        setValue('originAddress', location.exactAddress || '', { shouldValidate: true, shouldDirty: true });
        setValue('originDepartmentId', location.departmentId || null, { shouldDirty: true });
        setValue('originMunicipalityId', location.municipalityId || null, { shouldDirty: true });
        setValue('originLocalZoneId', location.localZoneId || null, { shouldDirty: true });
        setValue('originLocalZoneName', location.localZoneName || '', { shouldDirty: true });
        setValue('originLocalZoneType', location.localZoneType || '', { shouldDirty: true });
        setValue('originAddressReference', location.reference || '', { shouldDirty: true });
        setValue('originLatitude', null, { shouldDirty: true });
        setValue('originLongitude', null, { shouldDirty: true });
    }, [setValue]);

    const handleDestinationLocationChange = React.useCallback((location: LocationSelectorValue) => {
        setValue('destinationDepartment', location.departmentName || '', { shouldValidate: true, shouldDirty: true });
        setValue('destinationCity', location.municipalityName || '', { shouldValidate: true, shouldDirty: true });
        setValue('destinationAddress', location.exactAddress || '', { shouldValidate: true, shouldDirty: true });
        setValue('destinationDepartmentId', location.departmentId || null, { shouldDirty: true });
        setValue('destinationMunicipalityId', location.municipalityId || null, { shouldDirty: true });
        setValue('destinationLocalZoneId', location.localZoneId || null, { shouldDirty: true });
        setValue('destinationLocalZoneName', location.localZoneName || '', { shouldDirty: true });
        setValue('destinationLocalZoneType', location.localZoneType || '', { shouldDirty: true });
        setValue('destinationAddressReference', location.reference || '', { shouldDirty: true });
        setValue('destinationLatitude', null, { shouldDirty: true });
        setValue('destinationLongitude', null, { shouldDirty: true });
    }, [setValue]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {t('offers.publish.route.title') || 'Información de Ruta'}
                </h2>
                <p className="text-slate-600">
                    {t('offers.publish.route.subtitle') || 'Origen, destino y fechas de transporte'}
                </p>
            </div>

            {/* Origin Section */}
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-emerald-900">
                        {t('offers.publish.route.origin') || 'Punto de Origen'}
                    </h3>
                </div>

                {country === 'CO' ? (
                    <>
                        <LocationSelector
                            value={originLocationValue}
                            onChange={handleOriginLocationChange}
                            mode="origen"
                            required
                            allowManualZone
                            showExactAddress
                            showReference
                            defaultDepartment={originDepartment}
                            defaultMunicipality={originCity}
                            className="mb-4 space-y-4"
                        />
                        {errors.originDepartment || errors.originCity || errors.originAddress ? (
                            <p className="mb-4 text-sm font-medium text-red-700">
                                {errors.originDepartment?.message || errors.originCity?.message || errors.originAddress?.message}
                            </p>
                        ) : null}
                    </>
                ) : (
                    <>
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <Select
                                label="Departamento"
                                options={departmentOptions}
                                value={originDepartment}
                                onChange={(value) => {
                                    setValue('originDepartment', value);
                                    setValue('originCity', '');
                                }}
                                errorMessage={errors.originDepartment?.message}
                                searchable
                                required
                            />
                            <Select
                                label="Ciudad"
                                options={originCityOptions}
                                value={originCity}
                                onChange={(value) => setValue('originCity', value)}
                                disabled={!originDepartment}
                                errorMessage={errors.originCity?.message}
                                searchable
                                required
                            />
                        </div>

                        <Input
                            label="Dirección Completa"
                            placeholder="Calle 123 #45-67, Bodega 5"
                            errorMessage={errors.originAddress?.message}
                            {...originAddressField}
                        />
                    </>
                )}

                {/* Pickup Contact - Critical for PIN delivery */}
                <div className="grid md:grid-cols-2 gap-4 mt-4 p-4 bg-emerald-100 border border-emerald-300 rounded-lg">
                    <div>
                        <Input
                            label="Nombre Contacto Recogida *"
                            placeholder="Ej: Juan Bodeguero"
                            errorMessage={errors.pickupContactName?.message}
                            {...register('pickupContactName')}
                        />
                        <p className="text-xs text-emerald-700 mt-1">Este contacto recibirá el PIN de salida</p>
                    </div>
                    <div>
                        <AndeanPhoneInput
                            label="Teléfono Contacto *"
                            value={watch('pickupContactPhone')}
                            onChange={(value) => setValue('pickupContactPhone', value, { shouldValidate: true, shouldDirty: true })}
                            defaultCountryCode={country}
                            errorMessage={errors.pickupContactPhone?.message}
                            helperText="Prefijo andino a la izquierda y celular al lado."
                        />
                        <p className="text-xs text-emerald-700 mt-1">WhatsApp preferido</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <Input
                        label="Fecha de Recogida"
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        errorMessage={errors.pickupDate?.message}
                        {...register('pickupDate')}
                    />
                    <Input
                        label="Hora Desde"
                        type="time"
                        errorMessage={errors.pickupTimeStart?.message}
                        {...register('pickupTimeStart')}
                    />
                    <Input
                        label="Hora Hasta"
                        type="time"
                        errorMessage={errors.pickupTimeEnd?.message}
                        {...register('pickupTimeEnd')}
                    />
                </div>
            </div>

            {/* Route Visual Connector */}
            <div className="flex justify-center">
                <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-slate-300" />
                    <ArrowRight className="w-6 h-6 text-slate-400 rotate-90" />
                    <div className="w-px h-6 bg-slate-300" />
                </div>
            </div>

            {/* Destination Section */}
            <div className="p-6 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-orange-900">
                        {t('offers.publish.route.destination') || 'Punto de Destino'}
                    </h3>
                </div>

                {country === 'CO' ? (
                    <>
                        <LocationSelector
                            value={destinationLocationValue}
                            onChange={handleDestinationLocationChange}
                            mode="destino"
                            required
                            allowManualZone
                            showExactAddress
                            showReference
                            defaultDepartment={destinationDepartment}
                            defaultMunicipality={destinationCity}
                            className="mb-4 space-y-4"
                        />
                        {errors.destinationDepartment || errors.destinationCity || errors.destinationAddress ? (
                            <p className="mb-4 text-sm font-medium text-red-700">
                                {errors.destinationDepartment?.message || errors.destinationCity?.message || errors.destinationAddress?.message}
                            </p>
                        ) : null}
                    </>
                ) : (
                    <>
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <Select
                                label="Departamento"
                                options={departmentOptions}
                                value={destinationDepartment}
                                onChange={(value) => {
                                    setValue('destinationDepartment', value);
                                    setValue('destinationCity', '');
                                }}
                                errorMessage={errors.destinationDepartment?.message}
                                searchable
                                required
                            />
                            <Select
                                label="Ciudad"
                                options={destinationCityOptions}
                                value={destinationCity}
                                onChange={(value) => setValue('destinationCity', value)}
                                disabled={!destinationDepartment}
                                errorMessage={errors.destinationCity?.message}
                                searchable
                                required
                            />
                        </div>

                        <Input
                            label="Dirección Completa"
                            placeholder="Zona Industrial Norte, Bodega 12"
                            errorMessage={errors.destinationAddress?.message}
                            {...destinationAddressField}
                        />
                    </>
                )}

                {/* Delivery Contact - Critical for PIN delivery */}
                <div className="grid md:grid-cols-2 gap-4 mt-4 p-4 bg-green-100 border border-green-400 rounded-lg">
                    <div>
                        <Input
                            label="Nombre Contacto Entrega *"
                            placeholder="Ej: Ing. María López"
                            errorMessage={errors.deliveryContactName?.message}
                            {...register('deliveryContactName')}
                        />
                        <p className="text-xs text-green-800 mt-1">Este contacto recibirá el PIN de entrega</p>
                    </div>
                    <div>
                        <AndeanPhoneInput
                            label="Teléfono Contacto *"
                            value={watch('deliveryContactPhone')}
                            onChange={(value) => setValue('deliveryContactPhone', value, { shouldValidate: true, shouldDirty: true })}
                            defaultCountryCode={country}
                            errorMessage={errors.deliveryContactPhone?.message}
                            helperText="Prefijo andino a la izquierda y celular al lado."
                        />
                        <p className="text-xs text-green-800 mt-1">WhatsApp preferido</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <Input
                        label="Fecha de Entrega"
                        type="date"
                        min={watch('pickupDate') || new Date().toISOString().split('T')[0]}
                        errorMessage={errors.deliveryDate?.message}
                        {...register('deliveryDate')}
                    />
                    <Input
                        label="Hora Desde"
                        type="time"
                        errorMessage={errors.deliveryTimeStart?.message}
                        {...register('deliveryTimeStart')}
                    />
                    <Input
                        label="Hora Hasta"
                        type="time"
                        errorMessage={errors.deliveryTimeEnd?.message}
                        {...register('deliveryTimeEnd')}
                    />
                </div>
            </div>

            <WarehouseOfferFields
                watch={watch}
                setValue={(name, value) => setValue(name, value)}
            />
        </div>
    );
}

/**
 * Step 3: Payment Terms
 */
function StepPaymentTerms({
    form,
    privateFleetMembers,
    fleetLoading,
    fleetLoadError,
}: {
    form: ReturnType<typeof useForm<CargoOfferFormData>>;
    privateFleetMembers: BusinessFleetMember[];
    fleetLoading: boolean;
    fleetLoadError: string | null;
}) {
    const { t } = useTranslation();
    const { register, watch, setValue, formState: { errors } } = form;
    const assignmentMode = watch('assignmentMode');
    const compensationMode = watch('compensationMode') || 'salary_no_trip_pay';
    const totalAmount = Number(watch('totalAmount') || 0);
    const freightPaymentAmount = Number(watch('freightPaymentAmount') || 0);
    const expenseAllowanceAmount = Number(watch('expenseAllowanceAmount') || 0);
    const allowsTripPay = compensationMode === 'trip_pay' || compensationMode === 'trip_pay_plus_expenses';
    const allowsExpenses = compensationMode === 'expenses_only' || compensationMode === 'trip_pay_plus_expenses';
    const compensationOptions = [
        {
            value: 'salary_no_trip_pay',
            label: 'Contrato mensual',
            description: 'La ruta no paga flete; el conductor cobra por nomina mensual separada.',
        },
        {
            value: 'trip_pay',
            label: 'Pago por ruta',
            description: 'La empresa fondea un flete privado para esta ruta.',
        },
        {
            value: 'expenses_only',
            label: 'Solo gastos',
            description: 'Entrega gastos operativos del viaje sin flete privado.',
        },
        {
            value: 'trip_pay_plus_expenses',
            label: 'Ruta + gastos',
            description: 'Flete privado y gastos operativos dentro de KargaX.',
        },
    ] as const;
    const releasePolicyOptions = [
        { value: 'acceptance', label: 'Al confirmar ruta' },
        { value: 'pickup_pin', label: 'Al validar PIN de cargue' },
        { value: 'delivery_pod', label: 'Al entregar POD' },
        { value: 'manual', label: 'Manual por finanzas' },
    ];
    const privateFleetOptions = privateFleetMembers
        .filter((member) => member.status === 'active')
        .map((member) => ({
            value: member.trucker_id,
            label: member.user?.full_name || member.user?.email || 'Conductor privado',
            description: [
                member.internal_driver_id ? `ID ${member.internal_driver_id}` : null,
                member.vehicle_plate ? `Placa ${member.vehicle_plate}` : null,
                member.user?.phone || null,
            ].filter(Boolean).join(' • ') || 'Miembro activo de tu flota',
        }));

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {t('offers.publish.payment.title') || 'Asignacion y Pago'}
                </h2>
                <p className="text-slate-600">
                    {t('offers.publish.payment.subtitle') || 'Define si la ruta va al marketplace o a tu flota privada y publica el valor del flete.'}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <button
                    type="button"
                    onClick={() => {
                        setValue('assignmentMode', 'public', { shouldValidate: true });
                        setValue('privateFleetTruckerId', '', { shouldValidate: true });
                        setValue('compensationMode', 'salary_no_trip_pay', { shouldValidate: true });
                        setValue('expensesReleasePolicy', 'acceptance', { shouldValidate: true });
                        setValue('freightPaymentAmount', 0, { shouldValidate: true });
                        setValue('expenseAllowanceAmount', 0, { shouldValidate: true });
                    }}
                    className={cn(
                        'rounded-2xl border p-5 text-left transition-all',
                        assignmentMode === 'public'
                            ? 'border-zinc-950 bg-zinc-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-700">Marketplace</p>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">Oferta pública</h3>
                    <p className="mt-2 text-sm text-slate-600">
                        Publicas la ruta para recibir postulaciones y luego eliges al mejor camionero.
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setValue('assignmentMode', 'private', { shouldValidate: true });
                        setValue('totalAmount', 0, { shouldValidate: true });
                        setValue('compensationMode', 'salary_no_trip_pay', { shouldValidate: true });
                        setValue('expensesReleasePolicy', 'acceptance', { shouldValidate: true });
                        setValue('freightPaymentAmount', 0, { shouldValidate: true });
                        setValue('expenseAllowanceAmount', 0, { shouldValidate: true });
                    }}
                    className={cn(
                        'rounded-2xl border p-5 text-left transition-all',
                        assignmentMode === 'private'
                            ? 'border-zinc-950 bg-zinc-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-700">Flota propia</p>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">Asignación directa</h3>
                    <p className="mt-2 text-sm text-slate-600">
                        Seleccionas un conductor de tu empresa y la ruta nace lista para confirmar en su app.
                    </p>
                </button>
            </div>

            {assignmentMode === 'private' ? (
                <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-zinc-950 p-2.5">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">Asignación privada a tu flota</h3>
                            <p className="mt-1 text-sm text-slate-600">
                                El conductor recibe la ruta en su app y puede confirmarla sin pasar por postulaciones públicas.
                            </p>
                        </div>
                    </div>

                    <Select
                        label="Conductor de tu flota"
                        options={privateFleetOptions}
                        value={watch('privateFleetTruckerId') || ''}
                        onChange={(value) => setValue('privateFleetTruckerId', value, { shouldValidate: true })}
                        errorMessage={errors.privateFleetTruckerId?.message}
                        placeholder={fleetLoading ? 'Cargando conductores...' : 'Selecciona un conductor'}
                        disabled={fleetLoading || privateFleetOptions.length === 0}
                        searchable
                        required
                    />

                    {fleetLoadError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {fleetLoadError}
                        </div>
                    ) : null}

                    {!fleetLoading && privateFleetOptions.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm font-semibold text-amber-900">Aún no tienes conductores privados activos</p>
                            <p className="mt-1 text-xs text-amber-800">
                                Invítalos desde `/dashboard/flota` para poder asignar viajes directos.
                            </p>
                        </div>
                    ) : null}

                    <div className="space-y-3">
                        <div>
                            <p className="text-sm font-semibold text-zinc-950">Modelo de compensacion</p>
                            <p className="mt-1 text-sm text-zinc-600">
                                Define si esta ruta solo asigna operacion, paga por ruta o entrega gastos del viaje.
                            </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {compensationOptions.map((option) => {
                                const selected = compensationMode === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            setValue('compensationMode', option.value, { shouldValidate: true, shouldDirty: true });
                                            if (option.value === 'salary_no_trip_pay' || option.value === 'expenses_only') {
                                                setValue('freightPaymentAmount', 0, { shouldValidate: true, shouldDirty: true });
                                            }
                                            if (option.value === 'salary_no_trip_pay' || option.value === 'trip_pay') {
                                                setValue('expenseAllowanceAmount', 0, { shouldValidate: true, shouldDirty: true });
                                            }
                                        }}
                                        className={cn(
                                            'rounded-lg border p-4 text-left transition-all',
                                            selected
                                                ? 'border-zinc-950 bg-zinc-50 shadow-sm'
                                                : 'border-zinc-200 bg-white hover:border-zinc-400'
                                        )}
                                    >
                                        <p className="text-sm font-semibold text-zinc-950">{option.label}</p>
                                        <p className="mt-1 text-xs leading-5 text-zinc-500">{option.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {compensationMode === 'salary_no_trip_pay' ? (
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-950">
                            <p className="font-semibold">Contrato mensual separado</p>
                            <p className="mt-1 text-zinc-600">
                                Esta ruta no genera flete por viaje. La nomina mensual se crea y fondea desde flota privada.
                            </p>
                        </div>
                    ) : null}

                    {allowsTripPay ? (
                        <div className="rounded-lg border border-zinc-200 bg-white p-5">
                            <label className="block text-sm font-medium text-zinc-950 mb-2">
                                Pago privado por ruta (COP) *
                            </label>
                            <div className="flex items-center gap-3">
                                <span className="text-xl font-bold text-zinc-950">$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="900.000"
                                    value={freightPaymentAmount > 0 ? freightPaymentAmount.toLocaleString('es-CO') : ''}
                                    onChange={(event) => {
                                        const nextAmount = Number(event.target.value.replace(/\D/g, ''));
                                        setValue('freightPaymentAmount', Number.isFinite(nextAmount) ? nextAmount : 0, {
                                            shouldValidate: true,
                                            shouldDirty: true,
                                        });
                                    }}
                                    className={cn(
                                        'flex-1 rounded-xl border bg-white px-4 py-3 text-2xl font-bold text-slate-900',
                                        'focus:outline-none focus:ring-2 focus:ring-zinc-950/20 focus:border-zinc-950',
                                        errors.freightPaymentAmount ? 'border-red-500' : 'border-zinc-200'
                                    )}
                                />
                                <span className="text-sm font-semibold text-zinc-600">COP</span>
                            </div>
                            {errors.freightPaymentAmount ? (
                                <p className="mt-2 text-sm text-red-600">{errors.freightPaymentAmount.message}</p>
                            ) : null}
                        </div>
                    ) : null}

                    {allowsExpenses ? (
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,.8fr)]">
                            <div className="rounded-lg border border-zinc-200 bg-white p-5">
                                <label className="block text-sm font-medium text-zinc-950 mb-2">
                                    Gastos del viaje (COP){['expenses_only', 'trip_pay_plus_expenses'].includes(compensationMode) ? ' *' : ' (opcional)'}
                                </label>
                                <div className="flex items-center gap-3">
                                    <span className="text-xl font-bold text-zinc-950">$</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="250.000"
                                        value={expenseAllowanceAmount > 0 ? expenseAllowanceAmount.toLocaleString('es-CO') : ''}
                                        onChange={(event) => {
                                            const nextAmount = Number(event.target.value.replace(/\D/g, ''));
                                            setValue('expenseAllowanceAmount', Number.isFinite(nextAmount) ? nextAmount : 0, {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            });
                                        }}
                                        className={cn(
                                            'flex-1 rounded-xl border bg-white px-4 py-3 text-2xl font-bold text-slate-900',
                                            'focus:outline-none focus:ring-2 focus:ring-zinc-950/20 focus:border-zinc-950',
                                            errors.expenseAllowanceAmount ? 'border-red-500' : 'border-zinc-200'
                                        )}
                                    />
                                    <span className="text-sm font-semibold text-zinc-600">COP</span>
                                </div>
                                {errors.expenseAllowanceAmount ? (
                                    <p className="mt-2 text-sm text-red-600">{errors.expenseAllowanceAmount.message}</p>
                                ) : null}
                            </div>

                            <Select
                                label="Liberacion de gastos"
                                options={releasePolicyOptions}
                                value={watch('expensesReleasePolicy') || 'acceptance'}
                                onChange={(value) => setValue('expensesReleasePolicy', value as CargoOfferFormData['expensesReleasePolicy'], { shouldValidate: true })}
                            />
                        </div>
                    ) : null}

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-950">
                        <p className="font-semibold">Ruta directa</p>
                        <p className="mt-1 text-zinc-600">
                            Esta asignación envía el viaje directo al conductor seleccionado y conserva la misma trazabilidad operativa.
                        </p>
                    </div>
                </div>
            ) : null}

            {assignmentMode === 'public' ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-[0_18px_44px_-38px_rgba(10,10,10,.55)]">
                <label className="block text-sm font-medium text-zinc-950 mb-2">
                    Flete ofrecido al conductor (COP) *
                </label>
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-zinc-950">$</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="1.500.000"
                        value={totalAmount > 0 ? totalAmount.toLocaleString('es-CO') : ''}
                        onChange={(event) => {
                            const nextAmount = Number(event.target.value.replace(/\D/g, ''));
                            setValue('totalAmount', Number.isFinite(nextAmount) ? nextAmount : 0, {
                                shouldValidate: true,
                                shouldDirty: true,
                            });
                        }}
                        className={cn(
                            'flex-1 rounded-xl border bg-white px-4 py-3 text-3xl font-bold text-slate-900',
                            'focus:outline-none focus:ring-2 focus:ring-zinc-950/20 focus:border-zinc-950',
                            errors.totalAmount ? 'border-red-500' : 'border-zinc-200'
                        )}
                    />
                    <span className="text-xl text-zinc-600">COP</span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                    Este valor es el pago base del viaje que verá el conductor al evaluar la ruta.
                </p>
                {totalAmount > 0 ? (
                    <p className="mt-2 text-lg font-bold text-zinc-950">
                        {formatCOP(totalAmount)}
                    </p>
                ) : null}
                {errors.totalAmount ? (
                    <p className="mt-2 text-sm text-red-600">{errors.totalAmount.message}</p>
                ) : null}
            </div>
            ) : null}

            {assignmentMode === 'private' ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-950">
                    <p className="font-semibold">Flujo corporativo privado</p>
                    <p className="mt-1 text-zinc-600">
                        Esta ruta no entra al marketplace publico. La empresa conserva trazabilidad, wallet y contabilidad privada.
                    </p>
                </div>
            ) : null}

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Condiciones Adicionales (Opcional)
                </label>
                <textarea
                    {...register('additionalTerms')}
                    placeholder="Ej: validacion en bodega, ventana de recibo, observaciones logísticas..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all duration-200"
                />
            </div>
        </div>
    );
}

/**
 * Step 4: Requirements
 */
function StepRequirements({ form }: { form: ReturnType<typeof useForm<CargoOfferFormData>> }) {
    const { t } = useTranslation();
    const { register, watch, setValue, formState: { errors } } = form;

    const vehicleOptions = VEHICLE_TYPES.map((v) => ({
        value: v.code,
        label: v.name,
        description: `${v.capacityTons} ton • ${v.volumeM3} m³`,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <Truck className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {t('offers.publish.requirements.title') || 'Requisitos del Transporte'}
                </h2>
                <p className="text-slate-600">
                    {t('offers.publish.requirements.subtitle') || 'Tipo de vehículo y conductor'}
                </p>
            </div>

            {/* Vehicle Type */}
            <Select
                label="Tipo de Vehículo Requerido"
                options={vehicleOptions}
                value={watch('vehicleType')}
                onChange={(value) => setValue('vehicleType', value)}
                errorMessage={errors.vehicleType?.message}
                searchable
                required
            />

            {/* Experience */}
            <Input
                label="Años Mínimos de Experiencia"
                type="number"
                min={0}
                max={50}
                placeholder="3"
                {...register('minExperienceYears', { valueAsNumber: true })}
            />

            {/* Insurance */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        {...register('insuranceRequired')}
                        className="w-5 h-5 rounded border-slate-300 text-green-700 focus:ring-green-600"
                    />
                    <div>
                        <span className="font-medium text-slate-900">
                            Seguro de Mercancía Obligatorio
                        </span>
                        <p className="text-sm text-slate-500">
                            El transportador debe contar con seguro vigente
                        </p>
                    </div>

                </label>
            </div>

            {/* Additional Requirements */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Requisitos Adicionales (Opcional)
                </label>
                <textarea
                    {...register('additionalRequirements')}
                    placeholder="Ej: Licencia para cargas peligrosas, certificación BASC..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all duration-200"
                />
            </div>
        </div>
    );
}

/**
 * Step 5: Photos — Real upload to Supabase Storage
 */
function StepPhotos({ form }: { form: ReturnType<typeof useForm<CargoOfferFormData>> }) {
    const { t } = useTranslation();
    const { watch, setValue } = form;
    const photos = watch('photos') || [];
    const [uploading, setUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const remaining = 5 - photos.length;
        if (remaining <= 0) { setUploadError('Máximo 5 fotos permitidas'); return; }

        const filesToUpload = Array.from(files).slice(0, remaining);
        const invalidFiles = filesToUpload.filter(
            (f) => !OFFER_PHOTO_MIME_TYPES.includes(f.type) || f.size > OFFER_PHOTO_MAX_BYTES
        );
        if (invalidFiles.length > 0) { setUploadError('Solo imágenes PNG, JPG o WebP de hasta 5MB'); return; }

        setUploading(true);
        setUploadError(null);
        try {
            const newUrls: string[] = [];
            for (const file of filesToUpload) {
                newUrls.push(await uploadOfferPhotoFile(file, 'offers'));
            }
            if (newUrls.length > 0) setValue('photos', [...photos, ...newUrls]);
        } catch (err) {
            setUploadError('Error al subir las fotos. Intenta de nuevo.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removePhoto = (index: number) => {
        setValue('photos', photos.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center">
                    <ImagePlus className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {t('offers.publish.photos.title') || 'Fotos de la Carga'}
                </h2>
                <p className="text-slate-600">
                    {t('offers.publish.photos.subtitle') || 'Opcional: Ayuda a los transportadores'}
                </p>
            </div>

            {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {photos.map((url, index) => (
                        <div key={url} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                            <img src={url} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removePhoto(index)}
                                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                                <span className="text-white text-xs font-medium">Foto {index + 1}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)} />

            {photos.length < 5 && (
                <div onClick={() => !uploading && fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (!uploading) handleFileSelect(e.dataTransfer.files); }}
                    className={cn(
                        'border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
                        uploading ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-green-500 hover:bg-green-50/50'
                    )}>
                    {uploading ? (
                        <>
                            <Loader2 className="w-12 h-12 mx-auto text-green-500 mb-4 animate-spin" />
                            <p className="text-green-700 font-medium">Subiendo fotos...</p>
                        </>
                    ) : (
                        <>
                            <ImagePlus className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                            <p className="text-slate-600 mb-2">Arrastra fotos aquí o haz clic para seleccionar</p>
                            <p className="text-sm text-slate-400">{photos.length}/5 fotos · PNG, JPG o WebP hasta 5MB</p>
                        </>
                    )}
                </div>
            )}

            {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {uploadError}
                </div>
            )}

            <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-green-700 mt-0.5" />
                <div>
                    <p className="font-medium text-orange-900">Este paso es opcional</p>
                    <p className="text-sm text-green-800">
                        Las fotos ayudan a los transportadores a entender mejor la carga, pero puedes publicar sin ellas.
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Step 6: Review
 */
function StepReview({
    form,
    privateFleetMembers,
}: {
    form: ReturnType<typeof useForm<CargoOfferFormData>>;
    privateFleetMembers: BusinessFleetMember[];
}) {
    const { t } = useTranslation();
    const { watch } = form;
    const data = watch();

    const cargoType = CARGO_TYPES.find((c) => c.code === data.cargoType);
    const vehicleType = VEHICLE_TYPES.find((v) => v.code === data.vehicleType);
    const selectedPrivateDriver = privateFleetMembers.find((member) => member.trucker_id === data.privateFleetTruckerId);
    const isPrivateAssignment = data.assignmentMode === 'private';
    const manifestMetrics = getManifestMetrics((data.manifestItems || []) as ManifestItemDraftInput[]);
    const compensationLabel: Record<NonNullable<CargoOfferFormData['compensationMode']>, string> = {
        salary_no_trip_pay: 'Contrato mensual',
        trip_pay: 'Pago por ruta',
        expenses_only: 'Solo gastos',
        trip_pay_plus_expenses: 'Pago por ruta + gastos',
    };
    const privateFreightAmount = Number(data.freightPaymentAmount || 0);
    const privateExpenseAmount = Number(data.expenseAllowanceAmount || 0);

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {t('offers.publish.review.title') || 'Revisar y Publicar'}
                </h2>
                <p className="text-slate-600">
                    {t('offers.publish.review.subtitle') || 'Verifica que todo esté correcto'}
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Carga
                    </h4>
                    <dl className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-slate-500">Tipo:</dt>
                            <dd className="font-medium">{cargoType?.name || '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-slate-500">Peso:</dt>
                            <dd className="font-medium">
                                {manifestMetrics.totalWeightKg > 0 ? manifestMetrics.totalWeightKg : 1} kg
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-slate-500">Cantidad:</dt>
                            <dd className="font-medium">
                                {manifestMetrics.totalUnits > 0 ? manifestMetrics.totalUnits : 1} unidades
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Ruta
                    </h4>
                    <dl className="space-y-1 text-sm">
                        <div className="flex items-start gap-2">
                            <dt className="text-slate-500">Origen:</dt>
                            <dd className="font-medium">{data.originCity ? getCityName(data.originCity) : '-'}</dd>
                        </div>
                        <div className="flex items-start gap-2">
                            <dt className="text-slate-500">Destino:</dt>
                            <dd className="font-medium">{data.destinationCity ? getCityName(data.destinationCity) : '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-slate-500">Fecha:</dt>
                            <dd className="font-medium">{data.pickupDate || '-'}</dd>
                        </div>
                    </dl>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-zinc-950">
                        <CreditCard className="w-4 h-4" />
                        {isPrivateAssignment ? 'Contrato privado' : 'Pago del viaje'}
                    </h4>
                    <p className="text-2xl font-bold text-zinc-950">
                        {isPrivateAssignment
                            ? compensationLabel[data.compensationMode || 'salary_no_trip_pay']
                            : (data.totalAmount ? formatCOP(Number(data.totalAmount || 0)) : '-')}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                        {isPrivateAssignment
                            ? [
                                privateFreightAmount > 0 ? `Flete privado ${formatCOP(privateFreightAmount)}` : null,
                                privateExpenseAmount > 0 ? `Gastos ${formatCOP(privateExpenseAmount)}` : null,
                                privateFreightAmount === 0 && privateExpenseAmount === 0 ? 'La ruta no paga flete por viaje; se liquida por nomina mensual separada.' : null,
                            ].filter(Boolean).join(' | ')
                            : 'Este valor se publica para que los transportadores evaluen la ruta.'}
                    </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Vehículo
                    </h4>
                    <p className="font-medium">{vehicleType?.name || '-'}</p>
                    <p className="text-sm text-slate-500">
                        {data.minExperienceYears} años de experiencia
                    </p>
                </div>
            </div>

            <div className={cn(
                'rounded-2xl border p-5',
                isPrivateAssignment ? 'border-zinc-200 bg-zinc-50' : 'border-slate-200 bg-slate-50'
            )}>
                <p className={cn(
                    'text-xs font-semibold uppercase tracking-[0.18em]',
                    isPrivateAssignment ? 'text-zinc-700' : 'text-slate-500'
                )}>
                    Modo de asignación
                </p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">
                    {isPrivateAssignment ? 'Privada - Mi flota' : 'Pública - Marketplace'}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                    {isPrivateAssignment
                        ? 'El viaje se enviará directo al conductor seleccionado y quedará esperando su confirmación.'
                        : 'La ruta se publicará para recibir postulaciones de transportadores verificados.'}
                </p>
                {isPrivateAssignment && selectedPrivateDriver ? (
                    <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
                        <p className="font-semibold text-slate-900">
                            {selectedPrivateDriver.user?.full_name || selectedPrivateDriver.user?.email || 'Conductor privado'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            {selectedPrivateDriver.vehicle_plate ? `Placa ${selectedPrivateDriver.vehicle_plate}` : 'Placa pendiente'}
                            {selectedPrivateDriver.internal_driver_id ? ` • ID ${selectedPrivateDriver.internal_driver_id}` : ''}
                        </p>
                    </div>
                ) : null}
            </div>

            {(data.manifestItems || []).length > 0 && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                    <h3 className="text-lg font-bold text-slate-900">Resumen del manifiesto</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
                            <p className="mt-1 text-xl font-bold text-slate-900">{manifestMetrics.totalItems}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unidades</p>
                            <p className="mt-1 text-xl font-bold text-slate-900">{manifestMetrics.totalUnits}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peso total</p>
                            <p className="mt-1 text-xl font-bold text-slate-900">
                                {manifestMetrics.totalWeightKg > 0 ? `${manifestMetrics.totalWeightKg.toLocaleString('es-CO')} kg` : 'Pendiente'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Volumen total</p>
                            <p className="mt-1 text-xl font-bold text-slate-900">
                                {manifestMetrics.totalVolumeCm3 > 0 ? formatVolumeM3(manifestMetrics.totalVolumeCm3) : 'Pendiente'}
                            </p>
                        </div>
                    </div>
                    {manifestMetrics.itemsWithoutDimensions > 0 && (
                        <p className="mt-3 text-sm text-slate-600">
                            {manifestMetrics.itemsWithoutDimensions} item(s) aun no tienen medidas completas y no entran en el calculo de volumen.
                        </p>
                    )}
                </div>
            )}

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        className="mt-1 w-5 h-5 rounded border-slate-300 text-green-700 focus:ring-green-600"
                        required
                    />
                    <span className="text-sm text-slate-600">
                        Confirmo que la información es correcta y acepto los{' '}
                        <a href="/terminos" className="text-green-700 hover:underline">
                            Términos de Servicio
                        </a>{' '}
                        de KargaX
                    </span>
                </label>
            </div>
        </div>
    );
}

// =============================================================================
// Step Progress Indicator
// =============================================================================

function StepIndicator({
    steps,
    currentStep,
    onStepClick,
}: {
    steps: StepConfig[];
    currentStep: number;
    onStepClick: (index: number) => void;
}) {
    return (
        <div className="hidden xl:flex items-center justify-center mb-8">
            {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                    <React.Fragment key={step.id}>
                        <button
                            onClick={() => onStepClick(index)}
                            disabled={index > currentStep}
                            className={cn(
                                'flex min-w-0 flex-col items-center gap-2 rounded-lg px-3 py-2 transition-all',
                                isActive && 'bg-green-50',
                                isCompleted && 'cursor-pointer hover:bg-slate-50',
                                index > currentStep && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            <div
                                className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                                    isActive && 'bg-green-600 text-white',
                                    isCompleted && 'bg-green-500 text-white',
                                    !isActive && !isCompleted && 'bg-slate-200 text-slate-500'
                                )}
                            >
                                {isCompleted ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <Icon className="w-5 h-5" />
                                )}
                            </div>
                            <span
                                className={cn(
                                    'max-w-24 truncate text-xs font-medium',
                                    isActive && 'text-green-800',
                                    isCompleted && 'text-green-700',
                                    !isActive && !isCompleted && 'text-slate-500'
                                )}
                            >
                                {step.title}
                            </span>
                        </button>

                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    'w-12 h-0.5 mx-2',
                                    index < currentStep ? 'bg-green-500' : 'bg-slate-200'
                                )}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// =============================================================================
// Mobile Step Indicator
// =============================================================================

function MobileStepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
    return (
        <div className="mb-6 xl:hidden">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">
                    Paso {currentStep + 1} de {totalSteps}
                </span>
                <span className="text-sm text-green-700 font-medium">
                    {Math.round(((currentStep + 1) / totalSteps) * 100)}%
                </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                    className="h-full bg-green-600 rounded-full"
                />
            </div>
        </div>
    );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function PublishOfferPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useAuthStore();
    const { country, config } = useUserCountry();

    const [currentStep, setCurrentStep] = React.useState(0);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [privateFleetMembers, setPrivateFleetMembers] = React.useState<BusinessFleetMember[]>([]);
    const [fleetLoading, setFleetLoading] = React.useState(false);
    const [fleetLoadError, setFleetLoadError] = React.useState<string | null>(null);
    const [planLimitDetails, setPlanLimitDetails] = React.useState<PlanLimitErrorDetails | null>(null);
    const [planLimitOpen, setPlanLimitOpen] = React.useState(false);

    const form = useForm<CargoOfferFormData>({
        resolver: zodResolver(offerSchema) as unknown as Resolver<CargoOfferFormData>,
        defaultValues: {
            cargoType: '',
            cargoDescription: '',
            weightKg: 0,
            quantity: 1,
            specialRequirements: '',
            // Route
            originDepartment: '',
            originCity: '',
            originAddress: '',
            originDepartmentId: null,
            originMunicipalityId: null,
            originLocalZoneId: null,
            originLocalZoneName: '',
            originLocalZoneType: '',
            originAddressReference: '',
            originLatitude: null,
            originLongitude: null,
            pickupContactName: '',
            pickupContactPhone: '',
            destinationDepartment: '',
            destinationCity: '',
            destinationAddress: '',
            destinationDepartmentId: null,
            destinationMunicipalityId: null,
            destinationLocalZoneId: null,
            destinationLocalZoneName: '',
            destinationLocalZoneType: '',
            destinationAddressReference: '',
            destinationLatitude: null,
            destinationLongitude: null,
            deliveryContactName: '',
            deliveryContactPhone: '',
            pickupDate: '',
            pickupTimeStart: '',
            pickupTimeEnd: '',
            deliveryDate: '',
            deliveryTimeStart: '',
            deliveryTimeEnd: '',
            warehouseFlowMode: 'manual',
            originWarehouseId: '',
            destinationWarehouseId: '',
            originDockId: '',
            destinationDockId: '',
            // Payment
            assignmentMode: 'public',
            privateFleetTruckerId: '',
            compensationMode: 'salary_no_trip_pay',
            expensesReleasePolicy: 'acceptance',
            totalAmount: 0,
            freightPaymentAmount: 0,
            expenseAllowanceAmount: 0,
            paymentMethod: 'bank_transfer',
            paymentSchedule: 'on_delivery',
            additionalTerms: '',
            // Requirements
            vehicleType: '',
            minExperienceYears: 1,
            insuranceRequired: true,
            additionalRequirements: '',
            photos: [],
        },
        mode: 'onBlur',
    });

    // Restrict to business users
    React.useEffect(() => {
        if (user && user.userType === 'trucker') {
            toast.warning('Acceso restringido', 'Solo las empresas pueden publicar ofertas');
            router.push('/ofertas');
        }
    }, [user, router]);

    React.useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);

        if (searchParams.get('assignmentMode') !== 'private') {
            return;
        }

        form.setValue('assignmentMode', 'private', { shouldValidate: true });
        form.setValue('warehouseFlowMode', searchParams.get('warehouseFlowMode') === 'warehouse_managed' ? 'warehouse_managed' : 'manual', { shouldValidate: true });
        form.setValue('compensationMode', 'salary_no_trip_pay', { shouldValidate: true });
        form.setValue('expensesReleasePolicy', 'acceptance', { shouldValidate: true });
    }, [form]);

    React.useEffect(() => {
        if (!user || (user.userType !== 'business' && user.userType !== 'admin')) {
            return;
        }

        let cancelled = false;

        const loadFleet = async () => {
            setFleetLoading(true);
            setFleetLoadError(null);
            try {
                const response = await warehouseClient.getBusinessFleet();
                if (!cancelled) {
                    setPrivateFleetMembers(response.data || []);
                }
            } catch (error) {
                if (!cancelled) {
                    setFleetLoadError(error instanceof Error ? error.message : 'No se pudo cargar la flota privada');
                }
            } finally {
                if (!cancelled) {
                    setFleetLoading(false);
                }
            }
        };

        void loadFleet();

        return () => {
            cancelled = true;
        };
    }, [user]);

    const handleStepInvalid = React.useCallback((message: string, fieldName?: string) => {
        if (fieldName) {
            form.setError(fieldName as keyof CargoOfferFormData, {
                type: 'manual',
                message,
            });
        }
        toast.error('Completa este paso', message);
        return false;
    }, [form]);

    const validateCurrentStep = React.useCallback(() => {
        const data = form.getValues();

        if (currentStep === 0) {
            form.clearErrors(['cargoType', 'cargoDescription', 'manifestItems']);

            if (!data.cargoType) {
                return handleStepInvalid('Selecciona el tipo de carga.', 'cargoType');
            }

            if (!data.cargoDescription?.trim() || data.cargoDescription.trim().length < 10) {
                return handleStepInvalid('Escribe una descripcion de carga de al menos 10 caracteres.', 'cargoDescription');
            }

            const manifestItems = (data.manifestItems || []) as ManifestItemDraftInput[];
            if (!manifestItems.length) {
                return handleStepInvalid('Agrega al menos un item al manifiesto.', 'manifestItems');
            }

            const emptyItemIndex = manifestItems.findIndex((item) => !item.name?.trim());
            if (emptyItemIndex >= 0) {
                return handleStepInvalid(`Completa el nombre del item ${emptyItemIndex + 1}.`, `manifestItems.${emptyItemIndex}.name`);
            }

            const invalidQuantityIndex = manifestItems.findIndex((item) => Number(item.quantity || 0) < 1);
            if (invalidQuantityIndex >= 0) {
                return handleStepInvalid(`La cantidad del item ${invalidQuantityIndex + 1} debe ser mayor a cero.`, `manifestItems.${invalidQuantityIndex}.quantity`);
            }

            const missingInvoicesIndex = manifestItems.findIndex((item) => (item.invoicePhotoUrls || []).filter(Boolean).length < 2);
            if (missingInvoicesIndex >= 0) {
                return handleStepInvalid(`Sube 2 facturas para el item ${missingInvoicesIndex + 1}.`, `manifestItems.${missingInvoicesIndex}.invoicePhotoUrls`);
            }

            return true;
        }

        if (currentStep === 1) {
            const requiredRouteFields: Array<[keyof CargoOfferFormData, string]> = [
                ['originDepartment', 'Selecciona el departamento de origen.'],
                ['originCity', 'Selecciona la ciudad de origen.'],
                ['originAddress', 'Escribe la direccion de origen.'],
                ['pickupContactName', 'Escribe el contacto de recogida.'],
                ['pickupContactPhone', 'Escribe un celular valido para recogida.'],
                ['destinationDepartment', 'Selecciona el departamento de destino.'],
                ['destinationCity', 'Selecciona la ciudad de destino.'],
                ['destinationAddress', 'Escribe la direccion de destino.'],
                ['deliveryContactName', 'Escribe el contacto de entrega.'],
                ['deliveryContactPhone', 'Escribe un celular valido para entrega.'],
                ['pickupDate', 'Selecciona fecha de recogida.'],
                ['pickupTimeStart', 'Selecciona hora inicial de recogida.'],
                ['pickupTimeEnd', 'Selecciona hora final de recogida.'],
                ['deliveryDate', 'Selecciona fecha de entrega.'],
                ['deliveryTimeStart', 'Selecciona hora inicial de entrega.'],
                ['deliveryTimeEnd', 'Selecciona hora final de entrega.'],
            ];

            form.clearErrors(requiredRouteFields.map(([field]) => field));

            for (const [field, message] of requiredRouteFields) {
                const value = data[field];
                if (typeof value !== 'string' || !value.trim()) {
                    return handleStepInvalid(message, field);
                }
            }

            if (!validateAndeanPhoneValue(data.pickupContactPhone, 'CO')) {
                return handleStepInvalid('Usa un celular andino valido para recogida.', 'pickupContactPhone');
            }

            if (!validateAndeanPhoneValue(data.deliveryContactPhone, 'CO')) {
                return handleStepInvalid('Usa un celular andino valido para entrega.', 'deliveryContactPhone');
            }

            return true;
        }

        if (currentStep === 2) {
            const compensationMode = data.compensationMode || 'salary_no_trip_pay';
            form.clearErrors(['assignmentMode', 'privateFleetTruckerId', 'compensationMode', 'freightPaymentAmount', 'expenseAllowanceAmount', 'expensesReleasePolicy', 'totalAmount']);

            if (data.assignmentMode === 'private') {
                if (!data.privateFleetTruckerId) {
                    return handleStepInvalid('Selecciona un conductor privado.', 'privateFleetTruckerId');
                }

                if (['trip_pay', 'trip_pay_plus_expenses'].includes(compensationMode) && Number(data.freightPaymentAmount || 0) <= 0) {
                    return handleStepInvalid('Ingresa el pago por ruta.', 'freightPaymentAmount');
                }

                if (['expenses_only', 'trip_pay_plus_expenses'].includes(compensationMode) && Number(data.expenseAllowanceAmount || 0) <= 0) {
                    return handleStepInvalid('Ingresa los viaticos del viaje.', 'expenseAllowanceAmount');
                }

                return true;
            }

            if (Number(data.totalAmount || 0) <= 0) {
                return handleStepInvalid('Define el monto a pagar del viaje.', 'totalAmount');
            }

            return true;
        }

        if (currentStep === 3) {
            form.clearErrors('vehicleType');
            if (!data.vehicleType) {
                return handleStepInvalid('Selecciona el tipo de vehiculo.', 'vehicleType');
            }
        }

        return true;
    }, [currentStep, form, handleStepInvalid]);

    const handleNext = async () => {
        const isValid = validateCurrentStep();

        if (isValid && currentStep < STEPS.length - 1) {
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleStepClick = (index: number) => {
        if (index <= currentStep) {
            setCurrentStep(index);
        }
    };

    const handleSubmit = async (publishImmediately: boolean = true) => {
        setIsSubmitting(true);
        try {
            const data = form.getValues();
            const manifestItems = (data.manifestItems || []) as ManifestItemDraftInput[];
            const manifestMetrics = getManifestMetrics(manifestItems);
            const derivedWeightKg = manifestMetrics.totalWeightKg > 0 ? manifestMetrics.totalWeightKg : 1;
            const derivedQuantity = manifestMetrics.totalUnits > 0 ? manifestMetrics.totalUnits : 1;
            const derivedVolumeM3 = manifestMetrics.totalVolumeCm3 > 0
                ? manifestMetrics.totalVolumeCm3 / 1000000
                : undefined;
            const isPrivateAssignment = data.assignmentMode === 'private';
            const compensationMode = data.compensationMode || 'salary_no_trip_pay';
            const privateFreightPaymentAmount = ['trip_pay', 'trip_pay_plus_expenses'].includes(compensationMode)
                ? Number(data.freightPaymentAmount || 0)
                : 0;
            const privateExpenseAllowanceAmount = ['expenses_only', 'trip_pay_plus_expenses'].includes(compensationMode)
                ? Number(data.expenseAllowanceAmount || 0)
                : 0;
            const offerAmount = isPrivateAssignment ? 0 : Number(data.totalAmount || 0);
            const originCityName = getCityName(data.originCity || '');
            const originDepartmentName = getDepartmentName(data.originDepartment || '');
            const destinationCityName = getCityName(data.destinationCity || '');
            const destinationDepartmentName = getDepartmentName(data.destinationDepartment || '');

            // Import API dynamically to avoid issues
            const { api } = await import('@/lib/api/client');

            // Map form data to backend DTO format
            const payload = {
                title: `${data.cargoType} - ${originCityName} a ${destinationCityName}`,
                description: data.cargoDescription,
                cargoType: data.cargoType,
                cargoDescription: data.cargoDescription,
                weight: derivedWeightKg,
                weightKg: derivedWeightKg,
                weightUnit: 'kg',
                volume: derivedVolumeM3,
                volumeUnit: 'm3',
                dimensionLength: data.dimensionLength,
                dimensionWidth: data.dimensionWidth,
                dimensionHeight: data.dimensionHeight,
                quantity: derivedQuantity,
                temperatureMin: data.temperatureMin,
                temperatureMax: data.temperatureMax,
                originCity: originCityName,
                originDepartment: originDepartmentName,
                originAddress: data.originAddress,
                originDepartmentId: data.originDepartmentId || null,
                originMunicipalityId: data.originMunicipalityId || null,
                originLocalZoneId: data.originLocalZoneId || null,
                originLocalZoneName: data.originLocalZoneName || undefined,
                originLocalZoneType: data.originLocalZoneType || undefined,
                originAddressReference: data.originAddressReference || undefined,
                originLatitude: data.originLatitude,
                originLongitude: data.originLongitude,
                // NEW: Pickup contact for PIN delivery
                pickupContactName: data.pickupContactName,
                pickupContactPhone: data.pickupContactPhone,
                destinationCity: destinationCityName,
                destinationDepartment: destinationDepartmentName,
                destCity: destinationCityName,
                destDepartment: destinationDepartmentName,
                destinationAddress: data.destinationAddress,
                destAddress: data.destinationAddress,
                destinationDepartmentId: data.destinationDepartmentId || null,
                destinationMunicipalityId: data.destinationMunicipalityId || null,
                destinationLocalZoneId: data.destinationLocalZoneId || null,
                destinationLocalZoneName: data.destinationLocalZoneName || undefined,
                destinationLocalZoneType: data.destinationLocalZoneType || undefined,
                destinationAddressReference: data.destinationAddressReference || undefined,
                destinationLatitude: data.destinationLatitude,
                destinationLongitude: data.destinationLongitude,
                // NEW: Delivery contact for PIN delivery
                deliveryContactName: data.deliveryContactName,
                deliveryContactPhone: data.deliveryContactPhone,
                // NEW: Manifest items (picking list)
                manifestItems: manifestItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: Number(item.quantity || 1),
                    weightKg: item.weightKg || undefined,
                    lengthCm: item.lengthCm || undefined,
                    widthCm: item.widthCm || undefined,
                    heightCm: item.heightCm || undefined,
                    imageUrls: (item.imageUrls || []).filter(Boolean).slice(0, 4),
                    invoicePhotoUrls: (item.invoicePhotoUrls || []).filter(Boolean).slice(0, 2),
                })),
                warehouseFlowMode: data.warehouseFlowMode,
                originWarehouseId: data.originWarehouseId || undefined,
                destinationWarehouseId: data.destinationWarehouseId || undefined,
                originDockId: data.originDockId || undefined,
                destinationDockId: data.destinationDockId || undefined,
                assignmentMode: data.assignmentMode,
                privateFleetTruckerId: isPrivateAssignment ? data.privateFleetTruckerId : undefined,
                compensationMode: isPrivateAssignment ? compensationMode : undefined,
                expensesReleasePolicy: isPrivateAssignment ? (data.expensesReleasePolicy || 'acceptance') : undefined,
                freightPaymentAmount: isPrivateAssignment ? privateFreightPaymentAmount : undefined,
                expenseAllowanceAmount: isPrivateAssignment ? privateExpenseAllowanceAmount : undefined,
                privateFleetNotes: isPrivateAssignment ? data.additionalTerms : undefined,
                pickupDate: data.pickupDate,
                pickupTimeStart: data.pickupTimeStart,
                pickupTimeEnd: data.pickupTimeEnd,
                deliveryDate: data.deliveryDate,
                deliveryTimeStart: data.deliveryTimeStart,
                deliveryTimeEnd: data.deliveryTimeEnd,
                budgetMin: offerAmount,
                budgetMax: offerAmount,
                totalAmount: offerAmount,
                currency: config.currencyCode,
                countryCode: country,
                currencyCode: config.currencyCode,
                requiredVehicle: data.vehicleType as any,
                vehicleType: data.vehicleType,
                minExperienceYears: data.minExperienceYears,
                requiredLicenses: data.requiredLicenses,
                requiredCertifications: data.requiredCertifications,
                insuranceRequired: data.insuranceRequired,
                specialRequirements: [
                    data.specialRequirements,
                    data.additionalRequirements,
                    `Experiencia mínima: ${data.minExperienceYears} años`,
                    data.insuranceRequired ? 'Seguro requerido' : null,
                ].filter(Boolean).join('. '),
                ratePerKm: undefined,
                additionalTerms: data.additionalTerms,
                additionalRequirements: data.additionalRequirements,
                paymentMethod: data.paymentMethod || 'bank_transfer',
                paymentSchedule: data.paymentSchedule || 'on_delivery',
                publishImmediately,
                photos: (data.photos || []).filter(Boolean),
            };
            if (process.env.NODE_ENV !== 'production') {
                console.log('[Publicar oferta] Sending payload:', JSON.stringify(payload, null, 2));
            }
            const result = await api.offers.create(payload);
            if (process.env.NODE_ENV !== 'production') {
                console.log('[Publicar oferta] Response:', result);
            }

            if (result.success) {
                toast.success(
                    publishImmediately ? '¡Oferta publicada!' : '¡Borrador guardado!',
                    publishImmediately
                        ? 'Tu oferta está ahora visible para los transportadores'
                        : 'Puedes continuar después desde "Mis Ofertas"'
                );
                router.push('/ofertas/mis-ofertas');
            } else {
                if (result.code === 'PLAN_LIMIT_REACHED') {
                    const details = coercePlanLimitDetails(result.details);

                    if (details) {
                        setPlanLimitDetails(details);
                        setPlanLimitOpen(true);
                        toast.error('Limite de plan', result.message || 'Tu plan necesita upgrade para crear mas viajes.');
                        return;
                    }
                }

                console.error('[Publicar oferta] API Error:', result);
                throw new Error(result.message || 'Error desconocido');
            }
        } catch (error: any) {
            console.error('[Publicar oferta] Error publishing offer:', error);
            toast.error('Error', error?.message || 'No se pudo publicar la oferta. Intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveDraft = async () => {
        await handleSubmit(false);
    };

    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return <StepCargoInfo form={form} />;
            case 1:
                return <StepRouteInfo form={form} country={country} />;
            case 2:
                return (
                    <StepPaymentTerms
                        form={form}
                        privateFleetMembers={privateFleetMembers}
                        fleetLoading={fleetLoading}
                        fleetLoadError={fleetLoadError}
                    />
                );
            case 3:
                return <StepRequirements form={form} />;
            case 4:
                return <StepPhotos form={form} />;
            case 5:
                return <StepReview form={form} privateFleetMembers={privateFleetMembers} />;
            default:
                return null;
        }
    };

    return (
        <DashboardLayout pageTitle={t('offers.publish.pageTitle') || 'Publicar Oferta de Carga'}>
            <div className="mx-auto w-full max-w-5xl">
                {/* Step Indicators */}
                <StepIndicator
                    steps={STEPS}
                    currentStep={currentStep}
                    onStepClick={handleStepClick}
                />
                <MobileStepIndicator currentStep={currentStep} totalSteps={STEPS.length} />

                {/* Form Card */}
                <Card variant="elevated" padding="lg">
                    <FormProvider {...form}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {renderStep()}
                            </motion.div>
                        </AnimatePresence>
                    </FormProvider>
                </Card>

                {/* Navigation Buttons */}
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        {currentStep > 0 && (
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                leftIcon={<ArrowLeft className="w-4 h-4" />}
                                className="w-full sm:w-auto"
                            >
                                Anterior
                            </Button>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                        <Button
                            variant="ghost"
                            onClick={() => handleSaveDraft()}
                            leftIcon={<Save className="w-4 h-4" />}
                            className="w-full sm:w-auto"
                        >
                            Guardar Borrador
                        </Button>

                        {currentStep < STEPS.length - 1 ? (
                            <Button
                                onClick={handleNext}
                                rightIcon={<ArrowRight className="w-4 h-4" />}
                                className="w-full sm:w-auto"
                            >
                                Continuar
                            </Button>
                        ) : (
                            <Button
                                onClick={() => handleSubmit(true)}
                                isLoading={isSubmitting}
                                rightIcon={<Send className="w-4 h-4" />}
                                className="w-full bg-zinc-950 text-white hover:bg-zinc-800 sm:w-auto"
                            >
                                Publicar Oferta
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <PlanLimitPaywallDialog
                open={planLimitOpen}
                onOpenChange={setPlanLimitOpen}
                details={planLimitDetails}
            />
        </DashboardLayout>
    );
}
