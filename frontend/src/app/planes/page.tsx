'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    ArrowUpRight,
    BadgeCheck,
    Building2,
    Check,
    Crown,
    Loader2,
    ShieldCheck,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card, toast } from '@/components/ui';
import { EnterpriseHero, InlineNotice, SectionHeader, StatusPill, UsageMeter } from '@/components/enterprise/EnterpriseLuxury';
import warehouseClient from '@/lib/warehouses/client';
import type { BillingPlan, BusinessPlanSubscription, WarehouseListResponse } from '@/lib/warehouses/types';
import { useAuthStore } from '@/features/auth/store/authStore';
import { MARKETPLACE_COMMISSION_PERCENT } from '@/lib/billing/pricing';

const BILLING_PLAN_USD_TO_COP_RATE = 3650;

function formatPriceCop(value: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(Number(value || 0));
}

function formatPlanCapacity(limit: number | null, limitedLabel: string, unlimitedLabel: string) {
    return limit === null ? unlimitedLabel : `${limit} ${limitedLabel}`;
}

function getPlanStage(plan: BillingPlan) {
    return ({ free: 'Arranque', starter: 'Primer equipo', growth: 'Recomendado', scale: 'Alto volumen', enterprise: 'Corporativo' } as Record<string, string>)[plan.code] || 'Plan';
}

function getSupportLabel(plan: BillingPlan) {
    return ({ email: 'Soporte por email', priority: 'Soporte prioritario', premium: 'Soporte premium' } as Record<string, string>)[plan.support_tier] || 'Soporte incluido';
}

function getNumericPrice(plan: BillingPlan | BusinessPlanSubscription['plan'] | null | undefined) {
    return Number(plan?.price_monthly_cop ?? 0) || Math.round(Number(plan?.price_monthly_usd || 0) * BILLING_PLAN_USD_TO_COP_RATE);
}

function getPlanUsdAnchor(plan: BillingPlan) {
    const featureMatrix = plan.feature_matrix || {};
    const featureAnchor = Number(featureMatrix.usd_anchor || featureMatrix.price_monthly_usd_anchor || featureMatrix.public_price_usd || 0);
    return Number.isFinite(featureAnchor) && featureAnchor > 0 ? featureAnchor : Number(plan.price_monthly_usd || 0);
}

function formatUsdReference(value: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(Number(value || 0));
}

function getPlanPriceLabel(plan: BillingPlan) {
    const price = formatPriceCop(getNumericPrice(plan));
    return plan.code === 'enterprise' ? `Desde ${price}` : price;
}

function getPlanReferenceLabel(plan: BillingPlan) {
    const usdAnchor = getPlanUsdAnchor(plan);

    if (!usdAnchor) {
        return plan.code === 'free' ? 'Sin mensualidad' : null;
    }

    return plan.code === 'enterprise'
        ? `desde ${formatUsdReference(usdAnchor)} de referencia`
        : `${formatUsdReference(usdAnchor)} de referencia`;
}

function getPlanHighlights(plan: BillingPlan) {
    const shared = [
        formatPlanCapacity(plan.max_warehouses, 'bodegas activas', 'Bodegas ilimitadas'),
        formatPlanCapacity(plan.max_internal_users, 'usuarios internos', 'Usuarios internos ilimitados'),
        formatPlanCapacity(plan.max_monthly_trips, 'viajes por mes', 'Viajes ilimitados'),
        formatPlanCapacity(plan.max_private_fleet_drivers, 'conductores privados', 'Flota privada ilimitada'),
    ];
    const byCode: Record<string, string[]> = {
        free: ['50 viajes/mes para validar operacion real', 'PIN/POD, receptor, hora, foto/firma y novedad', `Marketplace con ${MARKETPLACE_COMMISSION_PERCENT}% solo en viajes externos`, getSupportLabel(plan)],
        starter: ['Entrada paga para micro-operacion recurrente', 'Inventario visual, recibos, despachos y analitica base', 'Hasta 150 viajes/mes antes de pasar a Growth', getSupportLabel(plan)],
        growth: ['Plan recomendado para equipos con despachos diarios', '750 viajes/mes, 5 bodegas y 25 conductores privados', 'Reportes operativos y paywalls claros hacia Scale/Enterprise', getSupportLabel(plan)],
        scale: ['3.000 viajes/mes para redes en crecimiento', 'API/webhooks, control tower y flota privada avanzada', 'Reportes, exportaciones, novedades y soporte premium', 'Scorecards basicos de rutas y proveedores', getSupportLabel(plan)],
        enterprise: ['Volumen personalizado bajo contrato', 'Control de margen logistico por ruta, proveedor y zona', 'Contratos, scorecards y alertas de sobrecosto', 'Aprobaciones, auditoria, treasury y SLA operativo', getSupportLabel(plan)],
    };
    return [...shared, ...(byCode[plan.code] || [getSupportLabel(plan)])];
}

