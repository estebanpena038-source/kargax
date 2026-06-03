# 02 · Navegación y sidebar responsive KargaX

## Objetivo

Definir cómo debe comportarse la navegación principal de KargaX en móvil, tablet, desktop y ultra wide. La navegación debe transmitir orden empresarial, separar flujos críticos y evitar que marketplace, flota privada, wallet y evidencia se mezclen visualmente.

## Principios obligatorios

- En móvil el sidebar **no debe ocupar espacio permanente**.
- En móvil debe abrirse como drawer accesible.
- El drawer debe cerrarse con botón, overlay y tecla Escape.
- En tablet el sidebar debe poder colapsarse.
- En desktop el sidebar debe ser estable y no tapar contenido.
- En ultra wide el contenido no debe quedar exageradamente expandido.
- El usuario siempre debe saber en qué módulo está.
- Marketplace y flota privada deben estar separados visualmente.
- Wallet privado y wallet marketplace deben tener navegación separada.
- Evidencia digital privada y evidencia marketplace no deben aparecer como si fueran lo mismo.
- Los módulos por rol deben mostrarse de forma clara.
- El menú no debe tener demasiadas opciones visibles al mismo nivel.
- Se deben usar grupos, separadores, jerarquía visual y estados activos claros.

## Estructura visual sugerida

### Grupo Operación Privada

- Dashboard.
- Flota privada.
- Envíos privados.
- Evidencia digital privada.
- Bodegas.
- Reportes.

### Grupo Marketplace

- Marketplace.
- Rutas públicas.
- Evidencia marketplace.
- Ofertas.
- Conductores marketplace.

### Grupo Finanzas

- Wallet privado.
- Wallet marketplace.
- Liquidaciones.
- Billing.

### Grupo Administración

- Usuarios.
- Roles.
- Configuración.
- Seguridad.

## Comportamiento por dispositivo

### Móvil 320px - 639px

- Header superior compacto con logo, módulo actual, botón menú y notificaciones.
- Sidebar oculto por defecto.
- Abrir navegación como drawer lateral o bottom sheet usando `vaul` o Radix Dialog si ya está implementado.
- Overlay oscuro o blur suave para separar navegación del contenido.
- El contenido no debe moverse horizontalmente cuando el drawer abre.
- El drawer debe tener ancho `min(92vw, 24rem)`.
- Debe respetar `env(safe-area-inset-bottom)`.
- Los items deben medir mínimo 44px de alto.
- No mostrar submenús gigantes abiertos por defecto.
- Usar accordions para grupos.
- Mostrar primero los módulos más usados por el rol actual.

### Tablet 640px - 1023px

- Sidebar colapsable o rail de iconos.
- Si el contenido es denso, preferir rail de 72px + drawer para submenú.
- Los grupos pueden aparecer como secciones colapsadas.
- El usuario debe poder expandir/cerrar sin perder contexto.
- No tapar tablas ni formularios.

### Desktop 1024px - 1535px

- Sidebar estable con ancho recomendado 260px-300px.
- Modo colapsado entre 72px y 88px.
- Header interno con breadcrumbs, título, estado operacional y acciones del módulo.
- No usar navegación superior saturada si el sidebar ya contiene grupos.
- Contenido principal debe tener `min-width: 0` para evitar overflow.

### Desktop grande y ultra wide 1536px+

- Mantener sidebar estable.
- Contenido dentro de `max-width`.
- Puede existir panel contextual derecho para alertas, actividad reciente o filtros persistentes.
- No hacer que las líneas del menú o contenido se estiren demasiado.

## Estados visuales del menú

Cada item debe tener:

- Icono consistente.
- Label claro en español.
- Estado activo visible.
- Hover elegante y discreto.
- Focus visible para teclado.
- Badge si hay alertas o pendientes.
- Indicación de riesgo si el módulo es financiero/legal.

### Estado activo

Debe comunicar módulo actual sin depender solo del color:

- Borde lateral o fondo suave.
- Texto más fuerte.
- Icono activo.
- `aria-current="page"` cuando aplique.

