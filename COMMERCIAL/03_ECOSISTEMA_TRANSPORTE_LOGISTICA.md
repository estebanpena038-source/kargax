# 03 — Plan para ser ecosistema de transporte y logística

## Visión

KargaX debe evolucionar de “software de evidencias” a **ecosistema operativo logístico**.

La secuencia correcta:

1. Cierre de entrega con evidencia.
2. Control de despachos.
3. Flota privada.
4. Bodega/inventario.
5. Novedades y reclamos.
6. Reportes y auditoría.
7. Liquidación y wallet operativa.
8. Marketplace de capacidad externa.
9. 3PL multi-cliente.
10. Holding/control tower.
11. API/integraciones.

## Por qué empezar por evidencia

La evidencia es el wedge de entrada porque duele hoy y se entiende rápido.

Mensaje base:

> “Te dejo KargaX listo para cerrar entregas reales con receptor, hora, PIN, foto/firma y novedad. Si hoy eso vive en WhatsApp, ahí hay plata perdida.”

Después de entrar por evidencia, se expande a bodega, flota, reportes y pagos.

## Mapa del ecosistema

### 1. Empresa generadora de carga

Necesita:

- Crear despachos.
- Asignar conductor.
- Controlar evidencia.
- Ver novedades.
- Descargar soportes.
- Reportar a clientes.

Producto que compra: Growth o Scale.

### 2. Operador logístico / 3PL

Necesita:

- Manejar varios clientes.
- Varias bodegas.
- Evidencia por cliente.
- Reporte por cliente.
- Control tower.
- API/webhooks.

Producto que compra: Scale o Enterprise.

### 3. Transportadora

Necesita:

- Flota propia/fidelizada.
- Conductores.
- Viajes.
- Evidencia.
- Rechazos.
- Liquidaciones.

Producto que compra: Growth, Scale o Enterprise.

### 4. Bodega / centro de distribución

Necesita:

- Inventario.
- Ubicaciones.
- Recibos.
- Picking.
- Despachos.
- Manifiestos.
- Incidencias.

Producto que compra: Scale.

### 5. Conductor

Necesita:

- Ver viaje.
- Cargar evidencia.
- Cerrar entrega.
- Registrar novedad.
- Ver liquidación/gasto.

Producto: app/PWA dentro del flujo B2B.

### 6. Cliente final B2B

Necesita:

- Recibir soporte.
- Ver estado.
- Descargar evidencia.
- Validar novedad.

Producto: portal/link de evidencia, incluido en planes pagos.

## Flywheel de crecimiento

1. Empresa crea viajes.
2. Conductores usan KargaX.
3. Clientes reciben soportes KargaX.
4. Operaciones usa reportes.
5. Finanzas usa cierres/liquidaciones.
6. Más áreas dependen del mismo flujo.
7. La empresa sube de plan.
8. Conductores/transportistas conocen KargaX.
9. Otras empresas piden algo similar.
10. KargaX se vuelve red.

## Features que generan dependencia por valor

### Nivel 1 — Cierre de entrega

- PIN de cargue.
- PIN de entrega.
- Foto/firma.
- Receptor.
- Hora.
- Novedad.
- Rechazo preservado.
- Soporte descargable.

### Nivel 2 — Operación recurrente

- Plantillas de rutas.
- Clientes frecuentes.
- Direcciones frecuentes.
- Conductores frecuentes.
- Despachos recurrentes.
- Alertas de entregas sin evidencia.
- Tablero de novedades.

### Nivel 3 — Bodega/flota

- Inventario.
- Ubicaciones.
- Recibos.
- Picking.
- Dispatch order.
- Manifiesto.
- Flota privada.
- Compensación/gastos.

### Nivel 4 — Gerencia

- Reporte semanal automático.
- OTIF.
- Entregas cerradas.
- Entregas con novedad.
- Entregas rechazadas.
- Conductores activos.
- Clientes con más reclamos.
- Rutas con más incidentes.

### Nivel 5 — Ecosistema

- Portal cliente.
- API/webhooks.
- Marketplace externo.
- 3PL multi-cliente.
- Holding multiempresa.
- Treasury/wallet operativo.

## Roadmap comercial por fases

### Fase 1 — Wedge: evidencia de entrega

Objetivo: cerrar las primeras empresas usando KargaX para entregas reales.

Entregables:

- Onboarding de 10 minutos.
- Crear empresa.
- Crear bodega.
- Crear conductor.
- Crear entrega.
- Cerrar con evidencia.
- Descargar soporte.

Métrica: 3 entregas reales cerradas por empresa en 48 horas.

### Fase 2 — Recurrencia

Objetivo: que KargaX se use 3+ veces por semana.

Entregables:

- Plantillas de entrega.
- Contactos frecuentes.
- Reporte semanal.
- Alertas de novedad.
- Vista de soportes.

Métrica: 30 entregas/mes por empresa.

### Fase 3 — Pago

Objetivo: mover Free/Acceso Operativo a Growth/Scale.

Entregables:

- Paywall al 70/90/100%.
- Upgrade recomendado.
- Checkout Mercado Pago.
- Oferta fundador temporal.

Métrica: 20-30% de empresas activadas pasan a pago.

### Fase 4 — Expansión dentro de cuenta

Objetivo: más usuarios, más bodegas, más conductores.

Entregables:

- Roles por área.
- Bodegas adicionales.
- Conductores privados.
- Reportes por cliente.
- Exportaciones.

Métrica: NRR > 110%.

### Fase 5 — Plataforma regional

Objetivo: Colombia primero, Ecuador y Perú después.

Entregables:

- País CO/EC/PE.
- Moneda local por país.
- Plantillas comerciales por país.
- Clientes ancla por sector.

Métrica: clientes activos en 2 países.

## Qué NO hacer

- No vender como app barata.
- No regalar ilimitado.
- No esconder la salida de datos.
- No depender solo de WhatsApp outbound.
- No construir features sin conectarlas al cierre/pago/retención.
- No perseguir enterprise gigante antes de cerrar medianas con dolor claro.

## North Star Metric

> Entregas cerradas con evidencia verificable por mes.

Métricas secundarias:

- Empresas activas semanales.
- Conductores activos.
- Soportes descargados.
- Novedades resueltas.
- Uso de límites.
- Conversión a plan pago.
- Retención mes 2.
