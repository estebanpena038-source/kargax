# CONTROL DE MARGEN · IMPLEMENTACIÓN FRONTEND KARGAX

Documento creado para guiar el refactor de la vista `/dashboard/control-margen` con base en el código real del repo `estebanpena038-source/kargax` y las reglas existentes en `FE-REGLAS/`.

> Estado del cambio documentado: **solo documentación**. No modifica lógica de negocio, auth, RLS, wallet, billing, liquidaciones, marketplace ni base de datos.

---

## 1. Resumen del análisis

La ruta real `/dashboard/control-margen` existe en `frontend/src/app/dashboard/control-margen/page.tsx` y actualmente solo renderiza `LastMileDashboard` desde `frontend/src/components/last-mile/LastMileDashboard.tsx`.

La vista actual funciona como un panel Enterprise de Last Mile para leer viajes del mes, crear snapshots de costo, comparar costo esperado contra costo final, calcular fuga estimada por sobrecosto, medir evidencia, generar scorecards por proveedor y abrir recomendaciones de renegociación.

El módulo **no es un flujo de wallet ni de billing**. El propio copy de Last Mile declara límites seguros: no mueve wallet, no crea pagos, no publica marketplace, no asigna conductores y no modifica liquidaciones. Esa separación debe conservarse.

Hallazgo principal: el backend y la separación de permisos están bien protegidos para una primera versión, pero la UI todavía no cumple completamente `FE-REGLAS/` porque las tablas grandes siguen dependiendo de scroll horizontal en móvil, el formulario rápido de contrato usa placeholders como labels, las alertas críticas no siempre tienen prioridad visual absoluta, falta mejor lectura de rutas con pérdida/utilidad operativa, y la separación visual entre marketplace, flota privada y proveedor externo no está suficientemente explícita en las tablas.

Recomendación concreta: hacer un refactor **frontend-only** en fases, manteniendo los endpoints y tipos actuales, para convertir el panel en una vista mobile-first de decisión financiera-operativa: primero alertas y rutas críticas, luego KPIs, después rutas/proveedores/snapshots/contratos con cards móviles y tablas desktop.

---

## 2. Archivos analizados

### Ruta `/dashboard/control-margen`

| Archivo | Qué hace |
|---|---|
| `frontend/src/app/dashboard/control-margen/page.tsx` | Página Next.js de la ruta. Renderiza únicamente `<LastMileDashboard />`. No contiene lógica propia. |

### Vista principal

| Archivo | Qué hace |
|---|---|
| `frontend/src/components/last-mile/LastMileDashboard.tsx` | Componente principal del módulo. Maneja estado de mes, loading, error, recompute, paywall, permisos, creación rápida de contrato, archivado de contratos, actualización de alertas/renegociaciones y composición de todos los paneles. |

### Componentes de Control de margen / Last Mile

| Archivo | Qué hace |
|---|---|
| `frontend/src/components/last-mile/LastMileKpiCards.tsx` | Muestra 6 KPIs: fuga estimada, viajes observados, costo final, evidencia completa, alertas abiertas y contratos por vencer. |
| `frontend/src/components/last-mile/MarginAlertsPanel.tsx` | Lista alertas abiertas de margen con severidad, estado, proveedor, ruta, oportunidad y acciones de gestión. |
| `frontend/src/components/last-mile/ProviderScorecardTable.tsx` | Tabla de scorecards por proveedor: score, viajes, evidencia, sobrecosto promedio y fuga estimada. |
| `frontend/src/components/last-mile/ContractsTable.tsx` | Tabla de contratos de margen: proveedor, ruta, estado, modelo, base, vigencia y acción de archivar. |
| `frontend/src/components/last-mile/RenegotiationPipeline.tsx` | Pipeline tipo kanban para casos de renegociación por estado. |
| `frontend/src/components/last-mile/RouteCostSnapshotsTable.tsx` | Tabla de snapshots por viaje con ruta, proveedor, estado, esperado, final, sobrecosto, evidencia y fecha observada. |
| `frontend/src/components/last-mile/LastMilePaywall.tsx` | Paywall Enterprise con CTA a planes e inteligencia. |
| `frontend/src/components/last-mile/LastMileEmptyState.tsx` | Estado vacío cuando todavía no hay análisis de margen. Permite recalcular si el rol tiene permiso. |
| `frontend/src/components/last-mile/LastMileExplainer.tsx` | Explica cómo Last Mile transforma viajes en decisiones y muestra pasos/guardrails. |

### Servicios, tipos y copy Last Mile

| Archivo | Qué hace |
|---|---|
| `frontend/src/lib/last-mile/client.ts` | Cliente frontend para consumir `/api/last-mile/*`. Obtiene token de Supabase, arma headers, maneja errores y expone métodos de dashboard, contratos, recompute, alertas y renegociaciones. |
| `frontend/src/lib/last-mile/types.ts` | Tipos compartidos del módulo: carriers, lanes, contracts, snapshots, scorecards, recomendaciones, acceso y respuesta del dashboard. |
| `frontend/src/lib/last-mile/copy.ts` | Copy operativo y guardrails: viajes, evidencia, contratos, margen, decisión; no mover wallet/pagos/marketplace/conductores/liquidaciones. |

### API y servidor Last Mile

