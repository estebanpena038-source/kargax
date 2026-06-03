# 04 · Dashboards, reportes, gráficas y mapas KargaX

## Objetivo

Definir cómo deben verse y comportarse dashboards, KPIs, reportes, mapas, tracking y gráficas en KargaX. El dashboard no es decoración: debe ayudar a una empresa logística a decidir rápido, detectar riesgo, controlar costos y operar mejor.

## Principios obligatorios

- En móvil los KPIs deben ir en 1 columna.
- En tablet los KPIs deben ir en 2 columnas.
- En desktop los KPIs deben ir en 3 o 4 columnas.
- En ultra wide no expandir infinitamente; usar `max-width`.
- Las gráficas deben mantener legibilidad.
- Las leyendas deben moverse abajo en móvil.
- Los filtros deben plegarse en móvil.
- Los filtros de fecha deben ser fáciles de usar en táctil.
- Los números financieros deben tener jerarquía visual clara.
- Los mapas deben tener altura mínima controlada.
- Los mapas no deben bloquear el scroll de la página en móvil.
- Las alertas críticas deben verse arriba o en zona prioritaria.
- No saturar el dashboard con demasiadas métricas.
- Cada KPI debe tener título, valor, tendencia y contexto.
- Los estados vacíos deben explicar qué hacer.
- En móvil no mostrar 10 gráficas al mismo tiempo; priorizar.
- En desktop grande usar espacio para comparar información útil, no para agrandar cards vacías.

## Layout recomendado por dispositivo

### Móvil

- Header compacto.
- Alertas críticas arriba.
- KPIs en 1 columna.
- Filtros plegables.
- Gráficas apiladas.
- Mapas con altura controlada.
- Tablas convertidas a cards.
- CTAs principales visibles.

Prioridad visual móvil:

1. Alertas críticas.
2. Estado operacional del día.
3. Rutas/envíos pendientes.
4. Wallet o liquidación pendiente si aplica al rol.
5. CTA principal.

### Tablet

- KPIs en 2 columnas.
- Gráficas principales en 1 o 2 columnas.
- Sidebar colapsable.
- Tablas compactas.
- Filtros parcialmente visibles.
- Mapas de 320px a 440px de alto.

### Desktop

- KPIs en 4 columnas.
- Gráficas en layout de 2 columnas.
- Mapa y actividad reciente lado a lado.
- Filtros visibles.
- Tablas completas.
- Navegación estable.

### Ultra wide

- Contenedor máximo.
- Paneles laterales útiles.
- Comparaciones de rutas, conductores o finanzas.
- No estirar tablas de forma absurda.
- Usar espacio para comparación, no para vacío visual.

## KPIs

Cada KPI debe incluir:

- Título claro.
- Valor principal.
- Tendencia.
- Contexto temporal.
- Estado si aplica.
- Acción o link si el KPI exige seguimiento.

Ejemplo de KPI correcto:

- `Envíos en riesgo`.
- `12`.
- `+3 vs ayer`.
- `Últimas 24 horas`.
- CTA: `Ver rutas afectadas`.

Evitar:

- Números sin contexto.
- Solo color para indicar riesgo.
- Métricas vanidosas que no ayudan a operar.
- Cards gigantes con poco dato.

## Dashboards por módulo

### Dashboard principal

Debe responder:

- ¿Qué está pasando hoy?
- ¿Qué está en riesgo?
- ¿Qué requiere acción?
- ¿Cómo está la operación vs días anteriores?
- ¿Hay pagos/evidencia/liquidaciones pendientes?

### Dashboard de empresa

Priorizar:

- Envíos activos.
- Rutas en riesgo.
- Evidencia pendiente.
- Costos logísticos.
- Cumplimiento de entrega.
- Novedades abiertas.

### Dashboard marketplace

Priorizar:

- Rutas públicas activas.
- Ofertas recibidas.
- Cargas sin asignar.
- Conductores/proveedores disponibles.
- Comisiones y liquidaciones marketplace.

### Dashboard de flota privada

Priorizar:

- Vehículos activos.
- Conductores propios.
- Rutas internas.
- Evidencia privada.
- Mantenimiento si aplica.
- Desempeño por conductor.

### Wallet y billing

Priorizar:

