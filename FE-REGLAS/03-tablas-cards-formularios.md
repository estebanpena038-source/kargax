# 03 · Tablas, cards y formularios

## Objetivo

KargaX opera datos densos: envíos, rutas, conductores, bodegas, ofertas, evidencias, pagos, liquidaciones y usuarios. La UI debe permitir tomar decisiones rápidas sin romperse en móvil.

Regla base: **desktop puede usar tablas completas; móvil debe priorizar cards/listas operativas**.

## Jerarquía de datos crítica

En cualquier tabla/card logística, estos datos nunca deben desaparecer sin alternativa visible:

1. Estado.
2. Origen.
3. Destino.
4. Fecha/hora.
5. Responsable/conductor/empresa.
6. Valor/monto si aplica.
7. Acción principal.
8. Identificador o referencia cuando sea necesario para soporte.

## Reglas para tablas

### Desktop

- Tablas completas permitidas.
- Encabezado sticky si hay scroll vertical dentro del panel.
- Columnas numéricas alineadas a la derecha.
- Fechas y estados con formato consistente.
- Acciones principales visibles; acciones secundarias en dropdown.
- Acciones destructivas separadas y confirmadas.
- Filtros arriba o en panel lateral, no mezclados con encabezados.
- Paginación o carga incremental si hay muchos registros.
- Scroll horizontal solo dentro de `.kx-table-shell`.

### Tablet

- Reducir columnas secundarias.
- Mantener: estado, ruta/resumen, fecha, responsable, valor, acción.
- Mover columnas opcionales a detalle expandible o drawer.
- Usar density compact sin bajar texto de 14px.
- Acciones secundarias en menú contextual.

### Móvil

- Tablas grandes deben convertirse en cards/listas.
- No usar tablas con 8 columnas apretadas.
- Si una tabla financiera requiere comparación tabular, usar scroll interno controlado + sombra/indicador.
- Cada card debe tener CTA principal claro.
- Las acciones secundarias van en menú contextual.
- No ocultar estado, ruta, fecha, responsable o valor.

## Contenedor de tabla seguro

```tsx
<div className="kx-table-shell" aria-label="Tabla de envíos privados">
  <table>
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>
```

```css
.kx-table-shell {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.kx-table-shell::after {
  content: "";
  position: sticky;
  right: 0;
  display: block;
  width: 1px;
}

.kx-table-shell table {
  width: 100%;
  min-width: max-content;
}

.kx-table-shell th,
.kx-table-shell td {
  white-space: nowrap;
}

.kx-table-shell td[data-column="descripcion"],
.kx-table-shell td[data-column="ruta"] {
  white-space: normal;
  min-width: 16rem;
  max-width: 28rem;
}
```

## Tablas por módulo

### Envíos privados

Columnas desktop recomendadas:

- Estado.
- ID / referencia.
- Origen.
- Destino.
- Fecha programada.
- Conductor/responsable.
- Evidencia.
- Novedades.
- Valor/costo si aplica.
- Acción.

Móvil: card con estado, origen → destino, fecha, conductor, evidencia/novedad y CTA “Ver envío”.

### Marketplace

Columnas desktop:

- Estado oportunidad.
- Ruta pública.
- Tipo de carga.
- Fecha.
- Empresa/publicador.
- Oferta actual.
- Comisión si aplica.
- Acción.

Móvil: card de oportunidad con CTA “Ver oferta” o “Aplicar”. Debe sentirse marketplace, no flota privada.

### Wallet privado

Columnas desktop:

- Estado.
- Movimiento.
- Monto.
- Fecha.
- Origen.
- Responsable.
- Comprobante.
- Acción.

Móvil: card financiera con monto grande, estado textual, fecha, origen y detalle. Alto riesgo: no ocultar signo, moneda ni estado.

### Wallet marketplace

Columnas desktop:

- Estado.
- Comisión/pago a tercero.
- Monto.
- Tercero/conductor/proveedor.
- Ruta pública.
- Fecha.
- Liquidación.
- Acción.

Móvil: card con etiqueta “Marketplace” visible.

### Liquidaciones

Columnas desktop:

