import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route, requireAuthenticatedRoute } from '@/lib/server/route-auth';
import {
    canManageHoldingBusinessLinks,
    createHoldingApproval,
    getHoldingBusinesses,
    linkBusinessToHolding,
    resolveHoldingAccessContext,
} from '@/lib/server/holding';

export async function GET(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveHoldingAccessContext(
            supabaseAdmin,
            authUser.id,
            profile,
            request.nextUrl.searchParams.get('holdingId')
        );

        if (!access.ready) {
            return NextResponse.json({
                ready: false,
                message: access.message,
                holdingAccountId: null,
                role: access.role,
                capabilities: access.capabilities,
                canManageHolding: false,
                canLinkDirectly: false,
                linked: [],
                catalog: [],
            });
        }

        if (!access.holdingAccountId) {
            return NextResponse.json({
                ready: true,
                message: null,
                holdingAccountId: null,
                role: null,
                capabilities: null,
                canManageHolding: false,
                canLinkDirectly: false,
                linked: [],
                catalog: [],
            });
        }

        const response = await getHoldingBusinesses(
            supabaseAdmin,
            authUser.id,
            profile,
            access.holdingAccountId,
            access.role,
            access.accounts
        );

        return NextResponse.json(response);
    } catch (error) {
        console.error('[HoldingBusinesses][GET]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const body = (await request.json()) as {
            businessId?: string;
            relationshipType?: 'parent' | 'subsidiary' | 'brand' | 'operator';
            holdingId?: string;
        };
        const { supabaseAdmin, authUser, profile } = auth.context;
        const access = await resolveHoldingAccessContext(
            supabaseAdmin,
            authUser.id,
            profile,
            body.holdingId || null
        );

        if (!access.ready) {
            return NextResponse.json(
                { error: access.message || 'Holding infrastructure is not ready' },
                { status: 503 }
            );
        }

        if (!access.holdingAccountId) {
            return NextResponse.json({ error: 'No holding account selected' }, { status: 403 });
        }

        const businessId = body.businessId?.trim();
        const relationshipType = body.relationshipType || 'subsidiary';

        if (!businessId) {
            return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
        }

        if (!['parent', 'subsidiary', 'brand', 'operator'].includes(relationshipType)) {
            return NextResponse.json({ error: 'Invalid relationshipType' }, { status: 400 });
        }

        const businessContext = await getHoldingBusinesses(
            supabaseAdmin,
            authUser.id,
            profile,
            access.holdingAccountId,
            access.role,
            access.accounts
        );
        const targetCatalogBusiness = businessContext.catalog.find((business) => business.business_id === businessId);
        const targetLinkedBusiness = businessContext.linked.find((business) => business.business_id === businessId);

        if (!targetCatalogBusiness && !targetLinkedBusiness) {
            return NextResponse.json(
                { error: 'You do not have permission to link this business into the holding' },
                { status: 403 }
            );
        }

        if (
            targetCatalogBusiness?.current_holding_id &&
            targetCatalogBusiness.current_holding_id !== access.holdingAccountId
        ) {
            return NextResponse.json(
                { error: 'This business already belongs to a different holding' },
                { status: 409 }
            );
        }

        if (canManageHoldingBusinessLinks(access.role)) {
            await linkBusinessToHolding(supabaseAdmin, {
                holdingAccountId: access.holdingAccountId,
                businessId,
                relationshipType,
                createdBy: authUser.id,
            });

            return NextResponse.json({
                success: true,
                mode: 'linked',
            });
        }

        await createHoldingApproval(supabaseAdmin, {
            holdingAccountId: access.holdingAccountId,
            businessId,
            requestType: 'business_link',
            priority: 'high',
            title: `Solicitud de vinculacion para ${targetCatalogBusiness?.company_name || targetLinkedBusiness?.company_name || 'empresa'}`,
            description: 'Solicitud creada desde la consola corporativa para conectar una nueva empresa al holding.',
            requestPayload: {
                businessId,
                relationshipType,
            },
            requestedBy: authUser.id,
        });

        return NextResponse.json({
            success: true,
            mode: 'approval_requested',
        });
    } catch (error) {
        console.error('[HoldingBusinesses][POST]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