- Saldo o estado financiero.
- Pendientes de liquidación.
- Pagos recientes.
- Riesgos/errores de pago.
- Próximo cobro o límite de plan.

Marcar todo cambio como `RISK HIGH` si puede afectar interpretación financiera.

## Gráficas

### Reglas de legibilidad

- No usar más de 2-3 series en móvil.
- Leyenda abajo en móvil.
- Tooltips legibles y táctiles.
- Ejes con labels claros.
- Valores financieros formateados.
- Evitar colores muy similares.
- No depender solo del color.
- Mostrar empty state si no hay datos.

### Tipos recomendados

- Línea: evolución de envíos, costos, cumplimiento.
- Barra: comparación por ruta, conductor, cliente o bodega.
- Dona: distribución de estados, solo si no hay demasiadas categorías.
- Área: tendencia acumulada, ingresos/costos.
- Tabla + mini chart: finanzas, wallet o liquidaciones.

### No usar gráfica cuando

- Un número con tendencia comunica mejor.
- Hay pocos datos.
- El usuario necesita acción, no análisis.
- La gráfica no cabe en móvil y no aporta valor.

## Mapas y tracking

### Reglas obligatorias

- Altura mínima móvil: 280px.
- Altura recomendada desktop: 420px-640px.
- No bloquear scroll móvil.
- Cargar mapa solo cuando sea necesario.
- Mostrar fallback si falla la ubicación.
- Agrupar marcadores si hay muchos.
- Incluir lista alternativa para accesibilidad.
- No ocultar estado/ruta bajo el mapa.

### Tracking móvil

- Mapa arriba solo si el usuario necesita ubicación inmediata.
- Debajo: estado, ETA, conductor, última actualización y CTA.
- Controles táctiles grandes.
- Evitar zoom accidental que bloquee navegación.

### Tracking desktop

- Mapa + panel de detalle.
- Actividad reciente lateral.
- Filtros visibles.
- Estados por ruta.

## Reportes

### Reportes operativos

Deben incluir:

- Periodo.
- Filtros aplicados.
- Métrica principal.
- Comparación.
- Detalle por ruta/conductor/bodega.
- Exportación si aplica.

### Reportes financieros

Deben incluir:

- Moneda.
- Periodo.
- Total.
- Desglose.
- Estado.
- Origen de datos.
- Advertencia si hay registros pendientes.

### Reportes de rutas

Deben incluir:

- Cumplimiento.
- Tiempo promedio.
- Novedades.
- Evidencia.
- Costos.
- Responsable.

## Alertas operativas

Las alertas críticas deben estar arriba o en zona prioritaria:

- Ruta retrasada.
- Evidencia incompleta.
- Liquidación en riesgo.
- Pago fallido.
- Conductor sin asignar.
- Novedad crítica.
- Error de sincronización.

Cada alerta debe incluir:

- Qué pasó.
- Impacto.
- Módulo afectado.
- Siguiente acción.
- Responsable si aplica.

## Estados vacíos

Ejemplos:

- `Aún no hay envíos activos. Crea una solicitud de carga para iniciar operación.`
- `No hay reportes financieros para este periodo. Ajusta el rango de fechas.`
- `No hay rutas marketplace disponibles. Publica una carga o revisa filtros.`

## Performance

- No renderizar todas las gráficas si no son visibles.
- Lazy load para mapas.
- Skeletons para KPIs y tablas.
- Evitar animaciones pesadas en dashboards.
- Reducir puntos en gráficas largas.
- Cuidar re-render de Recharts.
- Usar React Query para estados de carga, error y cache.

## Checklist QA dashboard

- [ ] KPIs en 1 columna móvil.
- [ ] KPIs en 2 columnas tablet.
- [ ] KPIs en 3-4 columnas desktop.
- [ ] Ultra wide usa max-width.
- [ ] Gráficas legibles en 320px.
- [ ] Leyendas no se montan.
- [ ] Filtros plegables en móvil.
- [ ] Mapas no bloquean scroll.
- [ ] Hay loading, empty y error.
- [ ] Números financieros están formateados.
- [ ] Alertas críticas son visibles arriba.
- [ ] No hay métricas sin contexto.

## Criterio de aceptación

Un dashboard KargaX está terminado cuando permite entender la operación en menos de 10 segundos, prioriza riesgos, funciona en móvil y desktop, y no sacrifica legibilidad por estética.
