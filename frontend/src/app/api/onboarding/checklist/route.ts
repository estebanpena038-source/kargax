import { NextRequest } from 'next/server';
import { apiSuccess, getRequestId } from '@/lib/server/api-response';
import { ONBOARDING_CHECKLISTS } from '@/lib/platform/market-registry';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const personaParam = request.nextUrl.searchParams.get('persona');
    const persona = personaParam === 'Ops lead' || personaParam === 'Finance lead'
        ? personaParam
        : 'Owner/CEO';

    return apiSuccess(ONBOARDING_CHECKLISTS[persona], {
        requestId,
        code: 'ONBOARDING_CHECKLIST_READY',
    });
}
