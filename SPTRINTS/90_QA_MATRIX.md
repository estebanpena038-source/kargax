# 90 - QA Matrix

## Estado

- artifact status: `completed`
- repo integration status: `completed`
- live evidence status: `tracked inside this document`
- cierre: este archivo queda cerrado como matriz ejecutable oficial del release

## Proposito

Convertir QA pre-launch en un artefacto ejecutable. Ningun journey se considera cerrado sin actor, timestamp, evidencia y estado final verificable.

## Roles canonicos

- anonimo
- trucker
- business owner
- ops_manager
- dispatcher
- warehouse_manager
- warehouse_operator
- finance_accountant
- auditor
- viewer
- admin plataforma
- holding owner
- finance admin
- ops admin
- analyst
- private_fleet_driver

## Regla de evidencia

Cada prueba debe registrar:

- actor y timestamp
- precondiciones
- pasos ejecutados
- payload esperado o campos clave de respuesta
- estado esperado en panel admin o BD
- screenshot o video corto
- resultado final: `passed`, `blocked`, `failed`

## Smoke suite minima de launch

| Journey | Roles minimos | Estado esperado | Evidencia minima |
|---|---|---|---|
| Auth + MFA | anonimo, trucker, business owner, admin plataforma | login y AAL2 funcionando sin bloqueo falso | screenshot, requestId si aplica, estado de sesion |
| Offer -> pay -> webhook -> trip | business owner, trucker | pago completado, webhook procesado, viaje trazable | payload pago, requestId, admin/payment trace |
| Wallet -> withdrawal | trucker, finance admin, admin plataforma | ledger consistente, hold y reversal visibles | transaccion, before/after, decision admin |
| Lending paused | trucker, finance admin, ops admin | adelantos no visibles en piloto y APIs protegidas por feature flag | evidencia de UI sin lending, flag `lending_enabled=false` |
| Warehouse ops | business owner, operator, auditor | appointment, receipt/dispatch y incidente con lifecycle valido | cita, evidencia operativa, estado final |
| Holding/admin reconcile | holding owner, finance admin, analyst, admin plataforma | approvals y reconcile trazables con requestId | cola corporativa, admin overview, evidencia final |
| WMS dispatch -> trip | business owner, ops manager, warehouse_operator, private_fleet_driver | despacho puede quedar solo WMS o crear viaje/oferta con confirmacion | stock before/after, `offer_id`, manifiesto, PIN |
| Automatic payouts | trucker, finance admin, admin plataforma | retiro pasa por provider o fallback manual sin doble pago | payout attempt, idempotency key, webhook/status |
| CEO control tower | admin plataforma | tablero global responde usuarios, viajes, dinero, planes, riesgos y salud | screenshot + queries de contraste |
| Roles empresariales | business owner, ops_manager, dispatcher, warehouse_manager, warehouse_operator, finance_accountant, auditor, viewer | sidebar, APIs, bodega e inteligencia respetan permisos por rol | screenshot por rol + respuesta `/api/warehouses/access` |

## Matriz ejecutable

