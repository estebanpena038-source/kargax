# CERRADO - Sprint 37: Publishing + Payments Luxury

## Estado

- artifact status: `closed_spec_complete_ready_for_execution`
- prioridad: maxima para confianza empresarial y money flow
- owner: Frontend + Payments + Marketplace
- rutas principales: `/ofertas/publicar`, `/ofertas/editar/[id]`, `/ofertas/mis-ofertas`, `/pagar/[offerId]`, `/pago/exitoso`, `/pago/fallido`, `/pago/pendiente`
- rutas/API que deben conservar contrato: `/api/offers`, `/api/payments/create-preference`, `/api/payments/trip-status`, `/api/payments/offers-status`, `/api/payments/selection/cancel`, `/api/payments/webhook`
- dependencias visuales: Sprint 33 `Luxury Design System Foundation`, Sprint 35 `App Shell + Personal Luxury`, Sprint 36 `Marketplace Luxury`
- frontera con otros sprints: este sprint termina en publicacion, gestion de ofertas y pago/reserva; wallet, retiros y payouts pertenecen al Sprint 38; tracking, PIN/POD y evidencia pertenecen al Sprint 39.
- cierre documental: `cerrado`
- decision: implementar exactamente esta especificacion, sin ampliar alcance financiero ni tocar wallet/payouts/lending

## Cierre Ejecutivo

Este sprint queda cerrado como especificacion maestra para convertir el flujo `Publicar -> Administrar -> Pagar -> Confirmar estado` en una experiencia premium de confianza empresarial.

La entrega no es solo visual. La entrega define:

- que debe sentir la empresa al publicar y pagar
- que pantallas entran y cuales quedan fuera
- que contratos de datos no se deben romper
- que copy financiero esta permitido
- que copy financiero esta prohibido
- que estados deben mostrarse
- que rutas deben conservar `offerId`, `applicationId` y referencias de pago
- que QA debe pasar antes de considerar el sprint implementado

La vara de cierre es simple: si una empresa no entiende con calma que esta publicando, pagando o esperando confirmacion, el sprint no esta implementado aunque compile.

## Objetivo

Convertir publicar una carga y pagar una reserva en una experiencia de precision financiera. La empresa debe sentir que esta operando desde una mesa de control premium: pocos pasos, cero ruido, dinero claro, estados confiables y decisiones sin ansiedad.

El usuario debe pensar:

- `publicar una carga aqui se siente serio`
- `entiendo exactamente cuanto pago y por que`
- `no siento riesgo, siento control`
- `esto parece una operacion corporativa de alto nivel`

## Principio central

La publicacion es el momento donde KargaX recibe la intencion operativa. El pago es el momento donde KargaX recibe confianza financiera. Si cualquiera de los dos se siente barato, confuso o inseguro, el producto pierde autoridad.

Por eso este sprint no busca decorar pantallas. Busca que cada pixel le diga al usuario:

`Tu carga, tu dinero y tu operacion estan bajo control.`

## Reglas Globales

- Todo el sprint debe ser blanco/negro mate, con grises sobrios y sin colores de marca heredados.
- No usar verdes, naranjas, azules, violetas, rojos, degradados de colores ni badges tipo arcoiris.
- Estados semanticos se comunican con texto, icono, borde, peso visual y posicion, no con color.
- Dinero siempre usa `font-money` o fuente mono equivalente.
- Montos deben tener separacion de miles, moneda visible y copy claro.
- La UI debe anticipar dudas antes de que el usuario pregunte.
- Ninguna vista debe prometer credito, adelantos, liberacion inmediata, payout automatico o funcionalidad financiera no certificada.
- La palabra `custodia` puede usarse solo si el flujo real lo respalda; si depende de webhook, conciliacion o aprobacion, decirlo con precision.
- No cambiar contratos de API, payloads, estados ni validaciones sin documentar migracion y QA.
- No romper restricciones por rol: camionero no publica, empresa no ve CTAs de camionero, admin solo ve lo permitido.
- Mobile primero: publicar, revisar y pagar deben ser posibles sin zoom, sin scroll confuso y sin botones cortados.

## Lenguaje Visual

- Superficie base: blanco mate o gris calido muy leve.
- Panel de autoridad: negro mate para momentos de decision financiera.
- Cards: radio maximo `8px`, borde fino, sombra casi imperceptible.
- Botones:
  - primario negro mate
  - secundario blanco con borde negro/gris
  - destructivo sin rojo dominante; usar borde, texto y confirmacion clara
- Iconos: lucide existentes, monocromos, pequenos, funcionales.
- Progreso: linea o steps discretos, sin circulos grandes de colores.
- Formularios: inputs amplios, labels concretos, errores cortos debajo del campo.
- Microcopy: humano, directo, sin hype.

## Arquitectura de Experiencia

El sprint se divide en 4 momentos:

1. `Publicar`: transformar una necesidad logistica en una oferta clara.
2. `Administrar`: ver ofertas por estado y actuar sin perder contexto.
3. `Pagar`: aceptar un camionero y confirmar dinero con confianza.
4. `Resolver estado`: exito, pendiente o fallo sin ansiedad.

Cada momento debe dejar claro:

- que esta pasando
- que puede hacer el usuario ahora
- que hara KargaX despues
- que no debe esperar todavia

## Personas y Motivaciones

### Empresa Owner

Necesita publicar cargas rapido, ver postulaciones, elegir conductor y pagar con confianza. Quiere control financiero, trazabilidad y una experiencia que parezca de empresa grande, no de herramienta improvisada.

Dolores:

- miedo a pagar mal
- duda sobre comisiones
- confusion entre postulacion, reserva y viaje confirmado
- ansiedad si el pago queda pendiente
- perdida de tiempo llenando formularios largos

Resultado esperado:

- entiende el flujo sin manual
- sabe que falta para publicar
- sabe cuanto paga y por que
- sabe que KargaX no promete liberar dinero antes de validar

### Operador de Empresa

Necesita publicar y administrar sin ver complejidad financiera innecesaria. Debe poder ejecutar tareas operativas con permisos correctos.

Dolores:

- demasiados campos
- estados poco claros
- acciones que aparecen aunque no tenga permiso
- editar ofertas que ya tienen actividad sin entender consecuencias

Resultado esperado:

- ve solo acciones permitidas
- entiende estados de oferta
- no rompe una reserva por accidente

### Finanzas Empresa

Necesita revisar montos, comision, total y referencias. Su obsesion es que el dinero tenga trazabilidad.

Dolores:

- fees escondidos
- referencias dificiles de copiar
- estados que suenan a pago liberado sin serlo
- falta de relacion entre oferta, postulacion y pago

Resultado esperado:

- ve desglose de flete, comision y total
- puede copiar referencia
- entiende si el pago esta confirmado, pendiente o fallido

### Admin KargaX

Necesita que el flujo genere datos limpios para soporte, conciliacion y seguimiento. Cada error visual debe dejar pistas sin exponer informacion sensible.

Dolores:

- usuarios duplicando pagos
- usuarios perdiendo `applicationId`
- soporte sin referencias
- UI prometiendo cosas que backend no ha confirmado

Resultado esperado:

- cada estado deja rastros utiles
- soporte puede pedir referencia corta
- no hay promesas financieras peligrosas

## Historias de Usuario

### Publicacion

- Como empresa, quiero crear una carga paso a paso para no olvidar datos criticos.
- Como empresa, quiero ver un resumen de ruta, carga y dinero mientras publico para detectar errores antes del final.
- Como empresa, quiero agregar manifiesto de items para que el conductor verifique lo que recoge.
- Como empresa, quiero escoger entre marketplace y flota privada para operar segun mi realidad.
- Como empresa, quiero guardar borrador para no perder progreso si aun no tengo toda la informacion.
- Como empresa, quiero publicar solo cuando todos los datos minimos esten completos.

### Administracion

- Como empresa, quiero ver mis ofertas por estado para saber que requiere accion.
- Como empresa, quiero buscar ofertas por ruta o titulo para encontrarlas rapido.
- Como empresa, quiero ver postulaciones por oferta para elegir conductor sin perder contexto.
- Como empresa, quiero aceptar una postulacion y entrar al pago seguro sin marcar el viaje como completado.
- Como empresa, quiero rechazar postulaciones sin cerrar toda la oferta.
- Como empresa, quiero editar solo lo que el estado permite para no romper trazabilidad.

