# 00 - Contexto KargaX

## Qué es KargaX

KargaX es un SaaS logístico B2B diseñado como sistema operativo de cierre logístico. La aplicación principal vive en `frontend/`; la historia oficial de base de datos vive en `supabase/migrations/`; el roadmap/auditoría vive en `SPTRINTS/`; y la estrategia comercial vive en `COMMERCIAL/`.

La tesis detectada en repo y documentación no es “tracking de camiones”. Es controlar el flujo completo: bodega, despacho, viaje, conductor, PIN/POD, foto/firma, novedad, soporte descargable, wallet/liquidación, billing y reportes.

## Qué problema resuelve

KargaX resuelve la pérdida de control operativo cuando una empresa debe demostrar qué pasó con una entrega. El dolor real aparece cuando hay pedido incompleto, referencia equivocada, rechazo, daño, faltante, cliente que dice no haber recibido, evidencia suelta por WhatsApp, soporte no localizable, pago/liquidación sin cierre o gerencia sin reporte confiable.

La plataforma convierte cada despacho en una entrega probada y auditable. Ese cierre es la base para vender, retener y expandir: cuando operaciones, bodega, conductor, cliente, finanzas y gerencia dependen del mismo soporte, volver a WhatsApp/Excel duele.

## Módulos detectados en el repo

| Módulo | Evidencia real detectada | Archivos/tablas principales |
|---|---|---|
| Auth / roles | Roles empresariales granulares y matriz de capacidades. | `frontend/src/lib/business-roles.ts`, `frontend/src/lib/server/warehouses.ts`, `business_team_members`, `warehouse_members` |
| Marketplace | Publicación de ofertas, asignación, rutas, comisiones y flujo `offer -> apply -> assign -> pay -> pickup -> delivery -> settlement`. | `frontend/src/app/api/offers/route.ts`, `cargo_offers`, `offer_photos`, `payments`, `transactions` |
| Flota privada | Conductores asociados a empresa, asignación directa, compensación por modo, gastos empresa, comprobantes externos. | `business_fleet_members`, `business_fleet_invitations`, `trip_financial_allocations`, `cargo_offers.is_private_fleet` |
| Last Mile / viajes | Viaje con origen/destino, ventanas de pickup/delivery, estados, tracking PWA, PIN/POD y evidencia. | `cargo_offers`, `trip_tracking_sessions`, `trip_location_pings`, `picking_events`, `trip_signature_evidences` |
| Bodegas / WMS | Bodegas, muelles, citas, inventario, recibos, picking, despachos, incidentes, dispatch-to-trip. | `warehouses`, `warehouse_docks`, `warehouse_appointments`, `warehouse_stock_balances`, `warehouse_dispatch_orders`, `warehouse_tasks`, `warehouse_incidents` |
| Evidencia digital | PIN/POD, foto, firma, tracking, timeline, manifest, rechazos preservados. | `trip_signature_evidences`, `offer_photos`, `picking_events`, `warehouse_dispatch_lines.metadata`, `WarehouseDigitalEvidenceRecord` |
| Wallet/liquidaciones | Ledger operativo, saldos, retiros, payout attempts, separaciones marketplace vs privado. | `transactions`, `payout_methods`, `payout_attempts`, `trip_financial_allocations`, `private_fleet_payroll_runs/items` |
| Billing / planes | Free/Growth/Scale/Enterprise, límites, checkout Mercado Pago, paywall, Acceso Operativo. | `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`, `/api/billing/**` |
| Reportes / inteligencia | Dashboard por rol, reportes mensuales, CEO control tower, report_exports, score camionero. | `/dashboard/inteligencia`, `/api/reports/business-monthly`, `/api/admin/overview`, `report_exports`, `trucker_scores` |
| Holding / enterprise | Control tower, multiempresa, finanzas, approvals, riesgo, marketplace/3PL. | tipos `Holding*` en `frontend/src/lib/warehouses/types.ts`, sprints 24/32 |

## Roles detectados

Roles de negocio detectados en `frontend/src/lib/business-roles.ts` y SPTRINTS:

