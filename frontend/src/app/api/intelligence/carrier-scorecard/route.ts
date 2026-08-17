import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { resolveBusinessRolePolicy } from '@/lib/server/role-policy';
import {
    computeSlaCompliance,
    type SlaComplianceInput,
    type SlaComplianceResult,
} from '@/algorithms/intelligence/slaCompliance';
import {
    buildCarrierScorecards,
    type CarrierTripData,
    type CarrierScorecardResult,
} from '@/algorithms/intelligence/carrierScorecard';
import {
    carrierScorecardParamsSchema,
    loadIntelligenceData,
    assertCanViewAlgorithms,
    type Row,
} from '@/app/api/intelligence/_shared';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);

    // 1. Authentication Check
    const auth = await requireAuthenticatedRoute(request);
    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;

    // 2. Validate Query Parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parseResult = carrierScorecardParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
        return apiError('Parámetros de consulta inválidos.', {
            status: 400,
            code: 'INVALID_PARAMS',
            requestId,
            details: parseResult.error.flatten().fieldErrors,
        });
    }

    const { businessId: requestedBusinessId, month, truckerId: targetTruckerId, limit } = parseResult.data;

    // 3. Resolve Role & Access Policy
    const policy = await resolveBusinessRolePolicy(supabaseAdmin, authUser.id, profile, {
        requestedBusinessId,
    });

    if (policy.scopeError) {
        return apiError(policy.scopeError.error, {
            status: policy.scopeError.status,
            code: 'INTELLIGENCE_SCOPE_DENIED',
            requestId,
        });
    }

    if (!policy.businessId || !assertCanViewAlgorithms(policy)) {
        return apiError('No tienes permisos para consultar scorecards de transportadores para esta empresa.', {
            status: 403,
            code: 'INTELLIGENCE_FORBIDDEN',
            requestId,
        });
    }

    try {
        // 4. Load Data
        const rawData = await loadIntelligenceData(supabaseAdmin, {
            businessId: policy.businessId,
            month: month || null,
            limit: limit || 100,
        });

        // 5. Build Profile Lookup Map
        const profilesById = new Map<string, Row>();
        for (const p of rawData.truckerProfiles) {
            const id = String(p.id || '');
            if (id) profilesById.set(id, p);
        }

        // 6. Compute SLA for all trips
        const slaByOffer = new Map<string, SlaComplianceResult>();
        for (const off of rawData.offers) {
            const offerId = String(off.id || '');
            const slaInput: SlaComplianceInput = {
                offerId,
                status: (off.status as string) || null,
                pickupDate: (off.pickup_date as string) || null,
                pickupTimeEnd: (off.pickup_time_end as string) || null,
                deliveryDate: (off.delivery_date as string) || null,
                deliveryTimeEnd: (off.delivery_time_end as string) || null,
                arrivedAtOriginAt: (off.arrived_at_origin_at as string) || null,
                loadingStartedAt: (off.loading_started_at as string) || null,
                loadingCompletedAt: (off.loading_completed_at as string) || null,
                pickupVerifiedAt: (off.pickup_verified_at as string) || null,
                arrivedAtDestinationAt: (off.arrived_at_destination_at as string) || null,
                unloadingStartedAt: (off.unloading_started_at as string) || null,
                unloadingCompletedAt: (off.unloading_completed_at as string) || null,
                deliveryVerifiedAt: (off.delivery_verified_at as string) || null,
            };
            slaByOffer.set(offerId, computeSlaCompliance(slaInput));
        }

        // 7. Aggregate Trips per Carrier
        const carrierTrips: CarrierTripData[] = [];
        for (const off of rawData.offers) {
            const truckerId = String(off.assigned_trucker_id || off.private_fleet_trucker_id || '');
            if (!truckerId) continue;

            // If a specific truckerId is requested, filter here
            if (targetTruckerId && truckerId !== targetTruckerId) continue;

            const offerId = String(off.id || '');
            const sla = slaByOffer.get(offerId);
            const truckerProfile = profilesById.get(truckerId);

            carrierTrips.push({
                offerId,
                truckerId,
                truckerName: truckerProfile ? String(truckerProfile.full_name || '') : null,
                status: (off.status as string) || null,
                slaBreached: sla ? sla.deliverySlaStatus === 'breached' : false,
                deliveryDelayMinutes: sla ? sla.deliveryDelayMinutes : null,
                totalAmount: Math.max(0, Number(off.total_amount) || 0),
                rejectedItemCount: Math.max(0, Number(off.manifest_rejected_count) || 0),
                totalItemCount: Math.max(0, Number(off.manifest_loaded_count) || 0) + Math.max(0, Number(off.manifest_rejected_count) || 0),
                hasDeliverySignature: Boolean(off.delivery_verified_at),
                hasDeliveryPhoto: Array.isArray(off.trip_photos) && (off.trip_photos as unknown[]).length > 0,
                hasDeliveryPin: Boolean(off.delivery_verified_at),
                openIncidents: 0,
                isPrivateFleet: Boolean(off.is_private_fleet),
            });
        }

        const scorecards = buildCarrierScorecards(carrierTrips);

        // If targetTruckerId requested and found, return detailed view with trip list
        if (targetTruckerId) {
            const singleScorecard = scorecards.find((s) => s.truckerId === targetTruckerId) || null;
            const truckerSpecificTrips = rawData.offers
                .filter((off) => String(off.assigned_trucker_id || off.private_fleet_trucker_id || '') === targetTruckerId)
                .map((off) => {
                    const id = String(off.id || '');
                    const sla = slaByOffer.get(id);
                    return {
                        offerId: id,
                        status: off.status,
                        originCity: off.origin_city,
                        destinationCity: off.destination_city,
                        pickupDate: off.pickup_date,
                        deliveryDate: off.delivery_date,
                        totalAmount: off.total_amount,
                        slaStatus: sla?.deliverySlaStatus || 'not_applicable',
                        slaScore: sla?.complianceScore || 100,
                        delayMinutes: sla?.deliveryDelayMinutes || 0,
                    };
                });

            return apiSuccess({
                generatedAt: new Date().toISOString(),
                businessId: policy.businessId,
                scorecard: singleScorecard,
                trips: truckerSpecificTrips,
            }, {
                code: 'CARRIER_SCORECARD_DETAIL_READY',
                requestId,
            });
        }

        return apiSuccess({
            generatedAt: new Date().toISOString(),
            businessId: policy.businessId,
            totalCarriers: scorecards.length,
            scorecards,
        }, {
            code: 'CARRIER_SCORECARDS_READY',
            requestId,
        });
    } catch (error) {
        return apiError(
            error instanceof Error ? error.message : 'Error inesperado al calcular scorecards de transportadores.',
            {
                status: 500,
                code: 'CARRIER_SCORECARD_FAILED',
                requestId,
            }
        );
    }
}
