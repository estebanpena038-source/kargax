import fs from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DOMAIN_SLOS, RUNBOOKS } from '@/lib/platform/market-registry';
import { RISK_REGISTER_BASELINE, SCORECARD_GATES_BASELINE, SMOKE_JOURNEY_BASELINE } from '@/lib/platform/readiness-registry';
import type {
    AdminCeoOverviewResponse,
    AdminOverviewResponse,
    IncidentSeverity,
    LaunchReadinessItem,
    OperationDomain,
    OperationEvent,
    PlatformIncident,
    ReplayAction,
    RiskRegisterItem,
    RiskSummary,
    ScorecardMetric,
    ScorecardSnapshot,
    SmokeJourney,
    SmokeSuiteSnapshot,
    SupportPriority,
    SupportRequest,
} from '@/lib/platform/types';
import { getAdminAdvancePortfolioSnapshot } from '@/lib/server/advances';
import { getFeatureFlags } from '@/lib/server/feature-flags';
import { resolveBillingPlanPriceCop } from '@/lib/server/warehouses';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

function isMissingTableError(error: unknown, tableName: string) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const message = JSON.stringify(error).toLowerCase();
    return message.includes(tableName.toLowerCase()) && (
        message.includes('does not exist')
        || message.includes('schema cache')
        || message.includes('pgrst')
    );
}

function computeSupportSla(priority: SupportPriority, createdAt = new Date()) {
    const next = new Date(createdAt);

    if (priority === 'critical') {
        next.setMinutes(next.getMinutes() + 5);
    } else if (priority === 'high') {
        next.setMinutes(next.getMinutes() + 30);
    } else if (priority === 'medium') {
        next.setHours(next.getHours() + 4);
    } else {
        next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
}

async function safeSelect<T>(
    promise: PromiseLike<{ data: T | null; error: { message?: string } | null }>,
    fallback: T
) {
    const result = await promise;
    if (result.error) {
        return fallback;
    }
    return (result.data ?? fallback) as T;
}

async function safeCount(
    promise: PromiseLike<{ count?: number | null; error: { message?: string } | null }>
) {
    const result = await promise;
    if (result.error) {
        return 0;
    }

    return Number(result.count || 0);
}

async function safeSelectAll<T>(
    queryFactory: () => {
        range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;
    },
    pageSize = 1000
) {
    const rows: T[] = [];

    for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const result = await queryFactory().range(from, to);

        if (result.error) {
            return rows;
        }

        const page = result.data || [];
        rows.push(...page);

        if (page.length < pageSize) {
            return rows;
        }
    }
}

