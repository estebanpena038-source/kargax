import type { SupabaseClient } from '@supabase/supabase-js';
import { buildLaneKey } from './access';
import { LastMileError, getSupabaseWriteErrorMessage } from './errors';
import type { LastMileContractPayload, LastMileContractPatch } from './schemas';
import type { LastMileAccess, LastMileContract } from '@/lib/last-mile/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;
type LastMileContractDraft = Partial<LastMileContractPayload> & {
    carrierType?: LastMileContractPayload['carrierType'];
    pricingModel?: LastMileContractPayload['pricingModel'];
    baseRateCop?: number;
    startsAt?: string;
};

function normalizeProviderKey(input: {
    carrierType?: string | null;
    providerKey?: string | null;
    profileUserId?: string | null;
    fleetMemberId?: string | null;
    providerName?: string | null;
}) {
    if (input.providerKey) {
        return input.providerKey.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 160);
    }

    if (input.fleetMemberId) return `fleet:${input.fleetMemberId}`;
    if (input.profileUserId) return `${input.carrierType || 'provider'}:${input.profileUserId}`;
    return `${input.carrierType || 'external_provider'}:${(input.providerName || 'proveedor').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96)}`;
}

function toContractPayload(payload: LastMileContractPayload | LastMileContractPatch, actorId: string) {
    const out: Record<string, unknown> = {};
    if ('sourceKind' in payload && payload.sourceKind !== undefined) out.source_kind = payload.sourceKind;
    if ('status' in payload && payload.status !== undefined) out.status = payload.status;
    if ('pricingModel' in payload && payload.pricingModel !== undefined) out.pricing_model = payload.pricingModel;
    if ('currencyCode' in payload && payload.currencyCode !== undefined) out.currency_code = payload.currencyCode;
    if ('baseRateCop' in payload && payload.baseRateCop !== undefined) out.base_rate_cop = payload.baseRateCop;
    if ('perKmRateCop' in payload && payload.perKmRateCop !== undefined) out.per_km_rate_cop = payload.perKmRateCop;
    if ('perKgRateCop' in payload && payload.perKgRateCop !== undefined) out.per_kg_rate_cop = payload.perKgRateCop;
    if ('minimumRateCop' in payload && payload.minimumRateCop !== undefined) out.minimum_rate_cop = payload.minimumRateCop;
    if ('maximumRateCop' in payload && payload.maximumRateCop !== undefined) out.maximum_rate_cop = payload.maximumRateCop;
    if ('fuelSurchargeCop' in payload && payload.fuelSurchargeCop !== undefined) out.fuel_surcharge_cop = payload.fuelSurchargeCop;
    if ('otherSurchargeCop' in payload && payload.otherSurchargeCop !== undefined) out.other_surcharge_cop = payload.otherSurchargeCop;
    if ('paymentTermsDays' in payload && payload.paymentTermsDays !== undefined) out.payment_terms_days = payload.paymentTermsDays;
    if ('evidenceRequired' in payload && payload.evidenceRequired !== undefined) out.evidence_required = payload.evidenceRequired;
    if ('slaRules' in payload && payload.slaRules !== undefined) out.sla_rules = payload.slaRules;
    if ('penaltyRules' in payload && payload.penaltyRules !== undefined) out.penalty_rules = payload.penaltyRules;
    if ('startsAt' in payload && payload.startsAt !== undefined) out.starts_at = payload.startsAt;
    if ('endsAt' in payload && payload.endsAt !== undefined) out.ends_at = payload.endsAt;
    if ('notes' in payload && payload.notes !== undefined) out.notes = payload.notes;
    out.updated_by = actorId;
    return out;
}

function isRateChange(before: Record<string, unknown>, after: Record<string, unknown>) {
    const fields = [
        'pricing_model',
        'base_rate_cop',
        'per_km_rate_cop',
        'per_kg_rate_cop',
        'minimum_rate_cop',
        'maximum_rate_cop',
        'fuel_surcharge_cop',
        'other_surcharge_cop',
    ];
    return fields.some((field) => field in after && String(before[field] ?? '') !== String(after[field] ?? ''));
}

function contractSelect() {
    return `
        *,
        carrier:last_mile_carriers(*),
        lane:last_mile_route_lanes(*)
    `;
}

