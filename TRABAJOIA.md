# 🤖 TRABAJOIA.md — Todo lo que Hace la IA (Codex Pro) en 30 Días

> Este documento es la guía técnica completa de qué le pides a la IA cada día.
> Copia y pega estas instrucciones en Codex Pro / Gemini / tu asistente IA.

---

## 📋 RESUMEN EJECUTIVO

| Semana | Foco | Tareas IA | Horas IA |
|---|---|---|---|
| **Semana 1** | Fix 15 bugs críticos + deploy | 15 bugs | ~40h |
| **Semana 2** | Features de retención | 8 features nuevas | ~45h |
| **Semana 3** | Hotfixes de usuarios reales | Variable | ~20h |
| **Semana 4** | Dashboard inteligencia + iteración | 4 features | ~30h |

---

## 🔴 SEMANA 1: FIX DE BUGS (Días 1-7)

### Bug #1: Lógica de Comisiones B2B — PRIORIDAD MÁXIMA

**Problema:** Cuando el camionero termina la ruta, dice "Total ganado $2M" pero el saldo disponible sube $2M completos sin descontar comisión. La empresa también ve montos incorrectos.

**Qué decirle a la IA:**
```
Necesito arreglar la lógica de comisiones/settlement en KargaX.

EL MODELO DE NEGOCIO ES:
- La empresa paga el valor total del flete (ej: $3.500.000 COP)
- KargaX cobra comisión del 8% ($280.000 COP)
- El camionero recibe el 92% ($3.220.000 COP)

ARCHIVOS CLAVE:
- frontend/src/app/billetera/page.tsx (61KB — vista de wallet)
- frontend/src/app/viaje/[offerId]/entrega/page.tsx (50KB — entrega)
- supabase/migrations/034_freight_payment_settlement_resilience.sql
- frontend/src/lib/supabase/api-bridge (settlement logic)

QUÉ DEBE PASAR:
1. Cuando el viaje se completa (PIN + evidencia):
   - Se calcula: comision = total_amount * 0.08
   - Se calcula: trucker_payment = total_amount - comision
   - Se registra en wallet del camionero: +trucker_payment
   - Se registra en wallet de KargaX: +comision
   - El settlement timeline muestra ambos montos claramente

2. En la billetera del camionero debe mostrar:
   "Viaje Bogotá→Medellín: $3.220.000 (neto después de comisión 8%)"
   
3. En la billetera de la empresa debe mostrar:
   "Pago viaje Bogotá→Medellín: -$3.500.000"

VERIFICACIÓN: 
- Crear un viaje de prueba por $2.000.000
- Comisión 8% = $160.000
- Camionero debe ver: +$1.840.000 en su wallet
- Dashboard admin debe mostrar: +$160.000 en revenue de plataforma
```

**Archivos que la IA debe revisar:**
- `frontend/src/app/billetera/page.tsx` (líneas de settlement)
- `frontend/src/lib/supabase/api-bridge.ts` (función de completar viaje)
- `supabase/migrations/034_freight_payment_settlement_resilience.sql`
- `frontend/src/app/viaje/[offerId]/entrega/page.tsx` (confirmación de entrega)

**Resultado esperado:** El camionero ve su pago neto (92%), la plataforma cobra 8%, todo queda registrado en el ledger.

---

### Bug #2: Cierre de Sesión Inesperado

**Problema:** Cuando el usuario (empresa) termina un pago y presiona "Volver a inicio", se cierra la sesión y tiene que volver a iniciar.

