# Prompt maestro — Implementar SIDEBAR Luxury KargaX

```text
Actúa como un equipo élite compuesto por CTO founding engineer, arquitecto SaaS B2B logístico, Product Manager de operaciones, frontend senior, security engineer y QA engineer.

Objetivo:
Implementar un sidebar premium estilo Apple para KargaX, separando Marketplace de Operación privada, sin romper roles, permisos, bodega activa, wallet, billing, Mercado Pago, Supabase ni rutas existentes.

Contexto del producto:
KargaX es un SaaS logístico B2B con carga, bodegas, flota privada, marketplace, evidencia digital/POD, wallet/liquidaciones, reportes, billing y operación multiempresa.

Archivos que debes revisar primero:
- AGENTS.md
- README.md
- DESING.md si existe
- frontend/package.json
- frontend/src/components/layouts/DashboardLayout.tsx
- frontend/src/lib/warehouses/client.ts
- frontend/src/lib/warehouses/types.ts
- frontend/src/features/auth/store/authStore.ts
- frontend/src/features/notifications/store/notificationStore.ts

Carpeta objetivo:
Crear frontend/src/components/layouts/SIDEBAR/

Archivos a crear:
- frontend/src/components/layouts/SIDEBAR/types.ts
- frontend/src/components/layouts/SIDEBAR/navigation.tsx
- frontend/src/components/layouts/SIDEBAR/LuxurySidebarContent.tsx

Archivo a editar:
- frontend/src/components/layouts/DashboardLayout.tsx

Implementación requerida:
1. Extraer tipos de navegación a types.ts.
2. Extraer configuración de navegación a navigation.tsx.
3. Crear LuxurySidebarContent.tsx con UI premium.
4. Separar secciones: Centro de mando, Operación privada, Marketplace, Dinero y límites, Gobierno, Cuenta.
5. Mantener filtros de roles existentes.
6. Mantener filtros por businessAccess y warehouse capabilities.
7. Mantener privateFleetContext para no mostrar marketplace abierto a transportista privado.
8. Mantener canAccessCeo para CEO console.
9. Mantener badges de notificaciones, postulaciones y viajes.
10. Mantener WarehouseSelector y cambio de bodega activa.
11. Mantener mobile drawer con cierre por click fuera, navegación y Escape.
12. Usar framer-motion, lucide-react, Tooltip, Tailwind y cn.

Restricciones críticas:
- No cambiar hrefs.
- No tocar wallet ni /billetera salvo QA visual.
- No tocar /planes, checkout, Mercado Pago ni billing.
- No tocar Supabase migrations.
- No inventar columnas, tablas, endpoints ni permisos.
- No meter dependencias nuevas sin justificar.
- No hacer deploy si build falla.

Criterios de aceptación:
- Business owner entiende Marketplace separado de Operación privada.
- Business operator de bodega ve navegación scoped a su bodega activa.
- Trucker marketplace ve cargas, postulaciones, viajes asignados y billetera.
- Trucker privado no ve marketplace abierto cuando isPrivateFleetDriver=true.
- Admin ve Admin y CEO solo si tiene permiso.
- Sidebar colapsado conserva navegación con tooltips.
- Mobile drawer funciona sin overflow horizontal.
- npm run typecheck pasa.
- npm run build pasa.

Entrega:
1. Diagnóstico.
2. Plan de implementación.
3. Archivos editados.
4. Diff/código.
5. Pruebas.
6. Riesgos.
7. Siguiente paso.
```
