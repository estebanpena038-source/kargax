import type { SupabaseClient } from '@supabase/supabase-js';
import { getTeamLocalization, normalizeTeamCountryCode, type TeamRole } from '@/lib/team/localization';
import { buildPublicAppUrl, shouldAllowLocalPublicAppUrl } from '@/lib/platform/public-app-url';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

type InviteLinkType = 'invite' | 'magiclink';

export interface BusinessTeamInviteContext {
    email: string;
    role: Exclude<TeamRole, 'owner'>;
    businessId: string;
    companyName: string;
    invitedByName: string;
    countryCode?: string | null;
    appUrl: string;
    linkType?: InviteLinkType;
}

export interface BusinessTeamInviteDelivery {
    provider: 'supabase';
    hasAccessCode: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidTeamInviteEmail(email: string) {
    return EMAIL_RE.test(email);
}

export function toTeamInviteError(error: { message?: string } | Error | null | undefined, countryCode?: string | null) {
    const copy = getTeamLocalization(countryCode).inviteErrors;
    const message = error?.message || '';
    const normalized = message.toLowerCase();

    if (normalized.includes('database error saving new user')) {
        return copy.authDatabase;
    }

    if (normalized.includes('invalid email')) {
        return copy.invalidEmail;
    }

    return message || copy.generic;
}

function buildInviteMetadata(context: BusinessTeamInviteContext) {
    const countryCode = normalizeTeamCountryCode(context.countryCode);

    return {
        user_type: 'business',
        country_code: countryCode,
        team_invitation: true,
        business_id: context.businessId,
        invited_business_id: context.businessId,
        team_role: context.role,
        company_name: context.companyName,
        invited_by_name: context.invitedByName,
    };
}

export async function sendBusinessTeamInvite(
    supabaseAdmin: AdminClient,
    context: BusinessTeamInviteContext
): Promise<BusinessTeamInviteDelivery> {
    const metadata = buildInviteMetadata(context);
    const redirectTo = buildPublicAppUrl('/auth/invite/accept', {
        requestOrigin: context.appUrl,
        allowLocalhost: shouldAllowLocalPublicAppUrl(),
    });

    if (!redirectTo) {
        throw new Error('No hay una URL pÃºblica vÃ¡lida para aceptar invitaciones.');
    }

    if (context.linkType === 'magiclink') {
        const magicLink = await supabaseAdmin.auth.signInWithOtp({
            email: context.email,
            options: {
                emailRedirectTo: redirectTo,
                shouldCreateUser: false,
                data: metadata,
            },
        });

        if (magicLink.error) {
            throw new Error(toTeamInviteError(magicLink.error, context.countryCode));
        }

        return {
            provider: 'supabase',
            hasAccessCode: false,
        };
    }

    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(context.email, {
        redirectTo,
        data: metadata,
    });

    if (invited.error) {
        throw new Error(toTeamInviteError(invited.error, context.countryCode));
    }

    return {
        provider: 'supabase',
        hasAccessCode: false,
    };
}
