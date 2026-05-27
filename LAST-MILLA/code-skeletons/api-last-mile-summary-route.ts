import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireAal2Route, resolveScopedBusinessId } from '@/lib/server/route-auth';
import { getBusinessPlanSnapshot, resolveBusinessAccessContext } from '@/lib/server/warehouses';
import { getLastMileSummary, resolveLastMileAccess } from '@/lib/server/last-mile';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const auth = await requireAal2Route(request);
  if ('response' in auth) return auth.response;

  try {
    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);
    const scopedBusiness = resolveScopedBusinessId({
      requestedBusinessId: request.nextUrl.searchParams.get('businessId'),
      resolvedBusinessId: businessAccess.businessId,
      profile,
    });
    if ('error' in scopedBusiness) {
      return apiError(scopedBusiness.error || 'Business scope error', { status: scopedBusiness.status, code: 'BUSINESS_SCOPE_ERROR', requestId });
    }

    const role = profile?.user_type === 'admin' ? 'admin' : businessAccess.isOwner ? 'owner' : businessAccess.teamMember?.role || 'viewer';
    const snapshot = await getBusinessPlanSnapshot(supabaseAdmin, scopedBusiness.businessId);
    const access = resolveLastMileAccess({
      role,
      isOwner: businessAccess.isOwner,
      isAdmin: profile?.user_type === 'admin',
      subscription: snapshot.subscription,
    });

    const data = await getLastMileSummary(supabaseAdmin, scopedBusiness.businessId, {
      month: request.nextUrl.searchParams.get('month'),
      access,
    });

    return apiSuccess(data, { code: 'LAST_MILE_SUMMARY_READY', requestId, meta: { businessId: scopedBusiness.businessId } });
  } catch (error) {
    const candidate = error as Error & { status?: number; code?: string; details?: unknown };
    return apiError(candidate.message || 'No se pudo cargar control de margen', {
      status: candidate.status || 500,
      code: candidate.code || 'LAST_MILE_SUMMARY_FAILED',
      requestId,
      details: candidate.details,
    });
  }
}
