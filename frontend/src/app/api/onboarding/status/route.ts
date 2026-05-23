import { NextRequest } from 'next/server';
import { apiSuccess, getRequestId } from '@/lib/server/api-response';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);

    return apiSuccess({
        commercial_motion: 'Enterprise B2B',
        primary_buyer: 'Owner/CEO',
        secondary_buyers: ['Ops lead', 'Finance lead'],
        onboarding_model: 'assisted_implementation',
        support_model: 'extended_hours_on_call_critical',
        release_journey: [
            'landing',
            'account setup',
            'implementation',
            'first warehouse',
            'first offer',
            'payment',
            'settlement',
            'advance',
            'holding/admin trace',
            'incident/replay',
        ],
        bootstrap_path: '/supabase/seeds/enterprise_bootstrap_tenant.sql',
        playbooks: [
            '/docs/playbooks/implementation-owner-ceo.md',
            '/docs/playbooks/implementation-ops-lead.md',
            '/docs/playbooks/implementation-finance-lead.md',
        ],
    }, {
        requestId,
        code: 'ONBOARDING_STATUS_READY',
    });
}
