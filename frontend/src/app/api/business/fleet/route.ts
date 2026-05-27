import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { buildPublicAppUrl, isLocalAppUrl, shouldAllowLocalPublicAppUrl } from '@/lib/platform/public-app-url';
import {
    getBusinessPolicyCapabilities,
    resolveEffectiveBusinessRole,
} from '@/lib/server/role-policy';
import {
    createPrivateFleetProofSignedUrlMap,
    getPrivateFleetProofDirectUrl,
    getPrivateFleetProofStoragePath,
    resolvePrivateFleetProofDisplayUrl,
} from '@/lib/server/private-fleet-proofs';
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
const PRIVATE_SETTLEMENT_TYPES = ['expense_advance', 'company_expense', 'freight_payment', 'trip_pay'];

function resolveTripSettlementStatus(allocations: Array<Record<string, any>>) {
    if (!allocations.length) return 'not_applicable';

    const statuses = allocations.map((allocation) => String(allocation.external_payment_status || allocation.status || 'pending_external_pay'));

    if (statuses.every((status) => status === 'paid_external')) return 'paid_external';
    if (statuses.some((status) => status === 'proof_uploaded')) return 'proof_uploaded';
    if (statuses.every((status) => status === 'released_to_wallet')) return 'paid_external';
    if (statuses.some((status) => status === 'rejected')) return 'rejected';
    if (statuses.every((status) => status === 'cancelled')) return 'cancelled';
    return 'pending_external_pay';
}

