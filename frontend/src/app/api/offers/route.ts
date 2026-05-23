import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    enforceMonthlyTripLimit,
    getPlanLimitErrorDetails,
    isPlanLimitError,
    resolveBusinessAccessContext,
} from '@/lib/server/warehouses';
import { normalizePhoneForNotification } from '@/lib/phone/andean';
import { normalizeVehicleTypeCode } from '@/constants/colombia';
import { getBusinessRoleCapabilities } from '@/lib/business-roles';

const COUNTRY_TO_CURRENCY: Record<string, string> = {
    CO: 'COP',
    EC: 'USD',
    PE: 'PEN',
    BR: 'BRL',
};

interface ManifestItemInput {
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
}

interface CreateOfferRequest {
    cargoType: string;
    cargoDescription: string;
    weightKg?: number;
    dimensionLength?: number;
    dimensionWidth?: number;
    dimensionHeight?: number;
    quantity?: number;
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
    paymentMethod: string;
    paymentSchedule: string;
    additionalTerms?: string;
    vehicleType: string;
    minExperienceYears: number;
    requiredLicenses?: string[];
    requiredCertifications?: string[];
    insuranceRequired: boolean;
    additionalRequirements?: string;
    publishImmediately?: boolean;
    manifestItems?: ManifestItemInput[];
    pickupContactName?: string;
    pickupContactPhone?: string;
    deliveryContactName?: string;
    deliveryContactPhone?: string;
    warehouseFlowMode?: 'manual' | 'warehouse_managed' | '3pl';
    originWarehouseId?: string;
    destinationWarehouseId?: string;
    originDockId?: string;
    destinationDockId?: string;
    assignmentMode?: 'public' | 'private';
    privateFleetTruckerId?: string;
    compensationMode?: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses';
    expensesReleasePolicy?: 'acceptance' | 'pickup_pin' | 'delivery_pod' | 'manual';
    expenseAllowanceAmount?: number;
    freightPaymentAmount?: number;
    privateFleetNotes?: string;
    sourceDispatchId?: string;
    dispatchTripMode?: 'dispatch_only' | 'private_fleet_trip' | 'marketplace_offer';
    countryCode?: 'CO' | 'EC' | 'PE' | 'BR';
    currencyCode?: 'COP' | 'USD' | 'PEN' | 'BRL';
    photos?: string[];
}

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

function normalizeManifestItems(items: ManifestItemInput[] | undefined): ManifestItemInput[] {
    if (!Array.isArray(items)) return [];

    return items
        .filter((item) => item && item.name?.trim())
        .map((item, index) => ({
            id: item.id || createManifestItemId(item.name, index),
            name: item.name.trim(),
            quantity: Math.max(1, Number(item.quantity || 1)),
            reference: item.reference,
            imageUrl: item.imageUrl,
            imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.filter(Boolean).slice(0, 4) : [],
            invoicePhotoUrls: Array.isArray(item.invoicePhotoUrls) ? item.invoicePhotoUrls.filter(Boolean).slice(0, 2) : [],
            description: item.description,
            weightKg: Number(item.weightKg || 0) > 0 ? Number(item.weightKg) : undefined,
            lengthCm: Number(item.lengthCm || 0) > 0 ? Number(item.lengthCm) : undefined,
            widthCm: Number(item.widthCm || 0) > 0 ? Number(item.widthCm) : undefined,
            heightCm: Number(item.heightCm || 0) > 0 ? Number(item.heightCm) : undefined,
        }));
}

function getManifestTotals(items: ManifestItemInput[]) {
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

function inferMimeTypeFromPath(storagePath: string): string {
    const extension = storagePath.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'jpg':
        case 'jpeg':
        default:
            return 'image/jpeg';
    }
}

function extractStoragePath(photoUrl: string): string | null {
    const trimmed = photoUrl.trim();
    if (!trimmed) return null;

    if (!/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/^\/+/, '');
    }

    try {
        const url = new URL(trimmed);
        const marker = '/storage/v1/object/public/offer-photos/';
        const markerIndex = url.pathname.indexOf(marker);

        if (markerIndex >= 0) {
            return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
        }

        return decodeURIComponent(url.pathname.split('/').slice(-2).join('/'));
    } catch {
        return null;
    }
}

