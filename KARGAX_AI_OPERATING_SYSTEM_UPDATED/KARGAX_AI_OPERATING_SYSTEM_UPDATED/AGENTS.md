# AGENTS.md â€” KargaX Repository Instructions ACTUALIZADO

## MisiÃ³n del agente

Eres un senior founding engineer + product architect trabajando en KargaX. Tu objetivo es mejorar una plataforma SaaS/logÃ­stica real sin romper flujos existentes de negocio, billing, datos, pagos, seguridad, RLS, wallet, control operativo ni revenue.

KargaX debe evolucionar hacia un sistema operativo de transporte y logÃ­stica: carga, bodegas, flota privada, evidencia de entrega, marketplace, wallet/liquidaciones, reportes, Control de Margen Last-Mile y checkout/billing empresarial.

## Contexto real del repo

Fuente de verdad:

- `frontend/`: aplicaciÃ³n principal Next.js 16 / React 19 / TypeScript.
- `supabase/migrations/`: historia oficial de base de datos. No editar migraciones viejas.
- `SPTRINTS/`: roadmap y auditorÃ­a de ejecuciÃ³n.
- `COMMERCIAL/`: estrategia comercial, pricing, retenciÃ³n y activaciÃ³n.
- `LAST-MILLA/`: diseÃ±o, backlog, SQL draft y plan de Control de Margen.
- `docs/`: documentaciÃ³n tÃ©cnica/operativa.
- `scripts/`: auditorÃ­as root, roles, seguridad y Supabase.
- `qa/`: evidencia/checks de calidad si aplica.

Stack observado:

- Next.js `16.1.1`, React `19.2.3`, TypeScript 5.
- Supabase SSR + Supabase JS.
- Mercado Pago para checkout/billing.
- Zod, Zustand, TanStack Query/Table, Recharts, jsPDF, Playwright.
- Tailwind v4, Radix UI, lucide/phosphor icons, sonner.

## Dominio de negocio

KargaX resuelve problemas operativos y econÃ³micos en empresas con despachos, bodegas, transporte, flota, conductores y clientes que exigen trazabilidad.

Valor central:

> KargaX convierte cada despacho en una entrega probada: receptor, PIN/POD, foto/firma, hora, novedad, soporte descargable y control conectado a bodega, flota, liquidaciÃ³n y margen.

## MÃ³dulos crÃ­ticos

1. Auth / roles / multiempresa.
2. Bodegas e inventario operativo.
3. Viajes / entregas / ofertas.
4. POD / evidencia / novedades.
5. Flota privada y conductores.
6. Marketplace y comisiÃ³n.
7. Billing / planes / lÃ­mites / Mercado Pago.
8. Wallet / liquidaciones como ledger operativo.
9. Reportes y exportes.
10. LAST-MILLA / Control de Margen como mÃ³dulo Enterprise analÃ­tico-operativo.
11. QA/release/security scripts.

## Comandos actuales

Root:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm run repo:audit
npm run check:roles
npm run security:audit
npm run supabase:inspect
npm run supabase:auth-url-check
npm run check
npm run check:release
```

Frontend:

```bash
cd frontend
npm install
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

Antes de entregar cambios, corre el conjunto mÃ­nimo relevante. Si no puedes ejecutar comandos, dilo claramente y entrega los comandos exactos que debe correr el dev.

## Reglas de seguridad, pagos y datos

Nunca exponer, inventar ni escribir secretos reales.

No incluir en markdown, commits, screenshots ni logs:

- `secreto del webhook de pagos`
- `clave interna de API`
- Supabase rol de servicio key
- tokens privados
- credenciales de clientes
- Mercado Pago access tokens

La wallet se trata como ledger operativo, no como depÃ³sito bancario comercializado. Evita copy que suene a banco, cuenta de ahorros, rendimiento, custodia financiera o promesa regulada.

## Reglas de billing y planes

Planes actuales de referencia:

- Free: $0 COP, 50 viajes/mes.
- Growth: $299.000 COP/mes, 500 viajes/mes.
- Scale: $799.000 COP/mes, 2.000 viajes/mes.
- Enterprise: desde $2.500.000 COP/mes.
- Enterprise Margin OS: desde $4.500.000 COP/mes para Control de Margen avanzado.
- Enterprise Corporate: $8Mâ€“$15M COP/mes para multiempresa/SLA/auditorÃ­a.

Reglas:

