// =============================================================================
// KARGAX - SUPABASE OFFERS SERVICE
// Enterprise-grade offers management with Supabase
// =============================================================================

import { supabase } from './client';
import { normalizeVehicleTypeCode } from '@/constants/colombia';

// =============================================================================
// Types
// =============================================================================

export type OfferStatus = 'draft' | 'active' | 'assigned' | 'reserved' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'check';
export type PaymentSchedule = 'on_delivery' | 'advance' | 'partial';
export type OfferAssignmentMode = 'public' | 'private';

export interface CargoOffer {
    id: string;
    business_id: string;
    assigned_trucker_id: string | null;
    private_fleet_trucker_id?: string | null;
    is_private_fleet?: boolean;
    status: OfferStatus;
    country_code?: 'CO' | 'EC' | 'PE' | 'BR' | null;
    currency_code?: 'COP' | 'USD' | 'PEN' | 'BRL' | null;

    // Cargo
    cargo_type: string;
    cargo_description: string;
    weight_kg: number;
    dimension_length: number | null;
    dimension_width: number | null;
    dimension_height: number | null;
    quantity: number;
    temperature_min: number | null;
    temperature_max: number | null;
    special_requirements: string | null;

    // Origin
    origin_department: string;
    origin_city: string;
    origin_address: string;
    origin_warehouse_id?: string | null;
    origin_dock_id?: string | null;
    origin_appointment_id?: string | null;

    // Destination
    destination_department: string;
    destination_city: string;
    destination_address: string;
    destination_warehouse_id?: string | null;
    destination_dock_id?: string | null;
    destination_appointment_id?: string | null;
    warehouse_flow_mode?: 'manual' | 'warehouse_managed' | '3pl' | null;

    // Schedule
    pickup_date: string;
    pickup_time_start: string;
    pickup_time_end: string;
    delivery_date: string;
    delivery_time_start: string;
    delivery_time_end: string;

    // Payment
    total_amount: number;
    expense_allowance_amount?: number | null;
    freight_payment_amount?: number | null;
    rate_per_km: number | null;
    payment_method: PaymentMethod;
    payment_schedule: PaymentSchedule;
    additional_terms: string | null;

    // Requirements
    vehicle_type: string;
    min_experience_years: number;
    required_licenses: string[] | null;
    required_certifications: string[] | null;
    insurance_required: boolean;
    additional_requirements: string | null;

    // Analytics
    views_count: number;
    applications_count: number;