### Pago

- Como empresa, quiero ver el flete y la comision separados para confiar en el total.
- Como empresa, quiero pagar con Mercado Pago sin perder mi sesion ni la postulacion seleccionada.
- Como empresa, quiero que si mi sesion expira, el sistema me devuelva al mismo checkout.
- Como empresa, quiero saber si el pago esta pendiente para no repetirlo a ciegas.
- Como empresa, quiero copiar referencias de pago para soporte o contabilidad.

### Estados Posteriores

- Como empresa, quiero ver si el pago fue confirmado para saber si la reserva avanzo.
- Como empresa, quiero entender si KargaX aun esta generando PINs o validando webhook.
- Como empresa, quiero reintentar un pago fallido sin crear una oferta nueva.
- Como empresa, quiero ir a mis ofertas o seguimiento despues de pagar.

## Mapa de Responsabilidades por Ruta

| Ruta | Responsabilidad | No debe hacer |
|---|---|---|
| `/ofertas/publicar` | Crear oferta operativa con datos completos | Confirmar pago, liberar dinero, mostrar wallet |
| `/ofertas/editar/[id]` | Ajustar oferta existente segun estado | Permitir cambios prohibidos por backend |
| `/ofertas/mis-ofertas` | Gestionar tablero de ofertas y postulaciones | Hacer conciliacion financiera profunda |
| `/pagar/[offerId]` | Crear checkout seguro para una postulacion | Marcar payout o viaje completado |
| `/pago/exitoso` | Mostrar confirmacion y siguiente paso | Prometer liberacion al camionero |
| `/pago/fallido` | Permitir recuperacion limpia | Afirmar que nunca hubo cargo si puede existir pendiente |
| `/pago/pendiente` | Validar estado y esperar sin ansiedad | Forzar reintento cuando puede existir pago pendiente |

## Contratos de Datos que No se Deben Romper

### Publicacion de Oferta

El payload hacia `api.offers.create` debe conservar, cuando existan:

- `title`
- `description`
- `cargoType`
- `weight`
- `weightKg`
- `weightUnit`
- `volume`
- `volumeUnit`
- `quantity`
- `originCity`
- `originDepartment`
- `originAddress`
- `pickupContactName`
- `pickupContactPhone`
- `destCity`
- `destDepartment`
- `destAddress`
- `deliveryContactName`
- `deliveryContactPhone`
- `manifestItems`
- `warehouseFlowMode`
- `originWarehouseId`
- `destinationWarehouseId`
- `originDockId`
- `destinationDockId`
- `assignmentMode`
- `privateFleetTruckerId`
- `freightPaymentAmount`
- `expenseAllowanceAmount`
- `pickupDate`
- `deliveryDate`
- `budgetMin`
- `budgetMax`
- `totalAmount`
- `currency`
- `countryCode`
- `currencyCode`
- `requiredVehicle`
- `minExperienceYears`
- `insuranceRequired`
- `specialRequirements`
- `paymentMethod`
- `paymentSchedule`
- `publishImmediately`
- `photos`

Regla:

- la UI puede reordenar, explicar y embellecer, pero no puede perder campos que ya alimentan viaje, bodega, pago o evidencia.

### Checkout

La llamada a `/api/payments/create-preference` debe conservar:

- `offerId`
- `applicationId`
- sesion activa
- bearer token si existe
- cookies
- reintento unico despues de refresh session si hay `401`

Respuesta esperada:

- `preference.id`
- `preference.init_point`
- `preference.sandbox_init_point`
- `amounts.freight`
- `amounts.platformFee`
- `amounts.total`
- `payment.id`
- `payment.offerId`
- `payment.applicationId`
- `payment.status`
- `idempotencyKey`

Regla:

- si no hay `init_point` ni `sandbox_init_point`, no redirigir.
- si no hay `applicationId` cuando se requiere, no inventar seleccion.

### Estado de Pago

Las pantallas de estado deben conservar parametros:

- `offer_id`
- `application_id`
- `payment_id`
- `collection_id`
- `local_payment_id`
- `merchant_order_id`
- `status`

Regla:

- cada link interno debe reconstruir query params relevantes.
- retry debe conservar `applicationId`.
- exitoso y pendiente deben conservar referencias para soporte.

## Matriz de Estados de Oferta

| Estado tecnico | Label UI | Intencion visual | Acciones permitidas |
|---|---|---|---|
| `draft` | Borrador | Incompleto o no publicado | editar, publicar, eliminar |
| `active` | Publicada | Recibiendo postulaciones | ver, editar si backend permite, ver postulaciones |
| `assigned` | Asignada | Hay conductor seleccionado | ver, pagar si falta pago, seguimiento si aplica |
| `reserved` | Reservada | Pago/reserva operativo asociado | ver, seguimiento, soporte |
| `in_progress` | En viaje | Operacion en ejecucion | seguimiento, mensajes, evidencia |
| `completed` | Completada | Operacion cerrada | ver resumen, soporte |
| `cancelled` | Cancelada | Operacion detenida | ver, soporte |
| `expired` | Expirada | Ventana vencida | duplicar si existe, archivar |

Reglas:

- `reserved` nunca significa `dinero liberado al camionero`.
- `completed` no pertenece al checkout; pertenece a viaje/evidencia.
- `cancelled` debe requerir cuidado si hay pago asociado.

## Matriz de Estados de Pago

| Estado tecnico | Label UI | Explicacion | CTA principal |
|---|---|---|---|
| `awaiting_payment` | Esperando pago | Aun no hay confirmacion del proveedor | Retomar pago |
| `pending_confirmation` | Confirmando | KargaX valida proveedor, reserva y PINs | Ver mis ofertas |
| `confirmed` | Confirmado | Pago validado y reserva cerrada segun backend | Ver seguimiento |
| `failed` | No confirmado | No se pudo confirmar este pago | Intentar nuevamente |
| `refunded` | Devuelto | Pago reversado si el backend lo soporta | Contactar soporte |

Reglas:

- `confirmed` no debe usar copy de payout.
- `pending_confirmation` debe reducir ansiedad, no parecer error.
- `failed` debe mantener camino de recuperacion.

## Matriz de Permisos

| Usuario | Publicar | Editar | Ver mis ofertas | Ver postulaciones | Pagar | Ver estados pago |
|---|---|---|---|---|---|---|
| Empresa owner | Si | Si, segun estado | Si | Si | Si | Si |
| Operador empresa | Si, si rol lo permite | Si, si rol lo permite | Si | Si, si rol lo permite | No, salvo permiso financiero |
| Finanzas empresa | No por defecto | No por defecto | Lectura | Lectura | Si, si rol lo permite | Si |
| Camionero | No | No | No | No | No | Solo si tiene contexto permitido |
| Admin | Si, segun rol admin | Si | Si | Si | Si | Si |

Reglas:

- no inventar permisos nuevos dentro de este sprint.
- si el sistema actual no soporta granularidad fina, conservar comportamiento actual y no ampliar privilegios.
- ocultar acciones no permitidas, pero tambien proteger con backend.

## Criterios de Aceptacion por Ruta

### `/ofertas/publicar`

Debe pasar:

- El usuario ve un flujo de 6 pasos limpio.
- Cada paso tiene titulo, subtitulo y campos relacionados.
- El boton principal avanza o publica segun paso.
- `Guardar borrador` se ve como accion secundaria.
- El stepper no usa colores heredados.
- El resumen lateral aparece en desktop.
- En mobile, el resumen no tapa el CTA.
- Errores de validacion aparecen debajo del campo.
- El manifiesto calcula unidades, peso y volumen.
- `assignmentMode` cambia entre marketplace y flota propia.
- Si flota propia, aparece selector de conductor.
- Si no hay conductores privados, hay mensaje claro y accion hacia flota.
- El paywall de plan aparece sin romper el layout.

No debe pasar:

- Un camionero puede publicar.
- El boton `Publicar oferta` queda activo mientras se envia.
- Un monto `0` avanza sin error.
- Una ciudad queda seleccionada despues de cambiar departamento.
- Los campos de flota privada aparecen en marketplace.

### `/ofertas/editar/[id]`

Debe pasar:

- Carga datos actuales.
- Muestra estado y referencia.
- Muestra secciones editables sin saturar.
- Muestra actividad/vistas si usuario tiene permiso.
- Guarda cambios con `api.offers.update`.
- Muestra restriccion si la oferta tiene actividad.

