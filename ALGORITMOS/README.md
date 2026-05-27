# ALGORITMOS — KargaX Intelligence OS

Carpeta generada para aterrizar algoritmos inteligentes sobre el repo real de KargaX.

## Documentos

1. `00_CONTEXTO_KARGAX.md` — mapa del sistema, módulos, roles, flujos, riesgos y oportunidades.
2. `01_MAPA_DE_ALGORITMOS.md` — catálogo completo de algoritmos por módulo con datos, archivos, tablas, lógica, pseudocódigo, riesgos y QA.
3. `02_PRIORIZACION_CTO.md` — decisión CTO por fases P0/P1/P2, qué no hacer y roadmap 30/90 días.
4. `03_IMPLEMENTACION_TECNICA.md` — arquitectura propuesta, carpetas, servicios, hooks, componentes, APIs, migraciones y patrón de ejecución.

## Alcance de lectura

La investigación se conectó a rutas reales del repo y a los ZIPs operativos adjuntos. Cuando una tabla, endpoint o archivo no quedó confirmado en los archivos leídos, el documento lo marca como **faltante** o **pendiente de localizar**, y propone migración nueva en `supabase/migrations/`.

## Principio CTO

KargaX no necesita empezar con ML pesado. La primera capa profesional debe ser **inteligencia determinística trazable**: reglas, scores, snapshots, alertas y recomendaciones con datos existentes. Después de capturar historial suficiente, se puede evolucionar a predicción estadística/ML sin romper wallet, billing, RLS ni multiempresa.

Generado: 2026-05-27T10:53:11.075407+00:00


## Prompts IA

- `04_PROMPTS_IA_IMPLEMENTACION.md`: prompts listos para Codex/Cursor/ChatGPT para implementar los algoritmos P0 de forma segura.
