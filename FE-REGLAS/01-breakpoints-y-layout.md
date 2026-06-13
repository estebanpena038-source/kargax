# 01 · Breakpoints y layout oficial KargaX

## Principio base

KargaX se diseña **mobile-first**. La vista base debe funcionar en 320px. Desde ahí se agregan mejoras progresivas para tablet, laptop, desktop y ultra wide.

Regla operativa: **el layout se adapta al contenido, no solo a la pantalla**. Si una tabla, card, KPI, mapa o formulario se rompe antes del siguiente breakpoint oficial, se permite usar container queries o un breakpoint local justificado.

## Breakpoints oficiales

| Rango | Nombre KargaX | Uso principal |
|---:|---|---|
| 320px - 374px | Celular muy pequeño | Operación mínima, una columna, CTAs táctiles, máxima síntesis. |
| 375px - 430px | Celular estándar | Experiencia móvil principal. |
| 431px - 639px | Celular grande | Cards más cómodas, filtros plegables. |
| 640px - 767px | Phablet / tablet pequeña | 1-2 columnas según contenido. |
| 768px - 1023px | Tablet | Sidebar colapsable, grids 2 columnas, tablas compactas. |
| 1024px - 1279px | Laptop pequeña | Sidebar estable o colapsado, dashboard mixto. |
| 1280px - 1535px | Desktop normal | Layout empresarial estándar. |
| 1536px - 1919px | Desktop grande | Comparación operativa y paneles laterales. |
| 1920px o más | Ultra wide | Max-width fuerte, no estirar infinito. |

## Reglas por rango

### 320px - 374px · Celular muy pequeño

- **Layout:** una sola columna. Nada crítico debe depender de hover.
- **Padding horizontal:** `12px` mínimo; `clamp(0.75rem, 4vw, 1rem)` recomendado.
- **Ancho máximo:** `width: 100%`; no usar `min-width` mayor a `320px` en componentes internos.
- **Columnas:** 1 columna para todo: cards, KPIs, formularios y gráficos.
- **Cards:** ancho completo, contenido priorizado. Máximo 2 acciones visibles: principal + menú.
- **Sidebar:** oculto como layout permanente. Debe abrir como drawer.
- **Tablas:** convertir a cards/listas. Si una tabla financiera requiere columnas, usar scroll interno con indicador.
- **Formularios:** inputs 100%, labels visibles, secciones cortas, stepper si hay más de 8 campos.
- **Modales:** preferir drawer/bottom sheet. Si es modal, `max-height: calc(100dvh - 2rem)` y scroll interno.
- **Tipografía:** body 16px ideal; texto secundario nunca menor a 14px. Títulos con `clamp()`.
- **Spacing:** `gap: 0.75rem` entre bloques; evitar márgenes manuales laterales.
- **Overflow:** prohibido `width: 100vw` en hijos dentro de contenedores con padding; usar `width: 100%`.
- **Dashboards:** mostrar alertas críticas, 2-4 KPIs máximos, gráficas apiladas.
- **Navegación:** header compacto con título de módulo, botón menú y acción principal si aplica.
- **Botones:** alto mínimo 44px; ancho completo cuando sea CTA principal.

### 375px - 430px · Celular estándar

- **Layout:** una columna con secciones claras.
- **Padding horizontal:** `16px` recomendado.
- **Ancho máximo:** `100%`; cards no deben tener width fijo.
- **Columnas:** 1 columna. Solo datos tipo “chips” pueden fluir en 2 columnas si no se rompen.
- **Cards:** mostrar estado, origen, destino, fecha, responsable, valor y CTA.
- **Sidebar:** drawer con overlay; cierre por Escape, overlay y botón.
- **Tablas:** card-list por defecto para envíos, rutas, wallet, liquidaciones y usuarios.
- **Formularios:** 1 columna; grupos colapsables si son largos.
- **Modales:** usar Radix Dialog o Vaul Drawer, no modal CSS casero sin accesibilidad.
- **Tipografía:** `h1 clamp(1.5rem, 7vw, 2rem)`, `h2 clamp(1.25rem, 5vw, 1.5rem)`.
- **Spacing:** `gap` consistente: 12-16px.
- **Dashboards:** KPIs 1 columna, leyendas de gráficas abajo.
- **Navegación:** breadcrumbs abreviados; mostrar título actual siempre.
- **Botones:** evitar grupos horizontales de más de 2 botones.

### 431px - 639px · Celular grande