No debe pasar:

- Editar una oferta bloqueada como si estuviera libre.
- Perder presupuesto al guardar otros campos.
- Mostrar estadisticas a quien no es owner si backend no lo permite.
- Usar copy que anime a cambiar todo sin cuidado.

### `/ofertas/mis-ofertas`

Debe pasar:

- Tablero carga ofertas de empresa.
- Filtros por estado funcionan.
- Busqueda por ruta/titulo funciona.
- Cards muestran ruta, fecha, estado, flete y postulaciones.
- Modal de postulaciones es legible en mobile.
- `Aceptar y pagar` navega a checkout con `applicationId`.
- `Rechazar` actualiza postulacion sin cerrar oferta.

No debe pasar:

- Aceptar postulacion marca viaje pagado.
- Perder contexto de offer al abrir modal.
- Mostrar acciones de editar en estados no permitidos.
- Mostrar botones destructivos sin confirmacion.

### `/pagar/[offerId]`

Debe pasar:

- Carga oferta, postulacion y camionero seleccionado.
- Si falta sesion, redirige a login con redirect completo.
- Si hay multiples postulaciones, exige `applicationId`.
- Muestra flete, comision y total.
- CTA crea preference con API actual.
- Processing deshabilita boton.
- Error se muestra en panel.

No debe pasar:

- Crear preference sin `applicationId` cuando hay multiples postulaciones.
- Redirigir a Mercado Pago sin URL.
- Decir que el pago ya quedo confirmado antes del proveedor.
- Ocultar la comision.

### `/pago/exitoso`

Debe pasar:

- Lee referencias de query.
- Consulta `trip-status`.
- Muestra estado claro.
- Muestra PINs solo si existen.
- Si no hay PINs, explica validacion.
- Si falla sync, muestra mensaje sobrio y reintenta.
- Permite copiar referencia.

No debe pasar:

- Decir `pago liberado`.
- Decir `camionero ya recibio dinero`.
- Mostrar PINs falsos como si existieran.
- Crashear si falta `offer_id`.

### `/pago/fallido`

Debe pasar:

- Mantiene `offer_id`.
- Mantiene `application_id`.
- Reintento vuelve al checkout correcto.
- Soporte disponible.
- Copy no culpa al usuario.

No debe pasar:

- Asegurar que no hubo cargo si el proveedor puede estar pendiente.
- Perder `applicationId`.
- Usar fondo rojo agresivo.

### `/pago/pendiente`

Debe pasar:

- Hace polling.
- Redirige a exitoso si confirma.
- Muestra retomar pago solo si corresponde.
- Explica que se valida proveedor/reserva/PINs.
- Conserva referencias.

No debe pasar:

- Empujar reintento si el banco muestra pago pendiente.
- Ocultar sync error.
- Romper al faltar una referencia opcional.

## `/ofertas/publicar`

### Intencion

El usuario no debe sentir que llena un formulario. Debe sentir que esta configurando una operacion seria. Cada paso debe reducir incertidumbre y convertir datos sueltos en una orden logistica lista para ejecutarse.

### Estructura General

- Layout desktop:
  - ancho principal comodo, max-width controlado
  - wizard a la izquierda/centro
  - resumen sticky a la derecha si hay espacio
  - navegacion inferior estable
- Layout mobile:
  - progreso compacto arriba
  - un solo paso visible
  - resumen colapsable
  - CTA fijo o facil de alcanzar al final del paso
- Header:
  - titulo: `Publicar carga`
  - subtitulo: `Configura ruta, manifiesto, asignacion y pago operativo.`
  - metadato discreto: `Empresa`, `Pais`, `Moneda`

### Pasos del Wizard

Los pasos deben sentirse inevitables y no negociables:

1. `Carga`
2. `Ruta`
3. `Asignacion`
4. `Requisitos`
5. `Fotos`
6. `Revision`

No usar nombres largos en el stepper. La descripcion vive dentro del paso, no en el indicador.

### Stepper

- Desktop:
  - linea horizontal monocroma
  - paso activo con borde negro y fondo blanco
  - pasos completados con check monocromo
  - pasos bloqueados con opacidad baja
- Mobile:
  - `Paso 2 de 6`
  - barra fina negra sobre gris claro
  - porcentaje opcional, sin protagonismo
- QA:
  - solo se puede saltar a pasos ya visitados
  - validar paso antes de avanzar
  - errores no deben mover todo el layout

### Paso 1: Carga

Objetivo: que la carga sea entendible y verificable.

Campos:

- tipo de carga
- descripcion
- manifiesto de items
- cantidad por item
- peso por item
- medidas por item
- requisitos especiales
- temperatura solo si aplica

Diseño:

- bloque de manifiesto como mesa de inventario premium
- cada item en fila limpia
- metricas calculadas abajo:
  - items
  - unidades
  - peso total
  - volumen total
- si faltan medidas, texto sobrio: `Algunos items no tienen medidas completas. El volumen se calculara solo con datos disponibles.`

Microcopy:

- label descripcion: `Descripcion operativa`
- placeholder: `Mercancia, presentacion, cuidados y condiciones de cargue.`
- manifiesto: `Lo que el conductor verificara al recoger.`

QA:

- `manifestItems` conserva validacion zod.
- no permitir item sin nombre.
- cantidad vacia vuelve a minimo seguro.
- calculos no generan `NaN`.
- datos derivados del manifiesto siguen alimentando peso/cantidad/volumen del payload.

### Paso 2: Ruta

Objetivo: que origen, destino y contactos queden listos para PIN y trazabilidad.

Campos:

- departamento origen
- ciudad origen
- direccion origen
- contacto de recogida
- telefono contacto de recogida
- fecha y ventana de recogida
- departamento destino
- ciudad destino
- direccion destino
- contacto de entrega
- telefono contacto de entrega
- fecha y ventana de entrega
- campos de bodega si aplica

Diseño:

- dos bloques simetricos: `Origen` y `Destino`
- conector vertical simple entre ambos
- contactos dentro de subpanel sobrio llamado `Contacto para PIN`
- fechas agrupadas como ventana, no campos dispersos

Microcopy:

- `Este contacto recibira el PIN de salida.`
- `Este contacto recibira el PIN de entrega.`
- `La ventana horaria ayuda a evitar esperas y reclamos.`

QA:

- validacion de telefono andino intacta.
- ciudades se resetean al cambiar departamento.
- fecha entrega no puede ser anterior a recogida si la logica actual ya lo controla.
- `WarehouseOfferFields` conserva comportamiento.
- mobile no corta `AndeanPhoneInput`.

### Paso 3: Asignacion y Pago

Objetivo: separar claramente marketplace, flota privada y dinero.

Opciones:

- `Marketplace`
  - copy: `Publicas la ruta y eliges entre postulaciones verificadas.`
  - no mencionar pago automatico al camionero.
- `Flota propia`
  - copy: `Asignas directo a un conductor de tu empresa.`
  - aparece selector de conductor solo en modo privado.

Monto:

- label: `Flete ofrecido al conductor`
- moneda visible: `COP` u otra segun configuracion de pais
- input grande, mono, sin color
- preview debajo: monto formateado
- texto: `Este es el valor operativo que vera el conductor o quedara asociado a la asignacion privada.`

Reglas:

- Si `assignmentMode = private`, pedir `privateFleetTruckerId`.
- Si no hay flota activa, mostrar bloque sobrio con accion hacia `/dashboard/flota`.
- No mezclar `freightPaymentAmount`, `expenseAllowanceAmount` y `totalAmount` visualmente si no se usan en el flujo real.
- Si existen viaticos privados en backend, mostrarlos como `Viaticos operativos` y explicar que no son credito.

QA:

- `privateFleetTruckerId` aparece solo cuando corresponde.
- `totalAmount` mayor a cero.
- paywall de plan no se rompe.
- error `PLAN_LIMIT_REACHED` abre `PlanLimitPaywallDialog`.
- toast no usa copy exagerado.

### Paso 4: Requisitos

Objetivo: que el conductor entienda si puede cumplir antes de postularse.

Campos:

- tipo de vehiculo
- experiencia minima
- seguro requerido
- requisitos adicionales

Diseño:

- pocos campos
- seguro como checkbox elegante
- requisitos adicionales como textarea corto

Microcopy:

- `Solo agrega requisitos que realmente cambian la ejecucion.`
- `Mas requisitos no siempre significan mejor operacion.`

QA:

- opciones de vehiculo no cambian contrato.
- checkbox conserva valor booleano.
- no se guardan requisitos vacios como ruido.

### Paso 5: Fotos

Objetivo: aportar claridad visual sin volver el flujo pesado.

Diseño:

- zona de carga limpia, borde punteado monocromo
- thumbnails con borde fino
- eliminar foto con icono monocromo
- limite visible: `0/5`

Microcopy:

- `Opcional. Usa fotos solo si ayudan a entender volumen, empaque o condicion de la carga.`
- `PNG, JPG o WebP hasta 5MB.`

QA:

- storage `offer-photos` intacto.
- no permitir mas de 5 imagenes.
- errores de upload visibles sin romper el paso.
- imagen rota no colapsa layout.

### Paso 6: Revision

Objetivo: que el usuario sienta cierre y control antes de publicar.

Debe mostrar:

- carga
- ruta
- contactos PIN
- asignacion
- conductor privado si aplica
- flete
- vehiculo
- manifiesto resumido
- fotos si existen
- terminos

Diseño:

- panel negro mate superior con ruta y monto principal
- secciones blancas debajo
- montos con `font-money`
- modo de asignacion como bloque propio
- checkbox final claro

Microcopy:

- titulo: `Revision final`
- subtitulo: `Esto es lo que KargaX publicara y usara para operar el viaje.`
- confirmacion: `Confirmo que la informacion operativa es correcta y acepto los terminos de KargaX.`

QA:

- revision refleja valores actuales del formulario.
- checkbox requerido funciona.
- `Guardar borrador` no publica.
- `Publicar oferta` no se puede disparar doble mientras `isSubmitting`.

### Resumen Sticky

Desktop debe tener un panel lateral que muestre:

- ruta en construccion
- modo: marketplace/flota propia
- flete ofrecido
- manifiesto: items/unidades/peso
- proximo dato pendiente

Regla:

- el resumen no debe reemplazar validaciones.
- en mobile puede ser acordeon o bloque antes del CTA final.

## `/ofertas/editar/[id]`

### Intencion

Editar no debe sentirse como volver a llenar todo. Debe sentirse como ajustar una orden existente con trazabilidad.

### Layout

- Header:
  - boton volver
  - titulo: `Editar oferta`
  - estado actual
  - referencia corta del offerId
- Contenido:
  - columna principal con secciones editables
  - lateral con estado, vistas y restricciones
- Si la oferta tiene postulaciones, pago o estado bloqueado:
  - mostrar banner discreto: `Esta oferta ya tiene actividad. Algunos cambios pueden estar restringidos.`

### Secciones

- `Informacion basica`
- `Ruta`
- `Presupuesto`
- `Requisitos`
- `Actividad`

### Reglas de Edicion

- Si backend impide editar ciertos estados, UI debe respetarlo.
- No esconder restricciones: explicar en una frase.
- No permitir cambios que contradigan el estado real de pago/reserva.
- Si hay postulaciones, presupuesto y ruta deben tratarse con mayor cautela.

### Microcopy

- `Ajusta solo lo necesario para mantener trazabilidad.`
- `Los cambios se guardaran sobre esta oferta.`
- `Si necesitas cambiar la operacion completa, considera crear una nueva oferta.`

### QA

- carga por `offerId` funciona.
- error `Oferta no encontrada` es sobrio.
- loader monocromo.
- guardar conserva payload actual.
- `api.offers.update` no cambia contrato.
- vistas/estadisticas no filtran datos a usuario no owner.
- botones no aparecen si el estado no permite accion.

## `/ofertas/mis-ofertas`

### Intencion

Debe ser el tablero de control de cargas de la empresa. No una galeria de cards bonitas. El usuario debe poder abrir esta pagina y entender:

- que esta publicado
- que requiere decision
- que ya esta reservado
- que esta en ejecucion
- que se completo
- donde hay dinero involucrado

### Layout

- Header:
  - titulo: `Mis ofertas`
  - subtitulo: `Publicaciones, postulaciones y pagos bajo control.`
  - CTA principal: `Publicar carga`
- Banda de metricas:
  - activas
  - con postulaciones
  - reservadas
  - en viaje
  - completadas
- Filtros:
  - todos
  - borrador
  - activas
  - reservadas
  - en viaje
  - completadas
  - canceladas
- Busqueda:
  - ruta
  - titulo
  - ciudad
- Orden:
  - recientes
  - antiguas
  - mayor flete
  - menor flete

### Cards

Cada card debe mostrar:

- ruta como elemento principal
- estado
- fecha recogida
- flete
- postulaciones
- tipo de vehiculo
- modo de asignacion si esta disponible
- estado de pago/reserva si esta disponible
- acciones permitidas

Diseño:

- cards densas pero respiradas
- sin hover verde
- monto con `font-money`
- estado con icono y texto
- acciones secundarias como icon buttons con tooltip si existe sistema

Acciones:

- `Editar` solo en estados permitidos.
- `Ver postulaciones` solo si hay postulaciones o si la oferta puede recibirlas.
- `Publicar` solo en borrador.
- `Eliminar/cancelar` debe requerir confirmacion.
- `Pagar` solo desde postulacion elegible.

### Modal de Postulaciones

Debe sentirse como mesa de seleccion ejecutiva:

- nombre del camionero
- telefono/email si corresponde
- experiencia
- monto propuesto si existe
- mensaje
- estado de la postulacion
- accion `Aceptar y pagar`
- accion `Rechazar`

Reglas:

- aceptar no debe marcar viaje como pagado directamente.
- aceptar debe llevar a `/pagar/[offerId]?applicationId=[id]`.
- si el flujo requiere pago antes de aceptar definitivamente, el copy debe decirlo.

Microcopy:

- `Aceptar inicia el pago seguro de la reserva.`
- `El viaje queda confirmado cuando el pago sea validado.`

QA:

- counters correctos por estado.
- filtro no rompe fetch.
- busqueda local no oculta estados incorrectamente.
- modal no se sale de pantalla mobile.
- acciones visibles solo segun permiso y estado.
- rechazar postulacion no cierra toda la oferta.
- no perder `applicationId` al navegar al checkout.

## `/pagar/[offerId]`

### Intencion

El checkout debe sentirse como una caja fuerte: serio, claro, irreversible solo cuando corresponde. La empresa no debe tener que adivinar si esta pagando el flete, una comision o ambos.

### Layout

- Header:
  - volver
  - titulo: `Confirmar pago`
  - subtitulo: `Revisa la reserva antes de salir a Mercado Pago.`
- Progreso:
  - `Revisar`
  - `Pagar`
  - `Confirmar`
- Columna principal:
  - ruta
  - carga
  - camionero seleccionado
  - fechas
- Panel financiero:
  - flete
  - comision KargaX / plataforma
  - total a pagar
  - metodo externo: Mercado Pago
  - CTA `Pagar con Mercado Pago`

### Panel Financiero

Debe usar:

- monto total grande con `font-money`
- tabla simple de conceptos
- fee separado, nunca escondido
- nota de validacion:
  - `El pago se confirma cuando Mercado Pago y KargaX validen la transaccion.`
- nota operativa:
  - `Los PINs y la reserva se activan despues de la confirmacion.`

### Estados

- loading:
  - `Cargando informacion del pago`
  - spinner monocromo
- sin sesion:
  - redirect a login conservando `offerId` y `applicationId`
- sin postulacion:
  - `No hay postulacion elegible para pagar esta oferta.`
- postulacion ambigua:
  - `Selecciona una postulacion especifica desde Mis ofertas.`
- error API:
  - mensaje claro del backend si existe
- processing:
  - boton disabled
  - `Creando checkout seguro`

### Reglas Criticas

- Siempre conservar `applicationId` si viene en query.
- No elegir postulacion arbitraria si hay multiples elegibles.
- No hacer redirect a checkout sin preferencia valida.
- Si `create-preference` responde 401, refresh session y reintentar una vez.
- No cambiar `idempotencyKey`.
- No cambiar calculo de `platformFee` sin sprint financiero separado.

### QA

