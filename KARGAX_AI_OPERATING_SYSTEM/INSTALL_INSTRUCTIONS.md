# Instrucciones para instalar en el repo KargaX

1. Descomprime `KARGAX_AI_OPERATING_SYSTEM.zip`.
2. Copia TODO el contenido de la carpeta `KARGAX_AI_OPERATING_SYSTEM` a la raiz del repo `C:\kargax2`.
3. Asegurate de que queden estos archivos en la raiz:

```text
C:\kargax2\AGENTS.md
C:\kargax2\GPT.md
C:\kargax2\AI_PROMPTS.md
C:\kargax2\.agents\skills\...
C:\kargax2\.codex\config.example.toml
C:\kargax2\frontend\AGENTS.md
C:\kargax2\supabase\AGENTS.md
C:\kargax2\COMMERCIAL\AI_ENGINEERING_PLAN.md
C:\kargax2\docs\ai\...
```

4. Ejecuta:

```bash
cd C:\kargax2
git status
git add AGENTS.md GPT.md AI_PROMPTS.md .agents .codex frontend/AGENTS.md supabase/AGENTS.md COMMERCIAL/AI_ENGINEERING_PLAN.md docs/ai INSTALL_INSTRUCTIONS.md
git commit -m "Add AI operating system for KargaX"
git push
```

5. En ChatGPT:

- Crea un Project llamado `KargaX`.
- Sube `GPT.md`, `AGENTS.md`, `AI_PROMPTS.md`, `COMMERCIAL/AI_ENGINEERING_PLAN.md` y `docs/ai/*`.
- Pega el contenido de `GPT.md` si creas un Custom GPT.

6. En Codex:

- Abre el repo.
- Pide: `Resume las instrucciones cargadas y dime que archivos son fuente de verdad en KargaX.`
- Luego usa los skills segun tarea.
