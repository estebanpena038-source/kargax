export const BUSINESS_TEAM_ROLE_VALUES = [
    'owner',
    'manager',
    'ops_manager',
    'dispatcher',
    'warehouse_manager',
    'warehouse_operator',
    'finance_accountant',
    'operator',
    'auditor',
    'viewer',
] as const;

export const BUSINESS_ROLE_VALUES = [
    ...BUSINESS_TEAM_ROLE_VALUES,
    'admin',
] as const;

export const EDITABLE_BUSINESS_TEAM_ROLE_VALUES = [
    'ops_manager',
    'dispatcher',
    'warehouse_manager',
    'warehouse_operator',
    'finance_accountant',
    'auditor',
    'viewer',
] as const;

export type BusinessTeamRole = typeof BUSINESS_TEAM_ROLE_VALUES[number];
export type BusinessRole = typeof BUSINESS_ROLE_VALUES[number];
export type EditableBusinessTeamRole = typeof EDITABLE_BUSINESS_TEAM_ROLE_VALUES[number];
export type BusinessRoleLocale = 'es' | 'pt';

export type BusinessIntelligenceTab = 'overview' | 'marketplace' | 'private_fleet' | 'warehouse' | 'accounting';

export interface BusinessRoleCapabilities {
    canManageTeam: boolean;
    canManageBilling: boolean;
    canViewFinance: boolean;
    canExportFinance: boolean;
    canViewOperations: boolean;
    canCreateMarketplaceOffers: boolean;
    canManagePrivateFleet: boolean;
    canViewTracking: boolean;
    canManageWarehouse: boolean;
    canExecuteWarehouse: boolean;
    canViewEvidence: boolean;
    canExportData: boolean;
    canViewIntelligence: boolean;
    intelligenceTabs: BusinessIntelligenceTab[];
}

export const BUSINESS_ROLE_LABELS: Record<BusinessRoleLocale, Record<BusinessTeamRole, string>> = {
    es: {
        owner: 'Propietario',
        manager: 'Gerente legacy',
        ops_manager: 'Jefe de operaciones',
        dispatcher: 'Despachador',
        warehouse_manager: 'Jefe de bodega',
        warehouse_operator: 'Operario de bodega',
        finance_accountant: 'Contabilidad',
        operator: 'Operador legacy',
        auditor: 'Auditor',
        viewer: 'Visualizador',
    },
    pt: {
        owner: 'Proprietario',
        manager: 'Gerente legado',
        ops_manager: 'Chefe de operacoes',
        dispatcher: 'Despachante',
        warehouse_manager: 'Chefe de armazem',
        warehouse_operator: 'Operador de armazem',
        finance_accountant: 'Contabilidade',
        operator: 'Operador legado',
        auditor: 'Auditor',
        viewer: 'Visualizador',
    },
};

