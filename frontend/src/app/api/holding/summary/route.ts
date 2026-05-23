import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { getHoldingSummary, resolveHoldingAccessContext } from '@/lib/server/holding';

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
                hasHoldingAccess: false,
                role: access.role,
                capabilities: access.capabilities,
                featureEnabled: false,
                account: null,
                stats: {
                    totalBusinesses: 0,
                    totalWarehouses: 0,
                    totalActiveInternalUsers: 0,
                    totalMonthlyTrips: 0,
                    openIncidents: 0,
                    criticalIncidents: 0,
                    activeHoldingMembers: 0,
                },
                accounts: access.accounts,
                businesses: [],
                controlTower: {
                    appointmentsToday: 0,
                    activeAppointments: 0,
                    delayedAppointments: 0,
                    otifRate: 0,
                    dockOccupancyRate: 0,
                    paymentReadyRate: 0,
                    paymentPendingAppointments: 0,
                    atRiskBusinesses: 0,
                    blockedBusinesses: 0,
                },
                fintech: {
                    completedPayments: 0,
                    pendingPayments: 0,
                    failedPayments: 0,
                    reconciledPaymentsRate: 0,
                    custodyCollectedCop: 0,
                    custodyPendingCop: 0,
                    platformRevenueCop: 0,
                    walletAvailableCop: 0,
                    walletPendingCop: 0,
                    pendingWithdrawalsCop: 0,
                    advanceOutstandingCop: 0,
                    advanceOverdueCop: 0,
                    activeAdvanceCount: 0,
                    par7Amount: 0,
                    par30Amount: 0,
                    npl30Amount: 0,
                    par7Rate: 0,
                    par30Rate: 0,
                    npl30Rate: 0,
                    writeOffAmount: 0,
                    recoveredPrincipalCop: 0,
                },
                marketplace: {
                    publishedOffers: 0,
                    assignedOffers: 0,
                    inTransitOffers: 0,
                    deliveredOffers: 0,
                    threePlOffers: 0,
                    fillRate: 0,
                    clientAccounts: 0,
                    activeClientAccounts: 0,
                    receiptsProcessed: 0,
                    dispatchesProcessed: 0,
                    dispatchReadyRate: 0,
                    multiClientBusinesses: 0,
                },
                paymentsReadiness: {
                    ready: false,
                    productionLikeUrl: false,
                    checkoutReady: false,
                    freightWebhookReady: false,
                    billingWebhookReady: false,
                    notificationsReady: false,
                    missingKeys: [],
                    warnings: [],
                },
                alerts: [],
                recommendedPlanCode: 'enterprise',
                approvals: {
                    pending: 0,
                    critical: 0,
                    breached: 0,
                    doubleBreached: 0,
                },
            });
        }

        if (!access.holdingAccountId) {
            return NextResponse.json({
                ready: true,
                message: null,
                hasHoldingAccess: false,
                role: null,
                capabilities: null,
                featureEnabled: false,
                account: null,
                stats: {
                    totalBusinesses: 0,
                    totalWarehouses: 0,
                    totalActiveInternalUsers: 0,
                    totalMonthlyTrips: 0,
                    openIncidents: 0,
                    criticalIncidents: 0,
                    activeHoldingMembers: 0,
                },
                accounts: access.accounts,
                businesses: [],
                controlTower: {
                    appointmentsToday: 0,
                    activeAppointments: 0,
                    delayedAppointments: 0,
                    otifRate: 0,
                    dockOccupancyRate: 0,
                    paymentReadyRate: 0,
                    paymentPendingAppointments: 0,
                    atRiskBusinesses: 0,
                    blockedBusinesses: 0,
                },
                fintech: {
                    completedPayments: 0,
                    pendingPayments: 0,
                    failedPayments: 0,
                    reconciledPaymentsRate: 0,
                    custodyCollectedCop: 0,
                    custodyPendingCop: 0,
                    platformRevenueCop: 0,
                    walletAvailableCop: 0,
                    walletPendingCop: 0,
                    pendingWithdrawalsCop: 0,
                    advanceOutstandingCop: 0,
                    advanceOverdueCop: 0,
                    activeAdvanceCount: 0,
                    par7Amount: 0,
                    par30Amount: 0,
                    npl30Amount: 0,
                    par7Rate: 0,
                    par30Rate: 0,
                    npl30Rate: 0,
                    writeOffAmount: 0,
                    recoveredPrincipalCop: 0,
                },
                marketplace: {
                    publishedOffers: 0,
                    assignedOffers: 0,
                    inTransitOffers: 0,
                    deliveredOffers: 0,
                    threePlOffers: 0,
                    fillRate: 0,
                    clientAccounts: 0,
                    activeClientAccounts: 0,
                    receiptsProcessed: 0,
                    dispatchesProcessed: 0,
                    dispatchReadyRate: 0,
                    multiClientBusinesses: 0,
                },
                paymentsReadiness: {
                    ready: false,
                    productionLikeUrl: false,
                    checkoutReady: false,
                    freightWebhookReady: false,
                    billingWebhookReady: false,
                    notificationsReady: false,
                    missingKeys: [],
                    warnings: [],
                },
                alerts: [],
                recommendedPlanCode: 'enterprise',
                approvals: {
                    pending: 0,
                    critical: 0,
                    breached: 0,
                    doubleBreached: 0,
                },
            });
        }

        const summary = await getHoldingSummary(
            supabaseAdmin,
            access.holdingAccountId,
            access.role,
            access.accounts
        );

        return NextResponse.json(summary);
    } catch (error) {
        console.error('[HoldingSummary][GET]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
