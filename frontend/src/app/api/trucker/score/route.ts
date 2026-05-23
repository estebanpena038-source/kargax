import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

function resolveTier(completedTrips: number) {
    if (completedTrips >= 200) return 'diamond';
    if (completedTrips >= 51) return 'gold';
    if (completedTrips >= 11) return 'silver';
    return 'bronze';
}

function calculateScore(input: {
    completedTrips: number;
    onTimeDeliveries: number;
    incidentFreeDeliveries: number;
    cancellations: number;
    driverRejections: number;
}) {
    const completed = Math.max(input.completedTrips, 0);
    const onTimeRate = completed > 0 ? input.onTimeDeliveries / completed : 0;
    const incidentFreeRate = completed > 0 ? input.incidentFreeDeliveries / completed : 0;
    const cancellationPenalty = Math.min(input.cancellations * 3, 20);
    const rejectionPenalty = Math.min(input.driverRejections * 2, 15);
    const volumeScore = Math.min(completed, 100) * 0.25;

    return Math.max(0, Math.min(100,
        volumeScore
        + (onTimeRate * 35)
        + (incidentFreeRate * 35)
        + 5
        - cancellationPenalty
        - rejectionPenalty
    ));
}

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;
    const targetTruckerId = request.nextUrl.searchParams.get('truckerId') || authUser.id;

    if (profile?.user_type !== 'admin' && targetTruckerId !== authUser.id) {
        if (profile?.user_type !== 'business') {
            return apiError('No puedes consultar el score de otro transportador', {
                status: 403,
                code: 'TRUCKER_SCORE_FORBIDDEN',
                requestId,
            });
        }

        const [{ data: ownedApplication }, { data: ownedOffer }] = await Promise.all([
            supabaseAdmin
                .from('offer_applications')
                .select('id, cargo_offers!inner(id, business_id)')
                .eq('trucker_id', targetTruckerId)
                .eq('cargo_offers.business_id', authUser.id)
                .limit(1)
                .maybeSingle(),
            supabaseAdmin
                .from('cargo_offers')
                .select('id')
                .eq('business_id', authUser.id)
                .or(`assigned_trucker_id.eq.${targetTruckerId},private_fleet_trucker_id.eq.${targetTruckerId}`)
                .limit(1)
                .maybeSingle(),
        ]);

        if (!ownedApplication && !ownedOffer) {
            return apiError('No puedes consultar el score de este transportador', {
                status: 403,
                code: 'TRUCKER_SCORE_FORBIDDEN',
                requestId,
            });
        }
    }

    const [{ data: offers }, { data: existingScore }] = await Promise.all([
        supabaseAdmin
            .from('cargo_offers')
            .select('id, status, assigned_trucker_id, private_fleet_trucker_id, delivery_date, delivered_at, updated_at, metadata')
            .or(`assigned_trucker_id.eq.${targetTruckerId},private_fleet_trucker_id.eq.${targetTruckerId}`),
        supabaseAdmin
            .from('trucker_scores')
            .select('*')
            .eq('trucker_id', targetTruckerId)
            .maybeSingle(),
    ]);

    const rows = (offers || []) as Array<Record<string, unknown>>;
    const completedRows = rows.filter((row) => ['completed', 'delivered'].includes(String(row.status || '')));
    const cancelledRows = rows.filter((row) => String(row.status || '') === 'cancelled');
    const completedTrips = completedRows.length;
    const onTimeDeliveries = completedRows.filter((row) => {
        const deliveryDate = typeof row.delivery_date === 'string' ? new Date(row.delivery_date) : null;
        const deliveredAt = typeof row.delivered_at === 'string'
            ? new Date(row.delivered_at)
            : typeof row.updated_at === 'string'
                ? new Date(row.updated_at)
                : null;
        return deliveryDate && deliveredAt ? deliveredAt.getTime() <= deliveryDate.getTime() : false;
    }).length;
    const incidentFreeDeliveries = completedRows.filter((row) => {
        const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? row.metadata as Record<string, unknown>
            : {};
        return !metadata.incident_count || Number(metadata.incident_count || 0) === 0;
    }).length;
    const driverRejections = completedRows.filter((row) => {
        const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? row.metadata as Record<string, unknown>
            : {};
        return Number(metadata.driver_rejections || 0) > 0;
    }).length;
    const score = calculateScore({
        completedTrips,
        onTimeDeliveries,
        incidentFreeDeliveries,
        cancellations: cancelledRows.length,
        driverRejections,
    });
    const tier = resolveTier(completedTrips);

    const payload = {
        trucker_id: targetTruckerId,
        completed_trips: completedTrips,
        on_time_deliveries: onTimeDeliveries,
        incident_free_deliveries: incidentFreeDeliveries,
        cancellations: cancelledRows.length,
        driver_rejections: driverRejections,
        evidence_quality_score: Number(existingScore?.evidence_quality_score || 0),
        company_rating: existingScore?.company_rating || null,
        score: Number(score.toFixed(2)),
        tier,
        calculated_at: new Date().toISOString(),
        metadata: {
            source: 'cargo_offers_runtime',
            lending_metrics_used: false,
        },
    };

    await supabaseAdmin
        .from('trucker_scores')
        .upsert(payload, { onConflict: 'trucker_id' });

    return apiSuccess(payload, {
        requestId,
        code: 'TRUCKER_SCORE_READY',
    });
}