- Mercado Pago flow intacto.
- `Authorization` bearer y cookies se conservan.
- redirect a login vuelve al mismo checkout.
- `applicationId` correcto llega a `/api/payments/create-preference`.
- doble click no crea dos preferencias visibles.
- errores se muestran dentro del panel, no como crash.
- mobile muestra total y CTA sin solaparse.

## `/pago/exitoso`

### Intencion

Exito no significa gritar victoria. Significa cerrar ansiedad y guiar al siguiente paso. La empresa debe entender que el pago fue recibido/aprobado por proveedor, pero la operacion puede seguir esperando webhook, conciliacion, PINs o reserva final.

### Layout

- KX o sello monocromo arriba.
- titulo segun estado:
  - `Pago confirmado`
  - `Pago aprobado, finalizando reserva`
- ruta resumida
- camionero asignado si existe
- referencias:
  - payment id
  - local payment id
  - merchant order id si aplica
- PINs solo si ya existen
- CTAs:
  - `Ver mis ofertas`
  - `Ir al seguimiento` si ya hay viaje activo
  - `Copiar referencia`

### Estados Internos

- Si `tripStatus = confirmed`:
  - mostrar que reserva esta confirmada.
- Si `tripStatus = pending_confirmation`:
  - mostrar banner: `Estamos terminando de validar el pago y generar los datos del viaje.`
- Si no hay PINs:
  - mostrar placeholders sobrios, no error rojo.
- Si sync falla:
  - mostrar bloque: `No pudimos sincronizar aun. Seguiremos intentando.`

### Microcopy Permitido

- `Pago recibido. KargaX esta confirmando la reserva.`
- `Los PINs apareceran cuando la validacion quede completa.`
- `No cierres esta pagina si quieres ver la confirmacion en tiempo real.`

### Microcopy Prohibido

- `El camionero ya recibio el dinero`
- `Pago liberado`
- `Retiro disponible`
- `Garantizado al instante`

### QA

- polling de `trip-status` conserva comportamiento.
- si estado pasa a failed, redirige a fallido.
- PINs se copian correctamente.
- no exponer datos sensibles.
- loading no usa colores heredados.
- si `offer_id` falta, vista no crashea.

## `/pago/fallido`

### Intencion

Fallo no debe generar panico ni verguenza. Debe ser una recuperacion limpia.

### Layout

- fondo blanco mate o negro mate sobrio.
- icono monocromo.
- titulo: `Pago no completado`
- texto: `No se registro un pago confirmado para esta reserva.`
- bloque de causas posibles, maximo 4:
  - banco no aprobo
  - pago cancelado
  - sesion expirada
  - metodo no disponible
- CTAs:
  - `Intentar nuevamente`
  - `Volver a mis ofertas`
  - `Contactar soporte`

### Reglas

- Conservar `offer_id`.
- Conservar `application_id`.
- `Intentar nuevamente` debe volver a `/pagar/[offerId]?applicationId=[applicationId]`.
- No decir que hubo cargo si no esta confirmado.
- No decir que no hubo cargo si el proveedor puede estar pendiente; en ese caso enviar a pendiente o usar copy neutral.

### Microcopy

- `Si tu banco muestra un movimiento pendiente, espera la confirmacion o contacta soporte con la referencia.`
- `Puedes reintentar sin crear una nueva oferta.`

### QA

- retryHref correcto.
- botones visibles en mobile.
- soporte abre `/soporte`.
- no perder query params.
- no usar fondo con degradado rojo.

## `/pago/pendiente`

### Intencion

La espera debe sentirse controlada. El usuario debe saber que KargaX esta trabajando y que no tiene que repetir pasos a ciegas.

### Layout

- titulo dinamico:
  - `Validando pago`
  - `Pago pendiente`
  - `Pago aprobado, cerrando reserva`
  - `Pago no confirmado`
- explicacion corta.
- panel `Que estamos revisando`
  - proveedor de pago
  - reserva de oferta
  - generacion de PINs
  - estado del viaje
- CTAs:
  - `Ver mis ofertas`
  - `Retomar pago` solo si el estado lo permite
  - `Ir al dashboard`

### Comportamiento

- polling cada pocos segundos como exista actualmente.
- si `tripStatus` pasa a `confirmed`, `in_transit` o `completed`, redirigir a exitoso.
- si `tripStatus = failed`, mostrar reintento cuando aplique.
- si `canResumePayment`, informar sin empujar al usuario a duplicar pago.

### Microcopy

- `Estamos validando la transaccion contra tu reserva.`
- `Si Mercado Pago confirma, KargaX cerrara la reserva y generara los datos operativos.`
- `No repitas el pago si tu banco lo muestra como pendiente.`

### QA

- polling intacto.
- redirect a exitoso conserva referencias.
- retry conserva `applicationId`.
- sync error visible sin pánico.
- loading monocromo.

## Estados de Oferta y Pago

### Estados visuales de oferta

- `draft`: Borrador
- `active`: Publicada
- `assigned`: Asignada
- `reserved`: Reservada
- `in_progress`: En viaje
- `completed`: Completada
- `cancelled`: Cancelada
- `expired`: Expirada

Regla visual:

- usar icono + texto + borde.
- no depender de color.
- `reserved` debe explicar que hay una reserva/pago operativo asociado, no payout al camionero.

### Estados visuales de pago

- `awaiting_payment`: Esperando pago
- `pending_confirmation`: Confirmando
- `confirmed`: Confirmado
- `failed`: No confirmado
- `refunded` si existe: Devuelto

Regla de copy:

- `confirmed` no equivale a `liberado al camionero`.
- `pending_confirmation` no equivale a error.
- `failed` no equivale siempre a cargo inexistente.

## Seguridad y Confianza

- No mostrar tokens, ids internos largos o datos sensibles completos.
- Referencias se muestran cortas con opcion copiar.
- Telefonos visibles solo donde el usuario ya tiene permiso operativo.
- En pagos, no mostrar datos de tarjeta; Mercado Pago se encarga.
- No guardar datos sensibles en UI.
- No alterar RLS ni permisos.

## Copy Base

### Publicacion

- `Configura la carga con la precision que necesita una operacion real.`
- `El manifiesto ayuda a verificar la carga en origen.`
- `La asignacion privada omite postulaciones publicas y conserva trazabilidad.`
- `El flete ofrecido es el valor operativo visible para la ruta.`

### Checkout

- `Revisa la reserva antes de salir a Mercado Pago.`
- `KargaX confirmara la reserva cuando el proveedor valide el pago.`
- `La comision se muestra separada para que sepas exactamente que estas pagando.`

### Exito

- `Pago recibido. Estamos cerrando la reserva operativa.`
- `Los PINs apareceran cuando la validacion quede completa.`

### Pendiente

- `Estamos validando el pago contra tu reserva.`
- `No repitas el pago si tu banco lo muestra pendiente.`

### Fallo

- `No se registro un pago confirmado para esta reserva.`
- `Puedes reintentar sin crear una nueva oferta.`

## No Alcance

Este sprint NO debe:

- rediseñar wallet o retiros.
- activar lending, avances o credito.
- cambiar contabilidad de payouts.
- cambiar webhook de Mercado Pago sin ticket financiero.
- rediseñar marketplace publico completo, que pertenece al Sprint 36.
- rediseñar tracking/PIN/POD completo, que pertenece al Sprint 39.
- introducir una nueva libreria visual.
- cambiar contratos de Supabase sin migracion y QA.

## Implementacion Recomendada

### Orden

1. Limpiar `/ofertas/publicar`:
   - stepper monocromo
   - bloques de carga/ruta/asignacion
   - resumen sticky
   - revision final
2. Limpiar `/ofertas/mis-ofertas`:
   - filtros monocromos
   - cards escaneables
   - modal de postulaciones sobrio
3. Limpiar `/ofertas/editar/[id]`:
   - header, banner de restricciones y sidebar
4. Limpiar `/pagar/[offerId]`:
   - checkout caja fuerte
   - panel financiero claro
5. Limpiar `/pago/exitoso`, `/pago/fallido`, `/pago/pendiente`:
   - copy financiero exacto
   - estados sin ansiedad

### Componentes Potenciales

Crear solo si reduce repeticion real:

- `PaymentAmountRow`
- `PaymentReference`
- `OfferStatusPill`
- `RouteSummary`
- `WizardReviewPanel`

No crear abstracciones grandes si solo se usan una vez.