function toInsertPayload(data: CreateOfferRequest, businessId: string, fallbackCountryCode?: string | null) {
    const countryCode = data.countryCode || (fallbackCountryCode as CreateOfferRequest['countryCode']) || 'CO';
    const currencyCode = data.currencyCode || COUNTRY_TO_CURRENCY[countryCode] || 'COP';
    const pickupContactPhone = normalizePhoneForNotification(data.pickupContactPhone, countryCode);
    const deliveryContactPhone = normalizePhoneForNotification(data.deliveryContactPhone, countryCode);
    const isPrivateFleet = data.assignmentMode === 'private' && Boolean(data.privateFleetTruckerId);
    const compensationMode = isPrivateFleet ? (data.compensationMode || 'salary_no_trip_pay') : null;
    const allowsTripPay = compensationMode === 'trip_pay' || compensationMode === 'trip_pay_plus_expenses';
    const allowsExpenses = compensationMode === 'expenses_only' || compensationMode === 'trip_pay_plus_expenses';
    const freightPaymentAmount = allowsTripPay ? Number(data.freightPaymentAmount || data.totalAmount || 0) : 0;
    const expenseAllowanceAmount = allowsExpenses ? Number(data.expenseAllowanceAmount || 0) : 0;
    const publishImmediately = data.publishImmediately !== false;
    const vehicleType = normalizeVehicleTypeCode(data.vehicleType) || data.vehicleType;
    const paymentMethod = data.paymentMethod || 'bank_transfer';
    const paymentSchedule = data.paymentSchedule || 'on_delivery';
    const totalAmount = Number(data.totalAmount || 0);
    const manifestItems = normalizeManifestItems(data.manifestItems);
    const manifestTotals = getManifestTotals(manifestItems);
    const weightKg = manifestTotals.weightKg > 0 ? manifestTotals.weightKg : Math.max(1, Number(data.weightKg || 1));
    const quantity = manifestTotals.quantity > 0 ? manifestTotals.quantity : Math.max(1, Number(data.quantity || 1));

    return {
        business_id: businessId,
        country_code: countryCode,
        currency_code: currencyCode,
        cargo_type: data.cargoType,
        cargo_description: data.cargoDescription,
        weight_kg: weightKg,
        dimension_length: data.dimensionLength,
        dimension_width: data.dimensionWidth,
        dimension_height: data.dimensionHeight,
        quantity,
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
        total_amount: isPrivateFleet ? freightPaymentAmount : totalAmount,
        rate_per_km: data.ratePerKm,
        payment_method: paymentMethod,
        payment_schedule: paymentSchedule,
        additional_terms: data.additionalTerms,
        vehicle_type: vehicleType,
        min_experience_years: data.minExperienceYears,
        required_licenses: data.requiredLicenses,
        required_certifications: data.requiredCertifications,
        insurance_required: data.insuranceRequired,
        additional_requirements: data.additionalRequirements,
        status: publishImmediately
            ? (isPrivateFleet ? 'assigned' : 'active')
            : 'draft',
        published_at: publishImmediately ? new Date().toISOString() : null,
        manifest_items: manifestItems,
        pickup_contact_name: data.pickupContactName || null,
        pickup_contact_phone: pickupContactPhone,
        delivery_contact_name: data.deliveryContactName || null,
        delivery_contact_phone: deliveryContactPhone,
        warehouse_flow_mode: data.warehouseFlowMode || null,
        source_dispatch_id: data.sourceDispatchId || null,
        dispatch_trip_mode: data.dispatchTripMode || null,
        origin_warehouse_id: data.originWarehouseId || null,
        destination_warehouse_id: data.destinationWarehouseId || null,
        origin_dock_id: data.originDockId || null,
        destination_dock_id: data.destinationDockId || null,
        is_private_fleet: isPrivateFleet,
        private_fleet_trucker_id: isPrivateFleet ? data.privateFleetTruckerId || null : null,
        assigned_trucker_id: isPrivateFleet ? data.privateFleetTruckerId || null : null,
        expense_allowance_amount: isPrivateFleet ? expenseAllowanceAmount : 0,
        freight_payment_amount: isPrivateFleet ? freightPaymentAmount : 0,
        compensation_mode: compensationMode,
        expenses_release_policy: isPrivateFleet ? (data.expensesReleasePolicy || 'acceptance') : null,
        private_payment_status: isPrivateFleet
            ? (freightPaymentAmount > 0 ? 'held' : 'not_applicable')
            : null,
        private_fleet_notes: data.privateFleetNotes || null,
        net_amount: isPrivateFleet ? freightPaymentAmount : undefined,
        platform_fee: isPrivateFleet ? 0 : undefined,
    };
}