- Estado.
- Monto.
- Fecha.
- Origen.
- Responsable.
- Beneficiario.
- Comprobante.
- Acción.

Móvil: card con monto, estado, fecha, responsable, origen y CTA “Ver liquidación”.

### Usuarios y roles

Columnas desktop:

- Usuario.
- Rol.
- Empresa/tenant si aplica.
- Estado.
- Último acceso.
- Permisos clave.
- Acción.

Móvil: lista compacta con nombre, rol, estado y menú.

### Bodegas

Columnas desktop:

- Bodega.
- Ciudad.
- Capacidad/ocupación.
- Responsable.
- Estado.
- Última actividad.
- Acción.

Móvil: card con bodega, ciudad, ocupación y CTA.

### Reportes

Reportes densos pueden tener tablas, pero deben ofrecer:

- Filtros claros.
- Exportación si aplica.
- Resumen KPI antes de la tabla.
- Scroll interno controlado.
- Alineación numérica.

## Estados obligatorios para tablas

### Loading

- Skeleton de filas o cards.
- Mantener altura aproximada para evitar saltos de layout.
- No mostrar tabla vacía con spinner pequeño perdido.

### Empty

Debe explicar:

- Qué no hay.
- Por qué podría estar vacío.
- Qué puede hacer el usuario.

Ejemplo:

> No hay envíos privados para este filtro. Cambia el rango de fechas o crea un nuevo envío.

### Error

Debe explicar:

- Qué falló.
- Si puede reintentar.
- Qué acción tomar.

Ejemplo:

> No pudimos cargar las liquidaciones. Revisa tu conexión o intenta nuevamente. Si el problema continúa, contacta soporte.

## Cards móviles logísticas

Cada card logística debe mostrar mínimo:

- Estado.
- Origen.
- Destino.
- Fecha.
- Responsable o conductor.
- Valor si aplica.
- Acción principal.
- Acción secundaria en menú.

### Patrón de card móvil

```tsx
<article className="kx-mobile-logistics-card" aria-label="Envío KGX-123">
  <header className="kx-card-header">
    <StatusBadge status={shipment.status} label="En tránsito" />
    <span className="kx-card-id">KGX-123</span>
  </header>

  <div className="kx-route-summary">
    <strong>Bogotá</strong>
    <span aria-hidden="true">→</span>
    <strong>Medellín</strong>
  </div>

  <dl className="kx-card-meta">
    <div><dt>Fecha</dt><dd>12 jun · 08:00</dd></div>
    <div><dt>Conductor</dt><dd>Laura Peña</dd></div>
    <div><dt>Valor</dt><dd>$480.000 COP</dd></div>
  </dl>

  <footer className="kx-card-actions">
    <button className="kx-primary-action">Ver envío</button>
    <ContextMenu />
  </footer>
</article>
```

```css
.kx-mobile-logistics-card {
  display: grid;
  gap: 0.875rem;
  padding: 1rem;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.kx-card-header,
.kx-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.kx-route-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  font-size: clamp(1rem, 4vw, 1.125rem);
}

.kx-card-meta {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
}
```

## Formularios

### Reglas obligatorias

- En móvil, todos los inputs ocupan `100%`.
- En desktop, usar máximo 2 o 3 columnas según el caso.
- Formularios largos deben dividirse en secciones.
- Cada sección debe tener título claro.
- Campos obligatorios indicados con texto, no solo asterisco sin explicación.
- Errores por campo, cerca del input.
- Botones principales visibles y con mínimo 44px de alto.
- No poner demasiados campos en una sola pantalla móvil.
- Usar pasos cuando el flujo sea largo.
- En evidencia digital, foto, firma y PIN deben tener controles grandes y táctiles.
- No usar placeholders como reemplazo de labels.
- Campos financieros con moneda, separadores y signo claro.
- Fecha/hora con controles fáciles de usar en móvil.

## Formularios por tipo

### Formulario de carga/envío

Secciones sugeridas:

1. Ruta: origen, destino, puntos intermedios.
2. Carga: tipo, peso, volumen, restricciones.
3. Programación: fecha, hora, ventana de entrega.
4. Responsable: conductor, contacto, empresa.
5. Costos: tarifa, moneda, condiciones.
6. Evidencia requerida: PIN, foto, firma, POD.
7. Revisión y confirmación.