| Flujo | Actor principal | Precondiciones | Pasos minimos | Payload o respuesta esperada | Estado esperado en admin o BD | Evidencia | Resultado |
|---|---|---|---|---|---|---|---|
| Registro | anonimo | correo y telefono disponibles | abrir `/registro`, completar alta, verificar email | alta valida o error controlado | `user_profiles` creada y rol correcto | screenshot + timestamp | pendiente |
| Login | trucker | usuario existente | abrir `/login`, autenticar, redirigir | sesion valida con requestId cuando aplique | dashboard correcto por rol | screenshot | pendiente |
| MFA | trucker | sesion valida y MFA habilitable | setup en `/auth/mfa/setup`, verify en `/auth/mfa/verify` | AAL2 obtenida | ruta protegida acepta acceso | screenshot + estado final | pendiente |
| Publicar oferta | business owner | negocio con acceso activo | crear oferta desde `/ofertas/publicar` | oferta creada | `cargo_offers` visible y trazable | screenshot + payload | pendiente |
| Postular / aceptar | trucker, business owner | oferta activa | postular, aceptar oferta | application aceptada | offer/application sincronizadas | screenshot + admin trace | pendiente |
| Pagar viaje | business owner | oferta aceptada | iniciar checkout en `/pagar/[offerId]` | preference o intento de pago valido | `payments` en estado esperado | payload + screenshot | pendiente |
| Webhook | admin plataforma | pago productivo o sandbox controlado | recibir callback y procesar side effects | response con `requestId` | payment conciliated, incidentes 0 o trazados | payload webhook + admin | pendiente |
| Crear cita | operator | offer con warehouse link | crear cita desde warehouse | cita creada | `warehouse_appointments` en `scheduled` | screenshot + BD/admin | pendiente |
| Pickup / validar PIN | trucker, operator | cita activa y PIN emitido | arrival, carga, validacion PIN | RPC o API exitosa | offer y appointment avanzan de estado | foto/video + requestId | pendiente |
| Entrega | trucker | viaje en progreso | registrar llegada, evidencia y PIN entrega | settlement trigger correcto | `trip_deposit` y offer completada | screenshot + ledger | pendiente |
| Wallet | trucker | wallet existente | abrir `/billetera`, revisar timeline | before/after y source visibles | wallet timeline consistente | screenshot | pendiente |
| Retiro | trucker, finance admin | saldo disponible | solicitar retiro y decidirlo en admin | request y resolution validos | withdrawal / reversal visibles en ledger | screenshot + payload | pendiente |
| Lending pausado | trucker, finance admin, ops admin | `lending_enabled=false` | abrir wallet, admin, planes, landing y notificaciones | no hay solicitud de adelanto visible | APIs nuevas devuelven `FEATURE_DISABLED` o rutas ocultas | screenshot + flag | pendiente |
| Upgrade de plan | business owner, holding owner | negocio y plan disponibles | iniciar upgrade | intento o approval valida | billing / approvals visibles | screenshot + payload | pendiente |
| Crear bodega | business owner | negocio con permisos | crear warehouse y dock | warehouse creada | `warehouses` y acceso correctos | screenshot | pendiente |
| Invitar equipo | business owner, holding owner | negocio o holding activo y migracion `046` aplicada | invitar miembro con rol granular y aceptar | invitacion registrada | membership con rol correcto | screenshot + admin | pendiente |
| Flujo corporativo / aprobacion | holding owner, finance admin, analyst | holding activo | crear approval y resolverla | SLA y assigned team visibles | approval status y requestId trazables | screenshot + requestId | pendiente |
| Admin reconcile | admin plataforma | pago o incidente elegible | ejecutar `/api/admin/payments/reconcile` | response valida | admin incident o payment actualizado | payload + screenshot | pendiente |
| Despacho solo WMS | warehouse_operator | stock disponible | crear despacho con `dispatch_only` | dispatch creado sin offer | stock descontado una vez | screenshot + stock before/after | pendiente |
| Despacho a flota privada | ops manager | conductor privado activo | crear despacho y elegir `private_fleet_trip` | offer assigned y dispatch vinculado | `warehouse_dispatch_orders.offer_id` y manifest correctos | screenshot + IDs | pendiente |
| Despacho marketplace | ops manager | stock y datos ruta | crear despacho y elegir `marketplace_offer` | offer draft/active segun confirmacion | stock, offer y manifest coherentes | screenshot + IDs | pendiente |
| Retiro automatico Nequi | trucker | payout sandbox habilitado | registrar Nequi y retirar | payout processing/paid | payout attempt con provider `nequi` | screenshot + provider ref | pendiente |
| Retiro automatico banco | trucker | Wompi sandbox habilitado | registrar cuenta y retirar | payout processing/paid | payout attempt con provider `wompi` | screenshot + provider ref | pendiente |
| CEO control tower | admin plataforma | datos semilla o staging | abrir vista CEO | metricas visibles sin crash | queries manuales cuadran | screenshot + timestamp | pendiente |

## Cobertura minima por dominio

