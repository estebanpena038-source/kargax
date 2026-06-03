# 03 · Tablas, cards y formularios KargaX

## Objetivo

Definir reglas profesionales para tablas, cards, listas, filtros, acciones y formularios en KargaX. Estos patrones aplican a envíos, marketplace, wallet, liquidaciones, usuarios, bodegas, reportes, evidencia, novedades y billing.

## Principio central

En KargaX, cada tabla o formulario representa una operación logística o financiera. La UI debe ayudar a decidir rápido, reducir errores y evitar confusiones entre operación privada, marketplace, wallet y evidencia.

## Tablas: reglas obligatorias

- En desktop pueden mostrarse tablas completas.
- En tablet se deben reducir columnas secundarias.
- En móvil las tablas grandes deben convertirse en cards o listas.
- Nunca ocultar datos críticos: estado, valor, ruta, fecha, responsable, origen, destino o acción principal.
- Las acciones deben agruparse en menú contextual cuando no quepan.
- Las acciones destructivas deben estar separadas visualmente y pedir confirmación.
- Las tablas financieras deben alinear valores numéricos a la derecha.
- Estados deben tener texto + color + señal adicional, no solo color.
- Debe existir empty state cuando no haya datos.
- Debe existir loading state.
- Debe existir error state.
- Debe existir paginación, virtualización o carga incremental cuando haya muchos registros.
- Las tablas no deben producir overflow horizontal global.
- Si hay scroll horizontal interno, debe estar dentro de un contenedor controlado con indicador visual.

## Patrón desktop para tablas

Columnas recomendadas por tipo:

### Envíos privados

- Estado.
- Código/envío.
- Origen.
- Destino.
- Fecha pickup/entrega.
- Conductor/responsable.
- Valor.
- Evidencia.
- Acción.

### Marketplace

- Estado oportunidad.
- Ruta pública.
- Tipo de carga.
- Precio/oferta.
- Fecha.
- Proveedor/conductor.
- Comisión si aplica.
- Acción.

### Wallet y liquidaciones

- Estado.
- Concepto.
- Monto.
- Origen.
- Responsable.
- Fecha.
- Método/comprobante.
- Acción.

### Usuarios y roles

- Nombre.
- Rol.
- Empresa.
- Estado.
- Último acceso.
- Permisos críticos.
- Acción.

## Patrón móvil: cards logísticas

Cada card logística debe mostrar mínimo:

- Estado.
- Origen.
- Destino.
- Fecha.
- Responsable o conductor.
- Valor si aplica.
- Acción principal.
- Acción secundaria en menú.

Ejemplo de estructura:

```tsx
<article className="rounded-2xl border bg-white p-4 shadow-sm">
  <div className="flex items-start justify-between gap-3">
    <div>
      <span className="text-xs font-medium uppercase">En tránsito</span>
      <h3 className="text-base font-semibold">Cali → Bogotá</h3>
    </div>
    <button aria-label="Más acciones">...</button>
  </div>
  <dl className="mt-4 grid gap-2 text-sm">
    <div className="flex justify-between gap-3"><dt>Fecha</dt><dd>03 Jun 2026</dd></div>
    <div className="flex justify-between gap-3"><dt>Responsable</dt><dd>Juan Pérez</dd></div>
    <div className="flex justify-between gap-3"><dt>Valor</dt><dd>$420.000 COP</dd></div>
  </dl>
  <button className="mt-4 min-h-11 w-full">Ver detalle</button>
</article>
```

## Cuándo usar cada patrón

### Tabla

Usar cuando:

- Hay comparación de muchos registros.
- El usuario necesita ordenar, filtrar o exportar.
- Desktop o tablet tienen espacio suficiente.

### Card

Usar cuando:

- Es móvil.
- Cada registro necesita resumen operativo.
- La acción principal importa más que comparar 12 columnas.

### Lista compacta

Usar cuando:

- Son notificaciones, eventos, novedades o actividad reciente.
- Cada item tiene 2-4 datos clave.

### Accordion

Usar cuando:

- Hay filtros largos.
- Hay detalles secundarios por registro.
- Hay secciones de formulario que no deben saturar móvil.

### Tabs

Usar cuando:

- Se separan estados o contextos: `Pendientes`, `En curso`, `Finalizados`.
- No deben reemplazar la navegación principal.

### Filtros plegables

Usar en móvil para:

- Fecha.
- Estado.
- Responsable.
- Tipo de carga.
- Rango de valor.
- Origen/destino.

### Menú contextual

Usar para acciones secundarias:

- Duplicar.
- Descargar.
- Ver historial.
- Cancelar.
- Eliminar.

### Stepper

Usar para formularios largos:

