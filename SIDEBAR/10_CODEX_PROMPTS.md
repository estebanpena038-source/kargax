# 10 — Prompts IA para implementar SIDEBAR Luxury KargaX

> Objetivo: rediseñar el sidebar de KargaX como un centro de mando premium estilo Apple, separando claramente Marketplace, Operación privada, Dinero/límites, Gobierno y Cuenta, sin romper roles, wallet, billing, Mercado Pago, bodega activa ni datos multiempresa.

## Prompt 1 — auditoría antes de tocar código

```text
Lee AGENTS.md, README.md, DESING.md, KARGAX_AI_OPERATING_SYSTEM/AI_PROMPTS.md si existe, y toda la carpeta /SIDEBAR.

No modifiques código todavía.

Audita el sidebar actual de KargaX:
1. Lee frontend/src/components/layouts/DashboardLayout.tsx completo.
2. Identifica dónde se construyen getNavigationItems, getSecondaryNavItems y getWarehouseScopedNavigation.
3. Identifica cómo se filtran los menús por user.userType, businessAccess, privateFleetContext, canAccessCeo y warehouse capabilities.
4. Identifica dónde se renderiza el sidebar desktop, mobile header, mobile drawer, header sticky y main content.
5. Explica por qué el menú actual mezcla Marketplace, Operación privada, Billing/planes, Billetera y Gobierno.
6. Propón la separación visual final por secciones.
7. Entrega un plan de cambios por commit.

Restricciones:
- No tocar wallet, Mercado Pago, billing, Supabase, RLS ni migraciones.
- No cambiar rutas existentes.
- No inventar permisos nuevos.
- No romper el flujo de bodega activa.
- Mantener copy en español operativo.
```

## Prompt 2 — crear arquitectura /SIDEBAR

```text
Implementa la nueva arquitectura del sidebar premium en KargaX.

Crea esta carpeta:
frontend/src/components/layouts/SIDEBAR/

Archivos esperados:
- frontend/src/components/layouts/SIDEBAR/types.ts
- frontend/src/components/layouts/SIDEBAR/navigation.tsx
- frontend/src/components/layouts/SIDEBAR/LuxurySidebarContent.tsx

Reglas:
- DashboardLayout.tsx debe quedar como orquestador, no como archivo gigante de UI.
- navigation.tsx debe contener configuración de navegación y secciones.
- LuxurySidebarContent.tsx debe contener la UI del sidebar desktop/mobile reutilizable.
- types.ts debe centralizar tipos del sidebar.
- Usar dependencias ya existentes: framer-motion, lucide-react, Tooltip de @/components/ui, Tailwind y cn.
- No instalar dependencias nuevas salvo que sea estrictamente necesario.

Secciones obligatorias:
1. Centro de mando.
2. Operación privada.
3. Marketplace.
4. Dinero y límites.
5. Gobierno.
6. Cuenta.

Al final entrega archivos modificados, diff resumido y comandos de prueba.
```

## Prompt 3 — separar Marketplace de Operación privada

```text
Refactoriza la navegación para que Marketplace no quede mezclado con Operación privada.

Objetivo de UX:
El usuario business debe entender en menos de 3 segundos qué pertenece a operación propia y qué pertenece al marketplace público.

Marketplace debe agrupar:
- /ofertas
- /ofertas/publicar
- /ofertas/mis-ofertas
- /pod-marketplace
- /postulaciones-recibidas
- /postulaciones

Operación privada debe agrupar:
- /bodegas
- /equipo
- /dashboard/flota
- /dashboard/inteligencia
- /dashboard/control-margen
- /viajes-asignados cuando aplique

Dinero y límites debe agrupar:
- /billetera
- /planes

Gobierno debe agrupar:
- /corporativo
- /notificaciones
- /admin
- /admin/ceo

Restricciones:
- No cambies href existentes.
- Conserva allowedUserTypes actuales.
- Conserva badges de notificaciones/postulaciones/viajes.
- Conserva filtros de privateFleetContext para no mostrar marketplace abierto a conductor privado.
- Conserva filtros de businessAccess para planes, equipo, corporate, flota, inteligencia y bodega.
```

## Prompt 4 — diseño luxury Apple-style

```text
Rediseña visualmente el sidebar como una interfaz premium estilo Apple/KargaX.

Principios:
- Claridad > decoración.
- Espacio amplio y respirable.
- Fondo tipo glass panel suave.
- Bordes y sombras sutiles.
- Estado activo fuerte pero elegante.
- Microcopy corto que reduzca ansiedad operativa.
- Nada de colores chillones.
- No saturar la pantalla con badges o textos largos.

Implementa:
- Sidebar desktop con fondo blanco/vidrio y sombra lateral suave.
- Header con marca KargaX Command cuando esté expandido.
- Modo colapsado con íconos centrados y Tooltip real.
- Secciones con etiqueta uppercase y descripción corta.
- Active item tipo pill negro elegante.
- Badges compactos y legibles.
- User card premium al final.
- Mobile drawer con backdrop blur y cierre por ESC.

No cambies lógica de autenticación ni redirección.
```

