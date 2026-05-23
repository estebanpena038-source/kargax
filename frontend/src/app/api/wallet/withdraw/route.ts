/**
 * =============================================================================
 * KARGAX - WITHDRAWAL REQUEST API
 * /api/wallet/withdraw
 *
 * Creates a pending withdrawal request, reserves available balance, stores the
 * selected payment method, and notifies admin operations.
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminNotification, requireAal2Route } from '@/lib/server/route-auth';
import { getFeatureFlags, isFeatureFlagEnabled } from '@/lib/server/feature-flags';

const ADMIN_EMAIL = 'contactokargax@gmail.com';
const MIN_WITHDRAWAL_AMOUNT = 50000;

interface WithdrawalRequest {
    amount: number;
    paymentMethod: 'nequi' | 'savings' | 'checking';
    bankDetails: {
        bankName?: string;
        accountNumber: string;
        accountHolderName: string;
        documentType?: string;
        documentNumber?: string;
    };
    saveMethod: boolean;
}

interface WithdrawalAdminNotification {
    request_id: string;
    trucker: {
        id: string;
        name: string;
        email: string | null;
        phone: string;
    };
    wallet: {
        total_balance: number;
        amount_requested: number;
        remaining_balance: number;
    };
    payment: {
        method: string;
        bank?: string;
        account_number: string;
        account_holder: string;
        document: string | null;
    };
    created_at: string;
}

type CanonicalPayoutMethod = 'nequi' | 'bancolombia_savings' | 'bancolombia_checking' | 'other_bank';
type PayoutProvider = 'nequi' | 'wompi' | 'manual';

function normalizeDigits(value: string | undefined | null) {
    return (value || '').replace(/\D/g, '');
}

function normalizeText(value: string | undefined | null) {
    return (value || '').trim();
}

function validateWithdrawalInput(body: WithdrawalRequest) {
    const amount = Number(body.amount);
    const method = body.paymentMethod;
    const bankName = normalizeText(body.bankDetails?.bankName);
    const accountNumber = normalizeDigits(body.bankDetails?.accountNumber);
    const accountHolderName = normalizeText(body.bankDetails?.accountHolderName);
    const documentType = normalizeText(body.bankDetails?.documentType) || 'CC';
    const documentNumber = normalizeDigits(body.bankDetails?.documentNumber);

    if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
        return { error: 'Monto minimo: $50,000' };
    }

    if (!['nequi', 'savings', 'checking'].includes(method)) {
        return { error: 'Metodo de retiro invalido' };
    }

    if (!accountHolderName) {
        return { error: 'Ingresa el nombre del titular de la cuenta o billetera' };
    }

    if (!documentNumber) {
        return { error: 'Ingresa el documento del titular' };
    }

    if (method === 'nequi') {
        if (!/^3\d{9}$/.test(accountNumber)) {
            return { error: 'Ingresa un numero Nequi valido de 10 digitos' };
        }
    } else {
        if (!bankName) {
            return { error: 'Selecciona el banco de destino' };
        }

        if (accountNumber.length < 6) {
            return { error: 'Ingresa un numero de cuenta valido' };
        }
    }

    return {
        amount,
        paymentMethod: method as WithdrawalRequest['paymentMethod'],
        bankDetails: {
            bankName: method === 'nequi' ? 'Nequi' : bankName,
            accountNumber,
            accountHolderName,
            documentType,
            documentNumber,
        },
    };
}

function mapPaymentMethodSaveError(error: { message?: string } | null | undefined) {
    const message = error?.message || '';
    const normalized = message.toLowerCase();

    if (
        normalized.includes('no unique or exclusion constraint matching the on conflict specification')
        || normalized.includes('there is no unique or exclusion constraint matching the on conflict specification')
    ) {
        return 'No pudimos guardar este metodo de retiro. Intenta de nuevo o desactiva guardar metodo.';
    }

    return 'No pudimos guardar este metodo de retiro. Intenta de nuevo o desactiva guardar metodo.';
}

function mapWithdrawalRpcError(errorMessage?: string | null, resultMessage?: string | null) {
    const combined = `${errorMessage || ''} ${resultMessage || ''}`.toLowerCase();

    if (combined.includes('insuficiente') || combined.includes('insufficient')) {
        return 'Saldo insuficiente para crear el retiro';
    }

    if (combined.includes('wallet') && combined.includes('not found')) {
        return 'Billetera no encontrada';
    }

    if (combined.includes('invalid') || combined.includes('invalido')) {
        return 'No pudimos crear la solicitud de retiro. Verifica el monto e intenta de nuevo.';
    }

    return 'No pudimos crear la solicitud de retiro. Intenta nuevamente en unos minutos.';
}

function toCanonicalPayoutMethod(
    method: WithdrawalRequest['paymentMethod'],
    bankName: string | undefined
): CanonicalPayoutMethod {
    if (method === 'nequi') return 'nequi';

    const normalizedBank = (bankName || '').toLowerCase();
    const isBancolombia = normalizedBank.includes('bancolombia');

    if (isBancolombia && method === 'savings') return 'bancolombia_savings';
    if (isBancolombia && method === 'checking') return 'bancolombia_checking';
    return 'other_bank';
}

function resolvePayoutProvider(method: CanonicalPayoutMethod, automaticPayoutsEnabled: boolean): PayoutProvider {
    if (!automaticPayoutsEnabled) return 'manual';
    if (method === 'nequi') return 'nequi';
    return 'wompi';
}

export async function POST(request: NextRequest) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    if (profile?.user_type !== 'trucker') {
        return NextResponse.json({ error: 'Solo transportadores pueden retirar saldo' }, { status: 403 });
    }

    try {
        const body: WithdrawalRequest = await request.json();
        const validated = validateWithdrawalInput(body);
        if ('error' in validated) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        const { amount, paymentMethod, bankDetails } = validated;
        const saveMethod = Boolean(body.saveMethod);
        const flags = await getFeatureFlags(supabaseAdmin);
        const lendingEnabled = isFeatureFlagEnabled(flags, 'lending_enabled', profile?.country_code);
        const automaticPayoutsEnabled = isFeatureFlagEnabled(flags, 'automatic_payouts_enabled', profile?.country_code);
        const canonicalPayoutMethod = toCanonicalPayoutMethod(paymentMethod, bankDetails.bankName);
        const payoutProvider = resolvePayoutProvider(canonicalPayoutMethod, automaticPayoutsEnabled);

        const { data: wallet, error: walletError } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('user_id', authUser.id)
            .single();

        if (walletError || !wallet) {
            return NextResponse.json({ error: 'Billetera no encontrada' }, { status: 404 });
        }

        if (lendingEnabled) {
            await supabaseAdmin.rpc('mark_overdue_fuel_advances');

            if (Number(wallet.available_balance || 0) > 0) {
                const { error: sweepError } = await supabaseAdmin.rpc('apply_advance_repayments', {
                    p_wallet_id: wallet.id,
                    p_offer_id: null,
                    p_max_amount: wallet.available_balance,
                    p_source: 'wallet_sweep',
                });

                if (sweepError) {
                    return NextResponse.json({ error: sweepError.message }, { status: 500 });
                }
            }
        }

        const { data: refreshedWallet, error: refreshedWalletError } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('id', wallet.id)
            .single();

        if (refreshedWalletError || !refreshedWallet) {
            return NextResponse.json({ error: 'No se pudo refrescar la billetera' }, { status: 500 });
        }

        if (Number(amount) > Number(refreshedWallet.available_balance || 0)) {
            return NextResponse.json({ error: 'Saldo insuficiente para crear el retiro' }, { status: 400 });
        }

        const methodData = {
            user_id: authUser.id,
            method_type: paymentMethod,
            bank_name: bankDetails.bankName,
            account_number: bankDetails.accountNumber,
            account_holder_name: bankDetails.accountHolderName,
            document_type: bankDetails.documentType,
            document_number: bankDetails.documentNumber,
            is_default: true,
        };

        if (saveMethod) {
            await supabaseAdmin
                .from('payment_methods')
                .update({ is_default: false })
                .eq('user_id', authUser.id);

            const { error: paymentMethodError } = await supabaseAdmin
                .from('payment_methods')
                .upsert(methodData, {
                    onConflict: 'user_id,method_type,account_number',
                });

            if (paymentMethodError) {
                return NextResponse.json({ error: mapPaymentMethodSaveError(paymentMethodError) }, { status: 500 });
            }
        }

        const balanceBefore = Number(refreshedWallet.available_balance || 0);
        const { data: withdrawalResult, error: withdrawalError } = await supabaseAdmin.rpc('create_withdrawal_request', {
            p_user_id: authUser.id,
            p_amount: Number(amount),
            p_payment_method: paymentMethod,
            p_payment_details: {
                payment_method: paymentMethod,
                bank_name: methodData.bank_name,
                account_number: bankDetails.accountNumber,
                account_holder_name: bankDetails.accountHolderName,
                document_type: bankDetails.documentType,
                document_number: bankDetails.documentNumber,
                source_kind: 'withdrawal_request',
                payout_method: canonicalPayoutMethod,
                payout_provider: payoutProvider,
                automatic_payouts_enabled: automaticPayoutsEnabled,
            },
        });

        const withdrawalRequest = Array.isArray(withdrawalResult) ? withdrawalResult[0] : null;

        if (withdrawalError || !withdrawalRequest?.success || !withdrawalRequest?.request_id) {
            return NextResponse.json({
                error: mapWithdrawalRpcError(withdrawalError?.message, withdrawalRequest?.message),
            }, { status: 500 });
        }

        const balanceAfter = Number(withdrawalRequest.available_balance_after || 0);
        const idempotencyKey = `withdrawal:${withdrawalRequest.request_id}:${Number(amount).toFixed(2)}`;
        const payoutStatus = automaticPayoutsEnabled ? 'queued' : 'manual_review';

        const { data: payoutAttempt, error: payoutAttemptError } = await supabaseAdmin
            .from('payout_attempts')
            .upsert({
                wallet_transaction_id: withdrawalRequest.request_id,
                user_id: authUser.id,
                provider: payoutProvider,
                method: canonicalPayoutMethod,
                amount_cop: Number(amount),
                status: payoutStatus,
                idempotency_key: idempotencyKey,
                provider_payload: {
                    bank_name: bankDetails.bankName,
                    account_holder_name: bankDetails.accountHolderName,
                    document_type: bankDetails.documentType,
                    document_number_last4: bankDetails.documentNumber.slice(-4),
                    account_number_last4: bankDetails.accountNumber.slice(-4),
                    automatic_payouts_enabled: automaticPayoutsEnabled,
                },
            }, { onConflict: 'idempotency_key' })
            .select('id, status, provider, method')
            .single();

        if (payoutAttemptError) {
            return NextResponse.json({ error: payoutAttemptError.message || 'No se pudo crear el intento de payout' }, { status: 500 });
        }

        const { data: withdrawalTransaction } = await supabaseAdmin
            .from('transactions')
            .select('metadata')
            .eq('id', withdrawalRequest.request_id)
            .maybeSingle();

        const existingMetadata = withdrawalTransaction?.metadata
            && typeof withdrawalTransaction.metadata === 'object'
            && !Array.isArray(withdrawalTransaction.metadata)
            ? withdrawalTransaction.metadata
            : {};

        await supabaseAdmin
            .from('transactions')
            .update({
                metadata: {
                    ...existingMetadata,
                    payment_method: paymentMethod,
                    requested_by: authUser.id,
                    source_kind: 'withdrawal_request',
                    payout_attempt_id: payoutAttempt?.id,
                    payout_status: payoutAttempt?.status,
                    payout_provider: payoutAttempt?.provider,
                    payout_method: payoutAttempt?.method,
                    automatic_payouts_enabled: automaticPayoutsEnabled,
                },
            })
            .eq('id', withdrawalRequest.request_id);

        const notificationData = {
            request_id: withdrawalRequest.request_id,
            trucker: {
                id: authUser.id,
                name: profile?.full_name || 'Sin nombre',
                email: profile?.email || authUser.email,
                phone: profile?.phone || 'Sin telefono',
            },
            wallet: {
                total_balance: balanceBefore,
                amount_requested: Number(amount),
                remaining_balance: balanceAfter,
            },
            payment: {
                method: paymentMethod === 'nequi'
                    ? 'Nequi'
                    : paymentMethod === 'savings'
                        ? 'Cuenta de Ahorros'
                        : 'Cuenta Corriente',
                bank: methodData.bank_name,
                account_number: bankDetails.accountNumber,
                account_holder: bankDetails.accountHolderName,
                document: bankDetails.documentNumber
                    ? `${bankDetails.documentType}: ${bankDetails.documentNumber}`
                    : null,
            },
            created_at: new Date().toISOString(),
        };

        await createAdminNotification(supabaseAdmin, {
            type: 'withdrawal_request',
            title: `Solicitud de retiro: ${formatCOP(amount)}`,
            message: `${profile?.full_name || 'Camionero'} solicita retiro de ${formatCOP(amount)} a ${notificationData.payment.method}.`,
            data: notificationData,
        });

        try {
            await sendAdminEmailNotification(notificationData);
        } catch (emailError) {
            console.error('[Withdrawal] Email notification failed:', emailError);
        }

        return NextResponse.json({
            success: true,
            message: 'Solicitud de retiro creada. Queda pendiente de aprobacion administrativa.',
            request_id: withdrawalRequest.request_id,
            payout: payoutAttempt,
        });
    } catch (error) {
        console.error('[Withdrawal] Unexpected error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

function formatCOP(value: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

async function sendAdminEmailNotification(data: WithdrawalAdminNotification) {
    console.log('[Withdrawal] Admin notification:', JSON.stringify(data, null, 2));

    if (process.env.RESEND_API_KEY) {
        const emailContent = `
            <h2>Nueva Solicitud de Retiro</h2>
            <h3>Datos del camionero:</h3>
            <ul>
                <li><strong>Nombre:</strong> ${data.trucker.name}</li>
                <li><strong>Email:</strong> ${data.trucker.email}</li>
                <li><strong>Telefono:</strong> ${data.trucker.phone}</li>
            </ul>
            <h3>Detalles del retiro:</h3>
            <ul>
                <li><strong>Saldo total:</strong> ${formatCOP(data.wallet.total_balance)}</li>
                <li><strong>Monto solicitado:</strong> ${formatCOP(data.wallet.amount_requested)}</li>
                <li><strong>Saldo restante:</strong> ${formatCOP(data.wallet.remaining_balance)}</li>
            </ul>
            <h3>Datos bancarios:</h3>
            <ul>
                <li><strong>Metodo:</strong> ${data.payment.method}</li>
                <li><strong>Banco:</strong> ${data.payment.bank}</li>
                <li><strong>Numero de cuenta:</strong> ${data.payment.account_number}</li>
                <li><strong>Titular:</strong> ${data.payment.account_holder}</li>
                ${data.payment.document ? `<li><strong>Documento:</strong> ${data.payment.document}</li>` : ''}
            </ul>
            <p><strong>ID Solicitud:</strong> ${data.request_id}</p>
            <p><strong>Fecha:</strong> ${new Date(data.created_at).toLocaleString('es-CO')}</p>
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'KargaX <noreply@kargax.com>',
                to: ADMIN_EMAIL,
                subject: `Solicitud de retiro: ${formatCOP(data.wallet.amount_requested)} - ${data.trucker.name}`,
                html: emailContent,
            }),
        });
    }
}
