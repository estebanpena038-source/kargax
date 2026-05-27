// =============================================================================
// KARGAX - SUPABASE API BRIDGE
// Redirige las llamadas de api.offers a Supabase
// =============================================================================

import { supabaseOffers, CreateOfferData, SearchOffersParams } from './offers';
import { normalizeVehicleTypeCode } from '@/constants/colombia';

const COUNTRY_TO_CURRENCY: Record<string, 'COP' | 'USD' | 'PEN' | 'BRL'> = {
    CO: 'COP',
    EC: 'USD',
    PE: 'PEN',
    BR: 'BRL',
};

// =============================================================================
// Helper: Map form payload to Supabase format
// El formulario envía campos diferentes, los mapeamos aquí
// =============================================================================
function mapFormToSupabase(data: any): CreateOfferData {
    const countryCode = (data.countryCode || data.country || 'CO') as 'CO' | 'EC' | 'PE' | 'BR';
    const vehicleType = normalizeVehicleTypeCode(data.requiredVehicle || data.vehicleType) || data.requiredVehicle || data.vehicleType || 'TURBO';
    const manifestItems = Array.isArray(data.manifestItems) ? data.manifestItems : [];
    const manifestQuantity = manifestItems.reduce((sum: number, item: any) => sum + Math.max(1, Number(item?.quantity || 1)), 0);
    const manifestWeightKg = manifestItems.reduce((sum: number, item: any) => {
        const quantity = Math.max(1, Number(item?.quantity || 1));
        const weightKg = Math.max(0, Number(item?.weightKg || 0));
        return sum + (quantity * weightKg);
    }, 0);

    return {
        cargoType: data.cargoType || 'GENERAL',
        cargoDescription: data.description || data.cargoDescription || 'Carga general',
        weightKg: manifestWeightKg > 0 ? manifestWeightKg : (data.weight || data.weightKg || 1),
        dimensionLength: data.dimensionLength,
        dimensionWidth: data.dimensionWidth,
        dimensionHeight: data.dimensionHeight,
        quantity: manifestQuantity > 0 ? manifestQuantity : (data.quantity || 1),
        temperatureMin: data.temperatureMin,
        temperatureMax: data.temperatureMax,
        specialRequirements: data.specialRequirements,
        originDepartment: data.originDepartment || '',
        originCity: data.originCity || '',
        originAddress: data.originAddress || 'Por confirmar',
        originLatitude: data.originLatitude,
        originLongitude: data.originLongitude,
        destinationDepartment: data.destDepartment || data.destinationDepartment || '',
        destinationCity: data.destCity || data.destinationCity || '',
        destinationAddress: data.destAddress || data.destinationAddress || 'Por confirmar',
        destinationLatitude: data.destinationLatitude,
        destinationLongitude: data.destinationLongitude,
        pickupDate: data.pickupDate?.split('T')[0] || new Date().toISOString().split('T')[0],
        pickupTimeStart: data.pickupDate?.split('T')[1]?.substring(0, 5) || data.pickupTimeStart || '08:00',
        pickupTimeEnd: data.pickupTimeEnd || '18:00',
        deliveryDate: data.deliveryDate?.split('T')[0] || data.pickupDate?.split('T')[0] || new Date().toISOString().split('T')[0],
        deliveryTimeStart: data.deliveryDate?.split('T')[1]?.substring(0, 5) || data.deliveryTimeStart || '08:00',
        deliveryTimeEnd: data.deliveryTimeEnd || '18:00',
        totalAmount: data.budgetMax || data.totalAmount || 0,
        ratePerKm: data.ratePerKm,
        paymentMethod: data.paymentMethod || 'bank_transfer',
        paymentSchedule: data.paymentSchedule || 'on_delivery',
        additionalTerms: data.additionalTerms,
        vehicleType,
        minExperienceYears: data.minExperienceYears || 0,
        requiredLicenses: data.requiredLicenses,
        requiredCertifications: data.requiredCertifications,
        insuranceRequired: data.insuranceRequired || false,
        additionalRequirements: data.additionalRequirements,
        publishImmediately: data.publishImmediately !== false,
        // Picking/Manifest fields - CRITICAL for digital picking flow
        manifestItems,
        pickupContactName: data.pickupContactName,
        pickupContactPhone: data.pickupContactPhone,
        deliveryContactName: data.deliveryContactName,
        deliveryContactPhone: data.deliveryContactPhone,
        warehouseFlowMode: data.warehouseFlowMode,
        originWarehouseId: data.originWarehouseId,
        destinationWarehouseId: data.destinationWarehouseId,
        originDockId: data.originDockId,
        destinationDockId: data.destinationDockId,
        assignmentMode: data.assignmentMode || 'public',
        privateFleetTruckerId: data.privateFleetTruckerId,
        compensationMode: data.compensationMode,
        expensesReleasePolicy: data.expensesReleasePolicy,
        expenseAllowanceAmount: data.expenseAllowanceAmount,
        freightPaymentAmount: data.freightPaymentAmount,
        privateFleetNotes: data.privateFleetNotes,
        countryCode,
        currencyCode: data.currencyCode || COUNTRY_TO_CURRENCY[countryCode] || 'COP',
        photos: Array.isArray(data.photos) ? data.photos : [],
    };
}

