# 06 — Guía de diff para Codex/dev

## Objetivo del diff

Crear módulo `POD-MK` copiando el módulo actual de inspecciones, renombrándolo a evidencia digital marketplace, y dejando redirects legacy.

## Preparación

Desde raíz del repo:

```bash
git checkout -b feature/pod-marketplace-evidencia-digital
```

## Comandos de copia sugeridos

```bash
mkdir -p frontend/src/lib/pod-marketplace
cp frontend/src/lib/inspections/index.ts frontend/src/lib/pod-marketplace/index.ts
cp frontend/src/lib/inspections/types.ts frontend/src/lib/pod-marketplace/types.ts
cp frontend/src/lib/inspections/api.ts frontend/src/lib/pod-marketplace/api.ts

mkdir -p frontend/src/app/pod-marketplace/[offerId]
cp frontend/src/app/inspecciones/page.tsx frontend/src/app/pod-marketplace/page.tsx
cp frontend/src/app/inspecciones/[offerId]/page.tsx frontend/src/app/pod-marketplace/[offerId]/page.tsx
cp frontend/src/app/inspecciones/[offerId]/components.tsx frontend/src/app/pod-marketplace/[offerId]/components.tsx
```

## Reemplazos conceptuales

No ejecutar un replace global ciego en todo el repo. Hacerlo solo en los archivos nuevos.

```txt
Inspection -> MarketplacePod
inspection -> marketplacePod
Inspections -> MarketplacePOD
inspections -> pod-marketplace
Inspecciones -> Evidencia Digital MK
getInspectionReport -> getMarketplacePodReport
getInspectionList -> getMarketplacePodList
formatInspectionDate -> formatMarketplacePodDate
isValidReport -> isValidMarketplacePodReport
```

## Patch mínimo: redirect legacy

### `frontend/src/app/inspecciones/page.tsx`

```tsx
import { redirect } from 'next/navigation';

export default function LegacyInspectionsPage() {
  redirect('/pod-marketplace');
}
```

### `frontend/src/app/inspecciones/[offerId]/page.tsx`

```tsx
import { redirect } from 'next/navigation';

export default async function LegacyInspectionDetailPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  redirect(`/pod-marketplace/${offerId}`);
}
```

## Patch mínimo: filtro en API

En `frontend/src/lib/pod-marketplace/api.ts`:

```diff
interface DbCargoOffer {
  id: string;
+ is_private_fleet: boolean | null;
  status: string;
```

En el select de detalle:

```diff
.select(`
-  id, status, cargo_type, cargo_description,
+  id, is_private_fleet, status, cargo_type, cargo_description,
```

En la query:

```diff
.eq('id', offerId)
+.neq('is_private_fleet', true)
.single();
```

Después de castear:

```ts
if (dbOffer.is_private_fleet === true) {
  return {
    success: false,
    error: 'Esta evidencia pertenece a una ruta privada. Revísala desde Flota privada.',
    errorCode: 'PRIVATE_FLEET_ROUTE_NOT_ALLOWED',
  };
}
```

En la query de lista:

```diff
.eq('business_id', businessId)
+.neq('is_private_fleet', true)
.order('created_at', { ascending: false })
```

## Patch mínimo: navegación

Archivo:

```txt
frontend/src/components/layouts/DashboardLayout.tsx
```

```diff
{
-  id: 'inspections',
-  labelKey: 'nav.inspections',
-  fallbackLabel: 'Inspecciones',
-  href: '/inspecciones',
+  id: 'pod-marketplace',
+  labelKey: 'nav.podMarketplace',
+  fallbackLabel: 'Evidencia Digital MK',
+  href: '/pod-marketplace',
   allowedUserTypes: ['business', 'admin'],
}
```

## Patch mínimo: CTA en Mis Ofertas

En `OfferCard` de `frontend/src/app/ofertas/mis-ofertas/page.tsx`, dentro del bloque de acciones:

```tsx
{(['reserved', 'in_progress', 'completed'] as OfferStatus[]).includes(offer.status) ? (
  <Button asChild size="sm" variant="outline">
    <Link href={`/pod-marketplace/${offer.id}`}>
      <Eye className="h-4 w-4" />
      Evidencia
    </Link>
  </Button>
) : null}
```

## Patch mínimo: copy de la página lista

En `frontend/src/app/pod-marketplace/page.tsx`:

```diff
- <DashboardLayout pageTitle="Inspecciones">
+ <DashboardLayout pageTitle="Evidencia Digital MK">

- <h1>Inspecciones</h1>
+ <h1>Evidencia digital Marketplace</h1>

- <p>Evidencia de cargue, ruta y entrega.</p>
+ <p>POD de cargue, ruta y entrega para rutas públicas.</p>
```

## Revisión antes de commit

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run check
```

## Commit sugerido

```bash
git add frontend/src/lib/pod-marketplace \
  frontend/src/app/pod-marketplace \
  frontend/src/app/inspecciones \
  frontend/src/components/layouts/DashboardLayout.tsx \
  frontend/public/locales/es-CO/common.json \
  frontend/public/locales/en/common.json \
  frontend/public/locales/pt-BR/common.json \
  frontend/src/app/ofertas/mis-ofertas/page.tsx

git commit -m "feat: rename inspections to marketplace digital evidence"
```
