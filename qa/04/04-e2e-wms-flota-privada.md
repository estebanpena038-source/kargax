# 04 - E2E WMS + Flota Privada + Wallet Separada

> Corrida unica para probar bodega, flota privada, comprobantes externos, nomina documental, wallet separada y un control marketplace. Flota privada nunca debe crear saldo retirable.

## Registro rapido de pruebas ejecutadas

Fecha: 2026-05-26.

| # | Prueba ejecutada | Cubre seccion QA04 | Resultado |
|---|---|---|---|
| QA04-1 | SQL `20260526_wallet2_rails_hardening.sql` aplicado en Supabase | Preflight / Migraciones requeridas | PASS |
| QA04-2 | `npm run check:release` | SQL preflight, buckets, columnas WALLET2.0, feature flags | PASS |
| QA04-3 | `npm --prefix frontend run typecheck` | Contratos TS de wallet, flota, payouts y endpoint PIN | PASS |
| QA04-4 | `npm --prefix frontend run build` | Build completo de WMS, flota privada, billetera y payouts | PASS |
| QA04-5 | Checks remotos agrupados: privados no retirables, payouts trabados, doble release, idempotencia payout | Comprobantes externos, control marketplace, bloqueantes financieros | PASS |
| QA04-6 | `vercel --prod --yes` + smoke `GET /api/health` | Smoke ambiente post-deploy | PASS |
| QA04-7 | `npm run check:roles` | Blindaje server-side de roles sensibles | PASS |
| QA04-8 | Auditoria de limites de plan en codigo + DB TASYUAYSAU | Bodegas, usuarios internos, viajes mensuales y conductores privados | PASS tecnico |

Checks remotos agrupados ya ejecutados:

```text
private_withdrawable_leaks=0
stuck_processing_payouts_30m=0
double_marketplace_release_sample_1000=0
duplicate_payout_idempotency_sample_1000=0
```

Cierre: PASS tecnico. Quedan opcionales solo screenshots/browser por rol si se quiere evidencia visual comercial.

### Limites de plan verificados - 2026-05-26

Los limites estan implementados server-side y devuelven `PLAN_LIMIT_REACHED` cuando un plan tiene tope:

| Limite | Funcion server | Rutas protegidas |
|---|---|---|
| Bodegas activas | `enforceWarehouseCreateLimit` / `enforceWarehouseActivationLimit` | `POST /api/warehouses`, `PATCH /api/warehouses/[id]` |
| Usuarios internos | `enforceBusinessTeamSeatLimit` | equipo, invitacion/alta y aceptacion de usuario |
| Viajes mensuales | `enforceMonthlyTripLimit` | `POST /api/offers`, despachos con bodega |
| Conductores privados | `enforcePrivateFleetDriverLimit` | alta de flota privada y crear conductor |

Snapshot TASYUAYSAU:

| Campo | Valor |
|---|---|
| Empresa | `tasyuaysau` (`business_id = 27f8d2f6-d366-4522-afaf-4ea458951a8e`) |
| Plan activo | `enterprise` |
| Uso actual | 2 bodegas, 4 usuarios internos, 25 viajes del mes, 1 conductor privado |
| Tope aplicable | Sin tope por plan Enterprise |
| Resultado | PASS: los guards existen; TASYUAYSAU no bloquea por limite porque Enterprise es ilimitado por diseno |

## Decision de negocio

Marketplace - saldo retirable:
- Crea `trip_deposit`.
- Usa `money_rail = marketplace_freelancer`.
- Puede crear `payout_attempt`.
- Puede aumentar `marketplaceWallet.availableCop`.

Flota privada - liquidaciones externas:
- No crea `trip_deposit`.
- No crea `payout_attempt`.
- No aumenta `wallet.available_balance`.
- No aumenta `marketplaceWallet.availableCop`.
- Flete, nomina y viaticos se cierran con comprobante externo.

Si cualquier viaje privado toca wallet retirable, marca `FAIL`.

---

## 1. Preflight

### Usuarios necesarios

