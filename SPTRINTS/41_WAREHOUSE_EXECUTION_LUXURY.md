# Sprint 41: Warehouse Execution Luxury

## Estado

- artifact status: `completed`
- prioridad: alta
- cierre: implementado y verificado sin build por instruccion del owner
- rutas cerradas: `/bodegas/[id]/inventario`, `/bodegas/[id]/recepciones`, `/bodegas/[id]/picking`, `/bodegas/[id]/despachos`, `/bodegas/[id]/incidentes`

## Objetivo Cerrado

La ejecucion WMS queda convertida en una experiencia monocroma, precisa y tranquila. Inventario, recepcion, picking, despacho e incidentes ahora operan como piezas de una maquinaria fina: cada pantalla muestra siguiente accion, conserva trazabilidad y evita que cantidades invalidas o riesgos criticos avancen sin contexto.

El sprint respeta el shell premium del Sprint 40 y no invade command, enterprise revenue, admin CEO ni release gate.

## Principios De Diseno Aplicados

- Monocromo real: negro mate, blanco, zinc, bordes finos y progreso sin semaforos.
- Jerarquia operativa: cada vista abre con metricas utiles y accion principal clara.
- Validacion antes del backend: cantidades invalidas, ajustes sin justificacion, rechazos sin contexto y cierres criticos sin revision quedan bloqueados en UI.
- Trazabilidad visible: SKU, ubicacion, stock, lineas, offerId, manifiesto, evidencia y estado aparecen sin esconder datos de operacion.
- Riesgo critico visible: incidentes criticos quedan arriba, con borde fuerte, evidencia requerida y revision de soporte/admin antes del cierre.
- Imagenes estables: thumbnails con aspect ratio, fallback sobrio y galeria de SKU sin romper tarjetas.
- Sin build ejecutado: el owner hara build general.

## Implementacion

### Componentes Compartidos

Archivo: `frontend/src/components/warehouses/WarehouseExecutionLuxury.tsx`

- `WmsStatusBadge`: estado textual monocromo, con tono critico sin depender de rojo.
- `WmsMetric`: KPI compacto con mono font.
- `WmsEmptyState`: ausencia sobria, no parece error.
- `WmsRiskNotice`: riesgo operativo visible.
- `WmsTextArea`: textarea consistente con inputs premium.
- `WmsProgress`: progreso fino negro sobre gris.
- `WmsImageThumb`: imagen estable con fallback.
- `WmsCompletionMark`: marca de cierre sin color dominante.

### `/bodegas/[id]/inventario`

Archivo: `frontend/src/app/bodegas/[id]/inventario/page.tsx`

- Layout convertido a ejecucion WMS premium:
  - metricas de stock disponible, reservado y SKUs visibles.
  - ajuste de inventario en panel dedicado.
  - catalogo visual con buscador SKU/nombre.
  - stock disponible en `font-money`.
  - ubicaciones, lotes e imagenes como datos escaneables.
- Validaciones:
  - SKU y nombre obligatorios.
  - cantidad finita y distinta de cero.
  - ajuste negativo no puede dejar stock total negativo para SKU existente.
  - justificacion minima antes de aplicar ajuste.
- Imagenes:
  - dropzone monocromo.
  - limite visual de 5 imagenes por SKU.
  - thumbnails cuadrados con fallback si la imagen falla.
  - eliminacion de imagen desde galeria sin romper layout.
- Paywall:
  - plan sin inventario muestra aviso sobrio y conserva lectura.

### `/bodegas/[id]/recepciones`

Archivo: `frontend/src/app/bodegas/[id]/recepciones/page.tsx`

- Crear recepcion:
  - numero automatico si se deja vacio.
  - viaje vinculado opcional.
  - notas operativas.
  - selector de SKU existente desde stock.
  - lineas con esperado, recibido y rechazado.
- Validaciones:
  - SKU y nombre obligatorios por linea.
  - recibido debe ser mayor a cero.
  - esperado y rechazado no pueden ser negativos.
  - rechazado no puede superar recibido.
  - al menos una linea antes de registrar.
