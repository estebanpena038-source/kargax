# 06 · Accesibilidad, calidad visual y performance

## Objetivo

KargaX debe poder usarse en operación real: bodegas, carretera, oficinas financieras, tablets de supervisores y laptops de administración. Accesibilidad y performance no son extras; reducen errores operativos y aumentan confianza B2B.

## Estándar de accesibilidad

Objetivo mínimo: WCAG 2.2 nivel AA para flujos principales.

Prioridades KargaX:

- Reflow sin pérdida de información desde 320px.
- Estados no dependientes solo del color.
- Focus visible.
- Navegación por teclado.
- Inputs con labels visibles.
- Errores por campo.
- Touch targets adecuados.
- Modales/drawers accesibles.
- Mensajes de estado comprensibles.

## Contraste

- Texto principal sobre fondo debe cumplir contraste AA.
- Texto secundario no debe ser tan gris que falle en móviles con sol o brillo bajo.
- Badges de estado deben tener texto legible.
- No usar fondos translúcidos con texto crítico sin prueba de contraste.
- En dark mode, revisar contraste de bordes, focus y badges.

## Tipografía

- Body ideal: 16px.
- Texto base mínimo: 14px.
- Labels mínimo: 14px.
- Metadata secundaria puede ser 12-13px solo si no es crítica y mantiene contraste.
- Títulos con `clamp()`.
- Evitar líneas de texto largas en desktop/ultra wide: max 72ch en párrafos.

## Focus states

- Todo elemento interactivo debe tener focus visible.
- El focus no debe quedar oculto bajo header/sidebar sticky.
- En modales y drawers, foco inicial y retorno deben funcionar.
- No eliminar outline sin reemplazo.

Ejemplo:

