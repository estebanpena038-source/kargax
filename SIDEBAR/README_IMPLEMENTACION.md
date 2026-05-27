# SIDEBAR — Rediseño luxury Apple-style para KargaX

## Decisión CTO

Mover el sidebar de un archivo gigante y una lista plana a una arquitectura separada en:

```text
frontend/src/components/layouts/SIDEBAR/
├─ types.ts
├─ navigation.tsx
└─ LuxurySidebarContent.tsx
```

`DashboardLayout.tsx` queda como orquestador de auth, permisos, bodega activa, notificaciones y responsive layout. La navegación, agrupación visual y UI premium viven dentro de `SIDEBAR/`.

## Qué resuelve

1. Separa claramente `Marketplace` de `Operación privada`.
2. Mantiene rutas existentes para no romper el producto.
3. Conserva reglas de roles actuales: business, trucker, admin, warehouse operator y CEO admin.
4. Usa dependencias existentes del FE: `framer-motion`, `lucide-react`, Radix Tooltip vía `@/components/ui`, Tailwind y componentes UI internos.
5. Evita tocar wallet, billing, Mercado Pago, Supabase, RLS o migraciones.

## Nueva jerarquía del menú

### Centro de mando
- Inicio.

### Operación privada
- Bodegas.
- Equipo.
- Flota privada.
- Inteligencia.
- Control de margen.
- Viajes asignados para transportista.

### Marketplace
- Cargas disponibles / Explorar marketplace.
- Publicar en marketplace.
- Ofertas publicadas.
- Evidencia marketplace.
- Postulaciones marketplace.
- Mis postulaciones.

### Dinero y límites
- Billetera operativa.
- Planes y límites.

### Gobierno
- Corporativo.
- Notificaciones.
- Admin.
- CEO KargaX.

### Cuenta
- Mi perfil.
- Configuración.
- Ayuda.

## UX aplicada

- Sidebar con vidrio suave, sombra lateral controlada y fondo tipo panel premium.
- Estados activos con pill negro de alto contraste.
- Secciones con microcopy operativo para bajar ansiedad.
- Collapsed mode con tooltips reales, no solo `title` HTML.
- Mobile drawer con backdrop blur y cierre por ESC.
- Bodega activa queda dentro del sidebar, no mezclada con marketplace.
- El header cambia a “KargaX Command” para dar sensación de centro de mando.

## Archivos incluidos

```text
SIDEBAR/frontend/src/components/layouts/DashboardLayout.tsx
SIDEBAR/frontend/src/components/layouts/SIDEBAR/types.ts
SIDEBAR/frontend/src/components/layouts/SIDEBAR/navigation.tsx
SIDEBAR/frontend/src/components/layouts/SIDEBAR/LuxurySidebarContent.tsx
```

## Cómo aplicar en tu repo local sobre main

Desde la raíz `C:\kargax2`:

```bash
git checkout main
git pull origin main
mkdir -p frontend/src/components/layouts/SIDEBAR
```

Copia estos archivos del paquete `SIDEBAR/` a las mismas rutas dentro del repo:

```text
frontend/src/components/layouts/DashboardLayout.tsx
frontend/src/components/layouts/SIDEBAR/types.ts
frontend/src/components/layouts/SIDEBAR/navigation.tsx
frontend/src/components/layouts/SIDEBAR/LuxurySidebarContent.tsx
```

Luego prueba:

```bash
npm run lint
npm run typecheck
npm run build
npm run check:release
```

Si prefieres probar solo FE:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Deploy Vercel

Solo después de build limpio:

```bash
vercel --prod
```

Si tu proyecto usa configuración de Vercel desde root:

```bash
vercel --prod
```

Si el proyecto de Vercel apunta a `frontend/`:

```bash
cd frontend
vercel --prod
```

## QA manual obligatorio

1. Business owner ve: Centro de mando, Operación privada, Marketplace, Dinero y límites, Gobierno y Cuenta.
2. Business operator de bodega ve navegación scoped a la bodega activa.
3. Trucker marketplace ve cargas, postulaciones, viajes asignados y billetera.
4. Trucker de flota privada no ve marketplace abierto si `isPrivateFleetDriver` está activo.
5. Admin ve admin y CEO solo si `/api/admin/ceo-access` autoriza.
6. Sidebar colapsado muestra tooltips y badges.
7. Mobile drawer abre/cierra, cierra al navegar y cierra con ESC.
8. Cambio de bodega redirige a `/bodegas/:id`.
9. `/billetera` sigue cargando sin tocar wallet ni retiros.
10. `/planes` sigue cargando sin tocar checkout ni Mercado Pago.

## Riesgos

- Riesgo medio: es refactor visual de layout global; afecta todas las rutas protegidas que usan `DashboardLayout`.
- Riesgo bajo en datos: no toca Supabase, migraciones, APIs, wallet ni billing.
- Riesgo UX: labels nuevos dependen de fallback si no existen llaves i18n. El código conserva `labelKey` para traducción futura.

## Rollback

```bash
git checkout -- frontend/src/components/layouts/DashboardLayout.tsx
rm -rf frontend/src/components/layouts/SIDEBAR
git status
```

## Prompts IA incluidos

Esta carpeta ahora incluye prompts para trabajar la función igual que módulos recientes como WALLET:

```text
SIDEBAR/AGENTS.md
SIDEBAR/AI_IMPLEMENTATION_PROMPT.md
SIDEBAR/10_CODEX_PROMPTS.md
```

Uso recomendado:

1. Pega primero `AI_IMPLEMENTATION_PROMPT.md` si quieres que una IA implemente todo el sidebar.
2. Usa `10_CODEX_PROMPTS.md` por fases: auditoría, arquitectura, separación marketplace, UI luxury, QA y deploy.
3. Mantén `AGENTS.md` dentro de `SIDEBAR/` como instrucciones permanentes para futuros agentes.
