import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    AdvanceAgingBucket,
    AdvancePortfolioCohort,
    AdvancePortfolioMetrics,
    AdvanceSummary,
    AdvanceExposureSnapshot,
    AdvancePolicySnapshot,
    EligibleAdvanceOffer,
    FuelAdvanceListItem,
    FuelAdvanceRepaymentItem,
    LendingSettingsSnapshot,
    LendingTreasurySnapshot,
} from '@/lib/advances/types';

type AdminClient = SupabaseClient<any, 'public', any>;

interface WalletRecord {
    id: string;
    user_id: string;
    available_balance: number;
    pending_balance: number;
    total_trips_completed: number;
}

type RawAdvanceRow = Record<string, any>;

function toNumber(value: unknown) {
    return Number(value || 0);
}

function toAdvanceAgingBucket(status: string, dueAt: string | null | undefined): AdvanceAgingBucket {
    if (status === 'written_off') {
        return 'written_off';
    }

    if (status === 'completed') {
        return 'completed';
    }

    if (status === 'requested') {
        return 'requested';
    }

    if (!dueAt) {
        return 'current';
    }

    const dueAtMs = new Date(dueAt).getTime();
    const nowMs = Date.now();

    if (Number.isNaN(dueAtMs) || dueAtMs >= nowMs) {
        return 'current';
    }

    const overdueDays = Math.max(1, Math.floor((nowMs - dueAtMs) / 86_400_000));

    if (overdueDays <= 7) {
        return 'overdue_1_7';
    }

    if (overdueDays <= 30) {
        return 'at_risk_8_30';
    }

    return 'write_off_candidate_31_plus';
}

function getOverdueDays(status: string, dueAt: string | null | undefined) {
    if (['requested', 'completed', 'written_off', 'rejected', 'cancelled'].includes(status) || !dueAt) {
        return 0;
    }

    const dueAtMs = new Date(dueAt).getTime();
    const nowMs = Date.now();

    if (Number.isNaN(dueAtMs) || dueAtMs >= nowMs) {
        return 0;
    }

    return Math.max(1, Math.floor((nowMs - dueAtMs) / 86_400_000));
}

function getCohortMonth(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizePolicySnapshot(value: unknown): AdvancePolicySnapshot | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const raw = value as Record<string, unknown>;

    return {
        policy_source: typeof raw.policy_source === 'string' ? raw.policy_source : 'global_lending_settings',
        monthly_interest_rate_percent: raw.monthly_interest_rate_percent == null ? undefined : toNumber(raw.monthly_interest_rate_percent),
        max_term_days: raw.max_term_days == null ? undefined : toNumber(raw.max_term_days),
        requested_amount_cap: raw.requested_amount_cap == null ? undefined : toNumber(raw.requested_amount_cap),
        decision: typeof raw.decision === 'string' ? raw.decision : undefined,
        max_single_advance_cop: raw.max_single_advance_cop == null ? undefined : toNumber(raw.max_single_advance_cop),
        max_business_exposure_cop: raw.max_business_exposure_cop == null ? undefined : toNumber(raw.max_business_exposure_cop),
        max_holding_exposure_cop: raw.max_holding_exposure_cop == null ? undefined : toNumber(raw.max_holding_exposure_cop),
        portfolio_deployment_limit_percent: raw.portfolio_deployment_limit_percent == null ? undefined : toNumber(raw.portfolio_deployment_limit_percent),
        approved_at: typeof raw.approved_at === 'string' ? raw.approved_at : undefined,
        approved_by: typeof raw.approved_by === 'string' ? raw.approved_by : undefined,
    };
}

function normalizeExposureSnapshot(value: unknown): AdvanceExposureSnapshot | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const raw = value as Record<string, unknown>;

    return {
        trucker: toNumber(raw.trucker),
        business: toNumber(raw.business),
        holding: toNumber(raw.holding),
        portfolio_deployment_percent: toNumber(raw.portfolio_deployment_percent),
        holding_account_id: typeof raw.holding_account_id === 'string' ? raw.holding_account_id : null,
    };
}

