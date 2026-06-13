import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { getDriverPayout } from '@/lib/server/driver-payouts';
import { requireStaffCapability } from '@/lib/server/staff';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireStaffCapability(request, 'payout:read');

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const { id } = await context.params;
        const data = await getDriverPayout(auth.context.supabaseAdmin, id);

        if (!data) {
            return apiError('Pago a driver no encontrado', {
                requestId,
                status: 404,
                code: 'DRIVER_PAYOUT_NOT_FOUND',
            });
        }

        return apiSuccess(data, {
            requestId,
            code: 'DRIVER_PAYOUT_READY',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'No se pudo cargar el pago a driver', {
            requestId,
            status: 500,
            code: 'DRIVER_PAYOUT_FAILED',
        });
    }
}
