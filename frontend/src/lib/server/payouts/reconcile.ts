import type { SupabaseAdminClient } from './types';

function normalizeProviderState(state: unknown) {
    const normalized = String(state || '').toLowerCase();
    if (normalized === 'completed') return 'paid';
    if (['failed', 'rejected', 'returned', 'canceled', 'cancelled'].includes(normalized)) return 'failed';
    if (['initiated', 'processing', 'pending_approval'].includes(normalized)) return 'processing';
    return null;
}

export async function reconcileProviderPayoutEvent(
    supabaseAdmin: SupabaseAdminClient,
    payload: Record<string, unknown>
) {
    const content = payload.content && typeof payload.content === 'object' && !Array.isArray(payload.content)
        ? payload.content as Record<string, unknown>
        : payload;
    const providerTransferId = String(content.id || content.money_movement_id || content.provider_transfer_id || '').trim();
    const externalId = String(content.external_id || content.idempotency_key || '').trim();
    const statusObject = content.status && typeof content.status === 'object' && !Array.isArray(content.status)
        ? content.status as Record<string, unknown>
        : {};
    const providerState = normalizeProviderState(statusObject.state || content.state || content.status);

    if (!providerTransferId && !externalId) {
        return { processed: false, reason: 'missing_provider_reference' };
    }

    let query = supabaseAdmin
        .from('payout_attempts')
        .select('*')
        .limit(1);

    if (providerTransferId) {
        query = query.eq('provider_transfer_id', providerTransferId);
    } else {
        query = query.eq('idempotency_key', externalId);
    }

    const { data: attempts, error } = await query;
    if (error) {
        throw new Error(error.message || 'No se pudo cargar payout attempt');
    }

    const attempt = attempts?.[0] as { id: string } | undefined;
    if (!attempt?.id) {
        return { processed: false, reason: 'payout_attempt_not_found' };
    }

    if (providerState === 'paid') {
        await supabaseAdmin.rpc('mark_payout_paid', {
            p_payout_attempt_id: attempt.id,
            p_provider_transfer_id: providerTransferId || null,
            p_receipt_url: typeof content.receipt_url === 'string' ? content.receipt_url : null,
            p_provider_response: payload,
        });
        return { processed: true, status: 'paid', payoutAttemptId: attempt.id };
    }

    if (providerState === 'failed') {
        await supabaseAdmin.rpc('mark_payout_failed', {
            p_payout_attempt_id: attempt.id,
            p_failure_reason: String(statusObject.description || content.failure_reason || 'Provider payout failed'),
            p_provider_response: payload,
        });
        return { processed: true, status: 'failed', payoutAttemptId: attempt.id };
    }

    if (providerState === 'processing') {
        await supabaseAdmin
            .from('payout_attempts')
            .update({
                status: 'processing',
                provider_transfer_id: providerTransferId || null,
                provider_response: payload,
                updated_at: new Date().toISOString(),
            })
            .eq('id', attempt.id);
        return { processed: true, status: 'processing', payoutAttemptId: attempt.id };
    }

    return { processed: false, reason: 'unsupported_provider_state', payoutAttemptId: attempt.id };
}
