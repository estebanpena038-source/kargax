# KargaX AI Operating System

Paquete drop-in para convertir KargaX en un repo que ChatGPT Pro/Codex pueda entender, modificar, revisar y escalar con menos prompts vacios.

## Que contiene

```text
/
├─ AGENTS.md                         # Instrucciones siempre activas para Codex/agents en la raiz del repo
├─ GPT.md                            # Instrucciones listas para pegar en un Custom GPT de KargaX
├─ AI_PROMPTS.md                     # Prompts operativos de alto nivel para programacion, arquitectura y growth
├─ .codex/config.example.toml        # Config ejemplo para Codex local/proyecto
├─ .agents/skills/                   # Skills reutilizables para workflows repetibles
│  ├─ kargax-architecture-audit/
│  ├─ kargax-feature-builder/
│  ├─ kargax-billing-pricing/
│  ├─ kargax-release-qa/
│  ├─ kargax-debugger/
│  └─ kargax-commercial-growth/
├─ frontend/AGENTS.md                # Reglas especificas para Next/React/TS y UI
├─ supabase/AGENTS.md                # Reglas especificas para migraciones, RLS y datos
├─ COMMERCIAL/AI_ENGINEERING_PLAN.md # Plan de uso de ChatGPT Pro/Codex para KargaX
└─ docs/ai/
   ├─ KARGAX_ARCHITECTURE_MAP.md
   ├─ HOW_TO_USE_CHATGPT_PRO_FOR_KARGAX.md
   ├─ WORKFLOW_ISSUE_TO_RELEASE.md
   └─ SOURCES.md
```

## Instalacion recomendada

Copia el contenido de esta carpeta en la raiz del repo `C:\kargax2`.

```bash
cd C:\kargax2
# copiar archivos y carpetas desde KARGAX_AI_OPERATING_SYSTEM a la raiz

git add AGENTS.md GPT.md AI_PROMPTS.md .codex .agents frontend/AGENTS.md supabase/AGENTS.md COMMERCIAL/AI_ENGINEERING_PLAN.md docs/ai
git commit -m "Add AI operating system for KargaX engineering"
git push
```

## Regla mental

- `AGENTS.md` = reglas permanentes del repo.
- `.agents/skills/*/SKILL.md` = workflows repetibles bajo demanda.
- `GPT.md` = comportamiento de tu Custom GPT en ChatGPT.
- `AI_PROMPTS.md` = prompts de founder/CTO para pedir trabajo serio.
- `COMMERCIAL/AI_ENGINEERING_PLAN.md` = como usar la IA todos los dias para construir, vender y no romper KargaX.