function PlansPageContent() {
    const searchParams = useSearchParams();
    const { user } = useAuthStore();
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [subscription, setSubscription] = React.useState<BusinessPlanSubscription | null>(null);
    const [plans, setPlans] = React.useState<BillingPlan[]>([]);
    const [limits, setLimits] = React.useState<WarehouseListResponse['limits']>({
        activeWarehouses: 0,
        maxWarehouses: null,
        activeInternalUsers: 0,
        maxInternalUsers: null,
        monthlyTrips: 0,
        maxMonthlyTrips: null,
        activePrivateFleetDrivers: 0,
        maxPrivateFleetDrivers: null,
    });
    const [canManageBilling, setCanManageBilling] = React.useState(false);
    const [teamSchemaReady, setTeamSchemaReady] = React.useState(true);
    const [teamSchemaMessage, setTeamSchemaMessage] = React.useState<string | null>(null);
    const [billingCheckoutReady, setBillingCheckoutReady] = React.useState(true);
    const [billingCheckoutMessage, setBillingCheckoutMessage] = React.useState<string | null>(null);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [subscriptionSnapshot, usageSnapshot] = await Promise.all([
                warehouseClient.getBillingSubscription(),
                warehouseClient.getBillingUsage(),
            ]);
            setSubscription(subscriptionSnapshot.subscription ?? null);
            setPlans(subscriptionSnapshot.plans ?? []);
            setLimits(usageSnapshot.usage ?? usageSnapshot.limits);
            setCanManageBilling(Boolean(subscriptionSnapshot.canManageBilling));
            setTeamSchemaReady(subscriptionSnapshot.teamSchemaReady ?? usageSnapshot.teamSchemaReady ?? true);
            setTeamSchemaMessage(subscriptionSnapshot.teamSchemaMessage ?? usageSnapshot.teamSchemaMessage ?? null);
            setBillingCheckoutReady(subscriptionSnapshot.billingCheckoutReady ?? usageSnapshot.billingCheckoutReady ?? true);
            setBillingCheckoutMessage(subscriptionSnapshot.billingCheckoutMessage ?? usageSnapshot.billingCheckoutMessage ?? null);
        } catch (error) {
            toast.error('Planes', error instanceof Error ? error.message : 'No se pudo cargar la facturacion');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    React.useEffect(() => {
        const paymentStatus = searchParams?.get('pago');
        if (!paymentStatus) return;

        if (paymentStatus === 'exitoso') {
            toast.success('Facturacion', 'Verificando la activacion de tu plan...');
            (async () => {
                try {
                    const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
                    const res = await fetch('/api/billing/subscription/reconcile', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${session?.access_token}`,
                            'Content-Type': 'application/json',
                        },
                    });
                    const data = await res.json();
                    const result = data?.data || data;
                    if (result?.reconciled && result?.activatedPlan) {
                        toast.success('Plan activado', `Tu empresa ahora opera con el plan ${result.activatedPlan.toUpperCase()}`);
                    } else {
                        toast.success('Facturacion', 'Tu activacion fue recibida. El plan se actualizara en segundos.');
                    }
                } catch {
                    toast.success('Facturacion', 'Tu activacion fue recibida. Estamos verificando el pago.');
                }
                void loadData();
            })();
        } else {
            const messages: Record<string, string> = {
                pendiente: 'La activacion del plan sigue pendiente de confirmacion.',
                fallido: 'La activacion del plan no se completo.',
            };
            toast.success('Facturacion', messages[paymentStatus] || 'Estado de pago recibido');
            void loadData();
        }
    }, [loadData, searchParams]);

    if (user?.userType === 'trucker') {
        return (
            <DashboardLayout pageTitle="Planes">
                <Card className="p-5 text-center sm:p-8 md:p-10">
                    <Building2 className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
                    <h1 className="text-2xl font-semibold text-zinc-950">Planes empresariales</h1>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                        La monetizacion de bodegas, equipos e integraciones vive del lado business/admin.
                    </p>
                </Card>
            </DashboardLayout>
        );
    }

    const publicPlans = plans.filter((p) => p.is_public);
    const infrastructureWarning = teamSchemaMessage || billingCheckoutMessage;
    const entitlementState = limits.entitlementState || (limits.pilotActive ? 'pilot_active' : 'free');
    const isPilotActive = entitlementState === 'pilot_active';
    const isPilotExpired = entitlementState === 'pilot_expired';
    const pilotDaysRemaining = limits.pilotDaysRemaining;
    const currentPlanName = isPilotActive ? 'Acceso Operativo' : subscription?.plan?.name || 'Free';

    return (
        <DashboardLayout pageTitle="Planes y facturacion">
            <div className="space-y-8">
                <EnterpriseHero
                    eyebrow="Revenue OS"
                    title="Planes, limites y checkout con control empresarial"
                    description="El plan actual vive arriba, el consumo se lee sin esfuerzo y el checkout de Mercado Pago queda claro para owner/admin."
                    icon={Crown}
                    meta={[
                        { label: 'Plan actual', value: currentPlanName, detail: subscription?.status || entitlementState },
                        { label: 'Viajes del mes', value: limits.monthlyTrips, detail: limits.maxMonthlyTrips === null ? 'Sin limite' : `Limite ${limits.maxMonthlyTrips}` },
                        { label: 'Flota privada', value: limits.activePrivateFleetDrivers, detail: limits.maxPrivateFleetDrivers === null ? 'Sin limite' : `Limite ${limits.maxPrivateFleetDrivers}` },
                    ]}
                />

                {loading ? (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    </div>
                ) : (
                    <>
                        {(!teamSchemaReady || !billingCheckoutReady) && infrastructureWarning ? (
                            <InlineNotice
                                tone="warning"
                                title="Activacion comercial pendiente"
                                description={infrastructureWarning}
                            />
                        ) : null}

                        {isPilotActive ? (
                            <InlineNotice
                                title="Acceso Operativo activo"
                                description={`Quedan ${pilotDaysRemaining ?? 'varios'} dias. Al terminar, Free mantiene 1 bodega, 2 usuarios, 3 conductores y 50 viajes/mes.`}
                                action={<Button asChild><Link href="#planes">Ver plan recomendado</Link></Button>}
                            />
                        ) : null}

                        {isPilotExpired ? (
                            <InlineNotice
                                tone="warning"
                                title="Acceso Operativo finalizado"
                                description="Tu cuenta ya opera con limites Free. Tus datos, viajes activos, evidencia, wallet y reportes siguen disponibles."
                                action={<Button asChild><Link href="#planes">Activar plan</Link></Button>}
                            />
                        ) : null}

                        <Card className="kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6">
                            <SectionHeader
                                icon={ShieldCheck}
                                title="Uso de limites"
                                description="Cada numero sale del snapshot de billing/usage. No cambia el modelo de billing ni roles."
                            />
                            <div className="mt-5 grid kx-enterprise-grid gap-4">
                                <UsageMeter label="Bodegas activas" current={limits.activeWarehouses} max={limits.maxWarehouses} />
                                <UsageMeter label="Usuarios internos" current={limits.activeInternalUsers} max={limits.maxInternalUsers} />
                                <UsageMeter label="Viajes del mes" current={limits.monthlyTrips} max={limits.maxMonthlyTrips} />
                                <UsageMeter label="Conductores privados" current={limits.activePrivateFleetDrivers} max={limits.maxPrivateFleetDrivers} />
                            </div>
                        </Card>

                        <div id="planes" className="space-y-5">
                            <SectionHeader
                                icon={BadgeCheck}
                                title="Comparacion de planes"
                                description="Seleccion sobria, capacidad clara y checkout visible cuando el plan requiere pago."
                            />
                            <div className="grid kx-enterprise-grid gap-5">
                                {publicPlans.map((plan) => {
                                    const isCurrentPlan = plan.action_state === 'current';
                                    const needsCheckout = plan.action_state === 'checkout';
                                    const isBlocked = plan.action_state === 'blocked_by_usage';
                                    const isEnterpriseSales = plan.code === 'enterprise' && !isCurrentPlan;
                                    const isDowngradeWithoutCheckout =
                                        plan.action_state === 'switch_now' &&
                                        getNumericPrice(plan) < getNumericPrice(subscription?.plan);
                                    const canClick = canManageBilling && !isCurrentPlan && !isBlocked && !isEnterpriseSales && (!needsCheckout || billingCheckoutReady);
                                    const referenceLabel = getPlanReferenceLabel(plan);

                                    return (
                                        <Card
                                            key={plan.code}
                                            className={`kx-enterprise-card flex h-full flex-col p-4 min-[380px]:p-5 sm:p-6 ${plan.code === 'enterprise' ? 'bg-zinc-950 text-white border-zinc-900' : 'bg-white'}`}
                                        >
                                            <div className="mb-4 flex items-center justify-between gap-3">
                                                <p className={`text-xs font-bold uppercase tracking-widest ${plan.code === 'enterprise' ? 'text-white/50' : 'text-zinc-500'}`}>
                                                    {getPlanStage(plan)}
                                                </p>
                                                {isCurrentPlan ? <StatusPill tone={plan.code === 'enterprise' ? 'inverse' : 'neutral'}>Actual</StatusPill> : null}
                                                {!isCurrentPlan && plan.code === 'growth' ? <StatusPill>Recomendado</StatusPill> : null}
                                            </div>

                                            <h3 className={`text-2xl font-semibold ${plan.code === 'enterprise' ? 'text-white' : 'text-zinc-950'}`}>{plan.name}</h3>
                                            <p className={`mt-2 min-h-[48px] text-sm leading-6 ${plan.code === 'enterprise' ? 'text-white/60' : 'text-zinc-500'}`}>{plan.tagline}</p>

                                            <div className="mt-5">
                                                <p className={`break-words font-money text-3xl font-semibold leading-tight min-[420px]:text-4xl ${plan.code === 'enterprise' ? 'text-white' : 'text-zinc-950'}`}>
                                                    {getPlanPriceLabel(plan)}
                                                </p>
                                                <p className={`mt-2 text-xs ${plan.code === 'enterprise' ? 'text-white/50' : 'text-zinc-500'}`}>/ mes + IVA si aplica</p>
                                                {referenceLabel ? (
                                                    <p className={`mt-1 text-xs ${plan.code === 'enterprise' ? 'text-white/50' : 'text-zinc-500'}`}>{referenceLabel}</p>
                                                ) : null}
                                            </div>

                                            <div className="mt-6 flex-1 space-y-3">
                                                {getPlanHighlights(plan).map((feature) => (
                                                    <div key={feature} className="flex items-start gap-2.5 text-sm">
                                                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.code === 'enterprise' ? 'text-white/70' : 'text-zinc-700'}`} />
                                                        <span className={plan.code === 'enterprise' ? 'text-white/72' : 'text-zinc-700'}>{feature}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {isEnterpriseSales ? (
                                                <Button
                                                    className="mt-6 w-full"
                                                    variant="secondary"
                                                    asChild
                                                >
                                                    <Link href="/soporte?tema=enterprise">Hablar con ventas</Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    className="mt-6 w-full"
                                                    variant={plan.code === 'enterprise' ? 'secondary' : isCurrentPlan ? 'outline' : 'primary'}
                                                    disabled={!canClick}
                                                    isLoading={actionLoading === plan.code}
                                                    rightIcon={needsCheckout && !isCurrentPlan ? <ArrowUpRight className="h-4 w-4" /> : undefined}
                                                    onClick={async () => {
                                                        setActionLoading(plan.code);
                                                        try {
                                                            if (plan.action_state === 'switch_now') {
                                                                const next = await warehouseClient.updatePlan({ planCode: plan.code });
                                                                setSubscription(next.subscription ?? null);
                                                                setPlans(next.plans ?? []);
                                                                setLimits(next.limits);
                                                                setTeamSchemaReady(next.teamSchemaReady ?? true);
                                                                setTeamSchemaMessage(next.teamSchemaMessage ?? null);
                                                                setBillingCheckoutReady(next.billingCheckoutReady ?? true);
                                                                setBillingCheckoutMessage(next.billingCheckoutMessage ?? null);
                                                                toast.success(
                                                                    'Plan actualizado',
                                                                    isDowngradeWithoutCheckout
                                                                        ? `Tu empresa ahora opera con ${plan.name}. No se requirio checkout porque el uso actual cabe en el plan.`
                                                                        : `Tu empresa ahora opera con ${plan.name}`
                                                                );
                                                                return;
                                                            }
                                                            if (plan.action_state === 'checkout') {
                                                                const checkout = await warehouseClient.createPlanCheckout({ planCode: plan.code });
                                                                const checkoutUrl = checkout.preference.init_point || checkout.preference.sandbox_init_point;
                                                                if (!checkoutUrl) throw new Error('No se recibio la URL de activacion del plan');
                                                                window.location.href = checkoutUrl;
                                                                return;
                                                            }
                                                            if (plan.action_disabled_reason) throw new Error(plan.action_disabled_reason);
                                                        } catch (error) {
                                                            toast.error('Facturacion', error instanceof Error ? error.message : 'No se pudo procesar el cambio de plan');
                                                        } finally {
                                                            setActionLoading(null);
                                                        }
                                                    }}
                                                >
                                                    {!canManageBilling
                                                        ? 'Solo owner/admin'
                                                        : !billingCheckoutReady && needsCheckout
                                                            ? 'Checkout pendiente'
                                                            : needsCheckout
                                                                ? 'Continuar a Mercado Pago'
                                                                : plan.action_label || 'Activar plan'}
                                                </Button>
                                            )}

                                            {isBlocked && plan.action_disabled_reason ? (
                                                <p className={`mt-3 text-xs ${plan.code === 'enterprise' ? 'text-white/60' : 'text-zinc-500'}`}>
                                                    {plan.action_disabled_reason}
                                                </p>
                                            ) : null}
                                            {isDowngradeWithoutCheckout ? (
                                                <p className={`mt-3 text-xs ${plan.code === 'enterprise' ? 'text-white/60' : 'text-zinc-500'}`}>
                                                    Los cambios a planes de menor precio se aplican inmediatamente si tu uso actual cabe en ese plan.
                                                </p>
                                            ) : null}
                                        </Card>
                                    );
                                })}

                                {!publicPlans.length ? (
                                    <div className="lg:col-span-2 xl:col-span-4">
                                        <Card className="p-5 text-center sm:p-8">
                                            <Building2 className="mx-auto h-10 w-10 text-zinc-700" />
                                            <h2 className="mt-4 text-xl font-semibold text-zinc-950">No hay planes publicos configurados</h2>
                                            <p className="mt-2 text-sm text-zinc-500">Publica tus planes comerciales en billing_plans para activar esta capa.</p>
                                        </Card>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

function PlansPageFallback() {
    return (
        <DashboardLayout pageTitle="Planes y facturacion">
            <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
            </div>
        </DashboardLayout>
    );
}

function PublicPricingPage() {
    const [publicPlans, setPublicPlans] = React.useState<BillingPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const response = await fetch('/api/billing/plans/public', {
                    headers: {
                        Accept: 'application/json',
                    },
                });
                const payload = await response.json();
                const data = payload?.data || payload;

                if (!response.ok) {
                    throw new Error(payload?.error?.message || 'No se pudieron cargar los planes');
                }

                if (mounted) {
                    setPublicPlans(Array.isArray(data?.plans) ? data.plans : []);
                    setLoadError(null);
                }
            } catch (error) {
                if (mounted) {
                    setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los planes');
                }
            } finally {
                if (mounted) {
                    setLoadingPlans(false);
                }
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <main className="min-h-screen bg-[var(--color-background)]">
            <section className="mx-auto max-w-6xl px-3 py-8 min-[380px]:px-4 sm:px-6 sm:py-12 lg:px-8">
                <EnterpriseHero
                    eyebrow="Planes de produccion"
                    title="Planes KargaX"
                    description={`Free valida, Starter convierte, Growth es el recomendado, Scale automatiza y Enterprise se vende con contrato. Cobro en COP por Mercado Pago con referencia USD. Marketplace mantiene ${MARKETPLACE_COMMISSION_PERCENT}% solo en viajes externos.`}
                    icon={Crown}
                    actions={(
                        <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
                            <Button asChild><Link href="/registro">Crear cuenta</Link></Button>
                            <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" asChild><Link href="/soporte">Hablar con ventas</Link></Button>
                        </div>
                    )}
                />

                {loadingPlans ? (
                    <div className="flex min-h-[32vh] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
                    </div>
                ) : loadError ? (
                    <Card className="mt-8 p-5 text-center sm:p-8">
                        <Building2 className="mx-auto h-10 w-10 text-zinc-700" />
                        <h2 className="mt-4 text-xl font-semibold text-zinc-950">No pudimos cargar los planes</h2>
                        <p className="mt-2 text-sm text-zinc-500">{loadError}</p>
                    </Card>
                ) : (
                    <div className="mt-8 grid kx-enterprise-grid gap-5">
                        {publicPlans.map((plan) => {
                            const referenceLabel = getPlanReferenceLabel(plan);

                            return (
                                <Card key={plan.code} className={`kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6 ${plan.code === 'enterprise' ? 'bg-zinc-950 text-white border-zinc-900' : 'bg-white border-zinc-200'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className={`text-xs uppercase tracking-[0.18em] ${plan.code === 'enterprise' ? 'text-white/50' : 'text-zinc-500'}`}>{getPlanStage(plan)}</p>
                                        {plan.code === 'growth' ? <StatusPill>Recomendado</StatusPill> : null}
                                    </div>
                                    <h2 className={`mt-4 text-2xl font-semibold ${plan.code === 'enterprise' ? 'text-white' : 'text-zinc-950'}`}>{plan.name}</h2>
                                    <p className={`mt-3 min-h-[48px] text-sm leading-6 ${plan.code === 'enterprise' ? 'text-white/60' : 'text-zinc-500'}`}>{plan.tagline}</p>
                                    <p className={`mt-5 break-words font-money text-3xl font-semibold leading-tight min-[420px]:text-4xl ${plan.code === 'enterprise' ? 'text-white' : 'text-zinc-950'}`}>{getPlanPriceLabel(plan)}</p>
                                    <p className={`mt-2 text-xs ${plan.code === 'enterprise' ? 'text-white/50' : 'text-zinc-500'}`}>/ mes + IVA si aplica</p>
                                    {referenceLabel ? (
                                        <p className={`mt-1 text-xs ${plan.code === 'enterprise' ? 'text-white/50' : 'text-zinc-500'}`}>{referenceLabel}</p>
                                    ) : null}
                                    <div className="mt-6 space-y-3">
                                        {getPlanHighlights(plan).map((item) => (
                                            <div key={item} className="flex items-start gap-2">
                                                <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.code === 'enterprise' ? 'text-white/70' : 'text-zinc-700'}`} />
                                                <p className={`text-sm leading-6 ${plan.code === 'enterprise' ? 'text-white/70' : 'text-zinc-600'}`}>{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <Button className="mt-6 w-full" variant={plan.code === 'enterprise' ? 'secondary' : 'primary'} asChild>
                                        <Link href={plan.code === 'enterprise' ? '/soporte?tema=enterprise' : `/registro?tipo=business&plan=${encodeURIComponent(plan.code)}`}>
                                            {plan.code === 'enterprise' ? 'Hablar con equipo comercial' : 'Comenzar'}
                                        </Link>
                                    </Button>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}

export default function PlansPage() {
    const { user, isInitialized } = useAuthStore();

    if (!isInitialized) {
        return <PlansPageFallback />;
    }

    if (!user) {
        return <PublicPricingPage />;
    }

    return (
        <React.Suspense fallback={<PlansPageFallback />}>
            <PlansPageContent />
        </React.Suspense>
    );
}
