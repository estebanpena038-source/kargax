# 93 - Unicorn Scorecard

## Estado

- artifact status: `completed`
- repo integration status: `completed`
- commercial evidence status: `tracked inside this document`
- cierre: este archivo queda cerrado como scorecard oficial de gates y honestidad operativa

## Proposito

Evitar autoengano. Los gates solo se marcan con evidencia. Si una metrica no tiene fuente verificable, se reporta como `manual required` y no se usa para declararse listo.

## Snapshot de staging - 2026-04-23

| Senal | Estado actual |
|---|---|
| Repo readiness | `npm run check` y `npm run check:release` pasaron |
| Lint gate | `0 errors`, `241 warnings` |
| Public smoke | `market_context` paso; `health` fallo con `503` |
| Runtime health | bloqueado por `TypeError: fetch failed` hacia Supabase |
| Browser evidence | aun pendiente para `auth`, `trip_money`, `wallet`, `lending_pause`, `warehouse`, `wms_dispatch_trip`, `payouts`, `holding_admin`, `ceo_control_tower` |

## Gates

| Gate | Alcance | Evidencia requerida | Estado actual | Si falla |
|---|---|---|---|---|
| Gate 1 - Fundacion | sprints `01-05` | repo claro, `check`, `lint`, `check:release`, auth sensible endurecida, contratos API unificados, mapa legal/financiero | blocked | no escalar lending, no abrir nuevos mercados |
| Gate 2 - Dinero y operacion | sprints `06-10` | 1 cliente pago o comprometido, flujo pago -> viaje -> settlement, ledger explicable, wallet/retiro conciliable y lending pausado si no hay capital | partial | estrechar foco a Logistics OS + payments |
| Gate 3 - Enterprise y venta | sprints `11-13` | 3 clientes pagos o 2 enterprise reales, recorrido comercial de 15 min, onboarding repetible, una empresa multiunidad operando | blocked | reducir complejidad enterprise y simplificar motion |
| Gate 4 - Expansion y reliability | sprints `14-15` | core desacoplado de Colombia, reliability probada, decision clara expansion vs consolidacion | partial | mantener `CO` como mercado unico abierto |
| Gate 5 - Pilotos finales | sprints `16-28` | bugs P0 cerrados, lending pausado, payouts con kill switch, WMS dispatch -> trip, flota privada con 4 modos, CEO control tower y QA navegador | blocked | no lanzar pilotos externos |

## Scorecard mensual

| KPI | Formula | Fuente exacta | Evidencia | Estado actual |
|---|---|---|---|---|
| paying businesses | `count(distinct business_id)` con plan `active/trialing` y plan no `free` | `business_plan_subscriptions` | query o export admin | requiere corrida mensual |
| active businesses | `count(distinct business_id)` con actividad en ofertas ultimos 30 dias | `cargo_offers` | query o export admin | requiere corrida mensual |
| paid trips | `count(payments.id)` con `status = completed` | `payments` | query o export admin | disponible en sistema |
| settled wallet volume | `sum(transactions.amount)` con `type = trip_deposit` y `status = completed` | `transactions` | query o export admin | disponible en sistema |
| warehouse operations processed | `appointments completed + receipts closed + dispatches dispatched` | `warehouse_appointments`, `warehouse_receipts`, `warehouse_dispatch_orders` | query o export admin | disponible en sistema |
| lending visible surfaces | conteo de CTAs/rutas/copy visibles de adelantos con `lending_enabled=false` | repo + browser QA | `rg` + screenshots | debe ser 0 para piloto |
| payout success rate | `paid payouts / payout attempts` por provider | `payout_attempts` | query o export admin | requiere implementacion sprint `20` |
| dispatch-to-trip conversion | despachos vinculados a offer sobre despachos totales | `warehouse_dispatch_orders.offer_id` | query o export admin | requiere implementacion sprint `23` |
| pilot activation depth | bodegas + usuarios + conductores + viajes por cuenta piloto | billing/warehouse/fleet/offers | dashboard CEO | requiere implementacion sprint `24/27` |
| gross margin by customer | ingreso neto por cliente menos costos de provider y operacion asignados | finanzas / modelo comercial | cierre mensual validado | manual required |
| onboarding time to first value | `fecha primer valor - fecha inicio onboarding` | onboarding ops + primer evento valido | cierre semanal o mensual | manual required |

## Reglas de declaracion

- `repo evidence`: puede sostener solo partes tecnicas de Gate 1.
- `runtime evidence`: puede sostener pagos, wallet, warehouse, admin y reliability minima.
- `commercial evidence`: se requiere para clientes pagos, conversion, gross margin y tiempo a valor.
- si falta evidencia, el gate queda `partial` o `blocked`, nunca `passed`.
- lending no puede contar como moat activo durante piloto si esta pausado por falta de capital.
- payouts solo cuentan como runtime evidence cuando tienen provider, idempotencia, webhook/status y fallback.

## Regla de honestidad

Si la evidencia no aparece, no se abandona la empresa automaticamente. Se estrecha el foco hasta encontrar repeticion y caja.
