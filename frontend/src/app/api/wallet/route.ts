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
            .select('id, wallet_id, offer_id, type, status, amount, description, reference_id, metadata, balance_before, balance_after, pending_balance_before, pending_balance_after, created_at')
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
            .select('offer_id, allocation_type, amount, status, created_at, released_at')
            .eq('trucker_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(50);

        const { data: privateFleetPayrollItems } = await supabaseAdmin
            .from('private_fleet_payroll_items')
            .select('id, run_id, amount, status, created_at, released_at')
            .eq('trucker_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(50);

        const flags = await getFeatureFlags(supabaseAdmin);
        const lendingPaused = !isFeatureFlagEnabled(flags, 'lending_enabled', profile?.country_code);
        const advanceSnapshot = auth.context.profile?.user_type === 'trucker' && !lendingPaused
            ? await getTruckerAdvanceSnapshot(supabaseAdmin, authUser.id)
            : null;

        const privateFleetSummary = (privateFleetAllocations || []).reduce((summary, allocation) => {
            const amount = Number(allocation.amount || 0);

            if (allocation.allocation_type === 'freight_payment' || allocation.allocation_type === 'trip_pay') {
                if (allocation.status === 'released_to_wallet') {
                    summary.freightReleasedCop += amount;
                } else {
                    summary.freightHeldCop += amount;
                }
            }

            if (allocation.allocation_type === 'expense_advance' || allocation.allocation_type === 'company_expense') {
                if (allocation.status === 'released_to_wallet') {
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

            if (item.status === 'released_to_wallet') {
                privateFleetSummary.salaryReleasedCop += amount;
            } else {
                privateFleetSummary.salaryPendingCop += amount;
            }
        });

        const settlementTypes = lendingPaused
            ? ['trip_pending', 'trip_deposit', 'private_fleet_salary', 'withdrawal', 'withdrawal_reversal', 'adjustment', 'bonus']
            : ['trip_pending', 'trip_deposit', 'private_fleet_salary', 'withdrawal', 'withdrawal_reversal', 'advance_disbursement', 'advance_repayment', 'advance_interest', 'adjustment', 'bonus'];

        return NextResponse.json({
            wallet,
            transactions: normalizedTransactions,
            pendingWithdrawals,
            settlementTimeline: normalizedTransactions.filter((tx) => settlementTypes.includes(tx.type)),
            defaultPaymentMethod: defaultPaymentMethod || null,
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
