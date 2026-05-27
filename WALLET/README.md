# WALLET — Implementación de pagos marketplace, retiros automáticos y liquidaciones privadas KargaX

## Objetivo

Crear una arquitectura de wallet que no mezcle dinero real de marketplace con liquidaciones privadas de nómina.

KargaX debe separar dos carriles financieros:

1. **Marketplace / camionero freelancer**
   - La empresa paga la ruta con Mercado Pago.
   - KargaX confirma el pago real por webhook.
   - La ruta queda asegurada.
   - Cuando la ruta termina y la evidencia queda validada, KargaX libera el pago al camionero.
   - KargaX crea y procesa un payout automático usando un proveedor de dispersión/payout.
   - KargaX guarda comprobante, estado y auditoría.

2. **Flota privada / camionero privado**
   - La empresa registra una liquidación mensual o pago privado en KargaX.
   - KargaX muestra el pago como pendiente.
   - La empresa paga directamente por Nequi, banco o método normal externo.
   - El admin sube comprobante.
   - KargaX marca la liquidación como pagada.
   - Este flujo NO debe crear saldo retirable automático en la wallet.

## Decisión CEO / Producto

No convertir todo en una wallet única. Eso rompe control y crea riesgo financiero.

- **Marketplace** = dinero real cobrado por Mercado Pago y liberado con payout automático.
- **Flota privada** = control documental de pagos externos, sin custodia de dinero.

## Regla de oro

> Ningún peso se vuelve retirable hasta que exista un pago real confirmado por Mercado Pago o proveedor financiero.

> Ningún pago privado externo debe inflar `wallet.available_balance`.

## Qué NO se debe hacer

- No guardar claves, tokens ni contraseñas en el repo.
- No usar contraseña personal de Nequi/Bancolombia en código.
- No crear saldo retirable manualmente desde admin.
- No mezclar salario privado con saldo marketplace real.
- No aprobar retiros automáticos desde staging.
- No eliminar la ruta manual de admin: debe quedar como fallback.

## Orden recomendado de implementación

1. Leer esta carpeta completa.
2. Hacer migraciones nuevas en `supabase/migrations`.
3. Crear capa `frontend/src/lib/server/payouts/*`.
4. Modificar `/api/wallet/withdraw` para que cree cola de payout, no solo admin review.
5. Crear job interno `/api/jobs/payouts/process`.
6. Crear webhook `/api/payouts/webhook`.
7. Crear servicio de liberación marketplace al completar ruta.
8. Cambiar flota privada para `external_proof`.
9. Ajustar UI `/billetera` para mostrar dos carriles.
10. Probar staging en modo dry-run.
11. Activar producción con límites bajos.

## Archivos principales actuales detectados

- `frontend/src/app/api/payments/webhook/route.ts`
- `frontend/src/lib/server/payments/freight-settlement.ts`
- `frontend/src/lib/contracts/payments.ts`
- `frontend/src/lib/server/private-fleet-payroll.ts`
- `frontend/src/app/billetera/page.tsx`
- `frontend/src/app/api/wallet/route.ts`
- `frontend/src/app/api/wallet/withdraw/route.ts`
- `frontend/src/app/api/admin/withdrawals/route.ts`
- `frontend/src/app/api/admin/withdrawals/[id]/route.ts`
- `frontend/src/lib/mercadopago/config.ts`
- `frontend/src/lib/server/runtime-env.ts`
- `supabase/migrations/*`

## Resultado esperado

Al terminar, KargaX tendrá:

- Pagos marketplace seguros.
- Liberación automática al terminar ruta.
- Payouts automáticos con proveedor externo.
- Comprobantes de payout.
- Fallback manual.
- Liquidaciones privadas con comprobante externo.
- Wallet limpia para camioneros freelancer.
- Panel privado que no simula dinero real.
