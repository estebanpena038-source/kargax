# frontend/AGENTS.md — Reglas para Next.js/React/TypeScript en KargaX

## Stack actual

- Next.js 16.1.1.
- React 19.2.3.
- TypeScript 5.
- Tailwind v4.
- Supabase SSR + Supabase JS.
- Mercado Pago.
- TanStack Query/Table, Zustand, Zod, Recharts, jsPDF, Playwright.

## Comandos

```bash
cd frontend
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
npm run test:algorithms
npm run visual:qa
npm run visual:qa:browser
npm run smoke:release
npm run debug:payment
```

## Reglas UI

- Copy en español claro, operativo y accionable.
- Estados obligatorios: loading, error, vacío, éxito, sin permisos, paywall.
- Evitar “humo”. KargaX vende cierre logístico, evidencia y control operativo.
- Mantener responsive mobile/tablet/desktop.
- Cualquier pantalla de plan debe explicar límite, uso actual y siguiente acción.

## Billing/planes

Rutas y archivos sensibles:

- `frontend/src/app/planes/page.tsx`
- `frontend/src/lib/billing/pricing.ts`
- `frontend/src/lib/billing/plan-limits.ts`
- `frontend/src/app/api/billing/**`
- `frontend/src/app/api/payments/**`

Reglas:

- No cambiar checkout sin QA manual.
- No cambiar copy de Enterprise sin revisar `COMMERCIAL/` y `LAST-MILLA/`.
- `recordPlanLimitEvent` nunca debe bloquear upgrade path.
- Plan limit errors deben tener `featureKey`, uso, límite, recommendedPlan y checkoutPath.

## LAST-MILLA / Control de Margen

Rutas actuales:

- Page: `frontend/src/app/dashboard/control-margen/page.tsx`.
- Componentes: `frontend/src/components/last-mile/**`.
- Cliente/tipos: `frontend/src/lib/last-mile/**`.
- API: `frontend/src/app/api/last-mile/**`.

Reglas:

- UI es Enterprise/operativa, no financiera bancaria.
- No prometer ahorro garantizado; usar “fuga estimada”, “sobrecosto observado”, “oportunidad”.
- Los errores 402/403 deben mostrar paywall o falta de permisos, no stack trace.
- Trucker no debe ver tablero empresarial/admin.
- No tocar wallet, payouts ni pagos desde componentes Last-Mile.

## API routes

- Usar auth y business scope.
- Usar `apiSuccess`, `apiError`, `getRequestId` donde aplique.
- No hacer gates manuales de owner/admin en rutas sensibles; usar `role-policy`.
- Respetar `check-role-policy.mjs`.

## Definition of done frontend

- `npm run typecheck` pasa.
- `npm run build` pasa o se explica bloqueo.
- `npm run visual:qa` si se tocó UI crítica.
- `npm run smoke:release` antes de release.
- No hay secretos ni logs sensibles.