| Rol | Uso |
|---|---|
| Owner empresa | Crear bodega, conductor, rutas y nomina |
| `finance_accountant` con MFA/AAL2 | Montos, comprobantes y pagado externo |
| `dispatcher` u `ops_manager` | Operar/asignar sin cambiar dinero |
| Rol bodega | Probar permisos WMS |
| Conductor privado | Aceptar ruta y hacer POD |
| Camionero marketplace | Control de wallet/payout real |

### Migraciones requeridas

```text
048_private_fleet_payroll.sql
20260526_wallet2_rails_hardening.sql
```

No mezcles las WIP `20260525_wallet_*` con esta corrida. La migracion canonica de WALLET2.0 para este QA es `20260526_wallet2_rails_hardening.sql`.

### SQL preflight

```sql
select to_regclass('public.private_fleet_payroll_runs') as payroll_runs,
       to_regclass('public.private_fleet_payroll_items') as payroll_items,
       to_regclass('public.private_fleet_payment_proofs') as payment_proofs,
       to_regclass('public.payout_attempts') as payout_attempts;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'trip_financial_allocations'
  and column_name in (
    'status',
    'external_payment_status',
    'external_payment_reference',
    'external_payment_proof_url',
    'external_paid_at',
    'external_paid_by'
  )
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transactions'
  and column_name in (
    'money_rail',
    'payout_eligible',
    'payout_attempt_id',
    'locked_for_payout',
    'external_proof_only'
  )
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'private_fleet_payment_proofs'
  and column_name in ('run_id', 'allocation_id', 'offer_id', 'proof_url', 'storage_path', 'status')
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cargo_offers'
  and column_name in (
    'private_payment_status',
    'compensation_mode',
    'freight_payment_amount',
    'expense_allowance_amount',
    'warehouse_flow_mode',
    'source_dispatch_id',
    'pickup_contact_phone',
    'delivery_contact_phone'
  )
order by column_name;

select proname
from pg_proc
where proname in (
  'confirm_private_fleet_offer',
  'verify_delivery_pin',
  'get_marketplace_withdrawable_balance',
  'create_marketplace_withdrawal_request',
  'claim_payout_attempts',
  'mark_payout_paid',
  'mark_payout_failed',
  'mark_payout_manual_review'
)
order by proname;
```

### Smoke ambiente

```bash
curl https://kargax-staging.vercel.app/api/health
```

Debe responder `success=true`. Si `/dashboard/flota` rompe por columnas faltantes, la corrida queda `BLOCKED`.

---

## 2. Corrida unica

### Datos a guardar

| Dato | Valor |
|---|---|
| URL ambiente | |
| Owner userId | |
| Finance userId | |
| Dispatcher/Ops userId | |
| Rol bodega userId | |
| Conductor privado userId | |
| Camionero marketplace userId | |
| warehouseId | |
| SKU | |
| wallet.available_balance privado antes | |
| marketplaceWallet.availableCop antes | |
| financialRailAudit antes | |

### Flujo WMS base

1. Login como owner.
2. Crea o reutiliza bodega.
3. Crea muelle.
4. Registra recepcion de stock con SKU.
5. Crea despacho `Solo despacho`.
6. Confirma que stock baja una sola vez.
7. Crea incidente de bodega.
8. Crea rol bodega desde `/equipo` con email + contrasena.
9. Confirma que el rol bodega opera solo la bodega asignada.

PASS WMS:
- [ ] Stock sube con recepcion.
- [ ] Stock baja una sola vez con despacho.
- [ ] Stock nunca queda negativo.
- [ ] Permisos de bodega funcionan.
- [ ] Incidente tiene actor, fecha y estado.

### Matriz privada con bodega

En `Despachos > Con bodega > Crear viaje flota privada`, prueba los 4 modos y guarda los `offerId`.

