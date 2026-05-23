import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminNotification } from '@/lib/server/route-auth';
import { resolveBusinessAccessContext } from '@/lib/server/warehouses';
import { getBusinessRoleCapabilities } from '@/lib/business-roles';
import type { PrivateFleetPayrollPaymentReference } from '@/lib/contracts/payments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

export type PayrollAccessProfile = {
    id: string;
    user_type: 'trucker' | 'business' | 'admin';
} | null;

export const PRIVATE_FLEET_PAYROLL_FEE_PERCENT = Number(process.env.PRIVATE_FLEET_PAYROLL_FEE_PERCENT || 0);

export function getPayrollFeeAmount(grossAmount: number) {
    const feePercent = Number.isFinite(PRIVATE_FLEET_PAYROLL_FEE_PERCENT)
        ? Math.max(0, PRIVATE_FLEET_PAYROLL_FEE_PERCENT)
        : 0;

    return Math.round((Math.max(0, grossAmount) * feePercent) / 100);
}

export async function resolvePrivateFleetPayrollAccess(
    supabaseAdmin: SupabaseAdminClient,
    authUserId: string,
    profile: PayrollAccessProfile,
    requestedBusinessId?: string | null
) {
    const access = await resolveBusinessAccessContext(supabaseAdmin, authUserId, profile);
    const businessId = profile?.user_type === 'admin'
        ? requestedBusinessId?.trim() || access.businessId || null
        : access.businessId;

    const effectiveRole = profile?.user_type === 'admin'
        ? 'admin'
        : access.isOwner
            ? 'owner'
            : access.teamMember?.role || 'viewer';
    const capabilities = getBusinessRoleCapabilities(effectiveRole);
    const canManagePayroll = profile?.user_type === 'admin'
        || access.isOwner
        || access.teamMember?.role === 'finance_accountant';
    const canViewPayroll = canManagePayroll || capabilities.canViewFinance;

    return {
        access,
        businessId,
        effectiveRole,
        capabilities,
        canManagePayroll,
        canViewPayroll,
    };
}

async function getOrCreateWallet(supabaseAdmin: SupabaseAdminClient, userId: string) {
    const { data: wallet, error } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Could not load wallet.');
    }

    if (wallet) {
        return wallet as Record<string, any>;
    }

    const { data: newWallet, error: createError } = await supabaseAdmin
        .from('wallets')
        .insert({
            user_id: userId,
            pending_balance: 0,
            available_balance: 0,
            total_earned: 0,
            total_withdrawn: 0,
            total_trips_completed: 0,
        })
        .select('*')
        .single();

    if (createError || !newWallet) {
        throw new Error(createError?.message || 'Could not create wallet.');
    }

    return newWallet as Record<string, any>;
}

