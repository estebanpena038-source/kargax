import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminNotification } from '@/lib/server/route-auth';
import { resolveBusinessRolePolicy } from '@/lib/server/role-policy';
import type { PrivateFleetPayrollPaymentReference } from '@/lib/contracts/payments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseAdminClient = SupabaseClient<any, 'public', any>;

export type PayrollAccessProfile = {
    id: string;
    user_type: 'trucker' | 'business' | 'admin' | 'staff';
} | null;

export const PRIVATE_FLEET_PAYROLL_FEE_PERCENT = Number(process.env.PRIVATE_FLEET_PAYROLL_FEE_PERCENT || 0);
const PRIVATE_FLEET_PAYROLL_WALLET_RELEASE_ENABLED = process.env.PRIVATE_FLEET_PAYROLL_WALLET_RELEASE_ENABLED === 'true';

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
    const policy = await resolveBusinessRolePolicy(supabaseAdmin, authUserId, profile, {
        requestedBusinessId,
    });
    const canManagePayroll = policy.capabilities.canManagePrivateFleetMoney;
    const canViewPayroll = canManagePayroll || policy.capabilities.canViewPrivateFleetMoney;

    return {
        access: policy.access,
        businessId: policy.businessId,
        effectiveRole: policy.effectiveRole,
        capabilities: policy.baseCapabilities,
        policyCapabilities: policy.capabilities,
        scopeError: policy.scopeError,
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

    const paymentMode = String(run.payment_mode || 'external_proof');
    if (paymentMode !== 'mercadopago_funded' || !PRIVATE_FLEET_PAYROLL_WALLET_RELEASE_ENABLED) {
        const nextExternalStatus = paymentMode === 'external_proof' ? 'paid_external' : 'proof_uploaded';

        await supabaseAdmin
            .from('private_fleet_payroll_runs')
            .update({
                status: nextExternalStatus,
                external_payment_status: nextExternalStatus,
                external_paid_at: nextExternalStatus === 'paid_external' ? new Date().toISOString() : run.external_paid_at || null,
                external_payment_method: 'mercadopago',
                external_payment_reference: providerPaymentId,
                funded_payment_id: providerPaymentId,
                funded_at: run.funded_at || new Date().toISOString(),
                gateway_response: mpPayment,
                metadata: {
                    ...(run.metadata || {}),
                    wallet_touched: false,
                    payment_mode: paymentMode,
                    source_kind: 'private_fleet_external_proof',
                },
            })
            .eq('id', run.id);

        await supabaseAdmin
            .from('private_fleet_payroll_items')
            .update({
                status: nextExternalStatus,
                released_at: nextExternalStatus === 'paid_external' ? new Date().toISOString() : null,
                metadata: {
                    source_kind: 'private_fleet_external_proof',
                    wallet_touched: false,
                    mp_payment_id: providerPaymentId,
                },
            })
            .eq('run_id', run.id)
            .eq('business_id', refData.business_id)
            .neq('status', 'released_to_wallet');

        await createAdminNotification(supabaseAdmin, {
            type: 'private_fleet_payroll_external_documented',
            title: 'Nomina privada documentada',
            message: `La empresa ${refData.business_id} documento una liquidacion privada por ${Number(run.gross_amount || 0).toFixed(0)} sin tocar wallet.`,
            data: {
                business_id: refData.business_id,
                payroll_run_id: run.id,
                payment_mode: paymentMode,
                wallet_touched: false,
                mp_payment_id: providerPaymentId,
            },
        });

        return {
            released: true,
            duplicate: false,
            status: nextExternalStatus,
            runId: run.id,
            releasedItems: 0,
            walletTouched: false,
        };
    }

    if (run.status === 'released' && run.funded_payment_id && providerPaymentId && run.funded_payment_id === providerPaymentId) {
        return {
            released: true,
            duplicate: true,
            status: 'released',
            runId: run.id,
            releasedItems: 0,
            walletTouched: true,
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
                money_rail: 'private_fleet_mercadopago_funded',
                source_system: 'mercadopago',
                payout_eligible: false,
                locked_for_payout: false,
                external_proof_only: true,
                metadata: {
                    source_kind: 'private_fleet_salary',
                    source_reference: run.id,
                    payroll_run_id: run.id,
                    payroll_item_id: item.id,
                    business_id: refData.business_id,
                    mp_payment_id: providerPaymentId,
                    period_start: run.period_start,
                    period_end: run.period_end,
                    payment_mode: 'mercadopago_funded',
                    legacy_wallet_funded: true,
                    wallet_touched: true,
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
            p_title: 'Nomina privada financiada por KargaX',
            p_message: `Tu empresa libero ${amount.toFixed(0)} en nomina privada por el flujo legacy financiado. No se mezcla con comprobantes externos.`,
            p_data: {
                payroll_run_id: run.id,
                payroll_item_id: item.id,
                amount,
                wallet_transaction_id: transaction.id,
                payment_mode: 'mercadopago_funded',
                external_proof_only: true,
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
        walletTouched: true,
    };
}
