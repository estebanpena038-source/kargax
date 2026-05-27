import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { reconcileProviderPayoutEvent } from '@/lib/server/payouts/reconcile';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase service role no configurado para webhook de payouts');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

function timingSafeEqualHex(left: string, right: string) {
    try {
        const leftBuffer = Buffer.from(left, 'hex');
        const rightBuffer = Buffer.from(right, 'hex');
        return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
    } catch {
        return false;
    }
}

function validatePayoutWebhookSignature(request: NextRequest, rawBody: string) {
    const secret = process.env.PAYOUT_WEBHOOK_SECRET;
    if (!secret) {
        return false;
    }

    const signature =
        request.headers.get('x-payout-signature')
        || request.headers.get('x-cobre-signature')
        || request.headers.get('x-signature')
        || '';
    const normalizedSignature = signature.includes('=')
        ? signature.split('=').pop()?.trim() || ''
        : signature.trim();
    const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    return timingSafeEqualHex(expected, normalizedSignature);
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const rawBody = await request.text();

    if (!validatePayoutWebhookSignature(request, rawBody)) {
        return apiSuccess({
            received: true,
            processed: false,
            ignored: true,
            reason: 'invalid_signature',
        }, {
            requestId,
            code: 'PAYOUT_WEBHOOK_IGNORED_INVALID_SIGNATURE',
        });
    }

    let payload: Record<string, unknown>;
    try {
        payload = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
    } catch {
        return apiError('Payload invalido', {
            requestId,
            status: 400,
            code: 'PAYOUT_WEBHOOK_INVALID_JSON',
        });
    }

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const result = await reconcileProviderPayoutEvent(supabaseAdmin, payload);

        return apiSuccess({
            received: true,
            ...result,
        }, {
            requestId,
            code: result.processed ? 'PAYOUT_WEBHOOK_PROCESSED' : 'PAYOUT_WEBHOOK_IGNORED',
        });
    } catch (error) {
        return apiError('No se pudo procesar webhook de payout', {
            requestId,
            status: 500,
            code: 'PAYOUT_WEBHOOK_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
