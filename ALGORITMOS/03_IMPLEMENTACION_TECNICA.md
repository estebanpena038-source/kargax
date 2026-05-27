# 03 - Implementación técnica de algoritmos inteligentes

## Diagnóstico

KargaX ya tiene suficientes datos operativos para una primera capa de inteligencia profesional:

- rutas y ofertas en `cargo_offers`;
- tracking PWA en `trip_tracking_sessions` y `trip_location_pings`;
- evidencia en `trip_signature_evidences`, `offer_photos`, `picking_events` y `WarehouseDigitalEvidenceRecord`;
- WMS en `warehouses`, appointments, stock, dispatches, tasks e incidents;
- flota privada en `business_fleet_members`, `compensation_mode` y `trip_financial_allocations`;
- billing en `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags` y plan snapshots;
- reportes en `report_exports`, `/api/reports/business-monthly`, `/dashboard/inteligencia` y `/api/admin/overview`.

La implementación no debe empezar metiendo modelos ML en todas partes. Debe empezar con una arquitectura limpia de scoring explicable, snapshots persistidos, RLS y UI accionable.

## Patrón de arquitectura recomendado

### Regla central

Los algoritmos no deben mutar estados críticos directamente. Deben producir:

- `score`
- `level`
- `reasons`
- `recommended_action`
- `source_type`
- `source_id`
- `business_id`
- `created_at`
- `expires_at`

Luego una acción humana o una API existente ejecuta cambios reales.

### Patrón

```txt
Raw data Supabase
  -> feature extractor server-side
  -> deterministic scoring function
  -> algorithm snapshot table
  -> API por módulo con role guard
  -> UI badge / panel / alert
  -> action href hacia flujo existente
```

### Por qué así

- Es auditable.
- Respeta RLS.
- Permite QA determinístico.
- No toca wallet/billing sin aprobación.
- Permite migrar a ML después usando los snapshots como dataset.

## Carpetas nuevas recomendadas

```txt
frontend/
  src/
    algorithms/
      shared/
        types.ts
        scoring.ts
        geo.ts
        dates.ts
        permissions.ts
        explain.ts
      lastmile/
        deliveryRisk.ts
        deliveryPriority.ts
        eta.ts
        sla.ts
        nextBestAction.ts
        routeEfficiency.ts
        stateRules.ts
      marketplace/
        matching.ts
        offerRanking.ts
        duplicateOffers.ts
        suspiciousOffers.ts
        pricingSuggestion.ts
      private-fleet/
        assignment.ts
        utilization.ts
        compliance.ts
        consolidation.ts
        outOfPattern.ts
      warehouse/
        dispatchPriority.ts
        bottlenecks.ts
        congestion.ts
        pickingRecommendations.ts
        inventoryAnomalies.ts
      evidence/
        evidencePolicy.ts
        evidenceQuality.ts
        podCompleteness.ts
        evidenceAnomalies.ts
        evidenceRail.ts
      wallet/
        financialGuards.ts
        reconciliation.ts
        duplicateSettlements.ts
        railSeparation.ts
      billing/
        usageHealth.ts
        churn.ts
        upsell.ts
        planConsistency.ts
      reports/
        executiveKpis.ts
        executiveAlerts.ts
        operationalLoss.ts
        routeProfitability.ts
        roleEfficiency.ts
```

## Servicios nuevos recomendados

### `frontend/src/algorithms/shared/types.ts`

Tipos canónicos:

```ts
export type AlgorithmModule =
  | 'lastmile'
  | 'marketplace'
  | 'private_fleet'
  | 'warehouse'
  | 'evidence'
  | 'wallet'
  | 'billing'
  | 'reports';

export type AlgorithmLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface AlgorithmReason {
  code: string;
  label: string;
  detail?: string;
  weight?: number;
}

export interface AlgorithmRecommendation {
  module: AlgorithmModule;
  businessId: string;
  sourceType: 'offer' | 'dispatch' | 'warehouse' | 'driver' | 'billing' | 'wallet' | 'report';
  sourceId: string;
  score: number;
  level: AlgorithmLevel;
  title: string;
  summary: string;
  reasons: AlgorithmReason[];
  actionLabel: string;
  actionHref: string;
  metadata?: Record<string, unknown>;
}
```