- Lista:
  - progreso de recepciones cerradas.
  - estado textual.
  - unidades recibidas y rechazadas.
  - lineas con ubicacion, esperado, recibido y rechazado.
  - transiciones backend intactas: `received`, `closed`, `cancelled`.

### `/bodegas/[id]/picking`

Archivo: `frontend/src/app/bodegas/[id]/picking/page.tsx`

- Checklist como foco principal:
  - progreso monocromo.
  - tareas de picking/loading/inspection.
  - checklist derivado de descripcion o fallback operativo.
  - estado textual: pendiente, activo, rechazo visible, completado, cancelado.
- Confirmacion:
  - cierre requiere confirmacion operativa en tareas activas.
  - no se guarda PIN crudo; solo se persiste que hubo confirmacion.
- Rechazo visible:
  - bloqueo exige nota minima.
  - tarea bloqueada muestra `Rejection flow visible`.
  - metadata conserva `rejectionNote`, `rejectionFlowVisible` y `confirmedAt`.
- Idempotencia UI:
  - `processingId` evita doble submit.
  - acciones respetan transiciones del endpoint de tareas.
- Manifiestos:
  - despachos draft/picking/ready aparecen como manifiestos en alistamiento.
  - lineas muestran solicitado, picked, despachado y rechazado.

### `/bodegas/[id]/despachos`

Archivo: `frontend/src/app/bodegas/[id]/despachos/page.tsx`

- Crear despacho desde inventario:
  - selector de stock disponible real.
  - numero automatico si se deja vacio.
  - programacion y notas.
  - lineas con solicitado, picked, despachado y rechazado.
- Validaciones:
  - requiere SKU con stock.
  - cantidades finitas y positivas donde aplica.
  - no despacha mas que disponible.
  - no despacha mas que picked.
  - no rechaza mas que solicitado.
  - al menos una linea antes de registrar.
- Manifiesto conectado a viaje:
  - modo `dispatch_only`, `private_fleet_trip` o `marketplace_offer`.
  - `offerId` opcional visible.
  - datos de automatizacion para flota privada/marketplace.
  - flota privada exige `offerId` existente o conductor privado.
- Lista:
  - status textual.
  - `offerId` corto.
  - `dispatch_trip_mode` y `trip_creation_status` visibles.
  - lineas conservan solicitado, picked, despachado y rechazado.
  - transiciones backend intactas: `picking`, `ready`, `dispatched`, `cancelled`.

### `/bodegas/[id]/incidentes`

Archivo: `frontend/src/app/bodegas/[id]/incidentes/page.tsx`

- Form incidente:
  - tipo.
  - severidad textual.
  - titulo.
  - viaje vinculado opcional.
  - descripcion.
  - evidencia por URL.
- Validaciones:
  - titulo y descripcion obligatorios.
  - evidencia debe ser URL http/https.
  - incidente critico exige evidencia antes de reportar.
- Revision:
  - incidentes ordenados por estado y severidad.
  - criticos abiertos aparecen arriba con aviso propio.
  - evidencia se muestra como thumbnail si es imagen o link si es documento.
  - cierre/resolucion de critico exige nota de soporte/admin.
  - metadata conserva `supportReviewNote` y `supportReviewedAt`.
- Estados:
  - `open`, `investigating`, `resolved`, `closed` visibles.
  - transiciones backend intactas.
  - riesgo critico no se oculta aunque no tenga evidencia.

## QA Ejecutado

- `npm run typecheck`
  - resultado: OK
- `npx eslint --no-warn-ignored --no-error-on-unmatched-pattern -- 'src/app/bodegas/[id]/inventario/page.tsx' 'src/app/bodegas/[id]/recepciones/page.tsx' 'src/app/bodegas/[id]/picking/page.tsx' 'src/app/bodegas/[id]/despachos/page.tsx' 'src/app/bodegas/[id]/incidentes/page.tsx' 'src/components/warehouses/WarehouseExecutionLuxury.tsx'`
  - resultado: OK
- QA visual por busqueda de clases prohibidas en archivos tocados:
  - sin `green`, `emerald`, `red`, `orange`, `amber`, `violet`, `blue`, `gradient`, `rounded-2xl`, `rounded-3xl` como lenguaje visual dominante.
