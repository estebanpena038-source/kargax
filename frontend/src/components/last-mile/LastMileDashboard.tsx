'use client';

import * as React from 'react';
import { AlertCircle, Building2, Plus, RefreshCw, Route, ShieldAlert, Truck } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Badge, Button, Card, Input, SkeletonStats, toast } from '@/components/ui';
import lastMileClient, { LastMileApiError } from '@/lib/last-mile/client';
import type {
    CreateLastMileContractPayload,
    LastMileDashboardResponse,
    LastMileRecommendationStatus,
} from '@/lib/last-mile/types';
import { useAuthStore } from '@/features/auth/store/authStore';
import LastMileKpiCards from './LastMileKpiCards';
import MarginAlertsPanel from './MarginAlertsPanel';
import ProviderScorecardTable from './ProviderScorecardTable';
import ContractsTable from './ContractsTable';
import RenegotiationPipeline from './RenegotiationPipeline';
import RouteCostSnapshotsTable from './RouteCostSnapshotsTable';
import LastMilePaywall from './LastMilePaywall';
import LastMileEmptyState from './LastMileEmptyState';

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMoney(value: number | null | undefined) {
    return money.format(Number(value || 0));
}

function isPaywallError(error: unknown) {
    return error instanceof LastMileApiError && error.status === 402;
}

function isForbiddenError(error: unknown) {
    return error instanceof LastMileApiError && error.status === 403;
}

