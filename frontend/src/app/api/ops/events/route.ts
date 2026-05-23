import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { buildMarketContext } from '@/lib/platform/market-registry';
import { capturePosthogServerEvent, recordOperationEvent } from '@/lib/server/operations';
import { getFeatureFlags } from '@/lib/server/feature-flags';
import { getSupabaseAdmin } from '@/lib/server/route-auth';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const body = await request.json().catch(() => ({}));
    const event = typeof body?.event === 'string' ? body.event.trim() : '';
    const distinctId = typeof body?.distinctId === 'string' ? body.distinctId.trim() : requestId;
    const countryCode = typeof body?.countryCode === 'string' ? body.countryCode : 'CO';
    const properties = body?.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
        ? body.properties as Record<string, unknown>
        : {};

    if (!event) {
        return apiError('event is required', {
            requestId,
            status: 400,
            code: 'EVENT_REQUIRED',
        });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const flags = await getFeatureFlags(supabaseAdmin);
    const market = buildMarketContext({ countryCode, flags });

    await recordOperationEvent(supabaseAdmin, {
        requestId,
        actorType: 'anonymous',
        domain: 'market',
        action: event,
        entityType: 'marketing_event',
        entityId: distinctId,
        countryCode: market.current_country_code,
        status: 'success',
        metadata: properties,
    });

    await capturePosthogServerEvent({
        distinctId,
        event,
        properties: {
            ...properties,
            request_id: requestId,
            country_code: market.current_country_code,
            locale: market.current_locale,
        },
    });

    return apiSuccess({
        tracked: true,
        event,
    }, {
        requestId,
        code: 'EVENT_CAPTURED',
    });
}