| Dominio | Roles cubiertos |
|---|---|
| Auth base | anonimo, trucker, business owner |
| MFA | trucker, business owner, admin plataforma |
| Marketplace | trucker, business owner, ops_manager, dispatcher |
| Trip execution | trucker, dispatcher, ops_manager |
| Warehouse | business owner, warehouse_manager, warehouse_operator, auditor |
| Wallet | trucker, finance admin, admin plataforma |
| Lending pause | trucker, finance admin, ops admin |
| Billing | business owner, holding owner |
| Holding | holding owner, finance admin, analyst |
| Admin | admin plataforma |
| Private fleet | business owner, ops manager, finance_accountant, private_fleet_driver |
| Payouts | trucker, finance admin, admin plataforma |
| CEO control tower | admin plataforma |
| Business roles | owner, ops_manager, dispatcher, warehouse_manager, warehouse_operator, finance_accountant, auditor, viewer |

## Ejecucion automatizada - 2026-04-23

| Check | Command | Resultado | Evidencia |
|---|---|---|---|
| Build y typecheck | `npm run check` | passed | build local completado el `2026-04-23`; Next genero rutas app y API sin error |
| Lint | `npm run lint` | warning | `0 errors`, `241 warnings`; `lint-report.json` actualizado |
| Release audit | `npm run check:release` | passed | auditoria de release verde el `2026-04-23` |
| Smoke publico | `npm run smoke:release -- --base-url https://kargax-staging.vercel.app` | blocked | `market_context` paso, `health` fallo con `HTTP 503`, admin smoke omitido por falta de `ADMIN_BEARER_TOKEN` |
| Health runtime | `curl.exe -i https://kargax-staging.vercel.app/api/health` | blocked | `requestId = 52878ab0-e510-497b-9304-fdd028428ef0`, `code = UNHEALTHY`, error `TypeError: fetch failed` |

## Paquete pendiente exclusivo de navegador

| Journey | Superficies a recorrer | Evidencia minima que debes capturar | Estado esperado |
|---|---|---|---|
| Auth + MFA | `/registro`, `/login`, `/auth/mfa/setup`, `/auth/mfa/verify` | screenshot de alta/login, screenshot MFA, requestId si aparece, estado final de sesion | acceso con AAL2 sin bloqueo falso |
| Offer -> pay -> webhook -> trip | `/ofertas/publicar`, aceptacion de oferta, `/pagar/[offerId]`, `/viaje/[offerId]`, `/viaje/[offerId]/carga`, `/viaje/[offerId]/entrega` | payload o screenshot de pago, requestId, evidencia de webhook o admin trace, estado final del viaje | pago completado, webhook procesado, viaje trazable |
| Wallet -> withdrawal | `/billetera`, `/admin` | before/after, transaccion, decision admin, reversal si aplica | ledger consistente y retiro visible |
| Lending pause | wallet trucker, `/admin`, `/planes`, landing/copy | no hay CTA visible de adelanto, flag apagada, APIs protegidas | piloto sin prometer credito |
| Warehouse ops | `/bodegas`, `/bodegas/[id]/citas`, `/recepciones`, `/despachos`, `/incidentes` | cita, evidencia operativa, estado final de incidente o cierre | lifecycle valido en warehouse |
| Holding/admin reconcile | `/corporativo`, `/admin` | approval queue, requestId, reconcile, screenshot final | approval y reconcile trazables |
| WMS dispatch -> trip | `/bodegas/[id]/despachos`, `/ofertas`, `/viaje/[offerId]` | stock before/after, offer vinculada, manifiesto, PIN | despacho convertido sin duplicidad |
| Automatic payouts | `/billetera`, `/admin`, provider sandbox | metodo retiro, payout attempt, webhook/status, fallback | saldo y provider conciliables |
| CEO control tower | `/admin` o `/admin/ceo` | usuarios, viajes, GMV, ingresos, planes, salud, incidentes | admin global operable |

## Cierre

No cerrar launch QA con `defined only`. Cada fila debe terminar con evidencia adjunta y resultado final.