- **Layout:** una columna amplia; cards pueden incluir subgrid interno.
- **Padding horizontal:** `16px - 20px`.
- **Ancho máximo:** `100%` con `max-width` solo en formularios muy largos.
- **Columnas:** 1 columna; cards de métricas compactas pueden usar 2 columnas solo si no pierden legibilidad.
- **Cards:** acciones secundarias en menú contextual.
- **Sidebar:** drawer.
- **Tablas:** card-list; scroll interno solo en tablas financieras con columnas necesarias.
- **Formularios:** 1 columna; secciones con títulos claros.
- **Modales:** drawer para acciones de edición; modal centrado solo para confirmaciones cortas.
- **Tipografía:** fluida; evitar títulos de más de 2 líneas en headers.
- **Spacing:** `gap: 1rem`.
- **Dashboards:** no más de 1 gráfica principal visible antes del primer scroll largo.
- **Navegación:** header sticky si la operación requiere acceso constante a acciones.
- **Botones:** CTA principal full width o sticky bottom si el flujo es crítico.

### 640px - 767px · Phablet / tablet pequeña

- **Layout:** 1-2 columnas por contenido.
- **Padding horizontal:** `20px - 24px`.
- **Ancho máximo:** `min(100%, 720px)` para formularios; dashboards pueden usar full width.
- **Columnas:** KPIs 2 columnas; cards operativas 2 si cada card conserva jerarquía.
- **Cards:** min card width `minmax(min(100%, 17rem), 1fr)`.
- **Sidebar:** drawer o rail colapsado según ruta.
- **Tablas:** tablas compactas con columnas secundarias ocultas; acciones en menú.
- **Formularios:** 1-2 columnas solo para campos cortos relacionados.
- **Modales:** ancho `min(92vw, 640px)`; scroll interno.
- **Tipografía:** títulos `clamp()`; body 16px.
- **Spacing:** `gap: 1rem - 1.25rem`.
- **Dashboards:** 2 columnas para KPIs; gráficas aún mayormente apiladas.
- **Navegación:** breadcrumb puede mostrarse si no compite con CTA.
- **Botones:** grupos horizontales permitidos si cada botón conserva 44px.

### 768px - 1023px · Tablet

- **Layout:** 2 columnas para dashboards y formularios; main con `min-width: 0`.
- **Padding horizontal:** `24px`.
- **Ancho máximo:** `min(100%, 960px)` para contenido principal; dashboards pueden usar `100%`.
- **Columnas:** KPIs 2 columnas; dashboards 1-2 columnas.
- **Cards:** densidad media, headers compactos.
- **Sidebar:** colapsable. No debe tapar contenido.
- **Tablas:** mostrar columnas críticas; ocultar columnas secundarias en detalles expandibles.
- **Formularios:** 2 columnas para campos cortos, 1 columna para direcciones, descripciones, evidencia.
- **Modales:** `max-width: 720px`; no más de 80-85dvh sin scroll interno.
- **Tipografía:** títulos medianos; evitar hero marketing dentro de app operativa.
- **Spacing:** `gap: 1.25rem`.
- **Dashboards:** filtros parcialmente visibles; mapas con altura controlada.
- **Navegación:** sidebar rail o colapsado + header con título.
- **Botones:** toolbars pueden envolver (`flex-wrap`).

### 1024px - 1279px · Laptop pequeña

- **Layout:** sidebar estable si hay espacio; main no debe quedar comprimido.
- **Padding horizontal:** `24px - 32px`.
- **Ancho máximo:** `min(100%, 1120px)`.
- **Columnas:** KPIs 3 columnas; dashboards 2 columnas.
- **Cards:** evitar cards demasiado altas por falta de ancho.
- **Sidebar:** fijo o colapsable; contenido con margen/área calculada.
- **Tablas:** tabla completa con scroll interno horizontal si hay muchas columnas.
- **Formularios:** 2 columnas, máximo 3 para campos muy simples.
- **Modales:** `max-width: 800px`; formularios complejos deberían ser página o drawer.
- **Tipografía:** títulos `1.75rem - 2.25rem`.
- **Spacing:** `gap: 1.25rem - 1.5rem`.
- **Dashboards:** mapa + actividad reciente lado a lado si aporta operación.
- **Navegación:** breadcrumbs visibles.
- **Botones:** toolbar horizontal con acciones secundarias agrupadas.

### 1280px - 1535px · Desktop normal

- **Layout:** estándar SaaS B2B. Sidebar estable, header claro, contenido amplio.
- **Padding horizontal:** `32px`.
- **Ancho máximo:** `min(100%, 1280px)` o `1360px` en dashboards complejos.
- **Columnas:** KPIs 4 columnas; dashboard 2 columnas; cards `auto-fit`.
- **Cards:** usar densidad profesional, no agrandar solo por espacio.
- **Sidebar:** expandido con grupos claros.
- **Tablas:** completas, sticky header si hay scroll interno.
- **Formularios:** 2 columnas por defecto; 3 columnas solo para filtros o campos cortos.
- **Modales:** ancho máximo según contenido; confirmaciones 420-520px, forms 720-900px.
- **Tipografía:** jerarquía sobria.
- **Spacing:** `gap: 1.5rem`.
- **Dashboards:** 4 KPIs arriba, gráficas en 2 columnas, filtros visibles.
- **Navegación:** grupos por operación privada, marketplace, finanzas, administración.
- **Botones:** acciones masivas visibles si aplican.

