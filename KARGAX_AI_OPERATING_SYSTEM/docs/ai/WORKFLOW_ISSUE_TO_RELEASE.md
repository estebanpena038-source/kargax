# Workflow KargaX: de idea a release con IA

## 0. Intake

Define:

- problema
- usuario
- impacto revenue/retencion
- ruta del producto
- metrica de exito

## 1. Research en repo

Pedir a ChatGPT/Codex:

```text
Busca en el repo donde vive este flujo. Dame rutas y resumen antes de proponer codigo.
```

## 2. Arquitectura

Usar skill `kargax-architecture-audit`.

Checklist:

- modulos afectados
- datos necesarios
- permisos
- limites por plan
- UX states
- riesgos

## 3. Issue tecnico

Crear issue con:

- alcance MVP
- no alcance
- archivos
- migraciones
- API contracts
- acceptance criteria
- pruebas

## 4. Implementacion

Usar skill `kargax-feature-builder`.

Reglas:

- cambios pequeños
- commits logicos
- no romper billing/RLS
- no editar migraciones viejas

## 5. QA

Usar skill `kargax-release-qa`.

Minimo:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run check
```

## 6. Review CEO/CTO

Preguntar:

```text
Revisa este cambio desde revenue, retencion, seguridad y operacion logistica. Que bloquearias?
```

## 7. Release

- merge pequeno
- deploy
- smoke test
- revisar logs
- probar flujo manual

## 8. Comercializacion

Si la feature afecta ventas:

- actualizar `COMMERCIAL/`
- crear mensaje de venta
- crear demo script
- medir activacion

## 9. Aprendizaje

Actualizar:

- `AGENTS.md` si fue regla permanente
- `SKILL.md` si fue workflow repetido
- `docs/ai/KARGAX_ARCHITECTURE_MAP.md` si fue conocimiento nuevo