**Qué decirle a la IA:**
```
En KargaX, cuando un usuario empresa completa un pago y presiona 
"Volver a inicio", la sesión se cierra y lo manda al login.

ARCHIVOS CLAVE:
- frontend/src/app/pagar/[offerId]/ (flujo de pago)
- frontend/src/features/auth/store/authStore.ts
- frontend/src/app/providers.tsx (auth provider)
- frontend/src/lib/supabase/auth.ts

INVESTIGAR:
1. ¿El botón "Volver a inicio" hace router.push('/') o window.location?
2. ¿Hay algún middleware que invalida la sesión al navegar?
3. ¿El auth provider re-valida el token al cambiar de ruta?

FIX: El botón debe usar Next.js router.push('/dashboard') SIN 
recargar la página. No debe tocar la sesión de Supabase.

VERIFICACIÓN:
- Login → Dashboard → Publicar oferta → Pagar → "Volver a inicio"
- El usuario DEBE seguir logueado en el dashboard
- Probar en Chrome y en modo incógnito
```

---

### Bug #3: Links de localhost en Emails

**Problema:** Los emails de recuperación de contraseña e invitaciones mandan a `localhost:3000` en vez del dominio real.

**Qué decirle a la IA:**
```
Los emails de KargaX (reset password, invitaciones de equipo) 
contienen links a localhost:3000 en vez del dominio de producción.

ARCHIVOS CLAVE:
- frontend/src/app/api/auth/ (API routes de auth)
- frontend/src/app/api/business/team/route.ts (invitaciones)
- frontend/src/app/recuperar-contrasena/page.tsx
- frontend/src/lib/supabase/auth.ts

SOLUCIÓN:
1. Buscar TODAS las instancias de "localhost" en el código
2. Reemplazar con process.env.NEXT_PUBLIC_APP_URL
3. En los templates de email de Supabase, usar {{ .SiteURL }}
4. En las invitaciones de equipo, usar NEXT_PUBLIC_APP_URL para el link

VERIFICACIÓN:
- Buscar: grep -r "localhost" en todo el frontend/src
- NO debe haber ningún localhost hardcodeado
- Los links en emails deben usar la variable de entorno
```

---

### Bug #4: Upload de Imágenes en Ofertas

**Problema:** Cuando se publica una oferta, las fotos no se suben. La web se reinicia y no guarda nada.

**Qué decirle a la IA:**
```
El upload de imágenes al publicar ofertas en KargaX no funciona.
La web se reinicia cuando se intenta subir una imagen.

ARCHIVOS CLAVE:
- frontend/src/app/ofertas/publicar/page.tsx (84KB — wizard)
- frontend/src/lib/supabase/client.ts (Supabase client)
- supabase/migrations/005_offer_photos.sql
- supabase/migrations/021_fix_trip_photos_rls.sql

INVESTIGAR:
1. ¿El bucket de storage existe en Supabase?
2. ¿Las políticas RLS del bucket permiten upload?
3. ¿El componente de upload maneja errores o crashea?
4. ¿El formulario hace submit al seleccionar imagen (causando recarga)?

FIX:
- Asegurar que el bucket "offer-photos" existe con RLS correcto
- El upload debe ser async, no causar recarga del formulario
- Agregar try-catch con toast.error si falla
- Mostrar preview de la imagen después de subir

VERIFICACIÓN:
- Ir a /ofertas/publicar
- En el paso de fotos, subir una imagen JPG de 2MB
- Debe mostrar preview sin recargar la página
- Al publicar, la oferta debe tener la foto visible
```

---

### Bug #5: Manifiesto se Reinicia al Confirmar Carga

**Problema:** Cuando el camionero tiene 4 items rechazados y presiona "Confirmar carga", los items vuelven a estado "Entregado".