export async function listLastMileContracts(
    supabaseAdmin: AdminClient,
    businessId: string,
    filters: { status?: string | null; carrierId?: string | null; laneId?: string | null } = {}
): Promise<LastMileContract[]> {
    let query = supabaseAdmin
        .from('last_mile_contracts')
        .select(contractSelect())
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.carrierId) query = query.eq('carrier_id', filters.carrierId);
    if (filters.laneId) query = query.eq('lane_id', filters.laneId);

    const { data, error } = await query;
    if (error) {
        throw new LastMileError(error.message || 'No se pudieron cargar contratos de margen', {
            status: 500,
            code: 'LAST_MILE_CONTRACTS_FAILED',
        });
    }

    return (data || []) as unknown as LastMileContract[];
}

export async function getLastMileContract(
    supabaseAdmin: AdminClient,
    businessId: string,
    contractId: string
) {
    const { data, error } = await supabaseAdmin
        .from('last_mile_contracts')
        .select(contractSelect())
        .eq('business_id', businessId)
        .eq('id', contractId)
        .maybeSingle();

    if (error) {
        throw new LastMileError(error.message || 'No se pudo cargar contrato de margen', {
            status: 500,
            code: 'LAST_MILE_CONTRACT_LOAD_FAILED',
        });
    }

    if (!data) {
        throw new LastMileError('Contrato de margen no encontrado', {
            status: 404,
            code: 'LAST_MILE_CONTRACT_NOT_FOUND',
        });
    }

    return data as unknown as LastMileContract;
}

async function ensureActiveContractLimit(supabaseAdmin: AdminClient, businessId: string, access: LastMileAccess) {
    if (access.activeContractLimit === null || access.activeContractLimit <= 0) {
        return;
    }

    const { count, error } = await supabaseAdmin
        .from('last_mile_contracts')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'active');

    if (error) {
        throw new LastMileError(error.message || 'No se pudo validar limite de contratos', {
            status: 500,
            code: 'LAST_MILE_CONTRACT_LIMIT_CHECK_FAILED',
        });
    }

    if ((count || 0) >= access.activeContractLimit) {
        throw new LastMileError('Tu plan llego al limite de contratos activos de margen.', {
            status: 402,
            code: 'LAST_MILE_CONTRACT_LIMIT_REACHED',
            details: {
                featureKey: 'last_mile_contract_limit',
                currentUsage: count || 0,
                limitValue: access.activeContractLimit,
                recommendedPlan: 'enterprise',
                checkoutPath: '/planes',
            },
        });
    }
}

async function assertNoOverlappingActiveContract(
    supabaseAdmin: AdminClient,
    businessId: string,
    input: {
        carrierId: string;
        laneId: string | null;
        startsAt: string;
        endsAt?: string | null;
        excludeContractId?: string;
        status?: string;
    }
) {
    if (input.status && input.status !== 'active') return;

    const { data, error } = await supabaseAdmin
        .from('last_mile_contracts')
        .select('id, starts_at, ends_at, carrier_id, lane_id')
        .eq('business_id', businessId)
        .eq('carrier_id', input.carrierId)
        .eq('status', 'active');

    if (error) {
        throw new LastMileError(error.message || 'No se pudo validar contrato activo', {
            status: 500,
            code: 'LAST_MILE_CONTRACT_OVERLAP_CHECK_FAILED',
        });
    }

    const nextStart = new Date(input.startsAt).getTime();
    const nextEnd = input.endsAt ? new Date(input.endsAt).getTime() : Number.POSITIVE_INFINITY;
    const overlap = (data || []).find((contract) => {
        if (contract.id === input.excludeContractId) return false;
        if ((contract.lane_id || null) !== (input.laneId || null)) return false;
        const currentStart = new Date(contract.starts_at).getTime();
        const currentEnd = contract.ends_at ? new Date(contract.ends_at).getTime() : Number.POSITIVE_INFINITY;
        return nextStart <= currentEnd && currentStart <= nextEnd;
    });

    if (overlap) {
        throw new LastMileError('Ya existe un contrato activo para este proveedor y ruta en la misma vigencia.', {
            status: 409,
            code: 'LAST_MILE_CONTRACT_OVERLAP',
        });
    }
}

