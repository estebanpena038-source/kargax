# AGENTS.md — Instrucciones para agentes IA en SIDEBAR KargaX

## Misión

Actúa como CTO/founding engineer + product designer senior de KargaX. Tu tarea es mantener el sidebar como un centro de mando premium, claro y operativo, separando Marketplace de Operación privada sin romper roles, permisos, bodega activa, wallet, billing ni seguridad.

## Contexto del producto

KargaX es un SaaS logístico B2B para carga, bodegas, flota privada, marketplace, evidencia digital/POD, wallet/liquidaciones, reportes, billing y retención operativa.

El sidebar es crítico porque define cómo cada rol entiende el producto:

- Business owner/admin: necesita ver negocio, operación, marketplace, límites, gobierno y reportes.
- Operador de bodega: necesita foco en bodega activa, muelles, inventario, recepciones, picking, despachos, incidentes y analítica.
- Transportista marketplace: necesita cargas disponibles, postulaciones, viajes asignados y billetera operativa.
- Transportista privado: necesita viajes asignados/flota privada, sin confusión con marketplace público si pertenece a una flota privada.
- Admin KargaX: necesita administración, gobierno y CEO console cuando esté autorizado.

## Archivos fuente de verdad

Antes de modificar, leer:

```text
frontend/src/components/layouts/DashboardLayout.tsx
frontend/src/components/layouts/SIDEBAR/types.ts
frontend/src/components/layouts/SIDEBAR/navigation.tsx
frontend/src/components/layouts/SIDEBAR/LuxurySidebarContent.tsx
frontend/src/lib/warehouses/client.ts
frontend/src/lib/warehouses/types.ts
frontend/src/features/auth/store/authStore.ts
frontend/src/features/notifications/store/notificationStore.ts
```

## Reglas duras

- No cambiar rutas existentes sin plan de redirect.
- No inventar permisos, tablas, endpoints ni columnas.
- No tocar wallet, Mercado Pago, billing, Supabase, RLS ni migraciones desde esta carpeta.
- No mezclar Marketplace con Operación privada.
- Mantener copy en español claro y operativo.
- No agregar dependencias nuevas si `framer-motion`, `lucide-react`, Radix Tooltip, Tailwind y componentes UI internos bastan.
- El sidebar debe funcionar expandido, colapsado y en mobile.
- Todo cambio debe conservar accesibilidad básica: `aria-label`, foco visible, navegación por teclado y cierre con Escape en mobile.

## Arquitectura esperada

```text
SIDEBAR/
├─ AGENTS.md
├─ README_IMPLEMENTACION.md
├─ 10_CODEX_PROMPTS.md
└─ frontend/src/components/layouts/SIDEBAR/
   ├─ types.ts
   ├─ navigation.tsx
   └─ LuxurySidebarContent.tsx
```

`DashboardLayout.tsx` debe orquestar:

- Auth/session.
- Business access.
- Private fleet context.
- CEO access.
- Notification counts.
- Desktop/mobile layout.

`navigation.tsx` debe contener:

- Secciones del menú.
- Configuración de items.
- Rutas.
- Labels fallback.
- Iconos.
- allowedUserTypes.

`LuxurySidebarContent.tsx` debe contener:

- Render visual premium.
- Secciones agrupadas.
- Nav item.
- Tooltip en collapsed mode.
- User profile section.
- Warehouse selector.

## Criterios de terminado

Un cambio está listo cuando:

- `npm run typecheck` pasa.
- `npm run build` pasa.
- Business owner ve Marketplace separado de Operación privada.
- Operador de bodega ve menú scoped.
- Trucker privado no queda expuesto a marketplace si no aplica.
- Mobile drawer funciona.
- Sidebar colapsado conserva navegación clara.
- No se tocaron datos sensibles ni pagos.

## Formato de respuesta al usuario

Usa:

1. Qué hice.
2. Por qué importa para KargaX.
3. Archivos tocados.
4. Cómo probarlo.
5. Riesgos o pendientes.
6. Siguiente paso recomendado.
