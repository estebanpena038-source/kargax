# Source map â€” rutas y evidencias revisadas

## Alcance real de esta auditorÃ­a

Se revisÃ³ el repo pÃºblico `estebanpena038-source/kargax` a nivel de estructura, documentos, scripts y archivos crÃ­ticos. No se ejecutÃ³ build local ni tests reales contra producciÃ³n porque no hubo clon/entorno con secrets ni acceso a DB productiva. Las conclusiones de â€œlisto/no listoâ€ dependen de evidencia de repo y deben cerrarse con los comandos del checklist.

## LimitaciÃ³n importante de escritura

El conector de escritura de GitHub resolviÃ³ el repo solicitado como `estebanpena038-source/curaZZ`, no como `estebanpena038-source/kargax`. Por eso no se creÃ³ esta carpeta directamente en GitHub. Es mÃ¡s seguro entregar la carpeta como artefacto para copiarla manualmente al repo correcto.

## Rutas raÃ­z revisadas

```text
README.md
package.json
AGENTS.md
KARGAX_AI_OPERATING_SYSTEM/
SPTRINTS/
ALGORITMOS/
FE-REGLAS/
WALLET/
WALLET2.0/
COMMERCIAL/
docs/
scripts/
supabase/
frontend/
```

## Frontend revisado

```text
frontend/README.md
frontend/package.json
frontend/.env.example
frontend/next.config.ts
frontend/vercel.json
frontend/src/app/
frontend/src/app/billetera/page.tsx
frontend/src/app/api/wallet/withdraw/route.ts
frontend/src/proxy.ts
frontend/src/lib/server/security-headers.ts
frontend/src/lib/server/cors.ts
frontend/src/lib/server/route-auth.ts
frontend/src/lib/business-roles.ts
```

## Scripts revisados

```text
scripts/repo-audit.mjs
scripts/security-audit.mjs
scripts/check-role-policy.mjs
scripts/supabase-auth-url-check.mjs
scripts/supabase-inspect.mjs
frontend/scripts/release-check.mjs
```

## Supabase revisado

```text
supabase/migrations/
supabase/seeds/
supabase/templates/
```

Se observÃ³ una superficie amplia de migraciones: usuarios, perfiles, ofertas, fotos, pagos, wallet, fuel advances, equipo/MFA, billing, holding, RLS hardening, flota privada, multicountry, payout methods/attempts, dispatch control tower, pricing, tracking, role presets, launch pricing, payroll, idempotencia wallet, algoritmos, last-mile y margen.

## KARGAX_AI_OPERATING_SYSTEM revisado

```text
KARGAX_AI_OPERATING_SYSTEM/README.md
KARGAX_AI_OPERATING_SYSTEM/AI_PROMPTS.md
KARGAX_AI_OPERATING_SYSTEM/GPT.md
KARGAX_AI_OPERATING_SYSTEM/INSTALL_INSTRUCTIONS.md
KARGAX_AI_OPERATING_SYSTEM/.agents/skills/
KARGAX_AI_OPERATING_SYSTEM/.codex/
KARGAX_AI_OPERATING_SYSTEM/docs/ai/
KARGAX_AI_OPERATING_SYSTEM/COMMERCIAL/
```

ConclusiÃ³n: es un paquete drop-in Ãºtil, pero se debe decidir si se instala en raÃ­z o se mantiene como kit interno para evitar duplicidad/confusiÃ³n.

## FE-REGLAS revisado

La carpeta FE-REGLAS define reglas estrictas de responsive y UX. Puntos clave para producciÃ³n:

- no overflow horizontal,
- mobile 320px,
- sidebar no tapa contenido,
- tablas mobile,
- estados con texto+icono+color,
- wallet/billing/liquidaciones son high-risk,
- no tocar wallet/RLS/roles/billing sin tratarlo como riesgo alto.

## Archivos de mayor riesgo

| Archivo | Por quÃ© importa |
|---|---|
| `frontend/src/app/billetera/page.tsx` | Wallet/retiros/copy financiero/UI tipo tarjeta. |
| `frontend/src/app/api/wallet/withdraw/route.ts` | Retiro de saldo, AAL2, datos bancarios, idempotencia. |
| `frontend/src/proxy.ts` | Rutas pÃºblicas, auth redirect, rate limiting, CORS/security wrapper. |
| `frontend/src/lib/server/cors.ts` | Origins permitidos y credenciales. |
| `frontend/src/lib/server/security-headers.ts` | CSP, HSTS, permisos, frame protection. |
| `frontend/src/lib/server/route-auth.ts` | Supabase admin, auth guards, MFA/admin/CEO. |
| `frontend/src/lib/business-roles.ts` | Matriz de permisos de empresa. |
| `frontend/scripts/release-check.mjs` | Gate de env, DB shapes, buckets, feature flags, typecheck, visual QA. |
| `scripts/check-role-policy.mjs` | Evita drift de permisos manuales. |
| `scripts/security-audit.mjs` | Busca patrones de secrets. |
| `scripts/supabase-auth-url-check.mjs` | Evita redirects a localhost/staging. |

## QuÃ© falta revisar con entorno real

- Resultado real de `npm run build`.
- Resultado real de `npm run lint`.
- Resultado real de `npm run check`.
- Resultado real de `npm run check:release`.
- Supabase producciÃ³n/staging real.
- Variables de entorno reales.
- Webhook MercadoPago real/sandbox.
- Dominio y SSL real.
- Logs de producciÃ³n.
- ConfiguraciÃ³n de Vercel.
- ConfiguraciÃ³n de Supabase Auth en dashboard.
- Policies RLS efectivas en DB.

## PrÃ³xima lectura recomendada por el dev

1. `Produccion/AUDITORIA_PRODUCCION.md`
2. `Produccion/IMPLEMENTACION.md`
3. `frontend/src/app/billetera/page.tsx`
4. `frontend/src/proxy.ts`
5. `frontend/src/app/api/payments/webhook/route.ts`
6. `frontend/src/app/api/jobs/payouts/process/route.ts`
7. `frontend/src/lib/server/route-auth.ts`
8. `frontend/src/lib/server/role-policy.ts`
9. `supabase/migrations/000_run_all.sql`
10. Ãºltimas migraciones `044` a `048` y timestamped migrations.
