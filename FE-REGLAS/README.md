# FE-REGLAS · KargaX Frontend Responsive System

**Estado:** estándar técnico para frontend KargaX.  
**Alcance:** `frontend/` Next.js + React + TypeScript + Tailwind CSS + Radix + TanStack + Recharts + Playwright.  
**Uso:** obligatorio para cualquier vista nueva, refactor responsive, auditoría visual o revisión QA.

## Qué es FE-REGLAS

`FE-REGLAS/` es el sistema de reglas frontend de KargaX. Define cómo debe verse, comportarse y probarse cada pantalla del SaaS logístico en celulares, tablets, laptops, desktop, monitores grandes y ultra wide.

No es una guía genérica. Es una especificación de ingeniería para que KargaX se sienta como un **sistema operativo logístico premium B2B**: rápido, claro, accesible, confiable y vendible a empresas grandes.

## Por qué existe

KargaX maneja flujos donde un error visual puede convertirse en error operativo: ruta equivocada, evidencia mal cargada, liquidación confusa, acción de wallet incorrecta, marketplace mezclado con operación privada o datos financieros difíciles de leer.

Este estándar existe para evitar:

- Overflow horizontal en móvil.
- Sidebars invasivos que tapan contenido.
- Tablas imposibles de usar en celulares.
- Formularios largos sin jerarquía.
- Modales que no caben en pantalla.
- Dashboards saturados o vacíos en ultra wide.
- Marketplace mezclado visualmente con flota privada.
- Wallet privado confundido con wallet marketplace.
- Evidencia privada confundida con evidencia marketplace.
- Estados logísticos dependientes solo del color.
- Flujos críticos sin loading, empty, error u offline state.

## Stack detectado y reglas base existentes

Antes de proponer dependencias nuevas, el stack real revisado en `frontend/package.json` ya incluye herramientas suficientes para construir un frontend premium:

- Framework: Next.js, React, React DOM.
- Estilos: Tailwind CSS 4, `clsx`, `class-variance-authority`, `tailwind-merge`.
- UI accesible: Radix Dialog, Dropdown Menu, Popover, Progress, Separator, Slot, Switch, Tabs, Tooltip, Avatar.
- Drawer móvil: `vaul`.
- Iconos: `lucide-react`, `@phosphor-icons/react`, `react-icons`.
- Formularios: `react-hook-form`, `@hookform/resolvers`, `zod`.
- Tablas: `@tanstack/react-table`.
- Gráficas: `recharts`, `react-countup`.
- Data/UI state: `@tanstack/react-query`, `zustand`, `sonner`.
- QA: `playwright`, scripts `visual:qa`, `visual:qa:browser`, `lint`, `typecheck`, `build`, `check`.

`frontend/src/app/globals.css` ya tiene tokens globales, anti-overflow, `min-width: 320px`, `overflow-x: hidden`, `max-width: 100%` para medios, focus visible y helpers como `.kx-card-grid` y `.kx-responsive-actions`. Estas reglas deben reforzarse, no duplicarse ni romperse.

## Cómo debe usarlo un desarrollador

Antes de tocar una vista:

1. Leer `FE-REGLAS/README.md`.
2. Leer el archivo específico según el tipo de vista:
   - Layout/sidebar: `02-navegacion-sidebar-responsive.md`.
   - Tablas, cards o forms: `03-tablas-cards-formularios.md`.
   - Dashboard/reportes/mapas: `04-dashboard-reportes-graficas.md`.
   - Marketplace/wallet/evidencia: `05-marketplace-wallet-evidencia.md`.
   - Accesibilidad/performance: `06-accesibilidad-performance.md`.
   - Dependencias: `07-dependencias-fe-recomendadas.md`.
   - QA responsive: `08-checklist-qa-responsive.md`.
3. Leer la vista actual y sus componentes hijos.
4. Leer estilos globales y utilidades existentes antes de crear nuevas clases.
5. Refactorizar mobile-first.
6. Probar manualmente y, cuando aplique, con Playwright.
7. Documentar riesgos, especialmente si toca wallet, billing, evidencia legal, roles, RLS o datos multiempresa.

## Cómo debe usarlo una IA

Toda IA que trabaje sobre KargaX debe:

- Leer primero `FE-REGLAS/` completo o el subconjunto relevante.
- Leer `frontend/package.json` antes de proponer dependencias.
- Leer `frontend/src/app/globals.css` antes de proponer estilos globales.
- Leer la vista, componentes relacionados, hooks, servicios y tipos usados.
- No inventar rutas, endpoints, tablas ni columnas.
- No tocar wallet, billing, liquidaciones, RLS, roles o datos multiempresa sin marcar `RISK HIGH`.
- Mantener copy en español, operativo y claro.
- Entregar diffs pequeños, verificables y con pruebas.

Usar el prompt reutilizable en `09-prompt-ia-para-refactor-responsive.md`.

## Archivos del repo que se deben revisar antes de tocar una vista

### Siempre revisar

- `frontend/package.json`: stack, dependencias, scripts.
- `frontend/src/app/layout.tsx`: fuentes, metadata, viewport, providers, toast global.
- `frontend/src/app/globals.css`: tokens, reset, helpers responsive, focus, anti-overflow.
- Archivo de la vista: `frontend/src/app/**/page.tsx` o ruta equivalente.
- Componentes usados por la vista: `frontend/src/components/**`.
- Hooks y servicios usados: `frontend/src/hooks/**`, `frontend/src/lib/**`.
- Tipos y schemas: `frontend/src/types/**`, schemas Zod o tipos locales.