function normalizeEligibleOffer(item: Record<string, any>): EligibleAdvanceOffer {
    return {
        ...item,
        offer_id: String(item.offer_id || ''),
        subtotal: toNumber(item.subtotal),
        max_advance_amount: toNumber(item.max_advance_amount),
        monthly_interest_rate_percent: toNumber(item.monthly_interest_rate_percent),
        max_term_days: toNumber(item.max_term_days),
        eligible: Boolean(item.eligible),
        reason: typeof item.reason === 'string' ? item.reason : null,
        due_at: typeof item.due_at === 'string' ? item.due_at : new Date().toISOString(),
        origin_city: typeof item.origin_city === 'string' ? item.origin_city : '',
        destination_city: typeof item.destination_city === 'string' ? item.destination_city : '',
        cargo_type: typeof item.cargo_type === 'string' ? item.cargo_type : '',
        exposure_by_trucker: toNumber(item.exposure_by_trucker),
        exposure_by_business: toNumber(item.exposure_by_business),
        exposure_by_holding: toNumber(item.exposure_by_holding),
        portfolio_deployment_percent: toNumber(item.portfolio_deployment_percent),
        risk_band: ['low', 'medium', 'high', 'critical'].includes(item.risk_band) ? item.risk_band : 'medium',
        decision: ['manual_review', 'blocked', 'approved'].includes(item.decision) ? item.decision : 'manual_review',
        policy_source: typeof item.policy_source === 'string' ? item.policy_source : 'global_lending_settings',
    };
}

export function normalizeAdvanceRecord(item: RawAdvanceRow): FuelAdvanceListItem {
    const originOffer = Array.isArray(item.origin_offer) ? item.origin_offer[0] ?? null : item.origin_offer ?? null;
    const overdueDays = getOverdueDays(String(item.status || ''), item.due_at);
    const agingBucket = toAdvanceAgingBucket(String(item.status || ''), item.due_at);
    const exposureSnapshot = normalizeExposureSnapshot(item.exposure_snapshot);

    return {
        ...item,
        origin_offer: originOffer
            ? {
                ...originOffer,
                business_id: typeof originOffer.business_id === 'string' ? originOffer.business_id : null,
            }
            : null,
        principal_amount: toNumber(item.principal_amount),
        monthly_interest_rate_percent: toNumber(item.monthly_interest_rate_percent),
        term_days: toNumber(item.term_days),
        principal_outstanding: toNumber(item.principal_outstanding),
        interest_outstanding: toNumber(item.interest_outstanding),
        total_due_at_maturity: toNumber(item.total_due_at_maturity),
        risk_band: ['low', 'medium', 'high', 'critical'].includes(item.risk_band) ? item.risk_band : 'medium',
        policy_snapshot: normalizePolicySnapshot(item.policy_snapshot),
        exposure_snapshot: exposureSnapshot,
        overdue_days: overdueDays,
        aging_bucket: agingBucket,
        cohort_month: getCohortMonth(item.disbursed_at || item.created_at) || undefined,
        exposure_by_trucker: exposureSnapshot?.trucker ?? undefined,
        exposure_by_business: exposureSnapshot?.business ?? undefined,
        exposure_by_holding: exposureSnapshot?.holding ?? undefined,
        linked_holding_account_id: exposureSnapshot?.holding_account_id ?? undefined,
        linked_business_id: typeof originOffer?.business_id === 'string' ? originOffer.business_id : undefined,
        par7: overdueDays >= 7,
        par30: overdueDays >= 30,
        npl30: overdueDays >= 30,
    } as FuelAdvanceListItem;
}