export async function releasePrivateFleetPayrollRun(
    supabaseAdmin: SupabaseAdminClient,
    refData: PrivateFleetPayrollPaymentReference,
    mpPayment: {
        id?: string | number;
        status?: string | null;
        status_detail?: string | null;
        external_reference?: string | null;
        metadata?: Record<string, unknown> | null;
        order?: { id?: string | number } | null;
    }
) {
    const providerPaymentId = mpPayment.id ? String(mpPayment.id) : null;

    const { data: run, error: runError } = await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .select('*')
        .eq('id', refData.run_id)
        .eq('business_id', refData.business_id)
        .maybeSingle();

    if (runError || !run) {
        throw new Error(runError?.message || 'Payroll run not found.');
    }

    if (mpPayment.status !== 'approved') {
        const nextStatus = ['rejected', 'cancelled', 'failed'].includes(String(mpPayment.status || '').toLowerCase())
            ? 'failed'
            : 'checkout_pending';

        await supabaseAdmin
            .from('private_fleet_payroll_runs')
            .update({
                status: nextStatus,
                funded_payment_id: providerPaymentId,
                gateway_response: mpPayment,
            })
            .eq('id', run.id);

        return {
            released: false,
            duplicate: false,
            status: nextStatus,
            runId: run.id,
            releasedItems: 0,
        };
    }

    if (run.status === 'released' && run.funded_payment_id && providerPaymentId && run.funded_payment_id === providerPaymentId) {
        return {
            released: true,
            duplicate: true,
            status: 'released',
            runId: run.id,
            releasedItems: 0,
        };
    }

    await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .update({
            status: 'funded',
            funded_payment_id: providerPaymentId,
            funded_at: run.funded_at || new Date().toISOString(),
            gateway_response: mpPayment,
        })
        .eq('id', run.id);

    const { data: items, error: itemsError } = await supabaseAdmin
        .from('private_fleet_payroll_items')
        .select('*')
        .eq('run_id', run.id)
        .eq('business_id', refData.business_id)
        .neq('status', 'released_to_wallet');

    if (itemsError) {
        throw new Error(itemsError.message || 'Could not load payroll items.');
    }

    let releasedItems = 0;

    for (const item of (items || []) as Array<Record<string, any>>) {
        const amount = Number(item.amount || 0);
        if (amount <= 0 || item.wallet_transaction_id) {
            continue;
        }

        const wallet = await getOrCreateWallet(supabaseAdmin, item.trucker_id);
        const availableBefore = Number(wallet.available_balance || 0);
        const pendingBefore = Number(wallet.pending_balance || 0);
        const availableAfter = availableBefore + amount;

        const { error: walletUpdateError } = await supabaseAdmin
            .from('wallets')
            .update({
                available_balance: availableAfter,
                total_earned: Number(wallet.total_earned || 0) + amount,
                updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id);

        if (walletUpdateError) {
            throw new Error(walletUpdateError.message || 'Could not update wallet.');
        }

        const { data: transaction, error: transactionError } = await supabaseAdmin
            .from('transactions')
            .insert({
                wallet_id: wallet.id,
                offer_id: null,
                type: 'private_fleet_salary',
                status: 'completed',
                amount,
                balance_before: availableBefore,
                balance_after: availableAfter,
                pending_balance_before: pendingBefore,
                pending_balance_after: pendingBefore,
                description: `Nomina flota privada ${String(run.period_start).slice(0, 7)}`,
                reference_id: run.id,
                metadata: {
                    source_kind: 'private_fleet_salary',
                    source_reference: run.id,
                    payroll_run_id: run.id,
                    payroll_item_id: item.id,
                    business_id: refData.business_id,
                    mp_payment_id: providerPaymentId,
                    period_start: run.period_start,
                    period_end: run.period_end,
                },
            })
            .select('id')
            .single();

        if (transactionError || !transaction) {
            throw new Error(transactionError?.message || 'Could not create payroll transaction.');
        }

        const releasedAt = new Date().toISOString();
        const { error: itemUpdateError } = await supabaseAdmin
            .from('private_fleet_payroll_items')
            .update({
                status: 'released_to_wallet',
                wallet_transaction_id: transaction.id,
                released_at: releasedAt,
                metadata: {
                    ...(item.metadata || {}),
                    wallet_transaction_id: transaction.id,
                    mp_payment_id: providerPaymentId,
                },
            })
            .eq('id', item.id);

        if (itemUpdateError) {
            throw new Error(itemUpdateError.message || 'Could not update payroll item.');
        }

        await supabaseAdmin.rpc('create_notification', {
            p_user_id: item.trucker_id,
            p_type: 'private_fleet_salary_released',
            p_title: 'Nomina privada disponible',
            p_message: `Tu empresa libero ${amount.toFixed(0)} en nomina privada a tu billetera KargaX.`,
            p_data: {
                payroll_run_id: run.id,
                payroll_item_id: item.id,
                amount,
                wallet_transaction_id: transaction.id,
            },
        });

        releasedItems += 1;
    }

    await supabaseAdmin
        .from('private_fleet_payroll_runs')
        .update({
            status: 'released',
            released_at: new Date().toISOString(),
        })
        .eq('id', run.id);

    await createAdminNotification(supabaseAdmin, {
        type: 'private_fleet_payroll_released',
        title: 'Nomina flota privada liberada',
        message: `La empresa ${refData.business_id} libero una nomina privada por ${Number(run.gross_amount || 0).toFixed(0)}.`,
        data: {
            business_id: refData.business_id,
            payroll_run_id: run.id,
            released_items: releasedItems,
            mp_payment_id: providerPaymentId,
        },
    });

    return {
        released: true,
        duplicate: false,
        status: 'released',
        runId: run.id,
        releasedItems,
    };
}