export const BUSINESS_ROLE_DESCRIPTIONS: Record<BusinessRoleLocale, Record<BusinessTeamRole, string>> = {
    es: {
        owner: 'Control total de empresa, equipo, planes, reportes, flota, bodegas y gobierno de datos.',
        manager: 'Rol antiguo con permisos amplios de operacion. Se conserva para no romper equipos existentes.',
        ops_manager: 'Planea y supervisa viajes, ofertas, flota privada, tracking, evidencia y novedades operativas.',
        dispatcher: 'Ejecuta despachos, asignaciones, seguimiento GPS, PIN/POD y novedades del viaje.',
        warehouse_manager: 'Administra bodega, muelles, inventario, citas, recepciones, picking, despachos e incidentes.',
        warehouse_operator: 'Ejecuta cargue, recepcion, picking, despacho, evidencia y tareas fisicas de bodega.',
        finance_accountant: 'Consulta reportes contables, comisiones, pagos privados, gastos del viaje, retiros y PDFs.',
        operator: 'Rol antiguo de ejecucion operativa. Se conserva para no romper equipos existentes.',
        auditor: 'Lee operaciones, evidencias, trazabilidad y exportes sin modificar datos.',
        viewer: 'Consulta resumenes operativos sin acciones sensibles ni exportes.',
    },
    pt: {
        owner: 'Controle total da empresa, equipe, planos, relatorios, frota, armazens e governanca de dados.',
        manager: 'Papel antigo com permissoes amplas de operacao. Mantido para nao quebrar equipes existentes.',
        ops_manager: 'Planeja e supervisiona viagens, ofertas, frota privada, tracking, evidencias e ocorrencias.',
        dispatcher: 'Executa despachos, atribuicoes, rastreamento GPS, PIN/POD e ocorrencias da viagem.',
        warehouse_manager: 'Administra armazem, docas, inventario, agendamentos, recebimentos, picking, despachos e incidentes.',
        warehouse_operator: 'Executa carga, recebimento, picking, despacho, evidencias e tarefas fisicas do armazem.',
        finance_accountant: 'Consulta relatorios contabeis, comissoes, pagamentos privados, despesas, saques e PDFs.',
        operator: 'Papel antigo de execucao operacional. Mantido para nao quebrar equipes existentes.',
        auditor: 'Le operacoes, evidencias, rastreabilidade e exportacoes sem modificar dados.',
        viewer: 'Consulta resumos operacionais sem acoes sensiveis nem exportacoes.',
    },
};

export const BUSINESS_ROLE_CAPABILITIES: Record<BusinessRole, BusinessRoleCapabilities> = {
    admin: {
        canManageTeam: true,
        canManageBilling: true,
        canViewFinance: true,
        canExportFinance: true,
        canViewOperations: true,
        canCreateMarketplaceOffers: true,
        canManagePrivateFleet: true,
        canViewTracking: true,
        canManageWarehouse: true,
        canExecuteWarehouse: true,
        canViewEvidence: true,
        canExportData: true,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'marketplace', 'private_fleet', 'warehouse', 'accounting'],
    },
    owner: {
        canManageTeam: true,
        canManageBilling: true,
        canViewFinance: true,
        canExportFinance: true,
        canViewOperations: true,
        canCreateMarketplaceOffers: true,
        canManagePrivateFleet: true,
        canViewTracking: true,
        canManageWarehouse: true,
        canExecuteWarehouse: true,
        canViewEvidence: true,
        canExportData: true,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'marketplace', 'private_fleet', 'warehouse', 'accounting'],
    },
    manager: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: true,
        canExportFinance: true,
        canViewOperations: true,
        canCreateMarketplaceOffers: true,
        canManagePrivateFleet: true,
        canViewTracking: true,
        canManageWarehouse: true,
        canExecuteWarehouse: true,
        canViewEvidence: true,
        canExportData: true,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'marketplace', 'private_fleet', 'warehouse'],
    },
    ops_manager: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: false,
        canExportFinance: false,
        canViewOperations: true,
        canCreateMarketplaceOffers: true,
        canManagePrivateFleet: true,
        canViewTracking: true,
        canManageWarehouse: false,
        canExecuteWarehouse: false,
        canViewEvidence: true,
        canExportData: true,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'marketplace', 'private_fleet'],
    },
    dispatcher: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: false,
        canExportFinance: false,
        canViewOperations: true,
        canCreateMarketplaceOffers: true,
        canManagePrivateFleet: true,
        canViewTracking: true,
        canManageWarehouse: false,
        canExecuteWarehouse: false,
        canViewEvidence: true,
        canExportData: false,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'marketplace', 'private_fleet'],
    },
    warehouse_manager: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: false,
        canExportFinance: false,
        canViewOperations: true,
        canCreateMarketplaceOffers: false,
        canManagePrivateFleet: false,
        canViewTracking: true,
        canManageWarehouse: true,
        canExecuteWarehouse: true,
        canViewEvidence: true,
        canExportData: true,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'warehouse'],
    },
    warehouse_operator: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: false,
        canExportFinance: false,
        canViewOperations: false,
        canCreateMarketplaceOffers: false,
        canManagePrivateFleet: false,
        canViewTracking: false,
        canManageWarehouse: false,
        canExecuteWarehouse: true,
        canViewEvidence: true,
        canExportData: false,
        canViewIntelligence: false,
        intelligenceTabs: [],
    },
    finance_accountant: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: true,
        canExportFinance: true,
        canViewOperations: false,
        canCreateMarketplaceOffers: false,
        canManagePrivateFleet: false,
        canViewTracking: false,
        canManageWarehouse: false,
        canExecuteWarehouse: false,
        canViewEvidence: true,
        canExportData: true,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'accounting'],
    },
    operator: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: false,
        canExportFinance: false,
        canViewOperations: true,
        canCreateMarketplaceOffers: true,
        canManagePrivateFleet: true,
        canViewTracking: true,
        canManageWarehouse: false,
        canExecuteWarehouse: true,
        canViewEvidence: true,
        canExportData: false,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'marketplace', 'private_fleet', 'warehouse'],
    },
    auditor: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: true,
        canExportFinance: true,
        canViewOperations: true,
        canCreateMarketplaceOffers: false,
        canManagePrivateFleet: false,
        canViewTracking: true,
        canManageWarehouse: false,
        canExecuteWarehouse: false,
        canViewEvidence: true,
        canExportData: true,
        canViewIntelligence: true,
        intelligenceTabs: ['overview', 'marketplace', 'private_fleet', 'warehouse', 'accounting'],
    },
    viewer: {
        canManageTeam: false,
        canManageBilling: false,
        canViewFinance: false,
        canExportFinance: false,
        canViewOperations: true,
        canCreateMarketplaceOffers: false,
        canManagePrivateFleet: false,
        canViewTracking: false,
        canManageWarehouse: false,
        canExecuteWarehouse: false,
        canViewEvidence: false,
        canExportData: false,
        canViewIntelligence: true,
        intelligenceTabs: ['overview'],
    },
};

