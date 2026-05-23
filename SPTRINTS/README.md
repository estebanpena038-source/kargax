# KargaX SPTRINTS

## Como leer esta carpeta

- Esto NO son 94 sprints.
- Los sprints reales son `32`: `01` a `32`.
- El archivo `00` define la tesis maestra y el orden completo.
- Los archivos `90-95` son documentos de control y evidencia, no sprints.
- `ideas-finales.md` queda como insumo bruto de fundador; la fase `17-28` lo convierte en ejecucion.

## Conteo real

- `00` = tesis y roadmap maestro
- `01-16` = sprints de fundacion, operacion, enterprise, expansion y flota privada
- `17-28` = fase final de pilotos, hardening, payouts, WMS conectado y control tower CEO
- `29-32` = cierre TRABAJOIA, tracking PWA, home comercial, roles empresariales y dashboard inteligente
- `90-95` = QA, launch, riesgos, scorecard, capital/partners y seguridad

## Estado auditado al iniciar

- `frontend` compila con `next build`
- `eslint` falla con `144` errores y `153` warnings
- no hay tests detectados en `frontend/src`
- auth sensible sigue dependiendo de `localStorage`
- el repo raiz `C:\kargax2` no tiene `HEAD` y `frontend` es un repo anidado
- `cargoconnect` aparece como legado y no debe seguir siendo la app principal
- pagos, wallet, advances, holding y warehouse ya existen como base de producto
- decision de fase final: advances/lending se pausan visualmente para pilotos hasta tener capital, partner y compliance

## Vision operativa

KargaX no debe intentar ganar por ser solo una bolsa de cargas. La tesis fuerte es:

`Logistics OS + Payments + Wallet/Payouts + Enterprise Control Tower`

Eso significa:

- la capa logistica genera datos operativos reales
- la capa de pagos convierte operacion en money flow verificable
- la capa de wallet, settlements y payouts convierte eventos en ledger y dinero real al camionero
- la capa de lending queda como opcion futura, no como promesa de piloto
- la capa holding vuelve el producto enterprise y defensible
- la capa WMS conecta inventario, despacho, viaje, PIN/POD y reporte contable

## Orden de ejecucion

### Fase 1. Fundacion

- `00_UNICORN_THESIS.md`
- `01_REPO_CONSOLIDATION.md`
- `02_RELEASE_GATE.md`
- `03_REGULATORY_FINANCE_SHAPE.md`
- `04_IDENTITY_SECURITY.md`
- `05_API_CONTRACTS.md`

### Fase 2. Dinero y operacion

- `06_PAYMENTS_BILLING.md`
- `07_MARKETPLACE_TRIP_EXECUTION.md`
- `08_WAREHOUSE_OS.md`
- `09_WALLET_SETTLEMENTS.md`
- `10_LENDING_RISK_TREASURY.md`

### Fase 3. Enterprise y venta

- `11_HOLDING_ENTERPRISE.md`
- `12_ADMIN_SUPPORT_OBSERVABILITY.md`
- `13_GTM_ONBOARDING.md`

### Fase 4. Expansion

- `14_ANDEAN_REGIONALIZATION.md`
- `15_SCALE_RELIABILITY.md`

### Fase 5. Pilotos finales y operacion real

- `16_PRIVATE_FLEET_B2B.md`
- `17_FINAL_PRODUCT_STRATEGY.md`
- `18_PILOT_BLOCKER_BUGS.md`
- `19_PRODUCTION_AUTH_URLS_AND_STORAGE.md`
- `20_WALLET_SETTLEMENTS_AND_AUTOMATIC_PAYOUTS.md`
- `21_LENDING_PAUSE_AND_COPY_CLEANUP.md`
- `22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`
- `23_WMS_DISPATCH_TO_TRIP_AUTOMATION.md`
- `24_CEO_KARGAX_CONTROL_TOWER.md`
- `25_RETENTION_REPUTATION_NOTIFICATIONS.md`
- `26_STARTUP_INFRA_HARDENING.md`
- `27_PRICING_LIMITS_PAYWALLS.md`
- `28_PILOT_QA_AND_DEV_MASTER_PLAN.md`

### Fase 6. Cierre TRABAJOIA y venta inteligente

- `29_TRABAJOIA_GAP_CLOSURE.md`
- `30_LIVE_TRIP_TRACKING_PWA.md`
- `31_COMMERCIAL_HOME_PRIVATE_FLEET.md`
- `32_BUSINESS_ROLES_AND_INTELLIGENCE_DASHBOARD.md`

## Como usar estos documentos

- cada sprint asume una duracion de `2 semanas`
- ningun sprint se cierra sin evidencia de QA
- ningun sprint financiero se cierra sin trazabilidad de estados antes/despues
- ningun sprint comercial se cierra si el producto real no soporta lo que se promete
- el scorecard `93` decide si KargaX sigue en ruta de empresa gigante o si debe estrechar foco
- durante la fase `17-32`, ningun documento puede reactivar lending visible sin actualizar `21`, `92`, `93` y `94`

## Definicion de exito del programa

- 1 producto vendible y operable de punta a punta
- 1 base segura de pagos, wallet, settlements y payouts
- 1 consola enterprise para holdings y 3PL
- 1 control tower CEO para operar pilotos con salud, dinero, soporte y riesgos
- 1 historia creible para expandir a Colombia y Andina
- 1 compania con capacidad de generar caja antes de perseguir escala masiva
