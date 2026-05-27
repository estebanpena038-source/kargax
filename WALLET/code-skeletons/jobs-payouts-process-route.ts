import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
// import { processQueuedPayouts } from '@/lib/server/payouts/processor';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const internalKey = request.headers.get('x-internal-api-key');

  if (!process.env.INTERNAL_API_KEY || internalKey !== process.env.INTERNAL_API_KEY) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED_PAYOUT_JOB', requestId });
  }

  if (process.env.PAYOUTS_ENABLED !== 'true') {
    return apiSuccess({ processed: 0, disabled: true }, { code: 'PAYOUTS_DISABLED', requestId });
  }

  // const result = await processQueuedPayouts({ limit: Number(process.env.PAYOUT_BATCH_SIZE || 10) });
  const result = { processed: 0, TODO: 'wire processQueuedPayouts after implementing provider' };

  return apiSuccess(result, { code: 'PAYOUT_JOB_PROCESSED', requestId });
}
