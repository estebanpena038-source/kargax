/**
 * =============================================================================
 * KARGAX - WALLET API ROUTE (SECURE)
 * /api/wallet
 *
 * Returns wallet, transaction history, pending withdrawals, and default payment
 * method using service-role access after validating the caller token.
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { getTruckerAdvanceSnapshot } from '@/lib/server/advances';
import { getFeatureFlags, isFeatureFlagEnabled } from '@/lib/server/feature-flags';
import {
    createPrivateFleetProofSignedUrlMap,
    getPrivateFleetProofDirectUrl,
    getPrivateFleetProofStoragePath,
    resolvePrivateFleetProofDisplayUrl,
} from '@/lib/server/private-fleet-proofs';

const TRANSACTION_SELECT = 'id, wallet_id, offer_id, type, status, amount, description, reference_id, metadata, balance_before, balance_after, pending_balance_before, pending_balance_after, money_rail, payout_eligible, payout_attempt_id, locked_for_payout, external_proof_only, created_at';

function normalizeTransaction(row: Record<string, any>): Record<string, any> {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const sourceKind = typeof metadata.source_kind === 'string' ? metadata.source_kind : row.type;
    const sourceReference = typeof metadata.source_reference === 'string'
        ? metadata.source_reference
        : row.reference_id || row.offer_id || row.id;

    return {
        ...row,
        amount: Number(row.amount || 0),
        balance_before: Number(row.balance_before || 0),
        balance_after: Number(row.balance_after || 0),
        pending_balance_before: Number(row.pending_balance_before || 0),
        pending_balance_after: Number(row.pending_balance_after || 0),
        source_kind: sourceKind,
        source_reference: sourceReference,
        advance_snapshot: metadata.exposure_snapshot || metadata.advance_snapshot || null,
        withdrawal_snapshot: {
            withdrawal_request_id: metadata.withdrawal_request_id || row.reference_id || row.id,
            payment_method: metadata.payment_method || null,
            admin_action: metadata.admin_action || null,
            processed_by: metadata.processed_by || null,
            processed_at: metadata.processed_at || null,
        },
        policy_snapshot: metadata.policy_snapshot || null,
    };
}

function getSourceKind(row: Record<string, any>) {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return typeof metadata.source_kind === 'string'
        ? metadata.source_kind
        : typeof row.source_kind === 'string'
            ? row.source_kind
            : String(row.type || '');
}

function isPrivateFleetFinancialRow(row: Record<string, any>) {
    const sourceKind = getSourceKind(row);
    const moneyRail = String(row.money_rail || '');

    return row.external_proof_only === true
        || row.type === 'private_fleet_salary'
        || moneyRail.startsWith('private_fleet')
        || sourceKind.startsWith('private_fleet');
}

function isMarketplaceEligibleCredit(row: Record<string, any>) {
    const sourceKind = getSourceKind(row);
    const moneyRail = String(row.money_rail || '');

    if (isPrivateFleetFinancialRow(row)) return false;

    if (row.payout_eligible === true) {
        return moneyRail === 'marketplace_freelancer'
            || sourceKind === 'trip_settlement'
            || sourceKind === 'marketplace_freight_release';
    }

    return row.type === 'trip_deposit'
        && row.status === 'completed'
        && (
            moneyRail === 'marketplace_freelancer'
            || sourceKind === 'trip_settlement'
            || sourceKind === 'marketplace_freight_release'
        );
}

function isMarketplacePendingRelease(row: Record<string, any>) {
    const sourceKind = getSourceKind(row);
    const moneyRail = String(row.money_rail || '');

    if (isPrivateFleetFinancialRow(row)) return false;

    return row.type === 'trip_pending'
        && ['pending', 'held', 'completed'].includes(String(row.status || 'pending'))
        && (
            moneyRail === 'marketplace_freelancer'
            || sourceKind === 'payment_capture'
            || sourceKind === 'trip_pending'
        );
}

function getMarketplaceTripKeys(row: Record<string, any>) {
    return [
        row.reference_id ? `reference:${row.reference_id}` : null,
        row.offer_id ? `offer:${row.offer_id}` : null,
    ].filter(Boolean) as string[];
}

function normalizePrivateFleetExternalStatus(row: Record<string, any>) {
    const rawStatus = String(row.external_payment_status || row.status || 'pending_external_pay');

    if (row.status === 'released_to_wallet') return 'paid_external';
    if (rawStatus === 'paid_external') return 'paid_external';
    if (rawStatus === 'proof_uploaded') return 'proof_uploaded';
    if (rawStatus === 'rejected') return 'rejected';
    if (rawStatus === 'cancelled') return 'cancelled';
    return 'pending_external_pay';
}

function getPrivateFleetCompensationMode(allocationType?: string | null) {
    if (allocationType === 'expense_advance' || allocationType === 'company_expense') {
        return 'viaticos';
    }

    if (allocationType === 'freight_payment' || allocationType === 'trip_pay') {
        return 'ruta';
    }

    return 'nomina_mensual';
}

export async function GET(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker') {
        return NextResponse.json(
            { error: 'La billetera operativa esta disponible solo para transportadores' },
            { status: 403 }
        );
    }

    try {
        const { data: existingWallet, error: walletError } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle();

        if (walletError) {
            return NextResponse.json({ error: 'Error fetching wallet data' }, { status: 500 });
        }

        let wallet = existingWallet;

        if (!wallet) {
            const { data: newWallet, error: createError } = await supabaseAdmin
                .from('wallets')
                .insert({
                    user_id: authUser.id,
                    pending_balance: 0,
                    available_balance: 0,
                    total_earned: 0,
                    total_withdrawn: 0,
                    total_trips_completed: 0,
                })
                .select()
                .single();

            if (createError || !newWallet) {
                return NextResponse.json({ error: 'Error creating wallet' }, { status: 500 });
            }

            wallet = newWallet;
        }

        const { data: transactions, error: txError } = await supabaseAdmin
            .from('transactions')
            .select(TRANSACTION_SELECT)
            .eq('wallet_id', wallet.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (txError) {
            return NextResponse.json({ error: 'Error fetching transactions' }, { status: 500 });
        }

        const normalizedTransactions = ((transactions || []) as Array<Record<string, any>>).map(normalizeTransaction);
        const pendingWithdrawals = normalizedTransactions.filter(
            (tx) => tx.type === 'withdrawal' && tx.status === 'pending'
        );

        const { data: balanceTransactions, error: balanceTxError } = await supabaseAdmin
            .from('transactions')
            .select(TRANSACTION_SELECT)
            .eq('wallet_id', wallet.id)
            .order('created_at', { ascending: true });

        if (balanceTxError) {
            return NextResponse.json({ error: 'Error validating wallet rails' }, { status: 500 });
        }

        const railTransactions = ((balanceTransactions || []) as Array<Record<string, any>>).map(normalizeTransaction);

        const { data: defaultPaymentMethod } = await supabaseAdmin
            .from('payment_methods')
            .select('*')
            .eq('user_id', authUser.id)
            .order('is_default', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data: privateFleetAllocations } = await supabaseAdmin
            .from('trip_financial_allocations')
            .select('id, offer_id, allocation_type, amount, status, external_payment_status, external_paid_at, external_payment_method, external_payment_reference, external_payment_proof_url, external_payment_proof_storage_path, external_payment_note, created_at, released_at')
            .eq('trucker_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(50);

        const { data: privateFleetPayrollItems } = await supabaseAdmin
            .from('private_fleet_payroll_items')
            .select('id, run_id, business_id, amount, status, created_at, released_at, metadata')
            .eq('trucker_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(50);

        const payrollRunIds = [...new Set((privateFleetPayrollItems || []).map((item) => item.run_id).filter(Boolean))];
        const { data: privateFleetPayrollRuns } = payrollRunIds.length
            ? await supabaseAdmin
                .from('private_fleet_payroll_runs')
                .select('id, business_id, period_start, period_end, status, payment_mode, external_payment_status, external_paid_at, external_payment_method, external_payment_reference, external_payment_proof_url, external_payment_proof_storage_path, external_payment_note, gross_amount, total_amount')
                .in('id', payrollRunIds)
            : { data: [] as any[] };

        const privateFleetAllocationIds = [...new Set((privateFleetAllocations || []).map((allocation) => allocation.id).filter(Boolean))];
        const { data: allocationProofRows } = privateFleetAllocationIds.length
            ? await supabaseAdmin
                .from('private_fleet_payment_proofs')
                .select('id, allocation_id, proof_url, storage_path, created_at')
                .in('allocation_id', privateFleetAllocationIds)
                .order('created_at', { ascending: false })
            : { data: [] as any[] };
        const { data: payrollProofRows } = payrollRunIds.length
            ? await supabaseAdmin
                .from('private_fleet_payment_proofs')
                .select('id, run_id, proof_url, storage_path, created_at')
                .in('run_id', payrollRunIds)
                .order('created_at', { ascending: false })
            : { data: [] as any[] };
        const visibleProofByAllocationId = new Map<string, Record<string, any>>();
        const visibleProofByRunId = new Map<string, Record<string, any>>();

        (allocationProofRows || []).forEach((proof) => {
            if (!proof.allocation_id || visibleProofByAllocationId.has(proof.allocation_id)) return;
            if (getPrivateFleetProofDirectUrl(proof) || getPrivateFleetProofStoragePath(proof)) {
                visibleProofByAllocationId.set(proof.allocation_id, proof);
            }
        });

        (payrollProofRows || []).forEach((proof) => {
            if (!proof.run_id || visibleProofByRunId.has(proof.run_id)) return;
            if (getPrivateFleetProofDirectUrl(proof) || getPrivateFleetProofStoragePath(proof)) {
                visibleProofByRunId.set(proof.run_id, proof);
            }
        });

        const privateFleetProofSignedUrls = await createPrivateFleetProofSignedUrlMap(
            supabaseAdmin,
            [
                ...(privateFleetAllocations || []).map((allocation) => allocation.external_payment_proof_storage_path),
                ...(privateFleetPayrollRuns || []).map((run) => run.external_payment_proof_storage_path),
                ...(allocationProofRows || []).map((proof) => proof.storage_path),
                ...(payrollProofRows || []).map((proof) => proof.storage_path),
            ]
        );

        const { data: payoutAttempts } = await supabaseAdmin
            .from('payout_attempts')
            .select('id, wallet_transaction_id, provider, method, amount_cop, status, source_kind, offer_id, payment_id, provider_transfer_id, receipt_url, failure_reason, failure_message, attempts_count, next_retry_at, paid_at, failed_at, created_at, updated_at')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(25);

        const flags = await getFeatureFlags(supabaseAdmin);
        const lendingPaused = !isFeatureFlagEnabled(flags, 'lending_enabled', profile?.country_code);
        const advanceSnapshot = auth.context.profile?.user_type === 'trucker' && !lendingPaused
            ? await getTruckerAdvanceSnapshot(supabaseAdmin, authUser.id)
            : null;

        const privateFleetSummary = (privateFleetAllocations || []).reduce((summary, allocation) => {
            const amount = Number(allocation.amount || 0);

            if (allocation.allocation_type === 'freight_payment' || allocation.allocation_type === 'trip_pay') {
                if (allocation.status === 'paid_external' || allocation.external_payment_status === 'paid_external') {
                    summary.freightReleasedCop += amount;
                } else {
                    summary.freightHeldCop += amount;
                }
            }

            if (allocation.allocation_type === 'expense_advance' || allocation.allocation_type === 'company_expense') {
                if (allocation.status === 'paid_external' || allocation.external_payment_status === 'paid_external') {
                    summary.expenseReleasedCop += amount;
                } else {
                    summary.expenseHeldCop += amount;
                }
            }

            summary.totalAllocations += 1;
            return summary;
        }, {
            freightReleasedCop: 0,
            freightHeldCop: 0,
            expenseReleasedCop: 0,
            expenseHeldCop: 0,
            salaryReleasedCop: 0,
            salaryPendingCop: 0,
            totalAllocations: 0,
        });

        (privateFleetPayrollItems || []).forEach((item) => {
            const amount = Number(item.amount || 0);

            if (item.status === 'paid_external') {
                privateFleetSummary.salaryReleasedCop += amount;
            } else {
                privateFleetSummary.salaryPendingCop += amount;
            }
        });

        const marketplaceCredits = railTransactions
            .filter(isMarketplaceEligibleCredit)
            .reduce((sum, tx) => sum + Math.max(Number(tx.amount || 0), 0), 0);
        const marketplaceWithdrawals = railTransactions
            .filter((tx) => tx.type === 'withdrawal' && ['pending', 'approved', 'completed'].includes(String(tx.status || '')))
            .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);
        const releasedMarketplaceTripKeys = new Set(
            railTransactions
                .filter((tx) => tx.type === 'trip_deposit' && isMarketplaceEligibleCredit(tx))
                .flatMap(getMarketplaceTripKeys)
        );
        const marketplacePendingReleaseCop = railTransactions
            .filter(isMarketplacePendingRelease)
            .filter((tx) => !getMarketplaceTripKeys(tx).some((key) => releasedMarketplaceTripKeys.has(key)))
            .reduce((sum, tx) => sum + Math.max(Number(tx.amount || 0), 0), 0);
        const derivedMarketplaceAvailableCop = Math.max(marketplaceCredits - marketplaceWithdrawals, 0);
        const legacyWalletAvailableCop = Number(wallet.available_balance || 0);
        const marketplaceAvailableCop = Math.max(0, Math.min(legacyWalletAvailableCop, derivedMarketplaceAvailableCop));
        const payoutRows = (payoutAttempts || []) as Array<Record<string, any>>;
        const transactionById = new Map(railTransactions.map((tx) => [tx.id, tx]));
        const marketplacePayoutRows = payoutRows.filter((attempt) => {
            const sourceKind = String(attempt.source_kind || '');
            const linkedTransaction = transactionById.get(attempt.wallet_transaction_id);

            return !sourceKind.startsWith('private_fleet')
                && (!linkedTransaction || !isPrivateFleetFinancialRow(linkedTransaction));
        });
        const privatePayoutAttemptLeakCount = payoutRows.length - marketplacePayoutRows.length;
        const privateWithdrawableLeakCount = railTransactions.filter((tx) => (
            isPrivateFleetFinancialRow(tx)
            && (tx.payout_eligible === true || tx.locked_for_payout === true)
        )).length;
        const balanceMismatchCop = legacyWalletAvailableCop - derivedMarketplaceAvailableCop;
        const marketplaceWallet = {
            availableCop: marketplaceAvailableCop,
            pendingReleaseCop: marketplacePendingReleaseCop,
            payoutProcessingCop: marketplacePayoutRows
                .filter((attempt) => ['queued', 'processing', 'failed', 'manual_review'].includes(String(attempt.status || '')))
                .reduce((sum, attempt) => sum + Number(attempt.amount_cop || 0), 0),
            paidThisMonthCop: marketplacePayoutRows
                .filter((attempt) => {
                    if (attempt.status !== 'paid' || !attempt.paid_at) return false;
                    const paidAt = new Date(attempt.paid_at);
                    const now = new Date();
                    return paidAt.getUTCFullYear() === now.getUTCFullYear()
                        && paidAt.getUTCMonth() === now.getUTCMonth();
                })
                .reduce((sum, attempt) => sum + Number(attempt.amount_cop || 0), 0),
            totalPaidCop: marketplacePayoutRows
                .filter((attempt) => attempt.status === 'paid')
                .reduce((sum, attempt) => sum + Number(attempt.amount_cop || 0), 0),
            derivedAvailableCop: derivedMarketplaceAvailableCop,
            legacyWalletAvailableCop,
            balanceMismatchCop,
            canWithdraw: marketplaceAvailableCop >= 50000,
            minimumWithdrawalCop: 50000,
        };

        const payrollRunById = new Map((privateFleetPayrollRuns || []).map((run) => [run.id, run]));
        const privateFleetLedger = (privateFleetPayrollItems || []).reduce((ledger, item) => {
            const amount = Number(item.amount || 0);
            const run = payrollRunById.get(item.run_id) || {};
            const visibleProof = visibleProofByRunId.get(item.run_id) || null;
            const proofPointer = {
                external_payment_proof_url: run.external_payment_proof_url || visibleProof?.proof_url || null,
                external_payment_proof_storage_path: run.external_payment_proof_storage_path || visibleProof?.storage_path || null,
            };
            const externalStatus = normalizePrivateFleetExternalStatus({
                ...item,
                external_payment_status: run.external_payment_status || item.status,
            });
            const normalizedItem = {
                ...item,
                amount,
                kind: 'payroll',
                label: 'Nomina mensual',
                compensation_mode: 'nomina_mensual',
                run,
                external_payment_status: externalStatus,
                payment_mode: run.payment_mode || 'external_proof',
                proof_url: resolvePrivateFleetProofDisplayUrl(proofPointer, privateFleetProofSignedUrls),
                proof_storage_path: getPrivateFleetProofStoragePath(proofPointer),
            };

            if (externalStatus === 'paid_external' || item.status === 'paid_external') {
                ledger.paidExternalCop += amount;
                ledger.payrollPaidExternalCop += amount;
            } else if (externalStatus === 'proof_uploaded' || item.status === 'proof_uploaded') {
                ledger.proofUploadedCop += amount;
                ledger.payrollProofUploadedCop += amount;
            } else {
                ledger.pendingExternalPayCop += amount;
                ledger.payrollPendingExternalCop += amount;
            }

            ledger.items.push(normalizedItem);
            return ledger;
        }, {
            pendingExternalPayCop: 0,
            proofUploadedCop: 0,
            paidExternalCop: 0,
            payrollPendingExternalCop: 0,
            payrollProofUploadedCop: 0,
            payrollPaidExternalCop: 0,
            freightPendingExternalCop: 0,
            freightProofUploadedCop: 0,
            freightPaidExternalCop: 0,
            expensePendingExternalCop: 0,
            expenseProofUploadedCop: 0,
            expensePaidExternalCop: 0,
            legacyWalletFundedCop: 0,
            items: [] as Array<Record<string, any>>,
        });

        (privateFleetAllocations || []).forEach((allocation) => {
            const amount = Number(allocation.amount || 0);
            const externalStatus = normalizePrivateFleetExternalStatus(allocation);
            const allocationType = String(allocation.allocation_type || '');
            const compensationMode = getPrivateFleetCompensationMode(allocationType);
            const visibleProof = visibleProofByAllocationId.get(allocation.id) || null;
            const proofPointer = {
                external_payment_proof_url: allocation.external_payment_proof_url || visibleProof?.proof_url || null,
                external_payment_proof_storage_path: allocation.external_payment_proof_storage_path || visibleProof?.storage_path || null,
            };
            const normalizedItem = {
                ...allocation,
                id: allocation.id,
                amount,
                kind: 'allocation',
                compensation_mode: compensationMode,
                external_payment_status: externalStatus,
                payment_mode: 'external_proof',
                proof_url: resolvePrivateFleetProofDisplayUrl(proofPointer, privateFleetProofSignedUrls),
                proof_storage_path: getPrivateFleetProofStoragePath(proofPointer),
                label: allocationType === 'expense_advance' || allocationType === 'company_expense'
                    ? 'Viaticos privados'
                    : 'Flete privado',
                run: {
                    period_start: allocation.created_at ? String(allocation.created_at).slice(0, 10) : 'Viaje privado',
                    period_end: allocation.external_paid_at ? String(allocation.external_paid_at).slice(0, 10) : 'pendiente',
                    external_payment_method: allocation.external_payment_method || 'comprobante externo',
                    external_payment_reference: allocation.external_payment_reference || null,
                },
            };

            if (externalStatus === 'paid_external') {
                privateFleetLedger.paidExternalCop += amount;
                if (compensationMode === 'viaticos') {
                    privateFleetLedger.expensePaidExternalCop += amount;
                } else {
                    privateFleetLedger.freightPaidExternalCop += amount;
                }
            } else if (externalStatus === 'proof_uploaded') {
                privateFleetLedger.proofUploadedCop += amount;
                if (compensationMode === 'viaticos') {
                    privateFleetLedger.expenseProofUploadedCop += amount;
                } else {
                    privateFleetLedger.freightProofUploadedCop += amount;
                }
            } else if (!['rejected', 'cancelled'].includes(externalStatus)) {
                privateFleetLedger.pendingExternalPayCop += amount;
                if (compensationMode === 'viaticos') {
                    privateFleetLedger.expensePendingExternalCop += amount;
                } else {
                    privateFleetLedger.freightPendingExternalCop += amount;
                }
            }

            privateFleetLedger.items.push(normalizedItem);
        });

        privateFleetLedger.items.sort((a, b) => {
            const aTime = new Date(String(a.created_at || a.run?.period_start || 0)).getTime();
            const bTime = new Date(String(b.created_at || b.run?.period_start || 0)).getTime();
            return bTime - aTime;
        });

        const settlementTypes = lendingPaused
            ? ['trip_pending', 'trip_deposit', 'withdrawal', 'withdrawal_reversal', 'adjustment', 'bonus']
            : ['trip_pending', 'trip_deposit', 'withdrawal', 'withdrawal_reversal', 'advance_disbursement', 'advance_repayment', 'advance_interest', 'adjustment', 'bonus'];

        return NextResponse.json({
            wallet,
            transactions: normalizedTransactions,
            pendingWithdrawals,
            settlementTimeline: normalizedTransactions.filter((tx) => settlementTypes.includes(tx.type) && !isPrivateFleetFinancialRow(tx)),
            defaultPaymentMethod: defaultPaymentMethod || null,
            marketplaceWallet,
            privateFleetLedger,
            payoutAttempts: marketplacePayoutRows.map((attempt) => ({
                ...attempt,
                amount_cop: Number(attempt.amount_cop || 0),
            })),
            financialRailAudit: {
                legacyWalletAvailableCop,
                derivedMarketplaceAvailableCop,
                withdrawableMarketplaceCop: marketplaceAvailableCop,
                balanceMismatchCop,
                privateWithdrawableLeakCount,
                privatePayoutAttemptLeakCount,
            },
            advancesSummary: advanceSnapshot?.summary || null,
            activeAdvances: advanceSnapshot?.activeAdvances || [],
            overdueAdvances: advanceSnapshot?.overdueAdvances || [],
            eligibleAdvanceAmount: advanceSnapshot?.summary.maxEligibleAmount || 0,
            eligibleAdvanceOffers: advanceSnapshot?.eligibleOffers || [],
            lendingSettings: advanceSnapshot?.settings || null,
            lendingPaused,
            privateFleetSummary,
            privateFleetAllocations: privateFleetAllocations || [],
            privateFleetPayrollItems: privateFleetPayrollItems || [],
        });
    } catch (error) {
        console.error('[Wallet API] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