**Qué decirle a la IA:**
```
En el flujo de entrega de KargaX, cuando el camionero marca items 
como rechazados/con novedad y presiona "Confirmar carga", todos 
los items vuelven a estado "Entregado". Se pierde el estado.

ARCHIVOS CLAVE:
- frontend/src/components/picking/PickingChecklist.tsx (44KB)
- frontend/src/app/viaje/[offerId]/carga/page.tsx (44KB)
- frontend/src/app/viaje/[offerId]/entrega/page.tsx (50KB)
- supabase/migrations/037_manifest_item_ids_and_picking_idempotency.sql

INVESTIGAR:
1. ¿La función de "confirmar carga" sobrescribe los estados individuales?
2. ¿Hay un re-fetch que resetea el state local?
3. ¿La migración 037 de idempotency está funcionando correctamente?

FIX:
- Al confirmar, enviar el estado ACTUAL de cada item (entregado/rechazado/novedad)
- No hacer re-fetch que sobrescriba el state local
- Los items rechazados DEBEN mantenerse como rechazados después de confirmar
- Mostrar resumen: "4 entregados, 0 rechazados" o "2 entregados, 2 rechazados"

VERIFICACIÓN:
- Crear viaje con manifiesto de 4 items
- Marcar 2 como rechazados, 2 como entregados
- Presionar "Confirmar carga"
- Los 2 rechazados DEBEN seguir como rechazados
```

---

### Bug #6: Loop OTP → Dashboard

**Problema:** Cuando la sesión expira y el usuario está inactivo, manda al OTP pero dice "Error al generar QR", luego hace loop entre onboarding y dashboard.

**Qué decirle a la IA:**
```
Cuando un usuario tiene la web abierta y la sesión expira:
1. Manda al OTP
2. Dice "Error al generar QR"
3. Hace loop entre /onboarding y /dashboard infinitamente
4. El usuario tiene que cerrar la web para detenerlo

ARCHIVOS CLAVE:
- frontend/src/app/providers.tsx (auth provider)
- frontend/src/features/auth/store/authStore.ts
- frontend/src/app/onboarding/page.tsx
- frontend/src/components/layouts/DashboardLayout.tsx (49KB)
- frontend/src/lib/supabase/auth.ts

FIX:
1. Cuando la sesión expira → redirigir a /login, NO a OTP
2. Eliminar el loop: si el usuario no tiene sesión válida → /login
3. Si el usuario ya completó onboarding → NUNCA mandarlo a /onboarding
4. Agregar guard: si estoy en /dashboard y no hay sesión → /login, sin loop

VERIFICACIÓN:
- Login → Esperar 30 min inactivo (o forzar expiración de token)
- Debe redirigir a /login limpiamente
- NO debe hacer loop entre páginas
- NO debe mostrar "Error al generar QR"
```

---

### Bug #7-12: Fixes de UI/UX (Día 2)

**Qué decirle a la IA (todo junto):**
```
Necesito arreglar 6 issues de UI/UX en KargaX. Hazlos todos:

1. UNIFICAR POSTULACIONES:
   - Hay 2 módulos: /postulaciones y /ofertas-aceptadas
   - Unificar en 1 solo: /postulaciones
   - Tabs: "Pendientes" | "Aceptadas" | "Terminadas" | "No seleccionadas"
   - Archivos: postulaciones/page.tsx + ofertas-aceptadas/page.tsx

2. SKU SELECTOR EN INSPECCIONES:
   - En /inspecciones, al agregar producto nuevo NO debe forzar "Selecciona SKU existente"
   - Primera vez = campo libre para escribir SKU nuevo
   - Si el SKU ya existe en la bodega = mostrar selector
   - Archivo: inspecciones/[offerId]/page.tsx

3. BOTÓN "RECHAZAR CARGA" INVISIBLE:
   - El botón es transparente/blanco, no se ve
   - Cambiar a: fondo rojo, texto blanco, visible siempre
   - Archivo: viaje/[offerId]/entrega/page.tsx o carga/page.tsx

4. VALIDACIÓN DESCRIPCIÓN DE CARGA:
   - Muestra "La descripción es muy corta" incluso cuando ya es larga
   - Solo quitar la alerta cuando el texto cumple el mínimo
   - Archivo: ofertas/publicar/page.tsx

5. QUITAR ELEMENTOS INNECESARIOS:
   - Quitar cuadro "Rutas optimizadas por IA" de ofertas-aceptadas
   - Quitar cuadro "Pago administrado por KargaX" del wizard de publicar
   - Quitar panel de tarjetas guardadas de Mercado Pago del checkout
   - Botón "Activar plan Enterprise" → color NARANJA (no verde)

6. TIMELINE DE SETTLEMENT EN ESPAÑOL:
   - En /billetera, el timeline dice "Settlement Timeline" en inglés
   - Cambiar TODO a español claro:
     - "Settlement initiated" → "Liquidación iniciada"
     - "Payment confirmed" → "Pago confirmado"  
     - "Funds available" → "Fondos disponibles"
   - Archivo: billetera/page.tsx
```

