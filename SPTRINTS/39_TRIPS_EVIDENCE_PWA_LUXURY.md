# Sprint 39: Trips + Evidence PWA Luxury

## Estado

- artifact status: `implemented_in_code_pending_general_build`
- cierre del documento: `completo`
- cierre de implementacion: `completo`
- build: `no ejecutado por instruccion del owner; se validara en build general`
- prioridad: maxima para confianza operativa, prueba de entrega y experiencia del camionero
- owner: Frontend + Operations + Evidence + PWA
- rutas principales: `/viaje/[offerId]`, `/viaje/[offerId]/carga`, `/viaje/[offerId]/entrega`, `/inspecciones`, `/inspecciones/[offerId]`
- rutas/API que deben conservar contrato: `/api/trips/[offerId]`, `/api/trips/[offerId]/tracking`, `/api/trips/[offerId]/tracking/start`, `/api/trips/[offerId]/tracking/ping`, `/api/trips/[offerId]/tracking/stop`, `/api/business/fleet/events`, `/api/business/fleet/signatures`, `/api/trucker/score`, `/api/notifications/inspection`
- RPC/Storage que deben conservar contrato: `register_arrival`, `register_item_loaded`, `register_item_delivered`, `verify_pickup_pin`, `verify_delivery_pin`, `add_trip_photo`, bucket `trip-photos`
- componentes actuales a respetar o refinar: `LiveTripTracker`, `PickingChecklist`, `GPSVerification`, `PinInput`, `TripSignatureCapture`, reportes de `inspections`
- dependencias visuales: Sprint 33 `Luxury Design System Foundation`, Sprint 35 `App Shell + Personal Luxury`, Sprint 36 `Marketplace Luxury`, Sprint 37 `Publishing + Payments Luxury`, Sprint 38 `Wallet + Payouts Luxury`
- frontera con otros sprints: este sprint empieza despues de la reserva/pago confirmado y termina con evidencia, POD, inspeccion y seguimiento; no redisenar checkout, wallet, payouts, admin CEO ni WMS command.

## Objetivo

Convertir el viaje en una cadena de custodia premium: clara, resistente, movil, confiable y bella. El camionero debe saber exactamente que hacer en cada paso, incluso con mala conexion, sol fuerte, una mano ocupada y presion operativa.

La empresa debe abrir una inspeccion y sentir que no esta viendo una galeria improvisada, sino un expediente logistico de alto nivel: ruta, PINs, GPS, fotos, firma, items, rechazos y timeline bajo control.

El usuario debe pensar:

- `se exactamente que sigue`
- `la prueba de entrega quedo seria`
- `si pasa algo, KargaX conserva la evidencia`
- `este viaje se siente profesional, no improvisado`
- `esto me da paz para operar`

## Principio Central

Un viaje sin evidencia confiable es solo una promesa. Un viaje con evidencia clara, ordenada y verificable se convierte en un activo operativo.

Este sprint no busca decorar pantallas de viaje. Busca que cada interaccion diga:

`La carga, la ruta y la prueba estan bajo control.`

## Reglas Globales

- Mobile primero de verdad: todo el flujo debe poder hacerse desde celular sin zoom, sin botones cortados y sin depender de hover.
- Interfaz monocroma premium: blanco mate, negro mate, grises sobrios, bordes finos y sombras casi invisibles.
- Eliminar colores heredados como verde, azul, violeta, rojo, naranja o ambar como lenguaje dominante. Los estados se comunican con texto, icono, borde, peso visual y posicion.
- No usar degradados de color, brillos, celebraciones exageradas, confetti, sombras neon ni badges tipo arcoiris.
- El camionero nunca debe leer una instruccion larga antes de actuar. Un paso, una accion principal, un resultado.
- Estados criticos no dependen del color: siempre incluir etiqueta textual, icono y microcopy.
- PIN, GPS, evidencia, firma y tracking deben sentirse como rituales de seguridad, no como formularios.
- El viaje no debe prometer liberacion financiera inmediata. Si se menciona dinero, usar lenguaje operativo y exacto.
- No decir `pago liberado` si el sistema real solo registro entrega o si depende de settlement/payout posterior.
- No exponer PINs completos, tokens, ids internos largos, coordenadas sensibles innecesarias o datos privados sin permiso.
- Toda foto debe mantener aspect ratio, metadata visible cuando aplique y fallback si la imagen falla.
- No romper RLS, permisos por rol, flujo de pagos, picking, tracking, firmas ni almacenamiento actual.
- No introducir una nueva libreria visual.
- No reactivar lending, advances o promesas de credito.

## Lenguaje Visual

- Superficie base:
  - `bg-white`, `bg-neutral-50`, `bg-zinc-50` o equivalente mate.
  - Evitar `bg-slate-950` como unico fondo de toda la experiencia salvo paneles de autoridad.
- Panel de autoridad:
  - negro mate para resumen de ruta, siguiente accion, valor operativo y estado de custodia.
  - texto blanco con jerarquia sobria.
- Cards:
  - radio maximo `8px` salvo componente existente que obligue otra escala.
  - borde fino.
  - sombra muy ligera o ninguna.
  - no anidar cards dentro de cards salvo formularios de evidencia realmente aislados.
- Iconos:
  - lucide monocromo.
  - tamano pequeno.
  - icono como soporte, no decoracion.