export async function ensureLastMileCarrier(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string,
    payload: LastMileContractDraft
) {
    if (payload.carrierId) {
        const { data, error } = await supabaseAdmin
            .from('last_mile_carriers')
            .select('*')
            .eq('business_id', businessId)
            .eq('id', payload.carrierId)
            .maybeSingle();

        if (error || !data) {
            throw new LastMileError('Proveedor de ultima milla no encontrado para esta empresa.', {
                status: 404,
                code: 'LAST_MILE_CARRIER_NOT_FOUND',
            });
        }
        return data;
    }

    const carrierType = payload.carrierType || 'external_provider';
    const providerKey = normalizeProviderKey({
        carrierType,
        providerKey: payload.providerKey,
        profileUserId: payload.profileUserId,
        fleetMemberId: payload.fleetMemberId,
        providerName: payload.providerName,
    });

    const { data, error } = await supabaseAdmin
        .from('last_mile_carriers')
        .upsert({
            business_id: businessId,
            provider_key: providerKey,
            carrier_type: carrierType,
            profile_user_id: payload.profileUserId || null,
            fleet_member_id: payload.fleetMemberId || null,
            legal_name: payload.legalName || payload.providerName || null,
            display_name: payload.providerName || payload.legalName || `Proveedor ${providerKey.slice(0, 12)}`,
            contact_name: payload.contactName || null,
            contact_phone: payload.contactPhone || null,
            contact_email: payload.contactEmail || null,
            status: 'active',
            metadata: { source: 'contract_form' },
            created_by: actorId,
            updated_by: actorId,
        }, {
            onConflict: 'business_id,provider_key',
        })
        .select('*')
        .single();

    if (error || !data) {
        throw new LastMileError(getSupabaseWriteErrorMessage(error), {
            status: 500,
            code: 'LAST_MILE_CARRIER_SAVE_FAILED',
        });
    }

    return data;
}

export async function ensureLastMileLane(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string,
    payload: LastMileContractDraft
) {
    if (payload.laneId) {
        const { data, error } = await supabaseAdmin
            .from('last_mile_route_lanes')
            .select('*')
            .eq('business_id', businessId)
            .eq('id', payload.laneId)
            .maybeSingle();

        if (error || !data) {
            throw new LastMileError('Ruta de margen no encontrada para esta empresa.', {
                status: 404,
                code: 'LAST_MILE_LANE_NOT_FOUND',
            });
        }
        return data;
    }

    if (!payload.originCity && !payload.destinationCity && !payload.originWarehouseId && !payload.destinationWarehouseId) {
        return null;
    }

    const laneKey = buildLaneKey(payload);
    const { data, error } = await supabaseAdmin
        .from('last_mile_route_lanes')
        .upsert({
            business_id: businessId,
            lane_key: laneKey,
            origin_department: payload.originDepartment || null,
            origin_city: payload.originCity || null,
            origin_zone: payload.originZone || null,
            origin_warehouse_id: payload.originWarehouseId || null,
            destination_department: payload.destinationDepartment || null,
            destination_city: payload.destinationCity || null,
            destination_zone: payload.destinationZone || null,
            destination_warehouse_id: payload.destinationWarehouseId || null,
            vehicle_type: payload.vehicleType || null,
            cargo_type: payload.cargoType || null,
            service_level: payload.serviceLevel || 'standard',
            status: 'active',
            created_by: actorId,
            updated_by: actorId,
        }, {
            onConflict: 'business_id,lane_key',
        })
        .select('*')
        .single();

    if (error || !data) {
        throw new LastMileError(getSupabaseWriteErrorMessage(error), {
            status: 500,
            code: 'LAST_MILE_LANE_SAVE_FAILED',
        });
    }

    return data;
}

