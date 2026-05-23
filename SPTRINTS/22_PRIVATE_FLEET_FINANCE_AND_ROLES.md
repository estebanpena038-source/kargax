# CERRADO - SPRINT 22

# 22 - Private Fleet Finance And Roles

## Estado

- artifact status: `completed`
- cerrado el: `2026-05-19`
- depende de: `16_PRIVATE_FLEET_B2B.md`, `20`, `21`
- owner: Product Lead + CTO + Finance Lead

## Implementacion cerrada 2026-05-19

- Se agrego `supabase/migrations/043_private_fleet_dispatch_control_tower.sql`.
- `cargo_offers` soporta `compensation_mode`, `expenses_release_policy`, `private_payment_status`, `private_fleet_notes`, `source_dispatch_id` y `dispatch_trip_mode`.
- `/api/offers` valida los 4 modos:
  - `salary_no_trip_pay`
  - `trip_pay`
  - `expenses_only`
  - `trip_pay_plus_expenses`
- `/api/offers` evita pago por viaje cuando el modo no lo permite.
- Allocaciones privadas usan tipos canonicos nuevos: `trip_pay` y `company_expense`.
- `company_expense` mantiene copy de gastos del viaje y no se vende como credito.
- Wallet reconoce allocaciones legacy y canonicas: `freight_payment`/`trip_pay`, `expense_advance`/`company_expense`.
- Typecheck frontend ejecutado y limpio.

## Proposito

Completar flota privada para que una empresa pueda operar su propia red de conductores dentro de KargaX sin forzar un unico modelo de pago. Esta es una pieza central para que KargaX se vuelva uso diario, no solo marketplace.

## Roles empresa

| Rol | Responsabilidad | Permisos |
|---|---|---|
| `business_owner` | gobierno total | planes, equipo, flota, pagos, bodegas |
| `finance_accountant` | dinero y contabilidad | pagos, reportes, wallet empresa, payouts, conciliacion |
| `ops_manager` | operacion de rutas | crear/asignar viajes, ver flota, resolver novedades |
| `warehouse_operator` | cargue/descargue | despachos, PIN salida, evidencia WMS |
| `auditor` | control | lectura, evidencias, reportes, logs |

## Roles conductor

- `private_fleet_driver`: conductor asociado a empresa.
- Puede tener cuenta KargaX normal.
- Puede recibir rutas directas.
- Puede ver wallet solo si su compensacion genera saldo.
- Puede actualizar placa/datos si la empresa lo permite.

## `compensation_mode`

### `salary_no_trip_pay`

Uso:

- Conductor asalariado.
- La empresa le paga quincenal o mensual por fuera de cada viaje.

Comportamiento:

- No crear pago por viaje al conductor.
- No prometer saldo al conductor.
- Si hay gastos del viaje, se pueden liberar como viaticos empresa.
- Reporte muestra costo operativo `0` por pago de viaje dentro de KargaX y nota de salario externo.

### `trip_pay`

Uso:

- Conductor privado o tercero de confianza cobra por viaje.

Comportamiento:

- Empresa define valor del viaje.
- Pago queda pendiente/custodia hasta POD o regla configurada.
- Conductor ve valor por viaje.
- Ledger crea movimiento de pago privado.

### `expenses_only`

Uso:

- Empresa solo entrega gastos de ruta.

Comportamiento:

- No hay pago por viaje.
- Se liberan gastos del viaje al aceptar o al iniciar ruta segun politica.
- Copy: "gastos del viaje", no "adelanto".

### `trip_pay_plus_expenses`

Uso:

- Empresa paga por viaje y tambien entrega gastos.

Comportamiento:

- Gastos disponibles segun regla.
- Pago por viaje pendiente hasta POD.
- Reporte separa gasto vs remuneracion.

## Campos objetivo

En `cargo_offers` o tabla relacionada:

- `is_private_fleet`
- `private_fleet_trucker_id`
- `compensation_mode`
- `freight_payment_amount`
- `expense_allowance_amount`
- `expenses_release_policy`
- `private_payment_status`
- `private_fleet_notes`

En `trip_financial_allocations`:

- `allocation_type`: `trip_pay`, `company_expense`
- `status`: `held`, `released`, `refunded`, `cancelled`
- `release_trigger`: `acceptance`, `pickup_pin`, `delivery_pod`, `manual`

## UI publicar oferta

- Toggle: publica marketplace / flota privada.
- Si flota privada:
  - seleccionar conductor.
  - seleccionar `compensation_mode`.
  - mostrar campos segun modo.
  - explicar que gastos del viaje son fondos de la empresa.
  - validar que no se ingrese pago si el modo no lo permite.

## UI flota

- Lista conductores.
- Estado: activo, suspendido, removido.
- Placa, identificador interno, viajes activos.
- Gasto entregado este mes.
- Pago por viaje liberado este mes.
- Ultima actividad.
- Boton invitar conductor.

## UI conductor

- Ruta directa asignada por empresa.
- Ver modo de compensacion en lenguaje simple:
  - "Ruta operativa sin pago por viaje en KargaX"
  - "Pago por viaje"
  - "Gastos del viaje"
  - "Pago por viaje + gastos"
- Checklists de salida, transito y POD.

## Seguridad y permisos

- Solo owner/ops puede asignar rutas.
- Solo owner/finance puede configurar pagos.
- Warehouse operator puede validar salida, pero no cambiar montos.
- Auditor solo lectura.
- Conductor solo ve sus rutas y sus saldos.

## QA

- Crear conductor privado.
- Probar los 4 modos.
- Confirmar que wallet cambia solo cuando corresponde.
- Confirmar que finance puede ver reportes.
- Confirmar que operator no cambia dinero.
- Confirmar que conductor asalariado no ve pago inexistente.

## Definition of Done

- Flota privada cubre empresas con conductores asalariados, contratistas por viaje y gastos de ruta.
- No se usa lenguaje de adelantos.
- Cada movimiento financiero tiene source, offer, conductor, empresa y status.
- El contador de la empresa puede entender que se pago y por que.