export async function POST(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const effectiveRole = profile?.user_type === 'admin'
        ? 'admin'
        : businessAccess.isOwner
            ? 'owner'
            : businessAccess.teamMember?.role || 'viewer';
    const roleCapabilities = getBusinessRoleCapabilities(effectiveRole);
    const canCreateOffers = profile?.user_type === 'admin'
        || businessAccess.isOwner
        || roleCapabilities.canCreateMarketplaceOffers
        || roleCapabilities.canManagePrivateFleet;
    const canManagePrivateMoney = profile?.user_type === 'admin'
        || businessAccess.isOwner
        || businessAccess.teamMember?.role === 'finance_accountant';

    if (
        profile?.user_type !== 'business' &&
        profile?.user_type !== 'admin'
    ) {
        return NextResponse.json({ error: 'Only business and admin users can publish offers' }, { status: 403 });
    }

    if (profile?.user_type !== 'admin' && !canCreateOffers) {
        return NextResponse.json({ error: 'Tu rol no puede publicar o asignar rutas' }, { status: 403 });
    }

    const businessId = profile?.user_type === 'admin' ? businessAccess.businessId || authUser.id : businessAccess.businessId;

    if (!businessId) {
        return NextResponse.json({ error: 'Business access required' }, { status: 403 });
    }

    const body = (await request.json()) as CreateOfferRequest;
    if (body.assignmentMode === 'private' && !body.privateFleetTruckerId) {
        return NextResponse.json({ error: 'Selecciona un conductor de flota privada' }, { status: 400 });
    }

    const isPrivateFleet = body.assignmentMode === 'private' && Boolean(body.privateFleetTruckerId);
    const compensationMode = isPrivateFleet ? (body.compensationMode || 'salary_no_trip_pay') : null;
    const allowsTripPay = compensationMode === 'trip_pay' || compensationMode === 'trip_pay_plus_expenses';
    const allowsExpenses = compensationMode === 'expenses_only' || compensationMode === 'trip_pay_plus_expenses';
    const countryCode = body.countryCode || (profile as { country_code?: CreateOfferRequest['countryCode'] } | null)?.country_code || 'CO';
    const pickupContactPhone = normalizePhoneForNotification(body.pickupContactPhone, countryCode);
    const deliveryContactPhone = normalizePhoneForNotification(body.deliveryContactPhone, countryCode);
    const requestedFreightAmount = allowsTripPay
        ? Number(body.freightPaymentAmount || body.totalAmount || 0)
        : Number(body.freightPaymentAmount || 0);
    const requestedExpenseAmount = Number(body.expenseAllowanceAmount || 0);

    if (isPrivateFleet && compensationMode && !['salary_no_trip_pay', 'trip_pay', 'expenses_only', 'trip_pay_plus_expenses'].includes(compensationMode)) {
        return NextResponse.json({ error: 'Modo de compensacion privada invalido' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'salary_no_trip_pay' && Number(body.freightPaymentAmount || 0) > 0) {
        return NextResponse.json({ error: 'salary_no_trip_pay no permite pago por viaje dentro de KargaX' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'expenses_only' && Number(body.freightPaymentAmount || 0) > 0) {
        return NextResponse.json({ error: 'expenses_only no permite pago por viaje' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'salary_no_trip_pay' && requestedExpenseAmount > 0) {
        return NextResponse.json({ error: 'salary_no_trip_pay no permite viaticos dentro del viaje' }, { status: 400 });
    }

    if (isPrivateFleet && !allowsExpenses && requestedExpenseAmount > 0) {
        return NextResponse.json({ error: 'Este modo no permite gastos del viaje' }, { status: 400 });
    }

    if (isPrivateFleet && allowsTripPay && requestedFreightAmount <= 0) {
        return NextResponse.json({ error: 'Este modo requiere un pago por ruta mayor a cero' }, { status: 400 });
    }

    if (isPrivateFleet && compensationMode === 'expenses_only' && requestedExpenseAmount <= 0) {
        return NextResponse.json({ error: 'Solo gastos requiere un valor de gastos mayor a cero' }, { status: 400 });
    }

    if (isPrivateFleet && (requestedFreightAmount > 0 || requestedExpenseAmount > 0) && !canManagePrivateMoney) {
        return NextResponse.json({ error: 'Solo owner/admin/contabilidad puede definir montos de flota privada' }, { status: 403 });
    }

    if (
        isPrivateFleet
        && body.publishImmediately !== false
        && (
            !body.pickupContactName?.trim()
            || !pickupContactPhone
            || !body.deliveryContactName?.trim()
            || !deliveryContactPhone
        )
    ) {
        return NextResponse.json({ error: 'Completa responsable y telefono validos de origen y entrega para enviar los PIN' }, { status: 400 });
    }

    try {
        await enforceMonthlyTripLimit(supabaseAdmin, businessId);
    } catch (error) {
        if (isPlanLimitError(error)) {
            return NextResponse.json({
                success: false,
                data: null,
                error: {
                    message: error.message,
                    details: getPlanLimitErrorDetails(error),
                },
                code: 'PLAN_LIMIT_REACHED',
            }, { status: 402 });
        }

        console.warn('[Offers][POST] Monthly trip limit check unavailable; allowing offer creation.', {
            businessId,
            error: error instanceof Error ? error.message : error,
        });
    }

    if (isPrivateFleet) {
        const { data: fleetMember, error: fleetMemberError } = await supabaseAdmin
            .from('business_fleet_members')
            .select('id, status, trucker_id')
            .eq('business_id', businessId)
            .eq('trucker_id', body.privateFleetTruckerId || '')
            .maybeSingle();

        if (fleetMemberError) {
            return NextResponse.json({ error: fleetMemberError.message || 'No se pudo validar la flota privada' }, { status: 500 });
        }

        if (!fleetMember || fleetMember.status !== 'active') {
            return NextResponse.json({ error: 'El conductor seleccionado no pertenece a tu flota privada activa' }, { status: 409 });
        }

    }

    const insertPayload = toInsertPayload(body, businessId, (profile as { country_code?: string } | null)?.country_code);
    let offerResult = await supabaseAdmin
        .from('cargo_offers')
        .insert(insertPayload)
        .select('id, status, assigned_trucker_id, private_fleet_trucker_id, is_private_fleet')
        .single();

    if (offerResult.error?.code === '42703') {
        const legacyPayload: Record<string, unknown> = { ...insertPayload };
        delete legacyPayload.country_code;
        delete legacyPayload.currency_code;
        offerResult = await supabaseAdmin
            .from('cargo_offers')
            .insert(legacyPayload)
            .select('id, status, assigned_trucker_id, private_fleet_trucker_id, is_private_fleet')
            .single();
    }

    const { data: offer, error } = offerResult;

    if (error || !offer) {
        return NextResponse.json({ error: error?.message || 'Could not create offer' }, { status: 500 });
    }

    const normalizedPhotos = Array.isArray(body.photos)
        ? body.photos
            .map((photoUrl) => extractStoragePath(photoUrl))
            .filter((photoPath): photoPath is string => Boolean(photoPath))
        : [];

    if (normalizedPhotos.length > 0) {
        const { error: photosError } = await supabaseAdmin
            .from('offer_photos')
            .insert(
                normalizedPhotos.map((storagePath, index) => ({
                    offer_id: offer.id,
                    storage_path: storagePath,
                    file_name: storagePath.split('/').pop() || `photo-${index + 1}.jpg`,
                    file_size: 0,
                    mime_type: inferMimeTypeFromPath(storagePath),
                    sort_order: index,
                }))
            );

        if (photosError) {
            return NextResponse.json({ error: photosError.message || 'No se pudieron guardar las fotos de la oferta' }, { status: 500 });
        }
    }

    if (isPrivateFleet && body.publishImmediately !== false) {
        const freightPaymentAmount = allowsTripPay ? Number(body.freightPaymentAmount || body.totalAmount || 0) : 0;
        const expenseAllowanceAmount = allowsExpenses ? Number(body.expenseAllowanceAmount || 0) : 0;
        const allocationRows = [
            freightPaymentAmount > 0 ? {
                offer_id: offer.id,
                business_id: businessId,
                trucker_id: body.privateFleetTruckerId,
                allocation_type: 'freight_payment',
                amount: freightPaymentAmount,
                status: 'held_in_custody',
                release_trigger: 'delivery_pod',
                metadata: { source_kind: 'private_fleet_offer_assignment', compensation_mode: compensationMode },
            } : null,
            expenseAllowanceAmount > 0 ? {
                offer_id: offer.id,
                business_id: businessId,
                trucker_id: body.privateFleetTruckerId,
                allocation_type: 'expense_advance',
                amount: expenseAllowanceAmount,
                status: 'held_in_custody',
                release_trigger: body.expensesReleasePolicy || 'acceptance',
                metadata: {
                    source_kind: 'private_fleet_offer_assignment',
                    product_label: 'company_trip_expense',
                    compensation_mode: compensationMode,
                },
            } : null,
        ].filter((row): row is NonNullable<typeof row> => Boolean(row));

        if (allocationRows.length > 0) {
            const { error: allocationError } = await supabaseAdmin
                .from('trip_financial_allocations')
                .upsert(allocationRows, { onConflict: 'offer_id,allocation_type' });

            if (allocationError) {
                return NextResponse.json({ error: allocationError.message || 'No se pudo preparar la custodia privada' }, { status: 500 });
            }
        }

        await supabaseAdmin.rpc('create_notification', {
            p_user_id: body.privateFleetTruckerId,
            p_type: 'private_fleet_assignment',
            p_title: 'Nueva ruta directa asignada',
            p_message: expenseAllowanceAmount > 0
                ? `Tu empresa te asigno una ruta privada. Confirma el viaje para liberar ${expenseAllowanceAmount.toFixed(0)} en gastos del viaje.`
                : 'Tu empresa te asigno una ruta privada. Confirma el viaje para iniciar el flujo operativo.',
            p_data: {
                offer_id: offer.id,
                business_id: businessId,
                freight_payment_amount: freightPaymentAmount,
                expense_allowance_amount: expenseAllowanceAmount,
            },
        });
    }

    return NextResponse.json({
        success: true,
        data: offer,
    }, { status: 201 });
}
