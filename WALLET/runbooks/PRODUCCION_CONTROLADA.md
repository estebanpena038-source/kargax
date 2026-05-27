# Runbook — Producción controlada payouts marketplace

## Antes de activar

- Confirmar proveedor real y contrato.
- Confirmar API oficial para dispersión.
- Confirmar webhook de estado.
- Confirmar cuenta empresarial.
- Confirmar topes diarios.
- Confirmar impuestos/comisiones con contador.
- Activar límites bajos.

## Día 1

- Solo 1 cliente.
- Solo 1-3 camioneros.
- Payout máximo $300.000-$500.000.
- Conciliación manual después de cada payout.

## Si algo falla

1. Desactivar `PAYOUTS_ENABLED`.
2. Mantener Mercado Pago activo para asegurar rutas.
3. Pasar payouts a manual_review.
4. Pagar manualmente con comprobante.
5. Registrar incidente.
6. No editar balances sin transacción compensatoria.
