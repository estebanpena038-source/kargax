# WALLET2.0 — Auditoría CTO y endurecimiento de wallets KargaX

Fecha: 2026-05-26
Repo auditado: `estebanpena038-source/kargax`
Fuentes leídas: repo GitHub, `/WALLET`, `/KARGAX_AI_OPERATING_SYSTEM`, resumen comercial `CLIENTES4.0`.

## Decisión CTO

KargaX no debe operar una wallet única para todo. Debe tener dos carriles financieros separados:

1. **Marketplace / freelancer**
   - Dinero entra por Mercado Pago.
   - El pago aprobado asegura la ruta, pero no paga al camionero todavía.
   - El dinero se libera únicamente cuando la ruta queda completada con evidencia/POD/PIN/firma/foto y sin disputa activa.
   - Puede crear `payout_attempt` automático si hay método de retiro válido y feature flag activo.
   - Es saldo retirable real porque KargaX sí tiene un pago confirmado.

2. **Flota privada / liquidaciones externas**
   - La empresa registra liquidaciones, salarios, gastos o pagos privados.
   - La empresa paga por fuera: banco, Nequi, transferencia, efectivo u otro canal.
   - KargaX registra estado y comprobante.
   - No debe tocar `wallet.available_balance` por defecto.
   - No debe crear retiro automático ni payout de dinero que KargaX no recibió.

## Regla dura

> `wallet.available_balance` solo puede representar dinero recibido/confirmado por KargaX y elegible para retiro. Una liquidación privada con comprobante externo no es saldo retirable.

## Entregables de esta carpeta

- `00_CONTEXTO_KARGAX.md`: función de KargaX y por qué wallet es de alto riesgo.
- `01_AUDITORIA_REPO_REAL.md`: hallazgos contra archivos reales del repo.
- `02_SEPARACION_MARKETPLACE_PRIVADO.md`: lógica exacta de cada wallet/ledger.
- `03_BUGS_RIESGOS_PRIORIZADOS.md`: bugs, severidad, impacto y fix.
- `04_PLAN_IMPLEMENTACION_CTO.md`: commits recomendados para cerrar el flujo.
- `05_MIGRACION_FINAL.sql`: migración propuesta idempotente.
- `06_DIFFS_PROPUESTOS.md`: cambios exactos por archivo.
- `07_QA_RUNBOOK.md`: pruebas unitarias, E2E, regresión y producción controlada.
- `08_RELEASE_ROLLBACK.md`: activación, límites, reversión y operación.
- `09_COPY_PRODUCTO.md`: copy seguro para UI.
- `10_PROMPT_CODEX_EJECUCION.md`: prompt listo para Codex/dev.
- `code/`: skeletons TypeScript/SQL listos para copiar y adaptar al repo.

## Estado de implementación recomendado

No se debe activar payout real todavía. El orden seguro es:

1. Migración de rails y estados.
2. Bloqueo de flota privada para que `external_proof` no toque wallet.
3. Respuesta de `/api/wallet` separada en `marketplaceWallet` y `privateFleetLedger`.
4. Validación de retiro solo contra saldo marketplace elegible.
5. Worker de payouts en dry-run/manual.
6. Release marketplace al cierre real de ruta.
7. Proveedor real únicamente en producción controlada.

## Riesgo alto

Todo cambio aquí toca dinero, Mercado Pago, service role, RLS, multiempresa, wallet y percepción financiera del usuario. No activar sin QA y conciliación.
