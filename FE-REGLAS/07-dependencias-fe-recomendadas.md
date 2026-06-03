# 07 · Dependencias frontend recomendadas KargaX

## Objetivo

Documentar las dependencias frontend actuales, qué se debe reutilizar, qué no se debe duplicar y qué se podría agregar solo si aporta valor real a UX, accesibilidad, performance, confianza empresarial o mantenimiento.

## Regla principal

No instalar dependencias por estética. En KargaX una dependencia solo entra si mejora operación logística, reduce errores, mejora accesibilidad, acelera desarrollo seguro o fortalece confianza B2B.

## Dependencias actuales detectadas

`frontend/package.json` ya contiene una base fuerte:

### Framework y runtime

- `next`.
- `react`.
- `react-dom`.
- `typescript`.

### Estilos y composición

- `tailwindcss`.
- `@tailwindcss/postcss`.
- `clsx`.
- `class-variance-authority`.
- `tailwind-merge`.

### UI / componentes

- `@radix-ui/react-avatar`.
- `@radix-ui/react-dialog`.
- `@radix-ui/react-dropdown-menu`.
- `@radix-ui/react-popover`.
- `@radix-ui/react-progress`.
- `@radix-ui/react-separator`.
- `@radix-ui/react-slot`.
- `@radix-ui/react-switch`.
- `@radix-ui/react-tabs`.
- `@radix-ui/react-tooltip`.
- `vaul`.
- `sonner`.

### Iconos

- `lucide-react`.
- `@phosphor-icons/react`.
- `react-icons`.

### Formularios y validación

- `react-hook-form`.
- `@hookform/resolvers`.
- `zod`.

### Tablas

- `@tanstack/react-table`.

### Gráficas y métricas

- `recharts`.
- `react-countup`.

### Data/state

- `@tanstack/react-query`.
- `@tanstack/react-query-devtools`.
- `zustand`.
- `axios`.

### Archivos, pagos y seguridad

- `react-dropzone`.
- `mercadopago`.
- `react-google-recaptcha`.
- `@types/react-google-recaptcha`.
- `jspdf`.

### Animaciones

- `framer-motion`.
- `embla-carousel-react`.

### QA/dev

- `playwright`.
- `eslint`.
- `eslint-config-next`.

## Dependencias que se deben reutilizar

- **Modales:** usar Radix Dialog.
- **Dropdowns:** usar Radix Dropdown Menu.
- **Popovers:** usar Radix Popover.
- **Tabs:** usar Radix Tabs.
- **Tooltips:** usar Radix Tooltip.
- **Drawer móvil:** usar Vaul.
- **Toast:** usar Sonner o componente existente.
- **Forms:** usar React Hook Form + Zod.
- **Tablas:** usar TanStack Table.
- **Charts:** usar Recharts.
- **Iconos:** preferir `lucide-react` como principal; evitar mezclar tres familias en una misma vista.
- **Motion:** usar Framer Motion solo para microinteracciones necesarias.
- **QA responsive:** usar Playwright existente.

## Dependencias que NO se deben instalar por ahora

- `@headlessui/react`: duplica Radix.
- Otra librería de modales/drawers: ya existen Radix y Vaul.
- Otra librería de tablas: ya existe TanStack Table.
- Formik/Yup: ya existen React Hook Form y Zod.
- Más librerías de iconos: ya existen 3.
- ECharts: solo evaluar si Recharts no cubre un caso real de reportes logísticos.
- Librerías pesadas de dashboard templates: rompen identidad visual y aumentan deuda.
- Animaciones pesadas innecesarias: pueden afectar operación en móviles.

## Recomendaciones por categoría

### UI / Componentes

#### Nombre: `@radix-ui/react-accordion`

- Categoría: Accordion.
- Problema que resuelve: secciones colapsables accesibles para filtros, formularios largos y grupos de sidebar.
- Dónde se usaría: filtros móviles, formularios de carga, evidencia, sidebar agrupado.
- Comando: `npm install @radix-ui/react-accordion`.
- Riesgo: bajo.
- Alternativa: implementar con HTML nativo `details/summary` si el caso es simple.
- Decisión: opcional, instalar solo si no existe accordion propio.
- Notas: útil para mobile-first y accesibilidad.

#### Nombre: `@radix-ui/react-alert-dialog`

- Categoría: Confirmaciones críticas.
- Problema que resuelve: confirmaciones accesibles para acciones destructivas o financieras.
- Dónde se usaría: cancelar liquidación, eliminar usuario, confirmar cambio de plan, cerrar evidencia.
- Comando: `npm install @radix-ui/react-alert-dialog`.
- Riesgo: medio-alto si se usa en wallet/billing; la librería es segura, el flujo es delicado.
- Alternativa: Radix Dialog con patrón de confirmación propio.
- Decisión: recomendado si las confirmaciones actuales no son robustas.
- Notas: marcar `RISK HIGH` cuando se aplique a pagos, billing, liquidaciones o evidencia legal.