function TopOpportunityList({ dashboard }: { dashboard: LastMileDashboardResponse }) {
    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                    <Route className="h-5 w-5 text-zinc-950" />
                    <h2 className="text-lg font-bold text-zinc-950">Rutas con oportunidad</h2>
                </div>
                <div className="mt-4 space-y-3">
                    {dashboard.topRoutes.length === 0 ? (
                        <p className="text-sm text-zinc-500">Sin rutas observadas.</p>
                    ) : dashboard.topRoutes.map((route) => (
                        <div key={route.laneId || route.label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-zinc-950">{route.label}</p>
                                    <p className="mt-1 text-xs text-zinc-500">{route.trips} viajes observados</p>
                                </div>
                                <p className="shrink-0 font-money text-sm font-bold text-zinc-950">{formatMoney(route.leakageCop)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
            <Card className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-zinc-950" />
                    <h2 className="text-lg font-bold text-zinc-950">Proveedores a revisar</h2>
                </div>
                <div className="mt-4 space-y-3">
                    {dashboard.topCarriers.length === 0 ? (
                        <p className="text-sm text-zinc-500">Sin proveedores observados.</p>
                    ) : dashboard.topCarriers.map((carrier) => (
                        <div key={carrier.carrierId || carrier.name} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-zinc-950">{carrier.name}</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {carrier.trips} viajes · score {Math.round(carrier.score)}
                                    </p>
                                </div>
                                <p className="shrink-0 font-money text-sm font-bold text-zinc-950">{formatMoney(carrier.leakageCop)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
    return (
        <Card className="p-6">
            <div className="flex min-w-0 items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-zinc-950">No se pudo cargar Control de margen</h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{error.message}</p>
                    <Button className="mt-4" variant="outline" onClick={onRetry}>
                        Reintentar
                    </Button>
                </div>
            </div>
        </Card>
    );
}

function ContractQuickForm({
    canManage,
    onCreate,
}: {
    canManage: boolean;
    onCreate: (payload: CreateLastMileContractPayload) => Promise<void>;
}) {
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [form, setForm] = React.useState({
        providerName: '',
        originCity: '',
        destinationCity: '',
        vehicleType: '',
        baseRateCop: '',
        startsAt: new Date().toISOString().slice(0, 10),
    });

    if (!canManage) return null;

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        try {
            await onCreate({
                providerName: form.providerName,
                originCity: form.originCity || null,
                destinationCity: form.destinationCity || null,
                vehicleType: form.vehicleType || null,
                pricingModel: 'per_trip',
                status: 'active',
                baseRateCop: Number(form.baseRateCop || 0),
                minimumRateCop: Number(form.baseRateCop || 0),
                startsAt: form.startsAt,
            });
            setForm({
                providerName: '',
                originCity: '',
                destinationCity: '',
                vehicleType: '',
                baseRateCop: '',
                startsAt: new Date().toISOString().slice(0, 10),
            });
            setOpen(false);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card className="p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-zinc-950">Nuevo contrato rápido</h2>
                    <p className="mt-1 text-sm text-zinc-500">Crea una tarifa pactada para comparar contra costos observados.</p>
                </div>
                <Button
                    variant={open ? 'outline' : 'primary'}
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setOpen((value) => !value)}
                >
                    {open ? 'Cerrar formulario' : 'Crear contrato'}
                </Button>
            </div>
            {open ? (
                <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-3">
                    <Input
                        required
                        value={form.providerName}
                        onChange={(event) => setForm((current) => ({ ...current, providerName: event.target.value }))}
                        placeholder="Proveedor"
                    />
                    <Input
                        value={form.originCity}
                        onChange={(event) => setForm((current) => ({ ...current, originCity: event.target.value }))}
                        placeholder="Ciudad origen"
                    />
                    <Input
                        value={form.destinationCity}
                        onChange={(event) => setForm((current) => ({ ...current, destinationCity: event.target.value }))}
                        placeholder="Ciudad destino"
                    />
                    <Input
                        value={form.vehicleType}
                        onChange={(event) => setForm((current) => ({ ...current, vehicleType: event.target.value }))}
                        placeholder="Tipo de vehículo"
                    />
                    <Input
                        required
                        type="number"
                        min="0"
                        value={form.baseRateCop}
                        onChange={(event) => setForm((current) => ({ ...current, baseRateCop: event.target.value }))}
                        placeholder="Tarifa base COP"
                    />
                    <Input
                        required
                        type="date"
                        value={form.startsAt}
                        onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                    />
                    <div className="md:col-span-3">
                        <Button type="submit" isLoading={saving}>
                            Guardar contrato
                        </Button>
                    </div>
                </form>
            ) : null}
        </Card>
    );
}

export function LastMileDashboard() {
    const { user } = useAuthStore();
    const [month, setMonth] = React.useState(currentMonth());
    const [dashboard, setDashboard] = React.useState<LastMileDashboardResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [recomputing, setRecomputing] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);

    const loadDashboard = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await lastMileClient.getDashboard({ month });
            setDashboard(data);
        } catch (loadError) {
            setDashboard(null);
            setError(loadError instanceof Error ? loadError : new Error('No se pudo cargar Control de margen'));
        } finally {
            setLoading(false);
        }
    }, [month]);

    React.useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    async function recompute() {
        setRecomputing(true);
        try {
            const result = await lastMileClient.recomputeSnapshots({ month });
            toast.success('Control de margen', `${result.processedOffers} viajes recalculados`);
            await loadDashboard();
        } catch (recomputeError) {
            toast.error('Control de margen', recomputeError instanceof Error ? recomputeError.message : 'No se pudo recalcular');
        } finally {
            setRecomputing(false);
        }
    }

    async function updateRecommendation(id: string, status: LastMileRecommendationStatus, resolutionNote?: string | null) {
        try {
            await lastMileClient.updateRenegotiation(id, { status, resolutionNote });
            toast.success('Renegociación', 'Estado actualizado');
            await loadDashboard();
        } catch (updateError) {
            toast.error('Renegociación', updateError instanceof Error ? updateError.message : 'No se pudo actualizar');
        }
    }

    async function archiveContract(contractId: string) {
        try {
            await lastMileClient.archiveContract(contractId);
            toast.success('Contratos', 'Contrato archivado');
            await loadDashboard();
        } catch (archiveError) {
            toast.error('Contratos', archiveError instanceof Error ? archiveError.message : 'No se pudo archivar');
        }
    }

    async function createContract(payload: CreateLastMileContractPayload) {
        try {
            await lastMileClient.createContract(payload);
            toast.success('Contratos', 'Contrato creado');
            await loadDashboard();
        } catch (createError) {
            toast.error('Contratos', createError instanceof Error ? createError.message : 'No se pudo crear contrato');
            throw createError;
        }
    }

    const isTrucker = user?.userType === 'trucker';
    const isPaywall = error && isPaywallError(error);
    const forbidden = error && isForbiddenError(error);

    return (
        <DashboardLayout
            pageTitle="Control de margen"
            headerActions={(
                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                    <input
                        type="month"
                        value={month}
                        onChange={(event) => setMonth(event.target.value)}
                        className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 font-money text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10 sm:flex-none"
                    />
                    <Button variant="outline" size="icon" onClick={() => void loadDashboard()} disabled={loading} aria-label="Actualizar Control de margen">
                        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    </Button>
                </div>
            )}
        >
            {isTrucker ? (
                <Card className="p-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-zinc-950" />
                        <div>
                            <h2 className="text-base font-bold text-zinc-950">Módulo no disponible para transportadores</h2>
                            <p className="mt-1 text-sm text-zinc-600">Control de margen es una vista empresarial/admin.</p>
                        </div>
                    </div>
                </Card>
            ) : loading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <SkeletonStats key={index} />
                    ))}
                </div>
            ) : isPaywall ? (
                <LastMilePaywall message={error?.message} />
            ) : forbidden ? (
                <LastMilePaywall message={error?.message || 'Tu rol no tiene permiso para ver Control de margen.'} />
            ) : error ? (
                <ErrorState error={error} onRetry={() => void loadDashboard()} />
            ) : dashboard ? (
                <div className="space-y-6">
                    <section className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
                        <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="premium">Enterprise</Badge>
                                    {dashboard.access.readOnly ? <Badge variant="outline">Solo lectura</Badge> : null}
                                    <Badge variant="outline">{dashboard.period.month}</Badge>
                                </div>
                                <h1 className="mt-3 text-2xl font-bold leading-tight text-zinc-950 sm:text-3xl">
                                    Control de margen por contrato, ruta y proveedor
                                </h1>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                                    Revisa fuga estimada, sobrecosto observado, scorecards y renegociación sugerida con datos operativos existentes.
                                </p>
                            </div>
                            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                                <Button
                                    variant="outline"
                                    onClick={() => void recompute()}
                                    isLoading={recomputing}
                                    disabled={!dashboard.access.canRunRecompute}
                                    leftIcon={<RefreshCw className="h-4 w-4" />}
                                >
                                    Recalcular
                                </Button>
                            </div>
                        </div>
                    </section>

                    <LastMileKpiCards dashboard={dashboard} />

                    {!dashboard.snapshots.length && !dashboard.scorecards.length ? (
                        <LastMileEmptyState
                            canRunRecompute={dashboard.access.canRunRecompute}
                            isRecomputing={recomputing}
                            onRecompute={() => void recompute()}
                        />
                    ) : (
                        <>
                            <TopOpportunityList dashboard={dashboard} />
                            {dashboard.access.readOnly ? (
                                <Card className="p-4 sm:p-5">
                                    <p className="text-sm leading-6 text-zinc-600">
                                        Scale muestra scorecards basicos. Contratos, alertas, snapshots detallados y renegociaciones se habilitan en Enterprise.
                                    </p>
                                </Card>
                            ) : (
                                <>
                                    <MarginAlertsPanel
                                        alerts={dashboard.alerts}
                                        canManage={dashboard.access.canManageRenegotiations}
                                        onStatusChange={updateRecommendation}
                                    />
                                    <RenegotiationPipeline
                                        renegotiations={dashboard.renegotiations}
                                        canManage={dashboard.access.canManageRenegotiations}
                                        onStatusChange={updateRecommendation}
                                    />
                                </>
                            )}
                            <ProviderScorecardTable scorecards={dashboard.scorecards} />
                            {!dashboard.access.readOnly ? (
                                <>
                                    <ContractQuickForm canManage={dashboard.access.canManageContracts} onCreate={createContract} />
                                    <ContractsTable
                                        contracts={dashboard.contracts}
                                        canManage={dashboard.access.canManageContracts}
                                        onArchive={archiveContract}
                                    />
                                    <RouteCostSnapshotsTable snapshots={dashboard.snapshots} />
                                </>
                            ) : null}
                        </>
                    )}

                    <Card className="p-4 sm:p-5">
                        <div className="flex min-w-0 items-start gap-3">
                            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-zinc-950" />
                            <p className="text-sm leading-6 text-zinc-600">
                                Este módulo lee viajes, evidencia, contratos y costos operativos. No escribe en pagos, wallet, transacciones ni liquidaciones.
                            </p>
                        </div>
                    </Card>
                </div>
            ) : null}
        </DashboardLayout>
    );
}

export default LastMileDashboard;