// =============================================================================
// Wrapper que mapea la API existente a Supabase
// =============================================================================

export const supabaseApi = {
    offers: {
        // CREATE
        create: async (data: any) => {
            console.log('[API Bridge] Received create data:', data);
            const mappedData = mapFormToSupabase(data);
            console.log('[API Bridge] Mapped to Supabase format:', mappedData);
            const result = await supabaseOffers.create(mappedData);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
                code: result.code,
                details: result.details,
            };
        },

        // SEARCH
        search: async (params?: SearchOffersParams) => {
            const result = await supabaseOffers.search(params);
            if (!result.success || !result.data) {
                return { success: false, data: null, message: result.error };
            }
            // Mapear al formato esperado por el frontend
            return {
                success: true,
                data: {
                    data: result.data.data.map(o => ({
                        id: o.id,
                        cargoType: o.cargo_type,
                        originCity: o.origin_city,
                        originDepartment: o.origin_department,
                        destinationCity: o.destination_city,
                        destCity: o.destination_city,
                        destDepartment: o.destination_department,
                        pickupDate: o.pickup_date,
                        totalAmount: o.total_amount,
                        freightPaymentAmount: o.freight_payment_amount || o.total_amount,
                        expenseAllowanceAmount: o.expense_allowance_amount || 0,
                        budgetMin: o.total_amount,
                        budgetMax: o.total_amount,
                        vehicleType: o.vehicle_type,
                        requiredVehicle: o.vehicle_type,
                        status: o.status,
                        assignmentMode: o.is_private_fleet ? 'private' : 'public',
                        privateFleetTruckerId: o.private_fleet_trucker_id || o.assigned_trucker_id || null,
                        applicationsCount: o.applications_count,
                        companyName: null,
                        publishedAt: o.published_at,
                        createdAt: o.created_at,
                        title: o.cargo_description?.substring(0, 50) || 'Oferta de carga',
                        description: o.cargo_description,
                        countryCode: o.country_code || 'CO',
                        currency: o.currency_code || COUNTRY_TO_CURRENCY[o.country_code || 'CO'] || 'COP',
                        originWarehouseId: o.origin_warehouse_id || null,
                        destinationWarehouseId: o.destination_warehouse_id || null,
                        warehouseFlowMode: o.warehouse_flow_mode || 'manual',
                    })),
                    meta: result.data.meta,
                },
            };
        },

        // GET MY OFFERS
        getMyOffers: async (params?: { page?: number; limit?: number; status?: string }) => {
            const result = await supabaseOffers.getMyOffers(params);
            if (!result.success || !result.data) {
                return { success: false, data: [], message: result.error };
            }
            return {
                success: true,
                data: result.data.map(o => ({
                    id: o.id,
                    title: o.cargo_description?.substring(0, 50) || 'Oferta',
                    cargoType: o.cargo_type,
                    originCity: o.origin_city,
                    destCity: o.destination_city,
                    pickupDate: o.pickup_date,
                    budgetMin: o.total_amount,
                    budgetMax: o.total_amount,
                    freightPaymentAmount: o.freight_payment_amount || o.total_amount,
                    expenseAllowanceAmount: o.expense_allowance_amount || 0,
                    currency: o.currency_code || COUNTRY_TO_CURRENCY[o.country_code || 'CO'] || 'COP',
                    countryCode: o.country_code || 'CO',
                    requiredVehicle: o.vehicle_type,
                    status: o.status,
                    assignmentMode: o.is_private_fleet ? 'private' : 'public',
                    companyName: null,
                    createdAt: o.created_at,
                    applicationsCount: o.applications_count,
                })),
            };
        },

        // GET BY ID
        getById: async (id: string) => {
            const result = await supabaseOffers.getById(id);
            if (!result.success || !result.data) {
                return { success: false, data: null, message: result.error };
            }
            const o = result.data;
            return {
                success: true,
                data: {
                    id: o.id,
                    title: o.cargo_description?.substring(0, 50) || 'Oferta',
                    description: o.cargo_description,
                    cargoType: o.cargo_type,
                    weight: o.weight_kg,
                    originCity: o.origin_city,
                    originDepartment: o.origin_department,
                    originAddress: o.origin_address,
                    destCity: o.destination_city,
                    destDepartment: o.destination_department,
                    destAddress: o.destination_address,
                    pickupDate: o.pickup_date,
                    deliveryDate: o.delivery_date,
                    budgetMin: o.total_amount,
                    budgetMax: o.total_amount,
                    freightPaymentAmount: o.freight_payment_amount || o.total_amount,
                    expenseAllowanceAmount: o.expense_allowance_amount || 0,
                    requiredVehicle: o.vehicle_type,
                    specialRequirements: o.special_requirements,
                    countryCode: o.country_code || 'CO',
                    currency: o.currency_code || COUNTRY_TO_CURRENCY[o.country_code || 'CO'] || 'COP',
                    status: o.status,
                    assignmentMode: o.is_private_fleet ? 'private' : 'public',
                    privateFleetTruckerId: o.private_fleet_trucker_id || o.assigned_trucker_id || null,
                    viewCount: o.views_count,
                    applicationsCount: o.applications_count,
                    createdAt: o.created_at,
                    originWarehouseId: o.origin_warehouse_id || null,
                    destinationWarehouseId: o.destination_warehouse_id || null,
                    originDockId: o.origin_dock_id || null,
                    destinationDockId: o.destination_dock_id || null,
                    warehouseFlowMode: o.warehouse_flow_mode || 'manual',
                },
            };
        },

        // UPDATE
        update: async (id: string, data: any) => {
            console.log('[API Bridge] Update received:', data);
            // Mapear campos del frontend al formato de Supabase
            const mappedData: any = {};

            if (data.title) mappedData.title = data.title;
            if (data.description) mappedData.cargoDescription = data.description;
            if (data.cargoType) mappedData.cargoType = data.cargoType;
            if (data.weight) mappedData.weightKg = data.weight;
            if (data.originDepartment) mappedData.originDepartment = data.originDepartment;
            if (data.originCity) mappedData.originCity = data.originCity;
            if (data.originAddress) mappedData.originAddress = data.originAddress;
            if (data.destDepartment) mappedData.destinationDepartment = data.destDepartment;
            if (data.destCity) mappedData.destinationCity = data.destCity;
            if (data.destAddress) mappedData.destinationAddress = data.destAddress;
            if (data.pickupDate) mappedData.pickupDate = data.pickupDate;
            if (data.deliveryDate) mappedData.deliveryDate = data.deliveryDate;
            if (data.budgetMax) mappedData.totalAmount = data.budgetMax;
            if (data.requiredVehicle) mappedData.vehicleType = normalizeVehicleTypeCode(data.requiredVehicle) || data.requiredVehicle;
            if (data.specialRequirements !== undefined) mappedData.specialRequirements = data.specialRequirements;

            console.log('[API Bridge] Update mapped:', mappedData);
            const result = await supabaseOffers.update(id, mappedData);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        // DELETE
        delete: async (id: string) => {
            const result = await supabaseOffers.delete(id);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        // PUBLISH
        publish: async (id: string) => {
            const result = await supabaseOffers.publish(id);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        // APPLY
        apply: async (offerId: string, data?: any) => {
            const result = await supabaseOffers.apply(offerId, data);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        // GET APPLICATIONS
        getApplications: async (offerId: string) => {
            const result = await supabaseOffers.getApplications(offerId);
            console.log('[API Bridge] getApplications result:', result);
            if (!result.success || !result.data) {
                return { success: false, data: [], message: result.error };
            }
            return {
                success: true,
                data: result.data.map((a: any) => ({
                    id: a.id,
                    offerId: a.offer_id,
                    truckerId: a.trucker_id,
                    status: a.status,
                    proposedAmount: a.proposed_amount,
                    message: a.message,
                    truckerName: a.truckerName || 'Transportador',
                    truckerEmail: a.truckerEmail || '',
                    truckerPhone: a.truckerPhone || null,
                    yearsExperience: a.yearsExperience || null,
                    vehicleTypeConfirmed: a.vehicleTypeConfirmed || null,
                    vehiclePlate: a.vehiclePlate || null,
                    licenseType: a.licenseType || null,
                    hasInsurance: a.hasInsurance || false,
                    applicationPayload: a.applicationPayload || {},
                    createdAt: a.created_at,
                })),
            };
        },

        // RESPOND TO APPLICATION
        respondToApplication: async (offerId: string, appId: string, data: any) => {
            const result = await supabaseOffers.respondToApplication(offerId, appId, data);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        // ACCEPT APPLICATION WITH MESSAGE (Atomic Transaction)
        acceptApplicationWithMessage: async (
            offerId: string,
            appId: string,
            messageContent: string,
            businessResponse?: string
        ) => {
            const result = await supabaseOffers.acceptApplicationWithMessage(
                offerId,
                appId,
                messageContent,
                businessResponse
            );
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        // GET MY APPLICATIONS
        getMyApplications: async () => {
            const result = await supabaseOffers.getMyApplications();
            if (!result.success || !result.data) {
                return { success: false, data: { data: [] }, message: result.error };
            }
            return {
                success: true,
                data: {
                    data: result.data.data.map((a: any) => ({
                        id: a.id,
                        offerId: a.offer_id,
                        status: a.status,
                        proposedAmount: a.proposed_amount,
                        businessResponse: a.business_response,
                        createdAt: a.created_at,
                        updatedAt: a.updated_at,
                        offer: a.offer ? {
                            cargoType: a.offer.cargo_type,
                            originCity: a.offer.origin_city,
                            originAddress: a.offer.origin_address,
                            destinationCity: a.offer.destination_city,
                            destinationAddress: a.offer.destination_address,
                            pickupDate: a.offer.pickup_date,
                            deliveryDate: a.offer.delivery_date,
                            totalAmount: a.offer.total_amount,
                            countryCode: a.offer.country_code || 'CO',
                            currency: a.offer.currency_code || COUNTRY_TO_CURRENCY[a.offer.country_code || 'CO'] || 'COP',
                            freightPaymentAmount: a.offer.freight_payment_amount || a.offer.total_amount,
                            expenseAllowanceAmount: a.offer.expense_allowance_amount || 0,
                            status: a.offer.status,
                            assignmentMode: a.offer.is_private_fleet ? 'private' : 'public',
                            privateFleetTruckerId: a.offer.private_fleet_trucker_id || a.offer.assigned_trucker_id || null,
                            businessId: a.offer.business_id || null,
                            companyName: 'Empresa',
                            businessEmail: null,
                            businessPhone: null,
                        } : null,
                    })),
                },
            };
        },

        withdrawApplication: async (applicationId: string) => {
            const result = await supabaseOffers.withdrawApplication(applicationId);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
                code: result.code,
                details: result.details,
            };
        },

        // RECORD VIEW
        recordView: async (offerId: string) => {
            const result = await supabaseOffers.recordView(offerId);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        // GET OFFER VIEWS
        getOfferViews: async (offerId: string) => {
            const result = await supabaseOffers.getOfferViews(offerId);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        // GET VIEW STATS (alias)
        getViewStats: async (offerId: string) => {
            return supabaseApi.offers.getOfferViews(offerId);
        },

        // MARK AS COMPLETED
        markAsCompleted: async (offerId: string) => {
            const { supabase } = await import('./client');
            const { error } = await (supabase
                .from('cargo_offers' as any) as any)
                .update({ status: 'completed' as const })
                .eq('id', offerId);
            if (error) {
                return { success: false, data: null, message: error.message };
            }
            return { success: true, data: { completed: true } };
        },
    },

    // =========================================================================
    // MESSAGES MODULE (migrado a Supabase)
    // =========================================================================
    messages: {
        getConversations: async () => {
            const { supabaseMessages } = await import('./messages');
            const result = await supabaseMessages.getConversations();
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        getMessages: async (conversationId: string, params?: { page?: number; limit?: number }) => {
            const { supabaseMessages } = await import('./messages');
            const result = await supabaseMessages.getMessages(conversationId, params);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        send: async (data: { recipientId: string; content: string; offerId?: string }) => {
            const { supabaseMessages } = await import('./messages');
            const result = await supabaseMessages.send(data);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        markAsRead: async (conversationId: string) => {
            const { supabaseMessages } = await import('./messages');
            const result = await supabaseMessages.markAsRead(conversationId);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        getUnreadCount: async () => {
            const { supabaseMessages } = await import('./messages');
            const result = await supabaseMessages.getUnreadCount();
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },
    },

    // =========================================================================
    // NOTIFICATIONS MODULE
    // =========================================================================
    notifications: {
        getAll: async (params?: { limit?: number; unreadOnly?: boolean }) => {
            const { supabaseNotifications } = await import('./notifications');
            const result = await supabaseNotifications.getAll(params);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        getUnreadCount: async () => {
            const { supabaseNotifications } = await import('./notifications');
            const result = await supabaseNotifications.getUnreadCount();
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        markAsRead: async (notificationId: string) => {
            const { supabaseNotifications } = await import('./notifications');
            const result = await supabaseNotifications.markAsRead(notificationId);
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        markAllAsRead: async () => {
            const { supabaseNotifications } = await import('./notifications');
            const result = await supabaseNotifications.markAllAsRead();
            return {
                success: result.success,
                data: result.data,
                message: result.error,
            };
        },

        subscribe: (userId: string, onNotification: (notification: any) => void) => {
            // Dynamic import to avoid SSR issues
            import('./notifications').then(({ supabaseNotifications }) => {
                return supabaseNotifications.subscribeToNotifications(userId, onNotification);
            });
        },
    },
};

export default supabaseApi;
