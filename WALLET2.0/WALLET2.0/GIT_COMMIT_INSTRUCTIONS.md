# Git instructions

No pude escribir directamente en GitHub desde esta sesión porque el conector disponible permite leer/fetch/search, pero no expone una acción de `create/update file` o `commit`.

Para agregar esta carpeta al repo:

```bash
cd C:\kargax2
mkdir WALLET2.0
# copiar el contenido de esta carpeta WALLET2.0 al repo

git status
git add WALLET2.0
git commit -m "Add WALLET2.0 wallet rails hardening audit"
git push origin main
```

Luego implementar por commits técnicos:

```bash
git checkout -b wallet2-rails-hardening
# aplicar migración/código por commits pequeños
git add supabase/migrations frontend/src/lib/server/private-fleet-payroll.ts frontend/src/app/api/wallet frontend/src/lib/server/payouts frontend/src/lib/server/wallet
git commit -m "Harden wallet rails for marketplace and private fleet"
npm run check
```