| Archivo | Qué hace |
|---|---|
| `frontend/src/app/api/last-mile/dashboard/route.ts` | GET del dashboard. Requiere AAL2, resuelve empresa/rol, valida acceso y carga datos del periodo. |
| `frontend/src/app/api/last-mile/contracts/route.ts` | GET/POST de contratos. Lista contratos o crea contrato validado con Zod y permisos. |
| `frontend/src/app/api/last-mile/contracts/[id]/route.ts` | PATCH/DELETE de contrato. Actualiza o archiva contrato con permisos de administración. |
| `frontend/src/app/api/last-mile/snapshots/recompute/route.ts` | POST de recomputo de snapshots. Requiere permiso `canRunRecompute`. |
| `frontend/src/app/api/last-mile/alerts/[id]/route.ts` | GET/PATCH de alertas de margen. PATCH requiere permiso de renegociación. |
| `frontend/src/app/api/last-mile/renegotiations/route.ts` | GET/POST de renegociaciones. Usa la misma base de recomendaciones de margen. |
| `frontend/src/app/api/last-mile/renegotiations/[id]/route.ts` | PATCH de renegociación. Requiere permiso de renegociación. |
| `frontend/src/lib/server/last-mile/index.ts` | Barrel de servidor para access, alerts, contracts, cost-engine, dashboard, errors, renegotiations, schemas, scorecards y snapshots. |
| `frontend/src/lib/server/last-mile/access.ts` | Entitlements, permisos, rango mensual, resolución de business scope y validaciones de acceso. |
| `frontend/src/lib/server/last-mile/dashboard.ts` | Carga dashboard, scorecards, contratos, observaciones, top routes, top carriers, métricas y alertas abiertas. |
| `frontend/src/lib/server/last-mile/cost-engine.ts` | Fórmulas de costo contratado, costo real, variación, evidencia, puntualidad, completitud y score de proveedor. |
| `frontend/src/lib/server/last-mile/snapshots.ts` | Recalcula snapshots desde `cargo_offers`, evidencia, incidentes, contratos y carriers/lanes. |
| `frontend/src/lib/server/last-mile/contracts.ts` | CRUD de contratos, carriers, lanes, validación de límites y eventos de auditoría. |
| `frontend/src/lib/server/last-mile/scorecards.ts` | Genera y lista scorecards por proveedor. |
| `frontend/src/lib/server/last-mile/alerts.ts` | Genera/lista/actualiza recomendaciones por sobrecosto o evidencia incompleta. |
| `frontend/src/lib/server/last-mile/renegotiations.ts` | Alias operativo para listar/crear/actualizar recomendaciones como renegociaciones. |
| `frontend/src/lib/server/last-mile/schemas.ts` | Schemas Zod para contratos, recompute y recomendaciones. |
| `frontend/src/lib/server/last-mile/errors.ts` | Error mapper del módulo. |
| `frontend/src/lib/server/route-auth.ts` | Auth server-side, AAL2, token, perfil y `resolveScopedBusinessId` para evitar fuga multiempresa. |

### Last Mile, costos, margen, evidencia y proveedores

| Archivo | Qué hace |
|---|---|
| `frontend/src/lib/server/last-mile/cost-engine.ts` | Define la base financiera-operativa: costo esperado, costo final, sobrecosto, evidencia y score. |
| `frontend/src/lib/server/last-mile/snapshots.ts` | Une viajes, flota privada/marketplace, evidencia, incidentes y contratos para crear observaciones. |
| `frontend/src/lib/server/last-mile/dashboard.ts` | Resume observaciones en KPIs, rutas y proveedores. |
| `frontend/src/components/last-mile/RouteCostSnapshotsTable.tsx` | Presenta costos por viaje/ruta. |
| `frontend/src/components/last-mile/ProviderScorecardTable.tsx` | Presenta desempeño y fuga por proveedor. |
| `frontend/src/components/last-mile/MarginAlertsPanel.tsx` | Presenta rutas/proveedores que requieren acción. |

### Wallet

| Archivo | Qué hace |
|---|---|
| `frontend/src/app/billetera/page.tsx` | Dashboard de billetera operativa, retiros, saldos, transacciones, wallet marketplace y ledger de flota privada. Se analizó para confirmar separación de Control de margen. No se debe tocar en este refactor. |

### Billing / planes

| Archivo | Qué hace |
|---|---|
| `frontend/src/app/planes/page.tsx` | Pantalla de planes y facturación. El plan Enterprise menciona Control de margen como feature comercial. No se debe tocar salvo copy coordinado con Revenue. |

### Marketplace

| Archivo | Qué hace |
|---|---|
| `frontend/src/app/ofertas/page.tsx` | Marketplace de cargas/ofertas con filtros, cards móviles y estados. Es referencia útil para patrón mobile-first y separación marketplace. |
| `frontend/src/app/pod-marketplace/page.tsx` | Evidencia marketplace/POD para rutas públicas. Se analizó para no mezclarla visualmente con evidencia privada ni Control de margen. |

### Flota privada

| Archivo | Qué hace |
|---|---|
| `frontend/src/app/dashboard/flota/page.tsx` | Gestión de flota privada, conductores, compensación, nómina/ruta/viáticos y comprobantes externos. Control de margen lee datos asociados pero no debe modificar esta lógica. |

### Layouts, navegación, rutas protegidas y estilos

| Archivo | Qué hace |
|---|---|
| `frontend/src/app/layout.tsx` | Layout raíz, fuentes, providers, viewport y toast global. |
| `frontend/src/app/globals.css` | Tokens, anti-overflow, `min-width: 320px`, helpers responsive, focus visible y utilidades globales. |
| `frontend/src/components/layouts/DashboardLayout.tsx` | Layout protegido del dashboard. Maneja auth client-side, sidebar desktop, drawer móvil, header, warehouse access y navegación por rol. |
| `frontend/src/components/layouts/SIDEBAR/navigation.tsx` | Define navegación por secciones. `Control de margen` aparece en `Operación privada` para navegación general y en `Dinero y límites` para navegación scoped de bodega. |

### Reglas leídas desde `FE-REGLAS/`