function resolveRepoPath(...segments: string[]) {
    const candidates = [
        path.resolve(process.cwd(), ...segments),
        path.resolve(process.cwd(), '..', ...segments),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function repoFileExists(...segments: string[]) {
    return fs.existsSync(resolveRepoPath(...segments));
}

function readJsonFile<T>(fullPath: string, fallback: T): T {
    try {
        if (!fs.existsSync(fullPath)) {
            return fallback;
        }

        return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as T;
    } catch {
        return fallback;
    }
}

function formatInteger(value: number) {
    return new Intl.NumberFormat('es-CO', {
        maximumFractionDigits: 0,
    }).format(value);
}

function formatCop(value: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(value);
}

function formatPercent(value: number) {
    return `${value.toFixed(1)}%`;
}

function deriveOverallReadinessStatus(items: LaunchReadinessItem[]): AdminOverviewResponse['launch_readiness']['status'] {
    if (items.some((item) => item.blocking && item.status === 'blocked')) {
        return 'blocked';
    }

    if (items.some((item) => item.status === 'warning' || item.status === 'pending_manual')) {
        return 'warning';
    }

    return 'passed';
}

function deriveOverallSmokeStatus(journeys: SmokeJourney[]): SmokeSuiteSnapshot['status'] {
    if (journeys.some((journey) => journey.status === 'blocked')) {
        return 'blocked';
    }

    return 'needs_evidence';
}

function getLintStats() {
    const report = readJsonFile<Array<{ errorCount?: number; fatalErrorCount?: number; warningCount?: number }>>(
        resolveRepoPath('lint-report.json'),
        []
    );

    return report.reduce(
        (current, entry) => ({
            errors: current.errors + Number(entry.errorCount || 0) + Number(entry.fatalErrorCount || 0),
            warnings: current.warnings + Number(entry.warningCount || 0),
        }),
        { errors: 0, warnings: 0 }
    );
}

function getPackageScriptStatus() {
    const packageJson = readJsonFile<{ scripts?: Record<string, string> }>(
        resolveRepoPath('package.json'),
        {}
    );
    const scripts = packageJson.scripts || {};

    return ['check', 'lint', 'check:release', 'smoke:release'].every((scriptName) => Boolean(scripts[scriptName]));
}

function getLaunchReadinessSnapshot(flags: AdminOverviewResponse['flags']) {
    const lintStats = getLintStats();
    const hasSmokeSuite = repoFileExists('scripts', 'smoke-suite.mjs') && repoFileExists('..', 'docs', 'ops', 'smoke-suite.md');
    const hasSupportEscalation = repoFileExists('..', 'docs', 'ops', 'support-escalation.md');
    const hasRollbackRunbook = repoFileExists('..', 'docs', 'ops', 'release-rollback.md');
    const hasBootstrapSeed = repoFileExists('..', 'supabase', 'seeds', 'enterprise_bootstrap_tenant.sql');
    const hasReleaseArtifacts = repoFileExists('..', 'docs', 'ops', 'launch-day-runbook.md') && repoFileExists('..', 'docs', 'ops', 'disaster-recovery.md');
    const featureFlagKeys = new Set(flags.map((flag) => flag.key));
    const marketFlagReady = ['market_open', 'enterprise_experience_mode', 'replay_actions', 'andean_country_visibility'].every((key) => featureFlagKeys.has(key));
    const webhookConfigured = Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim());

    const items: LaunchReadinessItem[] = [
        {
            key: 'repo_checks_configured',
            title: 'Repo checks and release audit configured',
            status: getPackageScriptStatus() && hasReleaseArtifacts ? 'passed' : 'blocked',
            source: 'repo',
            blocking: true,
            detail: 'check, lint, check:release and smoke:release must exist together with launch/DR artifacts.',
            evidence_path: '/SPTRINTS/91_LAUNCH_CHECKLIST.md',
        },
        {
            key: 'lint_gate',
            title: 'Lint gate triaged',
            status: lintStats.errors > 0 ? 'blocked' : lintStats.warnings > 0 ? 'warning' : 'passed',
            source: 'repo',
            blocking: true,
            detail: `Lint report shows ${lintStats.errors} errors and ${lintStats.warnings} warnings.`,
            evidence_path: '/SPTRINTS/92_RISK_REGISTER.md',
        },
        {
            key: 'smoke_suite',
            title: 'Smoke suite defined and awaiting evidence',
            status: hasSmokeSuite ? 'pending_manual' : 'blocked',
            source: 'manual',
            blocking: true,
            detail: 'The suite exists, but launch still requires executed evidence for every critical journey.',
            evidence_path: '/docs/ops/smoke-suite.md',
        },
        {
            key: 'webhook_signature',
            title: 'Webhook signature configured',
            status: webhookConfigured ? 'passed' : 'blocked',
            source: 'env',
            blocking: true,
            detail: 'MERCADOPAGO_WEBHOOK_SECRET must be present in the live environment.',
            evidence_path: '/SPTRINTS/91_LAUNCH_CHECKLIST.md',
        },
        {
            key: 'support_rotation',
            title: 'Support and escalation source of truth',
            status: hasSupportEscalation ? 'pending_manual' : 'blocked',
            source: 'manual',
            blocking: true,
            detail: 'Roster exists in docs, but actual humans must be assigned before launch.',
            evidence_path: '/docs/ops/support-escalation.md',
        },
        {
            key: 'rollback_path',
            title: 'Rollback path documented',
            status: hasRollbackRunbook ? 'pending_manual' : 'blocked',
            source: 'manual',
            blocking: true,
            detail: 'Rollback runbook exists and still requires rehearsal before launch.',
            evidence_path: '/docs/ops/release-rollback.md',
        },
        {
            key: 'feature_flags',
            title: 'Feature flags ready for market and degraded modes',
            status: marketFlagReady ? 'passed' : 'blocked',
            source: 'runtime',
            blocking: true,
            detail: 'market_open, production experience mode, replay_actions and andean_country_visibility must be available.',
            evidence_path: '/SPTRINTS/91_LAUNCH_CHECKLIST.md',
        },
        {
            key: 'bootstrap_setup',
            title: 'Bootstrap operativo listo',
            status: hasBootstrapSeed ? 'passed' : 'blocked',
            source: 'repo',
            blocking: false,
            detail: 'La configuracion base debe existir para acelerar activacion e implementacion controlada.',
            evidence_path: '/supabase/seeds/enterprise_bootstrap_tenant.sql',
        },
    ];

    return {
        lintStats,
        readiness: {
            status: deriveOverallReadinessStatus(items),
            items,
        },
    };
}

function getSmokeSuiteSnapshot() {
    const pathChecks: Record<string, string[]> = {
        auth_mfa: ['src/app/auth/mfa/setup/page.tsx', 'src/app/auth/mfa/verify/page.tsx'],
        trip_money: ['src/app/pagar/[offerId]/page.tsx', 'src/app/api/payments/webhook/route.ts', 'src/app/viaje/[offerId]/page.tsx'],
        wallet_withdrawal: ['src/app/billetera/page.tsx', 'src/app/api/admin/withdrawals/[id]/route.ts'],
        advance_cycle: ['src/app/api/advances/route.ts', 'src/components/wallet/AdvancesSection.tsx'],
        warehouse_ops: ['src/app/api/warehouses/[id]/appointments/route.ts', 'src/app/api/warehouses/[id]/receipts/route.ts', 'src/app/api/warehouses/[id]/dispatches/route.ts'],
        holding_admin: ['src/app/corporativo/page.tsx', 'src/app/api/holding/approvals/route.ts', 'src/app/api/admin/payments/reconcile/route.ts'],
    };

    const journeys: SmokeJourney[] = SMOKE_JOURNEY_BASELINE.map((journey) => {
        const requiredPaths = pathChecks[journey.key] || [];
        const exists = requiredPaths.every((relativePath) => repoFileExists(relativePath));

        return {
            ...journey,
            status: exists ? 'needs_evidence' : 'blocked',
        };
    });

    return {
        status: deriveOverallSmokeStatus(journeys),
        journeys,
    };
}

function getRiskSummarySnapshot(flags: AdminOverviewResponse['flags'], lintWarnings: number): RiskSummary {
    const marketOpenCountries = flags
        .filter((flag) => flag.key === 'market_open' && flag.enabled && flag.country_code)
        .map((flag) => flag.country_code);
    const supportDocExists = repoFileExists('..', 'docs', 'ops', 'support-escalation.md');
    const rollbackDocExists = repoFileExists('..', 'docs', 'ops', 'release-rollback.md');

    const items: RiskRegisterItem[] = RISK_REGISTER_BASELINE.map((item): RiskRegisterItem => {
        if (item.key === 'lint_warning_backlog') {
            return {
                ...item,
                status: lintWarnings === 0 ? 'mitigated' : 'partial',
                early_signal: `lint-report.json currently shows ${lintWarnings} warnings.`,
            };
        }

        if (item.key === 'support_founder_dependency') {
            return {
                ...item,
                status: supportDocExists ? 'partial' : 'open',
            };
        }

        if (item.key === 'rollback_gap') {
            return {
                ...item,
                status: rollbackDocExists ? 'partial' : 'open',
            };
        }

        if (item.key === 'partner_compliance_gap') {
            return {
                ...item,
                early_signal: `Open markets today: ${marketOpenCountries.length ? marketOpenCountries.join(', ') : 'none'}.`,
            };
        }

        return item;
    });

    return {
        blockers_open: items.filter((item) => item.blocker && item.status !== 'mitigated').length,
        open_total: items.filter((item) => item.status === 'open').length,
        partially_mitigated: items.filter((item) => item.status === 'partial').length,
        mitigated_total: items.filter((item) => item.status === 'mitigated').length,
        top_blockers: items.filter((item) => item.blocker && item.status !== 'mitigated').slice(0, 5),
        items,
    };
}

async function getScorecardSnapshot(
    supabaseAdmin: AdminClient,
    launchReadinessStatus: AdminOverviewResponse['launch_readiness']['status'],
    riskSummary: RiskSummary
): Promise<ScorecardSnapshot> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
        subscriptions,
        recentOffers,
        completedPayments,
        tripDeposits,
        completedAppointments,
        closedReceipts,
        dispatchedOrders,
        advanceSnapshot,
    ] = await Promise.all([
        safeSelect(
            supabaseAdmin
                .from('business_plan_subscriptions')
                .select('business_id, plan_code, status')
                .in('status', ['active', 'trialing'])
                .neq('plan_code', 'free'),
            [] as Array<{ business_id: string; plan_code: string; status: string }>
        ),
        safeSelect(
            supabaseAdmin
                .from('cargo_offers')
                .select('business_id')
                .gte('created_at', thirtyDaysAgo),
            [] as Array<{ business_id: string }>
        ),
        safeCount(
            supabaseAdmin
                .from('payments')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'completed')
        ),
        safeSelect(
            supabaseAdmin
                .from('transactions')
                .select('amount')
                .eq('type', 'trip_deposit')
                .eq('status', 'completed'),
            [] as Array<{ amount: number }>
        ),
        safeCount(
            supabaseAdmin
                .from('warehouse_appointments')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'completed')
        ),
        safeCount(
            supabaseAdmin
                .from('warehouse_receipts')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'closed')
        ),
        safeCount(
            supabaseAdmin
                .from('warehouse_dispatch_orders')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'dispatched')
        ),
        getAdminAdvancePortfolioSnapshot(supabaseAdmin).catch(() => null),
    ]);

    const payingBusinesses = new Set(subscriptions.map((item) => item.business_id)).size;
    const activeBusinesses = new Set(recentOffers.map((item) => item.business_id)).size;
    const settledWalletVolume = tripDeposits.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const warehouseOpsProcessed = Number(completedAppointments || 0) + Number(closedReceipts || 0) + Number(dispatchedOrders || 0);
    const advanceOutstanding = Number(advanceSnapshot?.metrics?.outstandingPrincipal || 0)
        + Number(advanceSnapshot?.metrics?.outstandingInterest || 0);
    const delinquencyByCohort = (advanceSnapshot?.cohorts || [])
        .slice(0, 3)
        .map((cohort) => {
            const base = Number(cohort.principal_disbursed || 0);
            const par7 = base > 0 ? (Number(cohort.par7_amount || 0) / base) * 100 : 0;
            const par30 = base > 0 ? (Number(cohort.par30_amount || 0) / base) * 100 : 0;
            return `${cohort.cohort_month}: PAR7 ${formatPercent(par7)} / PAR30 ${formatPercent(par30)}`;
        })
        .join(' | ');

    const metrics: ScorecardMetric[] = [
        {
            key: 'paying_businesses',
            label: 'paying businesses',
            formula: 'distinct business_id with active or trialing paid subscription',
            source: 'business_plan_subscriptions',
            current_value: formatInteger(payingBusinesses),
            evidence_status: 'runtime',
        },
        {
            key: 'active_businesses',
            label: 'active businesses',
            formula: 'distinct business_id with cargo activity in the last 30 days',
            source: 'cargo_offers',
            current_value: formatInteger(activeBusinesses),
            evidence_status: 'runtime',
        },
        {
            key: 'paid_trips',
            label: 'paid trips',
            formula: 'payments where status = completed',
            source: 'payments',
            current_value: formatInteger(Number(completedPayments || 0)),
            evidence_status: 'runtime',
        },
        {
            key: 'settled_wallet_volume',
            label: 'settled wallet volume',
            formula: 'sum trip_deposit where status = completed',
            source: 'transactions',
            current_value: formatCop(settledWalletVolume),
            evidence_status: 'runtime',
        },
        {
            key: 'warehouse_operations_processed',
            label: 'warehouse operations processed',
            formula: 'appointments completed + receipts closed + dispatches dispatched',
            source: 'warehouse_*',
            current_value: formatInteger(warehouseOpsProcessed),
            evidence_status: 'runtime',
        },
        {
            key: 'advance_book_outstanding',
            label: 'advance book outstanding',
            formula: 'sum principal_outstanding + interest_outstanding',
            source: 'fuel_advances',
            current_value: formatCop(advanceOutstanding),
            evidence_status: 'runtime',
        },
        {
            key: 'delinquency_by_cohort',
            label: 'delinquency by cohort',
            formula: 'cohort PAR7, PAR30 and NPL30 from advances snapshot',
            source: 'fuel_advances + advances snapshot',
            current_value: delinquencyByCohort || 'No cohort data available yet',
            evidence_status: 'runtime',
        },
        {
            key: 'gross_margin_by_customer',
            label: 'gross margin by customer',
            formula: 'net customer revenue minus provider and operating costs',
            source: 'finance closeout',
            current_value: 'Manual evidence required',
            evidence_status: 'manual_required',
            notes: 'Not yet derivable from a single canonical table.',
        },
        {
            key: 'onboarding_time_to_first_value',
            label: 'onboarding time to first value',
            formula: 'first value timestamp minus onboarding start timestamp',
            source: 'ops onboarding closeout',
            current_value: 'Manual evidence required',
            evidence_status: 'manual_required',
            notes: 'Requires a formal onboarding start event and closeout discipline.',
        },
    ];

    const gates: ScorecardSnapshot['gates'] = SCORECARD_GATES_BASELINE.map<ScorecardSnapshot['gates'][number]>((gate) => {
        if (gate.key === 'gate_1') {
            return {
                ...gate,
                status: launchReadinessStatus === 'passed' ? 'passed' : launchReadinessStatus === 'blocked' ? 'blocked' : 'partial',
                evidence_basis: `Repo readiness is ${launchReadinessStatus}.`,
            };
        }

        if (gate.key === 'gate_2') {
            const hasOperationalFlow = Number(completedPayments || 0) > 0 && settledWalletVolume > 0;
            return {
                ...gate,
                status: hasOperationalFlow ? 'partial' : 'blocked',
                evidence_basis: hasOperationalFlow
                    ? 'Runtime data shows payment, settlement and lending traces, but commercial proof still requires real customer evidence.'
                    : 'Runtime data does not yet prove an end-to-end money flow.',
            };
        }

        if (gate.key === 'gate_3') {
            return {
                ...gate,
                status: 'blocked',
                evidence_basis: 'Enterprise adoption still requires paid customers or real multi-business usage evidence.',
            };
        }

        return {
            ...gate,
            status: riskSummary.blockers_open > 0 ? 'partial' : 'passed',
            evidence_basis: riskSummary.blockers_open > 0
                ? 'Backend is market-ready, but launch blockers still exist for expansion or reliability proof.'
                : 'No open blockers remain for expansion and reliability.',
        };
    });

    return {
        generated_at: new Date().toISOString(),
        monthly_cadence: 'monthly closeout with weekly gate review until launch',
        honesty_rule: 'If evidence is missing, the metric stays runtime-only, partial, blocked, or manual required.',
        gates,
        metrics,
    };
}

