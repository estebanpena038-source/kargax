# API route skeletons — LAST-MILLA

## `/api/last-mile/contracts/route.ts`

```ts
import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { getBusinessPlanSnapshot, resolveBusinessAccessContext } from '@/lib/server/warehouses';
import { createLastMileContract, listLastMileContracts, resolveLastMileAccess } from '@/lib/server/last-mile';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const auth = await requireAal2Route(request);
  if ('response' in auth) return auth.response;
  try {
    const { supabaseAdmin, authUser, profile } = auth.context;
    const access = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const scopedBusiness = resolveScopedBusinessId({
      requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
      resolvedBusinessId: access.businessId,
      profile,
    });
    if ('error' in scopedBusiness) return apiError(scopedBusiness.error || 'Business scope error', { status: scopedBusiness.status, code: 'BUSINESS_SCOPE_ERROR', requestId });

    const role = profile?.user_type === 'admin' ? 'admin' : access.isOwner ? 'owner' : access.teamMember?.role || 'viewer';
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, scopedBusiness.businessId);
    const lastMileAccess = resolveLastMileAccess({ role, isOwner: access.isOwner, isAdmin: profile?.user_type === 'admin', subscription: snapshot.subscription });
    if (!lastMileAccess.enabled && !lastMileAccess.readOnly) return apiError('Control de margen está disponible en Enterprise.', { status: 402, code: 'LAST_MILE_FEATURE_DISABLED', requestId });

    const data = await listLastMileContracts(supabaseAdmin, scopedBusiness.businessId, {
      status: request.nextUrl.searchParams.get('status'),
      carrierId: request.nextUrl.searchParams.get('carrierId'),
      laneId: request.nextUrl.searchParams.get('laneId'),
    });
    return apiSuccess(data, { code: 'LAST_MILE_CONTRACTS_LOADED', requestId });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'No se pudieron cargar contratos', { status: 500, code: 'LAST_MILE_CONTRACTS_FAILED', requestId });
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const auth = await requireAal2Route(request);
  if ('response' in auth) return auth.response;
  try {
    const { supabaseAdmin, authUser, profile } = auth.context;
    const body = await request.json().catch(() => ({}));
    const access = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const scopedBusiness = resolveScopedBusinessId({ requestedBusinessId: body.businessId, resolvedBusinessId: access.businessId, profile });
    if ('error' in scopedBusiness) return apiError(scopedBusiness.error || 'Business scope error', { status: scopedBusiness.status, code: 'BUSINESS_SCOPE_ERROR', requestId });

    const role = profile?.user_type === 'admin' ? 'admin' : access.isOwner ? 'owner' : access.teamMember?.role || 'viewer';
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, scopedBusiness.businessId);
    const lastMileAccess = resolveLastMileAccess({ role, isOwner: access.isOwner, isAdmin: profile?.user_type === 'admin', subscription: snapshot.subscription });
    if (!lastMileAccess.canManageContracts) return apiError('Tu rol no puede crear contratos de margen.', { status: 403, code: 'LAST_MILE_CONTRACT_FORBIDDEN', requestId });

    const contract = await createLastMileContract(supabaseAdmin, scopedBusiness.businessId, authUser.id, body);
    return apiSuccess({ contract }, { status: 201, code: 'LAST_MILE_CONTRACT_CREATED', requestId });
  } catch (error) {
    const candidate = error as Error & { status?: number; code?: string };
    return apiError(candidate.message || 'No se pudo crear contrato', { status: candidate.status || 500, code: candidate.code || 'LAST_MILE_CONTRACT_CREATE_FAILED', requestId });
  }
}
```

## `/api/last-mile/observations/sync/route.ts`

Debe seguir este patrón:

```ts
export async function POST(request: NextRequest) {
  // requireAal2Route
  // resolveBusinessAccessContext + resolveScopedBusinessId
  // getBusinessPlanSnapshot + resolveLastMileAccess
  // if !canRunSync => 403
  // const result = await syncLastMileObservations(...)
  // apiSuccess(result, { code: 'LAST_MILE_SYNC_COMPLETED' })
}
```

## `/api/last-mile/recommendations/[recommendationId]/route.ts`

Debe permitir solo cambios de estado:

```ts
status: 'acknowledged' | 'in_negotiation' | 'accepted' | 'rejected' | 'closed'
resolutionNote?: string | null
assignedTo?: string | null
```

Reglas:

- `closed`, `accepted`, `rejected` requieren `resolutionNote`.
- Actualizar `resolved_at` cuando se cierra/acepta/rechaza.
- Insertar evento `renegotiation_requested` o `manual_note` si aplica.