- `npm run build`
  - no ejecutado por instruccion del owner.

## Pasada Responsive 2026

- objetivo: eliminar necesidad de zoom manual en movil y asegurar lectura elegante en 360/390/414, tablet 768/820/1024, laptop 1366/1440/1536 y desktop 1920+.
- referencia externa revisada: distribucion global actual de resoluciones por StatCounter; se priorizaron moviles 360-430px CSS, tablets 768-1024px, laptops 1366-1536px y desktop amplio.
- archivos ajustados:
  - `frontend/src/components/warehouses/WarehouseExecutionLuxury.tsx`
  - `frontend/src/components/warehouses/WarehouseWorkspace.tsx`
  - `frontend/src/app/globals.css`
  - `frontend/src/app/bodegas/[id]/inventario/page.tsx`
  - `frontend/src/app/bodegas/[id]/recepciones/page.tsx`
  - `frontend/src/app/bodegas/[id]/picking/page.tsx`
  - `frontend/src/app/bodegas/[id]/despachos/page.tsx`
  - `frontend/src/app/bodegas/[id]/incidentes/page.tsx`
- cambios:
  - grids WMS fluidos con `auto-fit` y `minmax(min(100%, ...), 1fr)`.
  - paneles maestro/detalle pasan a una columna en movil/tablet y dos columnas solo en desktop amplio.
  - metricas densas reducen tipografia y tracking en pantallas pequenas.
  - acciones se apilan full width en <=420px y vuelven a fila cuando hay espacio.
  - tarjetas, thumbs, badges, rutas, lineas y contenedores recibieron `min-w-0`, wrapping y truncado controlado.
  - navegacion de secciones mantiene scroll horizontal contenido, sin forzar ancho de pagina.
- QA ejecutado:
  - `npx eslint --no-warn-ignored --no-error-on-unmatched-pattern -- 'src/app/bodegas/[id]/inventario/page.tsx' 'src/app/bodegas/[id]/recepciones/page.tsx' 'src/app/bodegas/[id]/picking/page.tsx' 'src/app/bodegas/[id]/despachos/page.tsx' 'src/app/bodegas/[id]/incidentes/page.tsx' 'src/components/warehouses/WarehouseExecutionLuxury.tsx' 'src/components/warehouses/WarehouseWorkspace.tsx'`
  - resultado: OK
- `npm run typecheck -- --pretty false`
  - resultado: no concluyo por timeout local de 120s.
- `npm run build`
  - no ejecutado por instruccion del owner.
- servidor local:
  - no levantado por instruccion del owner.

## Riesgos Controlados

- Permisos:
  - se mantienen `manageInventoryAdjustments`, `manageReceipts`, `manageTasks`, `manageDispatches`, `manageIncidents`.
  - no se relaja RLS.
- Contratos:
  - se conservan `adjustStock`, `createReceipt`, `updateReceipt`, `createTask`, `updateTask`, `createDispatch`, `updateDispatch`, `createIncident`, `updateIncident`.
  - payloads siguen usando los nombres esperados por API.
- Datos:
  - cantidades no avanzan si son invalidas.
  - rechazos se muestran como dato propio.
  - incidentes criticos no se cierran sin revision.
  - PIN/confirmacion no persiste secretos crudos.
- UX:
  - cada pantalla tiene accion siguiente clara.
  - tarjetas e imagenes mantienen dimensiones estables.
  - estados no dependen de color.

## Definition Of Done

- Flujo WMS completo monocromo: `done`
- Inventario con buscador SKU, stock mono, ajustes justificados e imagenes estables: `done`
- Recepciones con crear, lista, recibidos/rechazados y estados intactos: `done`
- Picking con checklist, confirmacion, progreso monocromo e idempotencia UI: `done`
- Despachos desde inventario con lineas y manifiesto conectado a viaje: `done`
- Incidentes con form, severidad textual, evidencia, estado y revision soporte/admin: `done`
- No se pierde trazabilidad de inventario/despacho: `done`
- Riesgo critico visible: `done`
- Build omitido por instruccion del owner: `done`
