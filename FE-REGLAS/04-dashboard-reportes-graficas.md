# 04 · Dashboards, reportes, gráficas y mapas

## Objetivo

Los dashboards de KargaX deben funcionar como una sala de control logística: mostrar lo urgente, explicar el estado de la operación y permitir actuar sin saturar. La UI debe transmitir control empresarial, no “landing page con métricas”.

## Regla central

Cada dashboard debe responder en menos de 5 segundos:

1. ¿Qué está pasando?
2. ¿Qué está en riesgo?
3. ¿Qué cambió?
4. ¿Qué acción debo tomar?

## Layouts recomendados

### Móvil

- Header compacto.
- Alertas críticas arriba.
- KPIs en 1 columna.
- Máximo 2-4 KPIs iniciales.
- Filtros plegables.
- Gráficas apiladas.
- Mapas con altura controlada.
- Tablas convertidas a cards.
- CTAs principales visibles.
- No mostrar 10 gráficas al mismo tiempo.

### Tablet

- KPIs en 2 columnas.
- Gráficas principales en 1 o 2 columnas.
- Sidebar colapsable.
- Tablas compactas.
- Filtros parcialmente visibles.
- Mapa con altura media.

### Desktop

- KPIs en 3 o 4 columnas.
- Gráficas en layout 2 columnas.
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

## Dashboard principal

Debe priorizar:

1. Alertas operativas críticas.
2. Envíos/rutas activas.
3. Evidencia pendiente.
4. Novedades abiertas.
5. Wallet/liquidaciones pendientes si el rol tiene permiso.
6. Rendimiento de operación.

No debe priorizar métricas vanidosas sin acción.

### Layout sugerido desktop

```text
┌───────────────────────────────────────────────────────────┐
│ Header: módulo, fechas, filtros, acción principal          │
├───────────┬───────────┬───────────┬───────────┤
│ KPI 1     │ KPI 2     │ KPI 3     │ KPI 4     │
├───────────────────────────────┬───────────────────────────┤
│ Gráfica principal             │ Alertas / actividad        │
├───────────────────────────────┼───────────────────────────┤
│ Mapa / tracking               │ Evidencia pendiente        │
├───────────────────────────────────────────────────────────┤
│ Tabla desktop / cards según viewport                       │
└───────────────────────────────────────────────────────────┘
```

## Dashboard de empresa

- Mostrar salud general de operación.
- Separar operación privada y marketplace si ambos están activos.
- Mostrar consumo de plan si afecta retención/billing.
- Mostrar evidencias pendientes o incompletas.
- Mostrar top riesgos: retrasos, novedades, liquidaciones pendientes.

## Dashboard marketplace

Debe sentirse como red de oportunidades:

- Rutas públicas disponibles.
- Ofertas recibidas/enviadas.
- Conversión de ofertas.
- Conductores/proveedores marketplace.
- Evidencia marketplace pendiente.
- Liquidaciones marketplace.

No mezclar con flota privada.

## Dashboard flota privada

Debe sentirse como control interno:

- Rutas propias activas.
- Conductores propios.
- Estado de vehículos si aplica.
- Evidencia privada.
- Bodegas propias.
- Costos internos.

No mostrar ofertas marketplace como si fueran rutas propias.

## Cards KPI

Cada KPI debe tener:

- Título claro.
- Valor principal.
- Tendencia o delta.
- Contexto temporal.
- Estado/alerta si aplica.
- Acción o link si el KPI requiere seguimiento.

### Ejemplo de estructura

```tsx
<KpiCard
  title="Evidencias pendientes"
  value="18"
  trend="+4 vs ayer"
  context="Últimas 24 horas"
  status="riesgo"
  actionLabel="Revisar evidencias"
/>
```

### Reglas responsive KPI

- Móvil: 1 columna.
- Tablet: 2 columnas.
- Desktop: 3 o 4 columnas.
- Ultra wide: máximo 4 KPIs principales; usar paneles adicionales para comparación.

```css
.kx-kpi-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
}

@media (width >= 48rem) {
  .kx-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width >= 64rem) {
  .kx-kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width >= 80rem) {
  .kx-kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
```

## Gráficas

KargaX ya tiene `recharts`. Reutilizarlo antes de instalar otra librería.

### Reglas obligatorias

- Mantener legibilidad en móvil.
- Leyendas abajo en móvil.
- Tooltips accesibles y con formato claro.
- Ejes con labels cortos.
- No mostrar 12 series de colores en móvil.
- No depender solo de color para diferenciar estados; usar labels, patrones o tooltips.
- Altura mínima controlada: 240px móvil, 280-360px desktop.
- Skeleton con altura fija para evitar CLS.
- No renderizar gráficas pesadas si están fuera de viewport y no aportan.

### Mobile chart rules