### Si toca navegación o layout

- Componentes de sidebar/header/drawer existentes.
- Providers de theme o sesión.
- Rutas protegidas y guards.
- Menús por rol.

### Si toca datos, permisos o seguridad visual

- Server-side guards en `frontend/src/lib/server/**`.
- Clientes Supabase en `frontend/src/lib/**`.
- Migraciones relevantes en `supabase/migrations/` solo para entender estructura; no editar migraciones antiguas.
- Documentos `SPTRINTS/` y `COMMERCIAL/` si el cambio afecta estrategia, planes o monetización.

### Si toca billing/wallet/liquidaciones

- Rutas y componentes de planes, billing, wallet, liquidaciones y checkout.
- Pricing, límites de planes y APIs de billing.
- Componentes financieros y validaciones visuales.

**Riesgo alto:** cualquier cambio visual que pueda confundir pagos, comisiones, saldos, liquidaciones, planes, límites, checkout o estado financiero.

## Módulos de KargaX con mayor riesgo visual

1. **Wallet privado:** confusión de saldos internos, costos, pagos propios o liquidaciones internas.
2. **Wallet marketplace:** confusión de comisiones, pagos a terceros, proveedores o conductores externos.
3. **Billing y planes:** errores de precio, límite, upgrade/downgrade, Mercado Pago o paywall.
4. **Liquidaciones:** errores de estado, monto, fecha, responsable, origen o comprobante.
5. **Evidencia digital privada:** pruebas de entrega internas, PIN/POD, foto, firma, novedad.
6. **Evidencia marketplace:** evidencia ligada a rutas públicas/ofertas externas.
7. **Marketplace:** separación visual de oportunidades públicas vs operación propia.
8. **Flota privada:** control interno, conductores propios, rutas propias.
9. **Reportes financieros:** valores y tendencias deben ser legibles y alineados.
10. **Tracking/mapas:** no deben bloquear scroll ni consumir performance innecesaria.

## Qué significa “vista responsive terminada”

Una vista responsive terminada en KargaX cumple todo esto:

- Funciona desde 320px sin pérdida de información crítica.
- No hay overflow horizontal global.
- El contenido principal nunca queda debajo del sidebar, header, drawer o footer.
- En móvil, tablas grandes se convierten en cards/listas o tienen scroll interno controlado.
- En tablet, la densidad baja sin perder jerarquía.
- En desktop, aprovecha el espacio sin estirar texto, tablas o cards de forma absurda.
- En ultra wide, usa `max-width` y paneles útiles, no vacío visual.
- Botones e inputs táctiles miden mínimo 44px de alto en móvil.
- Todo formulario tiene labels visibles, errores por campo y acciones claras.
- Todo modal/drawer cabe en pantalla, tiene scroll interno si hace falta, focus visible y cierre por Escape/overlay/botón.
- Toda vista tiene loading, empty y error state.
- Estados logísticos usan texto + color + icono o señal visual secundaria.
- Se probaron las resoluciones del checklist QA.
- Se documentaron riesgos si toca wallet, billing, liquidaciones, evidencia legal, roles, permisos, RLS o datos multiempresa.

## Ninguna vista se considera terminada si

- Tiene overflow horizontal.
- El sidebar tapa contenido.
- Las tablas no se pueden leer en móvil.
- Los botones son difíciles de tocar.
- Los formularios se rompen.
- Los modales no caben en pantalla.
- Marketplace y flota privada se mezclan visualmente.
- Wallet privado y wallet marketplace se confunden.
- Evidencia digital privada y evidencia marketplace se confunden.
- No existen estados loading, empty y error.
- No se probó en móviles reales o DevTools.
- No se probó en tablet.
- No se probó en desktop.
- No se probó en ultra wide.

## Criterios globales de toda pantalla

- **Mobile-first:** empezar con una columna, contenido crítico y CTA claro.
- **Adaptación por contenido:** agregar breakpoints cuando el contenido se rompe, no por capricho visual.
- **Jerarquía operativa:** estado, ruta, fecha, responsable, valor y acción principal deben ser fáciles de encontrar.
- **Separación de contexto:** privado, marketplace, wallet, evidencia y billing nunca deben parecer el mismo flujo.
- **Densidad profesional:** más información en desktop, menos ruido en móvil.
- **Accesibilidad:** foco visible, navegación por teclado, labels, contraste y estados no dependientes solo del color.
- **Performance:** evitar layouts pesados, mapas innecesarios, gráficas excesivas y animaciones que bloqueen operación.
- **Copy operativo:** explicar qué pasó, qué falta y cuál es el siguiente paso.

## Regla de oro KargaX

KargaX debe verse como un **sistema operativo logístico premium**. Cada vista debe ayudar a una empresa a operar más rápido, entender mejor su logística, reducir errores y confiar en la plataforma.

Si una pantalla no mejora velocidad operativa, claridad, seguridad o confianza empresarial, debe simplificarse.

## Fuentes técnicas base

- MDN Responsive Design.
- MDN CSS Grid, Flexbox y Container Queries.
- MDN `clamp()`, `min()`, `max()`.
- W3C WCAG 2.2.
- WAI-ARIA Modal Dialog Pattern.
- web.dev CLS e INP.