export async function capturePosthogServerEvent(payload: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
}) {
    const captureUrl = process.env.POSTHOG_CAPTURE_URL?.trim();
    const apiKey = process.env.POSTHOG_API_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();

    if (!captureUrl || !apiKey) {
        return { sent: false };
    }

    try {
        const response = await fetch(captureUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: apiKey,
                event: payload.event,
                distinct_id: payload.distinctId,
                properties: payload.properties || {},
            }),
        });

        return { sent: response.ok };
    } catch {
        return { sent: false };
    }
}

export async function recordOperationEvent(
    supabaseAdmin: AdminClient,
    payload: {
        requestId: string;
        actorUserId?: string | null;
        actorType?: OperationEvent['actor_type'];
        domain: OperationDomain;
        action: string;
        entityType?: string | null;
        entityId?: string | null;
        entityIds?: Record<string, unknown>;
        businessId?: string | null;
        holdingAccountId?: string | null;
        countryCode?: string | null;
        status?: OperationEvent['status'];
        errorClass?: string | null;
        replayable?: boolean;
        replayAction?: ReplayAction | null;
        sourceReference?: string | null;
        metadata?: Record<string, unknown>;
    }
) {
    const { data, error } = await supabaseAdmin
        .from('operation_events')
        .insert({
            request_id: payload.requestId,
            actor_user_id: payload.actorUserId || null,
            actor_type: payload.actorType || 'system',
            domain: payload.domain,
            action: payload.action,
            entity_type: payload.entityType || null,
            entity_id: payload.entityId || null,
            entity_ids: payload.entityIds || {},
            business_id: payload.businessId || null,
            holding_account_id: payload.holdingAccountId || null,
            country_code: payload.countryCode || 'CO',
            status: payload.status || 'success',
            error_class: payload.errorClass || null,
            replayable: Boolean(payload.replayable),
            replay_action: payload.replayAction || null,
            source_reference: payload.sourceReference || null,
            metadata: payload.metadata || {},
        })
        .select('*')
        .maybeSingle();

    if (error && !isMissingTableError(error, 'operation_events')) {
        console.error('[operation_events][insert]', error.message || error);
    }

    return (data as OperationEvent | null) ?? null;
}