---

## 🟢 SEMANA 2: FEATURES DE RETENCIÓN (Días 8-14)

### Feature #1: Sistema de Score/Reputación (Días 8-9)

**Qué decirle a la IA:**
```
Necesito crear un sistema de reputación para camioneros en KargaX.

CREAR EN SUPABASE (nueva migración 040_trucker_scores.sql):

CREATE TABLE trucker_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trucker_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  total_trips INTEGER DEFAULT 0,
  completed_trips INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  no_incident_deliveries INTEGER DEFAULT 0,
  advances_repaid INTEGER DEFAULT 0,
  advances_total INTEGER DEFAULT 0,
  overall_score NUMERIC(3,2) DEFAULT 0, -- 0.00 a 5.00
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','diamond')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Función que actualiza el score después de cada viaje completado
CREATE OR REPLACE FUNCTION update_trucker_score(p_trucker_id UUID)
RETURNS void AS $$
  -- Calcular métricas basadas en trips completados
  -- on_time_rate = on_time_deliveries / completed_trips
  -- no_incident_rate = no_incident_deliveries / completed_trips
  -- overall_score = (on_time_rate * 2 + no_incident_rate * 2 + repayment_rate) / 5 * 5
  -- tier basado en completed_trips: 0-10=bronze, 11-50=silver, 51-200=gold, 200+=diamond
$$ LANGUAGE plpgsql;

CREAR EN FRONTEND:
1. Componente TruckerScoreBadge.tsx:
   - Muestra: ⭐ 4.8/5.0 — Nivel ORO — 87 viajes
   - Colores: Bronce=gris, Plata=azul, Oro=dorado, Diamante=morado
   - Con animación de brillo para Oro y Diamante

2. Mostrar badge en:
   - Perfil del camionero (/perfil)
   - Tarjeta de postulación (cuando empresa ve postulaciones)
   - Dashboard del camionero

3. Sección en /perfil que muestra estadísticas:
   - Viajes completados: 87
   - Entregas a tiempo: 95%
   - Sin novedades: 92%
   - Adelantos pagados: 100%
   - Score: ⭐⭐⭐⭐⭐ 4.8/5.0
   - Nivel: ORO (siguiente: Diamante a 200 viajes)
   - Barra de progreso al siguiente nivel

VERIFICACIÓN:
- Crear camionero con 55 viajes → debe ser ORO
- Score debe calcularse automáticamente
- Badge debe verse en postulaciones
```

---

### Feature #2: Sistema de Niveles con Comisión Dinámica (Día 10)

**Qué decirle a la IA:**
```
Crear sistema de niveles que cambia la comisión según el tier del camionero.

LÓGICA:
- BRONCE (0-10 viajes):   comisión 8%, sin adelantos
- PLATA (11-50 viajes):   comisión 6%, adelantos hasta $500.000
- ORO (51-200 viajes):    comisión 5%, adelantos hasta $2.000.000
- DIAMANTE (200+ viajes): comisión 4%, adelantos hasta $5.000.000

IMPLEMENTAR:
1. En la función de settlement, obtener el tier del camionero
2. Aplicar la comisión correspondiente al tier
3. En la billetera, mostrar: "Comisión KargaX: 5% (beneficio nivel Oro)"
4. En el perfil, mostrar tabla de beneficios por nivel
5. Mostrar: "Llevas 51 viajes. Si llegas a 200, tu comisión baja a 4%"

ARCHIVOS:
- Migración SQL nueva para la tabla de tier_benefits
- billetera/page.tsx (mostrar comisión dinámica)
- La función de settlement que ya arreglamos en Bug #1
```

