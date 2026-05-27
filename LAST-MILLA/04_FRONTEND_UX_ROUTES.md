# 04 — Frontend, UX y rutas

## Ruta principal

```text
frontend/src/app/dashboard/control-margen/page.tsx
```

Label sidebar:

```text
Control de margen
```

Icono recomendado:

```ts
LineChart | TrendingDown | BadgeDollarSign
```

Ubicación en sidebar:

Después de `Inteligencia` y antes de `Planes`.

## Objetivo de UX

Una persona de operaciones/finanzas debe entender en 30 segundos:

1. Cuánto sobrecosto estimado hay.
2. Qué rutas generan fuga.
3. Qué proveedores deben renegociarse.
4. Qué contratos vencen.
5. Qué evidencia sustenta el análisis.

## Layout recomendado

```text
EnterpriseHero
  - Eyebrow: Margen logístico
  - Title: Control de margen en última milla
  - Description: Contratos, costos reales, evidencia y renegociación en una sola vista.
  - Meta: Viajes observados, fuga estimada, alertas críticas

Filtros
  - Mes
  - Carrier/proveedor
  - Ruta/lane
  - Estado contrato
  - Severidad recomendación

KPIs
  - Fuga estimada COP
  - Variación promedio %
  - Evidencia completa %
  - Recomendaciones abiertas
  - Contratos por vencer

Tabs
  - Resumen
  - Contratos
  - Rutas
  - Proveedores
  - Renegociaciones
  - Auditoría
```

## Tab: Resumen

Componentes:

- Cards KPI.
- Top 5 rutas con sobrecosto.
- Top 5 proveedores por fuga.
- Recomendaciones críticas.
- CTA `Sincronizar mes`.

Copy:

```text
Controla dónde se está escapando margen y qué proveedor/ruta necesita renegociación.
```

## Tab: Contratos

Tabla:

```text
Proveedor
Ruta
Modelo tarifa
Tarifa base
Vigencia
Estado
Variación promedio
Acciones
```

Acciones:

- Crear contrato.
- Editar contrato.
- Pausar.
- Activar.
- Ver eventos.

Formulario:

```text
carrierId
laneId opcional
sourceKind
pricingModel
baseRateCop
perKmRateCop
perKgRateCop
minimumRateCop
maximumRateCop
fuelSurchargeCop
paymentTermsDays
evidenceRequired
startsAt
endsAt
notes
```

## Tab: Rutas

Tabla:

```text
Lane
Viajes
Costo esperado
Costo real
Fuga
Variación %
Evidencia completa
Proveedor principal
```

Acción:

- Ver viajes observados.
- Crear contrato para lane.
- Generar recomendación.

## Tab: Proveedores

Tabla:

```text
Proveedor
Tipo
Viajes
Completados
Incidencias
Evidencia %
Costo promedio
Fuga estimada
Score
Acción recomendada
```

Score visual:

```text
80-100: saludable
60-79: observar
40-59: renegociar
0-39: riesgo crítico
```

## Tab: Renegociaciones

Kanban o tabla:

```text
Abierta
Reconocida
En negociación
Aceptada
Rechazada
Cerrada
```

Campos:

```text
Severidad
Proveedor
Ruta
Trigger
Ahorro esperado
Confianza
Due date
Responsable
```

Acciones:

- Reconocer.
- Marcar en negociación.
- Aceptar.
- Rechazar.
- Cerrar con nota.

Copy operativo:

```text
No es una alerta genérica. Cada recomendación debe terminar en una decisión: renegociar, reasignar volumen o cerrar.
```

## Tab: Auditoría

Tabla:

```text
Fecha
Actor
Entidad
Evento
Antes
Después
Motivo
```

Solo visible a:

- owner;
- admin;
- auditor;
- finance_accountant.

## Estados vacíos

### Sin feature

```text
Control de margen está disponible en Enterprise. Actívalo para convertir contratos, rutas y evidencia en decisiones de renegociación.
```

CTA:

```text
Ver planes
```

### Sin contratos

```text
Crea tu primer contrato de última milla para comparar tarifa pactada contra costo real.
```

CTA:

```text
Crear contrato
```

### Sin observaciones

```text
Aún no hay viajes sincronizados para este periodo.
```

CTA:

```text
Sincronizar mes
```

## Componentes UI existentes a reutilizar

```text
DashboardLayout
EnterpriseHero
EnterpriseMetric
SectionHeader
StatusPill
InlineNotice
Card
Button
toast
```

## Cliente frontend

Crear:

```text
frontend/src/lib/last-mile/client.ts
```

Métodos:

```ts
getSummary(params)
listContracts(params)
createContract(payload)
updateContract(contractId, payload)
listCarriers(params)
listLanes(params)
syncObservations(payload)
listScorecards(params)
listRecommendations(params)
updateRecommendation(recommendationId, payload)
```

## Tipos

Crear:

```text
frontend/src/lib/last-mile/types.ts
```

No meter estos tipos en `warehouses/types.ts` salvo que el sidebar/access necesite flags compartidos.

## Copy final de producto

Hero:

```text
Control de margen en última milla
```

Description:

```text
Estandariza contratos, compara tarifa pactada contra costo real y convierte evidencia operativa en alertas de renegociación.
```

KPIs:

```text
Fuga estimada
Variación promedio
Evidencia completa
Alertas abiertas
```

CTA sync:

```text
Sincronizar viajes del mes
```

CTA contrato:

```text
Crear contrato
```

CTA recomendación:

```text
Mover a negociación
```
