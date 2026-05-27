# AI Engineering Plan para KargaX

## Decision CEO

KargaX debe usar ChatGPT Pro/Codex como un sistema operativo de construccion, no como un chat para prompts sueltos.

La estrategia correcta:

1. Repo con instrucciones persistentes: `AGENTS.md`.
2. Workflows repetibles: `.agents/skills/*/SKILL.md`.
3. Custom GPT para producto/comercial: `GPT.md`.
4. Prompts de alto nivel: `AI_PROMPTS.md`.
5. Ciclo diario: issue -> plan -> diff -> pruebas -> release -> aprendizaje -> actualizar instrucciones.

## Por que esto importa

KargaX toca flujos sensibles:

- billing y Mercado Pago
- planes y limites
- RLS / multiempresa
- bodegas e inventario
- flota privada y conductores
- entregas y evidencia
- wallet/liquidaciones
- marketplace/comisiones

Sin instrucciones, la IA puede hacer cambios bonitos pero peligrosos. Con AGENTS + Skills + prompts operativos, la IA trabaja como un dev que conoce el negocio.

## Como usar ChatGPT Pro / Codex cada dia

### 1. Para pensar producto

Usa ChatGPT normal o Proyecto de ChatGPT.

Prompt:

```text
Actua como CEO/CTO de KargaX. Quiero mejorar [feature].
Analiza impacto en revenue, retencion, UX operativa, deuda tecnica y seguridad.
No escribas codigo. Dame decision, MVP y riesgos.
```

### 2. Para revisar repo

Usa GitHub conectado o Codex.

Prompt:

```text
Usa el repo de KargaX. Busca los archivos relacionados con [feature/bug].
No respondas desde memoria. Dame rutas concretas, riesgos y plan de cambio.
```

### 3. Para implementar

Usa Codex.

Prompt:

```text
Implementa el MVP de [feature] siguiendo AGENTS.md.
Haz cambios pequeños, no rompas billing/RLS/Mercado Pago, y corre los checks relevantes.
Al final dame resumen, archivos, pruebas y riesgos.
```

### 4. Para revisar antes de merge

Prompt:

```text
Revisa estos cambios como CTO de KargaX.
Busca bugs, RLS rota, billing roto, copy confuso, riesgos de datos y pruebas faltantes.
No seas amable: bloquea si algo puede romper produccion.
```

### 5. Para actualizar conocimiento

Cada vez que la IA se equivoque dos veces, actualizar:

- `AGENTS.md` si es regla permanente.
- un `SKILL.md` si es workflow repetible.
- `docs/ai/KARGAX_ARCHITECTURE_MAP.md` si es conocimiento del repo.

## Rutina semanal

### Lunes: planeacion

- Elegir 1 feature de revenue/retencion.
- Pedir arquitectura antes de codigo.
- Convertirla en issue tecnico.

### Martes-Miercoles: implementacion

- Codex implementa en pasos pequenos.
- Tu revisas cada diff.
- No aceptar cambios grandes sin test.

### Jueves: QA y pricing/producto

- Ejecutar release checks.
- Revisar UX y copy.
- Validar que no rompa activacion Free/Growth/Scale.

### Viernes: comercial + aprendizaje

- Usar lo construido en demos reales.
- Registrar objeciones.
- Actualizar `COMMERCIAL/` y prompts.

## Reglas para no quemar el plan Pro

- No pidas "revisa todo el repo" cada vez. Pide rutas y objetivo.
- Primero pide plan; luego implementacion.
- Usa AGENTS/Skills para no repetir contexto.
- Divide tareas grandes en 3-5 subtareas.
- Usa Codex para codigo y ChatGPT normal para estrategia/copy/ventas.
- Pide siempre comandos de prueba.
- Mantén el contexto vivo en un Proyecto de ChatGPT llamado "KargaX".

## Prompts prohibidos por baja calidad

- "Arregla esto."
- "Mejora mi app."
- "Hazlo profesional."
- "Revisa todo."
- "Crea una feature completa como Uber."

## Prompts buenos

- "Arregla el paywall de planes. Primero lee `frontend/src/lib/billing/plan-limits.ts` y `frontend/src/app/planes/page.tsx`. No cambies checkout. Entrega diff y test plan."
- "Crea una migracion idempotente para actualizar billing_plans con estos precios. No edites migraciones viejas."
- "Audita si el Free de 50 viajes y Growth de 500 viajes generan upgrade natural. Dame cambios de UI y backend."

## KPI de uso de IA

Medir cada semana:

- features entregadas
- bugs introducidos por IA
- bugs evitados por review de IA
- tiempo de issue a release
- cambios con test plan
- mejoras comerciales creadas
- prompts convertidos en AGENTS/Skills

## Meta

Que KargaX pueda construir mas rapido que competidores, pero sin romper la confianza del cliente logistico.
