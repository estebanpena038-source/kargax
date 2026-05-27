# frontend/AGENTS.md — Reglas para la app Next.js de KargaX

Estas reglas aplican cuando trabajes dentro de `frontend/`.

## Stack

- Next.js 16.
- React 19.
- TypeScript.
- Supabase SSR / Supabase JS.
- Mercado Pago.
- TanStack Query/Table.
- Zod, Zustand, Recharts, jsPDF.
- Tailwind/Radix/lucide.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
```

## Rutas sensibles

Revisar antes de modificar:

- `src/app/planes/page.tsx`: UI de planes, checkout, limites, paywall y pricing publico.
- `src/lib/billing/pricing.ts`: constantes de comision/currency.
- `src/lib/billing/plan-limits.ts`: errores, labels y copy de limite.
- `src/app/api/billing/**`: checkout, reconciliacion, eventos de pago.
- `src/lib/warehouses/**`: cliente, tipos, operaciones de bodega/flota/facturacion.
- `src/lib/server/**`: server-side guards y consultas.

## Reglas UX

- La aplicacion debe sonar operativa, no como marketing vacio.
- Mantener lenguaje en espanol.
- Cada estado de error debe decir que paso y que hacer.
- En planes, mostrar claramente precio, limite, beneficio y proximo paso.
- En paywall, empujar al plan recomendado sin bloquear de forma confusa.

## Reglas de pricing

- Free nunca debe parecer plan suficiente para una empresa con operacion seria.
- Enterprise debe decir "Desde" y "volumen personalizado".
- Evitar "ilimitado" salvo que el backend tenga guardas y contrato.
- Si actualizas `PublicPricingPage`, tambien revisar planes reales desde `billing_plans`.
- Si cambias limites, agregar migracion en `supabase/migrations/`.

## Testing minimo

Despues de tocar frontend:

```bash
npm run lint
npm run typecheck
npm run build
```

Si tocas billing/checkout, revisar manualmente:

1. Usuario sin login ve pricing publico.
2. Usuario business/admin ve planes internos.
3. Plan actual no permite checkout innecesario.
4. Upgrade pago abre Mercado Pago.
5. Downgrade solo ocurre si el uso cabe en el plan menor.
6. Mensajes de limite apuntan al plan correcto.
