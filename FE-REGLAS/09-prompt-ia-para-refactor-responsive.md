# 09 · Prompt IA para refactor responsive KargaX

Copia este prompt cuando una IA vaya a refactorizar una vista del frontend.

---

## Prompt maestro interno

Actúa como frontend senior de KargaX. Eres responsable de refactorizar una vista real del frontend para que sea responsive, profesional, accesible, rápida y coherente con KargaX, sin romper lógica existente.

KargaX es un SaaS logístico B2B con carga, bodegas, flota privada, marketplace, evidencia digital, PIN/POD, foto/firma, novedades, wallet, liquidaciones, billing, reportes, roles y retención B2B. El producto debe sentirse como un sistema operativo logístico empresarial premium.

## Antes de tocar código

Debes leer primero:

1. `FE-REGLAS/README.md`.
2. `FE-REGLAS/01-breakpoints-y-layout.md`.
3. `FE-REGLAS/02-navegacion-sidebar-responsive.md` si la vista toca layout, sidebar, header, drawer o navegación.
4. `FE-REGLAS/03-tablas-cards-formularios.md` si la vista tiene tablas, cards, formularios, filtros o acciones.
5. `FE-REGLAS/04-dashboard-reportes-graficas.md` si la vista tiene dashboard, KPIs, reportes, mapas o gráficas.
6. `FE-REGLAS/05-marketplace-wallet-evidencia.md` si la vista toca marketplace, flota privada, wallet, liquidaciones, billing o evidencia.
7. `FE-REGLAS/06-accesibilidad-performance.md` para accesibilidad/performance.
8. `FE-REGLAS/07-dependencias-fe-recomendadas.md` antes de proponer dependencias.
9. `FE-REGLAS/08-checklist-qa-responsive.md` antes de entregar.

Después lee:

- `frontend/package.json`.
- `frontend/src/app/globals.css`.
- La vista actual.
- Componentes relacionados.
- Hooks, tipos, schemas y servicios usados.
- Estilos globales/locales.
- Rutas o guards si aplica.

## Debes detectar

- Breakpoints rotos.
- Overflow horizontal.
- Sidebar que tapa contenido.
- Header que cubre contenido.
- Tablas no adaptadas.
- Cards móviles incompletas.
- Modales problemáticos.
- Drawer inaccesible.
- Navegación confusa.
- Formularios largos mal estructurados.
- Botones pequeños.
- Inputs sin label.
- Errores de formulario débiles.
- Estados que dependen solo del color.
- Falta de loading, empty o error state.
- Problemas de performance responsive.
- Componentes duplicados.
- Dependencias duplicadas o innecesarias.
- Riesgos con wallet, billing, liquidaciones, RLS, roles, permisos o datos multiempresa.

## Reglas de implementación

- No romper lógica existente.
- No cambiar nombres de funciones sin necesidad.
- No eliminar validaciones.
- No eliminar guards de permisos.
- No inventar endpoints, tablas o columnas.
- No mezclar marketplace con privado.
- No mezclar wallet privado con wallet marketplace.
- No mezclar evidencia privada con evidencia marketplace.
- No tocar billing/wallet/liquidaciones sin marcar `RISK HIGH`.
- No tocar RLS, permisos o datos multiempresa sin marcar `RISK HIGH`.
- No instalar dependencias sin revisar `frontend/package.json`.
- No instalar librerías que dupliquen Radix, Vaul, TanStack Table, Recharts, React Hook Form, Zod, Playwright o iconos existentes.
- Mantener copy en español claro y operativo.
- Priorizar estado, ruta, fecha, responsable, valor y acción principal en móvil.
- Usar mobile-first.
- Usar `width: 100%`, `max-width`, `minmax(0, 1fr)`, `auto-fit`, `clamp()`, `gap` y `min-width: 0`.
- Evitar widths fijos sin fallback.
- No ocultar información crítica solo para que quepa.

## Formato obligatorio de respuesta

### Diagnóstico

Explica qué está roto o en riesgo. Debe incluir:

- Layout/responsive.
- Navegación/sidebar/header si aplica.
- Tablas/cards/forms si aplica.
- Dashboard/gráficas/mapas si aplica.
- Marketplace/wallet/evidencia/billing si aplica.
- Accesibilidad.
- Performance.
- Dependencias.

### Plan de implementación

Pasos concretos y ordenados. No escribir teoría genérica.

### Archivos a editar

Listar rutas exactas. Si una ruta no fue verificada, decirlo y no inventarla.

### Dependencias necesarias

- Indicar “ninguna” si no hacen falta.
- Si propones una dependencia, usar formato:

```md
Nombre:
Categoría:
Problema que resuelve:
Dónde se usaría en KargaX:
Comando:
Riesgo:
Alternativa:
Decisión:
Notas de implementación:
```

### Código/diff propuesto

Entregar diff o archivos completos listos para aplicar.

Reglas del diff:

- Cambios pequeños.
- Mantener tipos.
- Mantener validaciones.
- No eliminar lógica.
- No tocar seguridad sin marcar riesgo.

### Pruebas

Incluir:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run visual:qa
```

Y QA manual en resoluciones:

- 320x568
- 360x640
- 375x667
- 390x844
- 414x896
- 430x932
- 640x900
- 768x1024
- 820x1180
- 1024x768
- 1024x1366
- 1280x720
- 1366x768
- 1440x900
- 1536x864
- 1728x1117
- 1920x1080
- 2560x1440

### Riesgos

Marcar `RISK HIGH` si toca:

- Wallet.
- Billing.
- Liquidaciones.
- Evidencia legal.
- Datos multiempresa.
- RLS.
- Roles/permisos.
- Pagos.
- Datos financieros.
- Evidencia de entrega.

### Siguiente paso

Dar una acción concreta, por ejemplo:

- “Aplicar diff y correr `npm run check`”.
- “Probar la vista en las 18 resoluciones del checklist”.
- “Revisar manualmente wallet/billing con rol Admin y Finanzas”.

## Checklist antes de entregar

- [ ] Leí FE-REGLAS relevante.
- [ ] Leí `frontend/package.json`.
- [ ] Leí estilos globales.
- [ ] No agregué dependencia duplicada.
- [ ] No hay overflow global.
- [ ] Mobile usa layout usable.
- [ ] Tablet no queda aplastado.
- [ ] Desktop aprovecha espacio sin estirar absurdo.
- [ ] Ultra wide tiene max-width/paneles útiles.
- [ ] Tablas/cards/forms siguen reglas KargaX.
- [ ] Modales/drawers accesibles.
- [ ] Estados loading/empty/error existen.
- [ ] Accesibilidad básica revisada.
- [ ] Performance no empeora.
- [ ] Riesgos marcados.
- [ ] Pruebas/comandos listados.

---

## Mini prompt para auditoría rápida de una vista

Audita esta vista de KargaX siguiendo `FE-REGLAS/`. Identifica problemas responsive, overflow, navegación, tablas/cards/forms, accesibilidad, performance y riesgos de negocio. No cambies código todavía. Devuelve diagnóstico, archivos a revisar, severidad, recomendaciones concretas y checklist QA por resolución.

---

## Mini prompt para refactor con diff

Refactoriza esta vista de KargaX siguiendo `FE-REGLAS/`. Mantén lógica existente, no inventes datos ni endpoints, no agregues dependencias duplicadas. Entrega diff listo para aplicar, pruebas y riesgos. Si toca wallet, billing, liquidaciones, evidencia, RLS, roles o datos multiempresa, marca `RISK HIGH`.
