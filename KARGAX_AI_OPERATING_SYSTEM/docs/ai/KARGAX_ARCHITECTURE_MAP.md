# KargaX Architecture Map para agentes IA

## Resumen ejecutivo

KargaX es un SaaS logistico B2B para empresas con bodegas, flota, despachos, transportadores, evidencia de entrega, marketplace, wallet/liquidaciones, planes y reportes.

No es solo tracking. Es cierre logistico: convertir cada entrega en un soporte verificable y accionable.

## Problema que resuelve

Empresas con operacion logistica pierden tiempo y dinero por:

- entregas sin soporte
- fotos sueltas en WhatsApp
- novedades no centralizadas
- pedidos incompletos sin evidencia
- reclamos dificiles de responder
- falta de trazabilidad por conductor/ruta/bodega
- procesos manuales para liquidacion o facturacion

## Modulos del producto

### 1. Auth / roles

Usuarios business/admin, posibles roles internos, conductores, transportadores.

Riesgo: datos multiempresa y permisos.

### 2. Bodegas

Gestion operativa de sedes/bodegas, inventario visual, ubicaciones, recibos y despachos.

Riesgo: limites por plan, multi-bodega, permisos por equipo.

### 3. Viajes / entregas

Creacion, asignacion, seguimiento y cierre de entregas.

Riesgo: evidencia incompleta, estados inconsistentes, reportes equivocados.

### 4. POD / evidencia

PIN/POD, receptor, hora, foto/firma, novedades y soporte descargable.

Riesgo: archivos, privacidad, trazabilidad, integridad.

### 5. Flota privada

Conductores privados/fidelizados, asignacion, cierre operativo.

Riesgo: limites por plan y experiencia movil/PWA.

### 6. Marketplace

Viajes externos y comision de marketplace.

Constante observada: marketplace commission 8%, private fleet commission 0%, currency COP.

### 7. Billing / planes

Planes Free/Growth/Scale/Enterprise, limites por bodegas, usuarios, viajes y conductores. Checkout con Mercado Pago.

Riesgo alto: no romper cobros, reconciliacion, action_state, paywalls.

### 8. Wallet / liquidaciones

Ledger operativo, gastos, pagos/liquidaciones y reportes.

Riesgo alto: copy financiero regulatorio, auditoria, integridad.

### 9. Reportes

Analitica, exportes, soporte para operaciones, cliente y gerencia.

Riesgo: datos incorrectos o no filtrados por empresa.

## Archivos/rutas prioritarias

- `README.md`
- `frontend/package.json`
- `frontend/src/app/page.tsx`
- `frontend/src/app/planes/page.tsx`
- `frontend/src/lib/billing/pricing.ts`
- `frontend/src/lib/billing/plan-limits.ts`
- `frontend/src/lib/warehouses/types.ts`
- `frontend/src/lib/warehouses/client.ts`
- `frontend/src/lib/server/warehouses.ts`
- `frontend/src/app/api/billing/**`
- `supabase/migrations/**`
- `COMMERCIAL/**`
- `SPTRINTS/**`

## Reglas de cambio

- Cambios de schema: nueva migracion.
- Cambios de pricing: UI + DB seed + COMMERCIAL.
- Cambios de checkout: QA manual obligatorio.
- Cambios de wallet: marcar riesgo alto.
- Cambios de copy: mantener enfoque operacional, no hype.

## MVP tecnico para cada feature

Antes de construir algo grande, exigir:

1. Usuario objetivo.
2. Dolor operativo.
3. Evento de valor.
4. Ruta del producto.
5. Datos necesarios.
6. Limite/plan afectado.
7. Test manual.
8. Metricas.
