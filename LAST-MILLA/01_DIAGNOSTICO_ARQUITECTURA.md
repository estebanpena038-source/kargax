# 01 — Diagnóstico de arquitectura para implementar Control de Margen

## Diagnóstico

KargaX ya tiene casi todo lo necesario para convertir la tesis de pérdida de margen en módulo enterprise:

- Viajes/ofertas con `cargo_offers`.
- Marketplace con comisión KargaX.
- Flota privada con conductores vinculados a empresa.
- Wallet y liquidaciones separadas.
- Evidencia/POD/PIN/firma/foto como núcleo de valor.
- Reportes mensuales por business.
- Billing SaaS con planes, límites y checkout.
- Roles internos con capacidades por operación/finanzas/auditoría.

La oportunidad es crear una capa nueva encima de lo existente:

```text
contrato pactado → viaje ejecutado → evidencia capturada → costo real → score proveedor → alerta renegociación
```

## Problema actual que resuelve

Empresas medianas/grandes pierden margen porque:

1. Contratan conductores/proveedores de forma fragmentada.
2. No tienen contrato/tarifa normalizada por ruta.
3. No comparan costo pactado vs costo final.
4. No cruzan costo con evidencia y novedades.
5. Renegocian sin benchmark operativo.
6. No saben qué proveedor absorbe más reclamos/sobrecostos.

## Recomendación técnica

Crear un dominio nuevo:

```text
last-mile-margin-control
```

Nombre comercial:

```text
Control de margen
```

Ruta UI:

```text
/dashboard/control-margen
```

Ruta API:

```text
/api/last-mile/*
```

Tablas:

```text
last_mile_carriers
last_mile_route_lanes
last_mile_contracts
last_mile_contract_events
last_mile_trip_cost_observations
last_mile_provider_score_snapshots
last_mile_renegotiation_recommendations
last_mile_analysis_runs
```

## Por qué no meterlo en `warehouses`

Bodega administra operación física: citas, muelles, inventario, recibos y despachos.

Control de margen administra decisiones comerciales/financieras sobre última milla:

- proveedor;
- contrato;
- ruta/lane;
- costo real;
- score;
- renegociación.

Mezclar ambos haría que bodega termine manejando pricing y contratos, lo cual rompería separación de dominios.

## Por qué no meterlo en `wallet`

Wallet representa movimientos verificables de dinero. Control de margen calcula fugas, variaciones y recomendaciones.

Ejemplo:

```text
Costo esperado: $80.000
Costo real observado: $96.000
Variación: $16.000
Recomendación: renegociar proveedor/ruta
```

Ese análisis no significa que KargaX tenga o deba mover $16.000. Por eso no entra a wallet.

## Por qué no meterlo solo en `/dashboard/inteligencia`

Inteligencia es reporte transversal. Control de margen necesita escritura:

- crear contrato;
- activar/pausar contrato;
- crear snapshot de costo;
- cambiar estado de alerta;
- auditar renegociación.

Por eso debe ser módulo propio con API propia.

## Estado de madurez recomendado

### V0 — Documentación y migración

- Esta carpeta.
- SQL draft.
- skeletons.

### V1 — Manual + Sync

- Crear carriers, lanes y contratos manualmente.
- Sync manual de viajes del mes.
- Dashboard ejecutivo.
- Alertas heurísticas.

### V2 — Job automático

- Recalcular al cerrar viaje.
- Recalcular diario por business.
- Dedupe de recomendaciones.

### V3 — Enterprise AI

- Generar propuestas de renegociación.
- Detectar anomalías por ciudad/proveedor.
- Simular cambio de proveedor.
- Sugerir redistribución de volumen.

## Modelo operativo

### Input

- `cargo_offers`: viajes, monto, origen/destino, status, proveedor asignado.
- `business_fleet_members`: flota privada.
- `trip_financial_allocations`: pagos/gastos por viaje privado.
- `warehouse_incidents`: novedades.
- `trip_signature_evidences` / evidencia: soporte de cierre.
- `payments`: solo como dato de confirmación, no para mover plata.

### Output

- costo esperado vs real;
- overrun COP/%;
- score proveedor;
- alertas;
- reporte ejecutivo;
- eventos de auditoría.

## Entidades críticas

### Carrier

Proveedor lógico de última milla.

Puede ser:

- conductor privado;
- transportador marketplace;
- proveedor externo;
- empresa aliada.

### Lane

Ruta normalizada.

No se debe usar dirección completa como llave primaria del negocio porque genera demasiada granularidad. Para MVP usar:

```text
origen departamento/ciudad/zona + destino departamento/ciudad/zona + tipo vehículo + tipo carga + service level
```

### Contract

Tarifa vigente por carrier/lane.

Puede ser:

- por viaje;
- por km;
- híbrida;
- retainer mensual;
- costo manual observado.

### Observation

Snapshot por viaje/oferta.

Es el dato que permite explicar el cálculo histórico incluso si el contrato cambia después.

### Recommendation

Alerta accionable.

No es solo “insight”: debe tener estado, dueño, vencimiento y resolución.

## Riesgo técnico principal

El riesgo no es crear tablas. El riesgo es duplicar lectura de money flows y crear contradicciones con wallet/billing.

Regla:

- Si el valor es **saldo real**, wallet.
- Si el valor es **costo observado**, last-mile.
- Si el valor es **revenue SaaS KargaX**, billing.
- Si el valor es **comisión marketplace**, pricing/payments/reportes.

## Criterios de éxito

El módulo está bien implementado si una empresa puede responder:

1. ¿Qué proveedor me cuesta más de lo pactado?
2. ¿Qué ruta tiene más sobrecosto?
3. ¿Qué proveedor entrega bien pero está caro?
4. ¿Qué proveedor barato genera reclamos?
5. ¿Qué contrato vence o debe renegociarse?
6. ¿Cuánto ahorro potencial hay si renegocio top 10 fugas?
7. ¿Qué evidencia sustenta cada alerta?
