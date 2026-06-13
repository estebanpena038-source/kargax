# 02 · Navegación, sidebar y drawer responsive

## Objetivo

La navegación de KargaX debe orientar a usuarios operativos, administradores y equipos financieros sin mezclar contextos críticos. El usuario siempre debe saber:

- En qué módulo está.
- Si está en operación privada o marketplace.
- Si está viendo wallet privado o wallet marketplace.
- Si la evidencia corresponde a rutas privadas o marketplace.
- Qué acciones son seguras, críticas o destructivas.

## Arquitectura visual sugerida

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

## Reglas globales de navegación

- No mostrar demasiadas opciones al mismo nivel.
- Usar grupos, separadores y jerarquía visual.
- Cada item debe tener icono consistente + texto claro.
- El estado activo debe ser visible por fondo, borde o indicador, no solo color.
- Marketplace y operación privada deben tener separación visual permanente.
- Wallet privado y wallet marketplace deben tener nombres completos; nunca usar solo “Wallet” si hay ambigüedad.
- Evidencia privada y evidencia marketplace deben tener labels explícitos.
- Los módulos por rol deben mostrarse de forma clara: ocultar lo no permitido y evitar menús vacíos.
- Badges deben comunicar número + tipo: “3 novedades”, “2 pagos pendientes”, “5 rutas abiertas”.
- Logout debe estar separado de navegación operativa y no competir visualmente con CTAs.

## Comportamiento por viewport

### Móvil `< 768px`

- El sidebar no ocupa espacio permanente.
- Debe abrirse como drawer desde botón visible en header.
- El drawer debe cerrar por:
  - Botón cerrar.
  - Overlay.
  - Tecla Escape.
  - Selección de item de navegación cuando cambia ruta.
- El drawer debe tener ancho `min(100vw, 28rem)`.
- Debe respetar `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)`.
- El body no debe quedar con scroll horizontal cuando el drawer abre.
- El foco debe moverse dentro del drawer y volver al botón que lo abrió al cerrar.
- La navegación principal debe ser scrolleable si hay muchos items.
- El header móvil debe mostrar: logo/mark, título de módulo o sección, botón menú y acción crítica si aplica.
- El breadcrumb completo se oculta o abrevia. Mostrar al menos el módulo actual.

### Tablet `768px - 1023px`

- Sidebar colapsable o rail lateral.
- El estado colapsado debe conservar iconos y tooltips accesibles.
- El contenido principal debe reajustarse; nunca quedar debajo del sidebar.
- El usuario debe poder expandir/colapsar manualmente.
- Menús secundarios pueden vivir en tabs, dropdown o subnav horizontal compacta.
- Los grupos deben seguir visibles como separadores o tooltips.

### Desktop `>= 1024px`

- Sidebar estable y no invasivo.
- El contenido principal debe usar una región clara: `main` con `min-width: 0`.
- El sidebar no debe tapar modales ni overlays.
- El header puede mostrar breadcrumbs, búsqueda, notificaciones y perfil.
- El estado activo debe ser evidente incluso en pantallas con mucho contenido.
- El usuario debe poder identificar el módulo en menos de 2 segundos.

### Ultra wide `>= 1920px`

- El sidebar permanece estable, pero el contenido usa max-width.
- No expandir el dashboard hasta el borde derecho sin propósito.
- Usar panel contextual si el módulo lo justifica: alertas, actividad reciente, resumen de filtros o métricas comparativas.

## Sidebar desktop premium

### Reglas visuales

- Ancho expandido sugerido: `264px - 288px`.
- Ancho colapsado sugerido: `72px - 88px`.
- Separadores suaves por grupo.
- Iconos del mismo set preferido: `lucide-react` o `@phosphor-icons/react`, no mezclar estilos sin razón.
- Items con altura mínima 40px desktop y 44px tablet/touch.
- Texto de items corto y operativo: “Envíos privados”, “Evidencia privada”, “Wallet marketplace”.
- Estado activo: fondo sutil + borde/indicador + texto semibold.
- Hover elegante: no saturar con colores fuertes.
- Badges compactos y con texto cuando haya espacio.
- No usar rojo/naranja para estados normales; reservar tonos intensos para riesgo o alerta.

### Estructura sugerida de componente

```tsx
<aside aria-label="Navegación principal KargaX" className="kx-sidebar">
  <SidebarBrand />
  <SidebarGroup title="Operación privada" items={privateItems} />
  <SidebarGroup title="Marketplace" items={marketplaceItems} />
  <SidebarGroup title="Finanzas" items={financeItems} />
  <SidebarGroup title="Administración" items={adminItems} />
  <SidebarFooter user={user} />
</aside>
```

## Drawer móvil

Usar `vaul` o Radix Dialog según implementación existente. No construir un drawer casero sin manejo de foco.

### Reglas funcionales

- `aria-label="Menú principal"`.
- Botón abrir con `aria-label="Abrir menú"`.
- Botón cerrar con `aria-label="Cerrar menú"`.
- Overlay visible y clickeable.
- Escape cierra.
- Foco atrapado dentro del drawer mientras está abierto.
- Foco vuelve al botón que abrió el drawer.
- Scroll interno dentro del drawer si el menú excede pantalla.
- El header del drawer debe mostrar empresa/tenant si aplica y rol actual.

### Layout sugerido