- Progreso:
  - linea fina, stepper vertical o timeline compacto.
  - sin circulos grandes de colores.
  - cada etapa debe tener texto: `Pendiente`, `Activo`, `Registrado`, `Bloqueado`.
- Dinero:
  - `font-money` o fuente mono equivalente.
  - copy exacto: `Valor operativo del viaje`, no `dinero liberado`.
- Fotos:
  - grillas estables con `aspect-ratio`.
  - thumbnails limpios.
  - modal con fondo negro mate.
  - metadata en mono o texto compacto.
- Botones:
  - primario negro mate.
  - secundario blanco con borde gris/negro.
  - accion de riesgo con borde/texto y confirmacion clara, no rojo dominante.
- Inputs:
  - altos, tactiles, sin ruido.
  - error debajo del campo, sin mover todo el layout.
- Microcopy:
  - humano, directo, calmado.
  - evitar hype, promesas financieras y tono infantil.

## Arquitectura de Experiencia

El sprint se divide en 5 momentos:

1. `Abrir viaje`: resolver permiso, pago/reserva, siguiente paso y contexto.
2. `Cargar en origen`: GPS, manifiesto, evidencia, firma si aplica y PIN de salida.
3. `Seguir ruta`: tracking PWA, cola local y estado visible.
4. `Entregar en destino`: GPS, entrega/rechazo por item, evidencia, firma y PIN de entrega.
5. `Auditar evidencia`: empresa/admin ve reporte completo, fotos, timeline y excepciones.

Cada momento debe dejar claro:

- que esta pasando
- que accion toca ahora
- que ya quedo registrado
- que esta bloqueado y por que
- que se puede recuperar si la conexion falla

## Estados Operativos

### Estados de viaje visibles

- `awaiting_confirmation`: Esperando confirmacion
- `awaiting_payment`: Falta confirmacion de reserva
- `pickup`: Carga en origen
- `in_transit`: En ruta
- `delivery`: Entrega en destino
- `completed`: Viaje cerrado
- `blocked`: No disponible

Regla visual:

- mostrar estado con texto + icono + borde.
- no usar color como unica senal.
- explicar el bloqueo en una frase corta.

### Estados de item

- `pending`: Pendiente
- `loaded`: Cargado
- `issue`: Cargado con novedad
- `rejected`: Rechazado
- `delivered`: Entregado
- `partial`: Entrega parcial

Regla visual:

- `rejected` y `partial` deben conservarse como estados propios.
- un item rechazado en origen no debe reaparecer como item normal en entrega.
- la UI debe mostrar cantidad esperada, cargada, entregada y rechazada cuando aplique.

### Estados de evidencia

- `local_draft`: Borrador local
- `uploading`: Subiendo
- `synced`: Sincronizada
- `failed`: No sincronizada
- `missing_required`: Falta requerida

Regla visual:

- fotos y firmas pendientes deben poder identificarse sin panico.
- si algo quedo local, decir `Guardado en este dispositivo. Sincroniza al recuperar conexion.`

### Estados de tracking PWA

- `paused`: Pausado
- `active`: Activo
- `offline_queue`: Cola local
- `syncing`: Sincronizando
- `denied`: GPS denegado
- `unsupported`: Navegador sin soporte

Regla visual:

- el tracking debe explicar limitacion de PWA: GPS en primer plano.
- no culpar al usuario si el navegador bloquea ubicacion.

## `/viaje/[offerId]`

### Intencion

Esta vista es la puerta de entrada al viaje. Debe recibir al camionero con calma, resolver el siguiente paso y evitar que piense. Si puede cargar, va a carga. Si puede entregar, va a entrega. Si esta cerrado, lo guia a billetera o historial sin prometer dinero no confirmado.

### Contrato Funcional

- Usa `fetchTripContext(offerId)`.
- Respeta `requiresLogin` y conserva redirect a `/viaje/[offerId]`.
- Respeta `canOpenTrip`, `canAccessPickup`, `canAccessDelivery`, `nextAction`, `blockingReason`, `tripStatus` y `jobStatus`.
- No debe abrir carga si no existe `pickup_pin`, `pickup_verified_at` o permiso valido.
- No debe abrir entrega si el viaje no esta en transito o no existe `delivery_pin` cuando aplica.
- Admin/business pueden leer contexto si contrato lo permite, pero CTAs de camionero deben estar condicionados por rol.

### Layout Desktop

- Shell sin distracciones, centrado y ancho controlado.
- Panel negro mate principal:
  - ruta grande: `Origen -> Destino`
  - estado actual
  - siguiente accion
  - valor operativo en mono
  - referencia corta del viaje
- Columna lateral:
  - checklist de etapas
  - contacto operativo si el rol lo permite
  - tracking compacto
  - accion secundaria `Volver a Mi Trabajo`

### Layout Mobile

- Una sola columna.
- Header compacto sticky opcional con ruta abreviada.
- CTA principal visible sin tap accidental.
- Etapas como timeline vertical, no grid apretado.
- Tracking compacto debajo de la accion principal.

### Etapas Visibles

1. `Reserva`
2. `Carga`
3. `Ruta`
4. `Entrega`
5. `Cierre`

Cada etapa debe mostrar:

- estado textual.
- timestamp si existe.
- bloqueo si falta requisito.
- accion solo si corresponde.

### Acciones