Móvil: stepper si hay más de 8-10 campos.

### Formulario de evidencia

Secciones/pasos:

1. Confirmar ruta/envío.
2. PIN/POD.
3. Foto.
4. Firma.
5. Novedad si aplica.
6. Confirmación final.

Reglas:

- Botones grandes.
- Cámara/foto con área clara.
- Firma con canvas alto y controles visibles.
- PIN con input grande y teclado numérico.
- Mensajes exactos: “Falta foto de entrega”, “PIN incorrecto”, “Firma obligatoria”.

### Formulario de novedades

- Tipo de novedad.
- Descripción.
- Evidencia adjunta.
- Severidad.
- Responsable.
- Próxima acción.

Móvil: no mostrar campos administrativos avanzados de entrada; permitir “Más detalles” expandible.

### Formulario de billing

Riesgo alto.

- Mostrar plan actual.
- Mostrar límite afectado.
- Mostrar precio y moneda.
- Mostrar próximo cobro o condición.
- Confirmar acciones de upgrade/downgrade.
- No usar copy ambiguo como “activar” si implica pago.
- Validar estados de loading/error del checkout.

## Filtros y buscadores

### Desktop

- Filtros visibles arriba de tabla o en sidebar derecho.
- Grids de filtros con `auto-fit`.
- Botón “Limpiar filtros” visible.
- Filtros activos como chips removibles.

### Móvil

- Filtros plegables en drawer/bottom sheet.
- Mostrar chips de filtros activos sobre la lista.
- Búsqueda principal visible si es flujo frecuente.
- No ocupar 60% de pantalla con filtros permanentes.

## Acciones masivas

- Solo desktop/tablet grande si la selección múltiple es usable.
- En móvil, acciones masivas deben ser excepcionales y confirmadas.
- Mostrar contador: “3 envíos seleccionados”.
- Separar acciones destructivas.
- Riesgo alto para wallet, liquidaciones, billing y evidencia.

## Acciones destructivas

- Nunca junto a CTA principal sin separación.
- Confirmación accesible.
- Copy específico: “Eliminar ruta pública” no “Eliminar”.
- En procesos financieros o legales, foco inicial en la acción menos destructiva.
- Registrar riesgo y prueba manual.

## Cuándo usar cada patrón

| Patrón | Usar cuando | Evitar cuando |
|---|---|---|
| Tabla | Hay comparación de muchos registros en desktop. | Móvil con muchas columnas. |
| Card | Hay entidad logística con resumen y CTA. | Se necesita comparar 20 columnas. |
| Lista compacta | Usuario escanea items simples. | Hay datos financieros críticos sin contexto. |
| Accordion | Hay secciones opcionales o detalles secundarios. | El contenido crítico quedaría oculto. |
| Tabs | Hay contextos hermanos claros. | Marketplace/privado podrían confundirse. |
| Filtros plegables | Móvil o filtros extensos. | Desktop con espacio suficiente y filtros críticos. |
| Menú contextual | Acciones secundarias. | CTA principal o acción frecuente. |
| Stepper | Formulario largo/secuencial. | Formulario corto de 3-5 campos. |
| Drawer lateral | Edición contextual sin salir de página. | Flujos financieros críticos que requieren revisión completa. |
| Modal | Confirmación o tarea corta. | Formularios largos o contenido que excede móvil. |
| Página dedicada | Flujos largos, billing, wallet, evidencia legal. | Confirmaciones simples. |

## Checklist rápido

- [ ] Tabla desktop tiene columnas legibles.
- [ ] Tablet conserva datos críticos.
- [ ] Móvil usa cards/listas o scroll interno controlado.
- [ ] No hay overflow global.
- [ ] Valores financieros alineados y con moneda.
- [ ] Estado usa texto + señal visual.
- [ ] Loading, empty y error existen.
- [ ] Acciones destructivas separadas.
- [ ] Inputs 100% en móvil.
- [ ] Labels visibles.
- [ ] Errores por campo.
- [ ] Botones 44px mínimo.
- [ ] Evidencia tiene controles táctiles grandes.
