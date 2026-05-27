# 01 - Mapa de algoritmos inteligentes para KargaX

## Principio de diseño

KargaX debe implementar inteligencia como una capa trazable sobre datos operativos reales, no como una “IA caja negra” que toca dinero, estados o permisos sin auditoría.

La recomendación CTO es empezar por algoritmos determinísticos y explicables:

1. calculan features desde tablas existentes;
2. producen snapshots con `business_id`, `module`, `source_type`, `source_id`, `score`, `level`, `reasons`, `recommended_action`;
3. nunca modifican wallet, billing, plan, payout ni estado crítico sin una acción humana o una API transaccional existente;
4. respetan roles, RLS y separación marketplace/flota privada.

## Datos base confirmados

- Last Mile y marketplace: `cargo_offers`, coordenadas, ventanas, contactos, manifest, `is_private_fleet`, `private_fleet_trucker_id`, `assigned_trucker_id`, `status`.
- Tracking: `trip_tracking_sessions`, `trip_location_pings`, helper `frontend/src/lib/server/trip-tracking.ts`.
- Evidencia: `trip_signature_evidences`, `offer_photos`, `picking_events`, `WarehouseDigitalEvidenceRecord`.
- Bodegas: `warehouses`, `warehouse_docks`, `warehouse_appointments`, stock, recibos, despachos, tareas e incidentes.
- Flota privada: `business_fleet_members`, `business_fleet_invitations`, `trip_financial_allocations`, payroll privado y compensation modes.
- Billing: `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, `PlanLimitError`, `recordPlanLimitEvent`.
- Wallet: `transactions`, `payout_methods`, `payout_attempts`, `trip_financial_allocations`. RIESGO ALTO.
- Reportes: `report_exports`, `/api/reports/business-monthly`, `/dashboard/inteligencia`, `/api/admin/overview`, `trucker_scores`.

## Mapa por módulo

- **Last Mile:** 16 algoritmos. Datos reales: Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.
- **Marketplace:** 10 algoritmos. Datos reales: Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.
- **Flota privada:** 8 algoritmos. Datos reales: Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.
- **Bodegas:** 6 algoritmos. Datos reales: Existe WMS con `warehouses`, `warehouse_docks`, `warehouse_appointments`, stock, recibos, despachos, líneas con requested/picked/dispatched/rejected, tareas e incidentes. Sprint 23 conectó despacho con viaje por `dispatch_trip_mode`.
- **Evidencia digital:** 6 algoritmos. Datos reales: Existe `trip_signature_evidences`, `offer_photos`, `picking_events`, `WarehouseDigitalEvidenceRecord`, manifest summary, signature requirements, fotos por stage, timeline, tracking y rejection.
- **Wallet/liquidaciones:** 7 algoritmos. Datos reales: Existe wallet/ledger operativo documentado; Sprint 20 implementó `payout_methods` y `payout_attempts`; Sprint 22 separa flota privada; `trip_financial_allocations` existe. Las reglas prohíben mezclar marketplace con privado.
- **Billing:** 6 algoritmos. Datos reales: Existe `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, paywall events, plan snapshot y recomendaciones de plan por uso.
- **Reportes:** 7 algoritmos. Datos reales: Existe `/api/reports/business-monthly`, `report_exports`, `/dashboard/inteligencia`, CEO Control Tower en `/api/admin/overview`, holding summaries y `trucker_scores`.

---

## Priorización inteligente de entregas

### Módulo
Last Mile

### Problema que resuelve
El operador ve muchas rutas y no sabe cuál atender primero.

### Impacto en revenue/retención
Reduce entregas fallidas y mejora demos B2B porque convierte el dashboard en una torre de control accionable.

### Datos necesarios
Estado, ventana de entrega, distancia al destino, último ping, precisión GPS, evidencia faltante, novedades, cliente, conductor y prioridad comercial.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Score 0-100 por entrega activa: SLA cercano, sin ping reciente, evidencia faltante, novedad abierta, ruta privada/marketplace, cliente crítico y valor operativo. Mostrar top 10 al dispatcher/ops_manager.

### Pseudocódigo
```txt
para cada cargo_offer activo: score = w_sla + w_tracking + w_evidencia + w_incidente + w_cliente; ordenar desc; guardar snapshot por business_id y offer_id.
```

### Riesgos
No debe mostrar entregas de otra empresa; no usar monto si el rol no puede ver finanzas.

### Pruebas QA
Crear 5 viajes con ventanas distintas; simular ping viejo y novedad; validar orden, permisos por rol y ausencia de montos para dispatcher.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Score de riesgo de entrega fallida

### Módulo
Last Mile

### Problema que resuelve
Una entrega puede fallar por retraso, dirección mala, falta de contacto, conductor sin confirmación o evidencia incompleta.

### Impacto en revenue/retención
Evita reclamos y da al cliente una razón clara para operar KargaX diariamente.

### Datos necesarios
Coordenadas válidas, ventanas, contacto origen/destino, tracking, histórico del conductor, rechazos, incidentes, estado de aceptación y manifest.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Calcular riesgo determinístico por factores: sin coordenadas, ventana estrecha, último ping lejos/demorado, conductor con score bajo, destinatario con rechazos, evidencia obligatoria pendiente.

### Pseudocódigo
```txt
risk=0; si no coords +20; si eta>delivery_end +30; si no contacto +10; si score_driver<60 +15; si missing_evidence +15; nivel según rango.
```

### Riesgos
No bloquear automáticamente entregas; solo recomendar acción. Evitar sesgo injusto contra conductor nuevo.

### Pruebas QA
Viaje sin coordenadas debe ser high; viaje con tracking fresco y evidencia completa debe low; conductor nuevo no debe quedar critical solo por falta de historial.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Optimización de rutas

### Módulo
Last Mile

### Problema que resuelve
El orden manual de entregas puede aumentar kilómetros, retrasos y costos.

### Impacto en revenue/retención
Mejora eficiencia operativa y se vende fácil en Scale/Enterprise, pero requiere datos buenos.

### Datos necesarios
Coordenadas origen/destino, ventanas, capacidad vehículo, prioridad, tiempos de servicio, tráfico externo si se integra proveedor.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Fase 1: heurística nearest-neighbor con ventanas por zona y capacidad. Fase 2: OR-Tools/VRP en servicio backend. Nunca reordena sin confirmación humana.

### Pseudocódigo
```txt
agrupar por ciudad/zona; ordenar por ventana y distancia estimada; probar swaps que reduzcan distancia sin violar ventana; devolver propuesta y delta km/tiempo.
```

### Riesgos
Geocoding impreciso; prometer optimización sin tráfico real; reasignar rutas privadas sin permiso.

### Pruebas QA
Con 8 entregas de prueba, validar que no viola ventanas; comparar distancia base vs propuesta; exigir confirmación antes de aplicar.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
alta

---
## Predicción de ETA

### Módulo
Last Mile

### Problema que resuelve
Operaciones no sabe si el conductor llegará a tiempo hasta que ya es tarde.

### Impacto en revenue/retención
Reduce ansiedad operacional y permite avisar temprano a cliente/destinatario.

### Datos necesarios
Último ping, velocidad, distancia al destino, precisión, ventana de entrega, histórico por ruta/zona/hora.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Fase 1: ETA heurístico por distancia haversine y velocidad saneada. Fase 2: modelo por histórico de rutas y tiempos reales. Mostrar confianza baja si tracking es viejo o impreciso.

### Pseudocódigo
```txt
si last_ping_age>15min => eta_confidence=low; distancia=geo(last,dest); speed=max(mediana_pings, velocidad_min); eta=now+dist/speed.
```

### Riesgos
No prometer exactitud; PWA foreground puede tener gaps; tráfico real no está garantizado.

### Pruebas QA
Simular pings cada 30s; cortar internet; validar ETA con confidence low y alerta si supera ventana.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Agrupación de pedidos por zona

### Módulo
Last Mile

### Problema que resuelve
Despachos similares se crean separados y el operador no ve oportunidades de consolidación.

### Impacto en revenue/retención
Baja costo operativo y aumenta uso diario de bodegas/despachos.

### Datos necesarios
Ciudad/departamento, coordenadas, bodega origen, ventana, cliente, tipo/capacidad, manifest.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Cluster simple por ciudad+radio geográfico+ventana compatible. Recomendar consolidar antes de crear viaje, especialmente desde `warehouse_dispatch_orders`.

### Pseudocódigo
```txt
clusters=[]; para cada dispatch ready: buscar cluster mismo origen y destino cercano <X km, ventana solapada, capacidad disponible; recomendar.
```

### Riesgos
No mezclar clientes si 3PL no tiene permiso; no mezclar carga incompatible.

### Pruebas QA
Crear despachos en misma zona; validar recomendación; crear cargas incompatibles y confirmar que no agrupa.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Detección de rutas ineficientes

### Módulo
Last Mile

### Problema que resuelve
Una ruta puede desviarse, detenerse demasiado o recorrer más de lo esperado sin que operaciones lo note.

### Impacto en revenue/retención
Reduce sobrecostos y soporta conversaciones con conductor/cliente sin perseguir manualmente.

### Datos necesarios
Pings GPS, origen/destino, timestamps, estado, incidentes, distancia directa y ruta estimada.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Comparar distancia recorrida aproximada por pings vs distancia origen-destino. Alertar si ratio excede umbral y no hay novedad registrada.

### Pseudocódigo
```txt
distance_ping=sum(geo(ping[i], ping[i+1])); direct=geo(origin,dest); if distance_ping/direct>1.6 and no incident => inefficient.
```

### Riesgos
GPS ruidoso puede inflar distancia; filtrar precisión mala; no sancionar automáticamente.

### Pruebas QA
Pings con accuracy >100m se ignoran; ruta con incidente no se marca crítica; ruta con desvío real sí alerta.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Reasignación inteligente de conductor

### Módulo
Last Mile

### Problema que resuelve
Si un conductor rechaza, no confirma o se retrasa antes de pickup, operaciones pierde tiempo buscando reemplazo.

### Impacto en revenue/retención
Mejora cumplimiento SLA y convierte KargaX en herramienta activa de despacho.

### Datos necesarios
Conductores activos por empresa/zona, business_fleet_members, disponibilidad inferida por viajes activos, score, vehículo/placa, ubicación reciente.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Generar candidatos ordenados, nunca reasignar automáticamente. Privado solo dentro de la empresa; marketplace requiere flujo de oferta/postulación.

### Pseudocódigo
```txt
candidatos = conductores activos sin viaje activo compatible; score = cercanía + confiabilidad + vehículo + historial zona; devolver top 3.
```

### Riesgos
RLS; privacidad de ubicación; no asignar montos a rol sin permiso; no reasignar marketplace como privado.

### Pruebas QA
Conductor activo con viaje actual no debe aparecer; conductor de otra empresa no debe aparecer; owner/ops sí ve top candidatos.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
alta

---
## Control de cumplimiento de SLA

### Módulo
Last Mile

### Problema que resuelve
Las ventanas de pickup/delivery existen, pero el sistema debe detectar incumplimiento y alertar antes/después.

### Impacto en revenue/retención
Aumenta retención porque gerencia ve control real y no solo estados manuales.

### Datos necesarios
pickup_date/time, delivery_date/time, timestamps reales, tracking, evidence timestamps, incidents.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Crear evaluación por etapa: pickup pendiente, salida, tránsito, llegada, POD. Guardar snapshot con estado `within_sla`, `due_soon`, `breached`.

### Pseudocódigo
```txt
deadline = delivery_date+delivery_time_end; if now > deadline and no delivery_verified_at => breached; if ETA > deadline => due_soon.
```

### Riesgos
Zonas horarias; ventanas mal cargadas; no bloquear liquidación sin revisar excepciones.

### Pruebas QA
Viaje vencido sin POD debe breached; viaje con ETA posterior a deadline debe due_soon; completed con evidencia debe resolved.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
baja

---
## Detección de novedades críticas

### Módulo
Last Mile

### Problema que resuelve
Novedades como daño, faltante, seguridad o pago pueden perderse dentro del timeline.

