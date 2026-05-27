import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { isBusinessFleetMembersTableMissing } from '@/lib/server/warehouses';

const ACTIVE_PRIVATE_TRIP_STATUSES = new Set(['assigned', 'reserved', 'in_progress']);
const ACCEPTED_PRIVATE_TRIP_STATUSES = new Set(['reserved', 'in_progress', 'completed']);
const PRIVATE_COMPENSATION_MODES = new Set([
    'salary_no_trip_pay',
    'trip_pay',
    'expenses_only',
    'trip_pay_plus_expenses',
]);

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

function resolveAssignmentStatus(trip: Record<string, unknown>) {
    const rawStatus = String(trip.private_fleet_assignment_status || '');

    if (rawStatus === 'accepted' || rawStatus === 'rejected' || rawStatus === 'pending') {
        return rawStatus;
    }

    if (
        trip.private_fleet_confirmed_at
        || trip.pickup_pin
        || trip.delivery_pin
        || ACCEPTED_PRIVATE_TRIP_STATUSES.has(String(trip.status || ''))
    ) {
        return 'accepted';
    }

    return 'pending';
}

function resolveNextAction(trip: Record<string, unknown>, assignmentStatus: string) {
    const status = String(trip.status || '');

    if (assignmentStatus === 'rejected') return 'returned_to_company';
    if (assignmentStatus === 'pending' && status === 'assigned') return 'accept_or_reject';
    if (trip.delivery_verified_at || status === 'completed') return 'completed';
    if (trip.pickup_verified_at || status === 'in_progress') return 'delivery';
    if (
        status === 'reserved'
        || trip.pickup_pin
        || trip.delivery_pin
        || trip.private_fleet_confirmed_at
        || assignmentStatus === 'accepted'
    ) return 'pickup';

    return 'open_trip';
}

