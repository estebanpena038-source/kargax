# KargaX Architecture Map para agentes IA — ACTUALIZADO

## Resumen ejecutivo

KargaX es un SaaS logístico B2B para empresas con bodegas, flota, despachos, transportadores, evidencia de entrega, marketplace, wallet/liquidaciones, planes, reportes y Control de Margen Last-Mile.

No es solo tracking. Es cierre logístico + control económico: convertir cada entrega en soporte verificable y cada operación en datos accionables.

## Fuente de verdad

- `frontend/`: app principal Next.js/React/TS.
- `supabase/migrations/`: DB histórica oficial.
- `SPTRINTS/`: roadmap/auditoría.
- `COMMERCIAL/`: pricing, retención, activación.
- `LAST-MILLA/`: estrategia y plan de Control de Margen.
- `scripts/`: auditorías y checks.
- `KARGAX_AI_OPERATING_SYSTEM/`: paquete de instrucciones IA.

## Módulos

### Auth / roles

Usuarios business/admin/trucker y equipo interno. Alto riesgo de datos multiempresa. Usar `role-policy` en rutas sensibles.

### Bodegas

Sedes, inventario visual, recibos, despachos. Riesgo: límites por plan y permisos.

### Viajes / entregas

Creación, asignación, seguimiento y cierre. Riesgo: estados inconsistentes, evidencia incompleta, reportes incorrectos.

### POD / evidencia

PIN/POD, receptor, foto/firma, hora, novedades, soporte descargable. Riesgo: privacidad e integridad.

### Flota privada

Conductores privados/fidelizados. Riesgo: plan limits y experiencia mobile.

### Marketplace

Viajes externos. Constantes: marketplace commission 8%, private fleet commission 0%, currency COP.

### Billing / planes

Free/Growth/Scale/Enterprise, checkout con Mercado Pago, paywall events, `PlanLimitReachedError`, reconciliación de pago.

### Wallet / liquidaciones

Ledger operativo. No vender como banco. Alto riesgo regulatorio/copy/integridad.

### LAST-MILLA / Control de Margen

Módulo Enterprise analítico-operativo:

- carriers/providers;
- lanes/rutas;
- contracts/tarifas;
- snapshots de costo;
- scorecards;
- alertas;
- renegociaciones;
- dashboard `/dashboard/control-margen`.

Regla: no mueve dinero. No toca wallet/pagos/webhook.

### QA / Release / Seguridad

- `scripts/repo-audit.mjs` valida estructura y scripts.
- `scripts/check-role-policy.mjs` bloquea role gates manuales.
- `scripts/security-audit.mjs` busca secretos.
- Frontend tiene visual QA, smoke release, algorithms P0 y debug payment.

## Rutas prioritarias

```text
README.md
AGENTS.md
package.json
frontend/package.json
scripts/repo-audit.mjs
scripts/check-role-policy.mjs
scripts/security-audit.mjs
frontend/src/app/page.tsx
frontend/src/app/planes/page.tsx
frontend/src/lib/billing/pricing.ts
frontend/src/lib/billing/plan-limits.ts
frontend/src/app/api/billing/paywall-events/route.ts
frontend/src/app/dashboard/control-margen/page.tsx
frontend/src/components/last-mile/**
frontend/src/lib/last-mile/**
frontend/src/app/api/last-mile/**
frontend/src/lib/server/role-policy.ts
frontend/src/lib/server/warehouses.ts
supabase/migrations/**
COMMERCIAL/**
LAST-MILLA/**
SPTRINTS/**
```

## Reglas de cambio

- Schema/data: nueva migración.
- Pricing: UI + DB/seed + COMMERCIAL + docs + QA.
- Checkout: QA manual obligatorio.
- Wallet: marcar riesgo alto.
- Last-Mile: no tocar dinero.
- Copy: operacional, directo, sin promesas financieras.

## MVP técnico para cualquier feature

1. Usuario objetivo.
2. Dolor operativo.
3. Evento de valor.
4. Ruta/product surface.
5. Datos necesarios.
6. Límite/plan afectado.
7. Permisos/RLS.
8. Test manual.
9. Métricas.
10. Rollback.