export async function createPlatformIncident(
    supabaseAdmin: AdminClient,
    payload: {
        requestId: string;
        domain: OperationDomain;
        title: string;
        detail?: string | null;
        severity?: IncidentSeverity;
        runbookKey: string;
        businessId?: string | null;
        holdingAccountId?: string | null;
        countryCode?: string | null;
        errorClass?: string | null;
        replayable?: boolean;
        replayAction?: ReplayAction | null;
        replayPayload?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        sourceReference?: string | null;
        operationEventId?: string | null;
    }
) {
    const { data, error } = await supabaseAdmin
        .from('platform_incidents')
        .insert({
            request_id: payload.requestId,
            operation_event_id: payload.operationEventId || null,
            domain: payload.domain,
            title: payload.title,
            detail: payload.detail || null,
            severity: payload.severity || 'medium',
            status: 'open',
            runbook_key: payload.runbookKey,
            replayable: Boolean(payload.replayable),
            replay_action: payload.replayAction || null,
            replay_payload: payload.replayPayload || {},
            business_id: payload.businessId || null,
            holding_account_id: payload.holdingAccountId || null,
            country_code: payload.countryCode || 'CO',
            error_class: payload.errorClass || null,
            metadata: payload.metadata || {},
            source_reference: payload.sourceReference || null,
        })
        .select('*')
        .maybeSingle();

    if (error && !isMissingTableError(error, 'platform_incidents')) {
        console.error('[platform_incidents][insert]', error.message || error);
    }

    return (data as PlatformIncident | null) ?? null;
}

export async function recordCriticalOperation(
    supabaseAdmin: AdminClient,
    payload: {
        requestId: string;
        actorUserId?: string | null;
        actorType?: OperationEvent['actor_type'];
        domain: OperationDomain;
        action: string;
        entityType?: string | null;
        entityId?: string | null;
        entityIds?: Record<string, unknown>;
        businessId?: string | null;
        holdingAccountId?: string | null;
        countryCode?: string | null;
        status: OperationEvent['status'];
        errorClass?: string | null;
        replayable?: boolean;
        replayAction?: ReplayAction | null;
        sourceReference?: string | null;
        metadata?: Record<string, unknown>;
        incident?: {
            title: string;
            detail?: string | null;
            severity?: IncidentSeverity;
            runbookKey: string;
            replayPayload?: Record<string, unknown>;
        } | null;
    }
) {
    const event = await recordOperationEvent(supabaseAdmin, payload);

    if (payload.incident && payload.status === 'error') {
        await createPlatformIncident(supabaseAdmin, {
            requestId: payload.requestId,
            domain: payload.domain,
            title: payload.incident.title,
            detail: payload.incident.detail || null,
            severity: payload.incident.severity || 'high',
            runbookKey: payload.incident.runbookKey,
            businessId: payload.businessId || null,
            holdingAccountId: payload.holdingAccountId || null,
            countryCode: payload.countryCode || 'CO',
            errorClass: payload.errorClass || null,
            replayable: payload.replayable,
            replayAction: payload.replayAction || null,
            replayPayload: payload.incident.replayPayload || payload.metadata || {},
            metadata: payload.metadata || {},
            sourceReference: payload.sourceReference || null,
            operationEventId: event?.id || null,
        });
    }

    return event;
}

export async function createSupportRequest(
    supabaseAdmin: AdminClient,
    payload: {
        requestId: string;
        requesterName: string;
        requesterEmail: string;
        requestedBy?: string | null;
        businessId?: string | null;
        holdingAccountId?: string | null;
        countryCode?: string | null;
        domain: SupportRequest['domain'];
        category?: SupportRequest['category'];
        assignedTo?: string | null;
        relatedUserId?: string | null;
        relatedBusinessId?: string | null;
        relatedTruckerId?: string | null;
        relatedOfferId?: string | null;
        relatedPaymentId?: string | null;
        relatedWalletTransactionId?: string | null;
        priority?: SupportPriority;
        preferredContactChannel?: SupportRequest['preferred_contact_channel'];
        subject: string;
        description: string;
        metadata?: Record<string, unknown>;
    }
) {
    const normalizedPriority = payload.priority || 'medium';
    const { data, error } = await supabaseAdmin
        .from('support_requests')
        .insert({
            request_id: payload.requestId,
            requester_name: payload.requesterName,
            requester_email: payload.requesterEmail,
            requested_by: payload.requestedBy || null,
            business_id: payload.businessId || null,
            holding_account_id: payload.holdingAccountId || null,
            country_code: payload.countryCode || 'CO',
            domain: payload.domain,
            category: payload.category || 'other',
            assigned_to: payload.assignedTo || null,
            related_user_id: payload.relatedUserId || null,
            related_business_id: payload.relatedBusinessId || null,
            related_trucker_id: payload.relatedTruckerId || null,
            related_offer_id: payload.relatedOfferId || null,
            related_payment_id: payload.relatedPaymentId || null,
            related_wallet_transaction_id: payload.relatedWalletTransactionId || null,
            priority: normalizedPriority,
            preferred_contact_channel: payload.preferredContactChannel || 'email',
            subject: payload.subject,
            description: payload.description,
            sla_due_at: computeSupportSla(normalizedPriority),
            metadata: payload.metadata || {},
        })
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message || 'Could not create support request.');
    }

    await recordOperationEvent(supabaseAdmin, {
        requestId: payload.requestId,
        actorUserId: payload.requestedBy || null,
        actorType: payload.requestedBy ? 'user' : 'anonymous',
        domain: 'support',
        action: 'support_request_created',
        entityType: 'support_request',
        entityId: data.id,
        businessId: payload.businessId || null,
        holdingAccountId: payload.holdingAccountId || null,
        countryCode: payload.countryCode || 'CO',
        status: 'success',
        sourceReference: data.id,
        metadata: {
            priority: normalizedPriority,
            category: payload.category || 'other',
            subject: payload.subject,
            preferred_contact_channel: payload.preferredContactChannel || 'email',
        },
    });

    await capturePosthogServerEvent({
        distinctId: payload.requestedBy || payload.requesterEmail,
        event: 'support_request_created',
        properties: {
            request_id: payload.requestId,
            domain: payload.domain,
            priority: normalizedPriority,
            category: payload.category || 'other',
            country_code: payload.countryCode || 'CO',
            subject: payload.subject,
        },
    });

    return data as SupportRequest;
}