- `Continuar carga`: solo si `nextAction = pickup`.
- `Continuar entrega`: solo si `nextAction = delivery`.
- `Ir a billetera`: solo si viaje cerrado, sin decir que ya se pago si no esta respaldado.
- `Volver a Mi Trabajo`: secundaria.
- `Reintentar cargar viaje`: si API falla.

### Microcopy

- `Tu siguiente paso esta listo.`
- `Esta ruta esta esperando confirmacion final.`
- `La carga se valida con GPS, evidencia y PIN de salida.`
- `La entrega se cierra con evidencia y PIN del receptor.`
- `El valor mostrado es operativo. Los movimientos de billetera se validan aparte.`

### QA

- sin sesion redirige con `redirect` completo.
- oferta inexistente muestra estado sobrio.
- camionero sin permiso ve bloqueo claro.
- empresa/admin no ve CTA operativo de camionero si no debe.
- no hay redirect automatico tan rapido que impida leer un bloqueo.
- `nextAction = completed` no promete payout.
- valor monetario usa mono.
- mobile no corta ruta, CTA ni estado.

## `/viaje/[offerId]/carga`

### Intencion

La carga debe sentirse como un ritual de inicio: llegar, verificar, registrar y salir. Cada paso reduce riesgo. El camionero debe sentir que KargaX le esta quitando ansiedad, no agregando tareas.

### Contrato Funcional

- Consulta `cargo_offers` con:
  - estado, origen, contacto, PIN, timestamps, manifiesto, monto, tolerancia GPS, camionero asignado y flota privada.
- Valida acceso por:
  - `assigned_trucker_id`
  - `private_fleet_trucker_id`
  - postulacion aceptada si aplica.
- Bloquea si no hay `pickup_pin` y no existe `pickup_verified_at`.
- Usa `register_arrival` con `locationType = origin`.
- Usa `register_item_loaded` para items.
- Usa `verify_pickup_pin` con `p_offer_id`, `p_input_pin`, `p_trucker_id`.
- Sube fotos a bucket `trip-photos`.
- Si flota privada aplica:
  - usa `TripSignatureCapture` con `signatureStage = origin_dispatch`.
  - usa `/api/business/fleet/signatures`.
  - permite eventos `/api/business/fleet/events`.

### Flujo

1. `GPS origen`
   - verificar llegada.
   - mostrar direccion, ciudad y tolerancia.
   - permitir bypass solo en development.
2. `Manifiesto`
   - listar items pendientes.
   - registrar cargado, novedad o rechazo.
   - adjuntar fotos cuando aplique.
   - preservar borradores locales por `draftNamespace`.
3. `Firma de salida`
   - obligatoria para flota privada si el flujo actual la exige.
   - nombre, documento opcional y canvas tactil.
4. `PIN salida`
   - input central de 4 digitos.
   - intentos restantes.
   - bloqueo claro.
5. `Salida registrada`
   - confirmacion sobria.
   - CTA hacia ruta o dashboard de trabajo.

### Layout

- Header negro mate compacto:
  - `Carga en origen`
  - ruta abreviada.
  - estado textual.
  - boton atras.
- Debajo:
  - stepper vertical o linea fina.
  - bloque GPS.
  - tracking PWA compacto.
  - manifiesto.
  - firma si aplica.
  - PIN.
- No usar header con gradiente.
- No usar iconos grandes con fondos verdes/violetas.

### GPS de Origen

- Mostrar:
  - direccion origen.
  - ciudad.
  - precision actual si existe.
  - distancia al punto si el RPC la devuelve.
  - timestamp de verificacion.
- Estados:
  - `Buscando ubicacion`
  - `Ubicacion lista`
  - `Fuera del radio permitido`
  - `Ubicacion registrada`
  - `Permiso GPS denegado`
- Microcopy:
  - `Mantente cerca del punto de cargue para registrar llegada.`
  - `Si el navegador no permite GPS, activa ubicacion y vuelve a intentar.`

### Manifiesto de Carga

- Cada item debe mostrar:
  - nombre.
  - referencia/SKU si existe.
  - cantidad esperada.
  - estado actual.
  - fotos ya asociadas.
  - notas si existen.
- Acciones por item:
  - `Confirmar carga`
  - `Registrar novedad`
  - `Rechazar carga`
- Reglas:
  - `Registrar novedad` no debe significar rechazo.
  - `Rechazar carga` debe pedir nota o evidencia.
  - si hay rechazo, ese item queda visualmente separado.
  - no permitir doble submit mientras `isProcessing`.
  - si upload de una foto falla, no ocultar el item ni marcarlo como completo sin claridad.

### Evidencia en Carga

- Input de foto debe ser tactil y obvio.
- En mobile, usar `accept="image/*"` y permitir camara cuando el navegador lo ofrezca.
- Mostrar contador de fotos por item.
- Preview estable:
  - aspect ratio cuadrado o 4:3.
  - object-fit cover en thumbnail.
  - object-contain en modal.
- Copy:
  - `Toma evidencia si el estado del item puede generar reclamo.`
  - `La foto queda asociada a este item y a esta etapa.`

### Firma de Salida

- Debe sentirse como firma de despacho, no decoracion.
- Campos:
  - nombre del firmante.
  - documento opcional.
  - rol: jefe de bodega o responsable.
  - canvas.
- Estados:
  - `Pendiente`
  - `Guardando`
  - `Guardada`
  - `No guardada`
- QA:
  - canvas funciona con touch.
  - limpiar firma no rompe dimension.
  - no permite guardar sin nombre.
  - si firma es obligatoria, PIN no avanza sin `savedAt`.