- `owner` / propietario: gobierno total, planes, equipo, flota, bodegas, marketplace, reportes y finanzas.
- `admin` / platform admin: acceso global con controles de plataforma.
- `ops_manager` / jefe de operaciones: planea y supervisa rutas, tracking, evidencia, novedades y flota.
- `dispatcher` / despachador: ejecuta despachos, asignaciones, seguimiento GPS, PIN/POD y novedades.
- `warehouse_manager` / jefe de bodega: administra bodega, muelles, inventario, citas, picking, despachos e incidentes.
- `warehouse_operator` / operario de bodega: ejecuta recepción, picking, cargue, despacho, evidencia e incidentes físicos.
- `finance_accountant` / contabilidad: consulta reportes, comisiones, pagos privados, gastos, retiros y PDFs.
- `auditor`: lectura de operaciones, evidencias, trazabilidad y exportes.
- `viewer`: resumen operativo sin acciones sensibles.
- `trucker`: transportador externo marketplace o conductor asociado a flota privada.
- `private_fleet_driver`: conductor privado asignado a empresa.
- Holding roles: `holding_owner`, `finance_admin`, `ops_admin`, `analyst`, `admin`.

## Flujo operativo por rol

### Propietario / admin empresa

1. Crea empresa, bodega y equipo.
2. Configura plan, límites y roles.
3. Decide si opera marketplace, flota privada o ambos.
4. Supervisa dashboards, reportes, soporte de evidencia y finanzas.
5. Activa upgrade cuando el uso supera límites o necesita reportes/API/holding.

### Jefe de operaciones

1. Revisa demanda de entregas.
2. Crea/publica ofertas o asigna flota privada.
3. Monitorea estado, GPS, cumplimiento y novedades.
4. Reacciona a alertas SLA/evidencia incompleta.
5. Cierra operación con soporte y reporta a gerencia.

### Despachador

1. Toma despachos listos desde WMS o crea rutas.
2. Verifica responsable origen/destino, ventanas horarias y conductor.
3. Sigue tracking, PIN/POD, fotos y firma.
4. Atiende novedad crítica o reasigna si aplica.
5. Deja cada cierre listo para auditoría.

### Jefe / operario de bodega

1. Agenda citas y muelles.
2. Recibe inventario y genera stock trazable.
3. Ejecuta picking/packing.
4. Crea despacho y decide `dispatch_only`, `private_fleet_trip` o `marketplace_offer`.
5. Valida cargue, rechazos en origen y evidencia.

### Contabilidad

1. Revisa reporte mensual por empresa.
2. Separa marketplace vs privado.
3. Valida comisiones, gastos del viaje, pagos externos y retiros.
4. Descarga soporte/PDF cuando el rol lo permite.
5. Escala inconsistencias a owner/admin.

### Auditor

1. Consulta trazabilidad sin modificar.
2. Revisa evidencia, timeline, estados, firmas, fotos, rechazos y exportes.
3. Confirma que no hubo salto de estado, mezcla financiera ni acceso cross-company.

### Conductor marketplace

1. Postula o acepta viaje asignado.
2. Ejecuta pickup, tracking, PIN y evidencia.
3. Cierra POD.
4. Recibe liquidación neta marketplace si cumple reglas de settlement.
5. Solicita retiro desde saldo disponible.

### Conductor flota privada

1. Recibe ruta directa de empresa.
2. Confirma viaje.
3. Ejecuta salida, tracking, novedades y POD.
4. Su compensación depende de `compensation_mode`: salario externo, pago por viaje, gastos del viaje o ambos.
5. Sus gastos/pagos privados no deben mezclarse con wallet marketplace si son comprobante externo.

## Marketplace vs privado

Marketplace y flota privada comparten la capa operativa de viaje, tracking, evidencia y cierre, pero no deben compartir reglas financieras.

