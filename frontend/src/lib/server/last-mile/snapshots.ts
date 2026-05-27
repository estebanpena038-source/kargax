import type { SupabaseClient } from '@supabase/supabase-js';
import {
    calculateActualCost,
    calculateContractedCost,
    calculateCostVariance,
    computeCompletionScore,
    computeEvidenceScore,
    computeOnTimeScore,
    computeProviderScore,
} from './cost-engine';
import { ensureLastMileCarrier, ensureLastMileLane, selectBestContractForOffer } from './contracts';
import { LastMileError } from './errors';
import { generateLastMileAlerts } from './alerts';
import { generateLastMileScorecards } from './scorecards';
import type { LastMileRecomputePayload } from './schemas';
import type { LastMileRecomputeResult } from '@/lib/last-mile/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

type OfferRow = Record<string, unknown> & {
    id: string;
    business_id: string;
    status: string | null;
    assigned_trucker_id: string | null;
    private_fleet_trucker_id: string | null;
    is_private_fleet: boolean | null;
    currency_code: string | null;
    origin_department: string | null;
    origin_city: string | null;
    destination_department: string | null;
    destination_city: string | null;
    vehicle_type: string | null;
    cargo_type: string | null;
    created_at: string;
    updated_at: string | null;
};

function dateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
}

function safeNumber(value: unknown) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function mapExecutionStatus(status: string | null | undefined) {
    if (['completed', 'delivered'].includes(String(status || ''))) return 'completed';
    if (['cancelled', 'expired'].includes(String(status || ''))) return 'cancelled';
    if (['in_progress'].includes(String(status || ''))) return 'in_progress';
    if (['assigned', 'reserved'].includes(String(status || ''))) return 'assigned';
    if (['disputed', 'rejected'].includes(String(status || ''))) return 'disputed';
    return 'planned';
}