---

### Feature #3: Pago Exprés (Día 11)

**Qué decirle a la IA:**
```
Crear sistema de "Pago Exprés" para camioneros nivel ORO y DIAMANTE.

LÓGICA:
1. Viaje completado + PIN verificado + evidencia fotográfica subida
2. Si el camionero es ORO o DIAMANTE:
   → 70% del pago neto se libera INMEDIATAMENTE al wallet
   → 30% restante queda en "pendiente de confirmación empresa"
3. La empresa tiene 48 horas para reclamar novedad
4. Si no reclama en 48h → el 30% se libera automáticamente
5. Si reclama → se abre disputa y el 30% queda retenido

IMPLEMENTAR:
1. Nueva columna en trips: express_payment_released BOOLEAN
2. Función: release_express_payment(trip_id)
3. Cron job o trigger: auto-release después de 48h
4. En billetera del camionero mostrar:
   "💨 Pago Exprés: $2.254.000 liberado (70%)"
   "⏳ Pendiente confirmación: $966.000 (30%) — libera en 47h"

ARCHIVOS:
- Nueva migración SQL
- billetera/page.tsx (mostrar pago exprés)
- viaje/[offerId]/entrega/page.tsx (trigger al completar)
```

---



### Feature #4: Notificaciones Inteligentes (Días 13-14)

**Qué decirle a la IA:**
```
Crear secuencia de notificaciones automáticas para retención.

SECUENCIAS:

PARA EMPRESAS:
- Día 1 post-registro: "Bienvenido a KargaX. Publica tu primera carga →"
- Día 3 sin actividad: "Hay [X] camioneros disponibles en tu zona. Publica una carga."
- Día 7 sin actividad: "Empresas como la tuya ahorran tiempo con KargaX. ¿Necesitas ayuda?"
- Post primer viaje: "Tu primer viaje se completó. Ahorraste [X] horas vs coordinación manual."
- Cuando camionero se postula: "🚛 [Nombre] (⭐4.8, 47 viajes) se postuló a tu carga."

PARA CAMIONEROS:
- Día 1 post-registro: "Bienvenido. Ya hay [X] cargas disponibles cerca de ti →"
- Día 3 sin actividad: "Nueva carga: [Ciudad]→[Ciudad] por $[X]. Postúlate →"
- Post primer viaje: "Ganaste $[X]. Con 10 viajes más subes a nivel PLATA (6% comisión)."
- Nuevo nivel: "🏆 ¡Felicidades! Ahora eres nivel ORO. Comisión reducida a 5%."
- Adelanto disponible: "💰 Tienes disponible adelanto de hasta $[X] para tu próximo viaje."

IMPLEMENTAR:
1. Tabla notification_sequences (user_id, sequence_key, sent_at, channel)
2. API route: /api/notifications/trigger-sequences
3. Lógica: verificar días desde registro, última actividad, viajes completados
4. Canales: in-app (toast/badge) + email
5. En el DashboardLayout, mostrar badge de notificaciones no leídas

ARCHIVOS:
- Nueva migración SQL
- api/notifications/ (nueva route)
- components/layouts/DashboardLayout.tsx (badge notificaciones)
- supabase/migrations/008_notifications.sql (ya existe, extender)
```

---

## 🟡 SEMANA 3-4: HOTFIXES + DASHBOARD INTELIGENCIA

### Feature #5: Dashboard de Inteligencia Empresarial (Día 22-24)