| Archivo | Qué regula |
|---|---|
| `FE-REGLAS/README.md` | Estándar obligatorio KargaX frontend, lectura previa, mobile-first, riesgos y criterios globales. |
| `FE-REGLAS/02-navegacion-sidebar-responsive.md` | Sidebar/drawer, navegación por contexto, separación privado/marketplace/wallet/evidencia y breadcrumbs. |
| `FE-REGLAS/03-tablas-cards-formularios.md` | Tablas, cards, formularios, filtros, acciones, loading, empty, error, labels y acciones destructivas. |
| `FE-REGLAS/04-dashboard-reportes-graficas.md` | KPIs, dashboards, reportes, gráficas, mapas, alertas críticas y jerarquía financiera. |
| `FE-REGLAS/05-marketplace-wallet-evidencia.md` | Separación crítica de marketplace, flota privada, wallet, liquidaciones, billing, evidencia, PIN/POD, foto/firma. |
| `FE-REGLAS/06-accesibilidad-performance.md` | Accesibilidad, focus, ARIA, touch targets, skeletons, performance, tablas accesibles y reduced motion. |
| `FE-REGLAS/07-dependencias-fe-recomendadas.md` | Dependencias actuales y regla de no instalar librerías por estética. |
| `FE-REGLAS/08-checklist-qa-responsive.md` | Matriz de QA responsive, viewports obligatorios y clasificación PASS/FAIL/NEEDS FIX/RISK HIGH. |
| `FE-REGLAS/09-prompt-ia-para-refactor-responsive.md` | Prompt operativo para otra IA que vaya a ejecutar el refactor. |

Nota: se intentó ubicar un archivo `FE-REGLAS/01-breakpoints-layout.md`, pero no existe en el repo actual. La matriz de breakpoints aplicable vive en `08-checklist-qa-responsive.md` y también está referenciada en `09-prompt-ia-para-refactor-responsive.md`.

---

## 3. Funcionamiento actual del control de margen

### 3.1 Entrada a la vista

1. El usuario entra a `/dashboard/control-margen`.
2. `page.tsx` renderiza `LastMileDashboard`.
3. `LastMileDashboard` se monta dentro de `DashboardLayout` con `pageTitle="Control de margen"`.
4. `DashboardLayout` valida sesión desde el store de auth y, si no hay usuario, redirige a `/login?redirect=/dashboard/control-margen`.
5. La API real vuelve a validar sesión con `requireAal2Route`. La seguridad no depende solo del frontend.

### 3.2 Datos y servicios que llama

La vista usa `lastMileClient.getDashboard({ month })`, que llama `GET /api/last-mile/dashboard?month=YYYY-MM`.

El backend:

1. Requiere AAL2.
2. Resuelve `businessId` con `resolveLastMileRouteContext`.
3. Valida plan/rol con `assertLastMileView`.
4. Calcula rango mensual con `getMonthRange`.
5. Carga dashboard con `loadLastMileDashboard`.

Acciones disponibles:

- `recomputeSnapshots({ month })` → `POST /api/last-mile/snapshots/recompute`.
- `createContract(payload)` → `POST /api/last-mile/contracts`.
- `archiveContract(id)` → `DELETE /api/last-mile/contracts/[id]`.
- `updateRenegotiation(id, payload)` → `PATCH /api/last-mile/renegotiations/[id]`.

### 3.3 Qué costos muestra

Actualmente muestra:

- Costo esperado (`expected_cost_cop`).
- Costo final (`final_cost_cop`).
- Sobrecosto (`overrun_cop`).
- Fuga estimada agregada (`leakageCop`, suma positiva de sobrecostos).
- Costo esperado total.
- Costo final total.
- Sobrecosto promedio porcentual (`avgOverrunPct`).
- Base de contrato (`base_rate_cop`) en contratos.

También existen campos en tipos/snapshots que hoy no están bien explotados visualmente:

- `agreed_cost_cop`.
- `platform_fee_cop`.
- `payout_cost_cop`.
- `private_expense_cost_cop`.
- `incident_cost_cop`.
- `pricing_snapshot.isPrivateFleet`.

### 3.4 Qué margen calcula o presenta

La vista presenta margen de forma operativa como **sobrecosto/fuga estimada**, no como utilidad neta P&L completa.

Actualmente no hay una columna explícita de ingreso, precio cobrado al cliente final o utilidad neta por ruta. Por eso el refactor debe evitar afirmar “utilidad real” si los datos actuales solo permiten leer “fuga”, “sobrecosto” y “oportunidad de ahorro”.

Recomendación: usar copy preciso:

- Correcto: `Ruta con fuga`, `Sobrecosto`, `Oportunidad de ahorro`, `Riesgo de margen`.
- Evitar sin nuevo dato: `Utilidad neta`, `Ganancia real`, `Pérdida contable`.

Si el negocio quiere utilidad neta real por ruta, se debe diseñar una mejora backend/API separada y marcarla `RISK HIGH` por datos financieros.

### 3.5 Qué evidencia muestra

Actualmente muestra:

- KPI `Evidencia completa`.
- Score de evidencia por snapshot.
- Score de evidencia en scorecards.
- Alertas por evidencia incompleta.
- Copy de proceso que menciona PIN, POD, fotos, firma, novedades e incidentes.

Limitación actual:

- La UI no muestra en cada ruta qué evidencia específica falta: PIN/POD, foto, firma, picking, novedad o incidente.
- `RouteCostSnapshotsTable` solo muestra porcentaje de evidencia, no desglose.
- La separación entre evidencia privada y evidencia marketplace no es explícita en cada fila/card.

### 3.6 Qué proveedores muestra

Actualmente muestra:

- Proveedor en snapshots.
- Proveedor en contratos.
- Proveedor en alertas.
- Proveedor en scorecards.
- Top proveedores a revisar por fuga estimada.

Limitación actual:

- El tipo de proveedor (`private_fleet`, `marketplace`, `external_provider`) existe en los tipos/datos, pero no se muestra de forma suficientemente visible.
- Falta una señal rápida de proveedor problemático: score bajo, evidencia baja, sobrecosto alto, muchas alertas o casos abiertos.

### 3.7 Filtros actuales

Filtros actuales reales:

- Mes (`input type="month"`).

No existen filtros reales en la vista para:

- Tipo de proveedor.
- Marketplace vs flota privada.
- Estado de ejecución.
- Evidencia incompleta.
- Sobrecosto alto.
- Severidad.
- Ruta.

Cualquier filtro nuevo debe operar sobre datos ya cargados o agregar endpoint/query param documentado aparte.

### 3.8 Loading, error y empty state

Loading actual:

- Usa skeletons tipo KPI al cargar dashboard.
- No hay skeletons específicos para tablas de snapshots, contratos o scorecards.

Error actual:

- `ErrorState` muestra mensaje y botón `Reintentar`.
- Si el error es 402 o 403, se muestra paywall/forbidden.
- No muestra requestId ni soporte.

Empty actual:

- Si no hay snapshots ni scorecards, se renderiza `LastMileEmptyState`.
- El empty explica que el recalculo convierte viajes en análisis sin tocar wallet/liquidaciones.
- Es una buena base y debe conservarse.

### 3.9 Qué ayuda a decidir hoy

Sí ayuda a decidir:

- Cuánta fuga estimada hay en el periodo.
- Qué proveedores concentran fuga.
- Qué rutas tienen fuga.
- Qué contratos están por vencer.
- Qué alertas están abiertas.
- Qué casos de renegociación están en pipeline.
- Qué tan completa está la evidencia agregada.

Todavía no es claro:

- Qué ruta requiere acción inmediata primero.
- Qué evidencia específica falta por ruta.
- Qué proveedor falla por sobrecosto vs evidencia vs cumplimiento.
- Qué registros son flota privada vs marketplace vs proveedor externo.
- Qué cálculo representa margen y cuál representa solo sobrecosto.
- Qué costos pertenecen a payout, plataforma, viáticos o gasto privado.

---

## 4. Lectura de `FE-REGLAS/` aplicada a `/dashboard/control-margen`

### `FE-REGLAS/README.md`

Aplica directamente. Control de margen es una vista financiera-operativa de alto riesgo visual. Debe:

- Funcionar desde 320px.
- No tener overflow horizontal global.
- No mezclar marketplace con flota privada.
- No mezclar wallet privado con wallet marketplace.
- No confundir evidencia privada con evidencia marketplace.
- Tener loading, empty y error states.
- Documentar riesgos si toca billing, wallet, liquidaciones, RLS, roles, datos multiempresa o datos financieros.

Acción para esta vista: refactor mobile-first, mantener copy en español operativo y no cambiar lógica crítica sin documentar `RISK HIGH`.

### `02-navegacion-sidebar-responsive.md`

Aplica en navegación y contexto del módulo.

- `DashboardLayout` ya tiene sidebar desktop y drawer móvil.
- `Control de margen` aparece en navegación principal como `Operación privada` y en navegación scoped de bodega como `Dinero y límites`.
- Esto puede ser aceptable, pero debe quedar claro en el título/copy que la vista es **Last Mile / margen operativo**, no wallet ni billing.

Acción: no mover la ruta en navegación en esta fase; sí reforzar breadcrumb/copy/context chip dentro de la vista: `Last Mile · Margen operativo · No mueve wallet`.

### `03-tablas-cards-formularios.md`

Aplica de forma crítica.

Problemas actuales frente a esta regla:

- Las tablas usan `overflow-x-auto` con `min-w-[56rem]`, `min-w-[58rem]` y `min-w-[64rem]`. Eso evita overflow global, pero en móvil no convierte a cards/listas.
- `ContractQuickForm` usa placeholders como labels, lo cual está prohibido.
- Archivar contrato no pide confirmación.
- Cerrar renegociación usa `window.prompt`, que no es un modal accesible.
- No hay paginación para snapshots, aunque se limita a `slice(0, 30)` sin explicar al usuario.

Acción: crear versión móvil en cards semánticas (`article`, `dl`, `dt`, `dd`) para contratos, scorecards y snapshots; agregar labels visibles; reemplazar prompt por modal/drawer accesible existente; agregar confirmación para archivar contrato.

### `04-dashboard-reportes-graficas.md`

Aplica directamente porque la vista es dashboard/reporting financiero-operativo.

Puntos cumplidos parcialmente:

- KPIs responden en grid.
- Números COP están formateados.
- Hay empty/error/loading.

Puntos a mejorar:

- Alertas críticas deben ir arriba o en zona prioritaria.
- Cada KPI debe tener tendencia/contexto/acción cuando aplique.
- No saturar con métricas; priorizar decisión.
- Mostrar origen de datos y periodo.
- En móvil no cargar demasiados paneles antes de la decisión principal.

Acción: ordenar así: alertas críticas/resumen de riesgo → KPIs → rutas con mayor fuga → proveedores → snapshots/contratos.

### `05-marketplace-wallet-evidencia.md`

Aplica con `RISK HIGH` conceptual porque la vista lee datos financieros, evidencia, roles, RLS y datos multiempresa.

Reglas directas:

- No mezclar marketplace con flota privada.
- No mezclar wallet privado con wallet marketplace.
- No mezclar evidencia privada con evidencia marketplace.
- Marcar `RISK HIGH` si se toca wallet, billing, liquidaciones, Mercado Pago, PIN/POD, foto/firma, roles, RLS, multiempresa o datos financieros.

Acción: la implementación frontend debe mostrar chips de contexto: `Flota privada`, `Marketplace`, `Proveedor externo` cuando el dato exista. También debe repetir el guardrail: `Lectura operativa; no mueve wallet ni liquidaciones`.

