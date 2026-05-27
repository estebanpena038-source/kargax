import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import { resolveBusinessAccessContext } from '@/lib/server/warehouses';
import {
    getBusinessPolicyCapabilities,
    resolveEffectiveBusinessRole,
} from '@/lib/server/role-policy';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ memberId: string }> }
) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const { memberId } = await params;
    const effectiveRole = resolveEffectiveBusinessRole(profile, businessAccess);
    const roleCapabilities = getBusinessPolicyCapabilities(effectiveRole);
    const canManageFleet = roleCapabilities.canManagePrivateFleetOperationalProfile;
    const canManagePayroll = roleCapabilities.canManagePrivateFleetMoney;

    if (!canManageFleet && !canManagePayroll) {
        return apiError('Solo owner/admin/contabilidad puede editar datos sensibles de flota privada', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_MEMBER_FORBIDDEN',
        });
    }

    const { data: member, error: memberError } = await supabaseAdmin
        .from('business_fleet_members')
        .select('id, business_id, status')
        .eq('id', memberId)
        .maybeSingle();

    if (memberError || !member) {
        return apiError('Conductor de flota no encontrado', {
            requestId,
            status: 404,
            code: 'BUSINESS_FLEET_MEMBER_NOT_FOUND',
        });
    }

    if (profile?.user_type !== 'admin' && member.business_id !== businessAccess.businessId) {
        return apiError('No tienes acceso a este conductor', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_MEMBER_SCOPE_DENIED',
        });
    }

    const body = await request.json().catch(() => ({})) as {
        status?: 'active' | 'suspended' | 'removed';
        internalDriverId?: string | null;
        vehiclePlate?: string | null;
        notes?: string | null;
        defaultCompensationMode?: 'salary_no_trip_pay' | 'trip_pay' | 'expenses_only' | 'trip_pay_plus_expenses';
        monthlySalaryAmount?: number | null;
        monthlySalaryCurrency?: 'COP' | 'USD' | 'PEN' | 'BRL' | null;
        payrollDay?: number | null;
        payrollNotes?: string | null;
    };

    const updatePayload: Record<string, unknown> = {};
    const operationalFieldsRequested =
        body.status !== undefined ||
        body.internalDriverId !== undefined ||
        body.vehiclePlate !== undefined ||
        body.notes !== undefined;
    const payrollFieldsRequested =
        body.defaultCompensationMode !== undefined ||
        body.monthlySalaryAmount !== undefined ||
        body.monthlySalaryCurrency !== undefined ||
        body.payrollDay !== undefined ||
        body.payrollNotes !== undefined;

    if (operationalFieldsRequested && !canManageFleet) {
        return apiError('Solo owner/admin puede editar estado, placa o datos operativos de flota.', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_OPERATIONAL_EDIT_FORBIDDEN',
        });
    }

    if (payrollFieldsRequested && !canManagePayroll) {
        return apiError('Solo owner/admin/contabilidad puede editar compensacion y nomina.', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_PAYROLL_EDIT_FORBIDDEN',
        });
    }

    if (body.status && ['active', 'suspended', 'removed'].includes(body.status)) {
        updatePayload.status = body.status;
    }

    if (body.internalDriverId !== undefined) {
        updatePayload.internal_driver_id = body.internalDriverId?.trim() || null;
    }

    if (body.vehiclePlate !== undefined) {
        updatePayload.vehicle_plate = body.vehiclePlate?.trim().toUpperCase() || null;
    }

    if (body.notes !== undefined) {
        updatePayload.notes = body.notes?.trim() || null;
    }

    if (
        body.defaultCompensationMode
        && ['salary_no_trip_pay', 'trip_pay', 'expenses_only', 'trip_pay_plus_expenses'].includes(body.defaultCompensationMode)
    ) {
        updatePayload.default_compensation_mode = body.defaultCompensationMode;
    }

    if (body.monthlySalaryAmount !== undefined) {
        updatePayload.monthly_salary_amount = Math.max(0, Math.round(Number(body.monthlySalaryAmount || 0)));
    }

    if (body.monthlySalaryCurrency && ['COP', 'USD', 'PEN', 'BRL'].includes(body.monthlySalaryCurrency)) {
        updatePayload.monthly_salary_currency = body.monthlySalaryCurrency;
    }

    if (body.payrollDay !== undefined) {
        const payrollDay = Math.min(31, Math.max(1, Math.round(Number(body.payrollDay || 30))));
        updatePayload.payroll_day = payrollDay;
    }

    if (body.payrollNotes !== undefined) {
        updatePayload.payroll_notes = body.payrollNotes?.trim() || null;
    }

    if (!Object.keys(updatePayload).length) {
        return apiError('No hay cambios validos para guardar', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_MEMBER_EMPTY_UPDATE',
        });
    }

    const { data: updatedMember, error: updateError } = await supabaseAdmin
        .from('business_fleet_members')
        .update(updatePayload)
        .eq('id', memberId)
        .select('*')
        .single();

    if (updateError || !updatedMember) {
        return apiError(updateError?.message || 'No se pudo actualizar el conductor', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_MEMBER_UPDATE_FAILED',
        });
    }

    return apiSuccess({
        data: updatedMember,
    }, {
        requestId,
        code: 'BUSINESS_FLEET_MEMBER_UPDATED',
    });
}
