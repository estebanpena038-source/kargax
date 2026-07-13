import type {
    CountryRegistryEntry,
    DomainSlo,
    FeatureFlagSnapshot,
    MarketContext,
    OnboardingChecklist,
    ProviderAdapterConfig,
    RunbookSummary,
} from '@/lib/platform/types';

export const COUNTRY_REGISTRY: CountryRegistryEntry[] = [
    {
        country_code: 'CO',
        display_name: 'Colombia',
        locale_default: 'es-CO',
        currency_code: 'COP',
        timezone_default: 'America/Bogota',
        phone_country_code: '+57',
        phone_pattern: '^(\\+57\\s?)?3\\d{9}$',
        document_types: [
            { code: 'CC', label: 'Cedula de Ciudadania' },
            { code: 'CE', label: 'Cedula de Extranjeria' },
            { code: 'NIT', label: 'NIT' },
            { code: 'PP', label: 'Pasaporte' },
        ],
        fiscal_label: 'NIT',
        supported_rails: {
            payments: ['mercadopago'],
            payouts: ['bank_transfer', 'wallet'],
            notifications: ['twilio', 'console'],
            billing: ['mercadopago'],
        },
        legal_links: {
            terms: '/terminos?country=CO',
            privacy: '/privacidad?country=CO',
            support: '/soporte?country=CO',
        },
        environment_urls: {
            app: 'https://kargax.online',
            checkout: 'https://kargax.online/checkout',
            support: 'https://kargax.online/soporte',
        },
        seed_regions: ['Bogota', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena'],
        feature_flags: { market_open: true },
        is_backend_ready: true,
        is_visible: true,
    },
    {
        country_code: 'PE',
        display_name: 'Peru',
        locale_default: 'es-PE',
        currency_code: 'PEN',
        timezone_default: 'America/Lima',
        phone_country_code: '+51',
        phone_pattern: '^(\\+51\\s?)?9\\d{8}$',
        document_types: [
            { code: 'DNI', label: 'DNI' },
            { code: 'RUC', label: 'RUC' },
            { code: 'CE', label: 'Carnet de Extranjeria' },
            { code: 'PP', label: 'Pasaporte' },
        ],
        fiscal_label: 'RUC',
        supported_rails: {
            payments: ['mercadopago'],
            payouts: ['bank_transfer', 'partner_placeholder_pe'],
            notifications: ['twilio', 'console'],
            billing: ['mercadopago'],
        },
        legal_links: {
            terms: '/terminos?country=PE',
            privacy: '/privacidad?country=PE',
            support: '/soporte?country=PE',
        },
        environment_urls: {
            app: 'https://kargax.online/pe',
            checkout: 'https://kargax.online/pe/checkout',
            support: 'https://kargax.online/soporte?country=PE',
        },
        seed_regions: ['Lima', 'Callao', 'Arequipa', 'Trujillo'],
        feature_flags: { market_open: true },
        is_backend_ready: true,
        is_visible: true,
    },
    {
        country_code: 'EC',
        display_name: 'Ecuador',
        locale_default: 'es-EC',
        currency_code: 'USD',
        timezone_default: 'America/Guayaquil',
        phone_country_code: '+593',
        phone_pattern: '^(\\+593\\s?)?9\\d{8}$',
        document_types: [
            { code: 'CI', label: 'Cedula' },
            { code: 'RUC', label: 'RUC' },
            { code: 'PP', label: 'Pasaporte' },
        ],
        fiscal_label: 'RUC',
        supported_rails: {
            payments: ['partner_placeholder_ec'],
            payouts: ['bank_transfer', 'partner_placeholder_ec'],
            notifications: ['twilio', 'console'],
            billing: ['partner_placeholder_ec'],
        },
        legal_links: {
            terms: '/terminos?country=EC',
            privacy: '/privacidad?country=EC',
            support: '/soporte?country=EC',
        },
        environment_urls: {
            app: 'https://kargax.online/ec',
            checkout: 'https://kargax.online/ec/checkout',
            support: 'https://kargax.online/soporte?country=EC',
        },
        seed_regions: ['Quito', 'Guayaquil', 'Cuenca', 'Manta'],
        feature_flags: { market_open: true },
        is_backend_ready: true,
        is_visible: true,
    },
    {
        country_code: 'BR',
        display_name: 'Brasil',
        locale_default: 'pt-BR',
        currency_code: 'BRL',
        timezone_default: 'America/Sao_Paulo',
        phone_country_code: '+55',
        phone_pattern: '^(\\+55\\s?)?[1-9]{2}9\\d{8}$',
        document_types: [
            { code: 'CPF', label: 'CPF' },
            { code: 'CNPJ', label: 'CNPJ' },
            { code: 'RG', label: 'RG' },
            { code: 'PP', label: 'Passaporte' },
        ],
        fiscal_label: 'CNPJ',
        supported_rails: {
            payments: ['mercadopago'],
            payouts: ['bank_transfer', 'pix'],
            notifications: ['twilio', 'console'],
            billing: ['mercadopago'],
        },
        legal_links: {
            terms: '/terminos?country=BR',
            privacy: '/privacidad?country=BR',
            support: '/soporte?country=BR',
        },
        environment_urls: {
            app: 'https://kargax.online/br',
            checkout: 'https://kargax.online/br/checkout',
            support: 'https://kargax.online/soporte?country=BR',
        },
        seed_regions: ['Sao Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Parana'],
        feature_flags: { market_open: true },
        is_backend_ready: true,
        is_visible: true,
    },
];

export const PROVIDER_ADAPTERS: ProviderAdapterConfig[] = [
    { country_code: 'CO', provider_kind: 'payments', adapter_key: 'mercadopago', status: 'active', config: { provider: 'mercadopago' } },
    { country_code: 'CO', provider_kind: 'payouts', adapter_key: 'bank_transfer', status: 'active', config: { provider: 'wallet_bank_transfer' } },
    { country_code: 'CO', provider_kind: 'notifications', adapter_key: 'twilio', status: 'active', config: { provider: 'twilio' } },
    { country_code: 'CO', provider_kind: 'billing', adapter_key: 'mercadopago', status: 'active', config: { provider: 'mercadopago' } },
    { country_code: 'PE', provider_kind: 'payments', adapter_key: 'partner_placeholder_pe', status: 'placeholder', config: { provider: 'partner_placeholder', market: 'PE' } },
    { country_code: 'PE', provider_kind: 'payments', adapter_key: 'mercadopago', status: 'active', config: { provider: 'mercadopago', market: 'PE' } },
    { country_code: 'PE', provider_kind: 'payouts', adapter_key: 'partner_placeholder_pe', status: 'placeholder', config: { provider: 'partner_placeholder', market: 'PE' } },
    { country_code: 'PE', provider_kind: 'notifications', adapter_key: 'twilio', status: 'active', config: { provider: 'twilio' } },
    { country_code: 'PE', provider_kind: 'billing', adapter_key: 'partner_placeholder_pe', status: 'placeholder', config: { provider: 'partner_placeholder', market: 'PE' } },
    { country_code: 'PE', provider_kind: 'billing', adapter_key: 'mercadopago', status: 'active', config: { provider: 'mercadopago', market: 'PE' } },
    { country_code: 'EC', provider_kind: 'payments', adapter_key: 'partner_placeholder_ec', status: 'placeholder', config: { provider: 'partner_placeholder', market: 'EC' } },
    { country_code: 'EC', provider_kind: 'payouts', adapter_key: 'partner_placeholder_ec', status: 'placeholder', config: { provider: 'partner_placeholder', market: 'EC' } },
    { country_code: 'EC', provider_kind: 'notifications', adapter_key: 'twilio', status: 'active', config: { provider: 'twilio' } },
    { country_code: 'EC', provider_kind: 'billing', adapter_key: 'partner_placeholder_ec', status: 'placeholder', config: { provider: 'partner_placeholder', market: 'EC' } },
    { country_code: 'BR', provider_kind: 'payments', adapter_key: 'mercadopago', status: 'active', config: { provider: 'mercadopago', market: 'BR' } },
    { country_code: 'BR', provider_kind: 'payouts', adapter_key: 'pix', status: 'active', config: { provider: 'pix', market: 'BR' } },
    { country_code: 'BR', provider_kind: 'payouts', adapter_key: 'bank_transfer', status: 'active', config: { provider: 'wallet_bank_transfer', market: 'BR' } },
    { country_code: 'BR', provider_kind: 'notifications', adapter_key: 'twilio', status: 'active', config: { provider: 'twilio' } },
    { country_code: 'BR', provider_kind: 'billing', adapter_key: 'mercadopago', status: 'active', config: { provider: 'mercadopago', market: 'BR' } },
];

export const RUNBOOKS: RunbookSummary[] = [
    { key: 'payment_webhook_failure', title: 'Payment Webhook Failure', domain: 'payments', severity: 'critical', sla: '5 min', owner: 'Payments on-call', file_path: '/docs/runbooks/payment-webhook-failure.md' },
    { key: 'withdrawal_stuck', title: 'Withdrawal Stuck', domain: 'wallet', severity: 'high', sla: '30 min', owner: 'Fintech ops', file_path: '/docs/runbooks/withdrawal-stuck.md' },
    { key: 'settlement_mismatch', title: 'Settlement Mismatch', domain: 'wallet', severity: 'high', sla: '30 min', owner: 'Fintech ops', file_path: '/docs/runbooks/settlement-mismatch.md' },
    { key: 'advance_overdue_spike', title: 'Advance Overdue Spike', domain: 'lending', severity: 'high', sla: '4 h', owner: 'Risk and treasury', file_path: '/docs/runbooks/advance-overdue-spike.md' },
    { key: 'warehouse_incident_backlog', title: 'Warehouse Incident Backlog', domain: 'warehouse', severity: 'medium', sla: '4 h', owner: 'Warehouse ops', file_path: '/docs/runbooks/warehouse-incident-backlog.md' },
    { key: 'holding_approval_sla_breach', title: 'Holding Approval SLA Breach', domain: 'holding', severity: 'critical', sla: '30 min', owner: 'Holding owner', file_path: '/docs/runbooks/holding-approval-sla-breach.md' },
];

export const DOMAIN_SLOS: DomainSlo[] = [
    { key: 'auth', title: 'Auth availability', target: '99.9% monthly', severity_owner: 'Platform on-call', runbook_key: 'holding_approval_sla_breach' },
    { key: 'payments', title: 'Payments success path', target: '99.95% successful webhook processing', severity_owner: 'Payments on-call', runbook_key: 'payment_webhook_failure' },
    { key: 'wallet', title: 'Wallet timeline freshness', target: '< 60s replication lag', severity_owner: 'Fintech ops', runbook_key: 'settlement_mismatch' },
    { key: 'warehouse', title: 'Warehouse API latency', target: 'p95 < 900ms', severity_owner: 'Warehouse ops', runbook_key: 'warehouse_incident_backlog' },
    { key: 'admin_support', title: 'Admin and support queue', target: 'critical incidents acknowledged < 5 min', severity_owner: 'Support lead', runbook_key: 'withdrawal_stuck' },
];

const onboardingBaseChecklist = [
    { key: 'setup_account', title: 'Crear tenant base y cuenta operativa', owner_team: 'implementation' as const, status: 'completed' as const, callout: 'Incluye configuracion inicial y branding enterprise.' },
    { key: 'payment_method', title: 'Configurar metodo de pago y callback productivo', owner_team: 'finance' as const, status: 'pending' as const },
    { key: 'first_warehouse', title: 'Crear primera bodega, muelles y equipo', owner_team: 'ops' as const, status: 'pending' as const },
    { key: 'first_offer', title: 'Publicar primer viaje con settlement trazable', owner_team: 'ops' as const, status: 'pending' as const },
    { key: 'first_payment', title: 'Completar primer pago y webhook trace', owner_team: 'finance' as const, status: 'pending' as const },
    { key: 'first_dashboard', title: 'Validar control tower, wallet y corporativo', owner_team: 'success' as const, status: 'pending' as const },
    { key: 'first_internal_user', title: 'Invitar owner, ops lead y finance lead', owner_team: 'implementation' as const, status: 'pending' as const },
];

export const ONBOARDING_CHECKLISTS: Record<OnboardingChecklist['persona'], OnboardingChecklist> = {
    'Owner/CEO': {
        motion: 'Enterprise B2B',
        onboarding_model: 'assisted_implementation',
        support_model: 'extended_hours_on_call_critical',
        persona: 'Owner/CEO',
        checklist: onboardingBaseChecklist.map((item) => ({
            ...item,
            notes: item.key === 'first_dashboard' ? 'Mostrar control multiempresa, treasury y trazabilidad admin.' : null,
        })),
        bootstrap_path: '/supabase/seeds/enterprise_bootstrap_tenant.sql',
        playbook_path: '/docs/playbooks/implementation-owner-ceo.md',
    },
    'Ops lead': {
        motion: 'Enterprise B2B',
        onboarding_model: 'assisted_implementation',
        support_model: 'extended_hours_on_call_critical',
        persona: 'Ops lead',
        checklist: onboardingBaseChecklist.map((item) => ({
            ...item,
            notes: item.key === 'first_warehouse' ? 'Priorizar citas, receipts, dispatches e incidentes.' : null,
        })),
        bootstrap_path: '/supabase/seeds/enterprise_bootstrap_tenant.sql',
        playbook_path: '/docs/playbooks/implementation-ops-lead.md',
    },
    'Finance lead': {
        motion: 'Enterprise B2B',
        onboarding_model: 'assisted_implementation',
        support_model: 'extended_hours_on_call_critical',
        persona: 'Finance lead',
        checklist: onboardingBaseChecklist.map((item) => ({
            ...item,
            notes: item.key === 'first_payment' ? 'Validar payment webhook, wallet settlement, withdrawal y lending snapshot.' : null,
        })),
        bootstrap_path: '/supabase/seeds/enterprise_bootstrap_tenant.sql',
        playbook_path: '/docs/playbooks/implementation-finance-lead.md',
    },
};

export function getCountryRegistryEntry(countryCode?: string | null) {
    return COUNTRY_REGISTRY.find((entry) => entry.country_code === countryCode) || COUNTRY_REGISTRY[0];
}

export function getProviderAdapters(countryCode?: string | null) {
    const resolvedCountryCode = getCountryRegistryEntry(countryCode).country_code;
    return PROVIDER_ADAPTERS.filter((item) => item.country_code === resolvedCountryCode);
}

export function getFeatureFlagValue(
    flags: FeatureFlagSnapshot[],
    key: string,
    countryCode?: string | null
) {
    const countryMatch = flags.find((flag) => flag.key === key && flag.country_code === countryCode);
    if (countryMatch) {
        return countryMatch;
    }

    return flags.find((flag) => flag.key === key && !flag.country_code) || null;
}

export function buildMarketContext(options?: {
    countryCode?: string | null;
    locale?: string | null;
    flags?: FeatureFlagSnapshot[];
}): MarketContext {
    const flags = options?.flags || [];
    const country = getCountryRegistryEntry(options?.countryCode);
    const marketOpenFlag = getFeatureFlagValue(flags, 'market_open', country.country_code);
    const visibilityFlag = getFeatureFlagValue(flags, 'andean_country_visibility');
    const visibleCountries = Array.isArray(visibilityFlag?.payload?.visible_countries)
        ? visibilityFlag?.payload?.visible_countries as string[]
        : ['CO', 'PE', 'EC', 'BR'];

    return {
        current_country_code: country.country_code,
        current_locale: options?.locale || country.locale_default,
        current_currency: country.currency_code,
        timezone: country.timezone_default,
        country,
        available_countries: COUNTRY_REGISTRY.map((entry) => ({
            ...entry,
            is_visible: visibleCountries.includes(entry.country_code) && entry.is_visible,
        })),
        provider_adapters: getProviderAdapters(country.country_code),
        feature_flags: flags,
        visibility: {
            market_open: Boolean(marketOpenFlag?.enabled ?? country.feature_flags.market_open),
            backend_ready: country.is_backend_ready,
            visible_in_ui: visibleCountries.includes(country.country_code) && country.is_visible,
        },
        commercial_motion: 'Enterprise B2B',
    };
}
