# 05 · Marketplace, wallet y evidencia KargaX

## Objetivo

Definir reglas específicas para los módulos más delicados de KargaX: marketplace, flota privada, wallet, liquidaciones, billing y evidencia digital. Estos módulos deben verse separados, claros y seguros para evitar errores operativos, financieros o legales.

## Riesgo alto obligatorio

Todo cambio en estos módulos debe marcarse como `RISK HIGH` si afecta:

- Wallet privado.
- Wallet marketplace.
- Liquidaciones.
- Billing.
- Mercado Pago.
- Evidencia legal.
- PIN/POD.
- Foto/firma.
- Roles/permisos.
- RLS.
- Datos multiempresa.
- Datos financieros.

## Separaciones visuales obligatorias

- Wallet marketplace y wallet privado deben verse separados.
- Evidencia privada y evidencia marketplace no deben confundirse.
- Marketplace no debe parecer parte de flota privada.
- Flota privada debe sentirse como operación interna de empresa.
- Marketplace debe sentirse como red abierta de oportunidades/cargas.
- No se debe mezclar lógica financiera entre privado y marketplace.
- No se debe mezclar evidencia de rutas públicas con evidencia privada.

## Flota privada

### Tono visual

- Más corporativo.
- Enfoque en control interno.
- Rutas propias.
- Conductores propios.
- Evidencia privada.
- Reportes internos.

### Datos prioritarios

- Estado de ruta.
- Vehículo/conductor propio.
- Origen/destino.
- ETA.
- Evidencia pendiente.
- Novedad abierta.
- Costo interno.

### CTAs por rol

- Empresa admin: crear envío, asignar conductor, ver evidencia, cerrar ruta.
- Operador: actualizar estado, registrar novedad, validar evidencia.
- Conductor privado: iniciar ruta, cargar evidencia, reportar novedad.

## Marketplace

### Tono visual

- Más transaccional.
- Enfoque en oportunidades.
- Cargas públicas.
- Ofertas.
- Conductores/proveedores externos.
- Evidencia marketplace.
- Comisiones/liquidaciones marketplace.

### Datos prioritarios

- Estado de oportunidad.
- Ruta pública.
- Tipo de carga.
- Precio estimado/oferta.
- Comisión si aplica.
- Tiempo restante.
- Responsable externo.

### CTAs por rol

- Empresa: publicar carga, revisar ofertas, aceptar propuesta.
- Conductor/proveedor: ofertar, aceptar ruta, subir evidencia marketplace.
- Admin KargaX: monitorear comisión, validar liquidación, revisar disputa.

## Wallet privado

### Debe representar

- Costos internos.
- Pagos propios.
- Control financiero de empresa.
- Liquidaciones internas.

### UI obligatoria

- Título explícito: `Wallet privado`.
- Subtítulo: `Control financiero interno de tu empresa`.
- Separar saldo, costos, pagos y liquidaciones.
- Valores alineados y formateados.
- Estados con texto claro.
- Historial con origen y responsable.

## Wallet marketplace

### Debe representar

- Comisiones.
- Pagos a terceros.
- Saldos marketplace.
- Liquidaciones de conductores/proveedores.

### UI obligatoria

- Título explícito: `Wallet marketplace`.
- Subtítulo: `Comisiones, pagos a terceros y liquidaciones externas`.
- Mostrar comisiones separadas de pagos.
- Mostrar responsable externo cuando aplique.
- Mostrar estado de liquidación.
- Confirmar acciones sensibles.

## Liquidaciones

Cada liquidación debe mostrar:

- Estado.
- Monto.
- Fecha.
- Origen.
- Responsable.
- Tipo: privado o marketplace.
- Comprobante si existe.
- Acción principal.

### Estados recomendados

- Borrador.
- Pendiente de revisión.
- Aprobada.
- Pagada.
- Rechazada.
- En disputa.
- Error de pago.

Nunca usar solo color para estados financieros.

## Billing

Billing debe ser una experiencia de confianza, no una pantalla confusa.

Debe mostrar:

