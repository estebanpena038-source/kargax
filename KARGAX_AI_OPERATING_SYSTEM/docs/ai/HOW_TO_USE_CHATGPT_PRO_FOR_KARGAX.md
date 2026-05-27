# Como usar ChatGPT Pro/Codex como experto para KargaX

## La verdad practica

El poder no esta en pedir "hazme codigo". Esta en crear un sistema donde la IA siempre tenga:

- contexto del producto
- reglas del repo
- rutas importantes
- criterio de exito
- comandos de prueba
- restricciones de seguridad
- workflows repetibles

## Herramientas y para que usarlas

### ChatGPT Projects

Usalo para memoria de producto, comercial, decisiones, docs y contexto compartido. Sube archivos clave y usa instrucciones del proyecto.

### GitHub conectado en ChatGPT

Usalo para leer y analizar codigo conectado. Ideal para preguntas: "donde esta X", "que archivos toca Y", "cita rutas".

### Codex

Usalo para escribir, revisar y shippear codigo. Es la herramienta correcta para cambios reales en repo.

### AGENTS.md

Archivo persistente que Codex lee antes de trabajar. Va en raiz y en subdirectorios criticos.

### Skills

Workflows reutilizables para tareas repetidas: pricing, release QA, debug, feature build, arquitectura.

### Canvas

Usalo para editar documentos o codigo largo con iteraciones visuales. No lo uses como reemplazo de Codex para repo completo.

## Setup recomendado para ti

1. Crea un Project en ChatGPT llamado `KargaX`.
2. Sube:
   - `README.md`
   - `AGENTS.md`
   - `GPT.md`
   - `AI_PROMPTS.md`
   - `COMMERCIAL/*`
   - `docs/ai/*`
3. Conecta GitHub a ChatGPT.
4. Usa Codex para tareas de codigo.
5. Copia `.agents/skills` al repo para que los workflows sean detectables.

## Flujo correcto para programar

### Paso 1: pensamiento

Preguntar:

```text
Analiza esta feature y dime riesgos antes de codificar.
```

### Paso 2: issue tecnico

Preguntar:

```text
Convierte esto en issue tecnico con acceptance criteria y test plan.
```

### Paso 3: implementacion

En Codex:

```text
Implementa el issue siguiendo AGENTS.md. Cambios pequeños, pruebas relevantes, resumen final.
```

### Paso 4: review

```text
Revisa los cambios como CTO. Bloquea si rompe billing, RLS, wallet o UX operacional.
```

### Paso 5: aprendizaje

Si hubo error:

```text
Haz retrospectiva. Que regla agregamos a AGENTS.md o a un Skill para que no pase de nuevo?
```

## Ejemplo real para pricing KargaX

```text
Quiero actualizar los planes de KargaX:
Free 0 / 50 viajes
Growth 299.000 / 500 viajes
Scale 799.000 / 2.000 viajes
Enterprise desde 2.500.000 / volumen personalizado

Primero revisa:
- frontend/src/app/planes/page.tsx
- frontend/src/lib/billing/pricing.ts
- frontend/src/lib/billing/plan-limits.ts
- supabase/migrations

No edites migraciones antiguas.
Dame plan, migracion nueva, cambios frontend y QA checklist.
```

## Señales de que estas usando bien la IA

- La IA menciona archivos concretos.
- La IA pregunta por criterio de exito, no solo escribe codigo.
- Cada cambio trae test plan.
- Las reglas que se repiten pasan a AGENTS.md.
- Los workflows repetidos pasan a Skills.
- El repo cada vez necesita menos contexto manual.

## Señales de mal uso

- Prompts largos pero sin objetivo medible.
- Pedir todo de una vez.
- Aceptar codigo sin entender archivos tocados.
- No correr build/lint.
- No revisar cambios de billing/RLS.
