# 07 · Dependencias frontend recomendadas

## Decisión CTO

No instalar dependencias nuevas por defecto. El `frontend/package.json` ya tiene un stack moderno y suficiente para elevar KargaX a nivel SaaS B2B premium.

La prioridad es **reutilizar bien lo instalado**, consolidar patrones y evitar duplicidad.

## Dependencias actuales detectadas en `frontend/package.json`

### Framework y runtime

| Dependencia | Versión detectada | Uso recomendado |
|---|---:|---|
| `next` | `16.1.1` | App framework, routing, SSR/SSG, optimización. |
| `react` | `19.2.3` | UI principal. |
| `react-dom` | `19.2.3` | Render React. |
| `typescript` | `^5` | Tipado estricto. |

### Estilos y design system

| Dependencia | Versión | Uso recomendado |
|---|---:|---|
| `tailwindcss` | `^4` | Utilidades responsive y tokens. |
| `@tailwindcss/postcss` | `^4` | Pipeline Tailwind. |
| `clsx` | `^2.1.1` | Clases condicionales. |
| `tailwind-merge` | `^3.4.0` | Merge de clases Tailwind. |
| `class-variance-authority` | `^0.7.1` | Variantes de componentes. |
| `next-themes` | `^0.4.6` | Tema claro/oscuro. |

### UI / componentes accesibles

| Dependencia | Versión | Reutilizar para |
|---|---:|---|
| `@radix-ui/react-dialog` | `^1.1.15` | Modales accesibles. |
| `@radix-ui/react-dropdown-menu` | `^2.1.16` | Menús contextuales y acciones secundarias. |
| `@radix-ui/react-popover` | `^1.1.15` | Filtros compactos, detalles. |
| `@radix-ui/react-tabs` | `^1.1.13` | Tabs de reportes/contextos. |
| `@radix-ui/react-tooltip` | `^1.2.8` | Tooltips accesibles. |
| `@radix-ui/react-avatar` | `^1.1.11` | Perfil/usuario. |
| `@radix-ui/react-progress` | `^1.1.8` | Progreso, steps, carga. |
| `@radix-ui/react-separator` | `^1.1.8` | Separadores de sidebar/grupos. |
| `@radix-ui/react-switch` | `^1.2.6` | Toggles de configuración. |
| `@radix-ui/react-slot` | `^1.2.4` | Composición de componentes. |
| `vaul` | `^1.1.2` | Drawer/bottom sheet móvil. |
| `sonner` | `^2.0.7` | Toasts. |
| `embla-carousel-react` | `^8.6.0` | Carruseles si realmente aportan. |

### Iconos

| Dependencia | Versión | Decisión |
|---|---:|---|
| `lucide-react` | `^0.562.0` | Preferido para iconografía lineal limpia. |
| `@phosphor-icons/react` | `^2.1.10` | Reutilizar si ya hay sistema visual con Phosphor. |
| `react-icons` | `^5.5.0` | Evitar para vistas nuevas salvo icono no disponible. |

### Formularios y validación

| Dependencia | Versión | Uso recomendado |
|---|---:|---|
| `react-hook-form` | `^7.69.0` | Formularios de envío, evidencia, billing. |
| `@hookform/resolvers` | `^5.2.2` | Resolver Zod. |
| `zod` | `^4.3.4` | Validación y mensajes por campo. |
| `react-dropzone` | `^15.0.0` | Foto/soportes/comprobantes. |
| `react-google-recaptcha` | `^3.1.0` | Anti-abuso si ya está integrado. |
| `@types/react-google-recaptcha` | `^2.1.9` | Tipos. |

### Data, tablas y estado

| Dependencia | Versión | Uso recomendado |
|---|---:|---|
| `@tanstack/react-query` | `^5.90.16` | Fetching/cache/loading/error. |
| `@tanstack/react-query-devtools` | `^5.91.2` | Debug en desarrollo. |
| `@tanstack/react-table` | `^8.21.3` | Tablas avanzadas. |
| `zustand` | `^5.0.12` | Estado local/global ligero. |
| `axios` | `^1.13.2` | HTTP si ya está usado. |
| `date-fns` | `^4.1.0` | Fechas. |

### Gráficas, documentos y pagos