function enrichAdvanceExposureMaps(advances: FuelAdvanceListItem[], linkedHoldingByBusiness: Map<string, string>) {
    const activeExposureByTrucker = new Map<string, number>();
    const activeExposureByBusiness = new Map<string, number>();
    const activeExposureByHolding = new Map<string, number>();

    for (const advance of advances) {
        if (!['disbursed', 'overdue', 'at_risk', 'restructured'].includes(advance.status)) {
            continue;
        }

        const outstandingAmount = toNumber(advance.principal_outstanding) + toNumber(advance.interest_outstanding);

        activeExposureByTrucker.set(
            advance.trucker_id,
            (activeExposureByTrucker.get(advance.trucker_id) || 0) + outstandingAmount
        );

        if (advance.origin_offer?.business_id) {
            activeExposureByBusiness.set(
                advance.origin_offer.business_id,
                (activeExposureByBusiness.get(advance.origin_offer.business_id) || 0) + outstandingAmount
            );

            const holdingId = linkedHoldingByBusiness.get(advance.origin_offer.business_id);
            if (holdingId) {
                activeExposureByHolding.set(
                    holdingId,
                    (activeExposureByHolding.get(holdingId) || 0) + outstandingAmount
                );
            }
        }
    }

    return {
        activeExposureByTrucker,
        activeExposureByBusiness,
        activeExposureByHolding,
    };
}

async function loadHoldingLinksByBusiness(
    supabaseAdmin: AdminClient,
    businessIds: string[]
) {
    if (businessIds.length === 0) {
        return new Map<string, string>();
    }

    const { data } = await supabaseAdmin
        .from('holding_business_links')
        .select('business_id, holding_account_id, status')
        .in('business_id', businessIds);

    const linkedHoldingByBusiness = new Map<string, string>();

    for (const row of (data || []) as Array<{ business_id: string; holding_account_id: string; status?: string | null }>) {
        if ((row.status || 'linked') !== 'linked') {
            continue;
        }
        linkedHoldingByBusiness.set(row.business_id, row.holding_account_id);
    }

    return linkedHoldingByBusiness;
}

export async function syncAdvanceStatuses(supabaseAdmin: AdminClient) {
    await supabaseAdmin.rpc('mark_overdue_fuel_advances');
}

export async function getLendingSettings(supabaseAdmin: AdminClient): Promise<LendingSettingsSnapshot | null> {
    const { data } = await supabaseAdmin
        .from('lending_settings')
        .select('monthly_interest_rate_percent, max_term_days, portfolio_deployment_limit_percent, first_advance_cap_cop, repeat_advance_cap_cop, initial_ltv_percent, repeat_ltv_percent, minimum_completed_trips_for_repeat')
        .eq('id', 'default')
        .maybeSingle();

    return (data as LendingSettingsSnapshot | null) ?? null;
}

export async function getLendingTreasury(supabaseAdmin: AdminClient): Promise<LendingTreasurySnapshot | null> {
    const { data } = await supabaseAdmin
        .from('lending_treasury')
        .select('available_capital, reserved_capital, deployed_capital, total_repaid_principal, total_repaid_interest')
        .eq('id', 'default')
        .maybeSingle();

    const treasury = (data as LendingTreasurySnapshot | null) ?? null;

    if (!treasury) {
        return null;
    }

    const totalCapital =
        toNumber(treasury.available_capital)
        + toNumber(treasury.deployed_capital)
        + toNumber(treasury.reserved_capital);

    return {
        ...treasury,
        deployment_percent: totalCapital > 0
            ? Math.round((toNumber(treasury.deployed_capital) / totalCapital) * 10_000) / 100
            : 0,
    };
}

