# HOW_TO_USE_CHATGPT_PRO_FOR_KARGAX.md

## Uso correcto

Usa ChatGPT para estrategia, arquitectura, revisión y prompts. Usa Codex/agente para código con contexto del repo.

## Flujo ideal

1. Pide diagnóstico y arquitectura.
2. Revisa riesgos.
3. Divide en subtareas.
4. Pide diff pequeño.
5. Corre checks.
6. Actualiza documentación si aprendiste algo permanente.

## Qué pegar en un prompt

- Objetivo.
- Usuario afectado.
- Rutas/archivos.
- Restricciones.
- Criterio de éxito.
- Comandos de prueba.
- Riesgos conocidos.

## Reglas para no gastar tokens mal

- No pidas “revisa todo el repo” sin objetivo.
- Pide rutas concretas.
- Usa `AGENTS.md` y skills.
- Para Last-Mile, usa el skill `kargax-last-mile-margin-control`.
- Para release, usa `kargax-release-qa`.
- Para roles/seguridad, usa `kargax-security-role-policy`.