### `frontend/src/algorithms/shared/scoring.ts`

Funciones puras:

```ts
export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function levelFromScore(score: number) {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'low';
  return 'info';
}
```

### `frontend/src/algorithms/lastmile/deliveryRisk.ts`

Debe leer datos ya disponibles:

- `cargo_offers.status`
- pickup/delivery date/time
- origin/destination coords
- assigned/private trucker
- latest tracking ping
- evidence summary
- incidents/rejections

Salida: `AlgorithmRecommendation`.

### `frontend/src/algorithms/evidence/evidenceQuality.ts`

Debe validar:

- firma POD;
- foto entrega;
- receptor/documento;
- tracking cerca del destino;
- manifest delivered/rejected;
- observación si hay rechazo;
- separación marketplace/privado.

### `frontend/src/algorithms/wallet/financialGuards.ts`

RIESGO ALTO. Solo read-only.

Permitido:

- detectar duplicados;
- alertar saldo negativo;
- alertar private/marketplace mixing;
- marcar `manual_review` recomendado.

Prohibido en primera fase:

- liberar saldo;
- aprobar retiro;
- cambiar estado de payout;
- crear transacción financiera.

## Hooks nuevos recomendados

```txt
frontend/src/hooks/algorithms/
  useLastMileIntelligence.ts
  useEvidenceQuality.ts
  useExecutiveAlerts.ts
  useMarketplaceMatching.ts
  useFleetUtilization.ts
  useWarehouseBottlenecks.ts
  useBillingHealth.ts
```

### Ejemplo de hook

```ts
export function useLastMileIntelligence() {
  return useQuery({
    queryKey: ['lastmile-intelligence'],
    queryFn: async () => {
      const res = await fetch('/api/algorithms/lastmile/overview');
      if (!res.ok) throw new Error('No se pudo cargar la inteligencia de entregas');
      return res.json();
    },
  });
}
```

## Componentes nuevos recomendados

```txt
frontend/src/components/algorithms/
  IntelligencePanel.tsx
  AlgorithmReasonList.tsx
  DeliveryRiskBadge.tsx
  EvidenceQualityBadge.tsx
  NextBestActionCard.tsx
  SlaAlertList.tsx
  RouteEfficiencyTable.tsx
  ExecutiveAlertsPanel.tsx
  FinancialRiskNotice.tsx
  BillingHealthCard.tsx
```

### Copy operativo sugerido

- “Requiere atención”
- “Evidencia incompleta”
- “Entrega en riesgo”
- “Siguiente acción recomendada”
- “Revisar antes de liquidar”
- “No se movió dinero. Solo se generó alerta de revisión.”

## APIs nuevas recomendadas

```txt
frontend/src/app/api/algorithms/
  lastmile/overview/route.ts
  lastmile/[offerId]/route.ts
  evidence/[offerId]/validate/route.ts
  marketplace/[offerId]/matches/route.ts
  private-fleet/overview/route.ts
  warehouse/[warehouseId]/overview/route.ts
  billing/health/route.ts
  reports/executive/route.ts
  wallet/guards/route.ts
```

### Reglas de API

1. Usar `requireAuthenticatedRoute`.
2. Resolver `businessAccess` con `resolveBusinessAccessContext`.
3. Resolver rol con `resolveEffectiveBusinessRole` y capabilities.
4. Filtrar siempre por `business_id`.
5. No retornar montos si `canViewFinance` es falso.
6. No retornar evidencia si `canViewEvidence` es falso.
7. Wallet/billing solo owner/admin/finance/auditor según permiso.

## Tipos/interfaces nuevas recomendadas