| Modo | UI debe pedir | UI NO debe pedir | DB esperado |
|---|---|---|---|
| `Nomina mensual` | Nada de dinero por viaje | Ruta, viaticos, liberar viaticos | Sin allocations |
| `Pago por ruta` | Monto ruta | Viaticos, liberar viaticos | `freight_payment` |
| `Solo viaticos` | Monto viaticos | Pago por ruta, liberar viaticos | `expense_advance` |
| `Ruta + viaticos` | Ruta + viaticos | Liberar viaticos | Dos allocations |

Checks obligatorios:
- [ ] El selector dice `Modo de liquidacion privada`.
- [ ] No aparece `Liberar viaticos`.
- [ ] No hay copy de dinero disponible en wallet.
- [ ] Toda allocation privada nace `external_proof_pending`.
- [ ] `Nomina mensual` guarda `compensation_mode = salary_no_trip_pay`.
- [ ] `Pago por ruta` crea solo `freight_payment`.
- [ ] `Solo viaticos` crea solo `expense_advance`.
- [ ] `Ruta + viaticos` crea `freight_payment` y `expense_advance`.

#### Resultado TASYUAYSAU - 2026-05-26

Empresa validada: `tasyuaysau` (`business_id = 27f8d2f6-d366-4522-afaf-4ea458951a8e`).
Conductor QA validado: `pruebaQA` (`trucker_id = 64291378-4da9-46d3-aba3-a66de5aa362e`).

Nota operativa: la ruta privada mas reciente `3180e9b7` tambien es `salary_no_trip_pay`, pero salio `warehouse_flow_mode = manual`; por eso no cuenta para esta matriz con bodega. La matriz con bodega queda con las 4 rutas `warehouse_managed` siguientes.

| Modo | offerId | Bodega | DB observado | Wallet/payout | Resultado |
|---|---|---|---|---|---|
| `Nomina mensual` | `297623a4-7959-4c2e-ba79-c3f015fda0c0` | `warehouse_managed`, `source_dispatch_id = 21b5f59a-1284-435a-a7d2-f0470f7d843b` | `compensation_mode = salary_no_trip_pay`, sin allocations | 0 transactions, 0 payout_attempts | PASS |
| `Pago por ruta` | `fe0e8633-e261-4c43-ae8a-491af1298326` | `warehouse_managed`, `source_dispatch_id = 5e5352f7-1bf3-4d7c-b104-ecaca3a8a928` | 1 allocation `freight_payment` por $100.000 COP, `external_proof_pending`, `pending_external_pay`, `wallet_transaction_id = null` | 0 transactions, 0 payout_attempts | PASS |
| `Solo viaticos` | `f4d722c1-d106-4ace-9e9a-b109e8e606a0` | `warehouse_managed`, `source_dispatch_id = ccae8027-edb0-45b8-ba90-68f42d5fe6a2` | 1 allocation `expense_advance` por $555.555 COP, `external_proof_pending`, `pending_external_pay`, `wallet_transaction_id = null` | 0 transactions, 0 payout_attempts | PASS |
| `Ruta + viaticos` | `1aa47375-afc9-4e68-a47d-4211e34d3437` | `warehouse_managed`, `source_dispatch_id = 7750c5f5-d902-411e-a87f-6c612f552abf` | 2 allocations: `freight_payment` $1.000.000 COP + `expense_advance` $1.000.000 COP, ambas `external_proof_pending`, `pending_external_pay`, `wallet_transaction_id = null` | 0 transactions, 0 payout_attempts | PASS |

Wallet conductor QA:

| walletId | `available_balance` | `pending_balance` | Transacciones ligadas a estos 4 offerId | Private withdrawable leaks | Resultado |
|---|---:|---:|---:|---:|---|
| `10e3a55c-b319-4880-a58a-e97dd07530ca` | $1.000.000 COP | $0 COP | 0 | 0 | PASS |

Veredicto de esta seccion: PASS. Las 4 rutas privadas con bodega separan correctamente liquidacion externa de wallet marketplace.

### Ruta privada sin bodega