### `06-accesibilidad-performance.md`

Aplica directamente.

Problemas actuales:

- `window.prompt` no cumple patrón accesible.
- Formulario rápido no tiene labels visibles.
- Varias tablas no tienen alternativa móvil semántica.
- Íconos decorativos no siempre están marcados como `aria-hidden`.
- Loading actual es genérico y no reserva bien tablas/paneles.

Acción: mantener focus visible global, agregar labels, mejorar skeletons, usar botones con texto/aria-label, crear cards móviles semánticas y evitar animaciones pesadas.

### `07-dependencias-fe-recomendadas.md`

Aplica como restricción.

No se deben instalar dependencias nuevas para este refactor. El proyecto ya tiene:

- Tailwind.
- Radix.
- Vaul.
- TanStack Table.
- Recharts.
- Lucide.
- Sonner.
- Playwright scripts.

Acción: reutilizar componentes y dependencias actuales. Si se necesita modal de confirmación, usar Radix Dialog/componente UI existente antes de instalar algo.

### `08-checklist-qa-responsive.md`

Aplica como criterio final.

La vista debe probarse en:

- 320x568, 360x640, 375x667, 390x844, 414x896, 430x932.
- 640x900, 768x1024, 820x1180.
- 1024x768, 1024x1366, 1280x720, 1366x768, 1440x900, 1536x864.
- 1728x1117, 1920x1080, 2560x1440.

Resultado esperado: `PASS`. Si queda una tabla solo con scroll horizontal en móvil y sin card/lista alternativa, clasificar `NEEDS FIX`.

### `09-prompt-ia-para-refactor-responsive.md`

Aplica como instrucción para la IA o dev que implemente.

Acción: antes de tocar código, la IA/dev debe leer esta documentación, `FE-REGLAS/`, la vista, componentes, estilos globales, `frontend/package.json`, servicios y tipos. Debe entregar diffs pequeños y no inventar endpoints/tablas/columnas.

---

## 5. Problemas encontrados

### Diseño y jerarquía visual

- La vista abre con hero + explainer antes de priorizar alertas/rutas críticas. En operación real, el usuario debe ver primero dónde pierde dinero o dónde falta evidencia.
- `TopOpportunityList` muestra fuga, pero no clasifica riesgo, evidencia ni tipo de proveedor.
- Los KPIs son útiles, pero algunos no tienen acción contextual: por ejemplo, `Evidencia completa` debería llevar a rutas con evidencia baja.
- Falta una banda superior tipo “Acción inmediata” con 3-5 decisiones del periodo.

### Responsive

- `ProviderScorecardTable`, `ContractsTable` y `RouteCostSnapshotsTable` dependen de tablas anchas con scroll interno.
- En móvil deberían transformarse a cards/listas. El scroll interno puede quedar como fallback, no como patrón principal.
- `RenegotiationPipeline` en móvil se apila, pero sigue siendo denso y puede esconder casos relevantes.
- Falta indicador de “mostrando 30 de N” en snapshots.

### Componentización

- `TopOpportunityList`, `ErrorState` y `ContractQuickForm` viven dentro de `LastMileDashboard.tsx`.
- Hay formateadores COP repetidos en varios componentes.
- La lógica visual de riesgo no está centralizada.

### Claridad de costos

- Se muestra `Esperado`, `Final` y `Sobrecosto`, pero no se explica fórmula en la tabla.
- Campos existentes como `platform_fee_cop`, `payout_cost_cop` y `private_expense_cost_cop` no se visualizan o no se contextualizan.
- Riesgo: un usuario puede leer “margen” como utilidad neta cuando el cálculo actual representa sobrecosto/fuga.

### Claridad de margen

- No hay columna explícita `Resultado` con estados tipo `Con fuga`, `En rango`, `Sin contrato`, `Evidencia incompleta`.
- No hay ranking claro de pérdida/utilidad operativa. Con los datos actuales se debe hablar de fuga/sobrecosto, no de utilidad neta.

### Claridad de evidencia

- Solo se muestra porcentaje.
- No se ve qué falta: PIN/POD, foto, firma, picking, novedad/incidente.
- No se diferencia visualmente evidencia privada vs evidencia marketplace.

### Claridad de proveedores

- Scorecards muestran score, pero no explican la causa del score.
- No se muestra tipo de carrier de forma visible.
- No hay CTA claro por proveedor: renegociar, revisar evidencia, revisar contrato, reasignar volumen.

### Separación marketplace / privado

- El engine sí distingue `is_private_fleet` y `carrier_type`, pero la UI no lo vuelve explícito en todas las listas.
- Riesgo visual: proveedor marketplace puede parecer flota privada o proveedor externo.

### Estados de carga, error y vacío

- Loading actual no reserva layout completo del dashboard.
- Error no muestra requestId ni acción secundaria de soporte.
- Empty state es correcto, pero puede explicar mejor si no hay viajes vs si hay viajes sin recompute.

### Copy

- Algunos textos son buenos, pero el título “Control de margen” debe acompañarse de “lectura operativa” para no parecer wallet/billing.
- Estados como `active`, `per_trip`, `open`, `in_negotiation` aparecen sin traducción completa en tablas.

### Accesibilidad

- `ContractQuickForm` usa placeholders como labels.
- `window.prompt` para cierre de auditoría no es accesible.
- Íconos decorativos deberían usar `aria-hidden` donde aplique.
- Botones de acciones críticas deben tener explicación de consecuencia.

### Seguridad frontend

- La seguridad real está en backend, y debe quedarse ahí.
- No mover validaciones de rol al frontend como única fuente.
- No pasar `businessId` arbitrario desde UI business salvo que se mantenga `resolveScopedBusinessId`.

### Consistencia visual

