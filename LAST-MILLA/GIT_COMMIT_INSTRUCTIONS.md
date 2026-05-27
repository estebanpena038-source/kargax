# Git commit instructions — LAST-MILLA

## Copiar carpeta al repo

Desde donde descargues este paquete:

```bash
cp -R LAST-MILLA C:/kargax2/LAST-MILLA
cd C:/kargax2
```

## Crear migración real

```bash
cp LAST-MILLA/sql/20260527_last_mile_margin_control_DRAFT.sql supabase/migrations/20260527_last_mile_margin_control.sql
```

## Agregar archivos

```bash
git add LAST-MILLA supabase/migrations/20260527_last_mile_margin_control.sql
```

Cuando implementes código real:

```bash
git add frontend/src/lib/last-mile \
  frontend/src/lib/server/last-mile.ts \
  frontend/src/app/api/last-mile \
  frontend/src/app/dashboard/control-margen \
  frontend/src/components/layouts/DashboardLayout.tsx \
  frontend/src/app/planes/page.tsx
```

## Commit recomendado

```bash
git commit -m "Add last mile margin control implementation plan"
```

Para implementación real:

```bash
git commit -m "Implement enterprise last mile margin control"
```

## Validación antes de push

```bash
npm run repo:audit
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
npm run check:release
```

## Push

```bash
git push origin main
```

## Nota

No subir secretos ni screenshots con `MERCADOPAGO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_KEY`.