### Impacto en revenue/retención
Reduce reclamos y protege cuentas enterprise.

### Datos necesarios
warehouse_incidents, picking_events, rejection reason, event_type, severity, payment_hold, photos, notes.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Clasificar novedad por severidad y contexto: palabras clave + tipo de incidente + impacto en entrega/evidencia/dinero. Escalar a ops/owner/auditor según rol.

### Pseudocódigo
```txt
if incident_type in [security,payment_hold] or severity critical => critical; if notes contains daño/faltante/rechazo => high.
```

### Riesgos
No generar spam; no exponer evidencias a viewer; tener dedupe por event_id.

### Pruebas QA
Crear incidentes low/high/critical; validar dedupe, notificación y visibilidad por rol.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
baja

---
## Recomendación de próxima mejor acción para operador

### Módulo
Last Mile

### Problema que resuelve
El operador ve estados pero no siempre sabe qué hacer después.

### Impacto en revenue/retención
Acelera operación y demo: “KargaX te dice qué resolver ahora”.

### Datos necesarios
Estado, timestamps, evidencia faltante, tracking, SLA, rol, permisos, modo privado/marketplace.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Motor de reglas priorizado que devuelve una acción: llamar conductor, pedir foto, validar PIN, reasignar, cerrar POD, revisar novedad, activar reporte.

### Pseudocódigo
```txt
if no driver => asignar; elif no ping>15m => contactar; elif missing_signature => solicitar firma; elif breached => escalar; else monitorear.
```

### Riesgos
Debe respetar permisos; no sugerir acciones financieras a dispatcher.

### Pruebas QA
Para cada estado del viaje, validar que la acción sea única, útil y permitida por rol.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Validación inteligente de evidencia POD

### Módulo
Last Mile

### Problema que resuelve
Un viaje puede quedar completed aunque el POD no tenga firma/foto/manifest/tracking coherente.

### Impacto en revenue/retención
Reduce reclamos y habilita liquidación/reportes confiables.

### Datos necesarios
delivery_verified_at, trip_signature_evidences delivery_pod, photos stage delivery, manifest delivered/rejected, tracking near destination.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Validar checklist mínimo configurable por empresa/plan: firma, receptor, documento, foto, tracking destino, cantidades entregadas/rechazadas.

### Pseudocódigo
```txt
quality=100; restar por firma faltante, foto faltante, tracking lejos, manifest mismatch; estado ready/needs_review/blocked.
```

### Riesgos
No bloquear wallet marketplace sin flujo de revisión; firmas públicas actuales requieren privacidad.

### Pruebas QA
Viaje con firma y foto debe ready; sin firma needs_review; tracking lejos y sin novedad debe blocked para revisión.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Detección de anomalías en PIN/foto/firma

### Módulo
Last Mile

### Problema que resuelve
PIN, foto o firma pueden ser inconsistentes, repetidos o capturados fuera del punto esperado.

### Impacto en revenue/retención
Eleva confianza de evidencia y reduce fraude operativo.

### Datos necesarios
Eventos PIN, timestamps, firma, fotos, storage path, GPS, IP/user agent si existe.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Primero reglas: PIN en secuencia, tiempo razonable, GPS cerca, firma única, foto no reutilizada por storage hash. Luego perceptual hash si se implementa.

### Pseudocódigo
```txt
if delivery_pin before pickup_pin => anomaly; if same_photo_hash used in >1 offer => anomaly; if signature missing signer => anomaly.
```

### Riesgos
PIN attempts no quedó confirmado como tabla; se debe crear si no existe. Evitar acusaciones: marcar “revisión”.

### Pruebas QA
Probar foto reutilizada; firma sin signer; PIN fuera de orden; validar que solo genera alerta.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Alertas tempranas de retrasos

### Módulo
Last Mile

### Problema que resuelve
El sistema espera a que el SLA se incumpla en vez de anticiparlo.

### Impacto en revenue/retención
Reduce fallos visibles al cliente final y mejora NPS operativo.

### Datos necesarios
ETA, ventana delivery, último ping, estado, tráfico externo opcional, incidentes.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Si ETA estimado supera deadline o no hay ping fresco durante ruta activa, enviar alerta con causa y acción recomendada.

### Pseudocódigo
```txt
if status in transit and (eta>deadline or last_ping_age>threshold) => alert(due_soon, action).
```

### Riesgos
PWA offline puede false-positive; incluir confianza y no repetir alertas cada minuto.

### Pruebas QA
Cortar tracking 20 min; validar una sola alerta; restaurar ping y resolver alerta.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Score de confiabilidad del conductor

### Módulo
Last Mile

### Problema que resuelve
La empresa necesita saber qué conductor cumple y qué conductor requiere seguimiento.

### Impacto en revenue/retención
Retiene porque crea historial operacional y ranking útil para asignar rutas.

### Datos necesarios
Viajes completados, on-time, novedades, rechazos atribuibles, calidad POD, cancelaciones, score existente de trucker.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Extender `trucker_scores`/events con subscore operativo por empresa y global; no usar lending ni crédito.

### Pseudocódigo
```txt
score=base completados + on_time - cancelaciones - evidencia_mala - rechazos_atribuibles; guardar evento con explicación.
```

### Riesgos
No castigar conductor nuevo; distinguir causa cliente/bodega/conductor; no exponer a empresas no relacionadas.

### Pruebas QA
Conductor con 0 viajes debe neutral; conductor con 10 completados on-time sube; cancelación atribuible baja.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Score de confiabilidad del cliente/destinatario

### Módulo
Last Mile

### Problema que resuelve
Algunos destinos generan rechazos, demoras o evidencia problemática y operaciones no lo sabe antes.

### Impacto en revenue/retención
Permite planear ventanas y prevenir reclamos con clientes difíciles.

### Datos necesarios
delivery_contact_phone/name, destino, historial de rechazos, tiempos de descarga, incidentes, POD incompleto.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Agrupar por destino/contacto normalizado dentro de la empresa; calcular tasa de rechazo, demora, POD incompleto y novedad.

### Pseudocódigo
```txt
key=business_id+normalized_phone/address; score=100 - rechazo_rate*40 - delay_rate*30 - missing_pod*20.
```

### Riesgos
Privacidad; no crear lista negra global; evitar exponer datos personales innecesarios.

### Pruebas QA
Mismo cliente con 3 rechazos baja score; otro business no ve ese score; datos personales enmascarados para viewer.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
media

---
## Motor de reglas para estados de entrega

### Módulo
Last Mile

### Problema que resuelve
SPTRINTS detectó riesgo de que la UI permita saltarse estados o cerrar sin prerequisitos.

### Impacto en revenue/retención
Aumenta confianza de todo el OS: billing, wallet, reportes y evidencia dependen de estados correctos.

### Datos necesarios
Estado actual, actor, rol, evidencia requerida, pagos, PIN, tracking, dispatch source, modo privado/marketplace.

### Datos existentes en el repo
Existe `cargo_offers` con rutas, ventanas, estados, coordenadas, contactos y modo público/privado; `trip_tracking_sessions`/`trip_location_pings` con GPS PWA; `picking_events`; `trip_signature_evidences`; `WarehouseDigitalEvidenceRecord` con timeline, manifest, tracking, financiero y rechazo.