export function summarizeAdvancePortfolio(
    advances: FuelAdvanceListItem[],
    treasury?: LendingTreasurySnapshot | null
): {
    metrics: AdvancePortfolioMetrics;
    cohorts: AdvancePortfolioCohort[];
} {
    const requested = advances.filter((item) => item.status === 'requested').length;
    const active = advances.filter((item) => ['disbursed', 'overdue', 'at_risk', 'restructured'].includes(item.status)).length;
    const overdue = advances.filter((item) => ['overdue', 'at_risk'].includes(item.status)).length;
    const completed = advances.filter((item) => item.status === 'completed').length;
    const outstandingPrincipal = advances.reduce((sum, item) => sum + toNumber(item.principal_outstanding), 0);
    const outstandingInterest = advances.reduce((sum, item) => sum + toNumber(item.interest_outstanding), 0);
    const par7Amount = advances
        .filter((item) => (item.par7 || false) && ['disbursed', 'overdue', 'at_risk', 'restructured'].includes(item.status))
        .reduce((sum, item) => sum + toNumber(item.principal_outstanding) + toNumber(item.interest_outstanding), 0);
    const par30Amount = advances
        .filter((item) => (item.par30 || false) && ['disbursed', 'overdue', 'at_risk', 'restructured'].includes(item.status))
        .reduce((sum, item) => sum + toNumber(item.principal_outstanding) + toNumber(item.interest_outstanding), 0);
    const npl30Amount = advances
        .filter((item) => (item.npl30 || false) && ['overdue', 'at_risk', 'written_off'].includes(item.status))
        .reduce((sum, item) => sum + toNumber(item.principal_outstanding) + toNumber(item.interest_outstanding), 0);
    const denominator = outstandingPrincipal + outstandingInterest;

    const cohortMap = new Map<string, AdvancePortfolioCohort>();

    for (const advance of advances) {
        const cohortMonth = advance.cohort_month || getCohortMonth(advance.disbursed_at || advance.created_at);
        if (!cohortMonth) {
            continue;
        }

        const current = cohortMap.get(cohortMonth) || {
            cohort_month: cohortMonth,
            disbursed_count: 0,
            principal_disbursed: 0,
            outstanding_amount: 0,
            par7_amount: 0,
            par30_amount: 0,
            npl30_amount: 0,
            write_off_amount: 0,
            recovered_interest: 0,
        };

        current.disbursed_count += 1;
        current.principal_disbursed += toNumber(advance.principal_amount);

        const outstandingAmount = toNumber(advance.principal_outstanding) + toNumber(advance.interest_outstanding);
        current.outstanding_amount += outstandingAmount;

        if (advance.par7) {
            current.par7_amount += outstandingAmount;
        }

        if (advance.par30) {
            current.par30_amount += outstandingAmount;
            current.npl30_amount += outstandingAmount;
        }

        if (advance.status === 'written_off') {
            current.write_off_amount += Math.max(outstandingAmount, toNumber(advance.total_due_at_maturity));
        }

        cohortMap.set(cohortMonth, current);
    }

    return {
        metrics: {
            requested,
            active,
            overdue,
            completed,
            outstandingPrincipal,
            outstandingInterest,
            par7Amount,
            par30Amount,
            npl30Amount,
            par7Rate: denominator > 0 ? Math.round((par7Amount / denominator) * 10_000) / 100 : 0,
            par30Rate: denominator > 0 ? Math.round((par30Amount / denominator) * 10_000) / 100 : 0,
            npl30Rate: denominator > 0 ? Math.round((npl30Amount / denominator) * 10_000) / 100 : 0,
            writeOffAmount: advances
                .filter((item) => item.status === 'written_off')
                .reduce((sum, item) => sum + Math.max(
                    toNumber(item.principal_outstanding) + toNumber(item.interest_outstanding),
                    toNumber(item.total_due_at_maturity)
                ), 0),
            recoveredPrincipal: toNumber(treasury?.total_repaid_principal),
            recoveredInterest: toNumber(treasury?.total_repaid_interest),
        },
        cohorts: Array.from(cohortMap.values()).sort((left, right) => right.cohort_month.localeCompare(left.cohort_month)),
    };
}