### Iconos

#### Nombre: `lucide-react`

- Categoría: iconografía.
- Problema que resuelve: iconos limpios y consistentes.
- Dónde se usaría: sidebar, KPIs, estados, acciones.
- Comando: ya instalado.
- Riesgo: bajo.
- Alternativa: Phosphor si ya domina un módulo.
- Decisión: reutilizar, no instalar más packs.
- Notas: elegir una familia por pantalla.

### Formularios

#### Nombre: `react-hook-form` + `zod`

- Categoría: formularios/validación.
- Problema que resuelve: validación declarativa, errores por campo y performance.
- Dónde se usaría: solicitudes de carga, evidencia, billing, wallet, usuarios.
- Comando: ya instalado.
- Riesgo: alto si se cambia validación en wallet/billing/RLS.
- Alternativa: validación nativa para formularios simples.
- Decisión: reutilizar.
- Notas: no eliminar validaciones existentes.

### Tablas

#### Nombre: `@tanstack/react-table`

- Categoría: tablas.
- Problema que resuelve: sorting, filtros, paginación, columnas responsive.
- Dónde se usaría: envíos, marketplace, wallet, liquidaciones, usuarios, reportes.
- Comando: ya instalado.
- Riesgo: medio; alto si se aplica a liquidaciones/wallet.
- Alternativa: tabla simple para listas pequeñas.
- Decisión: reutilizar.
- Notas: en móvil transformar a cards cuando la tabla sea ilegible.

### Gráficas

#### Nombre: `recharts`

- Categoría: gráficas.
- Problema que resuelve: KPIs, reportes operativos, wallet, billing.
- Dónde se usaría: dashboards y reportes.
- Comando: ya instalado.
- Riesgo: medio por performance si hay muchas gráficas.
- Alternativa: cards KPI sin gráfica cuando el dato es simple.
- Decisión: reutilizar.
- Notas: reducir series en móvil.

### Mapas / tracking

No instalar nada sin revisar el mapa real existente. Mapas pueden afectar performance y costos.

Formato para decidir:

- ¿El usuario necesita mapa en esa vista o basta lista/estado?
- ¿Se carga lazy?
- ¿Tiene fallback?
- ¿No bloquea scroll móvil?
- ¿Respeta datos multiempresa?

Riesgo: alto si muestra ubicación, rutas privadas, evidencia o datos sensibles.

### Animaciones

#### Nombre: `framer-motion`

- Categoría: microinteracciones.
- Problema que resuelve: transiciones suaves y sensación premium.
- Dónde se usaría: drawer, cards, estado loading, cambios de tabs.
- Comando: ya instalado.
- Riesgo: medio por performance si se abusa.
- Alternativa: CSS transitions.
- Decisión: reutilizar con moderación.
- Notas: respetar `prefers-reduced-motion`.

### QA

#### Nombre: `@playwright/test`

- Categoría: QA responsive.
- Problema que resuelve: screenshots por viewport, pruebas visuales, flujos críticos.
- Dónde se usaría: release gates, responsive QA, smoke tests.
- Comando: `npm install -D @playwright/test` si el proyecto usa solo `playwright` y faltan test runner/imports.
- Riesgo: bajo.
- Alternativa: script actual `visual:qa` si ya cubre los casos.
- Decisión: revisar antes de instalar.
- Notas: no duplicar si los scripts actuales ya funcionan.

#### Nombre: `@axe-core/playwright`

- Categoría: accesibilidad automatizada.
- Problema que resuelve: detección de problemas WCAG en flujos principales.
- Dónde se usaría: login, dashboard, marketplace, wallet, evidencia, billing.
- Comando: `npm install -D @axe-core/playwright`.
- Riesgo: bajo.
- Alternativa: revisión manual con DevTools/Lighthouse.
- Decisión: recomendado para fase QA pro.
- Notas: iniciar como reporte, no bloquear release hasta estabilizar.

## Reglas para instalar cualquier dependencia

1. Revisar `frontend/package.json`.
2. Confirmar que no existe alternativa instalada.
3. Medir impacto de bundle si es pesada.
4. Explicar razón de negocio.
5. Definir dónde se usará.
6. Marcar riesgo si toca wallet, billing, mapas, evidencia, roles o datos sensibles.
7. Ejecutar `npm install`.
8. Ejecutar `npm run lint`, `npm run typecheck`, `npm run build`.
9. Actualizar este documento.

## Decisión actual

No instalar nuevas dependencias por defecto. KargaX ya tiene base suficiente para construir un frontend premium. La prioridad debe ser usar bien lo existente: Radix, Vaul, Tailwind, TanStack Table, Recharts, React Hook Form, Zod y Playwright.
