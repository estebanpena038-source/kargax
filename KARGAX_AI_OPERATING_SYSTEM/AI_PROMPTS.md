# AI_PROMPTS.md — Prompts de alto apalancamiento para KargaX

No uses prompts vacios tipo "mejora esto". Usa prompts con contexto, objetivo, restricciones, archivos, criterio de exito y pruebas.

## Prompt maestro para programacion

```text
Actua como founding engineer senior de KargaX.

Objetivo: [describe la feature o bug]

Contexto del producto:
KargaX es un SaaS logistico para bodegas, flota privada, entregas, evidencia POD, marketplace, wallet/liquidaciones, billing y reportes.

Archivos/rutas que debes revisar primero:
- [ruta 1]
- [ruta 2]
- [ruta 3]

Restricciones:
- No romper billing, Mercado Pago, plan limits ni RLS.
- No editar migraciones antiguas; crear nueva migracion si hay schema/data change.
- Mantener UX en espanol.
- No inventar tablas/columnas; confirma contra el repo.

Entregame:
1. Diagnostico.
2. Plan de implementacion.
3. Archivos a editar.
4. Diff/codigo.
5. Comandos de prueba.
6. Riesgos.
7. Siguiente paso.
```

## Prompt para revisar arquitectura antes de tocar codigo

```text
Audita esta tarea antes de implementarla:
[TAREA]

Quiero que revises el repo como arquitecto. Identifica:
- Que modulos toca.
- Que riesgos hay en billing, seguridad, RLS, wallet, datos multiempresa y UX.
- Que archivos debo leer antes.
- Que migraciones serian necesarias.
- Que pruebas manuales y automaticas debe pasar.
- Que version minima puedo lanzar sin sobreconstruir.
No escribas codigo todavia. Dame decision tecnica y plan.
```

## Prompt para crear issue tecnico perfecto

```text
Convierte esta idea en un issue tecnico listo para un dev:
[IDEA]

Incluye:
- Problema.
- Usuario afectado.
- Impacto en revenue/retencion.
- Alcance MVP.
- Fuera de alcance.
- Archivos probables.
- Migraciones probables.
- API/contracts.
- UI states.
- Edge cases.
- Acceptance criteria.
- Test plan.
- Riesgos.
```

## Prompt para debug serio

```text
Tengo este error:
[ERROR/SCREENSHOT/LOG]

Contexto:
- Ruta:
- Usuario/rol:
- Plan:
- Accion que hice:
- Resultado esperado:
- Resultado real:

Haz debug como senior engineer:
1. Hipotesis ordenadas por probabilidad.
2. Archivos a revisar.
3. Comandos o logs a correr.
4. Fix minimo.
5. Fix robusto.
6. Como probar que no rompi nada.
```

## Prompt para pricing y retencion

```text
Actua como CEO SaaS B2B y arquitecto de monetizacion.

Quiero cambiar pricing/limites de KargaX para aumentar activacion y conversion a pago sin regalar la operacion.

Situacion actual:
[pega precios/limites]

Objetivo:
- Mas empresas activadas.
- Mas entregas reales cerradas con evidencia.
- Upgrade natural a Growth/Scale.
- No romper checkout ni plan limits.

Entregame:
- Pricing recomendado.
- Limites por plan.
- Copy exacto para UI.
- Migracion SQL conceptual.
- Cambios en frontend.
- Riesgos.
- KPIs para medir.
```

## Prompt para review de PR

```text
Revisa esta PR como CTO de KargaX.

Prioriza:
1. Seguridad y secretos.
2. RLS/datos multiempresa.
3. Billing/planes/Mercado Pago.
4. Wallet/liquidaciones.
5. UX operativa en espanol.
6. Performance.
7. Deuda tecnica.

Entrega:
- Blockers.
- Comentarios importantes.
- Nitpicks.
- Pruebas faltantes.
- Decision: merge / changes requested.
```

## Prompt para que ChatGPT use GitHub conectado

```text
Usa el repo conectado de KargaX. Busca primero los archivos relacionados con [FEATURE/BUG].

No respondas desde memoria. Cita rutas concretas y dime que evidencia encontraste.
Luego proponme el cambio minimo seguro y los comandos de prueba.
```