**Qué decirle a la IA:**
```
Crear dashboard de inteligencia operativa para empresas en KargaX.

CREAR PÁGINA: /dashboard/inteligencia

SECCIONES:
1. RESUMEN DEL MES:
   - Total viajes completados: 34
   - Total pagado en fletes: $119.000.000 COP
   - Comisión KargaX: $9.520.000 COP
   - Ahorro estimado vs intermediarios: $17.850.000 COP

2. COSTOS POR RUTA (gráfico de barras):
   - Bogotá→Medellín: promedio $3.200.000 (12 viajes)
   - Bogotá→Cali: promedio $2.800.000 (8 viajes)
   - Bogotá→Barranquilla: promedio $5.900.000 (6 viajes)

3. TOP CAMIONEROS (ranking):
   - 🥇 Juan Pérez: 12 viajes, 0 novedades, ⭐4.9
   - 🥈 Carlos López: 8 viajes, 1 novedad, ⭐4.6
   - 🥉 María García: 6 viajes, 0 novedades, ⭐4.8

4. TENDENCIAS (línea de tiempo):
   - Viajes por semana (últimas 8 semanas)
   - Costo promedio por viaje (tendencia)

5. BOTÓN: "Exportar reporte PDF"

ARCHIVOS:
- Nueva página: dashboard/inteligencia/page.tsx
- Queries a Supabase para agregar datos de viajes
- Usar recharts o chart.js para gráficos
- Agregar link en el sidebar del DashboardLayout
```

---

## 📊 CHECKLIST COMPLETO PARA LA IA

### Semana 1 — Bugs (marcar cuando esté listo):
```
[ ] Bug #1:  Comisiones B2B (8% plataforma, 92% camionero)
[ ] Bug #2:  Cierre de sesión inesperado post-pago
[ ] Bug #3:  Links localhost → NEXT_PUBLIC_APP_URL
[ ] Bug #4:  Upload de imágenes en ofertas
[ ] Bug #5:  Manifiesto se reinicia al confirmar
[ ] Bug #6:  Loop OTP/dashboard al expirar sesión
[ ] Bug #7:  Unificar postulaciones + trabajos aceptados
[ ] Bug #8:  SKU selector en inspecciones
[ ] Bug #9:  Botón "Rechazar carga" → rojo visible
[ ] Bug #10: Validación descripción carga
[ ] Bug #11: Quitar "Rutas IA" + panel MP + cuadro pago
[ ] Bug #12: Timeline settlement → español
```

### Semana 2 — Features de Retención:
```
[ ] Feature #1: Sistema de Score/Reputación
[ ] Feature #2: Niveles Bronce→Diamante + comisión dinámica
[ ] Feature #3: Pago Exprés (70% en 2h)
[ ] Feature #4: Sistema de referidos
[ ] Feature #5: Notificaciones inteligentes
```

### Semana 3-4 — Iteración + Features Extra:
```
[ ] Feature #6:  Dashboard de inteligencia
[ ] Feature #7:  Exportar reporte PDF para empresas
[ ] Feature #8:  Landing page pública para camioneros
[ ] Feature #9:  Botón "Compartir en WhatsApp" para referidos
[ ] Feature #10: Emails automáticos a usuarios inactivos
[ ] Feature #11: Optimización mobile/responsive
[ ] Hotfixes de usuarios reales (variable)
```

---

## 🔵 FEATURES EXTRA SEMANA 3-4 (Detalle)

### Feature #7: Exportar Reporte PDF (Día 25)

**Qué decirle a la IA:**
```
Crear botón "Exportar PDF" en el dashboard de inteligencia y billetera.

QUÉ EXPORTA:
- Nombre empresa, NIT, período
- Tabla de viajes del mes (fecha, ruta, camionero, monto, comisión)
- Total pagado, total comisión, neto
- Sirve como soporte contable

IMPLEMENTAR:
- Usar librería jsPDF o react-pdf
- Botón en /dashboard/inteligencia y en /billetera
- Formato profesional con logo KargaX
- Nombre archivo: "KargaX_Reporte_Mayo2026_[NombreEmpresa].pdf"

¿POR QUÉ ES CRÍTICO?
Esto convence al CONTADOR de la empresa de usar KargaX.
Si el contador lo adopta, la empresa NUNCA se va.
```

