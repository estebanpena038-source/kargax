# 05 - API Contracts

## Estado

- `COMPLETADO`
- cierre: `operativo para frontend, backoffice y QA`
- semaforo: `verde`

## Objetivo

Unificar contratos HTTP para que UI, backoffice y automatizacion consuman un solo envelope con `requestId`, `code` y errores consistentes.

## Contrato objetivo implementado

```json
{
  "success": true,
  "data": {},
  "error": null,
  "code": "OK",
  "meta": {
    "requestId": "...",
    "timestamp": "..."
  }
}
```

## Resultado implementado

- se creo helper central de response
- se creo helper cliente para `unwrap` y extraccion de errores
- se tiparon contratos de pago canonicos e idempotencia
- se migraron las rutas criticas de `payments`, `billing`, `admin/payments` y `warehouses`
- se alineo el cliente de bodegas para consumir envelope unico o legado mientras termina la transicion global

## Implementacion cerrada

### Helper server-side comun

- archivo: `frontend/src/lib/server/api-response.ts`
- implementado:
  - `apiSuccess`
  - `apiError`
  - `getRequestId`
- efecto:
  - todas las rutas migradas ya responden con el mismo shape

### Helper cliente comun

- archivo: `frontend/src/lib/contracts/api.ts`
- implementado:
  - `extractApiErrorMessage`
  - `unwrapApiEnvelope`
- efecto:
  - los consumidores ya no dependen de formatos inconsistentes

### Contratos de pago canonicos

- archivo: `frontend/src/lib/contracts/payments.ts`
- implementado:
  - `FreightPaymentReference`
  - `BillingPlanPaymentReference`
  - `PaymentReferenceData`
  - `serializePaymentReference`
  - `parsePaymentReference`
  - `buildPaymentIdempotencyKey`
  - `mapMercadoPagoStatusToMoneyFlow`

### Cliente de bodegas endurecido

- archivo: `frontend/src/lib/warehouses/client.ts`
- implementado:
  - parse seguro de envelopes
  - errores coherentes
  - compatibilidad con respuestas nuevas
- impacto:
  - alta/baja/consulta de bodegas y modulos asociados ya consumen un shape consistente

## Rutas normalizadas en este sprint

### Payments y billing

- `api/payments/create-preference`
- `api/payments/webhook`
- `api/payments/simulate`
- `api/billing/subscription`
- `api/billing/subscription/checkout`
- `api/billing/subscription/usage`
- `api/admin/payments/reconcile`

### Warehouses

- `api/warehouses`
- `api/warehouses/access`
- `api/warehouses/[id]`
- `api/warehouses/[id]/appointments`
- `api/warehouses/[id]/docks`
- `api/warehouses/[id]/stock`
- `api/warehouses/[id]/tasks`
- `api/warehouses/[id]/incidents`
- `api/warehouses/[id]/receipts`
- `api/warehouses/[id]/dispatches`

### Consumidores migrados

- `frontend/src/app/pagar/[offerId]/page.tsx`
- `frontend/src/app/admin/page.tsx`
- `frontend/src/lib/warehouses/client.ts`

## Auditoria y evidencia

### Hallazgo principal cerrado

- antes:
  - coexistian respuestas planas, `{ data }`, `{ error }` y retornos arbitrarios
- despues:
  - el bloque critico del MVP ya responde y consume envelope unificado

### Chequeo estructural

- busqueda ejecutada:
  - `rg "NextResponse.json" ...payments ...billing ...warehouses ...admin/payments`
- resultado:
  - `0` matches en el bloque de rutas normalizado

## Definition of Done

- `requestId` consistente en rutas criticas: `SI`
- error parsing consistente en frontend: `SI`
- pagos, billing y warehouse con envelope comun: `SI`
- consumidores principales migrados: `SI`

## Verificacion ejecutada

- `npm run typecheck` -> `PASS`
- `npm run lint` -> `PASS` con `0` errores bloqueantes
- `npm run build` -> `PASS`
- `npm run check` -> `PASS`
- `npm run check:release` -> `PASS`

## Deuda remanente no bloqueante

- quedan warnings heredados de lint fuera de los contratos criticos cerrados aqui
- no todas las rutas del producto completo han sido migradas todavia, pero el bloque que soporta ventas, pagos, bodegas y backoffice si quedo alineado

## Veredicto

`Sprint 05` queda cerrado. El MVP ya tiene un contrato HTTP serio en su ruta comercial central y QA puede automatizar sin adivinar formatos por endpoint.
