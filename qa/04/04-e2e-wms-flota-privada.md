# 04 - E2E WMS, Flota Privada, Nomina y Wallet

> Esta prueba revisa que una empresa pueda operar bodega, despacho, flota privada, nomina, wallet y reportes financieros sin usar Excel.

## E2E-07: Bodega completa hasta despacho

### Que vas a probar

- Crear bodega.
- Crear muelle.
- Recibir stock.
- Crear despacho solo WMS.
- Incidente.
- Stock no negativo.

### Necesitas

- Empresa owner.
- Usuario de bodega si quieres probar permisos.

### Preflight de roles de bodega

El flujo principal ya no usa invitaciones por correo. Los roles de bodega se crean desde `/equipo` con contrasena inicial definida por owner/admin.

### Pasos

1. Login como empresa owner.
2. Abre `/bodegas`.
3. Crea una bodega.
4. Entra a la bodega.
5. Crea un muelle.
6. Registra recepcion con SKU y cantidad.
7. Revisa inventario.
8. Crea despacho `Solo despacho`.
9. Revisa inventario despues.
10. Crea incidente de bodega.
11. Desde `/equipo`, crea un rol bodega con email + contrasena y asignale la bodega.
12. Login como rol bodega.
13. Confirma que puede operar bodega.
14. Login como rol sin permiso.
15. Confirma que no puede tocar bodega.

### Tiene que pasar esto

- [ ] Bodega se crea.
- [ ] Stock sube con recepcion.
- [ ] Despacho baja stock una sola vez.
- [ ] Stock nunca queda negativo.
- [ ] Incidente tiene actor, fecha y estado.
- [ ] Permisos de bodega funcionan.
- [ ] Rol bodega entra con email + contrasena, sin magic link.
- [ ] Sidebar muestra empresa y rol.

### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| warehouseId | |
| SKU | |
| Stock antes/despues | |
| Screenshot / evidencia | |

---

## E2E-08: Flota privada integral

Esta es la prueba unica de flota privada. Junta viajes privados, compensacion, nomina mensual, wallet y reportes para probar todo el negocio privado en una sola corrida.

### Flujo A: Con bodega - despacho crea viaje de flota privada

#### Que vas a probar

- Creacion directa de conductor privado.
- Login del conductor sin magic link.
- Despacho WMS crea viaje privado desde inventario.
- Stock baja una sola vez.
- Compensacion privada en los 4 modos:
  - `Nomina mensual` / `Contrato mensual`
  - `Pago por ruta`
  - `Solo viaticos` / `Solo gastos`
  - `Ruta + viaticos` / `Pago por ruta + gastos`
- Permisos financieros por rol.
- Registros correctos en `cargo_offers` y `trip_financial_allocations`.
- POD.
- Ledger.

#### Necesitas

- Empresa owner.
- Usuario `finance_accountant`.
- Usuario `dispatcher` u `ops_manager`.
- Conductor privado nuevo.
- Stock en bodega.
- Migraciones aplicadas hasta `048_private_fleet_payroll.sql`.

#### Preflight DB financiero

Ejecuta o revisa en Supabase SQL Editor:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'business_fleet_members'
  and column_name in (
    'default_compensation_mode',
    'monthly_salary_amount',
    'monthly_salary_currency',
    'payroll_day',
    'payroll_notes'
  );

select to_regclass('public.private_fleet_payroll_runs') as payroll_runs,
       to_regclass('public.private_fleet_payroll_items') as payroll_items;
