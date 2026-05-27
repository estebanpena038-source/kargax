# 13 — Planes, límites y pricing para Control de Margen Last-Mile

## Decisión CEO

KargaX NO debe regalar `Control de Margen` en planes bajos. Esta función vende reducción de fuga operativa, control de proveedores y renegociación logística; por lo tanto debe empujar **Scale → Enterprise** y permitir vender add-ons corporativos.

La tabla comercial queda así:

| Plan | Precio recomendado | Límite viajes/mes | Control de margen | Objetivo comercial |
|---|---:|---:|---|---|
| Free | $0 COP | 50 | No incluido | Activación y prueba real limitada |
| Growth | $299.000 COP/mes | 500 | No incluido; solo teaser/paywall | Operación inicial B2B |
| Scale | $799.000 COP/mes | 2.000 | Scorecards básicos/read-only | 3PL/operación en crecimiento |
| Enterprise | Desde $2.500.000 COP/mes | Volumen personalizado | Dashboard completo + contratos básicos | Empresa mediana/grande |
| Enterprise Margin OS | Desde $4.500.000 COP/mes | Contrato personalizado | Contratos + alertas + renegociación + exportes | Empresa con fuga de margen en última milla |
| Enterprise Corporate | $8M–$15M COP/mes | Contrato personalizado | Multiempresa + SLA + auditoría + soporte premium | Operador grande / holding / multi-sede |

## Recomendación concreta

Mantener el plan **Enterprise desde $2.500.000 COP/mes** como entrada, pero NO entregar todo el módulo avanzado allí.

- **Enterprise Base**: incluye tablero, contratos básicos, vista de costo pactado vs costo observado y 10 alertas abiertas.
- **Enterprise Margin OS**: incluye contratos avanzados, scorecards completos, alertas ilimitadas bajo contrato, renegociación, exportes y simulación de ahorro.
- **Enterprise Corporate**: agrega multiempresa, SLA, auditoría, soporte premium, implementación acompañada y configuración avanzada.

## Feature matrix objetivo

Usar `billing_plans.feature_matrix` como fuente del gate comercial.

```json
{
  "last_mile_margin_control": true,
  "last_mile_margin_dashboard": true,
  "last_mile_contracts": true,
  "last_mile_scorecards": true,
  "last_mile_alerts": true,
  "last_mile_renegotiations": true,
  "last_mile_exports": true,
  "last_mile_monthly_alert_limit": null,
  "last_mile_active_contract_limit": null
}
```

## Matriz por plan

### Free

```json
{
  "last_mile_margin_control": false,
  "last_mile_margin_dashboard": false,
  "last_mile_contracts": false,
  "last_mile_scorecards": false,
  "last_mile_alerts": false,
  "last_mile_renegotiations": false,
  "last_mile_exports": false,
  "last_mile_monthly_alert_limit": 0,
  "last_mile_active_contract_limit": 0
}
```

### Growth

```json
{
  "last_mile_margin_control": false,
  "last_mile_margin_dashboard": false,
  "last_mile_contracts": false,
  "last_mile_scorecards": false,
  "last_mile_alerts": false,
  "last_mile_renegotiations": false,
  "last_mile_exports": false,
  "last_mile_teaser": true,
  "last_mile_monthly_alert_limit": 0,
  "last_mile_active_contract_limit": 0
}
```

### Scale

```json
{
  "last_mile_margin_control": false,
  "last_mile_margin_read_only": true,
  "last_mile_margin_dashboard": true,
  "last_mile_contracts": false,
  "last_mile_scorecards": true,
  "last_mile_alerts": false,
  "last_mile_renegotiations": false,
  "last_mile_exports": false,
  "last_mile_monthly_alert_limit": 0,
  "last_mile_active_contract_limit": 0
}
```

### Enterprise Base

```json
{
  "last_mile_margin_control": true,
  "last_mile_margin_dashboard": true,
  "last_mile_contracts": true,
  "last_mile_scorecards": true,
  "last_mile_alerts": true,
  "last_mile_renegotiations": false,
  "last_mile_exports": false,
  "last_mile_monthly_alert_limit": 10,
  "last_mile_active_contract_limit": 25
}
```

### Enterprise Margin OS

Este no necesita ser un `billing_plans.code` separado en V1. Puede venderse como contrato Enterprise con flags internos o `feature_matrix` extendido por business/entitlement futuro.

```json
{
  "last_mile_margin_control": true,
  "last_mile_margin_dashboard": true,
  "last_mile_contracts": true,
  "last_mile_scorecards": true,
  "last_mile_alerts": true,
  "last_mile_renegotiations": true,
  "last_mile_exports": true,
  "last_mile_monthly_alert_limit": null,
  "last_mile_active_contract_limit": null
}
```

## Copy para planes

### Free

> Acceso operativo gratis para validar KargaX con evidencia esencial y hasta 50 viajes/mes. No incluye control de margen.

### Growth

> Para empresas que empiezan a operar con más orden: 500 viajes/mes, evidencia, bodegas base y flota privada inicial. El control de margen avanzado está disponible en Enterprise.

### Scale

> Para operación 3PL y equipos en crecimiento: 2.000 viajes/mes, API/webhooks, control tower, scorecards básicos de rutas/proveedores y reportes operativos.

### Enterprise

> Desde $2.500.000 COP/mes. Para empresas que necesitan volumen personalizado, contratos por proveedor, control de margen, evidencia, auditoría y soporte premium.

### Enterprise Margin OS

> Desde $4.500.000 COP/mes. Control avanzado de margen logístico: contratos por proveedor/ruta/zona, alertas de sobrecosto, scorecards, renegociación y simulación de fuga estimada.

## Por qué no dejarlo todo en $2.5M

$2.5M COP/mes funciona como puerta de entrada porque reduce fricción comercial. Pero si el cliente tiene mucho volumen y el dolor es fuga de margen, el módulo completo debe venderse desde $4.5M o por contrato personalizado.

La función no se vende como “pantalla”. Se vende como:

> Detectar fugas, ordenar contratos, priorizar renegociaciones y defender margen operativo con evidencia.

## Reglas de implementación

1. No editar migraciones viejas.
2. Crear nueva migración para actualizar `billing_plans`.
3. Mantener `Enterprise` con precio público “desde”.
4. No usar “ilimitado” sin contrato.
5. El backend debe validar `feature_matrix`, no solo el frontend.
6. Scale puede ver scorecards básicos, pero no crear contratos ni renegociaciones.
7. Free/Growth deben ver paywall/teaser.
8. Trucker nunca accede a costos o margen.
9. Wallet y pagos no se tocan.
10. Documentar el cambio en `COMMERCIAL/`.