```ts
export interface DeliveryRiskInput {
  offerId: string;
  businessId: string;
  status: string;
  isPrivateFleet: boolean;
  deliveryWindowEnd: string | null;
  lastPingAt: string | null;
  lastDistanceToDestinationKm: number | null;
  evidenceMissingCount: number;
  openCriticalIncidents: number;
  driverReliabilityScore: number | null;
}

export interface EvidenceQualityInput {
  offerId: string;
  businessId: string;
  isPrivateFleet: boolean;
  hasDeliverySignature: boolean;
  hasDeliveryPhoto: boolean;
  hasRecipientName: boolean;
  hasTrackingNearDestination: boolean;
  manifestMismatchCount: number;
  rejectedWithoutReasonCount: number;
}
```

## Migraciones necesarias

Crear una nueva migración. No editar migraciones antiguas.

Archivo sugerido:

```txt
supabase/migrations/20260527_algorithms_intelligence_os.sql
```

### SQL propuesto

```sql
begin;

create table if not exists public.algorithm_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.user_profiles(id) on delete cascade,
  module text not null check (module in (
    'lastmile','marketplace','private_fleet','warehouse','evidence','wallet','billing','reports'
  )),
  run_type text not null,
  status text not null default 'completed' check (status in ('started','completed','failed')),
  source_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.algorithm_recommendations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.user_profiles(id) on delete cascade,
  module text not null check (module in (
    'lastmile','marketplace','private_fleet','warehouse','evidence','wallet','billing','reports'
  )),
  source_type text not null,
  source_id uuid,
  score integer not null check (score >= 0 and score <= 100),
  level text not null check (level in ('info','low','medium','high','critical')),
  title text not null,
  summary text not null,
  reasons jsonb not null default '[]'::jsonb,
  action_label text,
  action_href text,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_by_run_id uuid references public.algorithm_runs(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_algorithm_recommendations_business_module
  on public.algorithm_recommendations(business_id, module, status, level, created_at desc);

create index if not exists idx_algorithm_recommendations_source
  on public.algorithm_recommendations(module, source_type, source_id, created_at desc);

create table if not exists public.evidence_quality_checks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.user_profiles(id) on delete cascade,
  offer_id uuid not null references public.cargo_offers(id) on delete cascade,
  is_private_fleet boolean not null default false,
  score integer not null check (score >= 0 and score <= 100),
  status text not null check (status in ('ready','needs_review','blocked')),
  missing_requirements jsonb not null default '[]'::jsonb,
  anomaly_flags jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  created_by_run_id uuid references public.algorithm_runs(id) on delete set null,
  unique (offer_id, checked_at)
);

create index if not exists idx_evidence_quality_checks_business
  on public.evidence_quality_checks(business_id, offer_id, checked_at desc);

create table if not exists public.financial_guardrail_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.user_profiles(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  offer_id uuid references public.cargo_offers(id) on delete set null,
  transaction_id uuid,
  payout_attempt_id uuid,
  rail text not null check (rail in ('marketplace','private_fleet','billing','unknown')),
  severity text not null check (severity in ('info','low','medium','high','critical')),
  event_type text not null,
  title text not null,
  detail text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_financial_guardrail_events_business
  on public.financial_guardrail_events(business_id, rail, severity, status, created_at desc);

alter table public.algorithm_runs enable row level security;
alter table public.algorithm_recommendations enable row level security;
alter table public.evidence_quality_checks enable row level security;
alter table public.financial_guardrail_events enable row level security;

-- Nota: ajustar estas policies a las funciones finales de roles si ya existe helper central.
drop policy if exists "Businesses read own algorithm recommendations" on public.algorithm_recommendations;
create policy "Businesses read own algorithm recommendations"
  on public.algorithm_recommendations for select
  to authenticated
  using (business_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists "Businesses read own evidence checks" on public.evidence_quality_checks;
create policy "Businesses read own evidence checks"
  on public.evidence_quality_checks for select
  to authenticated
  using (business_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists "Finance reads own financial guardrails" on public.financial_guardrail_events;
create policy "Finance reads own financial guardrails"
  on public.financial_guardrail_events for select
  to authenticated
  using (business_id = auth.uid() or public.is_admin_user(auth.uid()));

commit;
```