- Marketplace ya tiene buenas cards móviles; Control de margen debería reutilizar ese patrón de densidad.
- Las tablas actuales se sienten más “admin table” que “sistema operativo logístico premium”.

### Utilidad real para controlar rentabilidad

- La vista permite detectar fuga y sobrecosto, pero no todavía una utilidad neta real.
- Debe explicar al usuario qué acción tomar: recalcular, revisar evidencia, renegociar contrato, vigilar proveedor, separar marketplace/privado.

---

## 6. Plan de mejora según `FE-REGLAS/`

### Fase 1: Análisis y limpieza

1. Mantener intactos los endpoints existentes.
2. Mantener intacta la lógica de auth, AAL2, roles, business scope y entitlements.
3. Extraer componentes internos desde `LastMileDashboard.tsx`:
   - `TopOpportunityList` → componente dedicado o reemplazo `RouteMarginActionList`.
   - `ContractQuickForm` → componente dedicado con labels y validación visual.
   - `ErrorState` → componente dedicado si se reutiliza.
4. Crear helpers frontend para:
   - Formatear dinero.
   - Traducir estados.
   - Traducir tipos de proveedor.
   - Resolver badge de riesgo por sobrecosto/evidencia.
5. Documentar en copy visible la fórmula actual: `fuga = suma de sobrecostos positivos vs costo esperado`.
6. No agregar dependencias.
7. No crear migraciones.
8. No modificar wallet, billing, liquidaciones ni Mercado Pago.

### Fase 2: Refactor visual

1. Reordenar la vista:
   - Arriba: alerta/resumen de acción inmediata.
   - Luego: KPIs financieros-operativos.
   - Luego: rutas con mayor fuga y evidencia incompleta.
   - Luego: proveedores.
   - Luego: snapshots y contratos.
   - Explainer como panel secundario o colapsable, no bloqueando la decisión principal.
2. Añadir chips de contexto:
   - `Last Mile`.
   - `Lectura operativa`.
   - `No mueve wallet`.
   - `No modifica liquidaciones`.
3. Hacer que cada KPI tenga:
   - Título.
   - Valor.
   - Contexto temporal.
   - Tendencia o explicación.
   - Acción si aplica.
4. Usar cards limpias, densidad profesional y jerarquía visual sobria.

### Fase 3: Jerarquía de margen y Last Mile

La vista debe contestar en menos de 10 segundos:

- Qué rutas tienen fuga.
- Qué rutas están en rango.
- Qué rutas necesitan evidencia.
- Qué proveedor afecta el margen.
- Qué proveedor tiene score bajo.
- Qué contrato vence pronto.
- Qué caso requiere renegociación.
- Qué dato viene de marketplace, flota privada o proveedor externo.

Implementación propuesta:

1. Crear sección `Acción inmediata`:
   - `Rutas con fuga crítica`.
   - `Evidencia incompleta`.
   - `Proveedor con score bajo`.
   - `Contrato por vencer`.
2. En rutas/snapshots mostrar estados:
   - `Con fuga` si `overrun_cop > 0`.
   - `En rango` si `overrun_cop <= 0`.
   - `Evidencia incompleta` si `evidence_score < 85`.
   - `Sin proveedor` si falta carrier.
   - `Sin contrato aplicado` si `pricing_snapshot.noContractApplied` existe y es true.
3. Mostrar costo con desglose solo cuando exista:
   - Esperado.
   - Final.
   - Sobrecosto.
   - Plataforma.
   - Payout.
   - Gasto privado.
4. No llamar “utilidad neta” a un dato que no existe.
5. Separar carrier type:
   - `Flota privada`.
   - `Marketplace`.
   - `Proveedor externo`.
6. En evidencia mostrar el score y, cuando esté disponible en snapshot, conteos de picking, firmas y fotos.

### Fase 4: Responsive

Mobile 320px - 639px:

- Una columna.
- Alertas críticas arriba.
- KPIs en 1 columna.
- Tablas como cards.
- Filtros plegables.
- CTAs de 44px.
- No scroll horizontal global.

Tablet 640px - 1023px:

- KPIs en 2 columnas.
- Rutas/proveedores en cards o tabla compacta.
- Sidebar/drawer no tapa contenido.

Laptop/Desktop 1024px - 1535px:

- KPIs en 3 o 4 columnas según contenido.
- Tablas completas.
- Filtros visibles.
- Paneles comparativos útiles.

Desktop grande/ultra wide 1536px+:

- Mantener `max-w-7xl` o contenedor controlado.
- No estirar tablas infinitamente.
- Usar espacio para comparar rutas/proveedores, no para cards vacías.

### Fase 5: Estados y datos

1. Loading:
   - Skeleton de hero/resumen.
   - Skeleton de KPIs.
   - Skeleton de cards/tablas.
2. Empty:
   - Distinguir `sin viajes`, `viajes sin recompute`, `sin contratos`, `sin alertas`.
3. Error:
   - Qué falló.
   - Reintentar.
   - Acción alternativa.
   - Mostrar código/requestId si API lo expone.
4. Filtros:
   - Mantener mes.
   - Agregar filtros frontend si ya están en datos cargados: riesgo, evidencia, tipo proveedor, estado.
   - No inventar query params si no se implementan en API.
5. Prevención de cálculos confusos:
   - Mostrar “fuga estimada” como sobrecosto positivo, no utilidad neta.
   - Mostrar moneda COP.
   - Mostrar periodo.
6. Prevención de doble lectura:
   - Repetir guardrail visual: no mueve wallet/billing/liquidaciones.
   - No mezclar payout privado con wallet marketplace.
   - No mezclar plataforma marketplace con costo interno sin etiqueta.

### Fase 6: QA final