### Badges

- Usar badges para novedades, rutas pendientes, liquidaciones por revisar, evidencia incompleta y alertas críticas.
- Nunca usar solo color; agregar texto corto como `3 pendientes`, `Riesgo`, `Nuevo`.
- Badges financieros deben ser sobrios y no parecer promociones.

## Separación crítica de contextos

### Privado vs marketplace

Operación privada debe comunicar control interno:

- Flota propia.
- Conductores propios.
- Rutas internas.
- Evidencia privada.
- Reportes internos.

Marketplace debe comunicar oportunidad/transacción:

- Cargas públicas.
- Ofertas.
- Conductores externos.
- Evidencia marketplace.
- Comisiones/liquidaciones marketplace.

### Wallet privado vs wallet marketplace

- No compartir el mismo item visual.
- No usar el mismo ícono sin etiqueta distintiva.
- Mostrar subtítulo o badge contextual si es necesario.
- Wallet privado: costos internos, saldos de empresa, liquidaciones internas.
- Wallet marketplace: comisiones, pagos a terceros, saldos marketplace.

### Evidencia privada vs evidencia marketplace

- Evidencia privada: rutas internas y flota propia.
- Evidencia marketplace: rutas públicas/ofertas aceptadas.
- El usuario debe saber desde el sidebar en qué evidencia está trabajando.

## Breadcrumbs y título de módulo

Cada pantalla interna debe mostrar:

- Breadcrumb: `Inicio / Grupo / Módulo`.
- Título claro: `Wallet marketplace`, no solo `Wallet`.
- Descripción operacional corta.
- Acción principal contextual.
- Estado si aplica: `Sincronizado`, `Pendiente`, `Riesgo alto`, `Borrador`.

## Perfil, notificaciones y logout

- Perfil de usuario debe estar visible en desktop y accesible en móvil desde drawer.
- Logout debe estar separado de acciones frecuentes.
- Notificaciones deben agrupar alertas operativas, financieras y evidencia.
- No mezclar notificaciones de marketplace con flota privada sin etiqueta.

## Reglas premium visuales

- Iconos de una sola familia principal por sección.
- Separadores suaves, no líneas duras excesivas.
- Densidad cómoda para operación diaria.
- Estados activos claros pero sobrios.
- Hover sutil, sin animaciones exageradas.
- Modo colapsado entendible con tooltip accesible.
- Evitar demasiados colores; usar jerarquía, peso tipográfico y espaciado.
- El sidebar debe parecer herramienta empresarial, no menú de landing page.

## Patrón recomendado de drawer móvil

```tsx
// Pseudopatrón: adaptar al componente real existente
<Drawer open={open} onOpenChange={setOpen}>
  <DrawerContent className="kx-drawer">
    <header className="flex min-h-11 items-center justify-between">
      <span>KargaX</span>
      <button aria-label="Cerrar menú">Cerrar</button>
    </header>
    <nav aria-label="Navegación principal KargaX">
      {/* Grupos por rol/contexto */}
    </nav>
  </DrawerContent>
</Drawer>
```

## Checklist QA navegación

- [ ] En 320px el menú abre y cierra sin overflow.
- [ ] Escape cierra el drawer.
- [ ] Overlay cierra el drawer.
- [ ] El botón de cerrar tiene `aria-label`.
- [ ] El foco queda dentro del drawer mientras está abierto.
- [ ] El contenido no queda debajo del header.
- [ ] El sidebar desktop no tapa contenido.
- [ ] El sidebar colapsado tiene tooltips o labels accesibles.
- [ ] El módulo actual se entiende.
- [ ] Wallet privado y wallet marketplace aparecen separados.
- [ ] Evidencia privada y marketplace aparecen separadas.
- [ ] Los grupos por rol no muestran opciones irrelevantes.

## Criterio de aceptación

La navegación está terminada cuando el usuario puede entrar a cualquier módulo crítico en móvil, tablet y desktop sin confusión, sin scroll horizontal, sin mezcla entre privado/marketplace y con estados activos claros.