```

#### Pasos

1. Login como empresa.
2. Abre `/dashboard/flota`.
3. Crea conductor privado con nombre, correo, telefono, pais, documento, licencia, placa y contrasena inicial.
4. Cierra sesion.
5. Login como conductor privado con email + contrasena.
6. Confirma que queda vinculado a la empresa y que no ve marketplace.
7. Vuelve a la bodega.
8. En inventario, confirma que hay stock disponible.
9. Abre `Despachos`.
10. En el bloque `Con bodega`, elige `Crear viaje flota privada`.
11. Selecciona conductor privado.
12. Prueba `Nomina mensual` / `Contrato mensual`:
    - No deben aparecer `Pago por ruta`, `Viaticos`, `Liberar viaticos` ni resumen monetario.
    - Crea despacho/viaje.
    - Confirma que el viaje se crea sin allocations de dinero y guarda `compensation_mode = salary_no_trip_pay`.

13. Repite con `Pago por ruta`:
    - Debe pedir monto de ruta.
    - No debe pedir viaticos.
    - Debe crear allocation `freight_payment`.

14. Repite con `Solo viaticos`:
    - Debe pedir viaticos y politica de liberacion.
    - No debe pedir pago por ruta.
    - Debe crear allocation `expense_advance`.

15. Repite con `Ruta + viaticos`:
    - Debe pedir monto de ruta y viaticos.
    - Debe crear allocations separadas.
16. Login como `dispatcher` u `ops_manager`.
17. Intenta cambiar salario, pago por ruta o viaticos al publicar/editar.
18. Confirma que puede operar/asignar, pero no cambiar dinero.
19. Login como `finance_accountant`.
20. Repite una publicacion privada con montos validos.
21. Login como conductor privado.
22. Abre `/viajes-asignados`.
23. Acepta un viaje pendiente.
24. Completa cargue, ruta y entrega/POD.
25. Revisa wallet y reporte.

#### Tiene que pasar esto

- [ ] No se genera ni se necesita invitacion.
- [ ] Conductor entra con email + contrasena, sin magic link.
- [ ] Conductor queda privado, no suelto como marketplace normal.
- [ ] Dispatch queda vinculado con offer/viaje.
- [ ] Stock baja una sola vez.
- [ ] `Nomina mensual` / `Contrato mensual` guarda `compensation_mode = salary_no_trip_pay`.
- [ ] `Nomina mensual` / `Contrato mensual` no muestra dinero ni crea allocations.
- [ ] `Pago por ruta` crea solo `freight_payment`.
- [ ] `Solo viaticos` crea solo `expense_advance`.
- [ ] `Ruta + viaticos` separa `freight_payment` y `expense_advance`.
- [ ] Los modos que requieren monto exigen valores mayores a 0.
- [ ] `dispatcher` y `ops_manager` pueden operar/asignar, pero no cambiar dinero.
- [ ] `owner`, `admin` y `finance_accountant` si pueden definir montos.
- [ ] Flota privada no cobra comision marketplace estandar.
- [ ] Viaticos no dicen credito ni adelanto KargaX.
- [ ] POD libera lo que corresponda segun modo.
- [ ] Conductor privado puede aceptar/rechazar viaje asignado.
- [ ] Conductor privado no ve `Buscar Ofertas`.

#### Validacion DB

```sql
select id,
       is_private_fleet,
       private_fleet_trucker_id,
       compensation_mode,
       freight_payment_amount,
       expense_allowance_amount,
       expenses_release_policy,
       private_payment_status,
       warehouse_flow_mode,
       warehouse_dispatch_order_id
from public.cargo_offers
where is_private_fleet = true
order by created_at desc
limit 10;

select offer_id,
       allocation_type,
       amount,
       status,
       release_trigger