export async function createLastMileContract(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string,
    access: LastMileAccess,
    payload: LastMileContractPayload
) {
    if (payload.status === 'active') {
        await ensureActiveContractLimit(supabaseAdmin, businessId, access);
    }

    const carrier = await ensureLastMileCarrier(supabaseAdmin, businessId, actorId, payload);
    const lane = await ensureLastMileLane(supabaseAdmin, businessId, actorId, payload);

    await assertNoOverlappingActiveContract(supabaseAdmin, businessId, {
        carrierId: carrier.id,
        laneId: lane?.id || null,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        status: payload.status,
    });

    const insertPayload = {
        business_id: businessId,
        carrier_id: carrier.id,
        lane_id: lane?.id || null,
        ...toContractPayload(payload, actorId),
        created_by: actorId,
    };

    const { data, error } = await supabaseAdmin
        .from('last_mile_contracts')
        .insert(insertPayload)
        .select(contractSelect())
        .single();

    if (error || !data) {
        throw new LastMileError(getSupabaseWriteErrorMessage(error), {
            status: 500,
            code: 'LAST_MILE_CONTRACT_CREATE_FAILED',
        });
    }

    await supabaseAdmin.from('last_mile_contract_events').insert({
        business_id: businessId,
        contract_id: (data as unknown as Record<string, unknown>).id,
        event_type: (data as unknown as Record<string, unknown>).status === 'active' ? 'activated' : 'created',
        actor_id: actorId,
        reason: 'Contrato creado desde Control de margen',
        new_snapshot: data,
    });

    return data as unknown as LastMileContract;
}

export async function updateLastMileContract(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string,
    contractId: string,
    payload: LastMileContractPatch
) {
    const current = await getLastMileContract(supabaseAdmin, businessId, contractId);
    const updatePayload = toContractPayload(payload, actorId);

    if (payload.status === 'active' || current.status === 'active') {
        await assertNoOverlappingActiveContract(supabaseAdmin, businessId, {
            carrierId: current.carrier_id,
            laneId: current.lane_id,
            startsAt: String(updatePayload.starts_at || current.starts_at),
            endsAt: (updatePayload.ends_at as string | null | undefined) ?? current.ends_at,
            excludeContractId: current.id,
            status: String(updatePayload.status || current.status),
        });
    }

    if (!Object.keys(updatePayload).length) {
        return current;
    }

    const { data, error } = await supabaseAdmin
        .from('last_mile_contracts')
        .update(updatePayload)
        .eq('business_id', businessId)
        .eq('id', contractId)
        .select(contractSelect())
        .single();

    if (error || !data) {
        throw new LastMileError(getSupabaseWriteErrorMessage(error), {
            status: 500,
            code: 'LAST_MILE_CONTRACT_UPDATE_FAILED',
        });
    }

    const eventType = isRateChange(current as unknown as Record<string, unknown>, updatePayload)
        ? 'rate_changed'
        : updatePayload.status === 'active'
            ? 'activated'
            : updatePayload.status === 'paused'
                ? 'paused'
                : updatePayload.status === 'expired'
                    ? 'expired'
                    : 'manual_note';

    await supabaseAdmin.from('last_mile_contract_events').insert({
        business_id: businessId,
        contract_id: contractId,
        event_type: eventType,
        actor_id: actorId,
        reason: payload.notes || 'Contrato actualizado desde Control de margen',
        old_snapshot: current,
        new_snapshot: data,
    });

    return data as unknown as LastMileContract;
}

export async function archiveLastMileContract(
    supabaseAdmin: AdminClient,
    businessId: string,
    actorId: string,
    contractId: string
) {
    return updateLastMileContract(supabaseAdmin, businessId, actorId, contractId, {
        status: 'superseded',
        notes: 'Archivado desde Control de margen',
    });
}

export async function selectBestContractForOffer(
    supabaseAdmin: AdminClient,
    businessId: string,
    carrierId: string | null,
    laneId: string | null,
    dateValue: string
) {
    if (!carrierId) return null;

    const { data, error } = await supabaseAdmin
        .from('last_mile_contracts')
        .select('*')
        .eq('business_id', businessId)
        .eq('carrier_id', carrierId)
        .eq('status', 'active')
        .lte('starts_at', dateValue)
        .order('lane_id', { ascending: false })
        .order('starts_at', { ascending: false });

    if (error) {
        throw new LastMileError(error.message || 'No se pudo resolver contrato activo', {
            status: 500,
            code: 'LAST_MILE_CONTRACT_MATCH_FAILED',
        });
    }

    return (data || []).find((contract) => {
        if (contract.ends_at && contract.ends_at < dateValue) return false;
        return contract.lane_id === laneId || contract.lane_id === null;
    }) || null;
}
