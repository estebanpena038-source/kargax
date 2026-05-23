# CERRADO - Sprint 35: App Shell + Personal Luxury

## Estado

- artifact status: `completed`
- prioridad: maxima para coherencia diaria
- owner: Frontend + Founder Design
- rutas cubiertas: `DashboardLayout`, `/dashboard`, `/perfil`, `/configuracion`, `/notificaciones`, `/mensajes`, `/onboarding`
- frontera respetada: no se tocaron flujos de Sprint 34, 36, 37 ni APIs/stores de negocio

## Objetivo

La app autenticada de KargaX ya se siente como una cabina premium: control inmediato, poco ruido, acciones claras, jerarquia sobria y experiencia diaria en blanco/negro mate. El usuario debe sentir que esta operando un sistema serio, preciso y caro, no una plantilla generica.

## Implementado

### `DashboardLayout`

- Sidebar y drawer mobile conservan logo `KX`:
  - lockup expandido
  - mark colapsado
  - logo visible en mobile header y drawer
- Badges de navegacion convertidos a monocromo:
  - contador negro mate con texto blanco
  - punto negro en sidebar colapsado
  - sin rojo heredado para unread
- Logout y hover states pasan a grises/negro, sin alertas de color.
- Se conserva:
  - persistencia de sidebar colapsado en `localStorage`
  - selector de bodega solo cuando aporta valor
  - rutas protegidas, redirect y logout existentes
  - filtros de navegacion por rol, permisos, bodega y CEO access

### `/dashboard`

- Para camionero:
  - titulo de pagina mantiene `Ofertas para transportar`
  - se agrego franja compacta de metricas:
    - Disponibles
    - Postulaciones
    - Viajes
    - Score
  - tarjetas de oferta migradas a blanco/negro:
    - borde superior negro
    - ruta en panel respirado
    - monto con `font-money`
    - estado postulado con borde negro
  - buscador, filtros, skeleton, empty state y error pasan a monocromo.
- Para empresa:
  - hero negro mate con estado operativo.
  - plan actual en modulo sobrio con `font-money`.
  - stats empresariales en cards limpias:
    - Ofertas publicadas
    - Ofertas activas
    - Postulaciones recibidas
    - Bodegas activas
  - accesos rapidos sin color heredado.
- Se conserva:
  - redirect de business/admin a experiencia empresarial
  - fetch de ofertas y acceso a bodegas
  - filtros y navegacion a detalle de oferta

### `/perfil`

- Hero personal convertido a negro mate, sin orbes ni gradientes.
- Avatar monocromo con iniciales.
- Badges de rol/verificacion sobrios.
- Formulario de datos personales mantiene:
  - `updateUserProfile`
  - `fetchProfile`
  - `AndeanPhoneInput`
- Estado de cuenta organizado en filas limpias:
  - correo
  - tipo de cuenta
  - autenticacion
- Score camionero se mantiene como sello sobrio cuando aplica.
- Se removio copy de "KargaX Pro" como promesa visual innecesaria.

### `/configuracion`

- Hero de configuracion en negro mate.
- Tabs corregidos a lo pedido:
  - Cuenta
  - Preferencias
  - Seguridad
  - Notificaciones
- Toggles monocromos desde `Switch`.
- Iconos de settings en negro mate.
- Paleta KargaX corregida:
  - blanco
  - gris claro
  - gris medio
  - negro mate
- Se elimino la paleta antigua verde/naranja y la referencia a Amazon.
- Seguridad, sesiones, idioma y zona horaria quedan en cards limpias.
- Se conserva estado local de switches y tabs sin tocar APIs.

### `/notificaciones`

- Bandeja limpia en card blanca con cabecera sobria.
- Filtros superiores implementados:
  - Todas
  - Viajes
  - Pagos
  - Equipo
  - Sistema
- Conteos por categoria calculados desde el store actual.
- Unread con punto negro, no color.
- Accion masiva `Marcar todas` mantiene `markAllAsRead`.
- Items con icono monocromo, timestamp, accion `Marcar como leida` y navegacion existente.
- Empty state premium con icono, borde y copy calmado.
- Se conserva:
  - `fetchNotifications`
  - `markAsRead`
  - rutas por tipo de notificacion

### `/mensajes`

- Shell de mensajes en panel blanco con borde, sombra sobria y layout estable.
- Desktop:
  - lista izquierda
  - conversacion derecha
  - divisor monocromo
- Mobile:
  - lista -> conversacion mediante estado existente
  - input no tapa mensajes
- `ConversationsList`:
  - item activo negro
  - badges unread monocromos
  - avatar y online indicator sobrios
  - empty/loading/search states monocromos
- `ChatArea`:
  - header limpio
  - contexto de carga en badge monocromo
  - skeletons sin color heredado
- `MessageBubble`:
  - mensajes propios negros
  - mensajes recibidos blancos con borde
  - adjuntos y system messages en grises
- `MessageInput`:
  - input texto limpio
  - boton enviar negro
  - contador limite monocromo
  - se retiro picker de emojis para reducir ruido en release operativo
- `MessageNotifications`:
  - toast interno blanco/negro, sin gradientes

### `/onboarding`

- Pantalla convertida en ritual privado premium:
  - fondo negro mate
  - logo KX arriba
  - badge sobrio por tipo de cuenta
  - card blanca central para formulario
- Pasos monocromos:
  - Empresa / Ubicacion / Contacto
  - Vehiculo / Licencia / Contacto
- CTA mobile sticky:
  - `Guardar y continuar`
  - visible al fondo del formulario
- Estados de exito/loading en negro/blanco.
- Se conserva:
  - auth guard
  - validaciones por paso
  - `validateAndeanPhoneValue`
  - Supabase updates de business/trucker profile
  - `onboarding_completed`
  - sync de flota corporativa para trucker
- Copy ajustado para no prometer features fuera de estado operativo.

## QA ejecutado

- `rg` sobre archivos del Sprint 35 para confirmar ausencia de:
  - verdes/naranjas/azules/violetas/rojos heredados
  - gradientes/radiales de marca antigua
  - `rounded-2xl` en rutas del sprint
  - caracteres mojibake en archivos tocados
- `git diff --check` sobre archivos del Sprint 35: sin errores.
- No se ejecuto `build` por instruccion del usuario; el usuario hara build general.
- `typecheck` fue iniciado antes, pero fue interrumpido por el usuario; no se reintento para respetar la indicacion de cierre sin build pesado.

## Definition of Done

- Shell privado completo monocromo.
- Todas las vistas personales comparten ritmo, logo, cards, botones y estados sobrios.
- Dashboard camionero y empresarial tienen jerarquia clara sin saturacion.
- Perfil, configuracion, notificaciones, mensajes y onboarding aplican la filosofia de `DESING.md`.
- No se cambiaron contratos de auth, stores ni APIs.
- Sprint 35 queda cerrado.