### PIN de Salida

- Input central, grande, usable con una mano.
- Cada casilla estable, sin layout shift.
- Teclado numerico en mobile.
- Mostrar:
  - titulo `PIN de salida`
  - descripcion corta.
  - intentos restantes.
  - error debajo.
- Microcopy:
  - `Solicita el PIN al responsable del cargue.`
  - `Este PIN confirma que la carga salio del origen.`
- QA:
  - no mostrar el PIN real.
  - no aceptar menos de 4 digitos.
  - intento fallido no borra todo el contexto.
  - bloqueo por intentos es claro.

### Final de Carga

- No usar celebracion ruidosa.
- Copy:
  - `Carga registrada`
  - `La salida quedo verificada con evidencia y PIN.`
  - `Puedes continuar la ruta.`
- CTA:
  - `Continuar ruta`
  - `Volver a Mi Trabajo`

### QA

- camionero asignado abre carga.
- camionero no asignado no abre carga.
- viaje sin PIN de salida muestra bloqueo de pago/confirmacion.
- GPS registra llegada y avanza.
- bypass solo existe en development.
- item cargado actualiza manifiesto.
- item con novedad conserva `hasIssue`.
- item rechazado conserva `loadStatus = rejected`.
- fotos suben a `trip-photos`.
- errores de upload son visibles.
- firma privada bloquea PIN si falta.
- `verify_pickup_pin` conserva parametros.
- al completar, estado local cambia a completado.
- mobile no corta fotos, botones ni PIN.

## `/viaje/[offerId]/entrega`

### Intencion

La entrega debe sentirse como un cierre impecable. No es una fiesta. Es el momento donde KargaX convierte la operacion en prueba: GPS destino, items, rechazos, firma y PIN.

### Contrato Funcional

- Consulta `cargo_offers` con destino, contacto, PIN, timestamps, manifiesto, monto, tolerancia GPS y asignacion.
- Valida acceso por camionero asignado, flota privada o postulacion aceptada.
- Usa `register_arrival` con `locationType = destination`.
- Usa `register_item_delivered`.
- Usa `verify_delivery_pin`.
- Si flota privada aplica:
  - usa `TripSignatureCapture` con `signatureStage = delivery_pod`.
  - exige documento del receptor si `requireDocumentId`.
  - permite eventos de flota privada.
- Al completar:
  - puede llamar `/api/trucker/score`.
  - detiene tracking con `/api/trips/[offerId]/tracking/stop`.

### Flujo

1. `GPS destino`
2. `Entrega por item`
3. `Rechazos y evidencia`
4. `Firma del receptor`
5. `PIN entrega`
6. `POD registrado`

### Layout

- Header negro mate compacto:
  - `Entrega en destino`
  - destino.
  - estado.
  - valor operativo si aplica.
- Stepper sobrio.
- Tracking PWA visible pero no protagonista.
- Checklist al centro.
- Firma y PIN como cierre.
- No usar celebracion exagerada, confetti ni copy de dinero liberado.

### GPS de Destino

- Estados:
  - `Buscando ubicacion`
  - `Destino detectado`
  - `Fuera del radio`
  - `Llegada registrada`
  - `GPS no disponible`
- Microcopy:
  - `Registra llegada cuando estes en el punto de entrega.`
  - `La ubicacion queda asociada al POD.`

### Entrega por Item

- Cada item debe mostrar:
  - esperado.
  - cargado.
  - entregado.
  - rechazado.
  - estado final.
- Contadores:
  - `Entregados`
  - `Rechazados`
  - maximo basado en cantidad cargada.
- Reglas:
  - entregado + rechazado no puede exceder cantidad cargada.
  - rechazo mayor a 0 exige motivo.
  - rechazo mayor a 0 exige foto.
  - item rechazado debe quedar como `partial` o `rejected`, no `delivered`.
  - si el item fue rechazado en carga, no debe forzar entrega normal.

### Motivos de Rechazo

- `damaged`: Danado/Roto
- `missing`: Faltante
- `wrong_item`: Item equivocado
- `customer_refused`: Cliente rechazo
- `expired`: Expirado
- `quality_issue`: Problema de calidad
- `other`: Otro motivo

Regla de copy:

- El motivo no debe culpar al camionero automaticamente.
- El reporte debe describir el hecho, no emitir juicio.

### Evidencia de Entrega

- Fotos obligatorias cuando hay rechazo.
- Fotos recomendadas para:
  - sello roto.
  - empaque afectado.
  - faltante.
  - remito firmado.
  - descarga parcial.
- Metadata:
  - etapa.
  - item.
  - cantidad.
  - motivo.
  - timestamp.
  - GPS si existe.

### Firma del Receptor

- Campos:
  - nombre del receptor.
  - documento obligatorio en flota privada.
  - rol `receiver`.
  - canvas.
- Copy:
  - `La firma valida la recepcion operativa de la carga.`
  - `El documento ayuda a resolver reclamos posteriores.`
- QA:
  - canvas funciona en mobile.
  - no permite guardar sin documento cuando es obligatorio.
  - firma guardada aparece antes del PIN.

### PIN de Entrega

- Titulo: `PIN de entrega`
- Microcopy:
  - `Solicita el PIN al receptor para cerrar la entrega.`
  - `Este PIN registra el cierre operativo del viaje.`
- Prohibido:
  - `liberar pago`
  - `pago ya disponible`
  - `dinero liberado a tu billetera`