function resolvePrivateTripCompensation(trip: Record<string, unknown>) {
    const expenseAmount = Number(trip.expense_allowance_amount || 0);
    const storedFreightAmount = Number(trip.freight_payment_amount || 0);
    const legacyFreightAmount = Number(trip.total_amount || 0);
    const rawMode = typeof trip.compensation_mode === 'string' ? trip.compensation_mode : null;
    const explicitMode = rawMode && PRIVATE_COMPENSATION_MODES.has(rawMode) ? rawMode : null;
    const shouldUseLegacyFreight = !explicitMode || explicitMode === 'trip_pay' || explicitMode === 'trip_pay_plus_expenses';
    const freightAmount = storedFreightAmount > 0
        ? storedFreightAmount
        : shouldUseLegacyFreight
            ? legacyFreightAmount
            : 0;
    const mode = explicitMode
        ? explicitMode
        : freightAmount > 0 && expenseAmount > 0
            ? 'trip_pay_plus_expenses'
            : expenseAmount > 0
                ? 'expenses_only'
                : freightAmount > 0
                    ? 'trip_pay'
                    : 'salary_no_trip_pay';

    if (mode === 'expenses_only') {
        return {
            mode,
            freightAmount,
            expenseAmount,
            visiblePrimaryAmount: expenseAmount,
            primaryLabel: 'Viaticos',
            summaryLabel: 'Solo viaticos',
        };
    }

    if (mode === 'trip_pay_plus_expenses') {
        return {
            mode,
            freightAmount,
            expenseAmount,
            visiblePrimaryAmount: freightAmount,
            primaryLabel: 'Pago ruta',
            summaryLabel: 'Pago ruta + viaticos',
        };
    }

    if (mode === 'trip_pay') {
        return {
            mode,
            freightAmount,
            expenseAmount,
            visiblePrimaryAmount: freightAmount,
            primaryLabel: 'Pago ruta',
            summaryLabel: 'Pago por ruta',
        };
    }

    return {
        mode,
        freightAmount,
        expenseAmount,
        visiblePrimaryAmount: 0,
        primaryLabel: 'Nomina mensual',
        summaryLabel: 'Nomina mensual separada',
    };
}

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker' && profile?.user_type !== 'admin') {
        return apiSuccess({
            isPrivateFleetDriver: false,
            membershipId: null,
            businessId: null,
            businessName: null,
            status: null,
            vehiclePlate: null,
            internalDriverId: null,
            schemaReady: true,
            stats: {
                activeTrips: 0,
                privateTripsCompleted: 0,
                payrollReleasedThisMonthCop: 0,
                payrollPendingCop: 0,
            },
            assignedTrips: [],
        }, {
            requestId,
            code: 'PRIVATE_FLEET_DRIVER_CONTEXT_NOT_TRUCKER',
        });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
        .from('business_fleet_members')
        .select('id, business_id, trucker_id, status, vehicle_plate, internal_driver_id, created_at, updated_at')
        .eq('trucker_id', authUser.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (membershipError) {
        if (isBusinessFleetMembersTableMissing(membershipError)) {
            return apiSuccess({
                isPrivateFleetDriver: false,
                membershipId: null,
                businessId: null,
                businessName: null,
                status: null,
                vehiclePlate: null,
                internalDriverId: null,
                schemaReady: false,
                stats: {
                    activeTrips: 0,
                    privateTripsCompleted: 0,
                    payrollReleasedThisMonthCop: 0,
                    payrollPendingCop: 0,
                },
                assignedTrips: [],
            }, {
                requestId,
                code: 'PRIVATE_FLEET_DRIVER_SCHEMA_MISSING',
            });
        }

        return apiError(membershipError.message || 'No se pudo cargar tu contexto de flota privada', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_DRIVER_CONTEXT_FAILED',
        });
    }

    if (!membership) {
        return apiSuccess({
            isPrivateFleetDriver: false,
            membershipId: null,
            businessId: null,
            businessName: null,
            status: null,
            vehiclePlate: null,
            internalDriverId: null,
            schemaReady: true,
            stats: {
                activeTrips: 0,
                privateTripsCompleted: 0,
                payrollReleasedThisMonthCop: 0,
                payrollPendingCop: 0,
            },
            assignedTrips: [],
        }, {
            requestId,
            code: 'PRIVATE_FLEET_DRIVER_CONTEXT_EMPTY',
        });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [businessProfileResponse, businessUserResponse, initialTripsResponse, payrollItemsResponse] = await Promise.all([
        supabaseAdmin
            .from('business_profiles')
            .select('company_name')
            .eq('user_id', membership.business_id)
            .maybeSingle(),
        supabaseAdmin
            .from('user_profiles')
            .select('full_name, email')
            .eq('id', membership.business_id)
            .maybeSingle(),
        supabaseAdmin
            .from('cargo_offers')
            .select(`
                id,
                status,
                cargo_type,
                cargo_description,
                origin_city,
                origin_department,
                origin_address,
                destination_city,
                destination_department,
                destination_address,
                pickup_date,
                pickup_time_start,
                pickup_time_end,
                delivery_date,
                delivery_time_start,
                delivery_time_end,
                total_amount,
                freight_payment_amount,
                expense_allowance_amount,
                compensation_mode,
                expenses_release_policy,
                private_fleet_notes,
                private_fleet_confirmed_at,
                pickup_verified_at,
                delivery_verified_at,
                pickup_pin,
                delivery_pin,
                private_fleet_assignment_status,
                private_fleet_rejected_at,
                private_fleet_rejection_reason,
                created_at
            `)
            .eq('business_id', membership.business_id)
            .eq('is_private_fleet', true)
            .or(`assigned_trucker_id.eq.${authUser.id},private_fleet_trucker_id.eq.${authUser.id}`)
            .order('created_at', { ascending: false })
            .limit(8),
        supabaseAdmin
            .from('private_fleet_payroll_items')
            .select('amount, status, created_at, released_at')
            .eq('business_id', membership.business_id)
            .eq('trucker_id', authUser.id)
            .gte('created_at', monthStart.toISOString()),
    ]) as any;

    let tripsResponse = initialTripsResponse;
    let assignmentSchemaReady = true;

    if (tripsResponse.error && isPrivateFleetAssignmentSchemaMissing(tripsResponse.error)) {
        assignmentSchemaReady = false;
        tripsResponse = await supabaseAdmin
            .from('cargo_offers')
            .select(`
                id,
                status,
                cargo_type,
                cargo_description,
                origin_city,
                origin_department,
                origin_address,
                destination_city,
                destination_department,
                destination_address,
                pickup_date,
                pickup_time_start,
                pickup_time_end,
                delivery_date,
                delivery_time_start,
                delivery_time_end,
                total_amount,
                freight_payment_amount,
                expense_allowance_amount,
                compensation_mode,
                expenses_release_policy,
                private_fleet_notes,
                private_fleet_confirmed_at,
                pickup_verified_at,
                delivery_verified_at,
                pickup_pin,
                delivery_pin,
                created_at
            `)
            .eq('business_id', membership.business_id)
            .eq('is_private_fleet', true)
            .or(`assigned_trucker_id.eq.${authUser.id},private_fleet_trucker_id.eq.${authUser.id}`)
            .order('created_at', { ascending: false })
            .limit(12);
    }

    if (businessProfileResponse.error) {
        return apiError(businessProfileResponse.error.message || 'No se pudo cargar la empresa de tu flota privada', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_BUSINESS_PROFILE_FAILED',
        });
    }

    if (businessUserResponse.error) {
        return apiError(businessUserResponse.error.message || 'No se pudo cargar la cuenta empresa de tu flota privada', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_BUSINESS_USER_FAILED',
        });
    }

    if (tripsResponse.error) {
        return apiError(tripsResponse.error.message || 'No se pudieron cargar tus viajes privados', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_TRIPS_FAILED',
        });
    }

    const payrollSchemaReady = !isPrivateFleetPayrollSchemaMissing(payrollItemsResponse.error);

    if (payrollItemsResponse.error && payrollSchemaReady) {
        return apiError(payrollItemsResponse.error.message || 'No se pudo cargar tu nomina privada', {
            requestId,
            status: 500,
            code: 'PRIVATE_FLEET_PAYROLL_FAILED',
        });
    }

    const trips = (tripsResponse.data || []) as Array<Record<string, unknown>>;
    const payrollItems = payrollItemsResponse.error ? [] : payrollItemsResponse.data || [];
    const businessName = businessProfileResponse.data?.company_name
        || businessUserResponse.data?.full_name
        || businessUserResponse.data?.email
        || 'Empresa KargaX';

    const activeTrips = trips.filter((trip) => {
        const assignmentStatus = resolveAssignmentStatus(trip);
        return assignmentStatus !== 'rejected' && ACTIVE_PRIVATE_TRIP_STATUSES.has(String(trip.status));
    }).length;
    const privateTripsCompleted = trips.filter((trip) => {
        const assignmentStatus = resolveAssignmentStatus(trip);
        return assignmentStatus !== 'rejected' && trip.status === 'completed';
    }).length;
    const payrollReleasedThisMonthCop = payrollItems
        .filter((item) => ['released_to_wallet', 'paid_external'].includes(item.status))
        .reduce((total, item) => total + Number(item.amount || 0), 0);
    const payrollPendingCop = payrollItems
        .filter((item) => ['pending', 'funded'].includes(String(item.status)))
        .reduce((total, item) => total + Number(item.amount || 0), 0);

    return apiSuccess({
        isPrivateFleetDriver: true,
        membershipId: membership.id,
        businessId: membership.business_id,
        businessName,
        status: membership.status,
        vehiclePlate: membership.vehicle_plate,
        internalDriverId: membership.internal_driver_id,
        schemaReady: payrollSchemaReady && assignmentSchemaReady,
        assignmentSchemaReady,
        stats: {
            activeTrips,
            privateTripsCompleted,
            payrollReleasedThisMonthCop,
            payrollPendingCop,
        },
        assignedTrips: trips.map((trip) => {
            const assignmentStatus = resolveAssignmentStatus(trip);
            const canDecide = assignmentStatus === 'pending' && trip.status === 'assigned';
            const compensation = resolvePrivateTripCompensation(trip);

            return {
                id: trip.id,
                status: trip.status,
                assignmentStatus,
                canAccept: canDecide,
                canReject: assignmentSchemaReady && canDecide,
                nextAction: resolveNextAction(trip, assignmentStatus),
                cargoType: trip.cargo_type,
                cargoDescription: trip.cargo_description,
                originCity: trip.origin_city,
                originDepartment: trip.origin_department,
                originAddress: trip.origin_address,
                destinationCity: trip.destination_city,
                destinationDepartment: trip.destination_department,
                destinationAddress: trip.destination_address,
                pickupDate: trip.pickup_date,
                pickupTimeStart: trip.pickup_time_start,
                pickupTimeEnd: trip.pickup_time_end,
                deliveryDate: trip.delivery_date,
                deliveryTimeStart: trip.delivery_time_start,
                deliveryTimeEnd: trip.delivery_time_end,
                totalAmount: Number(trip.total_amount || 0),
                freightPaymentAmount: compensation.freightAmount,
                expenseAllowanceAmount: compensation.expenseAmount,
                compensationMode: compensation.mode,
                expensesReleasePolicy: trip.expenses_release_policy || null,
                compensation,
                privateFleetNotes: trip.private_fleet_notes,
                rejectedAt: trip.private_fleet_rejected_at || null,
                rejectionReason: trip.private_fleet_rejection_reason || null,
            };
        }),
    }, {
        requestId,
        code: 'PRIVATE_FLEET_DRIVER_CONTEXT_LOADED',
    });
}