- Solicitar carga.
- Registrar evidencia.
- Crear liquidación.
- Configurar billing.

### Drawer lateral

Usar para:

- Filtros avanzados.
- Detalle rápido.
- Edición ligera.
- No usar para procesos legales/financieros complejos si una página dedicada reduce errores.

### Modal

Usar para:

- Confirmaciones cortas.
- Preview.
- Acciones simples.

### Página dedicada

Usar para:

- Billing.
- Wallet.
- Liquidaciones.
- Evidencia legal.
- Formularios largos con riesgo alto.

## Formularios: reglas obligatorias

- En móvil todos los inputs deben ocupar 100%.
- En desktop usar máximo 2 o 3 columnas según el caso.
- Formularios largos deben dividirse en secciones.
- Cada sección debe tener título claro y descripción corta.
- Campos obligatorios deben indicarse.
- Errores deben mostrarse por campo.
- Botones principales deben estar visibles.
- Botones mínimo 44px de alto.
- No poner demasiados campos en una sola pantalla móvil.
- Usar pasos cuando el flujo sea largo.
- En evidencia digital, foto, firma y PIN deben tener controles grandes y táctiles.
- No usar placeholders como reemplazo de labels.
- Campos financieros deben tener formato claro.
- Campos de fecha/hora deben ser fáciles de usar en móvil.

## Formularios por módulo

### Solicitar carga

Secciones recomendadas:

1. Ruta: origen, destino, dirección, ventanas horarias.
2. Carga: tipo, peso, volumen, paquetes, dimensiones.
3. Servicio: urgencia, vehículo requerido, condiciones.
4. Valor y seguro: valor declarado, costo estimado, forma de pago.
5. Confirmación: resumen y términos.

### Evidencia digital

Flujo móvil recomendado:

1. Verificar ruta/envío.
2. Capturar foto.
3. Capturar firma.
4. Confirmar PIN/POD.
5. Registrar novedad si existe.
6. Enviar evidencia.

### Novedades

- Tipo de novedad.
- Descripción clara.
- Evidencia adjunta.
- Responsable.
- Severidad.
- Acción recomendada.

### Billing y wallet

- Mostrar contexto antes de pedir acción.
- Resumir monto, concepto, responsable y consecuencia.
- Confirmación explícita antes de operaciones destructivas o financieras.
- Marcar `RISK HIGH` en cambios visuales o lógicos.

## Validación y errores

- Cada input debe tener error cerca del campo.
- Mensaje debe explicar qué hacer: `Ingresa un valor mayor a 0`, no `Error`.
- Validaciones financieras deben mostrar formato esperado.
- Fechas deben validar rangos imposibles.
- En carga/evidencia, errores deben decir qué falta para continuar.

## Estados vacíos, loading y error

### Loading

- Usar skeletons en tablas y dashboards.
- Evitar spinners aislados sin contexto.
- Mantener espacio reservado para evitar saltos.

### Empty

Debe incluir:

- Título claro.
- Explicación de por qué no hay datos.
- CTA principal.
- CTA secundaria si aplica.

Ejemplo: `Aún no hay rutas públicas disponibles. Publica una carga o ajusta los filtros.`

### Error

Debe incluir:

- Qué falló.
- Qué puede hacer el usuario.
- Botón de reintentar.
- Contacto/soporte si es crítico.

## Acciones masivas

- Solo desktop/tablet salvo casos muy bien justificados.
- Requieren selección clara.
- Deben mostrar conteo seleccionado.
- Acciones destructivas separadas.
- Confirmación obligatoria si toca pagos, liquidaciones, evidencia o usuarios.

## Acciones destructivas

- No deben estar junto al CTA principal.
- Usar copy explícito: `Cancelar liquidación`, no `Eliminar` si la operación no elimina físicamente.
- Confirmar consecuencias.
- Marcar riesgo alto si afecta wallet, billing, evidencia legal o datos multiempresa.

## Checklist QA

- [ ] En móvil la tabla no causa overflow global.
- [ ] Los datos críticos siguen visibles.
- [ ] Las acciones secundarias están en menú.
- [ ] Los valores financieros están alineados y formateados.
- [ ] Hay loading, empty y error.
- [ ] Los formularios tienen labels visibles.
- [ ] Los errores aparecen por campo.
- [ ] Los botones miden mínimo 44px.
- [ ] El modal de formulario cabe en pantalla.
- [ ] Los filtros funcionan en móvil y desktop.

## Criterio de aceptación

Una vista con tablas, cards o formularios está terminada cuando puede operarse en 320px sin perder información crítica, se entiende en tablet, aprovecha desktop y no mezcla contextos financieros, privados o marketplace.