- Mostrar una gráfica por bloque.
- Usar tabs/accordion para alternar entre métricas.
- Ocultar detalles secundarios, no datos críticos.
- Tooltips deben ser táctiles.
- Si una gráfica necesita mucha comparación, convertir a resumen + link a reporte.

### Desktop chart rules

- Gráficas 2 columnas si comparan conceptos distintos.
- Si son dependientes, usar layout vertical con narrativa.
- Filtros visibles y aplicados de forma clara.
- No agrandar gráfica solo por ancho ultra wide.

## Reportes financieros

Riesgo alto si toca wallet, billing o liquidaciones.

Reglas:

- Moneda visible: COP u otra según contexto.
- Valores alineados a la derecha.
- Signos claros para egresos/ingresos.
- Estado textual: “Pagado”, “Pendiente”, “Fallido”, “En revisión”.
- Fecha y responsable visibles.
- No usar abreviaturas financieras confusas.
- Diferenciar wallet privado vs wallet marketplace.
- Exportación solo si datos y permisos lo permiten.

## Reportes operativos

Deben priorizar:

- Cumplimiento de entregas.
- Evidencias completas/incompletas.
- Novedades por tipo.
- Retrasos.
- Rutas por conductor.
- Bodegas con actividad o riesgo.

## Reportes de rutas

- Mapa o listado de tramos si aporta.
- Origen/destino visibles.
- Estado por tramo.
- Tiempo estimado vs real.
- Evidencia asociada.
- Novedades.

## Reportes de conductores

- Ranking con contexto, no gamificación superficial.
- Entregas completadas.
- Evidencias correctas.
- Novedades.
- Tiempo promedio.
- Liquidaciones si el rol tiene permiso.

## Mapas y tracking

### Reglas obligatorias

- Altura mínima móvil: `280px`; máxima inicial: `45dvh` salvo pantalla dedicada.
- Desktop: `360px - 560px` según layout.
- El mapa no debe bloquear el scroll de la página en móvil.
- Controles del mapa deben medir 44px en móvil.
- Lazy load si el mapa no es crítico en el primer render.
- Skeleton con misma altura antes de cargar.
- Error state: “No pudimos cargar el mapa. Puedes seguir viendo la ruta en lista.”
- Fallback lista de paradas si el mapa falla.

```css
.kx-map-shell {
  min-height: 17.5rem;
  height: min(45dvh, 28rem);
  overflow: hidden;
  border-radius: var(--radius-2xl);
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
}

@media (width >= 64rem) {
  .kx-map-shell {
    height: clamp(22rem, 42vh, 35rem);
  }
}
```

## Alertas operativas

Las alertas críticas deben aparecer arriba o en una zona prioritaria.

Tipos:

- Retraso crítico.
- Evidencia incompleta.
- Novedad sin resolver.
- Liquidación fallida.
- Pago/billing bloqueado.
- Riesgo de permisos/rol.

Cada alerta debe tener:

- Título.
- Descripción corta.
- Severidad textual.
- Acción.
- Timestamp si aplica.

## Filtros de dashboards

### Móvil

- Filtros plegables en drawer/bottom sheet.
- Chips activos visibles.
- Rango de fechas táctil.
- Botón aplicar sticky.

### Desktop

- Filtros visibles arriba.
- Rango de fechas claro.
- Grupos por operación, estado, responsable, bodega, tipo.
- Botón limpiar.

## Estados vacíos

Un dashboard vacío debe explicar qué hacer.

Ejemplo operación:

> Aún no hay rutas activas. Crea un envío privado o revisa oportunidades en marketplace.

Ejemplo evidencia:

> No hay evidencias pendientes para este rango. Cambia la fecha o revisa rutas completadas.

Ejemplo wallet:

> No hay movimientos para este filtro. Revisa el rango de fechas o el tipo de wallet seleccionado.

## Performance específica

- No cargar mapas hasta que se necesiten si no son above-the-fold.
- No renderizar tablas de cientos de filas sin paginación/virtualización.
- Usar skeletons con tamaño reservado.
- Evitar animaciones en gráficas móviles de bajo rendimiento.
- Respetar `prefers-reduced-motion`.
- Memoizar cálculos pesados de reportes.
- Evitar que filtros disparen consultas en cada tecla sin debounce.

## Checklist dashboard

- [ ] KPIs 1 columna móvil, 2 tablet, 3-4 desktop.
- [ ] Alertas críticas arriba.
- [ ] Filtros plegables en móvil.
- [ ] Gráficas legibles y no saturadas.
- [ ] Leyendas abajo en móvil.
- [ ] Mapas con altura controlada.
- [ ] Mapas no bloquean scroll móvil.
- [ ] Números financieros con moneda y jerarquía.
- [ ] Empty state dice qué hacer.
- [ ] Loading usa skeleton estable.
- [ ] Error state permite reintentar o usar fallback.
- [ ] Ultra wide usa max-width/paneles útiles.