function deriveCompensationMode(offer: Record<string, any>, allocations: Array<Record<string, any>>) {
    if (offer.compensation_mode) return offer.compensation_mode;

    const hasFreight = allocations.some((allocation) => ['freight_payment', 'trip_pay'].includes(allocation.allocation_type));
    const hasExpenses = allocations.some((allocation) => ['expense_advance', 'company_expense'].includes(allocation.allocation_type));

    if (hasFreight && hasExpenses) return 'trip_pay_plus_expenses';
    if (hasFreight) return 'trip_pay';
    if (hasExpenses) return 'expenses_only';
    return 'salary_no_trip_pay';
}

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
    const effectiveRole = resolveEffectiveBusinessRole(profile, businessAccess);
    const roleCapabilities = getBusinessPolicyCapabilities(effectiveRole);
    const canManagePayroll = roleCapabilities.canManagePrivateFleetMoney;
    const canViewPrivateFleet = roleCapabilities.canViewPrivateFleet;

    if (!businessId || !canViewPrivateFleet) {
        return apiError('Solo owner/admin/contabilidad u operacion puede ver esta flota privada', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_FORBIDDEN',
        });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [membersResponse, invitationsResponse, initialOffersResponse, allocationsResponse, payrollItemsResponse, snapshot] = await Promise.all([
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
            .select('id, assigned_trucker_id, status, is_private_fleet, private_fleet_assignment_status, created_at, compensation_mode, freight_payment_amount, expense_allowance_amount, total_amount, cargo_description, origin_warehouse_id, destination_warehouse_id')
            .eq('business_id', businessId)
            .eq('is_private_fleet', true),
        supabaseAdmin
            .from('trip_financial_allocations')
            .select('id, offer_id, trucker_id, allocation_type, amount, status, external_payment_status, external_paid_at, external_payment_method, external_payment_reference, external_payment_proof_url, external_payment_proof_storage_path, external_payment_note, created_at, released_at')
            .eq('business_id', businessId)
            .gte('created_at', monthStart.toISOString())
            .order('created_at', { ascending: false }),
        supabaseAdmin
            .from('private_fleet_payroll_items')
            .select('trucker_id, amount, status, created_at, released_at')
            .eq('business_id', businessId)
            .gte('created_at', monthStart.toISOString()),
        getBusinessPlanSnapshot(supabaseAdmin, businessId),
    ]) as any;

    let offersResponse = initialOffersResponse;
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
    const allocationIds = allocations.map((allocation) => allocation.id).filter(Boolean);
    const { data: allocationProofRows } = allocationIds.length
        ? await supabaseAdmin
            .from('private_fleet_payment_proofs')
            .select('id, allocation_id, proof_url, storage_path, created_at')
            .in('allocation_id', allocationIds)
            .order('created_at', { ascending: false })
        : { data: [] as Array<Record<string, any>> };
    const visibleProofByAllocationId = new Map<string, Record<string, any>>();

    (allocationProofRows || []).forEach((proof) => {
        const allocationId = proof.allocation_id;
        if (!allocationId || visibleProofByAllocationId.has(allocationId)) return;
        if (getPrivateFleetProofDirectUrl(proof) || getPrivateFleetProofStoragePath(proof)) {
            visibleProofByAllocationId.set(allocationId, proof);
        }
    });

    const proofSignedUrlByPath = await createPrivateFleetProofSignedUrlMap(
        supabaseAdmin,
        [
            ...allocations.map((allocation) => allocation.external_payment_proof_storage_path),
            ...(allocationProofRows || []).map((proof) => proof.storage_path),
        ]
    );

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

    const expenseAssignedByTruckerId = new Map<string, number>();
    const expenseReleasedByTruckerId = new Map<string, number>();
    const expenseProofUploadedByTruckerId = new Map<string, number>();
    const freightHeldByTruckerId = new Map<string, number>();
    const freightReleasedByTruckerId = new Map<string, number>();
    const freightProofUploadedByTruckerId = new Map<string, number>();
    const payrollByTruckerId = new Map<string, number>();
    let expenseAssignedThisMonthCop = 0;
    let expenseReleasedThisMonthCop = 0;
    let expenseProofUploadedThisMonthCop = 0;
    let expensePaidExternalThisMonthCop = 0;
    let freightHeldThisMonthCop = 0;
    let freightReleasedThisMonthCop = 0;
    let freightProofUploadedThisMonthCop = 0;
    let freightPaidExternalThisMonthCop = 0;
    let payrollReleasedThisMonthCop = 0;

    allocations.forEach((allocation) => {
        const amount = Number(allocation.amount || 0);
        const truckerId = allocation.trucker_id;
        const status = String(allocation.status || '');

        if (['expense_advance', 'company_expense'].includes(allocation.allocation_type)) {
            if (!['refunded', 'cancelled', 'rejected'].includes(status)) {
                expenseAssignedThisMonthCop += amount;
                expenseAssignedByTruckerId.set(truckerId, (expenseAssignedByTruckerId.get(truckerId) || 0) + amount);
            }

            if (status === 'proof_uploaded') {
                expenseProofUploadedThisMonthCop += amount;
                expenseProofUploadedByTruckerId.set(truckerId, (expenseProofUploadedByTruckerId.get(truckerId) || 0) + amount);
            }

            if (status === 'paid_external' || status === 'released_to_wallet') {
                if (status === 'paid_external') {
                    expensePaidExternalThisMonthCop += amount;
                }
                expenseReleasedThisMonthCop += amount;
                expenseReleasedByTruckerId.set(truckerId, (expenseReleasedByTruckerId.get(truckerId) || 0) + amount);
            }
        }

        if (['freight_payment', 'trip_pay'].includes(allocation.allocation_type)) {
            if (status === 'proof_uploaded') {
                freightProofUploadedThisMonthCop += amount;
                freightProofUploadedByTruckerId.set(truckerId, (freightProofUploadedByTruckerId.get(truckerId) || 0) + amount);
            }

            if (status === 'paid_external' || status === 'released_to_wallet') {
                if (status === 'paid_external') {
                    freightPaidExternalThisMonthCop += amount;
                }
                freightReleasedThisMonthCop += amount;
                freightReleasedByTruckerId.set(truckerId, (freightReleasedByTruckerId.get(truckerId) || 0) + amount);
            } else if (['held_in_custody', 'external_proof_pending', 'proof_uploaded'].includes(status)) {
                freightHeldThisMonthCop += amount;
                freightHeldByTruckerId.set(truckerId, (freightHeldByTruckerId.get(truckerId) || 0) + amount);
            }
        }
    });

    payrollItems.forEach((item) => {
        if (!['released_to_wallet', 'paid_external'].includes(item.status)) {
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
        totalExpenseAdvancedCop: expenseReleasedByTruckerId.get(member.trucker_id) || 0,
        totalExpenseAssignedCop: expenseAssignedByTruckerId.get(member.trucker_id) || 0,
        totalExpenseReleasedCop: expenseReleasedByTruckerId.get(member.trucker_id) || 0,
        totalExpenseProofUploadedCop: expenseProofUploadedByTruckerId.get(member.trucker_id) || 0,
        totalFreightHeldCop: freightHeldByTruckerId.get(member.trucker_id) || 0,
        totalFreightReleasedCop: freightReleasedByTruckerId.get(member.trucker_id) || 0,
        totalFreightProofUploadedCop: freightProofUploadedByTruckerId.get(member.trucker_id) || 0,
        totalPayrollReleasedCop: payrollByTruckerId.get(member.trucker_id) || 0,
    }));
    const memberByTruckerId = new Map(members.map((member) => [
        member.trucker_id,
        member as typeof member & {
            user?: {
                full_name?: string | null;
                email?: string | null;
            } | null;
        },
    ]));
    const privateAllocations = allocations
        .filter((allocation) => PRIVATE_SETTLEMENT_TYPES.includes(allocation.allocation_type))
        .map((allocation) => {
            const visibleProof = visibleProofByAllocationId.get(allocation.id) || null;
            const proofPointer = {
                external_payment_proof_url: allocation.external_payment_proof_url || visibleProof?.proof_url || null,
                external_payment_proof_storage_path: allocation.external_payment_proof_storage_path || visibleProof?.storage_path || null,
            };
            const member = memberByTruckerId.get(allocation.trucker_id) as {
                user?: {
                    full_name?: string | null;
                    email?: string | null;
                } | null;
            } | undefined;
            return {
                ...allocation,
                ...proofPointer,
                external_payment_proof_signed_url: resolvePrivateFleetProofDisplayUrl(proofPointer, proofSignedUrlByPath),
                latest_proof_id: visibleProof?.id || null,
                amount: Number(allocation.amount || 0),
                truckerName: member?.user?.full_name || member?.user?.email || null,
            };
        });
    const allocationsByOfferId = new Map<string, Array<Record<string, any>>>();
    privateAllocations.forEach((allocation) => {
        const current = allocationsByOfferId.get(allocation.offer_id) || [];
        current.push(allocation);
        allocationsByOfferId.set(allocation.offer_id, current);
    });
    const privateTripGroups = offers
        .filter((offer) => {
            const createdAt = offer.created_at ? new Date(offer.created_at).getTime() : 0;
            return createdAt >= monthStart.getTime();
        })
        .map((offer) => {
            const offerAllocations = allocationsByOfferId.get(offer.id) || [];
            const payableAllocations = offerAllocations.filter((allocation) => Number(allocation.amount || 0) > 0);
            const truckerId = offer.assigned_trucker_id || offerAllocations[0]?.trucker_id || null;
            const member = truckerId ? memberByTruckerId.get(truckerId) as {
                user?: {
                    full_name?: string | null;
                    email?: string | null;
                } | null;
            } | undefined : undefined;
            const freightCop = payableAllocations
                .filter((allocation) => ['freight_payment', 'trip_pay'].includes(allocation.allocation_type))
                .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
            const expenseCop = payableAllocations
                .filter((allocation) => ['expense_advance', 'company_expense'].includes(allocation.allocation_type))
                .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);

            return {
                id: offer.id,
                offer_id: offer.id,
                trucker_id: truckerId,
                truckerName: member?.user?.full_name || member?.user?.email || null,
                compensation_mode: deriveCompensationMode(offer, payableAllocations),
                status: offer.status,
                external_payment_status: resolveTripSettlementStatus(payableAllocations),
                created_at: offer.created_at,
                cargo_description: offer.cargo_description || null,
                has_warehouse: Boolean(offer.origin_warehouse_id || offer.destination_warehouse_id),
                freightCop,
                expenseCop,
                totalCop: freightCop + expenseCop,
                allocations: payableAllocations,
            };
        })
        .sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime());

    return apiSuccess({
        data: members,
        privateAllocations,
        privateTripGroups,
        invitations: invitationsResponse.data || [],
        subscription: snapshot.subscription,
        plans: snapshot.plans,
        limits: snapshot.limits,
        canManageFleet: roleCapabilities.canManagePrivateFleetDrivers,
        canManagePayroll,
        role: effectiveRole,
        roleCapabilities,
        payrollSchemaReady,
        invitationHours: DEFAULT_INVITATION_HOURS,
        stats: {
            activeDrivers: snapshot.limits.activePrivateFleetDrivers,
            activeTrips,
            privateTripsCompleted,
            expenseAdvancedThisMonthCop: expenseReleasedThisMonthCop,
            expenseAssignedThisMonthCop,
            expenseReleasedThisMonthCop,
            expenseProofUploadedThisMonthCop,
            expensePaidExternalThisMonthCop,
            freightHeldThisMonthCop,
            freightReleasedThisMonthCop,
            freightProofUploadedThisMonthCop,
            freightPaidExternalThisMonthCop,
            freightSettledThisMonthCop: freightReleasedThisMonthCop,
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
    const effectiveRole = resolveEffectiveBusinessRole(profile, businessAccess);
    const roleCapabilities = getBusinessPolicyCapabilities(effectiveRole);

    if (!businessAccess.businessId && profile?.user_type !== 'admin') {
        return apiError('Business access required', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_INVITE_BUSINESS_REQUIRED',
        });
    }

    if (!roleCapabilities.canManagePrivateFleetDrivers) {
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