export async function getAdminAdvancePortfolioSnapshot(supabaseAdmin: AdminClient): Promise<{
    treasury: LendingTreasurySnapshot | null;
    settings: LendingSettingsSnapshot | null;
    metrics: AdvancePortfolioMetrics;
    cohorts: AdvancePortfolioCohort[];
    data: FuelAdvanceListItem[];
}> {
    await syncAdvanceStatuses(supabaseAdmin);

    const [treasury, settings, advancesResponse] = await Promise.all([
        getLendingTreasury(supabaseAdmin),
        getLendingSettings(supabaseAdmin),
        supabaseAdmin
            .from('fuel_advances')
            .select(`
                id,
                trucker_id,
                wallet_id,
                origin_offer_id,
                status,
                principal_amount,
                monthly_interest_rate_percent,
                term_days,
                approved_at,
                disbursed_at,
                due_at,
                principal_outstanding,
                interest_outstanding,
                total_due_at_maturity,
                requested_by,
                approved_by,
                rejected_reason,
                risk_band,
                policy_snapshot,
                exposure_snapshot,
                metadata,
                created_at,
                updated_at,
                origin_offer:origin_offer_id (
                    id,
                    business_id,
                    origin_city,
                    destination_city,
                    cargo_type,
                    pickup_date,
                    delivery_date,
                    status
                )
            `)
            .order('created_at', { ascending: false }),
    ]);

    if (advancesResponse.error) {
        throw new Error(advancesResponse.error.message || 'Could not load advances.');
    }

    const normalizedAdvances = ((advancesResponse.data || []) as RawAdvanceRow[]).map(normalizeAdvanceRecord);
    const businessIds = normalizedAdvances
        .map((item) => item.origin_offer?.business_id)
        .filter((value): value is string => Boolean(value));
    const linkedHoldingByBusiness = await loadHoldingLinksByBusiness(
        supabaseAdmin,
        Array.from(new Set(businessIds))
    );
    const exposureMaps = enrichAdvanceExposureMaps(normalizedAdvances, linkedHoldingByBusiness);
    const truckerIds = Array.from(new Set(normalizedAdvances.map((item) => item.trucker_id).filter(Boolean)));
    const { data: profiles } = truckerIds.length
        ? await supabaseAdmin
            .from('user_profiles')
            .select('id, full_name, email, phone')
            .in('id', truckerIds)
        : { data: [] as any[] };

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const enrichedAdvances = normalizedAdvances.map((item) => {
        const businessId = item.origin_offer?.business_id || null;
        const holdingId = businessId ? linkedHoldingByBusiness.get(businessId) || null : null;
        const exposureSnapshot = item.exposure_snapshot || {
            trucker: exposureMaps.activeExposureByTrucker.get(item.trucker_id) || 0,
            business: businessId ? exposureMaps.activeExposureByBusiness.get(businessId) || 0 : 0,
            holding: holdingId ? exposureMaps.activeExposureByHolding.get(holdingId) || 0 : 0,
            portfolio_deployment_percent: toNumber(treasury?.deployment_percent),
            holding_account_id: holdingId,
        };

        return {
            ...item,
            exposure_snapshot: exposureSnapshot,
            exposure_by_trucker: exposureSnapshot.trucker,
            exposure_by_business: exposureSnapshot.business,
            exposure_by_holding: exposureSnapshot.holding,
            linked_business_id: businessId || undefined,
            linked_holding_account_id: holdingId || undefined,
            trucker: profileMap.has(item.trucker_id)
                ? {
                    id: item.trucker_id,
                    full_name: profileMap.get(item.trucker_id)?.full_name || 'Sin nombre',
                    email: profileMap.get(item.trucker_id)?.email || '',
                    phone: profileMap.get(item.trucker_id)?.phone || null,
                }
                : null,
        };
    });

    const { metrics, cohorts } = summarizeAdvancePortfolio(enrichedAdvances, treasury);

    return {
        treasury,
        settings,
        metrics,
        cohorts,
        data: enrichedAdvances,
    };
}

