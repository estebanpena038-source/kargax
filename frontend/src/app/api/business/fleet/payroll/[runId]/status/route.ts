import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { createAdminNotification, requireAal2Route } from '@/lib/server/route-auth';
import { resolvePrivateFleetPayrollAccess } from '@/lib/server/private-fleet-payroll';

type ExternalPayrollStatus = 'paid_external' | 'rejected' | 'cancelled';

function normalizeStatus(value: unknown): ExternalPayrollStatus | null {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'paid_external') return 'paid_external';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'cancelled') return 'cancelled';
    return null;
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { runId } = await params;
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
            code: 'PRIVATE_FLEET_EXTERNAL_STATUS_INVALID',
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
            code: 'PRIVATE_FLEET_EXTERNAL_STATUS_FORBIDDEN',
        });
    }

    const { data: run, error: runError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .select('*')
        .eq('id', runId)
        .eq('business_id', payrollAccess.businessId)
        .maybeSingle();

    if (runError || !run) {
        return apiError(runError?.message || 'Liquidacion no encontrada', {
            requestId,
            status: 404,
            code: 'PRIVATE_FLEET_PAYROLL_NOT_FOUND',
        });
    }

    if (nextStatus === 'paid_external') {
        const { count } = await supabaseAdmin
            .from('private_fleet_payment_proofs')
            .select('id', { count: 'exact', head: true })
            .eq('run_id', run.id);

        if (!count && profile?.user_type !== 'admin') {
            return apiError('Para marcar pagado externo debes cargar primero un comprobante.', {
                requestId,
                status: 409,
                code: 'PRIVATE_FLEET_PROOF_REQUIRED',
            });
        }
    }

    const paidAt = nextStatus === 'paid_external' ? new Date().toISOString() : run.external_paid_at || null;
    const { data: updatedRun, error: updateError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .update({
            status: nextStatus,
            payment_mode: 'external_proof',
            external_payment_status: nextStatus,
            external_paid_at: paidAt,
            external_paid_by: nextStatus === 'paid_external' ? authUser.id : run.external_paid_by || null,
            external_payment_note: body.note || run.external_payment_note || null,
        })
        .eq('id', run.id)
        .select('*')
        .single();

    if (updateError || !updatedRun) {
        return apiError(updateError?.message || 'No se pudo actualizar liquidacion', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_EXTERNAL_STATUS_UPDATE_FAILED',
        });
    }

    await supabaseAdmin
        .from('private_fleet_payroll_items')
        .update({
            status: nextStatus,
            released_at: nextStatus === 'paid_external' ? paidAt : null,
            metadata: {
                source_kind: 'private_fleet_external_status',
                external_payment_status: nextStatus,
                wallet_touched: false,
            },
        })
        .eq('run_id', run.id)
        .neq('status', 'released_to_wallet');

    await createAdminNotification(supabaseAdmin, {
        type: 'private_fleet_external_status_updated',
        title: 'Liquidacion privada actualizada',
        message: `Liquidacion ${run.id.slice(0, 8)} cambio a ${nextStatus}.`,
        data: {
            business_id: payrollAccess.businessId,
            payroll_run_id: run.id,
            status: nextStatus,
            wallet_touched: false,
        },
    });

    return apiSuccess({
        run: updatedRun,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_EXTERNAL_STATUS_UPDATED',
    });
}
