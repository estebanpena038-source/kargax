# 05 · Marketplace, wallet, liquidaciones y evidencia

## Objetivo

Estos módulos son los más delicados de KargaX porque mezclan operación logística, dinero, roles, confianza y evidencia legal. La UI debe separar claramente contextos para evitar decisiones equivocadas.

**Riesgo alto:** wallet, billing, liquidaciones, pagos, evidencia legal, RLS, roles/permisos y datos multiempresa.

## Separación visual obligatoria

### Flota privada

Debe sentirse como operación interna de empresa.

- Tono corporativo.
- Enfoque en control interno.
- Rutas propias.
- Conductores propios.
- Evidencia privada.
- Reportes internos.
- Costos internos.
- Copy sugerido: “Control privado”, “Ruta propia”, “Conductor interno”, “Evidencia privada”.

### Marketplace

Debe sentirse como red abierta de oportunidades/cargas.

- Tono más transaccional.
- Enfoque en oportunidades.
- Cargas públicas.
- Ofertas.
- Conductores externos.
- Evidencia marketplace.
- Comisiones/liquidaciones marketplace.
- Copy sugerido: “Ruta pública”, “Oferta marketplace”, “Proveedor externo”, “Evidencia marketplace”.

### Wallet privado

Debe representar costos internos y control de empresa.

- Costos internos.
- Pagos propios.
- Control de empresa.
- Liquidaciones internas.
- Movimientos internos.
- Copy sugerido: “Wallet privado”, “Costo interno”, “Liquidación interna”.

### Wallet marketplace

Debe representar comisiones y pagos a terceros.

- Comisiones.
- Pagos a terceros.
- Saldos marketplace.
- Liquidaciones de conductores/proveedores externos.
- Copy sugerido: “Wallet marketplace”, “Comisión marketplace”, “Pago a tercero”.

## Reglas obligatorias

- Wallet marketplace y wallet privado deben verse separados.
- Evidencia privada y evidencia marketplace no deben confundirse.
- Marketplace no debe parecer parte de flota privada.
- Flota privada debe sentirse como operación interna de empresa.
- Marketplace debe sentirse como red abierta de oportunidades/cargas.
- Los estados logísticos deben usar lenguaje claro y operativo.
- Los CTAs deben depender del rol.
- Los pasos de evidencia deben ser simples en móvil.
- Firma, foto y PIN deben tener UI táctil grande.
- Los errores deben explicar qué hacer.
- Billing y wallet son riesgo alto: cualquier cambio debe revisarse con más cuidado.
- No se debe mezclar lógica financiera entre privado y marketplace.
- No se debe mezclar evidencia de rutas públicas con evidencia privada.
- Los datos financieros deben tener formato claro.
- Las liquidaciones deben mostrar estado, monto, fecha, origen y responsable.

## Marketplace público y rutas públicas

### Card de ruta pública

Debe mostrar:

- Etiqueta “Marketplace”.
- Estado de oportunidad.
- Origen → destino.
- Tipo de carga.
- Fecha.
- Publicador/empresa si aplica.
- Valor/oferta/comisión si aplica.
- CTA por rol.

CTAs por rol:

- Empresa: “Publicar carga”, “Ver ofertas”, “Asignar proveedor”.
- Conductor/proveedor: “Ver detalle”, “Enviar oferta”, “Aceptar ruta” si aplica.
- Admin: “Auditar”, “Revisar actividad”.

### Separación visual

- Usar un header o chip persistente: `Marketplace`.
- No usar iconografía de flota propia.
- No mostrar “mis conductores” si son externos.
- No mezclar reportes internos en la misma card.

## Flota privada y envíos privados

### Card de envío privado

Debe mostrar:

- Etiqueta “Privado” o “Flota privada”.
- Estado.
- Origen → destino.
- Conductor propio/responsable.
- Fecha.
- Evidencia privada.
- Novedades.
- CTA: “Ver envío”, “Cargar evidencia”, “Resolver novedad”.

### Separación visual

- Usar lenguaje de control interno.
- Mostrar bodega, equipo o conductor propio.
- No mezclar ofertas marketplace en la vista principal.

## Wallet privado

### Reglas UI

- Título explícito: `Wallet privado`.
- Subtítulo: “Costos y liquidaciones internas de tu empresa”.
- Mostrar moneda en cada monto.
- Estados con texto: “Pendiente”, “Aprobado”, “Pagado”, “Fallido”, “En revisión”.
- Detalle con fecha, responsable, origen y comprobante.
- Acciones financieras confirmadas.
- No usar copy de banco, ahorro, rendimiento o promesa regulada.

### Mobile

- Monto principal grande.
- Estado debajo del monto.
- Fecha y origen visibles.
- CTA “Ver detalle”.
- Acciones sensibles detrás de confirmación.

## Wallet marketplace

### Reglas UI

- Título explícito: `Wallet marketplace`.
- Subtítulo: “Comisiones, pagos a terceros y liquidaciones marketplace”.
- Etiqueta marketplace visible en cards y detalles.
- Separar comisiones de pagos a proveedor/conductor.
- Mostrar beneficiario externo cuando aplique.
- No mezclar movimientos internos.

### Mobile

- Mostrar `Marketplace` como chip persistente.
- Monto + estado + tercero + ruta pública.
- CTA principal claro.
- Evitar acciones masivas financieras en móvil.

## Liquidaciones

Cada liquidación debe mostrar:

- Estado.
- Monto.
- Fecha.
- Origen.
- Responsable.
- Beneficiario si aplica.
- Tipo: interna o marketplace.
- Comprobante/soporte si aplica.

### Estados sugeridos