### 1536px - 1919px · Desktop grande

- **Layout:** contenedor centrado + paneles útiles.
- **Padding horizontal:** `32px - 40px`.
- **Ancho máximo:** `1440px - 1600px` según vista.
- **Columnas:** KPIs 4 columnas; comparativas 3 columnas si aportan.
- **Cards:** no estirar texto largo; usar panel secundario para alertas, resumen o actividad.
- **Sidebar:** estable; puede tener modo compacto si el usuario lo elige.
- **Tablas:** no estirar columnas de texto; definir anchos mínimos y máximos.
- **Formularios:** 2-3 columnas con secciones; evitar líneas demasiado largas.
- **Modales:** no superar `min(90vw, 960px)` salvo reportes específicos.
- **Tipografía:** no crecer por viewport más allá del clamp máximo.
- **Spacing:** `gap: 1.5rem - 2rem`.
- **Dashboards:** comparar rutas, conductores, wallet o performance operativa.
- **Navegación:** jerarquía completa visible.
- **Botones:** toolbar estable; no dispersar acciones críticas.

### 1920px o más · Ultra wide

- **Layout:** nunca estirar infinito. Usar `max-width` y composición por paneles.
- **Padding horizontal:** `40px` dentro de contenedor, no `vw` excesivo.
- **Ancho máximo:** `1600px` para app operativa; hasta `1760px` para centros de monitoreo con mapas/reportes.
- **Columnas:** no más de 4 KPIs principales; usar espacio para comparación real.
- **Cards:** evitar cards vacías gigantes; agregar paneles de alertas, backlog, mapa o actividad.
- **Sidebar:** estable; contenido centrado o con panel contextual.
- **Tablas:** mantener ancho legible; columnas con max width y truncamiento controlado.
- **Formularios:** contenedor máximo 960-1120px; no expandir inputs de texto a 1600px.
- **Modales:** centrados con max-width; para flujos largos usar página dedicada.
- **Tipografía:** clamp máximo estricto.
- **Spacing:** no aumentar indefinidamente.
- **Dashboards:** usar ultra wide para “control room”: mapa + KPIs + alertas + actividad, no para inflar cards.
- **Navegación:** sidebar premium con grupos, badges y estado activo.
- **Botones:** mantener cerca del contenido relacionado.

## Reglas obligatorias globales

- Diseñar mobile-first.
- Nunca usar widths fijos sin `max-width` o fallback responsive.
- Evitar `width: 1200px`, `min-width: 900px`, `left: 280px` rígidos y similares.
- Usar `width: 100%` y `max-width` cuando aplique.
- Usar CSS Grid con `repeat(auto-fit, minmax())` para cards.
- Usar Flexbox para alineación simple, toolbars y distribución de acciones.
- Usar `clamp()` para títulos, spacing fluido y alturas de hero/headers.
- Usar `gap` en vez de márgenes manuales inconsistentes.
- No permitir `overflow-x` en `body`.
- No esconder información crítica solo para que “quepa”.
- En móviles, priorizar estado, ruta, fecha, responsable, valor y acción principal.
- En desktop, aprovechar espacio sin estirar demasiado el contenido.
- En ultra wide, usar `max-width` para que la interfaz no se vea vacía o rota.
- Los layouts deben adaptarse por contenido, no solo por pantalla.

## Utilidades CSS recomendadas

Estas clases pueden vivir en `globals.css` o en un archivo de utilidades si se decide organizar el design system. Antes de agregarlas, revisar si ya existe una variante equivalente.

