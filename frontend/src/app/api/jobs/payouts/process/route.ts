import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { claimAndProcessPayouts } from '@/lib/server/payouts/processor';
import { getPayoutRuntimeConfig } from '@/lib/server/payouts/provider';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase service role no configurado para procesar payouts');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const internalKey = request.headers.get('x-internal-api-key');

    if (!process.env.INTERNAL_API_KEY || internalKey !== process.env.INTERNAL_API_KEY) {
        return apiError('No autorizado', {
            requestId,
            status: 401,
            code: 'PAYOUT_JOB_UNAUTHORIZED',
        });
    }

    const config = getPayoutRuntimeConfig();
    if (!config.enabled) {
        return apiSuccess({
            processed: 0,
            skipped: true,
            reason: config.disabledReason || 'payouts_disabled',
        }, {
            requestId,
            code: 'PAYOUT_JOB_SKIPPED',
        });
    }

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const result = await claimAndProcessPayouts(supabaseAdmin, config.batchSize);

        return apiSuccess({
            ...result,
            dryRun: config.dryRun,
            provider: config.provider,
            realProviderAllowed: config.realProviderAllowed,
        }, {
            requestId,
            code: 'PAYOUT_JOB_PROCESSED',
        });
    } catch (error) {
        return apiError('No se pudo procesar la cola de payouts', {
            requestId,
            status: 500,
            code: 'PAYOUT_JOB_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
