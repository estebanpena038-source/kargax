# UI skeleton — `/dashboard/control-margen/page.tsx`

```tsx
'use client';

import * as React from 'react';
import { Loader2, RefreshCw, TrendingDown, FileText, Shield, Route, Truck } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Card, toast } from '@/components/ui';
import { EnterpriseHero, EnterpriseMetric, SectionHeader, StatusPill } from '@/components/enterprise/EnterpriseLuxury';
import lastMileClient from '@/lib/last-mile/client';
import type { LastMileSummaryResponse } from '@/lib/last-mile/types';

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function ControlMargenPage() {
  const [month, setMonth] = React.useState(currentMonth());
  const [summary, setSummary] = React.useState<LastMileSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await lastMileClient.getSummary({ month }));
    } catch (error) {
      toast.error('Control de margen', error instanceof Error ? error.message : 'No se pudo cargar el módulo');
    } finally {
      setLoading(false);
    }
  }, [month]);

  React.useEffect(() => { void load(); }, [load]);

  async function syncMonth() {
    setSyncing(true);
    try {
      const result = await lastMileClient.syncObservations({ month });
      toast.success('Control de margen', `Sync listo: ${result.processedOffers} viajes procesados.`);
      await load();
    } catch (error) {
      toast.error('Control de margen', error instanceof Error ? error.message : 'No se pudo sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <DashboardLayout pageTitle="Control de margen">
      <div className="space-y-6">
        <EnterpriseHero
          eyebrow="Margen logístico"
          title="Control de margen en última milla"
          description="Estandariza contratos, compara tarifa pactada contra costo real y convierte evidencia operativa en alertas de renegociación."
          icon={TrendingDown}
          actions={(
            <div className="flex gap-2">
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-xl border px-3 py-2" />
              <Button onClick={syncMonth} disabled={syncing || !summary?.access.canRunSync}>
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sincronizar mes
              </Button>
            </div>
          )}
        />

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Cargando control de margen...</Card>
        ) : summary ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <EnterpriseMetric label="Fuga estimada" value={money.format(summary.metrics.leakageCop || 0)} icon={TrendingDown} />
              <EnterpriseMetric label="Variación promedio" value={`${(summary.metrics.avgOverrunPct || 0).toFixed(1)}%`} icon={Shield} />
              <EnterpriseMetric label="Evidencia completa" value={`${(summary.metrics.evidenceCompleteRate || 0).toFixed(0)}%`} icon={FileText} />
              <EnterpriseMetric label="Alertas abiertas" value={String(summary.metrics.openRecommendations || 0)} icon={Route} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <SectionHeader title="Rutas con mayor fuga" description="Priorización por sobrecosto acumulado." />
                <div className="mt-4 space-y-3">
                  {summary.topRoutes.map((route) => (
                    <div key={route.laneId || route.label} className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <p className="font-medium">{route.label}</p>
                        <p className="text-xs text-muted-foreground">{route.trips} viajes · {route.avgOverrunPct.toFixed(1)}%</p>
                      </div>
                      <span className="font-semibold">{money.format(route.leakageCop || 0)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <SectionHeader title="Proveedores a revisar" description="Costo, evidencia y score operativo." />
                <div className="mt-4 space-y-3">
                  {summary.topCarriers.map((carrier) => (
                    <div key={carrier.carrierId || carrier.name} className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <p className="font-medium">{carrier.name}</p>
                        <p className="text-xs text-muted-foreground">{carrier.trips} viajes · score {carrier.score.toFixed(0)}</p>
                      </div>
                      <StatusPill status={carrier.score >= 80 ? 'success' : carrier.score >= 60 ? 'warning' : 'danger'}>
                        {money.format(carrier.leakageCop || 0)}
                      </StatusPill>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
```
