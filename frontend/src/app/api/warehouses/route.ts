import { NextRequest } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    enforceWarehouseCreateLimit,
    getPlanLimitErrorDetails,
    getBusinessPlanSnapshot,
    isPlanLimitError,
    loadBillingPlans,
    resolveBusinessAccessContext,
    setActiveWarehousePreference,
} from '@/lib/server/warehouses';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
        let query = supabaseAdmin.from('warehouses').select('*').order('created_at', { ascending: false });

        if (profile?.user_type === 'admin') {
            const businessId = request.nextUrl.searchParams.get('businessId');

            if (businessId) {
                const [{ data: warehouses, error }, snapshot] = await Promise.all([
                    query.eq('business_id', businessId),
                    getBusinessPlanSnapshot(supabaseAdmin, businessId),
                ]);

                if (error) {
                    return apiError(error.message, {
                        status: 500,
                        code: 'WAREHOUSE_LIST_FAILED',
                        requestId,
                    });
                }

                return apiSuccess({
                    data: warehouses || [],
                    plans: snapshot.plans,
                    subscription: snapshot.subscription,
                    limits: snapshot.limits,
                    activeWarehouseId: null,
                    isOwner: false,
                    role: 'admin',
                }, {
                    code: 'WAREHOUSE_LIST_LOADED',
                    requestId,
                    meta: {
                        businessId,
                    },
                });
            }

            const { data: warehouses, error } = await query;

            if (error) {
                return apiError(error.message, {
                    status: 500,
                    code: 'WAREHOUSE_LIST_FAILED',
                    requestId,
                });
            }

            const plans = await loadBillingPlans(supabaseAdmin);

            return apiSuccess({
                data: warehouses || [],
                plans: plans || [],
                subscription: null,
                limits: {
                    activeWarehouses: (warehouses || []).length,
                    maxWarehouses: null,
                    activeInternalUsers: 0,
                    maxInternalUsers: null,
                    monthlyTrips: 0,
                    maxMonthlyTrips: null,
                    activePrivateFleetDrivers: 0,
                    maxPrivateFleetDrivers: null,
                    entitlementState: 'paid',
                    pilotActive: false,
                    pilotExpiresAt: null,
                    pilotDaysRemaining: null,
                    recommendedPlan: null,
                },
                activeWarehouseId: null,
                isOwner: false,
                role: 'admin',
            }, {
                code: 'WAREHOUSE_LIST_LOADED',
                requestId,
            });
        }

        if (profile?.user_type === 'business') {
            if (!businessAccess.businessId) {
                return apiError('Business access required', {
                    status: 403,
                    code: 'BUSINESS_ACCESS_REQUIRED',
                    requestId,
                });
            }

            if (businessAccess.isOwner) {
                query = query.eq('business_id', businessAccess.businessId);
            } else if (businessAccess.accessibleWarehouseIds.length) {
                query = query.in('id', businessAccess.accessibleWarehouseIds);
            } else {
                return apiSuccess({
                    data: [],
                    plans: [],
                    subscription: null,
                    limits: {
                        activeWarehouses: 0,
                        maxWarehouses: null,
                        activeInternalUsers: 0,
                        maxInternalUsers: null,
                        monthlyTrips: 0,
                        maxMonthlyTrips: null,
                        activePrivateFleetDrivers: 0,
                        maxPrivateFleetDrivers: null,
                    },
                    activeWarehouseId: null,
                    isOwner: false,
                    role: businessAccess.teamMember?.role || null,
                }, {
                    code: 'WAREHOUSE_LIST_LOADED',
                    requestId,
                    meta: {
                        businessId: businessAccess.businessId,
                    },
                });
            }

            const [{ data: warehouses, error }, snapshot] = await Promise.all([
                query,
                getBusinessPlanSnapshot(supabaseAdmin, businessAccess.businessId),
            ]);

            if (error) {
                return apiError(error.message, {
                    status: 500,
                    code: 'WAREHOUSE_LIST_FAILED',
                    requestId,
                });
            }

            return apiSuccess({
                data: warehouses || [],
                plans: snapshot.plans,
                subscription: snapshot.subscription,
                limits: snapshot.limits,
                activeWarehouseId: businessAccess.activeWarehouseId,
                isOwner: businessAccess.isOwner,
                role: businessAccess.teamMember?.role || (businessAccess.isOwner ? 'owner' : null),
            }, {
                code: 'WAREHOUSE_LIST_LOADED',
                requestId,
                meta: {
                    businessId: businessAccess.businessId,
                },
            });
        }

        return apiSuccess({
            data: [],
            plans: [],
            subscription: null,
            limits: {
                activeWarehouses: 0,
                maxWarehouses: null,
                activeInternalUsers: 0,
                maxInternalUsers: null,
                monthlyTrips: 0,
                maxMonthlyTrips: null,
                activePrivateFleetDrivers: 0,
                maxPrivateFleetDrivers: null,
            },
            activeWarehouseId: null,
            isOwner: false,
            role: null,
        }, {
            code: 'WAREHOUSE_LIST_LOADED',
            requestId,
        });
    } catch (error) {
        console.error('[Warehouses][GET]', error);
        return apiError('Internal server error', {
            status: 500,
            code: 'WAREHOUSE_LIST_FAILED',
            requestId,
        });
    }
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

    if (!profile || !['business', 'admin'].includes(profile.user_type)) {
        return apiError('Only business and admin users can create warehouses', {
            status: 403,
            code: 'WAREHOUSE_CREATE_ROLE_REQUIRED',
            requestId,
        });
    }

    try {
        const body = (await request.json()) as {
            code?: string;
            name?: string;
            description?: string;
            department?: string;
            city?: string;
            address?: string;
            timezone?: string;
            status?: 'active' | 'inactive' | 'maintenance';
            flowMode?: 'manual' | 'warehouse_managed' | '3pl';
            notes?: string;
            businessId?: string;
        };

        if (!body.code || !body.name || !body.department || !body.city || !body.address) {
            return apiError('code, name, department, city and address are required', {
                status: 400,
                code: 'WAREHOUSE_CREATE_VALIDATION_ERROR',
                requestId,
            });
        }

        const businessId =
            profile.user_type === 'admin'
                ? body.businessId || businessAccess.businessId || authUser.id
                : businessAccess.businessId;

        if (!businessId) {
            return apiError('businessId is required for admin-created warehouses', {
                status: 400,
                code: 'WAREHOUSE_BUSINESS_ID_REQUIRED',
                requestId,
            });
        }

        if (profile.user_type !== 'admin' && !businessAccess.isOwner) {
            return apiError('Only business owners can create warehouses', {
                status: 403,
                code: 'WAREHOUSE_OWNER_REQUIRED',
                requestId,
            });
        }

        if (profile.user_type !== 'admin') {
            await enforceWarehouseCreateLimit(supabaseAdmin, businessId);
        }

        const { data: warehouse, error } = await supabaseAdmin
            .from('warehouses')
            .insert({
                business_id: businessId,
                code: body.code.trim().toUpperCase(),
                name: body.name.trim(),
                description: body.description?.trim() || null,
                department: body.department.trim(),
                city: body.city.trim(),
                address: body.address.trim(),
                timezone: body.timezone || 'America/Bogota',
                status: body.status || 'active',
                flow_mode: body.flowMode || 'warehouse_managed',
                notes: body.notes?.trim() || null,
            })
            .select('*')
            .single();

        if (error || !warehouse) {
            return apiError(error?.message || 'Could not create warehouse', {
                status: 500,
                code: 'WAREHOUSE_CREATE_FAILED',
                requestId,
            });
        }

        await supabaseAdmin.from('warehouse_docks').insert({
            warehouse_id: warehouse.id,
            code: 'D-01',
            name: 'Muelle principal',
            dock_type: 'mixed',
            status: 'available',
            is_default: true,
        });

        if (profile.user_type !== 'admin') {
            const nextWarehouseId =
                businessAccess.activeWarehouseId ||
                warehouse.id;
            await setActiveWarehousePreference(supabaseAdmin, authUser.id, nextWarehouseId);
        }

        return apiSuccess(warehouse, {
            status: 201,
            code: 'WAREHOUSE_CREATED',
            requestId,
            meta: {
                businessId,
                warehouseId: warehouse.id,
            },
        });
    } catch (error) {
        console.error('[Warehouses][POST]', error);
        if (isPlanLimitError(error)) {
            return apiError(error.message, {
                status: 402,
                code: 'PLAN_LIMIT_REACHED',
                requestId,
                details: getPlanLimitErrorDetails(error),
            });
        }

        return apiError(error instanceof Error ? error.message : 'Internal server error', {
            status: 500,
            code: 'WAREHOUSE_CREATE_FAILED',
            requestId,
        });
    }
}
