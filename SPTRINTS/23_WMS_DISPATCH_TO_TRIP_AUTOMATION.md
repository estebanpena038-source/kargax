# CERRADO - SPRINT 23

# 23 - WMS Dispatch To Trip Automation

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- depende de: `08_WAREHOUSE_OS.md`, `16_PRIVATE_FLEET_B2B.md`, `22`
- owner: Head of Ops + CTO

## Implementacion cerrada 2026-05-19

- `warehouse_dispatch_orders` soporta `dispatch_trip_mode`, `trip_creation_status`, `trip_creation_error`, `trip_created_at` y `metadata`.
- `/api/warehouses/[id]/dispatches` acepta `dispatchTripMode` con valores canonicos:
  - `dispatch_only`
  - `private_fleet_trip`
  - `marketplace_offer`
- El API valida que `private_fleet_trip` tenga conductor privado u oferta preexistente.
- El despacho guarda metadata del wizard y deja `trip_creation_status` en `created`, `not_requested` o `manual_review`.
- Lineas de despacho guardan metadata de manifiesto: solicitado, cargado, rechazado, bodega origen y estado.
- Si hay `rejectedQty > 0`, la linea queda marcada como `rechazado_en_origen` para no reaparecer como cargada normal.
- Stock sigue descontandose solo por `dispatchedQty/pickedQty/requestedQty` usado como despachado.
- Typecheck frontend ejecutado y limpio.

## Proposito

Conectar despacho de bodega con viaje/oferta para que KargaX sea el sistema operativo real. El usuario no debe duplicar informacion: si ya despacho stock, puede convertir ese despacho en viaje con manifiesto, PIN y conductor.

## Problema actual

En `/bodegas/[id]/despachos` ya existe despacho con lineas y stock. El usuario quiere que desde ahi se pueda crear la oferta automaticamente. La automatizacion debe ser segura: no debe publicar marketplace ni asignar conductor por error.

## `dispatch_trip_mode`

- `dispatch_only`
- `private_fleet_trip`
- `marketplace_offer`

## Flujo UX objetivo

### Paso 1 - Crear despacho

- Seleccionar SKU con stock.
- Definir solicitado, despachado y rechazado.
- Programar fecha.
- Agregar notas.

### Paso 2 - Que quieres hacer con este despacho

Opciones:

- Solo registrar despacho.
- Crear viaje para flota privada.
- Publicar carga al marketplace.

### Paso 3A - Solo despacho

- Descuenta stock.
- Crea `warehouse_dispatch_order`.
- No crea `cargo_offers`.

### Paso 3B - Crear viaje flota privada

- Seleccionar conductor privado.
- Seleccionar `compensation_mode`.
- Definir origen/destino, contacto, ventana, PIN.
- Crear `cargo_offers` con `is_private_fleet=true`.
- Vincular `warehouse_dispatch_orders.offer_id`.
- Crear manifiesto desde lineas despachadas.

### Paso 3C - Publicar marketplace

- Crear oferta publica en draft o active segun confirmacion final.
- Reutilizar manifiesto desde lineas.
- Requiere precio, origen/destino, tipo de vehiculo y condiciones.
- No asigna conductor privado.

## Reglas de stock

- `dispatched_qty` descuenta stock.
- `rejected_qty` no debe descontar como despachado si nunca salio.
- Si hay rechazo por calidad o falta, debe quedar en metadata y evidencia.
- Nunca permitir stock negativo.

## Reglas de manifiesto

Cada linea del despacho genera item:

- `id`
- `skuCode`
- `name`
- `requestedQty`
- `loadedQty`
- `rejectedQty`
- `sourceDispatchLineId`
- `loadStatus`
- `originWarehouseId`

Si `rejectedQty > 0`, el item debe marcar cantidad rechazada en origen para que entrega no lo trate como cargado.

## Cambios tecnicos

- `frontend/src/app/bodegas/[id]/despachos/page.tsx`
  - reemplazar input manual `offerId` por wizard.
  - permitir crear oferta desde despacho.
  - mostrar resumen antes de confirmar.

- `frontend/src/app/api/warehouses/[id]/dispatches/route.ts`
  - aceptar `dispatchTripMode`.
  - si modo crea viaje, ejecutar operacion transaccional.
  - evitar crear dispatch si falla creacion de offer o dejar rollback logico.

- `frontend/src/app/api/offers/route.ts`
  - exponer helper server-side reusable o mover creacion a servicio.
  - evitar duplicar reglas de validacion.

- Supabase
  - asegurar indices entre dispatch, offer y warehouse.
  - agregar `source_dispatch_id` si hace falta.

## Permisos

- `warehouse_operator`: puede crear `dispatch_only`.
- `ops_manager`: puede crear `private_fleet_trip` y `marketplace_offer`.
- `finance_accountant`: puede completar datos de pago flota.
- `business_owner`: todo.

## QA

- Despacho solo: stock baja y no se crea offer.
- Despacho flota privada: stock baja, offer assigned, conductor recibe ruta.
- Despacho marketplace: stock baja, offer active/draft segun decision.
- Rechazados: no reaparecen como cargados.
- Error al crear offer no deja stock inconsistente.
- Usuario sin permiso no puede publicar desde bodega.

## Definition of Done

- Un operador puede convertir stock en viaje sin reescribir manifiesto.
- La automatizacion siempre pide confirmacion.
- `offer_id` queda vinculado a despacho.
- PIN/POD y manifiesto funcionan desde el viaje creado.
- No hay doble descuento de inventario.