from public.trip_financial_allocations
order by created_at desc
limit 20;
```

#### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| owner userId | |
| finance userId | |
| dispatcher/ops userId | |
| conductor creado por web | PASS / FAIL |
| dispatchId | |
| offerId | |
| offerIds 4 modos | |
| conductor privado | |
| modo compensacion probado | nomina / ruta / viaticos / ruta+viaticos |
| stock antes/despues | |
| allocation esperada | ninguna / freight_payment / expense_advance / ambas |
| Screenshot / evidencia | |

---

### Flujo B: Sin bodega - ruta privada directa

#### Que vas a probar

- Empresa crea viaje privado sin tocar inventario.
- El flujo exige manifiesto y 2 facturas por item.
- La ruta queda asignada a conductor privado.
- No se crea despacho WMS.
- Compensacion privada respeta el modo elegido sin repetir toda la matriz del Flujo A.

#### Necesitas

- Empresa owner.
- Conductor privado activo.
- Imagenes/facturas para manifiesto.

#### Pasos

1. Login como empresa.
2. Abre `/bodegas`.
3. Entra a una bodega y abre `Despachos`.
4. En el bloque superior, elige `Sin bodega`.
5. Confirma que abre `/ofertas/publicar?assignmentMode=private&warehouseFlowMode=manual`.
6. Completa carga/manifiesto:
    - Agrega al menos 1 item.
    - Sube imagenes del item si aplica.
    - Sube 2 facturas por item.
7. Completa origen, destino, contactos, recogida y entrega.
8. En asignacion, confirma que esta en `Flota propia`.
9. Selecciona conductor privado.
10. Prueba primero `Nomina mensual` / `Contrato mensual`:
    - No debe pedir pago por ruta ni viaticos.
    - Publica la ruta.
11. Repite la prueba con `Ruta + viaticos`.
12. Login como conductor privado.
13. Abre `/viajes-asignados`.
14. Acepta o rechaza la ruta.
15. Si acepta, abre el viaje y completa cargue/ruta/entrega.

#### Tiene que pasar esto

- [ ] No se crea `warehouse_dispatch_order`.
- [ ] `warehouse_flow_mode` queda `manual`.
- [ ] `is_private_fleet` queda `true`.
- [ ] `assigned_trucker_id` y `private_fleet_trucker_id` apuntan al conductor.
- [ ] Manifiesto conserva facturas.
- [ ] `Nomina mensual` / `Contrato mensual` no crea allocations.
- [ ] `Ruta + viaticos` crea flete y viaticos separados.
- [ ] Conductor privado ve la ruta en `Viajes asignados`, no en marketplace.

#### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| offerId | |
| conductor privado | |
| warehouse_flow_mode | manual |
| dispatch creado | NO |
| modo compensacion probado | nomina / ruta+viaticos |
| Screenshot / evidencia | |


---

### Flujo C: Nomina mensual privada hasta wallet

#### Que vas a probar

- Configuracion de salario mensual por conductor.
- Corrida mensual por empresa.
- Aprobacion financiera.
- Checkout/fondeo con Mercado Pago.
- Webhook aprobado.
- Liberacion a wallet del conductor.
- Transaccion inmutable `private_fleet_salary`.

#### Necesitas

- Empresa owner o admin.
- Usuario `finance_accountant`.
- Conductor privado activo del Flujo A.
- Mercado Pago sandbox o credenciales productivas de prueba.
- Migracion `048_private_fleet_payroll.sql` aplicada en la DB objetivo.

#### Pasos

1. Login como owner/admin.
2. Abre `/dashboard/flota`.
3. Edita el conductor privado.
4. Define:
   - compensacion default: `Contrato mensual`
   - salario mensual COP mayor a 0
   - dia de pago
   - nota operativa
5. Guarda cambios.
6. Crea `Nomina mensual`.
7. Verifica que la corrida quede en `draft`.
8. Login como `finance_accountant`.
9. Aprueba la corrida.
10. Genera checkout/fondeo.
11. Completa pago en Mercado Pago.
12. Espera webhook o simula confirmacion aprobada segun ambiente.
13. Login como conductor privado.
14. Abre `/billetera`.
15. Revisa que el salario aparezca separado de pagos por ruta, viaticos y retiros.

#### Tiene que pasar esto

- [ ] `business_fleet_members.monthly_salary_amount` queda guardado.
- [ ] `private_fleet_payroll_runs.status` avanza `draft -> approved -> checkout_pending -> released`.
- [ ] `private_fleet_payroll_items.status` avanza hasta `released_to_wallet`.
- [ ] Wallet sube `available_balance`, no `pending_balance`.
- [ ] Se crea una fila en `transactions` con `type = private_fleet_salary`.
- [ ] El webhook duplicado no paga dos veces el mismo item.
- [ ] Conductor ve `Salario mensual privado` separado de `Pago por ruta`, `Gastos del viaje` y `Retiros`.

#### Validacion DB

```sql
select id,
       business_id,
       period_start,
       period_end,
       status,
       gross_amount,
       processing_fee_amount,
       total_amount,
       mp_preference_id,
       funded_payment_id,
       released_at
from public.private_fleet_payroll_runs
order by created_at desc
limit 5;

select id,
       run_id,
       trucker_id,
       amount,
       status,
       wallet_transaction_id,
       released_at
from public.private_fleet_payroll_items
order by created_at desc
limit 20;

select id,
       wallet_id,
       type,
       status,
       amount,
       reference_id,
       metadata,
       created_at