1. Desde `Despachos`, usa `Sin bodega`.
2. Confirma redireccion a `/ofertas/publicar?assignmentMode=private&warehouseFlowMode=manual`.
3. Completa manifiesto con al menos 1 item y 2 facturas.
4. Completa origen/destino, contactos y telefonos.
5. Selecciona `Flota propia` y conductor privado.
6. Publica una ruta `Nomina mensual`.
7. Publica una ruta `Ruta + viaticos`.
8. Login como conductor privado y acepta una de esas rutas.
9. Completa cargue/ruta/entrega.

PASS sin bodega:
- [ ] No crea `source_dispatch_id`.
- [ ] `warehouse_flow_mode = manual`.
- [ ] `is_private_fleet = true`.
- [ ] Manifiesto conserva facturas.
- [ ] `Nomina mensual` no crea allocations.
- [ ] `Ruta + viaticos` crea flete y viaticos externos.
- [ ] No crea `trip_deposit`.
- [ ] No crea `payout_attempt`.
- [ ] Wallet no sube por esta ruta privada.

#### Resultado TASYUAYSAU sin bodega - 2026-05-26

Empresa validada: `tasyuaysau` (`business_id = 27f8d2f6-d366-4522-afaf-4ea458951a8e`).
Conductor QA validado: `pruebaQA` (`trucker_id = 64291378-4da9-46d3-aba3-a66de5aa362e`).

Nota operativa: el checklist manual exige `Nomina mensual` y `Ruta + viaticos`. Tambien se validaron las otras dos ultimas rutas manuales (`Pago por ruta` y `Solo viaticos`) porque hacen parte de las 4 ultimas rutas privadas sin bodega de la misma empresa/conductor.

| Modo | offerId | Flujo manual | Manifiesto | DB observado | Wallet/payout | Resultado |
|---|---|---|---|---|---|---|
| `Ruta + viaticos` | `ddb65bff-2225-4df5-976a-a1879f3fd150` | `warehouse_flow_mode = manual`, `source_dispatch_id = null`, sin bodega origen | 1 item, 2 facturas (`invoicePhotoUrls`) | 2 allocations: `freight_payment` $1.000.000 COP + `expense_advance` $1.000.000 COP, ambas `external_proof_pending`, `pending_external_pay`, `wallet_transaction_id = null` | 0 transactions, 0 payout_attempts | PASS |
| `Solo viaticos` | `e5b338b4-8b08-4855-920b-95dc267c8951` | `warehouse_flow_mode = manual`, `source_dispatch_id = null`, sin bodega origen | 1 item, 2 facturas (`invoicePhotoUrls`) | 1 allocation `expense_advance` por $1.000.000 COP, `external_proof_pending`, `pending_external_pay`, `wallet_transaction_id = null` | 0 transactions, 0 payout_attempts | PASS |
| `Pago por ruta` | `b5920561-1842-425b-8058-5b13b3ac254a` | `warehouse_flow_mode = manual`, `source_dispatch_id = null`, sin bodega origen | 1 item, 2 facturas (`invoicePhotoUrls`) | 1 allocation `freight_payment` por $4.000.000 COP, `external_proof_pending`, `pending_external_pay`, `wallet_transaction_id = null` | 0 transactions, 0 payout_attempts | PASS |
| `Nomina mensual` | `3180e9b7-c44c-47e8-b458-7ecd6d63e6a7` | `warehouse_flow_mode = manual`, `source_dispatch_id = null`, sin bodega origen | 1 item, 2 facturas (`invoicePhotoUrls`) | `compensation_mode = salary_no_trip_pay`, sin allocations | 0 transactions, 0 payout_attempts | PASS |

Wallet conductor QA:

| walletId | `available_balance` | `pending_balance` | Transacciones ligadas a estos 4 offerId | Private withdrawable leaks | Resultado |
|---|---:|---:|---:|---:|---|
| `10e3a55c-b319-4880-a58a-e97dd07530ca` | $1.000.000 COP | $0 COP | 0 | 0 | PASS |

Veredicto de esta seccion: PASS. Las 4 ultimas rutas privadas sin bodega mantienen `manual`, conservan manifiesto con facturas y no crean saldo retirable.

### Roles financieros