- Plan actual.
- Precio.
- Periodicidad.
- Límites.
- Uso actual.
- Próximo cobro.
- Estado de pago.
- Acción de upgrade/downgrade/cancelación.

Cambios de plan deben confirmar:

- Nuevo precio.
- Fecha de efecto.
- Diferencia de límites.
- Consecuencia operacional.

## Evidencia digital privada

### Uso

Rutas internas, flota propia, conductores propios y operación privada de la empresa.

### Debe mostrar

- Envío/ruta privada.
- Conductor propio.
- Estado de entrega.
- PIN/POD.
- Foto.
- Firma.
- Novedades.
- Fecha/hora.
- Ubicación si aplica.

## Evidencia digital marketplace

### Uso

Rutas públicas, cargas marketplace, conductores/proveedores externos.

### Debe mostrar

- Ruta pública/oferta.
- Conductor o proveedor externo.
- Estado de entrega.
- Evidencia marketplace.
- Comisiones/liquidación relacionada si aplica.
- Disputas o revisión si aplica.

## PIN/POD, foto y firma

### Reglas obligatorias móvil

- Flujo paso a paso.
- No mostrar demasiados campos a la vez.
- Foto, firma y PIN deben ocupar espacio cómodo.
- Confirmaciones claras.
- Errores deben decir exactamente qué falta.
- CTAs grandes y fáciles de tocar.
- Botón principal fijo al fondo solo si no tapa contenido.
- Firma con área táctil grande.
- PIN con inputs grandes o teclado numérico.
- Foto con preview y botón de reemplazo.

### Errores recomendados

- `Falta capturar la firma del receptor.`
- `El PIN ingresado no coincide con el POD de esta ruta.`
- `La foto no se pudo subir. Revisa conexión e intenta de nuevo.`
- `Esta evidencia pertenece a marketplace, no a flota privada.`

## Novedades

Cada novedad debe incluir:

- Tipo.
- Severidad.
- Descripción.
- Ruta/envío.
- Responsable.
- Evidencia adjunta.
- Estado.
- Próxima acción.

Estados:

- Abierta.
- En revisión.
- Resuelta.
- Escalada.
- Cerrada.

## Tracking y estados logísticos

Lenguaje recomendado:

- Borrador.
- Programado.
- Asignado.
- En recogida.
- En tránsito.
- En entrega.
- Entregado.
- Evidencia pendiente.
- Con novedad.
- Cancelado.

Cada estado debe incluir descripción corta si afecta operación.

## Mobile-first para flujos delicados

### Evidencia

1. Resumen de ruta.
2. Estado actual.
3. Paso activo.
4. Acción táctil.
5. Confirmación.
6. Resultado.

### Wallet/liquidación

1. Contexto financiero.
2. Monto.
3. Responsable.
4. Tipo de wallet.
5. Consecuencia.
6. Confirmación.

### Marketplace

1. Oportunidad.
2. Ruta.
3. Valor/oferta.
4. Requisitos.
5. CTA.

## Checklist QA de módulos delicados

- [ ] Wallet privado y marketplace tienen títulos distintos.
- [ ] Evidencia privada y marketplace tienen títulos distintos.
- [ ] Marketplace no aparece dentro de operación privada sin separación.
- [ ] Los datos financieros están formateados.
- [ ] Las acciones financieras tienen confirmación.
- [ ] PIN/foto/firma son táctiles en móvil.
- [ ] Errores explican qué falta.
- [ ] Estados usan texto, no solo color.
- [ ] Liquidaciones muestran estado, monto, fecha, origen y responsable.
- [ ] Billing muestra precio, plan, límites y consecuencia.
- [ ] No hay overflow horizontal en 320px.
- [ ] Se marca `RISK HIGH` si toca pagos, roles, RLS o datos multiempresa.

## Criterio de aceptación

Estos módulos están listos cuando un usuario puede distinguir en menos de 3 segundos si está en privado, marketplace, wallet privado, wallet marketplace, evidencia privada o evidencia marketplace, y puede operar sin riesgo de confundir pagos, evidencia o rutas.
