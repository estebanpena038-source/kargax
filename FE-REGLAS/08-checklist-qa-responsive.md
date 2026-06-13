# 08 · Checklist QA responsive KargaX

## Objetivo

Este checklist define cómo aprobar una vista frontend KargaX en móvil, tablet, desktop y ultra wide. Debe ejecutarse antes de marcar una vista como terminada.

## Resultado esperado

Cada vista debe clasificarse como:

- `PASS`: cumple criterios y no tiene riesgos críticos.
- `FAIL`: se rompe funcionalmente o visualmente.
- `NEEDS FIX`: funciona, pero tiene problemas de UX/responsive/accesibilidad.
- `RISK HIGH`: involucra wallet, billing, liquidaciones, evidencia legal, datos multiempresa, RLS, roles/permisos, pagos, datos financieros o evidencia de entrega.

Un resultado puede ser `PASS + RISK HIGH` solo si pasó QA y además se marcó por sensibilidad del módulo. En ese caso requiere revisión manual adicional.

## Resoluciones obligatorias

| Resolución | Tipo | Validación principal |
|---:|---|---|
| 320x568 | Celular muy pequeño | Sin overflow, CTA táctil, contenido crítico visible. |
| 360x640 | Celular pequeño | Cards/listas legibles, drawer usable. |
| 375x667 | iPhone clásico | Formularios y modales caben. |
| 390x844 | Celular moderno | Header/drawer/acciones correctas. |
| 414x896 | Celular grande | Cards y filtros plegables. |
| 430x932 | Celular grande alto | Sticky actions y safe area. |
| 640x900 | Phablet/tablet pequeña | 1-2 columnas sin romperse. |
| 768x1024 | Tablet vertical | Sidebar colapsable, tablas compactas. |
| 820x1180 | Tablet vertical grande | Dashboard 2 columnas controlado. |
| 1024x768 | Tablet horizontal/laptop pequeña | Sidebar no tapa contenido. |
| 1024x1366 | Tablet grande vertical | Layout no queda vacío. |
| 1280x720 | Laptop baja | Modales no exceden altura. |
| 1366x768 | Laptop común | Dashboard usable above-the-fold. |
| 1440x900 | Desktop | Tabla completa y filtros visibles. |
| 1536x864 | Desktop grande | Max-width y densidad profesional. |
| 1728x1117 | Desktop grande | Paneles útiles, no vacío. |
| 1920x1080 | Full HD | Ultra wide inicial, no estirar absurdo. |
| 2560x1440 | Ultra wide | Contenedor máximo y composición útil. |

## Validación global por resolución

En cada resolución validar:

- [ ] No hay scroll horizontal global.
- [ ] El contenido principal no se corta.
- [ ] El sidebar funciona correctamente.
- [ ] El menú móvil abre y cierra.
- [ ] Los botones son tocables.
- [ ] Los formularios no se rompen.
- [ ] Los inputs son legibles.
- [ ] Los modales caben en pantalla.
- [ ] Las tablas/cards son legibles.
- [ ] Las acciones críticas son visibles.
- [ ] Los filtros funcionan.
- [ ] Los estados responsive son correctos.
- [ ] Los textos no se montan.
- [ ] Los badges no se deforman.
- [ ] Las gráficas se entienden.
- [ ] Los mapas no rompen el layout.
- [ ] El footer o zona final no queda encima del contenido.
- [ ] La performance es aceptable.
- [ ] Loading, empty y error states existen.
- [ ] El drawer móvil no bloquea la experiencia.
- [ ] El contenido no queda debajo del header.
- [ ] Las zonas táctiles tienen mínimo 44px en móvil.

## Checklist por módulo

### Login

- [ ] Formulario centrado sin overflow en 320px.
- [ ] Inputs 100% en móvil.
- [ ] Labels visibles.
- [ ] Errores claros.
- [ ] reCAPTCHA no rompe layout.
- [ ] CTA principal 44px mínimo.
- [ ] Link a registro/recuperación legible.

### Registro

