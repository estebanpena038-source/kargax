import { NextRequest } from 'next/server';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    getWarehouseCapabilities,
    getBusinessPlanSnapshot,
    ensureWarehouseAccess,
    resolveBusinessAccessContext,
    setActiveWarehousePreference,
} from '@/lib/server/warehouses';
import { resolveHoldingAccessContext } from '@/lib/server/holding';
import { getBusinessRoleCapabilities } from '@/lib/business-roles';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
        const holdingAccess = await resolveHoldingAccessContext(supabaseAdmin, authUser.id, profile);

        if (!access.businessId && profile?.user_type !== 'admin') {
            return apiSuccess({
                businessId: null,
                businessName: null,
                activeWarehouseId: null,
                warehouses: [],
                role: null,
                capabilities: null,
                subscription: null,
                limits: null,
                holdingReady: holdingAccess.ready,
                holdingMessage: holdingAccess.message,
                holdingAccountId: holdingAccess.holdingAccountId,
                holdingRole: holdingAccess.role,
            }, {
                code: 'WAREHOUSE_ACCESS_LOADED',
                requestId,
            });
        }

        const scopedBusiness = resolveScopedBusinessId({
            requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
            resolvedBusinessId: access.businessId,
            profile,
        });

        if ('error' in scopedBusiness) {
            return apiError(scopedBusiness.error || 'Business scope error', {
                status: scopedBusiness.status,
                code: 'BUSINESS_SCOPE_ERROR',
                requestId,
            });
        }

        const businessId = scopedBusiness.businessId;
        const activeWarehouseAccess = access.activeWarehouseId
            ? await ensureWarehouseAccess(supabaseAdmin, authUser.id, profile, access.activeWarehouseId)
            : null;
        const effectiveRole =
            activeWarehouseAccess?.membershipRole ||
            access.teamMember?.role ||
            (access.isOwner ? 'owner' : profile?.user_type === 'admin' ? 'admin' : null);
        const effectiveCapabilities = effectiveRole ? getWarehouseCapabilities(effectiveRole) : null;
        const roleCapabilities = getBusinessRoleCapabilities(effectiveRole);

        const warehouseQuery = supabaseAdmin
            .from('warehouses')
            .select('*')
            .eq('business_id', businessId)
            .order('name', { ascending: true });

        const [warehousesResponse, snapshot, businessProfileResponse] = await Promise.all([
            access.isOwner || profile?.user_type === 'admin'
                ? warehouseQuery
                : access.accessibleWarehouseIds.length
                    ? warehouseQuery.in('id', access.accessibleWarehouseIds)
                    : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
            getBusinessPlanSnapshot(supabaseAdmin, businessId),
            supabaseAdmin
                .from('business_profiles')
                .select('company_name')
                .eq('user_id', businessId)
                .maybeSingle(),
        ]);

        if (warehousesResponse.error) {
            return apiError(warehousesResponse.error.message, {
                status: 500,
                code: 'WAREHOUSE_ACCESS_FAILED',
                requestId,
            });
        }

        return apiSuccess({
            businessId,
            businessName: businessProfileResponse.data?.company_name || null,
            activeWarehouseId: access.activeWarehouseId,
            warehouses: warehousesResponse.data || [],
            role: effectiveRole,
            capabilities: effectiveCapabilities,
            subscription: snapshot.subscription,
            limits: snapshot.limits,
            isOwner: access.isOwner,
            canManageBilling: roleCapabilities.canManageBilling,
            canManageTeam: roleCapabilities.canManageTeam,
            canViewFinance: roleCapabilities.canViewFinance,
            canExportFinance: roleCapabilities.canExportFinance,
            canViewOperations: roleCapabilities.canViewOperations,
            canCreateMarketplaceOffers: roleCapabilities.canCreateMarketplaceOffers,
            canManagePrivateFleet: roleCapabilities.canManagePrivateFleet,
            canViewTracking: roleCapabilities.canViewTracking,
            canViewIntelligence: roleCapabilities.canViewIntelligence,
            holdingReady: holdingAccess.ready,
            holdingMessage: holdingAccess.message,
            holdingAccountId: holdingAccess.holdingAccountId,
            holdingRole: holdingAccess.role,
        }, {
            code: 'WAREHOUSE_ACCESS_LOADED',
            requestId,
            meta: {
                businessId,
            },
        });
    } catch (error) {
        console.error('[WarehouseAccess][GET]', error);
        return apiError(error instanceof Error ? error.message : 'Internal server error', {
            status: 500,
            code: 'WAREHOUSE_ACCESS_FAILED',
            requestId,
        });
    }
}

export async function PATCH(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

        if (!access.businessId && profile?.user_type !== 'admin') {
            return apiError('Business access required', {
                status: 403,
                code: 'BUSINESS_ACCESS_REQUIRED',
                requestId,
            });
        }

        const body = (await request.json()) as { activeWarehouseId?: string | null };
        const nextWarehouseId = body.activeWarehouseId || null;
        const scopedBusiness = resolveScopedBusinessId({
            requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
            resolvedBusinessId: access.businessId,
            profile,
        });

        if (
            nextWarehouseId &&
            !access.isOwner &&
            profile?.user_type !== 'admin' &&
            !access.accessibleWarehouseIds.includes(nextWarehouseId)
        ) {
            return apiError('Warehouse access denied', {
                status: 403,
                code: 'WAREHOUSE_ACCESS_DENIED',
                requestId,
            });
        }

        if (nextWarehouseId && (access.isOwner || profile?.user_type === 'admin')) {
            if ('error' in scopedBusiness) {
                return apiError(scopedBusiness.error || 'Business scope error', {
                    status: scopedBusiness.status,
                    code: 'BUSINESS_SCOPE_ERROR',
                    requestId,
                });
            }

            const { data: warehouse } = await supabaseAdmin
                .from('warehouses')
                .select('id')
                .eq('id', nextWarehouseId)
                .eq('business_id', scopedBusiness.businessId || '')
                .maybeSingle();

            if (!warehouse) {
                return apiError('Warehouse not found for this business', {
                    status: 404,
                    code: 'WAREHOUSE_NOT_FOUND',
                    requestId,
                });
            }
        }

        await setActiveWarehousePreference(supabaseAdmin, authUser.id, nextWarehouseId);

        return apiSuccess({
            success: true,
            activeWarehouseId: nextWarehouseId,
        }, {
            code: 'ACTIVE_WAREHOUSE_UPDATED',
            requestId,
        });
    } catch (error) {
        console.error('[WarehouseAccess][PATCH]', error);
        return apiError(error instanceof Error ? error.message : 'Internal server error', {
            status: 500,
            code: 'WAREHOUSE_ACCESS_UPDATE_FAILED',
            requestId,
        });
    }
}
