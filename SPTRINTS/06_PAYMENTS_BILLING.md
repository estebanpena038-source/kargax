# 06 - Payments Billing

## Estado

- `COMPLETADO`
- cierre: `operativo para cobro de viajes, planes y conciliacion`
- semaforo: `verde`

## Objetivo

Cerrar el sistema de cobro de viajes y planes con referencias canonicas, idempotencia, webhook seguro, conciliacion manual y estados coherentes.

## Resultado implementado

- `create-preference` de viajes y planes ya usa `external_reference` canonico
- ambos flujos generan `idempotencyKey`
- el webhook procesa referencias estructuradas y separa `freight` de `billing_plan`
- el runtime prohibe bypass inseguro en produccion salvo `preview/local` con flag explicito
- la conciliacion manual ya tiene `reasonCode`, `requestId` y `externalId` resuelto
- el simulador dev quedo alineado al envelope oficial para QA y validaciones operativas

## Estados oficiales implementados

- `pending`
- `processing`
- `completed`
- `refunded`
- `cancelled`
- `failed`

## Implementacion cerrada

### Cobro de viajes

- archivo: `frontend/src/app/api/payments/create-preference/route.ts`
- implementado:
  - `requireAal2Route`
  - `FreightPaymentReference`
  - `buildPaymentIdempotencyKey`
  - envelope normalizado
  - retorno con `preference`, `amounts`, `payment`, `externalReference`, `idempotencyKey`

### Cobro de planes

- archivo: `frontend/src/app/api/billing/subscription/checkout/route.ts`
- implementado:
  - `BillingPlanPaymentReference`
  - `billing_plan_payment_attempts`
  - `idempotencyKey`
  - metadata de negocio consistente
  - envelope oficial

### Runtime de pagos

- archivos:
  - `frontend/src/lib/server/runtime-env.ts`
  - `frontend/src/lib/mercadopago/config.ts`
- ya endurecido en sprints previos y validado en este cierre:
  - `NEXT_PUBLIC_APP_URL` publico
  - `MERCADOPAGO_WEBHOOK_SECRET` obligatorio para flujos reales
  - `INTERNAL_API_KEY` y providers reales para notificaciones productivas
  - bypass no firmado restringido a local/preview con flag explicito

### Webhook de pagos

- archivo: `frontend/src/app/api/payments/webhook/route.ts`
- implementado:
  - firma validada
  - ignore seguro para firma invalida o tipos no soportados
  - parse de `external_reference` canonico
  - branch separado para `billing_plan`
  - mapping de estados Mercado Pago -> estados internos
  - replay seguro para duplicados
  - incidente admin cuando falla procesamiento secundario
  - sincronizacion de citas de bodega y envio de PINs tras pago confirmado

### Conciliacion manual

- archivo: `frontend/src/app/api/admin/payments/reconcile/route.ts`
- implementado:
  - `paymentId` u `offerId`
  - `reasonCode`
  - `externalId` resuelto consistentemente
  - envelope con resultado trazable
  - notificacion admin en falla de reconcile

### Simulacion para QA

- archivo: `frontend/src/app/api/payments/simulate/route.ts`
- implementado:
  - solo desarrollo
  - envelope oficial
  - soporte para `rpc` o fallback
  - datos de PIN y contactos listos para pruebas

## Auditoria y evidencia

### Hallazgos cerrados

- antes:
  - pagos de viaje y plan compartian infraestructura pero no una referencia canonicamente estructurada
  - webhook y reconcile tenian trazabilidad desigual
- despues:
  - ambos flujos usan referencia estructurada e idempotencia
  - el backoffice puede reconciliar con contexto y reason code
  - el webhook distingue mejor exito del provider vs procesamiento del negocio

### Archivos clave tocados

- `frontend/src/lib/contracts/payments.ts`
- `frontend/src/app/api/payments/create-preference/route.ts`
- `frontend/src/app/api/payments/webhook/route.ts`
- `frontend/src/app/api/payments/simulate/route.ts`
- `frontend/src/app/api/billing/subscription/checkout/route.ts`
- `frontend/src/app/api/billing/subscription/route.ts`
- `frontend/src/app/api/billing/subscription/usage/route.ts`
- `frontend/src/app/api/admin/payments/reconcile/route.ts`
- `frontend/src/app/pagar/[offerId]/page.tsx`
- `frontend/src/app/admin/page.tsx`

## Definition of Done

- `external_reference` canonico en viaje y plan: `SI`
- `idempotencyKey` en viaje y plan: `SI`
- webhook firmado y con replay seguro: `SI`
- conciliacion manual con trazabilidad: `SI`
- simulacion alineada a contratos reales: `SI`

## Verificacion ejecutada

- `npm run typecheck` -> `PASS`
- `npm run lint` -> `PASS` con `0` errores bloqueantes y warnings heredados
- `npm run build` -> `PASS`
- `npm run check` -> `PASS`
- `npm run check:release` -> `PASS`

## Riesgos remanentes no bloqueantes

- sigue existiendo deuda de warnings de lint en zonas fuera del core de pagos
- la prueba automatizada end-to-end de provider real aun es una fase posterior; hoy el cierre esta validado por build, tipado, contratos y simulacion controlada

## Veredicto

`Sprint 06` queda cerrado. KargaX ya tiene una base real para cobrar viajes y planes con trazabilidad, referencias canonicas y backoffice operativo, que es exactamente la clase de infraestructura que necesitas si quieres construir una compania de escala grande y no solo una maqueta.
