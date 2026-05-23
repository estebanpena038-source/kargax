# Sprint 36: Marketplace Luxury

## Estado

- artifact status: `completed`
- prioridad: alta
- owner: Frontend
- rutas cerradas: `/ofertas`, `/ofertas/[id]`, `/postulaciones`, `/postulaciones-recibidas`, `/ofertas-aceptadas`
- cierre: marketplace operativo con lenguaje visual blanco/negro mate, cards escaneables, acciones reducidas y estados coherentes con viajes/pagos.

## Objetivo

Hacer que buscar, revisar y aceptar carga se sienta como operar un mercado serio, no como una bolsa caotica. El usuario debe escanear rapido, entender riesgo y actuar con confianza.

## Principios aplicados

- Lujo por eliminacion: menos botones, menos color, mas jerarquia.
- Ruta y monto como protagonistas visuales.
- `font-money` para montos relevantes.
- Estados sin dependencia de verde/naranja heredado: borde negro, texto, icono y contraste.
- Mobile primero: filtros en sheet, cards respiradas, CTAs visibles.
- Microcopy sobrio: sin exagerar pagos, creditos ni garantias no certificadas.

## `/ofertas`

### Implementado

- Header premium con:
  - titulo `Cargas disponibles`
  - contador de resultados
  - busqueda principal visible
  - orden por recientes/monto/fecha
- Filtros:
  - busqueda, origen, destino, tipo y vehiculo
  - desktop: filtros visibles bajo buscador
  - mobile: sheet inferior con cerrar/aplicar/limpiar
  - limpiar filtros como accion secundaria
- Cards:
  - ruta origen -> destino como elemento principal
  - monto con `font-money`
  - empresa, fecha, vehiculo y tipo/peso como metadata
  - CTA `Ver detalle`
  - CTA `Postularme` solo camionero
  - estado `Postulado` con borde/negro, no color heredado
- Estados:
  - skeleton monocromo
  - error sobrio con `Reintentar`
  - empty state con siguiente accion

### QA cubierto

- Filtros conservan el fetch actual de `supabaseApi.offers.search`.
- Search local no rompe los resultados ya traidos.
- Mobile sheet no altera parametros ni rutas.

## `/ofertas/[id]`

### Implementado

- Encabezado con ruta origen -> destino, status y monto.
- Layout de dos columnas:
  - izquierda: ruta, carga, requisitos, fechas, empresa y seguimiento si corresponde
  - derecha: panel sticky con monto, estado de postulacion y CTA
- Secciones:
  - `Ruta`: origen/destino, direccion y contactos si existen
  - `Carga`: tipo, peso, vehiculo, descripcion, fotos y manifiesto
  - `Requisitos`: vehiculo, experiencia, licencias, certificaciones, seguro y notas
  - `Fechas`: recogida y entrega
  - `Empresa`: publicador
  - `Seguimiento`: visible para business/admin o camionero postulado
- Postulacion:
  - solo camionero ve CTA de aplicar
  - empresa/admin ve aviso sin CTA incorrecto
  - formulario conserva validacion de vehiculo, placa, experiencia, licencias, seguro y certificaciones
  - errores como bloque sobrio
- Fallback:
  - loading monocromo
  - oferta no encontrada con CTA a `/ofertas`

### QA cubierto

- Logica de `supabaseApi.offers.apply` intacta.
- Fallback de carga y error conservado.
- No se promete liberacion automatica de pago; se explica condicion por evidencia/PIN/flujo operativo.

## `/postulaciones`

### Implementado

- Tablero de trabajo del conductor con:
  - resumen por estado
  - contador de siguiente accion
  - tabs: Todo, En revision, Por iniciar, En ruta, Entregadas, Cerradas
- Cada postulacion muestra:
  - ruta
  - empresa
  - monto
  - fecha
  - estado
  - siguiente paso
  - rail de progreso monocromo
- Viaje aceptado:
  - destaca con borde negro, icono y texto `Viaje aceptado`
  - no depende de color
- Acciones:
  - `Ver oferta`
  - `Iniciar ruta`
  - `Continuar ruta`
  - `Ver entrega`
  - `Retirar solicitud` solo cuando esta en revision

### QA cubierto

- Estados `accepted`, `in_progress`, `completed` siguen mapeados por `deriveWorkStage`.
- `tripReadiness.jobStatus` mantiene prioridad sobre estados basicos de oferta.
- `/postulaciones?tab=accepted` sigue llevando a rutas listas/aceptadas.

## `/postulaciones-recibidas`

### Implementado

- Mesa de decision empresarial con:
  - tabs por estado con contadores
  - candidatos agrupados por oferta
  - header de oferta con ruta, carga, fecha, monto y numero de candidatos
- Candidate cards:
  - transportador
  - email/telefono
  - `TruckerScoreBadge` en modo monocromo/grayscale
  - experiencia
  - monto propuesto/publicado
  - mensaje del transportador
  - estado sobrio
- Flujo de decision:
  - `Asegurar y pagar` abre modal de revision
  - modal muestra resumen financiero, operativo y condicion de pago
  - `Retomar pago` para seleccion pendiente
  - `Liberar seleccion` conserva endpoint `/api/payments/selection/cancel`
  - `Rechazar` conserva `respondToApplication`
- Modal:
  - no oculta condiciones
  - no promete liberacion inmediata
  - CTA claro a checkout

### QA cubierto

- Aceptar directo no se reactiva.
- Pago sigue por `/pagar/[offerId]?applicationId=...`.
- Cancelar seleccion conserva token Supabase y endpoint existente.

## `/ofertas-aceptadas`

### Implementado

- Se reemplazo el redirect simple por una pantalla real.
- Layout:
  - header `Ofertas aceptadas`
  - proximo viaje arriba
  - historial abajo
  - empty state con accion a buscar cargas
- Estado segun `trip-state`:
  - `awaiting` -> ver condicion
  - `awaiting` confirmado/reservado -> abrir carga
  - `in_transit` -> ver seguimiento
  - `delivered`/completed -> ver entrega
- CTA:
  - `/viaje/[offerId]/carga`
  - `/viaje/[offerId]`
  - `/viaje/[offerId]/entrega`
  - `/ofertas/[offerId]` si aun falta condicion

### QA cubierto

- Estados de viaje coinciden con `tripReadiness.jobStatus` y status de oferta.
- Historial separa el proximo viaje del resto.

## Verificacion

- `npm run typecheck` paso correctamente.
- ESLint dirigido a las rutas del sprint paso sin errores:
  - `src/app/ofertas/page.tsx`
  - `src/app/ofertas/[id]/page.tsx`
  - `src/app/postulaciones/page.tsx`
  - `src/app/postulaciones-recibidas/page.tsx`
  - `src/app/ofertas-aceptadas/page.tsx`
- Quedan warnings no bloqueantes:
  - algunos mapeos con `any` por payloads flexibles de `supabaseApi`
  - aviso de Next por `<img>` en fotos existentes de carga
- Build no ejecutado por indicacion del owner para correr un build general despues.

## Definition of Done

- Marketplace sin colores heredados visibles en las rutas del sprint.
- Cards escaneables en mobile.
- Acciones primarias obvias y pocas.
- Detalle de oferta con panel sticky y secciones operativas completas.
- Postulaciones del conductor con estados claros y viaje aceptado marcado sin color.
- Postulaciones recibidas agrupadas por oferta con modal financiero/operativo.
- Ofertas aceptadas convertida en pantalla real de proximo viaje + historial.
