import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import { resolvePrivateFleetPayrollAccess } from '@/lib/server/private-fleet-payroll';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { runId } = await params;
    const body = await request.json().catch(() => ({})) as { businessId?: string };
    const { supabaseAdmin, authUser, profile } = auth.context;
    const payrollAccess = await resolvePrivateFleetPayrollAccess(
        supabaseAdmin,
        authUser.id,
        profile,
        body.businessId
    );

    if (!payrollAccess.businessId) {
        return apiError('Business access required', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_PAYROLL_BUSINESS_REQUIRED',
        });
    }

    if (!payrollAccess.canManagePayroll) {
        return apiError('Solo owner/admin/contabilidad puede aprobar nomina privada.', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_PAYROLL_APPROVE_FORBIDDEN',
        });
    }

    const { data: run, error: runError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .select('*')
        .eq('id', runId)
        .eq('business_id', payrollAccess.businessId)
        .maybeSingle();

    if (runError || !run) {
        return apiError(runError?.message || 'Corrida de nomina no encontrada', {
            requestId,
            status: 404,
            code: 'PRIVATE_FLEET_PAYROLL_NOT_FOUND',
        });
    }

    if (!['draft', 'failed'].includes(run.status)) {
        return apiError('Solo se puede aprobar una nomina en borrador o fallida.', {
            requestId,
            status: 409,
            code: 'PRIVATE_FLEET_PAYROLL_INVALID_STATUS',
        });
    }

    if (Number(run.gross_amount || 0) <= 0) {
        return apiError('La nomina no tiene monto para aprobar.', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_PAYROLL_EMPTY',
        });
    }

    const { data: updatedRun, error: updateError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .update({
            status: 'approved',
            approved_by: authUser.id,
            approved_at: new Date().toISOString(),
        })
        .eq('id', run.id)
        .select('*')
        .single();

    if (updateError || !updatedRun) {
        return apiError(updateError?.message || 'No se pudo aprobar nomina', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PAYROLL_APPROVE_FAILED',
        });
    }

    return apiSuccess({
        run: updatedRun,
    }, {
        requestId,
        code: 'PRIVATE_FLEET_PAYROLL_APPROVED',
    });
}
