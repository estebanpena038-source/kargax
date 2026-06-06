import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getInternalApiKeyFromRequest, getSupabaseAdmin, safelyCompareSecrets } from '@/lib/server/route-auth';
import { isStrictProductionEnvironment } from '@/lib/server/runtime-env';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const cronSecret = process.env.CRON_SECRET?.trim();
    const internalApiKey = process.env.INTERNAL_API_KEY?.trim();
    const providedCronSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
        || request.nextUrl.searchParams.get('secret');
    const hasConfiguredSecret = Boolean(cronSecret || internalApiKey);
    const hasValidCronSecret = safelyCompareSecrets(providedCronSecret, cronSecret);
    const hasValidInternalKey = safelyCompareSecrets(getInternalApiKeyFromRequest(request), internalApiKey);

    if (!hasConfiguredSecret && isStrictProductionEnvironment()) {
        return apiError('Cron secret no configurado', {
            status: 500,
            code: 'CRON_SECRET_MISSING',
            requestId,
        });
    }

    if (hasConfiguredSecret && !hasValidCronSecret && !hasValidInternalKey) {
        return apiError('Cron no autorizado', {
            status: 401,
            code: 'CRON_UNAUTHORIZED',
            requestId,
        });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, full_name, user_type, updated_at, metadata')
        .lt('updated_at', since)
        .limit(100);

    if (error) {
        return apiError(error.message, {
            status: 500,
            code: 'INACTIVE_USERS_QUERY_FAILED',
            requestId,
        });
    }

    const candidates = (data || []).filter((profile) => {
        const metadata = profile.metadata && typeof profile.metadata === 'object' && !Array.isArray(profile.metadata)
            ? profile.metadata as Record<string, unknown>
            : {};
        const lastEmailAt = typeof metadata.inactive_email_last_sent_at === 'string'
            ? metadata.inactive_email_last_sent_at
            : null;
        return !lastEmailAt || lastEmailAt < oneWeekAgo;
    });

    return apiSuccess({
        dryRun: true,
        candidates: candidates.map((profile) => ({
            id: profile.id,
            email: profile.email,
            userType: profile.user_type,
            updatedAt: profile.updated_at,
        })),
        nextStep: 'Conectar proveedor transaccional y actualizar metadata.inactive_email_last_sent_at al enviar.',
    }, {
        requestId,
        code: 'INACTIVE_USERS_READY',
    });
}