## Plan de Ejecucion Detallado

### Bloque 1: Auditoria de UI Actual

Objetivo:

- detectar colores heredados
- detectar copy financiero peligroso
- detectar acciones visibles incorrectas
- detectar perdida de parametros

Tareas:

- revisar `/ofertas/publicar`
- revisar `/ofertas/editar/[id]`
- revisar `/ofertas/mis-ofertas`
- revisar `/pagar/[offerId]`
- revisar `/pago/exitoso`
- revisar `/pago/fallido`
- revisar `/pago/pendiente`
- buscar clases `green`, `emerald`, `orange`, `amber`, `blue`, `violet`, `purple`, `red`
- buscar texto:
  - `liberado`
  - `garantizado`
  - `automatico`
  - `credito`
  - `adelanto`
  - `deposito`

Salida esperada:

- lista corta de archivos a tocar
- confirmacion de APIs que no se modifican
- confirmacion de componentes reutilizables disponibles

### Bloque 2: Publicar Oferta

Tareas:

- rediseñar header de pagina.
- reemplazar stepper visual por monocromo.
- normalizar headers de cada paso.
- limpiar bloque de manifiesto.
- convertir ruta en bloques simetricos.
- limpiar `assignmentMode`.
- convertir monto en panel de dinero.
- limpiar fotos y estado opcional.
- crear revision final mas fuerte.
- agregar resumen sticky desktop.
- revisar mobile.

Validacion:

- crear borrador.
- publicar marketplace.
- publicar flota privada.
- validar errores paso a paso.
- confirmar que payload no cambia.

### Bloque 3: Mis Ofertas

Tareas:

- limpiar header y CTA.
- convertir tabs en filtros sobrios.
- agregar/ordenar metricas si existen datos suficientes.
- rediseñar card.
- normalizar `StatusBadge`.
- limpiar modal de postulaciones.
- cambiar copy `Aceptar` por `Aceptar y pagar` cuando aplique.
- conservar navegacion a `/pagar/[offerId]?applicationId=[id]`.

Validacion:

- filtros por estado.
- busqueda.
- abrir modal.
- aceptar postulacion.
- rechazar postulacion.
- revisar mobile.

### Bloque 4: Editar Oferta

Tareas:

- limpiar loading/error.
- limpiar header.
- mostrar referencia corta.
- mostrar banner de actividad si aplica.
- normalizar secciones.
- limpiar estadisticas de vistas.
- conservar `handleSave`.

Validacion:

- editar oferta borrador.
- editar oferta activa si backend lo permite.
- ver error oferta inexistente.
- revisar acciones segun estado.

### Bloque 5: Checkout

Tareas:

- reemplazar estilo tipo billetera generica por caja fuerte KX.
- mostrar progreso simple.
- rediseñar ruta/carga/camionero.
- rediseñar panel financiero.
- mostrar total en mono.
- separar fee.
- agregar nota de validacion.
- limpiar metodo Mercado Pago.
- normalizar loading/error.
- conservar refresh session.

Validacion:

- checkout con `applicationId`.
- checkout sin sesion.
- checkout con multiples postulaciones y sin `applicationId`.
- API error.
- redirect a Mercado Pago.

### Bloque 6: Estados de Pago

Tareas:

- exitoso:
  - sello KX
  - estado dinamico
  - referencias copiables
  - PINs solo si existen
  - copy sin promesa de payout
- pendiente:
  - panel de espera controlada
  - polling visible
  - retomar pago solo si corresponde
- fallido:
  - recuperacion sin ansiedad
  - retry con params
  - soporte

Validacion:

- pago aprobado con PINs.
- pago aprobado sin PINs.
- pendiente con polling.
- fallido con retry.
- query params completos e incompletos.

## Componentes y Patrones Sugeridos

### `OfferStatusPill`

Responsabilidad:

- mostrar estado tecnico como texto humano.
- usar icono monocromo.
- no depender de color.

Props sugeridas:

- `status`
- `label`
- `size`
- `className`

No debe:

- decidir permisos.
- disparar acciones.

### `MoneyLine`

Responsabilidad:

- mostrar concepto financiero y monto.
- usar `font-money`.
- alinear valores.

Props sugeridas:

- `label`
- `amount`
- `currency`
- `description`
- `strong`

No debe:

- calcular fee.
- decidir moneda global.

### `PaymentReferenceBlock`

Responsabilidad:

- mostrar referencias cortas.
- permitir copiar.
- ocultar si no existe referencia.

Props sugeridas:

- `paymentId`
- `localPaymentId`
- `merchantOrderId`
- `collectionId`

No debe:

- exponer tokens.
- mostrar IDs internos completos si no aportan.

### `RouteSignature`

Responsabilidad:

- mostrar origen -> destino de forma compacta.
- funcionar en card, checkout y exito.

Props sugeridas:

- `originCity`
- `originDepartment`
- `destinationCity`
- `destinationDepartment`
- `date`

No debe:

- hacer fetch.
- traducir estados financieros.

### `WizardSummaryPanel`

Responsabilidad:

- mostrar resumen vivo de publicar oferta.
- detectar datos faltantes visualmente.

Props sugeridas:

- `formValues`
- `currentStep`
- `manifestMetrics`
- `currencyCode`

No debe:

- validar por si mismo.
- modificar formulario.

## Edge Cases Obligatorios

### Publicacion

- Usuario refresca a mitad del wizard.
  - comportamiento aceptado: se pierde si hoy no hay persistencia, pero no debe crashear.
- Manifiesto sin peso.
  - usar fallback existente y explicar que peso queda pendiente.
- Manifiesto con medidas parciales.
  - calcular solo completas.
- Monto con decimales.
  - normalizar o aceptar segun input actual; nunca mostrar `NaN`.
- Pais distinto de Colombia.
  - respetar `country` y `currencyCode` actuales; no hardcodear COP si config dice otra cosa.
- Flota privada sin conductores.
  - mostrar mensaje y bloquear seleccion.
- Error de plan.
  - abrir paywall y mantener datos del formulario.

### Mis Ofertas

- Oferta sin `budgetMin` ni `budgetMax`.
  - mostrar `Sin flete definido` o `-`, no `COP 0` si no corresponde.
- Oferta sin postulaciones.
  - boton de postulaciones puede estar deshabilitado o explicar estado.
- Oferta con status desconocido.
  - mostrar `Estado no reconocido` con icono sobrio.
- Busqueda sin resultados.
  - empty state con accion clara.

### Checkout

- Sin `offerId`.
  - error controlado.
- `offerId` invalido.
  - `Oferta no encontrada`.
- Sin postulaciones elegibles.
  - `No hay postulacion elegible para pagar esta oferta.`
- Multiples postulaciones elegibles sin query.
  - pedir seleccion desde mis ofertas.
- Sesion expirada.
  - refresh y reintento.
- `create-preference` devuelve 401 dos veces.
  - login con redirect.
- `create-preference` devuelve error de negocio.
  - mostrar mensaje.
- Mercado Pago sin init point.
  - no redirigir.

### Exitoso

- `offer_id` falta.
  - vista sobria con accion a mis ofertas.
- `payment_id` falta pero `local_payment_id` existe.
  - usar referencia local.
- Pago aprobado pero backend aun no genera PINs.
  - mostrar pendiente de validacion.
- `trip-status` falla.
  - mostrar error suave y reintentar.

### Pendiente

- Estado se mantiene pendiente mucho tiempo.
  - mantener mensaje, soporte visible.
- Estado cambia a confirmado.
  - redirigir a exitoso.
- Estado cambia a failed.
  - permitir reintento.
- `canResumePayment` true.
  - mostrar reintento sin decir que el pago anterior desaparecio.

### Fallido

- Falta `application_id`.
  - retry a `/pagar/[offerId]`; checkout decidira si necesita seleccion.
- Banco muestra pendiente.
  - copy recomienda esperar o soporte.
- Usuario presiona volver.
  - no debe perder contexto si navegador lo conserva.

## Plan de QA Manual Detallado

### QA37-01 Publicar Marketplace

Preparacion:

- usuario empresa
- plan con capacidad de publicar
- sin flota privada requerida

Pasos:

1. Entrar a `/ofertas/publicar`.
2. Completar carga con 2 items de manifiesto.
3. Completar ruta con contactos PIN.
4. Elegir `Marketplace`.
5. Ingresar flete.
6. Elegir vehiculo.
7. Omitir fotos.
8. Revisar resumen final.
9. Publicar.

