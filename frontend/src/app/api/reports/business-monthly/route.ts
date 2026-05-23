import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { resolveBusinessAccessContext } from '@/lib/server/warehouses';
import { getBusinessRoleCapabilities } from '@/lib/business-roles';

function getMonthRange(monthParam: string | null) {
    const base = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? new Date(`${monthParam}-01T00:00:00.000Z`)
        : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
}

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) return auth.response;

    const { supabaseAdmin, authUser, profile } = auth.context;
    const access = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
        resolvedBusinessId: access.businessId,
        profile,
    });

    if ('error' in scopedBusiness) {
        return apiError(scopedBusiness.error || 'Business scope error', {
            status: scopedBusiness.status,
            code: 'BUSINESS_SCOPE_ERROR',
            requestId,
        });
    }

    const { start, end } = getMonthRange(request.nextUrl.searchParams.get('month'));
    const businessId = scopedBusiness.businessId;
    if (!businessId) {
        return apiError('businessId es requerido', {
            status: 400,
            code: 'BUSINESS_SCOPE_REQUIRED',
            requestId,
        });
    }

    const effectiveRole = profile?.user_type === 'admin'
        ? 'admin'
        : access.isOwner
            ? 'owner'
            : access.teamMember?.role || 'viewer';
    const roleCapabilities = getBusinessRoleCapabilities(effectiveRole);

    if (!roleCapabilities.canViewIntelligence) {
        return apiError('Tu rol no tiene acceso al dashboard de inteligencia.', {
            status: 403,
            code: 'BUSINESS_INTELLIGENCE_FORBIDDEN',
            requestId,
        });
    }

    const [{ data: offers }, { data: allocations }, { data: payrollItems }] = await Promise.all([
        supabaseAdmin
            .from('cargo_offers')
            .select('id, cargo_type, origin_department, origin_city, destination_department, destination_city, status, total_amount, platform_fee, net_amount, is_private_fleet, assigned_trucker_id, private_fleet_trucker_id, created_at')
            .eq('business_id', businessId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString()),
        supabaseAdmin
            .from('trip_financial_allocations')
            .select('id, offer_id, allocation_type, amount, status, trucker_id, created_at')
            .eq('business_id', businessId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString()),
        supabaseAdmin
            .from('private_fleet_payroll_items')
            .select('id, run_id, amount, status, trucker_id, created_at, released_at')
            .eq('business_id', businessId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString()),
    ]);

    const offerRows = (offers || []) as Array<Record<string, unknown>>;
    const truckerIds = Array.from(new Set(
        offerRows
            .flatMap((row) => [row.assigned_trucker_id, row.private_fleet_trucker_id])
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ));
    const { data: truckerProfiles } = truckerIds.length
        ? await supabaseAdmin
            .from('user_profiles')
            .select('id, full_name, phone, avatar_url')
            .in('id', truckerIds)
        : { data: [] };
    const { data: payouts } = truckerIds.length
        ? await supabaseAdmin
            .from('payout_attempts')
            .select('id, user_id, provider, method, amount_cop, status, created_at')
            .in('user_id', truckerIds)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
        : { data: [] };
    const truckerProfileMap = new Map((truckerProfiles || []).map((profileRow) => [
        profileRow.id,
        profileRow as { id: string; full_name?: string | null; phone?: string | null; avatar_url?: string | null },
    ]));
    const enrichedOfferRows = offerRows.map((row) => {
        const truckerId = String(row.assigned_trucker_id || row.private_fleet_trucker_id || '');
        const trucker = truckerProfileMap.get(truckerId);
        return {
            ...row,
            trucker_name: trucker?.full_name || null,
            trucker_phone: trucker?.phone || null,
            trucker_avatar_url: trucker?.avatar_url || null,
        };
    });
    const allocationRows = (allocations || []) as Array<Record<string, unknown>>;
    const payrollRows = (payrollItems || []) as Array<Record<string, unknown>>;
    const payoutRows = (payouts || []) as Array<Record<string, unknown>>;
    const marketplaceRows = offerRows.filter((row) => row.is_private_fleet !== true);
    const privateFleetRows = offerRows.filter((row) => row.is_private_fleet === true);
    const summary = {
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        trips: offerRows.length,
        completed_trips: offerRows.filter((row) => ['completed', 'delivered'].includes(String(row.status || ''))).length,
        marketplace_gmv_cop: marketplaceRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
        private_fleet_gmv_cop: privateFleetRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
        gross_amount_cop: offerRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
        kargax_fee_cop: offerRows.reduce((sum, row) => sum + Number(row.platform_fee || 0), 0),
        net_to_truckers_cop: offerRows.reduce((sum, row) => sum + Number(row.net_amount || 0), 0),
        private_trip_pay_cop: allocationRows
            .filter((row) => ['trip_pay', 'freight_payment'].includes(String(row.allocation_type || '')))
            .reduce((sum, row) => sum + Number(row.amount || 0), 0),
        private_payroll_cop: payrollRows
            .filter((row) => row.status === 'released_to_wallet')
            .reduce((sum, row) => sum + Number(row.amount || 0), 0),
        private_payroll_pending_cop: payrollRows
            .filter((row) => row.status !== 'released_to_wallet')
            .reduce((sum, row) => sum + Number(row.amount || 0), 0),
        company_expenses_cop: allocationRows
            .filter((row) => ['company_expense', 'expense_advance'].includes(String(row.allocation_type || '')))
            .reduce((sum, row) => sum + Number(row.amount || 0), 0),
        payouts_cop: payoutRows.reduce((sum, row) => sum + Number(row.amount_cop || 0), 0),
    };

    const visibleSummary = roleCapabilities.canViewFinance
        ? summary
        : {
            ...summary,
            gross_amount_cop: 0,
            marketplace_gmv_cop: 0,
            private_fleet_gmv_cop: 0,
            kargax_fee_cop: 0,
            net_to_truckers_cop: 0,
            private_trip_pay_cop: 0,
            private_payroll_cop: 0,
            private_payroll_pending_cop: 0,
            company_expenses_cop: 0,
            payouts_cop: 0,
        };
    const visibleTrips = roleCapabilities.canViewFinance
        ? enrichedOfferRows
        : enrichedOfferRows.map((row) => ({
            ...row,
            total_amount: null,
            platform_fee: null,
            net_amount: null,
        }));
    const visiblePrivateFinance = roleCapabilities.canViewFinance ? allocationRows : [];
    const visiblePrivatePayroll = roleCapabilities.canViewFinance ? payrollRows : [];
    const visiblePayouts = roleCapabilities.canViewFinance ? payoutRows : [];

    const { data: exportRow } = await supabaseAdmin
        .from('report_exports')
        .insert({
            business_id: businessId,
            report_type: 'business_monthly_accounting',
            period_start: summary.period_start,
            period_end: summary.period_end,
            status: 'generated',
            format: 'json',
            summary: visibleSummary,
            generated_by: authUser.id,
        })
        .select('*')
        .single();

    return apiSuccess({
        export: exportRow,
        role: effectiveRole,
        role_capabilities: roleCapabilities,
        summary: visibleSummary,
        trips: visibleTrips,
        private_finance: visiblePrivateFinance,
        private_payroll: visiblePrivatePayroll,
        payouts: visiblePayouts,
    }, {
        requestId,
        code: 'BUSINESS_MONTHLY_REPORT_READY',
    });
}