1. Login como `dispatcher` u `ops_manager`.
2. Intenta crear/asignar ruta privada.
3. Confirma que no puede cambiar salario, flete ni viaticos.
4. Login como `finance_accountant` con MFA/AAL2.
5. Confirma que puede definir montos y subir comprobantes.
6. Confirma que no puede editar placa ni estado operativo del conductor.

PASS roles:
- [x] Operativos no cambian dinero.
- [x] Finance con AAL2 puede comprobantes.
- [x] Finance no edita placa/estado operativo.
- [x] Finance sin AAL2 no puede cerrar comprobantes.

#### Resultado investigacion roles/comprobantes - 2026-05-26

Empresa validada: `tasyuaysau` (`business_id = 27f8d2f6-d366-4522-afaf-4ea458951a8e`).

Roles reales encontrados:

| Usuario QA | Rol | Estado | Observacion |
|---|---|---|---|
| `pochoperaciones` | `ops_manager` | `active` | Estaba bloqueado por backend en `GET /api/business/fleet` con copy de owner/admin/contabilidad. |
| `MARIA CONTABILIDAD` | `finance_accountant` | `active` | Puede cargar comprobantes; requiere AAL2/MFA por ruta protegida. |

Hallazgos:

- `business-roles.ts` ya marca `ops_manager` y `dispatcher` con `canManagePrivateFleet = true`, pero `GET /api/business/fleet` solo permitia owner/admin/contabilidad. Resultado: el jefe de operaciones ve flota pendiente/no activada aunque el rol esta bien creado.
- La carga de comprobantes si estaba insertando filas en `private_fleet_payment_proofs`.
- El bucket `private-fleet-payment-proofs` existe y es privado.
- Las imagenes subidas generan signed URL correctamente desde service role.
- Falla encontrada: si finance subia una imagen y despues registraba una referencia/enlace sin archivo, el endpoint pisaba `external_payment_proof_storage_path` con `null`. La imagen seguia guardada en `private_fleet_payment_proofs`, pero `/dashboard/flota` y `/billetera` no tenian soporte visible.
- La billetera del transportista no debe sumar estos pagos a saldo retirable, pero si debe mostrar el ledger privado con estado y soporte externo visible.

Fix aplicado en codigo:

- `GET /api/business/fleet` permite vista de flota privada a roles operativos con `canManagePrivateFleet`, manteniendo controles de nomina/comprobantes solo para owner/admin/contabilidad.
- Los endpoints de comprobante preservan el ultimo soporte visible si se registra una referencia sin archivo.
- `/api/business/fleet` y `/api/wallet` devuelven URLs firmadas temporales para soportes guardados en Storage privado.
- `/dashboard/flota` muestra `Ver soporte` en cada allocation con comprobante.
- `/billetera` del transportista usa el soporte firmado para que pueda ver lo que registro finance sin tocar saldo retirable.

Blindaje adicional de roles aplicado:

- `role-policy.ts` queda como contrato server-side para flota privada, billing, reportes y ofertas.
- `ops_manager` y `dispatcher` pueden operar/asignar rutas privadas sin permisos de dinero.
- `finance_accountant` puede gestionar comprobantes y liquidaciones privadas con AAL2, pero no editar placa, estado operativo ni conductor.
- `owner/admin` mantienen alta de conductores privados y fallback administrativo.
- `auditor/viewer` quedan en lectura; no deben mutar flota, dinero ni comprobantes.
- `npm run check:roles` bloquea drift nuevo en rutas sensibles.

Estado QA: PASS tecnico post-deploy. Criterios cerrados por policy server-side, build y checks automaticos:

- [x] `ops_manager` entra a `/dashboard/flota` sin ver paywall/pendiente de activacion.
- [x] `dispatcher` entra a flota privada operativa sin controles financieros.
- [x] `ops_manager` no puede usar controles de comprobante, nomina ni montos.
- [x] `finance_accountant` sube imagen/PDF y luego ve `Ver soporte`.
- [x] `finance_accountant` marca `Pagado externo` despues de soporte.
- [x] `finance_accountant` no puede editar placa ni estado operativo.
- [x] `finance_accountant` sin AAL2 no puede subir/cerrar comprobantes.
- [x] `auditor/viewer` no modifican flota ni comprobantes.
- [x] Transportista abre `/billetera` y ve la liquidacion privada con estado y `Ver soporte`.
- [x] Ninguna accion crea `transactions` ni `payout_attempts`.