- [ ] Formulario dividido en secciones/pasos si es largo.
- [ ] Campos obligatorios claros.
- [ ] Errores por campo.
- [ ] No hay texto legal ilegible.
- [ ] CTA no queda debajo del teclado en móvil.

### Dashboard

- [ ] KPIs 1 columna móvil, 2 tablet, 3-4 desktop.
- [ ] Alertas críticas arriba.
- [ ] Filtros plegables en móvil.
- [ ] Gráficas legibles.
- [ ] Empty/loading/error states.
- [ ] Ultra wide no estira cards sin sentido.

### Marketplace

- [ ] Etiqueta Marketplace visible.
- [ ] No parece flota privada.
- [ ] Cards móviles muestran ruta, fecha, valor/oferta, estado y CTA.
- [ ] Filtros plegables.
- [ ] Ofertas/acciones por rol correctas.
- [ ] No se mezclan evidencias privadas.

### Flota privada

- [ ] Etiqueta privada/control interno clara.
- [ ] Conductores propios y rutas propias no se mezclan con marketplace.
- [ ] Tabla desktop legible.
- [ ] Cards móviles con estado, ruta, fecha, conductor y CTA.
- [ ] Evidencia privada visible si aplica.

### Bodegas

- [ ] Cards/tablas muestran bodega, ciudad, ocupación, responsable, estado.
- [ ] Ocupación no depende solo de color.
- [ ] Formularios de bodega no se rompen en móvil.
- [ ] Acciones administrativas según rol.

### Envíos

- [ ] Estado, origen, destino, fecha, responsable y CTA siempre visibles.
- [ ] Tabla desktop no genera overflow global.
- [ ] Móvil usa cards.
- [ ] Filtros por estado/fecha funcionan.
- [ ] Novedades y evidencia no quedan ocultas.

### Tracking

- [ ] Mapa con altura controlada.
- [ ] Mapa no bloquea scroll móvil.
- [ ] Fallback lista si mapa falla.
- [ ] Estados de ruta visibles.
- [ ] Actualizaciones no causan saltos fuertes de layout.

### Wallet privado

- [ ] Título “Wallet privado”.
- [ ] Monto, moneda, estado, fecha, origen y responsable visibles.
- [ ] No se mezcla con marketplace.
- [ ] Acciones financieras confirmadas.
- [ ] Valores alineados.
- [ ] `RISK HIGH` marcado.

### Wallet marketplace

- [ ] Título “Wallet marketplace”.
- [ ] Chip marketplace visible en cards móviles.
- [ ] Comisiones/pagos a terceros diferenciados.
- [ ] Ruta pública/beneficiario visibles.
- [ ] No se mezcla con wallet privado.
- [ ] `RISK HIGH` marcado.

### Billing

- [ ] Plan actual visible.
- [ ] Precio/moneda claros.
- [ ] Límites claros.
- [ ] Upgrade/downgrade no ambiguo.
- [ ] Mercado Pago/checkout con loading/error.
- [ ] No usar “ilimitado” sin soporte contractual/backend.
- [ ] `RISK HIGH` marcado.

### Liquidaciones

- [ ] Estado, monto, fecha, origen y responsable visibles.
- [ ] Interna vs marketplace diferenciado.
- [ ] Comprobante visible si existe.
- [ ] Acciones financieras confirmadas.
- [ ] `RISK HIGH` marcado.

### Evidencia digital privada

- [ ] Título/label “Evidencia privada”.
- [ ] PIN/foto/firma táctiles.
- [ ] Errores específicos.
- [ ] Novedades claras.
- [ ] Confirmación antes de cerrar si irreversible.
- [ ] No se mezcla con marketplace.
- [ ] `RISK HIGH` marcado.

### Evidencia marketplace

- [ ] Título/label “Evidencia marketplace”.
- [ ] Ruta pública visible.
- [ ] Proveedor/conductor externo visible si aplica.
- [ ] PIN/foto/firma táctiles.
- [ ] No se mezcla con evidencia privada.
- [ ] `RISK HIGH` marcado.