1. Ejecutar lint, typecheck y build.
2. Ejecutar QA responsive visual si el entorno lo permite.
3. Probar todos los viewports de `08-checklist-qa-responsive.md`.
4. Probar con:
   - Sin sesión.
   - Trucker.
   - Business sin acceso Enterprise.
   - Business read-only.
   - Business con acceso completo.
   - Admin con `businessId`.
5. Verificar que no se rompa:
   - Auth.
   - AAL2.
   - `resolveScopedBusinessId`.
   - Rutas protegidas.
   - Multiempresa.
   - Planes/paywall.
   - Wallet/billing/liquidaciones.

---

## 7. Archivos a editar

| Archivo | Acción | Motivo | Riesgo | Regla FE aplicada |
|---|---|---|---|---|
| `CONTROL-MARGEN/IMPLEMENTACION.md` | Crear | Documento de implementación pedido. | Bajo. Solo documentación. | README, 09. |
| `frontend/src/components/last-mile/LastMileDashboard.tsx` | Editar | Reordenar jerarquía, extraer componentes internos, mejorar header/filtros/estados. | Medio. Vista financiera-operativa. | README, 03, 04, 05, 06. |
| `frontend/src/components/last-mile/LastMileKpiCards.tsx` | Editar | Mejorar contexto, tendencias, acciones y jerarquía KPI. | Medio. Datos financieros. | 04, 06. |
| `frontend/src/components/last-mile/MarginAlertsPanel.tsx` | Editar | Priorizar críticas, mejorar copy de impacto/acción y reemplazar prompt por patrón accesible. | Medio/alto si cambia flujo de cierre. | 03, 04, 06. |
| `frontend/src/components/last-mile/ProviderScorecardTable.tsx` | Editar | Agregar cards móviles, chip de tipo proveedor y causa del riesgo. | Medio. Datos de proveedor. | 03, 05, 06. |
| `frontend/src/components/last-mile/ContractsTable.tsx` | Editar | Agregar cards móviles, traducción de estados/modelos y confirmación al archivar. | Alto si cambia acción de contrato. | 03, 05, 06. |
| `frontend/src/components/last-mile/RenegotiationPipeline.tsx` | Editar | Mejorar legibilidad móvil y cierre accesible con nota. | Medio/alto por flujo de decisión. | 03, 04, 06. |
| `frontend/src/components/last-mile/RouteCostSnapshotsTable.tsx` | Editar | Convertir en tabla desktop + cards móviles; mostrar resultado, desglose y contexto. | Alto por interpretación financiera. | 03, 04, 05, 06. |
| `frontend/src/components/last-mile/LastMileEmptyState.tsx` | Editar menor | Diferenciar mejor sin viajes vs sin recompute si se pasa contexto suficiente. | Bajo/medio. | 03, 04. |
| `frontend/src/components/last-mile/LastMileExplainer.tsx` | Editar menor | Mover a sección secundaria/colapsable o reducir peso en móvil. | Bajo. | 04, 06. |
| `frontend/src/lib/last-mile/copy.ts` | Editar menor | Ajustar copy operativo y guardrails si se necesita. | Bajo/medio. | README, 05. |
| `frontend/src/components/last-mile/RouteMarginActionList.tsx` | Crear | Lista priorizada de rutas/proveedores que requieren acción inmediata. | Medio por interpretación de métricas. | 03, 04, 05. |
| `frontend/src/components/last-mile/LastMileFilters.tsx` | Crear | Filtros responsive del dashboard usando datos existentes. | Medio. Puede confundir si filtra datos agregados. | 03, 04, 06. |
| `frontend/src/components/last-mile/LastMileRiskBadge.tsx` | Crear | Centralizar badges de riesgo con texto + señal visual. | Bajo/medio. | 03, 04, 06. |

### Archivos que NO se deben tocar en la primera fase

| Archivo / área | Motivo |
|---|---|
| `frontend/src/app/api/last-mile/*` | Mantener contrato API actual hasta cerrar refactor visual. |
| `frontend/src/lib/server/last-mile/*` | No cambiar cálculos ni permisos en fase frontend. |
| `supabase/migrations/*` | No crear ni editar migraciones para refactor visual. |
| `frontend/src/app/billetera/page.tsx` | Wallet es `RISK HIGH`; no tocar para esta vista. |
| `frontend/src/app/planes/page.tsx` | Billing/planes es `RISK HIGH`; no tocar salvo copy comercial coordinado. |
| `frontend/src/app/ofertas/*` | Marketplace no debe mezclarse con Control de margen. Usar solo como referencia de patrón UI. |
| `frontend/src/app/dashboard/flota/page.tsx` | Flota privada es fuente/contexto, no destino del refactor. |
| `frontend/src/lib/server/route-auth.ts` | Auth/multiempresa es `RISK HIGH`; no tocar. |

---

## 8. Criterios de aceptación

Checklist final:

- [ ] `/dashboard/control-margen` sigue las reglas de `FE-REGLAS/`.
- [ ] La vista muestra costos, margen operativo, evidencia y proveedores de forma clara.
- [ ] La vista permite detectar rutas con fuga/sobrecosto.
- [ ] La vista permite detectar rutas en rango.
- [ ] La vista no llama utilidad neta a datos que solo son sobrecosto/fuga.
- [ ] La vista permite identificar proveedores problemáticos.
- [ ] La vista permite detectar evidencia incompleta.
- [ ] Los KPIs tienen jerarquía clara, contexto temporal y moneda.
- [ ] Las tablas desktop son entendibles.
- [ ] En móvil, las tablas grandes tienen cards/listas legibles.
- [ ] Los filtros funcionan si existen.
- [ ] Hay estado de loading.
- [ ] Hay estado de error con acción de reintento.
- [ ] Hay estado vacío con explicación y CTA.
- [ ] La vista es responsive desde 320px.
- [ ] No hay overflow horizontal global.
- [ ] Los botones táctiles miden mínimo 44px en móvil.
- [ ] Los formularios tienen labels visibles.
- [ ] Las acciones sensibles tienen confirmación clara.
- [ ] No se rompe la autenticación.
- [ ] No se rompen rutas protegidas.
- [ ] No se mezclan roles.
- [ ] No se mezclan empresas.
- [ ] No se mezclan datos marketplace/privado cuando existan separados.
- [ ] No se mezclan datos de wallet y billing de forma peligrosa.
- [ ] No se expone información sensible.
- [ ] El diseño se ve profesional y consistente con KargaX.
- [ ] El copy queda en español operativo.
- [ ] El módulo conserva el guardrail: no mueve wallet, pagos ni liquidaciones.

