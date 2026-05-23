'use client';

/**
 * =============================================================================
 * KARGAX - WALLET DASHBOARD
 * /billetera
 *
 * Billetera operativa con retiros a Nequi y cuentas bancarias.
 * =============================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowDownCircle,
    ArrowUpCircle,
    BadgeCheck,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Coins,
    CreditCard,
    DollarSign,
    History,
    Landmark,
    Loader2,
    Mail,
    ShieldCheck,
    Smartphone,
    Truck,
    Wallet,
    X,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui';
import { formatCOP } from '@/constants/colombia';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { AdvancesSection } from '@/components/wallet/AdvancesSection';
import type {
    AdvanceSummary,
    EligibleAdvanceOffer,
    FuelAdvanceListItem,
    LendingSettingsSnapshot,
} from '@/lib/advances/types';

interface WalletData {
    id: string;
    pending_balance: number;
    available_balance: number;
    total_earned: number;
    total_withdrawn: number;
    total_trips_completed: number;
}

interface Transaction {
    id: string;
    type: string;
    status?: string;
    amount: number;
    description: string;
    reference_id?: string | null;
    balance_before?: number;
    balance_after?: number;
    pending_balance_before?: number;
    pending_balance_after?: number;
    source_kind?: string;
    source_reference?: string;
    advance_snapshot?: Record<string, unknown> | null;
    withdrawal_snapshot?: Record<string, unknown> | null;
    policy_snapshot?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    created_at: string;
}

interface SavedPaymentMethod {
    method_type: PaymentMethodType;
    bank_name?: string | null;
    account_number: string;
    account_holder_name?: string | null;
}

type PaymentMethodType = 'nequi' | 'savings' | 'checking';

interface BankDetails {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    documentType: string;
    documentNumber: string;
}

interface PrivateFleetSummary {
    freightReleasedCop: number;
    freightHeldCop: number;
    expenseReleasedCop: number;
    expenseHeldCop: number;
    salaryReleasedCop?: number;
    salaryPendingCop?: number;
    totalAllocations: number;
}

const MIN_WITHDRAWAL_AMOUNT = 50000;

const COLOMBIAN_BANKS = [
    'Bancolombia',
    'Banco de Bogota',
    'Davivienda',
    'BBVA Colombia',
    'Banco de Occidente',
    'Banco Popular',
    'Banco Caja Social',
    'Banco Agrario',
    'Banco AV Villas',
    'Banco Falabella',
    'Banco Pichincha',
    'Scotiabank Colpatria',
    'Banco Itau',
    'Banco GNB Sudameris',
    'Citibank',
];

const PAYOUT_STEPS = [
    {
        title: 'Solicitado',
        description: 'La solicitud queda registrada con referencia interna.',
    },
    {
        title: 'En revision',
        description: 'Operaciones valida saldo, titular, documento y destino.',
    },
    {
        title: 'Aprobado',
        description: 'El retiro pasa a giro manual o proveedor configurado.',
    },
    {
        title: 'Pagado',
        description: 'El dinero fue marcado como enviado al metodo elegido.',
    },
    {
        title: 'Rechazado/devuelto',
        description: 'Si falla la validacion, el saldo vuelve a la billetera.',
    },
];

function validateWithdrawalDetails(
    amount: number,
    selectedMethod: PaymentMethodType | null,
    bankDetails: BankDetails,
    availableBalance: number
) {
    if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
        return 'Monto minimo: $50,000';
    }

    if (amount > availableBalance) {
        return 'Saldo insuficiente';
    }

    if (!selectedMethod) {
        return 'Selecciona un metodo de pago';
    }

    if (!bankDetails.accountHolderName.trim()) {
        return 'Ingresa el nombre del titular';
    }

    if (!bankDetails.documentNumber.trim()) {
        return 'Ingresa el documento del titular';
    }

    if (selectedMethod === 'nequi') {
        if (!/^3\d{9}$/.test(bankDetails.accountNumber)) {
            return 'Ingresa un numero Nequi valido de 10 digitos';
        }
        return null;
    }

    if (!bankDetails.bankName.trim()) {
        return 'Selecciona tu banco';
    }

    if (bankDetails.accountNumber.trim().length < 6) {
        return 'Ingresa un numero de cuenta valido';
    }

    return null;
}

function parseCopInput(value: string) {
    return Number(value.replace(/[^0-9]/g, '')) || 0;
}

function maskAccountNumber(value?: string | null) {
    const digits = (value || '').replace(/\D/g, '');

    if (!digits) {
        return 'Sin dato visible';
    }

    return `****${digits.slice(-4)}`;
}

function getPaymentMethodLabel(method?: PaymentMethodType | string | null) {
    switch (method) {
        case 'nequi':
            return 'Nequi';
        case 'savings':
            return 'Cuenta de ahorros';
        case 'checking':
            return 'Cuenta corriente';
        default:
            return 'Metodo guardado';
    }
}

function getShortReference(transaction: Transaction) {
    const rawReference =
        transaction.source_reference ||
        transaction.reference_id ||
        (typeof transaction.withdrawal_snapshot?.withdrawal_request_id === 'string'
            ? transaction.withdrawal_snapshot.withdrawal_request_id
            : transaction.id);

    return rawReference ? rawReference.slice(0, 8).toUpperCase() : 'KX';
}

function getTransactionStatusLabel(status?: string) {
    switch ((status || '').toLowerCase()) {
        case 'pending':
            return 'En revision';
        case 'approved':
            return 'Aprobado';
        case 'paid':
        case 'settled':
        case 'completed':
            return 'Pagado';
        case 'rejected':
            return 'Rechazado';
        case 'returned':
        case 'reversed':
            return 'Devuelto';
        default:
            return status || 'Registrado';
    }
}

function getTransactionDirection(transaction: Transaction): 'in' | 'out' {
    if (transaction.type === 'withdrawal' || transaction.source_kind === 'withdrawal_request') {
        return 'out';
    }

    if (['advance_repayment', 'advance_interest', 'platform_fee', 'withdrawal_fee'].includes(transaction.type)) {
        return 'out';
    }

    if (transaction.type === 'withdrawal_reversal') {
        return 'in';
    }

    return transaction.amount < 0 ? 'out' : 'in';
}

function getTransactionDisplayAmount(transaction: Transaction) {
    return Math.abs(Number(transaction.amount || 0));
}

function getTransactionSourceLabel(transaction: Transaction) {
    const sourceKind = typeof transaction.source_kind === 'string'
        ? transaction.source_kind
        : typeof transaction.metadata?.source_kind === 'string'
            ? transaction.metadata.source_kind
            : transaction.type;

    switch (sourceKind) {
        case 'payment_capture':
            return 'Pago confirmado';
        case 'trip_settlement':
            return 'Liquidacion de viaje';
        case 'private_fleet_salary':
            return 'Nomina flota privada';
        case 'withdrawal_request':
            return 'Solicitud de retiro';
        case 'withdrawal_reversal':
            return 'Devolucion de retiro';
        case 'holding_wallet_release':
            return 'Saldo retenido liberado';
        case 'advance_disbursement':
            return 'Movimiento financiero historico';
        case 'advance_repayment':
        case 'advance_interest':
            return 'Ajuste financiero historico';
        case 'trip_deposit':
        case 'trip_pending':
            return 'Deposito por viaje';
        case 'withdrawal':
            return 'Retiro procesado';
        case 'platform_fee':
            return 'Comision de plataforma';
        default:
            return sourceKind.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
    }
}

function getTransactionNarrative(transaction: Transaction) {
    if (transaction.type === 'withdrawal' && transaction.status === 'pending') {
        return 'Tu retiro fue solicitado y esta siendo validado por operaciones.';
    }

    if (transaction.type === 'withdrawal' && transaction.status === 'approved') {
        return 'El retiro fue aprobado y esta listo para giro controlado.';
    }

    if (transaction.type === 'withdrawal' && transaction.status === 'rejected') {
        return 'El retiro fue rechazado y el saldo regreso a tu billetera disponible.';
    }

    if (transaction.type === 'withdrawal_reversal') {
        return 'El saldo del retiro volvio a tu billetera operativa.';
    }

    if (transaction.type === 'trip_pending') {
        return 'El viaje quedo registrado y el pago sigue en validacion.';
    }

    if (transaction.type === 'trip_deposit' || transaction.source_kind === 'trip_settlement') {
        return 'El pago del viaje ya esta disponible en tu billetera.';
    }

    if (transaction.type === 'private_fleet_salary' || transaction.source_kind === 'private_fleet_salary') {
        return 'Tu empresa libero nomina privada a tu billetera operativa.';
    }

    if (transaction.type === 'advance_disbursement') {
        return 'Movimiento financiero historico registrado en tu saldo operativo.';
    }

    if (transaction.type === 'advance_repayment' || transaction.type === 'advance_interest') {
        return 'Se aplico un ajuste financiero historico en tu billetera.';
    }

    return 'Movimiento registrado en tu billetera operativa.';
}

function getTransactionIcon(transaction: Transaction) {
    if (getTransactionDirection(transaction) === 'out') {
        return ArrowUpCircle;
    }

    if (transaction.type === 'trip_deposit' || transaction.type === 'trip_pending') {
        return ArrowDownCircle;
    }

    if (transaction.type === 'private_fleet_salary') {
        return Wallet;
    }

    if (transaction.type.includes('advance')) {
        return Coins;
    }

    return DollarSign;
}

export default function WalletPage() {
    const { user: authUser } = useAuthStore();

    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [settlementTimeline, setSettlementTimeline] = useState<Transaction[]>([]);
    const [pendingWithdrawals, setPendingWithdrawals] = useState<Transaction[]>([]);
    const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<SavedPaymentMethod | null>(null);
    const [advancesSummary, setAdvancesSummary] = useState<AdvanceSummary | null>(null);
    const [activeAdvances, setActiveAdvances] = useState<FuelAdvanceListItem[]>([]);
    const [overdueAdvances, setOverdueAdvances] = useState<FuelAdvanceListItem[]>([]);
    const [eligibleAdvanceOffers, setEligibleAdvanceOffers] = useState<EligibleAdvanceOffer[]>([]);
    const [lendingSettings, setLendingSettings] = useState<LendingSettingsSnapshot | null>(null);
    const [lendingPaused, setLendingPaused] = useState(true);
    const [privateFleetSummary, setPrivateFleetSummary] = useState<PrivateFleetSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawStep, setWithdrawStep] = useState<1 | 2 | 3 | 4>(1);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
    const [bankDetails, setBankDetails] = useState<BankDetails>({
        bankName: '',
        accountNumber: '',
        accountHolderName: '',
        documentType: 'CC',
        documentNumber: '',
    });
    const [saveMethod, setSaveMethod] = useState(true);
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawResult, setWithdrawResult] = useState<{ success: boolean; message: string } | null>(null);

    const loadWalletData = useCallback(async () => {
        if (!authUser?.id) {
            setLoading(false);
            return;
        }

        if (authUser.userType !== 'trucker') {
            setLoading(false);
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setLoading(false);
                return;
            }

            const response = await fetch('/api/wallet', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('No se pudo cargar la billetera');
            }

            const data = await response.json();

            if (data.wallet) {
                setWallet({
                    id: data.wallet.id,
                    pending_balance: data.wallet.pending_balance || 0,
                    available_balance: data.wallet.available_balance || 0,
                    total_earned: data.wallet.total_earned || 0,
                    total_withdrawn: data.wallet.total_withdrawn || 0,
                    total_trips_completed: data.wallet.total_trips_completed || 0,
                });
            }

            setTransactions(data.transactions || []);
            setSettlementTimeline(data.settlementTimeline || []);
            setPendingWithdrawals(data.pendingWithdrawals || []);
            setDefaultPaymentMethod(data.defaultPaymentMethod || null);
            setAdvancesSummary(data.advancesSummary || null);
            setActiveAdvances(data.activeAdvances || []);
            setOverdueAdvances(data.overdueAdvances || []);
            setEligibleAdvanceOffers(data.eligibleAdvanceOffers || []);
            setLendingSettings(data.lendingSettings || null);
            setLendingPaused(data.lendingPaused !== false);
            setPrivateFleetSummary(data.privateFleetSummary || null);

            if (data.defaultPaymentMethod) {
                setBankDetails((prev) => ({
                    ...prev,
                    bankName: data.defaultPaymentMethod.bank_name || '',
                    accountNumber: data.defaultPaymentMethod.account_number || '',
                    accountHolderName: data.defaultPaymentMethod.account_holder_name || prev.accountHolderName,
                }));
            }
        } catch (err) {
            console.error('[Wallet] Error:', err);
        } finally {
            setLoading(false);
        }
    }, [authUser?.id, authUser?.userType]);

    useEffect(() => {
        loadWalletData();
    }, [loadWalletData]);

    const withdrawalAmountNumber = parseCopInput(withdrawAmount);
    const withdrawalDetailsError = validateWithdrawalDetails(
        withdrawalAmountNumber,
        selectedMethod,
        bankDetails,
        wallet?.available_balance || 0
    );

    const withdrawAmountError = useMemo(() => {
        if (!withdrawAmount) {
            return null;
        }

        if (withdrawalAmountNumber < MIN_WITHDRAWAL_AMOUNT) {
            return 'El retiro minimo es de $50,000.';
        }

        if (withdrawalAmountNumber > Number(wallet?.available_balance || 0)) {
            return 'El monto supera tu saldo disponible.';
        }

        return null;
    }, [wallet?.available_balance, withdrawAmount, withdrawalAmountNumber]);

    const visibleTransactions = settlementTimeline.length > 0 ? settlementTimeline : transactions;
    const latestWithdrawal = pendingWithdrawals[0] || transactions.find((item) => item.type === 'withdrawal') || null;
    const releasedOperational = Number(privateFleetSummary?.freightReleasedCop || 0) + Number(privateFleetSummary?.expenseReleasedCop || 0);
    const canWithdraw = Number(wallet?.available_balance || 0) >= MIN_WITHDRAWAL_AMOUNT;
    const walletCardNumber = useMemo(() => {
        const seed = (wallet?.id || authUser?.id || 'kargaxwallet').replace(/-/g, '').toUpperCase().padEnd(16, '0');
        return `KX ${seed.slice(0, 4)} ${seed.slice(4, 8)} ${seed.slice(8, 12)}`;
    }, [authUser?.id, wallet?.id]);

    const summaryCards = [
        {
            label: 'Pago por ruta',
            value: formatCOP(privateFleetSummary?.freightReleasedCop || 0),
            detail: `${formatCOP(privateFleetSummary?.freightHeldCop || 0)} en custodia`,
            icon: Truck,
        },
        {
            label: 'Salario mensual',
            value: formatCOP(privateFleetSummary?.salaryReleasedCop || 0),
            detail: `${formatCOP(privateFleetSummary?.salaryPendingCop || 0)} pendiente de fondeo`,
            icon: Wallet,
        },
        {
            label: 'Gastos del viaje',
            value: formatCOP(privateFleetSummary?.expenseReleasedCop || 0),
            detail: `${formatCOP(privateFleetSummary?.expenseHeldCop || 0)} pendiente por confirmar`,
            icon: Coins,
        },
        {
            label: 'Operativo liberado',
            value: formatCOP(releasedOperational + Number(privateFleetSummary?.salaryReleasedCop || 0)),
            detail: 'Disponible despues de validaciones internas',
            icon: ShieldCheck,
        },
    ];

    const metricCards = [
        {
            label: 'Movimientos recientes',
            value: String(visibleTransactions.length),
            detail: 'Depositos, retiros y devoluciones trazables.',
            icon: History,
        },
        {
            label: 'Retiros pendientes',
            value: String(pendingWithdrawals.length),
            detail: 'Solicitudes bajo revision administrativa.',
            icon: Clock,
        },
        {
            label: 'Viajes completados',
            value: String(wallet?.total_trips_completed || 0),
            detail: 'Liquidaciones cerradas en KargaX.',
            icon: Truck,
        },
        {
            label: 'Retirado',
            value: formatCOP(wallet?.total_withdrawn || 0),
            detail: 'Historico procesado desde tu billetera.',
            icon: ArrowUpCircle,
        },
    ];

    const paymentOptions = [
        {
            value: 'nequi' as const,
            title: 'Nequi',
            detail: 'Celular validado y giro con revision admin.',
            icon: Smartphone,
        },
        {
            value: 'savings' as const,
            title: 'Cuenta de ahorros',
            detail: 'Banco, titular, documento y cuenta.',
            icon: Landmark,
        },
        {
            value: 'checking' as const,
            title: 'Cuenta corriente',
            detail: 'Transferencia revisada antes de liberar fondos.',
            icon: CreditCard,
        },
    ];

    const openWithdrawModal = () => {
        setWithdrawResult(null);
        setWithdrawStep(1);

        if (defaultPaymentMethod) {
            setSelectedMethod(defaultPaymentMethod.method_type);
            setBankDetails((prev) => ({
                ...prev,
                bankName: defaultPaymentMethod.bank_name || '',
                accountNumber: defaultPaymentMethod.account_number || '',
                accountHolderName: defaultPaymentMethod.account_holder_name || prev.accountHolderName,
            }));
        }

        setShowWithdrawModal(true);
    };

    const resetWithdrawal = () => {
        setShowWithdrawModal(false);
        setWithdrawStep(1);
        setWithdrawAmount('');
        setSelectedMethod(defaultPaymentMethod?.method_type || null);
        setWithdrawResult(null);
        loadWalletData();
    };

    const handleAmountChange = (value: string) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        setWithdrawAmount(numericValue ? formatCOP(Number(numericValue)) : '');
        setWithdrawResult(null);
    };

    const handleSubmitWithdrawal = async () => {
        const validationError = validateWithdrawalDetails(
            withdrawalAmountNumber,
            selectedMethod,
            bankDetails,
            wallet?.available_balance || 0
        );

        if (validationError) {
            setWithdrawResult({ success: false, message: validationError });
            return;
        }

        setWithdrawing(true);
        setWithdrawResult(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('No hay sesion activa');
            }

            const response = await fetch('/api/wallet/withdraw', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: withdrawalAmountNumber,
                    paymentMethod: selectedMethod,
                    bankDetails: {
                        bankName: selectedMethod === 'nequi' ? 'Nequi' : bankDetails.bankName,
                        accountNumber: bankDetails.accountNumber,
                        accountHolderName: bankDetails.accountHolderName,
                        documentType: bankDetails.documentType,
                        documentNumber: bankDetails.documentNumber,
                    },
                    saveMethod,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al procesar retiro');
            }

            setWithdrawResult({ success: true, message: data.message });
            await loadWalletData();
            setWithdrawStep(4);
        } catch (err: unknown) {
            setWithdrawResult({
                success: false,
                message: err instanceof Error ? err.message : 'No se pudo procesar el retiro',
            });
        } finally {
            setWithdrawing(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout pageTitle="Billetera">
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                </div>
            </DashboardLayout>
        );
    }

    if (authUser?.userType !== 'trucker') {
        return (
            <DashboardLayout pageTitle="Billetera">
                <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
                    <div className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-[0_24px_70px_-50px_rgba(10,10,10,.6)]">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                            <AlertCircle className="h-6 w-6 text-zinc-950" />
                        </div>
                        <h1 className="text-xl font-semibold text-zinc-950">Billetera disponible para transportadores</h1>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                            Las cuentas empresa gestionan pagos, planes y flota desde sus modulos empresariales.
                            Esta billetera corresponde al saldo operativo del conductor.
                        </p>
                        <Button asChild className="mt-6">
                            <Link href="/dashboard">Volver al dashboard</Link>
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout pageTitle="Billetera">
            <div className="mx-auto max-w-6xl space-y-6 px-1 pb-10">
                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-auto w-full max-w-3xl"
                    aria-label="Tarjeta premium KargaX Wallet"
                >
                    <div className="relative aspect-[1.586/1] min-h-[252px] overflow-hidden rounded-lg border border-zinc-700 bg-[#050505] p-6 text-white shadow-[0_42px_120px_-56px_rgba(0,0,0,.98)] sm:p-8">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,.16),transparent_28%),linear-gradient(135deg,rgba(255,255,255,.12),transparent_31%,rgba(255,255,255,.055)_68%,transparent),repeating-linear-gradient(90deg,rgba(255,255,255,.045)_0,rgba(255,255,255,.045)_1px,transparent_1px,transparent_28px)]" />
                        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-white/10" />
                        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full border border-white/10" />
                        <div className="pointer-events-none absolute right-8 top-8 grid grid-cols-5 gap-1 opacity-25">
                            {Array.from({ length: 25 }).map((_, index) => (
                                <span key={index} className="h-1 w-1 rounded-full bg-white/70" />
                            ))}
                        </div>

                        <div className="relative flex h-full flex-col justify-between">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="font-sans text-[11px] uppercase tracking-[0.28em] text-white/48">KargaX Wallet</p>
                                    <p className="mt-1 font-display text-lg font-semibold text-white sm:text-xl">Black Matte Operator</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/15 bg-white/[0.075] shadow-[inset_0_1px_0_rgba(255,255,255,.18)]">
                                    <span className="font-display text-lg font-semibold">KX</span>
                                </div>
                            </div>

                            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-end">
                                <div className="grid h-12 w-16 grid-cols-3 gap-1 rounded-md border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,.30),rgba(255,255,255,.05))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.20)]">
                                    {Array.from({ length: 6 }).map((_, index) => (
                                        <span key={index} className="rounded-sm bg-white/20" />
                                    ))}
                                </div>
                                <div className="min-w-0 sm:text-right">
                                    <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-white/45">Saldo disponible</p>
                                    <p className="font-money mt-1 text-4xl font-bold tracking-normal text-white sm:text-5xl">
                                        {formatCOP(wallet?.available_balance || 0)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                                <div className="min-w-0">
                                    <p className="font-money text-base font-semibold text-white/90 sm:text-lg">{walletCardNumber}</p>
                                    <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.24em] text-white/45">Titular</p>
                                    <p className="mt-1 truncate font-display text-base font-semibold text-white sm:text-lg">
                                        {authUser?.fullName || 'Conductor KargaX'}
                                    </p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-white/40">Ledger rail</p>
                                    <p className="mt-1 font-display text-sm font-semibold text-white">KX Verified</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 }}
                    className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_48px_-38px_rgba(10,10,10,.55)] lg:grid-cols-[1fr_auto]"
                >
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Informacion de billetera</p>
                        <h2 className="mt-2 text-xl font-semibold text-zinc-950">Saldo operativo y retiros</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                            Saldo operativo generado dentro de KargaX. No es deposito bancario; cada retiro pasa por
                            validacion, conciliacion y controles de seguridad antes de pagarse.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">En transito</p>
                                <p className="font-money mt-2 text-lg font-semibold text-zinc-950">{formatCOP(wallet?.pending_balance || 0)}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Total ganado</p>
                                <p className="font-money mt-2 text-lg font-semibold text-zinc-950">{formatCOP(wallet?.total_earned || 0)}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Total retirado</p>
                                <p className="font-money mt-2 text-lg font-semibold text-zinc-950">{formatCOP(wallet?.total_withdrawn || 0)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-white lg:w-64">
                        <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-white/50">Retiro minimo</p>
                            <p className="font-money mt-2 text-2xl font-semibold">{formatCOP(MIN_WITHDRAWAL_AMOUNT)}</p>
                        </div>
                        <Button
                            onClick={openWithdrawModal}
                            disabled={!canWithdraw}
                            variant="secondary"
                            className="h-12 w-full"
                        >
                            <ArrowUpCircle className="h-4 w-4" />
                            Solicitar retiro
                        </Button>
                    </div>
                </motion.section>

                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 }}
                    className="rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_48px_-38px_rgba(10,10,10,.55)]"
                >
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 text-zinc-950" />
                        <div>
                            <p className="font-semibold text-zinc-950">Saldo operativo, no deposito bancario</p>
                            <p className="mt-1 text-sm leading-6 text-zinc-600">
                                KargaX muestra dinero operativo ligado a viajes, liquidaciones y aprobaciones internas.
                                Los retiros se registran como solicitud, se revisan, se aprueban o se devuelven con trazabilidad.
                            </p>
                        </div>
                    </div>
                </motion.section>

                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                    aria-label="Resumen privado de billetera"
                >
                    {summaryCards.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_16px_42px_-38px_rgba(10,10,10,.5)]">
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                                    <Icon className="h-4 w-4 text-zinc-950" />
                                </div>
                                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                                <p className="font-money mt-2 text-2xl font-semibold text-zinc-950">{item.value}</p>
                                <p className="mt-2 text-sm leading-5 text-zinc-500">{item.detail}</p>
                            </div>
                        );
                    })}
                </motion.section>

                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.07 }}
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                    aria-label="Metricas de billetera"
                >
                    {metricCards.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="rounded-lg border border-zinc-200 bg-white p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                                    <Icon className="h-4 w-4 text-zinc-500" />
                                </div>
                                <p className="font-money mt-3 text-2xl font-semibold text-zinc-950">{item.value}</p>
                                <p className="mt-2 text-sm leading-5 text-zinc-500">{item.detail}</p>
                            </div>
                        );
                    })}
                </motion.section>

                <div className="grid gap-6 lg:grid-cols-[1fr_.82fr]">
                    <motion.section
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.09 }}
                        className="rounded-lg border border-zinc-200 bg-white p-6"
                    >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Timeline de retiro</p>
                                <h2 className="mt-2 text-xl font-semibold text-zinc-950">Payout con cadena de control</h2>
                                <p className="mt-2 text-sm leading-6 text-zinc-600">
                                    Cada solicitud conserva estado, referencia y narrativa humana para que sepas que esta pasando.
                                </p>
                            </div>
                            {latestWithdrawal ? (
                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                                    <p className="text-zinc-500">Ultimo retiro</p>
                                    <p className="font-money mt-1 font-semibold text-zinc-950">Ref {getShortReference(latestWithdrawal)}</p>
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-6 space-y-3">
                            {PAYOUT_STEPS.map((step, index) => (
                                <div key={step.title} className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-xs font-semibold text-zinc-950">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-zinc-950">{step.title}</p>
                                        <p className="mt-1 text-sm leading-5 text-zinc-500">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.11 }}
                        className="rounded-lg border border-zinc-200 bg-white p-6"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Metodo de retiro</p>
                                <h2 className="mt-2 text-xl font-semibold text-zinc-950">Destino seguro</h2>
                            </div>
                            <CreditCard className="h-5 w-5 text-zinc-500" />
                        </div>

                        {defaultPaymentMethod ? (
                            <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                                            <CreditCard className="h-5 w-5 text-zinc-950" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-zinc-950">
                                                {defaultPaymentMethod.bank_name || getPaymentMethodLabel(defaultPaymentMethod.method_type)}
                                            </p>
                                            <p className="mt-1 text-sm text-zinc-500">
                                                {getPaymentMethodLabel(defaultPaymentMethod.method_type)} {maskAccountNumber(defaultPaymentMethod.account_number)}
                                            </p>
                                            <p className="mt-2 text-xs leading-5 text-zinc-500">
                                                Guardamos solo lo necesario para llenar el retiro; la vista no expone datos completos.
                                            </p>
                                        </div>
                                    </div>
                                    <BadgeCheck className="h-5 w-5 text-zinc-950" />
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 space-y-3">
                                {paymentOptions.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                        <div key={option.value} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                                                <Icon className="h-4 w-4 text-zinc-950" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-zinc-950">{option.title}</p>
                                                <p className="text-xs leading-5 text-zinc-500">{option.detail}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm leading-6 text-zinc-600">
                                    Configura tu metodo al solicitar tu primer retiro.
                                </div>
                            </div>
                        )}
                    </motion.section>
                </div>

                {pendingWithdrawals.length > 0 ? (
                    <motion.section
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 }}
                        className="rounded-lg border border-zinc-200 bg-white p-5"
                    >
                        <div className="flex items-start gap-3">
                            <Clock className="mt-0.5 h-5 w-5 text-zinc-950" />
                            <div>
                                <p className="font-semibold text-zinc-950">Retiros pendientes</p>
                                <p className="mt-1 text-sm leading-6 text-zinc-600">
                                    Tienes {pendingWithdrawals.length} solicitud(es) en revision administrativa. El saldo ya esta reservado
                                    mientras KargaX valida el destino y la conciliacion.
                                </p>
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {lendingPaused ? (
                    <motion.section
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.13 }}
                        className="rounded-lg border border-zinc-200 bg-white p-6"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                                <Clock className="h-5 w-5 text-zinc-950" />
                            </div>
                            <div>
                                <p className="font-semibold text-zinc-950">Pago expres no disponible en piloto</p>
                                <p className="mt-1 text-sm leading-6 text-zinc-600">
                                    KargaX mantiene esta opcion apagada por feature flag hasta completar compliance,
                                    capital/partner, reglas de disputa y auditoria operacional. No se reactiva lending visual en este sprint.
                                </p>
                            </div>
                        </div>
                    </motion.section>
                ) : (
                    <AdvancesSection
                        summary={advancesSummary}
                        eligibleOffers={eligibleAdvanceOffers}
                        activeAdvances={activeAdvances}
                        overdueAdvances={overdueAdvances}
                        settings={lendingSettings}
                        onAdvanceRequested={loadWalletData}
                    />
                )}

                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
                >
                    <div className="border-b border-zinc-100 p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Ledger privado</p>
                                <h2 className="mt-2 text-xl font-semibold text-zinc-950">Historial de movimientos</h2>
                            </div>
                            <p className="text-sm text-zinc-500">Referencias cortas, sin datos sensibles.</p>
                        </div>
                    </div>

                    {visibleTransactions.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                                <History className="h-5 w-5 text-zinc-500" />
                            </div>
                            <p className="mt-4 font-semibold text-zinc-950">Aun no tienes movimientos</p>
                            <p className="mt-1 text-sm text-zinc-500">Completa tu primer viaje para ver tu historial operativo.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {visibleTransactions.slice(0, 12).map((transaction) => {
                                const Icon = getTransactionIcon(transaction);
                                const direction = getTransactionDirection(transaction);
                                const sourceLabel = getTransactionSourceLabel(transaction);

                                return (
                                    <article key={transaction.id} className="p-5 transition-colors hover:bg-zinc-50">
                                        <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-start">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                                                <Icon className="h-5 w-5 text-zinc-950" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold text-zinc-950">{transaction.description}</p>
                                                    <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600">
                                                        {direction === 'in' ? 'Ingreso' : 'Salida'}
                                                    </span>
                                                    <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600">
                                                        {getTransactionStatusLabel(transaction.status)}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                                    {sourceLabel} | Ref {getShortReference(transaction)}
                                                </p>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">
                                                    {getTransactionNarrative(transaction)}
                                                </p>
                                                <p className="mt-2 text-xs text-zinc-400">
                                                    {new Date(transaction.created_at).toLocaleString('es-CO')}
                                                </p>
                                            </div>
                                            <div className="md:text-right">
                                                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                                    {direction === 'in' ? 'A favor' : 'Reservado'}
                                                </p>
                                                <p className="font-money mt-2 text-lg font-semibold text-zinc-950">
                                                    {direction === 'in' ? '+' : '-'}{formatCOP(getTransactionDisplayAmount(transaction))}
                                                </p>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </motion.section>
            </div>

            <AnimatePresence>
                {showWithdrawModal ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
                        onClick={() => !withdrawing && resetWithdrawal()}
                    >
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0, y: 12 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.96, opacity: 0, y: 12 }}
                            onClick={(event) => event.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="withdraw-title"
                            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-[0_40px_110px_-54px_rgba(0,0,0,.95)]"
                        >
                            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-6">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Retiro operativo</p>
                                    <h3 id="withdraw-title" className="mt-2 text-xl font-semibold text-zinc-950">
                                        {withdrawStep === 4 ? 'Solicitud registrada' : 'Solicitar retiro'}
                                    </h3>
                                    {withdrawStep !== 4 ? (
                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            {[1, 2, 3].map((step) => (
                                                <div
                                                    key={step}
                                                    className={`h-1.5 rounded-full ${withdrawStep >= step ? 'bg-zinc-950' : 'bg-zinc-200'}`}
                                                />
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => !withdrawing && resetWithdrawal()}
                                    className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                                    aria-label="Cerrar retiro"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {withdrawStep === 1 ? (
                                <div className="space-y-6 p-6">
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-center">
                                        <p className="text-sm text-zinc-500">Saldo disponible</p>
                                        <p className="font-money mt-2 text-3xl font-semibold text-zinc-950">
                                            {formatCOP(wallet?.available_balance || 0)}
                                        </p>
                                    </div>

                                    <label className="block">
                                        <span className="text-sm font-semibold text-zinc-950">Monto a retirar</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={withdrawAmount}
                                            onChange={(event) => handleAmountChange(event.target.value)}
                                            placeholder="$0"
                                            className="font-money mt-2 w-full rounded-lg border-2 border-zinc-200 bg-white px-4 py-5 text-center text-3xl font-semibold text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                        />
                                    </label>

                                    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600">
                                        Minimo visible: <span className="font-money font-semibold text-zinc-950">{formatCOP(MIN_WITHDRAWAL_AMOUNT)}</span>.
                                        La solicitud no se crea si el monto deja el saldo en negativo.
                                    </div>

                                    {withdrawAmountError ? (
                                        <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-sm font-medium text-zinc-950">
                                            {withdrawAmountError}
                                        </div>
                                    ) : null}

                                    <Button
                                        onClick={() => setWithdrawStep(2)}
                                        disabled={!withdrawAmount || Boolean(withdrawAmountError)}
                                        className="w-full"
                                    >
                                        Continuar
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : null}

                            {withdrawStep === 2 ? (
                                <div className="space-y-5 p-6">
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-950">Metodo de recepcion</p>
                                        <p className="mt-1 text-sm leading-6 text-zinc-500">
                                            Selecciona el destino. La opcion activa se marca por borde negro, no por color.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        {paymentOptions.map((option) => {
                                            const Icon = option.icon;
                                            const isSelected = selectedMethod === option.value;

                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedMethod(option.value);
                                                        setWithdrawResult(null);
                                                    }}
                                                    className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-all ${
                                                        isSelected
                                                            ? 'border-zinc-950 bg-zinc-50 shadow-[0_14px_32px_-28px_rgba(10,10,10,.8)]'
                                                            : 'border-zinc-200 bg-white hover:border-zinc-400'
                                                    }`}
                                                >
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                                                        <Icon className="h-5 w-5 text-zinc-950" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold text-zinc-950">{option.title}</p>
                                                        <p className="mt-1 text-sm leading-5 text-zinc-500">{option.detail}</p>
                                                    </div>
                                                    {isSelected ? <CheckCircle2 className="h-5 w-5 text-zinc-950" /> : null}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setWithdrawStep(1)}
                                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-950 hover:text-zinc-950"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Volver
                                        </button>
                                        <Button
                                            onClick={() => setWithdrawStep(3)}
                                            disabled={!selectedMethod}
                                            className="flex-1"
                                        >
                                            Continuar
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : null}

                            {withdrawStep === 3 ? (
                                <div className="space-y-5 p-6">
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <p className="font-money text-lg font-semibold text-zinc-950">{withdrawAmount}</p>
                                        <p className="mt-1 text-sm leading-6 text-zinc-600">
                                            Retiro a {getPaymentMethodLabel(selectedMethod)}. Queda pendiente de aprobacion administrativa antes del giro.
                                        </p>
                                    </div>

                                    {selectedMethod !== 'nequi' ? (
                                        <label className="block">
                                            <span className="text-sm font-semibold text-zinc-950">Banco</span>
                                            <select
                                                value={bankDetails.bankName}
                                                onChange={(event) => setBankDetails({ ...bankDetails, bankName: event.target.value })}
                                                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                            >
                                                <option value="">Selecciona tu banco</option>
                                                {COLOMBIAN_BANKS.map((bank) => (
                                                    <option key={bank} value={bank}>{bank}</option>
                                                ))}
                                            </select>
                                        </label>
                                    ) : null}

                                    <label className="block">
                                        <span className="text-sm font-semibold text-zinc-950">
                                            {selectedMethod === 'nequi' ? 'Celular Nequi' : 'Numero de cuenta'}
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={bankDetails.accountNumber}
                                            onChange={(event) => setBankDetails({ ...bankDetails, accountNumber: event.target.value.replace(/[^0-9]/g, '') })}
                                            placeholder={selectedMethod === 'nequi' ? '3001234567' : 'Numero de cuenta'}
                                            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-semibold text-zinc-950">Titular</span>
                                        <input
                                            type="text"
                                            value={bankDetails.accountHolderName}
                                            onChange={(event) => setBankDetails({ ...bankDetails, accountHolderName: event.target.value })}
                                            placeholder="Nombre completo"
                                            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                        />
                                    </label>

                                    <div className="grid gap-3 sm:grid-cols-[.42fr_.58fr]">
                                        <label className="block">
                                            <span className="text-sm font-semibold text-zinc-950">Tipo doc.</span>
                                            <select
                                                value={bankDetails.documentType}
                                                onChange={(event) => setBankDetails({ ...bankDetails, documentType: event.target.value })}
                                                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                            >
                                                <option value="CC">CC</option>
                                                <option value="CE">CE</option>
                                                <option value="NIT">NIT</option>
                                                <option value="PAS">Pasaporte</option>
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-sm font-semibold text-zinc-950">Documento</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={bankDetails.documentNumber}
                                                onChange={(event) => setBankDetails({ ...bankDetails, documentNumber: event.target.value.replace(/[^0-9]/g, '') })}
                                                placeholder="12345678"
                                                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                                            />
                                        </label>
                                    </div>

                                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <input
                                            type="checkbox"
                                            checked={saveMethod}
                                            onChange={(event) => setSaveMethod(event.target.checked)}
                                            className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                                        />
                                        <span className="text-sm leading-6 text-zinc-600">
                                            Guardar metodo para futuros retiros. La interfaz seguira mostrando solo datos enmascarados.
                                        </span>
                                    </label>

                                    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600">
                                        Validamos titular, documento, destino y saldo antes de aprobar. Esta accion crea una solicitud,
                                        no un pago instantaneo.
                                    </div>

                                    {withdrawResult && !withdrawResult.success ? (
                                        <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-sm font-medium text-zinc-950">
                                            {withdrawResult.message}
                                        </div>
                                    ) : null}

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setWithdrawStep(2)}
                                            disabled={withdrawing}
                                            className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-950 hover:text-zinc-950 disabled:opacity-45"
                                        >
                                            Volver
                                        </button>
                                        <Button
                                            onClick={handleSubmitWithdrawal}
                                            disabled={withdrawing || Boolean(withdrawalDetailsError)}
                                            className="flex-1"
                                        >
                                            {withdrawing ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Registrando
                                                </>
                                            ) : (
                                                'Registrar solicitud'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ) : null}

                            {withdrawStep === 4 ? (
                                <div className="space-y-5 p-6 text-center">
                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50">
                                        <span className="font-display text-2xl font-semibold text-zinc-950">KX</span>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-semibold text-zinc-950">Solicitud enviada</h4>
                                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                                            Solicitud registrada y pendiente de aprobacion administrativa.
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left">
                                        <p className="text-sm leading-6 text-zinc-600">
                                            <Mail className="mr-2 inline h-4 w-4 text-zinc-950" />
                                            Te notificaremos cuando operaciones valide el retiro y cambie su estado.
                                        </p>
                                    </div>
                                    <Button onClick={resetWithdrawal} className="w-full">
                                        Entendido
                                    </Button>
                                </div>
                            ) : null}
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </DashboardLayout>
    );
}
