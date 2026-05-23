# 28 - Pilot QA And Dev Master Plan

## Estado

- artifact status: `planned`
- owner: CTO / Founding Engineer + Head of Ops
- proposito: ordenar ejecucion y cierre de la fase final

## Orden de ejecucion recomendado

1. `18_PILOT_BLOCKER_BUGS.md`
2. `19_PRODUCTION_AUTH_URLS_AND_STORAGE.md`
3. `21_LENDING_PAUSE_AND_COPY_CLEANUP.md`
4. `20_WALLET_SETTLEMENTS_AND_AUTOMATIC_PAYOUTS.md`
5. `22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`
6. `23_WMS_DISPATCH_TO_TRIP_AUTOMATION.md`
7. `24_CEO_KARGAX_CONTROL_TOWER.md`
8. `26_STARTUP_INFRA_HARDENING.md`
9. `27_PRICING_LIMITS_PAYWALLS.md`
10. `25_RETENTION_REPUTATION_NOTIFICATIONS.md`

La retencion va despues de estabilidad. Primero que funcione, luego que enamore.

## Dependencias criticas

- No activar payouts automaticos sin sandbox y kill switch.
- No activar score con comision dinamica sin settlement correcto.
- No mostrar reportes contables si ledger no cuadra.
- No crear viaje desde despacho sin preservar stock y manifiesto.
- No lanzar pilotos si emails todavia pueden abrir localhost.
- No vender lending si `lending_enabled=false`.

## Mapa de cobertura de fuentes

### `ideas-finales.md`

| Punto fuente | Decision / sprint destino |
|---|---|
| Funciones para que no dejen de usar KargaX | `17`, `22`, `23`, `24`, `25`, `27` |
| Roles empresa, contador/finanzas, camioneros y flota privada | `22` |
| Limites generosos para atraer usuarios | `27` |
| Produccion lista | `19`, `26`, `28` |
| Ciberseguridad | `26`, controles en `90-93` |
| Quitar adelantos porque no hay capital | `21` |
| Clerk, Cloudflare, Sentry, Upstash, rate limiting | `26` |
| WMS despacho crea oferta/viaje | `23` |
| Flota privada pregunta si hay pago por viaje | `22`, `23` |
| Vista CEO | `24` |
| Bugs localhost auth/invitaciones | `18`, `19` |
| Quitar campos globales de peso/medidas/cantidad | `18` |
| Error `Bucket not found` | `18`, `19` |
| Rechazados en cargue/descargue | `18`, `23` |

### `TRABAJOIA.md`

| Bloque fuente | Decision / sprint destino |
|---|---|
| Bug #1 comisiones B2B | `18`, `20` |
| Bug #2 sesion post-pago | `18` |
| Bug #3 localhost emails | `18`, `19` |
| Bug #4 upload imagenes | `18`, `19` |
| Bug #5 manifiesto reseteado | `18` |
| Bug #6 loop OTP/dashboard | `18` |
| Bugs #7-12 UI/UX | `18` |
| Score/reputacion | `25` |
| Niveles/comision dinamica | `25` despues de settlement |
| Pago expres | pausado por `21`, solo futuro con fondos ya pagados |
| Notificaciones inteligentes | `25` |
| Referidos | `25`, no bloquea piloto |
| Dashboard inteligencia empresarial | dividido: CEO KargaX en `24`, empresa cliente futuro |
| Exportar PDF | `25` |
| Landing camioneros | `25` despues de bugs/pagos/retiros |
| Emails inactivos | `25` |
| Optimizacion mobile/responsive | QA en `28`, UI por sprint |

## QA master de navegador

### Auth

- Registro camionero.
- Registro empresa.
- Login normal.
- Logout.
- Reset password.
- Invitacion equipo.
- Invitacion holding.
- Invitacion flota privada.
- MFA si esta activo.

### Marketplace

- Empresa publica oferta con foto.
- Camionero postula.
- Empresa acepta.
- Pago.
- Webhook.
- Cargue.
- Entrega.
- Settlement.
- Wallet.
- Retiro.

### Flota privada

- Empresa invita conductor.
- Conductor acepta.
- Crear ruta privada con cada `compensation_mode`.
- Confirmar viaje.
- Liberar gastos si aplica.
- Completar POD.
- Revisar ledger.

### WMS

- Crear bodega.
- Crear SKU/stock.
- Recepcion.
- Despacho solo.
- Despacho a flota privada.
- Despacho a marketplace.
- Rechazos.
- Inventario final.

### CEO/admin

- Ver control tower.
- Ver incidentes.
- Ver payouts.
- Reconciliar pago.
- Ver readiness.
- Ver pilotos.

### Produccion

- `/api/health`.
- Sentry.
- Rate limit.
- CORS.
- Storage.
- Payment webhook.
- Payout provider sandbox.

## Evidencia obligatoria

Cada flujo cerrado debe tener:

- actor
- ambiente
- timestamp
- screenshot o video
- requestId si aplica
- ids de tablas principales
- before/after financiero si toca dinero
- resultado: `passed`, `failed`, `blocked`

## Definition of Done global

- Build pasa.
- Typecheck pasa.
- Release check pasa.
- Smoke browser pasa.
- No hay bugs P0/P1 abiertos.
- No hay localhost en emails productivos.
- No hay storage bucket faltante.
- Wallet y settlement cuadran.
- Payouts tienen fallback.
- Lending no aparece visible.
- WMS crea viaje solo con confirmacion.
- CEO puede operar pilotos desde admin.
- Riesgos rojos tienen owner y fecha.

## Checklist diario del dev

- Leer sprint activo.
- Confirmar dependencias.
- Hacer cambios pequenos y verificables.
- Probar local.
- Probar staging si toca auth/pagos/payouts.
- Actualizar evidencia.
- No cerrar sprint sin QA.

## Cierre de fase

La fase `17-28` se cierra solo cuando KargaX puede correr un piloto real con:

- empresa creando operacion diaria
- camionero cobrando
- bodega despachando
- admin viendo salud
- soporte resolviendo fallos
- CEO viendo dinero y uso
