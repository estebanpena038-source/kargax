# 02 — Arquitectura de dominio: POD-MK separado de flota privada

## Modelo de dominio

```txt
KargaX Evidence OS
│
├── Evidence Capture Layer
│   ├── GPS arrival origin/destination
│   ├── Item loading / delivery
│   ├── Photos
│   ├── Notes
│   ├── Rejection reasons
│   ├── Pickup PIN
│   └── Delivery PIN
│
├── POD-MK — Marketplace Evidence
│   ├── Public marketplace offers
│   ├── External trucker accepted by offer application
│   ├── Business owner sees evidence
│   ├── Driver sees his own operational trip
│   └── No private signatures/payroll
│
└── POD-PRIVATE — Private Fleet Evidence
    ├── Internal assigned routes
    ├── Private fleet driver
    ├── Signature capture
    ├── Private events
    ├── Internal settlement/comprobante
    └── No marketplace payout assumptions
```

## Data ownership

| Dato | POD-MK | POD-PRIVATE |
|---|---:|---:|
| `cargo_offers` | Sí, con `is_private_fleet != true` | Sí, con `is_private_fleet = true` |
| `offer_applications` | Sí, para transportador aceptado | No como fuente principal |
| `picking_events` | Sí | Sí, pero semántica privada |
| `trip_photos` | Sí | Sí |
| `trip_signature_evidences` | No | Sí |
| `/api/business/fleet/signatures` | No | Sí |
| `private_fleet_assignment_status` | No | Sí |
| Payroll privado | No | Sí |
| Wallet marketplace | Solo lectura indirecta; no tocar | No mezclar |

## Invariantes de seguridad

Estas reglas no se negocian:

1. `POD-MK` nunca debe listar ofertas privadas.
2. `POD-MK` nunca debe abrir detalle de una oferta privada.
3. `POD-MK` nunca debe consultar firmas privadas.
4. `POD-MK` nunca debe disparar liquidaciones, pagos, wallet ni Mercado Pago.
5. `POD-MK` solo debe leer evidencia de rutas públicas.
6. El business solo ve ofertas donde `cargo_offers.business_id = user.id` o según rol/admin autorizado.
7. El transportador solo puede ver su ruta si está asignado o tiene postulación aceptada.
8. La galería y timeline deben venir de `trip_photos` + `picking_events`.

## Reglas de acceso recomendadas

### Business/admin lista POD-MK

```txt
profile.user_type in ('business', 'admin')
AND cargo_offers.business_id = auth.user.id -- salvo admin
AND coalesce(cargo_offers.is_private_fleet, false) = false
```

### Business/admin detalle POD-MK

```txt
cargo_offers.id = offerId
AND coalesce(cargo_offers.is_private_fleet, false) = false
AND (business_id = auth.user.id OR auth user is admin)
```

### Trucker detalle POD-MK opcional

Solo si se decide permitir que el transportador vea su expediente:

```txt
coalesce(cargo_offers.is_private_fleet, false) = false
AND (
  cargo_offers.assigned_trucker_id = auth.user.id
  OR exists accepted offer_applications for offer_id + trucker_id
)
```

## Por qué no usar “inspecciones”

“Inspección” suena a auditoría manual o checklist interno. El valor comercial de KargaX es más fuerte si se llama:

```txt
Evidencia Digital
POD Marketplace
Expediente de entrega
Cadena de custodia
```

El usuario compra menos “inspecciones” y más “prueba de entrega”.

## Arquitectura recomendada de carpetas

```txt
frontend/src/lib/pod-marketplace/
├── index.ts
├── types.ts
└── api.ts

frontend/src/app/pod-marketplace/
├── page.tsx
└── [offerId]/
    ├── page.tsx
    └── components.tsx

frontend/src/app/inspecciones/
├── page.tsx                # redirect legacy
└── [offerId]/page.tsx      # redirect legacy
```

## Naming técnico

| Actual | Nuevo |
|---|---|
| `InspectionReport` | `MarketplacePodReport` |
| `InspectionPhoto` | `MarketplacePodPhoto` |
| `InspectionSummary` | `MarketplacePodSummary` |
| `InspectionTimelineEvent` | `MarketplacePodTimelineEvent` |
| `getInspectionReport` | `getMarketplacePodReport` |
| `getInspectionList` | `getMarketplacePodList` |
| `/inspecciones` | `/pod-marketplace` |

## Naming de producto

| Contexto | Copy |
|---|---|
| Sidebar | Evidencia Digital MK |
| H1 | Evidencia digital Marketplace |
| Subtitle | POD de cargue, ruta y entrega para rutas públicas. |
| Card CTA | Ver expediente POD |
| Timeline | Cadena de custodia marketplace |
| Photos | Evidencia fotográfica del POD |
| Empty | Aún no hay evidencias marketplace registradas. |
