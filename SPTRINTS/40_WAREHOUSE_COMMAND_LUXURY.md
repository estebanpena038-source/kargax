# Sprint 40: Warehouse Command Luxury

## Estado

- artifact status: `completed`
- prioridad: alta
- cierre: implementado y verificado sin build por instruccion del owner
- rutas cerradas: `/bodegas`, `/bodegas/[id]`, `/bodegas/[id]/analitica`, `/bodegas/[id]/citas`, `/bodegas/[id]/muelles`

## Objetivo Cerrado

Convertir bodegas en una sala de control premium: orden, simetria, datos respirando y decisiones rapidas. La empresa debe sentir que domina su operacion fisica desde una interfaz serena, monocroma y escaneable.

El sprint queda cerrado como **Warehouse Command Luxury**: no entra en ejecucion profunda de inventario, recepciones, picking, despachos ni incidentes porque eso pertenece al Sprint 41. Este sprint deja la capa de mando, agenda, muelles, analitica y resumen ejecutivo lista.

## Principios De Diseño Aplicados

- Monocromo real: negro mate, blanco, zinc y bordes. No se depende de verde, naranja, rojo o azul para comunicar estado.
- Lujo por ausencia de friccion: menos ruido, mas jerarquia, menos explicacion visible.
- Datos con aire: metricas en mono font, tarjetas respiradas, grids estables y copy corto.
- Control emocional: la pantalla dice que hacer sin abrumar.
- Riesgo visible: incidentes criticos y estados operativos no se esconden por estetica.
- Formularios sobrios: dialog o seccion clara, campos agrupados, textarea limpio, CTA unico.

## Implementacion

### Shell Comun De Bodega

Archivo: `frontend/src/components/warehouses/WarehouseWorkspace.tsx`

- Header convertido en comando premium negro mate con:
  - codigo KX Command
  - nombre de bodega
  - ubicacion
  - flujo operativo
  - plan
  - estado
  - stock
- KPIs superiores redisenados como modulos sobrios:
  - agenda activa
  - muelles libres
  - tareas abiertas
  - riesgos abiertos
- Navegacion interna convertida a tabs horizontales monocromos con overflow controlado.
- `MetricCard` redisenado:
  - mono font en valores
  - icono en caja neutra
  - descripcion opcional
  - compatibilidad con llamadas antiguas que pasan `accent`

### `/bodegas`

Archivo: `frontend/src/app/bodegas/page.tsx`

- Hero reemplazado por sala de control blanca/negra:
  - KX Warehouse Command
  - estado del plan
  - uso activo del limite SaaS
  - pais detectado del usuario
- Cards de resumen:
  - activas
  - mantenimiento
  - archivadas
- Lista de bodegas premium:
  - codigo en mono
  - nombre
  - ciudad/departamento
  - direccion
  - modo operativo
  - estado textual
  - descripcion operativa
- CTA de crear bodega:
  - visible solo si owner/admin puede gestionar
  - bloqueado si limite del plan esta alcanzado
  - alternativa a planes cuando no hay capacidad
- Crear/editar bodega movido a dialog monocromo:
  - pais
  - codigo
  - nombre
  - departamento/provincia/estado
  - ciudad
  - direccion
  - modo operativo
  - estado en edicion
  - descripcion operativa
- Paywall intacto:
  - `PlanLimitPaywallDialog`
  - `isPlanLimitReachedError`
  - limites activos del backend
- Permisos intactos:
  - trucker ve empty state
  - owner/admin gestionan
  - no owner/admin ve sello de solo owner/admin

### `/bodegas/[id]`

Archivo: `frontend/src/app/bodegas/[id]/page.tsx`

- Resumen operativo convertido en tablero ejecutivo:
  - proximas citas
  - recepciones
  - despachos
  - riesgos abiertos
- Agenda inmediata:
  - citas vivas ordenadas por fecha
  - tipo
  - fecha inicio/fin
  - responsable
  - placa
  - muelle
  - estado textual
- Pulso operativo:
  - stock total
  - saldos registrados
  - siguiente decision recomendada
- Recepciones recientes:
  - numero
  - fecha
  - estado textual
- Despachos recientes:
  - numero
  - fecha
  - estado textual
- Riesgo e incidentes:
  - solo incidentes abiertos/no resueltos
  - severidad textual
  - estado textual
  - empty state sobrio cuando no hay riesgo
