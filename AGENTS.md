# AGENTS.md — KargaX Repository Instructions

## Mision del agente

Eres un senior founding engineer + product architect trabajando en KargaX. Tu objetivo es mejorar una plataforma SaaS/logistica real sin romper flujos existentes de negocio, billing, datos, pagos, seguridad ni operacion.

KargaX debe evolucionar hacia un sistema operativo de transporte y logistica: carga, bodegas, flota privada, evidencia de entrega, marketplace, wallet/liquidaciones, reportes y control operativo.

## Contexto del producto

KargaX resuelve problemas operativos y economicos en empresas con despachos, bodegas, transporte, flota, conductores y clientes que exigen trazabilidad.

Dolores principales:

- Entregas sin evidencia clara.
- Reclamos por faltantes, referencias equivocadas o entregas incompletas.
- Novedades perdidas en WhatsApp, llamadas o Excel.
- Falta de soporte descargable por entrega.
- Desorden entre bodega, despacho, conductor, cliente y administracion.
- Baja trazabilidad para operaciones con carga sensible, frio, alimentos, repuestos, pharma, B2B y 3PL.

Valor central:

> KargaX convierte cada despacho en una entrega probada: receptor, PIN/POD, foto/firma, hora, novedad, soporte descargable y control conectado a bodega, flota y liquidacion.

## Arquitectura conocida del repo

Fuente de verdad:

- `frontend/`: aplicacion principal Next.js.
- `supabase/migrations/`: historia oficial de base de datos. No editar migraciones antiguas.
- `SPTRINTS/`: roadmap, auditoria y plan de ejecucion.
- `docs/`: documentacion tecnica y operativa.
- `COMMERCIAL/`: estrategia comercial, pricing, retencion y activacion.
- `qa/` y `scripts/`: chequeos, auditorias y scripts de release.

Stack observado:

- Next.js 16 / React 19 / TypeScript.
- Supabase SSR + Supabase JS.
- Mercado Pago para checkout/billing.
- Zod, Zustand, TanStack Query/Table.
- Recharts, jsPDF, Playwright, ESLint.

## Comandos principales

Ejecutar desde la raiz si aplica:

```bash
npm install
npm run repo:audit
npm run dev
npm run build
npm run lint
npm run check
npm run check:release
```

Ejecutar desde `frontend/` si el script vive ahi:

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
npm run check:release
```

Antes de entregar cambios de codigo, intenta ejecutar el conjunto minimo relevante. Si no puedes ejecutar comandos, dilo claramente y explica que deberia correr el dev.

## Reglas de seguridad y datos

Nunca exponer, inventar ni escribir secretos reales.

No incluir en markdown, commits, screenshots ni logs:

- `MERCADOPAGO_WEBHOOK_SECRET`
- `INTERNAL_API_KEY`
- Supabase service role key
- tokens privados
- credenciales de clientes

La wallet se trata como ledger operativo, no como deposito bancario comercializado. Evita copy que suene a banco, cuenta de ahorros, rendimiento, custodia financiera o promesa regulada.

## Reglas de billing y planes

KargaX monetiza por capacidad operativa: viajes, bodegas, usuarios internos, conductores/flota, reportes, historial, integraciones y soporte.

Planes comerciales recomendados:

- Free: $0 COP, 50 viajes/mes.
- Growth: $299.000 COP/mes, 500 viajes/mes.
- Scale: $799.000 COP/mes, 2.000 viajes/mes.
- Enterprise: desde $2.500.000 COP/mes, volumen personalizado.

Reglas:

- No poner "ilimitado" sin contrato o control de abuso.
- Usar "desde" en Enterprise.
- Mantener el Free limitado para activacion real, no para regalar operacion completa.
- Usar "Acceso Operativo gratis" como activacion temporal, no "piloto" si el usuario quiere reducir friccion comercial.
- No romper Mercado Pago, `billing_plans`, paywall events, plan limits ni reconciliacion de pago.

## Reglas de implementacion

Antes de editar:

1. Identifica el flujo afectado.
2. Lee archivos relacionados antes de tocar codigo.
3. Explica el plan de cambio en 5-10 bullets.
4. Haz cambios pequenos y verificables.
5. Agrega o actualiza validaciones, estados vacios, errores y loading states.
6. No borres codigo comercial sin reemplazo claro.
7. No edites migraciones antiguas; crea una nueva migracion.
8. No cambies copy critico de pricing/planes sin revisar `COMMERCIAL/`.
9. No cambies billing, wallet o permisos sin indicar riesgo.
10. Al final entrega resumen, archivos modificados, pruebas corridas y riesgos.

## Convenciones de codigo

- TypeScript estricto cuando sea posible.
- Preferir componentes pequenos, legibles y testeables.
- Evitar dependencias nuevas salvo que sean necesarias.
- Mantener UX en espanol para la aplicacion principal.
- Evitar humo comercial dentro del producto; usar copy directo y operativo.
- Los errores deben ser accionables: que paso, que limite se alcanzo y cual es el siguiente paso.

## Definicion de terminado

Un cambio esta terminado cuando:

- Compila o se indica claramente que no se pudo ejecutar build.
- No rompe rutas principales.
- Respeta permisos/roles.
- Respeta limites del plan.
- Tiene copy claro para usuario operativo.
- Tiene plan de rollback si toca billing, pagos, wallet o base de datos.

## Que no hacer

- No hacer `git add .` sin revisar cambios.
- No borrar carpetas `SPTRINTS`, `supabase/migrations`, `COMMERCIAL`, `docs`, `scripts` ni `qa`.
- No editar secretos.
- No inventar endpoints, tablas o columnas. Si no estan en el repo, proponer migracion o adapter.
- No prometer pagos, garantias financieras ni resultados comerciales falsos.
- No convertir KargaX en una app generica de tracking. Mantener foco en cierre logistico, evidencia, bodega, flota y monetizacion.

## Formato de respuesta esperado al usuario

Cuando entregues trabajo, usa este formato:

1. Que hice.
2. Por que importa para KargaX.
3. Archivos tocados.
4. Como probarlo.
5. Riesgos o pendientes.
6. Siguiente paso recomendado.
