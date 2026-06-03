# 06 · Accesibilidad, calidad visual y performance KargaX

## Objetivo

Definir reglas de accesibilidad, estados UI, performance y calidad visual para que KargaX sea usable por equipos logísticos reales en móvil, tablet y desktop, sin perder velocidad ni claridad.

## Reglas obligatorias de accesibilidad

- Nunca depender solo del color para comunicar estados.
- Todo botón debe tener texto o `aria-label`.
- Todo input debe tener label visible.
- Toda vista debe tener loading state.
- Toda vista debe tener empty state.
- Toda vista debe tener error state.
- Los formularios deben mostrar errores por campo.
- Los botones deben tener focus visible.
- Elementos interactivos deben medir mínimo 44px en móvil.
- El texto base no debe ser menor a 14px.
- El body idealmente debe usar 16px como base.
- Las imágenes deben tener `alt` cuando comuniquen información.
- Los íconos decorativos deben ocultarse de lectores de pantalla.
- Evitar saltos de layout fuertes.
- No cargar mapas pesados si no son necesarios.
- Usar skeletons en dashboards y tablas.
- Usar lazy loading para imágenes pesadas.
- Reducir animaciones en móviles de bajo rendimiento.
- Respetar `prefers-reduced-motion`.

## Contraste y color

- Estados críticos deben tener texto explícito: `Retrasado`, `Pago fallido`, `Evidencia pendiente`.
- No usar solo verde/rojo.
- Mantener contraste suficiente en textos secundarios, badges y botones.
- Los badges financieros deben ser legibles en modo claro y oscuro.
- Evitar fondos translúcidos si reducen lectura de datos financieros.

## Tipografía

- Base: 16px recomendados.
- Mínimo absoluto: 14px para texto secundario.
- Títulos fluidos con `clamp()`.
- Evitar párrafos largos en dashboard.
- Usar números tabulares si aplica en tablas financieras.
- No comprimir labels de formularios.

## Focus states

Todo elemento interactivo debe tener focus visible:

- Botones.
- Links.
- Inputs.
- Selects.
- Menús.
- Tabs.
- Accordions.
- Drawers.
- Modales.

No quitar outline sin reemplazo accesible.

## Navegación por teclado

- Tab debe seguir orden lógico.
- Shift+Tab debe funcionar.
- Escape debe cerrar modales, drawers y dropdowns.
- Enter/Space deben activar controles.
- El foco debe regresar al botón que abrió el modal/drawer.
- En modales, el foco debe quedar atrapado dentro mientras esté abierto.

## Labels y ARIA

- Inputs siempre con label visible.
- Placeholders no reemplazan labels.
- Botones de solo ícono necesitan `aria-label`.
- Iconos decorativos: `aria-hidden="true"`.
- Tablas deben tener headers comprensibles.
- Modales deben tener título accesible.
- Drawers deben tener `aria-label` o título.

## Estados UI obligatorios

### Loading

- Skeletons para dashboards, cards y tablas.
- Mantener layout reservado para evitar saltos.
- Mostrar contexto: `Cargando rutas`, `Cargando liquidaciones`.

### Empty

Debe responder:

- Qué no hay.
- Por qué puede pasar.
- Qué acción tomar.

Ejemplo: `No hay evidencia pendiente. Las rutas activas ya tienen POD completo.`

### Error

Debe responder:

- Qué falló.
- Qué puede hacer el usuario.
- Si debe reintentar o contactar soporte.

Ejemplo: `No pudimos cargar las liquidaciones. Revisa conexión e intenta de nuevo.`

### Offline

- Mostrar banner no invasivo.
- Indicar si la acción se guardó localmente o no.
- En evidencia, explicar si falta sincronizar.

## Performance responsive

- Evitar renders pesados en móvil.
- Lazy load para mapas, reportes grandes e imágenes.
- No montar 10 gráficas si el usuario solo ve 2.
- Reducir puntos de gráficas largas.
- Evitar animaciones complejas en listas largas.
- Reservar espacio para imágenes, mapas y gráficas para reducir CLS.
- Evitar `backdrop-filter` excesivo en móviles de bajo rendimiento.
- Usar paginación o virtualización para tablas grandes.
- Usar cache y loading states con React Query.

## Imágenes e íconos

- SVG e imágenes con `max-width: 100%`.
- `alt` descriptivo si comunica información.
- `alt=""` o `aria-hidden` si es decorativa.
- No cargar packs de iconos duplicados por vista.
- Reutilizar iconografía existente.

## Animaciones

- Deben reforzar claridad, no distraer.
- Duración recomendada: 150ms-250ms.
- No animar tablas grandes completas.
- No animar números críticos de forma confusa.
- Respetar reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Modales accesibles

- Usar Radix Dialog o componente accesible existente.
- Título obligatorio.
- Descripción si la acción tiene consecuencia.
- Cierre con Escape.
- Cierre con botón visible.
- Focus trap.
- Scroll interno si no cabe.
- En móvil usar ancho `calc(100vw - 24px)` y altura máxima `calc(100dvh - 24px)`.

## Drawer accesible

- Usar Vaul/Radix si ya existe.
- Título accesible.
- Botón cerrar.
- Overlay.
- Escape.
- Focus trap.
- Items mínimos 44px.
- Safe areas.

## Tablas accesibles

- Headers claros.
- Valores financieros con formato.
- Estados con texto.
- Si se transforma a cards, usar estructura semántica con `article`, `dl`, `dt`, `dd`.
- Acciones con labels claros.

## Formularios accesibles

- Label visible.
- Error por campo.
- Mensaje de ayuda cuando el campo sea complejo.
- Botones con estado disabled y razón si aplica.
- Validación no solo al submit si el error bloquea operación.

## Checklist de accesibilidad

- [ ] Contraste suficiente.
- [ ] Focus visible.
- [ ] Navegación por teclado.
- [ ] Labels visibles.
- [ ] Mensajes de error por campo.
- [ ] Estados no dependientes solo del color.
- [ ] Touch targets mínimo 44px.
- [ ] Jerarquía semántica.
- [ ] Títulos por página.
- [ ] Texto legible.
- [ ] Modales accesibles.
- [ ] Drawer accesible.
- [ ] Tablas comprensibles.
- [ ] Formularios entendibles.
- [ ] Reduced motion respetado.
- [ ] Imágenes con alt cuando aplica.

## Checklist de performance

- [ ] No hay overflow global.
- [ ] No hay saltos visuales fuertes.
- [ ] Mapas cargan solo cuando se necesitan.
- [ ] Gráficas no bloquean móvil.
- [ ] Skeletons reservan espacio.
- [ ] Tablas grandes usan paginación o carga incremental.
- [ ] Imágenes pesadas usan lazy loading.
- [ ] Animaciones no afectan operación.
- [ ] El dashboard no monta contenido invisible innecesario.

## Criterio de aceptación

Una vista cumple accesibilidad y performance cuando puede usarse con teclado, lector de pantalla básico, móvil táctil y conexión irregular, sin perder información crítica ni romper layout.