---

## 9. Pruebas

### Pruebas manuales mínimas

1. Cargar `/dashboard/control-margen` con sesión business autorizada.
2. Cargar con datos reales del mes.
3. Cargar con mes sin datos.
4. Simular error de servicio y validar `ErrorState`.
5. Probar refresh completo de página.
6. Probar acceso sin sesión y validar redirect a login.
7. Probar usuario `trucker` y validar mensaje de no disponible.
8. Probar business sin Enterprise y validar paywall.
9. Probar business read-only y validar que no pueda crear contratos/recalcular/gestionar.
10. Probar business con permisos completos.
11. Probar admin con business scope válido.
12. Probar que business no pueda leer otra empresa con `businessId` ajeno.
13. Recalcular periodo y validar toast/actualización.
14. Archivar contrato con confirmación.
15. Cerrar renegociación con nota obligatoria.
16. Revisar costos por ruta.
17. Revisar margen operativo/fuga por ruta.
18. Revisar evidencia por ruta.
19. Revisar proveedores por ruta.
20. Revisar separación visual `Flota privada`, `Marketplace`, `Proveedor externo` cuando el dato exista.

### QA responsive

Probar, como mínimo, estos viewports:

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

En cada viewport validar:

- No hay scroll horizontal global.
- Sidebar/drawer no tapa contenido.
- Header no tapa la primera sección.
- KPIs mantienen columnas correctas.
- Cards móviles muestran ruta, proveedor, estado, fecha, valor, evidencia y acción.
- Tablas desktop no se estiran de forma absurda.
- Filtros son usables.
- Textos no se montan.
- Badges no se deforman.
- Botones son tocables.
- Loading, empty y error existen.

### Pruebas técnicas

Desde la raíz:

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm run check
```

Desde `frontend/`:

```bash
cd frontend
npm install
npm run lint
npm run typecheck
npm run build
npm run visual:qa
npm run visual:qa:browser
npm run smoke:release
```

El proyecto **no tiene** script `npm run test` en `package.json` raíz ni en `frontend/package.json`. Sí existe en frontend:

```bash
cd frontend
npm run test:algorithms
```

---

## 10. Riesgos

### RISK HIGH

Marcar como `RISK HIGH` cualquier cambio que toque:

- Auth, sesión o AAL2.
- Roles/permisos.
- `resolveScopedBusinessId`.
- Supabase service role.
- RLS o datos multiempresa.
- Datos financieros de margen/costos.
- Cálculos del `cost-engine`.
- Recompute de snapshots.
- Contratos de margen.
- Datos de proveedores.
- Datos de rutas.
- Evidencia legal, PIN/POD, foto/firma.
- Wallet privado.
- Wallet marketplace.
- Billing, planes, Mercado Pago.
- Liquidaciones.
- Marketplace y flota privada si se mezclan visualmente.

### Riesgo medio

- Reordenar secciones puede ocultar información si no se prueba con usuarios reales.
- Agregar filtros frontend puede confundir si los KPIs agregados no se recalculan con el filtro.
- Cambiar copy de “margen” puede afectar ventas si no se coordina con comercial.
- Cards móviles pueden omitir columnas críticas si no se diseñan con `FE-REGLAS/03`.

### Riesgo bajo

- Extraer componentes visuales sin cambiar props ni endpoints.
- Agregar labels visibles.
- Agregar badges de contexto basados en campos existentes.
- Mejorar empty/error/loading sin cambiar datos.

---

## 11. Comandos de prueba detectados en `package.json`

### Raíz del repo

Scripts reales:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
npm run security:audit
```

Notas:

- `npm run dev` en raíz ejecuta `npm --prefix frontend run dev`.
- `npm run lint` en raíz ejecuta `npm --prefix frontend run lint`.
- `npm run build` en raíz ejecuta `npm --prefix frontend run build`.
- No existe `npm run test` en raíz.

### `frontend/`

Scripts reales:

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
npm run test:algorithms
npm run visual:qa
npm run visual:qa:browser
npm run smoke:release
```

Notas:

- No existe `npm run test` genérico en `frontend/package.json`.
- Si el equipo quiere test unitario estándar, se debe agregar explícitamente y documentar herramienta/alcance.

---

## 12. Siguiente paso

Ejecutar el refactor en una rama dedicada con alcance frontend-only:

1. Crear rama `feat/control-margen-fe-reglas`.
2. No tocar APIs, migraciones, wallet, billing ni route-auth.
3. Empezar por `frontend/src/components/last-mile/RouteCostSnapshotsTable.tsx` y `ProviderScorecardTable.tsx` para agregar cards móviles semánticas.
4. Luego editar `LastMileDashboard.tsx` para subir alertas/rutas críticas sobre el explainer.
5. Ejecutar:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run visual:qa
```

El cambio solo debe considerarse listo cuando `/dashboard/control-margen` pueda operarse desde 320px, muestre costos/fuga/evidencia/proveedor sin confusión, conserve la separación marketplace/privado/wallet/billing y no rompa auth, roles, empresa ni rutas protegidas.