### Notas de migración

- Si `public.is_admin_user` ya existe, reutilizarla.
- Si hay helper de business team membership con roles, reemplazar policies simples por policies que validen `business_team_members`.
- No crear policies permisivas para storage de evidencia sin revisar privacidad.
- No crear columnas financieras que permitan mover dinero desde algoritmos.

## Separación frontend/backend

### Backend / server

Debe hacer:

- leer Supabase con service/admin client cuando corresponda;
- aplicar role guard;
- calcular scores;
- persistir snapshots;
- devolver recomendaciones filtradas por rol.

### Frontend

Debe hacer:

- renderizar badges, razones y acciones;
- no recalcular reglas sensibles;
- no ocultar restricciones server-side;
- no mostrar dinero/evidencia a roles no autorizados.

## Separación marketplace/privado

Toda recomendación debe incluir:

```ts
const rail = offer.is_private_fleet ? 'private_fleet' : 'marketplace';
```

Reglas:

- Marketplace puede tener comisión, neto y payout elegible.
- Flota privada puede tener pago externo, gastos empresa y comprobantes.
- No mezclar `trip_financial_allocations` privadas con saldo marketplace.
- Reportes deben mostrar secciones separadas.
- Evidencia puede compartir estructura, pero privacidad y soporte deben filtrarse por empresa/rol.

## Separación wallet/billing

### Wallet

RIESGO ALTO.

Algoritmos permitidos:

- conciliación read-only;
- duplicados;
- rail separation;
- manual review recommendation;
- alertas de saldo/anomalía.

Algoritmos prohibidos en P0/P1:

- payout automático;
- release automático de saldo;
- reverso automático;
- aprobación de retiro;
- cambio de balance.

### Billing

RIESGO ALTO.

Algoritmos permitidos:

- uso por cliente;
- plan recomendado;
- churn score;
- inconsistencias uso/cobro;
- alertas de pago pendiente.

Algoritmos prohibidos:

- cambiar plan automáticamente;
- cobrar automáticamente fuera de checkout;
- ocultar datos por churn;
- modificar límites sin migración.

## Integración con rutas existentes

| Superficie | Integración recomendada |
|---|---|
| `/dashboard/inteligencia` | Panel de alertas ejecutivas, KPIs por rol, Next Best Action. |
| `/ofertas/mis-ofertas` | Badge de riesgo, SLA y evidencia. |
| `/viaje/[offerId]` | Acción siguiente, ETA, tracking quality, evidencia faltante. |
| `/viaje/[offerId]/carga` | Validación de salida, PIN/firma/foto requerida. |
| `/viaje/[offerId]/entrega` | POD completeness, evidence quality, bloqueo visual si falta soporte. |
| `/bodegas/[id]/despachos` | Priorización, consolidación y dispatch-to-trip recommendation. |
| `/dashboard/flota` | Utilización, cumplimiento, subutilización, alertas fuera de patrón. |
| `/planes` | Uso 70/90/100%, plan recomendado y churn/upsell para owner/admin. |
| `/billetera` | Solo guardrails visibles al usuario autorizado; no mover dinero. |
| `/admin` / CEO Control Tower | Métricas agregadas, riesgos, payouts manual_review, pilotos en riesgo. |

## Pruebas

### Unitarias recomendadas

Crear tests para funciones puras:

```txt
frontend/src/algorithms/lastmile/deliveryRisk.test.ts
frontend/src/algorithms/evidence/evidenceQuality.test.ts
frontend/src/algorithms/billing/usageHealth.test.ts
frontend/src/algorithms/wallet/railSeparation.test.ts
```

Casos mínimos:

- score bajo con datos sanos;
- score alto con tracking vencido;
- POD sin firma;
- flota privada externa no genera payout elegible;
- dispatcher no recibe monto financiero;
- viewer no recibe evidencia sensible;
- owner sí ve acciones completas.

