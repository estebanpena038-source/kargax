import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { createAdminNotification, requireAal2Route } from '@/lib/server/route-auth';
import { resolvePrivateFleetPayrollAccess } from '@/lib/server/private-fleet-payroll';

type ExternalAllocationStatus = 'paid_external' | 'rejected' | 'cancelled';

function normalizeStatus(value: unknown): ExternalAllocationStatus | null {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'paid_external') return 'paid_external';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'cancelled') return 'cancelled';
    return null;
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ allocationId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { allocationId } = await params;
    const body = await request.json().catch(() => ({})) as {
        businessId?: string;
        status?: string;
        note?: string;
    };
    const nextStatus = normalizeStatus(body.status);

    if (!nextStatus) {
        return apiError('Estado externo invalido', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_ALLOCATION_STATUS_INVALID',
        });
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const payrollAccess = await resolvePrivateFleetPayrollAccess(
        supabaseAdmin,
        authUser.id,
        profile,
        body.businessId
    );

    if (!payrollAccess.businessId || !payrollAccess.canManagePayroll) {
        return apiError('Solo owner/admin/contabilidad puede actualizar liquidaciones privadas.', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_ALLOCATION_STATUS_FORBIDDEN',
        });
    }

    const { data: allocation, error: allocationError } = await supabaseAdmin
        .from('trip_financial_allocations')
        .select('*')
        .eq('id', allocationId)
        .eq('business_id', payrollAccess.businessId)
        .maybeSingle();

    if (allocationError || !allocation) {
        return apiError(allocationError?.message || 'Liquidacion privada no encontrada', {
            requestId,
            status: 404,
            code: 'PRIVATE_FLEET_ALLOCATION_NOT_FOUND',
        });
    }

    if (String(allocation.status || '') === 'released_to_wallet') {
        return apiError('Esta liquidacion fue procesada por flujo legacy de wallet y requiere revision manual.', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_ALLOCATION_LEGACY_WALLET_LOCKED',
        });
    }

    if (nextStatus === 'paid_external') {
        const { count } = await supabaseAdmin
            .from('private_fleet_payment_proofs')
            .select('id', { count: 'exact', head: true })
            .eq('allocation_id', allocation.id);

        if (!count && profile?.user_type !== 'admin') {
            return apiError('Para marcar pagado externo debes cargar primero un comprobante.', {
                requestId,
                status: 409,
                code: 'PRIVATE_FLEET_ALLOCATION_PROOF_REQUIRED',
            });
        }
    }

    const metadata = allocation.metadata && typeof allocation.metadata === 'object' && !Array.isArray(allocation.metadata)
        ? allocation.metadata
        : {};
    const paidAt = nextStatus === 'paid_external' ? new Date().toISOString() : allocation.external_paid_at || null;
    const { data: updatedAllocation, error: updateError } = await supabaseAdmin
        .from('trip_financial_allocations')
        .update({
            status: nextStatus,
            external_payment_status: nextStatus,
            external_paid_at: paidAt,
            external_paid_by: nextStatus === 'paid_external' ? authUser.id : allocation.external_paid_by || null,
            external_payment_note: body.note || allocation.external_payment_note || null,
            released_at: null,
            wallet_transaction_id: null,
            metadata: {
                ...metadata,
                source_kind: 'private_fleet_allocation_external_status',
                external_payment_status: nextStatus,
                wallet_touched: false,
            },
        })
        .eq('id', allocation.id)
        .select('*')
        .single();

    if (updateError || !updatedAllocation) {
        return apiError(updateError?.message || 'No se pudo actualizar liquidacion privada', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_ALLOCATION_STATUS_UPDATE_FAILED',
        });
    }

    const { count: openCount } = await supabaseAdmin
        .from('trip_financial_allocations')
        .select('id', { count: 'exact', head: true })
        .eq('offer_id', allocation.offer_id)
        .in('status', ['external_proof_pending', 'proof_uploaded']);

    await supabaseAdmin
        .from('cargo_offers')
        .update({
            private_payment_status: nextStatus === 'paid_external' && !openCount
                ? 'paid_external'
                : nextStatus,
            updated_at: new Date().toISOString(),
        })
        .eq('id', allocation.offer_id);

    await createAdminNotification(supabaseAdmin, {
        type: 'private_fleet_allocation_status_updated',
        title: 'Liquidacion privada actualizada',
        message: `Liquidacion privada ${String(allocation.id).slice(0, 8)} cambio a ${nextStatus}.`,
        data: {
            business_id: payrollAccess.businessId,
            allocation_id: allocation.id,
            offer_id: allocation.offer_id,
            status: nextStatus,
            wallet_touched: false,
        },
    });

    return apiSuccess({
        allocation: updatedAllocation,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_ALLOCATION_STATUS_UPDATED',
    });
}