export async function PATCH(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker' && profile?.user_type !== 'admin') {
        return apiError('Solo transportadores pueden actualizar su perfil de flota privada', {
            requestId,
            status: 403,
            code: 'BUSINESS_FLEET_SELF_UPDATE_FORBIDDEN',
        });
    }

    const body = await request.json().catch(() => ({})) as {
        vehiclePlate?: string | null;
        internalDriverId?: string | null;
    };

    const updatePayload: Record<string, unknown> = {};

    if (body.vehiclePlate !== undefined) {
        updatePayload.vehicle_plate = body.vehiclePlate?.trim().toUpperCase() || null;
    }

    if (body.internalDriverId !== undefined) {
        updatePayload.internal_driver_id = body.internalDriverId?.trim() || null;
    }

    if (!Object.keys(updatePayload).length) {
        return apiError('No hay cambios validos para guardar', {
            requestId,
            status: 400,
            code: 'BUSINESS_FLEET_SELF_UPDATE_EMPTY',
        });
    }

    const { data, error } = await supabaseAdmin
        .from('business_fleet_members')
        .update(updatePayload)
        .eq('trucker_id', authUser.id)
        .eq('status', 'active')
        .select('id, trucker_id, vehicle_plate, internal_driver_id');

    if (error) {
        return apiError(error.message || 'No se pudo actualizar tu membresia privada', {
            requestId,
            status: 500,
            code: 'BUSINESS_FLEET_SELF_UPDATE_FAILED',
        });
    }

    return apiSuccess({
        updated: data?.length || 0,
        data: data || [],
    }, {
        requestId,
        code: 'BUSINESS_FLEET_SELF_UPDATED',
    });
}