- QA visual:
  - no renderiza cards vacias sin sentido
  - cada ausencia tiene empty state discreto y util

### `/bodegas/[id]/analitica`

Archivo: `frontend/src/app/bodegas/[id]/analitica/page.tsx`

- Metricas con mono font:
  - citas completadas
  - citas pendientes
  - criticos abiertos
  - unidades despachadas
- Lectura de negocio breve:
  - prioriza riesgo critico
  - agenda viva
  - estado sereno si no hay friccion
- Grafica monocroma:
  - cumplimiento de citas
  - muelles disponibles
  - despacho listo
  - riesgo cerrado
- Datos derivados:
  - porcentajes clamp 0-100
  - divisiones protegidas cuando no hay datos
  - conteos derivados de arrays reales
- Pulso comercial:
  - recepciones
  - tareas abiertas
  - stock total
  - muelles
- Senales que importan:
  - puntualidad
  - capacidad
  - riesgo

### `/bodegas/[id]/citas`

Archivo: `frontend/src/app/bodegas/[id]/citas/page.tsx`

- Formulario de crear cita refinado:
  - tipo
  - muelle
  - inicio
  - fin
  - viaje vinculado opcional
  - placa
  - conductor
  - contacto de bodega
  - telefonos andinos
  - notas operativas
- Agenda viva:
  - lista/calendario operacional
  - status como texto y borde
  - responsable
  - placa
  - muelle
  - fecha inicio/fin
- Acciones de estado intactas:
  - scheduled -> checked_in/cancelled
  - checked_in -> in_progress/completed/cancelled
  - in_progress -> completed/cancelled
- Historico sobrio:
  - ultimas cerradas/canceladas
  - estado textual
- QA funcional:
  - `createAppointment`
  - `updateAppointment`
  - `offerId` opcional preservado para citas creadas desde flujo de pago/viaje
  - permisos `manageAppointments` respetados

### `/bodegas/[id]/muelles`

Archivo: `frontend/src/app/bodegas/[id]/muelles/page.tsx`

- Resumen superior:
  - disponibles
  - ocupados
  - mantenimiento
- Crear muelle:
  - codigo
  - nombre
  - tipo
  - switch de principal
  - CTA unico
  - permisos `manageDocks` respetados
- Mapa/grid de muelles:
  - grid estable `auto-fit/minmax`
  - minimo alto para evitar saltos
  - estado por borde, peso y texto
  - disponible con borde fuerte
  - mantenimiento con borde dashed
  - ocupado con borde neutro
  - principal/secundario textual
- QA visual:
  - responsive sin overflow intencional
  - no se usa color como unica senal

## QA Ejecutado

- `npm run typecheck`
  - resultado: OK
- `npx eslint src\components\warehouses\WarehouseWorkspace.tsx src\app\bodegas\page.tsx "src\app\bodegas\[id]\page.tsx" "src\app\bodegas\[id]\analitica\page.tsx" "src\app\bodegas\[id]\citas\page.tsx" "src\app\bodegas\[id]\muelles\page.tsx"`
  - resultado: OK
- `npm run build`
  - no ejecutado al cierre final por instruccion del owner
  - intento previo abortado/omitido para que el owner haga build general

## Riesgos Controlados

- Permisos SaaS:
  - owner/admin se conservan
  - trucker no accede a gestion de bodegas
  - capacidades `manageAppointments` y `manageDocks` se respetan
- Limites de plan:
  - crear bodega se bloquea si el limite activo esta alcanzado
  - paywall se mantiene
  - bodegas archivadas conservan historial
- Datos:
  - no se inventan KPIs fuera del backend actual
  - las metricas derivan de `appointments`, `docks`, `stock`, `receipts`, `dispatches`, `tasks`, `incidents`
  - porcentajes protegidos contra arrays vacios
- UX:
  - no hay dependencia exclusiva de color
  - estados aparecen como texto
  - empty states no generan ruido

## Definition Of Done

- Comando de bodega monocromo y escaneable: `done`
- Formularios no abruman: `done`
- Permisos y limites SaaS intactos: `done`
- Analitica con datos derivados correctos: `done`
- Citas pickup/delivery con `offerId` opcional preservado: `done`
- Muelles responsive sin overflow intencional: `done`
- Sprint cerrado sin invadir Sprint 41: `done`