| Dependencia | Versión | Uso recomendado |
|---|---:|---|
| `recharts` | `^3.8.1` | Dashboards y reportes. |
| `react-countup` | `^6.5.3` | Animación leve de KPIs si no afecta operación. |
| `jspdf` | `^4.2.1` | Soportes/reportes descargables. |
| `mercadopago` | `^2.12.0` | Billing/checkout. Riesgo alto. |

### Supabase

| Dependencia | Versión | Uso recomendado |
|---|---:|---|
| `@supabase/ssr` | `^0.8.0` | SSR/session. |
| `@supabase/supabase-js` | `^2.89.0` | Cliente Supabase. |

### Animaciones

| Dependencia | Versión | Uso recomendado |
|---|---:|---|
| `framer-motion` | `^12.23.26` | Microinteracciones y transiciones, con reduced motion. |

### QA y tooling

| Dependencia | Versión | Uso recomendado |
|---|---:|---|
| `playwright` | `^1.60.0` | QA visual/responsive. |
| `eslint` | `^9` | Lint. |
| `eslint-config-next` | `16.1.1` | Lint Next. |
| `@types/node`, `@types/react`, `@types/react-dom` | Detectadas | Tipos. |

## Dependencias que ya existen y se deben reutilizar

- **Drawer móvil:** reutilizar `vaul` o Radix Dialog; no instalar otro drawer.
- **Modales:** reutilizar `@radix-ui/react-dialog`.
- **Dropdown/context menu:** reutilizar `@radix-ui/react-dropdown-menu`.
- **Tabs:** reutilizar `@radix-ui/react-tabs`.
- **Tooltips:** reutilizar `@radix-ui/react-tooltip`.
- **Toasts:** reutilizar `sonner` o `ToastContainer` existente.
- **Iconos:** preferir `lucide-react`; no agregar más sets.
- **Forms:** reutilizar `react-hook-form` + `zod`.
- **Tables:** reutilizar `@tanstack/react-table`.
- **Charts:** reutilizar `recharts`.
- **Motion:** reutilizar `framer-motion` con `prefers-reduced-motion`.
- **QA:** reutilizar `playwright` y scripts existentes `visual:qa`.

## Dependencias que NO se deben instalar porque duplican funcionalidad

| No instalar | Por qué |
|---|---|
| `@headlessui/react` | Duplica Radix/Dialog/Dropdown/Tabs/Popover. |
| Otra librería de drawer | `vaul` ya existe. |
| `echarts` | `recharts` ya cubre dashboards estándar; ECharts sería más pesado salvo necesidad real. |
| Otra librería de tablas | TanStack Table ya existe. |
| Otro form manager | React Hook Form ya existe. |
| Otro validador | Zod ya existe. |
| Otro set de iconos | Ya existen lucide, phosphor y react-icons. Consolidar, no sumar. |
| Otra librería de toast | Sonner/ToastContainer ya existen. |
| Librerías CSS UI completas pesadas | Tailwind + Radix + CVA ya cubren sistema componentizado. |

## Dependencias recomendadas solo si hacen falta

### Nombre: `@axe-core/playwright`

- **Categoría:** QA / accesibilidad.
- **Problema que resuelve:** automatiza chequeos básicos de accesibilidad en pruebas Playwright.
- **Dónde se usaría en KargaX:** `frontend/tests/accessibility/*.spec.ts` o dentro de `scripts/visual-qa-release-gate.mjs` si se decide integrar.
- **Comando:** `cd frontend && npm install -D @axe-core/playwright`.
- **Riesgo:** bajo. No afecta bundle de producción si se mantiene en devDependencies.
- **Impacto/peso esperado:** bajo en producción; aumenta tiempo de QA en CI.
- **Alternativa:** revisión manual con Lighthouse/DevTools + checklist `08`.
- **Decisión:** recomendado para una fase posterior de QA automatizado, no instalar en este cambio documental.
- **Notas de implementación:** ejecutar en rutas críticas: login, dashboard, marketplace, wallet privado, wallet marketplace, billing, evidencia.

### Nombre: `@radix-ui/react-accordion`