## Prompt 5 — bodega activa y roles operativos

```text
Endurece el sidebar para usuarios de bodega y empresa.

Revisa:
- warehouseClient.getWarehouseAccess
- businessAccess.capabilities
- businessAccess.activeWarehouseId
- businessAccess.role
- getWarehouseScopedNavigation
- handleActiveWarehouseChange

Objetivo:
Un operador de bodega debe ver navegación scoped a su bodega activa, no el menú completo de owner/admin.

Reglas:
- Mantener selector de bodega activa.
- Si el usuario tiene rol manager/operator/warehouse_manager/warehouse_operator, mostrar navegación scoped a /bodegas/:warehouseId.
- Filtrar muelles, inventario, recepciones, picking, despachos, incidentes y analítica por capabilities existentes.
- No inventar capabilities nuevas.
- No romper redirección a /bodegas/:id al cambiar bodega.

Entrega test manual por rol.
```

## Prompt 6 — mobile drawer y responsive QA

```text
Valida y ajusta el sidebar mobile.

Debe cumplir:
- Header fijo de 64px en mobile.
- Botón de menú accesible con aria-label.
- Drawer ancho máximo min(20rem, calc(100vw - 1.25rem)).
- Backdrop oscuro con blur.
- Cierre al hacer click fuera.
- Cierre al navegar.
- Cierre con tecla Escape.
- No permitir overflow horizontal.
- Bodega activa usable en mobile.
- User profile visible al final.

Prueba en:
- 360px ancho.
- 390px ancho.
- 768px ancho.
- Desktop > 1024px.

No rompas main content margin-left en desktop colapsado/expandido.
```

## Prompt 7 — QA de roles y navegación

```text
Crea o ejecuta un runbook QA para el sidebar.

Casos mínimos:
1. business owner ve Centro de mando, Operación privada, Marketplace, Dinero y límites, Gobierno y Cuenta.
2. business operator de bodega ve menú scoped de bodega activa.
3. trucker marketplace ve ofertas, postulaciones, viajes asignados y billetera.
4. trucker privado no ve marketplace abierto si privateFleetContext.isPrivateFleetDriver=true.
5. admin ve Admin.
6. admin CEO ve CEO KargaX solo si /api/admin/ceo-access responde allowed=true.
7. badges aparecen en notificaciones/postulaciones/viajes.
8. modo colapsado muestra tooltips.
9. mobile drawer abre/cierra correctamente.
10. rutas /billetera y /planes cargan sin cambios funcionales.

Comandos:
- npm run lint
- npm run typecheck
- npm run build
- npm run check:release

Entrega blockers, issues visuales y decisión de release.
```

## Prompt 8 — PR review CTO

```text
Revisa la implementación del sidebar como CTO de KargaX.

Prioriza:
1. No romper auth/session redirect.
2. No romper roles ni permisos por userType.
3. No romper businessAccess ni warehouse capabilities.
4. No mezclar Marketplace con Operación privada.
5. No tocar wallet/billing/Mercado Pago.
6. No instalar dependencias innecesarias.
7. No romper mobile.
8. No generar deuda técnica mayor en DashboardLayout.tsx.

Entrega:
- Blockers.
- Cambios requeridos.
- Mejoras UX.
- Pruebas faltantes.
- Decisión: merge / changes requested.
```

## Prompt 9 — copy y microcopy premium

```text
Mejora solo el copy del sidebar sin tocar lógica.

Objetivo:
Que el menú se sienta premium, claro y operativo.

Reglas:
- Español Colombia.
- Nada bancario/regulado en wallet.
- Nada de humo tipo "IA revolucionaria" dentro del sidebar.
- Microcopy máximo 1 línea por sección.
- El usuario debe entender qué hacer sin manual.

Secciones:
Centro de mando: "Resumen ejecutivo de tu operación."
Operación privada: "Bodegas, flota y equipo propio."
Marketplace: "Capacidad externa sin perder trazabilidad."
Dinero y límites: "Saldo operativo, planes y control de uso."
Gobierno: "Empresa, auditoría y administración."
Cuenta: "Perfil, ayuda y preferencias."

Entrega diff mínimo.
```

## Prompt 10 — deploy controlado a Vercel

```text
Prepara release controlado del sidebar en main.

Pasos:
1. git status
2. npm run lint
3. npm run typecheck
4. npm run build
5. npm run check:release
6. Revisar rutas críticas manualmente.
7. Deploy con vercel --prod solo si build está limpio.

No crear ramas nuevas.
No hacer git add . sin revisar.
No desplegar si hay errores de typecheck/build.

Entrega:
- Resultado de comandos.
- Riesgos restantes.
- Plan de rollback.
- Comando exacto de deploy.
```
