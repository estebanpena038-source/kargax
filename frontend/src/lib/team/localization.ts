import {
    BUSINESS_ROLE_DESCRIPTIONS,
    BUSINESS_ROLE_LABELS,
    type BusinessTeamRole,
} from '@/lib/business-roles';

export type TeamCountryCode = 'CO' | 'EC' | 'PE' | 'BR';
export type TeamRole = BusinessTeamRole;
export type TeamMemberStatus = 'invited' | 'active' | 'suspended';
export type TeamLocale = 'es' | 'pt';

interface TeamLocalization {
    locale: TeamLocale;
    roleLabels: Record<TeamRole, string>;
    roleDescriptions: Record<TeamRole, string>;
    statusLabels: Record<TeamMemberStatus, string>;
    inviteErrors: {
        invalidEmail: string;
        alreadyActive: string;
        suspendedMember: string;
        wrongUserType: string;
        authDatabase: string;
        publicInviteUrl: string;
        acceptInvitationFirst: string;
        generic: string;
    };
}

const TEAM_LOCALIZATIONS: Record<TeamLocale, TeamLocalization> = {
    es: {
        locale: 'es',
        roleLabels: BUSINESS_ROLE_LABELS.es,
        roleDescriptions: BUSINESS_ROLE_DESCRIPTIONS.es,
        statusLabels: {
            invited: 'Pendiente',
            active: 'Activo',
            suspended: 'Suspendido',
        },
        inviteErrors: {
            invalidEmail: 'Ingresa un correo valido para enviar la invitacion.',
            alreadyActive: 'Este correo ya pertenece al equipo de la empresa.',
            suspendedMember: 'Este miembro esta suspendido. Reactivalo desde la lista del equipo.',
            wrongUserType: 'Esta invitacion debe completarse con una cuenta empresarial autorizada por la compania.',
            authDatabase: 'No se pudo crear el usuario invitado. Aplica la migracion de invitaciones y vuelve a intentar.',
            publicInviteUrl: 'La URL publica de invitaciones no esta configurada. Configura el entorno de staging o produccion antes de reenviar invitaciones.',
            acceptInvitationFirst: 'Este miembro aun no acepta la invitacion. Reenviala para que complete el acceso antes de activarlo.',
            generic: 'No se pudo enviar la invitacion. Intenta nuevamente en unos minutos.',
        },
    },
    pt: {
        locale: 'pt',
        roleLabels: BUSINESS_ROLE_LABELS.pt,
        roleDescriptions: BUSINESS_ROLE_DESCRIPTIONS.pt,
        statusLabels: {
            invited: 'Pendente',
            active: 'Ativo',
            suspended: 'Suspenso',
        },
        inviteErrors: {
            invalidEmail: 'Informe um email valido para enviar o convite.',
            alreadyActive: 'Este email ja pertence a equipe da empresa.',
            suspendedMember: 'Este membro esta suspenso. Reative-o pela lista da equipe.',
            wrongUserType: 'Este convite deve ser concluido com uma conta empresarial autorizada pela empresa.',
            authDatabase: 'Nao foi possivel criar o usuario convidado. Aplique a migracao de convites e tente novamente.',
            publicInviteUrl: 'A URL publica de convites nao esta configurada. Configure o ambiente de staging ou producao antes de reenviar convites.',
            acceptInvitationFirst: 'Este membro ainda nao aceitou o convite. Reenvie-o para concluir o acesso antes de ativar.',
            generic: 'Nao foi possivel enviar o convite. Tente novamente em alguns minutos.',
        },
    },
};

export function normalizeTeamCountryCode(countryCode?: string | null): TeamCountryCode {
    const normalized = (countryCode || 'CO').toUpperCase();
    return normalized === 'EC' || normalized === 'PE' || normalized === 'BR' ? normalized : 'CO';
}

export function getTeamLocale(countryCode?: string | null): TeamLocale {
    return normalizeTeamCountryCode(countryCode) === 'BR' ? 'pt' : 'es';
}

export function getTeamLocalization(countryCode?: string | null): TeamLocalization {
    return TEAM_LOCALIZATIONS[getTeamLocale(countryCode)];
}

export function getTeamRoleLabel(role: TeamRole, countryCode?: string | null) {
    return getTeamLocalization(countryCode).roleLabels[role] || role;
}

export function getTeamStatusLabel(status: TeamMemberStatus, countryCode?: string | null) {
    return getTeamLocalization(countryCode).statusLabels[status] || status;
}