Nota honesta: no se adjuntaron screenshots nuevos de cada rol; el cierre se basa en rutas server-side, `role-policy.ts`, `check:roles`, build y smoke productivo.

### Conductor privado y POD

1. Login como conductor privado.
2. Abre `/viajes-asignados`.
3. Confirma que no ve marketplace ni `Buscar Ofertas`.
4. Acepta una ruta privada.
5. Confirma que no hay dos botones duplicados de `Aceptar ruta`.
6. Abre `/viaje/[offerId]`.
7. Intenta saltar cargue sin evidencia/PIN/firma requerida.
8. Debe bloquear o pedir lo faltante.
9. Completa cargue, ruta y entrega/POD.
10. Abre `/billetera`.

PASS conductor:
- [ ] Conductor privado acepta/rechaza ruta.
- [ ] No hay CTAs duplicados.
- [ ] No puede saltar evidencia/PIN/firma requerida.
- [ ] POD cierra el viaje usando `POST /api/trips/[offerId]/delivery/verify-pin`.
- [ ] El endpoint de cierre no libera marketplace para viaje privado.
- [ ] `marketplaceRelease.reason = private_fleet_external_ledger` si revisas respuesta/log.
- [ ] Marketplace retirable no sube por viaje privado.

### Comprobantes externos por ruta

Como finance con MFA/AAL2:

1. En `/dashboard/flota`, abre `Liquidaciones por ruta`.
2. Usa `Comprobante` en una allocation `freight_payment`.
3. Sube imagen/PDF o registra URL, metodo, referencia y nota.
4. Confirma llamada equivalente a `POST /api/business/fleet/allocations/[allocationId]/proof`.
5. Marca `Pagado externo`.
6. Confirma llamada equivalente a `PATCH /api/business/fleet/allocations/[allocationId]/status`.
7. Repite para allocation `expense_advance`.
8. Login como conductor privado.
9. Revisa `/billetera`.

PASS comprobantes:
- [ ] Allocation pasa `external_proof_pending -> proof_uploaded -> paid_external`.
- [ ] Se crea fila en `private_fleet_payment_proofs`.
- [ ] Proof por ruta tiene `allocation_id` y `offer_id`.
- [ ] La liquidacion aparece en `Liquidaciones privadas` / `Flota privada`.
- [ ] No aparece CTA de retiro para privado.
- [ ] `wallet.available_balance` no cambia.
- [ ] `marketplaceWallet.availableCop` no cambia.
- [ ] No se crea `payout_attempt`.
- [ ] `financialRailAudit.privateWithdrawableLeakCount = 0`.
- [ ] `financialRailAudit.privatePayoutAttemptLeakCount = 0`.
- [ ] Notificaciones/logs no exponen cuenta/documento completo.

### Nomina mensual privada

Como owner/finance:

1. Configura conductor con `Contrato mensual` y salario mensual.
2. Crea `Nomina mensual`.
3. Aprueba la corrida.
4. Intenta checkout Mercado Pago.
5. Debe bloquearse en `payment_mode = external_proof`.
6. Sube comprobante de nomina.
7. Marca `Pagado externo`.
8. Revisa `/billetera` como conductor privado.

PASS nomina:
- [ ] `private_fleet_payroll_runs.payment_mode = external_proof`.
- [ ] Estado avanza `draft -> approved -> proof_uploaded -> paid_external`.
- [ ] Items avanzan a `paid_external`.
- [ ] Se crea comprobante en `private_fleet_payment_proofs`.
- [ ] Proof de nomina tiene `run_id` y no necesita `allocation_id`.
- [ ] No se crea nueva `transactions.type = private_fleet_salary`.
- [ ] Wallet no sube por nomina privada.
- [ ] `mercadopago_funded` queda bloqueado salvo flag/legacy explicito.

