# INSTALL_OR_UPDATE.md — Aplicación segura del paquete actualizado

## Objetivo

Actualizar `KARGAX_AI_OPERATING_SYSTEM` y, opcionalmente, sincronizar sus instrucciones al root del repo para que ChatGPT/Codex trabajen con el estado real del código.

## Pasos recomendados

```bash
cd C:\kargax2

git status

# Reemplazar/actualizar la carpeta del paquete
# Copia esta carpeta descargada como KARGAX_AI_OPERATING_SYSTEM

# Sincronizar instrucciones al repo si quieres que los agentes las lean siempre
copy KARGAX_AI_OPERATING_SYSTEM\AGENTS.md AGENTS.md
copy KARGAX_AI_OPERATING_SYSTEM\GPT.md GPT.md
copy KARGAX_AI_OPERATING_SYSTEM\AI_PROMPTS.md AI_PROMPTS.md
xcopy KARGAX_AI_OPERATING_SYSTEM\.agents .agents /E /I /Y
xcopy KARGAX_AI_OPERATING_SYSTEM\.codex .codex /E /I /Y
copy KARGAX_AI_OPERATING_SYSTEM\frontend\AGENTS.md frontend\AGENTS.md
copy KARGAX_AI_OPERATING_SYSTEM\supabase\AGENTS.md supabase\AGENTS.md
xcopy KARGAX_AI_OPERATING_SYSTEM\docs\ai docs\ai /E /I /Y
copy KARGAX_AI_OPERATING_SYSTEM\COMMERCIAL\AI_ENGINEERING_PLAN.md COMMERCIAL\AI_ENGINEERING_PLAN.md
```

## Checks obligatorios

```bash
npm run repo:audit
npm run check:roles
npm run security:audit
npm run check
npm run check:release
npm --prefix frontend run visual:qa
npm --prefix frontend run smoke:release
```

## Commit sugerido

```bash
git add KARGAX_AI_OPERATING_SYSTEM AGENTS.md GPT.md AI_PROMPTS.md .agents .codex frontend/AGENTS.md supabase/AGENTS.md docs/ai COMMERCIAL/AI_ENGINEERING_PLAN.md
git commit -m "Update KargaX AI operating system with Last-Mile, QA and security rules"
git push
```

## Rollback

```bash
git restore KARGAX_AI_OPERATING_SYSTEM AGENTS.md GPT.md AI_PROMPTS.md .agents .codex frontend/AGENTS.md supabase/AGENTS.md docs/ai COMMERCIAL/AI_ENGINEERING_PLAN.md
```