```css
:focus-visible {
  outline: 2px solid var(--color-primary-light);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

## Navegación por teclado

Debe funcionar con:

- Tab.
- Shift + Tab.
- Enter/Space para botones.
- Escape para cerrar modal/drawer/dropdown.
- Flechas cuando el patrón Radix lo soporte, por ejemplo tabs o dropdown.

Checklist:

- [ ] Se puede abrir/cerrar menú móvil sin mouse.
- [ ] Se puede navegar sidebar.
- [ ] Se puede usar tabla/lista y acciones contextuales.
- [ ] Modal atrapa foco y devuelve foco al cerrar.
- [ ] No hay keyboard traps.

## ARIA y labels

- Todo botón debe tener texto visible o `aria-label`.
- Todo input debe tener `label` visible.
- Placeholders no reemplazan labels.
- Iconos decorativos deben tener `aria-hidden="true"`.
- Badges numéricos deben tener contexto si están solos.
- Loading puede usar `aria-busy` en región relevante.
- Errores de formulario deben asociarse al campo con `aria-describedby` si aplica.

## Touch targets

- Elementos interactivos en móvil: mínimo 44px de alto recomendado para KargaX.
- WCAG 2.2 AA exige objetivos de puntero de al menos 24x24 CSS px salvo excepciones; KargaX usa 44px como estándar interno por operación logística.
- Separar botones destructivos de primarios para evitar taps accidentales.
- Inputs de PIN/foto/firma deben ser grandes y claros.

## Estados obligatorios

Toda vista debe tener:

### Loading state

- Skeleton o loader contextual.
- Altura reservada para evitar CLS.
- Texto si la espera puede ser larga: “Cargando rutas activas…”.

### Empty state

- Mensaje claro.
- Próxima acción.
- Filtros alternativos si aplica.

### Error state

- Qué falló.
- Qué puede hacer el usuario.
- Reintentar si aplica.
- Contactar soporte si es bloqueo.

### Offline / conexión débil

- Mostrar estado si la operación móvil puede perder conexión.
- Evitar perder datos de formularios largos.
- En evidencia, indicar si la entrega no se pudo sincronizar.

## Formularios accesibles

- Labels visibles.
- Errores por campo.
- Mensaje global arriba solo como resumen, no reemplazo de errores por campo.
- Campos obligatorios indicados.
- Validación no debe depender solo de color.
- Finanzas/billing deben tener prevención de errores: resumen antes de confirmar.

## Modales accesibles

Usar Radix Dialog o componente equivalente accesible.

Reglas:

- Título visible o `aria-label`.
- Escape cierra salvo bloqueo crítico justificado.
- Foco inicial dentro del modal.
- Foco atrapado dentro del modal.
- Foco vuelve al disparador.
- Si es acción destructiva/financiera, foco inicial en acción menos destructiva.
- Scroll interno si contenido excede viewport.
- En móvil, preferir drawer/bottom sheet para formularios.

## Drawer accesible

- `aria-label` descriptivo.
- Cierre por Escape, overlay y botón.
- Foco atrapado.
- Safe areas.
- Scroll interno.
- No bloquear permanentemente la página si falla animación.

## Tablas comprensibles

- Headers claros.
- Scope en `th` si se usa tabla HTML directa.
- Valores financieros alineados.
- Estados con texto.
- En móvil, card-list debe conservar semántica con `dl` para pares clave/valor.
- Acciones contextuales con labels.

## Performance responsive

### Core principles

- Reducir JavaScript innecesario en móvil.
- No cargar mapas pesados si no son necesarios.
- Evitar layouts enormes y DOM excesivo.
- Evitar recalcular gráficas/tablas en cada render.
- Reservar espacio para imágenes, mapas, charts y skeletons.
- Lazy load de imágenes pesadas.
- Reducir animaciones en móviles de bajo rendimiento.
- Respetar `prefers-reduced-motion`.

## CLS: evitar saltos de layout

Reglas KargaX:

- Skeletons con altura equivalente a la UI final.
- Imágenes con dimensiones o contenedor con aspect ratio.
- Mapas con altura reservada.
- Tablas con shell estable.
- Web fonts con `display: swap` ya usado en layout; no cambiar sin razón.
- Badges/alertas dinámicas no deben empujar contenido crítico de forma brusca.

## INP: mantener interacciones rápidas

Reglas KargaX:

- Filtros de tabla con debounce.
- Evitar cálculos grandes en render.
- Paginar/virtualizar tablas grandes.
- Reducir gráficos animados en móvil.
- Dar feedback visual inmediato en CTAs: loading, disabled, optimistic state si es seguro.
- No bloquear apertura de drawer/modal con cálculo pesado.

## Imágenes e iconos

- Usar `next/image` cuando aplique.
- `alt` si la imagen comunica información.
- `alt=""` o `aria-hidden` si es decorativa.
- No cargar imágenes gigantes en cards móviles.
- Preferir un set de iconos consistente.
- No importar librerías completas de iconos si se puede importar iconos individuales.

## Gráficas

- No montar gráficas fuera de vista si hay muchas.
- Skeleton con altura fija.
- Tooltips táctiles.
- Leyendas legibles.
- Desactivar animaciones cuando `prefers-reduced-motion` esté activo.

## Mapas

- Lazy load si no es crítico above-the-fold.
- Fallback lista de paradas.
- Altura controlada.
- Controles táctiles.
- No bloquear scroll móvil.
- No cargar tiles/mapa en vistas donde un resumen basta.

## Animaciones

KargaX puede usar microinteracciones, pero deben ayudar a entender estado, no decorar.

Usar animación para:

- Abrir/cerrar drawer.
- Feedback de botones.
- Transición sutil de cards.
- Skeleton/loading.

Evitar animación para:

- Tablas densas.
- Wallet/billing con cambios de valor.
- Gráficas críticas si distraen.
- Mapas en móviles lentos.

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

## Checklist de accesibilidad

- [ ] Contraste suficiente.
- [ ] Focus visible.
- [ ] Navegación por teclado.
- [ ] Labels visibles.
- [ ] Mensajes de error por campo.
- [ ] Estados no dependen solo del color.
- [ ] Touch targets adecuados.
- [ ] Jerarquía semántica.
- [ ] Títulos por página.
- [ ] Texto legible.
- [ ] Modales accesibles.
- [ ] Drawer accesible.
- [ ] Tablas comprensibles.
- [ ] Formularios entendibles.
- [ ] Loading, empty, error y offline state cuando aplique.

## Checklist de performance

- [ ] No hay overflow horizontal.
- [ ] Skeletons reservan espacio.
- [ ] Imágenes con tamaño/aspect ratio.
- [ ] Mapas lazy o justificados.
- [ ] Gráficas no saturan móvil.
- [ ] Tablas grandes tienen paginación/carga incremental.
- [ ] Filtros no recalculan en cada tecla sin control.
- [ ] Animaciones respetan reduced motion.
- [ ] Build/lint/typecheck pasan.
- [ ] QA visual responsive ejecutado o documentado.