### QA manual

```bash
npm install
npm run repo:audit
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm run check:release
```

Flujos manuales:

1. Crear bodega.
2. Crear conductor privado.
3. Crear despacho WMS.
4. Convertir despacho a viaje privado.
5. Iniciar tracking PWA.
6. Cerrar entrega con firma/foto.
7. Validar score de evidencia ready.
8. Crear viaje sin firma y validar needs_review.
9. Crear viaje con ping viejo y validar riesgo de retraso.
10. Revisar `/dashboard/inteligencia` como owner, dispatcher, finance, auditor y viewer.
11. Validar que wallet no cambió por ejecutar algoritmos.
12. Validar que billing no cambió plan automáticamente.

## Riesgos

### RIESGO ALTO — Wallet/liquidaciones

No ejecutar cambios de saldo desde algoritmos. Cualquier recomendación financiera debe ser read-only, con `financial_guardrail_events` y revisión manual.

### RIESGO ALTO — Billing

No cambiar planes ni límites desde algoritmos. Usar recomendaciones y checkout existente.

### RIESGO ALTO — RLS/multiempresa

Cada tabla nueva debe tener `business_id`, índices por negocio y policies. No usar consultas agregadas globales para usuario business.

### RIESGO MEDIO — Evidencia

La evidencia incluye fotos, firmas y documentos. No exponer URLs o storage paths a roles sin permiso.

### RIESGO MEDIO — Tracking

PWA foreground genera gaps. Los algoritmos deben mostrar confianza baja, no acusar incumplimiento definitivo.

### RIESGO MEDIO — Datos legacy

`trip_financial_allocations` tiene tipos legacy y canónicos en evolución. Implementar normalizador antes de scoring financiero.

## Archivos a editar

### Nuevos

- `frontend/src/algorithms/shared/types.ts`
- `frontend/src/algorithms/shared/scoring.ts`
- `frontend/src/algorithms/lastmile/deliveryRisk.ts`
- `frontend/src/algorithms/lastmile/nextBestAction.ts`
- `frontend/src/algorithms/lastmile/stateRules.ts`
- `frontend/src/algorithms/evidence/evidenceQuality.ts`
- `frontend/src/algorithms/reports/executiveAlerts.ts`
- `frontend/src/app/api/algorithms/lastmile/overview/route.ts`
- `frontend/src/app/api/algorithms/evidence/[offerId]/validate/route.ts`
- `frontend/src/app/api/algorithms/reports/executive/route.ts`
- `frontend/src/components/algorithms/ExecutiveAlertsPanel.tsx`
- `frontend/src/components/algorithms/DeliveryRiskBadge.tsx`
- `frontend/src/components/algorithms/EvidenceQualityBadge.tsx`
- `supabase/migrations/20260527_algorithms_intelligence_os.sql`

### Existentes a integrar

- `frontend/src/app/dashboard/inteligencia`
- `frontend/src/app/ofertas/mis-ofertas` o ruta equivalente de ofertas de business
- `frontend/src/app/viaje/[offerId]`
- `frontend/src/app/viaje/[offerId]/carga`
- `frontend/src/app/viaje/[offerId]/entrega`
- `frontend/src/app/bodegas/[id]/despachos/page.tsx`
- `frontend/src/lib/server/warehouses.ts`
- `frontend/src/lib/business-roles.ts`
- `frontend/src/lib/warehouses/types.ts`
- `frontend/src/lib/billing/plan-limits.ts`

## Siguiente paso técnico recomendado

Implementar primero el paquete mínimo:

```txt
P0.1 shared/types + scoring
P0.2 lastmile/deliveryRisk
P0.3 evidence/evidenceQuality
P0.4 reports/executiveAlerts
P0.5 API /api/algorithms/lastmile/overview
P0.6 componente ExecutiveAlertsPanel en /dashboard/inteligencia
```

Ese paquete genera demo vendible sin tocar dinero, sin tocar checkout y sin romper flujos existentes.
