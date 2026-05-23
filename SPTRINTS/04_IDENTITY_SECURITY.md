# 04 - Identity Security

## Estado

- `COMPLETADO`
- cierre: `operativo para MVP fintech/logistics`
- semaforo: `verde`

## Objetivo

Quitar la dependencia de `localStorage` para seguridad real, volver server-first el perimetro de sesion y exigir `AAL2` en flujos sensibles.

## Resultado implementado

- se creo un `session bridge` real con cookie `HttpOnly`
- `proxy.ts` ahora gobierna acceso por cookie segura y no por estado local del browser
- las rutas server-side autentican con `Authorization` o con cookie segura `kargax-session`
- `authStore` sincroniza y limpia el bridge al iniciar sesion, refrescar token y cerrar sesion
- los flujos sensibles de dinero y gobierno usan `requireAal2Route`

## Implementacion cerrada

### Session bridge server-first

- archivo: `frontend/src/app/api/auth/session/route.ts`
- comportamiento:
  - recibe `Bearer token`
  - valida el token en servidor
  - escribe cookie `HttpOnly`
  - limpia cookie al cerrar sesion
- decision clave:
  - la cookie guarda el `access_token` actual para que middleware y rutas puedan validar sin depender de `localStorage`

### Constantes de sesion

- archivo: `frontend/src/lib/auth/session-constants.ts`
- se fijo:
  - `SESSION_COOKIE_NAME = kargax-session`
  - `maxAge` consistente para bridge

### Ruta auth server-side

- archivo: `frontend/src/lib/server/route-auth.ts`
- implementado:
  - lectura de token desde `Authorization`
  - fallback a cookie `HttpOnly`
  - lectura de `aal` desde JWT
  - helper `requireAal2Route`
  - errores API normalizados con `apiError`
- impacto:
  - el backend ya no depende del cliente para decidir autenticacion sensible

### Proxy de seguridad

- archivo: `frontend/src/proxy.ts`
- implementado:
  - proteccion de rutas por cookie segura
  - respuesta `401` con envelope para APIs
  - redirect a login para UI
  - `security headers`
  - rate limiting simple
- impacto:
  - el middleware ahora participa de verdad en el perimetro

### Cliente auth sincronizado

- archivos:
  - `frontend/src/lib/auth/session-bridge.ts`
  - `frontend/src/features/auth/store/authStore.ts`
  - `frontend/src/app/providers.tsx`
- implementado:
  - sync del bridge en `SIGNED_IN`, `TOKEN_REFRESHED`, `MFA_CHALLENGE_VERIFIED`, `USER_UPDATED`
  - clear del bridge en `SIGNED_OUT` y cuando no hay sesion valida

### Step-up auth activo en flujos sensibles

- `requireAal2Route` confirmado en:
  - `api/payments/create-preference`
  - `api/billing/subscription`
  - `api/billing/subscription/checkout`
  - `api/billing/subscription/usage`
  - `api/wallet/withdraw`
  - `api/warehouses/access`
  - `api/business/team/*`
  - `api/holding/approvals*`
  - `api/holding/businesses*`
  - `api/holding/finance-policy`
  - `api/holding/members*`

## Auditoria y evidencia

### Hallazgos cerrados

- antes:
  - el producto dependia de almacenamiento del navegador para mantener la continuidad de seguridad
  - el middleware no podia gobernar acceso real
- despues:
  - el borde de seguridad se comparte entre `proxy`, rutas API y lifecycle de auth
  - el acceso sensible requiere sesion valida y puede exigir `AAL2`

### Archivos clave tocados

- `frontend/src/app/api/auth/session/route.ts`
- `frontend/src/lib/auth/session-constants.ts`
- `frontend/src/lib/auth/session-bridge.ts`
- `frontend/src/lib/server/route-auth.ts`
- `frontend/src/features/auth/store/authStore.ts`
- `frontend/src/app/providers.tsx`
- `frontend/src/proxy.ts`

## Verificacion ejecutada

- `npm run typecheck` -> `PASS`
- `npm run lint` -> `PASS` con `0` errores bloqueantes
- `npm run build` -> `PASS`
- `npm run check` -> `PASS`
- `npm run check:release` -> `PASS`

## Definition of Done

- token sensible fuera del flujo critico de `localStorage`: `SI`
- middleware con participacion real en el acceso: `SI`
- rutas sensibles con `AAL2`: `SI`
- logout limpia perimetro server-side: `SI`

## Riesgos remanentes no bloqueantes

- todavia existe deuda de warnings de lint en zonas heredadas fuera del cierre de este sprint
- el repo sigue con `frontend/.git` anidado como deuda de consolidacion historica

## Veredicto

`Sprint 04` queda cerrado. La seguridad del MVP ya es compatible con una operacion seria de pagos, wallet y gobierno empresarial sin depender de confianza ciega en estado cliente.