### Reportes

- [ ] KPIs resumen antes de tabla densa.
- [ ] Filtros por fecha claros.
- [ ] Gráficas legibles.
- [ ] Tabla desktop con scroll interno si aplica.
- [ ] Móvil usa cards/resumen.
- [ ] Exportación no rompe permisos.

### Usuarios

- [ ] Nombre, rol y estado visibles.
- [ ] Acciones por rol.
- [ ] Tabla móvil en lista compacta.
- [ ] No hay acciones destructivas sin confirmación.

### Roles

- [ ] Permisos visibles y entendibles.
- [ ] No se ocultan permisos críticos sin explicación.
- [ ] Cambios de rol confirmados.
- [ ] `RISK HIGH` si afecta permisos o multiempresa.

### Configuración

- [ ] Secciones claras.
- [ ] Forms no se rompen.
- [ ] Toggles accesibles.
- [ ] Cambios sensibles confirmados.

### Notificaciones

- [ ] Badges no se deforman.
- [ ] Estado leído/no leído no depende solo de color.
- [ ] Drawer/popover cabe en móvil.
- [ ] Alertas críticas priorizadas.

## Marcar `RISK HIGH` si aparece cualquier problema relacionado con

- Wallet.
- Billing.
- Liquidaciones.
- Evidencia legal.
- Datos multiempresa.
- RLS.
- Roles/permisos.
- Pagos.
- Datos financieros.
- Evidencia de entrega.

## Plantilla de reporte QA

```md
# QA Responsive · [Vista]

Fecha:
Tester:
Rama/commit:
URL/ruta:
Rol probado:

## Resultado general

Estado: PASS / FAIL / NEEDS FIX / RISK HIGH

## Resoluciones probadas

- [ ] 320x568
- [ ] 360x640
- [ ] 375x667
- [ ] 390x844
- [ ] 414x896
- [ ] 430x932
- [ ] 640x900
- [ ] 768x1024
- [ ] 820x1180
- [ ] 1024x768
- [ ] 1024x1366
- [ ] 1280x720
- [ ] 1366x768
- [ ] 1440x900
- [ ] 1536x864
- [ ] 1728x1117
- [ ] 1920x1080
- [ ] 2560x1440

## Hallazgos

| Resolución | Estado | Problema | Riesgo | Evidencia |
|---|---|---|---|---|
| 390x844 | NEEDS FIX | CTA queda debajo del footer | Medio | screenshot |

## Pruebas funcionales

- [ ] Drawer abre/cierra.
- [ ] Filtros aplican.
- [ ] Form envía o valida.
- [ ] Error state visible.
- [ ] Empty state visible.
- [ ] Loading state visible.

## Riesgos

- [ ] Wallet
- [ ] Billing
- [ ] Liquidaciones
- [ ] Evidencia legal
- [ ] Datos multiempresa/RLS/roles

## Decisión

Aprobado / Bloqueado / Requiere fix

## Siguiente paso
```

## Playwright sugerido

Si el proyecto usa los scripts existentes, preferir:

```bash
cd frontend
npm run visual:qa
npm run visual:qa:browser
```

Si se agrega runner oficial:

```bash
cd frontend
npm install -D @playwright/test
npx playwright install
npx playwright test
```

### Viewports para automatizar

```ts
export const KARGAX_VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'mobile-360', width: 360, height: 640 },
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'phablet-640', width: 640, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'tablet-landscape-1024', width: 1024, height: 768 },
  { name: 'tablet-pro-1024', width: 1024, height: 1366 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1536', width: 1536, height: 864 },
  { name: 'desktop-1728', width: 1728, height: 1117 },
  { name: 'fullhd-1920', width: 1920, height: 1080 },
  { name: 'ultrawide-2560', width: 2560, height: 1440 },
];
```

## Comandos manuales mínimos

```bash
cd frontend
npm install
npm run lint
npm run typecheck
npm run build
npm run visual:qa
```

Luego probar en DevTools todas las resoluciones obligatorias.