| Dimensión | Marketplace | Flota privada |
|---|---|---|
| Publicación | Oferta pública o activa para capacidad externa. | Asignación directa a conductor asociado a empresa. |
| Comisión | `MARKETPLACE_COMMISSION_PERCENT = 8`. | `PRIVATE_FLEET_COMMISSION_PERCENT = 0`. |
| Estado inicial | Puede ir a `active` o `draft`. | Si se publica directamente, queda `assigned`. |
| Wallet | Puede generar saldo neto retirable al transportador tras settlement. | Pagos/gastos pueden ser externos/documentales; no deben crear saldo marketplace por defecto. |
| Riesgo principal | Doble pago, oferta fraudulenta, transportador bajo desempeño. | Mezclar dinero privado con marketplace, permisos de montos, comprobantes falsos. |
| Dato separador | `cargo_offers.is_private_fleet = false`. | `cargo_offers.is_private_fleet = true`, `private_fleet_trucker_id`, `compensation_mode`. |

## Last Mile dentro de KargaX

Last Mile aparece como la capa que conecta despacho, ruta, conductor, destino, tracking, evidencia y cierre. En el repo hay bases fuertes:

- `cargo_offers` contiene origen/destino, fechas, ventanas, coordenadas, contactos, modo público/privado, estado y montos.
- `frontend/src/app/api/offers/route.ts` normaliza direcciones, geocodifica, valida coordenadas y crea oferta/ruta.
- `frontend/src/lib/server/trip-tracking.ts` maneja sesiones y pings con latitud, longitud, precisión, velocidad, heading, batería y timestamp.
- Sprint 30 cerró APIs `start`, `ping`, `stop`, `get` de tracking PWA y cola offline.
- `WarehouseDigitalEvidenceRecord` ya modela status, timestamps, manifest, fotos, firmas, tracking, financiero y rechazo.
- Sprint 23 conectó `warehouse_dispatch_orders` con viaje/offer por `dispatch_trip_mode`.

Hoy la capa es operable; falta convertirla en inteligencia: riesgo de entrega, SLA, ETA, alertas, próxima acción y score de evidencia.

## Evidencia digital/POD/PIN/foto/firma

La evidencia es el wedge comercial y operativo más importante. Detectado:

- `trip_signature_evidences` guarda firmas por `origin_dispatch` y `delivery_pod` con signer, documento, rol, storage path y URL.
- `offer_photos` almacena fotos asociadas a oferta.
- `picking_events` registra eventos operativos con fotos, ubicación y metadata.
- `WarehouseDigitalEvidenceRecord` agrupa timeline, manifest, firmas, fotos, tracking y rechazo.
- La landing y la estrategia comercial venden receptor, hora, PIN, foto/firma, novedad y soporte descargable.

Falta un motor inteligente que diga: “esta entrega no está lista para liquidar/soportar porque falta firma, la foto es repetida, el PIN está fuera de secuencia, el tracking no llegó al destino o el manifest no cuadra”.

## Wallet/liquidaciones

RIESGO ALTO.

La wallet debe tratarse como ledger operativo, no como depósito bancario comercializado. Las reglas detectadas son estrictas:

- Marketplace: empresa paga bruto, KargaX calcula comisión, conductor recibe neto, ledger registra bruto/comisión/neto.
- Flota privada: gastos del viaje y pagos privados son fondos de la empresa; pueden quedar como comprobante externo o liquidación documental, no saldo marketplace por defecto.
- Retiros: solo desde saldo disponible, con idempotency key, estado, proveedor y kill switch de payouts automáticos.
- No debe existir mutación de saldo sin ledger entry.
- `payout_attempts` y `payout_methods` existen según Sprint 20.
- `trip_financial_allocations` existe, pero hay convivencia de nombres legacy (`freight_payment`, `expense_advance`) y nombres canónicos nuevos (`trip_pay`, `company_expense`) mencionados en Sprint 22.

Cualquier algoritmo financiero debe ser guardrail/alerta/reconciliación, no automatización irreversible de dinero sin aprobación.

## Billing/reportes

Billing existe con planes, límites y checkout:

- `billing_plans`, `business_plan_subscriptions`, `business_pilot_flags`, `billing_plan_payment_attempts`.
- `getBusinessPlanSnapshot` calcula uso de bodegas, usuarios, viajes del mes, conductores privados, entitlement y plan recomendado.
- `PlanLimitError` y `recordPlanLimitEvent` ya soportan paywall/eventos.
- `business_pilot_flags` se muestra comercialmente como Acceso Operativo.

Reportes detectados:

- `/api/reports/business-monthly` genera reporte contable JSON.
- `report_exports` existe según Sprint 25.
- `/dashboard/inteligencia` separa Marketplace y Flota privada, oculta montos a roles operativos y habilita PDF solo a contabilidad/auditor/owner/admin.
- `/api/admin/overview` alimenta CEO Control Tower con usuarios, ofertas, WMS, GMV, fee, payouts, flota y riesgos.

Oportunidad: transformar reportes de “números pasados” a “alertas ejecutivas accionables”.

## Riesgos actuales

1. **RLS/multiempresa — RIESGO ALTO:** todo score debe filtrar por `business_id`, membership y rol. No puede existir ranking o reporte cross-company accidental.
2. **Wallet/liquidaciones — RIESGO ALTO:** no mezclar marketplace con privado. Un algoritmo no debe mover saldo ni pagar automáticamente sin ledger, estado, idempotencia y aprobación.
3. **Billing — RIESGO ALTO:** no cambiar planes, límites ni checkout de Mercado Pago automáticamente por “recomendación”. Solo sugerir, registrar y escalar.
4. **Estado de viaje:** SPTRINTS reconoce necesidad de reglas más fuertes de transición. Si la UI permite saltos de estado, cualquier score se vuelve poco confiable.
5. **Evidencia incompleta:** firmas/fotos/PIN/tracking pueden existir en superficies separadas. Sin score de calidad, soporte descargable puede verse confiable aunque no lo sea.
6. **Tracking PWA foreground:** no prometer tracking en background. El algoritmo debe tolerar gaps/offline y baja precisión.
7. **Datos legacy vs canónicos:** `trip_financial_allocations` tiene tipos legacy y sprints posteriores mencionan tipos nuevos. Hay que normalizar sin romper compatibilidad.
8. **QA insuficiente:** SPTRINTS reportó no haber tests detectados en `frontend/src` y deuda de lint histórica. Los algoritmos deben salir con tests unitarios mínimos y QA manual.
9. **Geocoding externo:** `api/offers` usa Google/Nominatim. Hay que cachear resultados y manejar fallos sin bloquear borradores.
10. **Privacidad de evidencia:** fotos, firmas y documentos no deben quedar expuestos a roles sin permiso.

## Oportunidades de algoritmos inteligentes

1. **Last Mile Control Tower:** priorizar entregas, detectar retrasos, riesgo de fallo, SLA breach y próxima mejor acción.
2. **Evidence Quality OS:** validar si un POD es completo, coherente, único, trazable y listo para soporte/liquidación.
3. **Smart Dispatch:** recomendar si un despacho debe ir por flota privada, marketplace o solo despacho, usando capacidad, zona, cumplimiento y urgencia.
4. **Driver Reliability:** usar `trucker_scores`, entregas a tiempo, evidencia y novedades para ranking de conductores.
5. **Marketplace Matching:** ordenar postulantes/cargas por zona, capacidad, historial, reputación, precio y riesgo.
6. **Warehouse Bottleneck Intelligence:** detectar congestión por muelle/cita/tarea/despacho y priorizar salida.
7. **Wallet Guardrails:** conciliación, duplicados, estados imposibles, private-vs-marketplace y alertas antes de release/payout.
8. **Billing Health & Churn:** detectar uso real, cuentas activadas, riesgo de churn y upsell recomendado sin tocar cobros automáticamente.
9. **Executive Alerts:** resumir para owner/admin qué entrega, ruta, bodega, conductor o cuenta necesita atención hoy.
10. **Retention Automation:** notificaciones útiles basadas en secuencias, no spam: primera carga, despacho listo, evidencia incompleta, plan por vencer, reporte listo.
