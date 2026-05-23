# CERRADO - Sprint 29: Cierre de Brechas TRABAJOIA

## Objetivo

Cerrar las piezas de TRABAJOIA que estaban parciales sin reactivar lending ni promesas financieras para piloto.

## Implementado

- Settlement marketplace queda definido como modelo `8% / 92%` en la migracion `045_trabajoia_tracking_and_settlement.sql`.
- Flota privada queda sin comision marketplace por defecto.
- Score/reputacion visible con `TruckerScoreBadge`.
- Score visible en `/perfil` y dashboard camionero.
- Dashboard empresa `/dashboard/inteligencia` con metricas mensuales, tendencia semanal, rutas principales y tabla de viajes.
- Export PDF real con `jspdf`.
- Link de Inteligencia en sidebar para empresas/admin.
- Pago expres queda documentado y bloqueado visualmente en billetera cuando lending esta pausado.
- Landing `/para-camioneros` sin promesas de adelantos, credito ni pago en dos horas.
- Cron `/api/cron/inactive-users` queda en modo seguro/dry-run con limite semanal por metadata.

## Reglas Cerradas

- `commission_rate`: `0.08` para marketplace.
- `gross_amount`: valor pagado por empresa.
- `platform_fee`: `gross_amount * 0.08`.
- `net_amount`: `gross_amount - platform_fee`.
- `settlement_source`: `marketplace_standard_v2` o `private_fleet_no_marketplace_fee`.
- `express_payment_enabled=false` para piloto.
- Score no usa credito, adelantos ni lending como metrica.

## QA

- Typecheck.
- Build.
- Publicar oferta marketplace y validar snapshot 8/92.
- Cerrar viaje y validar wallet/ledger.
- Abrir `/dashboard/inteligencia` como empresa/admin.
- Exportar `KargaX_Reporte_[Mes]_[Empresa].pdf`.
- Abrir `/para-camioneros` en mobile y desktop.

## Pendiente Operativo

- Ejecutar migracion `045` en Supabase antes de produccion.
- Conectar proveedor transaccional real para emails inactivos si se decide activar envio.
