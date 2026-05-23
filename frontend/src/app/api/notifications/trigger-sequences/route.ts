import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { createAdminNotification, requireAdminRoute } from '@/lib/server/route-auth';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAdminRoute(request);

    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser } = auth.context;
    const body = (await request.json().catch(() => ({}))) as {
        sequenceKey?: string;
        userId?: string;
        payload?: Record<string, unknown>;
    };

    if (!body.sequenceKey || !body.userId) {
        return apiError('sequenceKey y userId son requeridos', {
            status: 400,
            code: 'NOTIFICATION_SEQUENCE_VALIDATION_ERROR',
            requestId,
        });
    }

    const { data: sequence, error: sequenceError } = await supabaseAdmin
        .from('notification_sequences')
        .select('*')
        .eq('key', body.sequenceKey)
        .eq('enabled', true)
        .maybeSingle();

    if (sequenceError || !sequence) {
        return apiError('Secuencia no encontrada o deshabilitada', {
            status: 404,
            code: 'NOTIFICATION_SEQUENCE_NOT_FOUND',
            requestId,
        });
    }

    const dedupeKey = `${body.sequenceKey}:${body.userId}:${JSON.stringify(body.payload || {})}`;
    const { data: delivery, error: deliveryError } = await supabaseAdmin
        .from('notification_deliveries')
        .upsert({
            sequence_key: body.sequenceKey,
            user_id: body.userId,
            dedupe_key: dedupeKey,
            status: 'queued',
            channel: 'in_app',
            action_path: sequence.action_path || null,
            payload: {
                ...(body.payload || {}),
                triggered_by: authUser.id,
                title: sequence.title_template,
                body: sequence.body_template,
            },
        }, { onConflict: 'dedupe_key' })
        .select('*')
        .single();

    if (deliveryError) {
        return apiError(deliveryError.message, {
            status: 500,
            code: 'NOTIFICATION_DELIVERY_CREATE_FAILED',
            requestId,
        });
    }

    await createAdminNotification(supabaseAdmin, {
        type: 'notification_sequence_queued',
        title: `Secuencia ${body.sequenceKey}`,
        message: `Se encolo una notificacion accionable para ${body.userId}.`,
        data: { delivery_id: delivery.id, sequence_key: body.sequenceKey },
    });

    return apiSuccess({ sequence, delivery }, {
        requestId,
        code: 'NOTIFICATION_SEQUENCE_QUEUED',
    });
}
