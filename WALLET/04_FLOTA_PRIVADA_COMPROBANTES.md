# 04 — Flota privada: liquidaciones con comprobante externo

## Objetivo

Implementar el flujo:

```text
Empresa ABC debe pagar $4.000.000

1. Admin registra pago mensual en KargaX.
2. KargaX muestra: pago pendiente.
3. Empresa paga directamente al transportador por banco/Nequi normal.
4. Admin sube comprobante.
5. KargaX marca: pagado.
```

## Decisión

Este flujo NO debe crear saldo retirable en la wallet.

Debe ser un módulo de liquidaciones privadas, no payout automático.

## Por qué

La empresa paga por fuera. Si KargaX no recibió dinero real, KargaX no debe mostrarlo como saldo disponible.

## Modelo de datos recomendado

Puede implementarse reutilizando `private_fleet_payroll_runs` y `private_fleet_payroll_items`, agregando campos nuevos, o creando tablas nuevas.

Recomendación: extender tablas existentes si ya están en producción.

### Nuevos campos en `private_fleet_payroll_runs`

```sql
alter table private_fleet_payroll_runs
  add column if not exists payment_mode text not null default 'external_proof',
  add column if not exists external_payment_status text not null default 'pending_external_pay',
  add column if not exists external_paid_at timestamptz,
  add column if not exists external_paid_by uuid,
  add column if not exists external_payment_method text,
  add column if not exists external_payment_reference text,
  add column if not exists external_payment_proof_url text,
  add column if not exists external_payment_proof_storage_path text,
  add column if not exists external_payment_note text;
```

### Estados privados

```text
pending_external_pay
proof_uploaded
paid_external
rejected
cancelled
```

## UI admin empresa

Crear/ajustar módulo:

```text
Flota privada > Liquidaciones

- Crear liquidación
- Seleccionar transportador(es)
- Periodo
- Concepto
- Valor
- Estado
- Cargar comprobante
- Marcar pagado
- Descargar reporte
```

## API recomendada

Crear o adaptar rutas existentes:

```text
GET    /api/private-fleet/payroll-runs
POST   /api/private-fleet/payroll-runs
GET    /api/private-fleet/payroll-runs/[id]
POST   /api/private-fleet/payroll-runs/[id]/proof
PATCH  /api/private-fleet/payroll-runs/[id]/status
```

Si ya existen rutas con otros nombres, no duplicar. Buscar primero:

```bash
rg "private_fleet_payroll" frontend/src/app frontend/src/lib supabase/migrations
rg "payroll_runs" frontend/src/app frontend/src/lib supabase/migrations
```

## Payload para subir comprobante

```ts
{
  paymentMethod: 'nequi' | 'bank_transfer' | 'cash' | 'other',
  externalReference: 'Banco/Nequi referencia',
  paidAt: '2026-05-25T10:00:00-05:00',
  note: 'Pago nómina mayo',
  proofFile: File
}
```

## Validaciones

- Solo owner/admin/finance_accountant de la empresa puede subir comprobante.
- El transportador solo puede ver su liquidación y comprobante.
- No permitir modificar monto después de `proof_uploaded` sin crear ajuste.
- No permitir `paid_external` sin comprobante, salvo rol admin KargaX con nota obligatoria.
- No sumar `wallet.available_balance`.

## Adaptación de `private-fleet-payroll.ts`

Actualmente `releasePrivateFleetPayrollRun` libera a wallet cuando Mercado Pago aprueba.

Modificar así:

```ts
if (run.payment_mode === 'external_proof') {
  // No tocar wallet.
  // No crear transaction private_fleet_salary como saldo retirable.
  // Solo actualizar estado documental:
  // external_payment_status = 'paid_external' si hay comprobante validado.
  return {
    released: true,
    duplicate: false,
    status: 'paid_external',
    runId: run.id,
    releasedItems: 0,
    walletTouched: false,
  };
}

if (run.payment_mode === 'mercadopago_funded') {
  // Mantener comportamiento actual, pero solo si esta modalidad se habilita explícitamente.
}
```

## Payload para `/api/wallet`

Para camionero privado, la wallet debe mostrar liquidación externa, no saldo retirable.

Agregar en respuesta:

```ts
privateFleetLedger: {
  pendingExternalPayCop: number;
  proofUploadedCop: number;
  paidExternalCop: number;
  items: PrivateFleetLiquidationItem[];
}
```

## UI `/billetera`

Cambiar labels:

### Antes

```text
Salario mensual: disponible / pendiente de fondeo
```

### Después

```text
Liquidaciones privadas
Pendiente externo: $4.000.000
Pagado externo: $0
Comprobante: pendiente
```

## Texto seguro para usuario

```text
Este pago lo realiza directamente tu empresa por su canal habitual. KargaX registra la liquidación y el comprobante, pero no custodia este dinero.
```

## Resultado esperado

El camionero privado entiende cuánto le deben y qué fue pagado, pero no confunde ese valor con saldo retirable desde KargaX.