from public.transactions
where type = 'private_fleet_salary'
order by created_at desc
limit 20;
```

#### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| payrollRunId | |
| payrollItemIds | |
| mpPaymentId | |
| walletId | |
| transactionId | |
| Saldo antes/despues | |
| Screenshot / evidencia | |

---

### Flujo D: Reportes separan dinero privado y marketplace

#### Que vas a probar

- `/dashboard/inteligencia`.
- `/api/reports/business-monthly`.
- Separacion contable de:
  - GMV marketplace
  - pagos privados por ruta
  - nomina privada
  - gastos de empresa
  - fees KargaX
  - payouts pendientes/fallidos

#### Pasos

1. Ejecuta al menos una oferta marketplace pagada o usa una evidencia vigente de `03-e2e-marketplace-dinero.md`.
2. Usa una oferta privada `Pago por ruta` del Flujo A.
3. Usa una oferta privada `Solo viaticos` del Flujo A.
4. Usa la nomina mensual privada liberada del Flujo C.
5. Abre `/dashboard/inteligencia`.
6. Filtra el mes actual.
7. Compara los totales de UI contra DB.
8. Login como rol sin finanzas.
9. Confirma que montos financieros sensibles aparecen ocultos o en 0.

#### Tiene que pasar esto

- [ ] Marketplace GMV no suma salario privado.
- [ ] Nomina privada no suma como flete de viaje.
- [ ] Gastos de empresa no suman como ingreso del conductor por ruta.
- [ ] Fees KargaX aparecen separados.
- [ ] Payouts pendientes/fallidos se reportan separados.
- [ ] Roles sin finanzas no ven montos sensibles.

#### Validacion DB

```sql
select is_private_fleet,
       count(*) as trips,
       sum(coalesce(total_amount, 0)) as total_amount
from public.cargo_offers
where created_at >= date_trunc('month', now())
group by is_private_fleet;

select allocation_type,
       status,
       sum(amount) as amount
from public.trip_financial_allocations
where created_at >= date_trunc('month', now())
group by allocation_type, status
order by allocation_type, status;

select status,
       sum(amount) as payroll_amount
from public.private_fleet_payroll_items
where created_at >= date_trunc('month', now())
group by status;

select status,
       sum(amount_cop) as payout_amount
from public.payout_attempts
where created_at >= date_trunc('month', now())
group by status;
```

#### Resultado

| Campo | Valor |
|---|---|
| Estado | PASS / FAIL / BLOCKED |
| Fecha y hora | |
| marketplace GMV UI/DB | |
| private route pay UI/DB | |
| payroll UI/DB | |
| expenses UI/DB | |
| payouts UI/DB | |
| Screenshot / evidencia | |

---

### Negativos bloqueantes de flota privada financiera

Marca `FAIL` y no avances a piloto si ocurre cualquiera:

- [ ] Se puede crear nomina sin migracion `048`.
- [ ] Un rol operativo cambia salario, flete privado o viaticos.
- [ ] Un webhook duplicado acredita dos veces el mismo salario.
- [ ] Wallet mezcla salario mensual con gasto de viaje.
- [ ] Reporte mensual suma nomina privada dentro de GMV marketplace.
- [ ] Una empresa ve conductores, nominas o reportes de otra empresa.
- [ ] Vercel deploy queda apuntando a una DB sin columnas requeridas y rompe `/dashboard/flota`.


## Observaciones pendientes de UI

Estas notas vienen de capturas de pruebas anteriores. No son pruebas E2E nuevas ni duplican E2E-07/E2E-08.

1. Revisar `image copy.png`: las cards de conductores activos y viajes activos quedan muy pegadas.
2. Revisar si la recepcion de stock debe exigir imagen o si la evidencia solo aplica a incidentes.
3. Revisar evidencia de incidente critico: debe exigir al menos una URL/soporte antes de reportar.
4. Revisar `image-1.png`: el tercer bloque se corta y debe verse completo en todas las resoluciones.
5. Revisar `image-2.png`: las cards pequenas de flota privada se desbordan; deben quedar responsivas.
6. Revisar `04/11.png`, `04/13.png`, `04/14.png` y `04/15.png`: fallas visuales o de campos en los modos de compensacion privada del despacho con bodega.