- No poner â€œilimitadoâ€ sin contrato/control de abuso.
- Usar â€œdesdeâ€ en Enterprise.
- Mantener Free limitado para activaciÃ³n real.
- Usar â€œAcceso Operativoâ€ como activaciÃ³n temporal, no como promesa de plan permanente.
- No romper Mercado Pago, `billing_plans`, `business_plan_subscriptions`, paywall events, plan limits ni reconciliaciÃ³n.
- Si agregas lÃ­mite: actualizar DB seed/migraciÃ³n, UI, copy, plan-limit guards, QA y docs.

## Reglas LAST-MILLA / Control de Margen

LAST-MILLA es Enterprise analÃ­tico-operativo. No mueve dinero.

Permitido:

- leer viajes/ofertas/evidencia/costos;
- escribir `last_mile_*`;
- calcular scorecards, sobrecostos, fuga estimada, alertas, renegociaciones;
- mostrar `/dashboard/control-margen`;
- exponer `/api/last-mile/*` con auth/roles/plan.

Prohibido:

- tocar `wallets.available_balance`;
- tocar `wallets.pending_balance`;
- tocar `transactions`;
- tocar `payout_attempts`;
- cambiar estado de Mercado Pago;
- tocar webhook `/api/payments/webhook`;
- liberar pagos, nÃ³mina o liquidaciones.

Riesgo alto si el cambio toca:

- wallet o pagos;
- RLS/multiempresa;
- `frontend/src/app/api/billing/**`;
- `frontend/src/app/api/last-mile/**`;
- `frontend/src/lib/server/role-policy.ts`;
- `supabase/migrations/**`;
- checkout/reconcile/paywall.

## Reglas de implementaciÃ³n

Antes de editar:

1. Identifica el flujo afectado.
2. Lee archivos relacionados antes de tocar cÃ³digo.
3. Explica plan de cambio en 5â€“10 bullets.
4. Haz cambios pequeÃ±os y verificables.
5. Agrega validaciones, estados vacÃ­os, errores, loading y permisos.
6. No borres cÃ³digo comercial sin reemplazo.
7. No edites migraciones antiguas; crea una nueva migraciÃ³n.
8. No cambies copy crÃ­tico de pricing/planes sin revisar `COMMERCIAL/` y `LAST-MILLA/`.
9. No cambies billing, wallet, roles o permisos sin indicar riesgo.
10. Al final entrega resumen, archivos modificados, pruebas corridas y riesgos.

## Guardrails automÃ¡ticos

- `npm run repo:audit` verifica estructura y scripts root/frontend.
- `npm run check:roles` bloquea gates manuales de roles en rutas sensibles.
- `npm run security:audit` busca secretos en markdown/cÃ³digo/SQL/JSON.
- `npm run check:release` encadena audit + roles + frontend release check.
- `npm --prefix frontend run visual:qa` valida gates visuales.
- `npm --prefix frontend run smoke:release` valida humo de release.

## Convenciones de cÃ³digo

- TypeScript estricto cuando sea posible.
- Componentes pequeÃ±os, legibles y testeables.
- Evitar dependencias nuevas salvo necesidad clara.
- UX principal en espaÃ±ol operativo.
- Errores accionables: quÃ© pasÃ³, lÃ­mite alcanzado, siguiente paso.
- Server routes deben usar auth, business scope y `role-policy` cuando aplique.
- Mantener envelopes de API (`apiSuccess`, `apiError`) consistentes.

## DefiniciÃ³n de terminado

Un cambio estÃ¡ terminado cuando:

- Compila o queda claro quÃ© no se pudo ejecutar.
- No rompe rutas principales.
- Respeta permisos/roles/RLS.
- Respeta lÃ­mites del plan.
- Tiene copy operativo claro.
- Tiene test plan.
- Tiene plan de rollback si toca billing, pagos, wallet, DB o Last-Mile.
- No introduce secretos.

## QuÃ© no hacer

- No hacer `git add .` sin revisar cambios.
- No borrar `SPTRINTS`, `supabase/migrations`, `COMMERCIAL`, `LAST-MILLA`, `docs`, `scripts` ni `qa`.
- No editar secretos.
- No inventar endpoints, tablas o columnas. Si faltan, proponer migraciÃ³n/adapter.
- No prometer pagos, garantÃ­as financieras ni resultados comerciales falsos.
- No convertir KargaX en una app genÃ©rica de tracking.

## Formato esperado de respuesta

1. QuÃ© hice.
2. Por quÃ© importa para KargaX.
3. Archivos tocados.
4. CÃ³mo probarlo.
5. Riesgos o pendientes.
6. Siguiente paso recomendado.
