# CERRADO - SPRINT 21

# 21 - Lending Pause And Copy Cleanup

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- prioridad: alta
- owner: CEO / Founder + CTO + Finance Lead

## Implementacion cerrada 2026-05-19

- `lending_enabled=false` queda en `supabase/migrations/041_pilot_feature_flags.sql` y como default server en `frontend/src/lib/server/feature-flags.ts`.
- `/api/advances` bloquea solicitudes nuevas cuando el flag esta apagado.
- `/api/wallet` no carga snapshot de adelantos cuando lending esta pausado.
- `/billetera` oculta `AdvancesSection` cuando lending esta pausado y mantiene saldo, retiros y liquidaciones.
- `/api/wallet/withdraw` no ejecuta barridos de adelantos cuando `lending_enabled=false`.
- Copy publico removido de landing, ayuda, planes y admin para no vender adelantos/lending durante piloto.
- Dominio visible de admin pasa de `Lending` a `Payouts`.
- Viaticos empresa/gastos del viaje se mantienen para flota privada sin prometer credito KargaX.
- Typecheck frontend ejecutado y limpio.

## Proposito

Pausar todo lo visible de adelantos, credito, lending y pago expres fondeado por KargaX durante pilotos. La razon es simple: sin capital, partner, cobranza, politicas y compliance, vender adelantos seria riesgo operativo y reputacional.

## Decision final

No se eliminan tablas ni migraciones de lending. Se oculta el producto y se deja protegido por feature flag.

Feature flag canonico:

- `lending_enabled=false`

## Lo que se debe ocultar

- Seccion `KargaX Adelanto` en wallet.
- Botones de solicitar adelanto.
- Paneles admin de aprobacion de adelantos, salvo acceso interno oculto si se necesita auditar historico.
- Landing/copy que prometa adelantos de combustible.
- Notificaciones de "adelanto disponible".
- Score basado en `advances_repaid`.
- Pago expres que requiera fondeo de KargaX.
- Planes o pricing que vendan lending como beneficio.

## Lo que si puede quedar

- Tablas `fuel_advances`, `fuel_advance_repayments`, `lending_settings`, `lending_treasury`.
- Runbooks de reactivacion futura.
- Metricas internas marcadas como pausadas.
- Viaticos empresa en flota privada.
- Wallet, settlements y retiros.

## Diferencia critica

| Concepto | Se permite en piloto | Motivo |
|---|---|---|
| Viatico empresa | si | lo paga la empresa para su conductor |
| Pago por viaje flota privada | si | es obligacion de la empresa |
| Wallet conductor | si | es saldo operativo de KargaX |
| Retiro Nequi/banco | si | es payout de saldo ya ganado |
| Adelanto KargaX | no | requiere capital y riesgo crediticio |
| Pago expres KargaX | no | requiere fondeo o garantia financiera |

## Cambios tecnicos

- Revisar `frontend/src/components/wallet/AdvancesSection.tsx`.
- Revisar `frontend/src/app/billetera/page.tsx`.
- Revisar `frontend/src/app/admin/page.tsx`.
- Revisar `frontend/src/lib/server/operations.ts`.
- Revisar `frontend/src/app/planes/page.tsx`.
- Revisar landing publica y copy de ayuda.
- Agregar helper `isLendingEnabled()` o usar feature flags existentes.
- Si `lending_enabled=false`, las APIs de solicitud deben responder `FEATURE_DISABLED`.

## Copy obligatorio

- Usar `gastos del viaje` o `viaticos empresa` para fondos privados.
- No usar "adelanto" en UI publica durante piloto.
- No usar "credito", "prestamo", "financiacion" o "pago garantizado por KargaX" salvo en documentos internos.

## Reactivacion futura

Para reactivar lending se requiere:

- Capital propio o partner.
- Politica de riesgo aprobada.
- Counsel regulatorio Colombia.
- Cobranza y mora.
- Score confiable.
- QA end-to-end.
- Cap por conductor, empresa y portafolio.
- Feature flag por cohort.

## QA

- Usuario camionero no ve adelantos.
- Empresa no ve adelantos.
- Admin no recibe solicitudes nuevas.
- Notificaciones no mencionan adelantos.
- Landing camionero no promete adelantos.
- Viaticos empresa siguen funcionando en flota privada.

## Definition of Done

- `rg -n -i "adelanto|advance|lending|credito|prestamo|pago expres"` revisado.
- Toda aparicion visible esta eliminada, oculta o justificada como documento interno.
- No se rompen migraciones ni imports.
- Wallet sigue mostrando saldo, liquidaciones y retiros.
- Flota privada mantiene gastos del viaje sin confundirse con credito.