```css
.kx-page {
  min-width: 0;
  width: 100%;
  min-height: 100dvh;
  padding-block: clamp(1rem, 2vw, 2rem);
}

.kx-container {
  width: min(100% - clamp(1.5rem, 5vw, 5rem), 1440px);
  margin-inline: auto;
}

.kx-container--wide {
  width: min(100% - clamp(1.5rem, 5vw, 5rem), 1600px);
  margin-inline: auto;
}

.kx-section {
  display: grid;
  gap: clamp(1rem, 2vw, 1.5rem);
  min-width: 0;
}

.kx-stack {
  display: flex;
  flex-direction: column;
  gap: var(--kx-stack-gap, 1rem);
  min-width: 0;
}

.kx-grid {
  display: grid;
  gap: clamp(1rem, 2vw, 1.5rem);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  min-width: 0;
}

.kx-card-grid {
  display: grid;
  gap: clamp(0.875rem, 2vw, 1.25rem);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
}

.kx-dashboard-grid {
  display: grid;
  gap: clamp(1rem, 2vw, 1.5rem);
  grid-template-columns: minmax(0, 1fr);
}

@media (width >= 64rem) {
  .kx-dashboard-grid {
    grid-template-columns: minmax(0, 2fr) minmax(20rem, 1fr);
  }
}

.kx-table-shell {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.kx-table-shell table {
  width: 100%;
  min-width: max-content;
}

.kx-mobile-card-list {
  display: grid;
  gap: 0.875rem;
}

.kx-modal {
  width: min(calc(100vw - 2rem), var(--kx-modal-max, 42rem));
  max-height: min(86dvh, 52rem);
  overflow: auto;
}

.kx-drawer {
  width: min(100vw, 28rem);
  max-width: 100%;
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

## Ejemplos con `clamp()`, `min()`, `max()` y safe areas

```css
.kx-page-title {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.kx-page-description {
  font-size: clamp(0.95rem, 1.4vw, 1.05rem);
  max-width: 72ch;
}

.kx-mobile-sticky-action {
  position: sticky;
  bottom: 0;
  padding: 0.75rem 1rem max(0.75rem, env(safe-area-inset-bottom));
  background: color-mix(in oklab, var(--color-surface) 94%, transparent);
  backdrop-filter: blur(12px);
}

.kx-report-shell {
  width: min(100%, 1600px);
  margin-inline: auto;
}

.kx-chart-card {
  min-height: max(18rem, 40vh);
}
```

## Ejemplos con `minmax()`, `auto-fit` y `auto-fill`

```css
/* Cards operativas: se acomodan según ancho disponible. */
.kx-load-card-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
}

/* Filtros compactos: auto-fill conserva tracks y funciona bien para inputs repetidos. */
.kx-filter-grid {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
}

/* Reportes: área principal + panel contextual en desktop. */
.kx-report-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(0, 1fr);
}

@media (width >= 80rem) {
  .kx-report-grid {
    grid-template-columns: minmax(0, 2.2fr) minmax(20rem, 0.8fr);
  }
}
```

## Container queries para componentes reutilizables

Usar container queries cuando el componente se renderiza en contenedores con anchos distintos: cards de KPI dentro de dashboard, panel de wallet dentro de tabs, card de envío en columna lateral o principal.

```css
.kx-kpi-container {
  container: kx-kpi / inline-size;
}

.kx-kpi-card {
  display: grid;
  gap: 0.75rem;
}

@container kx-kpi (width >= 28rem) {
  .kx-kpi-card {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }
}

.kx-route-card-container {
  container-type: inline-size;
}

@container (width >= 36rem) {
  .kx-route-card {
    grid-template-columns: minmax(0, 1.4fr) minmax(12rem, 0.6fr);
  }
}
```

## Media queries limpias

Usar sintaxis moderna cuando el tooling lo soporte:

```css
@media (width >= 40rem) {
  .kx-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width >= 80rem) {
  .kx-kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Reglas anti-overflow

- Todo grid/flex hijo debe permitir compresión: `min-width: 0`.
- Evitar `w-screen` dentro de layouts con sidebar o padding.
- Tablas grandes siempre dentro de `.kx-table-shell` o transformadas en cards.
- Imágenes, SVG, canvas y mapas con `max-width: 100%`.
- Textos largos con `overflow-wrap: anywhere` o truncamiento controlado.
- Badges con `white-space: nowrap` solo si su contenedor puede hacer wrap.
- En grids, usar `minmax(0, 1fr)` para evitar que contenido largo rompa columnas.
- No usar márgenes negativos para “alinear” contenido principal con sidebar.

## Reglas de layout para dashboards

- Móvil: 1 columna, alertas arriba, KPIs priorizados, filtros plegables.
- Tablet: KPIs 2 columnas, gráficos 1-2 columnas, tablas compactas.
- Desktop: KPIs 3-4 columnas, gráficos 2 columnas, tabla completa.
- Ultra wide: contenedor máximo, paneles laterales útiles, comparación operativa.

## Reglas de navegación por breakpoint

- `< 768px`: drawer móvil; header compacto; sidebar no ocupa espacio permanente.
- `768px - 1023px`: sidebar colapsable/rail; header con título y breadcrumbs opcionales.
- `>= 1024px`: sidebar estable; contenido no debe quedar debajo.
- `>= 1536px`: sidebar + contenedor máximo; evitar líneas de texto largas.

## Criterio de aceptación de layout

Una vista pasa layout QA si:

- Funciona en 320px sin overflow global.
- En tablet no hay columnas aplastadas.
- En desktop el espacio se usa para comparar y operar, no para agrandar vacío.
- En ultra wide el contenido mantiene max-width y jerarquía.
- No se perdió información crítica por ocultamiento responsive.