- **Categoría:** UI / componentes.
- **Problema que resuelve:** accordions accesibles para filtros móviles, formularios largos y detalles expandibles.
- **Dónde se usaría en KargaX:** filtros móviles, detalles de envío, secciones de formularios, reportes.
- **Comando:** `cd frontend && npm install @radix-ui/react-accordion`.
- **Riesgo:** bajo.
- **Impacto/peso esperado:** bajo.
- **Alternativa:** usar `<details><summary>` con estilos accesibles o componente propio si ya existe.
- **Decisión:** no instalar ahora; revisar primero si existe componente `Accordion` propio.
- **Notas de implementación:** si se instala, documentar patrón en componentes UI y QA de teclado.

### Nombre: `@radix-ui/react-alert-dialog`

- **Categoría:** UI / componentes críticos.
- **Problema que resuelve:** confirmaciones accesibles para acciones destructivas/financieras.
- **Dónde se usaría en KargaX:** eliminar rutas, anular liquidación, cambios de plan, acciones de evidencia irreversible.
- **Comando:** `cd frontend && npm install @radix-ui/react-alert-dialog`.
- **Riesgo:** medio en flujos críticos por copy/UX, bajo técnico.
- **Impacto/peso esperado:** bajo.
- **Alternativa:** Radix Dialog existente con implementación cuidadosa.
- **Decisión:** considerar solo si las confirmaciones actuales son débiles o repetidas.
- **Notas de implementación:** foco inicial en acción menos destructiva para wallet/billing/evidencia legal.

### Nombre: `@playwright/test`

- **Categoría:** QA.
- **Problema que resuelve:** runner oficial de Playwright si el proyecto solo usa `playwright` directo.
- **Dónde se usaría en KargaX:** tests responsive por viewport y screenshots.
- **Comando:** `cd frontend && npm install -D @playwright/test`.
- **Riesgo:** bajo.
- **Impacto/peso esperado:** dev-only.
- **Alternativa:** scripts existentes `visual:qa` y `visual:qa:browser`.
- **Decisión:** no instalar ahora porque `playwright` ya existe y hay scripts propios; evaluar si los scripts necesitan runner oficial.
- **Notas de implementación:** no duplicar QA si los scripts actuales ya cubren viewports.

## Categorías cubiertas

### UI / Componentes

- Drawer: `vaul` existente.
- Modal: Radix Dialog existente.
- Tabs: Radix Tabs existente.
- Accordion: opcional Radix Accordion si no hay componente propio.
- Dropdown: Radix Dropdown existente.
- Tooltip: Radix Tooltip existente.
- Toast: Sonner/Toast existente.
- Command menu: no instalar hasta que exista caso claro de búsqueda global empresarial.

### Iconos

- Usar `lucide-react` como estándar preferido para nuevas vistas.
- Evitar mezclar lucide/phosphor/react-icons en una misma pantalla.

### Formularios

- React Hook Form + Zod + resolvers ya cubren validación y errores.

### Tablas

- TanStack Table ya cubre ordenamiento, filtros, paginación y columnas responsive.

### Gráficas

- Recharts ya cubre KPIs, reportes, wallet y billing.
- No instalar ECharts salvo necesidad de mapas/series complejas demostrada.

### Mapas / tracking

No se detectó librería específica de mapas en `package.json`.

Decisión:

- No instalar mapas hasta identificar proveedor actual o necesidad concreta.
- Si se necesita tracking real, evaluar Mapbox/MapLibre/Google Maps según costos, licencias, performance y privacidad.
- Cualquier integración de tracking con ubicación real es `RISK HIGH` por datos sensibles y performance.

### Animaciones

- Framer Motion ya existe.
- Usar solo microinteracciones necesarias.
- Respetar reduced motion.

### QA

- Playwright ya existe.
- Recomendación opcional: `@axe-core/playwright` para accesibilidad automatizada.

## Formato obligatorio para proponer una dependencia

```md
Nombre:
Categoría:
Problema que resuelve:
Dónde se usaría en KargaX:
Comando:
Riesgo:
Impacto/peso esperado:
Alternativa:
Decisión:
Notas de implementación:
```

## Regla final de dependencias

Una dependencia nueva solo se acepta si mejora al menos una de estas dimensiones:

- UX operativa.
- Velocidad de desarrollo sin deuda alta.
- Accesibilidad.
- Performance.
- Confianza empresarial.
- Mantenimiento del design system.
- QA/release safety.

Si solo mejora “estética” pero agrega peso o duplicidad, no se instala.
