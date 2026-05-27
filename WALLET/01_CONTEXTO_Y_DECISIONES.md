# 01 — Contexto, problema y decisiones de arquitectura

## Problema

KargaX tiene dos tipos de camioneros y dos tipos de dinero:

1. **Camionero freelancer de marketplace**
   - Toma rutas publicadas en el marketplace.
   - La empresa paga una ruta específica.
   - El pago entra por Mercado Pago.
   - El pago se debe liberar cuando la entrega termina correctamente.
   - Este flujo sí puede convertirse en wallet real y payout automático.

2. **Camionero privado de una empresa**
   - Trabaja dentro de una flota privada.
   - La empresa le paga nómina, mensualidad, liquidación o gastos por fuera.
   - KargaX no necesita custodiar ese dinero al inicio.
   - KargaX debe documentar el pago, el estado y el comprobante.

## Decisión principal

No se debe usar la misma lógica de wallet real para ambos mundos.

| Carril | Dinero real dentro de KargaX | Retiro automático | Modelo recomendado |
|---|---:|---:|---|
| Marketplace freelancer | Sí, cuando Mercado Pago confirma | Sí, después de ruta completada | Wallet + payout automático |
| Flota privada | No al inicio | No | Liquidación + comprobante externo |
| Planes SaaS KargaX | Sí, revenue KargaX | No aplica | Mercado Pago billing |

## Por qué no mezclar

Si una empresa privada registra una nómina de $4.000.000 y KargaX la suma a `wallet.available_balance`, el camionero podría creer que puede retirar dinero que KargaX realmente no recibió.

Eso crea tres riesgos:

1. Riesgo financiero: KargaX podría quedar debiendo plata que nunca recibió.
2. Riesgo legal: parece custodia de fondos de terceros sin estructura.
3. Riesgo operativo: soporte no puede demostrar de dónde salió cada peso.

## Principio de diseño

> La wallet no crea dinero. La wallet representa movimientos financieros verificables.

## Estados correctos

### Marketplace

```text
payment_pending       Empresa inició checkout
payment_approved      Mercado Pago confirmó pago real
route_secured         Ruta asegurada
route_completed       Entrega terminada con evidencia
release_pending       Lista para liberar al camionero
payout_queued         Payout creado
payout_processing     Proveedor procesando
payout_paid           Dinero enviado
payout_failed         Falló, requiere retry/manual
```

### Flota privada

```text
draft                 Liquidación en borrador
pending_external_pay  Empresa aún no pagó por fuera
proof_uploaded        Comprobante cargado
paid_external         Pago externo marcado como pagado
rejected              Comprobante rechazado
cancelled             Liquidación anulada
```

## Product copy recomendado

### Marketplace

“Pago asegurado por KargaX. El transportador recibe el pago automáticamente cuando la entrega queda validada.”

### Privado

“Controla liquidaciones y comprobantes de tu flota privada sin cambiar la forma en que hoy pagas por banco o Nequi.”

## Qué debe ver el usuario

### Camionero freelancer

- Saldo marketplace disponible.
- Saldo en proceso de payout.
- Historial de rutas pagadas.
- Estado de payout.
- Comprobante del proveedor.

### Camionero privado

- Liquidaciones privadas pendientes.
- Liquidaciones pagadas.
- Comprobantes cargados.
- No debe ver esos valores como saldo retirable automático.

### Admin empresa privada

- Crear liquidación mensual.
- Cargar comprobante.
- Marcar pagado.
- Exportar reporte.

### Admin KargaX

- Ver payouts marketplace.
- Reintentar payout fallido.
- Pasar payout a manual fallback.
- Auditar cada movimiento.