```css
.kx-mobile-drawer {
  width: min(100vw, 28rem);
  max-width: 100%;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
}

.kx-mobile-drawer__nav {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

## Header móvil

Debe contener:

- Botón menú.
- Logo o mark KargaX.
- Título de módulo actual.
- Acción principal si es crítica y cabe.
- Notificaciones si son relevantes para operación.

No debe contener:

- Menús completos horizontales.
- Breadcrumb largo.
- 3 o más acciones primarias.
- Filtros complejos permanentes.

## Bottom navigation opcional

Solo usar bottom navigation si mejora operación móvil diaria. No debe reemplazar el sidebar completo.

### Cuándo sí usar

- Conductores o usuarios operativos móviles con 3-5 acciones frecuentes.
- Flujo de evidencia: pendiente, escanear/PIN, foto, firma, novedades.
- Tracking rápido: rutas activas, novedades, evidencia, perfil.

### Cuándo no usar

- Dashboard administrativo con muchas secciones.
- Billing, wallet o liquidaciones con riesgo de acciones financieras accidentales.
- Formularios largos donde ocuparía espacio crítico.

### Reglas

- Máximo 5 items.
- Labels visibles, no solo iconos.
- Área táctil 44px mínimo.
- Respetar safe area inferior.
- No duplicar acción destructiva.

## Breadcrumbs

- Desktop: mostrar ruta completa si ayuda: `Dashboard / Flota privada / Ruta KGX-123`.
- Tablet: mostrar módulo + pantalla: `Flota privada / Ruta KGX-123`.
- Móvil: mostrar solo título actual o breadcrumb abreviado.
- Breadcrumbs nunca reemplazan el título de la página.
- El título debe responder: “¿qué estoy operando ahora?”.

## Estados activos

Cada item activo debe tener:

- Texto semibold.
- Fondo o borde sutil.
- Icono en estado activo.
- `aria-current="page"` cuando corresponde.
- Contraste suficiente.

No depender solo de color. Agregar borde, barra lateral, peso tipográfico o icono.

## Badges y alertas

### Tipos de badge

- `Pendiente`: requiere acción.
- `Nuevo`: información reciente.
- `Riesgo`: posible impacto operativo/financiero.
- `Error`: algo falló.
- `Bloqueado`: permisos, plan o validación impiden avanzar.

### Reglas

- Badge con texto o `aria-label` descriptivo.
- No usar solo números sin contexto cuando el sidebar está expandido.
- En modo colapsado, tooltip debe explicar el badge.
- Wallet/billing/liquidaciones con badge de riesgo deben revisarse manualmente.

## Perfil, tenant y rol

El usuario debe saber en qué empresa/tenant está trabajando si KargaX opera multiempresa.

Header/sidebar footer sugerido:

- Nombre de empresa.
- Rol: Admin, Operador, Finanzas, Conductor, Marketplace.
- Estado de sesión.
- Botón de perfil/configuración.
- Logout separado.

Si un usuario puede cambiar empresa, el selector debe ser extremadamente claro y no confundirse con filtros de dashboard.

## Separación privado vs marketplace

### Operación privada

- Lenguaje: “propio”, “privado”, “interno”, “empresa”.
- Iconografía: flota, bodega, escudo/control, rutas propias.
- Copy: “Control interno”, “Evidencia privada”, “Conductores propios”.

### Marketplace

- Lenguaje: “público”, “ofertas”, “red”, “oportunidad”, “terceros”.
- Iconografía: red, intercambio, rutas públicas, usuarios externos.
- Copy: “Rutas públicas”, “Ofertas”, “Evidencia marketplace”.

## Finanzas: separación obligatoria

Nunca dejar un item llamado solo “Wallet” si existen dos contextos.

Usar:

- `Wallet privado`.
- `Wallet marketplace`.
- `Liquidaciones internas` si aplica.
- `Liquidaciones marketplace` si aplica.
- `Billing` para planes, pago de suscripción, checkout y límites.

## Reglas por rol

### Admin empresa

- Ve operación privada, finanzas, usuarios, roles, configuración, reportes.
- Marketplace visible si la empresa lo tiene habilitado.

### Operador logístico

- Ve envíos, flota, bodegas, evidencia, tracking, novedades.
- Finanzas puede estar oculto o read-only según permisos.

### Finanzas

- Ve wallet, liquidaciones, billing, reportes financieros.
- No debe tener CTAs operativos si no tiene permisos.

### Conductor privado

- Ve rutas asignadas, evidencia, novedades, perfil.
- Navegación móvil simplificada.

### Marketplace / conductor externo

- Ve oportunidades, rutas públicas, ofertas, evidencia marketplace, liquidaciones marketplace.
- No ve flota privada ni evidencia privada.

## Checklist de navegación

- [ ] En móvil no existe sidebar permanente.
- [ ] Drawer abre/cierra por botón, overlay y Escape.
- [ ] Foco se maneja correctamente.
- [ ] Sidebar desktop no tapa contenido.
- [ ] Tablet tiene colapso usable.
- [ ] El módulo activo es claro.
- [ ] Grupos privados, marketplace, finanzas y administración están separados.
- [ ] Wallet privado y marketplace no se confunden.
- [ ] Evidencia privada y marketplace no se confunden.
- [ ] Items ocultos por rol no dejan espacios raros.
- [ ] Badges tienen texto/aria-label.
- [ ] Logout está separado y no parece acción principal.
- [ ] Ultra wide mantiene max-width y composición útil.