- QA:
  - conserva `verify_delivery_pin`.
  - detiene tracking despues de exito.
  - no completa visualmente si RPC falla.

### Final de Entrega

- Copy:
  - `Entrega registrada`
  - `El POD quedo guardado con evidencia, firma y PIN.`
  - `KargaX actualizara los estados operativos asociados.`
- CTA:
  - `Ver billetera`
  - `Ver mas ofertas`
  - `Ver evidencia` si corresponde.
- No decir:
  - `Pago liberado`
  - `A tu billetera`
  - `100% pagado`
  - `Garantizado`

### QA

- camionero asignado abre entrega solo cuando corresponde.
- sin `delivery_pin` muestra bloqueo claro.
- GPS destino registra llegada.
- item entregado total queda `delivered`.
- item parcial queda `partial`.
- item rechazado total queda `rejected`.
- motivo de rechazo requerido.
- foto requerida en rechazo.
- firma privada bloquea PIN si falta.
- `verify_delivery_pin` conserva parametros.
- tracking se detiene al completar.
- score refresh no bloquea cierre si falla.
- mobile no corta contadores, motivos, fotos ni PIN.

## `LiveTripTracker`

### Intencion

El tracking debe sentirse como un copiloto silencioso. No debe asustar, no debe prometer tracking en background si PWA no lo garantiza, y debe hacer visible la cola local.

### Contrato Funcional

- Usa:
  - `/api/trips/[offerId]/tracking/start`
  - `/api/trips/[offerId]/tracking/ping`
  - `/api/trips/[offerId]/tracking/stop`
  - `/api/trips/[offerId]/tracking?limit=1`
- Mantiene cola local en `localStorage`.
- Conserva throttling:
  - distancia minima aproximada 250m.
  - intervalo minimo aproximado 30s.
- Sincroniza al volver online.
- No envia tracking si usuario no es conductor autorizado.

### UI

- Card sobria o bloque integrado, no protagonico.
- Debe mostrar:
  - estado: activo/pausado.
  - permiso GPS.
  - precision.
  - ultima sincronizacion.
  - cola local.
  - accion iniciar/pausar.
  - accion sync manual con icono.
- Si hay ultima ubicacion:
  - enlace externo a mapa con copy sobrio.

### Copy

- `GPS activo en primer plano.`
- `Si el telefono bloquea el navegador, guardamos lo pendiente y sincronizamos al volver.`
- `Cola local`
- `Ultima sincronizacion`
- `Permiso de ubicacion`

### QA

- offline agrega pings a cola.
- online sincroniza cola.
- sync no duplica pings innecesariamente.
- permission denied muestra recuperacion.
- navegador sin GPS muestra fallback.
- boton pausar detiene watch.
- unmount limpia watch.
- business/admin solo leen tracking, no lo escriben.

## `PickingChecklist`

### Intencion

El checklist debe sentirse como una mesa de verificacion premium. El camionero no debe pelear con una lista: debe avanzar item por item con certeza.

### Reglas de Diseno

- Header monocromo con progreso sobrio.
- Barra de progreso fina negra sobre gris claro.
- Item card con borde fino y altura estable.
- Estado textual visible.
- Expandir item con chevron.
- Acciones con botones grandes y tactiles.
- No usar verde/rojo como lenguaje dominante.

### Carga

- Estados permitidos:
  - pendiente.
  - cargado.
  - con novedad.
  - rechazado.
- Rechazo en carga:
  - nota requerida.
  - foto requerida o bloque de justificacion si foto no disponible.
  - debe persistir como `loadStatus = rejected`.

### Entrega

- Estados permitidos:
  - pendiente.
  - entregado.
  - parcial.
  - rechazado.
- Rechazo en entrega:
  - cantidad.
  - motivo.
  - foto.
  - nota opcional.

### Borradores Locales

- Mantener `draftNamespace`.
- Guardar:
  - notas.
  - fotos seleccionadas.
  - decision.
  - cantidades.
  - expandido.
- Limpiar borrador al confirmar item.
- Si el navegador no permite persistir imagenes grandes, mostrar error claro.

### QA

- progreso cuenta item rechazado en carga como procesado.
- progreso de entrega no marca rechazado como entregado total.
- fotos se restauran desde borrador si se recarga.
- borrar foto no rompe input.
- doble submit bloqueado.
- errores no colapsan panel.
- no hay `NaN` en cantidades.

## `/inspecciones`

### Intencion

La empresa debe ver inspecciones como expedientes operativos, no como cards decorativas. La lista debe permitir encontrar rapido rutas con evidencia, novedades, rechazos y cierres.

### Contrato Funcional

- Usa `getInspectionList(user.id, { limit })`.
- Respeta RLS y permisos de business/admin.
- No debe exponer inspecciones de otra empresa.
- Mantiene busqueda local por:
  - origen.
  - destino.
  - camionero.
- Puede agregar filtro por estado si no rompe el contrato.

### Layout

- Header:
  - titulo `Inspecciones`
  - subtitulo `Evidencia de cargue, ruta y entrega.`
  - sin hero comercial.
- Banda de metricas:
  - total.
  - con novedades.
  - con rechazos.
  - completadas.
  - pendientes.
- Filtros:
  - todas.
  - pendientes.
  - en proceso.
  - en ruta.
  - entrega.
  - completadas.
  - con novedad.
