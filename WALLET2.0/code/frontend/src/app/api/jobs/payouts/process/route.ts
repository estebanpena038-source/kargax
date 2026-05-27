import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { processQueuedPayouts } from '@/lib/server/payouts/processor';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role no configurado para payout job');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const internalKey = request.headers.get('x-internal-api-key');

  if (!process.env.INTERNAL_API_KEY || internalKey !== process.env.INTERNAL_API_KEY) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED_PAYOUT_JOB', requestId });
  }

  if (process.env.PAYOUTS_ENABLED !== 'true') {
    return apiSuccess({ processed: 0, disabled: true }, { code: 'PAYOUTS_DISABLED', requestId });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const result = await processQueuedPayouts(supabaseAdmin, {
      limit: Number(process.env.PAYOUT_BATCH_SIZE || 10),
      dryRun: process.env.PAYOUT_DRY_RUN !== 'false',
    });

    return apiSuccess(result, { code: 'PAYOUT_JOB_PROCESSED', requestId });
  } catch (error) {
    return apiError('Payout job failed', {
      status: 500,
      code: 'PAYOUT_JOB_FAILED',
      requestId,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