export function isBusinessTeamRole(value: unknown): value is BusinessTeamRole {
    return typeof value === 'string' && BUSINESS_TEAM_ROLE_VALUES.includes(value as BusinessTeamRole);
}

export function isEditableBusinessTeamRole(value: unknown): value is EditableBusinessTeamRole {
    return typeof value === 'string' && EDITABLE_BUSINESS_TEAM_ROLE_VALUES.includes(value as EditableBusinessTeamRole);
}

export function isBusinessRole(value: unknown): value is BusinessRole {
    return typeof value === 'string' && BUSINESS_ROLE_VALUES.includes(value as BusinessRole);
}

export function getBusinessRoleCapabilities(role: BusinessRole | null | undefined): BusinessRoleCapabilities {
    if (!role || !isBusinessRole(role)) {
        return BUSINESS_ROLE_CAPABILITIES.viewer;
    }

    return BUSINESS_ROLE_CAPABILITIES[role];
}

export function getBusinessRoleLabel(role: BusinessTeamRole, locale: BusinessRoleLocale = 'es') {
    return BUSINESS_ROLE_LABELS[locale][role] || role;
}

export function getBusinessRoleDescription(role: BusinessTeamRole, locale: BusinessRoleLocale = 'es') {
    return BUSINESS_ROLE_DESCRIPTIONS[locale][role] || role;
}

export function toEditableBusinessTeamRole(role: BusinessTeamRole | null | undefined): EditableBusinessTeamRole {
    if (role === 'manager') {
        return 'ops_manager';
    }

    if (role === 'operator') {
        return 'warehouse_operator';
    }

    if (role && isEditableBusinessTeamRole(role)) {
        return role;
    }

    return 'viewer';
}

export function toWarehouseMembershipRole(role: BusinessTeamRole): BusinessTeamRole {
    if (role === 'owner') {
        return 'manager';
    }

    return role;
}
