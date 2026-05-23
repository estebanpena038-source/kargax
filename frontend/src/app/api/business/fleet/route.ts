import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { buildPublicAppUrl, isLocalAppUrl, shouldAllowLocalPublicAppUrl } from '@/lib/platform/public-app-url';
import { getBusinessRoleCapabilities } from '@/lib/business-roles';
import {
    enforcePrivateFleetDriverLimit,
    getBusinessPlanSnapshot,
    getBusinessPrivateFleetSetupMessage,
    getPlanLimitErrorDetails,
    isBusinessFleetMembersTableMissing,
    isPlanLimitError,
    resolveBusinessAccessContext,
} from '@/lib/server/warehouses';

const DEFAULT_INVITATION_HOURS = 48;

function isPrivateFleetPayrollSchemaMissing(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const candidate = error as {
        code?: string | null;
        details?: string | null;
        hint?: string | null;
        message?: string | null;
    };
    const text = [candidate.code, candidate.message, candidate.details, candidate.hint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return text.includes('private_fleet_payroll_items') && (
        text.includes('schema cache')
        || text.includes('does not exist')
        || text.includes('pgrst205')
    );
}

function isPrivateFleetAssignmentSchemaMissing(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const candidate = error as {
        code?: string | null;
        details?: string | null;
        hint?: string | null;
        message?: string | null;
    };
    const text = [candidate.code, candidate.message, candidate.details, candidate.hint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return text.includes('private_fleet_assignment_status') || text.includes('private_fleet_rejected');
}

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
        resolvedBusinessId: businessAccess.businessId,
        profile,
    });

    if ('error' in scopedBusiness) {
        return apiError(scopedBusiness.error ?? 'Business scope invalid', {
            requestId,
            status: scopedBusiness.status,
            code: 'BUSINESS_FLEET_SCOPE_INVALID',
        });
    }

    const businessId = scopedBusiness.businessId;
    const effectiveRole = profile?.user_type === 'admin'
        ? 'admin'
        : businessAccess.isOwner
            ? 'owner'
            : businessAccess.teamMember?.role || 'viewer';
    const roleCapabilities = getBusinessRoleCapabilities(effectiveRole);
    const canManagePayroll = profile?.user_type === 'admin'
        || businessAccess.isOwner
        || businessAccess.teamMember?.role === 'finance_accountant';

    if (!businessId || (!businessAccess.isOwner && profile?.user_type !== 'admin' && !canManagePayroll)) {
        return apiError('Solo owner/admin/contabilidad puede ver esta flota privada', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_FORBIDDEN',
        });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let [membersResponse, invitationsResponse, offersResponse, allocationsResponse, payrollItemsResponse, snapshot] = await Promise.all([
        supabaseAdmin
            .from('business_fleet_members')
            .select(`
                *,
                user:user_profiles!business_fleet_members_trucker_id_fkey(id, email, full_name, phone, avatar_url)
            `)
            .eq('business_id', businessId)
            .order('created_at', { ascending: true }),
        supabaseAdmin
            .from('business_fleet_invitations')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(25),
        supabaseAdmin
            .from('cargo_offers')
            .select('id, assigned_trucker_id, status, is_private_fleet, private_fleet_assignment_status, created_at, freight_payment_amount, expense_allowance_amount')
            .eq('business_id', businessId)
            .eq('is_private_fleet', true),
        supabaseAdmin
            .from('trip_financial_allocations')
            .select('offer_id, trucker_id, allocation_type, amount, status, created_at, released_at')
            .eq('business_id', businessId)
            .gte('created_at', monthStart.toISOString()),
        supabaseAdmin
            .from('private_fleet_payroll_items')
            .select('trucker_id, amount, status, created_at, released_at')
            .eq('business_id', businessId)
            .gte('created_at', monthStart.toISOString()),
        getBusinessPlanSnapshot(supabaseAdmin, businessId),
    ]) as any;

    if (offersResponse.error && isPrivateFleetAssignmentSchemaMissing(offersResponse.error)) {
        offersResponse = await supabaseAdmin
            .from('cargo_offers')
            .select('id, assigned_trucker_id, status, is_private_fleet, created_at, freight_payment_amount, expense_allowance_amount')
            .eq('business_id', businessId)
            .eq('is_private_fleet', true);
    }

    if (membersResponse.error) {
        if (isBusinessFleetMembersTableMissing(membersResponse.error)) {
            return apiError(getBusinessPrivateFleetSetupMessage(), {
                requestId,
                status: 503,
                code: 'BUSINESS_FLEET_SCHEMA_MISSING',
            });
        }

        return apiError(membersResponse.error.message || 'No se pudo cargar la flota', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_LOAD_FAILED',
        });
    }

    if (invitationsResponse.error) {
        return apiError(invitationsResponse.error.message || 'No se pudieron cargar invitaciones', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_INVITATIONS_LOAD_FAILED',
        });
    }

    if (offersResponse.error) {
        return apiError(offersResponse.error.message || 'No se pudieron cargar viajes privados', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_OFFERS_LOAD_FAILED',
        });
    }

    if (allocationsResponse.error) {
        return apiError(allocationsResponse.error.message || 'No se pudieron cargar custodias de flota', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_ALLOCATIONS_LOAD_FAILED',
        });
    }

    const payrollSchemaReady = !isPrivateFleetPayrollSchemaMissing(payrollItemsResponse.error);

    if (payrollItemsResponse.error && canManagePayroll && payrollSchemaReady) {
        return apiError(payrollItemsResponse.error.message || 'No se pudo cargar nomina privada', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_PAYROLL_LOAD_FAILED',
        });
    }

    const offers = offersResponse.data || [];
    const allocations = allocationsResponse.data || [];
    const payrollItems = payrollItemsResponse.error ? [] : payrollItemsResponse.data || [];

    const activeTripsByTruckerId = new Map<string, number>();
    const completedTripsByTruckerId = new Map<string, number>();
    let activeTrips = 0;
    let privateTripsCompleted = 0;

    offers.forEach((offer) => {
        const truckerId = offer.assigned_trucker_id || null;
        if (!truckerId) return;

        if (offer.private_fleet_assignment_status !== 'rejected' && ['assigned', 'reserved', 'in_progress'].includes(offer.status)) {
            activeTrips += 1;
            activeTripsByTruckerId.set(truckerId, (activeTripsByTruckerId.get(truckerId) || 0) + 1);
        }

        if (offer.status === 'completed') {
            privateTripsCompleted += 1;
            completedTripsByTruckerId.set(truckerId, (completedTripsByTruckerId.get(truckerId) || 0) + 1);
        }
    });

    const expenseByTruckerId = new Map<string, number>();
    const payrollByTruckerId = new Map<string, number>();
    let expenseAdvancedThisMonthCop = 0;
    let freightSettledThisMonthCop = 0;
    let payrollReleasedThisMonthCop = 0;

    allocations.forEach((allocation) => {
        if (allocation.allocation_type === 'expense_advance' && allocation.status === 'released_to_wallet') {
            const amount = Number(allocation.amount || 0);
            expenseAdvancedThisMonthCop += amount;
            expenseByTruckerId.set(allocation.trucker_id, (expenseByTruckerId.get(allocation.trucker_id) || 0) + amount);
        }

        if (['freight_payment', 'trip_pay'].includes(allocation.allocation_type) && allocation.status === 'released_to_wallet') {
            freightSettledThisMonthCop += Number(allocation.amount || 0);
        }
    });

    payrollItems.forEach((item) => {
        if (item.status !== 'released_to_wallet') {
            return;
        }

        const amount = Number(item.amount || 0);
        payrollReleasedThisMonthCop += amount;
        payrollByTruckerId.set(item.trucker_id, (payrollByTruckerId.get(item.trucker_id) || 0) + amount);
    });

    const members = (membersResponse.data || []).map((member) => ({
        ...member,
        monthly_salary_amount: canManagePayroll || roleCapabilities.canViewFinance ? Number(member.monthly_salary_amount || 0) : null,
        activeTrips: activeTripsByTruckerId.get(member.trucker_id) || 0,
        privateTripsCompleted: completedTripsByTruckerId.get(member.trucker_id) || 0,
        totalExpenseAdvancedCop: expenseByTruckerId.get(member.trucker_id) || 0,
        totalPayrollReleasedCop: payrollByTruckerId.get(member.trucker_id) || 0,
    }));

    return apiSuccess({
        data: members,
        invitations: invitationsResponse.data || [],
        subscription: snapshot.subscription,
        plans: snapshot.plans,
        limits: snapshot.limits,
        canManageFleet: businessAccess.isOwner || profile?.user_type === 'admin',
        canManagePayroll,
        payrollSchemaReady,
        invitationHours: DEFAULT_INVITATION_HOURS,
        stats: {
            activeDrivers: snapshot.limits.activePrivateFleetDrivers,
            activeTrips,
            privateTripsCompleted,
            expenseAdvancedThisMonthCop,
            freightSettledThisMonthCop,
            payrollReleasedThisMonthCop: canManagePayroll || roleCapabilities.canViewFinance ? payrollReleasedThisMonthCop : 0,
        },
    }, {
        requestId,
        code: 'BUSINESS_FLEET_LOADED',
    });
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

    if (profile?.user_type !== 'admin' && (!businessAccess.businessId || !businessAccess.isOwner)) {
        return apiError('Solo owner/admin puede invitar conductores a la flota', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_INVITE_FORBIDDEN',
        });
    }

    const body = await request.json().catch(() => ({})) as {
        businessId?: string;
        expiresHours?: number;
    };

    const scopedBusiness = resolveScopedBusinessId({
        requestedBusinessId: body.businessId,
        resolvedBusinessId: businessAccess.businessId,
        profile,
    });

    if ('error' in scopedBusiness) {
        return apiError(scopedBusiness.error ?? 'Business scope invalid', {
            requestId,
            status: scopedBusiness.status,
            code: 'BUSINESS_FLEET_SCOPE_INVALID',
        });
    }

    const businessId = scopedBusiness.businessId;

    if (!businessId) {
        return apiError('Business access required', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_INVITE_BUSINESS_REQUIRED',
        });
    }

    try {
        await enforcePrivateFleetDriverLimit(supabaseAdmin, businessId);
    } catch (error) {
        if (isPlanLimitError(error)) {
            return apiError(error.message, {
                requestId,
                status: 402,
                code: 'PLAN_LIMIT_REACHED',
                details: getPlanLimitErrorDetails(error),
            });
        }

        return apiError(error instanceof Error ? error.message : 'Limite de conductores alcanzado', {
            requestId,
            status: 409,
            code: 'BUSINESS_FLEET_LIMIT_REACHED',
        });
    }

    const { count: pendingInvitations, error: pendingInvitationsError } = await supabaseAdmin
        .from('business_fleet_invitations')
        .select('id', { head: true, count: 'exact' })
        .eq('business_id', businessId)
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString());

    if (pendingInvitationsError && !isBusinessFleetMembersTableMissing(pendingInvitationsError)) {
        return apiError(pendingInvitationsError.message || 'No se pudo validar el cupo de invitaciones', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_PENDING_INVITATIONS_FAILED',
        });
    }

    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, businessId);
    if (
        snapshot.limits.maxPrivateFleetDrivers !== null
        && snapshot.limits.activePrivateFleetDrivers + Number(pendingInvitations || 0) + 1 > snapshot.limits.maxPrivateFleetDrivers
    ) {
        return apiError(
            `Has alcanzado el limite de tu plan. ${snapshot.subscription?.plan?.name || 'Tu plan actual'} permite ${snapshot.limits.maxPrivateFleetDrivers} conductores privados activos o pendientes de activacion.`,
            {
                requestId,
                status: 402,
                code: 'PLAN_LIMIT_REACHED',
                details: {
                    featureKey: 'private_fleet_limit',
                    currentUsage: snapshot.limits.activePrivateFleetDrivers + Number(pendingInvitations || 0) + 1,
                    limitValue: snapshot.limits.maxPrivateFleetDrivers,
                    recommendedPlan: snapshot.limits.recommendedPlan,
                    checkoutPath: '/planes',
                },
            }
        );
    }

    const expiresHours = Number.isFinite(Number(body.expiresHours)) && Number(body.expiresHours) > 0
        ? Number(body.expiresHours)
        : DEFAULT_INVITATION_HOURS;

    const { data: inviteResult, error: inviteError } = await supabaseAdmin.rpc('generate_business_fleet_invitation', {
        p_business_id: businessId,
        p_created_by: authUser.id,
        p_expires_hours: expiresHours,
    });

    if (inviteError) {
        return apiError(inviteError.message || 'No se pudo generar la invitacion', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_INVITE_FAILED',
        });
    }

    const invitation = Array.isArray(inviteResult) ? inviteResult[0] : inviteResult;

    if (!invitation?.success) {
        return apiError(invitation?.message || 'No se pudo generar la invitacion', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_INVITE_REJECTED',
        });
    }

    const inviteCode = String(invitation.invite_code || '');
    const relativeLink = String(invitation.invite_link || `/registro?invite=${inviteCode}`);
    const normalizedRelativeLink = relativeLink.startsWith('http') && isLocalAppUrl(relativeLink)
        ? `${new URL(relativeLink).pathname}${new URL(relativeLink).search}`
        : relativeLink;
    const inviteUrl = normalizedRelativeLink.startsWith('http')
        ? normalizedRelativeLink
        : buildPublicAppUrl(normalizedRelativeLink, {
            requestOrigin: request.nextUrl.origin,
            allowLocalhost: shouldAllowLocalPublicAppUrl(),
        });

    if (!inviteUrl) {
        return apiError('No hay una URL pÃºblica vÃ¡lida para crear la invitaciÃ³n de flota.', {
            requestId,
            status: 503,
            code: 'BUSINESS_FLEET_INVITE_PUBLIC_URL_MISSING',
        });
    }
    const whatsappMessage = `Ãšnete a la flota de KargaX usando este link: ${inviteUrl}`;

    return apiSuccess({
        invitationId: invitation.invitation_id,
        inviteCode,
        inviteLink: inviteUrl,
        whatsappMessage,
        expiresAt: invitation.expires_at,
    }, {
        requestId,
        code: 'BUSINESS_FLEET_INVITE_CREATED',
        status: 201,
    });
}