export async function listPlatformIncidents(
    supabaseAdmin: AdminClient,
    options?: {
        status?: string | null;
        domain?: string | null;
        limit?: number;
    }
) {
    let query = supabaseAdmin
        .from('platform_incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options?.limit || 50);

    if (options?.status) {
        query = query.eq('status', options.status);
    }

    if (options?.domain) {
        query = query.eq('domain', options.domain);
    }

    const { data, error } = await query;

    if (error) {
        if (isMissingTableError(error, 'platform_incidents')) {
            return [] as PlatformIncident[];
        }
        throw new Error(error.message || 'Could not list platform incidents.');
    }

    return (data || []) as PlatformIncident[];
}

export async function getPlatformIncident(
    supabaseAdmin: AdminClient,
    incidentId: string
) {
    const { data, error } = await supabaseAdmin
        .from('platform_incidents')
        .select('*')
        .eq('id', incidentId)
        .maybeSingle();

    if (error) {
        if (isMissingTableError(error, 'platform_incidents')) {
            return null;
        }
        throw new Error(error.message || 'Could not load incident.');
    }

    return (data as PlatformIncident | null) ?? null;
}

export async function listSupportRequests(
    supabaseAdmin: AdminClient,
    options?: { limit?: number }
) {
    const { data, error } = await supabaseAdmin
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options?.limit || 50);

    if (error) {
        if (isMissingTableError(error, 'support_requests')) {
            return [] as SupportRequest[];
        }
        throw new Error(error.message || 'Could not load support requests.');
    }

    return (data || []) as SupportRequest[];
}

type CeoCargoOfferRow = {
    id: string;
    status: string | null;
    total_amount: number | null;
    platform_fee: number | null;
    net_amount: number | null;
    is_private_fleet: boolean | null;
    created_at: string | null;
};

type CeoFreightPaymentRow = {
    offer_id: string | null;
    platform_fee: number | null;
    status: string | null;
    created_at: string | null;
};

type CeoPlanPaymentAttemptRow = {
    amount: number | null;
    plan_code: string | null;
    status: string | null;
    paid_at: string | null;
    created_at: string | null;
};

type CeoBusinessSubscriptionRow = {
    business_id: string | null;
    plan_code: string | null;
    status: string | null;
    plan?: {
        code?: string | null;
        name?: string | null;
        price_monthly_cop?: number | null;
        price_monthly_usd?: number | null;
        feature_matrix?: Record<string, unknown> | null;
    } | Array<{
        code?: string | null;
        name?: string | null;
        price_monthly_cop?: number | null;
        price_monthly_usd?: number | null;
        feature_matrix?: Record<string, unknown> | null;
    }> | null;
};

const CEO_SUCCESSFUL_PLAN_PAYMENT_STATUSES = new Set(['approved', 'completed']);

function isMarketplaceOffer(row: Pick<CeoCargoOfferRow, 'is_private_fleet'>) {
    return row.is_private_fleet !== true;
}

