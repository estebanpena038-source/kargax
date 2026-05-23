import { NextRequest } from 'next/server';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import {
    getBillingCheckoutInfrastructureStatus,
    getBusinessPlanSnapshot,
    resolveBusinessAccessContext,
} from '@/lib/server/warehouses';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
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

        const [snapshot, billingCheckout] = await Promise.all([
            getBusinessPlanSnapshot(supabaseAdmin, businessId),
            getBillingCheckoutInfrastructureStatus(supabaseAdmin),
        ]);
        return apiSuccess({
            subscription: snapshot.subscription,
            limits: snapshot.limits,
            usage: snapshot.limits,
            teamSchemaReady: snapshot.teamSchemaReady,
            teamSchemaMessage: snapshot.teamSchemaMessage,
            billingCheckoutReady: billingCheckout.ready,
            billingCheckoutMessage: billingCheckout.message,
        }, {
            code: 'BILLING_USAGE_LOADED',
            requestId,
            meta: {
                businessId,
            },
        });
    } catch (error) {
        console.error('[BillingSubscriptionUsage][GET]', error);
        return apiError(error instanceof Error ? error.message : 'Internal server error', {
            status: 500,
            code: 'BILLING_USAGE_LOAD_FAILED',
            requestId,
        });
    }
}