export async function getTruckerAdvanceSnapshot(
    supabaseAdmin: AdminClient,
    userId: string
): Promise<{
    wallet: WalletRecord | null;
    settings: LendingSettingsSnapshot | null;
    eligibleOffers: EligibleAdvanceOffer[];
    advances: FuelAdvanceListItem[];
    activeAdvances: FuelAdvanceListItem[];
    overdueAdvances: FuelAdvanceListItem[];
    summary: AdvanceSummary;
}> {
    await syncAdvanceStatuses(supabaseAdmin);

    const [{ data: wallet }, settings, { data: eligibleOffers }, { data: advances }] = await Promise.all([
        supabaseAdmin
            .from('wallets')
            .select('id, user_id, available_balance, pending_balance, total_trips_completed')
            .eq('user_id', userId)
            .maybeSingle(),
        getLendingSettings(supabaseAdmin),
        supabaseAdmin.rpc('get_fuel_advance_eligibility', { p_trucker_id: userId }),
        supabaseAdmin
            .from('fuel_advances')
            .select(`
                id,
                trucker_id,
                wallet_id,
                origin_offer_id,
                status,
                principal_amount,
                monthly_interest_rate_percent,
                term_days,
                approved_at,
                disbursed_at,
                due_at,
                principal_outstanding,
                interest_outstanding,
                total_due_at_maturity,
                requested_by,
                approved_by,
                rejected_reason,
                risk_band,
                policy_snapshot,
                exposure_snapshot,
                metadata,
                created_at,
                updated_at,
                origin_offer:origin_offer_id (
                    id,
                    business_id,
                    origin_city,
                    destination_city,
                    cargo_type,
                    pickup_date,
                    delivery_date,
                    status
                )
            `)
            .eq('trucker_id', userId)
            .order('created_at', { ascending: false }),
    ]);

    const normalizedEligible = ((eligibleOffers || []) as Array<Record<string, any>>).map(normalizeEligibleOffer);
    const normalizedAdvances = ((advances || []) as RawAdvanceRow[]).map(normalizeAdvanceRecord);

    const activeAdvances = normalizedAdvances.filter((item) =>
        ['requested', 'disbursed', 'overdue', 'at_risk', 'restructured'].includes(item.status)
    );
    const overdueAdvances = normalizedAdvances.filter((item) => ['overdue', 'at_risk'].includes(item.status));

    const summary: AdvanceSummary = {
        activeCount: activeAdvances.length,
        overdueCount: overdueAdvances.length,
        outstandingPrincipal: activeAdvances.reduce((sum, item) => sum + toNumber(item.principal_outstanding), 0),
        outstandingInterest: activeAdvances.reduce((sum, item) => sum + toNumber(item.interest_outstanding), 0),
        totalOutstanding: activeAdvances.reduce(
            (sum, item) => sum + toNumber(item.principal_outstanding) + toNumber(item.interest_outstanding),
            0
        ),
        eligibleOffersCount: normalizedEligible.filter((item) => item.eligible).length,
        blockedOffersCount: normalizedEligible.filter((item) => item.decision === 'blocked').length,
        manualReviewOffersCount: normalizedEligible.filter((item) => item.decision === 'manual_review').length,
        maxEligibleAmount: normalizedEligible.reduce(
            (max, item) => Math.max(max, toNumber(item.eligible ? item.max_advance_amount : 0)),
            0
        ),
        monthlyInterestRatePercent: toNumber(settings?.monthly_interest_rate_percent || normalizedEligible[0]?.monthly_interest_rate_percent || 0),
        maxTermDays: toNumber(settings?.max_term_days || normalizedEligible[0]?.max_term_days || 30),
    };

    return {
        wallet: (wallet as WalletRecord | null) ?? null,
        settings,
        eligibleOffers: normalizedEligible,
        advances: normalizedAdvances,
        activeAdvances,
        overdueAdvances,
        summary,
    };
}

export async function getAdvanceRepayments(
    supabaseAdmin: AdminClient,
    advanceIds: string[]
): Promise<Record<string, FuelAdvanceRepaymentItem[]>> {
    if (advanceIds.length === 0) {
        return {};
    }

    const { data } = await supabaseAdmin
        .from('fuel_advance_repayments')
        .select('*')
        .in('advance_id', advanceIds)
        .order('created_at', { ascending: false });

    return ((data || []) as FuelAdvanceRepaymentItem[]).reduce<Record<string, FuelAdvanceRepaymentItem[]>>((acc, item) => {
        if (!acc[item.advance_id]) {
            acc[item.advance_id] = [];
        }
        acc[item.advance_id].push({
            ...item,
            principal_paid: toNumber(item.principal_paid),
            interest_paid: toNumber(item.interest_paid),
            balance_after_principal: toNumber(item.balance_after_principal),
            balance_after_interest: toNumber(item.balance_after_interest),
        });
        return acc;
    }, {});
}