Debe pasar:

- cada paso valida lo necesario.
- el resumen refleja datos.
- la oferta queda creada.
- redirige a `/ofertas/mis-ofertas`.

### QA37-02 Publicar Flota Privada

Preparacion:

- empresa con conductor privado activo

Pasos:

1. Entrar a `/ofertas/publicar`.
2. Completar carga y ruta.
3. Elegir `Flota propia`.
4. Seleccionar conductor.
5. Ingresar flete.
6. Revisar.
7. Publicar.

Debe pasar:

- selector aparece solo en privado.
- payload incluye `assignmentMode = private`.
- payload incluye `privateFleetTruckerId`.
- copy no menciona marketplace.

### QA37-03 Paywall de Plan

Preparacion:

- empresa con limite agotado

Pasos:

1. Completar oferta valida.
2. Publicar.

Debe pasar:

- aparece `PlanLimitPaywallDialog`.
- formulario no se borra.
- error no rompe layout.

### QA37-04 Mis Ofertas y Postulaciones

Preparacion:

- oferta activa con 2 postulaciones

Pasos:

1. Entrar a `/ofertas/mis-ofertas`.
2. Filtrar activas.
3. Buscar por ciudad.
4. Abrir postulaciones.
5. Rechazar una.
6. Aceptar otra.

Debe pasar:

- modal muestra candidatos.
- rechazar no cierra oferta.
- aceptar navega a `/pagar/[offerId]?applicationId=[id]`.

### QA37-05 Checkout Sesion Expirada

Preparacion:

- URL de checkout con `offerId` y `applicationId`
- sesion expirada

Pasos:

1. Abrir checkout.
2. Confirmar redirect a login.
3. Iniciar sesion.

Debe pasar:

- vuelve al checkout original.
- conserva `applicationId`.

### QA37-06 Checkout Multiples Postulaciones

Preparacion:

- oferta con multiples postulaciones elegibles

Pasos:

1. Abrir `/pagar/[offerId]` sin query.

Debe pasar:

- no selecciona al azar.
- muestra mensaje de seleccionar postulacion desde lista.

### QA37-07 Pago Exitoso Pendiente de PINs

Preparacion:

- callback exitoso con provider aprobado
- backend aun sin PINs

Pasos:

1. Abrir `/pago/exitoso?offer_id=...&payment_id=...`.
2. Esperar polling.

Debe pasar:

- muestra validacion en progreso.
- no promete liberacion.
- muestra PINs cuando existan.

### QA37-08 Pago Fallido Retry

Preparacion:

- URL fallida con `offer_id` y `application_id`

Pasos:

1. Abrir `/pago/fallido?...`.
2. Presionar `Intentar nuevamente`.

Debe pasar:

- vuelve a `/pagar/[offerId]?applicationId=[applicationId]`.
- no pierde parametros.

### QA37-09 Pago Pendiente a Confirmado

Preparacion:

- pago en `pending_confirmation`

Pasos:

1. Abrir `/pago/pendiente?...`.
2. Simular que `trip-status` pasa a `confirmed`.

Debe pasar:

- redirige a exitoso.
- conserva referencias.

### QA37-10 Mobile Completo

Preparacion:

- viewport mobile

Pasos:

1. Publicar carga completa.
2. Ver mis ofertas.
3. Abrir modal postulaciones.
4. Entrar checkout.
5. Ver estados pago.

Debe pasar:

- no hay zoom necesario.
- botones no se cortan.
- inputs no desbordan.
- modales caben.
- CTA principal visible.

## QA Automatizable Recomendado

Aunque no haya suite completa, se recomienda automatizar:

- render de `/ofertas/publicar` sin crash.
- render de `/ofertas/mis-ofertas` sin crash.
- render de checkout con mock de datos.
- funcion de construir retry href conserva `applicationId`.
- funcion de construir success href conserva referencias.
- busqueda local en mis ofertas.
- status label para estados conocidos y desconocidos.

No bloquear implementacion si no existe infraestructura de tests, pero dejar evidencia manual.

## Evidencia de Cierre Esperada

Cuando se implemente, adjuntar:

- screenshot desktop `/ofertas/publicar`
- screenshot mobile `/ofertas/publicar`
- screenshot desktop `/ofertas/mis-ofertas`
- screenshot mobile modal postulaciones
- screenshot desktop `/pagar/[offerId]`
- screenshot mobile `/pagar/[offerId]`
- screenshot `/pago/exitoso`
- screenshot `/pago/pendiente`
- screenshot `/pago/fallido`
- evidencia de payload publicacion
- evidencia de request `create-preference`
- evidencia de retry con `applicationId`
- evidencia de que no hay copy financiero prohibido

## Matriz de Riesgos

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Perder `applicationId` | Pago a postulacion incorrecta o bloqueo | conservar query en todos los links |
| Prometer liberacion inmediata | Riesgo legal/soporte | copy aprobado y QA financiero |
| Duplicar preferencia de pago | Confusion y soporte | boton disabled, idempotency backend |
| Romper payload de oferta | Viajes incompletos | diff estricto y QA publicacion |
| Confundir marketplace/flota privada | Operacion incorrecta | bloques separados y revision final |
| Mostrar colores heredados | Rompe lujo visual | busqueda de clases y QA visual |
| Ocultar comision | Pierde confianza | tabla financiera obligatoria |
| Fallo de webhook | Usuario ansioso | pantalla pendiente clara y polling |
| Sesion expirada en checkout | Abandono | redirect completo a login |
| Estados desconocidos | UI rota | fallback sobrio |

## Checklist de Implementacion

- [ ] `/ofertas/publicar` monocromo.
- [ ] stepper premium sin colores heredados.
- [ ] resumen sticky desktop.
- [ ] resumen mobile no invasivo.
- [ ] manifiesto limpio y calculos robustos.
- [ ] ruta con contactos PIN claros.
- [ ] asignacion marketplace/flota propia separada.
- [ ] monto con `font-money`.
- [ ] revision final con ruta, monto, asignacion y manifiesto.
- [ ] paywall de plan intacto.
- [ ] `/ofertas/mis-ofertas` monocromo.
- [ ] filtros por estado claros.
- [ ] cards con ruta/monto/estado/postulaciones.
- [ ] modal postulaciones sobrio.
- [ ] aceptar postulacion navega a checkout con `applicationId`.
- [ ] `/ofertas/editar/[id]` con restricciones visibles.
- [ ] checkout con panel financiero claro.
- [ ] fee separado.
- [ ] Mercado Pago intacto.
- [ ] estados pago sin promesas indebidas.
- [ ] pending con polling claro.
- [ ] failed con retry correcto.
- [ ] references copiables donde aplique.
- [ ] mobile revisado.
- [ ] copy financiero prohibido eliminado.

## Checklist de Cierre Funcional

- [ ] crear oferta marketplace.
- [ ] crear oferta flota privada.
- [ ] guardar borrador.
- [ ] activar paywall.
- [ ] filtrar mis ofertas.
- [ ] buscar mis ofertas.
- [ ] abrir postulaciones.
- [ ] rechazar postulacion.
- [ ] aceptar postulacion hacia checkout.
- [ ] checkout con sesion valida.
- [ ] checkout con sesion expirada.
- [ ] checkout con error API.
- [ ] redirect Mercado Pago.
- [ ] exitoso pendiente de PINs.
- [ ] exitoso con PINs.
- [ ] pendiente a confirmado.
- [ ] fallido a retry.

## Checklist de Cierre Visual

- [ ] no colores heredados visibles.
- [ ] no degradados de colores.
- [ ] no cards dentro de cards sin necesidad.
- [ ] radio de cards sobrio.
- [ ] botones sin texto cortado.
- [ ] montos alineados.
- [ ] labels claros.
- [ ] estados entendibles sin color.
- [ ] mobile sin overflow horizontal.
- [ ] modales caben en mobile.
- [ ] loading skeleton/spinner monocromo.
- [ ] error state sin rojo agresivo.

## Checklist de Cierre de Copy

