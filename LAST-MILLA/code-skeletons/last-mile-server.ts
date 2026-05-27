import type { SupabaseClient } from '@supabase/supabase-js';
import { getBusinessRoleCapabilities, type BusinessRole } from '@/lib/business-roles';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

type PlanLike = { feature_matrix?: Record<string, unknown> | null } | null;
type SubscriptionLike = { plan?: PlanLike } | null;

interface LastMileAccessInput {
  role: BusinessRole;
  isOwner: boolean;
  isAdmin: boolean;
  subscription: SubscriptionLike;
}

export function getMonthRange(monthParam?: string | null) {
  const base = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? new Date(`${monthParam}-01T00:00:00.000Z`)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export function resolveLastMileAccess(input: LastMileAccessInput) {
  const caps = getBusinessRoleCapabilities(input.role);
  const matrix = input.subscription?.plan?.feature_matrix || {};
  const enabled = Boolean(matrix.last_mile_margin_control) || input.isAdmin;
  const readOnly = !enabled && Boolean(matrix.last_mile_margin_control_read_only);
  const canViewFinance = input.isAdmin || caps.canViewFinance;
  const canManageContracts = enabled && (input.isAdmin || input.isOwner || input.role === 'manager');
  const canRunSync = enabled && (input.isAdmin || input.isOwner || input.role === 'manager' || input.role === 'finance_accountant');
  const canResolveRecommendations = enabled && (
    input.isAdmin || input.isOwner || ['manager', 'ops_manager', 'dispatcher', 'finance_accountant'].includes(input.role)
  );
  return {
    enabled,
    readOnly,
    canViewFinance,
    canManageContracts,
    canRunSync,
    canResolveRecommendations,
    canExport: input.isAdmin || caps.canExportFinance || caps.canExportData,
  };
}

export function assertLastMileEnabled(access: ReturnType<typeof resolveLastMileAccess>) {
  if (!access.enabled && !access.readOnly) {
    const error = new Error('Control de margen está disponible en Enterprise.');
    (error as Error & { status?: number; code?: string }).status = 402;
    (error as Error & { status?: number; code?: string }).code = 'LAST_MILE_FEATURE_DISABLED';
    throw error;
  }
}

export function buildLaneKey(row: Record<string, unknown>) {
  const part = (value: unknown) => String(value || '*').trim().toLowerCase();
  return [
    `${part(row.origin_department)}:${part(row.origin_city)}:${part(row.origin_zone)}`,
    `${part(row.destination_department)}:${part(row.destination_city)}:${part(row.destination_zone)}`,
    part(row.vehicle_type),
    part(row.cargo_type),
    part(row.service_level || 'standard'),
  ].join('->');
}

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function maskMoney<T>(payload: T, canViewFinance: boolean): T {
  if (canViewFinance) return payload;
  const hidden = new Set([
    'totalAgreedCostCop', 'totalExpectedCostCop', 'totalFinalCostCop', 'leakageCop',
    'avgOverrunPct', 'expected_saving_cop', 'expectedSavingCop', 'agreed_cost_cop',
    'expected_cost_cop', 'final_cost_cop', 'overrun_cop', 'overrun_pct',
  ]);
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, hidden.has(key) ? null : redact(entry)]));
  };
  return redact(payload) as T;
}

