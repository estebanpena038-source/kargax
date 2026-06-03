# 01 · Breakpoints y layout responsive KargaX

## Objetivo

Este documento define la escala oficial de breakpoints y las reglas de layout para que cada vista de KargaX funcione desde celulares pequeños hasta pantallas ultra wide. KargaX debe diseñarse **mobile-first**, sin overflow horizontal, sin anchos fijos peligrosos y con jerarquía logística clara.

## Breakpoints oficiales

| Rango | Dispositivo | Layout esperado |
|---|---|---|
| 320px - 374px | Celular muy pequeño | 1 columna, padding mínimo, solo información crítica |
| 375px - 430px | Celular estándar | 1 columna cómoda, cards logísticas, CTA visible |
| 431px - 639px | Celular grande | 1 columna amplia o 2 columnas solo para contenido corto |
| 640px - 767px | Phablet / tablet pequeña | 1-2 columnas, filtros plegables, sidebar drawer |
| 768px - 1023px | Tablet | 2 columnas, sidebar colapsable, tablas compactas |
| 1024px - 1279px | Laptop pequeña | Layout estable, sidebar visible o compacto, tablas completas controladas |
| 1280px - 1535px | Desktop normal | Dashboard completo, 3-4 columnas KPI, filtros visibles |
| 1536px - 1919px | Desktop grande | Contenedor con max-width, paneles útiles, comparación operacional |
| 1920px+ | Ultra wide | No estirar infinito; usar max-width y paneles laterales reales |

## Principios obligatorios

- Diseñar primero para `320px`.
- Nunca usar `width: 1200px`, `min-width: 900px` o valores fijos sin `max-width` y fallback responsive.
- Usar `width: 100%` + `max-width` cuando aplique.
- Usar CSS Grid con `repeat(auto-fit, minmax())` para cards.
- Usar Flexbox para alineación simple, no para grids complejos.
- Usar `clamp()` para títulos, spacing y tamaños fluidos.
- Usar `gap` en vez de márgenes manuales inconsistentes.
- No permitir `overflow-x` global en `body`.
- No esconder información crítica solo para que “quepa”.
- En móvil priorizar: estado, origen, destino, fecha, responsable, valor y acción principal.
- En desktop aprovechar espacio con comparación útil, no agrandar cards vacías.
- En ultra wide usar `max-width` para que la interfaz no se vea rota.
- Los layouts deben adaptarse por contenido, no solo por pantalla.

## Reglas por rango

### 320px - 374px · celular muy pequeño

- Layout: 1 columna estricta.
- Padding horizontal: `12px` a `16px`.
- Contenedor: `width: 100%`, sin `max-width` rígido.
- Cards: una debajo de otra; evitar cards con 3+ columnas internas.
- Sidebar: prohibido permanente; usar drawer.
- Tablas: convertir a cards o lista compacta.
- Formularios: inputs 100%, labels visibles, máximo 1 sección visible por bloque.
- Modales: `width: calc(100vw - 24px)`, `max-height: calc(100dvh - 24px)`, scroll interno.
- Tipografía: base 16px, secundarios mínimo 14px.
- Botones: mínimo 44px alto, ancho completo para CTA principal.
- Dashboard: KPIs en 1 columna y solo métricas prioritarias.

### 375px - 430px · celular estándar

- Layout: 1 columna con más aire visual.
- Padding: `16px`.
- Cards: estado arriba, ruta al centro, CTA abajo.
- Tablas: cards móviles con acciones secundarias en menú.
- Formularios: secciones colapsables o stepper si pasan de 8 campos.
- Navegación: header compacto + drawer.
- Gráficas: una por bloque; leyenda abajo.

### 431px - 639px · celular grande

- Layout: 1 columna; 2 columnas solo para chips, mini-KPIs o datos cortos.
- Padding: `16px` a `20px`.
- Cards: pueden usar grid interno de 2 columnas para metadatos no críticos.
- Formularios: inputs siguen 100%; grupos cortos pueden ser 2 columnas si no afectan legibilidad.
- Dashboard: KPIs 1 columna o grid auto-fit con mínimo 220px.

### 640px - 767px · phablet / tablet pequeña

- Layout: 1-2 columnas.
- Padding: `20px`.
- Sidebar: drawer o rail temporal, nunca fijo invasivo.
- Tablas: compactas; ocultar columnas secundarias solo si el resumen/card conserva la información crítica.
- Formularios: máximo 2 columnas para campos cortos.
- Modales: `max-width: 640px` y scroll interno.

### 768px - 1023px · tablet

- Layout: 2 columnas para dashboard y formularios medianos.
- Padding: `24px`.
- Sidebar: colapsable; debe dejar contenido con `min-width: 0`.
- Tablas: compactas con columnas secundarias en detalle expandible.
- Dashboard: KPIs en 2 columnas.
- Mapas: altura entre 320px y 440px.

### 1024px - 1279px · laptop pequeña

