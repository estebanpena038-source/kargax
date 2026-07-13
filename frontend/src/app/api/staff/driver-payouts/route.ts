import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { listDriverPayouts } from '@/lib/server/driver-payouts';
import { requireStaffCapability } from '@/lib/server/staff';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireStaffCapability(request, 'payout:read');

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const includeSensitiveDestination = auth.context.staff.capabilities.includes('payout:mark_paid');
        const data = await listDriverPayouts(auth.context.supabaseAdmin, {
            status: request.nextUrl.searchParams.get('status'),
            driverId: request.nextUrl.searchParams.get('driverId'),
            businessId: request.nextUrl.searchParams.get('businessId'),
            from: request.nextUrl.searchParams.get('from'),
            to: request.nextUrl.searchParams.get('to'),
            limit: Number(request.nextUrl.searchParams.get('limit') || 100),
            includeSensitiveDestination,
        });

        return apiSuccess(data, {
            requestId,
            code: 'DRIVER_PAYOUTS_READY',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'No se pudieron cargar los pagos a drivers', {
            requestId,
            status: 500,
            code: 'DRIVER_PAYOUTS_FAILED',
        });
    }
}