async function loadOffers(
    supabaseAdmin: AdminClient,
    businessId: string,
    range: { start: Date; end: Date },
    options: { offerId?: string; limit?: number } = {}
) {
    let query = supabaseAdmin
        .from('cargo_offers')
        .select(`
            id,
            business_id,
            status,
            cargo_type,
            weight_kg,
            origin_department,
            origin_city,
            destination_department,
            destination_city,
            pickup_date,
            delivery_date,
            total_amount,
            platform_fee,
            net_amount,
            vehicle_type,
            created_at,
            updated_at,
            pickup_verified_at,
            delivery_verified_at,
            loading_completed_at,
            unloading_completed_at,
            manifest_loaded_count,
            manifest_delivered_count,
            manifest_rejected_count,
            trip_photos,
            origin_warehouse_id,
            destination_warehouse_id,
            is_private_fleet,
            private_fleet_trucker_id,
            assigned_trucker_id,
            expense_allowance_amount,
            freight_payment_amount,
            currency_code
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

    if (options.offerId) {
        query = query.eq('id', options.offerId);
    } else {
        query = query.gte('created_at', range.start.toISOString()).lte('created_at', range.end.toISOString());
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
        throw new LastMileError(error.message || 'No se pudieron cargar viajes para recomputar margen', {
            status: 500,
            code: 'LAST_MILE_OFFER_LOAD_FAILED',
        });
    }

    return (data || []) as OfferRow[];
}

async function loadEvidenceMaps(supabaseAdmin: AdminClient, offerIds: string[]) {
    if (!offerIds.length) {
        return {
            picking: new Map<string, number>(),
            pickingPhotos: new Map<string, number>(),
            signatures: new Map<string, number>(),
            incidents: new Map<string, Array<Record<string, unknown>>>(),
        };
    }

    const [pickingResponse, signaturesResponse, incidentsResponse] = await Promise.all([
        supabaseAdmin.from('picking_events').select('offer_id, photo_urls').in('offer_id', offerIds),
        supabaseAdmin.from('trip_signature_evidences').select('offer_id, signature_stage').in('offer_id', offerIds),
        supabaseAdmin.from('warehouse_incidents').select('id, offer_id, severity, status, incident_type, title, created_at').in('offer_id', offerIds),
    ]);

    if (pickingResponse.error) throw new LastMileError(pickingResponse.error.message, { status: 500, code: 'LAST_MILE_PICKING_LOAD_FAILED' });
    if (signaturesResponse.error) throw new LastMileError(signaturesResponse.error.message, { status: 500, code: 'LAST_MILE_SIGNATURE_LOAD_FAILED' });
    if (incidentsResponse.error) throw new LastMileError(incidentsResponse.error.message, { status: 500, code: 'LAST_MILE_INCIDENT_LOAD_FAILED' });

    const picking = new Map<string, number>();
    const pickingPhotos = new Map<string, number>();
    for (const event of pickingResponse.data || []) {
        const offerId = String(event.offer_id || '');
        picking.set(offerId, (picking.get(offerId) || 0) + 1);
        pickingPhotos.set(offerId, (pickingPhotos.get(offerId) || 0) + (Array.isArray(event.photo_urls) ? event.photo_urls.length : 0));
    }

    const signatures = new Map<string, number>();
    for (const signature of signaturesResponse.data || []) {
        const offerId = String(signature.offer_id || '');
        signatures.set(offerId, (signatures.get(offerId) || 0) + 1);
    }

    const incidents = new Map<string, Array<Record<string, unknown>>>();
    for (const incident of incidentsResponse.data || []) {
        const offerId = String(incident.offer_id || '');
        const bucket = incidents.get(offerId) || [];
        bucket.push(incident as Record<string, unknown>);
        incidents.set(offerId, bucket);
    }

    return { picking, pickingPhotos, signatures, incidents };
}

async function resolveCarrierForOffer(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string | null,
    offer: OfferRow
) {
    const truckerId = offer.is_private_fleet
        ? offer.private_fleet_trucker_id || offer.assigned_trucker_id
        : offer.assigned_trucker_id;

    const [fleetMemberResponse, profileResponse] = truckerId
        ? await Promise.all([
            supabaseAdmin
                .from('business_fleet_members')
                .select('id, internal_driver_id, vehicle_plate')
                .eq('business_id', businessId)
                .eq('trucker_id', truckerId)
                .maybeSingle(),
            supabaseAdmin
                .from('user_profiles')
                .select('id, full_name, phone, email')
                .eq('id', truckerId)
                .maybeSingle(),
        ])
        : [{ data: null }, { data: null }];

    const profile = profileResponse.data as { full_name?: string | null; phone?: string | null; email?: string | null } | null;
    const fleetMember = fleetMemberResponse.data as { id?: string; vehicle_plate?: string | null; internal_driver_id?: string | null } | null;
    const carrierType = offer.is_private_fleet ? 'private_fleet' : truckerId ? 'marketplace' : 'external_provider';

    return ensureLastMileCarrier(supabaseAdmin, businessId, actorId || businessId, {
        carrierType,
        profileUserId: truckerId || null,
        fleetMemberId: fleetMember?.id || null,
        providerKey: truckerId ? `${carrierType}:${truckerId}` : 'external_provider:sin-proveedor',
        providerName: profile?.full_name || (truckerId ? `Transportador ${truckerId.slice(0, 8)}` : 'Sin proveedor asignado'),
        contactPhone: profile?.phone || null,
        contactEmail: profile?.email || null,
        pricingModel: 'per_trip',
        baseRateCop: 0,
        startsAt: dateOnly(new Date()),
    });
}

async function resolveLaneForOffer(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string | null,
    offer: OfferRow
) {
    return ensureLastMileLane(supabaseAdmin, businessId, actorId || businessId, {
        carrierType: 'external_provider',
        providerName: 'placeholder',
        originDepartment: offer.origin_department,
        originCity: offer.origin_city,
        originWarehouseId: String(offer.origin_warehouse_id || '') || null,
        destinationDepartment: offer.destination_department,
        destinationCity: offer.destination_city,
        destinationWarehouseId: String(offer.destination_warehouse_id || '') || null,
        vehicleType: offer.vehicle_type,
        cargoType: offer.cargo_type,
        serviceLevel: 'standard',
        pricingModel: 'per_trip',
        baseRateCop: 0,
        startsAt: dateOnly(new Date()),
    });
}

export async function recomputeLastMileSnapshots(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string | null,
    payload: LastMileRecomputePayload,
    range: { start: Date; end: Date }
): Promise<LastMileRecomputeResult> {
    const runInsert = await supabaseAdmin
        .from('last_mile_analysis_runs')
        .insert({
            business_id: businessId,
            run_type: payload.offerId ? 'offer_completed' : 'manual',
            status: 'running',
            period_start: dateOnly(range.start),
            period_end: dateOnly(range.end),
            offer_id: payload.offerId || null,
            started_by: actorId,
            started_at: new Date().toISOString(),
            metadata: {
                dryRun: payload.dryRun,
                source: 'api',
            },
        })
        .select('id')
        .single();

    const runId = runInsert.data?.id || crypto.randomUUID();

    try {
        const offers = await loadOffers(supabaseAdmin, businessId, range, {
            offerId: payload.offerId,
            limit: payload.limit,
        });
        const offerIds = offers.map((offer) => offer.id);
        const evidence = await loadEvidenceMaps(supabaseAdmin, offerIds);
        const { data: existingObservations } = offerIds.length
            ? await supabaseAdmin
                .from('last_mile_trip_cost_observations')
                .select('offer_id')
                .eq('business_id', businessId)
                .in('offer_id', offerIds)
            : { data: [] };
        const existingOfferIds = new Set(((existingObservations || []) as Array<{ offer_id: string }>).map((row) => row.offer_id));
        const observationPayloads: Array<Record<string, unknown> & { offer_id: string }> = [];

        for (const offer of offers) {
            const carrier = await resolveCarrierForOffer(supabaseAdmin, businessId, actorId, offer);
            const lane = await resolveLaneForOffer(supabaseAdmin, businessId, actorId, offer);
            const observedAt = offer.updated_at || offer.created_at || new Date().toISOString();
            const contract = await selectBestContractForOffer(
                supabaseAdmin,
                businessId,
                carrier?.id || null,
                lane?.id || null,
                String(observedAt).slice(0, 10)
            );
            const actual = calculateActualCost(offer);
            const expectedCostCop = calculateContractedCost(contract, offer);
            const agreedCostCop = contract ? expectedCostCop : safeNumber(offer.total_amount);
            const variance = calculateCostVariance(expectedCostCop, actual.finalCostCop);
            const incidentRows = evidence.incidents.get(offer.id) || [];
            const tripPhotos = Array.isArray(offer.trip_photos) ? offer.trip_photos.length : 0;
            const evidenceScore = computeEvidenceScore({
                offer,
                pickingEventsCount: evidence.picking.get(offer.id) || 0,
                signatureCount: evidence.signatures.get(offer.id) || 0,
                incidentCount: incidentRows.length,
                photoCount: tripPhotos + (evidence.pickingPhotos.get(offer.id) || 0),
            });
            const onTimeScore = computeOnTimeScore(offer);
            const completionScore = computeCompletionScore(offer);
            const providerScore = computeProviderScore({
                evidenceScore,
                onTimeScore,
                completionScore,
                overrunPct: variance.overrunPct,
                incidentCount: incidentRows.length,
            });

            observationPayloads.push({
                business_id: businessId,
                offer_id: offer.id,
                carrier_id: carrier?.id || null,
                lane_id: lane?.id || null,
                contract_id: contract?.id || null,
                source_kind: 'sync',
                execution_status: mapExecutionStatus(offer.status),
                currency_code: offer.currency_code || 'COP',
                agreed_cost_cop: Math.max(0, Math.round(agreedCostCop)),
                expected_cost_cop: Math.max(0, Math.round(expectedCostCop)),
                final_cost_cop: Math.max(0, Math.round(actual.finalCostCop)),
                platform_fee_cop: Math.max(0, Math.round(actual.platformFeeCop)),
                payout_cost_cop: Math.max(0, Math.round(actual.payoutCostCop)),
                private_expense_cost_cop: Math.max(0, Math.round(actual.privateExpenseCostCop)),
                incident_cost_cop: 0,
                overrun_cop: Math.round(variance.overrunCop),
                overrun_pct: Number(variance.overrunPct.toFixed(4)),
                evidence_score: Number(evidenceScore.toFixed(2)),
                on_time_score: Number(onTimeScore.toFixed(2)),
                completion_score: Number(completionScore.toFixed(2)),
                provider_score: Number(providerScore.toFixed(2)),
                contract_snapshot: contract || {},
                pricing_snapshot: {
                    noContractApplied: !contract,
                    isPrivateFleet: Boolean(offer.is_private_fleet),
                    totalAmount: safeNumber(offer.total_amount),
                    netAmount: safeNumber(offer.net_amount),
                    platformFee: safeNumber(offer.platform_fee),
                },
                evidence_snapshot: {
                    pickingEvents: evidence.picking.get(offer.id) || 0,
                    signatures: evidence.signatures.get(offer.id) || 0,
                    photos: tripPhotos + (evidence.pickingPhotos.get(offer.id) || 0),
                },
                incident_snapshot: {
                    count: incidentRows.length,
                    incidents: incidentRows.slice(0, 5),
                },
                observed_at: observedAt,
            });
        }

        if (!payload.dryRun && observationPayloads.length) {
            const { error } = await supabaseAdmin
                .from('last_mile_trip_cost_observations')
                .upsert(observationPayloads, {
                    onConflict: 'business_id,offer_id',
                });

            if (error) {
                throw new LastMileError(error.message || 'No se pudieron guardar snapshots de margen', {
                    status: 500,
                    code: 'LAST_MILE_OBSERVATION_SAVE_FAILED',
                });
            }

            await generateLastMileScorecards(supabaseAdmin, businessId, range);
        }

        const alertResult = !payload.dryRun
            ? await generateLastMileAlerts(supabaseAdmin, businessId, range, actorId)
            : { createdRecommendations: 0 };

        const createdObservations = observationPayloads.filter((row) => !existingOfferIds.has(row.offer_id)).length;
        const updatedObservations = observationPayloads.length - createdObservations;

        await supabaseAdmin
            .from('last_mile_analysis_runs')
            .update({
                status: 'succeeded',
                finished_at: new Date().toISOString(),
                processed_offers: offers.length,
                created_observations: payload.dryRun ? 0 : createdObservations,
                updated_observations: payload.dryRun ? 0 : updatedObservations,
                created_recommendations: alertResult.createdRecommendations,
            })
            .eq('id', runId);

        return {
            runId,
            dryRun: Boolean(payload.dryRun),
            processedOffers: offers.length,
            createdObservations: payload.dryRun ? 0 : createdObservations,
            updatedObservations: payload.dryRun ? 0 : updatedObservations,
            createdRecommendations: alertResult.createdRecommendations,
        };
    } catch (error) {
        await supabaseAdmin
            .from('last_mile_analysis_runs')
            .update({
                status: 'failed',
                finished_at: new Date().toISOString(),
                error_message: error instanceof Error ? error.message : 'Last-mile recompute failed',
            })
            .eq('id', runId);
        throw error;
    }
}

export async function recomputeLastMileJob(
    supabaseAdmin: AdminClient,
    payload: LastMileRecomputePayload,
    range: { start: Date; end: Date }
) {
    const businessIds = payload.businessId
        ? [payload.businessId]
        : await (async () => {
            const { data, error } = await supabaseAdmin
                .from('business_plan_subscriptions')
                .select('business_id, plan:billing_plans(feature_matrix)')
                .in('status', ['active', 'trialing']);

            if (error) {
                throw new LastMileError(error.message || 'No se pudieron cargar empresas para job Last-Mile', {
                    status: 500,
                    code: 'LAST_MILE_JOB_BUSINESSES_FAILED',
                });
            }

            return (data || [])
                .filter((row) => {
                    const plan = row.plan as { feature_matrix?: Record<string, unknown> } | null;
                    return Boolean(plan?.feature_matrix?.last_mile_margin_control);
                })
                .map((row) => row.business_id as string);
        })();

    const results: LastMileRecomputeResult[] = [];
    for (const businessId of businessIds) {
        results.push(await recomputeLastMileSnapshots(supabaseAdmin, businessId, null, payload, range));
    }

    return {
        runId: results[0]?.runId || crypto.randomUUID(),
        dryRun: Boolean(payload.dryRun),
        processedOffers: results.reduce((sum, result) => sum + result.processedOffers, 0),
        createdObservations: results.reduce((sum, result) => sum + result.createdObservations, 0),
        updatedObservations: results.reduce((sum, result) => sum + result.updatedObservations, 0),
        createdRecommendations: results.reduce((sum, result) => sum + result.createdRecommendations, 0),
        processedBusinessIds: businessIds,
    };
}