### Datos faltantes
`delivery_intelligence_scores`, `operator_recommendations`, `route_efficiency_snapshots`, `sla_policy_rules`, histórico normalizado de eventos de estado si no se consolida desde `picking_events`/tracking.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/server/trip-tracking.ts`, `frontend/src/lib/warehouses/types.ts`, `frontend/src/app/viaje/[offerId]`, `frontend/src/app/viaje/[offerId]/carga`, `frontend/src/app/viaje/[offerId]/entrega`, `frontend/src/app/api/trips/[offerId]/tracking/**`.

### Tablas relacionadas
`cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `notifications`.

### Lógica propuesta
Crear state machine server-side compartida. Cada transición valida precondiciones y produce evento auditable. Frontend solo consume estados permitidos.

### Pseudocódigo
```txt
allowed = rules[current][target]; assert role+evidence+pin+payment; insert operation_event; update status.
```

### Riesgos
Migrar sin romper estados legacy; alto impacto si se implementa mal.

### Pruebas QA
Probar transición inválida active->completed; private assigned->in_progress sin confirmación; completed con POD válido.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
alta

---
## Matching carga ↔ transportador

### Módulo
Marketplace

### Problema que resuelve
Las ofertas públicas necesitan encontrar transportadores compatibles sin depender solo de orden cronológico.

### Impacto en revenue/retención
Aumenta fill-rate marketplace y reduce tiempo de asignación.

### Datos necesarios
Zona, vehículo, experiencia, certificaciones, score, historial, ubicación, disponibilidad, tipo de carga, precio.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Ranking candidatos por compatibilidad de vehículo/zona/historial. Si no hay tabla de postulaciones confirmada, empezar con recomendaciones para notificación de cargas compatibles.

### Pseudocódigo
```txt
match = vehicle_fit*30 + zone_fit*25 + score*25 + availability*10 + price_fit*10; top candidates.
```

### Riesgos
No usar datos financieros privados; no invadir empresas privadas; no prometer asignación automática.

### Pruebas QA
Oferta refrigerada solo debe rankear conductores compatibles; conductor suspendido no aparece; marketplace no ve flota privada ajena.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
alta

---
## Ranking de ofertas

### Módulo
Marketplace

### Problema que resuelve
Transportadores pueden ver ofertas sin priorización por cercanía, urgencia o reputación del negocio.

### Impacto en revenue/retención
Mejora conversión de postulaciones y liquidez del marketplace.

### Datos necesarios
Origen/destino, ventana pickup, valor, distancia al conductor, score de negocio, evidencia requerida, fecha publicación.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Ordenar ofertas por compatibilidad con el trucker actual. No cambiar la publicación real; solo vista personalizada.

### Pseudocódigo
```txt
rank = urgency + distance_fit + payment_clarity + business_reliability + vehicle_fit; sort desc.
```

### Riesgos
No ocultar artificialmente ofertas; explicar criterios; filtrar por permisos y disponibilidad.

### Pruebas QA
Conductor con ubicación cerca ve oferta cercana primero; oferta vencida no aparece; privacidad de negocio respetada.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Score de reputación de transportador

### Módulo
Marketplace

### Problema que resuelve
El business necesita comparar postulantes con más contexto que precio.

### Impacto en revenue/retención
Aumenta confianza y reduce fallos de entrega.

### Datos necesarios
trucker_scores, viajes completados, on-time, evidencia, cancelaciones, incidentes, ratings si existen.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Reusar `trucker_scores` y enriquecer evento por marketplace. Mostrar badge y explicación compacta.

### Pseudocódigo
```txt
score = completed_tier + on_time_rate + evidence_quality - cancellation_rate - incidents;
```

### Riesgos
No mezclar con crédito/lending; no crear discriminación por falta de historial.

### Pruebas QA
Trucker nuevo muestra “Nuevo, sin historial suficiente”; trucker gold aparece arriba con razones.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Score de riesgo de operación

### Módulo
Marketplace

### Problema que resuelve
Algunas cargas combinan alto riesgo: ruta larga, horario ajustado, carga sensible, conductor nuevo, pago pendiente.

### Impacto en revenue/retención
Protege margen y reputación; ayuda a decidir depósito, revisión o soporte manual.

### Datos necesarios
Tipo de carga, valor, ruta, distancia, horario, score conductor, estado pago, evidencia requerida, historial zona.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Score por operación antes de publicar/asignar. Si alto, pedir más evidencia o revisión humana.

### Pseudocódigo
```txt
risk = cargo_sensibility + route_complexity + low_driver_score + tight_window + payment_uncertainty;
```

### Riesgos
No bloquear automáticamente revenue; no usar en wallet sin aprobación.

### Pruebas QA
Oferta high-risk debe mostrar checklist reforzado; low-risk no debe friccionar.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Predicción de precio sugerido

### Módulo
Marketplace

### Problema que resuelve
El business puede publicar precio demasiado bajo o alto y afectar fill-rate/margen.

### Impacto en revenue/retención
Mejora conversión marketplace y ventas enterprise si se muestra como inteligencia de mercado.

### Datos necesarios
Histórico por ruta, km, peso/volumen, vehículo, tipo carga, urgencia, pagos completados, comisión.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Fase 1: benchmark por rutas similares; Fase 2: regresión/quantiles cuando haya suficiente histórico. Mostrar rango, no precio único obligatorio.

### Pseudocódigo
```txt
similar = offers same cities/vehicle/weight bucket; p50,p75 = completed prices; suggest = adjusted by urgency.
```

### Riesgos
Puede afectar percepción de precios; no prometer tarifa oficial; datos históricos insuficientes.

### Pruebas QA
Con 20 viajes históricos por ruta, validar p50/p75; sin historial mostrar “datos insuficientes”.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
alta

---
## Detección de ofertas sospechosas

### Módulo
Marketplace

### Problema que resuelve
Publicaciones duplicadas, montos fuera de rango o datos inconsistentes pueden generar fraude o soporte.

### Impacto en revenue/retención
Reduce ruido y protege liquidez marketplace.

### Datos necesarios
Business, origen/destino, fechas, descripción, monto, fotos, manifest, frecuencia de publicaciones.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Reglas: duplicado similar en ventana corta, monto extremo, contacto inválido, coordenadas inconsistentes, fotos repetidas.

### Pseudocódigo
```txt
if duplicate_key within 24h or amount_zscore>3 or invalid_phone => suspicious_review.
```

### Riesgos
No bloquear publicación legítima sin revisión; evitar falsos positivos en clientes de alto volumen.

### Pruebas QA
Crear dos ofertas iguales en 10 min; validar alerta; oferta recurrente con plantilla permitida no debe bloquearse.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Priorización de cargas urgentes

### Módulo
Marketplace

### Problema que resuelve
Cargas con pickup cercano pueden quedar enterradas en lista.

### Impacto en revenue/retención
Aumenta fill-rate y reduce cancelaciones por falta de conductor.

### Datos necesarios
pickup_date/time, published_at, destino, tipo vehículo, postulaciones, prioridad manual, plan del cliente.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Urgency score por tiempo restante y falta de postulaciones. Notificar transportadores compatibles.

### Pseudocódigo
```txt
urgency = max(0, 1-hours_to_pickup/threshold)*60 + no_applications*30 + plan_priority;
```

### Riesgos
No spamear; respetar notification_deliveries dedupe.

### Pruebas QA
Oferta con pickup en 2h y 0 postulantes dispara secuencia; oferta con 10 postulantes no.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
baja

---
## Motor de asignación por zona, capacidad, historial y cumplimiento

### Módulo
Marketplace

### Problema que resuelve
La asignación manual puede elegir un conductor disponible pero no óptimo.

### Impacto en revenue/retención
Mejora cumplimiento y calidad marketplace.

### Datos necesarios
Zona, vehículo, score, historial por ruta, cargas activas, evidencia pasada, cumplimiento SLA.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Recomendar top 3 candidatos con explicación. Human-in-the-loop para asignación final.

### Pseudocódigo
```txt
score = zone + capacity + historical_route_success + evidence_quality + availability; return explanations.
```

### Riesgos
No asignar sin consentimiento si flujo requiere postulación; no usar ubicación si no autorizada.

### Pruebas QA
Top candidato debe cumplir vehicle_type; rol sin permiso no asigna; explicación visible para owner/ops.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
alta

---
## Control de duplicidad de publicaciones

### Módulo
Marketplace

### Problema que resuelve
Una empresa puede publicar la misma carga varias veces por error y contaminar marketplace/reportes.

### Impacto en revenue/retención
Reduce soporte y mantiene reportes confiables.

### Datos necesarios
Business, cargo_description normalizada, origen/destino, fechas, manifest, monto, fotos.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Generar fingerprint por oferta y revisar duplicados en ventana configurable. Permitir duplicado intencional con confirmación.

### Pseudocódigo
```txt
fingerprint = hash(business+origin+dest+date+manifest_summary+amount); if exists active => warn.
```

### Riesgos
No impedir rutas recurrentes legítimas; guardar override_reason.

### Pruebas QA
Publicar duplicado exacto avisa; publicar ruta diaria similar permite confirmar plantilla recurrente.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
baja

---
## Detección de transportadores con bajo desempeño

### Módulo
Marketplace

### Problema que resuelve
Operaciones necesita saber qué transportadores generan retrasos, rechazos o mala evidencia.

### Impacto en revenue/retención
Reduce pérdida operativa y mejora reputación marketplace.

### Datos necesarios
trucker_scores, eventos, cancelaciones, delayed deliveries, evidence quality, incidents.

### Datos existentes en el repo
Existe publicación de ofertas en `cargo_offers`, fotos en `offer_photos`, geocoding, comisión marketplace 8%, flujo marketplace documentado y estados de viaje. SPTRINTS menciona postulaciones/aplicaciones, pago y pantallas de viaje; la ruta exacta de postulaciones queda pendiente de localizar en esta lectura.

### Datos faltantes
`marketplace_match_scores`, `offer_duplicate_checks`, `marketplace_pricing_snapshots`, tabla/vista confirmada de postulaciones si no existe expuesta.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/billing/pricing.ts`, `SPTRINTS/07_MARKETPLACE_TRIP_EXECUTION.md`, futuras rutas de postulaciones/ofertas aceptadas.

### Tablas relacionadas
`cargo_offers`, `offer_photos`, `payments`, `transactions`, `trucker_scores`, `trucker_score_events`, `notifications`. Pendiente confirmar tabla de applications/postulaciones en migraciones no leídas.

### Lógica propuesta
Crear bandera `needs_review` si score cae bajo umbral por métricas recientes. Mostrar acciones: entrenar, limitar asignación, revisar.

### Pseudocódigo
```txt
if last_30_completed>=5 and score<60 or cancellation_rate>0.25 => review.
```

### Riesgos
No bloquear ingresos sin proceso justo; distinguir causas externas.

### Pruebas QA
Conductor con 5 cancelaciones dispara review; conductor con retrasos por incidentes justificados no baja igual.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Asignación óptima de vehículos

### Módulo
Flota privada

### Problema que resuelve
La empresa asigna conductor/vehículo por memoria, no por disponibilidad, zona y cumplimiento.

### Impacto en revenue/retención
Hace que flota privada sea uso diario y reduce rutas mal asignadas.

### Datos necesarios
business_fleet_members, vehicle_plate, viajes activos, zona, tipo de carga, histórico de cumplimiento, ubicación reciente.

### Datos existentes en el repo
Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.

### Datos faltantes
`fleet_utilization_snapshots`, `vehicle_maintenance_events`, `private_fleet_assignment_scores`, campo estructurado de vehículo si se requiere más que `vehicle_plate`.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/warehouses/types.ts`, `SPTRINTS/16_PRIVATE_FLEET_B2B.md`, `SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`, rutas de `/dashboard/flota`.

### Tablas relacionadas
`business_fleet_members`, `business_fleet_invitations`, `cargo_offers`, `trip_financial_allocations`, `private_fleet_payroll_runs`, `private_fleet_payroll_items`, `trip_location_pings`.

### Lógica propuesta
Recomendar conductor privado compatible y explicar razón. No asignar automáticamente.

### Pseudocódigo
```txt
candidatos = fleet active; excluir activeTrips; score = cercanía + historial + vehículo + disponibilidad; top3.
```

### Riesgos
Datos de vehículo son limitados; no inventar capacidad si no existe.

### Pruebas QA
Conductor suspendido no aparece; conductor con activeTrip baja; resultado filtrado por business_id.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Mantenimiento preventivo básico

### Módulo
Flota privada

### Problema que resuelve
KargaX registra placa y viajes, pero no alerta desgaste operativo mínimo.

### Impacto en revenue/retención
Ayuda a retención en empresas con flota propia sin construir un TMS completo.

### Datos necesarios
vehicle_plate, número de viajes, km estimados, incidentes mecánicos, fecha última revisión si se agrega.

### Datos existentes en el repo
Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.

### Datos faltantes
`fleet_utilization_snapshots`, `vehicle_maintenance_events`, `private_fleet_assignment_scores`, campo estructurado de vehículo si se requiere más que `vehicle_plate`.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/warehouses/types.ts`, `SPTRINTS/16_PRIVATE_FLEET_B2B.md`, `SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`, rutas de `/dashboard/flota`.

### Tablas relacionadas
`business_fleet_members`, `business_fleet_invitations`, `cargo_offers`, `trip_financial_allocations`, `private_fleet_payroll_runs`, `private_fleet_payroll_items`, `trip_location_pings`.

### Lógica propuesta
Fase 1: contador por viajes/km estimados e incidentes. Proponer tabla `vehicle_maintenance_events` para mantenimientos reales.

### Pseudocódigo
```txt
if km_estimated_since_last_service>threshold or mechanical_incidents>=2 => maintenance_due.
```

### Riesgos
No reemplaza mantenimiento legal; no dar diagnósticos mecánicos, solo recordatorios operativos.

### Pruebas QA
Vehículo con 10k km estimados alerta; registrar mantenimiento resetea contador.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
media

---
## Score de utilización de flota

### Módulo
Flota privada

### Problema que resuelve
El owner no sabe si sus conductores privados están sobreutilizados o subutilizados.

### Impacto en revenue/retención
Optimiza costos de nómina/terceros y genera valor para Scale/Enterprise.

### Datos necesarios
Viajes asignados/completados por conductor, días activos, distancia, horas, payroll/gastos si rol financiero.

### Datos existentes en el repo
Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.

### Datos faltantes
`fleet_utilization_snapshots`, `vehicle_maintenance_events`, `private_fleet_assignment_scores`, campo estructurado de vehículo si se requiere más que `vehicle_plate`.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/warehouses/types.ts`, `SPTRINTS/16_PRIVATE_FLEET_B2B.md`, `SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`, rutas de `/dashboard/flota`.

### Tablas relacionadas
`business_fleet_members`, `business_fleet_invitations`, `cargo_offers`, `trip_financial_allocations`, `private_fleet_payroll_runs`, `private_fleet_payroll_items`, `trip_location_pings`.

### Lógica propuesta
Calcular utilización por conductor: viajes, días con ruta, horas estimadas y cumplimiento. Separar vista operativa vs financiera por rol.

### Pseudocódigo
```txt
util = active_days/period_days*40 + trips_norm*40 + on_time*20; tag low/healthy/overloaded.
```

### Riesgos
No exponer pagos a ops si no puede ver finanzas.

### Pruebas QA
Finance ve costo; dispatcher solo ve carga operativa; conductor removido no cuenta como activo.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Detección de vehículos subutilizados

### Módulo
Flota privada

### Problema que resuelve
Placas/conductores pueden quedar sin uso mientras se contrata externo.

### Impacto en revenue/retención
Reduce gasto y aumenta adopción de flota privada.

### Datos necesarios
business_fleet_members, cargo_offers private/public, viajes por conductor, marketplace usado por la misma empresa.

### Datos existentes en el repo
Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.

### Datos faltantes
`fleet_utilization_snapshots`, `vehicle_maintenance_events`, `private_fleet_assignment_scores`, campo estructurado de vehículo si se requiere más que `vehicle_plate`.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/warehouses/types.ts`, `SPTRINTS/16_PRIVATE_FLEET_B2B.md`, `SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`, rutas de `/dashboard/flota`.

### Tablas relacionadas
`business_fleet_members`, `business_fleet_invitations`, `cargo_offers`, `trip_financial_allocations`, `private_fleet_payroll_runs`, `private_fleet_payroll_items`, `trip_location_pings`.

### Lógica propuesta
Detectar empresas que publican marketplace en rutas que podrían cubrir conductores privados subutilizados.

### Pseudocódigo
```txt
if marketplace_offer and fleet_driver_available_same_zone and low_utilization => recommend private assignment.
```

### Riesgos
No forzar flota privada si vehículo/capacidad no coincide.

### Pruebas QA
Conductor privado libre y oferta pública similar dispara recomendación; vehículo incompatible no.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Priorización de rutas por costo operativo

### Módulo
Flota privada

### Problema que resuelve
La empresa no ve qué ruta consume más gastos/tiempo/recursos.

### Impacto en revenue/retención
Ayuda a margen y upsell a reportes Enterprise.

### Datos necesarios
Ruta, distancia, gastos empresa, pago por viaje, incidentes, delays, costo por conductor.

### Datos existentes en el repo
Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.

### Datos faltantes
`fleet_utilization_snapshots`, `vehicle_maintenance_events`, `private_fleet_assignment_scores`, campo estructurado de vehículo si se requiere más que `vehicle_plate`.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/warehouses/types.ts`, `SPTRINTS/16_PRIVATE_FLEET_B2B.md`, `SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`, rutas de `/dashboard/flota`.

### Tablas relacionadas
`business_fleet_members`, `business_fleet_invitations`, `cargo_offers`, `trip_financial_allocations`, `private_fleet_payroll_runs`, `private_fleet_payroll_items`, `trip_location_pings`.

### Lógica propuesta
Calcular costo operativo estimado por ruta y prioridad de revisión. Separar `trip_pay` y `company_expense`.

### Pseudocódigo
```txt
cost = company_expense + trip_pay + delay_cost + incident_cost; rank desc by margin risk.
```

### Riesgos
RIESGO ALTO si mezcla wallet marketplace con pagos privados; usar solo datos permitidos por rol.

### Pruebas QA
Ruta con gastos altos aparece; dispatcher no ve COP si no tiene finance; contabilidad ve detalle.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
media

---
## Recomendación de consolidación de carga

### Módulo
Flota privada

### Problema que resuelve
Varios despachos pequeños de la misma empresa pueden salir separados.

### Impacto en revenue/retención
Reduce viajes, costos y emisiones; fortalece WMS-to-trip.

### Datos necesarios
warehouse_dispatch_orders, manifest, destino, ventana, capacidad, conductor disponible.

### Datos existentes en el repo
Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.

### Datos faltantes
`fleet_utilization_snapshots`, `vehicle_maintenance_events`, `private_fleet_assignment_scores`, campo estructurado de vehículo si se requiere más que `vehicle_plate`.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/warehouses/types.ts`, `SPTRINTS/16_PRIVATE_FLEET_B2B.md`, `SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`, rutas de `/dashboard/flota`.

### Tablas relacionadas
`business_fleet_members`, `business_fleet_invitations`, `cargo_offers`, `trip_financial_allocations`, `private_fleet_payroll_runs`, `private_fleet_payroll_items`, `trip_location_pings`.

### Lógica propuesta
Desde despacho WMS recomendar consolidar líneas compatibles antes de crear viaje privado.

### Pseudocódigo
```txt
buscar dispatch ready misma bodega + destino cercano + ventana compatible; recomendar consolidar y recalcular manifest.
```

### Riesgos
No mezclar cargas incompatibles; no romper stock ni manifest.

### Pruebas QA
Dos despachos compatibles generan sugerencia; rechazos en origen no deben contarse como cargados.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Control de cumplimiento por conductor

### Módulo
Flota privada

### Problema que resuelve
La empresa necesita saber si el conductor privado acepta, recoge y entrega según reglas.

### Impacto en revenue/retención
Mejora operación interna y justifica reportes por conductor.

### Datos necesarios
acceptedAt/rejectedAt, pickup/delivery timestamps, tracking, evidence quality, incidents, compensation mode.

### Datos existentes en el repo
Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.

### Datos faltantes
`fleet_utilization_snapshots`, `vehicle_maintenance_events`, `private_fleet_assignment_scores`, campo estructurado de vehículo si se requiere más que `vehicle_plate`.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/warehouses/types.ts`, `SPTRINTS/16_PRIVATE_FLEET_B2B.md`, `SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`, rutas de `/dashboard/flota`.

### Tablas relacionadas
`business_fleet_members`, `business_fleet_invitations`, `cargo_offers`, `trip_financial_allocations`, `private_fleet_payroll_runs`, `private_fleet_payroll_items`, `trip_location_pings`.

### Lógica propuesta
Subscore privado por conductor con explicación por etapa: aceptación, puntualidad, evidencia, novedades.

### Pseudocódigo
```txt
score = acceptance + pickup_sla + delivery_sla + pod_quality - incidents;
```

### Riesgos
No mezclar con marketplace global sin indicar contexto; no usar para decisiones laborales automáticas.

### Pruebas QA
Conductor asalariado ve ruta sin pago; owner ve cumplimiento; score bajo genera revisión, no bloqueo.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Alertas de operación fuera de patrón

### Módulo
Flota privada

### Problema que resuelve
Flota privada puede tener comportamientos raros: rutas de madrugada, muchas pruebas externas, gastos anómalos.

### Impacto en revenue/retención
Reduce fraude operativo y errores internos.

### Datos necesarios
Horarios, rutas usuales, gastos, comprobantes, pings, conductor, placa, incidentes.

### Datos existentes en el repo
Existe `business_fleet_members`, `business_fleet_invitations`, columnas privadas en `cargo_offers`, `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `trip_financial_allocations`, payroll privado y validaciones server en `/api/offers`.

### Datos faltantes
`fleet_utilization_snapshots`, `vehicle_maintenance_events`, `private_fleet_assignment_scores`, campo estructurado de vehículo si se requiere más que `vehicle_plate`.

### Archivos relacionados
`frontend/src/app/api/offers/route.ts`, `frontend/src/lib/warehouses/types.ts`, `SPTRINTS/16_PRIVATE_FLEET_B2B.md`, `SPTRINTS/22_PRIVATE_FLEET_FINANCE_AND_ROLES.md`, rutas de `/dashboard/flota`.

### Tablas relacionadas
`business_fleet_members`, `business_fleet_invitations`, `cargo_offers`, `trip_financial_allocations`, `private_fleet_payroll_runs`, `private_fleet_payroll_items`, `trip_location_pings`.

### Lógica propuesta
Modelo de reglas por desviación de patrón de la propia empresa: hora, zona, monto, falta de tracking, comprobante repetido.

### Pseudocódigo
```txt
if route_zone not in driver_history and expense>p95 and no_tracking => alert_review.
```

### Riesgos
RIESGO ALTO en dinero; no acusar fraude, usar “revisión operativa”.

### Pruebas QA
Gasto > p95 con comprobante repetido alerta; rol sin finance ve solo alerta operativa.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
alta

---
## Priorización de despacho

### Módulo
Bodegas

### Problema que resuelve
La bodega no sabe qué despacho debe preparar primero cuando hay volumen.

### Impacto en revenue/retención
Mejora OTIF y reduce retrasos desde origen.

### Datos necesarios
scheduled_at, dispatch status, líneas, stock, destino, ventana pickup, trip_creation_status, prioridad cliente.

### Datos existentes en el repo
Existe WMS con `warehouses`, `warehouse_docks`, `warehouse_appointments`, stock, recibos, despachos, líneas con requested/picked/dispatched/rejected, tareas e incidentes. Sprint 23 conectó despacho con viaje por `dispatch_trip_mode`.

### Datos faltantes
`warehouse_bottleneck_snapshots`, `warehouse_capacity_rules`, `picking_recommendation_runs`, métricas históricas por muelle si no se derivan de appointments/tasks.

### Archivos relacionados
`frontend/src/app/bodegas/[id]/despachos/page.tsx`, `frontend/src/app/api/warehouses/[id]/dispatches/route.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`warehouses`, `warehouse_docks`, `warehouse_appointments`, `warehouse_stock_balances`, `warehouse_receipts`, `warehouse_receipt_lines`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `warehouse_tasks`, `warehouse_incidents`.

### Lógica propuesta
Score de despacho listo: SLA, stock disponible, viaje creado, conductor asignado, líneas rechazadas, cliente prioritario.

### Pseudocódigo
```txt
score = due_soon + stock_ready + trip_missing + rejected_qty + priority; ordenar para warehouse_manager.
```

### Riesgos
No mostrar finanzas; respetar permisos warehouse_operator.

### Pruebas QA
Despacho con pickup próximo aparece arriba; sin stock muestra acción “resolver stock”.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
baja

---
## Detección de cuellos de botella

### Módulo
Bodegas

### Problema que resuelve
Citas, muelles, tareas o despachos se acumulan y nadie detecta el cuello.

### Impacto en revenue/retención
Reduce demoras y fortalece venta WMS.

### Datos necesarios
warehouse_appointments, docks, tasks, dispatches, actual_start/end, status, incidents.

### Datos existentes en el repo
Existe WMS con `warehouses`, `warehouse_docks`, `warehouse_appointments`, stock, recibos, despachos, líneas con requested/picked/dispatched/rejected, tareas e incidentes. Sprint 23 conectó despacho con viaje por `dispatch_trip_mode`.

### Datos faltantes
`warehouse_bottleneck_snapshots`, `warehouse_capacity_rules`, `picking_recommendation_runs`, métricas históricas por muelle si no se derivan de appointments/tasks.

### Archivos relacionados
`frontend/src/app/bodegas/[id]/despachos/page.tsx`, `frontend/src/app/api/warehouses/[id]/dispatches/route.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`warehouses`, `warehouse_docks`, `warehouse_appointments`, `warehouse_stock_balances`, `warehouse_receipts`, `warehouse_receipt_lines`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `warehouse_tasks`, `warehouse_incidents`.

### Lógica propuesta
Detectar acumulación por etapa: citas esperando, muelles ocupados, tareas bloqueadas, despachos sin confirmar.

### Pseudocódigo
```txt
if open_tasks_by_type[picking]>threshold or delayed_appointments>0 => bottleneck(stage).
```

### Riesgos
Datos de tiempo real pueden faltar; empezar con status/aging.

### Pruebas QA
Crear 5 tareas bloqueadas y validar alerta; cerrar tareas reduce alerta.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Predicción de congestión operativa

### Módulo
Bodegas

### Problema que resuelve
La bodega reacciona cuando ya está congestionada.

### Impacto en revenue/retención
Mejora planificación diaria y retención por uso operativo recurrente.

### Datos necesarios
Agenda futura de citas/despachos, muelles, tareas abiertas, histórico por día/hora.

### Datos existentes en el repo
Existe WMS con `warehouses`, `warehouse_docks`, `warehouse_appointments`, stock, recibos, despachos, líneas con requested/picked/dispatched/rejected, tareas e incidentes. Sprint 23 conectó despacho con viaje por `dispatch_trip_mode`.

### Datos faltantes
`warehouse_bottleneck_snapshots`, `warehouse_capacity_rules`, `picking_recommendation_runs`, métricas históricas por muelle si no se derivan de appointments/tasks.

### Archivos relacionados
`frontend/src/app/bodegas/[id]/despachos/page.tsx`, `frontend/src/app/api/warehouses/[id]/dispatches/route.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`warehouses`, `warehouse_docks`, `warehouse_appointments`, `warehouse_stock_balances`, `warehouse_receipts`, `warehouse_receipt_lines`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `warehouse_tasks`, `warehouse_incidents`.

### Lógica propuesta
Fase 1: forecast por carga programada vs capacidad. Fase 2: modelo por histórico de duración real.

### Pseudocódigo
```txt
load_hour = appointments + dispatch_lines + open_tasks; if load_hour>capacity_rule => predicted_congestion.
```

### Riesgos
Capacidad por muelle no confirmada; requiere tabla `warehouse_capacity_rules`.

### Pruebas QA
Configurar capacidad 3 citas/hora; programar 5; debe alertar congestión.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
media

---
## Recomendación de picking/packing

### Módulo
Bodegas

### Problema que resuelve
Picking puede ejecutarse sin orden óptimo por ubicación o prioridad.

### Impacto en revenue/retención
Reduce tiempo de bodega y errores de despacho.

### Datos necesarios
warehouse_locations, stock balances, dispatch lines, SKU, lot/expiry, location type, requested qty.

### Datos existentes en el repo
Existe WMS con `warehouses`, `warehouse_docks`, `warehouse_appointments`, stock, recibos, despachos, líneas con requested/picked/dispatched/rejected, tareas e incidentes. Sprint 23 conectó despacho con viaje por `dispatch_trip_mode`.

### Datos faltantes
`warehouse_bottleneck_snapshots`, `warehouse_capacity_rules`, `picking_recommendation_runs`, métricas históricas por muelle si no se derivan de appointments/tasks.

### Archivos relacionados
`frontend/src/app/bodegas/[id]/despachos/page.tsx`, `frontend/src/app/api/warehouses/[id]/dispatches/route.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`warehouses`, `warehouse_docks`, `warehouse_appointments`, `warehouse_stock_balances`, `warehouse_receipts`, `warehouse_receipt_lines`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `warehouse_tasks`, `warehouse_incidents`.

### Lógica propuesta
Ordenar picking por zona/aisle/rack/FEFO si expiry existe. No mover stock automáticamente.

### Pseudocódigo
```txt
lines.sort(by zone, aisle, rack, expiry soonest); propose pick path and shortages.
```

### Riesgos
Datos de ubicación pueden estar incompletos; no inventar FEFO si `expires_at` es null.

### Pruebas QA
SKU con expiración más cercana aparece primero; location null queda al final con aviso.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Score de ocupación

### Módulo
Bodegas

### Problema que resuelve
Owner/warehouse_manager necesita entender ocupación operativa, no solo stock total.

### Impacto en revenue/retención
Permite upsell a Scale/Enterprise y previene congestión.

### Datos necesarios
Ubicaciones, stock_on_hand/reserved, docks status, appointments, dispatches, tasks.

### Datos existentes en el repo
Existe WMS con `warehouses`, `warehouse_docks`, `warehouse_appointments`, stock, recibos, despachos, líneas con requested/picked/dispatched/rejected, tareas e incidentes. Sprint 23 conectó despacho con viaje por `dispatch_trip_mode`.

### Datos faltantes
`warehouse_bottleneck_snapshots`, `warehouse_capacity_rules`, `picking_recommendation_runs`, métricas históricas por muelle si no se derivan de appointments/tasks.

### Archivos relacionados
`frontend/src/app/bodegas/[id]/despachos/page.tsx`, `frontend/src/app/api/warehouses/[id]/dispatches/route.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`warehouses`, `warehouse_docks`, `warehouse_appointments`, `warehouse_stock_balances`, `warehouse_receipts`, `warehouse_receipt_lines`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `warehouse_tasks`, `warehouse_incidents`.

### Lógica propuesta
Score mixto: stock por ubicación + muelles ocupados + citas activas + tareas abiertas. Faltan dimensiones físicas para ocupación volumétrica real.

### Pseudocódigo
```txt
occupancy = stock_locations_used/active_locations*50 + dock_occupancy*30 + task_pressure*20;
```

### Riesgos
No vender como capacidad física exacta si no hay m3 por ubicación.

### Pruebas QA
Ubicaciones activas con stock calculan porcentaje; sin locations mostrar “ocupación operativa estimada”.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
media

---
## Alertas de inventario o movimiento irregular

### Módulo
Bodegas

### Problema que resuelve
Ajustes, rechazos o movimientos raros pueden generar diferencias de inventario.

### Impacto en revenue/retención
Reduce pérdidas y soporte por faltantes.

### Datos necesarios
Stock balances, dispatch/receipt lines, rejected_qty, damaged_qty, incidents, actor, timestamps.

### Datos existentes en el repo
Existe WMS con `warehouses`, `warehouse_docks`, `warehouse_appointments`, stock, recibos, despachos, líneas con requested/picked/dispatched/rejected, tareas e incidentes. Sprint 23 conectó despacho con viaje por `dispatch_trip_mode`.

### Datos faltantes
`warehouse_bottleneck_snapshots`, `warehouse_capacity_rules`, `picking_recommendation_runs`, métricas históricas por muelle si no se derivan de appointments/tasks.

### Archivos relacionados
`frontend/src/app/bodegas/[id]/despachos/page.tsx`, `frontend/src/app/api/warehouses/[id]/dispatches/route.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`warehouses`, `warehouse_docks`, `warehouse_appointments`, `warehouse_stock_balances`, `warehouse_receipts`, `warehouse_receipt_lines`, `warehouse_dispatch_orders`, `warehouse_dispatch_lines`, `warehouse_tasks`, `warehouse_incidents`.

### Lógica propuesta
Detectar stock negativo, rechazo alto, daño alto, ajustes sin evidencia, salida sin despacho confirmado.

### Pseudocódigo
```txt
if quantity_on_hand<0 or rejected_qty/requested_qty>threshold or adjustment_without_evidence => alert.
```

### Riesgos
No está confirmada tabla de stock movements en lectura; si falta, crear `warehouse_stock_movements` o vista audit.

### Pruebas QA
Intentar stock negativo debe fallar/alertar; despacho con rejected_qty alto crea alerta.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Validación de evidencia obligatoria

### Módulo
Evidencia digital

### Problema que resuelve
Cada empresa puede exigir evidencia mínima distinta, pero hoy falta un validador central.

### Impacto en revenue/retención
Reduce reclamos y hace vendible el soporte descargable.

### Datos necesarios
Firma, foto, receptor, documento, PIN, tracking, manifest, novedad, role/capture surface.

### Datos existentes en el repo
Existe `trip_signature_evidences`, `offer_photos`, `picking_events`, `WarehouseDigitalEvidenceRecord`, manifest summary, signature requirements, fotos por stage, timeline, tracking y rejection.

### Datos faltantes
`evidence_quality_checks`, hash/perceptual hash de foto si se quiere detectar repetición, `pin_attempts` estructurado si PIN no tiene tabla dedicada en archivos leídos.

### Archivos relacionados
`frontend/src/lib/warehouses/types.ts`, `supabase/migrations/035_private_fleet_b2b.sql`, rutas de viaje/carga/entrega y componentes de evidencia.

### Tablas relacionadas
`trip_signature_evidences`, `offer_photos`, `picking_events`, `trip_location_pings`, `warehouse_dispatch_lines`, `cargo_offers`.

### Lógica propuesta
Crear reglas por stage y modo: pickup, delivery, private/marketplace, warehouse dispatch. Guardar resultado en `evidence_quality_checks`.

### Pseudocódigo
```txt
for requirement in policy(stage): completed = exists(source); if not => missing.append; status by missing severity.
```

### Riesgos
Privacidad de fotos/firma; no bloquear viaje legacy sin migración.

### Pruebas QA
Policy requiere firma+foto; viaje sin foto queda needs_review; auditor puede ver resultado.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Detección de POD incompleto

### Módulo
Evidencia digital

### Problema que resuelve
Una entrega cerrada puede no tener soporte suficiente para cliente/finanzas.

### Impacto en revenue/retención
Evita liberar pagos o emitir reportes con evidencia débil.

### Datos necesarios
delivery_verified_at, delivery_pod signature, photos delivery, manifest delivered/rejected, recipient fields.

### Datos existentes en el repo
Existe `trip_signature_evidences`, `offer_photos`, `picking_events`, `WarehouseDigitalEvidenceRecord`, manifest summary, signature requirements, fotos por stage, timeline, tracking y rejection.

### Datos faltantes
`evidence_quality_checks`, hash/perceptual hash de foto si se quiere detectar repetición, `pin_attempts` estructurado si PIN no tiene tabla dedicada en archivos leídos.

### Archivos relacionados
`frontend/src/lib/warehouses/types.ts`, `supabase/migrations/035_private_fleet_b2b.sql`, rutas de viaje/carga/entrega y componentes de evidencia.

### Tablas relacionadas
`trip_signature_evidences`, `offer_photos`, `picking_events`, `trip_location_pings`, `warehouse_dispatch_lines`, `cargo_offers`.

### Lógica propuesta
Subconjunto del validador con foco POD. Estado `complete`, `incomplete`, `critical_missing`.

### Pseudocódigo
```txt
if completed and not delivery_signature => critical; if no photo => incomplete; if manifest mismatch => incomplete.
```

### Riesgos
RIESGO ALTO si se conecta a wallet; inicialmente solo alerta, no libera/bloquea dinero automáticamente.

### Pruebas QA
Viaje completed sin firma se marca critical; completed con firma/foto/manifest OK se marca complete.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
baja

---
## Reglas para PIN, foto, firma y observaciones

### Módulo
Evidencia digital

### Problema que resuelve
Los requisitos de PIN/foto/firma deben ser consistentes por estado y actor.

### Impacto en revenue/retención
Aumenta confianza y baja errores de operación.

### Datos necesarios
PIN pickup/delivery, signature stage, photo stage, notes/rejection reason, actor role.

### Datos existentes en el repo
Existe `trip_signature_evidences`, `offer_photos`, `picking_events`, `WarehouseDigitalEvidenceRecord`, manifest summary, signature requirements, fotos por stage, timeline, tracking y rejection.

### Datos faltantes
`evidence_quality_checks`, hash/perceptual hash de foto si se quiere detectar repetición, `pin_attempts` estructurado si PIN no tiene tabla dedicada en archivos leídos.

### Archivos relacionados
`frontend/src/lib/warehouses/types.ts`, `supabase/migrations/035_private_fleet_b2b.sql`, rutas de viaje/carga/entrega y componentes de evidencia.

### Tablas relacionadas
`trip_signature_evidences`, `offer_photos`, `picking_events`, `trip_location_pings`, `warehouse_dispatch_lines`, `cargo_offers`.

### Lógica propuesta
State rules: origen requiere pickup PIN o firma bodega; destino requiere delivery PIN/firma/foto; observación obligatoria si rechazo.

### Pseudocódigo
```txt
if rejected_qty>0 and no rejectionReason => invalid; if delivery stage and no signature => invalid.
```

### Riesgos
PIN attempts no fue confirmado como tabla; migrar si hace falta.

### Pruebas QA
Rechazo sin observación falla; firma de origen no cuenta como POD destino.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Score de calidad de evidencia

### Módulo
Evidencia digital

### Problema que resuelve
No basta saber si hay evidencia; hay que medir si es buena.

### Impacto en revenue/retención
Diferencia KargaX en ventas: “entrega probada con calidad”.

### Datos necesarios
Cantidad y tipo de evidencias, precisión GPS, timestamp, signer completo, manifest match, foto única.

### Datos existentes en el repo
Existe `trip_signature_evidences`, `offer_photos`, `picking_events`, `WarehouseDigitalEvidenceRecord`, manifest summary, signature requirements, fotos por stage, timeline, tracking y rejection.

### Datos faltantes
`evidence_quality_checks`, hash/perceptual hash de foto si se quiere detectar repetición, `pin_attempts` estructurado si PIN no tiene tabla dedicada en archivos leídos.

### Archivos relacionados
`frontend/src/lib/warehouses/types.ts`, `supabase/migrations/035_private_fleet_b2b.sql`, rutas de viaje/carga/entrega y componentes de evidencia.

### Tablas relacionadas
`trip_signature_evidences`, `offer_photos`, `picking_events`, `trip_location_pings`, `warehouse_dispatch_lines`, `cargo_offers`.

### Lógica propuesta
Score 0-100 con razones. Mostrar badge en viaje, dashboard y reporte.

### Pseudocódigo
```txt
score=100 - missing_required*25 - low_accuracy*10 - no_signer_doc*10 - manifest_mismatch*20;
```

### Riesgos
No usar IA visual de terceros al inicio; proteger fotos y firmas.

### Pruebas QA
Caso perfecto 95+; sin firma <=60; GPS lejos resta; badge visible por rol autorizado.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Detección de evidencias repetidas o sospechosas

### Módulo
Evidencia digital

### Problema que resuelve
Fotos o firmas pueden reutilizarse en varios viajes.

### Impacto en revenue/retención
Reduce fraude y reclamos.

### Datos necesarios
storage_path, public_url, hash de archivo, metadata, offer_id, signer data, timestamp.

### Datos existentes en el repo
Existe `trip_signature_evidences`, `offer_photos`, `picking_events`, `WarehouseDigitalEvidenceRecord`, manifest summary, signature requirements, fotos por stage, timeline, tracking y rejection.

### Datos faltantes
`evidence_quality_checks`, hash/perceptual hash de foto si se quiere detectar repetición, `pin_attempts` estructurado si PIN no tiene tabla dedicada en archivos leídos.

### Archivos relacionados
`frontend/src/lib/warehouses/types.ts`, `supabase/migrations/035_private_fleet_b2b.sql`, rutas de viaje/carga/entrega y componentes de evidencia.

### Tablas relacionadas
`trip_signature_evidences`, `offer_photos`, `picking_events`, `trip_location_pings`, `warehouse_dispatch_lines`, `cargo_offers`.

### Lógica propuesta
Agregar hash SHA/perceptual_hash al subir evidencia; comparar dentro del mismo business y global solo con privacidad estricta.

### Pseudocódigo
```txt
if hash appears in other offer_id and stage same => suspicious_duplicate.
```

### Riesgos
No exponer evidencia de otra empresa; hashes no deben permitir reconstruir imagen.

### Pruebas QA
Subir misma foto en dos viajes: alerta; misma plantilla de firma sin documento: alerta revisión.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
alta

---
## Separación estricta entre evidencia privada y evidencia marketplace

### Módulo
Evidencia digital

### Problema que resuelve
Las evidencias comparten estructuras, pero privacidad y dinero cambian según modo.

### Impacto en revenue/retención
Evita incidentes de confianza y soporte legal.

### Datos necesarios
is_private_fleet, business_id, assigned_trucker_id, private_fleet_trucker_id, role, source dispatch.

### Datos existentes en el repo
Existe `trip_signature_evidences`, `offer_photos`, `picking_events`, `WarehouseDigitalEvidenceRecord`, manifest summary, signature requirements, fotos por stage, timeline, tracking y rejection.

### Datos faltantes
`evidence_quality_checks`, hash/perceptual hash de foto si se quiere detectar repetición, `pin_attempts` estructurado si PIN no tiene tabla dedicada en archivos leídos.

### Archivos relacionados
`frontend/src/lib/warehouses/types.ts`, `supabase/migrations/035_private_fleet_b2b.sql`, rutas de viaje/carga/entrega y componentes de evidencia.

### Tablas relacionadas
`trip_signature_evidences`, `offer_photos`, `picking_events`, `trip_location_pings`, `warehouse_dispatch_lines`, `cargo_offers`.

### Lógica propuesta
Toda consulta de evidencia debe filtrar por business_id y modo. Los reportes deben etiquetar `marketplace` vs `private_fleet`.

### Pseudocódigo
```txt
assert evidence.business_id == context.business_id; evidenceRail = offer.is_private_fleet ? private : marketplace;
```

### Riesgos
RIESGO ALTO: fuga cross-company o mezcla de soporte privado en marketplace.

### Pruebas QA
Usuario business A no accede evidencia B; reporte privado no crea payout marketplace.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Conciliación inteligente

### Módulo
Wallet/liquidaciones

### Problema que resuelve
Saldos, transacciones, pagos y payouts deben explicar cada peso.

### Impacto en revenue/retención
Aumenta confianza financiera y reduce soporte.

### Datos necesarios
transactions, payments, payout_attempts, cargo_offers, trip_financial_allocations, balance before/after.

### Datos existentes en el repo
Existe wallet/ledger operativo documentado; Sprint 20 implementó `payout_methods` y `payout_attempts`; Sprint 22 separa flota privada; `trip_financial_allocations` existe. Las reglas prohíben mezclar marketplace con privado.

### Datos faltantes
`financial_guardrail_events`, `ledger_reconciliation_runs`, campo canónico `money_rail` si no se aplica desde WALLET draft, vista unificada de balance before/after.

### Archivos relacionados
`frontend/src/app/api/wallet/withdraw/route.ts` (mencionado), `frontend/src/app/api/payments/webhook/route.ts` (mencionado), `frontend/src/lib/server/payments/freight-settlement.ts` (mencionado), `WALLET/**`, `SPTRINTS/20_*`, `SPTRINTS/22_*`.

### Tablas relacionadas
`transactions`, `wallets`/wallet operativo (tabla exacta no confirmada en lectura de migración), `payout_methods`, `payout_attempts`, `trip_financial_allocations`, `payments`, `cargo_offers`, `private_fleet_payroll_runs/items`.

### Lógica propuesta
Job read-only que compara ledger vs eventos fuente y genera `financial_guardrail_events`.

### Pseudocódigo
```txt
for wallet: expected=sum(ledger); compare stored_balance; if diff !=0 => reconciliation_event.
```

### Riesgos
RIESGO ALTO: no corregir saldo automáticamente; solo alertar y requerir revisión.

### Pruebas QA
Crear ledger consistente => pass; duplicar transacción => alerta; saldo negativo => critical.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
alta

---
## Detección de liquidaciones duplicadas

### Módulo
Wallet/liquidaciones

### Problema que resuelve
Un mismo viaje no puede liberar pago dos veces.

### Impacto en revenue/retención
Evita pérdida directa de dinero.

### Datos necesarios
offer_id, allocation_type, transaction_type, payout_attempt idempotency, payment reference, status.

### Datos existentes en el repo
Existe wallet/ledger operativo documentado; Sprint 20 implementó `payout_methods` y `payout_attempts`; Sprint 22 separa flota privada; `trip_financial_allocations` existe. Las reglas prohíben mezclar marketplace con privado.

### Datos faltantes
`financial_guardrail_events`, `ledger_reconciliation_runs`, campo canónico `money_rail` si no se aplica desde WALLET draft, vista unificada de balance before/after.

### Archivos relacionados
`frontend/src/app/api/wallet/withdraw/route.ts` (mencionado), `frontend/src/app/api/payments/webhook/route.ts` (mencionado), `frontend/src/lib/server/payments/freight-settlement.ts` (mencionado), `WALLET/**`, `SPTRINTS/20_*`, `SPTRINTS/22_*`.

### Tablas relacionadas
`transactions`, `wallets`/wallet operativo (tabla exacta no confirmada en lectura de migración), `payout_methods`, `payout_attempts`, `trip_financial_allocations`, `payments`, `cargo_offers`, `private_fleet_payroll_runs/items`.

### Lógica propuesta
Unique logical key por `offer_id + money_rail + allocation_type + release_trigger`. Alertar duplicados existentes.

### Pseudocódigo
```txt
group by offer_id, allocation_type where status in released/paid; if count>1 => duplicate_liquidation.
```

### Riesgos
RIESGO ALTO: primero detectar, luego migrar constraints con cleanup.

### Pruebas QA
Intentar release dos veces debe fallar o alertar; payout duplicate idempotency no paga dos veces.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Validación de saldos

### Módulo
Wallet/liquidaciones

### Problema que resuelve
Un retiro no puede salir si saldo disponible no existe o está comprometido.

### Impacto en revenue/retención
Protege caja y confianza del camionero.

### Datos necesarios
available, pending, withdrawals, payout_attempts, holds, transactions, obligations.

### Datos existentes en el repo
Existe wallet/ledger operativo documentado; Sprint 20 implementó `payout_methods` y `payout_attempts`; Sprint 22 separa flota privada; `trip_financial_allocations` existe. Las reglas prohíben mezclar marketplace con privado.

### Datos faltantes
`financial_guardrail_events`, `ledger_reconciliation_runs`, campo canónico `money_rail` si no se aplica desde WALLET draft, vista unificada de balance before/after.

### Archivos relacionados
`frontend/src/app/api/wallet/withdraw/route.ts` (mencionado), `frontend/src/app/api/payments/webhook/route.ts` (mencionado), `frontend/src/lib/server/payments/freight-settlement.ts` (mencionado), `WALLET/**`, `SPTRINTS/20_*`, `SPTRINTS/22_*`.

### Tablas relacionadas
`transactions`, `wallets`/wallet operativo (tabla exacta no confirmada en lectura de migración), `payout_methods`, `payout_attempts`, `trip_financial_allocations`, `payments`, `cargo_offers`, `private_fleet_payroll_runs/items`.

### Lógica propuesta
Pre-check antes de retiro y nightly check. Marketplace only para saldo retirable.

### Pseudocódigo
```txt
if requested > available or available<0 or pending<0 => block/review.
```

### Riesgos
RIESGO ALTO: no tocar private external proof como saldo disponible.

### Pruebas QA
Retiro mayor a disponible rechaza; saldo no queda negativo si provider falla.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Separación marketplace vs privado

### Módulo
Wallet/liquidaciones

### Problema que resuelve
Flota privada documental no debe contaminar wallet marketplace.

### Impacto en revenue/retención
Evita errores financieros graves y mantiene compliance del producto.

### Datos necesarios
is_private_fleet, compensation_mode, allocation_type, wallet_touched, private_payment_status, money_rail.

### Datos existentes en el repo
Existe wallet/ledger operativo documentado; Sprint 20 implementó `payout_methods` y `payout_attempts`; Sprint 22 separa flota privada; `trip_financial_allocations` existe. Las reglas prohíben mezclar marketplace con privado.

### Datos faltantes
`financial_guardrail_events`, `ledger_reconciliation_runs`, campo canónico `money_rail` si no se aplica desde WALLET draft, vista unificada de balance before/after.

### Archivos relacionados
`frontend/src/app/api/wallet/withdraw/route.ts` (mencionado), `frontend/src/app/api/payments/webhook/route.ts` (mencionado), `frontend/src/lib/server/payments/freight-settlement.ts` (mencionado), `WALLET/**`, `SPTRINTS/20_*`, `SPTRINTS/22_*`.

### Tablas relacionadas
`transactions`, `wallets`/wallet operativo (tabla exacta no confirmada en lectura de migración), `payout_methods`, `payout_attempts`, `trip_financial_allocations`, `payments`, `cargo_offers`, `private_fleet_payroll_runs/items`.

### Lógica propuesta
Clasificador financiero obligatorio: marketplace_settlement, private_external_proof, private_wallet_legacy. Ningún payout automático si rail privado externo.

### Pseudocódigo
```txt
rail = offer.is_private_fleet ? private : marketplace; if private and external_proof => payout_eligible=false.
```

### Riesgos
RIESGO ALTO máximo: mezclar rails puede pagar dinero indebido.

### Pruebas QA
Viaje privado con comprobante externo no crea saldo; marketplace completado con POD sí queda elegible.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Alertas de transacciones sospechosas

### Módulo
Wallet/liquidaciones

### Problema que resuelve
Montos, retiros o comprobantes anómalos pueden pasar desapercibidos.

### Impacto en revenue/retención
Reduce fraude y errores operativos.

### Datos necesarios
amount, user, payout_method, provider, status, failed attempts, proof URL, historical p95.

### Datos existentes en el repo
Existe wallet/ledger operativo documentado; Sprint 20 implementó `payout_methods` y `payout_attempts`; Sprint 22 separa flota privada; `trip_financial_allocations` existe. Las reglas prohíben mezclar marketplace con privado.

### Datos faltantes
`financial_guardrail_events`, `ledger_reconciliation_runs`, campo canónico `money_rail` si no se aplica desde WALLET draft, vista unificada de balance before/after.

### Archivos relacionados
`frontend/src/app/api/wallet/withdraw/route.ts` (mencionado), `frontend/src/app/api/payments/webhook/route.ts` (mencionado), `frontend/src/lib/server/payments/freight-settlement.ts` (mencionado), `WALLET/**`, `SPTRINTS/20_*`, `SPTRINTS/22_*`.

### Tablas relacionadas
`transactions`, `wallets`/wallet operativo (tabla exacta no confirmada en lectura de migración), `payout_methods`, `payout_attempts`, `trip_financial_allocations`, `payments`, `cargo_offers`, `private_fleet_payroll_runs/items`.

### Lógica propuesta
Reglas: monto > p95, múltiples fallos, método nuevo + retiro alto, comprobante repetido, release manual fuera de patrón.

### Pseudocódigo
```txt
if amount>p95*2 or failed_attempts>=3 or new_method_high_amount => manual_review_alert.
```

### Riesgos
RIESGO ALTO: alertar no bloquear permanentemente sin revisión.

### Pruebas QA
Retiro alto a método nuevo pasa manual_review; retiro normal pasa.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
alta

---
## Control de estados de pago

### Módulo
Wallet/liquidaciones

### Problema que resuelve
Estados de pago/payout pueden quedar inconsistentes entre provider, ledger y UI.

### Impacto en revenue/retención
Reduce tickets y evita doble operación manual.

### Datos necesarios
payment status, payout_status, provider_reference, transaction metadata, webhook timestamps.

### Datos existentes en el repo
Existe wallet/ledger operativo documentado; Sprint 20 implementó `payout_methods` y `payout_attempts`; Sprint 22 separa flota privada; `trip_financial_allocations` existe. Las reglas prohíben mezclar marketplace con privado.

### Datos faltantes
`financial_guardrail_events`, `ledger_reconciliation_runs`, campo canónico `money_rail` si no se aplica desde WALLET draft, vista unificada de balance before/after.

### Archivos relacionados
`frontend/src/app/api/wallet/withdraw/route.ts` (mencionado), `frontend/src/app/api/payments/webhook/route.ts` (mencionado), `frontend/src/lib/server/payments/freight-settlement.ts` (mencionado), `WALLET/**`, `SPTRINTS/20_*`, `SPTRINTS/22_*`.

### Tablas relacionadas
`transactions`, `wallets`/wallet operativo (tabla exacta no confirmada en lectura de migración), `payout_methods`, `payout_attempts`, `trip_financial_allocations`, `payments`, `cargo_offers`, `private_fleet_payroll_runs/items`.

### Lógica propuesta
State machine financiera con transiciones válidas para payout_attempts y wallet_transactions.

### Pseudocódigo
```txt
allowed[requested]=queued/manual_review; allowed[processing]=paid/failed/manual_review; reject invalid.
```

### Riesgos
RIESGO ALTO: migrar con cuidado para no romper estados legacy.

### Pruebas QA
processing->paid válido; paid->processing inválido; provider failed no libera saldo dos veces.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
alta

---
## Score de riesgo financiero por operación

### Módulo
Wallet/liquidaciones

### Problema que resuelve
Algunas operaciones deberían requerir revisión antes de release/payout.

### Impacto en revenue/retención
Protege caja y permite escalar marketplace con control.

### Datos necesarios
operation risk, evidence quality, driver score, amount, payment status, dispute/incidents, rail.

### Datos existentes en el repo
Existe wallet/ledger operativo documentado; Sprint 20 implementó `payout_methods` y `payout_attempts`; Sprint 22 separa flota privada; `trip_financial_allocations` existe. Las reglas prohíben mezclar marketplace con privado.

### Datos faltantes
`financial_guardrail_events`, `ledger_reconciliation_runs`, campo canónico `money_rail` si no se aplica desde WALLET draft, vista unificada de balance before/after.

### Archivos relacionados
`frontend/src/app/api/wallet/withdraw/route.ts` (mencionado), `frontend/src/app/api/payments/webhook/route.ts` (mencionado), `frontend/src/lib/server/payments/freight-settlement.ts` (mencionado), `WALLET/**`, `SPTRINTS/20_*`, `SPTRINTS/22_*`.

### Tablas relacionadas
`transactions`, `wallets`/wallet operativo (tabla exacta no confirmada en lectura de migración), `payout_methods`, `payout_attempts`, `trip_financial_allocations`, `payments`, `cargo_offers`, `private_fleet_payroll_runs/items`.

### Lógica propuesta
Score read-only que decide si requiere revisión financiera antes de release. No aprueba pagos automáticamente.

### Pseudocódigo
```txt
risk = high_amount + low_evidence + low_driver_score + incident + rail_private; if risk>threshold => review_required.
```

### Riesgos
RIESGO ALTO: no usar para crédito/lending visible; no denegar pagos legítimos sin proceso.

### Pruebas QA
Monto alto + POD incompleto => review; POD completo + monto normal => low risk.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
alta

---
## Detección de facturación pendiente

### Módulo
Billing

### Problema que resuelve
Un plan o pago puede quedar pendiente después de checkout.

### Impacto en revenue/retención
Mejora conversión y soporte de pago.

### Datos necesarios
billing_plan_payment_attempts, business_plan_subscriptions, Mercado Pago reconcile, plan action_state, payment status.

### Datos existentes en el repo
Existe `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, paywall events, plan snapshot y recomendaciones de plan por uso.

### Datos faltantes
`billing_customer_health_scores`, `billing_usage_anomalies`, `plan_recommendation_events`, datos de factura real si se integra proveedor fiscal.

### Archivos relacionados
`frontend/src/app/planes/page.tsx`, `frontend/src/lib/billing/pricing.ts`, `frontend/src/lib/billing/plan-limits.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/app/api/billing/**`.

### Tablas relacionadas
`billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, `cargo_offers`, `warehouses`, `business_team_members`, `business_fleet_members`, `report_exports`.

### Lógica propuesta
Alertar owner/admin si pago aprobado no activó plan o si intento quedó pendiente demasiado tiempo.

### Pseudocódigo
```txt
if payment approved and subscription.plan_code != target after grace => billing_pending_alert.
```

### Riesgos
RIESGO ALTO: no activar plan sin webhook/reconcile válido.

### Pruebas QA
Simular pago exitoso pendiente; POST reconcile; validar alerta resuelta.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Validación de planes

### Módulo
Billing

### Problema que resuelve
Plan visible, límites y DB pueden divergir.

### Impacto en revenue/retención
Evita errores comerciales y pérdida de confianza.

### Datos necesarios
billing_plans, pricing.ts, planes/page, COMMERCIAL, usage limits.

### Datos existentes en el repo
Existe `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, paywall events, plan snapshot y recomendaciones de plan por uso.

### Datos faltantes
`billing_customer_health_scores`, `billing_usage_anomalies`, `plan_recommendation_events`, datos de factura real si se integra proveedor fiscal.

### Archivos relacionados
`frontend/src/app/planes/page.tsx`, `frontend/src/lib/billing/pricing.ts`, `frontend/src/lib/billing/plan-limits.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/app/api/billing/**`.

### Tablas relacionadas
`billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, `cargo_offers`, `warehouses`, `business_team_members`, `business_fleet_members`, `report_exports`.

### Lógica propuesta
Check automático que compara planes esperados vs DB y genera warning en admin, no cambia DB.

### Pseudocódigo
```txt
for plan in expected: compare price, max limits, is_public; diff => plan_config_alert.
```

### Riesgos
RIESGO ALTO si cambia precios automáticamente; solo auditar.

### Pruebas QA
Modificar precio DB en staging; check debe detectar diferencia.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
baja

---
## Control de uso por cliente

### Módulo
Billing

### Problema que resuelve
El paywall existe, pero debe detectar 70/90/100% y uso por recurso.

### Impacto en revenue/retención
Convierte uso real en upsell sin castigar al cliente.

### Datos necesarios
warehouses, team, monthly trips, private fleet drivers, plan limits, pilot days remaining.

### Datos existentes en el repo
Existe `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, paywall events, plan snapshot y recomendaciones de plan por uso.

### Datos faltantes
`billing_customer_health_scores`, `billing_usage_anomalies`, `plan_recommendation_events`, datos de factura real si se integra proveedor fiscal.

### Archivos relacionados
`frontend/src/app/planes/page.tsx`, `frontend/src/lib/billing/pricing.ts`, `frontend/src/lib/billing/plan-limits.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/app/api/billing/**`.

### Tablas relacionadas
`billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, `cargo_offers`, `warehouses`, `business_team_members`, `business_fleet_members`, `report_exports`.

### Lógica propuesta
Extender `getBusinessPlanSnapshot` con eventos de umbral y recomendaciones por plan.

### Pseudocódigo
```txt
ratio=usage/limit; if ratio>=0.7 and not notified => emit paywall_event.
```

### Riesgos
No bloquear datos existentes; solo nueva creación cuando límite real se supera.

### Pruebas QA
Free con 35/50 viajes dispara 70%; 45/50 90%; 50/50 bloqueo de nuevo viaje.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
baja

---
## Score de cliente en riesgo de churn

### Módulo
Billing

### Problema que resuelve
El cliente puede dejar de usar KargaX antes de pagar.

### Impacto en revenue/retención
Aumenta retención y prioriza gestión comercial.

### Datos necesarios
Días sin viajes, entregas con evidencia, usuarios activos, report exports, plan, pilot days, novedades.

### Datos existentes en el repo
Existe `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, paywall events, plan snapshot y recomendaciones de plan por uso.

### Datos faltantes
`billing_customer_health_scores`, `billing_usage_anomalies`, `plan_recommendation_events`, datos de factura real si se integra proveedor fiscal.

### Archivos relacionados
`frontend/src/app/planes/page.tsx`, `frontend/src/lib/billing/pricing.ts`, `frontend/src/lib/billing/plan-limits.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/app/api/billing/**`.

### Tablas relacionadas
`billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, `cargo_offers`, `warehouses`, `business_team_members`, `business_fleet_members`, `report_exports`.

### Lógica propuesta
Score por inactividad y falta de activación. Usar para acción comercial y notificación útil.

### Pseudocódigo
```txt
risk = days_no_trips*10 + no_evidence*30 + pilot_expiring*20 - report_exports*10;
```

### Riesgos
No enviar spam; no ocultar salida de datos.

### Pruebas QA
Cuenta 7 días sin viajes => high churn; cuenta con 3 entregas y reporte => low.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Detección de inconsistencias entre servicio usado y cobrado

### Módulo
Billing

### Problema que resuelve
Una empresa puede usar más recursos de los que su plan permite o pagar sin tener acceso correcto.

### Impacto en revenue/retención
Protege revenue y evita soporte.

### Datos necesarios
usage snapshot, plan limits, subscription status, payment attempts, pilot flags.

### Datos existentes en el repo
Existe `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, paywall events, plan snapshot y recomendaciones de plan por uso.

### Datos faltantes
`billing_customer_health_scores`, `billing_usage_anomalies`, `plan_recommendation_events`, datos de factura real si se integra proveedor fiscal.

### Archivos relacionados
`frontend/src/app/planes/page.tsx`, `frontend/src/lib/billing/pricing.ts`, `frontend/src/lib/billing/plan-limits.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/app/api/billing/**`.

### Tablas relacionadas
`billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, `cargo_offers`, `warehouses`, `business_team_members`, `business_fleet_members`, `report_exports`.

### Lógica propuesta
Nightly audit: uso vs límites y status. Genera alerta de billing; no borra recursos.

### Pseudocódigo
```txt
if paidPlanInactive and usage>free_limit => billing_inconsistency; if active_paid and limits free => entitlement_error.
```

### Riesgos
RIESGO ALTO: no suspender operación automáticamente en pilotos reales.

### Pruebas QA
Empresa con 10 conductores en Free sin pilot => alerta; pilot activo no alerta como incumplimiento.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Recomendación de upsell

### Módulo
Billing

### Problema que resuelve
El sistema debe sugerir Growth/Scale/Enterprise según uso real, no genérico.

### Impacto en revenue/retención
Aumenta ARPU y conversión B2B.

### Datos necesarios
Uso de viajes, bodegas, usuarios, flota, reportes, API/holding, plan actual, PQL.

### Datos existentes en el repo
Existe `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, paywall events, plan snapshot y recomendaciones de plan por uso.

### Datos faltantes
`billing_customer_health_scores`, `billing_usage_anomalies`, `plan_recommendation_events`, datos de factura real si se integra proveedor fiscal.

### Archivos relacionados
`frontend/src/app/planes/page.tsx`, `frontend/src/lib/billing/pricing.ts`, `frontend/src/lib/billing/plan-limits.ts`, `frontend/src/lib/server/warehouses.ts`, `frontend/src/app/api/billing/**`.

### Tablas relacionadas
`billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, `cargo_offers`, `warehouses`, `business_team_members`, `business_fleet_members`, `report_exports`.

### Lógica propuesta
Reusar `resolveRecommendedPlan` y enriquecer razones: “te conviene Scale por 8 bodegas + 40 conductores”.

### Pseudocódigo
```txt
recommended = first plan that fits; reasons = resources over 70%; display CTA.
```

### Riesgos
No mostrar upsell a rol sin billing; no cambiar plan sin checkout.

### Pruebas QA
Owner ve recomendación; dispatcher no ve billing; downgrade bloquea si uso supera límite.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
baja

---
## KPIs inteligentes

### Módulo
Reportes

### Problema que resuelve
Los dashboards deben priorizar métricas que explican salud operacional, no solo conteos.

### Impacto en revenue/retención
Aumenta valor percibido y facilita venta a gerencia.

### Datos necesarios
OTIF, evidence quality, SLA, incident rate, fill rate, wallet readiness, plan usage, churn risk.

### Datos existentes en el repo
Existe `/api/reports/business-monthly`, `report_exports`, `/dashboard/inteligencia`, CEO Control Tower en `/api/admin/overview`, holding summaries y `trucker_scores`.

### Datos faltantes
`executive_alerts`, `route_profitability_snapshots`, `customer_value_scores`, `role_efficiency_snapshots`.

### Archivos relacionados
`frontend/src/app/dashboard/inteligencia`, `frontend/src/app/api/reports/business-monthly`, `frontend/src/app/api/admin/overview`, `frontend/src/lib/business-roles.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`report_exports`, `cargo_offers`, `warehouse_dispatch_orders`, `warehouse_incidents`, `business_fleet_members`, `payout_attempts`, `transactions`, `billing_plan_payment_attempts`, `trucker_scores`.

### Lógica propuesta
Crear capa `executive_kpis` que calcula métricas por business/rol/periodo y muestra definición.

### Pseudocódigo
```txt
kpis = aggregate offers+dispatch+evidence+wallet; each KPI has value, trend, threshold, action.
```

### Riesgos
No mostrar dinero a roles operativos; cada KPI debe tener fuente.

### Pruebas QA
Owner ve dinero; dispatcher ve operaciones; auditor ve evidencia/exportes.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Alertas ejecutivas

### Módulo
Reportes

### Problema que resuelve
El owner necesita saber qué requiere atención hoy sin revisar 10 pantallas.

### Impacto en revenue/retención
Retiene decisores y acelera soporte comercial.

### Datos necesarios
Scores de last mile, evidencia, warehouse, wallet, billing, churn.

### Datos existentes en el repo
Existe `/api/reports/business-monthly`, `report_exports`, `/dashboard/inteligencia`, CEO Control Tower en `/api/admin/overview`, holding summaries y `trucker_scores`.

### Datos faltantes
`executive_alerts`, `route_profitability_snapshots`, `customer_value_scores`, `role_efficiency_snapshots`.

### Archivos relacionados
`frontend/src/app/dashboard/inteligencia`, `frontend/src/app/api/reports/business-monthly`, `frontend/src/app/api/admin/overview`, `frontend/src/lib/business-roles.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`report_exports`, `cargo_offers`, `warehouse_dispatch_orders`, `warehouse_incidents`, `business_fleet_members`, `payout_attempts`, `transactions`, `billing_plan_payment_attempts`, `trucker_scores`.

### Lógica propuesta
Unificar top alerts por severidad y próximo paso. Dedupe por business_id/source/type.

### Pseudocódigo
```txt
alerts = merge(module_alerts); sort severity, revenue_impact, sla; top 8; action_href.
```

### Riesgos
No mezclar empresas; no saturar con alertas repetidas.

### Pruebas QA
Crear alertas de módulos distintos; dashboard muestra top ordenado y deduplicado.

### Prioridad: P0 / P1 / P2
P0

### Complejidad: baja / media / alta
media

---
## Detección de pérdida operativa

### Módulo
Reportes

### Problema que resuelve
Demoras, rechazos, reprocesos y evidencia mala generan pérdida pero no siempre se cuantifican.

### Impacto en revenue/retención
Vende KargaX contra dinero/tiempo perdido, no solo orden.

### Datos necesarios
Incidents, rejects, delays, missing evidence, route inefficiency, failed delivery, support time if captured.

### Datos existentes en el repo
Existe `/api/reports/business-monthly`, `report_exports`, `/dashboard/inteligencia`, CEO Control Tower en `/api/admin/overview`, holding summaries y `trucker_scores`.

### Datos faltantes
`executive_alerts`, `route_profitability_snapshots`, `customer_value_scores`, `role_efficiency_snapshots`.

### Archivos relacionados
`frontend/src/app/dashboard/inteligencia`, `frontend/src/app/api/reports/business-monthly`, `frontend/src/app/api/admin/overview`, `frontend/src/lib/business-roles.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`report_exports`, `cargo_offers`, `warehouse_dispatch_orders`, `warehouse_incidents`, `business_fleet_members`, `payout_attempts`, `transactions`, `billing_plan_payment_attempts`, `trucker_scores`.

### Lógica propuesta
Estimar pérdida operativa por reglas configurables: retraso, reproceso, reclamo por falta de evidencia, pago retenido.

### Pseudocódigo
```txt
loss = delayed_count*cost_delay + rejected_qty*cost_reprocess + missing_evidence*claim_risk;
```

### Riesgos
No inventar cifras como verdad contable; marcar “estimado operativo”.

### Pruebas QA
Con costos configurados calcula estimado; sin costos muestra conteos y pide configuración.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Ranking de clientes por valor

### Módulo
Reportes

### Problema que resuelve
3PL/empresa no sabe qué clientes generan más volumen, problemas o valor.

### Impacto en revenue/retención
Permite retención/upsell por cuenta y foco comercial.

### Datos necesarios
client_id en dispatch/receipt si existe, destination contact, trips, reportes, incidencias, valor si rol financiero.

### Datos existentes en el repo
Existe `/api/reports/business-monthly`, `report_exports`, `/dashboard/inteligencia`, CEO Control Tower en `/api/admin/overview`, holding summaries y `trucker_scores`.

### Datos faltantes
`executive_alerts`, `route_profitability_snapshots`, `customer_value_scores`, `role_efficiency_snapshots`.

### Archivos relacionados
`frontend/src/app/dashboard/inteligencia`, `frontend/src/app/api/reports/business-monthly`, `frontend/src/app/api/admin/overview`, `frontend/src/lib/business-roles.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`report_exports`, `cargo_offers`, `warehouse_dispatch_orders`, `warehouse_incidents`, `business_fleet_members`, `payout_attempts`, `transactions`, `billing_plan_payment_attempts`, `trucker_scores`.

### Lógica propuesta
Agrupar por cliente/cuenta dentro de business. Si `client_id` no está completo, usar destino/contacto normalizado como fallback.

### Pseudocódigo
```txt
value = trips + completed_evidence + revenue_if_allowed - incident_penalty; rank.
```

### Riesgos
Privacidad y datos incompletos; no mezclar clientes de diferentes 3PL.

### Pruebas QA
Cliente con más viajes y baja incidencia rankea alto; finance ve COP, ops no.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
media

---
## Ranking de rutas por rentabilidad

### Módulo
Reportes

### Problema que resuelve
No se sabe qué rutas son más rentables o problemáticas.

### Impacto en revenue/retención
Soporta pricing, negociación y decisiones de flota/marketplace.

### Datos necesarios
Origen/destino, km, GMV, fee, trip_pay, company_expense, incidents, delays, evidence.

### Datos existentes en el repo
Existe `/api/reports/business-monthly`, `report_exports`, `/dashboard/inteligencia`, CEO Control Tower en `/api/admin/overview`, holding summaries y `trucker_scores`.

### Datos faltantes
`executive_alerts`, `route_profitability_snapshots`, `customer_value_scores`, `role_efficiency_snapshots`.

### Archivos relacionados
`frontend/src/app/dashboard/inteligencia`, `frontend/src/app/api/reports/business-monthly`, `frontend/src/app/api/admin/overview`, `frontend/src/lib/business-roles.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`report_exports`, `cargo_offers`, `warehouse_dispatch_orders`, `warehouse_incidents`, `business_fleet_members`, `payout_attempts`, `transactions`, `billing_plan_payment_attempts`, `trucker_scores`.

### Lógica propuesta
Calcular rentabilidad por corredor para roles financieros. Operaciones ve eficiencia sin COP.

### Pseudocódigo
```txt
route_key=origin_city+dest_city; margin = fee - cost_estimated; rank by margin and incident_rate.
```

### Riesgos
RIESGO ALTO por dinero; no mezclar marketplace/private y no mostrar a dispatcher.

### Pruebas QA
Owner/finance ve margen; dispatcher ve OTIF/incidentes; ruta privada externa no se mezcla con fee marketplace.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
alta

---
## Predicción básica de churn

### Módulo
Reportes

### Problema que resuelve
La empresa puede enfriarse antes de que ventas lo note.

### Impacto en revenue/retención
Aumenta retención y conversiones de Acceso Operativo.

### Datos necesarios
Uso semanal, días sin viajes, activación, reportes, usuarios, conductores, plan, paywall events.

### Datos existentes en el repo
Existe `/api/reports/business-monthly`, `report_exports`, `/dashboard/inteligencia`, CEO Control Tower en `/api/admin/overview`, holding summaries y `trucker_scores`.

### Datos faltantes
`executive_alerts`, `route_profitability_snapshots`, `customer_value_scores`, `role_efficiency_snapshots`.

### Archivos relacionados
`frontend/src/app/dashboard/inteligencia`, `frontend/src/app/api/reports/business-monthly`, `frontend/src/app/api/admin/overview`, `frontend/src/lib/business-roles.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`report_exports`, `cargo_offers`, `warehouse_dispatch_orders`, `warehouse_incidents`, `business_fleet_members`, `payout_attempts`, `transactions`, `billing_plan_payment_attempts`, `trucker_scores`.

### Lógica propuesta
Modelo simple con reglas de `COMMERCIAL`: 7 días sin viajes, no 3 entregas en 48h, no reporte, piloto por vencer.

### Pseudocódigo
```txt
risk = inactivity + no_activation + pilot_expiring + low_team_adoption - evidence_success;
```

### Riesgos
No usar prácticas oscuras; mensaje debe ayudar al cliente.

### Pruebas QA
Cuenta sin viajes 7 días high; cuenta activada con reporte low; notification_sequence útil.

### Prioridad: P0 / P1 / P2
P1

### Complejidad: baja / media / alta
media

---
## Reporte de eficiencia por rol

### Módulo
Reportes

### Problema que resuelve
Owner no sabe si operaciones, bodega, despacho y contabilidad usan KargaX correctamente.

### Impacto en revenue/retención
Mejora adopción interna y expansión de usuarios.

### Datos necesarios
business_team_members, roles, acciones creadas, dispatches, reports, evidence, tasks completed, exports.

### Datos existentes en el repo
Existe `/api/reports/business-monthly`, `report_exports`, `/dashboard/inteligencia`, CEO Control Tower en `/api/admin/overview`, holding summaries y `trucker_scores`.

### Datos faltantes
`executive_alerts`, `route_profitability_snapshots`, `customer_value_scores`, `role_efficiency_snapshots`.

### Archivos relacionados
`frontend/src/app/dashboard/inteligencia`, `frontend/src/app/api/reports/business-monthly`, `frontend/src/app/api/admin/overview`, `frontend/src/lib/business-roles.ts`, `frontend/src/lib/warehouses/types.ts`.

### Tablas relacionadas
`report_exports`, `cargo_offers`, `warehouse_dispatch_orders`, `warehouse_incidents`, `business_fleet_members`, `payout_attempts`, `transactions`, `billing_plan_payment_attempts`, `trucker_scores`.

### Lógica propuesta
Medir actividades por rol sin vigilancia invasiva: tareas cerradas, despachos, evidencias, reportes consultados/exportados.

### Pseudocódigo
```txt
for role: metrics = actions_by_type / assigned_scope; compare expected role outcomes; recommend enablement.
```

### Riesgos
Privacidad laboral; no mostrar datos personales a roles no autorizados.

### Pruebas QA
Warehouse_operator con tareas cerradas aparece eficiente; finance con reportes descargados; viewer sin acciones no penaliza.

### Prioridad: P0 / P1 / P2
P2

### Complejidad: baja / media / alta
media

---