- Layout: sidebar estable o compacto + contenido.
- Padding: `24px` a `32px`.
- Contenedor: `max-width` recomendado 1180px.
- Tablas: completas si no rompen; valores financieros alineados a la derecha.
- Formularios: 2 columnas; 3 solo para campos cortos.
- Dashboard: 3 columnas KPI.

### 1280px - 1535px · desktop normal

- Layout: sidebar estable, header contextual, contenido central.
- Padding: `32px`.
- Contenedor: `max-width: 1280px` a `1440px` según vista.
- Dashboard: 4 columnas KPI, gráficas 2 columnas.
- Tablas: completas, filtros visibles.
- Formularios: 2-3 columnas con secciones claras.

### 1536px - 1919px · desktop grande

- Layout: contenedor centrado + paneles laterales útiles.
- Contenedor: `max-width: 1520px`.
- Dashboard: comparar rutas, conductores, finanzas o alertas.
- No aumentar texto ni cards de forma absurda.
- Tablas: no estirar columnas de texto; usar widths proporcionales.

### 1920px+ · ultra wide

- Layout: `max-width` obligatorio entre 1560px y 1720px, salvo mapas operativos full-screen justificados.
- Usar paneles secundarios para actividad reciente, alertas, filtros o detalle seleccionado.
- Evitar líneas de texto largas; máximo 70-85 caracteres para párrafos.
- Dashboard: usar espacio para comparación real, no para vacío.

## Clases CSS recomendadas

```css
.kx-page {
  min-width: 0;
  width: 100%;
  padding-inline: clamp(0.75rem, 2vw, 2rem);
  padding-block: clamp(1rem, 2vw, 2rem);
}

.kx-container {
  width: min(100%, 1440px);
  margin-inline: auto;
}

.kx-section {
  display: grid;
  gap: clamp(1rem, 2vw, 1.5rem);
}

.kx-stack {
  display: flex;
  flex-direction: column;
  gap: clamp(0.75rem, 2vw, 1.25rem);
}

.kx-grid {
  display: grid;
  gap: clamp(1rem, 2vw, 1.5rem);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
}

.kx-card-grid {
  display: grid;
  gap: clamp(1rem, 2vw, 1.5rem);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
}

.kx-dashboard-grid {
  display: grid;
  gap: clamp(1rem, 2vw, 1.5rem);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
}

.kx-table-shell {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  border-radius: 1rem;
}

.kx-mobile-card-list {
  display: grid;
  gap: 0.875rem;
}

.kx-modal {
  width: min(calc(100vw - 1.5rem), 42rem);
  max-height: min(720px, calc(100dvh - 1.5rem));
  overflow: auto;
}

.kx-drawer {
  width: min(92vw, 24rem);
  max-width: 100%;
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom);
}
```

## Ejemplos responsive recomendados

### Tipografía fluida

```css
.kx-title {
  font-size: clamp(1.75rem, 5vw, 3.5rem);
  line-height: 1.05;
}

.kx-subtitle {
  font-size: clamp(0.95rem, 1.7vw, 1.125rem);
  line-height: 1.55;
}
```

### Grid de cards logísticas

```css
.kx-logistics-grid {
  display: grid;
  gap: clamp(0.875rem, 2vw, 1.25rem);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
}
```

### Container queries

Usar container queries cuando un componente puede vivir en dashboard, modal, drawer o página dedicada.

```css
.kx-card-container {
  container-type: inline-size;
}

.kx-route-card {
  display: grid;
  gap: 0.75rem;
}

@container (min-width: 420px) {
  .kx-route-card {
    grid-template-columns: 1fr auto;
    align-items: center;
  }
}
```

### Media queries limpias

```css
@media (min-width: 768px) {
  .kx-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .kx-form-grid.kx-form-grid--dense {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
```

## Reglas anti-overflow

- Todo contenedor flex/grid debe tener `min-width: 0` cuando contiene texto, tablas o gráficas.
- Todo texto largo debe permitir wrap: `overflow-wrap: anywhere` o `break-words` cuando sea necesario.
- Tablas largas van en `.kx-table-shell`, nunca directamente en el body.
- No usar `100vw` para contenedores dentro de layouts con scrollbar; preferir `width: 100%`.
- Los drawers deben usar `height: 100dvh` y safe areas.
- Las imágenes, mapas, canvas y SVG deben tener `max-width: 100%`.

## Reglas para dashboards

- Móvil: KPIs en 1 columna, alertas arriba, filtros plegables.
- Tablet: KPIs en 2 columnas, gráficas 1-2 columnas.
- Desktop: KPIs 3-4 columnas, filtros visibles, tablas completas.
- Ultra wide: usar paneles laterales para comparación, no estirar tarjetas.

## Criterio de aceptación

Una vista cumple este documento si:

- Se ve bien en 320px y 2560px.
- No tiene overflow horizontal global.
- No usa anchos fijos peligrosos.
- Usa mobile-first y escala por contenido.
- Conserva información crítica en móvil.
- Tiene comportamiento definido para sidebar, tablas, forms y modales.
- Está alineada con el sistema operativo logístico premium de KargaX.
