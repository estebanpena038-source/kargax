# 11 · Reporte de pruebas

## Ejecutado en este entorno

- Inspección de ZIPs locales: `CLIENTES4.0.zip`, `KARGAX_AI_OPERATING_SYSTEM.zip`, `WALLET.zip`.
- Auditoría de repo por GitHub connector sobre archivos críticos.
- Generación de migración, scripts, APIs, componente y documentación.
- Validación sintáctica local de scripts Node con `node --check`: OK para `_supabase-loader`, `seed`, `verify`, `diff`, `validate`, `export`.
- Generación del ZIP final.

## No ejecutado por falta de entorno/credenciales

- `supabase db push` contra staging/producción.
- `npm install`, `npm run lint`, `npm run typecheck`, `npm run build` sobre repo completo.
- `npm run seed:geo` real con `SUPABASE_SERVICE_ROLE_KEY`.
- Pruebas E2E con navegador.

## Comandos obligatorios para el fundador/equipo

```bash
cd frontend
npm install
npm run lint
npm run typecheck
npm run build
npm run smoke:release
npm run test:algorithms
```

```bash
supabase db lint
supabase migration list
supabase db push --dry-run
```

```bash
cd frontend
SUPABASE_URL="https://<staging>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>" npm run seed:geo -- --dry-run
SUPABASE_URL="https://<staging>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>" npm run seed:geo
SUPABASE_URL="https://<staging>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>" npm run verify:geo
SUPABASE_URL="https://<staging>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>" npm run diff:geo
```