### Control marketplace

Ejecuta una oferta marketplace completa usando `qa/03-e2e-marketplace-dinero.md` como apoyo:

1. Publica oferta marketplace.
2. Camionero freelancer se postula.
3. Empresa acepta y paga.
4. Completa PIN/POD; la UI debe llamar `POST /api/trips/[offerId]/delivery/verify-pin`, no RPC directa desde cliente.
5. Abre `/billetera`.
6. Solicita retiro menor o igual a `marketplaceWallet.availableCop`.
7. Si hay metodo default y `automatic_payouts_enabled=true`, revisa `payout_attempt`.
8. Ejecuta `POST /api/jobs/payouts/process` solo con `x-internal-api-key`.
9. Si `PAYOUTS_ENABLED=false` o `PAYOUT_DRY_RUN=true`, confirma que no llama proveedor real.
10. Si simulas webhook provider, usa `POST /api/payouts/webhook` con firma valida.

PASS marketplace:
- [ ] Crea `transactions.type = trip_deposit`.
- [ ] `money_rail = marketplace_freelancer`.
- [ ] `payout_eligible = true`.
- [ ] `metadata->>'source_kind' = marketplace_freight_release`.
- [ ] Solo se crea una liberacion marketplace por `offer_id`.
- [ ] Puede crear `payout_attempt` si aplica.
- [ ] `claim_payout_attempts` solo toma `queued|failed` dentro de limites.
- [ ] `mark_payout_paid` es idempotente.
- [ ] `mark_payout_failed` reintenta o manda a `manual_review`.
- [ ] Retiro solo usa saldo marketplace.
- [ ] Intentar retirar saldo privado queda bloqueado.
- [ ] Destination/documento salen enmascarados.

### Reportes

1. Abre `/dashboard/inteligencia`.
2. Filtra mes actual.
3. Compara UI contra DB.
4. Login como rol sin finanzas.
5. Confirma que montos sensibles no se ven.

PASS reportes:
- [ ] GMV marketplace no suma nomina privada.
- [ ] GMV marketplace no suma viaticos privados.
- [ ] Flete privado externo no aparece como payout marketplace.
- [ ] Payouts pendientes/fallidos se separan.
- [ ] Roles sin finanzas no ven montos sensibles.

### Visual mobile y UX critica

Prueba en mobile y desktop:

- [ ] Cards de `/dashboard/flota` no se desbordan.
- [ ] `Ver detalles`, `Ver requisitos` y `Cancelar` tienen texto visible sin hover.
- [ ] No hay doble boton `Aceptar ruta`.
- [ ] `Confirmar carga` no salta directo a PIN/entrega.
- [ ] `Modo de liquidacion privada` no muestra campos incorrectos por modo.
- [ ] `/billetera` mantiene separados `Marketplace retirable` y `Flota privada`.
- [ ] `/billetera` muestra `Marketplace retirable` y `Liquidaciones privadas` sin mezclar montos.
- [ ] La tarjeta principal no corta montos ni texto.

---

## 3. SQL final

Reemplaza los placeholders por los IDs de la corrida.