---

### Feature #8: Landing Page Pública para Camioneros (Día 26)

**Qué decirle a la IA:**
```
Crear página pública /para-camioneros que convenza camioneros 
de registrarse. NO necesita login.

SECCIONES:
1. Hero: "Gana más por cada viaje. Sin intermediarios."
   - Botón grande: "Regístrate gratis"
   
2. Beneficios (3 cards):
   - 💰 "Pago en 2 horas, no en 30 días"
   - 🛡️ "Pago garantizado con escrow"
   - ⛽ "Adelantos de combustible"

3. Cómo funciona (3 pasos):
   - Paso 1: "Regístrate gratis"
   - Paso 2: "Postúlate a cargas disponibles"
   - Paso 3: "Entrega y cobra en 2 horas"

4. Niveles:
   - Tabla Bronce → Plata → Oro → Diamante
   - "Entre más viajes, menos comisión"

5. Testimonial (placeholder hasta tener reales):
   - "Con KargaX gano más y me pagan rápido"

6. CTA final: "Únete a [X] camioneros en KargaX"
   - Botón: "Registrarme ahora"

DISEÑO: Mobile-first. La mayoría de camioneros usan celular.
Colores: Verde KargaX + naranja para CTAs.

ARCHIVOS:
- Nueva página: app/para-camioneros/page.tsx
- Agregar link en footer y en la página principal
```

---


### Feature #10: Emails Automáticos a Inactivos (Día 28)

**Qué decirle a la IA:**
```
Crear sistema de emails automáticos para usuarios que dejan 
de usar KargaX.

TRIGGERS:
1. Empresa registrada + 3 días sin publicar carga:
   Asunto: "Tu primera carga te espera"
   Body: "Hay [X] camioneros disponibles en tu zona.
   Publica tu primera carga en 2 minutos →"

2. Camionero registrado + 3 días sin postularse:
   Asunto: "Hay cargas nuevas cerca de ti"
   Body: "[X] cargas disponibles saliendo de [ciudad].
   La mejor paga $[X]. Postúlate →"

3. Usuario activo + 14 días sin actividad:
   Asunto: "Te echamos de menos en KargaX"
   Body: "Desde tu última visita, [X] viajes se completaron
   en tu zona. ¿Volvemos?"

IMPLEMENTAR:
- API route: /api/cron/inactive-users
- Query: usuarios con last_login > 3 días
- Enviar vía Supabase Auth email o Resend
- Límite: máximo 1 email por usuario por semana
- Botón "Dejar de recibir" en el footer del email

ARCHIVOS:
- api/cron/inactive-users/route.ts
- Configurar Vercel Cron o llamar manual
```

---

## 💡 REGLA DE ORO PARA LA IA

```
PRIORIDAD ABSOLUTA:
1. PRIMERO los 12 bugs (sin bugs no hay producto)
2. DESPUÉS las features de retención (sin retención no hay negocio)
3. AL FINAL el pulido (landing, PDF, emails)

SI UN CLIENTE REPORTA UN BUG → se arregla EL MISMO DÍA
SI 2 CLIENTES PIDEN LO MISMO → se construye EN LA SEMANA
SI ES COSMÉTICO → se hace cuando no haya nada urgente
```

---

*Total de tareas IA: 12 bugs + 10 features = 22 entregables en 30 días.*
*Con 7h/día de código = 210 horas de desarrollo.*
*Más que suficiente para completar TODO.*

*Marca con [x] cada tarea cuando la completes.*
*Este archivo es tu fuente de verdad. Consúltalo TODOS los días.*