function getRowTimestamp(value?: string | null) {
    const timestamp = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function countRowsSince<T extends { created_at?: string | null }>(rows: T[], sinceIso: string) {
    const since = new Date(sinceIso).getTime();
    return rows.filter((row) => getRowTimestamp(row.created_at) >= since).length;
}

function sumRowsSince<T>(
    rows: T[],
    sinceIso: string,
    valueSelector: (row: T) => number,
    dateSelector: (row: T) => string | null | undefined
) {
    const since = new Date(sinceIso).getTime();

    return rows.reduce((total, row) => {
        if (getRowTimestamp(dateSelector(row)) < since) {
            return total;
        }

        return total + valueSelector(row);
    }, 0);
}

export async function getCeoOverviewSnapshot(
    supabaseAdmin: AdminClient,
    requestId: string
): Promise<AdminCeoOverviewResponse> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const monthToDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const [
        totalUsers,
        businessUsers,
        businessProfiles,
        truckerUsers,
        adminUsers,
        newUsers7d,
        newUsers30d,
        pendingWithdrawals,
        payoutsManualReview,
        openIncidents,
        criticalIncidents,
        openSupportRequests,
        pendingApprovals,
        criticalPendingApprovals,
        breachedApprovals,
        dueSoonApprovals,
        activePilotBusinesses,
        offerRows,
        freightPaymentRows,
        planPaymentAttemptRows,
        subscriptionRows,
    ] = await Promise.all([
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true })),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'business')),
        safeCount(supabaseAdmin.from('business_profiles').select('user_id', { count: 'exact', head: true })),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'trucker')),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'admin')),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo)),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo)),
        safeCount(
            supabaseAdmin
                .from('transactions')
                .select('id', { count: 'exact', head: true })
                .eq('type', 'withdrawal')
                .eq('status', 'pending')
        ),
        safeCount(supabaseAdmin.from('payout_attempts').select('id', { count: 'exact', head: true }).eq('status', 'manual_review')),
        safeCount(
            supabaseAdmin
                .from('platform_incidents')
                .select('id', { count: 'exact', head: true })
                .in('status', ['open', 'investigating'])
        ),
        safeCount(
            supabaseAdmin
                .from('platform_incidents')
                .select('id', { count: 'exact', head: true })
                .eq('severity', 'critical')
                .in('status', ['open', 'investigating'])
        ),
        safeCount(
            supabaseAdmin
                .from('support_requests')
                .select('id', { count: 'exact', head: true })
                .in('status', ['open', 'investigating', 'waiting_customer'])
        ),
        safeCount(
            supabaseAdmin
                .from('holding_approval_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
        ),
        safeCount(
            supabaseAdmin
                .from('holding_approval_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .eq('priority', 'critical')
        ),
        safeCount(
            supabaseAdmin
                .from('holding_approval_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .in('aging_bucket', ['breached', 'double_breached'])
        ),
        safeCount(
            supabaseAdmin
                .from('holding_approval_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .eq('aging_bucket', 'due_soon')
        ),
        safeCount(
            supabaseAdmin
                .from('business_pilot_flags')
                .select('business_id', { count: 'exact', head: true })
                .eq('enabled', true)
                .gte('pilot_expires_at', now.toISOString())
        ),
        safeSelectAll<CeoCargoOfferRow>(() =>
            supabaseAdmin
                .from('cargo_offers')
                .select('id, status, total_amount, platform_fee, net_amount, is_private_fleet, created_at')
                .not('status', 'eq', 'draft')
                .order('created_at', { ascending: false })
        ),
        safeSelectAll<CeoFreightPaymentRow>(() =>
            supabaseAdmin
                .from('payments')
                .select('offer_id, platform_fee, status, created_at')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
        ),
        safeSelectAll<CeoPlanPaymentAttemptRow>(() =>
            supabaseAdmin
                .from('billing_plan_payment_attempts')
                .select('amount, plan_code, status, paid_at, created_at')
                .order('created_at', { ascending: false })
        ),
        safeSelectAll<CeoBusinessSubscriptionRow>(() =>
            supabaseAdmin
                .from('business_plan_subscriptions')
                .select('business_id, plan_code, status, plan:billing_plans(code, name, price_monthly_cop, price_monthly_usd, feature_matrix)')
                .in('status', ['active', 'trialing'])
                .order('created_at', { ascending: false })
        ),
    ]);

    const marketplaceOffers = offerRows.filter(isMarketplaceOffer);
    const privateFleetOffers = offerRows.filter((row) => row.is_private_fleet === true);
    const marketplacePaymentsByOfferId = freightPaymentRows.reduce((map, row) => {
        if (!row.offer_id) {
            return map;
        }

        map.set(row.offer_id, (map.get(row.offer_id) || 0) + Number(row.platform_fee || 0));
        return map;
    }, new Map<string, number>());

    const getMarketplaceCommission = (row: CeoCargoOfferRow) => {
        const offerFee = Number(row.platform_fee || 0);
        if (offerFee > 0) {
            return offerFee;
        }

        return marketplacePaymentsByOfferId.get(row.id) || 0;
    };

    const marketplaceGmvCop = marketplaceOffers.reduce((total, row) => total + Number(row.total_amount || 0), 0);
    const privateFleetGmvCop = privateFleetOffers.reduce((total, row) => total + Number(row.total_amount || 0), 0);
    const marketplaceCommissionCop = marketplaceOffers.reduce((total, row) => total + getMarketplaceCommission(row), 0);
    const successfulPlanPaymentRows = planPaymentAttemptRows.filter((row) =>
        CEO_SUCCESSFUL_PLAN_PAYMENT_STATUSES.has(String(row.status || '').toLowerCase())
    );
    const collectedPlanRevenueCop = successfulPlanPaymentRows.reduce((total, row) => total + Number(row.amount || 0), 0);
    const subscriptionByBusiness = subscriptionRows.reduce((map, row) => {
        if (row.business_id && !map.has(row.business_id)) {
            map.set(row.business_id, row);
        }

        return map;
    }, new Map<string, CeoBusinessSubscriptionRow>());
    const paidSubscriptions = Array.from(subscriptionByBusiness.values()).filter((row) => (row.plan_code || 'free') !== 'free');
    const payingBusinessIds = new Set(paidSubscriptions.map((row) => row.business_id).filter(Boolean));
    const planCounts = paidSubscriptions.reduce((counts, row) => {
        const planCode = (row.plan_code || 'other').toLowerCase();

        if (planCode === 'starter') counts.starter += 1;
        else if (planCode === 'growth' || planCode === 'pro') counts.growth += 1;
        else if (planCode === 'scale') counts.scale += 1;
        else if (planCode === 'enterprise') counts.enterprise += 1;
        else counts.other += 1;

        if (row.status === 'trialing') counts.trialing += 1;

        return counts;
    }, { starter: 0, growth: 0, scale: 0, enterprise: 0, other: 0, trialing: 0 });
    const activeMrrCop = paidSubscriptions.reduce((total, row) => {
        const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
        return total + resolveBillingPlanPriceCop({
            price_monthly_cop: Number(plan?.price_monthly_cop || 0),
            price_monthly_usd: Number(plan?.price_monthly_usd || 0),
            feature_matrix: plan?.feature_matrix || {},
        });
    }, 0);
    const statusCounts = offerRows.reduce((counts, row) => {
        const status = String(row.status || '').toLowerCase();

        if (status === 'active' || status === 'published') counts.published += 1;
        else if (status === 'assigned' || status === 'reserved') counts.assigned += 1;
        else if (status === 'in_progress') counts.inProgress += 1;
        else if (status === 'completed' || status === 'delivered') counts.completed += 1;
        else if (status === 'cancelled') counts.cancelled += 1;

        return counts;
    }, { published: 0, assigned: 0, inProgress: 0, completed: 0, cancelled: 0 });
    const getOfferAmount = (row: CeoCargoOfferRow) => Number(row.total_amount || 0);

    return {
        generatedAt: now.toISOString(),
        requestId,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        users: {
            total: Number(totalUsers || 0),
            businesses: Number(businessUsers || 0),
            businessProfiles: Number(businessProfiles || 0),
            truckers: Number(truckerUsers || 0),
            admins: Number(adminUsers || 0),
            new7d: Number(newUsers7d || 0),
            new30d: Number(newUsers30d || 0),
        },
        trips: {
            total: offerRows.length,
            marketplace: marketplaceOffers.length,
            privateFleet: privateFleetOffers.length,
            published: statusCounts.published,
            assigned: statusCounts.assigned,
            inProgress: statusCounts.inProgress,
            completed: statusCounts.completed,
            cancelled: statusCounts.cancelled,
        },
        gmv: {
            marketplaceGmvCop,
            privateFleetGmvCop,
            totalGmvCop: marketplaceGmvCop + privateFleetGmvCop,
        },
        revenue: {
            marketplaceCommissionCop,
            collectedPlanRevenueCop,
            activeMrrCop,
            totalCollectedRevenueCop: marketplaceCommissionCop + collectedPlanRevenueCop,
        },
        plans: {
            freeBusinesses: Math.max(Number(businessProfiles || businessUsers || 0) - payingBusinessIds.size, 0),
            starterBusinesses: planCounts.starter,
            growthBusinesses: planCounts.growth,
            proBusinesses: planCounts.growth,
            scaleBusinesses: planCounts.scale,
            enterpriseBusinesses: planCounts.enterprise,
            otherPaidBusinesses: planCounts.other,
            activePilotBusinesses: Number(activePilotBusinesses || 0),
            trialingPaidBusinesses: planCounts.trialing,
            payingBusinesses: payingBusinessIds.size,
        },
        health: {
            pendingWithdrawals: Number(pendingWithdrawals || 0),
            payoutsManualReview: Number(payoutsManualReview || 0),
            openIncidents: Number(openIncidents || 0),
            criticalIncidents: Number(criticalIncidents || 0),
            openSupportRequests: Number(openSupportRequests || 0),
        },
        approvals: {
            pending: Number(pendingApprovals || 0),
            criticalPending: Number(criticalPendingApprovals || 0),
            breached: Number(breachedApprovals || 0),
            dueSoon: Number(dueSoonApprovals || 0),
        },
        periods: {
            last30Days: {
                newUsers: Number(newUsers30d || 0),
                trips: countRowsSince(offerRows, thirtyDaysAgo),
                marketplaceGmvCop: sumRowsSince(marketplaceOffers, thirtyDaysAgo, getOfferAmount, (row) => row.created_at),
                privateFleetGmvCop: sumRowsSince(privateFleetOffers, thirtyDaysAgo, getOfferAmount, (row) => row.created_at),
                marketplaceCommissionCop: sumRowsSince(marketplaceOffers, thirtyDaysAgo, getMarketplaceCommission, (row) => row.created_at),
                collectedPlanRevenueCop: sumRowsSince(successfulPlanPaymentRows, thirtyDaysAgo, (row) => Number(row.amount || 0), (row) => row.paid_at || row.created_at),
            },
            monthToDate: {
                trips: countRowsSince(offerRows, monthToDate),
                marketplaceGmvCop: sumRowsSince(marketplaceOffers, monthToDate, getOfferAmount, (row) => row.created_at),
                privateFleetGmvCop: sumRowsSince(privateFleetOffers, monthToDate, getOfferAmount, (row) => row.created_at),
                marketplaceCommissionCop: sumRowsSince(marketplaceOffers, monthToDate, getMarketplaceCommission, (row) => row.created_at),
                collectedPlanRevenueCop: sumRowsSince(successfulPlanPaymentRows, monthToDate, (row) => Number(row.amount || 0), (row) => row.paid_at || row.created_at),
            },
        },
    };
}

export async function getAdminOverviewSnapshot(
    supabaseAdmin: AdminClient,
    requestId: string
): Promise<AdminOverviewResponse> {
    const [flags, incidents, supportRequests] = await Promise.all([
        getFeatureFlags(supabaseAdmin),
        listPlatformIncidents(supabaseAdmin, { limit: 12 }),
        listSupportRequests(supabaseAdmin, { limit: 12 }),
    ]);

    const [
        pendingWithdrawals,
        atRiskAdvances,
        breachedApprovals,
        domainIncidentCounts,
        totalUsers,
        businessUsers,
        truckerUsers,
        adminUsers,
        newUsers7d,
        newUsers30d,
        offersPublished,
        offersAssigned,
        offersInProgress,
        offersCompleted,
        offersCancelled,
        dispatchesCreated,
        dispatchesLinked,
        activeFleetDrivers,
        privateOffers,
        payoutManualReview,
        moneyRows,
    ] = await Promise.all([
        safeCount(
            supabaseAdmin
                .from('transactions')
                .select('id', { count: 'exact', head: true })
                .eq('type', 'withdrawal')
                .eq('status', 'pending')
        ),
        safeCount(
            supabaseAdmin
                .from('fuel_advances')
                .select('id', { count: 'exact', head: true })
                .in('status', ['overdue', 'at_risk'])
        ),
        safeCount(
            supabaseAdmin
                .from('holding_approval_requests')
                .select('id', { count: 'exact', head: true })
                .in('aging_bucket', ['breached', 'double_breached'])
                .eq('status', 'pending')
        ),
        safeSelect(
            supabaseAdmin
                .from('platform_incidents')
                .select('domain, severity, status'),
            [] as Array<{ domain: OperationDomain; severity: IncidentSeverity; status: string }>
        ),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true })),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'business')),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'trucker')),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'admin')),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())),
        safeCount(supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())),
        safeCount(supabaseAdmin.from('cargo_offers').select('id', { count: 'exact', head: true }).in('status', ['active', 'published'])),
        safeCount(supabaseAdmin.from('cargo_offers').select('id', { count: 'exact', head: true }).in('status', ['assigned', 'reserved'])),
        safeCount(supabaseAdmin.from('cargo_offers').select('id', { count: 'exact', head: true }).eq('status', 'in_progress')),
        safeCount(supabaseAdmin.from('cargo_offers').select('id', { count: 'exact', head: true }).in('status', ['completed', 'delivered'])),
        safeCount(supabaseAdmin.from('cargo_offers').select('id', { count: 'exact', head: true }).eq('status', 'cancelled')),
        safeCount(supabaseAdmin.from('warehouse_dispatch_orders').select('id', { count: 'exact', head: true })),
        safeCount(supabaseAdmin.from('warehouse_dispatch_orders').select('id', { count: 'exact', head: true }).not('offer_id', 'is', null)),
        safeCount(supabaseAdmin.from('business_fleet_members').select('id', { count: 'exact', head: true }).eq('status', 'active')),
        safeCount(supabaseAdmin.from('cargo_offers').select('id', { count: 'exact', head: true }).eq('is_private_fleet', true)),
        safeCount(supabaseAdmin.from('payout_attempts').select('id', { count: 'exact', head: true }).eq('status', 'manual_review')),
        safeSelect(
            supabaseAdmin
                .from('cargo_offers')
                .select('total_amount, platform_fee, net_amount')
                .not('status', 'eq', 'draft'),
            [] as Array<{ total_amount: number | null; platform_fee: number | null; net_amount: number | null }>
        ),
    ]);

    const { lintStats, readiness } = getLaunchReadinessSnapshot(flags);
    const smokeStatus = getSmokeSuiteSnapshot();
    const riskSummary = getRiskSummarySnapshot(flags, lintStats.warnings);
    const scorecardSnapshot = await getScorecardSnapshot(
        supabaseAdmin,
        readiness.status,
        riskSummary
    );
    const money = moneyRows.reduce((totals, row) => {
        totals.gmv += Number(row.total_amount || 0);
        totals.platformFee += Number(row.platform_fee || 0);
        totals.net += Number(row.net_amount || 0);
        return totals;
    }, { gmv: 0, platformFee: 0, net: 0 });

    const incidentByDomain = new Map<string, { open: number; critical: number }>();
    for (const row of domainIncidentCounts) {
        const current = incidentByDomain.get(row.domain) || { open: 0, critical: 0 };
        if (row.status === 'open' || row.status === 'investigating') {
            current.open += 1;
        }
        if (row.severity === 'critical' && (row.status === 'open' || row.status === 'investigating')) {
            current.critical += 1;
        }
        incidentByDomain.set(row.domain, current);
    }

    const supportByDomain = new Map<string, number>();
    for (const row of supportRequests) {
        if (row.status === 'resolved' || row.status === 'closed') {
            continue;
        }
        supportByDomain.set(row.domain, (supportByDomain.get(row.domain) || 0) + 1);
    }

    const domainCards: AdminOverviewResponse['domains'] = [
        { key: 'payments', title: 'Payments', incidents_open: 0, incidents_critical: 0, queue_open: 0, healthy: true },
        { key: 'wallet', title: 'Wallet', incidents_open: 0, incidents_critical: 0, queue_open: Number(pendingWithdrawals || 0), healthy: true },
        { key: 'payouts', title: 'Payouts', incidents_open: 0, incidents_critical: 0, queue_open: Number(pendingWithdrawals || 0), healthy: true },
        { key: 'warehouse', title: 'Warehouse', incidents_open: 0, incidents_critical: 0, queue_open: 0, healthy: true },
        { key: 'support', title: 'Support', incidents_open: 0, incidents_critical: 0, queue_open: supportRequests.filter((item) => ['open', 'investigating', 'waiting_customer'].includes(item.status)).length, healthy: true },
        { key: 'platform', title: 'Platform', incidents_open: 0, incidents_critical: 0, queue_open: 0, healthy: true },
        { key: 'admin_support', title: 'Admin Control', incidents_open: 0, incidents_critical: 0, queue_open: Number(breachedApprovals || 0), healthy: true },
    ] satisfies AdminOverviewResponse['domains'];

    const normalizedDomainCards: AdminOverviewResponse['domains'] = domainCards.map((domain) => {
        const counts = incidentByDomain.get(domain.key) || { open: 0, critical: 0 };
        const queueOpen = domain.key === 'support'
            ? domain.queue_open
            : domain.key === 'payments'
                ? (supportByDomain.get('payments') || 0)
                : domain.queue_open;

        return {
            ...domain,
            incidents_open: counts.open,
            incidents_critical: counts.critical,
            queue_open: queueOpen,
            healthy: counts.critical === 0 && counts.open < 5,
        };
    });

    return {
        generated_at: new Date().toISOString(),
        request_id: requestId,
        domains: normalizedDomainCards,
        incidents,
        support_requests: supportRequests,
        flags,
        runbooks: RUNBOOKS,
        slos: DOMAIN_SLOS,
        summary: {
            pending_withdrawals: Number(pendingWithdrawals || 0),
            advances_at_risk: Number(atRiskAdvances || 0),
            approvals_breached: Number(breachedApprovals || 0),
            incident_backlog: incidents.filter((item) => ['open', 'investigating'].includes(item.status)).length,
            support_backlog: supportRequests.filter((item) => ['open', 'investigating', 'waiting_customer'].includes(item.status)).length,
        },
        launch_readiness: readiness,
        smoke_status: smokeStatus,
        risk_summary: riskSummary,
        scorecard_snapshot: scorecardSnapshot,
        ceo_control_tower: {
            environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
            users: {
                total: Number(totalUsers || 0),
                businesses: Number(businessUsers || 0),
                truckers: Number(truckerUsers || 0),
                admins: Number(adminUsers || 0),
                new_7d: Number(newUsers7d || 0),
                new_30d: Number(newUsers30d || 0),
            },
            operations: {
                offers_published: Number(offersPublished || 0),
                offers_assigned: Number(offersAssigned || 0),
                offers_in_progress: Number(offersInProgress || 0),
                offers_completed: Number(offersCompleted || 0),
                offers_cancelled: Number(offersCancelled || 0),
                dispatches_created: Number(dispatchesCreated || 0),
                dispatches_linked_to_trips: Number(dispatchesLinked || 0),
            },
            money: {
                gmv_cop: money.gmv,
                platform_fee_cop: money.platformFee,
                net_to_truckers_cop: money.net,
                pending_withdrawals: Number(pendingWithdrawals || 0),
                payout_manual_review: Number(payoutManualReview || 0),
            },
            private_fleet: {
                active_drivers: Number(activeFleetDrivers || 0),
                private_offers: Number(privateOffers || 0),
            },
        },
    };
}