    // Timestamps
    published_at: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface OfferApplication {
    id: string;
    offer_id: string;
    trucker_id: string;
    status: ApplicationStatus;
    proposed_amount: number | null;
    message: string | null;
    estimated_pickup: string | null;
    years_experience?: number | null;
    vehicle_type_confirmed?: string | null;
    vehicle_plate?: string | null;
    license_type?: string | null;
    has_insurance?: boolean | null;
    application_payload?: Record<string, unknown> | null;
    business_response: string | null;
    responded_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateOfferData {
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
    originDepartment: string;
    originCity: string;
    originAddress: string;
    destinationDepartment: string;
    destinationCity: string;
    destinationAddress: string;
    pickupDate: string;
    pickupTimeStart: string;
    pickupTimeEnd: string;
    deliveryDate: string;
    deliveryTimeStart: string;
    deliveryTimeEnd: string;
    totalAmount: number;
    ratePerKm?: number;
    paymentMethod: PaymentMethod;
    paymentSchedule: PaymentSchedule;
    additionalTerms?: string;
    vehicleType: string;
    minExperienceYears: number;
    requiredLicenses?: string[];
    requiredCertifications?: string[];
    insuranceRequired: boolean;
    additionalRequirements?: string;
    publishImmediately?: boolean;
    // Picking/Manifest fields
    manifestItems?: Array<{
        id?: string;
        name: string;
        quantity: number;
        reference?: string;
        imageUrl?: string;
        imageUrls?: string[];
        invoicePhotoUrls?: string[];
        description?: string;
        weightKg?: number;
        lengthCm?: number;
        widthCm?: number;
        heightCm?: number;
    }>;
    pickupContactName?: string;
    pickupContactPhone?: string;
    deliveryContactName?: string;
    deliveryContactPhone?: string;
    warehouseFlowMode?: 'manual' | 'warehouse_managed' | '3pl';
    originWarehouseId?: string;
    destinationWarehouseId?: string;
    originDockId?: string;
    destinationDockId?: string;
    assignmentMode?: OfferAssignmentMode;
    privateFleetTruckerId?: string;
    compensationMode?: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses';
    expensesReleasePolicy?: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual';
    expenseAllowanceAmount?: number;
    freightPaymentAmount?: number;
    privateFleetNotes?: string;
    countryCode?: 'CO' | 'EC' | 'PE' | 'BR';
    currencyCode?: 'COP' | 'USD' | 'PEN' | 'BRL';
    photos?: string[];
}

export interface SearchOffersParams {
    page?: number;
    limit?: number;
    sortBy?: 'published_at' | 'total_amount' | 'pickup_date' | 'created_at';
    sortOrder?: 'asc' | 'desc';
    status?: OfferStatus;
    originDepartment?: string;
    originCity?: string;
    destinationDepartment?: string;
    destinationCity?: string;
    cargoType?: string;
    vehicleType?: string;
    pickupDateFrom?: string;
    pickupDateTo?: string;
    amountMin?: number;
    amountMax?: number;
    search?: string;
}

interface OfferResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
    details?: unknown;
}

// =============================================================================
// Helper: Convert camelCase to snake_case
// =============================================================================

function slugifyManifestName(name: string): string {
    return (name || 'item')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || 'item';
}

function createManifestItemId(itemName: string, index: number): string {
    const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 10)}`;
    return `mi-${index + 1}-${slugifyManifestName(itemName)}-${randomId.slice(0, 8)}`;
}

function normalizeManifestItems(items: CreateOfferData['manifestItems']) {
    if (!Array.isArray(items)) return [];

    return items
        .filter((item) => item && item.name?.trim())
        .map((item, index) => ({
            ...item,
            id: item.id || createManifestItemId(item.name, index),
            name: item.name.trim(),
            quantity: Math.max(1, Number(item.quantity || 1)),
            imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.filter(Boolean).slice(0, 4) : [],
            invoicePhotoUrls: Array.isArray(item.invoicePhotoUrls) ? item.invoicePhotoUrls.filter(Boolean).slice(0, 2) : [],
        }));
}

function getManifestTotals(items: ReturnType<typeof normalizeManifestItems>) {
    return items.reduce(
        (totals, item) => {
            const quantity = Math.max(1, Number(item.quantity || 1));
            const weightKg = Math.max(0, Number(item.weightKg || 0));
            const lengthCm = Math.max(0, Number(item.lengthCm || 0));
            const widthCm = Math.max(0, Number(item.widthCm || 0));
            const heightCm = Math.max(0, Number(item.heightCm || 0));

            totals.quantity += quantity;
            totals.weightKg += weightKg * quantity;
            totals.volumeM3 += lengthCm && widthCm && heightCm
                ? (lengthCm * widthCm * heightCm * quantity) / 1000000
                : 0;
            return totals;
        },
        { quantity: 0, weightKg: 0, volumeM3: 0 }
    );
}

function toSnakeCase(data: CreateOfferData): Record<string, unknown> {
    const vehicleType = normalizeVehicleTypeCode(data.vehicleType) || data.vehicleType;
    const manifestItems = normalizeManifestItems(data.manifestItems);
    const manifestTotals = getManifestTotals(manifestItems);

    return {
        cargo_type: data.cargoType,
        cargo_description: data.cargoDescription,
        weight_kg: manifestTotals.weightKg > 0 ? manifestTotals.weightKg : data.weightKg,
        dimension_length: data.dimensionLength,
        dimension_width: data.dimensionWidth,
        dimension_height: data.dimensionHeight,
        quantity: manifestTotals.quantity > 0 ? manifestTotals.quantity : data.quantity,
        temperature_min: data.temperatureMin,
        temperature_max: data.temperatureMax,
        special_requirements: data.specialRequirements,
        origin_department: data.originDepartment,
        origin_city: data.originCity,
        origin_address: data.originAddress,
        destination_department: data.destinationDepartment,
        destination_city: data.destinationCity,
        destination_address: data.destinationAddress,
        pickup_date: data.pickupDate,
        pickup_time_start: data.pickupTimeStart,
        pickup_time_end: data.pickupTimeEnd,
        delivery_date: data.deliveryDate,
        delivery_time_start: data.deliveryTimeStart,
        delivery_time_end: data.deliveryTimeEnd,
        total_amount: data.totalAmount,
        rate_per_km: data.ratePerKm,
        payment_method: data.paymentMethod,
        payment_schedule: data.paymentSchedule,
        additional_terms: data.additionalTerms,
        vehicle_type: vehicleType,
        min_experience_years: data.minExperienceYears,
        required_licenses: data.requiredLicenses,
        required_certifications: data.requiredCertifications,
        insurance_required: data.insuranceRequired,
        additional_requirements: data.additionalRequirements,
        status: data.publishImmediately ? 'active' : 'draft',
        published_at: data.publishImmediately ? new Date().toISOString() : null,
        // Picking/Manifest fields
        manifest_items: manifestItems,
        pickup_contact_name: data.pickupContactName,
        pickup_contact_phone: data.pickupContactPhone,
        delivery_contact_name: data.deliveryContactName,
        delivery_contact_phone: data.deliveryContactPhone,
        warehouse_flow_mode: data.warehouseFlowMode,
        origin_warehouse_id: data.originWarehouseId,
        destination_warehouse_id: data.destinationWarehouseId,
        origin_dock_id: data.originDockId,
        destination_dock_id: data.destinationDockId,
        assignment_mode: data.assignmentMode,
        private_fleet_trucker_id: data.privateFleetTruckerId,
        compensation_mode: data.compensationMode,
        expenses_release_policy: data.expensesReleasePolicy,
        expense_allowance_amount: data.expenseAllowanceAmount,
        freight_payment_amount: data.freightPaymentAmount,
        private_fleet_notes: data.privateFleetNotes,
        country_code: data.countryCode,
        currency_code: data.currencyCode,
    };
}

// =============================================================================
// Offers Service
// =============================================================================

export const supabaseOffers = {
    // =========================================================================
    // CREATE OFFER
    // =========================================================================
    async create(data: CreateOfferData): Promise<OfferResult<{ id: string; status: string }>> {
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                return { success: false, error: 'No autenticado' };
            }

            const response = await fetch('/api/offers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(data),
            });

            const rawText = await response.text();
            let json: any = null;
            try {
                json = rawText ? JSON.parse(rawText) : null;
            } catch {
                json = null;
            }

            if (!response.ok) {
                const apiError = typeof json?.error === 'string'
                    ? json.error
                    : typeof json?.error?.message === 'string'
                        ? json.error.message
                        : rawText
                            ? rawText
                        : null;

                return {
                    success: false,
                    error: apiError || `No se pudo crear la oferta (${response.status})`,
                    code: typeof json?.code === 'string' ? json.code : undefined,
                    details: json?.error && typeof json.error === 'object' ? json.error.details : undefined,
                };
            }

            const createdOffer = json.data as { id: string; status: string } | null;

            if (!createdOffer) {
                return { success: false, error: 'No se pudo crear la oferta' };
            }

            return {
                success: true,
                data: { id: createdOffer.id, status: createdOffer.status }
            };
        } catch (err) {
            console.error('[Offers] Create exception:', err);
            return { success: false, error: 'Error al crear oferta' };
        }
    },

    // =========================================================================
    // SEARCH OFFERS
    // =========================================================================
    async search(params?: SearchOffersParams): Promise<OfferResult<{
        data: CargoOffer[];
        meta: { page: number; limit: number; total: number; totalPages: number };
    }>> {
        try {
            const page = params?.page || 1;
            const limit = params?.limit || 10;
            const offset = (page - 1) * limit;

            let query = (supabase.from('cargo_offers' as any) as any)
                .select('*', { count: 'exact' });

            // Filtros
            if (params?.status) {
                query = query.eq('status', params.status);
            } else {
                // Por defecto solo ofertas activas
                query = query.eq('status', 'active');
            }

            if (params?.originDepartment) {
                query = query.eq('origin_department', params.originDepartment);
            }
            if (params?.originCity) {
                query = query.eq('origin_city', params.originCity);
            }
            if (params?.destinationDepartment) {
                query = query.eq('destination_department', params.destinationDepartment);
            }
            if (params?.destinationCity) {
                query = query.eq('destination_city', params.destinationCity);
            }
            if (params?.cargoType) {
                query = query.eq('cargo_type', params.cargoType);
            }
            if (params?.vehicleType) {
                query = query.eq('vehicle_type', normalizeVehicleTypeCode(params.vehicleType) || params.vehicleType);
            }
            if (params?.pickupDateFrom) {
                query = query.gte('pickup_date', params.pickupDateFrom);
            }
            if (params?.pickupDateTo) {
                query = query.lte('pickup_date', params.pickupDateTo);
            }
            if (params?.amountMin) {
                query = query.gte('total_amount', params.amountMin);
            }
            if (params?.amountMax) {
                query = query.lte('total_amount', params.amountMax);
            }
            if (params?.search) {
                query = query.or(`cargo_description.ilike.%${params.search}%,origin_city.ilike.%${params.search}%,destination_city.ilike.%${params.search}%`);
            }

            // Ordenar
            const sortBy = params?.sortBy || 'published_at';
            const sortOrder = params?.sortOrder === 'asc' ? true : false;
            query = query.order(sortBy, { ascending: sortOrder, nullsFirst: false });

            // Paginación
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) {
                console.error('[Offers] Search error:', error);
                return { success: false, error: error.message };
            }

            const total = count || 0;
            return {
                success: true,
                data: {
                    data: (data || []) as CargoOffer[],
                    meta: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            };
        } catch (err) {
            console.error('[Offers] Search exception:', err);
            return { success: false, error: 'Error al buscar ofertas' };
        }
    },

    // =========================================================================
    // GET MY OFFERS (Business)
    // =========================================================================
    async getMyOffers(params?: { status?: string }): Promise<OfferResult<CargoOffer[]>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            let query = (supabase.from('cargo_offers' as any) as any)
                .select('*')
                .eq('business_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (params?.status && params.status !== 'all') {
                query = query.eq('status', params.status);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[Offers] GetMyOffers error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: (data || []) as CargoOffer[] };
        } catch (err) {
            console.error('[Offers] GetMyOffers exception:', err);
            return { success: false, error: 'Error al obtener ofertas' };
        }
    },

    // =========================================================================
    // GET OFFER BY ID
    // =========================================================================
    async getById(id: string): Promise<OfferResult<CargoOffer>> {
        try {
            const { data, error } = await (supabase.from('cargo_offers' as any) as any)
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('[Offers] GetById error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: data as CargoOffer };
        } catch (err) {
            console.error('[Offers] GetById exception:', err);
            return { success: false, error: 'Error al obtener oferta' };
        }
    },

    // =========================================================================
    // UPDATE OFFER
    // =========================================================================
    async update(id: string, data: Partial<CreateOfferData>): Promise<OfferResult<{ updated: boolean }>> {
        try {
            const updateData: Record<string, unknown> = {};

            // Solo incluir campos que están presentes
            if (data.cargoType) updateData.cargo_type = data.cargoType;
            if (data.cargoDescription) updateData.cargo_description = data.cargoDescription;
            if (data.weightKg) updateData.weight_kg = data.weightKg;
            if (data.dimensionLength) updateData.dimension_length = data.dimensionLength;
            if (data.dimensionWidth) updateData.dimension_width = data.dimensionWidth;
            if (data.dimensionHeight) updateData.dimension_height = data.dimensionHeight;
            if (data.quantity) updateData.quantity = data.quantity;
            if (data.temperatureMin) updateData.temperature_min = data.temperatureMin;
            if (data.temperatureMax) updateData.temperature_max = data.temperatureMax;
            if (data.specialRequirements !== undefined) updateData.special_requirements = data.specialRequirements;
            if (data.originDepartment) updateData.origin_department = data.originDepartment;
            if (data.originCity) updateData.origin_city = data.originCity;
            if (data.originAddress) updateData.origin_address = data.originAddress;
            if (data.destinationDepartment) updateData.destination_department = data.destinationDepartment;
            if (data.destinationCity) updateData.destination_city = data.destinationCity;
            if (data.destinationAddress) updateData.destination_address = data.destinationAddress;
            if (data.pickupDate) updateData.pickup_date = data.pickupDate;
            if (data.pickupTimeStart) updateData.pickup_time_start = data.pickupTimeStart;
            if (data.pickupTimeEnd) updateData.pickup_time_end = data.pickupTimeEnd;
            if (data.deliveryDate) updateData.delivery_date = data.deliveryDate;
            if (data.deliveryTimeStart) updateData.delivery_time_start = data.deliveryTimeStart;
            if (data.deliveryTimeEnd) updateData.delivery_time_end = data.deliveryTimeEnd;
            if (data.totalAmount) updateData.total_amount = data.totalAmount;
            if (data.ratePerKm !== undefined) updateData.rate_per_km = data.ratePerKm;
            if (data.paymentMethod) updateData.payment_method = data.paymentMethod;
            if (data.paymentSchedule) updateData.payment_schedule = data.paymentSchedule;
            if (data.additionalTerms !== undefined) updateData.additional_terms = data.additionalTerms;
            if (data.vehicleType) updateData.vehicle_type = normalizeVehicleTypeCode(data.vehicleType) || data.vehicleType;
            if (data.minExperienceYears !== undefined) updateData.min_experience_years = data.minExperienceYears;
            if (data.requiredLicenses) updateData.required_licenses = data.requiredLicenses;
            if (data.requiredCertifications) updateData.required_certifications = data.requiredCertifications;
            if (data.insuranceRequired !== undefined) updateData.insurance_required = data.insuranceRequired;
            if (data.additionalRequirements !== undefined) updateData.additional_requirements = data.additionalRequirements;

            const { error } = await (supabase.from('cargo_offers' as any) as any)
                .update(updateData)
                .eq('id', id);

            if (error) {
                console.error('[Offers] Update error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { updated: true } };
        } catch (err) {
            console.error('[Offers] Update exception:', err);
            return { success: false, error: 'Error al actualizar oferta' };
        }
    },

    // =========================================================================
    // DELETE OFFER
    // =========================================================================
    async delete(id: string): Promise<OfferResult<{ deleted: boolean }>> {
        try {
            const { error } = await (supabase.from('cargo_offers' as any) as any)
                .delete()
                .eq('id', id);

            if (error) {
                console.error('[Offers] Delete error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { deleted: true } };
        } catch (err) {
            console.error('[Offers] Delete exception:', err);
            return { success: false, error: 'Error al eliminar oferta' };
        }
    },

    // =========================================================================
    // PUBLISH OFFER
    // =========================================================================
    async publish(id: string): Promise<OfferResult<{ published: boolean }>> {
        try {
            const { error } = await (supabase.from('cargo_offers' as any) as any)
                .update({
                    status: 'active',
                    published_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('status', 'draft');

            if (error) {
                console.error('[Offers] Publish error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { published: true } };
        } catch (err) {
            console.error('[Offers] Publish exception:', err);
            return { success: false, error: 'Error al publicar oferta' };
        }
    },

    // =========================================================================
    // APPLY TO OFFER (Trucker)
    // =========================================================================
    async apply(offerId: string, data?: {
        proposedAmount?: number;
        message?: string;
        estimatedPickup?: string;
        yearsExperience?: number;
        vehicleType?: string;
        vehiclePlate?: string;
        licenseType?: string;
        hasInsurance?: boolean;
        applicationPayload?: Record<string, unknown>;
    }): Promise<OfferResult<{ applicationId: string }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            const confirmedVehicleType = data?.vehicleType
                ? normalizeVehicleTypeCode(data.vehicleType) || data.vehicleType
                : undefined;

            const payloadWithRequirements = {
                offer_id: offerId,
                trucker_id: userData.user.id,
                proposed_amount: data?.proposedAmount,
                message: data?.message,
                estimated_pickup: data?.estimatedPickup,
                years_experience: data?.yearsExperience,
                vehicle_type_confirmed: confirmedVehicleType,
                vehicle_plate: data?.vehiclePlate,
                license_type: data?.licenseType,
                has_insurance: data?.hasInsurance ?? false,
                application_payload: data?.applicationPayload || {},
            };

            let insertResult = await (supabase.from('offer_applications' as any) as any)
                .insert(payloadWithRequirements)
                .select('id')
                .single();

            if (insertResult.error?.code === '42703') {
                insertResult = await (supabase.from('offer_applications' as any) as any)
                    .insert({
                        offer_id: offerId,
                        trucker_id: userData.user.id,
                        proposed_amount: data?.proposedAmount,
                        message: data?.message,
                        estimated_pickup: data?.estimatedPickup,
                    })
                    .select('id')
                    .single();
            }

            const { data: application, error } = insertResult;

            if (error) {
                console.error('[Offers] Apply error:', error);
                if (error.code === '23505') {
                    return { success: false, error: 'Ya aplicaste a esta oferta' };
                }
                return { success: false, error: error.message };
            }

            const createdApplication = application as { id: string } | null;

            if (!createdApplication) {
                return { success: false, error: 'No se pudo crear la postulacion' };
            }

            return { success: true, data: { applicationId: createdApplication.id } };
        } catch (err) {
            console.error('[Offers] Apply exception:', err);
            return { success: false, error: 'Error al aplicar' };
        }
    },

    // =========================================================================
    // GET APPLICATIONS FOR OFFER (Business)
    // =========================================================================
    async getApplications(offerId: string): Promise<OfferResult<OfferApplication[]>> {
        try {
            console.log('[Offers] Getting applications for offer:', offerId);

            const { data, error } = await (supabase.from('offer_applications' as any) as any)
                .select('*')
                .eq('offer_id', offerId)
                .order('created_at', { ascending: false });

            console.log('[Offers] Applications result:', { data, error });

            if (error) {
                console.error('[Offers] GetApplications error:', error);
                return { success: false, error: error.message };
            }

            // Map to include trucker info from metadata
            const applications = (data || []).map((app: any) => ({
                ...app,
                truckerName: 'Transportador',
                truckerEmail: '',
                truckerPhone: null,
                yearsExperience: app.years_experience ?? null,
                vehicleTypeConfirmed: app.vehicle_type_confirmed ?? null,
                vehiclePlate: app.vehicle_plate ?? null,
                licenseType: app.license_type ?? null,
                hasInsurance: app.has_insurance ?? false,
                applicationPayload: app.application_payload ?? {},
            }));

            return { success: true, data: applications as OfferApplication[] };
        } catch (err) {
            console.error('[Offers] GetApplications exception:', err);
            return { success: false, error: 'Error al obtener aplicaciones' };
        }
    },

    // =========================================================================
    // RESPOND TO APPLICATION (Business)
    // =========================================================================
    async respondToApplication(
        offerId: string,
        applicationId: string,
        response: { action: 'accepted' | 'rejected'; message?: string }
    ): Promise<OfferResult<{ responded: boolean }>> {
        try {
            if (response.action === 'accepted') {
                return {
                    success: false,
                    error: 'La aceptacion directa fue deshabilitada. Usa el flujo seguro de pago para seleccionar al transportador.',
                };
            }

            const { error } = await (supabase.from('offer_applications' as any) as any)
                .update({
                    status: response.action,
                    business_response: response.message,
                    responded_at: new Date().toISOString(),
                })
                .eq('id', applicationId)
                .eq('offer_id', offerId);

            if (error) {
                console.error('[Offers] Respond error:', error);
                return { success: false, error: error.message };
            }

            // Si aceptó, asignar trucker a la oferta
            if ((response as { action: string }).action === '__disabled_legacy_accept__') {
                console.warn('[Offers] Legacy accept path is disabled');
            }

            return { success: true, data: { responded: true } };
        } catch (err) {
            console.error('[Offers] Respond exception:', err);
            return { success: false, error: 'Error al responder' };
        }
    },

    // =========================================================================
    // ACCEPT APPLICATION WITH MESSAGE (Business) - Atomic Transaction
    // Uses RPC function to accept + create conversation + send message atomically
    // =========================================================================
    async acceptApplicationWithMessage(
        offerId: string,
        applicationId: string,
        messageContent: string,
        businessResponse?: string
    ): Promise<OfferResult<{
        applicationId: string;
        conversationId: string;
        messageId: string;
        truckerId: string;
    }>> {
        try {
            console.log('[Offers] AcceptWithMessage:', { offerId, applicationId });

            const { data, error } = await (supabase as any).rpc('accept_application_with_message', {
                p_offer_id: offerId,
                p_application_id: applicationId,
                p_message_content: messageContent,
                p_business_response: businessResponse || 'Aceptado',
            });

            if (error) {
                console.error('[Offers] AcceptWithMessage RPC error:', error);
                return { success: false, error: error.message };
            }

            // The RPC returns JSONB with success/error/data
            const result = data as { success: boolean; error?: string; data?: any };

            if (!result.success) {
                console.error('[Offers] AcceptWithMessage failed:', result.error);
                return { success: false, error: result.error || 'Error al aceptar' };
            }

            console.log('[Offers] AcceptWithMessage success:', result.data);
            return {
                success: true,
                data: {
                    applicationId: result.data.applicationId,
                    conversationId: result.data.conversationId,
                    messageId: result.data.messageId,
                    truckerId: result.data.truckerId,
                },
            };
        } catch (err) {
            console.error('[Offers] AcceptWithMessage exception:', err);
            return { success: false, error: 'Error al aceptar aplicación' };
        }
    },

    // =========================================================================
    // GET MY APPLICATIONS (Trucker)
    // =========================================================================
    async getMyApplications(): Promise<OfferResult<{
        data: (OfferApplication & { offer: CargoOffer })[];
    }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            const { data, error } = await (supabase.from('offer_applications' as any) as any)
                .select(`
                    *,
                    offer:offer_id (*)
                `)
                .eq('trucker_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[Offers] GetMyApplications error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { data: data as any } };
        } catch (err) {
            console.error('[Offers] GetMyApplications exception:', err);
            return { success: false, error: 'Error al obtener aplicaciones' };
        }
    },

    // =========================================================================
    // WITHDRAW APPLICATION (Trucker)
    // =========================================================================
    async withdrawApplication(applicationId: string): Promise<OfferResult<{ withdrawn: boolean }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                return { success: false, error: 'No autenticado' };
            }

            const { error } = await (supabase.from('offer_applications' as any) as any)
                .update({
                    status: 'withdrawn',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', applicationId)
                .eq('trucker_id', userData.user.id)
                .eq('status', 'pending');

            if (error) {
                console.error('[Offers] WithdrawApplication error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: { withdrawn: true } };
        } catch (err) {
            console.error('[Offers] WithdrawApplication exception:', err);
            return { success: false, error: 'Error al retirar la postulacion' };
        }
    },

    // =========================================================================
    // RECORD VIEW
    // =========================================================================
    async recordView(offerId: string): Promise<OfferResult<{ recorded: boolean }>> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            const viewerId = userData?.user?.id;

            if (viewerId) {
                await (supabase as any).rpc('record_offer_view', {
                    p_offer_id: offerId,
                    p_viewer_id: viewerId,
                });
            }

            return { success: true, data: { recorded: true } };
        } catch (err) {
            // No fallar si analytics falla
            console.warn('[Offers] RecordView warning:', err);
            return { success: true, data: { recorded: true } };
        }
    },

    // =========================================================================
    // GET OFFER VIEWS (Business)
    // =========================================================================
    async getOfferViews(offerId: string): Promise<OfferResult<{
        views: Array<{
            viewerId: string;
            viewerName: string;
            viewCount: number;
            lastViewedAt: string;
        }>;
        totalViews: number;
        uniqueViewers: number;
    }>> {
        try {
            const { data, error } = await (supabase.from('offer_views' as any) as any)
                .select('*')
                .eq('offer_id', offerId);

            if (error) {
                console.error('[Offers] GetViews error:', error);
                return { success: false, error: error.message };
            }

            const views = (data || []).map((v: any) => ({
                viewerId: v.viewer_id,
                viewerName: 'Usuario',
                viewCount: v.view_count,
                lastViewedAt: v.last_viewed_at,
            }));

            return {
                success: true,
                data: {
                    views,
                    totalViews: views.reduce((sum: number, v: any) => sum + v.viewCount, 0),
                    uniqueViewers: views.length,
                },
            };
        } catch (err) {
            console.error('[Offers] GetViews exception:', err);
            return { success: false, error: 'Error al obtener vistas' };
        }
    },
};

export default supabaseOffers;
