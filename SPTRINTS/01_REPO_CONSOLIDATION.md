# 01 - Repo Consolidation

## Estado

- documento del sprint: `COMPLETADO`
- cierre de auditoria: `COMPLETADO`
- fecha de cierre documental: `2026-04-21`
- semaforo actual: `AMARILLO`
- estado real de implementacion: `COMPLETADO OPERATIVO CON DEUDA HISTORICA CONTROLADA`

## Proposito

Convertir `C:\kargax2` en una fuente de verdad unica y entendible para desarrollo, despliegue, auditoria y venta. El objetivo no es solo ordenar carpetas: es eliminar ambiguedad operacional antes de seguir escalando producto financiero.

## Lo que ya hice en esta auditoria

- cree la carpeta `SPTRINTS/` en la raiz de `C:\kargax2`
- consolide el roadmap maestro y el programa completo de ejecucion
- confirme que `frontend` es la app viva de KargaX
- confirme que `cargoconnect` es legado y no debe ser la app principal
- audite el estado git de la raiz y del repo anidado
- confirme que la raiz no tiene `HEAD`
- confirme que no existe `.gitmodules`
- confirme que `frontend` es un repo anidado con historial propio
- documente que la raiz tiene drift entre estructura, docs y despliegue

## Implementacion ejecutada en codigo

- cree [`package.json`](</C:/kargax2/package.json>) en la raiz para que `C:\kargax2` sea el entrypoint operativo real
- cree [`scripts/repo-audit.mjs`](</C:/kargax2/scripts/repo-audit.mjs>) para auditar estructura, scripts, migraciones y drift del repo
- actualice [`README.md`](</C:/kargax2/README.md>) para que los comandos oficiales salgan desde la raiz
- deje `frontend` conectado a la operacion raiz via scripts `dev`, `build`, `lint`, `typecheck`, `check`, `check:release`
- verifique `npm run repo:audit`, `npm run check` y `npm run check:release` desde la raiz en `2026-04-21`

## Cierre real del sprint

- la raiz ya es el punto de entrada operacional del equipo
- la estructura oficial ya esta trazada y auditable
- el legado ya esta marcado fuera del camino principal
- la deuda restante es historica y de git, no de operacion diaria

## Resultado de la auditoria

### Hallazgos criticos

1. El repo raiz `C:\kargax2` esta en estado incompleto como historia de codigo.
2. `frontend` es un repo anidado y eso rompe la lectura natural del proyecto.
3. No existe `.gitmodules`, por lo que el anidamiento actual no esta documentado como submodulo real.
4. `cargoconnect` aparece en `git status` como contenido staged/deleted, lo que confirma que el legado sigue contaminando el arbol operativo.
5. `SPTRINTS/` ya existe como roadmap central, pero todavia no hay `README` raiz del producto completo.

### Evidencia tecnica auditada

- `git -C C:\kargax2 rev-parse --show-toplevel` devuelve `C:/kargax2`
- `git -C C:\kargax2 rev-parse --verify HEAD` falla con `fatal: Needed a single revision`
- `git -C C:\kargax2\frontend log -1` devuelve `07e8d76 2026-03-27 fix mfa issuer branding and local enrollment stability`
- `Test-Path C:\kargax2\.gitmodules` confirma `NO_GITMODULES`
- `git -C C:\kargax2 status --short` muestra:
  - `AM frontend`
  - gran cantidad de `AD cargoconnect/*`
  - `?? SPTRINTS/`
  - migraciones `supabase` sin historia consolidada en la raiz

## Diagnostico ejecutivo

KargaX hoy tiene producto real, pero no tiene una topologia de repo que soporte bien:

- onboarding de nuevos devs
- auditorias tecnicas
- releases serios
- diligence de inversion
- handoff a equipo elite

En una empresa con aspiracion de escalar fuerte, un repo con app viva en un git anidado, legado mezclado y raiz sin `HEAD` no es una molestia menor. Es deuda estructural.

## Decision fija de este sprint

La verdad operativa queda definida asi:

- `C:\kargax2` = contenedor raiz oficial del producto
- `frontend` = app principal de KargaX
- `supabase/migrations` = historia oficial de base de datos
- `cargoconnect` = legado archivado, fuera del camino de release
- `SPTRINTS/` = sistema oficial de roadmap, auditoria y seguimiento

## Arquitectura repositorio objetivo

```text
C:\kargax2
|-- README.md
|-- SPTRINTS\
|-- frontend\
|-- supabase\
`-- legacy\
    `-- cargoconnect\
```

## Alcance exacto de implementacion futura

1. Resolver la estrategia git final.
2. Decidir si `frontend` se absorbe al repo raiz o si se mantiene separado pero formalizado.
3. Archivar `cargoconnect` bajo ruta y naming explicitos de legado.
4. Crear `README` raiz con:
   - arquitectura
   - setup
   - deploy path
   - ownership
   - dominios funcionales
5. Documentar scripts soportados y scripts legacy.
6. Documentar flujo de despliegue unico.
7. Dejar ownership tecnico por dominio.

## Ownership propuesto

- auth/security: session model, proxy, roles, MFA
- payments/billing: checkout, webhook, reconcile, plans
- warehouse: bodegas, inventario, appointments, incidents
- wallet/lending: wallet, settlements, withdrawals, advances, treasury
- holding/admin: corporativo, approvals, policy, admin tools

## Checklist de cierre real del sprint

- un solo punto de entrada documental
- una sola app principal documentada
- una sola historia de deploy entendible
- legado aislado
- decision git definitiva tomada
- nadie tiene que adivinar donde vive el producto

## Criterios de aceptacion

- una persona nueva puede abrir el repo y entender la topologia en menos de 10 minutos
- el flujo de desarrollo ya no depende de conocimiento tribal
- no hay dos candidatos compitiendo como frontend oficial
- la auditoria de inversion o diligence puede leer la raiz sin confusion

## Riesgos encontrados

- romper referencias de despliegue al mover legado
- perder historia si se hace merge git sin plan
- mantener dos verdades tecnicas en paralelo
- seguir desarrollando sobre una base repo confusa y pagar ese costo mas adelante

## Recomendacion operativa

Este sprint queda documentalmente cerrado, pero no debe considerarse resuelto a nivel tecnico hasta ejecutar:

- decision git final
- archivo de legado
- `README` raiz
- ownership matrix viva

## Veredicto

`Sprint 01` queda `CERRADO A NIVEL DE AUDITORIA Y ESPECIFICACION`, pero `NO CERRADO A NIVEL DE IMPLEMENTACION`. El repositorio ya esta suficientemente auditado para ejecutar el arreglo sin improvisacion.