- Busqueda:
  - input con icono.
  - placeholder `Buscar por ruta o conductor`.

### Card de Inspeccion

Debe mostrar:

- ruta como elemento principal.
- conductor.
- estado.
- fecha.
- items totales.
- cargados.
- entregados.
- rechazados.
- fotos.
- indicador de novedad si aplica.
- CTA textual `Ver expediente`.

Reglas:

- sin hover verde.
- sin iconos coloreados por estado.
- usar `font-money` solo si aparece valor.
- la card debe ser escaneable en 3 segundos.

### Empty State

- Copy:
  - `Aun no hay inspecciones registradas.`
  - `Cuando un viaje tenga cargue, entrega o evidencia, aparecera aqui.`
- CTA opcional:
  - `Ver mis ofertas`

### Error State

- Copy:
  - `No pudimos cargar inspecciones.`
  - `Reintenta o contacta soporte si el problema continua.`

### QA

- lista carga para business con ofertas asignadas.
- search no rompe cuando trucker falta.
- filtros combinan con busqueda.
- card no depende de color.
- mobile no corta ruta ni CTA.
- empty state no parece error.
- permisos intactos.

## `/inspecciones/[offerId]`

### Intencion

Este es el expediente premium del viaje. Debe parecer una cadena de custodia, no una pagina de debug. Cada evidencia debe poder responder: quien, que, cuando, donde, en que etapa y con que resultado.

### Contrato Funcional

- Usa `getInspectionReport(offerId)`.
- Carga:
  - `cargo_offers`
  - `picking_events`
  - `user_profiles`
  - `trip_photos`
- Enriquecer manifiesto con `picking_events` como fuente autoritativa cuando el JSONB no refleje rechazo/entrega.
- Deduplicar fotos por URL.
- Mantener `InspectionReport`, `InspectionSummary`, `InspectionManifestItem`, `InspectionTimelineEvent`, `InspectionPhoto`.
- Respetar RLS.

### Layout

- Header negro mate:
  - `Expediente de viaje`
  - ruta.
  - conductor.
  - estado.
  - fecha.
  - referencia corta.
- Summary band:
  - items.
  - cargados.
  - novedades.
  - rechazados.
  - fotos.
- Secciones:
  - `Cadena de custodia`
  - `Manifiesto`
  - `Evidencia fotografica`
  - `Timeline`
  - `Ubicaciones verificadas`
  - `Firmas digitales` si existen o cuando el contrato lo soporte.

### Summary

Metricas:

- `Items`
- `Cargados`
- `Novedades`
- `Rechazados`
- `Fotos`
- `Cumplimiento de cargue`
- `Cumplimiento de entrega`

Reglas:

- no usar semaforo de colores.
- porcentajes deben incluir texto.
- si el total es 0, mostrar `Sin manifiesto`, no `NaN%`.

### Manifiesto

Cada fila/card debe mostrar:

- item.
- referencia.
- esperado.
- cargado.
- entregado.
- rechazado.
- estado.
- motivo.
- notas.
- fotos relacionadas.

Reglas:

- tabla en desktop.
- cards compactas en mobile.
- fotos de item abren modal filtrado.
- rechazo y parcial siempre visibles.
- si hay inconsistencia, mostrar etiqueta `Revisar evidencia`.

### Galeria de Evidencia

Agrupar por:

- `Carga`
- `Ruta`
- `Entrega`
- `Novedades`

Cada foto debe mostrar:

- stage.
- item.
- timestamp.
- cantidad.
- estado.
- motivo si existe.
- notas.
- coordenadas solo si el rol puede verlas.

Modal:

- fondo negro mate.
- imagen object-contain.
- navegacion con iconos.
- contador.
- metadata inferior.
- escape cierra.
- flechas funcionan.

Fallback:

- imagen rota muestra bloque sobrio.
- sin fotos muestra empty state.

### Timeline

Eventos:

- llegada a origen.
- inicio de carga.
- item cargado.
- novedad en carga.
- carga completada.
- PIN salida.
- llegada a destino.
- inicio de descarga.
- item entregado.
- item rechazado.
- descarga completada.
- PIN entrega.
- foto agregada.

Reglas:

- timeline vertical.
- iconos monocromos.
- timestamp relativo y absoluto.
- fotos mini si existen.
- ubicacion compacta si existe y esta permitida.
- no depender de color para severidad.

### Ubicaciones Verificadas

Mostrar:

- origen esperado vs registrado.
- destino esperado vs registrado.
- distancia al punto si existe.
- tolerancia.
- timestamp.
- precision GPS si existe.

Copy:

- `Ubicacion registrada dentro del radio permitido.`
- `Ubicacion registrada fuera del radio esperado. Revisar con soporte.`

### Acciones de Soporte

Disponibles segun rol:

- `Copiar referencia`
- `Abrir soporte`
- `Ver oferta`
- `Ver tracking` si hay permiso.

Reglas:

- no exponer ids largos como elemento visual principal.
- copiar referencia usa id corto.
- soporte debe recibir contexto de `offerId` si la ruta lo soporta.

### QA

- reporte carga con offerId valido.
- oferta inexistente muestra error sobrio.
- fotos de `trip_photos` y `picking_events` se deduplican.
- item con eventos duplicados no excede cantidad esperada.
- rechazos aparecen en summary, manifiesto, galeria y timeline.
- timeline ordena por fecha ascendente.
- modal no se sale en mobile.
- imagen no se distorsiona.
- coordenadas no se muestran a rol no permitido.
- no hay colores heredados dominantes.