export async function getReliabilitySnapshot(supabaseAdmin: AdminClient) {
    const flags = await getFeatureFlags(supabaseAdmin);
    const upstashEnabled = Boolean(
        process.env.UPSTASH_REDIS_REST_URL?.trim()
        && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
    );
    const qstashEnabled = Boolean(
        process.env.QSTASH_URL?.trim()
        && process.env.QSTASH_TOKEN?.trim()
    );

    const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
    const posthogEnabled = Boolean(
        process.env.POSTHOG_CAPTURE_URL?.trim()
        && (process.env.POSTHOG_API_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim())
    );

    const countries = await safeSelect(
        supabaseAdmin
            .from('country_registry')
            .select('country_code, is_backend_ready, is_visible'),
        [] as Array<{ country_code: string; is_backend_ready: boolean; is_visible: boolean }>
    );

    const { lintStats, readiness } = getLaunchReadinessSnapshot(flags);
    const smokeStatus = getSmokeSuiteSnapshot();
    const riskSummary = getRiskSummarySnapshot(flags, lintStats.warnings);
    const scorecardSnapshot = await getScorecardSnapshot(
        supabaseAdmin,
        readiness.status,
        riskSummary
    );

    return {
        flags,
        integrations: {
            sentry: sentryEnabled,
            posthog: posthogEnabled,
            upstash_redis: upstashEnabled,
            qstash: qstashEnabled,
        },
        countries,
        backups: {
            database_backup_runbook: '/docs/ops/disaster-recovery.md',
            storage_backup_runbook: '/docs/ops/disaster-recovery.md',
            restore_drill_runbook: '/docs/ops/disaster-recovery.md',
        },
        launch_readiness: readiness,
        smoke_status: smokeStatus,
        risk_summary: riskSummary,
        scorecard_snapshot: scorecardSnapshot,
    };
}
