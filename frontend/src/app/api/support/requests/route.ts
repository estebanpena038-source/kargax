import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequestId } from '@/lib/server/api-response';
import { createSupportRequest, listSupportRequests } from '@/lib/server/operations';
import { getSupabaseAdmin, requireAdminRoute } from '@/lib/server/route-auth';
import type { SupportRequest } from '@/lib/platform/types';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const auth = await requireAdminRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    try {
        const data = await listSupportRequests(auth.context.supabaseAdmin, { limit: 50 });
        return apiSuccess(data, {
            requestId,
            code: 'SUPPORT_REQUESTS_READY',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Could not load support requests', {
            requestId,
            status: 500,
            code: 'SUPPORT_REQUESTS_LOAD_FAILED',
        });
    }
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));

    const requesterName = typeof body?.requesterName === 'string' ? body.requesterName.trim() : '';
    const requesterEmail = typeof body?.requesterEmail === 'string' ? body.requesterEmail.trim() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const domain = typeof body?.domain === 'string' ? body.domain : 'support';
    const priority = typeof body?.priority === 'string' ? body.priority : 'medium';
    const preferredContactChannel = typeof body?.preferredContactChannel === 'string'
        ? body.preferredContactChannel
        : 'email';
    const countryCode = typeof body?.countryCode === 'string' ? body.countryCode : 'CO';

    if (!requesterName || !requesterEmail || !subject || !description) {
        return apiError('requesterName, requesterEmail, subject and description are required', {
            requestId,
            status: 400,
            code: 'SUPPORT_REQUEST_INVALID',
        });
    }

    try {
        const data = await createSupportRequest(supabaseAdmin, {
            requestId,
            requesterName,
            requesterEmail,
            subject,
            description,
            domain: domain as SupportRequest['domain'],
            priority: priority as SupportRequest['priority'],
            preferredContactChannel: preferredContactChannel as SupportRequest['preferred_contact_channel'],
            countryCode,
            metadata: {
                company: typeof body?.company === 'string' ? body.company : null,
                phone: typeof body?.phone === 'string' ? body.phone : null,
                persona: typeof body?.persona === 'string' ? body.persona : 'Owner/CEO',
                requested_from: 'support_portal',
            },
        });

        return apiSuccess(data, {
            requestId,
            status: 201,
            code: 'SUPPORT_REQUEST_CREATED',
        });
    } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Could not create support request', {
            requestId,
            status: 500,
            code: 'SUPPORT_REQUEST_CREATE_FAILED',
        });
    }
}
