# Sprint 34: Public + Auth Luxury

## Estado

- artifact status: `completed`
- prioridad: máxima para primera impresión
- owner: Frontend + Growth
- alcance cerrado: solo rutas públicas y auth de este sprint
- rutas: `/`, `/para-camioneros`, `/soporte`, `/terminos`, `/privacidad`, `/ayuda`, `/login`, `/registro`, `/recuperar-contrasena`, `/verificar-email`, `/auth/callback`, `/auth/invite/accept`, `/auth/mfa/setup`, `/auth/mfa/verify`, `/auth/reset-password`

## Objetivo

Hacer que el primer segundo de KargaX se sienta como abrir una herramienta de élite: silencio visual, logo KX presente, blanco/negro mate, promesa clara y cero ansiedad.

El usuario debe pensar: `esto es serio, limpio, caro y confiable`.

## Implementación Completada

- Se creó una capa compartida `PublicLuxury` para header público, estados auth, spinner negro, paneles de entrada y tarjetas blancas.
- Todas las rutas públicas y auth del sprint usan una estética monocroma: blanco mate, negro mate, bordes sobrios, iconografía sin color y sin gradientes decorativos.
- El monograma KX aparece en login, registro, recuperación, verificación de email, callback, invite y MFA.
- Se conservaron los flujos existentes de Supabase, redirects, tokens hash, invitaciones, MFA, recovery codes, captcha condicional y validaciones principales.
- No se tocó el alcance de los sprints 35, 36, 37 ni 39.

## Reglas Globales Cumplidas

- Header público minimal con logo KX, máximo cuatro enlaces y CTAs negro/blanco.
- Sin blobs, orbes, gradientes coloridos ni cards decorativas anidadas.
- Texto público/auth corregido a español claro.
- Formularios con labels claros, inputs amplios y mensajes cortos.
- Mobile primero para registro, recuperación de contraseña, verificación y MFA.

## `/` Home

- Hero blanco mate con promesa directa: sistema operativo premium para carga, bodegas y pagos.
- Visual principal reemplazado por mock operativo monocromo.
- Secciones completadas:
  - `Control`: flota privada, bodegas, marketplace.
  - `Evidencia`: PIN, fotos, firma, tracking.
  - `Dinero`: liquidaciones, wallet, retiros, reporte.
  - `Piloto`: siete días con pasos claros.
- CTAs conservados: `/registro?tipo=business`, `/login`, `/ofertas/publicar`.

## `/para-camioneros`

- Hero negro mate con KX pequeño.
- Tres beneficios concretos: saldo visible, evidencia lista y ruta clara.
- Microcopy sobrio:
  - `Tus viajes, evidencias y pagos en orden.`
  - `Sin promesas de crédito. Sin letra pequeña.`
- Bloque de referido WhatsApp conservado y sin prometer pagos automáticos.

## `/soporte`

- Encabezado `Soporte KargaX` con intención calmada.
- Selector de dominio y prioridad sin colores.
- Formulario responsive de una columna en mobile.
- SLA como tabla limpia.
- Microcopy aplicado: `Cuéntanos qué pasó. Lo revisamos con trazabilidad.`

## `/terminos` y `/privacidad`

- Documentos centrados con max-width legible.
- Índice lateral solo desktop.
- Tipografía limpia, sin hero pesado.
- Enlaces a login y ayuda visibles.
- Lectura cómoda en mobile.

## `/ayuda`

- Buscador superior.
- Categorías por flujo: Empresa, Camionero, Bodega, Wallet, Seguridad.
- Acordeones sobrios con respuestas accionables.
- Sin bloques promocionales.

## `/login`

- Ritual de entrada con panel izquierdo negro mate, KX y tres frases de confianza.
- Panel derecho blanco con formulario.
- MFA pendiente como bloque sobrio.
- Form conserva email, password, recordar y captcha condicional.
- CTAs: `Entrar` primario negro y `Crear cuenta` secundario.
- Redirect y MFA se conservaron.

## `/registro`

- Paso 1: Transportador / Empresa con cards monocromas, borde negro y check.
- Paso 2: datos personales/empresa agrupados, país, departamento y ciudad sin saturación.
- Paso 3: credenciales, términos, captcha condicional y fuerza de contraseña en barra monocroma.
- Éxito: KX y mensaje claro de email/verificación.
- Se conservaron validaciones Zod, input telefónico andino y alta responsive.

## `/recuperar-contrasena` y `/auth/reset-password`

- KX arriba.
- Una sola tarjeta.
- Instrucciones breves.
- Estados success/error sin colores fuertes: borde, icono y texto.
- Lógica de envío y reset con token conservada.

## `/verificar-email`

- KX visible.
- Input email.
- CTA `Reenviar verificación`.
- Bloque `Revisa spam o correo corporativo`.
- Loading visible.

## `/auth/callback` y `/auth/invite/accept`

- Transición silenciosa centrada.
- KX y spinner negro.
- Texto `Validando acceso`.
- Se mantuvo exchange de código, sesión, aceptación de invite y redirect.

## `/auth/mfa/setup` y `/auth/mfa/verify`

- Fondo negro mate.
- Panel blanco.
- QR, clave manual y recovery codes con mono font.
- CTA claro.
- Recovery codes visibles una vez.
- Verify respeta redirect.
- Errores no filtran datos sensibles.

## QA Ejecutado

- Barrido textual de rutas Sprint 34: sin gradientes, verde/naranja/azul/púrpura ni mojibake en las superficies del sprint.
- Se verificó existencia de todas las rutas del sprint.
- `npm run typecheck` pasó una vez durante la implementación.
- No se ejecutó build final por instrucción del usuario; el build general queda para el cierre global.

## Definition of Done

- Todas las rutas public/auth se ven monocromas.
- El logo KX aparece consistentemente.
- Ningún flujo auth cambia su lógica.
- El sprint queda cerrado sin tocar el alcance de otros sprints.
