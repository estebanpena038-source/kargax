import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    getPayrollFeeAmount,
    resolvePrivateFleetPayrollAccess,
} from '@/lib/server/private-fleet-payroll';

function getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return {
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: end.toISOString().slice(0, 10),
    };
}

function normalizeDateInput(value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    return value;
}

function normalizeCurrency(value: unknown) {
    const candidate = typeof value === 'string' ? value.toUpperCase() : 'COP';
    return ['COP', 'USD', 'PEN', 'BRL'].includes(candidate) ? candidate : 'COP';
}

type PayrollRunRecord = Record<string, unknown> & {
    id: string;
    status: string;
    metadata?: Record<string, unknown> | null;
};

type PayrollItemRecord = Record<string, unknown> & {
    run_id: string;
    status?: string | null;
    amount?: number | string | null;
};

type PayrollItemInsert = {
    fleet_member_id: string;
    business_id: string;
    trucker_id: string;
    amount: number;
    status: string;
    metadata: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const payrollAccess = await resolvePrivateFleetPayrollAccess(
        supabaseAdmin,
        authUser.id,
        profile,
        request.nextUrl.searchParams.get('businessId')
    );

    if (!payrollAccess.businessId) {
        return apiError('Business access required', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_PAYROLL_BUSINESS_REQUIRED',
        });
    }

    const businessId = payrollAccess.businessId;

    if (!payrollAccess.canViewPayroll) {
        return apiError('Tu rol no tiene acceso a nomina privada.', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_PAYROLL_FORBIDDEN',
        });
    }

    const [runsResponse, membersResponse] = await Promise.all([
        supabaseAdmin
            .from('private_fleet_payroll_runs')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(12),
        supabaseAdmin
            .from('business_fleet_members')
            .select(`
                id,
                business_id,
                trucker_id,
                status,
                internal_driver_id,
                vehicle_plate,
                default_compensation_mode,
                monthly_salary_amount,
                monthly_salary_currency,
                payroll_day,
                payroll_notes,
                user:user_profiles!business_fleet_members_trucker_id_fkey(id, email, full_name, phone)
            `)
            .eq('business_id', businessId)
            .order('created_at', { ascending: true }),
    ]);

    if (runsResponse.error) {
        return apiError(runsResponse.error.message || 'No se pudo cargar nomina privada', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PAYROLL_LOAD_FAILED',
        });
    }

    if (membersResponse.error) {
        return apiError(membersResponse.error.message || 'No se pudo cargar conductores', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PAYROLL_MEMBERS_LOAD_FAILED',
        });
    }

    const runs = (runsResponse.data || []) as PayrollRunRecord[];
    const runIds = runs.map((run) => run.id);
    const { data: items, error: itemsError } = runIds.length
        ? await supabaseAdmin
            .from('private_fleet_payroll_items')
            .select('*')
            .in('run_id', runIds)
            .order('created_at', { ascending: true })
        : { data: [], error: null };

    if (itemsError) {
        return apiError(itemsError.message || 'No se pudieron cargar items de nomina', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PAYROLL_ITEMS_LOAD_FAILED',
        });
    }

    const itemRows = (items || []) as PayrollItemRecord[];
    const itemsByRunId = new Map<string, PayrollItemRecord[]>();
    itemRows.forEach((item) => {
        const runItems = itemsByRunId.get(item.run_id) || [];
        runItems.push(item);
        itemsByRunId.set(item.run_id, runItems);
    });

    const enrichedRuns = runs.map((run) => ({
        ...run,
        items: itemsByRunId.get(run.id) || [],
    }));

    const releasedThisMonthCop = itemRows
        .filter((item) => item.status === 'released_to_wallet')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return apiSuccess({
        runs: enrichedRuns,
        members: membersResponse.data || [],
        canManagePayroll: payrollAccess.canManagePayroll,
        role: payrollAccess.effectiveRole,
        summary: {
            configuredDrivers: (membersResponse.data || []).filter((member) => Number(member.monthly_salary_amount || 0) > 0).length,
            releasedThisMonthCop,
            pendingRuns: runs.filter((run) => ['draft', 'approved', 'checkout_pending', 'funded'].includes(run.status)).length,
        },
    }, {
        requestId,
        code: 'PRIVATE_FLEET_PAYROLL_LOADED',
    });
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const body = await request.json().catch(() => ({})) as {
        businessId?: string;
        periodStart?: string;
        periodEnd?: string;
        currencyCode?: string;
        items?: Array<{ fleetMemberId?: string; amount?: number }>;
    };
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

    const businessId = payrollAccess.businessId;

    if (!payrollAccess.canManagePayroll) {
        return apiError('Solo owner/admin/contabilidad puede crear nomina privada.', {
            requestId,
            status: 403,
            code: 'PRIVATE_FLEET_PAYROLL_MANAGE_FORBIDDEN',
        });
    }

    const defaultRange = getCurrentMonthRange();
    const periodStart = normalizeDateInput(body.periodStart) || defaultRange.periodStart;
    const periodEnd = normalizeDateInput(body.periodEnd) || defaultRange.periodEnd;
    const currencyCode = normalizeCurrency(body.currencyCode);

    if (periodEnd < periodStart) {
        return apiError('periodEnd debe ser mayor o igual a periodStart', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_PAYROLL_INVALID_PERIOD',
        });
    }

    const { data: activeMembers, error: membersError } = await supabaseAdmin
        .from('business_fleet_members')
        .select('id, business_id, trucker_id, status, monthly_salary_amount, monthly_salary_currency')
        .eq('business_id', businessId)
        .eq('status', 'active');

    if (membersError) {
        return apiError(membersError.message || 'No se pudo cargar flota activa', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PAYROLL_MEMBERS_LOAD_FAILED',
        });
    }

    const memberById = new Map((activeMembers || []).map((member) => [member.id, member]));
    const requestedItems = Array.isArray(body.items) && body.items.length
        ? body.items
        : (activeMembers || [])
            .filter((member) => Number(member.monthly_salary_amount || 0) > 0)
            .map((member) => ({
                fleetMemberId: member.id,
                amount: Number(member.monthly_salary_amount || 0),
            }));

    const normalizedItems = requestedItems
        .map((item): PayrollItemInsert | null => {
            const member = item.fleetMemberId ? memberById.get(item.fleetMemberId) : null;
            const amount = Math.round(Number(item.amount || 0));

            return member && amount > 0
                ? {
                    fleet_member_id: member.id,
                    business_id: businessId,
                    trucker_id: member.trucker_id,
                    amount,
                    status: 'pending',
                    metadata: {
                        source_kind: 'private_fleet_monthly_payroll',
                        configured_currency: member.monthly_salary_currency || currencyCode,
                    },
                }
                : null;
        })
        .filter((item): item is PayrollItemInsert => item !== null);

    if (normalizedItems.length === 0) {
        return apiError('No hay conductores activos con salario mensual configurado.', {
            requestId,
            status: 400,
            code: 'PRIVATE_FLEET_PAYROLL_EMPTY',
        });
    }

    const grossAmount = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
    const processingFeeAmount = getPayrollFeeAmount(grossAmount);
    const totalAmount = grossAmount + processingFeeAmount;

    const { data: run, error: runError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .insert({
            business_id: businessId,
            period_start: periodStart,
            period_end: periodEnd,
            currency_code: currencyCode,
            status: 'draft',
            gross_amount: grossAmount,
            processing_fee_amount: processingFeeAmount,
            total_amount: totalAmount,
            created_by: authUser.id,
            metadata: {
                source_kind: 'private_fleet_payroll_created',
                role: payrollAccess.effectiveRole,
            },
        })
        .select('*')
        .single();

    if (runError || !run) {
        return apiError(runError?.message || 'No se pudo crear corrida de nomina', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PAYROLL_CREATE_FAILED',
        });
    }

    const { data: items, error: itemsError } = await supabaseAdmin
        .from('private_fleet_payroll_items')
        .insert(normalizedItems.map((item) => ({
            ...item,
            run_id: run.id,
        })))
        .select('*');

    if (itemsError) {
        await supabaseAdmin
            .from('private_fleet_payroll_runs')
            .update({
                status: 'failed',
                metadata: {
                    ...(run.metadata || {}),
                    item_create_error: itemsError.message,
                },
            })
            .eq('id', run.id);

        return apiError(itemsError.message || 'No se pudieron crear items de nomina', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PAYROLL_ITEMS_CREATE_FAILED',
        });
    }

    return apiSuccess({
        run: {
            ...run,
            items: items || [],
        },
    }, {
        requestId,
        status: 201,
        code: 'PRIVATE_FLEET_PAYROLL_CREATED',
    });
}
