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
    return ({ free: 'Arranque', growth: 'Operacion', scale: 'Expansion', enterprise: 'Corporativo' } as Record<string, string>)[plan.code] || 'Plan';
}

function getSupportLabel(plan: BillingPlan) {
    return ({ email: 'Soporte por email', priority: 'Soporte prioritario', premium: 'Soporte premium' } as Record<string, string>)[plan.support_tier] || 'Soporte incluido';
}

function getNumericPrice(plan: BillingPlan | BusinessPlanSubscription['plan'] | null | undefined) {
    return Number(plan?.price_monthly_cop ?? 0) || Math.round(Number(plan?.price_monthly_usd || 0) * 4000);
}

function getPlanHighlights(plan: BillingPlan) {
    const shared = [
        formatPlanCapacity(plan.max_warehouses, 'bodegas activas', 'Bodegas ilimitadas'),
        formatPlanCapacity(plan.max_internal_users, 'usuarios internos', 'Usuarios internos ilimitados'),
        formatPlanCapacity(plan.max_monthly_trips, 'viajes por mes', 'Viajes ilimitados'),
        formatPlanCapacity(plan.max_private_fleet_drivers, 'conductores privados', 'Flota privada ilimitada'),
    ];
    const byCode: Record<string, string[]> = {
        free: ['50 viajes/mes para validar operacion real', 'PIN/POD, evidencia esencial y wallet base', `Marketplace con ${MARKETPLACE_COMMISSION_PERCENT}% solo en viajes externos`, getSupportLabel(plan)],
        growth: ['500 viajes/mes para operacion B2B inicial', 'Equipo interno, bodegas base y flota privada inicial', 'Paywall comercial hacia Control de margen Enterprise', getSupportLabel(plan)],
        scale: ['2.000 viajes/mes para 3PL y equipos en crecimiento', 'API/webhooks, control tower y flota privada avanzada', 'Scorecards basicos de rutas y proveedores', getSupportLabel(plan)],
        enterprise: ['Volumen personalizado bajo contrato', 'Control de margen logistico por ruta, proveedor y zona', 'Contratos, scorecards y alertas de sobrecosto', 'Enterprise Margin OS desde $4.500.000 COP/mes', 'Aprobaciones, auditoria, treasury y soporte premium', getSupportLabel(plan)],
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
    const currentPlanName = isPilotActive ? 'Launch Pilot' : subscription?.plan?.name || 'Free';

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
                                title="Launch Pilot activo"
                                description={`Quedan ${pilotDaysRemaining ?? 'varios'} dias. Al terminar, Free mantiene 1 bodega, 3 usuarios, 3 conductores y 25 viajes/mes.`}
                                action={<Button asChild><Link href="#planes">Ver plan recomendado</Link></Button>}
                            />
                        ) : null}

                        {isPilotExpired ? (
                            <InlineNotice
                                tone="warning"
                                title="Piloto finalizado"
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
                                    const isDowngradeWithoutCheckout =
                                        plan.action_state === 'switch_now' &&
                                        getNumericPrice(plan) < getNumericPrice(subscription?.plan);
                                    const canClick = canManageBilling && !isCurrentPlan && !isBlocked && (!needsCheckout || billingCheckoutReady);

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
                                            </div>

                                            <h3 className={`text-2xl font-semibold ${plan.code === 'enterprise' ? 'text-white' : 'text-zinc-950'}`}>{plan.name}</h3>
                                            <p className={`mt-2 min-h-[48px] text-sm leading-6 ${plan.code === 'enterprise' ? 'text-white/60' : 'text-zinc-500'}`}>{plan.tagline}</p>

                                            <div className="mt-5">
                                                <p className={`break-words font-money text-3xl font-semibold leading-tight min-[420px]:text-4xl ${plan.code === 'enterprise' ? 'text-white' : 'text-zinc-950'}`}>
                                                    {formatPriceCop(getNumericPrice(plan))}
                                                </p>
                                                <p className={`mt-2 text-xs ${plan.code === 'enterprise' ? 'text-white/50' : 'text-zinc-500'}`}>/ mes + IVA si aplica</p>
                                            </div>

                                            <div className="mt-6 flex-1 space-y-3">
                                                {getPlanHighlights(plan).map((feature) => (
                                                    <div key={feature} className="flex items-start gap-2.5 text-sm">
                                                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.code === 'enterprise' ? 'text-white/70' : 'text-zinc-700'}`} />
                                                        <span className={plan.code === 'enterprise' ? 'text-white/72' : 'text-zinc-700'}>{feature}</span>
                                                    </div>
                                                ))}
                                            </div>

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
    const publicPlans = [
        {
            code: 'free',
            name: 'Free',
            price: '$0 COP',
            tagline: 'Validacion inicial',
            highlights: ['1 bodega, 3 usuarios, 3 conductores', '25 viajes/mes', 'PIN/POD, wallet y evidencia esencial'],
        },
        {
            code: 'growth',
            name: 'Pro',
            price: '$149.000 COP',
            tagline: 'Operacion diaria',
            highlights: ['5 bodegas, 20 usuarios, 20 conductores', '500 viajes/mes', 'Inventario visual, ubicaciones y analitica base'],
        },
        {
            code: 'scale',
            name: 'Scale',
            price: '$399.000 COP',
            tagline: '3PL y automatizacion',
            highlights: ['25 bodegas y 100 usuarios', '2.000 viajes/mes', 'API/webhooks, control tower y scorecards basicos'],
        },
        {
            code: 'enterprise',
            name: 'Enterprise',
            price: 'Desde $4.500.000 COP',
            tagline: 'Margin OS y governance',
            highlights: ['Volumen bajo contrato', 'Control de margen por ruta y proveedor', 'Contratos, alertas y renegociaciones sugeridas'],
        },
    ];

    return (
        <main className="min-h-screen bg-[var(--color-background)]">
            <section className="mx-auto max-w-6xl px-3 py-8 min-[380px]:px-4 sm:px-6 sm:py-12 lg:px-8">
                <EnterpriseHero
                    eyebrow="Planes de produccion"
                    title="Planes KargaX"
                    description={`Free, Pro y Scale entran por uso inmediato en COP. Enterprise entra por Control de margen, operacion multiempresa, treasury, governance y soporte operativo serio. Marketplace mantiene ${MARKETPLACE_COMMISSION_PERCENT}% solo en viajes externos.`}
                    icon={Crown}
                    actions={(
                        <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
                            <Button asChild><Link href="/registro">Crear cuenta</Link></Button>
                            <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" asChild><Link href="/soporte">Hablar con ventas</Link></Button>
                        </div>
                    )}
                />

                <div className="mt-8 grid kx-enterprise-grid gap-5">
                    {publicPlans.map((plan) => (
                        <Card key={plan.code} className={`kx-enterprise-card p-4 min-[380px]:p-5 sm:p-6 ${plan.code === 'enterprise' ? 'bg-zinc-950 text-white border-zinc-900' : 'bg-white border-zinc-200'}`}>
                            <p className={`text-xs uppercase tracking-[0.18em] ${plan.code === 'enterprise' ? 'text-white/50' : 'text-zinc-500'}`}>{plan.tagline}</p>
                            <h2 className={`mt-4 text-2xl font-semibold ${plan.code === 'enterprise' ? 'text-white' : 'text-zinc-950'}`}>{plan.name}</h2>
                            <p className={`mt-3 break-words font-money text-3xl font-semibold leading-tight min-[420px]:text-4xl ${plan.code === 'enterprise' ? 'text-white' : 'text-zinc-950'}`}>{plan.price}</p>
                            <div className="mt-6 space-y-3">
                                {plan.highlights.map((item) => (
                                    <div key={item} className="flex items-start gap-2">
                                        <Check className={`mt-0.5 h-4 w-4 ${plan.code === 'enterprise' ? 'text-white/70' : 'text-zinc-700'}`} />
                                        <p className={`text-sm leading-6 ${plan.code === 'enterprise' ? 'text-white/70' : 'text-zinc-600'}`}>{item}</p>
                                    </div>
                                ))}
                            </div>
                            <Button className="mt-6 w-full" variant={plan.code === 'enterprise' ? 'secondary' : 'primary'} asChild>
                                <Link href={plan.code === 'enterprise' ? '/soporte' : '/registro'}>
                                    {plan.code === 'enterprise' ? 'Hablar con equipo comercial' : 'Comenzar'}
                                </Link>
                            </Button>
                        </Card>
                    ))}
                </div>
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
