import { NextRequest, NextResponse } from 'next/server';
import { getRequestId } from '@/lib/server/api-response';
import { getSupabaseAdmin } from '@/lib/server/route-auth';
import { getReliabilitySnapshot } from '@/lib/server/operations';
import {
    getConfiguredAppUrl,
    isKargaxProductionHost,
    isKargaxStagingEnvironment,
    isLocalAppUrl,
    isStrictProductionEnvironment,
} from '@/lib/server/runtime-env';

const REQUIRED_STORAGE_BUCKETS = [
    'offer-photos',
    'trip-photos',
    'trip-signatures',
    'warehouse-sku-images',
    'private-fleet-payment-proofs',
];
const PUBLIC_HEALTH_REDACTIONS: Array<[RegExp, string]> = [
    [/MERCADOPAGO_WEBHOOK_SECRET/g, 'configuracion de firma del webhook de pagos'],
    [/SUPABASE_SERVICE_ROLE_KEY/g, 'credencial interna de base de datos'],
    [/INTERNAL_API_KEY/g, 'credencial interna de jobs'],
    [/NEXT_PUBLIC_SUPABASE_ANON_KEY/g, 'credencial publica de Supabase'],
];

function sanitizePublicHealthPayload(value: unknown): unknown {
    if (typeof value === 'string') {
        return PUBLIC_HEALTH_REDACTIONS.reduce(
            (current, [pattern, replacement]) => current.replace(pattern, replacement),
            value
        );
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizePublicHealthPayload(item));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, sanitizePublicHealthPayload(item)])
        );
    }

    return value;
}

function getSupabaseProjectRef(value?: string | null) {
    if (!value) return null;

    try {
        return new URL(value).hostname.split('.')[0] || null;
    } catch {
        return null;
    }
}

function getDbTargetSnapshot(appUrl: string) {
    const supabaseProjectRef = getSupabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const productionProjectRef = process.env.KARGAX_PROD_SUPABASE_PROJECT_REF?.trim() || null;
    const stagingProjectRef = process.env.KARGAX_STAGING_SUPABASE_PROJECT_REF?.trim() || null;
    const stagingRuntime = isKargaxStagingEnvironment({ requestUrl: appUrl });
    const productionRuntime = isStrictProductionEnvironment() || isKargaxProductionHost({ requestUrl: appUrl });
    const expectedProjectRef = productionRuntime
        ? productionProjectRef
        : stagingRuntime
            ? stagingProjectRef
            : null;
    const refsSeparated = productionProjectRef && stagingProjectRef
        ? productionProjectRef !== stagingProjectRef
        : true;
    const dbTargetValid = Boolean(
        supabaseProjectRef
        && refsSeparated
        && (!expectedProjectRef || supabaseProjectRef === expectedProjectRef)
        && (!(productionRuntime || stagingRuntime) || expectedProjectRef)
    );

    return {
        supabase_project_ref: supabaseProjectRef,
        db_target_valid: dbTargetValid,
        expected_db_target_configured: Boolean(expectedProjectRef),
        refs_separated: refsSeparated,
        runtime: productionRuntime ? 'production' : stagingRuntime ? 'staging' : 'development',
    };
}

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
        const dbTarget = getDbTargetSnapshot(appUrl);
        const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
        const bucketIds = new Set((buckets || []).map((bucket: { id?: string | null }) => bucket.id).filter(Boolean));
        const missingBuckets = REQUIRED_STORAGE_BUCKETS.filter((bucketId) => !bucketIds.has(bucketId));

        const snapshot = await getReliabilitySnapshot(supabaseAdmin);
        const releaseGateRequired = snapshot.flags.some((flag) => flag.key === 'release_gate_required' && flag.enabled);
        const sentryConfigured = Boolean(
            process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
            || process.env.SENTRY_DSN?.trim()
        );
        const upstashConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
        const paymentWebhookConfigured = Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET);
        const degradedFlags = snapshot.flags.filter((flag) =>
            flag.enabled && ['degraded_mode_wallet', 'degraded_mode_warehouse'].includes(flag.key)
        );
        const healthy = !error
            && !bucketsError
            && missingBuckets.length === 0
            && !appUrlLocalInStrictProduction
            && dbTarget.db_target_valid;
        const status = healthy && degradedFlags.length === 0 ? 'healthy' : healthy ? 'degraded' : 'unhealthy';
        const responseStatus = healthy ? 200 : 503;

        const healthData = sanitizePublicHealthPayload({
            status,
            requestId,
            latency_ms: Date.now() - startedAt,
            environment: {
                app_url: appUrl,
                strict_production: isStrictProductionEnvironment(),
                local_app_url_in_strict_production: appUrlLocalInStrictProduction,
                ...dbTarget,
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
                payment_webhook_signature_configured: paymentWebhookConfigured,
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
        });

        return NextResponse.json({
            success: healthy,
            code: healthy ? 'HEALTHY' : 'UNHEALTHY',
            data: healthData,
            error: healthy ? null : {
                message: error?.message
                    || bucketsError?.message
                    || (missingBuckets.length ? `Missing storage buckets: ${missingBuckets.join(', ')}` : null)
                    || (appUrlLocalInStrictProduction ? 'Public app URL cannot be localhost in production' : null)
                    || (!dbTarget.db_target_valid ? 'Supabase project ref does not match the configured runtime target' : null)
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