- `Borrador`: aún no enviado.
- `Pendiente`: espera revisión o pago.
- `En revisión`: requiere validación interna.
- `Aprobada`: lista para ejecutar.
- `Pagada`: completada.
- `Fallida`: no se pudo completar.
- `Anulada`: cancelada con razón.

### Acciones

- Ver detalle.
- Descargar soporte.
- Aprobar/rechazar si rol permite.
- Reintentar si falló y el sistema lo permite.

Acciones destructivas o financieras requieren confirmación y `RISK HIGH` en QA.

## Billing

Billing es diferente a wallet.

- Billing = plan, suscripción, checkout, límites, Mercado Pago, paywall.
- Wallet = movimientos/liquidaciones operativas.

Reglas:

- No mezclar “pagar suscripción” con “liquidar conductor”.
- Mostrar plan actual y límites.
- Mostrar precio y moneda.
- Usar “Desde” para Enterprise.
- Evitar “ilimitado” salvo contrato y backend.
- Upgrade/downgrade con confirmación clara.
- Errores accionables: “No se pudo abrir checkout”, “Tu uso actual supera el plan menor”.

## Evidencia digital privada

Debe estar ligada a envíos/rutas privadas.

Mínimos:

- Ruta/encomienda identificada.
- Responsable/conductor propio.
- PIN/POD si aplica.
- Foto.
- Firma.
- Novedad.
- Hora y ubicación si aplica.
- Estado de validación.

Copy sugerido:

- “Evidencia privada”.
- “Entrega probada”.
- “Falta foto de entrega”.
- “Firma del receptor requerida”.

## Evidencia digital marketplace

Debe estar ligada a rutas públicas o acuerdos marketplace.

Mínimos:

- Ruta pública identificada.
- Proveedor/conductor externo si aplica.
- PIN/POD.
- Foto/firma.
- Novedad.
- Estado.
- Liquidación marketplace asociada si aplica.

Copy sugerido:

- “Evidencia marketplace”.
- “Soporte de ruta pública”.
- “Validación marketplace pendiente”.

## Flujo móvil de evidencia

El flujo de evidencia en móvil debe ser paso a paso.

### Paso 1 · Confirmar entrega

- Mostrar ruta, destinatario y referencia.
- CTA: “Continuar con evidencia”.

### Paso 2 · PIN/POD

- Input grande.
- Teclado numérico si aplica.
- Error claro: “PIN incorrecto. Verifica el código con el receptor.”

### Paso 3 · Foto

- Área grande para cámara/subida.
- Vista previa.
- Botón “Tomar foto nuevamente”.
- Error: “Falta foto de entrega”.

### Paso 4 · Firma

- Canvas alto y cómodo.
- Botones: “Limpiar firma”, “Guardar firma”.
- Error: “La firma es obligatoria para cerrar esta entrega”.

### Paso 5 · Novedad

- Opción “Sin novedad”.
- Tipos claros.
- Campo descripción si hay novedad.
- Adjuntos si aplica.

### Paso 6 · Confirmar

- Resumen.
- CTA final claro: “Cerrar entrega”.
- Advertencia si no es reversible.

## UI táctil para PIN/foto/firma

- Botones mínimo 44px.
- PIN con caracteres legibles.
- Firma con canvas mínimo 280px alto en móvil si el viewport lo permite.
- Foto con preview clara.
- Controles separados para evitar taps accidentales.
- Confirmaciones con copy específico.

## Estados logísticos recomendados

Usar texto operativo y evitar estados genéricos.

- `Programado`.
- `Asignado`.
- `En cargue`.
- `En tránsito`.
- `En entrega`.
- `Entregado con evidencia`.
- `Entregado con novedad`.
- `Novedad abierta`.
- `En revisión`.
- `Cancelado`.
- `Fallido`.

Cada estado debe tener:

- Label visible.
- Color o estilo.
- Icono/señal secundaria.
- Descripción en tooltip o detalle si hay ambigüedad.

## CTAs por rol

| Rol | CTAs principales | Evitar |
|---|---|---|
| Admin | Crear envío, aprobar liquidación, revisar evidencia, configurar roles. | Acciones sin confirmación en wallet/billing. |
| Operador | Asignar conductor, resolver novedad, cargar evidencia. | Ver acciones financieras si no tiene permiso. |
| Finanzas | Revisar wallet, aprobar liquidación, ver billing. | Mezclar rutas marketplace sin contexto financiero. |
| Conductor privado | Ver ruta, iniciar entrega, cargar evidencia, reportar novedad. | Ver wallet marketplace o billing. |
| Marketplace externo | Ver ruta pública, enviar oferta, cargar evidencia marketplace. | Ver flota privada o evidencia privada. |

## Errores accionables

Mal:

> Error.

Bien:

> No pudimos guardar la evidencia. Revisa tu conexión y vuelve a intentarlo. La ruta sigue abierta.

Mal:

> Pago fallido.

Bien:

> No se pudo completar la liquidación. Verifica el método de pago o marca el caso para revisión financiera.

## Checklist de riesgo alto

- [ ] El título diferencia privado vs marketplace.
- [ ] Wallet privado y wallet marketplace no comparten vista sin labels persistentes.
- [ ] Evidencia privada y marketplace no comparten flujo sin contexto visible.
- [ ] Billing no se mezcla con wallet.
- [ ] Montos tienen moneda y signo.
- [ ] Liquidaciones muestran estado, monto, fecha, origen y responsable.
- [ ] Acciones financieras tienen confirmación.
- [ ] Roles limitan CTAs visibles.
- [ ] No se oculta información crítica en móvil.
- [ ] Errores explican qué hacer.
- [ ] Cambios en wallet/billing/evidencia se marcan `RISK HIGH`.
