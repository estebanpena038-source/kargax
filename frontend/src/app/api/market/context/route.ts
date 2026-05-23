import { NextRequest } from 'next/server';
import { apiSuccess, getRequestId } from '@/lib/server/api-response';
import { buildMarketContext } from '@/lib/platform/market-registry';
import { getSupabaseAdmin } from '@/lib/server/route-auth';
import { getFeatureFlags } from '@/lib/server/feature-flags';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const countryCode = request.nextUrl.searchParams.get('countryCode');
    const locale = request.nextUrl.searchParams.get('locale');
    const supabaseAdmin = getSupabaseAdmin();
    const flags = await getFeatureFlags(supabaseAdmin);
    const context = buildMarketContext({
        countryCode,
        locale,
        flags,
    });

    return apiSuccess(context, {
        requestId,
        code: 'MARKET_CONTEXT_READY',
    });
}