export async function getLastMileSummary(
  supabaseAdmin: AdminClient,
  businessId: string,
  options: { month?: string | null; access: ReturnType<typeof resolveLastMileAccess> }
) {
  assertLastMileEnabled(options.access);
  const { start, end } = getMonthRange(options.month);

  const [observationsRes, recommendationsRes, contractsRes] = await Promise.all([
    supabaseAdmin
      .from('last_mile_trip_cost_observations')
      .select('*, carrier:last_mile_carriers(id, display_name, carrier_type), lane:last_mile_route_lanes(id, lane_key, origin_city, destination_city)')
      .eq('business_id', businessId)
      .gte('observed_at', start.toISOString())
      .lte('observed_at', end.toISOString()),
    supabaseAdmin
      .from('last_mile_renegotiation_recommendations')
      .select('*, carrier:last_mile_carriers(id, display_name, carrier_type), lane:last_mile_route_lanes(id, lane_key, origin_city, destination_city)')
      .eq('business_id', businessId)
      .in('status', ['open', 'acknowledged', 'in_negotiation'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('last_mile_contracts')
      .select('id, status, ends_at')
      .eq('business_id', businessId),
  ]);

  if (observationsRes.error) throw observationsRes.error;
  if (recommendationsRes.error) throw recommendationsRes.error;
  if (contractsRes.error) throw contractsRes.error;

  const observations = observationsRes.data || [];
  const recommendations = recommendationsRes.data || [];
  const contracts = contractsRes.data || [];
  const activeContracts = contracts.filter((row: any) => row.status === 'active');
  const now = Date.now();
  const in30d = now + 30 * 86400000;

  const metrics = {
    totalTrips: observations.length,
    observedTrips: observations.length,
    totalAgreedCostCop: observations.reduce((sum: number, row: any) => sum + number(row.agreed_cost_cop), 0),
    totalExpectedCostCop: observations.reduce((sum: number, row: any) => sum + number(row.expected_cost_cop), 0),
    totalFinalCostCop: observations.reduce((sum: number, row: any) => sum + number(row.final_cost_cop), 0),
    leakageCop: observations.reduce((sum: number, row: any) => sum + Math.max(0, number(row.overrun_cop)), 0),
    avgOverrunPct: observations.length ? observations.reduce((sum: number, row: any) => sum + number(row.overrun_pct), 0) / observations.length : 0,
    evidenceCompleteRate: observations.length ? observations.filter((row: any) => number(row.evidence_score) >= 80).length / observations.length * 100 : 0,
    openRecommendations: recommendations.length,
    criticalRecommendations: recommendations.filter((row: any) => row.severity === 'critical').length,
    activeContracts: activeContracts.length,
    expiringContracts30d: activeContracts.filter((row: any) => row.ends_at && new Date(row.ends_at).getTime() <= in30d).length,
  };

  const routes = new Map<string, any>();
  const carriers = new Map<string, any>();
  for (const row of observations as any[]) {
    const laneKey = row.lane_id || row.lane?.lane_key || 'sin-ruta';
    const route = routes.get(laneKey) || { laneId: row.lane_id, label: row.lane?.lane_key || 'Sin ruta', trips: 0, leakageCop: 0, avgOverrunPct: 0 };
    route.trips += 1;
    route.leakageCop += Math.max(0, number(row.overrun_cop));
    route.avgOverrunPct += number(row.overrun_pct);
    routes.set(laneKey, route);

    const carrierKey = row.carrier_id || 'sin-proveedor';
    const carrier = carriers.get(carrierKey) || { carrierId: row.carrier_id, name: row.carrier?.display_name || 'Sin proveedor', type: row.carrier?.carrier_type || 'unresolved', trips: 0, leakageCop: 0, score: 0 };
    carrier.trips += 1;
    carrier.leakageCop += Math.max(0, number(row.overrun_cop));
    carrier.score += number(row.provider_score);
    carriers.set(carrierKey, carrier);
  }

  const topRoutes = [...routes.values()].map((row) => ({ ...row, avgOverrunPct: row.trips ? row.avgOverrunPct / row.trips : 0 })).sort((a, b) => b.leakageCop - a.leakageCop).slice(0, 10);
  const topCarriers = [...carriers.values()].map((row) => ({ ...row, score: row.trips ? row.score / row.trips : 0 })).sort((a, b) => b.leakageCop - a.leakageCop).slice(0, 10);

  return maskMoney({
    period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    access: options.access,
    metrics,
    topRoutes,
    topCarriers,
    recommendations,
  }, options.access.canViewFinance);
}

export async function listLastMileContracts(supabaseAdmin: AdminClient, businessId: string, filters: { status?: string | null; carrierId?: string | null; laneId?: string | null }) {
  let query = supabaseAdmin
    .from('last_mile_contracts')
    .select('*, carrier:last_mile_carriers(*), lane:last_mile_route_lanes(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.carrierId) query = query.eq('carrier_id', filters.carrierId);
  if (filters.laneId) query = query.eq('lane_id', filters.laneId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createLastMileContract(supabaseAdmin: AdminClient, businessId: string, actorId: string, payload: Record<string, unknown>) {
  const insertPayload = {
    business_id: businessId,
    carrier_id: String(payload.carrierId || ''),
    lane_id: payload.laneId || null,
    source_kind: payload.sourceKind || 'manual',
    pricing_model: payload.pricingModel || 'per_trip',
    base_rate_cop: number(payload.baseRateCop),
    per_km_rate_cop: number(payload.perKmRateCop),
    per_kg_rate_cop: number(payload.perKgRateCop),
    minimum_rate_cop: number(payload.minimumRateCop),
    maximum_rate_cop: payload.maximumRateCop === null || payload.maximumRateCop === undefined ? null : number(payload.maximumRateCop),
    fuel_surcharge_cop: number(payload.fuelSurchargeCop),
    other_surcharge_cop: number(payload.otherSurchargeCop),
    payment_terms_days: Math.max(0, Number(payload.paymentTermsDays || 30)),
    starts_at: payload.startsAt,
    ends_at: payload.endsAt || null,
    evidence_required: payload.evidenceRequired || undefined,
    sla_rules: payload.slaRules || {},
    penalty_rules: payload.penaltyRules || {},
    notes: payload.notes || null,
    created_by: actorId,
    updated_by: actorId,
  };

  if (!insertPayload.carrier_id || !insertPayload.starts_at) {
    const error = new Error('carrierId y startsAt son requeridos.');
    (error as Error & { status?: number; code?: string }).status = 400;
    (error as Error & { status?: number; code?: string }).code = 'LAST_MILE_CONTRACT_VALIDATION_ERROR';
    throw error;
  }

  const { data: contract, error } = await supabaseAdmin
    .from('last_mile_contracts')
    .insert(insertPayload)
    .select('*, carrier:last_mile_carriers(*), lane:last_mile_route_lanes(*)')
    .single();
  if (error) throw error;

  await supabaseAdmin.from('last_mile_contract_events').insert({
    business_id: businessId,
    contract_id: contract.id,
    event_type: 'created',
    actor_id: actorId,
    new_snapshot: contract,
  });

  return contract;
}

export function computeExpectedCost(contract: any | null, offer: Record<string, unknown>) {
  if (!contract) return number(offer.total_amount || offer.net_amount);
  let expected = number(contract.base_rate_cop) + number(contract.fuel_surcharge_cop) + number(contract.other_surcharge_cop);
  if (contract.pricing_model === 'per_km') expected += number(offer.distance_km) * number(contract.per_km_rate_cop);
  if (contract.pricing_model === 'per_kg') expected += number(offer.weight_kg) * number(contract.per_kg_rate_cop);
  if (contract.pricing_model === 'hybrid') expected += number(offer.distance_km) * number(contract.per_km_rate_cop) + number(offer.weight_kg) * number(contract.per_kg_rate_cop);
  if (number(contract.minimum_rate_cop) > 0) expected = Math.max(expected, number(contract.minimum_rate_cop));
  if (contract.maximum_rate_cop !== null && contract.maximum_rate_cop !== undefined) expected = Math.min(expected, number(contract.maximum_rate_cop));
  return expected;
}

// Implementation note:
// syncLastMileObservations should:
// 1. create analysis_run queued/running;
// 2. read cargo_offers for period/business;
// 3. resolve/create carrier and lane;
// 4. find active contract;
// 5. upsert last_mile_trip_cost_observations by business_id + offer_id;
// 6. regenerate scorecards and recommendations;
// 7. mark run succeeded/failed.
