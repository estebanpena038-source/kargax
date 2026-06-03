# 08 · Checklist QA responsive KargaX

## Objetivo

Crear una matriz real de QA responsive para probar cada vista de KargaX en móvil, tablet, laptop, desktop y ultra wide. Este checklist es obligatorio para vistas nuevas, refactors visuales y cambios en módulos críticos.

## Clasificación de resultado

Cada vista debe clasificarse como:

- `PASS`: cumple responsive, accesibilidad básica, estados y no hay riesgos abiertos.
- `FAIL`: rompe layout, flujo crítico o datos.
- `NEEDS FIX`: usable, pero con problemas visuales o de UX que deben corregirse.
- `RISK HIGH`: afecta wallet, billing, liquidaciones, evidencia legal, datos multiempresa, RLS, roles/permisos, pagos o datos financieros.

## Resoluciones obligatorias

- 320x568.
- 360x640.
- 375x667.
- 390x844.
- 414x896.
- 430x932.
- 640x900.
- 768x1024.
- 820x1180.
- 1024x768.
- 1024x1366.
- 1280x720.
- 1366x768.
- 1440x900.
- 1536x864.
- 1728x1117.
- 1920x1080.
- 2560x1440.

## Validaciones por resolución

Para cada viewport validar:

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
- [ ] Las zonas táctiles tienen mínimo 44px.

## Checklist por módulo

### Login

- [ ] Formulario centrado sin overflow.
- [ ] Inputs con labels.
- [ ] Error de credenciales visible.
- [ ] Botón mínimo 44px.
- [ ] Captcha no rompe 320px.
- [ ] Modo claro/oscuro legible.

### Registro

- [ ] Formulario dividido por secciones si es largo.
- [ ] Campos obligatorios claros.
- [ ] Errores por campo.
- [ ] CTA visible.
- [ ] Legal/terms legible.

### Dashboard

- [ ] KPIs 1 columna móvil.
- [ ] KPIs 2 columnas tablet.
- [ ] KPIs 3-4 columnas desktop.
- [ ] Alertas críticas arriba.
- [ ] Gráficas legibles.
- [ ] Empty/loading/error.

### Marketplace

- [ ] Se distingue de flota privada.
- [ ] Cards móviles muestran ruta, estado, valor/oferta y CTA.
- [ ] Filtros plegables en móvil.
- [ ] Ofertas no se confunden con envíos privados.
- [ ] Estados claros.

### Flota privada

- [ ] Se siente operación interna.
- [ ] Conductores propios visibles.
- [ ] Rutas privadas separadas de marketplace.
- [ ] Evidencia privada contextual.
- [ ] Tabla/card responsive.

### Bodegas

- [ ] Inventario legible en móvil.
- [ ] Ubicación/capacidad visibles.
- [ ] Acciones críticas claras.
- [ ] Tablas no rompen layout.

### Envíos

- [ ] Estado, origen, destino, fecha, responsable y acción visibles.
- [ ] Cards móviles correctas.
- [ ] Filtros funcionales.
- [ ] Detalle no pierde información.

### Tracking

- [ ] Mapa no bloquea scroll móvil.
- [ ] Altura controlada.
- [ ] ETA y estado visibles.
- [ ] Lista alternativa si mapa falla.

### Wallet privado

- [ ] Título explícito `Wallet privado`.
- [ ] No se mezcla con marketplace.
- [ ] Valores financieros formateados.
- [ ] Acciones financieras confirmadas.
- [ ] `RISK HIGH` si hay cambios funcionales.

### Wallet marketplace

- [ ] Título explícito `Wallet marketplace`.
- [ ] Comisiones y pagos a terceros separados.
- [ ] Liquidaciones externas claras.
- [ ] Estados no dependen solo del color.
- [ ] `RISK HIGH` si hay cambios funcionales.

### Billing

- [ ] Plan, precio, límites y próximo cobro visibles.
- [ ] Cambio de plan confirma consecuencia.
- [ ] Mercado Pago/checkout no se rompe en móvil.
- [ ] `RISK HIGH` obligatorio.

### Liquidaciones

- [ ] Estado, monto, fecha, origen y responsable visibles.
- [ ] Valores alineados.
- [ ] Acciones destructivas separadas.
- [ ] Confirmación antes de aprobar/rechazar/pagar.
- [ ] `RISK HIGH` obligatorio.

### Evidencia digital privada

- [ ] Título explícito.
- [ ] Ruta/envío privado visible.
- [ ] PIN/POD, foto y firma táctiles.
- [ ] Error explica qué falta.
- [ ] `RISK HIGH` si afecta evidencia legal.

### Evidencia marketplace

- [ ] Título explícito.
- [ ] Ruta pública/oferta visible.
- [ ] Conductor/proveedor externo visible.
- [ ] No se mezcla con evidencia privada.
- [ ] `RISK HIGH` si afecta evidencia legal.

### Reportes

- [ ] Filtros responsive.
- [ ] Gráficas legibles.
- [ ] Tablas exportables o legibles.
- [ ] Finanzas formateadas.
- [ ] Empty state por periodo sin datos.

### Usuarios

- [ ] Roles claros.
- [ ] Estado de usuario visible.
- [ ] Acciones destructivas confirmadas.
- [ ] No se exponen datos multiempresa.

### Roles

- [ ] Permisos críticos legibles.
- [ ] Cambios tienen confirmación.
- [ ] `RISK HIGH` si afecta permisos/RLS.

### Configuración

- [ ] Secciones claras.
- [ ] Guardado visible.
- [ ] Errores por campo.
- [ ] No hay formularios eternos sin agrupación.

### Notificaciones

- [ ] Badges legibles.
- [ ] Marketplace/privado etiquetados.
- [ ] Críticas arriba.
- [ ] Estado leído/no leído no depende solo de color.

## Riesgos altos automáticos

Marcar `RISK HIGH` si el problema está relacionado con:

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

## Comandos sugeridos

```bash
cd frontend
npm install
npm run lint
npm run typecheck
npm run build
npm run visual:qa
npm run visual:qa:browser
```

Si se agrega Playwright Test formal:

```bash
npm install -D @playwright/test
npx playwright install
npx playwright test
```

## Plantilla de reporte QA

```md
## Vista evaluada

Ruta:
Módulo:
Fecha:
Tester:

## Resultado

Estado: PASS | FAIL | NEEDS FIX | RISK HIGH

## Viewports probados

- 320x568:
- 390x844:
- 768x1024:
- 1366x768:
- 1920x1080:
- 2560x1440:

## Hallazgos

1.
2.
3.

## Riesgos

- Wallet/billing/liquidaciones:
- Evidencia legal:
- RLS/datos multiempresa:
- Roles/permisos:

## Acciones requeridas

- [ ]
- [ ]

## Evidencia

Screenshots/videos:
```

## Criterio de aceptación final

Una vista solo puede pasar QA responsive si no tiene overflow global, no pierde información crítica, mantiene separación marketplace/privado/wallet/evidencia, tiene estados loading/empty/error y funciona en móvil, tablet, desktop y ultra wide.