## Seguridad y Permisos

- Camionero:
  - puede operar solo viajes asignados o aceptados.
  - puede escribir tracking solo en sus viajes.
  - puede subir evidencia solo en sus viajes.
- Empresa:
  - puede leer inspecciones de sus ofertas.
  - no debe operar PIN del camionero desde UI.
- Admin:
  - puede leer segun permisos internos.
  - acciones de soporte deben quedar separadas de acciones operativas.

Reglas:

- nunca mostrar `pickup_pin` o `delivery_pin` completo en UI de inspeccion.
- no mostrar bearer tokens, session ids o payloads internos.
- referencias largas se acortan.
- telefonos visibles solo donde hay permiso operativo.
- coordenadas se tratan como dato sensible.
- RLS no se relaja para mejorar UX.

## PWA, Offline y Resiliencia

### Tracking

- Cola local limitada.
- Sync al volver online.
- Boton manual de sync.
- Estado de cola visible.

### Picking Drafts

- Borradores por `offerId:stage:itemId`.
- Fotos serializadas si el navegador lo soporta.
- Recuperacion despues de reload.
- Limpieza al confirmar.

### Uploads

- Manejar:
  - timeout.
  - archivo muy grande.
  - red offline.
  - storage error.
- Copy:
  - `La evidencia no se sincronizo. Conserva esta pantalla y reintenta.`
  - `La foto excede el tamano permitido.`

### Reintentos

- No duplicar eventos si el usuario toca dos veces.
- Boton disabled mientras procesa.
- Si el backend responde error, no marcar completado visualmente.
- Si la evidencia se sube pero RPC falla, mostrar recuperacion clara.

## Copy Base

### Viaje

- `Tu siguiente paso esta listo.`
- `Esta ruta aun espera confirmacion final.`
- `La cadena de custodia se completa con GPS, evidencia y PIN.`
- `El valor mostrado es operativo. Los movimientos financieros se validan aparte.`

### Carga

- `Registra llegada al punto de cargue.`
- `Verifica cada item antes de pedir el PIN.`
- `La evidencia queda asociada al item y a esta etapa.`
- `Este PIN confirma la salida desde origen.`

### Entrega

- `Registra llegada al destino.`
- `Confirma entregados y rechazados con precision.`
- `Si hay rechazo, agrega motivo y evidencia.`
- `Este PIN cierra la entrega operativa.`

### Tracking

- `GPS activo en primer plano.`
- `Guardamos pings pendientes y sincronizamos al volver.`
- `Ultima ubicacion registrada.`

### Inspecciones

- `Expediente de viaje`
- `Evidencia de cargue, ruta y entrega.`
- `Revisar evidencia`
- `Cadena de custodia`

## Copy Prohibido

No debe aparecer:

- `pago liberado`
- `dinero disponible`
- `a tu billetera`
- `garantizado`
- `credito`
- `adelanto`
- `cash inmediato`
- `tracking en segundo plano garantizado`
- `sin conexion no pasa nada` si no hay evidencia real de recuperacion
- `entregado exitosamente` cuando hay rechazo parcial

## No Alcance

Este sprint NO debe:

- redisenar publicar, editar, mis ofertas, checkout o estados de pago del Sprint 37.
- redisenar billetera, retiros, settlements o payouts del Sprint 38.
- cambiar calculos financieros.
- prometer liberacion de dinero.
- activar lending o avances.
- cambiar Mercado Pago.
- redisenar WMS command de Sprint 40.
- cambiar RLS o politicas de Supabase sin migracion propia.
- introducir mapas complejos si el contrato actual solo muestra ultima ubicacion.
- crear una nueva arquitectura de almacenamiento de evidencia.
- cambiar payloads de RPC sin migracion y QA.

## Implementacion Recomendada

### Orden

1. Limpiar `/viaje/[offerId]`:
   - panel de autoridad monocromo.
   - timeline de etapas.
   - CTA unico segun `nextAction`.
   - bloquear copy financiero incorrecto.
2. Limpiar `LiveTripTracker`:
   - monocromo.
   - estados claros.
   - cola local visible.
   - limitar promesa PWA.
3. Limpiar `/viaje/[offerId]/carga`:
   - header negro mate.
   - GPS sobrio.
   - checklist monocromo.
   - evidencia y firma.
   - PIN de salida.
4. Limpiar `/viaje/[offerId]/entrega`:
   - header negro mate.
   - GPS destino.
   - entrega/rechazo por item.
   - firma receptor.
   - PIN entrega sin prometer payout.
5. Limpiar `/inspecciones`:
   - lista ejecutiva.
   - filtros.
   - metricas.
   - cards sin colores heredados.
6. Limpiar `/inspecciones/[offerId]`:
   - expediente premium.
   - summary.
   - manifiesto.
   - galeria.
   - timeline.
   - metadata y soporte.

### Componentes Potenciales

Crear solo si reduce repeticion real:

- `TripAuthorityPanel`
- `TripStageTimeline`
- `EvidenceStatusBadge`
- `EvidencePhotoGrid`
- `EvidenceMetadata`
- `InspectionMetric`
- `InspectionRouteHeader`
- `CustodyTimeline`
- `MonochromeStatusBadge`

No crear un nuevo design system dentro de este sprint si Sprint 33 ya define la base.

## QA Visual

