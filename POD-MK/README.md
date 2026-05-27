# POD-MK — Evidencia Digital Marketplace de KargaX

## Decisión CTO

**Inspecciones debe desaparecer como concepto de producto.** Lo que hoy aparece como `Inspecciones` debe convertirse en **Evidencia Digital Marketplace**, internamente **POD-MK**.

La decisión correcta no es mezclarlo con la evidencia digital de flota privada. La evidencia digital es el paraguas; debajo hay dos carriles aislados:

```txt
Evidencia Digital / POD
├── POD-PRIVATE / Flota privada
│   ├── Rutas internas de empresa
│   ├── Firma de despacho y firma de receptor
│   ├── trip_signature_evidences
│   ├── eventos privados de flota
│   └── liquidación interna / comprobantes, NO wallet marketplace
└── POD-MK / Marketplace público
    ├── Rutas públicas del marketplace
    ├── Oferta aceptada por transportador externo
    ├── cargo_offers + offer_applications
    ├── picking_events + trip_photos
    └── PIN/POD de pickup y delivery, sin firma privada obligatoria
```

## Qué se entrega en esta carpeta

| Documento | Uso |
|---|---|
| `00_DECISION_CTO.md` | Decisión de producto y arquitectura. |
| `01_INVESTIGACION_REPO.md` | Hallazgos del repo y fuentes leídas. |
| `02_ARQUITECTURA_DOMINIO.md` | Separación de dominios privado vs marketplace. |
| `03_IMPLEMENTACION_FRONTEND.md` | Plan exacto para rutas, componentes, copy y navegación. |
| `04_IMPLEMENTACION_SUPABASE_RLS.md` | Seguridad, RLS, índices y migración opcional. |
| `05_CONTRATOS_API_DATOS.md` | Contratos TypeScript/API para POD-MK. |
| `06_DIFF_GUIDE_CODEX.md` | Guía de diff para dev/IA/Codex. |
| `07_QA_RUNBOOK.md` | Pruebas automáticas y QA manual. |
| `08_COPY_UX.md` | Copy final en español operativo. |
| `09_RIESGOS_ROLLBACK.md` | Riesgos críticos y rollback. |
| `10_PROMPT_DEV_IA.md` | Prompt listo para otra IA/dev. |

## Resumen ejecutivo

La implementación debe ser un **fork/rebrand del módulo actual `inspecciones`**, porque ese módulo ya consulta las fuentes correctas del marketplace: `cargo_offers`, `picking_events`, `trip_photos`, manifiesto y transportador asignado. La flota privada tiene otra capa: firmas, eventos privados, payroll/comprobantes y reglas de acceso internas. Por eso **no se debe copiar lógica privada hacia marketplace**.

## Resultado esperado

- Nuevo módulo visible: **Evidencia Digital MK**.
- Nueva ruta principal: `/pod-marketplace`.
- Nueva ruta detalle: `/pod-marketplace/[offerId]`.
- Legacy redirects:
  - `/inspecciones` -> `/pod-marketplace`
  - `/inspecciones/[offerId]` -> `/pod-marketplace/[offerId]`
- Nuevo lib: `frontend/src/lib/pod-marketplace/`.
- Filtro fuerte: `is_private_fleet != true` en lista y detalle.
- Cero dependencia de `trip_signature_evidences` o `/api/business/fleet/signatures`.
- Cero cambio en wallet/liquidaciones Mercado Pago.

## Orden recomendado

1. Crear `frontend/src/lib/pod-marketplace/` copiando y renombrando `frontend/src/lib/inspections/`.
2. Crear rutas `frontend/src/app/pod-marketplace/` copiando y renombrando `frontend/src/app/inspecciones/`.
3. Añadir filtro anti-flota-privada en API.
4. Cambiar navegación de `Inspecciones` a `Evidencia Digital MK`.
5. Dejar redirects legacy en `/inspecciones`.
6. Agregar CTA “Ver evidencia” en `Mis Ofertas` para rutas marketplace con estado operativo.
7. Ejecutar QA.

## Comandos mínimos

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run check
```