- [ ] `Pago confirmado` solo cuando backend/proveedor lo respaldan.
- [ ] `Pago pendiente` explica validacion.
- [ ] `Pago no completado` no acusa ni asusta.
- [ ] no aparece `credito`.
- [ ] no aparece `adelanto`.
- [ ] no aparece `liberado al camionero`.
- [ ] no aparece `garantizado`.
- [ ] no aparece `deposito bancario`.
- [ ] aparece `Mercado Pago` donde aplica.
- [ ] aparece `referencia` donde aplica.
- [ ] aparece `validacion` donde aplica.

## QA Visual

Validar desktop y mobile en:

- `/ofertas/publicar`
- `/ofertas/mis-ofertas`
- `/ofertas/editar/[id]`
- `/pagar/[offerId]`
- `/pago/exitoso`
- `/pago/fallido`
- `/pago/pendiente`

Checklist:

- no hay verde/naranja/azul/violeta/rojo visible como marca.
- no hay gradientes de colores.
- no hay cards anidadas innecesarias.
- no hay texto cortado en botones.
- no hay layout shift al mostrar error.
- mobile no requiere zoom.
- el CTA principal es obvio.
- los montos usan fuente mono.
- referencias se pueden copiar si aplica.
- estados se entienden sin color.

## QA Funcional

### Publicar

- empresa puede crear oferta marketplace.
- empresa puede crear oferta flota privada si tiene conductor activo.
- camionero es redirigido fuera de publicar.
- validaciones zod siguen igual.
- `PlanLimitPaywallDialog` aparece con `PLAN_LIMIT_REACHED`.
- `Guardar borrador` crea borrador si el API lo soporta.
- `Publicar oferta` crea oferta activa si el API lo soporta.

### Mis Ofertas

- filtros por estado funcionan.
- busqueda local funciona.
- contador de postulaciones correcto.
- aceptar postulacion navega a checkout con `applicationId`.
- rechazar postulacion no rompe lista.
- acciones se ocultan segun estado.

### Editar

- carga oferta existente.
- error de oferta inexistente.
- guardar llama `api.offers.update`.
- estados bloqueados respetan backend.

### Checkout

- sin sesion redirige a login con redirect completo.
- con una postulacion elegible carga checkout.
- con varias postulaciones exige `applicationId`.
- `create-preference` recibe `offerId` y `applicationId`.
- si Mercado Pago entrega `init_point`, redirige.
- si falla, muestra error en pantalla.

### Estados de Pago

- exitoso consulta `trip-status`.
- pendiente hace polling y redirige cuando confirma.
- fallido permite reintentar con `offerId` y `applicationId`.
- no se duplican pagos por reintentos visuales.
- copy no promete liberacion inmediata.

## QA de Datos

- `offerId` no se pierde entre:
  - mis ofertas
  - checkout
  - pendiente
  - exitoso
  - fallido
- `applicationId` no se pierde entre:
  - modal postulaciones
  - checkout
  - retry
  - estados de pago
- `payment_id`, `collection_id`, `merchant_order_id`, `local_payment_id` se conservan en links internos si existen.
- `countryCode` y `currencyCode` siguen saliendo de configuracion actual.
- `platformFee` coincide con configuracion actual.

## QA de Copy Legal/Financiero

No debe aparecer:

- `credito aprobado`
- `adelanto disponible`
- `pago inmediato al camionero`
- `dinero liberado`
- `garantizado`
- `banco KargaX`
- `deposito bancario`

Debe aparecer donde aplique:

- `validacion`
- `confirmacion`
- `reserva`
- `Mercado Pago`
- `referencia`
- `PINs despues de confirmar`

## Condiciones de Bloqueo

El sprint NO puede cerrarse como implementado si ocurre cualquiera de estos puntos:

- se pierde `applicationId` entre postulaciones y checkout.
- checkout permite pagar una postulacion ambigua.
- el total financiero no muestra fee separado.
- una pantalla dice o sugiere que el camionero ya recibio dinero.
- una pantalla de exito muestra PINs que no existen.
- una pantalla pendiente empuja a pagar otra vez sin verificar estado.
- una oferta privada muestra datos de marketplace como si fuera publica.
- camionero puede entrar a publicar.
- se cambian APIs de pago sin evidencia.
- se toca wallet/payout/lending.
- mobile tiene overflow horizontal en rutas principales.
- botones primarios quedan fuera de pantalla.
- se ven colores heredados dominantes.

## Criterios de Calidad Premium

Para que este sprint se considere a la altura de `DESING.md`, debe cumplir:

- La pantalla respira.
- El usuario sabe que hacer sin leer instrucciones largas.
- Hay menos botones, no mas.
- El dinero es claro y separado.
- La espera tiene narrativa.
- El fallo tiene salida.
- El exito no exagera.
- El estado actual siempre es visible.
- El siguiente paso siempre es obvio.
- La belleza no tapa la verdad operativa.

## Frases que Debe Provocar

Estas frases son el norte emocional del sprint:

- `Que limpio se siente publicar aqui.`
- `Entiendo el costo exacto.`
- `No me da miedo pagar.`
- `Si queda pendiente, se que esta pasando.`
- `Esto parece hecho para una empresa seria.`
- `No necesito llamar a soporte para entender el estado.`

## Frases que Serian Fracaso

Si un usuario piensa esto, el sprint fallo:

- `No se si ya pague.`
- `No se a quien acepte.`
- `No entiendo por que me cobraron eso.`
- `No se si el camionero ya recibio plata.`
- `No se como reintentar.`
- `La pantalla se ve igual de vieja.`
- `Esto parece una app financiera improvisada.`

## Entregable Final para Implementacion

El equipo que implemente este sprint debe entregar:

- cambios de UI en las 7 rutas declaradas.
- prueba manual completa de publicacion marketplace.
- prueba manual completa de publicacion flota privada.
- prueba manual completa de checkout.
- prueba manual de exitoso/pendiente/fallido.
- screenshots desktop/mobile.
- confirmacion de APIs sin cambios contractuales.
- confirmacion de que no se toco wallet/payout/lending.
- confirmacion de copy financiero revisado.

## Cierre de Alcance

Este sprint queda cerrado con alcance definitivo:

- si el cambio es publicar oferta, entra aqui.
- si el cambio es gestionar oferta y postulaciones, entra aqui.
- si el cambio es pagar una postulacion, entra aqui.
- si el cambio es mostrar exito, pendiente o fallo del pago, entra aqui.
- si el cambio es saldo, retiro, payout o ledger, NO entra aqui.
- si el cambio es tracking vivo, PIN operativo o POD completo, NO entra aqui.
- si el cambio es landing, auth o shell, NO entra aqui.
- si el cambio es marketplace publico de camioneros, NO entra aqui salvo conexion a pago desde postulacion recibida.

## Cierre Documental

Estado documental: `cerrado`.

Razon de cierre:

- todas las rutas del Sprint 37 estan definidas.
- el flujo completo esta cubierto de punta a punta.
- los contratos de datos criticos estan listados.
- los estados de oferta y pago estan normalizados.
- el copy financiero permitido/prohibido esta definido.
- el QA visual, funcional, datos y legal esta definido.
- el no alcance esta blindado.
- la implementacion puede empezar sin preguntar que significa `lujo` en este sprint.

La implementacion posterior debe tratar este archivo como fuente de verdad del Sprint 37.

## Definition of Done

- Sprint documentado y cerrado.
- Alcance final definido para publicar, editar, administrar, pagar y resolver estados de pago.
- Publicar, editar, administrar y pagar tienen lenguaje premium monocromo especificado.
- La empresa entiende en cada paso si esta configurando, pagando o esperando.
- Los montos quedan claros, separados y legibles.
- Los estados de pago no prometen mas que lo que el sistema confirma.
- `offerId`, `applicationId` y referencias de pago deben conservarse en todo el flujo.
- Mercado Pago flow debe permanecer intacto.
- Wallet, payouts y lending quedan fuera.
- Tracking/PIN/POD completo queda fuera salvo copy de confirmacion posterior al pago.
- Desktop y mobile tienen QA visual obligatorio.
- QA funcional, datos y copy financiero quedan definidos.
- El sprint queda cerrado sin invadir 33, 34, 35, 36, 38 o 39.

## Sentencia Final

Sprint 37 queda cerrado como blueprint completo para que KargaX haga que publicar una carga y pagar una reserva se sienta como operar una maquina corporativa de precision: sobria, bella, seria, transparente y confiable.

No se vende humo. Se vende control.
