import { NextRequest, NextResponse } from 'next/server';
import { getRequestId } from '@/lib/server/api-response';
import { getSupabaseAdmin } from '@/lib/server/route-auth';
import { getReliabilitySnapshot } from '@/lib/server/operations';
import { isLocalAppUrl, isStrictProductionEnvironment, getConfiguredAppUrl } from '@/lib/server/runtime-env';

const REQUIRED_STORAGE_BUCKETS = ['offer-photos', 'trip-photos', 'trip-signatures', 'warehouse-sku-images'];

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const supabaseAdmin = getSupabaseAdmin();
    const startedAt = Date.now();

    try {
        const { error } = await supabaseAdmin
            .from('user_profiles')
            .select('id', { count: 'exact', head: true });

        const appUrl = getConfiguredAppUrl();
        const appUrlLocalInStrictProduction = isStrictProductionEnvironment() && isLocalAppUrl(appUrl);
        const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
        const bucketIds = new Set((buckets || []).map((bucket: { id?: string | null }) => bucket.id).filter(Boolean));
        const missingBuckets = REQUIRED_STORAGE_BUCKETS.filter((bucketId) => !bucketIds.has(bucketId));

        const snapshot = await getReliabilitySnapshot(supabaseAdmin);
        const releaseGateRequired = snapshot.flags.some((flag) => flag.key === 'release_gate_required' && flag.enabled);
        const sentryConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);
        const upstashConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
        const paymentWebhookConfigured = Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET);
        const degradedFlags = snapshot.flags.filter((flag) =>
            flag.enabled && ['degraded_mode_wallet', 'degraded_mode_warehouse'].includes(flag.key)
        );
        const healthy = !error && !bucketsError && missingBuckets.length === 0 && !appUrlLocalInStrictProduction;
        const status = healthy && degradedFlags.length === 0 ? 'healthy' : healthy ? 'degraded' : 'unhealthy';
        const responseStatus = healthy ? 200 : 503;

        return NextResponse.json({
            success: healthy,
            code: healthy ? 'HEALTHY' : 'UNHEALTHY',
            data: {
                status,
                requestId,
                latency_ms: Date.now() - startedAt,
                environment: {
                    app_url: appUrl,
                    strict_production: isStrictProductionEnvironment(),
                    local_app_url_in_strict_production: appUrlLocalInStrictProduction,
                },
                storage: {
                    required_buckets: REQUIRED_STORAGE_BUCKETS,
                    missing_buckets: missingBuckets,
                    error: bucketsError?.message || null,
                },
                infra: {
                    release_gate_required: releaseGateRequired,
                    sentry_configured: sentryConfigured,
                    upstash_configured: upstashConfigured,
                    mercadopago_webhook_secret_configured: paymentWebhookConfigured,
                    payout_automatic_enabled: snapshot.flags.some((flag) => flag.key === 'automatic_payouts_enabled' && flag.enabled),
                },
                degraded_flags: degradedFlags.map((flag) => flag.key),
                integrations: snapshot.integrations,
                countries: snapshot.countries,
                runbooks: snapshot.backups,
                launch_readiness: snapshot.launch_readiness,
                smoke_status: snapshot.smoke_status,
                risk_summary: snapshot.risk_summary,
                scorecard_snapshot: snapshot.scorecard_snapshot,
            },
            error: healthy ? null : {
                message: error?.message
                    || bucketsError?.message
                    || (missingBuckets.length ? `Missing storage buckets: ${missingBuckets.join(', ')}` : null)
                    || (appUrlLocalInStrictProduction ? 'Public app URL cannot be localhost in production' : null)
                    || 'Health probe failed',
            },
            meta: {
                requestId,
                timestamp: new Date().toISOString(),
            },
        }, { status: responseStatus });
    } catch (error) {
        return NextResponse.json({
            success: false,
            code: 'HEALTHCHECK_FAILED',
            data: null,
            error: {
                message: error instanceof Error ? error.message : 'Unknown healthcheck failure',
            },
            meta: {
                requestId,
                timestamp: new Date().toISOString(),
            },
        }, { status: 503 });
    }
}
