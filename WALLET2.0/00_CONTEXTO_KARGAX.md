# 00 — Contexto KargaX y rol real de wallet

## Qué es KargaX

KargaX debe funcionar como sistema operativo logístico para empresas con carga, bodegas, flota privada, marketplace, evidencia de entrega, liquidaciones, wallet operativa, billing y reportes. El valor central no es “tracking”; es **cierre probado de entrega**: receptor, PIN/POD, foto/firma, hora, novedad y soporte descargable conectado a bodega, flota y liquidación.

## Por qué wallet es sensible

La wallet no es solo UI. Es ledger financiero operativo. Si se mezcla dinero marketplace con liquidaciones privadas, KargaX crea tres problemas:

- **Financiero:** se puede mostrar como retirable un dinero que KargaX no recibió.
- **Legal/regulatorio:** la app puede parecer custodia de fondos de terceros.
- **Operativo:** soporte no podrá explicar por qué un conductor ve saldo si la empresa lo paga por fuera.

## Dos mundos distintos

### Marketplace freelancer

El camionero toma rutas del marketplace. La empresa paga la ruta a través de Mercado Pago. KargaX confirma el pago por webhook. La ruta queda asegurada. Cuando se completa la entrega con evidencia, KargaX libera el neto del camionero y puede crear un payout automático.

Este flujo sí puede tocar wallet retirable porque existe pago real confirmado.

### Flota privada

El camionero trabaja para una empresa o dentro de una flota privada. La empresa puede pagar nómina, gastos, liquidación o bonos por fuera. KargaX debe registrar la liquidación y el comprobante, no convertir eso en saldo retirable.

Este flujo no debe tocar `wallet.available_balance`, salvo que explícitamente exista un modo futuro `mercadopago_funded` con pago real confirmado por KargaX y controles separados.

## Rail financiero canónico

| Rail | Descripción | Retirable | Fuente de verdad |
|---|---|---:|---|
| `marketplace_freelancer` | Ruta marketplace pagada por Mercado Pago y completada | Sí | Mercado Pago + cierre ruta |
| `private_fleet_external` | Liquidación privada pagada por fuera con comprobante | No | Empresa + comprobante |
| `wallet_withdrawal` | Retiro desde saldo marketplace elegible | No es ingreso | RPC retiro/payout |
| `billing_kargax` | Plan SaaS de KargaX | No aplica | Mercado Pago billing |
| `legacy` | Movimientos históricos sin rail claro | Bloqueado hasta auditoría | Backfill + revisión |

## Regla de oro

`wallet.available_balance` no es “todo lo que le deben al conductor”. Es solo dinero operativo confirmado y retirable desde KargaX.

Las liquidaciones privadas deben verse en un ledger privado separado:

```text
privateFleetLedger.pendingExternalPayCop
privateFleetLedger.proofUploadedCop
privateFleetLedger.paidExternalCop
privateFleetLedger.items[]
```

## Resultado esperado

El camionero freelancer ve saldo marketplace retirable.

El camionero privado ve liquidaciones/documentos, pero no un botón de retiro para esos montos.

El admin empresa ve liquidaciones, estados y comprobantes.

El admin KargaX ve payouts, fallos, retries, manual fallback y conciliación.