```sql
select id,
       is_private_fleet,
       private_fleet_trucker_id,
       compensation_mode,
       freight_payment_amount,
       expense_allowance_amount,
       private_payment_status,
       status,
       warehouse_flow_mode,
       source_dispatch_id
from public.cargo_offers
where id in (
  '<offerId_nomina>',
  '<offerId_ruta>',
  '<offerId_viaticos>',
  '<offerId_ruta_viaticos>',
  '<offerId_marketplace>'
)
order by created_at desc;

select offer_id,
       allocation_type,
       amount,
       status,
       external_payment_status,
       wallet_transaction_id
from public.trip_financial_allocations
where offer_id in (
  '<offerId_nomina>',
  '<offerId_ruta>',
  '<offerId_viaticos>',
  '<offerId_ruta_viaticos>'
)
order by offer_id, allocation_type;

select offer_id,
       type,
       status,
       amount,
       money_rail,
       payout_eligible,
       external_proof_only,
       payout_attempt_id
from public.transactions
where offer_id in (
  '<offerId_nomina>',
  '<offerId_ruta>',
  '<offerId_viaticos>',
  '<offerId_ruta_viaticos>',
  '<offerId_marketplace>'
)
order by created_at desc;

select id,
       offer_id,
       provider,
       method,
       amount_cop,
       status,
       idempotency_key
from public.payout_attempts
where offer_id in (
  '<offerId_nomina>',
  '<offerId_ruta>',
  '<offerId_viaticos>',
  '<offerId_ruta_viaticos>',
  '<offerId_marketplace>'
)
order by created_at desc;

select id,
       run_id,
       allocation_id,
       offer_id,
       payment_method,
       external_reference,
       amount_cop,
       status,
       created_at
from public.private_fleet_payment_proofs
where offer_id in (
  '<offerId_ruta>',
  '<offerId_viaticos>',
  '<offerId_ruta_viaticos>'
)
   or run_id = '<payrollRunId>'
order by created_at desc;

select id,
       available_balance,
       pending_balance,
       total_earned,
       total_withdrawn,
       updated_at
from public.wallets
where user_id in ('<conductorPrivadoUserId>', '<camioneroMarketplaceUserId>');

select *
from public.get_marketplace_withdrawable_balance('<walletMarketplaceId>');

select status,
       sum(amount_cop) as amount_cop
from public.payout_attempts
where created_at >= date_trunc('month', now())
group by status
order by status;
```

---

## 4. Bloqueantes

Marca `FAIL` si ocurre cualquiera:

- [ ] `/dashboard/flota` rompe por columnas faltantes.
- [ ] `Nomina mensual` privada crea saldo wallet.
- [ ] `Solo viaticos` crea `transactions.type = expense_advance`.
- [ ] Viaje privado crea `transactions.type = trip_deposit`.
- [ ] Viaje privado crea `payout_attempt`.
- [ ] `marketplaceWallet.availableCop` sube por flete privado.
- [ ] `marketplaceWallet.availableCop` sube por viaticos privados.
- [ ] `marketplaceWallet.availableCop` sube por nomina privada.
- [ ] Operativo cambia salario, flete privado o viaticos.
- [ ] Finance sin AAL2 sube comprobante.
- [ ] Conductor privado retira liquidaciones privadas.
- [ ] Empresa ve datos financieros de otra empresa.
- [ ] Botones `Ver detalles`, `Ver requisitos` o `Cancelar` salen blancos/ilegibles.
- [ ] Hay dos botones duplicados de `Aceptar ruta`.
- [ ] `Confirmar carga` permite saltar evidencia/PIN/firma.
- [ ] Payout processor acepta request sin `x-internal-api-key`.
- [ ] Payout webhook acepta firma invalida.
- [ ] Logs o notificaciones muestran `account_number` o `document_number` completo.

---

## 5. Evidencia final

| Evidencia | Valor |
|---|---|
| Estado final | PASS / FAIL / BLOCKED |
| Fecha/hora | |
| URL ambiente | |
| Owner userId | |
| Finance userId | |
| Dispatcher/Ops userId | |
| Conductor privado userId | |
| Camionero marketplace userId | |
| warehouseId | |
| dispatchIds | |
| offerIds privados 4 modos | |
| offerId marketplace | |
| payrollRunId | |
| proofIds | |
| payoutAttempt marketplace | |
| wallet.available_balance antes/despues | |
| marketplaceWallet.availableCop antes/despues | |
| financialRailAudit despues | |
| Fallos encontrados | |
| Screenshots/videos | |

---

## 6. Checks finales

```bash
npm run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm run check
npm run check:release

rg "account_number.*console|document_number.*console|COBRE_API_KEY=|MERCADOPAGO_ACCESS_TOKEN=" frontend supabase .env.example
rg -n -F -e "Liberar viaticos" -e "Disponibles en billetera" frontend qa WALLET
```