Validar desktop y mobile en:

- `/viaje/[offerId]`
- `/viaje/[offerId]/carga`
- `/viaje/[offerId]/entrega`
- `/inspecciones`
- `/inspecciones/[offerId]`

Checklist:

- no hay verde, naranja, azul, violeta, rojo o ambar como marca dominante.
- no hay degradados de colores.
- no hay confetti ni celebraciones ruidosas.
- no hay cards anidadas innecesarias.
- no hay texto cortado en botones.
- no hay layout shift al mostrar errores.
- mobile no requiere zoom.
- targets tactiles comodos.
- PIN usable con una mano.
- fotos no se distorsionan.
- timeline se entiende sin color.
- estados se entienden por texto.
- dinero en mono si aparece.
- referencias cortas y copiables si aplica.

## QA Funcional

### Viaje

- sin sesion redirige conservando ruta.
- camionero asignado puede abrir.
- camionero no asignado no puede abrir.
- empresa/admin no reciben CTAs de conductor por error.
- `nextAction` dirige a carga, entrega o cierre.
- bloqueo por pago/confirmacion se entiende.
- refresh no pierde estado.

### Carga

- GPS origen llama `register_arrival`.
- llegada fuera de radio muestra mensaje.
- item cargado llama `register_item_loaded`.
- item con novedad conserva `hasIssue`.
- item rechazado conserva `loadStatus`.
- fotos suben al bucket correcto.
- draft local se restaura.
- firma privada se guarda.
- PIN salida llama `verify_pickup_pin`.
- intentos de PIN funcionan.
- completion no duplica eventos.

### Tracking

- iniciar llama `tracking/start`.
- ping llama `tracking/ping`.
- stop llama `tracking/stop`.
- offline guarda cola.
- online sincroniza.
- permiso denegado no crashea.
- unmount limpia watch.

### Entrega

- GPS destino llama `register_arrival`.
- entrega total llama `register_item_delivered`.
- entrega parcial conserva entregado/rechazado.
- rechazo exige motivo y foto.
- firma receptor se guarda.
- PIN entrega llama `verify_delivery_pin`.
- al completar detiene tracking.
- score refresh no bloquea flujo.
- no aparece copy de payout inmediato.

### Inspecciones

- lista carga por business.
- busqueda por ruta/conductor funciona.
- filtros por estado funcionan si se implementan.
- reporte carga por offerId.
- timeline usa picking_events.
- fotos de eventos aparecen.
- fotos duplicadas se deduplican.
- rechazos se ven en summary, manifiesto, galeria y timeline.
- modal de fotos funciona con teclado y mobile.

## QA de Datos

- `offerId` se conserva entre:
  - viaje.
  - carga.
  - entrega.
  - tracking.
  - inspeccion.
- `manifestItem.id` se mantiene estable.
- si item no trae id, se usa `generateStableManifestItemId`.
- cantidades nunca exceden esperado/cargado.
- `loadStatus = rejected` no se pierde.
- `deliveryStatus = partial/rejected/complete` se refleja en reporte.
- fotos conservan URL, etapa, timestamp, item y notas.
- eventos conservan `manifest_item_id`, `manifest_item_name`, `quantity`, `item_status`, `rejection_reason`, `photo_urls`, `latitude`, `longitude`.
- firmas conservan `signatureStage`, `signerName`, `signerDocumentId`, `signerRole`.
- tracking conserva `capturedAt`, precision, velocidad, heading y metadata si existe.

## QA de Seguridad

- RLS intacto en cargo offers, picking events, tracking y evidencia.
- rutas API validan usuario autenticado.
- `canWriteTracking` solo permite conductor asignado.
- `canReadTracking` respeta rol.
- no mostrar PINs en reportes.
- no mostrar tokens.
- no mostrar ids largos como UI principal.
- coordenadas visibles solo con permiso.
- storage no permite acceso indebido mas alla del contrato actual.

## QA de Accesibilidad

- botones con texto o aria-label.
- icon buttons con tooltip si existe sistema.
- contraste suficiente en negro/blanco/gris.
- focus visible.
- input PIN con teclado numerico.
- canvas de firma tiene instrucciones textuales.
- modal de fotos cierra con Escape.
- navegacion de modal por teclado.
- imagenes con alt util.
- errores asociados al campo.

## Definition of Done

- `/viaje/[offerId]` funciona como hub premium del viaje con CTA unico y estado claro.
- `/viaje/[offerId]/carga` permite registrar GPS, manifiesto, evidencia, firma y PIN sin ansiedad.
- `/viaje/[offerId]/entrega` permite registrar GPS, entrega/rechazo, evidencia, firma y PIN sin prometer payout.
- `LiveTripTracker` comunica PWA, permisos, cola local y sincronizacion con claridad.
- `/inspecciones` se siente como tablero ejecutivo de expedientes, no lista decorativa.
- `/inspecciones/[offerId]` se siente como cadena de custodia completa.
- Rechazos y parciales se preservan de extremo a extremo.
- Fotos y metadata se ven sin distorsion.
- Estados no dependen de color.
- Mobile pasa el flujo completo.
- Copy financiero es exacto y no invade Sprint 38.
- Permisos y RLS se conservan.
- API/RPC/storage actuales se mantienen.
- El sprint queda cerrado como especificacion completa y listo para implementacion avanzada sin invadir 34, 35, 36, 37, 38, 40, 41, 42 ni 43.
