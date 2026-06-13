import { NextRequest } from 'next/server';
import { apiSuccess, getRequestId } from '@/lib/server/api-response';
import { requireStaffCapability, resolveStaffRoles, getCapabilitiesForStaffRoles } from '@/lib/server/staff';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireStaffCapability(request, 'support:read');

    if ('response' in auth) {
        const fallbackAuth = await requireStaffCapability(request, 'payout:read');

        if ('response' in fallbackAuth) {
            const overviewAuth = await requireStaffCapability(request, 'admin:overview');
            if ('response' in overviewAuth) {
                return auth.response;
            }

            return apiSuccess({
                roles: overviewAuth.context.staff.roles,
                capabilities: overviewAuth.context.staff.capabilities,
                actorRole: overviewAuth.context.staff.actorRole,
            }, {
                requestId,
                code: 'STAFF_ACCESS_READY',
            });
        }

        return apiSuccess({
            roles: fallbackAuth.context.staff.roles,
            capabilities: fallbackAuth.context.staff.capabilities,
            actorRole: fallbackAuth.context.staff.actorRole,
        }, {
            requestId,
            code: 'STAFF_ACCESS_READY',
        });
    }

    const roles = await resolveStaffRoles(auth.context);
    const capabilities = getCapabilitiesForStaffRoles(roles);

    return apiSuccess({
        roles,
        capabilities,
        actorRole: roles[0] || auth.context.staff.actorRole,
    }, {
        requestId,
        code: 'STAFF_ACCESS_READY',
    });
}
