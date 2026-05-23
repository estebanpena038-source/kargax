import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeatureFlagSnapshot } from '@/lib/platform/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>;

const ENTERPRISE_EXPERIENCE_KEY = 'enterprise_experience_mode';
const DEFAULT_FLAGS: Array<Omit<FeatureFlagSnapshot, 'source'>> = [
    { key: 'market_open', enabled: true, scope: 'global', description: 'Mercado principal activo', country_code: null, payload: {} },
    { key: ENTERPRISE_EXPERIENCE_KEY, enabled: true, scope: 'global', description: 'Experiencia publica enterprise', country_code: null, payload: { owner_persona: 'Owner/CEO' } },
    { key: 'async_notifications', enabled: true, scope: 'global', description: 'Notificaciones asincronas', country_code: null, payload: {} },
    { key: 'replay_actions', enabled: true, scope: 'global', description: 'Replay seguro desde admin', country_code: null, payload: {} },
    { key: 'andean_country_visibility', enabled: true, scope: 'global', description: 'Visibilidad de paises andinos backend-ready', country_code: null, payload: { visible_countries: ['CO', 'PE', 'EC'] } },
    { key: 'degraded_mode_wallet', enabled: false, scope: 'global', description: 'Degradacion explicita de wallet', country_code: null, payload: {} },
    { key: 'degraded_mode_warehouse', enabled: false, scope: 'global', description: 'Degradacion explicita de warehouse', country_code: null, payload: {} },
    { key: 'lending_enabled', enabled: false, scope: 'global', description: 'Habilita adelantos/credito KargaX. Pausado para piloto.', country_code: null, payload: { paused_reason: 'pilot_focus' } },
    { key: 'pilot_generous_limits', enabled: true, scope: 'global', description: 'Limites generosos para cuentas piloto con expiracion controlada.', country_code: null, payload: { default_days: 90 } },
    { key: 'automatic_payouts_enabled', enabled: false, scope: 'global', description: 'Habilita retiros automaticos cuando los adaptadores esten listos.', country_code: null, payload: { providers: ['wompi', 'nequi'] } },
    { key: 'express_payment_enabled', enabled: false, scope: 'global', description: 'Pago expres pausado hasta capital, disputa y cron auditado.', country_code: null, payload: { pilot_status: 'paused' } },
    { key: 'live_trip_tracking_enabled', enabled: true, scope: 'global', description: 'Tracking PWA foreground para viajes asignados.', country_code: null, payload: { mode: 'pwa_foreground' } },
    { key: 'market_open', enabled: true, scope: 'country', description: 'CO activo', country_code: 'CO', payload: { status: 'active' } },
    { key: 'market_open', enabled: false, scope: 'country', description: 'PE activacion controlada', country_code: 'PE', payload: { status: 'controlled_rollout' } },
    { key: 'market_open', enabled: false, scope: 'country', description: 'EC activacion controlada', country_code: 'EC', payload: { status: 'controlled_rollout' } },
];

const ENV_FLAG_MAP: Record<string, string[]> = {
    [ENTERPRISE_EXPERIENCE_KEY]: ['NEXT_PUBLIC_ENTERPRISE_EXPERIENCE_MODE'],
    async_notifications: ['NEXT_PUBLIC_ASYNC_NOTIFICATIONS'],
    replay_actions: ['NEXT_PUBLIC_REPLAY_ACTIONS'],
    degraded_mode_wallet: ['NEXT_PUBLIC_DEGRADED_MODE_WALLET'],
    degraded_mode_warehouse: ['NEXT_PUBLIC_DEGRADED_MODE_WAREHOUSE'],
    lending_enabled: ['NEXT_PUBLIC_LENDING_ENABLED'],
    pilot_generous_limits: ['NEXT_PUBLIC_PILOT_GENEROUS_LIMITS'],
    automatic_payouts_enabled: ['NEXT_PUBLIC_AUTOMATIC_PAYOUTS_ENABLED'],
    express_payment_enabled: ['NEXT_PUBLIC_EXPRESS_PAYMENT_ENABLED'],
    live_trip_tracking_enabled: ['NEXT_PUBLIC_LIVE_TRIP_TRACKING_ENABLED'],
};

function parseEnvBoolean(value: string | undefined, fallback: boolean) {
    if (value == null || value === '') {
        return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function normalizeDatabaseFlag(row: Record<string, unknown>): FeatureFlagSnapshot {
    const rawKey = String(row.key || '');
    const normalizedKey = rawKey;
    const countryCode = typeof row.country_code === 'string' ? row.country_code : null;
    const rawPayload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? row.payload as Record<string, unknown>
        : {};
    const payload = rawPayload;
    const rawDescription = typeof row.description === 'string' ? row.description : null;
    const description = normalizedKey === 'market_open' && countryCode === 'PE'
            ? 'PE activacion controlada'
            : normalizedKey === 'market_open' && countryCode === 'EC'
                ? 'EC activacion controlada'
                : rawDescription;

    return {
        key: normalizedKey,
        enabled: Boolean(row.enabled),
        scope: row.scope === 'country' ? 'country' : 'global',
        description,
        country_code: countryCode,
        payload,
        source: 'database',
    };
}

export async function getFeatureFlags(supabaseAdmin?: AdminClient | null): Promise<FeatureFlagSnapshot[]> {
    const defaults = DEFAULT_FLAGS.map((flag) => ({
        ...flag,
        source: 'default' as const,
    }));

    const merged = new Map<string, FeatureFlagSnapshot>();

    for (const flag of defaults) {
        merged.set(`${flag.key}:${flag.country_code || 'global'}`, flag);
    }

    if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
            .from('feature_flags')
            .select('key, enabled, scope, description, country_code, payload');

        if (!error) {
            for (const row of (data || []) as Array<Record<string, unknown>>) {
                const normalized = normalizeDatabaseFlag(row);
                merged.set(`${normalized.key}:${normalized.country_code || 'global'}`, normalized);
            }
        }
    }

    for (const [key, envNames] of Object.entries(ENV_FLAG_MAP)) {
        const existingGlobal = merged.get(`${key}:global`);
        if (!existingGlobal) {
            continue;
        }

        const overrideName = envNames.find((envName) => process.env[envName] != null);
        merged.set(`${key}:global`, {
            ...existingGlobal,
            enabled: parseEnvBoolean(overrideName ? process.env[overrideName] : undefined, existingGlobal.enabled),
            source: overrideName ? 'env' : existingGlobal.source,
        });
    }

    return Array.from(merged.values());
}

export function getFeatureFlagMap(flags: FeatureFlagSnapshot[]) {
    return new Map(flags.map((flag) => [`${flag.key}:${flag.country_code || 'global'}`, flag]));
}

export function isFeatureFlagEnabled(flags: FeatureFlagSnapshot[], key: string, countryCode?: string | null) {
    const flagMap = getFeatureFlagMap(flags);
    return Boolean(
        (countryCode ? flagMap.get(`${key}:${countryCode}`)?.enabled : undefined)
        ?? flagMap.get(`${key}:global`)?.enabled
    );
}
